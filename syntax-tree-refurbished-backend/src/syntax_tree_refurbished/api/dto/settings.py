"""DTOs for the end-user Settings API (product-hardening round).

Covers only the architectural-explanation LLM configuration boundary
(``Settings.arch_explanation_llm_*`` /
``app.architectural_explanation.runtime_config.ArchExplanationRuntimeConfig``)
-- the legacy architecture-map/investigation LLM configuration is
untouched and has no equivalent Settings-UI surface in this round.

Every response DTO here is constructed to make it structurally
impossible to include the API key: none of them declare a field that
could hold it, so there is no accidental-inclusion bug to guard against
in the route layer either.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ConfigSourceLiteral = Literal["runtime", "environment", "unset"]


class ArchExplanationSettingsResponse(BaseModel):
    """GET/PUT response shape. Never includes the API key -- only
    ``credentials_present``/``credential_source``."""

    enabled: bool
    provider: str
    base_url: str
    model: str
    configured: bool
    credentials_present: bool
    credential_source: ConfigSourceLiteral
    config_source: ConfigSourceLiteral


class ArchExplanationSettingsUpdate(BaseModel):
    """PUT request body.

    ``api_key``: ``None`` (the default, and what the UI sends when the
    user left the masked credential field untouched) means "keep the
    previously-saved credential unchanged". A non-empty string replaces
    it. ``clear_api_key=True`` explicitly removes any saved credential
    regardless of ``api_key`` -- the UI's own "Remove saved key" action.
    """

    enabled: bool
    provider: str = Field(default="off")
    base_url: str = Field(default="")
    model: str = Field(default="")
    api_key: str | None = None
    clear_api_key: bool = False


class ConnectionTestRequest(BaseModel):
    """POST /api/settings/architectural-explanation/test-connection body.

    Every field is optional: an omitted field falls back to the
    currently-saved (or env-var) value, so a user can click "Test
    connection" against the already-saved configuration without
    retyping anything, or supply not-yet-saved candidate values to test
    before saving."""

    provider: str | None = None
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None


class ConnectionTestResponse(BaseModel):
    status: str
    message: str
    latency_ms: int | None = None
    model_used: str | None = None
