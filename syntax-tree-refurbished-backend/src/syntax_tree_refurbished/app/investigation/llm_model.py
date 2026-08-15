"""Investigation model adapters."""

from __future__ import annotations

from dataclasses import dataclass
import json
import os
import ssl
import time
from typing import Any, Protocol
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from syntax_tree_refurbished.app.investigation.providers import (
    SUPPORTED_PROVIDERS,
    supports_reasoning_effort,
    uses_modern_token_parameter,
)
from syntax_tree_refurbished.config import Settings


JSON_INSTRUCTION = "Return valid compact JSON only. Do not use Markdown fences or prose."


@dataclass(frozen=True)
class ModelReply:
    data: dict[str, Any]
    model: str
    tokens_in: int
    tokens_out: int
    latency_ms: int


class InvestigationModel(Protocol):
    @property
    def model_name(self) -> str:
        ...

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        ...


class NoConfiguredModel:
    @property
    def model_name(self) -> str:
        return ""

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        raise RuntimeError("No live LLM is configured.")


class OpenAICompatibleInvestigationModel:
    """Reused by both the legacy investigation/architecture-map feature
    (via ``make_live_model``) and architectural explanations (via
    ``make_arch_explanation_model``) -- one provider stack, two
    independent configuration boundaries. The ``*_override`` parameters
    let a caller supply its own model/api_key/base_url instead of the
    provider-derived env-var defaults (``_resolve_model``/
    ``_resolve_api_key``/``_resolve_base_url``); omitting them (the
    default, and the only thing ``make_live_model`` ever does) preserves
    the original single-configuration behavior exactly.
    """

    def __init__(
        self,
        settings: Settings,
        *,
        provider_override: str | None = None,
        model_override: str | None = None,
        api_key_override: str | None = None,
        base_url_override: str | None = None,
        timeout_seconds: int = 60,
    ):
        self._provider = (provider_override or settings.llm_provider).strip().lower()
        if self._provider not in SUPPORTED_PROVIDERS:
            raise RuntimeError("No supported live LLM provider is selected.")
        self._model = model_override or _resolve_model(settings, self._provider)
        self._api_key = api_key_override or _resolve_api_key(self._provider)
        self._base_url = (base_url_override or _resolve_base_url(self._provider)).rstrip("/")
        self._timeout_seconds = timeout_seconds
        self._ssl_context = _ssl_context()
        if not self._api_key:
            raise RuntimeError("No API key configured for investigation model.")

    @property
    def model_name(self) -> str:
        return self._model

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        started = time.monotonic()
        body: dict[str, Any] = {
            "model": self._model,
            "messages": [{"role": "system", "content": f"{system}\n\n{JSON_INSTRUCTION}"}] + messages,
            "temperature": 0,
        }
        # OpenAI's own Chat Completions endpoint rejects the legacy
        # `max_tokens` field for its current model families (HTTP 400:
        # "Unsupported parameter: 'max_tokens' is not supported with
        # this model. Use 'max_completion_tokens' instead.") -- every
        # other supported provider (OpenRouter, Blackbox, and any other
        # OpenAI-compatible proxy) still expects `max_tokens`. See
        # app.investigation.providers for the shared capability check.
        if uses_modern_token_parameter(self._provider, self._base_url):
            body["max_completion_tokens"] = max_tokens
            if supports_reasoning_effort(self._provider, self._base_url, self._model):
                # Lowest available effort for this structured, single-
                # shot claim-proposal call -- no benefit from deeper
                # reasoning here, and it only adds latency/cost.
                body["reasoning_effort"] = "none"
        else:
            body["max_tokens"] = max_tokens
        payload = json.dumps(body).encode("utf-8")
        req = urlrequest.Request(
            f"{self._base_url}/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
                "X-Title": "Syntax Tree Refurbished",
            },
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=self._timeout_seconds, context=self._ssl_context) as response:
                raw = response.read().decode("utf-8", errors="replace")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"LLM HTTP error {exc.code}: {detail[:500]}") from exc
        except URLError as exc:
            raise RuntimeError(f"LLM network error: {exc}") from exc
        except OSError as exc:
            # Lower-level socket/TLS failures (e.g. ssl.SSLError such as
            # "bad record mac" from a corrupted/dropped record mid-response)
            # are not always wrapped in URLError by urllib -- observed live
            # during a usability dry-run readiness check as a transient
            # network blip that produced a raw, unhandled 500 instead of
            # the intended "Architectural explanation unavailable" +
            # Retry/Open Settings UX every other network-failure class
            # already gets (see _verify_claims_or_503, which only catches
            # RuntimeError). Folding these in here, alongside HTTPError/
            # URLError, is the single place that distinction is made.
            raise RuntimeError(f"LLM network error: {exc}") from exc
        decoded = json.loads(raw)
        text = decoded["choices"][0]["message"].get("content") or ""
        data = _parse_json_text(text)
        usage = decoded.get("usage") or {}
        return ModelReply(
            data=data,
            model=str(decoded.get("model") or self._model),
            tokens_in=int(usage.get("prompt_tokens") or 0),
            tokens_out=int(usage.get("completion_tokens") or 0),
            latency_ms=int((time.monotonic() - started) * 1000),
        )


