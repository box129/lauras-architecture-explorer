from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.investigation.llm_model import ModelReply
from syntax_tree_refurbished.config import Settings


@dataclass
class ScriptedModel:
    replies: list[dict[str, Any]]
    model_name: str = "fake-drilldown"
    calls: int = 0

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        self.calls += 1
        if not self.replies:
            raise RuntimeError("No scripted replies left.")
        return ModelReply(
            data=self.replies.pop(0),
            model=self.model_name,
            tokens_in=100,
            tokens_out=50,
            latency_ms=1,
        )


def test_component_children_generate_cache_and_support_child_proof(tmp_path: Path) -> None:
    write(tmp_path / "httpx" / "_client.py", "\n".join([
        "class Client:",
        "    def send(self, request):",
        "        return self._send_handling_redirects(request)",
        "    def _send_handling_redirects(self, request):",
        "        return self._send_single_request(request)",
        "class AsyncClient(Client):",
        "    async def send(self, request):",
        "        return await self._send_single_request(request)",
    ]))
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel([
        overview_reply(),
        drilldown_reply(),
    ])
    root_map = client.get(f"/api/architecture-map?run_id={run_id}").json()
    parent = next(node for node in root_map["nodes"] if node["label"] == "Client Lifecycle")

    first = client.get(f"/api/architecture-map/nodes/{parent['id']}/children?run_id={run_id}")
    second = client.get(f"/api/architecture-map/nodes/{parent['id']}/children?run_id={run_id}")

    assert first.status_code == 200
    assert second.status_code == 200
    assert app.state.investigation_model.calls == 2
    children = first.json()["children"]
    labels = {child["label"] for child in children}
    assert {"Sync Client", "Async Client", "Request Sending", "Redirect Handling"} <= labels
    assert not {"Frontend", "RAG", "Persistence"} & labels
    sync = next(child for child in children if child["label"] == "Sync Client")
    assert sync["status"] == "verified"
    detail = client.get(f"/api/architecture-map/nodes/{sync['id']}?run_id={run_id}")
    evidence = client.get(f"/api/architecture-map/nodes/{sync['id']}/evidence?run_id={run_id}")
    implementation = client.get(f"/api/architecture-map/nodes/{sync['id']}/implementation?run_id={run_id}")
    explanation = client.get(f"/api/architecture-map/nodes/{sync['id']}/explanation?run_id={run_id}")
    assert detail.status_code == 200
    assert evidence.status_code == 200
    assert implementation.status_code == 200
    assert explanation.status_code == 200
    assert evidence.json()["total"] >= 1
    assert implementation.json()["status"] == "verified"
    assert implementation.json()["tabs"][0]["file_path"] == "httpx/_client.py"


def test_verified_child_without_source_is_downgraded_to_insufficient(tmp_path: Path) -> None:
    write(tmp_path / "pkg" / "client.py", "class Client:\n    pass\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel([
        overview_reply(path="pkg/client.py"),
        {
            "final": {
                "summary": "Client drilldown.",
                "simple_explanation": "A child was suggested.",
                "technical_explanation": "No source citation was attached.",
                "component_hypotheses": [
                    {"label": "Imagined Send Pipeline", "support_status": "verified"}
                ],
            }
        },
    ])
    root_map = client.get(f"/api/architecture-map?run_id={run_id}").json()
    parent = next(node for node in root_map["nodes"] if node["label"] == "Client Lifecycle")

    child = client.get(f"/api/architecture-map/nodes/{parent['id']}/children?run_id={run_id}").json()["children"][0]

    assert child["label"] == "Imagined Send Pipeline"
    assert child["status"] == "insufficient"
    assert child["evidence_count"] == 0


def test_file_like_child_becomes_code_group_not_fake_architecture(tmp_path: Path) -> None:
    write(tmp_path / "httpx" / "_client.py", "class Client:\n    pass\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel([
        overview_reply(),
        {
            "final": {
                "summary": "Only file grouping was found.",
                "simple_explanation": "A file group is available.",
                "technical_explanation": "The model did not find a better semantic split.",
                "component_hypotheses": [
                    {
                        "label": "httpx/_client.py",
                        "support_status": "verified",
                        "source_region_ids": [],
                    }
                ],
                "claims": [
                    {
                        "id": "c1",
                        "text": "The client file exists.",
                        "requested_status": "verified",
                        "citations": [{"kind": "file_range", "path": "httpx/_client.py", "start_line": 1, "end_line": 2}],
                    }
                ],
            }
        },
    ])
    root_map = client.get(f"/api/architecture-map?run_id={run_id}").json()
    parent = next(node for node in root_map["nodes"] if node["label"] == "Client Lifecycle")

    child = client.get(f"/api/architecture-map/nodes/{parent['id']}/children?run_id={run_id}").json()["children"][0]

    assert child["label"] == "Client Code Group"
    assert child["kind"] == "code_group"


