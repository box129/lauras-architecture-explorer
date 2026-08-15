from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.query.query_lens_adapter import investigation_to_query_response
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.grounding import (
    Citation,
    CitationValidation,
    Claim,
    GroundedClaim,
)
from syntax_tree_refurbished.core.models.investigation import (
    InvestigationAnswer,
    InvestigationMetrics,
    InvestigationResult,
)


def test_run_metrics_uses_repo_path_from_snapshot(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    client = TestClient(create_app(Settings(environment="test")))
    analyze = client.post("/api/analyze", json={"repository_path": str(tmp_path)})
    assert analyze.status_code == 200
    run_id = analyze.json()["run_id"]

    response = client.get(f"/api/runs/{run_id}/metrics")

    assert response.status_code == 200
    assert response.json()["repository_name"] == str(tmp_path)


def test_flows_list_is_empty_compat_response_for_active_run(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    client = TestClient(create_app(Settings(environment="test")))
    analyze = client.post("/api/analyze", json={"repository_path": str(tmp_path)})
    assert analyze.status_code == 200
    run_id = analyze.json()["run_id"]

    response = client.get("/api/flows?limit=50")

    assert response.status_code == 200
    assert response.json() == {
        "analysis_run_id": run_id,
        "flows": [],
        "total": 0,
        "limit": 50,
        "offset": 0,
    }


def test_query_response_adapter_does_not_require_grounded_claim_confidence() -> None:
    claim = GroundedClaim(
        claim=Claim(
            id="claim-auth",
            text="Authentication is enforced by get_current_user.",
            requested_status="verified",
            citations=(),
        ),
        support_status="verified",
        citations=(
            CitationValidation(
                citation=Citation(kind="file_range", path="backend/app/api/deps.py", start_line=1, end_line=8),
                valid=True,
                support_status="verified",
                resolved_region_id=None,
                reason="Source cited by the investigation.",
            ),
        ),
        failures=(),
    )
    result = InvestigationResult(
        run_id="run:test",
        status="completed",
        question="How is authentication implemented?",
        mode="focused_question",
        answer=InvestigationAnswer(
            summary="Authentication uses get_current_user.",
            simple_explanation="Requests are checked by a dependency.",
            technical_explanation="The dependency validates the user before protected routes run.",
        ),
        resolved_hypotheses=(),
        rejected_hypotheses=(),
        remaining_uncertainties=(),
        component_hypotheses=(),
        relationships=(),
        claims=(claim,),
        important_regions=(),
        suggested_next_questions=(),
        tool_trace=(),
        gaps=(),
        metrics=InvestigationMetrics(
            llm_used=True,
            tool_calls=1,
            regions_returned=0,
            tokens_in=10,
            tokens_out=5,
            latency_ms=1,
            model="test",
            fallback_reason=None,
        ),
    )

    body = investigation_to_query_response(result, "How is authentication implemented?", None, store=None)

    assert body["confidence"] == 1.0
    assert body["run_metadata"]["tokens_in"] == 10


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
