from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.api.dto.provenance import (
    ArchitecturalClaimDTO,
    ProducerInfoDTO,
)
from syntax_tree_refurbished.api.routes.claims import router as claims_router
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.program_relation import ResolutionEvidenceSpan
from syntax_tree_refurbished.core.models.provenance import (
    ArchitecturalClaim,
    EvidenceChain,
    ProducerInfo,
    RelationshipEvidence,
    SourceSpanEvidence,
    compute_claim_id,
    compute_evidence_chain_id,
    compute_relationship_evidence_id,
    compute_source_span_evidence_id,
)


PRODUCER = ProducerInfo(producer_type="extractor", name="test.extractor", version="v1")


# ---------------------------------------------------------------------------
# Deterministic id generation
# ---------------------------------------------------------------------------


def test_source_span_evidence_id_is_deterministic_for_same_input() -> None:
    first = compute_source_span_evidence_id(
        run_id="run-1", source_region_id="region:abc", content_hash="hash-1", description="cites the health route"
    )
    second = compute_source_span_evidence_id(
        run_id="run-1", source_region_id="region:abc", content_hash="hash-1", description="cites the health route"
    )
    assert first == second
    assert first.startswith("evidence-span:")


@pytest.mark.parametrize(
    "kwargs",
    [
        {"run_id": "run-2"},
        {"source_region_id": "region:different"},
        {"content_hash": "hash-2"},
        {"description": "a different reason"},
    ],
)
def test_source_span_evidence_id_changes_when_any_input_changes(kwargs: dict) -> None:
    base = {
        "run_id": "run-1",
        "source_region_id": "region:abc",
        "content_hash": "hash-1",
        "description": "cites the health route",
    }
    baseline = compute_source_span_evidence_id(**base)
    varied = compute_source_span_evidence_id(**{**base, **kwargs})
    assert baseline != varied


def test_relationship_evidence_id_is_deterministic_and_order_sensitive() -> None:
    first = compute_relationship_evidence_id(
        run_id="run-1", relationship_kind="calls", from_symbol_id="symbol:a", to_symbol_id="symbol:b", description="a calls b"
    )
    second = compute_relationship_evidence_id(
        run_id="run-1", relationship_kind="calls", from_symbol_id="symbol:a", to_symbol_id="symbol:b", description="a calls b"
    )
    reversed_edge = compute_relationship_evidence_id(
        run_id="run-1", relationship_kind="calls", from_symbol_id="symbol:b", to_symbol_id="symbol:a", description="a calls b"
    )
    assert first == second
    assert first != reversed_edge


def test_claim_id_is_deterministic_and_subject_order_independent() -> None:
    first = compute_claim_id(
        run_id="run-1",
        statement="AuthMiddleware enforces the auth boundary",
        epistemic_type="observed",
        subject_symbol_ids=("symbol:a", "symbol:b"),
    )
    same_but_reordered_subjects = compute_claim_id(
        run_id="run-1",
        statement="AuthMiddleware enforces the auth boundary",
        epistemic_type="observed",
        subject_symbol_ids=("symbol:b", "symbol:a"),
    )
    different_statement = compute_claim_id(
        run_id="run-1",
        statement="A completely different claim",
        epistemic_type="observed",
        subject_symbol_ids=("symbol:a", "symbol:b"),
    )
    different_epistemic_type = compute_claim_id(
        run_id="run-1",
        statement="AuthMiddleware enforces the auth boundary",
        epistemic_type="inferred",
        subject_symbol_ids=("symbol:a", "symbol:b"),
    )

    assert first == same_but_reordered_subjects
    assert first != different_statement
    assert first != different_epistemic_type


def test_evidence_chain_id_is_order_sensitive() -> None:
    forward = compute_evidence_chain_id(run_id="run-1", claim_id="claim:x", evidence_ids=("e1", "e2"))
    backward = compute_evidence_chain_id(run_id="run-1", claim_id="claim:x", evidence_ids=("e2", "e1"))
    repeated = compute_evidence_chain_id(run_id="run-1", claim_id="claim:x", evidence_ids=("e1", "e2"))
    assert forward == repeated
    assert forward != backward


def test_architectural_claim_create_is_fully_deterministic_end_to_end() -> None:
    def build() -> ArchitecturalClaim:
        span = SourceSpanEvidence.create(
            run_id="run-1",
            source_region_id="region:abc",
            content_hash="hash-1",
            description="health route defined here",
            producer=PRODUCER,
        )
        return ArchitecturalClaim.create(
            run_id="run-1",
            statement="The app exposes a health route",
            epistemic_type="observed",
            support_status="supported",
            confidence=0.9,
            producer=PRODUCER,
            evidence_items=(span,),
            subject_symbol_ids=("symbol:health",),
        )

    first, second = build(), build()
    assert first.id == second.id
    assert first.evidence_chain.id == second.evidence_chain.id
    assert first.evidence_chain.items[0].id == second.evidence_chain.items[0].id

    third = ArchitecturalClaim.create(
        run_id="run-1",
        statement="A totally different claim",
        epistemic_type="observed",
        support_status="supported",
        confidence=0.9,
        producer=PRODUCER,
        evidence_items=(),
        subject_symbol_ids=(),
    )
    assert third.id != first.id


