"""Usability dry-run readiness fix: a real ssl.SSLError ("bad record mac",
a corrupted/dropped TLS record mid-response -- a transient network
condition, not a code defect) was observed live during a readiness
walkthrough as a raw, unhandled HTTP 500 instead of the friendly
"Architectural explanation unavailable" + Retry/Open Settings UX every
other network-failure class already gets. Root cause: OpenAICompatible
InvestigationModel.complete_json only wrapped urllib.error.HTTPError and
URLError into RuntimeError (which api/routes/architectural_explanation.py's
_verify_claims_or_503 catches and turns into a friendly 503); a bare
ssl.SSLError is not a URLError subclass and was not wrapped, so it
escaped as an unhandled 500. Fixed by also catching OSError (ssl.SSLError's
base class) and wrapping it identically.
"""

from __future__ import annotations

import ssl

import pytest

from syntax_tree_refurbished.app.investigation.llm_model import OpenAICompatibleInvestigationModel
from syntax_tree_refurbished.config import Settings


def test_ssl_error_during_response_read_is_wrapped_as_runtime_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def _raise_ssl_error(*_args, **_kwargs):
        raise ssl.SSLError("[SSL: SSLV3_ALERT_BAD_RECORD_MAC] sslv3 alert bad record mac")

    import syntax_tree_refurbished.app.investigation.llm_model as llm_model_module

    monkeypatch.setattr(llm_model_module.urlrequest, "urlopen", _raise_ssl_error)

    settings = Settings()
    model = OpenAICompatibleInvestigationModel(
        settings,
        provider_override="openai",
        model_override="gpt-5.4-mini",
        api_key_override="sk-test-key-never-logged",
        base_url_override="https://api.openai.com/v1",
    )

    with pytest.raises(RuntimeError, match="LLM network error"):
        model.complete_json(system="be helpful", messages=[{"role": "user", "content": "hi"}], max_tokens=64)


def test_generic_os_error_during_request_is_also_wrapped_as_runtime_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def _raise_os_error(*_args, **_kwargs):
        raise ConnectionResetError("connection reset by peer")

    import syntax_tree_refurbished.app.investigation.llm_model as llm_model_module

    monkeypatch.setattr(llm_model_module.urlrequest, "urlopen", _raise_os_error)

    settings = Settings()
    model = OpenAICompatibleInvestigationModel(
        settings,
        provider_override="openai",
        model_override="gpt-5.4-mini",
        api_key_override="any-key",
        base_url_override="https://api.openai.com/v1",
    )

    with pytest.raises(RuntimeError, match="LLM network error"):
        model.complete_json(system="s", messages=[{"role": "user", "content": "hi"}], max_tokens=32)
