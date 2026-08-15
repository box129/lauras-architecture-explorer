"""V2 vertical-slice contract: evidence -> structured LLM claim proposal ->
deterministic verification -> verified claim -> explanation composition.

This module defines the shared data contract every downstream workstream
(L1 proposer, L2 verification service, L3 explanation composer, L4
frontend) builds against. It is deliberately narrow: types and validation
only, no proposal/verification/composition logic. "Do not implement broad
architectural inference yet" -- the first slice covers exactly the three
proposition shapes the deterministic core already supports.

The pipeline, and where each stage's output type is defined
--------------------------------------------------------------------------
    bounded repository evidence            BoundedEvidence (this module)
      -> LLM claim proposal                ClaimProposal (this module)
      -> deterministic verification        verify_proposition (existing,
                                            core.models.provenance --
                                            UNCHANGED, reused as-is)
      -> verified claim                    ArchitecturalClaim (existing,
                                            core.models.provenance -- see
                                            "Why no new VerifiedArchitecturalClaim
                                            type" below)
      -> explanation composition           ArchitecturalExplanation (this
                                            module)

Why no new "VerifiedArchitecturalClaim" type
--------------------------------------------------------------------------
The task brief asks for a ``VerifiedArchitecturalClaim`` DTO carrying:
claim id, proposition, canonical/verifier-bound statement, epistemic
type, support status, evidence chain, source spans, producer information.
``core.models.provenance.ArchitecturalClaim`` already carries every one
of those fields (``id``, ``proposition``, ``statement`` -- rendered
deterministically from the proposition via ``render_proposition_statement``,
never LLM prose -- ``epistemic_type``, ``support_status``,
``evidence_chain`` -- whose items carry source spans/regions --
``producer``), and is already produced by the existing, tested
``claim_from_proposition``/``verify_proposition`` pipeline (see
``app.provenance.relation_adapter``, exercised end-to-end by the J-V0/J2/
J3 experiments and the real-repository pilot). Introducing a parallel
type would either (a) duplicate that exact shape for no reason, or (b)
diverge from it, risking two different "verified claim" representations
in the same codebase. **A "VerifiedArchitecturalClaim" in this slice IS
an ``ArchitecturalClaim`` whose ``proposition`` came from a
vocabulary-checked ``ClaimProposal`` and whose ``support_status`` came
from ``verify_proposition`` against real, persisted
``ObservedProgramRelation``s -- nothing new is added to the type, only a
constraint on how it was produced.** L2 (the verification service) is
responsible for that constraint; this module only defines the input
(``ClaimProposal``) that constraint applies to.

Scope: the first-slice proposition vocabulary
--------------------------------------------------------------------------
Only these three (``kind``, ``relation_kind``) shapes may appear in a
``ClaimProposal`` for this slice -- exactly the shapes
``core.models.provenance.verify_proposition`` can mechanically prove or
fail to prove:

- ``direct_relation`` / ``calls``
- ``direct_relation`` / ``inherits``
- ``reachability`` / ``calls``

Not ``reachability``/``inherits`` (unsupported by ``verify_proposition``
itself -- see that function's own docstring), not ``contains``/``imports``
(``ClaimProposition``'s own vocabulary technically permits these as
``relation_kind`` values, since it mirrors the broader
``ProgramRelationKind``, but this slice does not offer them to the LLM or
accept them back), and never a behavioral proposition (there is no
``relation_kind`` for "performs fraud detection" or similar -- structurally
impossible to construct as a ``ClaimProposition`` at all, unchanged from
every prior workstream in this project). A proposal outside this
vocabulary is REJECTED before verification, never silently dropped or
forced into a shape that doesn't fit -- see ``ClaimProposal.__post_init__``.

The LLM is a proposer only
--------------------------------------------------------------------------
Nothing in ``ClaimProposal`` can express or influence support status.
``proposed_statement`` is presentation-only prose the LLM may suggest;
callers must never treat it as authoritative or use it in place of
``render_proposition_statement(proposition)`` when a claim is later
verified. The structured ``ClaimProposition`` -- not the LLM's wording --
remains semantic truth throughout this pipeline, exactly as it already
is for the deterministic-only extractors.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.core.models.provenance import (
    ArchitecturalClaim,
    ClaimProposition,
    ProducerInfo,
    PropositionKind,
)
from syntax_tree_refurbished.core.models.program_relation import ProgramRelationKind


#: The first-slice proposition vocabulary -- see module docstring "Scope".
#: A (kind, relation_kind) pair not in this set can never appear in a
#: ClaimProposal, checked structurally at construction time, not by
#: convention.
ALLOWED_PROPOSITION_SHAPES: frozenset[tuple[PropositionKind, ProgramRelationKind]] = frozenset(
    {
        ("direct_relation", "calls"),
        ("direct_relation", "inherits"),
        ("reachability", "calls"),
    }
)


def _validate_literal(value: str, allowed: tuple[str, ...], field_name: str) -> None:
    if value not in allowed:
        raise ValueError(f"{field_name} must be one of {allowed}, got {value!r}")


# ---------------------------------------------------------------------------
# Input: bounded structured evidence handed to the proposer
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BoundedEvidence:
    """The ONLY evidence a claim proposer may see for one proposal request
    -- a deliberately bounded, structured neighborhood around a single
    target entity, never the entire repository dumped into a prompt (per
    the task brief). Real ``ParsedSymbol``/``ObservedProgramRelation``
    records from one specific analysis run -- L2 is responsible for
    selecting the bounded neighborhood (e.g. the target entity plus its
    direct callers/callees/bases within some hop limit); this module only
    defines the resulting shape.

    A proposer (L1) must never invent an entity id that isn't present in
    ``symbols`` here -- see ``ClaimProposal.__post_init__``, which enforces
    this is checkable (not merely convention) via ``validate_claim_proposal``
    below.
    """

    run_id: str
    target_entity_id: str
    symbols: tuple[ParsedSymbol, ...]
    relations: tuple[ObservedProgramRelation, ...]

    def __post_init__(self) -> None:
        if not self.run_id:
            raise ValueError("BoundedEvidence requires a non-empty run_id")
        if not self.target_entity_id:
            raise ValueError("BoundedEvidence requires a non-empty target_entity_id")
        symbol_ids = {s.id for s in self.symbols}
        if self.target_entity_id not in symbol_ids:
            raise ValueError(
                "BoundedEvidence.target_entity_id must itself be one of the entities "
                "in `symbols` -- the target is always part of its own bounded evidence"
            )
        mismatched_run_symbols = [s.id for s in self.symbols if s.run_id != self.run_id]
        if mismatched_run_symbols:
            raise ValueError(
                f"BoundedEvidence.symbols must all share run_id {self.run_id!r}, "
                f"found symbols from a different run: {mismatched_run_symbols!r}"
            )
        mismatched_run_relations = [r.id for r in self.relations if r.run_id != self.run_id]
        if mismatched_run_relations:
            raise ValueError(
                f"BoundedEvidence.relations must all share run_id {self.run_id!r}, "
                f"found relations from a different run: {mismatched_run_relations!r}"
            )

    @property
    def entity_ids(self) -> frozenset[str]:
        """Every real entity id this evidence set makes available -- the
        only ids a proposal built from this evidence may reference."""
        return frozenset(s.id for s in self.symbols)


# ---------------------------------------------------------------------------
# Output of the proposer (L1) / input to verification (L2)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ClaimProposal:
    """One LLM-proposed, not-yet-verified structural claim. Produced by a
    ``ClaimProposer`` (see ``app.architectural_explanation.claim_proposer``)
    from one ``BoundedEvidence`` set. Carries no support status -- that is
    exclusively ``verify_proposition``'s job, downstream, in L2.
    """

    proposition: ClaimProposition
    proposed_statement: str | None
    producer: ProducerInfo

    def __post_init__(self) -> None:
        shape = (self.proposition.kind, self.proposition.relation_kind)
        if shape not in ALLOWED_PROPOSITION_SHAPES:
            raise ValueError(
                f"ClaimProposal proposition shape {shape!r} is outside this slice's "
                f"vocabulary; allowed shapes are {sorted(ALLOWED_PROPOSITION_SHAPES)!r}. "
                "Reject out-of-vocabulary proposals before verification -- never force "
                "one into a shape that doesn't fit."
            )
        if self.producer.producer_type != "llm":
            raise ValueError(
                f"ClaimProposal.producer.producer_type must be 'llm', got "
                f"{self.producer.producer_type!r} -- a proposal is, by definition, an "
                "LLM's suggestion, not an extractor's or a human's"
            )

    @staticmethod
    def from_dict(d: dict, *, producer: ProducerInfo) -> "ClaimProposal":
        """Build a ClaimProposal from a proposer's raw structured output
        (e.g. parsed JSON) plus the caller-supplied producer metadata (the
        proposer never gets to self-report its own producer info -- L2
        supplies it, mirroring how epistemic_type/producer are always
        caller-supplied for ``claim_from_proposition``)."""
        prop = d["proposition"]
        proposition = ClaimProposition(
            kind=prop["kind"],
            subject_entity_id=prop["subject_entity_id"],
            relation_kind=prop["relation_kind"],
            object_entity_id=prop["object_entity_id"],
            path_entity_ids=tuple(prop.get("path_entity_ids", ())),
        )
        return ClaimProposal(
            proposition=proposition,
            proposed_statement=d.get("proposed_statement"),
            producer=producer,
        )


class MalformedClaimProposal(ValueError):
    """Raised by ``validate_claim_proposal`` when a raw proposer output
    cannot even be parsed into a ``ClaimProposal`` (missing/wrong-typed
    fields) -- distinct from a well-formed but out-of-vocabulary or
    evidence-violating proposal (``ClaimProposal.__post_init__`` /
    ``validate_claim_proposal``'s own ValueError), so callers can log/count
    the two failure modes separately if useful, while treating both as
    "never verify this" the same way."""


def validate_claim_proposal(proposal: ClaimProposal, evidence: BoundedEvidence) -> None:
    """Second-layer validation beyond ``ClaimProposal.__post_init__``'s own
    vocabulary check: every entity id the proposal references (subject,
    object, and every path hop) must be one of the real entity ids the
    proposer was actually shown in ``evidence`` -- never an id the LLM
    invented or recalled from outside its bounded context. Raises
    ``ValueError`` (never silently drops/repairs) on any violation.
    """
    referenced = {proposal.proposition.subject_entity_id, proposal.proposition.object_entity_id}
    referenced.update(proposal.proposition.path_entity_ids)
    unknown = referenced - evidence.entity_ids
    if unknown:
        raise ValueError(
            f"ClaimProposal references entity id(s) not present in its own bounded "
            f"evidence: {sorted(unknown)!r} -- a proposer must never reference an "
            "entity it wasn't shown"
        )
    if evidence.run_id and proposal.proposition.subject_entity_id not in evidence.entity_ids:
        # Redundant with the check above (kept as an explicit, separately
        # readable assertion for the single most common case: the subject
        # itself, not just some path hop, being unknown).
        raise ValueError("ClaimProposal.proposition.subject_entity_id not in bounded evidence")


# ---------------------------------------------------------------------------
# Explanation composition (L3 output / L4 input)
# ---------------------------------------------------------------------------


ExplanationTargetKind = Literal["entity", "lens", "module"]


@dataclass(frozen=True)
class ArchitecturalExplanation:
    """Composed, human-readable explanation of a target entity/lens/module,
    built strictly from already-verified claims (``ArchitecturalClaim``,
    ``support_status`` already determined by ``verify_proposition`` -- this
    type carries no verification logic or support-status computation of its
    own). Produced by an explanation composer (L3) from
    ``ArchitecturalClaim`` results L2 already verified.

    ``narrative`` is free-form prose, but every FACTUAL sentence in it must
    be traceable to one or more ids in ``claims`` (L3's own responsibility
    to enforce when composing -- this type just carries the ordered claim
    list the narrative is required to be grounded in). This type does not
    itself validate that constraint (that would require NLP-level sentence
    attribution, out of scope for a data contract) -- L3's tests are
    responsible for proving its composer honors it.
    """

    id: str
    run_id: str
    target_kind: ExplanationTargetKind
    target_id: str
    claims: tuple[ArchitecturalClaim, ...]
    narrative: str
    producer: ProducerInfo
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("ArchitecturalExplanation requires a non-empty id")
        if not self.run_id:
            raise ValueError("ArchitecturalExplanation requires a non-empty run_id")
        _validate_literal(self.target_kind, ("entity", "lens", "module"), "target_kind")
        if not self.target_id:
            raise ValueError("ArchitecturalExplanation requires a non-empty target_id")
        mismatched = [c.id for c in self.claims if c.run_id != self.run_id]
        if mismatched:
            raise ValueError(
                f"ArchitecturalExplanation.claims must all share run_id {self.run_id!r}, "
                f"found claims from a different run: {mismatched!r}"
            )

    @property
    def supported_claims(self) -> tuple[ArchitecturalClaim, ...]:
        return tuple(c for c in self.claims if c.support_status == "supported")

    @property
    def insufficient_evidence_claims(self) -> tuple[ArchitecturalClaim, ...]:
        return tuple(c for c in self.claims if c.support_status == "insufficient_evidence")
