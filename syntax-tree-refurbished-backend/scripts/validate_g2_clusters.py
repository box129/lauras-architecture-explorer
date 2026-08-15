"""Emit deterministic G2B clustering diagnostics for local repositories.

Usage: uv run --isolated --with fastapi --with httpx python scripts/validate_g2_clusters.py PATH [...]
No LLM configuration or production cluster semantics are used or changed.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.analysis.static_structure import module_component_id
from syntax_tree_refurbished.app.architecture_clusters.projection import (
    ArchitectureClusterProjector,
    _bridge_separated_components,
)
from syntax_tree_refurbished.app.architecture_map.structural_fallback import (
    build_containment_hierarchy,
)
from syntax_tree_refurbished.config import Settings


def _resolved_region_relations(store, run_id, module_ids, symbol_modules):
    return [
        relation
        for relation in store.get_relations(run_id)
        if relation.resolution_status == "resolved"
        and relation.target_entity_id
        and symbol_modules.get(relation.source_entity_id) in module_ids
        and symbol_modules.get(relation.target_entity_id) in module_ids
        and symbol_modules[relation.source_entity_id] != symbol_modules[relation.target_entity_id]
    ]


def _plain_components(vertices, edges):
    adjacency = {vertex: set() for vertex in vertices}
    for left, right in edges:
        adjacency[left].add(right)
        adjacency[right].add(left)
    seen, result = set(), []
    for start in sorted(vertices):
        if start in seen:
            continue
        component, stack = set(), [start]
        while stack:
            vertex = stack.pop()
            if vertex in seen:
                continue
            seen.add(vertex)
            component.add(vertex)
            stack.extend(sorted(adjacency[vertex], reverse=True))
        result.append(component)
    return result


def _region_report(group, modules, relations, projection, symbol_modules):
    pairs = {
        tuple(sorted((symbol_modules[value.source_entity_id], symbol_modules[value.target_entity_id])))
        for value in relations
    }
    components = _bridge_separated_components(tuple(sorted(modules)), pairs)
    plain_components = _plain_components(tuple(sorted(modules)), pairs)
    bridge_count = sum(
        1
        for left, right in pairs
        if not any(left in component and right in component for component in components)
    )
    clusters = [cluster for cluster in projection.clusters if cluster.containing_structural_group_id == group.id]
    residual = next(value for value in projection.residuals if value.containing_structural_group_id == group.id)
    cluster_details = []
    for cluster in clusters:
        members = set(cluster.member_module_ids)
        internal_pairs = {pair for pair in pairs if set(pair) <= members}
        boundary_pairs = {pair for pair in pairs if bool(set(pair) & members) and not set(pair) <= members}
        cluster_details.append(
            {
                "id": cluster.id,
                "display_name": cluster.display_name,
                "members": list(cluster.member_module_ids),
                "internal_relation_count": cluster.internal_relation_count,
                "internal_relation_kind_counts": dict(cluster.internal_relation_kind_counts),
                "boundary_relation_count": cluster.boundary_relation_count,
                "internal_pair_count": len(internal_pairs),
                "density": len(internal_pairs) / (len(members) * (len(members) - 1) / 2),
                "boundary_pair_count": len(boundary_pairs),
                "boundary_ratio": len(boundary_pairs) / (len(internal_pairs) + len(boundary_pairs)) if internal_pairs or boundary_pairs else 0,
            }
        )
    cc_sizes = sorted((len(component) for component in components), reverse=True)
    clustered = sum(cluster.member_count for cluster in clusters)
    return {
        "structural_path": group.graph_qn or group.label,
        "group_id": group.id,
        "direct_module_count": len(modules),
        "participating_module_count": len({symbol_modules[r.source_entity_id] for r in relations} | {symbol_modules[r.target_entity_id] for r in relations}),
        "resolved_internal_relation_records": len(relations),
        "distinct_internal_module_pairs": len(pairs),
        "relation_kind_counts": dict(sorted(Counter(r.relation_kind for r in relations).items())),
        "connected_component_sizes": cc_sizes,
        "bridge_count": bridge_count,
        "cluster_count": len(clusters),
        "cluster_sizes": [cluster.member_count for cluster in clusters],
        "residual_count": len(residual.member_module_ids),
        "residual_member_reasons": dict(residual.member_reasons),
        "clustered_module_coverage": clustered / len(modules),
        "relation_participation_coverage": clustered / len({module for pair in pairs for module in pair}) if pairs else 0,
        "clusters": cluster_details,
        "cluster_edges": [edge.__dict__ for edge in projection.cluster_edges if edge.source_cluster_id in {c.id for c in clusters}],
        "connected_components_baseline": {
            "count": len(plain_components),
            "sizes": sorted((len(component) for component in plain_components), reverse=True),
        },
    }


def analyze(path: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    run_id = client.post("/api/analyze", json={"repository_path": str(path.resolve())}).json()["run_id"]
    store = app.state.run_store
    job, overview = store.get_run(run_id), store.get_system_overview(run_id)
    projection = ArchitectureClusterProjector(job=job, store=store, overview=overview).project()
    repeated = ArchitectureClusterProjector(job=job, store=store, overview=overview).project()
    hierarchy = build_containment_hierarchy(run_id, overview.main_components)
    symbol_modules = {symbol.id: module_component_id(run_id, symbol.path) for symbol in store.get_symbols(run_id)}
    regions = []
    if hierarchy:
        for group_id, members in sorted(hierarchy.leaf_members_by_id.items()):
            if len(members) >= 3:
                group = next(value for value in hierarchy.all_nodes if value.id == group_id)
                modules = {member.id for member in members}
                regions.append(_region_report(group, modules, _resolved_region_relations(store, run_id, modules, symbol_modules), projection, symbol_modules))
    relation_counts = Counter(
        f"{relation.resolution_status}:{relation.relation_kind}"
        for relation in store.get_relations(run_id)
    )
    return {
        "repository": str(path),
        "run_id": run_id,
        "source_files_discovered": len(job.snapshot.files) if job.snapshot else 0,
        "parsed_entities": len(store.get_symbols(run_id)),
        "module_components": len(overview.main_components),
        "persisted_relation_counts": dict(sorted(relation_counts.items())),
        "repeated_projection_identical": projection == repeated,
        "regions": regions,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Provide one or more repository paths")
    print(json.dumps([analyze(Path(value)) for value in sys.argv[1:]], indent=2, default=list))
