from __future__ import annotations

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.analysis.analysis_controller import AnalysisController


def test_analysis_websocket_matches_frontend_contract(tmp_path) -> None:
    (tmp_path / "sample.py").write_text("def answer():\n    return 42\n", encoding="utf-8")
    app = create_app()
    client = TestClient(app)
    controller = AnalysisController(settings=app.state.settings, store=app.state.run_store)
    job = controller.start(str(tmp_path))

    with client.websocket_connect(f"/api/ws/analyze/{job.job_id}") as websocket:
        progress = websocket.receive_json()
        controller.run(job)
        messages = [websocket.receive_json()]
        while messages[-1]["event"] != "pipeline_complete":
            messages.append(websocket.receive_json())
        complete = messages[-1]

    assert progress["event"] == "status_update"
    assert progress["data"]["job_id"] == job.job_id
    assert progress["data"]["status"] == "running"
    assert progress["data"]["stage"] == "repo_snapshot"
    assert any(message["event"] == "status_update" for message in messages)
    assert complete["event"] == "pipeline_complete"
    assert complete["data"]["status"] == "completed"
    assert complete["data"]["progress"]["files_total"] == 1
    assert complete["data"]["progress"]["can_render_frontend"] is True


def test_analysis_websocket_reports_analysis_errors() -> None:
    client = TestClient(create_app())
    analyze = client.post(
        "/api/analyze",
        json={"repository_path": "Z:/definitely/missing/syntax-tree-repository"},
    )
    job_id = analyze.json()["job_id"]

    with client.websocket_connect(f"/api/ws/analyze/{job_id}") as websocket:
        progress = websocket.receive_json()
        error = websocket.receive_json()

    assert progress["event"] == "status_update"
    assert progress["data"]["status"] == "failed"
    assert error["event"] == "error"
    assert error["data"]["error"]


def test_analysis_websocket_supports_disconnect_and_reconnect(tmp_path) -> None:
    (tmp_path / "sample.ts").write_text("export const ready = true;\n", encoding="utf-8")
    client = TestClient(create_app())
    job_id = client.post(
        "/api/analyze", json={"repository_path": str(tmp_path)}
    ).json()["job_id"]

    with client.websocket_connect(f"/api/ws/analyze/{job_id}") as websocket:
        assert websocket.receive_json()["event"] == "status_update"

    with client.websocket_connect(f"/api/ws/analyze/{job_id}") as websocket:
        assert websocket.receive_json()["event"] == "status_update"
        assert websocket.receive_json()["event"] == "pipeline_complete"


def test_analysis_websocket_reports_unknown_job() -> None:
    client = TestClient(create_app())

    with client.websocket_connect("/api/ws/analyze/job:missing") as websocket:
        error = websocket.receive_json()

    assert error == {
        "event": "error",
        "data": {"status": "failed", "error": "Analysis job not found."},
    }
