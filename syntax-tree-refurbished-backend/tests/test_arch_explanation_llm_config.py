"""Phase 3 ("final product hardening"): architectural explanations get
their own, independently-enableable LLM configuration boundary
(Settings.arch_explanation_llm_*), decoupled from the legacy
live_llm_configured flag that gates architecture-map/system-overview
generation and the unrelated investigation/query feature.

All tests here are pure config/model-construction unit tests or
FastAPI TestClient tests using request.app.state.claim_proposer/
investigation_model injection -- no external API call, no live network
request, matching this project's standing mocked-provider-only test
discipline (see Settings.arch_explanation_llm_configured's own docstring
for the property under test).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.investigation.llm_model import (
    NoConfiguredModel,
    OpenAICompatibleInvestigationModel,
    make_arch_explanation_model,
)
from syntax_tree_refurbished.config import Settings


# ---------------------------------------------------------------------------
# Settings.arch_explanation_llm_configured
# ---------------------------------------------------------------------------


def test_disabled_by_default() -> None:
    settings = Settings()
    assert settings.arch_explanation_llm_enabled is False
    assert settings.arch_explanation_llm_configured is False


def test_not_configured_when_enabled_but_no_provider() -> None:
    settings = Settings(arch_explanation_llm_enabled=True, arch_explanation_llm_provider="off")
    assert settings.arch_explanation_llm_configured is False


def test_not_configured_when_enabled_and_provider_but_no_credentials() -> None:
    settings = Settings(
        arch_explanation_llm_enabled=True,
        arch_explanation_llm_provider="openrouter",
        arch_explanation_llm_api_key_present=False,
    )
    assert settings.arch_explanation_llm_configured is False


def test_configured_when_enabled_provider_and_credentials_all_present() -> None:
    settings = Settings(
        arch_explanation_llm_enabled=True,
        arch_explanation_llm_provider="openrouter",
        arch_explanation_llm_api_key_present=True,
    )
    assert settings.arch_explanation_llm_configured is True


def test_independent_of_legacy_live_llm_configured() -> None:
    """The central independence property: legacy llm_provider/keys being
    configured must NOT make arch_explanation_llm_configured True, and
    vice versa."""
    legacy_only = Settings(
        llm_provider="openrouter",
        openrouter_api_key_present=True,
        arch_explanation_llm_enabled=False,
    )
    assert legacy_only.live_llm_configured is True
    assert legacy_only.arch_explanation_llm_configured is False

    arch_only = Settings(
        llm_provider="off",
        arch_explanation_llm_enabled=True,
        arch_explanation_llm_provider="openrouter",
        arch_explanation_llm_api_key_present=True,
    )
    assert arch_only.live_llm_configured is False
    assert arch_only.arch_explanation_llm_configured is True


# ---------------------------------------------------------------------------
# make_arch_explanation_model
# ---------------------------------------------------------------------------


def test_make_arch_explanation_model_returns_no_configured_model_when_disabled() -> None:
    settings = Settings(arch_explanation_llm_enabled=False)
    model = make_arch_explanation_model(settings)
    assert isinstance(model, NoConfiguredModel)


def test_make_arch_explanation_model_uses_its_own_overrides_not_legacy_values(monkeypatch: pytest.MonkeyPatch) -> None:
    """Independence at the model-construction level, not just the config
    flag: point the legacy OPENROUTER_* env vars at one set of values and
    the arch-explanation-specific env var at a different one, and confirm
    the constructed model uses the arch-explanation value."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "legacy-key-should-not-be-used")
    monkeypatch.setenv("OPENROUTER_MODEL", "legacy-model-should-not-be-used")
    monkeypatch.setenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_API_KEY", "arch-explanation-key")

    settings = Settings(
        arch_explanation_llm_enabled=True,
        arch_explanation_llm_provider="openrouter",
        arch_explanation_llm_model="arch-explanation-model",
        arch_explanation_llm_base_url="http://127.0.0.1:9999/v1",
        arch_explanation_llm_api_key_present=True,
        arch_explanation_llm_timeout_seconds=17,
    )

    model = make_arch_explanation_model(settings)

    assert isinstance(model, OpenAICompatibleInvestigationModel)
    assert model.model_name == "arch-explanation-model"
    # Internal fields -- acceptable to inspect directly in a unit test
    # that exists specifically to prove configuration independence.
    assert model._api_key == "arch-explanation-key"  # noqa: SLF001
    assert model._base_url == "http://127.0.0.1:9999/v1"  # noqa: SLF001
    assert model._timeout_seconds == 17  # noqa: SLF001


