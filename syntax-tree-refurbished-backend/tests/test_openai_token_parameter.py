"""Real end-user acceptance blocker fix: OpenAI's Chat Completions
endpoint rejected the legacy `max_tokens` parameter for `gpt-5.4-mini`
(HTTP 400: "Unsupported parameter: 'max_tokens' is not supported with
this model. Use 'max_completion_tokens' instead."). See
app.investigation.providers for the capability boundary this fix
introduces, and its module docstring for the full root-cause writeup.

Every test here inspects the REAL outgoing JSON body via a local fake
HTTP server (never a real external call), for both the live-generation
code path (OpenAICompatibleInvestigationModel.complete_json) and the
Settings-UI "Test connection" path (connection_test.test_connection) --
proving they use identical request semantics, per requirement #4.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from syntax_tree_refurbished.app.architectural_explanation.connection_test import (
    test_connection as run_connection_test,
)
from syntax_tree_refurbished.app.investigation.llm_model import OpenAICompatibleInvestigationModel
from syntax_tree_refurbished.app.investigation.providers import (
    is_openai_endpoint,
    supports_reasoning_effort,
    uses_modern_token_parameter,
)
from syntax_tree_refurbished.config import Settings


def _capturing_server(*, status_code: int = 200, response_body: dict | None = None):
    """Local fake OpenAI-compatible server that records every request
    body it receives (never a real external call)."""
    captured: list[dict] = []
    response_body = response_body or {
        "model": "fake-model",
        "choices": [{"message": {"content": '{"ok": true}'}}],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1},
    }

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802 - stdlib signature
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            captured.append(json.loads(raw.decode("utf-8")))
            body = json.dumps(response_body).encode("utf-8")
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args) -> None:  # noqa: A002
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port, captured


# ---------------------------------------------------------------------------
# app.investigation.providers -- the capability boundary itself
# ---------------------------------------------------------------------------


def test_is_openai_endpoint_by_provider_label() -> None:
    assert is_openai_endpoint("openai", "https://anything.example") is True


def test_is_openai_endpoint_by_base_url_fallback() -> None:
    """A user who selected 'openrouter' as the required provider label
    but manually pointed Base URL at OpenAI's real endpoint (a
    configuration this codebase already supported before the 'openai'
    provider value existed) must still be detected as OpenAI."""
    assert is_openai_endpoint("openrouter", "https://api.openai.com/v1") is True


def test_is_not_openai_endpoint_for_openrouter_default() -> None:
    assert is_openai_endpoint("openrouter", "https://openrouter.ai/api/v1") is False


def test_is_not_openai_endpoint_for_blackbox() -> None:
    assert is_openai_endpoint("blackbox", "https://api.blackbox.ai") is False


def test_uses_modern_token_parameter_matches_is_openai_endpoint() -> None:
    assert uses_modern_token_parameter("openai", "https://api.openai.com/v1") is True
    assert uses_modern_token_parameter("openrouter", "https://openrouter.ai/api/v1") is False


def test_reasoning_effort_supported_for_gpt5_family_on_openai() -> None:
    assert supports_reasoning_effort("openai", "https://api.openai.com/v1", "gpt-5.4-mini") is True
    assert supports_reasoning_effort("openai", "https://api.openai.com/v1", "GPT-5.4-Mini") is True
    assert supports_reasoning_effort("openai", "https://api.openai.com/v1", "o3-mini") is True


def test_reasoning_effort_not_supported_for_known_non_reasoning_openai_chat_variant() -> None:
    """gpt-5-chat-latest is a real, documented case of an OpenAI model
    that rejects an explicit reasoning_effort despite otherwise matching
    the 'gpt-5' prefix -- must not be treated as reasoning-capable."""
    assert supports_reasoning_effort("openai", "https://api.openai.com/v1", "gpt-5-chat-latest") is False


def test_reasoning_effort_not_supported_for_non_reasoning_model_families() -> None:
    assert supports_reasoning_effort("openai", "https://api.openai.com/v1", "gpt-4o") is False
    assert supports_reasoning_effort("openai", "https://api.openai.com/v1", "gpt-3.5-turbo") is False


def test_reasoning_effort_never_supported_off_openai() -> None:
    assert supports_reasoning_effort("openrouter", "https://openrouter.ai/api/v1", "gpt-5.4-mini") is False
    assert supports_reasoning_effort("blackbox", "https://api.blackbox.ai", "gpt-5.4-mini") is False


# ---------------------------------------------------------------------------
# Requirement 1: direct OpenAI + gpt-5.4-mini sends max_completion_tokens,
# never max_tokens, and includes reasoning_effort: none.
# ---------------------------------------------------------------------------


def test_openai_model_sends_max_completion_tokens_not_max_tokens() -> None:
    server, port, captured = _capturing_server()
    try:
        settings = Settings()
        model = OpenAICompatibleInvestigationModel(
            settings,
            provider_override="openai",
            model_override="gpt-5.4-mini",
            api_key_override="sk-test-key-never-logged",
            base_url_override=f"http://127.0.0.1:{port}",
        )
        model.complete_json(system="be helpful", messages=[{"role": "user", "content": "hi"}], max_tokens=512)

        assert len(captured) == 1
        body = captured[0]
        assert "max_completion_tokens" in body
        assert body["max_completion_tokens"] == 512
        assert "max_tokens" not in body
        assert body["reasoning_effort"] == "none"
        assert body["model"] == "gpt-5.4-mini"
    finally:
        server.shutdown()


def test_openai_via_base_url_fallback_also_sends_max_completion_tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    """Same behavior when reached via the base-URL-detection fallback
    (provider label left as 'openrouter', base URL pointed at OpenAI's
    real host) -- exercised as a full real request through the actual
    code path, not just the unit predicate. Since a local test server
    cannot itself be reachable at the literal hostname "api.openai.com",
    the module's recognized-host constant is pointed at the local
    server's own loopback address for the duration of this test only."""
    import syntax_tree_refurbished.app.investigation.providers as providers_module

    server, port, captured = _capturing_server()
    try:
        monkeypatch.setattr(providers_module, "_OPENAI_HOST", "127.0.0.1")
        settings = Settings()
        model = OpenAICompatibleInvestigationModel(
            settings,
            provider_override="openrouter",  # provider label deliberately NOT "openai"
            model_override="gpt-5.4-mini",
            api_key_override="any-key",
            base_url_override=f"http://127.0.0.1:{port}",
        )
        model.complete_json(system="s", messages=[{"role": "user", "content": "hi"}], max_tokens=64)

        assert len(captured) == 1
        assert "max_completion_tokens" in captured[0]
        assert "max_tokens" not in captured[0]
    finally:
        server.shutdown()


