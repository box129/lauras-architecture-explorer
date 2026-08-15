"""Runtime configuration for the refurbished backend."""

from __future__ import annotations

import os
from dataclasses import dataclass

from syntax_tree_refurbished.app.investigation.providers import SUPPORTED_PROVIDERS


ENV_PREFIX = "SYNTAX_TREE_REFURBISHED_"


@dataclass(frozen=True)
class Settings:
    app_name: str = "Syntax Tree Refurbished Backend"
    environment: str = "development"
    log_level: str = "INFO"
    database_path: str = ".syntax-tree-refurbished/backend.sqlite"
    llm_provider: str = "off"
    openrouter_model: str = "blackboxai/anthropic/claude-sonnet-4.6"
    max_file_size_bytes: int = 1_048_576
    max_lines_per_file: int = 50_000
    blackbox_api_key_present: bool = False
    openrouter_api_key_present: bool = False
    openrouter_api_key_2_present: bool = False

    # --- Architectural explanations (L1 claim proposer): an independent
    # LLM configuration boundary from the block above, which governs
    # architecture-map/system-overview generation and the unrelated
    # investigation/query feature (both via InvestigationEngine). Kept
    # fully separate (own enabled flag, own provider, own model, own base
    # URL, own api-key-presence flag) so architectural explanations can be
    # turned on/off, or pointed at a different provider/model/endpoint,
    # without affecting -- or being affected by -- those legacy features.
    # See app.investigation.llm_model.make_arch_explanation_model and
    # api.routes.architectural_explanation._proposer, the only two call
    # sites that read these fields.
    arch_explanation_llm_enabled: bool = False
    arch_explanation_llm_provider: str = "off"
    arch_explanation_llm_model: str = ""
    arch_explanation_llm_base_url: str = ""
    arch_explanation_llm_api_key_present: bool = False
    arch_explanation_llm_timeout_seconds: int = 60

    @property
    def live_llm_configured(self) -> bool:
        provider = self.llm_provider.strip().lower()
        if provider == "blackbox":
            return self.blackbox_api_key_present
        if provider == "openrouter":
            return self.openrouter_api_key_present or self.openrouter_api_key_2_present
        return False

    @property
    def arch_explanation_llm_configured(self) -> bool:
        """True only when architectural explanations are explicitly
        enabled AND a supported provider AND an API key are present --
        independent of ``live_llm_configured``/the legacy LLM block
        above. A caller must never fall back to the legacy flag if this
        is False."""
        if not self.arch_explanation_llm_enabled:
            return False
        provider = self.arch_explanation_llm_provider.strip().lower()
        if provider not in SUPPORTED_PROVIDERS:
            return False
        return self.arch_explanation_llm_api_key_present


def load_settings() -> Settings:
    return Settings(
        environment=_env("ENV", "development"),
        log_level=_env("LOG_LEVEL", "INFO").upper(),
        database_path=_env("DB_PATH", ".syntax-tree-refurbished/backend.sqlite"),
        llm_provider=(os.getenv("SYNTAX_TREE_LLM_PROVIDER") or os.getenv("LLM_PROVIDER") or "off").strip().lower(),
        openrouter_model=os.getenv("OPENROUTER_MODEL", "blackboxai/anthropic/claude-sonnet-4.6"),
        max_file_size_bytes=int(_env("MAX_FILE_SIZE_BYTES", "1048576")),
        max_lines_per_file=int(_env("MAX_LINES_PER_FILE", "50000")),
        blackbox_api_key_present=bool(os.getenv("BLACKBOX_API_KEY")),
        openrouter_api_key_present=bool(os.getenv("OPENROUTER_API_KEY")),
        openrouter_api_key_2_present=bool(os.getenv("OPENROUTER_API_KEY_2")),
        arch_explanation_llm_enabled=_bool_env("SYNTAX_TREE_ARCH_EXPLANATION_ENABLED", False),
        arch_explanation_llm_provider=(
            os.getenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_PROVIDER", "off").strip().lower()
        ),
        arch_explanation_llm_model=os.getenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_MODEL", ""),
        arch_explanation_llm_base_url=os.getenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_BASE_URL", ""),
        arch_explanation_llm_api_key_present=bool(os.getenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_API_KEY")),
        arch_explanation_llm_timeout_seconds=int(
            os.getenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_TIMEOUT_SECONDS", "60")
        ),
    )


def _env(name: str, default: str) -> str:
    return os.getenv(f"{ENV_PREFIX}{name}", default)


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}
