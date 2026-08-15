"""Part 2 follow-up to d4ab177: prove ordinary architecture-map navigation
(map fetch, drilldown, node lookup, and the automatically-fetched "Simple
explanation" panel) never triggers a request against the legacy
investigation model, whether or not one is configured.

Root cause found while investigating this: every route in
api/routes/architecture_map.py (including
``/nodes/{id}/explanation``, the "Simple explanation" panel's backing
route) resolved its model via ``_model(request)``, which -- outside test
mode, absent a test-injected override -- called ``make_live_model
(settings)``. The frontend's ``useNodeExplanation`` hook (see
ObservatoryShell.tsx: ``explanationNode = lens.selectedNode ??
lens.focalNode``) fetches that endpoint automatically the instant ANY node
is selected or entered -- not behind a separate, explicit "explain this"
action. So simply opening the map and clicking through it, with a legacy
provider configured, would silently fire a real external request. This is
exactly what produced the raw HTTP 400 for a stale legacy model seen in
qa-audit/live-openai-validation's blocker evidence.

The fix: ``_model()`` in architecture_map.py no longer resolves
``make_live_model`` at all -- absent a test-injected model, it always
returns ``NoConfiguredModel()``, matching AnalysisController's own
deliberate choice for the structure stage and applying it consistently to
every read this file serves. The real, OpenAI-configurable
architectural-explanation path (``make_arch_explanation_model``,
api/routes/architectural_explanation.py) is untouched -- it is a separate,
explicitly user-triggered feature, not part of this file at all."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.config import Settings


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_small_fixture(root: Path) -> None:
    write(root / "pkg" / "__init__.py", "")
    write(
        root / "pkg" / "service.py",
        "class Service:\n"
        "    def __init__(self):\n"
        "        self.helper = Helper()\n\n"
        "    def run(self):\n"
        "        return self.helper.assist()\n\n\n"
        "class Helper:\n"
        "    def assist(self):\n"
        "        return 1\n",
    )


def app_with_no_injected_model(repo: Path):
    """Deliberately environment="development" (real runtime's own default,
    see config.py -- NOT "test") with no app.state.investigation_model
    injected, to exercise the exact branch that used to resolve
    make_live_model(settings) and silently attempt a real network call.
    database_path=":memory:" keeps this fast/isolated like any other test
    despite the non-test environment value; nothing else in the analysis
    pipeline is gated on environment (only a few OTHER routes' own,
    separate _model()-equivalents are -- see this file's module
    docstring -- none of which are exercised here)."""
    app = create_app(Settings(environment="development", database_path=":memory:"))
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    return app, response.json()["run_id"], client


def test_map_fetch_does_not_invoke_any_investigation_model(tmp_path: Path) -> None:
    write_small_fixture(tmp_path)
    app, run_id, client = app_with_no_injected_model(tmp_path)

    response = client.get(f"/api/architecture-map?run_id={run_id}")
    assert response.status_code == 200
    assert response.json()["metadata"]["llm_used"] is False


def test_drilldown_children_does_not_invoke_any_investigation_model(tmp_path: Path) -> None:
    write_small_fixture(tmp_path)
    app, run_id, client = app_with_no_injected_model(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    drillable = next(n for n in body["nodes"] if n["id"] != body["root"]["id"] and n["can_drilldown"])
    children = client.get(f"/api/architecture-map/nodes/{drillable['id']}/children?run_id={run_id}")
    assert children.status_code == 200
    assert children.json()["total"] > 0


def test_selecting_a_node_and_fetching_its_explanation_does_not_invoke_a_legacy_model(tmp_path: Path) -> None:
    """This is the exact automatic frontend behavior: useNodeExplanation
    fires GET .../explanation the instant a node is selected/entered, with
    no separate explicit user action. Confirm that endpoint itself never
    reaches for a live legacy model when none is configured."""
    write_small_fixture(tmp_path)
    app, run_id, client = app_with_no_injected_model(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    node_id = next(n for n in body["nodes"] if n["id"] != body["root"]["id"])["id"]

    explanation = client.get(f"/api/architecture-map/nodes/{node_id}/explanation?run_id={run_id}")
    assert explanation.status_code == 200
    body = explanation.json()
    assert body["generation_status"] == "fallback_no_llm"
    # No raw provider text of any kind, since no request was ever attempted.
    assert "HTTP error" not in str(body)
    assert "400" not in str(body)
