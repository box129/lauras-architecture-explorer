"""Tests for app.architectural_explanation.verification_service (L2).

Pure unit tests -- no FastAPI, no live LLM call anywhere. ``ClaimProposer``
is always a hand-written fake (structurally implementing the Protocol) or
``NullClaimProposer``, matching the same "L2 tests inject a fake proposer,
never a concrete L1 implementation" boundary documented on
``app.architectural_explanation.claim_proposer.ClaimProposer``.

The single most important property under test (mirroring
test_relation_adapter.py's own canonical example) is
``test_false_claim_is_never_marked_supported`` below: a proposal a fake
proposer deliberately makes FALSE (no real relation backs it, even though
a real, connected chain exists between related entities) must come back
"insufficient_evidence", never "supported" -- this project's standing
precision-first discipline, now exercised through the full L2 pipeline
rather than just the adapter in isolation.
"""

from __future__ import annotations

from syntax_tree_refurbished.app.architectural_explanation.claim_proposer import (
    ClaimProposer,
    NullClaimProposer,
)
from syntax_tree_refurbished.app.architectural_explanation.verification_service import (
    gather_bounded_evidence,
    verify_target_entity,
)
from syntax_tree_refurbished.core.models.architectural_explanation import BoundedEvidence, ClaimProposal
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.core.models.provenance import ClaimProposition, ProducerInfo


RUN_ID = "run:l2-verification-test"


def _symbol(id_suffix: str, name: str, *, parent_symbol_id: str | None = None) -> ParsedSymbol:
    return ParsedSymbol(
        id=f"symbol:{id_suffix}",
        run_id=RUN_ID,
        path="pkg/mod.py",
        language="python",
        name=name,
        qualified_name=f"python:pkg/mod.py::{name}",
        kind="function",
        start_line=1,
        end_line=2,
        source_region_id=f"region:{id_suffix}",
        signature="",
        exported=True,
        async_=False,
        parent_symbol_id=parent_symbol_id,
    )


def _relation(
    *,
    source: str,
    target: str | None,
    relation_kind: str = "calls",
    resolution_status: str = "resolved",
    target_reference: str | None = None,
) -> ObservedProgramRelation:
    return ObservedProgramRelation.create(
        run_id=RUN_ID,
        relation_kind=relation_kind,  # type: ignore[arg-type]
        source_entity_id=source,
        target_entity_id=target,
        target_reference=target_reference,
        extractor_name="test.fixture",
        extractor_version="0.1.0",
        resolution_status=resolution_status,  # type: ignore[arg-type]
        span_path="pkg/mod.py",
        span_start_line=10,
        span_end_line=10,
    )


def _llm_producer() -> ProducerInfo:
    return ProducerInfo(producer_type="llm", name="test-fake-proposer", version="v1")


# ---------------------------------------------------------------------------
# gather_bounded_evidence
# ---------------------------------------------------------------------------


def test_gather_bounded_evidence_always_includes_the_target() -> None:
    target = _symbol("a", "target")
    evidence = gather_bounded_evidence(
        run_id=RUN_ID, target_entity_id=target.id, symbols=(target,), relations=()
    )
    assert evidence.target_entity_id == target.id
    assert target.id in evidence.entity_ids


def test_gather_bounded_evidence_includes_direct_neighbors_via_relations() -> None:
    a = _symbol("a", "caller")
    b = _symbol("b", "callee")
    unrelated = _symbol("z", "unrelated")
    relation = _relation(source=a.id, target=b.id)

    evidence = gather_bounded_evidence(
        run_id=RUN_ID,
        target_entity_id=a.id,
        symbols=(a, b, unrelated),
        relations=(relation,),
    )

    assert evidence.entity_ids == {a.id, b.id}
    assert relation.id in {r.id for r in evidence.relations}
    assert unrelated.id not in evidence.entity_ids


def test_gather_bounded_evidence_includes_neighbors_regardless_of_resolution_status() -> None:
    """The proposer should see partial/unresolved relations too -- 'no
    relation found' is itself useful context, even though only resolved
    relations can later PROVE a claim (verify_proposition's job)."""
    a = _symbol("a", "caller")
    b = _symbol("b", "maybe_callee")
    partial_relation = _relation(
        source=a.id, target=b.id, resolution_status="partial", target_reference="maybe_callee(...)"
    )

    evidence = gather_bounded_evidence(
        run_id=RUN_ID, target_entity_id=a.id, symbols=(a, b), relations=(partial_relation,)
    )

    assert b.id in evidence.entity_ids
    assert partial_relation.id in {r.id for r in evidence.relations}


