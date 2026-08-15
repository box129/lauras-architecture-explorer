"""Shared provider-identity and Chat Completions capability boundary for
the OpenAI-compatible LLM abstraction.

Used by three places that each need the exact same answer to "is this
genuinely OpenAI's own API, and if so what does that imply about the
request shape":

- ``config.Settings.arch_explanation_llm_configured`` (provider
  allow-list);
- ``app.investigation.llm_model.OpenAICompatibleInvestigationModel``
  (the real HTTP request body builder);
- ``app.architectural_explanation.connection_test`` (the Settings-UI
  "Test connection" request builder, which must use identical request
  semantics to the real explanation-generation path -- see that
  module's own docstring for why it doesn't just call
  ``OpenAICompatibleInvestigationModel`` directly).

Deliberately a tiny, dependency-free module (only ``urllib.parse``) so
``config.py`` -- imported very early, before ``app.investigation``
exists as a usable package -- can share this without a circular import
(``llm_model.py`` itself imports ``config.Settings``).

Root cause this module exists to fix: a real end-user hit HTTP 400 from
OpenAI's actual API -- "Unsupported parameter: 'max_tokens' is not
supported with this model. Use 'max_completion_tokens' instead." --
when pointing Laura's Settings at ``https://api.openai.com/v1`` with
``gpt-5.4-mini``. OpenAI's Chat Completions endpoint deprecated
``max_tokens`` in favor of ``max_completion_tokens`` for its current
reasoning-capable model families; OpenRouter/Blackbox and other
OpenAI-compatible proxies still expect ``max_tokens``. This module
centralizes that one distinction instead of scattering model-name
conditionals through the request-building code.
"""

from __future__ import annotations

from urllib.parse import urlparse

#: Every provider value the Settings UI / env-var configuration may
#: select. Adding "openai" here (this round) is what lets the Settings
#: dropdown offer an honest "OpenAI" option instead of requiring a user
#: to pick "OpenRouter" and manually override the base URL to reach
#: OpenAI's real endpoint (that override-based path still works
#: unchanged -- see ``is_openai_endpoint``'s host-based fallback -- this
#: only adds a clearer, explicit way to select it).
SUPPORTED_PROVIDERS = frozenset({"blackbox", "openrouter", "openai"})

_OPENAI_HOST = "api.openai.com"

#: Known OpenAI reasoning-capable model name prefixes that accept the
#: ``reasoning_effort`` Chat Completions parameter, per OpenAI's current
#: reasoning-models guide (gpt-5.x and o-series families).
_REASONING_MODEL_PREFIXES = ("gpt-5", "o1", "o3", "o4")

#: Known OpenAI model-name markers for chat variants that do NOT support
#: reasoning_effort despite otherwise matching a reasoning-family prefix
#: -- e.g. "gpt-5-chat-latest" is a non-reasoning chat variant that
#: OpenAI's own API rejects an explicit reasoning_effort for. Excluded
#: explicitly rather than guessed at, so this stays a verified allow-list
#: rather than an optimistic blanket "any OpenAI model" assumption.
_NON_REASONING_MODEL_MARKERS = ("chat-latest",)


def is_openai_endpoint(provider: str, base_url: str) -> bool:
    """True when the target is genuinely OpenAI's own API -- either by
    explicit ``provider="openai"`` selection, or, as a backward-
    compatible fallback, by the resolved base URL's host (a user who
    selected "OpenRouter" as the required provider label but manually
    pointed Base URL at ``api.openai.com`` -- a configuration this
    codebase already supported before the "openai" provider value
    existed -- must keep working identically)."""
    if provider.strip().lower() == "openai":
        return True
    try:
        host = urlparse(base_url).hostname or ""
    except ValueError:
        host = ""
    return host == _OPENAI_HOST


def uses_modern_token_parameter(provider: str, base_url: str) -> bool:
    """True when the outgoing Chat Completions request must use
    ``max_completion_tokens`` instead of the deprecated ``max_tokens``
    -- currently exactly the "is this OpenAI" question, since every
    other supported provider (OpenRouter, Blackbox, and any other
    OpenAI-compatible proxy reached via a custom base URL) still expects
    ``max_tokens``."""
    return is_openai_endpoint(provider, base_url)


def supports_reasoning_effort(provider: str, base_url: str, model: str) -> bool:
    """True when it is safe to send OpenAI's ``reasoning_effort``
    parameter for this (provider, base_url, model) combination.

    Deliberately conservative: sending ``reasoning_effort`` to an OpenAI
    model that does not support it is itself an HTTP 400 (confirmed
    against a real, non-reasoning OpenAI chat variant -- see this
    module's docstring), so this is a small, explicit allow-list of
    known reasoning-capable model-name families rather than "any OpenAI
    model". Never raises; an unrecognized model name simply omits the
    parameter, which is always the backward-compatible choice.
    """
    if not is_openai_endpoint(provider, base_url):
        return False
    normalized = model.strip().lower()
    if any(marker in normalized for marker in _NON_REASONING_MODEL_MARKERS):
        return False
    return normalized.startswith(_REASONING_MODEL_PREFIXES)
