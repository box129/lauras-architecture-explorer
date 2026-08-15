"""Tests for api.routes.architectural_explanation.

UPDATED at Phase-6 integration: this router is now registered in
api/app.py (see that module) -- these tests exercise it via a plain
``create_app()`` instance, no manual router mounting needed anymore.

Uses the real ``AnalysisController``/``InMemoryRunStore`` pipeline (via
``POST /api/analyze`` against a tiny real repository fixture, exactly the
``analyzed_app`` pattern already used by tests/test_grounding_validation.py)
to get REAL, persisted ``ParsedSymbol``/``ObservedProgramRelation`` data,
rather than hand-fabricating those objects -- more realistic, and proves
the route's ``store.get_symbols``/``store.get_relations`` wiring against
actual analysis output.

No live LLM call anywhere: the fake proposer is injected via
``request.app.state.claim_proposer``, mirroring the ``investigation_model``
test-injection hook api/routes/query.py's ``_model(request)`` already uses.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.architectural_explanation.claim_proposer import ClaimProposer
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.architectural_explanation import BoundedEvidence, ClaimProposal
from syntax_tree_refurbished.core.models.provenance import ClaimProposition, ProducerInfo


def _app_with_route() -> FastAPI:
    """The route is registered by create_app() itself now (Phase-6
    integration) -- no manual router mounting needed."""
    return create_app(Settings(environment="test"))


class _FixedProposalsProposer:
    def __init__(self, proposals: tuple[ClaimProposal, ...]) -> None:
        self._proposals = proposals

    def propose_claims(self, evidence: BoundedEvidence) -> tuple[ClaimProposal, ...]:
        return self._proposals


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _analyzed(repo: Path):
    app = _app_with_route()
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    run_id = response.json()["run_id"]
    return app, run_id, client


def test_route_is_registered_in_default_app() -> None:
    """Phase-6 integration registered this router in api/app.py -- a
    request must reach OUR handler, not FastAPI's generic
    route-not-found 404. With no analysis run active at all,
    resolve_ready_run's own 503 ("no active run") fires before our
    handler's own entity-lookup logic does -- that 503 (not FastAPI's
    generic 404) is itself the proof the route is registered and
    reachable."""
    default_app = create_app(Settings(environment="test"))
    default_client = TestClient(default_app)
    response = default_client.post("/api/entities/symbol:whatever/claims")
    assert response.status_code == 503


def test_unknown_entity_id_returns_404(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)

    response = client.post(
        "/api/entities/symbol:does-not-exist/claims", json=None, params={"run_id": run_id}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Entity not found in this analysis run."


def test_successful_call_returns_verified_claims(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)

    symbols = app.state.run_store.get_symbols(run_id)
    relations = app.state.run_store.get_relations(run_id)
    caller = next(s for s in symbols if s.name == "caller")
    callee = next(s for s in symbols if s.name == "callee")
    real_relation = next(
        r for r in relations if r.source_entity_id == caller.id and r.target_entity_id == callee.id
    )
    assert real_relation.resolution_status == "resolved"

    proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation",
            subject_entity_id=caller.id,
            relation_kind="calls",
            object_entity_id=callee.id,
        ),
        proposed_statement="caller calls callee",
        producer=ProducerInfo(producer_type="llm", name="fake-test-model", version="v1"),
    )
    app.state.claim_proposer = _FixedProposalsProposer((proposal,))

    response = client.post(
        f"/api/entities/{caller.id}/claims", json=None, params={"run_id": run_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["analysis_run_id"] == run_id
    assert body["target_id"] == caller.id
    assert body["supported_count"] == 1
    assert body["insufficient_evidence_count"] == 0
    assert len(body["claims"]) == 1
    claim = body["claims"][0]
    assert claim["support_status"] == "supported"
    assert claim["producer"]["producer_type"] == "llm"
    assert claim["proposition"]["subject_entity_id"] == caller.id
    assert claim["proposition"]["object_entity_id"] == callee.id


def test_no_injected_proposer_falls_back_to_null_proposer_and_returns_zero_claims(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")

    response = client.post(f"/api/entities/{caller.id}/claims", json=None, params={"run_id": run_id})

    assert response.status_code == 200
    body = response.json()
    assert body["claims"] == []
    assert body["supported_count"] == 0
    assert body["insufficient_evidence_count"] == 0


# ---------------------------------------------------------------------------
# Phase-6 integration: the full explanation endpoint (L2 verification + L3
# composition chained together)
# ---------------------------------------------------------------------------


def test_architectural_explanation_endpoint_chains_verification_and_composition(tmp_path: Path) -> None:
    # "deeper" sits two call-hops from "caller" (caller -> callee -> deeper),
    # so it IS within gather_bounded_evidence's default 2-hop neighborhood
    # (a real proposal may legitimately reference it) -- but there is no
    # DIRECT relation caller -> deeper, so a direct_relation claim asserting
    # one is genuinely false and must come back insufficient_evidence, not
    # be dropped for referencing an out-of-evidence entity (which would be
    # a different, weaker test than the one intended here).
    _write(
        tmp_path / "app.py",
        "def caller():\n    return callee()\n\n\ndef callee():\n    return deeper()\n\n\ndef deeper():\n    return 1\n",
    )
    app, run_id, client = _analyzed(tmp_path)
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")
    callee = next(s for s in symbols if s.name == "callee")
    deeper = next(s for s in symbols if s.name == "deeper")

    true_proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation", subject_entity_id=caller.id, relation_kind="calls",
            object_entity_id=callee.id,
        ),
        proposed_statement="caller calls callee",
        producer=ProducerInfo(producer_type="llm", name="fake-test-model", version="v1"),
    )
    false_proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation", subject_entity_id=caller.id, relation_kind="calls",
            object_entity_id=deeper.id,
        ),
        proposed_statement="caller directly calls deeper (false -- only reachable via callee)",
        producer=ProducerInfo(producer_type="llm", name="fake-test-model", version="v1"),
    )
    app.state.claim_proposer = _FixedProposalsProposer((true_proposal, false_proposal))

    response = client.post(
        f"/api/entities/{caller.id}/architectural-explanation", json=None, params={"run_id": run_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["analysis_run_id"] == run_id
    assert body["target_kind"] == "entity"
    assert body["target_id"] == caller.id
    assert body["supported_count"] == 1
    assert body["insufficient_evidence_count"] == 1
    assert len(body["claims"]) == 2
    assert body["explanation_id"].startswith("explanation:")
    # L3's narrative must distinguish the two -- both claim statements
    # (deterministically rendered, never LLM prose) should be traceable in
    # the composed narrative.
    narrative = body["narrative"]
    assert "callee" in narrative
    supported = next(c for c in body["claims"] if c["support_status"] == "supported")
    insufficient = next(c for c in body["claims"] if c["support_status"] == "insufficient_evidence")
    assert supported["proposition"]["object_entity_id"] == callee.id
    assert insufficient["proposition"]["object_entity_id"] == deeper.id


def test_architectural_explanation_endpoint_supported_claim_has_navigable_source(tmp_path: Path) -> None:
    """Phase 1 (source-backed evidence navigation): a SUPPORTED claim's
    evidence must carry a real, dereferenceable ``source_region_id`` --
    produced by the route's production ``_source_region_resolver`` (backed
    by the same ``SourceReader``/run-store abstraction
    ``POST /api/evidence/read-range`` already uses), not fabricated.
    Fetching that id via the existing ``GET /api/source-regions/{id}``
    route must resolve to the exact file/line range the relation was
    observed at."""
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)
    symbols = app.state.run_store.get_symbols(run_id)
    relations = app.state.run_store.get_relations(run_id)
    caller = next(s for s in symbols if s.name == "caller")
    callee = next(s for s in symbols if s.name == "callee")
    real_relation = next(
        r for r in relations if r.source_entity_id == caller.id and r.target_entity_id == callee.id
    )
    assert real_relation.span_path is not None

    proposal = ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation", subject_entity_id=caller.id, relation_kind="calls",
            object_entity_id=callee.id,
        ),
        proposed_statement="caller calls callee",
        producer=ProducerInfo(producer_type="llm", name="fake-test-model", version="v1"),
    )
    app.state.claim_proposer = _FixedProposalsProposer((proposal,))

    response = client.post(
        f"/api/entities/{caller.id}/architectural-explanation", json=None, params={"run_id": run_id}
    )
    assert response.status_code == 200
    body = response.json()
    supported = next(c for c in body["claims"] if c["support_status"] == "supported")
    evidence_item = supported["evidence_chain"]["items"][0]
    region_id = evidence_item["source_region_id"]
    assert region_id

    region_response = client.get(f"/api/source-regions/{region_id}")
    assert region_response.status_code == 200
    region = region_response.json()
    assert region["path"] == real_relation.span_path
    assert region["start_line"] == real_relation.span_start_line
    assert region["end_line"] == real_relation.span_end_line


def test_architectural_explanation_endpoint_unknown_entity_404s(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    _app, run_id, client = _analyzed(tmp_path)

    response = client.post(
        "/api/entities/symbol:does-not-exist/architectural-explanation",
        json=None,
        params={"run_id": run_id},
    )
    assert response.status_code == 404


def test_architectural_explanation_endpoint_deterministic_id_same_inputs(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")

    first = client.post(
        f"/api/entities/{caller.id}/architectural-explanation", json=None, params={"run_id": run_id}
    ).json()
    second = client.post(
        f"/api/entities/{caller.id}/architectural-explanation", json=None, params={"run_id": run_id}
    ).json()
    assert first["explanation_id"] == second["explanation_id"]


# ---------------------------------------------------------------------------
# Product-hardening round, PHASE 2/7: a genuinely-configured-but-failing
# live LLM must surface as a distinguishable 503 (frontend shows
# "Architectural explanation unavailable" + Retry/Open Settings), never
# an unhandled 500 or a blank/crashed panel. Repository analysis/
# architecture exploration must remain fully unaffected -- proven below
# by continuing to use the same analyzed run/client afterward.
# ---------------------------------------------------------------------------


class _FailingProposer:
    def propose_claims(self, evidence: BoundedEvidence) -> tuple[ClaimProposal, ...]:
        raise RuntimeError("LLM network error: [Errno 111] Connection refused")


def test_llm_proposer_failure_returns_503_not_500(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)
    app.state.claim_proposer = _FailingProposer()
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")

    response = client.post(f"/api/entities/{caller.id}/claims", json=None, params={"run_id": run_id})

    assert response.status_code == 503
    detail = response.json()["detail"]
    assert detail["code"] == "architectural_explanation_unavailable"
    assert "could not be reached" in detail["message"]
    # The raw exception text (which could contain internal detail) must
    # not leak into the user-facing message.
    assert "Errno 111" not in response.text


def test_llm_proposer_failure_leaves_symbol_lookup_and_analysis_usable(tmp_path: Path) -> None:
    """The static-analysis/architecture-exploration surface must remain
    fully usable even while the LLM-backed endpoint is failing -- proven
    by continuing to call unrelated, already-passing endpoints against
    the SAME run/client right after the 503."""
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)
    app.state.claim_proposer = _FailingProposer()
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")

    failing = client.post(f"/api/entities/{caller.id}/claims", json=None, params={"run_id": run_id})
    assert failing.status_code == 503

    symbols_response = client.get(f"/api/runs/{run_id}/symbols")
    assert symbols_response.status_code == 200
    architecture_response = client.get("/api/architecture-map", params={"run_id": run_id})
    assert architecture_response.status_code == 200
