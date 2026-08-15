"""Adapter: ClaimProposition + ObservedProgramRelation(s) -> RelationshipEvidence
-> EvidenceChain -> ArchitecturalClaim.

This module is the one place that implements the one-directional flow
documented in ``core.models.program_relation``'s module docstring, now
routed through the machine-verifiable proposition semantics introduced by
``core.models.provenance`` (see that module's "Machine-verifiable claim
semantics" docstring section):

    extractor --produces--> ObservedProgramRelation
                                    |
                                    v  (this module, via verify_proposition)
                           RelationshipEvidence -> EvidenceChain
                                    |
                                    v
                           ArchitecturalClaim (carries the ClaimProposition,
                                                and a statement RENDERED from
                                                it -- never caller prose)

It is a *reshaping/framing* step, matching the pattern already established
by ``claim_projection.py`` in this package: it does not run any new
extraction, call an LLM, or discover claims on its own. Callers hand it a
``ClaimProposition`` (the structured, machine-checkable assertion), a pool of
candidate ``ObservedProgramRelation`` evidence to search, and claim-framing
info (an epistemic type, subject symbol ids, a ``ProducerInfo``, and
optionally a cosmetic ``entity_display_names`` lookup); it produces a
fully-formed ``ArchitecturalClaim`` whose ``EvidenceChain`` cites exactly the
relations that actually proved the proposition -- no more, no less -- and
whose displayed ``statement`` is generated deterministically from the same
proposition that was verified.

Why this module no longer checks "does the chain exist and connect"
----------------------------------------------------------------------
Round 1 of this adapter computed support_status from a purely structural
check: at least one relation, none unresolved, and (for multi-hop) each
relation's target feeding the next relation's source. That check proves a
chain is *coherent*, but proves nothing about whether the chain actually
entails the *specific* thing a claim asserts -- a real, connected chain
"Controller -> Service -> PaymentService" would pass that check and could be
cited as "supporting" an unrelated or overreaching claim, e.g. a direct claim
that Controller calls PaymentService (never actually observed, only
reachable via Service), because nothing compared the evidence against what
was actually being claimed.

This module now delegates that judgement entirely to
``core.models.provenance.verify_proposition``, which checks a structured
``ClaimProposition`` against real relation evidence with no natural-language
interpretation involved (see that function's own extensive docstring for the
exact support policy, including why resolved-only evidence is required and
why a direct_relation proposition can never be satisfied by a multi-hop
chain). This adapter's job is narrow: call it correctly, translate its
verdict into ``support_status`` and an ``EvidenceChain``, and never
second-guess or re-implement the check itself.

Relation-kind mapping
----------------------
``ObservedProgramRelation.relation_kind`` (``ProgramRelationKind``) is a
strict subset of ``RelationshipEvidence.relationship_kind``
(``RelationshipKind``): both currently define "contains", "imports",
"calls", "inherits" with identical names, and ``RelationshipKind`` adds
"implements" / "references" / "other" that no extractor producing
``ObservedProgramRelation`` can emit yet. ``_RELATION_KIND_TO_RELATIONSHIP_KIND``
below is the explicit, documented mapping between the two vocabularies --
today it is the identity mapping over the four shared names. It is kept as
an explicit dict (not just a cast) so that if either enum ever grows
independently of the other, the mismatch is caught here at the adapter
boundary with a clear error, rather than silently mis-labelling evidence.

Support / abstention policy (the important correctness property)
------------------------------------------------------------------
This adapter never lets a caller construct a "supported" claim from
evidence that does not actually entail the proposition being asserted.
Concretely:

1. All input relations are searched via ``verify_proposition(proposition,
   relations)`` -- the candidate pool is a search space, not an
   already-known-correct ordered chain a caller has pre-validated.
2. If ``verify_proposition`` reports ``supported=True``, ``support_status``
   is set to "supported" and the resulting ``EvidenceChain`` is built from
   *exactly* the relations named in ``matched_relation_ids`` (in path order
   for a reachability proposition), not the full candidate pool -- a claim's
   cited evidence should be precisely what proves it, not everything that
   merely happened to be available.
3. If ``verify_proposition`` reports ``supported=False``, ``support_status``
   is set to "insufficient_evidence" -- never "supported" -- and the
   chain's ``reasoning`` field carries ``verify_proposition``'s own
   ``.reason``, so it is always clear *why* verification failed. Per the
   Phase 4 support policy documented on ``verify_proposition``, any relation
   ids named in ``matched_relation_ids`` even on a failed verification (e.g.
   the matched prefix of an incomplete reachability path) are still cited as
   evidence, for diagnostics -- retaining a partially-relevant match is
   useful context for a human or a future repair pass, and it does not
   change the support_status, which is driven only by
   ``verify_proposition.supported``.

This mirrors the corrected evaluation-harness semantics this adapter was
built alongside: every SUPPORTED claim must resolve to real evidence that
was checked against what the claim actually asserts, and every
INSUFFICIENT_EVIDENCE claim must remain unsupported.

No arbitrary statement text, by construction (G3 correction)
----------------------------------------------------------------
Round 2 (G2) of this adapter accepted an independently-supplied ``statement``
string alongside the ``proposition`` being verified. ``verify_proposition``
correctly never consulted that text to decide support -- but G2 still
stored and surfaced the caller-supplied string verbatim as the resulting
claim's displayed text. That meant a caller could pass a proposition that
verified TRUE (e.g. "Controller calls Service") alongside a completely
unrelated or false ``statement`` (e.g. "PaymentService performs fraud
detection") and get back a ``support_status="supported"`` claim carrying
that false, unverified prose as its user-visible text. A verifier being
correct about *support_status* is not enough if the *displayed claim text*
can still say something else entirely -- a SUPPORTED user-visible claim must
be semantically bound to the verified proposition, not just accompanied by
it.

This module now removes that gap structurally rather than by convention:
``claim_from_proposition`` has **no ``statement`` parameter at all** for the
proposition-backed path (there is no legacy/citation-based path through this
adapter -- every claim this module builds carries a ``proposition``). The
only caller-supplied input that affects the displayed text is the optional,
purely cosmetic ``entity_display_names`` mapping, threaded straight through
to ``ArchitecturalClaim.create`` (which in turn calls
``render_proposition_statement`` -- see ``core.models.provenance``). There is
no code path anywhere in this module by which arbitrary prose could reach a
claim's ``statement`` field; the model layer's own ``ValueError`` guard in
``ArchitecturalClaim.create`` (raised if both ``proposition`` and
``statement`` are supplied together) exists as defense in depth, but this
adapter never gives it a reason to fire because it never passes
``statement=`` in the first place.

Scope boundary: "contradicted"
-------------------------------
Detecting a genuine contradiction requires comparing evidence against a
claim's *negation*. ``verify_proposition`` reports "not entailed", not
"positively refuted" -- for both direct_relation and reachability
propositions, "no matching resolved relation was found" is consistent with
either "the proposition is false" or "the evidence for it just hasn't been
collected/resolved yet," and this module has no sound, general way to tell
those apart from a ClaimProposition/ObservedProgramRelation pair alone (a
resolved relation with a *different* relation_kind or target for the same
subject is *evidence consistent with* a contradiction, but is not, on its
own, proof of one -- the same subject can legitimately have multiple
outgoing relations of different kinds/targets that coexist with the
asserted one being separately true, e.g. "A calls B" and "A imports C" are
not in tension). Given that, this module deliberately does not attempt any
automatic contradiction detection (see the module's accompanying research
notes for the fuller reasoning). It only supports "contradicted" as an
explicit pass-through: a caller that has already determined (by means
outside this adapter) that its own relations constitute refuting evidence
for the claim may request ``support_status="contradicted"`` via
``assert_contradicted=True``. This still requires at least one evidence
item (an empty chain can never carry a verdict); it deliberately does NOT
run ``verify_proposition`` at all in that case, because refuting evidence
for "A calls B" plausibly *is* the absence of that relation -- exactly the
point being asserted by the caller, not a defect in it. This scope boundary
is unchanged from round 1.

G2 also let ``assert_contradicted=True`` take the same arbitrary
``statement`` -- the identical gap, just on the contradiction path instead
of the support path. The fix here is the same and, deliberately, produces
the SAME rendered text either way: a contradicted claim, like a supported
one, renders its statement via ``render_proposition_statement(proposition,
entity_display_names=...)``. The reasoning for rendering identically
regardless of verdict: ``statement`` describes the PROPOSITION being
evaluated ("A calls B."), not the verdict reached about it -- the verdict
lives entirely in ``support_status``, which is a separate field a reader
already checks. Rendering a different sentence for "contradicted" (e.g. "A
does not call B.") would require this module to editorialize prose around a
verdict it does not itself compute in the ``assert_contradicted`` path (the
caller determined that externally), and would reintroduce exactly the kind
of free-text surface this correction is trying to close off. Keeping the
statement verdict-invariant means the only way to know whether "A calls B."
is being asserted true, false, or unproven is to read ``support_status`` --
which is the whole point of separating the two fields in the first place.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence

from syntax_tree_refurbished.core.models.program_relation import (
    ObservedProgramRelation,
    ProgramRelationKind,
)
from syntax_tree_refurbished.core.models.provenance import (
    ArchitecturalClaim,
    ClaimEpistemicType,
    ClaimProposition,
    ClaimSupportStatus,
    ProducerInfo,
    RelationshipEvidence,
    RelationshipKind,
    verify_proposition,
)


SourceRegionResolver = Callable[[str, int, int], "str | None"]
"""``(path, start_line, end_line) -> source_region_id | None``.

