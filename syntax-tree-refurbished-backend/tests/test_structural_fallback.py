"""Bounded product remediation: small-repository navigation fallback
(Part A) and the legacy "Simple explanation" failure path (Part B).

Root cause (see qa-audit/live-openai-validation/'s blocker report and
app.architecture_map.structural_fallback's own module docstring): a real
user's controlled fixture (research/provenance-evaluation/fixtures/
python_app/) produced an architecture map collapsed to a single root node
with zero children, and a real, live-but-broken legacy investigation
model produced a raw HTTP 400 directly in the "Simple explanation" UI
panel. Neither defect touches AnalysisController's NoConfiguredModel()
structure-stage hardcoding, the real OpenAI/architectural-explanation
proposer, or any research/provenance semantics -- both are fixed at the
architecture-map/system-overview layer only.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.investigation.llm_model import ModelReply
from syntax_tree_refurbished.config import Settings


@dataclass
class AlwaysFailingModel:
    """Simulates the real scenario: a live model IS configured (not
    NoConfiguredModel), but every call fails -- exactly what an invalid/
    stale legacy default model id produces against a real provider."""

    model_name: str = "blackboxai/anthropic/claude-sonnet-4.6"
    calls: int = 0

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        self.calls += 1
        raise RuntimeError(
            "LLM HTTP error 400: {\"error\":{\"message\":\"/chat/completions: Invalid model name passed in "
            "model=blackboxai/anthropic/claude-sonnet-4.6. Call `/v1/models` to view available models for "
            "your key.\"}}"
        )


@dataclass
class ScriptedModel:
    replies: list[dict[str, Any]]
    model_name: str = "fake-architecture-map"
    calls: int = 0

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        self.calls += 1
        if not self.replies:
            raise RuntimeError("No scripted replies left.")
        return ModelReply(data=self.replies.pop(0), model=self.model_name, tokens_in=100, tokens_out=50, latency_ms=1)


def analyzed_app(repo: Path, *, investigation_model=None):
    app = create_app(Settings(environment="test"))
    if investigation_model is not None:
        app.state.investigation_model = investigation_model
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    return app, response.json()["run_id"], client


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_python_app_shaped_fixture(root: Path) -> None:
    """Mirrors research/provenance-evaluation/fixtures/python_app/'s real
    shape (nested packages: controllers/, services/, models/,
    repositories/) closely enough to reproduce the same architecture-map
    behavior -- NOT a copy of the canonical fixture's ground-truth
    content (that stays untouched; see the real fixture read directly in
    test_canonical_fixture_exposes_order_service_create_order below)."""
    write(root / "__init__.py", "")
    write(root / "controllers" / "__init__.py", "")
    write(
        root / "controllers" / "order_controller.py",
        "from ..services.order_service import OrderService\n\n\n"
        "class OrderController:\n"
        "    def __init__(self, order_service: OrderService) -> None:\n"
        "        self.order_service = order_service\n\n"
        "    def place_order(self, customer_id, item_id, amount):\n"
        "        return self.order_service.create_order(customer_id, item_id, amount)\n",
    )
    write(root / "services" / "__init__.py", "")
    write(
        root / "services" / "payment_service.py",
        "class PaymentService:\n"
        "    def charge(self, customer_id, amount):\n"
        "        return None\n",
    )
    write(
        root / "services" / "order_service.py",
        "from ..repositories.order_repository import OrderRepository\n"
        "from .payment_service import PaymentService\n\n\n"
        "class OrderService:\n"
        "    def __init__(self, repository: OrderRepository, payment_service: PaymentService) -> None:\n"
        "        self.repository = repository\n"
        "        self.payment_service = payment_service\n\n"
        "    def create_order(self, customer_id, item_id, amount):\n"
        "        self.payment_service.charge(customer_id, amount)\n"
        "        self.repository.save(None)\n",
    )
    write(root / "repositories" / "__init__.py", "")
    write(
        root / "repositories" / "base.py",
        "class InMemoryRepository:\n    pass\n",
    )
    write(
        root / "repositories" / "order_repository.py",
        "from .base import InMemoryRepository\n\n\n"
        "class OrderRepository(InMemoryRepository):\n"
        "    def __init__(self) -> None:\n"
        "        self._orders = {}\n\n"
        "    def save(self, order):\n"
        "        self._orders[1] = order\n",
    )
    write(root / "models" / "__init__.py", "")
    write(root / "models" / "order.py", "class Order:\n    pass\n")


# ---------------------------------------------------------------------------
# Requirement 1: a normal multi-area map (real components exist) is unchanged.
# ---------------------------------------------------------------------------


def test_normal_multi_component_map_is_unaffected_by_the_fallback(tmp_path: Path) -> None:
    write(tmp_path / "httpx" / "__init__.py", "from ._api import get\nfrom ._client import Client\n")
    write(tmp_path / "httpx" / "_api.py", "def get(url):\n    return Client().send('GET', url)\n")
    write(tmp_path / "httpx" / "_client.py", "class Client:\n    def send(self, method, url):\n        return self._transport.handle_request(method, url)\n")
    write(tmp_path / "httpx" / "_auth.py", "class BasicAuth:\n    pass\n")
    app, run_id, client = analyzed_app(tmp_path, investigation_model=ScriptedModel(_httpx_replies()))

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()

    assert body["root"]["children_count"] == 3
    assert body["root"]["can_drilldown"] is True
    kinds = {node["kind"] for node in body["nodes"]}
    assert "structural_package" not in kinds
    assert "structural_module" not in kinds


# ---------------------------------------------------------------------------
# Requirement 2/3/4/5: degenerate single-root map gets deterministic,
# real-id, no-fabricated-edge, drillable children through the API canvas
# navigation uses.
# ---------------------------------------------------------------------------


def test_order_service_and_create_order_reachable_when_legacy_llm_fails(tmp_path: Path) -> None:
    """End-to-end regression, using the synthetic python_app-shaped
    fixture: with a real-but-broken legacy model (exactly the reported
    scenario), OrderService.create_order is reachable through the same
    normal-UI navigation API (map -> children*), using real persisted
    symbol ids, with no fabricated edges anywhere along the path. In
    this repository shape, Part B's fix (system_overview_generator
    falling back to the deterministic, source-backed overview instead
    of an overview built from a failed investigation) is what supplies
    the real per-file components; see
    test_structural_fallback_activates_for_a_genuinely_empty_projection
    below for a direct test of Part A's own fallback mechanism, which
    activates independently whenever the projection is genuinely empty
    for any reason (not only this one)."""
    write_python_app_shaped_fixture(tmp_path)
    app, run_id, client = analyzed_app(tmp_path, investigation_model=AlwaysFailingModel())
    real_symbol_ids = {s["id"] for s in client.get(f"/api/runs/{run_id}/symbols").json()["symbols"]}

    order_service_node = _drill_to_label(client, run_id, "OrderService")
    assert order_service_node is not None, "OrderService must be reachable via the normal map/children API"
    assert order_service_node["id"] in real_symbol_ids

    method_children = client.get(
        f"/api/architecture-map/nodes/{order_service_node['id']}/children?run_id={run_id}"
    ).json()
    # OrderService is a real symbol node, so its children route through the
    # pre-existing (unmodified) _symbol_children, which legitimately emits
    # real "contains" edges backed by real parent_symbol_id containment --
    # not something this remediation introduces. Confirm the edges are
    # exactly that (real ids, "contains" kind), not anything fabricated.
    for edge in method_children["edges"]:
        assert edge["kind"] == "contains"
        assert edge["source"] in real_symbol_ids
        assert edge["target"] in real_symbol_ids
    method_labels = {c["label"] for c in method_children["children"]}
    assert "create_order" in method_labels
    create_order_node = next(c for c in method_children["children"] if c["label"] == "create_order")
    assert create_order_node["id"] in real_symbol_ids


def test_structural_fallback_activates_for_a_genuinely_empty_projection(tmp_path: Path) -> None:
    """Direct test of Part A's own mechanism: construct an
    ArchitectureMapProjector around a SystemOverview with
    main_components=() (the literal activation condition -- "the normal
    map has no meaningful child navigation despite analyzed source
    entities existing") against REAL persisted symbols from a real
    analysis run, and prove the deterministic package -> module ->
    symbol fallback reaches OrderService.create_order with real ids and
    zero fabricated edges. This is what actually runs whenever
    SystemOverviewGenerator's own deterministic fallback
    (build_static_structure) is ALSO unable to find any components --
    Part A is independent defense-in-depth, not conditional on Part B."""
    from syntax_tree_refurbished.app.architecture_map.projection import ArchitectureMapProjector
    from syntax_tree_refurbished.app.investigation.llm_model import NoConfiguredModel
    from syntax_tree_refurbished.core.models.system_overview import SystemOverview, SystemOverviewMetrics

    write_python_app_shaped_fixture(tmp_path)
    app, run_id, client = analyzed_app(tmp_path)  # NoConfiguredModel; real analysis, real persisted symbols
    job = app.state.run_store.get_run(run_id)
    assert job is not None and job.snapshot is not None

    empty_overview = SystemOverview(
        id="overview:forced-empty",
        analysis_run_id=run_id,
        input_hash="forced-empty",
        status="degraded_no_llm",
        repo_identity={"name": "forced-empty"},
        repo_shape={"kind": "unknown", "label": "Unknown", "confidence": 0.0, "support_status": "not_inspected"},
        summary="Forced-empty overview for a direct Part A unit test.",
        main_components=(),
        relationships=(),
        semantic_anchors=(),
        important_files=(),
        important_regions=(),
        claims=(),
        orientation_notes=(),
        gaps=(),
        suggested_questions=(),
        suggested_lenses=(),
        investigation_summaries=(),
        metrics=SystemOverviewMetrics(
            cached=False, llm_used=False, model="none", latency_ms=0, tool_calls=0,
            regions_returned=0, tokens_in=0, tokens_out=0, input_hash="forced-empty",
            generation_mode="no_model",
        ),
    )
    projector = ArchitectureMapProjector(job=job, store=app.state.run_store, overview=empty_overview, model=NoConfiguredModel())

    root = projector.project().root
    assert root.children_count > 0
    assert root.can_drilldown is True

    # Part A itself (root/package/module levels) never emits edges --
    # containment there is expressed by tree structure only. See
    # structural_fallback.py's module docstring/root_children/
    # package_children/module_children (all return `()` edges).
    root_children, root_edges = projector.children(root.id)
    assert len(root_children) > 0
    assert root_edges == ()  # no fabricated relation
    package_kinds = {n.kind for n in root_children}
    assert package_kinds <= {"structural_package", "structural_module"}

    services_package = next((n for n in root_children if n.label == "services"), None)
    assert services_package is not None, f"expected a 'services' package node, got labels={[n.label for n in root_children]}"
    assert services_package.kind == "structural_package"

    package_children, package_edges = projector.children(services_package.id)
    assert package_edges == ()
    module_labels = {n.label for n in package_children}
    assert "order_service.py" in module_labels
    order_service_module = next(n for n in package_children if n.label == "order_service.py")
    assert order_service_module.kind == "structural_module"

    module_children, module_edges = projector.children(order_service_module.id)
    assert module_edges == ()
    real_symbol_ids = {s.id for s in app.state.run_store.get_symbols(run_id)}
    class_labels = {n.label for n in module_children}
    assert "OrderService" in class_labels
    order_service_class = next(n for n in module_children if n.label == "OrderService")
    assert order_service_class.id in real_symbol_ids  # real persisted id, not synthetic

    # Below the module level, order_service_class.id is a REAL symbol id,
    # so children() now dispatches to the pre-existing (unmodified)
    # _symbol_children, which legitimately emits real "contains" edges for
    # real parent_symbol_id containment -- not part of Part A, and not
    # fabricated (every edge endpoint is a real persisted symbol id).
    method_children, method_edges = projector.children(order_service_class.id)
    for edge in method_edges:
        assert edge.kind == "contains"
        assert edge.source in real_symbol_ids
        assert edge.target in real_symbol_ids
    method_labels = {n.label for n in method_children}
    assert "create_order" in method_labels
    create_order = next(n for n in method_children if n.label == "create_order")
    assert create_order.id in real_symbol_ids
    assert create_order.can_drilldown is False  # a true leaf (no nested methods)

    # projector.node() must also resolve every fallback id directly
    # (required by the /children route's own "if not projector.node(id):
    # 404" guard) -- not just via children() traversal.
    assert projector.node(services_package.id) is not None
    assert projector.node(order_service_module.id) is not None


# ---------------------------------------------------------------------------
# Requirement 7: the ACTUAL canonical fixture (not a re-creation) exposes
# OrderService.create_order via the normal /children API.
# ---------------------------------------------------------------------------


def test_canonical_fixture_exposes_order_service_create_order() -> None:
    canonical = Path(__file__).resolve().parents[2] / "research" / "provenance-evaluation" / "fixtures" / "python_app"
    assert canonical.is_dir(), f"canonical fixture not found at {canonical}"
    app, run_id, client = analyzed_app(canonical, investigation_model=AlwaysFailingModel())

    order_service_node = _drill_to_label(client, run_id, "OrderService")
    assert order_service_node is not None, "OrderService must be reachable via the normal UI navigation API"
    children = client.get(f"/api/architecture-map/nodes/{order_service_node['id']}/children?run_id={run_id}").json()
    labels = {c["label"] for c in children["children"]}
    assert "create_order" in labels

    create_order_node = next(c for c in children["children"] if c["label"] == "create_order")
    # The real entity id must work, unmodified, with the actual
    # provenance-based Architectural Explanation endpoint (requirement 9:
    # this endpoint itself is untouched by this remediation).
    real_symbol_ids = {s["id"] for s in client.get(f"/api/runs/{run_id}/symbols").json()["symbols"]}
    assert create_order_node["id"] in real_symbol_ids


def _drill_to_label(client: TestClient, run_id: str, target_label: str, max_depth: int = 6):
    """Mirrors how the real UI actually reaches a node: the top-level
    map response already contains root + every top-level node (real
    components OR, when the map is genuinely degenerate, just the root
    alone) -- those are all simultaneously visible/clickable on the
    canvas, not reached via a `/children` call on the root's own id.
    `/children` is only used to go one level deeper than something
    already known. Starting the search from `nodes` (not `[root_id]`)
    is what makes this helper behave like a real user clicking around,
    rather than assuming a specific internal API shape."""
    map_body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    for node in map_body["nodes"]:
        if node["label"] == target_label:
            return node
    frontier = [node["id"] for node in map_body["nodes"]]
    seen = set()
    for _ in range(max_depth):
        next_frontier = []
        for node_id in frontier:
            if node_id in seen:
                continue
            seen.add(node_id)
            children = client.get(f"/api/architecture-map/nodes/{node_id}/children?run_id={run_id}").json()["children"]
            for child in children:
                if child["label"] == target_label:
                    return child
                next_frontier.append(child["id"])
        if not next_frontier:
            return None
        frontier = next_frontier
    return None


# ---------------------------------------------------------------------------
# Part B, requirement 8: the legacy Simple explanation path never surfaces
# the stale provider error in normal conditions.
# ---------------------------------------------------------------------------


def test_legacy_explanation_never_leaks_raw_provider_error(tmp_path: Path) -> None:
    write_python_app_shaped_fixture(tmp_path)
    failing_model = AlwaysFailingModel()
    app, run_id, client = analyzed_app(tmp_path, investigation_model=failing_model)

    root_id = client.get(f"/api/architecture-map?run_id={run_id}").json()["root"]["id"]
    explanation = client.get(f"/api/architecture-map/nodes/{root_id}/explanation?run_id={run_id}").json()

    rendered = " ".join(
        [explanation.get("summary", ""), explanation.get("simple_explanation", ""), *explanation.get("gaps", []), *explanation.get("warnings", [])]
    )
    assert "HTTP error 400" not in rendered
    assert "blackboxai/anthropic/claude-sonnet-4.6" not in rendered
    assert failing_model.calls >= 1  # a real attempt was made, not silently skipped


def test_no_llm_overview_still_renders_verified_static_source_map_unchanged(tmp_path: Path) -> None:
    """Requirement: the existing, already-tested NoConfiguredModel
    (genuinely unconfigured) path is completely unaffected by the Part B
    change, which only applies to the "configured but failing" branch."""
    write(tmp_path / "app.py", "@app.get('/health')\ndef health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)  # no investigation_model injected -> NoConfiguredModel

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    assert body["diagnostics"]["repo_shape"] == "static_module_graph"
    assert any(node["label"] == "app.py" for node in body["nodes"])


# ---------------------------------------------------------------------------
# Requirement 9: provenance-based architectural-explanation behavior is
# untouched (existing test suites already cover this in full; this is a
# direct, additional confirmation using a fallback-reached entity id).
# ---------------------------------------------------------------------------


def test_provenance_explanation_endpoint_works_unchanged_for_a_fallback_reached_entity(tmp_path: Path) -> None:
    write_python_app_shaped_fixture(tmp_path)
    app, run_id, client = analyzed_app(tmp_path, investigation_model=AlwaysFailingModel())
    order_service_node = _drill_to_label(client, run_id, "OrderService")
    assert order_service_node is not None
    children = client.get(f"/api/architecture-map/nodes/{order_service_node['id']}/children?run_id={run_id}").json()
    create_order_node = next(c for c in children["children"] if c["label"] == "create_order")

    # NullClaimProposer (no arch-explanation LLM configured in this test
    # app) -> zero claims, never an error -- proves the entity id is
    # accepted by the untouched provenance endpoint.
    response = client.post(
        f"/api/entities/{create_order_node['id']}/claims", json=None, params={"run_id": run_id}
    )
    assert response.status_code == 200
    assert response.json()["claims"] == []


def _httpx_replies() -> list[dict[str, Any]]:
    return [
        {
            "final": {
                "summary": "HTTPX client library.",
                "simple_explanation": "A small HTTP client.",
                "technical_explanation": "Public API wraps a Client.",
                "repo_shape": {"kind": "python_http_client_library", "label": "HTTP client", "confidence": 0.9, "support_status": "verified"},
                "component_hypotheses": [
                    {"label": "Public Request API", "source_region_ids": []},
                    {"label": "Client Lifecycle", "source_region_ids": []},
                    {"label": "Auth And Cookies", "source_region_ids": []},
                ],
            }
        }
    ]