def test_gather_bounded_evidence_reaches_two_hops_for_reachability_context() -> None:
    a = _symbol("a", "caller")
    b = _symbol("b", "mid")
    c = _symbol("c", "far")
    far_beyond = _symbol("d", "too_far")
    r1 = _relation(source=a.id, target=b.id)
    r2 = _relation(source=b.id, target=c.id)
    r3 = _relation(source=c.id, target=far_beyond.id)

    evidence = gather_bounded_evidence(
        run_id=RUN_ID,
        target_entity_id=a.id,
        symbols=(a, b, c, far_beyond),
        relations=(r1, r2, r3),
    )

    assert evidence.entity_ids == {a.id, b.id, c.id}
    assert far_beyond.id not in evidence.entity_ids


def test_gather_bounded_evidence_run_id_consistency() -> None:
    a = _symbol("a", "target")
    evidence = gather_bounded_evidence(
        run_id=RUN_ID, target_entity_id=a.id, symbols=(a,), relations=()
    )
    assert isinstance(evidence, BoundedEvidence)
    assert evidence.run_id == RUN_ID
    assert all(s.run_id == RUN_ID for s in evidence.symbols)
    assert all(r.run_id == RUN_ID for r in evidence.relations)


def test_gather_bounded_evidence_ignores_relations_from_a_different_run() -> None:
    a = _symbol("a", "caller")
    b = _symbol("b", "callee")
    other_run_relation = ObservedProgramRelation.create(
        run_id="run:other",
        relation_kind="calls",
        source_entity_id=a.id,
        target_entity_id=b.id,
        extractor_name="test.fixture",
        extractor_version="0.1.0",
        resolution_status="resolved",
    )

    evidence = gather_bounded_evidence(
        run_id=RUN_ID, target_entity_id=a.id, symbols=(a, b), relations=(other_run_relation,)
    )

    assert evidence.relations == ()
    assert evidence.entity_ids == {a.id}


def test_gather_bounded_evidence_includes_containing_class_and_siblings() -> None:
    cls = _symbol("cls", "MyClass")
    method = _symbol("m", "target_method", parent_symbol_id=cls.id)
    sibling = _symbol("sib", "sibling_method", parent_symbol_id=cls.id)

    evidence = gather_bounded_evidence(
        run_id=RUN_ID, target_entity_id=method.id, symbols=(cls, method, sibling), relations=()
    )

    assert cls.id in evidence.entity_ids
    assert sibling.id in evidence.entity_ids


# ---------------------------------------------------------------------------
# verify_target_entity
# ---------------------------------------------------------------------------


class _FixedProposalsProposer:
    """Fake ClaimProposer (structurally satisfies the Protocol) that
    returns a caller-supplied, fixed tuple of proposals regardless of the
    evidence it is handed."""

    def __init__(self, proposals: tuple[ClaimProposal, ...]) -> None:
        self._proposals = proposals

    def propose_claims(self, evidence: BoundedEvidence) -> tuple[ClaimProposal, ...]:
        return self._proposals


def test_verify_target_entity_with_null_proposer_returns_empty_tuple() -> None:
    a = _symbol("a", "target")
    proposer: ClaimProposer = NullClaimProposer()

    result = verify_target_entity(
        run_id=RUN_ID,
        target_entity_id=a.id,
        symbols=(a,),
        relations=(),
        proposer=proposer,
        producer_name="test-producer",
    )

    assert result == ()


def test_verify_target_entity_marks_real_relation_as_supported() -> None:
    a = _symbol("a", "caller")
    b = _symbol("b", "callee")
    relation = _relation(source=a.id, target=b.id)
    true_proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation",
            subject_entity_id=a.id,
            relation_kind="calls",
            object_entity_id=b.id,
        ),
        proposed_statement="caller definitely calls callee",
        producer=_llm_producer(),
    )
    proposer: ClaimProposer = _FixedProposalsProposer((true_proposal,))

    result = verify_target_entity(
        run_id=RUN_ID,
        target_entity_id=a.id,
        symbols=(a, b),
        relations=(relation,),
        proposer=proposer,
        producer_name="test-producer",
    )

    assert len(result) == 1
    claim = result[0]
    assert claim.support_status == "supported"
    assert claim.producer.producer_type == "llm"
    assert claim.producer.name == "test-producer"
    assert claim.proposition == true_proposal.proposition
    # Statement is rendered from the proposition, never the LLM's prose.
    assert claim.statement != true_proposal.proposed_statement


def test_verify_target_entity_marks_absent_relation_as_insufficient_evidence() -> None:
    cls = _symbol("cls", "Owner")
    a = _symbol("a", "caller", parent_symbol_id=cls.id)
    b = _symbol("b", "callee", parent_symbol_id=cls.id)
    # b is visible to the proposer as a's sibling (shared containing
    # class), but no relation at all connects a and b.
    unsupported_proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation",
            subject_entity_id=a.id,
            relation_kind="calls",
            object_entity_id=b.id,
        ),
        proposed_statement="caller calls callee",
        producer=_llm_producer(),
    )
    proposer: ClaimProposer = _FixedProposalsProposer((unsupported_proposal,))

    result = verify_target_entity(
        run_id=RUN_ID,
        target_entity_id=a.id,
        symbols=(cls, a, b),
        relations=(),
        proposer=proposer,
        producer_name="test-producer",
    )

    assert len(result) == 1
    assert result[0].support_status == "insufficient_evidence"


