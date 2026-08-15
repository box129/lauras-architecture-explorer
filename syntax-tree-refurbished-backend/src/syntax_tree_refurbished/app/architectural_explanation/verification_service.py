"""L2: the verification service.

The full V2 vertical-slice pipeline, for one target entity, sits between
two frozen contracts this module depends on but never reimplements:

    real, persisted analysis output       app.analysis.run_store
      (ParsedSymbol / ObservedProgramRelation, via store.get_symbols /
      store.get_relations -- the ONLY sanctioned way to retrieve evidence
      in this project; this module never calls an extractor directly)
      -> bounded evidence                 gather_bounded_evidence (below)
      -> LLM claim proposal                ClaimProposer.propose_claims
      (app.architectural_explanation.claim_proposer -- a Protocol; this
      module depends on it ABSTRACTLY and never imports a concrete L1
      implementation, exactly so L1 and L2 can be built and tested in
      parallel, per that module's own docstring)
      -> vocabulary/evidence-membership   validate_claim_proposal
      re-check                            (core.models.architectural_explanation
                                            -- a ClaimProposal that fails this
                                            is skipped, never coerced or
                                            passed downstream)
      -> deterministic verification +     claim_from_proposition
      claim construction                  (app.provenance.relation_adapter --
                                            the existing, tested function that
                                            calls core.models.provenance.
                                            verify_proposition internally and
                                            builds the resulting
                                            ArchitecturalClaim; this module
                                            never reimplements verify_proposition's
                                            logic and never hand-builds an
                                            ArchitecturalClaim)

Nothing in this module is FastAPI-aware -- it is pure, deterministic (given
its inputs -- the only non-determinism, if any, lives inside whatever
``ClaimProposer`` implementation a caller injects) and testable with a fake
``ClaimProposer``, no live LLM call, no HTTP layer.

Precision-first discipline this module is responsible for upholding
--------------------------------------------------------------------------
- Only the ``relations`` tuple actually passed in (which route wiring
  populates via ``store.get_relations(run_id)`` -- real, persisted
  analysis output) may ever be used to prove a claim. Nothing here
  fabricates a relation or calls an extractor directly.
- LLM wording (``ClaimProposal.proposed_statement``) never influences
  ``support_status`` or becomes an ``ArchitecturalClaim.statement`` --
  enforced structurally by ``claim_from_proposition``/
  ``ArchitecturalClaim.create`` (see those modules), not by convention
  here; this module simply never works around that.
- A ``ClaimProposal`` that fails ``validate_claim_proposal`` is skipped
  entirely -- it never reaches ``claim_from_proposition`` -- and one bad
  proposal never raises or aborts verification of the others.
- Unresolved/partial relations can never prove a definite "supported"
  claim -- guaranteed by ``verify_proposition`` itself (see
  ``core.models.provenance``); this module does not pre-filter
  ``relations`` in any way that could help a partial/unresolved relation
  look like proof (bounding the evidence neighborhood only affects what a
  *proposer* sees, never what a claim can be *verified* against -- see
  ``verify_target_entity``'s own docstring below for why the full
  ``relations`` pool, not the bounded neighborhood, is what gets searched).
"""

from __future__ import annotations

from syntax_tree_refurbished.app.architectural_explanation.claim_proposer import ClaimProposer
from syntax_tree_refurbished.app.provenance.relation_adapter import (
    SourceRegionResolver,
    claim_from_proposition,
)
from syntax_tree_refurbished.core.models.architectural_explanation import (
    BoundedEvidence,
    validate_claim_proposal,
)
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.core.models.provenance import ArchitecturalClaim, ProducerInfo


#: Default neighborhood radius (in relation-graph hops from the target
#: entity) that ``gather_bounded_evidence`` expands to. 2 is the minimum
#: that lets a proposer see a genuine 3-entity "reachability" path
#: (target -> mid -> far) while still being a small, bounded neighborhood
#: -- not the whole symbol table, per the task brief.
DEFAULT_HOP_LIMIT = 2


