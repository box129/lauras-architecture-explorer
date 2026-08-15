"""Tests for the V2 vertical-slice shared contract (Phase 1):
core.models.architectural_explanation + api.dto.architectural_explanation +
app.architectural_explanation.claim_proposer.

Pure contract tests -- no proposer/verifier/composer implementation is
exercised here (that's L1/L2/L3's own test suites). These tests exist to
prove the frozen contract itself behaves as documented: vocabulary
rejection, evidence-membership rejection, the Protocol boundary, and
DTO round-tripping.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from syntax_tree_refurbished.api.dto.architectural_explanation import (
    ArchitecturalExplanationResponse,
    ClaimProposalDTO,
)
from syntax_tree_refurbished.api.dto.provenance import ArchitecturalClaimDTO
from syntax_tree_refurbished.app.architectural_explanation.claim_proposer import (
    ClaimProposer,
    NullClaimProposer,
)
from syntax_tree_refurbished.core.models.architectural_explanation import (
    ALLOWED_PROPOSITION_SHAPES,
    ArchitecturalExplanation,
    BoundedEvidence,
    ClaimProposal,
    validate_claim_proposal,
)
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.provenance import (
    ArchitecturalClaim,
    ClaimProposition,
    EvidenceChain,
    ProducerInfo,
)

RUN_ID = "run:contract-test"


def _symbol(id_suffix: str, name: str = "x", kind: str = "function") -> ParsedSymbol:
    return ParsedSymbol(
        id=f"symbol:{id_suffix}",
        run_id=RUN_ID,
        path=f"pkg/{id_suffix}.py",
        language="python",
        kind=kind,  # type: ignore[arg-type]
        name=name,
        qualified_name=f"python:pkg/{id_suffix}.py::{name}",
        start_line=1,
        end_line=2,
        source_region_id=f"region:{id_suffix}",
        signature="",
        exported=True,
        async_=False,
    )


def _bounded_evidence() -> BoundedEvidence:
    subject = _symbol("a", "caller")
    target = _symbol("b", "callee")
    return BoundedEvidence(run_id=RUN_ID, target_entity_id=subject.id, symbols=(subject, target), relations=())


def _llm_producer() -> ProducerInfo:
    return ProducerInfo(producer_type="llm", name="test-model", version="v1")


# ---------------------------------------------------------------------------
# ALLOWED_PROPOSITION_SHAPES / ClaimProposal vocabulary enforcement
# ---------------------------------------------------------------------------


def test_allowed_shapes_are_exactly_the_first_slice_vocabulary():
    assert ALLOWED_PROPOSITION_SHAPES == {
        ("direct_relation", "calls"),
        ("direct_relation", "inherits"),
        ("reachability", "calls"),
    }


def test_claim_proposal_accepts_direct_relation_calls():
    evidence = _bounded_evidence()
    proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation",
            subject_entity_id="symbol:a",
            relation_kind="calls",
            object_entity_id="symbol:b",
        ),
        proposed_statement="caller calls callee",
        producer=_llm_producer(),
    )
    validate_claim_proposal(proposal, evidence)  # must not raise


@pytest.mark.parametrize(
    "kind,relation_kind",
    [
        ("direct_relation", "imports"),
        ("direct_relation", "contains"),
        ("reachability", "inherits"),
    ],
)
def test_claim_proposal_rejects_out_of_vocabulary_shapes(kind, relation_kind):
    with pytest.raises(ValueError, match="outside this slice's vocabulary"):
        ClaimProposal(
            proposition=ClaimProposition(
                kind=kind,
                subject_entity_id="symbol:a",
                relation_kind=relation_kind,
                object_entity_id="symbol:b",
                path_entity_ids=("symbol:a", "symbol:b") if kind == "reachability" else (),
            ),
            proposed_statement=None,
            producer=_llm_producer(),
        )


def test_claim_proposal_rejects_non_llm_producer():
    with pytest.raises(ValueError, match="producer_type must be 'llm'"):
        ClaimProposal(
            proposition=ClaimProposition(
                kind="direct_relation", subject_entity_id="symbol:a",
                relation_kind="calls", object_entity_id="symbol:b",
            ),
            proposed_statement=None,
            producer=ProducerInfo(producer_type="extractor", name="not-an-llm", version="v1"),
        )


def test_validate_claim_proposal_rejects_entity_id_outside_evidence():
    evidence = _bounded_evidence()
    proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation",
            subject_entity_id="symbol:a",
            relation_kind="calls",
            object_entity_id="symbol:not-in-evidence",
        ),
        proposed_statement=None,
        producer=_llm_producer(),
    )
    with pytest.raises(ValueError, match="not present in its own bounded evidence"):
        validate_claim_proposal(proposal, evidence)


# ---------------------------------------------------------------------------
# BoundedEvidence
# ---------------------------------------------------------------------------


def test_bounded_evidence_requires_target_in_its_own_symbols():
    other = _symbol("z")
    with pytest.raises(ValueError, match="target_entity_id must itself be one of"):
        BoundedEvidence(run_id=RUN_ID, target_entity_id="symbol:not-there", symbols=(other,), relations=())


def test_bounded_evidence_entity_ids_property():
    evidence = _bounded_evidence()
    assert evidence.entity_ids == {"symbol:a", "symbol:b"}


# ---------------------------------------------------------------------------
# ClaimProposer protocol / NullClaimProposer
# ---------------------------------------------------------------------------


def test_null_claim_proposer_returns_empty_and_satisfies_protocol():
    proposer: ClaimProposer = NullClaimProposer()
    result = proposer.propose_claims(_bounded_evidence())
    assert result == ()


def test_fake_proposer_can_implement_the_protocol_structurally():
    class FakeProposer:
        def propose_claims(self, evidence: BoundedEvidence) -> tuple[ClaimProposal, ...]:
            return (
                ClaimProposal(
                    proposition=ClaimProposition(
                        kind="direct_relation",
                        subject_entity_id=evidence.target_entity_id,
                        relation_kind="calls",
                        object_entity_id=next(iter(evidence.entity_ids - {evidence.target_entity_id})),
                    ),
                    proposed_statement="fake proposal",
                    producer=_llm_producer(),
                ),
            )

    proposer: ClaimProposer = FakeProposer()
    result = proposer.propose_claims(_bounded_evidence())
    assert len(result) == 1
    assert result[0].proposition.kind == "direct_relation"


# ---------------------------------------------------------------------------
# ArchitecturalExplanation
# ---------------------------------------------------------------------------


def _verified_claim(support_status: str, claim_id: str) -> ArchitecturalClaim:
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id="symbol:a", relation_kind="calls", object_entity_id="symbol:b"
    )
    producer = ProducerInfo(producer_type="extractor", name="test", version="v1")
    chain = EvidenceChain(id=f"chain:{claim_id}", run_id=RUN_ID, claim_id=claim_id, items=())
    return ArchitecturalClaim(
        id=claim_id,
        run_id=RUN_ID,
        statement="caller calls callee.",
        epistemic_type="observed",
        support_status=support_status,  # type: ignore[arg-type]
        confidence=None,
        producer=producer,
        evidence_chain=chain,
        proposition=proposition,
    )


def test_architectural_explanation_splits_supported_and_insufficient():
    claims = (
        _verified_claim("supported", "claim:1"),
        _verified_claim("insufficient_evidence", "claim:2"),
    )
    explanation = ArchitecturalExplanation(
        id="explanation:1",
        run_id=RUN_ID,
        target_kind="entity",
        target_id="symbol:a",
        claims=claims,
        narrative="caller calls callee (claim:1). A second claim was not proven (claim:2).",
        producer=ProducerInfo(producer_type="llm", name="test-model", version="v1"),
    )
    assert len(explanation.supported_claims) == 1
    assert explanation.supported_claims[0].id == "claim:1"
    assert len(explanation.insufficient_evidence_claims) == 1
    assert explanation.insufficient_evidence_claims[0].id == "claim:2"


def test_architectural_explanation_rejects_mismatched_run_id_claims():
    other_run_claim = _verified_claim("supported", "claim:other-run")
    other_run_claim = ArchitecturalClaim(
        id=other_run_claim.id,
        run_id="run:different",
        statement=other_run_claim.statement,
        epistemic_type=other_run_claim.epistemic_type,
        support_status=other_run_claim.support_status,
        confidence=other_run_claim.confidence,
        producer=other_run_claim.producer,
        evidence_chain=EvidenceChain(id="chain:x", run_id="run:different", claim_id="claim:other-run", items=()),
        proposition=other_run_claim.proposition,
    )
    with pytest.raises(ValueError, match="must all share run_id"):
        ArchitecturalExplanation(
            id="explanation:2",
            run_id=RUN_ID,
            target_kind="entity",
            target_id="symbol:a",
            claims=(other_run_claim,),
            narrative="",
            producer=ProducerInfo(producer_type="llm", name="test-model", version="v1"),
        )


# ---------------------------------------------------------------------------
# DTO round-tripping
# ---------------------------------------------------------------------------


def test_claim_proposal_dto_round_trips():
    proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="reachability",
            subject_entity_id="symbol:a",
            relation_kind="calls",
            object_entity_id="symbol:b",
            path_entity_ids=("symbol:a", "symbol:mid", "symbol:b"),
        ),
        proposed_statement="a reaches b",
        producer=_llm_producer(),
    )
    dto = ClaimProposalDTO.from_domain(proposal)
    round_tripped = dto.to_domain()
    assert round_tripped == proposal


def test_architectural_explanation_response_from_domain_shape():
    claims = (_verified_claim("supported", "claim:1"),)
    explanation = ArchitecturalExplanation(
        id="explanation:1",
        run_id=RUN_ID,
        target_kind="entity",
        target_id="symbol:a",
        claims=claims,
        narrative="caller calls callee (claim:1).",
        producer=ProducerInfo(producer_type="llm", name="test-model", version="v1"),
    )
    response = ArchitecturalExplanationResponse.from_domain(explanation)
    assert response.analysis_run_id == RUN_ID
    assert response.target_kind == "entity"
    assert response.supported_count == 1
    assert response.insufficient_evidence_count == 0
    assert len(response.claims) == 1
    assert isinstance(response.claims[0], ArchitecturalClaimDTO)
    assert response.claims[0].id == "claim:1"