Resolves a relation's raw source span into a real, dereferenceable
``SourceRegion`` id (creating and persisting the region on first lookup if
the caller's implementation does so -- see
``api.routes.architectural_explanation``'s ``_source_region_resolver`` for
the production implementation backed by ``SourceReader``/the run store).
Returns ``None`` when no region can be resolved (e.g. the file is no
longer readable) -- callers must never fabricate a region id in that case;
the evidence item's ``source_region_id`` simply stays unset and navigation
correctly stays unavailable for that item alone."""


_RELATION_KIND_TO_RELATIONSHIP_KIND: dict[ProgramRelationKind, RelationshipKind] = {
    "contains": "contains",
    "imports": "imports",
    "calls": "calls",
    "inherits": "inherits",
}
"""Explicit, documented mapping from the raw extractor-facing
ProgramRelationKind vocabulary to the claim-facing RelationshipKind
vocabulary. See the module docstring "Relation-kind mapping" section."""


class BrokenRelationChainError(ValueError):
    """Raised when the relations handed to this adapter cannot be built into
    an EvidenceChain at all (as opposed to building successfully but being
    judged insufficient -- see the module docstring's support/abstention
    policy for that case, which does NOT raise)."""


def _map_relation_kind(kind: ProgramRelationKind) -> RelationshipKind:
    try:
        return _RELATION_KIND_TO_RELATIONSHIP_KIND[kind]
    except KeyError as exc:  # pragma: no cover - ProgramRelationKind is a closed Literal
        raise BrokenRelationChainError(
            f"No RelationshipKind mapping is defined for ProgramRelationKind {kind!r}; "
            "the two vocabularies are expected to be kept in sync for the shared names "
            "(see core.models.program_relation.ProgramRelationKind's docstring)."
        ) from exc


def _default_evidence_description(relation: ObservedProgramRelation) -> str:
    span = (
        f"{relation.span_path}:{relation.span_start_line}-{relation.span_end_line}"
        if relation.span_path is not None
        else "no span"
    )
    return (
        f"{relation.relation_kind} relation {relation.source_entity_id} -> "
        f"{relation.target_entity_id}, observed by {relation.extractor_name}"
        f"@{relation.extractor_version} ({relation.resolution_status}, {span})"
    )


def _require_matching_run_id(
    relations: tuple[ObservedProgramRelation, ...], *, run_id: str
) -> None:
    for relation in relations:
        if relation.run_id != run_id:
            raise BrokenRelationChainError(
                f"relation {relation.id!r} belongs to run_id {relation.run_id!r}, "
                f"which does not match the claim's run_id {run_id!r}"
            )


def _select_relations_by_id(
    relations: tuple[ObservedProgramRelation, ...], ids: tuple[str, ...]
) -> tuple[ObservedProgramRelation, ...]:
    """Look up relations by id, in the order `ids` specifies (not the order
    they appear in `relations`) -- used to turn verify_proposition's
    matched_relation_ids (already in path order for reachability) into the
    ordered evidence sequence an EvidenceChain expects."""
    by_id = {relation.id: relation for relation in relations}
    return tuple(by_id[relation_id] for relation_id in ids)


def relationship_evidence_from_relations(
    relations: Sequence[ObservedProgramRelation],
    *,
    run_id: str,
    producer: ProducerInfo,
    evidence_description: Callable[[ObservedProgramRelation], str] | None = None,
    source_region_resolver: SourceRegionResolver | None = None,
) -> tuple[RelationshipEvidence, ...]:
    """Convert each ObservedProgramRelation into one RelationshipEvidence
    item, in input order, via RelationshipEvidence.create (deterministic
    ids). Every relation must belong to `run_id` -- an adapter silently
    re-stamping evidence from another run onto this one would be a
    provenance bug, so it is rejected loudly instead.

    ``resolution_basis``/``supporting_resolution_spans`` are carried
    straight through from the relation to the evidence item (both default
    to ``None``/``()`` on relations that needed no additional resolution
    evidence, so this is a no-op for ordinary directly-resolved relations)
    -- this is precisely what lets a claim's evidence chain expose *how* a
    relation like a constructor-binding-resolved call was resolved, not
    just that it was.

    ``source_region_resolver``, when given, is called with
    ``(relation.span_path, relation.span_start_line, relation.span_end_line)``
    for every relation whose span fields are all populated (they are
    all-or-nothing on ``ObservedProgramRelation`` -- see that class's
    docstring), and the resulting id (or ``None``) becomes the evidence
    item's ``source_region_id``. Relations with no span at all (e.g. a
    containment edge derived purely from symbol nesting, per
    ``RelationshipEvidence``'s own docstring) are never passed to the
    resolver and always get ``source_region_id=None`` -- there is no
    fabricated span to resolve. Omitting the resolver (the default)
    preserves the old behavior of every item having ``source_region_id=None``,
    which existing callers (e.g. tests that don't care about source
    navigation) can still rely on.
    """
    describe = evidence_description or _default_evidence_description
    relations = tuple(relations)
    _require_matching_run_id(relations, run_id=run_id)
    items: list[RelationshipEvidence] = []
    for relation in relations:
        source_region_id = None
        if (
            source_region_resolver is not None
            and relation.span_path is not None
            and relation.span_start_line is not None
            and relation.span_end_line is not None
        ):
            source_region_id = source_region_resolver(
                relation.span_path, relation.span_start_line, relation.span_end_line
            )
        items.append(
            RelationshipEvidence.create(
                run_id=run_id,
                relationship_kind=_map_relation_kind(relation.relation_kind),
                from_symbol_id=relation.source_entity_id,
                to_symbol_id=relation.target_entity_id,
                description=describe(relation),
                producer=producer,
                source_region_id=source_region_id,
                resolution_basis=relation.resolution_basis,
                supporting_resolution_spans=relation.supporting_resolution_spans,
            )
        )
    return tuple(items)


def claim_from_proposition(
    proposition: ClaimProposition,
    relations: Sequence[ObservedProgramRelation],
    *,
    run_id: str,
    epistemic_type: ClaimEpistemicType,
    producer: ProducerInfo,
    entity_display_names: Mapping[str, str] | None = None,
    subject_symbol_ids: tuple[str, ...] = (),
    related_lens_ids: tuple[str, ...] = (),
    confidence: float | None = None,
    evidence_description: Callable[[ObservedProgramRelation], str] | None = None,
    assert_contradicted: bool = False,
    source_region_resolver: SourceRegionResolver | None = None,
) -> ArchitecturalClaim:
    """Build one ArchitecturalClaim whose support_status is determined by
    checking `proposition` -- the structured, machine-checkable assertion --
    against `relations`, a candidate pool of ObservedProgramRelation
    evidence to search (NOT an already-known-correct ordered chain).

    There is deliberately NO `statement` parameter here (see the module
    docstring's "No arbitrary statement text, by construction" section): the
    displayed text for the resulting claim is always generated from
    `proposition` itself via `ArchitecturalClaim.create` ->
    `render_proposition_statement`, never supplied independently. The only
    caller-controlled input that affects wording is `entity_display_names`,
    a purely cosmetic entity-id -> display-name lookup (e.g. so the
    rendered text reads "OrderController calls OrderService." instead of
    using raw symbol ids) -- it cannot change *what* is asserted, only how
    the same assertion is worded.

    - This function calls `verify_proposition(proposition, relations)`
      internally and trusts its verdict:
        * supported=True  -> support_status="supported"; the EvidenceChain
          is built from exactly the relations in
          `verification.matched_relation_ids` (in path order for
          reachability), not the full input pool.
        * supported=False -> support_status="insufficient_evidence" (never
          "supported"); `evidence_chain.reasoning` carries
          `verification.reason`. Any relations still named in
          `matched_relation_ids` (e.g. the matched prefix of an incomplete
          reachability path) are cited as evidence too, for diagnostics --
          this does not change the support_status.
    - `assert_contradicted=True` bypasses `verify_proposition` entirely and
      is an explicit, caller-driven pass-through -- see the module
      docstring's "Scope boundary: contradicted" section. This still
      requires at least one relation, and the EvidenceChain is built from
      every relation the caller supplied (the caller's own refuting
      evidence), since there is no proposition-verification step in this
      branch to select a subset from. The displayed statement is rendered
      from `proposition` exactly as in the supported/insufficient_evidence
      path -- the statement describes the proposition, not the verdict.

    Every relation must belong to `run_id` -- checked up front, before any
    verification -- so an adapter silently re-stamping evidence from another
    run onto this one is rejected loudly rather than laundered through a
    "supported"/"insufficient_evidence" verdict.
    """
    relations = tuple(relations)
    _require_matching_run_id(relations, run_id=run_id)

    if assert_contradicted:
        evidence_items = relationship_evidence_from_relations(
            relations,
            run_id=run_id,
            producer=producer,
            evidence_description=evidence_description,
            source_region_resolver=source_region_resolver,
        )
        if not evidence_items:
            raise BrokenRelationChainError(
                "cannot assert support_status='contradicted' with zero evidence items"
            )
        support_status: ClaimSupportStatus = "contradicted"
        reasoning = "caller-asserted contradiction (see assert_contradicted=True); not adapter-detected"
    else:
        verification = verify_proposition(proposition, relations)
        matched_relations = _select_relations_by_id(relations, verification.matched_relation_ids)
        evidence_items = relationship_evidence_from_relations(
            matched_relations,
            run_id=run_id,
            producer=producer,
            evidence_description=evidence_description,
            source_region_resolver=source_region_resolver,
        )
        if verification.supported:
            support_status = "supported"
            reasoning = ""
        else:
            support_status = "insufficient_evidence"
            reasoning = verification.reason

    return ArchitecturalClaim.create(
        run_id=run_id,
        epistemic_type=epistemic_type,
        support_status=support_status,
        confidence=confidence,
        producer=producer,
        evidence_items=evidence_items,
        proposition=proposition,
        entity_display_names=entity_display_names,
        subject_symbol_ids=subject_symbol_ids,
        related_lens_ids=related_lens_ids,
        reasoning=reasoning,
    )
