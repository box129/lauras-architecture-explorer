"""G2A deterministic relation-cluster contract tests."""
from __future__ import annotations

from pathlib import Path
from time import perf_counter

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.architecture_clusters.projection import (
    ArchitectureClusterProjector,
    _bridge_separated_components,
)
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation


def _write(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("def item():\n    return 1\n", encoding="utf-8")


def _prepared(tmp_path: Path, count: int = 7):
    # A second root section makes the deterministic containment hierarchy eligible.
    for index in range(count):
        _write(tmp_path / "services" / f"m{index}.py")
    _write(tmp_path / "api" / "entry.py")
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    run_id = client.post("/api/analyze", json={"repository_path": str(tmp_path)}).json()["run_id"]
    symbols = {symbol.path: symbol for symbol in app.state.run_store.get_symbols(run_id) if not symbol.parent_symbol_id}
    return app, run_id, [symbols[f"services/m{index}.py"] for index in range(count)]


def _relation(run_id, source, target, kind="calls", status="resolved", line=1):
    kwargs = {
        "run_id": run_id,
        "relation_kind": kind,
        "source_entity_id": source.id,
        "extractor_name": "test",
        "extractor_version": "1",
        "resolution_status": status,
    }
    if status == "resolved":
        kwargs.update(target_entity_id=target.id, span_path=source.path, span_start_line=line, span_end_line=line)
    elif status == "partial":
        kwargs.update(target_entity_id=target.id, target_reference=target.name, confidence=.5)
    else:
        kwargs.update(target_reference=target.name, confidence=.5)
    return ObservedProgramRelation.create(**kwargs)


def _project(app, run_id):
    job = app.state.run_store.get_run(run_id)
    overview = app.state.run_store.get_system_overview(run_id)
    return ArchitectureClusterProjector(job=job, store=app.state.run_store, overview=overview).project()


def test_resolved_only_two_cores_boundary_and_determinism(tmp_path: Path):
    app, run_id, symbols = _prepared(tmp_path)
    relations = []
    # Two triangles, joined by one known cross-community relation; m6 is isolated.
    for left, right, kind in ((0, 1, "calls"), (1, 2, "inherits"), (2, 0, "calls"), (3, 4, "calls"), (4, 5, "calls"), (5, 3, "inherits"), (2, 3, "calls")):
        relations.append(_relation(run_id, symbols[left], symbols[right], kind, line=len(relations) + 1))
    relations += [_relation(run_id, symbols[0], symbols[1], status="partial"), _relation(run_id, symbols[0], symbols[1], status="unresolved")]
    app.state.run_store.put_relations(run_id, tuple(reversed(relations)))
    first, second = _project(app, run_id), _project(app, run_id)
    assert first == second
    assert first.schema_version == "architecture-clusters/v1"
    assert len(first.clusters) == 2
    assert [cluster.display_name for cluster in first.clusters] == ["Structural cluster 1", "Structural cluster 2"]
    assert [cluster.member_count for cluster in first.clusters] == [3, 3]
    assert all(cluster.algorithm.endswith("/v1") for cluster in first.clusters)
    assert {kind for cluster in first.clusters for kind, _ in cluster.internal_relation_kind_counts} == {"calls", "inherits"}
    assert sum(cluster.boundary_relation_count for cluster in first.clusters) == 2
    residual = next(value for value in first.residuals if value.member_module_ids)
    assert len(residual.member_module_ids) == 1 and residual.member_reasons[0][1] == "no_internal_resolved_relation"
    assert len(first.cluster_edges) == 1
    assert first.cluster_edges[0].relation_kind == "calls"
    assert first.cluster_edges[0].member_relation_count == 1


def test_hub_disconnected_sparse_and_small_regions_do_not_force_clusters(tmp_path: Path):
    app, run_id, symbols = _prepared(tmp_path, 5)
    # A star is bridge-only; disconnected and sparse pairs are not invented into communities.
    relations = tuple(_relation(run_id, symbols[0], symbols[index], line=index) for index in range(1, 5))
    app.state.run_store.put_relations(run_id, relations)
    result = _project(app, run_id)
    service_residual = next(value for value in result.residuals if len(value.member_module_ids) == 5)
    assert not result.clusters
    assert service_residual.reason == "insufficient_relation_core"
    assert all(reason == "no_useful_non_bridge_relation_core" for _, reason in service_residual.member_reasons)
    assert any(value.reason == "region_too_small" for value in result.residuals)
    assert _bridge_separated_components(("a", "b"), {("a", "b")}) == [{"a"}, {"b"}]
    assert _bridge_separated_components(("a", "b", "c"), set()) == [{"a"}, {"b"}, {"c"}]


def test_input_order_ids_and_relation_counts_are_stable(tmp_path: Path):
    app, run_id, symbols = _prepared(tmp_path, 3)
    relations = [_relation(run_id, symbols[0], symbols[1], "calls", line=1), _relation(run_id, symbols[1], symbols[2], "inherits", line=2), _relation(run_id, symbols[2], symbols[0], "calls", line=3)]
    app.state.run_store.put_relations(run_id, tuple(relations))
    ordered = _project(app, run_id)
    app.state.run_store.put_relations(run_id, tuple(reversed(relations)))
    reversed_result = _project(app, run_id)
    assert ordered == reversed_result
    cluster = ordered.clusters[0]
    assert cluster.internal_relation_count == 3
    assert cluster.internal_relation_kind_counts == (("calls", 2), ("inherits", 1))
    assert cluster.id == reversed_result.clusters[0].id


def test_clustering_scale_smoke_20_200_2000():
    timings = []
    for count in (20, 200, 2_000):
        vertices = tuple(f"m{index:04d}" for index in range(count))
        # Disjoint triangles: realistic enough to exercise a resolved relation-rich topology.
        edges = {(vertices[index], vertices[index + 1]) for index in range(0, count - 2, 3)} | {(vertices[index + 1], vertices[index + 2]) for index in range(0, count - 2, 3)} | {(vertices[index], vertices[index + 2]) for index in range(0, count - 2, 3)}
        started = perf_counter(); components = _bridge_separated_components(vertices, edges); timings.append(perf_counter() - started)
        assert sum(len(component) for component in components) == count
    assert all(value < 5 for value in timings)