# ---------------------------------------------------------------------------
# Requirement 2: generic/OpenRouter-compatible behavior remains
# backward-compatible with max_tokens.
# ---------------------------------------------------------------------------


def test_openrouter_still_sends_max_tokens_not_max_completion_tokens() -> None:
    server, port, captured = _capturing_server()
    try:
        settings = Settings()
        model = OpenAICompatibleInvestigationModel(
            settings,
            provider_override="openrouter",
            model_override="some/model",
            api_key_override="sk-test-key-never-logged",
            base_url_override=f"http://127.0.0.1:{port}",
        )
        model.complete_json(system="be helpful", messages=[{"role": "user", "content": "hi"}], max_tokens=256)

        assert len(captured) == 1
        body = captured[0]
        assert body["max_tokens"] == 256
        assert "max_completion_tokens" not in body
        assert "reasoning_effort" not in body
    finally:
        server.shutdown()


def test_blackbox_still_sends_max_tokens() -> None:
    server, port, captured = _capturing_server()
    try:
        settings = Settings()
        model = OpenAICompatibleInvestigationModel(
            settings,
            provider_override="blackbox",
            model_override="some/model",
            api_key_override="sk-test-key-never-logged",
            base_url_override=f"http://127.0.0.1:{port}",
        )
        model.complete_json(system="be helpful", messages=[{"role": "user", "content": "hi"}], max_tokens=128)

        assert len(captured) == 1
        assert captured[0]["max_tokens"] == 128
        assert "max_completion_tokens" not in captured[0]
    finally:
        server.shutdown()


# ---------------------------------------------------------------------------
# Requirement 3: API key never logged or surfaced.
# ---------------------------------------------------------------------------


SECRET = "sk-THIS-MUST-NEVER-APPEAR-ANYWHERE-1234567890"


def test_api_key_never_appears_in_captured_request_body_keys_or_error_text() -> None:
    """The key belongs only in the Authorization header (which the fake
    server intentionally does not echo back into the JSON body) -- prove
    it never leaks into the body itself or into a raised error message."""
    server, port, captured = _capturing_server(status_code=400, response_body={"error": "bad request"})
    try:
        settings = Settings()
        model = OpenAICompatibleInvestigationModel(
            settings,
            provider_override="openai",
            model_override="gpt-5.4-mini",
            api_key_override=SECRET,
            base_url_override=f"http://127.0.0.1:{port}",
        )
        with pytest.raises(RuntimeError) as excinfo:
            model.complete_json(system="be helpful", messages=[{"role": "user", "content": "hi"}], max_tokens=64)
        assert SECRET not in str(excinfo.value)
        assert SECRET not in json.dumps(captured[0])
    finally:
        server.shutdown()


