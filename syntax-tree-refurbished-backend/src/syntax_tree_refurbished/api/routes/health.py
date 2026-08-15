"""Health and readiness endpoints."""

from __future__ import annotations

import platform
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from syntax_tree_refurbished import __version__
from syntax_tree_refurbished.config import Settings


router = APIRouter(tags=["health"])


class LlmHealth(BaseModel):
    configured: bool
    provider_keys_present: dict[str, bool]
    model: str


class ArchExplanationLlmHealth(BaseModel):
    """Independent config-boundary status for the architectural-explanation
    claim proposer (Phase 3) -- deliberately a separate object from
    ``llm`` above, which reports the legacy architecture-map/investigation
    configuration. Never includes the API key itself, only whether one is
    present."""

    enabled: bool
    configured: bool
    provider: str
    model: str
    base_url: str
    credentials_present: bool


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
    environment: str
    python_version: str
    storage: dict[str, str]
    llm: LlmHealth
    architectural_explanation_llm: ArchExplanationLlmHealth


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    settings = _settings(request)
    arch_settings = _effective_arch_explanation_settings(request)
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=__version__,
        environment=settings.environment,
        python_version=platform.python_version(),
        storage={"kind": "sqlite", "path": settings.database_path},
        llm=LlmHealth(
            configured=settings.live_llm_configured,
            provider_keys_present={
                "blackbox": settings.blackbox_api_key_present,
                "openrouter": settings.openrouter_api_key_present,
                "openrouter_secondary": settings.openrouter_api_key_2_present,
            },
            model=settings.openrouter_model,
        ),
        architectural_explanation_llm=ArchExplanationLlmHealth(
            enabled=arch_settings.arch_explanation_llm_enabled,
            configured=arch_settings.arch_explanation_llm_configured,
            provider=arch_settings.arch_explanation_llm_provider,
            model=arch_settings.arch_explanation_llm_model,
            base_url=arch_settings.arch_explanation_llm_base_url,
            credentials_present=arch_settings.arch_explanation_llm_api_key_present,
        ),
    )


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _effective_arch_explanation_settings(request: Request) -> Settings:
    """Same effective-settings merge as
    ``api.routes.architectural_explanation._settings`` -- reports whatever
    a Settings-UI save actually changed, not just the env-var snapshot
    taken at process start."""
    runtime = getattr(request.app.state, "arch_explanation_runtime_config", None)
    base = request.app.state.settings
    if runtime is None:
        return base
    return runtime.effective_settings(base)

