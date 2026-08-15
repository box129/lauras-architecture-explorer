"""Resolved-only, deterministic relation clustering for structural leaf regions."""
from __future__ import annotations

import hashlib
from collections import Counter, defaultdict

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.analysis.static_structure import module_component_id
from syntax_tree_refurbished.app.architecture_map import structural_fallback
from syntax_tree_refurbished.core.models.architecture_cluster import (
    ARCHITECTURE_CLUSTER_SCHEMA_VERSION,
    CLUSTER_ALGORITHM,
    ArchitectureClusterEdge,
    ArchitectureClusterProjection,
    ArchitectureClusterResidual,
    ArchitectureRelationCluster,
)
from syntax_tree_refurbished.core.models.system_overview import SystemOverview

MIN_CLUSTER_MEMBERS = 3


def _id(*parts: str) -> str:
    return "architecture-cluster:" + hashlib.sha1("|".join(parts).encode()).hexdigest()[:24]


class ArchitectureClusterProjector:
    """Derives only relation cores within *leaf* structural groups.

    The undirected affinity topology has one edge per distinct resolved module pair.
    We remove graph bridges, then retain components with at least three modules.  This
    prevents a single connector relation (and star hubs) from manufacturing a cluster.
    All persisted resolved relations remain available as directed, per-kind provenance.
    """
    def __init__(self, *, job: AnalysisJob, store: InMemoryRunStore, overview: SystemOverview):
        self._job, self._store, self._overview = job, store, overview

    def project(self) -> ArchitectureClusterProjection:
        hierarchy = structural_fallback.build_containment_hierarchy(self._job.run_id, self._overview.main_components)
        if hierarchy is None:
            return ArchitectureClusterProjection(ARCHITECTURE_CLUSTER_SCHEMA_VERSION, self._job.run_id, CLUSTER_ALGORITHM, (), (), ())
        symbol_modules = {
            symbol.id: module_component_id(self._job.run_id, symbol.path)
            for symbol in self._store.get_symbols(self._job.run_id)
        }
        clusters, residuals = [], []
        for group_id, members in sorted(hierarchy.leaf_members_by_id.items()):
            result = self._cluster_region(group_id, tuple(sorted(member.id for member in members)), symbol_modules)
            clusters.extend(result[0]); residuals.append(result[1])
        clusters.sort(key=lambda value: (value.containing_structural_group_id, value.member_module_ids))
        # Display identity is ordering-only and is intentionally excluded from stable ids.
        clusters = [
            ArchitectureRelationCluster(**{**cluster.__dict__, "display_name": f"Structural cluster {index}"})
            for index, cluster in enumerate(clusters, 1)
        ]
        return ArchitectureClusterProjection(ARCHITECTURE_CLUSTER_SCHEMA_VERSION, self._job.run_id, CLUSTER_ALGORITHM, tuple(clusters), tuple(residuals), tuple(self._cluster_edges(clusters, symbol_modules)))

    def _cluster_region(self, group_id: str, modules: tuple[str, ...], symbol_modules: dict[str, str]):
        module_set = set(modules)
        if len(modules) < MIN_CLUSTER_MEMBERS:
            return [], ArchitectureClusterResidual(group_id, modules, "region_too_small", tuple((module, "region_too_small") for module in modules))
        relations = [
            relation for relation in self._store.get_relations(self._job.run_id)
            if relation.resolution_status == "resolved" and relation.target_entity_id
            and symbol_modules.get(relation.source_entity_id) in module_set
            and symbol_modules.get(relation.target_entity_id) in module_set
            and symbol_modules[relation.source_entity_id] != symbol_modules[relation.target_entity_id]
        ]
        if not relations:
            return [], ArchitectureClusterResidual(group_id, modules, "no_internal_resolved_relations", tuple((module, "no_internal_resolved_relation") for module in modules))
        pairs = {tuple(sorted((symbol_modules[r.source_entity_id], symbol_modules[r.target_entity_id]))) for r in relations}
        components = _bridge_separated_components(modules, pairs)
        member_sets = [tuple(sorted(component)) for component in components if len(component) >= MIN_CLUSTER_MEMBERS]
        assigned = {member for component in member_sets for member in component}
        if not member_sets:
            return [], ArchitectureClusterResidual(group_id, modules, "insufficient_relation_core", tuple((module, "no_useful_non_bridge_relation_core") for module in modules))
        clusters = []
        for members in sorted(member_sets):
            contained = set(members)
            internal = [r for r in relations if symbol_modules[r.source_entity_id] in contained and symbol_modules[r.target_entity_id] in contained]
            boundary = [r for r in relations if (symbol_modules[r.source_entity_id] in contained) != (symbol_modules[r.target_entity_id] in contained)]
            counts = lambda values: tuple(sorted(Counter(r.relation_kind for r in values).items()))
            clusters.append(ArchitectureRelationCluster(
                _id(self._job.run_id, group_id, CLUSTER_ALGORITHM, *members), self._job.run_id, group_id, "",
                members, len(members), len(internal), counts(internal), len(boundary), counts(boundary),
                tuple(sorted(r.id for r in internal)), CLUSTER_ALGORITHM,
            ))
        residual_members = tuple(sorted(module_set - assigned))
        reasons = []
        adjacency = {module: set() for module in residual_members}
        for left, right in pairs:
            if left in adjacency: adjacency[left].add(right)
            if right in adjacency: adjacency[right].add(left)
        for module in residual_members:
            reasons.append((module, "no_internal_resolved_relation" if not adjacency[module] else "only_bridge_connected_or_below_minimum_core"))
        return clusters, ArchitectureClusterResidual(group_id, residual_members, "insufficient_relation_core", tuple(reasons))

    def _cluster_edges(self, clusters, symbol_modules):
        member_cluster = {module: cluster.id for cluster in clusters for module in cluster.member_module_ids}
        buckets = defaultdict(list)
        for relation in self._store.get_relations(self._job.run_id):
            if relation.resolution_status != "resolved" or not relation.target_entity_id:
                continue
            source = member_cluster.get(symbol_modules.get(relation.source_entity_id, ""))
            target = member_cluster.get(symbol_modules.get(relation.target_entity_id, ""))
            if source and target and source != target:
                buckets[(source, target, relation.relation_kind)].append(relation)
        return [ArchitectureClusterEdge(source, target, kind, len(values), tuple(sorted({(symbol_modules[r.source_entity_id], symbol_modules[r.target_entity_id]) for r in values})), tuple(sorted(r.id for r in values))) for (source, target, kind), values in sorted(buckets.items())]