def make_live_model(settings: Settings) -> InvestigationModel:
    if not settings.live_llm_configured:
        return NoConfiguredModel()
    return OpenAICompatibleInvestigationModel(settings)


def make_arch_explanation_model(
    settings: Settings, *, api_key_override: str | None = None
) -> InvestigationModel:
    """Independent of ``make_live_model``/``settings.live_llm_configured``
    -- see ``Settings.arch_explanation_llm_configured``'s docstring. Reads
    the architectural-explanation-specific provider/model/base-url/api-key
    fields, never the legacy ``llm_provider``/``OPENROUTER_*``/
    ``BLACKBOX_*`` ones (unless a caller has pointed the
    ``arch_explanation_llm_*`` env vars at the exact same values, which is
    a legitimate configuration choice, not a code-level coupling). Returns
    ``NoConfiguredModel()`` -- never raises -- whenever architectural
    explanations are disabled or incompletely configured.

    ``api_key_override``: the Settings UI (product-hardening round) keeps
    a saved credential in a process-local, in-memory-only store
    (``app.architectural_explanation.runtime_config
    .ArchExplanationRuntimeConfig``) rather than an environment variable.
    Callers that have such a saved credential pass it here; omitting it
    (the default) preserves the original environment-variable-only
    lookup exactly, so this stays a purely additive change.
    """
    if not settings.arch_explanation_llm_configured:
        return NoConfiguredModel()
    provider = settings.arch_explanation_llm_provider.strip().lower()
    api_key = api_key_override or os.getenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_API_KEY")
    return OpenAICompatibleInvestigationModel(
        settings,
        provider_override=provider,
        model_override=settings.arch_explanation_llm_model or None,
        api_key_override=api_key,
        base_url_override=settings.arch_explanation_llm_base_url or None,
        timeout_seconds=settings.arch_explanation_llm_timeout_seconds,
    )


def _parse_json_text(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:].strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end <= start:
            raise
        parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("Expected JSON object from investigation model.")
    return parsed


def _resolve_model(settings: Settings, provider: str) -> str:
    if provider == "blackbox":
        return os.getenv("BLACKBOX_MODEL") or os.getenv("OPENROUTER_MODEL") or settings.openrouter_model
    if provider == "openai":
        return os.getenv("OPENAI_MODEL") or settings.openrouter_model
    return os.getenv("OPENROUTER_MODEL") or settings.openrouter_model


def _resolve_api_key(provider: str) -> str | None:
    if provider == "blackbox":
        return os.getenv("BLACKBOX_API_KEY")
    if provider == "openai":
        return os.getenv("OPENAI_API_KEY")
    return os.getenv("OPENROUTER_API_KEY_2") or os.getenv("OPENROUTER_API_KEY")


def _resolve_base_url(provider: str) -> str:
    if provider == "blackbox":
        return os.getenv("BLACKBOX_BASE_URL", "https://api.blackbox.ai")
    if provider == "openai":
        return os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    return os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")


def default_base_url(provider: str) -> str:
    """Public wrapper around ``_resolve_base_url`` for callers (the
    Settings "Test connection" endpoint) that need the same provider
    default outside of constructing a full ``OpenAICompatibleInvestigation
    Model``."""
    return _resolve_base_url(provider)


def _ssl_context() -> ssl.SSLContext | None:
    value = os.getenv("SYNTAX_TREE_LLM_SSL_VERIFY", "1").strip().lower()
    if value in {"0", "false", "no", "off"}:
        return ssl._create_unverified_context()  # noqa: SLF001 - local Windows cert workaround.
    return None
