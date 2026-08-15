"""Part 1 follow-up to d4ab177 (system overview cache-mode isolation).

d4ab177 stopped a FAILED live-model investigation from poisoning the
overview cache with a near-empty map, but SystemOverviewGenerator's cache
identity (``input_hash``) was still based only on repository content and
the configured model's name. Nothing prevented a genuinely SUCCESSFUL
live-model overview, once cached, from later being served back to a
NoConfiguredModel() caller (or vice versa) -- which would violate
AnalysisController's deliberate choice to keep the architecture-map
structure stage deterministic, even though the reused content happened to
be valid.

``GenerationMode`` (core/models/system_overview.py) closes this: every
overview is tagged "no_model" (NoConfiguredModel, OR a live model that was
attempted but never produced a usable reply -- both are the same
deterministic, source-backed content in substance) or "live_model" (a
genuine successful investigation). The tag is folded into ``input_hash``
itself (so a mismatched-mode entry cannot even coincidentally collide) AND
checked explicitly against the stored ``metrics.generation_mode`` at read
time (so a failed live-model attempt's "no_model"-tagged degraded entry
can never masquerade as a durable "live_model" result for a later retry
under the same model)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.investigation.llm_model import ModelReply, NoConfiguredModel
from syntax_tree_refurbished.app.overview.system_overview_generator import SystemOverviewGenerator
from syntax_tree_refurbished.config import Settings


@dataclass
class ScriptedModel:
    replies: list[dict[str, Any]]
    model_name: str = "fake-live-model"
    calls: int = 0

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        self.calls += 1
        if not self.replies:
            raise RuntimeError("No scripted replies left.")
        return ModelReply(data=self.replies.pop(0), model=self.model_name, tokens_in=10, tokens_out=10, latency_ms=1)


@dataclass
class AlwaysFailingModel:
    """A live, CONFIGURED model that never produces a usable reply --
    exactly what a stale/invalid legacy model id looks like against a real
    provider (the same scenario d4ab177 fixed)."""

    model_name: str = "fake-broken-legacy-model"
    calls: int = 0

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        self.calls += 1
        raise RuntimeError("LLM HTTP error 400: invalid model")


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_small_fixture(root: Path) -> None:
    write(root / "pkg" / "__init__.py", "")
    write(root / "pkg" / "service.py", "class Service:\n    def run(self):\n        return 1\n")


def analyzed_app(repo: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    return app, response.json()["run_id"], client


def scripted_replies() -> list[dict[str, Any]]:
    return [
        {
            "hypotheses": [{"id": "h1", "claim": "A small service module."}],
            "competing_theories": [],
            "mismatches": [],
            "next_action": {"tool": "find_definition", "args": {"query": "run"}, "reason": "Inspect Service.run."},
        },
        {
            "final": {
                "summary": "A tiny service module.",
                "simple_explanation": "Service.run does the work.",
                "technical_explanation": "Service.run does the work.",
                "repo_identity": {"name": "small", "description": "tiny fixture"},
                "repo_shape": {
                    "kind": "service_module",
                    "label": "Service module",
                    "confidence": 0.9,
                    "support_status": "verified",
                    "reason": "Service.run was inspected.",
                },
                "component_hypotheses": [
                    {"component": "Service Layer", "support_status": "verified"},
                ],
                "relationships": [],
                "claims": [],
                "important_regions": [],
                "suggested_next_questions": [],
                "gaps": [],
            }
        },
    ]


def _generator(app, run_id: str, model) -> SystemOverviewGenerator:
    job = app.state.run_store.get_run(run_id)
    return SystemOverviewGenerator(job=job, store=app.state.run_store, model=model)


# ---------------------------------------------------------------------------
# 1/2: NoConfiguredModel generates and caches a deterministic overview, and
# a subsequent NoConfiguredModel run reuses it.
# ---------------------------------------------------------------------------


def test_no_configured_model_generates_and_caches_deterministic_overview(tmp_path: Path) -> None:
    write_small_fixture(tmp_path)
    app, run_id, _ = analyzed_app(tmp_path)

    overview = _generator(app, run_id, NoConfiguredModel()).get_or_generate()

    assert overview.metrics.generation_mode == "no_model"
    assert overview.metrics.llm_used is False
    assert overview.main_components  # build_static_structure found the real module


def test_subsequent_no_configured_model_run_reuses_deterministic_entry(tmp_path: Path) -> None:
    write_small_fixture(tmp_path)
    app, run_id, _ = analyzed_app(tmp_path)
    # AnalysisController already generated and cached a "no_model" overview
    # during POST /api/analyze (its own structure stage), so this first
    # explicit call is itself already a cache hit -- confirm that, then
    # confirm a further call reuses the exact same cached entry.
    first = _generator(app, run_id, NoConfiguredModel()).get_or_generate()
    assert first.metrics.cached is True
    assert first.metrics.generation_mode == "no_model"

    second = _generator(app, run_id, NoConfiguredModel()).get_or_generate()

    assert second.metrics.cached is True
    assert second.id == first.id
    assert second.metrics.generation_mode == "no_model"


# ---------------------------------------------------------------------------
# 3/4: cross-mode isolation in both directions.
# ---------------------------------------------------------------------------


def test_successful_live_model_entry_is_not_reused_by_no_configured_model(tmp_path: Path) -> None:
    write_small_fixture(tmp_path)
    app, run_id, _ = analyzed_app(tmp_path)

    live = _generator(app, run_id, ScriptedModel(scripted_replies())).get_or_generate()
    assert live.metrics.generation_mode == "live_model"
    assert live.metrics.llm_used is True

    deterministic = _generator(app, run_id, NoConfiguredModel()).get_or_generate()
    assert deterministic.metrics.cached is False, "NoConfiguredModel must not reuse a live-model cache entry."
    assert deterministic.metrics.generation_mode == "no_model"
    assert deterministic.metrics.llm_used is False


def test_deterministic_entry_is_not_silently_reused_as_live_model_entry(tmp_path: Path) -> None:
    write_small_fixture(tmp_path)
    app, run_id, _ = analyzed_app(tmp_path)

    deterministic = _generator(app, run_id, NoConfiguredModel()).get_or_generate()
    assert deterministic.metrics.generation_mode == "no_model"

    model = ScriptedModel(scripted_replies())
    live = _generator(app, run_id, model).get_or_generate()
    assert live.metrics.cached is False, "A live-model call must not reuse a deterministic cache entry."
    assert model.calls > 0, "The live model must actually have been invoked, not skipped via a stale cache hit."
    assert live.metrics.generation_mode == "live_model"
    assert live.metrics.llm_used is True


# ---------------------------------------------------------------------------
# 5: d4ab177 regression -- a failed live model still degrades to the
# deterministic overview (never an empty map, never a leaked raw error).
# ---------------------------------------------------------------------------


def test_failed_live_model_still_degrades_to_deterministic_overview(tmp_path: Path) -> None:
    write_small_fixture(tmp_path)
    app, run_id, _ = analyzed_app(tmp_path)

    failing = AlwaysFailingModel()
    overview = _generator(app, run_id, failing).get_or_generate()

    assert failing.calls >= 1
    assert overview.metrics.llm_used is False
    assert overview.metrics.generation_mode == "no_model"
    assert overview.main_components  # still navigable, not empty


# ---------------------------------------------------------------------------
# 6: legacy/bad cache records cannot cross-contaminate modes -- a failed
# live-model attempt's "no_model"-tagged degraded entry (reached via a
# live, non-NoConfiguredModel call, so it shares model_name with a later
# retry) must not block that later retry from reaching the live model
# again once it recovers.
# ---------------------------------------------------------------------------


def test_legacy_or_failed_cache_record_cannot_cross_contaminate_modes(tmp_path: Path) -> None:
    write_small_fixture(tmp_path)
    app, run_id, _ = analyzed_app(tmp_path)

    failing = AlwaysFailingModel()
    degraded = _generator(app, run_id, failing).get_or_generate()
    assert degraded.metrics.generation_mode == "no_model"

    recovering = ScriptedModel(scripted_replies(), model_name=failing.model_name)
    recovered = _generator(app, run_id, recovering).get_or_generate()

    assert recovering.calls > 0, "The live model must be retried, not blocked by the earlier degraded entry."
    assert recovered.metrics.cached is False
    assert recovered.metrics.generation_mode == "live_model"
    assert recovered.metrics.llm_used is True


# ---------------------------------------------------------------------------
# 7/8: unaffected behavior.
# ---------------------------------------------------------------------------


def test_normal_non_degenerate_map_behavior_is_unchanged(tmp_path: Path) -> None:
    write(tmp_path / "httpx" / "__init__.py", "from ._api import get\nfrom ._client import Client\n")
    write(tmp_path / "httpx" / "_api.py", "def get(url):\n    return Client().send('GET', url)\n")
    write(tmp_path / "httpx" / "_client.py", "class Client:\n    def send(self, method, url):\n        return None\n")
    app, run_id, client = analyzed_app(tmp_path)
    app.state.investigation_model = ScriptedModel(scripted_replies())

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    assert body["root"]["children_count"] >= 1
    assert body["root"]["can_drilldown"] is True


def test_canonical_python_app_remains_navigable(tmp_path: Path) -> None:
    fixture = Path(__file__).resolve().parents[2] / "research" / "provenance-evaluation" / "fixtures" / "python_app"
    assert fixture.exists(), f"Canonical fixture missing: {fixture}"
    app, run_id, client = analyzed_app(fixture)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    assert body["root"]["children_count"] > 0
    assert body["root"]["can_drilldown"] is True
    # Phase B (deterministic grouped Overview) groups this fixture's
    # multi-directory shape (controllers/services/models/repositories) into
    # structural_group sections rather than one flat top-level node per
    # file -- so "order_service" is no longer a top-level label directly,
    # but must still be reachable one level down, inside its real
    # directory's group (see architecture-navigation Phase B's search/
    # direct-access requirement: grouping must never make a known file
    # unreachable, only require one extra, honest drill-down step).
    top_level_labels = [node["label"] for node in body["nodes"]]
    assert not any("order_service" in label for label in top_level_labels), (
        "this fixture has >=2 directories, so order_service.py should now live inside a group, not top-level"
    )
    services_group = next(node for node in body["nodes"] if node["kind"] == "structural_group" and node["label"] == "services")
    group_children = client.get(f"/api/architecture-map/nodes/{services_group['id']}/children?run_id={run_id}").json()
    assert any("order_service" in child["label"] for child in group_children["children"])