def _bridge_separated_components(vertices: tuple[str, ...], edges: set[tuple[str, str]]) -> list[set[str]]:
    """Tarjan bridge detection with sorted traversal; no random state or dependencies."""
    adjacency = {vertex: set() for vertex in vertices}
    for left, right in edges:
        adjacency[left].add(right); adjacency[right].add(left)
    visited, low, bridges, tick = {}, {}, set(), 0
    def visit(vertex, parent):
        nonlocal tick
        tick += 1; visited[vertex] = low[vertex] = tick
        for neighbor in sorted(adjacency[vertex]):
            if neighbor == parent: continue
            if neighbor not in visited:
                visit(neighbor, vertex); low[vertex] = min(low[vertex], low[neighbor])
                if low[neighbor] > visited[vertex]: bridges.add(tuple(sorted((vertex, neighbor))))
            else: low[vertex] = min(low[vertex], visited[neighbor])
    for vertex in sorted(vertices):
        if vertex not in visited: visit(vertex, None)
    seen, components = set(), []
    for start in sorted(vertices):
        if start in seen: continue
        stack, component = [start], set()
        while stack:
            vertex = stack.pop()
            if vertex in seen: continue
            seen.add(vertex); component.add(vertex)
            stack.extend(sorted((n for n in adjacency[vertex] if tuple(sorted((vertex, n))) not in bridges), reverse=True))
        components.append(component)
    return components
