from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.investigation.llm_model import NoConfiguredModel, make_live_model
from syntax_tree_refurbished.config import Settings


def test_health_endpoint_reports_readiness_without_secrets() -> None:
    app = create_app(
        Settings(
            environment="test",
            database_path=":memory:",
            llm_provider="blackbox",
            openrouter_model="blackboxai/anthropic/claude-sonnet-4.6",
            blackbox_api_key_present=True,
            openrouter_api_key_present=True,
            openrouter_api_key_2_present=False,
        )
    )

    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "Syntax Tree Refurbished Backend"
    assert body["environment"] == "test"
    assert body["storage"] == {"kind": "sqlite", "path": ":memory:"}
    assert body["llm"]["configured"] is True
    assert body["llm"]["provider_keys_present"] == {
        "blackbox": True,
        "openrouter": True,
        "openrouter_secondary": False,
    }
    rendered = str(body)
    assert "sk-" not in rendered
    assert "api_key" not in rendered.lower()


def test_create_app_exposes_openapi_under_api_prefix() -> None:
    response = TestClient(create_app(Settings(environment="test"))).get("/api/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Syntax Tree Refurbished Backend"


def test_explicit_off_and_provider_key_mismatch_use_local_model() -> None:
    explicitly_off = Settings(llm_provider="off", blackbox_api_key_present=True)
    wrong_provider_key = Settings(llm_provider="openrouter", blackbox_api_key_present=True)

    assert explicitly_off.live_llm_configured is False
    assert wrong_provider_key.live_llm_configured is False
    assert isinstance(make_live_model(explicitly_off), NoConfiguredModel)
    assert isinstance(make_live_model(wrong_provider_key), NoConfiguredModel)

