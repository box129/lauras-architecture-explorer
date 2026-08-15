""""Test connection" for the architectural-explanation Settings UI.

Performs one small, real HTTP request to the candidate provider using
the exact OpenAI-compatible ``/chat/completions`` shape
``OpenAICompatibleInvestigationModel`` (``app.investigation.llm_model``)
uses for real proposal calls -- so a successful test genuinely predicts
that live claim proposals will work, not just that *some* endpoint
responded.

Deliberately a standalone function rather than routing through
``OpenAICompatibleInvestigationModel.complete_json``: that method wraps
every failure into one generic ``RuntimeError``, which is enough for the
real proposal path (callers there only need "it failed"), but the
Settings UI needs the finer distinctions the task brief calls for
(invalid credentials vs. unreachable vs. timeout vs. invalid model vs.
malformed response) -- distinctions the outer text of a wrapped
``RuntimeError`` cannot document as anything more than "unstructured
error message" without re-parsing it.
"""

from __future__ import annotations

import json
import socket
import time
from dataclasses import dataclass
from typing import Literal
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from syntax_tree_refurbished.app.investigation.llm_model import _ssl_context
from syntax_tree_refurbished.app.investigation.providers import (
    SUPPORTED_PROVIDERS,
    supports_reasoning_effort,
    uses_modern_token_parameter,
)

ConnectionTestStatus = Literal[
    "success",
    "invalid_credentials",
    "provider_unreachable",
    "timeout",
    "invalid_model",
    "malformed_response",
    "not_configured",
    "error",
]


@dataclass(frozen=True)
class ConnectionTestResult:
    status: ConnectionTestStatus
    message: str
    latency_ms: int | None = None
    model_used: str | None = None


def test_connection(
    *,
    provider: str,
    model: str,
    base_url: str,
    api_key: str | None,
    timeout_seconds: int = 20,
) -> ConnectionTestResult:
    """Never raises -- every failure mode is reported as a
    ``ConnectionTestResult``, since this exists specifically to be shown
    to an end user in the Settings screen, not to propagate an exception
    up through FastAPI's default 500 handler."""
    provider = (provider or "").strip().lower()
    if provider not in SUPPORTED_PROVIDERS:
        return ConnectionTestResult(
            status="not_configured",
            message=f"'{provider or '(empty)'}' is not a supported provider. Choose openai, blackbox, or openrouter.",
        )
    if not api_key:
        return ConnectionTestResult(
            status="invalid_credentials",
            message="No API key is configured. Enter an API key and try again.",
        )
    if not model or not model.strip():
        return ConnectionTestResult(
            status="invalid_model",
            message="No model is configured. Enter a model id and try again.",
        )
    resolved_base_url = (base_url or "").rstrip("/") or _default_base_url(provider)

    body: dict[str, object] = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Reply with a single JSON object: {\"ok\": true}"},
            {"role": "user", "content": "ping"},
        ],
        "temperature": 0,
    }
    # Identical token-parameter/reasoning-effort semantics to the real
    # explanation-generation path (OpenAICompatibleInvestigationModel
    # .complete_json) -- see app.investigation.providers. Otherwise a
    # successful Test Connection could not be trusted to predict that a
    # real claim-proposal request will also succeed.
    if uses_modern_token_parameter(provider, resolved_base_url):
        body["max_completion_tokens"] = 16
        if supports_reasoning_effort(provider, resolved_base_url, model):
            body["reasoning_effort"] = "none"
    else:
        body["max_tokens"] = 16
    payload = json.dumps(body).encode("utf-8")
    req = urlrequest.Request(
        f"{resolved_base_url}/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Title": "Syntax Tree Refurbished (connection test)",
        },
        method="POST",
    )

    started = time.monotonic()
    try:
        with urlrequest.urlopen(req, timeout=timeout_seconds, context=_ssl_context()) as response:
            raw = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        if exc.code in (401, 403):
            return ConnectionTestResult(
                status="invalid_credentials",
                message=f"The provider rejected the credentials (HTTP {exc.code}).",
            )
        if exc.code == 404:
            return ConnectionTestResult(
                status="invalid_model",
                message=f"The provider could not find model '{model}' (HTTP 404).",
            )
        if exc.code == 429:
            return ConnectionTestResult(
                status="error",
                message="The provider rate-limited this request (HTTP 429). Try again shortly.",
            )
        return ConnectionTestResult(
            status="error",
            message=f"The provider returned HTTP {exc.code}: {detail}",
        )
    except (socket.timeout, TimeoutError):
        return ConnectionTestResult(
            status="timeout",
            message=f"No response from the provider within {timeout_seconds}s.",
        )
    except URLError as exc:
        if isinstance(exc.reason, (socket.timeout, TimeoutError)):
            return ConnectionTestResult(
                status="timeout",
                message=f"No response from the provider within {timeout_seconds}s.",
            )
        return ConnectionTestResult(
            status="provider_unreachable",
            message=f"Could not reach the provider at {resolved_base_url}: {exc.reason}",
        )
    latency_ms = int((time.monotonic() - started) * 1000)

    try:
        decoded = json.loads(raw)
        _content = decoded["choices"][0]["message"]["content"]
        if not isinstance(_content, str):
            raise TypeError("content was not a string")
    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
        return ConnectionTestResult(
            status="malformed_response",
            message="The provider responded, but not in the expected chat-completion format.",
            latency_ms=latency_ms,
        )

    return ConnectionTestResult(
        status="success",
        message="Connected successfully.",
        latency_ms=latency_ms,
        model_used=str(decoded.get("model") or model),
    )


def _default_base_url(provider: str) -> str:
    from syntax_tree_refurbished.app.investigation.llm_model import default_base_url

    return default_base_url(provider)