def test_no_llm_drilldown_returns_verified_parsed_symbols(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "@app.get('/health')\ndef health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)
    root_map = client.get(f"/api/architecture-map?run_id={run_id}").json()
    parent = next(node for node in root_map["nodes"] if node["kind"] != "system")

    response = client.get(f"/api/architecture-map/nodes/{parent['id']}/children?run_id={run_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["children"]
    assert body["children"][0]["label"] == "health"
    assert body["children"][0]["status"] == "verified"
    assert body["children"][0]["source_refs"]["source_region_ids"]


def overview_reply(path: str = "httpx/_client.py") -> dict[str, Any]:
    return {
        "final": {
            "summary": "This repository includes client lifecycle behavior.",
            "simple_explanation": "The client sends requests.",
            "technical_explanation": "Client.send is implemented in source.",
            "repo_shape": {
                "kind": "python_http_client_library",
                "label": "Python HTTP client library",
                "confidence": 0.9,
                "support_status": "verified",
            },
            "component_hypotheses": [
                {
                    "label": "Client Lifecycle",
                    "summary": "Client.send coordinates request dispatch.",
                    "support_status": "verified",
                    "related_file_paths": [path],
                }
            ],
            "claims": [
                {
                    "id": "c1",
                    "text": "Client.send is implemented on Client.",
                    "requested_status": "verified",
                    "citations": [{"kind": "file_range", "path": path, "start_line": 1, "end_line": 3}],
                }
            ],
        }
    }


def drilldown_reply() -> dict[str, Any]:
    return {
        "final": {
            "summary": "Client lifecycle breaks down into sync, async, request sending, and redirects.",
            "simple_explanation": "The client has separate sync and async entrypoints, and send delegates into request handling.",
            "technical_explanation": "Client.send and AsyncClient.send are separate source-backed behaviors.",
            "component_hypotheses": [
                {
                    "label": "Sync Client",
                    "summary": "Synchronous Client.send path.",
                    "support_status": "verified",
                    "source_region_ids": [],
                    "related_file_paths": ["httpx/_client.py"],
                },
                {
                    "label": "Async Client",
                    "summary": "Asynchronous client send path.",
                    "support_status": "verified",
                    "source_region_ids": [],
                    "related_file_paths": ["httpx/_client.py"],
                },
                {
                    "label": "Request Sending",
                    "summary": "Request dispatch through send helpers.",
                    "support_status": "verified",
                    "source_region_ids": [],
                    "related_file_paths": ["httpx/_client.py"],
                },
                {
                    "label": "Redirect Handling",
                    "summary": "Redirect-aware send path.",
                    "support_status": "verified",
                    "source_region_ids": [],
                    "related_file_paths": ["httpx/_client.py"],
                },
            ],
            "claims": [
                {
                    "id": "c1",
                    "text": "Sync Client uses Client.send.",
                    "requested_status": "verified",
                    "citations": [{"kind": "file_range", "path": "httpx/_client.py", "start_line": 1, "end_line": 3}],
                },
                {
                    "id": "c2",
                    "text": "Async Client has async send behavior.",
                    "requested_status": "verified",
                    "citations": [{"kind": "file_range", "path": "httpx/_client.py", "start_line": 6, "end_line": 8}],
                },
                {
                    "id": "c3",
                    "text": "Request Sending delegates into _send_single_request.",
                    "requested_status": "verified",
                    "citations": [{"kind": "file_range", "path": "httpx/_client.py", "start_line": 2, "end_line": 5}],
                },
                {
                    "id": "c4",
                    "text": "Redirect Handling uses _send_handling_redirects.",
                    "requested_status": "verified",
                    "citations": [{"kind": "file_range", "path": "httpx/_client.py", "start_line": 3, "end_line": 5}],
                },
            ],
        }
    }


def analyzed_app(repo: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    assert response.json()["status"] == "running"
    return app, response.json()["run_id"], client


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