# ---------------------------------------------------------------------------
# Domain-level (dataclass) validation
# ---------------------------------------------------------------------------


def test_architectural_claim_rejects_invalid_epistemic_type() -> None:
    chain = EvidenceChain(id="evidence-chain:x", run_id="run-1", claim_id="claim:x", items=())
    with pytest.raises(ValueError, match="epistemic_type"):
        ArchitecturalClaim(
            id="claim:x",
            run_id="run-1",
            statement="Some claim",
            epistemic_type="guessed",  # type: ignore[arg-type]
            support_status="supported",
            confidence=None,
            producer=PRODUCER,
            evidence_chain=chain,
        )


def test_architectural_claim_rejects_invalid_support_status() -> None:
    chain = EvidenceChain(id="evidence-chain:x", run_id="run-1", claim_id="claim:x", items=())
    with pytest.raises(ValueError, match="support_status"):
        ArchitecturalClaim(
            id="claim:x",
            run_id="run-1",
            statement="Some claim",
            epistemic_type="observed",
            support_status="maybe",  # type: ignore[arg-type]
            confidence=None,
            producer=PRODUCER,
            evidence_chain=chain,
        )


def test_architectural_claim_requires_non_empty_statement() -> None:
    chain = EvidenceChain(id="evidence-chain:x", run_id="run-1", claim_id="claim:x", items=())
    with pytest.raises(ValueError, match="statement"):
        ArchitecturalClaim(
            id="claim:x",
            run_id="run-1",
            statement="   ",
            epistemic_type="observed",
            support_status="supported",
            confidence=None,
            producer=PRODUCER,
            evidence_chain=chain,
        )


def test_architectural_claim_rejects_confidence_out_of_range() -> None:
    chain = EvidenceChain(id="evidence-chain:x", run_id="run-1", claim_id="claim:x", items=())
    with pytest.raises(ValueError, match="confidence"):
        ArchitecturalClaim(
            id="claim:x",
            run_id="run-1",
            statement="Some claim",
            epistemic_type="observed",
            support_status="supported",
            confidence=1.5,
            producer=PRODUCER,
            evidence_chain=chain,
        )


def test_architectural_claim_requires_evidence_chain_to_reference_same_claim_and_run() -> None:
    mismatched_chain = EvidenceChain(id="evidence-chain:x", run_id="run-1", claim_id="claim:other", items=())
    with pytest.raises(ValueError, match="claim_id"):
        ArchitecturalClaim(
            id="claim:x",
            run_id="run-1",
            statement="Some claim",
            epistemic_type="observed",
            support_status="supported",
            confidence=None,
            producer=PRODUCER,
            evidence_chain=mismatched_chain,
        )


def test_source_span_evidence_requires_source_region_id_and_content_hash() -> None:
    with pytest.raises(ValueError, match="source_region_id"):
        SourceSpanEvidence(
            id="evidence-span:x",
            run_id="run-1",
            kind="source_span",
            producer=PRODUCER,
            description="",
            source_region_id="",
            content_hash="hash-1",
        )


def test_relationship_evidence_rejects_invalid_relationship_kind() -> None:
    with pytest.raises(ValueError, match="relationship_kind"):
        RelationshipEvidence(
            id="evidence-rel:x",
            run_id="run-1",
            kind="relationship",
            producer=PRODUCER,
            description="",
            relationship_kind="teleports_to",  # type: ignore[arg-type]
            from_symbol_id="symbol:a",
            to_symbol_id="symbol:b",
        )


def test_relationship_evidence_carries_resolution_provenance() -> None:
    """RelationshipEvidence must be able to expose resolution_basis and
    supporting_resolution_spans (propagated from an ObservedProgramRelation
    by app/provenance/relation_adapter.py) -- defaulting to None/() for
    backward compatibility with evidence built from relations that needed
    no additional resolution evidence (see test below)."""
    spans = (
        ResolutionEvidenceSpan(path="pkg/mod.py", start_line=3, end_line=3, description="constructor parameter annotation"),
        ResolutionEvidenceSpan(path="pkg/mod.py", start_line=4, end_line=4, description="attribute assignment"),
    )
    evidence = RelationshipEvidence.create(
        run_id="run-1",
        relationship_kind="calls",
        from_symbol_id="symbol:a",
        to_symbol_id="symbol:b",
        description="resolved via constructor binding",
        producer=PRODUCER,
        resolution_basis="constructor_binding",
        supporting_resolution_spans=spans,
    )
    assert evidence.resolution_basis == "constructor_binding"
    assert evidence.supporting_resolution_spans == spans