def test_make_arch_explanation_model_falls_back_to_shared_default_model_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An unset arch_explanation_llm_model is allowed to fall back to the
    shared default model constant (Settings.openrouter_model) -- that
    constant is a generic default, not legacy-specific -- but the API key
    must still come from the arch-explanation-specific env var only."""
    monkeypatch.setenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_API_KEY", "arch-explanation-key")
    settings = Settings(
        arch_explanation_llm_enabled=True,
        arch_explanation_llm_provider="openrouter",
        arch_explanation_llm_model="",
        arch_explanation_llm_api_key_present=True,
        openrouter_model="shared-default-model",
    )

    model = make_arch_explanation_model(settings)

    assert isinstance(model, OpenAICompatibleInvestigationModel)
    assert model.model_name == "shared-default-model"


def test_make_arch_explanation_model_raises_when_configured_flag_is_stale(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """arch_explanation_llm_api_key_present is a boolean snapshot taken at
    settings-load time; if the actual env var is unset by the time the
    model is constructed (e.g. a stale/hand-built Settings in a test),
    the api key resolves empty and construction fails loudly rather than
    silently falling back to a legacy key."""
    monkeypatch.delenv("SYNTAX_TREE_ARCH_EXPLANATION_LLM_API_KEY", raising=False)
    settings = Settings(
        arch_explanation_llm_enabled=True,
        arch_explanation_llm_provider="openrouter",
        arch_explanation_llm_api_key_present=True,
    )

    with pytest.raises(RuntimeError, match="No API key configured"):
        make_arch_explanation_model(settings)


# ---------------------------------------------------------------------------
# Route-level independence: /api/entities/{id}/architectural-explanation
# ---------------------------------------------------------------------------


def _analyzed_app(tmp_path, settings: Settings):
    app = create_app(settings)
    client = TestClient(app)
    (tmp_path / "app.py").write_text(
        "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n", encoding="utf-8"
    )
    response = client.post("/api/analyze", json={"repository_path": str(tmp_path)})
    assert response.status_code == 200
    return app, client, response.json()["run_id"]


def test_proposer_selection_ignores_legacy_live_llm_configured(tmp_path) -> None:
    """Legacy live_llm_configured=True (e.g. investigation/architecture-map
    is live-LLM-backed) must NOT cause the architectural-explanation route
    to attempt a real network call -- it has its own, separately-disabled
    config, so it must fall back to NullClaimProposer (zero proposals,
    never an error) here."""
    settings = Settings(
        environment="development",
        llm_provider="openrouter",
        openrouter_api_key_present=True,
        arch_explanation_llm_enabled=False,
    )
    app, client, run_id = _analyzed_app(tmp_path, settings)
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")

    response = client.post(f"/api/entities/{caller.id}/claims", json=None, params={"run_id": run_id})

    assert response.status_code == 200
    assert response.json()["claims"] == []


# ---------------------------------------------------------------------------
# Health endpoint: reports status, never leaks the credential value.
# ---------------------------------------------------------------------------


def test_health_reports_arch_explanation_status_without_leaking_credentials() -> None:
    settings = Settings(
        environment="test",
        database_path=":memory:",
        arch_explanation_llm_enabled=True,
        arch_explanation_llm_provider="openrouter",
        arch_explanation_llm_model="some-model",
        arch_explanation_llm_base_url="https://example.invalid/v1",
        arch_explanation_llm_api_key_present=True,
    )
    app = create_app(settings)
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    body = response.json()
    section = body["architectural_explanation_llm"]
    assert section["enabled"] is True
    assert section["configured"] is True
    assert section["provider"] == "openrouter"
    assert section["model"] == "some-model"
    assert section["credentials_present"] is True

    rendered = str(body).lower()
    assert "api_key" not in rendered
    assert "sk-" not in rendered