def gather_bounded_evidence(
    *,
    run_id: str,
    target_entity_id: str,
    symbols: tuple[ParsedSymbol, ...],
    relations: tuple[ObservedProgramRelation, ...],
    hop_limit: int = DEFAULT_HOP_LIMIT,
) -> BoundedEvidence:
    """Select a bounded neighborhood around ``target_entity_id``.

    Included, by construction:

    - the target entity itself (always -- ``BoundedEvidence`` itself
      requires this);
    - every entity reachable from the target by following relations in
      ``relations`` out to ``hop_limit`` hops, in EITHER direction (as
      source or as target of a relation), regardless of
      ``resolution_status`` -- the proposer should SEE partial/unresolved
      relations too, since "no relation found" is itself useful context,
      even though only resolved relations can later PROVE a claim (that
      distinction is ``verify_proposition``'s job downstream, not this
      function's);
    - the target's containing symbol (``parent_symbol_id``, e.g. its
      owning class or module) and any siblings sharing that same parent,
      if the target itself is present in ``symbols`` -- cheap, genuinely
      useful context (the class/file the target lives in) that costs
      nothing extra to include.

    ``relations`` in the returned ``BoundedEvidence`` is exactly the set of
    relations collected while expanding the neighborhood (i.e. every
    relation that touches some entity within ``hop_limit`` hops of the
    target) -- not the full ``relations`` pool. This is deliberately a
    strict subset: it is what the *proposer* is shown, bounded by design.
    It is NOT what a proposal is later verified against -- see
    ``verify_target_entity``, which searches the full ``relations`` pool a
    caller passes in, exactly as ``claim_from_proposition`` expects (a
    candidate pool to search, not a pre-bounded chain).

    Symbol/relation objects belonging to a different ``run_id`` than the
    one requested are ignored (defensive; callers are expected to already
    pass single-run tuples, e.g. via ``store.get_symbols(run_id)`` /
    ``store.get_relations(run_id)``).
    """
    run_relations = tuple(r for r in relations if r.run_id == run_id)

    visited_entity_ids: set[str] = {target_entity_id}
    frontier: set[str] = {target_entity_id}
    collected_relation_ids: set[str] = set()

    for _ in range(max(hop_limit, 0)):
        next_frontier: set[str] = set()
        for relation in run_relations:
            touches_frontier = relation.source_entity_id in frontier or (
                relation.target_entity_id is not None and relation.target_entity_id in frontier
            )
            if not touches_frontier:
                continue
            collected_relation_ids.add(relation.id)
            next_frontier.add(relation.source_entity_id)
            if relation.target_entity_id:
                next_frontier.add(relation.target_entity_id)
        next_frontier -= visited_entity_ids
        if not next_frontier:
            break
        visited_entity_ids |= next_frontier
        frontier = next_frontier

    target_symbol = next((s for s in symbols if s.id == target_entity_id), None)
    if target_symbol is not None and target_symbol.parent_symbol_id:
        visited_entity_ids.add(target_symbol.parent_symbol_id)
        for symbol in symbols:
            if symbol.parent_symbol_id == target_symbol.parent_symbol_id:
                visited_entity_ids.add(symbol.id)

    bounded_symbols = tuple(
        symbol for symbol in symbols if symbol.run_id == run_id and symbol.id in visited_entity_ids
    )
    bounded_relations = tuple(
        relation for relation in run_relations if relation.id in collected_relation_ids
    )

    return BoundedEvidence(
        run_id=run_id,
        target_entity_id=target_entity_id,
        symbols=bounded_symbols,
        relations=bounded_relations,
    )


def verify_target_entity(
    *,
    run_id: str,
    target_entity_id: str,
    symbols: tuple[ParsedSymbol, ...],
    relations: tuple[ObservedProgramRelation, ...],
    proposer: ClaimProposer,
    producer_name: str,
    source_region_resolver: SourceRegionResolver | None = None,
) -> tuple[ArchitecturalClaim, ...]:
    """Run the full L2 pipeline for one target entity.

    1. ``gather_bounded_evidence(...)`` -- select what the proposer gets to
       see.
    2. ``proposer.propose_claims(evidence)`` -- ask the (abstract)
       ``ClaimProposer`` for zero or more ``ClaimProposal``s. Zero
       proposals (e.g. ``NullClaimProposer``, or any proposer that simply
       found nothing to propose) is a normal, valid outcome -- this
       function returns ``()`` cleanly, never an error.
    3. For each proposal, ``validate_claim_proposal(proposal, evidence)``:
       a proposal referencing an entity id outside its own bounded
       evidence is skipped (never coerced, never passed to verification,
       never raises the whole request over one bad proposal from an
       otherwise-useful batch).
    4. ``claim_from_proposition(proposal.proposition, relations, ...)`` --
       note this searches the FULL ``relations`` pool passed into this
       function (real, persisted analysis output for this run), not the
       bounded neighborhood ``gather_bounded_evidence`` built for the
       proposer. Bounding is a proposer-facing concern only; verification
       must be checked against everything actually known, or a true
       multi-hop reachability claim whose far end sits outside the
       proposer's bounded neighborhood could wrongly come back
       "insufficient_evidence" even though real evidence for it exists.
       ``claim_from_proposition`` calls ``verify_proposition`` internally
       and is the sole authority on ``support_status`` -- this function
       trusts its verdict completely and never second-guesses it.
    5. Collect and return the resulting ``ArchitecturalClaim`` tuple, in
       proposal order. A mix of "supported" and "insufficient_evidence"
       claims is the normal, expected shape of this return value -- both
       are valid outcomes, not errors; only a proposal that fails
       structural validation at step 3 is ever dropped.

    Every returned claim carries ``producer=ProducerInfo(producer_type="llm",
    name=producer_name, ...)`` -- real, traceable provenance back to the
    LLM proposal that originated it, per this project's standing
    precision-first / provenance discipline.

    ``source_region_resolver``, when given, is forwarded unchanged to
    every ``claim_from_proposition`` call, which forwards it to
    ``relationship_evidence_from_relations`` -- see that function's
    docstring for the exact contract. Omitting it (the default) keeps
    every evidence item's ``source_region_id`` unset, exactly as before
    this parameter existed.
    """
    relations = tuple(r for r in relations if r.run_id == run_id)

    evidence = gather_bounded_evidence(
        run_id=run_id,
        target_entity_id=target_entity_id,
        symbols=symbols,
        relations=relations,
    )

    proposals = proposer.propose_claims(evidence)

    entity_display_names = {symbol.id: symbol.name for symbol in symbols if symbol.run_id == run_id}
    producer = ProducerInfo(producer_type="llm", name=producer_name, version="")

    claims: list[ArchitecturalClaim] = []
    for proposal in proposals:
        try:
            validate_claim_proposal(proposal, evidence)
        except ValueError:
            # Never coerce, never raise the whole request over one bad
            # proposal -- just skip it (see module/function docstrings).
            continue

        claim = claim_from_proposition(
            proposal.proposition,
            relations,
            run_id=run_id,
            epistemic_type="observed",
            producer=producer,
            entity_display_names=entity_display_names,
            subject_symbol_ids=(
                proposal.proposition.subject_entity_id,
                proposal.proposition.object_entity_id,
            ),
            source_region_resolver=source_region_resolver,
        )
        claims.append(claim)

    return tuple(claims)
