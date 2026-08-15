"""Product-hardening round, PHASE 2: end-user Settings API for the
architectural-explanation LLM configuration.

Covers:
    - GET/PUT round-trip and immediate effect (no process restart) on
      /api/health and the claim-proposer selection.
    - Credential-safety invariants: the API key is never present in any
      GET/PUT response body, in /api/health, or in a masked "leave
      unchanged" round-trip.
    - Environment-variable configuration continuing to work as a
      fallback when nothing has been saved through the Settings API.
    - Test-connection status categorization using a local fake HTTP
      server (never a real external provider -- see
      ``test_live_llm_validation.py`` for the real-provider path, which
      is opt-in and skipped when no real credentials are present).
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.config import Settings


def _app(**settings_kwargs):
    settings = Settings(environment="test", database_path=":memory:", **settings_kwargs)
    return create_app(settings)


# ---------------------------------------------------------------------------
# GET/PUT round-trip
# ---------------------------------------------------------------------------


def test_get_defaults_to_disabled_and_unset() -> None:
    client = TestClient(_app())
    response = client.get("/api/settings/architectural-explanation")
    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is False
    assert body["configured"] is False
    assert body["credentials_present"] is False
    assert body["config_source"] == "unset"
    assert "api_key" not in body


def test_put_then_get_reflects_saved_values() -> None:
    client = TestClient(_app())
    put_response = client.put(
        "/api/settings/architectural-explanation",
        json={
            "enabled": True,
            "provider": "openrouter",
            "base_url": "https://openrouter.ai/api/v1",
            "model": "some/model",
            "api_key": "sk-super-secret-value",
        },
    )
    assert put_response.status_code == 200
    body = put_response.json()
    assert body["enabled"] is True
    assert body["provider"] == "openrouter"
    assert body["model"] == "some/model"
    assert body["configured"] is True
    assert body["credentials_present"] is True
    assert body["credential_source"] == "runtime"
    assert body["config_source"] == "runtime"

    get_response = client.get("/api/settings/architectural-explanation")
    assert get_response.json() == body


def test_put_then_get_accepts_openai_provider() -> None:
    """OpenAI as an explicit provider value (product-hardening follow-up:
    a real end user hit HTTP 400 from OpenAI's own API because the
    provider dropdown only offered OpenRouter/Blackbox) -- see
    tests/test_openai_token_parameter.py for the request-shape fix this
    provider value enables."""
    client = TestClient(_app())
    put_response = client.put(
        "/api/settings/architectural-explanation",
        json={
            "enabled": True,
            "provider": "openai",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-5.4-mini",
            "api_key": "sk-super-secret-value",
        },
    )
    assert put_response.status_code == 200
    body = put_response.json()
    assert body["provider"] == "openai"
    assert body["configured"] is True
    assert "sk-super-secret-value" not in put_response.text


def test_put_takes_effect_immediately_on_health_without_restart() -> None:
    client = TestClient(_app())
    before = client.get("/api/health").json()["architectural_explanation_llm"]
    assert before["configured"] is False

    client.put(
        "/api/settings/architectural-explanation",
        json={
            "enabled": True,
            "provider": "blackbox",
            "model": "some-model",
            "api_key": "secret-key",
        },
    )

    after = client.get("/api/health").json()["architectural_explanation_llm"]
    assert after["configured"] is True
    assert after["provider"] == "blackbox"
    assert after["credentials_present"] is True


def test_disabling_immediately_falls_back_to_null_proposer(tmp_path) -> None:
    client = TestClient(_app())
    client.put(
        "/api/settings/architectural-explanation",
        json={"enabled": True, "provider": "openrouter", "model": "m", "api_key": "k"},
    )
    client.put(
        "/api/settings/architectural-explanation",
        json={"enabled": False, "provider": "openrouter", "model": "m"},
    )
    status = client.get("/api/settings/architectural-explanation").json()
    assert status["enabled"] is False
    assert status["configured"] is False


# ---------------------------------------------------------------------------
# Masked "leave credential unchanged" semantics
# ---------------------------------------------------------------------------


def test_omitting_api_key_on_update_preserves_previously_saved_credential() -> None:
    client = TestClient(_app())
    client.put(
        "/api/settings/architectural-explanation",
        json={"enabled": True, "provider": "openrouter", "model": "m", "api_key": "original-secret"},
    )
    # A later save that only changes the model, without re-sending the
    # key (exactly what the masked-field UI does).
    response = client.put(
        "/api/settings/architectural-explanation",
        json={"enabled": True, "provider": "openrouter", "model": "new-model"},
    )
    body = response.json()
    assert body["model"] == "new-model"
    assert body["credentials_present"] is True
    assert body["credential_source"] == "runtime"


def test_clear_api_key_removes_saved_credential() -> None:
    client = TestClient(_app())
    client.put(
        "/api/settings/architectural-explanation",
        json={"enabled": True, "provider": "openrouter", "model": "m", "api_key": "original-secret"},
    )
    response = client.put(
        "/api/settings/architectural-explanation",
        json={"enabled": True, "provider": "openrouter", "model": "m", "clear_api_key": True},
    )
    body = response.json()
    assert body["credentials_present"] is False
    assert body["configured"] is False


# ---------------------------------------------------------------------------
# Credential-safety: the raw key never appears anywhere in a response.
# ---------------------------------------------------------------------------


SECRET = "sk-THIS-MUST-NEVER-BE-SERIALIZED-anywhere-1234567890"


def test_secret_never_appears_in_get_put_or_health_response_bodies() -> None:
    client = TestClient(_app())
    put_response = client.put(
        "/api/settings/architectural-explanation",
        json={"enabled": True, "provider": "openrouter", "model": "m", "api_key": SECRET},
    )
    get_response = client.get("/api/settings/architectural-explanation")
    health_response = client.get("/api/health")

    for response in (put_response, get_response, health_response):
        assert SECRET not in response.text


def test_secret_never_appears_in_test_connection_response(monkeypatch: pytest.MonkeyPatch) -> None:
    server, port = _start_fake_server(
        status_code=200,
        content=json.dumps(
            {"model": "any-model", "choices": [{"message": {"content": '{"ok": true}'}}]}
        ),
    )
    try:
        client = TestClient(_app())
        response = client.post(
            "/api/settings/architectural-explanation/test-connection",
            json={
                "provider": "openrouter",
                "base_url": f"http://127.0.0.1:{port}",
                "model": "any-model",
                "api_key": SECRET,
            },
        )
        assert SECRET not in response.text
        assert response.json()["status"] == "success"
    finally:
        server.shutdown()


# ---------------------------------------------------------------------------
# Environment-variable fallback continues to work.
# ---------------------------------------------------------------------------


def test_env_var_configuration_still_works_when_nothing_saved() -> None:
    app = create_app(
        Settings(
            environment="test",
            database_path=":memory:",
            arch_explanation_llm_enabled=True,
            arch_explanation_llm_provider="openrouter",
            arch_explanation_llm_model="env-model",
            arch_explanation_llm_api_key_present=True,
        )
    )
    client = TestClient(app)
    body = client.get("/api/settings/architectural-explanation").json()
    assert body["enabled"] is True
    assert body["configured"] is True
    assert body["model"] == "env-model"
    assert body["config_source"] == "environment"
    assert body["credential_source"] == "environment"


def test_saved_settings_override_env_var_configuration() -> None:
    app = create_app(
        Settings(
            environment="test",
            database_path=":memory:",
            arch_explanation_llm_enabled=True,
            arch_explanation_llm_provider="openrouter",
            arch_explanation_llm_model="env-model",
            arch_explanation_llm_api_key_present=True,
        )
    )
    client = TestClient(app)
    client.put(
        "/api/settings/architectural-explanation",
        json={"enabled": True, "provider": "blackbox", "model": "ui-model", "api_key": "ui-key"},
    )
    body = client.get("/api/settings/architectural-explanation").json()
    assert body["provider"] == "blackbox"
    assert body["model"] == "ui-model"
    assert body["config_source"] == "runtime"


# ---------------------------------------------------------------------------
# LLM failure must never disable analysis/architecture exploration --
# proven here at the API-selection level; end-to-end UI proof is in the
# Chromium acceptance evidence (Phase 7/9/10).
# ---------------------------------------------------------------------------


def test_analysis_endpoint_unaffected_by_arch_explanation_settings(tmp_path) -> None:
    client = TestClient(_app())
    client.put(
        "/api/settings/architectural-explanation",
        json={"enabled": True, "provider": "openrouter", "model": "m", "api_key": "k"},
    )
    (tmp_path / "app.py").write_text("def f():\n    return 1\n", encoding="utf-8")
    response = client.post("/api/analyze", json={"repository_path": str(tmp_path)})
    assert response.status_code == 200
    assert response.json()["status"] in ("queued", "running", "complete")


# ---------------------------------------------------------------------------
# Test-connection status categorization (local fake server only).
# ---------------------------------------------------------------------------


def _start_fake_server(*, status_code: int, content: str, header_401: bool = False):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802 - stdlib signature
            length = int(self.headers.get("Content-Length", "0"))
            self.rfile.read(length)
            code = 401 if header_401 else status_code
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            body = content.encode("utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args) -> None:  # noqa: A002 - silence stdlib default logging
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


def test_connection_success_via_fake_server() -> None:
    server, port = _start_fake_server(
        status_code=200,
        content=json.dumps(
            {
                "model": "fake-model",
                "choices": [{"message": {"content": '{"ok": true}'}}],
            }
        ),
    )
    try:
        client = TestClient(_app())
        response = client.post(
            "/api/settings/architectural-explanation/test-connection",
            json={
                "provider": "openrouter",
                "base_url": f"http://127.0.0.1:{port}",
                "model": "fake-model",
                "api_key": "any-key",
            },
        )
        body = response.json()
        assert body["status"] == "success"
        assert body["latency_ms"] is not None
        assert body["model_used"] == "fake-model"
    finally:
        server.shutdown()


def test_connection_invalid_credentials_via_fake_server() -> None:
    server, port = _start_fake_server(status_code=401, content='{"error": "unauthorized"}', header_401=True)
    try:
        client = TestClient(_app())
        response = client.post(
            "/api/settings/architectural-explanation/test-connection",
            json={
                "provider": "openrouter",
                "base_url": f"http://127.0.0.1:{port}",
                "model": "fake-model",
                "api_key": "bad-key",
            },
        )
        assert response.json()["status"] == "invalid_credentials"
    finally:
        server.shutdown()


def test_connection_malformed_response_via_fake_server() -> None:
    server, port = _start_fake_server(status_code=200, content="not json at all")
    try:
        client = TestClient(_app())
        response = client.post(
            "/api/settings/architectural-explanation/test-connection",
            json={
                "provider": "openrouter",
                "base_url": f"http://127.0.0.1:{port}",
                "model": "fake-model",
                "api_key": "any-key",
            },
        )
        assert response.json()["status"] == "malformed_response"
    finally:
        server.shutdown()


def test_connection_provider_unreachable_when_nothing_listens() -> None:
    client = TestClient(_app())
    response = client.post(
        "/api/settings/architectural-explanation/test-connection",
        json={
            "provider": "openrouter",
            "base_url": "http://127.0.0.1:1",
            "model": "fake-model",
            "api_key": "any-key",
        },
    )
    assert response.json()["status"] in ("provider_unreachable", "timeout")


def test_connection_missing_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_API_KEY", raising=False)
    client = TestClient(_app())
    response = client.post(
        "/api/settings/architectural-explanation/test-connection",
        json={"provider": "openrouter", "base_url": "http://127.0.0.1:1", "model": "m"},
    )
    assert response.json()["status"] == "invalid_credentials"


def test_connection_missing_model() -> None:
    client = TestClient(_app())
    response = client.post(
        "/api/settings/architectural-explanation/test-connection",
        json={"provider": "openrouter", "base_url": "http://127.0.0.1:1", "model": "", "api_key": "k"},
    )
    assert response.json()["status"] == "invalid_model"