def test_relationship_evidence_resolution_provenance_defaults_to_none() -> None:
    evidence = RelationshipEvidence.create(
        run_id="run-1",
        relationship_kind="calls",
        from_symbol_id="symbol:a",
        to_symbol_id="symbol:b",
        description="direct call",
        producer=PRODUCER,
    )
    assert evidence.resolution_basis is None
    assert evidence.supporting_resolution_spans == ()


def test_producer_info_rejects_invalid_producer_type() -> None:
    with pytest.raises(ValueError, match="producer_type"):
        ProducerInfo(producer_type="robot", name="x", version="1")  # type: ignore[arg-type]


def test_evidence_chain_rejects_items_from_a_different_run() -> None:
    other_run_span = SourceSpanEvidence.create(
        run_id="run-OTHER",
        source_region_id="region:abc",
        content_hash="hash-1",
        description="x",
        producer=PRODUCER,
    )
    with pytest.raises(ValueError, match="run_id"):
        EvidenceChain(id="evidence-chain:x", run_id="run-1", claim_id="claim:x", items=(other_run_span,))


# ---------------------------------------------------------------------------
# DTO-level (Pydantic) validation
# ---------------------------------------------------------------------------


def test_producer_info_dto_rejects_invalid_producer_type() -> None:
    with pytest.raises(ValidationError):
        ProducerInfoDTO(producer_type="robot", name="x", version="1", produced_at=datetime.now(UTC))


def test_architectural_claim_dto_rejects_invalid_epistemic_type() -> None:
    valid_producer = ProducerInfoDTO(
        producer_type="extractor", name="x", version="1", produced_at=datetime.now(UTC)
    )
    with pytest.raises(ValidationError):
        ArchitecturalClaimDTO(
            id="claim:x",
            run_id="run-1",
            statement="Some claim",
            epistemic_type="guessed",
            support_status="supported",
            producer=valid_producer,
            evidence_chain={
                "id": "evidence-chain:x",
                "run_id": "run-1",
                "claim_id": "claim:x",
                "items": [],
                "hop_count": 0,
            },
            created_at=datetime.now(UTC),
        )


def test_architectural_claim_dto_requires_required_fields() -> None:
    with pytest.raises(ValidationError):
        ArchitecturalClaimDTO()  # type: ignore[call-arg]


def test_architectural_claim_dto_round_trips_through_domain() -> None:
    span = SourceSpanEvidence.create(
        run_id="run-1",
        source_region_id="region:abc",
        content_hash="hash-1",
        description="health route defined here",
        producer=PRODUCER,
    )
    claim = ArchitecturalClaim.create(
        run_id="run-1",
        statement="The app exposes a health route",
        epistemic_type="observed",
        support_status="supported",
        confidence=0.9,
        producer=PRODUCER,
        evidence_items=(span,),
        subject_symbol_ids=("symbol:health",),
    )

    dto = ArchitecturalClaimDTO.from_domain(claim)
    restored = dto.to_domain()

    assert restored.id == claim.id
    assert restored.evidence_chain.id == claim.evidence_chain.id
    assert restored.evidence_chain.items[0].id == claim.evidence_chain.items[0].id
    assert dto.model_dump()["evidence_chain"]["items"][0]["kind"] == "source_span"


# ---------------------------------------------------------------------------
# Experimental route stub — proves the contract works against real lens
# data, without wiring the router into the production app (api/app.py is
# untouched; the router is mounted onto a throwaway FastAPI app here only).
# ---------------------------------------------------------------------------


def test_experimental_claims_route_returns_projected_claims_for_a_real_lens(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    app = create_app(Settings(environment="test"))
    app.include_router(claims_router, prefix="/api")
    client = TestClient(app)

    analyze_response = client.post("/api/analyze", json={"repository_path": str(tmp_path)})
    assert analyze_response.status_code == 200
    run_id = analyze_response.json()["run_id"]

    region = client.post(
        "/api/evidence/read-range",
        json={"run_id": run_id, "path": "app.py", "start_line": 1, "end_line": 2},
    ).json()

    grounding_response = client.post(
        "/api/grounding/validate",
        json={
            "run_id": run_id,
            "claims": [
                {
                    "id": "c1",
                    "text": "The app has a health function.",
                    "requested_status": "verified",
                    "citations": [{"kind": "source_region", "ref_id": region["id"]}],
                }
            ],
        },
    )
    assert grounding_response.status_code == 200

    lens_response = client.get(f"/api/query-lenses/{region['id']}/claims", params={"run_id": run_id})
    # A source_region id is not a real lens id, so this must 404 cleanly
    # rather than error — proves lens-not-found handling on the new route.
    assert lens_response.status_code == 404


def test_experimental_claims_route_404s_when_no_run_is_active() -> None:
    app: FastAPI = create_app(Settings(environment="test"))
    app.include_router(claims_router, prefix="/api")
    client = TestClient(app)

    response = client.get("/api/query-lenses/some-lens/claims")
    assert response.status_code in (404, 503)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
