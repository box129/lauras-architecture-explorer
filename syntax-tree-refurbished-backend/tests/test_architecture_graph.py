"""G0 deterministic architecture graph contract tests."""
from pathlib import Path
from time import perf_counter
from fastapi.testclient import TestClient
from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.app.architecture_graph.projection import visible_representative
from syntax_tree_refurbished.app.architecture_map.structural_fallback import build_containment_hierarchy
from syntax_tree_refurbished.core.models.system_overview import OverviewComponent

def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

def _ready(repo: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    run_id = client.post("/api/analyze", json={"repository_path": str(repo)}).json()["run_id"]
    return app, client, run_id

def test_graph_resolved_only_aggregation_membership_and_legacy_compatibility(tmp_path: Path) -> None:
    _write(tmp_path / "api" / "a.py", "def a():\n return 1\n")
    _write(tmp_path / "services" / "b.py", "def b():\n return 2\n")
    _write(tmp_path / "services" / "d.py", "def d():\n return 4\n")
    _write(tmp_path / "models" / "c.py", "class C:\n pass\n")
    app, client, run_id = _ready(tmp_path)
    symbols = {symbol.path: symbol for symbol in app.state.run_store.get_symbols(run_id) if not symbol.parent_symbol_id}
    a, b, c, d = symbols["api/a.py"], symbols["services/b.py"], symbols["models/c.py"], symbols["services/d.py"]
    resolved_a = ObservedProgramRelation.create(run_id=run_id, relation_kind="calls", source_entity_id=a.id, target_entity_id=b.id, extractor_name="test", extractor_version="1", resolution_status="resolved", span_path=a.path, span_start_line=1, span_end_line=1)
    resolved_b = ObservedProgramRelation.create(run_id=run_id, relation_kind="calls", source_entity_id=a.id, target_entity_id=b.id, extractor_name="test", extractor_version="1", resolution_status="resolved", span_path=a.path, span_start_line=2, span_end_line=2)
    inherits = ObservedProgramRelation.create(run_id=run_id, relation_kind="inherits", source_entity_id=c.id, target_entity_id=b.id, extractor_name="test", extractor_version="1", resolution_status="resolved", span_path=c.path, span_start_line=1, span_end_line=1)
    partial = ObservedProgramRelation.create(run_id=run_id, relation_kind="calls", source_entity_id=a.id, target_entity_id=b.id, target_reference="b", extractor_name="test", extractor_version="1", resolution_status="partial", confidence=0.4)
    unresolved = ObservedProgramRelation.create(run_id=run_id, relation_kind="calls", source_entity_id=a.id, target_reference="external", extractor_name="test", extractor_version="1", resolution_status="unresolved", confidence=0.2)
    internal = ObservedProgramRelation.create(run_id=run_id, relation_kind="calls", source_entity_id=b.id, target_entity_id=d.id, extractor_name="test", extractor_version="1", resolution_status="resolved", span_path=b.path, span_start_line=1, span_end_line=1)
    app.state.run_store.put_relations(run_id, (resolved_a, resolved_b, inherits, partial, unresolved, internal))
    graph = client.get(f"/api/architecture-graph?run_id={run_id}")
    assert graph.status_code == 200
    body = graph.json()
    assert body["schema_version"] == "architecture-graph/v2"
    api = next(group for group in body["groups"] if group["label"] == "api")
    # "api" has 1 module (a.py) and zero *internal* resolved relations (its
    # only relations are cross-region, to services/b.py), so it is below
    # MIN_CLUSTER_MEMBERS and gets a residual+module child, not an empty
    # region -- the single-module dead-end fix (see
    # test_graph_attaches_residual_module_for_region_with_no_clusters).
    assert api["direct_member_module_ids"] and api["direct_child_group_ids"]
    api_residuals = [group for group in body["groups"] if group["kind"] == "relation_residual" and group["parent_group_id"] == api["id"]]
    assert len(api_residuals) == 1
    assert [group for group in body["groups"] if group["kind"] == "module" and group["parent_group_id"] == api_residuals[0]["id"]]
    calls = [edge for edge in body["aggregate_edges"] if edge["relation_kind"] == "calls"]
    assert len(calls) == 1 and calls[0]["member_relation_count"] == 2
    assert calls[0]["distinct_member_pair_count"] == 1
    assert calls[0]["contributing_relation_count"] == 2
    assert len(calls[0]["relation_ids_preview"]) == 2
    assert {edge["relation_kind"] for edge in body["aggregate_edges"]} == {"calls", "inherits"}
    services = next(group for group in body["groups"] if group["label"] == "services")
    assert {"group_id": services["id"], "relation_kind": "calls", "member_relation_count": 1} in body["internal_relation_counts"]
    assert client.get(f"/api/architecture-map?run_id={run_id}").status_code == 200

def test_visible_representative_is_nearest_collapsed_ancestor() -> None:
    parents = {"region": None, "area": "region", "leaf": "area", "other": None}
    assert visible_representative("leaf", parents, set()) == "leaf"
    assert visible_representative("leaf", parents, {"area"}) == "area"
    assert visible_representative("leaf", parents, {"region", "area"}) == "area"
    assert visible_representative("other", parents, {"area"}) == "other"

def test_graph_projects_g2_cluster_membership_and_preserves_zero_cluster_regions(tmp_path: Path) -> None:
    """G3 consumes the G2 projection; it does not re-cluster graph data."""
    for name in ("a", "b", "c", "lonely"):
        _write(tmp_path / "services" / f"{name}.py", f"def {name}():\n return 1\n")
    _write(tmp_path / "api" / "entry.py", "def entry():\n return 1\n")
    app, client, run_id = _ready(tmp_path)
    symbols = {symbol.path: symbol for symbol in app.state.run_store.get_symbols(run_id) if not symbol.parent_symbol_id}
    def resolved(source: str, target: str):
        return ObservedProgramRelation.create(run_id=run_id, relation_kind="calls", source_entity_id=symbols[source].id, target_entity_id=symbols[target].id, extractor_name="test", extractor_version="1", resolution_status="resolved", span_path=source, span_start_line=1, span_end_line=1)
    # A triangle is a non-bridge core; lonely.py remains the G2 residual.
    app.state.run_store.put_relations(run_id, (resolved("services/a.py", "services/b.py"), resolved("services/b.py", "services/c.py"), resolved("services/c.py", "services/a.py")))
    body = client.get(f"/api/architecture-graph?run_id={run_id}").json()
    clusters = [group for group in body["groups"] if group["kind"] == "relation_cluster"]
    assert len(clusters) == 1
    assert clusters[0]["label"] == "Structural cluster 1"
    assert len(clusters[0]["direct_member_module_ids"]) == 3
    services = next(group for group in body["groups"] if group["label"] == "services")
    api = next(group for group in body["groups"] if group["label"] == "api")
    residuals = [group for group in body["groups"] if group["kind"] == "relation_residual"]
    # "services" (4 modules, 1 accepted cluster) keeps its lonely.py residual
    # alongside the cluster. "api" (1 module, no clusters at all) previously
    # never appeared here because the old projection only attached residuals
    # for regions that also produced a cluster -- the single-module dead-end
    # bug. Both residuals must be present now.
    services_residual = next(group for group in residuals if group["parent_group_id"] == services["id"])
    api_residual = next(group for group in residuals if group["parent_group_id"] == api["id"])
    assert len(residuals) == 2
    assert len(services_residual["direct_member_module_ids"]) == 1
    assert len(api_residual["direct_member_module_ids"]) == 1
    assert not [edge for edge in body["aggregate_edges"] if edge["source_group_id"] == clusters[0]["id"] and edge["target_group_id"] == clusters[0]["id"]]

def test_graph_attaches_residual_module_for_region_with_no_clusters(tmp_path: Path) -> None:
    """A leaf region below MIN_CLUSTER_MEMBERS (or with no internal relations)
    still gets a residual group with its real module attached, even though it
    never contributes to clusters_by_region. Reproduces the live-audit defect
    where entering such a region (e.g. a single-module "docs" folder) showed
    0 modules / 0 regions / 0 relations despite the parent card correctly
    reporting 1 module."""
    _write(tmp_path / "docs" / "conf.py", "def setup():\n return 1\n")
    for name in ("a", "b", "c"):
        _write(tmp_path / "services" / f"{name}.py", f"def {name}():\n return 1\n")
    app, client, run_id = _ready(tmp_path)
    symbols = {symbol.path: symbol for symbol in app.state.run_store.get_symbols(run_id) if not symbol.parent_symbol_id}
    def resolved(source: str, target: str):
        return ObservedProgramRelation.create(run_id=run_id, relation_kind="calls", source_entity_id=symbols[source].id, target_entity_id=symbols[target].id, extractor_name="test", extractor_version="1", resolution_status="resolved", span_path=source, span_start_line=1, span_end_line=1)
    # Give "services" an accepted cluster so clusters_by_region is non-empty
    # for it, while "docs" (1 module, no relations at all) never produces a
    # cluster and previously never appeared in clusters_by_region's keys.
    app.state.run_store.put_relations(run_id, (resolved("services/a.py", "services/b.py"), resolved("services/b.py", "services/c.py"), resolved("services/c.py", "services/a.py")))
    body = client.get(f"/api/architecture-graph?run_id={run_id}").json()
    docs_region = next(group for group in body["groups"] if group["label"] == "docs")
    assert docs_region["recursive_module_count"] == 1
    assert docs_region["direct_child_group_ids"], "docs region has a module but zero children -- the dead-end reproduction"
    docs_residuals = [group for group in body["groups"] if group["kind"] == "relation_residual" and group["parent_group_id"] == docs_region["id"]]
    assert len(docs_residuals) == 1
    docs_modules = [group for group in body["groups"] if group["kind"] == "module" and group["parent_group_id"] == docs_residuals[0]["id"]]
    assert len(docs_modules) == 1
    assert docs_modules[0]["label"] == "conf.py" or docs_modules[0]["label"].endswith("conf.py")

def test_graph_does_not_wrap_multi_module_zero_cluster_region_in_residual(tmp_path: Path) -> None:
    """Accepted G3 policy: a region with >= MIN_CLUSTER_MEMBERS modules but
    zero useful recovered clusters keeps plain G1 structural/module
    presentation -- its modules attach directly to the region, not inside a
    synthetic "Unclustered by recovered relations" wrapper. That framing
    belongs only to (a) a genuine complement of an accepted cluster in the
    same region, or (b) a region below MIN_CLUSTER_MEMBERS that was never
    eligible for clustering at all (the single-module dead-end exception).
    Reproduces a live-audit regression where the dead-end fix accidentally
    wrapped every zero-cluster region, including large ones with no
    clustering language justification at all (e.g. Tenacity's 10-module,
    zero-relation "tenacity (direct files)" region)."""
    for name in ("a", "b", "c", "d", "e"):
        _write(tmp_path / "lib" / f"{name}.py", f"def {name}():\n return 1\n")
    # A repository-root partition needs >= 2 sections for
    # build_containment_hierarchy to activate at all (otherwise it returns
    # None and the caller flat-degrades) -- a second top-level directory is
    # required for "lib" to be grouped as its own structural region.
    _write(tmp_path / "other" / "z.py", "def z():\n return 1\n")
    app, client, run_id = _ready(tmp_path)
    # No relations at all are recorded for "lib" -- 5 modules, 0 internal
    # resolved relations, well above MIN_CLUSTER_MEMBERS but nothing to
    # cluster from ("no_internal_resolved_relations").
    body = client.get(f"/api/architecture-graph?run_id={run_id}").json()
    lib = next(group for group in body["groups"] if group["label"] == "lib")
    assert lib["recursive_module_count"] == 5
    assert not [group for group in body["groups"] if group["kind"] == "relation_cluster" and group["parent_group_id"] == lib["id"]]
    assert not [group for group in body["groups"] if group["kind"] == "relation_residual" and group["parent_group_id"] == lib["id"]]
    lib_modules = [group for group in body["groups"] if group["kind"] == "module" and group["parent_group_id"] == lib["id"]]
    assert len(lib_modules) == 5
    assert set(lib["direct_child_group_ids"]) == {module["id"] for module in lib_modules}

def test_structural_graph_scale_smoke_20_200_2000() -> None:
    """Collapsed graph foundation must remain bounded before any leaf rendering."""
    timings = []
    for count in (20, 200, 2_000):
        components = tuple(OverviewComponent(f"module:{index}", f"region-{index % 20}/module-{index}.py", "module", "", (), (), (), (), "verified", 0.98) for index in range(count))
        started = perf_counter()
        hierarchy = build_containment_hierarchy("run:scale", components)
        timings.append(perf_counter() - started)
        assert hierarchy is not None
        assert sum(1 for node in hierarchy.all_nodes if node.parent_group_id is None) == 20
    # This is intentionally a smoke bound rather than a benchmark threshold.
    assert all(value < 5 for value in timings)
