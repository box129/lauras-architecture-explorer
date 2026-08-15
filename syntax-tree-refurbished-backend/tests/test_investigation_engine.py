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
    model_name: str = "fake-investigator"
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


def test_investigation_follows_model_decisions_and_revises_hypotheses(tmp_path: Path) -> None:
    write(tmp_path / "httpx" / "__init__.py", "from ._api import get\nfrom ._client import Client\n")
    write(tmp_path / "httpx" / "_api.py", "def get(url):\n    return Client().send('GET', url)\n")
    write(tmp_path / "httpx" / "_client.py", "class Client:\n    def send(self, method, url):\n        return self._transport.handle_request(method, url)\n")
    write(tmp_path / "httpx" / "_transports" / "default.py", "class HTTPTransport:\n    def handle_request(self, method, url):\n        return None\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(
        [
            {
                "hypotheses": [
                    {
                        "id": "h1",
                        "claim": "Public API helpers may call transports directly.",
                        "confidence": 0.4,
                        "support": "inferred",
                        "supporting_region_ids": [],
                        "missing_evidence": ["Read _api.py"],
                    }
                ],
                "competing_theories": [
                    {
                        "id": "t1",
                        "theory": "Public API helpers delegate to Client.",
                        "why_plausible": "HTTP clients usually centralize request handling.",
                        "disambiguating_evidence_needed": "Find get definition.",
                    }
                ],
                "mismatches": [],
                "next_action": {
                    "tool": "find_definition",
                    "args": {"query": "get"},
                    "reason": "Resolve the public request entrypoint.",
                },
            },
            {
                "hypotheses": [
                    {
                        "id": "h1",
                        "claim": "Public API delegates to Client.send.",
                        "confidence": 0.7,
                        "support": "verified",
                    }
                ],
                "competing_theories": [
                    {
                        "id": "t1",
                        "theory": "Public API calls transports directly.",
                        "why_plausible": "Still possible until Client.send is inspected.",
                        "disambiguating_evidence_needed": "Find Client.send.",
                    }
                ],
                "mismatches": [],
                "next_action": {
                    "tool": "find_definition",
                    "args": {"query": "send"},
                    "reason": "Check whether Client.send reaches transport.",
                },
            },
            {
                "final": {
                    "summary": "HTTPX-style requests move from public helpers through Client.send into transport handling.",
                    "simple_explanation": "The public helper creates or uses a client, and the client sends the request to a transport.",
                    "technical_explanation": "The inspected source shows get delegating to Client.send, and Client.send calling handle_request on its transport.",
                    "resolved_hypotheses": [
                        {"id": "h1", "claim": "Public helpers delegate to Client.send."}
                    ],
                    "rejected_hypotheses": [
                        {"id": "t1", "claim": "Public helpers call transports directly."}
                    ],
                    "remaining_uncertainties": [],
                    "component_hypotheses": [
                        {"component": "Public Request API", "support_status": "verified"},
                        {"name": "Client Lifecycle", "support_status": "verified"},
                        "Transport Layer",
                    ],
                    "relationships": [
                        {"from": "Public Request API", "to": "Client Lifecycle", "label": "delegates request sending"}
                    ],
                    "claims": [
                        {
                            "id": "c1",
                            "text": "The public get helper delegates request work to Client.send.",
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
                    "gaps": [],
                }
            },
        ]
    )

    body = investigate(client, run_id, "How does a request reach the transport layer?")

    assert body["status"] == "completed"
    assert [entry["tool"] for entry in body["tool_trace"]] == ["find_definition", "find_definition"]
    assert body["resolved_hypotheses"][0]["id"] == "h1"
    assert body["rejected_hypotheses"][0]["id"] == "t1"
    assert {item["label"] for item in body["component_hypotheses"]} == {
        "Public Request API",
        "Client Lifecycle",
        "Transport Layer",
    }
    assert all(claim["support_status"] == "verified" for claim in body["claims"])
    assert body["metrics"]["llm_used"] is True
    assert body["metrics"]["tool_calls"] == 2


def test_readme_only_claim_is_downgraded_by_grounding(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Demo\n\nThis project has RAG and chat.\n")
    write(tmp_path / "lib.py", "def sign(value):\n    return value\n")
    app, run_id, client = analyzed_app(tmp_path)
    orientation = app.state.run_store.get_orientation_items(run_id)[0]
    app.state.investigation_model = ScriptedModel(
        [
            {
                "final": {
                    "summary": "README mentions RAG, but source verification is not present.",
                    "simple_explanation": "The docs mention the feature, but code evidence was not inspected.",
                    "technical_explanation": "Orientation evidence is not runtime proof.",
                    "claims": [
                        {
                            "id": "c1",
                            "text": "The repo has RAG.",
                            "requested_status": "verified",
                            "citations": [{"kind": "orientation_item", "ref_id": orientation.id}],
                        }
                    ],
                    "gaps": ["RAG was not source-verified."],
                }
            }
        ]
    )

    body = investigate(client, run_id, "Does this repo have RAG?")

    assert body["status"] == "completed"
    assert body["claims"][0]["support_status"] == "orientation_only"
    assert body["metrics"]["llm_used"] is True


def test_tool_budget_stops_loop_with_partial_result(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(
        [
            {
                "hypotheses": [{"id": "h1", "claim": "Need to inspect health."}],
                "competing_theories": [],
                "mismatches": [],
                "next_action": {"tool": "search_code", "args": {"query": "health"}, "reason": "Find health."},
            },
            {
                "hypotheses": [{"id": "h1", "claim": "Still need more."}],
                "competing_theories": [],
                "mismatches": [],
                "next_action": {"tool": "search_code", "args": {"query": "missing"}, "reason": "Keep searching."},
            },
        ]
    )

    body = investigate(client, run_id, "What handles health?", budget={"max_tool_calls": 1})

    assert body["status"] == "partial"
    assert body["metrics"]["tool_calls"] == 1
    assert body["gaps"] == ["Investigation reached the tool-call budget before final synthesis."]


def test_tool_budget_requests_partial_final_synthesis(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(
        [
            {
                "hypotheses": [{"id": "h1", "claim": "Need to inspect health."}],
                "competing_theories": [],
                "mismatches": [],
                "next_action": {"tool": "search_code", "args": {"query": "health"}, "reason": "Find health."},
            },
            {
                "final": {
                    "summary": "Health is handled by app.py.",
                    "simple_explanation": "The app has a health function.",
                    "technical_explanation": "A source search found health in app.py.",
                    "claims": [],
                    "gaps": ["No route decorator was inspected."],
                }
            },
        ]
    )

    body = investigate(client, run_id, "What handles health?", budget={"max_tool_calls": 1})

    assert body["status"] == "partial"
    assert body["answer"]["summary"] == "Health is handled by app.py."
    assert "Investigation reached the tool-call budget before final synthesis." in body["gaps"]


def test_source_region_budget_requests_partial_final_synthesis(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(
        [
            {
                "hypotheses": [{"id": "h1", "claim": "Need to inspect health."}],
                "competing_theories": [],
                "mismatches": [],
                "next_action": {"tool": "search_code", "args": {"query": "health"}, "reason": "Find health."},
            },
            {
                "final": {
                    "summary": "Health is handled by app.py.",
                    "simple_explanation": "The app has a health function.",
                    "technical_explanation": "A source search found health in app.py.",
                    "component_hypotheses": [{"label": "Health Endpoint"}],
                    "claims": [],
                    "gaps": [],
                }
            },
        ]
    )

    body = investigate(
        client,
        run_id,
        "What handles health?",
        budget={"max_tool_calls": 10, "max_source_regions": 1},
    )

    assert body["status"] == "partial"
    assert body["answer"]["summary"] == "Health is handled by app.py."
    assert body["component_hypotheses"][0]["label"] == "Health Endpoint"
    assert "Investigation stopped because source-region budget was reached." in body["gaps"]


def test_non_validation_mode_without_llm_returns_degraded_status(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)

    body = investigate(client, run_id, "What does this repo do?")

    assert body["status"] == "degraded_no_llm"
    assert body["metrics"]["llm_used"] is False
    assert body["metrics"]["fallback_reason"] == "No live LLM configured."


def test_validation_mode_without_llm_fails_explicitly(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)

    body = investigate(client, run_id, "What does this repo do?", validation_mode=True)

    assert body["status"] == "failed"
    assert body["metrics"]["llm_used"] is False
    assert body["metrics"]["fallback_reason"] == "No live LLM configured in validation mode."


def test_full_stack_fixture_can_start_from_route_anchor(tmp_path: Path) -> None:
    write(tmp_path / "backend" / "routes.py", "@router.post('/api/auth/login')\ndef login():\n    return create_token()\n")
    write(tmp_path / "backend" / "auth.py", "def create_token():\n    return 'token'\n")
    app, run_id, client = analyzed_app(tmp_path)
    anchor = next(anchor for anchor in app.state.run_store.get_anchors(run_id) if anchor.kind == "http_route")
    app.state.investigation_model = ScriptedModel(
        [
            {
                "hypotheses": [{"id": "h1", "claim": "Login route likely creates a token."}],
                "competing_theories": [],
                "mismatches": [],
                "next_action": {"tool": "list_anchors", "args": {"kind": "http_route"}, "reason": "Start from route anchors."},
            },
            {
                "hypotheses": [{"id": "h1", "claim": "Login route found."}],
                "competing_theories": [],
                "mismatches": [],
                "next_action": {"tool": "find_references", "args": {"query": "create_token"}, "reason": "Find token source."},
            },
            {
                "final": {
                    "summary": "Login starts at the auth route and calls token creation.",
                    "simple_explanation": "A login request enters the backend route and creates a token.",
                    "technical_explanation": "The route anchor identifies /api/auth/login and source references show create_token usage.",
                    "claims": [
                        {
                            "id": "c1",
                            "text": "The login route is source-detected.",
                            "requested_status": "verified",
                            "citations": [{"kind": "semantic_anchor", "ref_id": anchor.id}],
                        }
                    ],
                    "gaps": [],
                }
            },
        ]
    )

    body = investigate(client, run_id, "How does login work?")

    assert body["status"] == "completed"
    assert [entry["tool"] for entry in body["tool_trace"]] == ["list_anchors", "find_references"]
    assert body["claims"][0]["support_status"] == "verified"


def test_malformed_claim_from_model_does_not_crash_endpoint(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(
        [
            {
                "final": {
                    "summary": "Health exists.",
                    "simple_explanation": "The app has a health function.",
                    "technical_explanation": "The model returned one malformed claim and one valid claim.",
                    "claims": [
                        {"id": "bad", "requested_status": "verified", "citations": []},
                        {
                            "id": "good",
                            "claim": "The health function is defined in app.py.",
                            "requested_status": "verified",
                            "citations": [
                                {
                                    "kind": "file_range",
                                    "path": "app.py",
                                    "start_line": 1,
                                    "end_line": 2,
                                }
                            ],
                        },
                    ],
                    "gaps": [],
                }
            }
        ]
    )

    body = investigate(client, run_id, "What handles health?")

    assert body["status"] == "completed"
    assert [claim["claim"]["id"] for claim in body["claims"]] == ["good"]
    assert body["claims"][0]["support_status"] == "verified"


def test_model_claim_source_region_ids_are_normalized_to_citations(tmp_path: Path) -> None:
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
                    "simple_explanation": "The app has a health function.",
                    "technical_explanation": "The claim cites source_region_ids instead of citations.",
                    "claims": [
                        {
                            "id": "c1",
                            "text": "The health function is defined in app.py.",
                            "requested_status": "verified",
                            "source_region_ids": [region["id"]],
                        }
                    ],
                    "gaps": [],
                }
            }
        ]
    )

    body = investigate(client, run_id, "What handles health?")

    assert body["claims"][0]["support_status"] == "verified"
    assert body["claims"][0]["citations"][0]["resolved_region_id"] == region["id"]


def investigate(
    client: TestClient,
    run_id: str,
    question: str,
    *,
    budget: dict | None = None,
    validation_mode: bool = False,
) -> dict:
    payload: dict[str, Any] = {"run_id": run_id, "question": question}
    if budget:
        payload["budget"] = budget
    if validation_mode:
        payload["validation_mode"] = True
    response = client.post("/api/investigate", json=payload)
    assert response.status_code == 200
    return response.json()


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
