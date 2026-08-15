"""End-user Settings API (product-hardening round: PHASE 2).

Environment variables (``SYNTAX_TREE_ARCH_EXPLANATION_LLM_*``) were the
only way to configure the architectural-explanation LLM before this
round -- not an acceptable end-user configuration experience for the
final product. This router adds a real Settings surface on top of the
existing, unmodified configuration boundary
(``Settings.arch_explanation_llm_*`` /
``app.investigation.llm_model.make_arch_explanation_model``): saved
values live in a process-local, in-memory-only store
(``app.architectural_explanation.runtime_config
.ArchExplanationRuntimeConfig``, see its module docstring for why not a
file/database), env vars keep working as a fallback whenever nothing has
been saved, and the architectural-explanation feature remains fully
independent of the legacy architecture-map/investigation LLM
configuration (untouched by this router).

Credential-safety invariants enforced here (see
``tests/test_settings_credential_safety.py``):
    - GET/PUT responses never include the raw API key, only
      ``credentials_present``/``credential_source``.
    - The test-connection endpoint accepts a key to test but never
      echoes it back in the response.
    - Nothing in this module logs a request body or a resolved API key.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from syntax_tree_refurbished.api.dto.settings import (
    ArchExplanationSettingsResponse,
    ArchExplanationSettingsUpdate,
    ConnectionTestRequest,
    ConnectionTestResponse,
)
from syntax_tree_refurbished.app.architectural_explanation.connection_test import test_connection
from syntax_tree_refurbished.app.architectural_explanation.runtime_config import (
    ArchExplanationRuntimeConfig,
)
from syntax_tree_refurbished.config import Settings

router = APIRouter(tags=["settings"])


@router.get(
    "/settings/architectural-explanation",
    response_model=ArchExplanationSettingsResponse,
)
def get_architectural_explanation_settings(request: Request) -> ArchExplanationSettingsResponse:
    runtime = _runtime(request)
    base = _base_settings(request)
    return _to_response(runtime, base)


@router.put(
    "/settings/architectural-explanation",
    response_model=ArchExplanationSettingsResponse,
)
def put_architectural_explanation_settings(
    body: ArchExplanationSettingsUpdate, request: Request
) -> ArchExplanationSettingsResponse:
    runtime = _runtime(request)
    runtime.update(
        enabled=body.enabled,
        provider=body.provider,
        model=body.model,
        base_url=body.base_url,
        api_key=body.api_key,
        clear_api_key=body.clear_api_key,
    )
    base = _base_settings(request)
    return _to_response(runtime, base)


@router.post(
    "/settings/architectural-explanation/test-connection",
    response_model=ConnectionTestResponse,
)
def post_test_connection(
    body: ConnectionTestRequest, request: Request
) -> ConnectionTestResponse:
    runtime = _runtime(request)
    base = _base_settings(request)
    effective = runtime.effective_settings(base)

    provider = body.provider if body.provider is not None else effective.arch_explanation_llm_provider
    model = body.model if body.model is not None else effective.arch_explanation_llm_model
    base_url = body.base_url if body.base_url is not None else effective.arch_explanation_llm_base_url
    api_key = body.api_key if body.api_key else runtime.resolve_api_key(base)

    result = test_connection(
        provider=provider,
        model=model,
        base_url=base_url,
        api_key=api_key,
        timeout_seconds=effective.arch_explanation_llm_timeout_seconds,
    )
    return ConnectionTestResponse(
        status=result.status,
        message=result.message,
        latency_ms=result.latency_ms,
        model_used=result.model_used,
    )


def _to_response(
    runtime: ArchExplanationRuntimeConfig, base: Settings
) -> ArchExplanationSettingsResponse:
    effective = runtime.effective_settings(base)
    return ArchExplanationSettingsResponse(
        enabled=effective.arch_explanation_llm_enabled,
        provider=effective.arch_explanation_llm_provider,
        base_url=effective.arch_explanation_llm_base_url,
        model=effective.arch_explanation_llm_model,
        configured=effective.arch_explanation_llm_configured,
        credentials_present=effective.arch_explanation_llm_api_key_present,
        credential_source=runtime.credential_source(base),
        config_source=runtime.source(base),
    )


def _runtime(request: Request) -> ArchExplanationRuntimeConfig:
    return request.app.state.arch_explanation_runtime_config


def _base_settings(request: Request) -> Settings:
    return request.app.state.settings
