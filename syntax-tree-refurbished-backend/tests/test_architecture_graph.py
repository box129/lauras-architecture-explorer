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
    assert api["direct_member_module_ids"] and api["direct_child_group_ids"] == []
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
    residuals = [group for group in body["groups"] if group["kind"] == "relation_residual"]
    assert len(residuals) == 1 and len(residuals[0]["direct_member_module_ids"]) == 1
    assert not [edge for edge in body["aggregate_edges"] if edge["source_group_id"] == clusters[0]["id"] and edge["target_group_id"] == clusters[0]["id"]]

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