def test_verify_target_entity_skips_proposal_that_fails_validation() -> None:
    """A proposal referencing an entity outside its own bounded evidence
    must never reach claim_from_proposition -- it should simply not appear
    in the output at all, and must not prevent other, valid proposals in
    the same batch from being verified."""
    a = _symbol("a", "caller")
    b = _symbol("b", "callee")
    relation = _relation(source=a.id, target=b.id)

    invalid_proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation",
            subject_entity_id=a.id,
            relation_kind="calls",
            object_entity_id="symbol:not-in-evidence-at-all",
        ),
        proposed_statement="caller calls something outside its evidence",
        producer=_llm_producer(),
    )
    valid_proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation",
            subject_entity_id=a.id,
            relation_kind="calls",
            object_entity_id=b.id,
        ),
        proposed_statement="caller calls callee",
        producer=_llm_producer(),
    )
    proposer: ClaimProposer = _FixedProposalsProposer((invalid_proposal, valid_proposal))

    result = verify_target_entity(
        run_id=RUN_ID,
        target_entity_id=a.id,
        symbols=(a, b),
        relations=(relation,),
        proposer=proposer,
        producer_name="test-producer",
    )

    assert len(result) == 1
    assert result[0].proposition == valid_proposal.proposition
    referenced_objects = {claim.proposition.object_entity_id for claim in result if claim.proposition}
    assert "symbol:not-in-evidence-at-all" not in referenced_objects


def test_false_claim_is_never_marked_supported() -> None:
    """The central precision property: a real, connected chain
    (Controller -calls-> Service -calls-> PaymentService) must never be
    mistaken for support of a direct claim between the two ends
    (Controller -calls-> PaymentService), which was never actually
    observed -- only reachable through Service. A fake proposer here
    deliberately proposes exactly that false direct_relation claim; it
    must come back 'insufficient_evidence', never 'supported'."""
    controller = _symbol("controller", "Controller")
    service = _symbol("service", "Service")
    payment_service = _symbol("payment", "PaymentService")
    r1 = _relation(source=controller.id, target=service.id)
    r2 = _relation(source=service.id, target=payment_service.id)

    false_proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation",
            subject_entity_id=controller.id,
            relation_kind="calls",
            object_entity_id=payment_service.id,
        ),
        proposed_statement="Controller directly calls PaymentService",
        producer=_llm_producer(),
    )
    proposer: ClaimProposer = _FixedProposalsProposer((false_proposal,))

    result = verify_target_entity(
        run_id=RUN_ID,
        target_entity_id=controller.id,
        symbols=(controller, service, payment_service),
        relations=(r1, r2),
        proposer=proposer,
        producer_name="test-producer",
    )

    assert len(result) == 1
    assert result[0].support_status == "insufficient_evidence"
    assert result[0].support_status != "supported"


def test_verify_target_entity_mixed_batch_supported_and_insufficient() -> None:
    a = _symbol("a", "caller")
    b = _symbol("b", "callee")
    c = _symbol("c", "maybe_called")
    relation = _relation(source=a.id, target=b.id)
    # c is visible to the proposer (a partial relation puts it in the
    # bounded neighborhood) but partial resolution means it can never
    # PROVE a direct_relation claim -- exactly the "no relation found"
    # vs. "not resolved" distinction verify_proposition enforces.
    partial_relation = _relation(
        source=a.id, target=c.id, resolution_status="partial", target_reference="maybe_called(...)"
    )

    supported_proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation", subject_entity_id=a.id, relation_kind="calls", object_entity_id=b.id
        ),
        proposed_statement="caller calls callee",
        producer=_llm_producer(),
    )
    insufficient_proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation", subject_entity_id=a.id, relation_kind="calls", object_entity_id=c.id
        ),
        proposed_statement="caller calls maybe_called",
        producer=_llm_producer(),
    )
    proposer: ClaimProposer = _FixedProposalsProposer((supported_proposal, insufficient_proposal))

    result = verify_target_entity(
        run_id=RUN_ID,
        target_entity_id=a.id,
        symbols=(a, b, c),
        relations=(relation, partial_relation),
        proposer=proposer,
        producer_name="test-producer",
    )

    statuses = {claim.proposition.object_entity_id: claim.support_status for claim in result if claim.proposition}
    assert statuses == {b.id: "supported", c.id: "insufficient_evidence"}
