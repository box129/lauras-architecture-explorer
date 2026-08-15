"""L3: explanation composition -- turning already-verified claims into
coherent, honest prose.

Pipeline position (see ``core.models.architectural_explanation`` module
docstring for the full picture): this module is the LAST stage --
``compose_architectural_explanation`` runs strictly AFTER L2 verification
has already assigned every claim's ``support_status``. It never verifies
anything itself, never invents a new architectural fact, and never
upgrades/downgrades a claim's support status. Its only job is to organize
an already-verified ``tuple[ArchitecturalClaim, ...]`` into a human-
readable ``narrative`` and hand back a valid ``ArchitecturalExplanation``.

Design decision: template-based, not LLM-assisted
--------------------------------------------------------------------------
This composer is deliberately **template-based**: the narrative is
assembled purely by deterministic string formatting over
``claim.statement`` (already deterministically rendered by
``render_proposition_statement`` upstream -- never LLM prose) and
``claim.support_status``. No ``InvestigationModel`` is accepted or used
anywhere in this module.

Why, given the task brief explicitly allows an LLM-assisted alternative:
the brief's own bar for going LLM-assisted is "a concrete, testable way to
bound LLM-introduced text to only rephrase (never add facts to) the given
claims" -- and the cheapest mechanical check available (e.g. "does the
claim's statement text appear verbatim, or close to it, in the
narrative") cannot actually bound what an LLM adds; it can only fail to
notice additions that happen to land near a legitimate sentence. There is
no cheap, reliable way to mechanically prove a generated paragraph
introduced zero new facts short of re-verifying every sentence against
the claim set, which is exactly the "NLP-level sentence attribution"
``ArchitecturalExplanation``'s own docstring says is out of scope. Since
the task explicitly prioritizes precision and honesty over polish for
this first vertical slice, and a template composed directly from
deterministically-rendered claim statements is TRIVIALLY provable to
introduce no new facts (it literally contains no text that didn't come
from a claim statement or a small fixed set of connective/labeling
phrases), the template-based approach is the only one that lets the
"no new facts" property be proven by construction, not merely tested
for absence of counterexamples. See ``tests/test_explanation_composer.py``
for the empirical proof this module is held to.

Narrative structure
--------------------------------------------------------------------------
The composed narrative always separates claims into two clearly labeled
sections, in this fixed order:

1. "What Laura's could establish:" -- one bullet line per ``supported``
   claim, stating ``claim.statement`` as-is (it is already a
   deterministically rendered factual sentence, e.g. "A calls B.").
2. "What Laura's could not establish:" -- one bullet line per
   ``insufficient_evidence`` claim, phrased with an explicit,
   non-refutational caveat (e.g. "Laura's did not have sufficient
   deterministic evidence to establish that A calls B.") -- never
   "A does not call B." (that would assert the opposite, which
   ``insufficient_evidence`` never means) and never presented with the
   same confidence as a supported claim.

A ``contradicted`` claim (not produced by this slice's verifier today,
but a valid value of ``ClaimSupportStatus``) is handled defensively in a
third, equally explicit section, so this composer never silently drops a
claim or mis-files it under "supported" -- see ``_CONTRADICTED_HEADER``.

If ``claims`` is empty, the narrative is a short, honest sentence saying
no claims were available -- never a fabricated "no architectural facts
were found" style conclusion (Laura's did not conclude that; there was
simply nothing to explain), and never an exception.

``explanation_id``
--------------------------------------------------------------------------
Accepted as-is from the caller rather than re-derived here. L2 (the
verification service) is the natural owner of run/target scoping and
already has everything (``run_id``, ``target_kind``, ``target_id``, and
the concrete claim id set) needed to derive a stable id the same way
``core.models.provenance._stable_id`` does, if/when that's wired up --
duplicating that derivation here, one layer downstream, would risk the
two callers disagreeing on the scheme. Accepting the id as a required
keyword-only argument keeps this function a pure, total mapping from
(explicit id, verified claims) -> ``ArchitecturalExplanation``, with no
hidden hashing policy of its own to keep in sync with anyone else's.
"""

