"""TLS certificate verification for normal product runtime.

Investigation finding (this round): there is no code defect. The single
source of truth is ``app.investigation.llm_model._ssl_context``, which
defaults to Python's normal (verifying) SSL context and only returns an
unverified one when the ``SYNTAX_TREE_LLM_SSL_VERIFY`` environment
variable is EXPLICITLY set to a falsy value (``0``/``false``/``no``/
``off``). ``.env.example`` (and this checkout's own ``.env``) both ship
that variable set to ``1`` (verification enabled). Both real-request
code paths -- ``OpenAICompatibleInvestigationModel.complete_json`` (live
claim-proposal generation) and
``app.architectural_explanation.connection_test.test_connection``
(Settings "Test connection") -- call the exact same ``_ssl_context``
function; there is no second, overlapping TLS mechanism to keep in sync.

These tests did not previously exist -- this was a real test-coverage
gap (a silent regression here would have gone undetected), not just a
literal reproduction of the reported warning.
"""

from __future__ import annotations

import json
import ssl
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from syntax_tree_refurbished.app.architectural_explanation.connection_test import (
    test_connection as run_connection_test,
)
from syntax_tree_refurbished.app.investigation.llm_model import (
    OpenAICompatibleInvestigationModel,
    _ssl_context,
)
from syntax_tree_refurbished.config import Settings


# ---------------------------------------------------------------------------
# Requirement 4 (and the core of 1-3): the opt-out is NOT the default.
# ---------------------------------------------------------------------------


def test_default_ssl_context_is_verifying_when_env_var_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SYNTAX_TREE_LLM_SSL_VERIFY", raising=False)
    assert _ssl_context() is None  # None => urllib uses its normal, verifying default context


@pytest.mark.parametrize("value", ["1", "true", "TRUE", "yes", "on", "", "garbage"])
def test_ssl_context_stays_verifying_for_any_non_falsy_or_unrecognized_value(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    """Only the exact documented falsy tokens disable verification --
    anything else (including an unrecognized/malformed value) fails
    SAFE, not open."""
    monkeypatch.setenv("SYNTAX_TREE_LLM_SSL_VERIFY", value)
    assert _ssl_context() is None


@pytest.mark.parametrize("value", ["0", "false", "False", "FALSE", "no", "off"])
def test_ssl_context_disables_verification_only_when_explicitly_set_falsy(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    """The diagnostic opt-out itself must still work for genuine local
    diagnostics (e.g. a corporate TLS-intercepting proxy) -- it must
    just never be the default."""
    monkeypatch.setenv("SYNTAX_TREE_LLM_SSL_VERIFY", value)
    context = _ssl_context()
    assert context is not None
    assert context.verify_mode == ssl.CERT_NONE
    assert context.check_hostname is False


def test_env_example_ships_verification_enabled() -> None:
    """The checked-in template new setups copy .env from must never ship
    with verification disabled."""
    import pathlib

    repo_root = pathlib.Path(__file__).resolve().parents[2]
    env_example = repo_root / ".env.example"
    lines = env_example.read_text(encoding="utf-8").splitlines()
    matching = [line for line in lines if line.strip().startswith("SYNTAX_TREE_LLM_SSL_VERIFY=")]
    assert matching == ["SYNTAX_TREE_LLM_SSL_VERIFY=1"]


# ---------------------------------------------------------------------------
# Requirements 1-3: both real-request code paths honor the same context.
# ---------------------------------------------------------------------------


def _capturing_https_free_server():
    """Plain HTTP fake server -- proves the SSL context plumbing doesn't
    interfere with the local, non-TLS fake-provider acceptance path
    (requirement 5)."""
    captured: list[dict] = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            length = int(self.headers.get("Content-Length", "0"))
            captured.append(json.loads(self.rfile.read(length).decode("utf-8")))
            body = json.dumps(
                {"model": "fake", "choices": [{"message": {"content": "{}"}}], "usage": {}}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args) -> None:  # noqa: A002
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, port, captured


def test_generation_path_constructs_model_with_verifying_context_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("SYNTAX_TREE_LLM_SSL_VERIFY", raising=False)
    settings = Settings()
    model = OpenAICompatibleInvestigationModel(
        settings,
        provider_override="openai",
        model_override="gpt-5.4-mini",
        api_key_override="sk-test-key-never-logged",
        base_url_override="https://127.0.0.1:0",  # never actually connected to in this test
    )
    assert model._ssl_context is None  # noqa: SLF001 - verifying this exact internal invariant is the point


def test_generation_path_still_works_over_plain_http_regardless_of_ssl_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Requirement 5: the local plain-HTTP fake-provider stand-in must
    keep working -- the SSL context is irrelevant for a non-HTTPS URL,
    proven with a real request, not just an assertion about the flag."""
    monkeypatch.delenv("SYNTAX_TREE_LLM_SSL_VERIFY", raising=False)
    server, port, captured = _capturing_https_free_server()
    try:
        settings = Settings()
        model = OpenAICompatibleInvestigationModel(
            settings,
            provider_override="openrouter",
            model_override="fake-model",
            api_key_override="any-key",
            base_url_override=f"http://127.0.0.1:{port}",
        )
        model.complete_json(system="s", messages=[{"role": "user", "content": "hi"}], max_tokens=8)
        assert len(captured) == 1
    finally:
        server.shutdown()


def test_connection_test_works_over_plain_http_regardless_of_ssl_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("SYNTAX_TREE_LLM_SSL_VERIFY", raising=False)
    server, port, captured = _capturing_https_free_server()
    try:
        result = run_connection_test(
            provider="openrouter",
            base_url=f"http://127.0.0.1:{port}",
            model="fake-model",
            api_key="any-key",
        )
        assert result.status == "success"
        assert len(captured) == 1
    finally:
        server.shutdown()


def test_connection_test_and_generation_use_the_exact_same_ssl_context_function() -> None:
    """Proves there is no second, overlapping TLS mechanism -- both
    modules import and call the identical function object."""
    from syntax_tree_refurbished.app.architectural_explanation import connection_test as ct_module
    from syntax_tree_refurbished.app.investigation import llm_model as model_module

    assert ct_module._ssl_context is model_module._ssl_context  # noqa: SLF001


# ---------------------------------------------------------------------------
# Requirement 6: no credential is surfaced by any of this.
# ---------------------------------------------------------------------------


def test_ssl_context_function_signature_carries_no_credential() -> None:
    import inspect

    assert list(inspect.signature(_ssl_context).parameters) == []