def test_connection_test_never_surfaces_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    server, port, captured = _capturing_server()
    try:
        result = run_connection_test(
            provider="openai",
            base_url=f"http://127.0.0.1:{port}",
            model="gpt-5.4-mini",
            api_key=SECRET,
        )
        assert SECRET not in result.message
        assert SECRET not in json.dumps(captured[0])
    finally:
        server.shutdown()


# ---------------------------------------------------------------------------
# Requirement 4: Test Connection uses the same corrected request
# semantics as real architectural-explanation generation.
# ---------------------------------------------------------------------------


def test_connection_test_sends_max_completion_tokens_for_openai() -> None:
    server, port, captured = _capturing_server()
    try:
        result = run_connection_test(
            provider="openai",
            base_url=f"http://127.0.0.1:{port}",
            model="gpt-5.4-mini",
            api_key="any-key",
        )
        assert result.status == "success"
        body = captured[0]
        assert "max_completion_tokens" in body
        assert "max_tokens" not in body
        assert body["reasoning_effort"] == "none"
    finally:
        server.shutdown()


def test_connection_test_sends_max_tokens_for_openrouter() -> None:
    server, port, captured = _capturing_server()
    try:
        result = run_connection_test(
            provider="openrouter",
            base_url=f"http://127.0.0.1:{port}",
            model="some/model",
            api_key="any-key",
        )
        assert result.status == "success"
        body = captured[0]
        assert "max_tokens" in body
        assert "max_completion_tokens" not in body
        assert "reasoning_effort" not in body
    finally:
        server.shutdown()


def test_connection_test_and_generation_produce_identical_token_parameter_shape() -> None:
    """Same provider/base_url/model combination through both code paths
    must choose the same token-parameter key -- proving requirement 4
    directly rather than by coincidence of separately-passing tests."""
    server, port, captured = _capturing_server()
    try:
        settings = Settings()
        model = OpenAICompatibleInvestigationModel(
            settings,
            provider_override="openai",
            model_override="gpt-5.4-mini",
            api_key_override="any-key",
            base_url_override=f"http://127.0.0.1:{port}",
        )
        model.complete_json(system="s", messages=[{"role": "user", "content": "hi"}], max_tokens=32)
        generation_body = captured.pop()

        run_connection_test(
            provider="openai",
            base_url=f"http://127.0.0.1:{port}",
            model="gpt-5.4-mini",
            api_key="any-key",
        )
        test_connection_body = captured.pop()

        assert set(generation_body) & {"max_tokens", "max_completion_tokens"} == set(
            test_connection_body
        ) & {"max_tokens", "max_completion_tokens"}
        assert generation_body.get("reasoning_effort") == test_connection_body.get("reasoning_effort")
    finally:
        server.shutdown()


# ---------------------------------------------------------------------------
# Requirement 6: malformed/400 provider errors remain safely surfaced.
# ---------------------------------------------------------------------------


def test_connection_test_surfaces_400_without_crashing() -> None:
    server, port, _captured = _capturing_server(
        status_code=400,
        response_body={
            "error": {
                "message": "Unsupported parameter: 'max_tokens' is not supported with this model.",
                "type": "invalid_request_error",
            }
        },
    )
    try:
        result = run_connection_test(
            provider="openai",
            base_url=f"http://127.0.0.1:{port}",
            model="gpt-5.4-mini",
            api_key="any-key",
        )
        assert result.status == "error"
        assert "400" in result.message
    finally:
        server.shutdown()


def test_generation_surfaces_400_as_runtime_error_without_crashing() -> None:
    server, port, _captured = _capturing_server(status_code=400, response_body={"error": "bad request"})
    try:
        settings = Settings()
        model = OpenAICompatibleInvestigationModel(
            settings,
            provider_override="openai",
            model_override="gpt-5.4-mini",
            api_key_override="any-key",
            base_url_override=f"http://127.0.0.1:{port}",
        )
        with pytest.raises(RuntimeError, match="LLM HTTP error 400"):
            model.complete_json(system="s", messages=[{"role": "user", "content": "hi"}], max_tokens=32)
    finally:
        server.shutdown()


def test_connection_test_surfaces_malformed_response_without_crashing() -> None:
    server, port, _captured = _capturing_server(status_code=200, response_body={"not": "a chat completion"})
    try:
        result = run_connection_test(
            provider="openai",
            base_url=f"http://127.0.0.1:{port}",
            model="gpt-5.4-mini",
            api_key="any-key",
        )
        assert result.status == "malformed_response"
    finally:
        server.shutdown()


# ---------------------------------------------------------------------------
# Provider allow-list / Settings.arch_explanation_llm_configured
# ---------------------------------------------------------------------------


def test_openai_is_a_configured_provider_value() -> None:
    settings = Settings(
        arch_explanation_llm_enabled=True,
        arch_explanation_llm_provider="openai",
        arch_explanation_llm_api_key_present=True,
    )
    assert settings.arch_explanation_llm_configured is True