from __future__ import annotations

from syntax_tree_refurbished.core.models.architectural_explanation import (
    ArchitecturalExplanation,
    ExplanationTargetKind,
)
from syntax_tree_refurbished.core.models.provenance import ArchitecturalClaim, ProducerInfo


_SUPPORTED_HEADER = "What Laura's could establish:"
_INSUFFICIENT_HEADER = "What Laura's could not establish:"
_CONTRADICTED_HEADER = "What Laura's evidence contradicts:"

_EMPTY_NARRATIVE = (
    "Laura's had no verified claims available to explain for this target "
    "-- no architectural facts, established or otherwise, are reported here."
)


def _supported_line(claim: ArchitecturalClaim) -> str:
    # claim.statement is already a complete, deterministically rendered
    # factual sentence (e.g. "A calls B."). Presented as-is, with no
    # hedging, since a supported claim earns full confidence.
    return f"- {claim.statement}"


def _insufficient_line(claim: ArchitecturalClaim) -> str:
    # Strip the trailing period so the statement can be embedded mid
    # sentence inside an explicit, non-refutational caveat. Never phrase
    # this as a negation of the claim (that would assert the opposite,
    # which insufficient_evidence does not mean). The statement is an
    # entity-led sentence (e.g. "OrderController calls FraudService.") --
    # entity names are proper nouns, so it is embedded verbatim, not
    # lowercased.
    bare = claim.statement.rstrip(".")
    return f"- Laura's did not have sufficient deterministic evidence to establish that {bare}."


def _contradicted_line(claim: ArchitecturalClaim) -> str:
    bare = claim.statement.rstrip(".")
    return f"- Laura's found evidence that contradicts the claim that {bare}."


def _compose_narrative(claims: tuple[ArchitecturalClaim, ...]) -> str:
    if not claims:
        return _EMPTY_NARRATIVE

    supported = tuple(c for c in claims if c.support_status == "supported")
    insufficient = tuple(c for c in claims if c.support_status == "insufficient_evidence")
    contradicted = tuple(c for c in claims if c.support_status == "contradicted")

    sections: list[str] = []

    if supported:
        lines = "\n".join(_supported_line(c) for c in supported)
        sections.append(f"{_SUPPORTED_HEADER}\n{lines}")

    if insufficient:
        lines = "\n".join(_insufficient_line(c) for c in insufficient)
        sections.append(f"{_INSUFFICIENT_HEADER}\n{lines}")

    if contradicted:
        lines = "\n".join(_contradicted_line(c) for c in contradicted)
        sections.append(f"{_CONTRADICTED_HEADER}\n{lines}")

    return "\n\n".join(sections)


def compose_architectural_explanation(
    *,
    explanation_id: str,
    run_id: str,
    target_kind: ExplanationTargetKind,
    target_id: str,
    claims: tuple[ArchitecturalClaim, ...],
    producer: ProducerInfo,
) -> ArchitecturalExplanation:
    """Compose an ``ArchitecturalExplanation`` from already-verified claims.

    MUST NOT introduce any architectural fact not already present in one
    of ``claims`` -- every factual sentence in the composed narrative is
    either ``claim.statement`` verbatim (supported claims) or
    ``claim.statement`` embedded, verbatim minus its trailing period,
    inside a fixed honest-caveat template (insufficient-evidence /
    contradicted claims). No other source of text is consulted.

    ``claims`` passes through to ``ArchitecturalExplanation.claims``
    completely unchanged (same tuple identity) -- this function composes
    prose ABOUT the claims, it never filters, reorders, or rewrites them.
    """
    narrative = _compose_narrative(claims)
    return ArchitecturalExplanation(
        id=explanation_id,
        run_id=run_id,
        target_kind=target_kind,
        target_id=target_id,
        claims=claims,
        narrative=narrative,
        producer=producer,
    )
