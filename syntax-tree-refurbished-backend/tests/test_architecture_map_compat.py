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
    model_name: str = "fake-architecture-map"
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


def test_architecture_map_projects_httpx_overview_and_caches_model(tmp_path: Path) -> None:
    write(tmp_path / "httpx" / "__init__.py", "from ._api import get\nfrom ._client import Client\n")
    write(tmp_path / "httpx" / "_api.py", "def get(url):\n    return Client().send('GET', url)\n")
    write(tmp_path / "httpx" / "_client.py", "class Client:\n    def send(self, method, url):\n        return self._transport.handle_request(method, url)\n")
    write(tmp_path / "httpx" / "_auth.py", "class BasicAuth:\n    pass\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(httpx_replies())

    first = client.get(f"/api/architecture-map?run_id={run_id}")
    second = client.get(f"/api/architecture-map?run_id={run_id}")

    assert first.status_code == 200
    assert second.status_code == 200
    body = first.json()
    assert body["diagnostics"]["repo_shape"] == "python_http_client_library"
    assert body["root"]["label"] == tmp_path.name
    labels = {node["label"] for node in body["nodes"]}
    assert {"Public Request API", "Client Lifecycle", "Auth And Cookies"} <= labels
    assert not {"Frontend", "RAG", "Chat"} & labels
    assert body["diagnostics"]["verified_node_count"] >= 2
    assert app.state.investigation_model.calls == 1


def test_node_detail_explanation_evidence_and_implementation_slice(tmp_path: Path) -> None:
    write(tmp_path / "httpx" / "_api.py", "def get(url):\n    return Client().send('GET', url)\n")
    write(tmp_path / "httpx" / "_client.py", "class Client:\n    def send(self, method, url):\n        return None\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(httpx_replies())
    map_body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    node = next(item for item in map_body["nodes"] if item["label"] == "Public Request API")
    node_id = node["id"]

    detail = client.get(f"/api/architecture-map/nodes/{node_id}?run_id={run_id}")
    explanation = client.get(f"/api/architecture-map/nodes/{node_id}/explanation?run_id={run_id}")
    evidence = client.get(f"/api/architecture-map/nodes/{node_id}/evidence?run_id={run_id}")
    implementation = client.get(f"/api/architecture-map/nodes/{node_id}/implementation?run_id={run_id}")
    generic = client.get(f"/api/implementation-slices?run_id={run_id}&subject_type=architecture_node&subject_id={node_id}")

    assert detail.status_code == 200
    assert explanation.status_code == 200
    assert evidence.status_code == 200
    assert implementation.status_code == 200
    assert generic.status_code == 200
    assert explanation.json()["summary"]
    evidence_body = evidence.json()
    assert evidence_body["total"] >= 1
    assert evidence_body["evidence"][0]["file_path"] == "httpx/_api.py"
    region_id = evidence_body["evidence"][0]["source_ref_id"]
    assert client.get(f"/api/source-regions/{region_id}").status_code == 200
    implementation_body = implementation.json()
    assert implementation_body["status"] == "verified"
    assert implementation_body["primary_span_id"]
    assert implementation_body["tabs"][0]["file_path"] == "httpx/_api.py"
    assert implementation_body["tabs"][0]["highlights"][0]["start_line"] == 1
    assert generic.json()["primary_span_id"] == implementation_body["primary_span_id"]


def test_node_neighborhood_returns_real_one_hop_relations(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = analyzed_app(tmp_path)
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")
    callee = next(s for s in symbols if s.name == "callee")

    caller_response = client.get(f"/api/architecture-map/nodes/{caller.id}/neighborhood?run_id={run_id}")
    callee_response = client.get(f"/api/architecture-map/nodes/{callee.id}/neighborhood?run_id={run_id}")

    assert caller_response.status_code == 200
    caller_body = caller_response.json()
    assert caller_body["node_id"] == caller.id
    assert {node["id"] for node in caller_body["dependencies"]} == {callee.id}
    assert caller_body["dependents"] == []
    edge = next(e for e in caller_body["edges"] if e["source"] == caller.id and e["target"] == callee.id)
    assert edge["kind"] == "calls"
    # A "resolved" relation is a deterministic fact, not a probabilistic
    # guess -- it must never carry a confidence value (see
    # ObservedProgramRelation's own validation).
    assert edge["confidence"] is None

    assert callee_response.status_code == 200
    callee_body = callee_response.json()
    assert callee_body["node_id"] == callee.id
    assert {node["id"] for node in callee_body["dependents"]} == {caller.id}
    assert callee_body["dependencies"] == []


def test_node_neighborhood_404_for_unknown_node(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def solo():\n    return 1\n")
    app, run_id, client = analyzed_app(tmp_path)

    response = client.get(f"/api/architecture-map/nodes/symbol:does-not-exist/neighborhood?run_id={run_id}")

    assert response.status_code == 404


def test_source_backed_component_is_verified_even_when_model_support_is_uncertain(tmp_path: Path) -> None:
    write(tmp_path / "pkg" / "client.py", "class Client:\n    pass\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(
        [
            {
                "final": {
                    "summary": "Client library.",
                    "simple_explanation": "Client exists.",
                    "technical_explanation": "Client source was inspected.",
                    "repo_shape": {"kind": "library", "label": "Library", "confidence": 0.7, "support_status": "inferred"},
                    "component_hypotheses": [
                        {
                            "label": "Client Lifecycle",
                            "summary": "Client source area.",
                            "support_status": "inferred",
                            "related_file_paths": ["pkg/client.py"],
                        }
                    ],
                    "claims": [
                        {
                            "id": "c1",
                            "text": "Client class exists.",
                            "requested_status": "verified",
                            "citations": [{"kind": "file_range", "path": "pkg/client.py", "start_line": 1, "end_line": 2}],
                        }
                    ],
                }
            }
        ]
    )

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    node = next(item for item in body["nodes"] if item["label"] == "Client Lifecycle")
    implementation = client.get(f"/api/architecture-map/nodes/{node['id']}/implementation?run_id={run_id}").json()

    assert node["status"] == "verified"
    assert implementation["status"] == "verified"
    assert implementation["tabs"][0]["file_path"] == "pkg/client.py"


def test_component_evidence_filters_broad_overview_regions_by_component_meaning(tmp_path: Path) -> None:
    write(tmp_path / "pkg" / "client.py", "class Client:\n    pass\n")
    write(tmp_path / "pkg" / "auth.py", "class Auth:\n    pass\n")
    app, run_id, client = analyzed_app(tmp_path)
    client_region = client.post(
        "/api/evidence/read-range",
        json={"run_id": run_id, "path": "pkg/client.py", "start_line": 1, "end_line": 2},
    ).json()
    auth_region = client.post(
        "/api/evidence/read-range",
        json={"run_id": run_id, "path": "pkg/auth.py", "start_line": 1, "end_line": 2},
    ).json()
    app.state.investigation_model = ScriptedModel(
        [
            {
                "final": {
                    "summary": "Client and auth library.",
                    "simple_explanation": "Client and auth exist.",
                    "technical_explanation": "Source regions were inspected.",
                    "repo_shape": {"kind": "library", "label": "Library", "confidence": 0.7, "support_status": "verified"},
                    "component_hypotheses": [
                        {
                            "label": "Client Lifecycle",
                            "support_status": "verified",
                            "source_region_ids": [client_region["id"], auth_region["id"]],
                        }
                    ],
                    "important_regions": [
                        {"source_region_id": client_region["id"], "path": "pkg/client.py"},
                        {"source_region_id": auth_region["id"], "path": "pkg/auth.py"},
                    ],
                }
            }
        ]
    )
    map_body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    node = next(item for item in map_body["nodes"] if item["label"] == "Client Lifecycle")

    implementation = client.get(f"/api/architecture-map/nodes/{node['id']}/implementation?run_id={run_id}").json()

    assert implementation["status"] == "verified"
    assert [tab["file_path"] for tab in implementation["tabs"]] == ["pkg/client.py"]


def test_architecture_map_children_are_empty_without_generated_lens(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(
        [
            {
                "final": {
                    "summary": "Health app.",
                    "simple_explanation": "Health exists.",
                    "technical_explanation": "Health function is present.",
                    "repo_shape": {"kind": "unknown", "label": "Unknown", "confidence": 0.4, "support_status": "uncertain"},
                    "component_hypotheses": [{"label": "Health", "source_region_ids": []}],
                }
            }
        ]
    )
    map_body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    node_id = next(item for item in map_body["nodes"] if item["label"] == "Health")["id"]

    children = client.get(f"/api/architecture-map/nodes/{node_id}/children?run_id={run_id}")

    assert children.status_code == 200
    assert children.json()["children"] == []
    assert children.json()["total"] == 0


def test_no_llm_overview_renders_verified_static_source_map(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "@app.get('/health')\ndef health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()

    assert body["diagnostics"]["repo_shape"] == "static_module_graph"
    assert body["nodes"]
    assert all(node["status"] == "verified" for node in body["nodes"])
    assert any(node["label"] == "app.py" for node in body["nodes"])
    assert body["diagnostics"]["warnings"]


def test_unsupported_implementation_subject_is_structured(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)

    response = client.get(f"/api/implementation-slices?run_id={run_id}&subject_type=flow&subject_id=missing")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unsupported"
    assert body["unsupported_reason"] == "unsupported_subject_type"


def test_architecture_map_errors_for_missing_run_and_unknown_node(tmp_path: Path) -> None:
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    assert client.get("/api/architecture-map").status_code == 503

    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)
    assert client.get(f"/api/architecture-map/nodes/missing?run_id={run_id}").status_code == 404


def httpx_replies() -> list[dict[str, Any]]:
    return [
        {
            "final": {
                "summary": "This repository is a Python HTTP client library with public helpers, clients, and auth.",
                "simple_explanation": "Users call helpers or clients; clients perform HTTP behavior.",
                "technical_explanation": "Public helper source delegates into Client.send.",
                "repo_shape": {
                    "kind": "python_http_client_library",
                    "label": "Python HTTP client library",
                    "confidence": 0.9,
                    "support_status": "verified",
                },
                "component_hypotheses": [
                    {
                        "label": "Public Request API",
                        "summary": "Top-level helper functions such as get.",
                        "support_status": "verified",
                        "related_file_paths": ["httpx/_api.py"],
                    },
                    {
                        "label": "Client Lifecycle",
                        "summary": "Client.send coordinates request dispatch.",
                        "support_status": "verified",
                        "related_file_paths": ["httpx/_client.py"],
                    },
                    {
                        "label": "Auth And Cookies",
                        "summary": "Authentication helpers.",
                        "support_status": "verified",
                        "related_file_paths": ["httpx/_auth.py"],
                    },
                ],
                "relationships": [
                    {"from": "Public Request API", "to": "Client Lifecycle", "label": "delegates to", "support_status": "verified"}
                ],
                "claims": [
                    {
                        "id": "c1",
                        "text": "The public get helper delegates to Client.send.",
                        "requested_status": "verified",
                        "citations": [{"kind": "file_range", "path": "httpx/_api.py", "start_line": 1, "end_line": 2}],
                    },
                    {
                        "id": "c2",
                        "text": "Client.send is implemented on Client.",
                        "requested_status": "verified",
                        "citations": [{"kind": "file_range", "path": "httpx/_client.py", "start_line": 1, "end_line": 2}],
                    },
                    {
                        "id": "c3",
                        "text": "Authentication helpers are present.",
                        "requested_status": "verified",
                        "citations": [{"kind": "file_range", "path": "httpx/_auth.py", "start_line": 1, "end_line": 2}],
                    },
                ],
                "suggested_next_questions": ["How does a request reach the transport layer?"],
                "gaps": [],
            }
        }
    ]


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
