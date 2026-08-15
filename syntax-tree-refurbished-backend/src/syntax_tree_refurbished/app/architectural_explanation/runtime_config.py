"""Process-local runtime override store for the architectural-explanation
LLM configuration boundary (``Settings.arch_explanation_llm_*``).

Product-hardening round: environment variables alone are not an
acceptable end-user configuration experience (see
``api/routes/settings.py``'s module docstring). This module is the
storage layer behind the real Settings UI: a user's saved values live
here, in process memory, for the lifetime of the backend process --
never written to disk, never logged, never returned by any getter that
reaches an API response body.

Deliberately NOT persisted to a file/database. The task's explicit
instruction for this round was: "Do NOT invent plaintext JSON credential
persistence merely for convenience" -- an in-memory, process-local store
is the documented acceptable minimum for this thesis/local application.
Environment variables continue to work as the fallback whenever no
runtime override has been saved (``effective_settings`` only overrides a
field once a caller has explicitly set it via ``update``).
"""

from __future__ import annotations

import threading
from dataclasses import replace
from typing import Literal

from syntax_tree_refurbished.config import Settings

ConfigSource = Literal["runtime", "environment", "unset"]


class ArchExplanationRuntimeConfig:
    """Thread-safe, process-local, in-memory-only override store.

    Every field starts at ``None`` ("no override saved yet"); an unset
    field falls through to the environment-derived base ``Settings`` in
    ``effective_settings``. ``_api_key`` is the one genuinely secret
    field: it is never exposed by any method that returns something an
    API response could serialize (only ``resolve_api_key``, which is for
    internal use by the model-construction code path, ever returns it).
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._enabled: bool | None = None
        self._provider: str | None = None
        self._model: str | None = None
        self._base_url: str | None = None
        self._api_key: str | None = None
        self._has_saved: bool = False

    def update(
        self,
        *,
        enabled: bool,
        provider: str,
        model: str,
        base_url: str,
        api_key: str | None,
        clear_api_key: bool,
    ) -> None:
        """Apply one full Settings-form save. ``api_key`` of ``None``
        means "leave the previously-stored credential unchanged" (the UI
        never re-sends a credential it only displayed as masked
        placeholder dots); ``clear_api_key=True`` explicitly removes it
        regardless of ``api_key``."""
        with self._lock:
            self._enabled = enabled
            self._provider = provider.strip().lower()
            self._model = model
            self._base_url = base_url
            if clear_api_key:
                self._api_key = None
            elif api_key:
                self._api_key = api_key
            self._has_saved = True

    def clear(self) -> None:
        """Test/debug-only full reset back to "no runtime override" (pure
        environment fallback)."""
        with self._lock:
            self._enabled = None
            self._provider = None
            self._model = None
            self._base_url = None
            self._api_key = None
            self._has_saved = False

    def effective_settings(self, base: Settings) -> Settings:
        """Merge saved runtime overrides on top of the env-loaded
        ``base`` Settings. Fields never explicitly saved fall through to
        ``base`` unchanged, which is what keeps env-var configuration
        working as a fallback (requirement: "Environment-variable
        configuration must continue to work as a fallback")."""
        with self._lock:
            if not self._has_saved:
                return base
            key_present = bool(self._api_key) or base.arch_explanation_llm_api_key_present
            return replace(
                base,
                arch_explanation_llm_enabled=self._enabled
                if self._enabled is not None
                else base.arch_explanation_llm_enabled,
                arch_explanation_llm_provider=self._provider or base.arch_explanation_llm_provider,
                arch_explanation_llm_model=self._model
                if self._model is not None
                else base.arch_explanation_llm_model,
                arch_explanation_llm_base_url=self._base_url
                if self._base_url is not None
                else base.arch_explanation_llm_base_url,
                arch_explanation_llm_api_key_present=key_present,
            )

    def resolve_api_key(self, base: Settings) -> str | None:
        """The one place the raw credential is returned. Used only by
        model/connection-test construction, never by anything that
        serializes to an HTTP response. Falls back to the
        environment-variable credential when no runtime key was saved,
        preserving the pre-Settings-UI behavior exactly."""
        import os

        with self._lock:
            if self._api_key:
                return self._api_key
        return os.getenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_API_KEY")

    def source(self, base: Settings) -> ConfigSource:
        with self._lock:
            has_saved = self._has_saved
        if has_saved:
            return "runtime"
        if base.arch_explanation_llm_enabled or base.arch_explanation_llm_api_key_present:
            return "environment"
        return "unset"

    def credential_source(self, base: Settings) -> ConfigSource:
        with self._lock:
            if self._api_key:
                return "runtime"
        if base.arch_explanation_llm_api_key_present:
            return "environment"
        return "unset"
