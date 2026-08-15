"""Deterministic aggregate architecture graph projection for G0."""
from __future__ import annotations

import hashlib
from collections import defaultdict

from syntax_tree_refurbished.app.architecture_map import structural_fallback
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.core.models.architecture_graph import (
    ARCHITECTURE_GRAPH_SCHEMA_VERSION, ArchitectureGraphAggregateEdge,
    ArchitectureGraphGroup, ArchitectureGraphInternalRelationCount, ArchitectureGraphProjection,
)
from syntax_tree_refurbished.core.models.system_overview import SystemOverview

RELATION_ID_PREVIEW_LIMIT = 20

def _id(*parts: str) -> str:
    return "architecture-graph:" + hashlib.sha1("|".join(parts).encode()).hexdigest()[:24]

class ArchitectureGraphProjector:
    """No LLM, overview relationship, partial relation, or unresolved target participates."""
    def __init__(self, *, job: AnalysisJob, store: InMemoryRunStore, overview: SystemOverview):
        self._job, self._store, self._overview = job, store, overview

    def project(self) -> ArchitectureGraphProjection:
        hierarchy = structural_fallback.build_containment_hierarchy(self._job.run_id, self._overview.main_components)
        if hierarchy is None:
            return ArchitectureGraphProjection(ARCHITECTURE_GRAPH_SCHEMA_VERSION, self._job.run_id, (), (), ())
        groups, module_to_leaf = self._groups(hierarchy)
        edges, internals = self._aggregate(self._symbol_to_group(module_to_leaf))
        return ArchitectureGraphProjection(ARCHITECTURE_GRAPH_SCHEMA_VERSION, self._job.run_id, tuple(groups), tuple(edges), tuple(internals))

    def _groups(self, hierarchy: structural_fallback.ContainmentHierarchy):
        module_to_leaf: dict[str, str] = {}
        groups: list[ArchitectureGraphGroup] = []
        for node in hierarchy.all_nodes:
            direct_children = tuple(child.id for child in hierarchy.children_by_id.get(node.id, ()))
            direct_members = tuple(component.id for component in hierarchy.leaf_members_by_id.get(node.id, ()))
            module_to_leaf.update({module_id: node.id for module_id in direct_members})
            kind = "structural_container" if direct_children else "root_file_bucket" if node.label == structural_fallback.ROOT_BUCKET_LABEL else "structural_leaf"
            groups.append(ArchitectureGraphGroup(node.id, self._job.run_id, node.label, node.graph_qn or node.label, node.parent_group_id, kind, direct_members, direct_children, node.children_count, node.can_drilldown))
        return groups, module_to_leaf

    def _symbol_to_group(self, module_to_leaf: dict[str, str]) -> dict[str, str]:
        from syntax_tree_refurbished.app.analysis.static_structure import module_component_id
        return {symbol.id: module_to_leaf[module_component_id(self._job.run_id, symbol.path)] for symbol in self._store.get_symbols(self._job.run_id) if module_component_id(self._job.run_id, symbol.path) in module_to_leaf}

    def _aggregate(self, symbol_to_group: dict[str, str]):
        buckets: dict[tuple[str, str, str], list] = defaultdict(list)
        internal: dict[tuple[str, str], int] = defaultdict(int)
        for relation in self._store.get_relations(self._job.run_id):
            if relation.resolution_status != "resolved" or not relation.target_entity_id:
                continue
            source, target = symbol_to_group.get(relation.source_entity_id), symbol_to_group.get(relation.target_entity_id)
            if not source or not target:
                continue
            if source == target:
                internal[(source, relation.relation_kind)] += 1
            else:
                buckets[(source, target, relation.relation_kind)].append(relation)
        edges = []
        for (source, target, kind), relations in sorted(buckets.items()):
            pairs = {(r.source_entity_id, r.target_entity_id) for r in relations}
            edges.append(ArchitectureGraphAggregateEdge(_id(self._job.run_id, source, target, kind), self._job.run_id, source, target, kind, len(relations), len(pairs), len({r.source_entity_id for r in relations}), len({r.target_entity_id for r in relations}), tuple(sorted(r.id for r in relations)[:RELATION_ID_PREVIEW_LIMIT]), len(relations)))
        return edges, [ArchitectureGraphInternalRelationCount(group, kind, count) for (group, kind), count in sorted(internal.items())]

def visible_representative(group_id: str, parent_by_group: dict[str, str | None], collapsed_group_ids: set[str]) -> str:
    """Pure G0 helper: the nearest collapsed ancestor, else the group itself."""
    original = group_id
    current = group_id
    while True:
        if current in collapsed_group_ids:
            return current
        parent = parent_by_group.get(current)
        if parent is None:
            return original
        current = parent
