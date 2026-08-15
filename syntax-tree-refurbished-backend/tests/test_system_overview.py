from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.investigation.llm_model import ModelReply
from syntax_tree_refurbished.app.overview.system_overview_generator import build_overview_input_hash
from syntax_tree_refurbished.config import Settings


@dataclass
class ScriptedModel:
    replies: list[dict[str, Any]]
    model_name: str = "fake-overview"
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


def test_system_overview_generates_and_caches_http_client_library(tmp_path: Path) -> None:
    write(tmp_path / "httpx" / "__init__.py", "from ._api import get\nfrom ._client import Client\n")
    write(tmp_path / "httpx" / "_api.py", "def get(url):\n    return Client().send('GET', url)\n")
    write(tmp_path / "httpx" / "_client.py", "class Client:\n    def send(self, method, url):\n        return self._transport.handle_request(method, url)\n")
    write(tmp_path / "httpx" / "_transports" / "default.py", "class HTTPTransport:\n    def handle_request(self, method, url):\n        return None\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(httpx_overview_replies())

    first = client.get(f"/api/system-overview?run_id={run_id}")
    second = client.get(f"/api/system-overview?run_id={run_id}")

    assert first.status_code == 200
    assert second.status_code == 200
    first_body = first.json()
    second_body = second.json()
    assert first_body["status"] == "ready"
    assert first_body["repo_shape"]["kind"] == "python_http_client_library"
    assert {item["label"] for item in first_body["main_components"]} == {
        "Public Request API",
        "Client Lifecycle",
        "Transport Layer",
    }
    assert "frontend" not in {item["label"].lower() for item in first_body["main_components"]}
    assert "rag" not in {item["label"].lower() for item in first_body["main_components"]}
    assert any(claim["support_status"] == "verified" for claim in first_body["claims"])
    assert first_body["metrics"]["cached"] is False
    assert second_body["metrics"]["cached"] is True
    assert app.state.investigation_model.calls == 3


def test_system_overview_normalizes_fileish_components_and_claim_variants(tmp_path: Path) -> None:
    write(tmp_path / "httpx" / "_api.py", "def get(url):\n    return Client().send('GET', url)\n")
    write(tmp_path / "httpx" / "_client.py", "class Client:\n    def send(self, method, url):\n        return None\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(
        [
            {
                "final": {
                    "summary": "This is a library overview.",
                    "simple_explanation": "Public helpers use clients.",
                    "technical_explanation": "The API helper calls client dispatch.",
                    "repo_shape": {
                        "kind": "python_http_client_library",
                        "label": "Python HTTP client library",
                        "confidence": 0.85,
                        "support_status": "verified",
                    },
                    "component_hypotheses": [
                        {"label": "httpx/_api.py", "support_status": "verified"},
                        {"label": "httpx/_client.py", "support_status": "verified"},
                    ],
                    "relationships": [
                        {"from": "httpx/_api.py", "to": "httpx/_client.py", "label": "delegates to"}
                    ],
                    "claims": [
                        {
                            "id": "c1",
                            "statement": "The public helper calls Client.send.",
                            "requested_status": "verified",
                            "citations": [
                                {"kind": "file_range", "path": "httpx/_api.py", "start_line": 1, "end_line": 2}
                            ],
                        }
                    ],
                }
            }
        ]
    )

    body = client.get(f"/api/system-overview?run_id={run_id}").json()

    assert [component["label"] for component in body["main_components"]] == [
        "Public Request API",
        "Client Lifecycle",
    ]
    assert body["main_components"][0]["related_file_paths"] == ["httpx/_api.py"]
    assert body["relationships"][0]["from_component_id"]
    assert body["relationships"][0]["to_component_id"]
    assert body["claims"][0]["claim"]["text"] == "The public helper calls Client.send."
    assert body["claims"][0]["support_status"] == "verified"


def test_overview_input_hash_is_stable_for_same_run_inputs(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Demo\n\nHTTP client notes.\n")
    write(tmp_path / "pkg" / "__init__.py", "from .client import Client\n")
    app, run_id, _ = analyzed_app(tmp_path)
    job = app.state.run_store.get_run(run_id)

    first = build_overview_input_hash(job=job, store=app.state.run_store, model_name="fake", generation_mode="live_model")
    second = build_overview_input_hash(job=job, store=app.state.run_store, model_name="fake", generation_mode="live_model")

    assert first == second
    assert first


def test_system_overview_uses_static_source_structure_without_llm(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "@app.get('/health')\ndef health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)

    response = client.get(f"/api/system-overview?run_id={run_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["metrics"]["llm_used"] is False
    assert body["repo_shape"]["kind"] == "static_module_graph"
    assert body["gaps"] == ["Optional LLM enrichment is unavailable; this map uses deterministic static analysis."]
    assert body["main_components"]


def test_living_readme_feature_remains_orientation_only(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Demo\n\nThis project has RAG and chat.\n")
    write(tmp_path / "lib.py", "def sign(value):\n    return value\n")
    app, run_id, client = analyzed_app(tmp_path)
    orientation = app.state.run_store.get_orientation_items(run_id)[0]
    app.state.investigation_model = ScriptedModel(
        [
            {
                "final": {
                    "summary": "Docs mention RAG, but source verification is absent.",
                    "simple_explanation": "The README is guidance only.",
                    "technical_explanation": "No code evidence was found for RAG.",
                    "repo_shape": {"kind": "unknown", "label": "Unknown", "confidence": 0.2, "support_status": "uncertain"},
                    "claims": [
                        {
                            "id": "c1",
                            "text": "The repo has RAG.",
                            "requested_status": "verified",
                            "citations": [{"kind": "orientation_item", "ref_id": orientation.id}],
                        }
                    ],
                    "orientation_notes": [{"title": "README mentions RAG", "support_status": "orientation_only"}],
                    "gaps": ["RAG was not source-verified."],
                }
            }
        ]
    )

    body = client.get(f"/api/runs/{run_id}/system-overview").json()

    assert body["claims"][0]["support_status"] == "orientation_only"
    assert body["orientation_notes"]
    assert "RAG was not source-verified." in body["gaps"]
    assert not any(component["label"].lower() == "rag" for component in body["main_components"])


def test_full_stack_overview_uses_source_supported_areas(tmp_path: Path) -> None:
    write(tmp_path / "backend" / "routes.py", "@router.post('/api/auth/login')\ndef login():\n    return create_token()\n")
    write(tmp_path / "backend" / "models.py", "class User(Base):\n    pass\n")
    write(tmp_path / "frontend" / "src" / "routes" / "+page.svelte", "<h1>Login</h1>\n")
    write(tmp_path / "Dockerfile", "FROM python:3.12\n")
    app, run_id, client = analyzed_app(tmp_path)
    anchor = next(anchor for anchor in app.state.run_store.get_anchors(run_id) if anchor.kind == "http_route")
    app.state.investigation_model = ScriptedModel(
        [
            {
                "final": {
                    "summary": "The repo is a small full-stack app with login.",
                    "simple_explanation": "A frontend page talks to a backend login route.",
                    "technical_explanation": "Source anchors show frontend, auth route, model, and deployment boundaries.",
                    "repo_shape": {"kind": "full_stack_app", "label": "Full-stack app", "confidence": 0.8, "support_status": "verified"},
                    "component_hypotheses": [
                        {"component": "Frontend", "anchor_ids": [], "support_status": "verified"},
                        {"name": "Backend API", "anchor_ids": [anchor.id], "support_status": "verified"},
                        {"label": "Persistence", "support_status": "verified"},
                        "Deployment",
                    ],
                    "claims": [
                        {
                            "id": "c1",
                            "text": "The app exposes a login route.",
                            "requested_status": "verified",
                            "citations": [{"kind": "semantic_anchor", "ref_id": anchor.id}],
                        }
                    ],
                    "gaps": ["Downstream token implementation was not inspected."],
                }
            }
        ]
    )

    body = client.get(f"/api/system-overview?run_id={run_id}").json()

    assert body["repo_shape"]["kind"] == "full_stack_app"
    labels = {component["label"] for component in body["main_components"]}
    assert {"Frontend", "Backend API", "Persistence", "Deployment"} <= labels
    assert body["claims"][0]["support_status"] == "verified"
    assert body["gaps"] == ["Downstream token implementation was not inspected."]


def test_important_region_ids_resolve(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    app, run_id, client = analyzed_app(tmp_path)
    region = client.post(
        "/api/evidence/read-range",
        json={"run_id": run_id, "path": "app.py", "start_line": 1, "end_line": 2},
    ).json()
    app.state.investigation_model = ScriptedModel(
        [
            {
                "final": {
                    "summary": "Health exists.",
                    "simple_explanation": "Health is implemented in app.py.",
                    "technical_explanation": "The source region defines health.",
                    "repo_shape": {"kind": "unknown", "label": "Unknown", "confidence": 0.4, "support_status": "uncertain"},
                    "component_hypotheses": [{"label": "Health Function", "source_region_ids": [region["id"]]}],
                    "claims": [
                        {
                            "id": "c1",
                            "text": "The health function exists.",
                            "requested_status": "verified",
                            "source_region_ids": [region["id"]],
                        }
                    ],
                    "important_regions": [{"source_region_id": region["id"], "path": "app.py", "reason": "Health function"}],
                    "gaps": [],
                }
            }
        ]
    )

    body = client.get(f"/api/system-overview?run_id={run_id}").json()
    region_id = body["important_regions"][0]["source_region_id"]
    region_response = client.get(f"/api/source-regions/{region_id}")

    assert body["important_regions"][0]["path"] == "app.py"
    assert body["important_files"] == ["app.py"]
    assert region_response.status_code == 200
    assert "def health" in region_response.json()["text"]


def test_system_overview_missing_run_errors(tmp_path: Path) -> None:
    app = create_app(Settings(environment="test"))
    client = TestClient(app)

    assert client.get("/api/system-overview").status_code == 503
    assert client.get("/api/system-overview?run_id=missing").status_code == 404


def httpx_overview_replies() -> list[dict[str, Any]]:
    return [
        {
            "hypotheses": [{"id": "h1", "claim": "This is an HTTP client library."}],
            "competing_theories": [{"id": "t1", "theory": "It might be a web app."}],
            "mismatches": [],
            "next_action": {"tool": "find_definition", "args": {"query": "get"}, "reason": "Inspect public helper."},
        },
        {
            "hypotheses": [{"id": "h1", "claim": "Client.send is central."}],
            "competing_theories": [],
            "mismatches": [],
            "next_action": {"tool": "find_definition", "args": {"query": "send"}, "reason": "Inspect client dispatch."},
        },
        {
            "final": {
                "summary": "This repository is a Python HTTP client library with public helpers, clients, and transports.",
                "simple_explanation": "Users call public request helpers or clients; clients send requests through transports.",
                "technical_explanation": "The source shows public helpers delegating to Client.send, and Client.send reaching transport handling.",
                "repo_identity": {"name": "httpx", "description": "Python HTTP client library"},
                "repo_shape": {
                    "kind": "python_http_client_library",
                    "label": "Python HTTP client library",
                    "confidence": 0.9,
                    "support_status": "verified",
                    "reason": "Public helper and client source were inspected.",
                },
                "component_hypotheses": [
                    {"component": "Public Request API", "support_status": "verified"},
                    {"name": "Client Lifecycle", "support_status": "verified"},
                    "Transport Layer",
                ],
                "relationships": [
                    {
                        "from": "Public Request API",
                        "to": "Client Lifecycle",
                        "label": "delegates to",
                        "support_status": "verified",
                    }
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
                        "text": "Client.send reaches transport handle_request.",
                        "requested_status": "verified",
                        "citations": [{"kind": "file_range", "path": "httpx/_client.py", "start_line": 1, "end_line": 3}],
                    },
                ],
                "important_regions": [],
                "suggested_next_questions": ["How do sync and async clients differ?"],
                "gaps": ["Async transport path was not inspected."],
            }
        },
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
