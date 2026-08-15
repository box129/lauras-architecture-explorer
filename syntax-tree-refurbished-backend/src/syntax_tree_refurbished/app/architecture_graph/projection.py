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
from syntax_tree_refurbished.app.architecture_clusters.projection import ArchitectureClusterProjector
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
        clusters = ArchitectureClusterProjector(job=self._job, store=self._store, overview=self._overview).project()
        groups = self._add_cluster_hierarchy(groups, clusters)
        edges, internals = self._aggregate(self._symbol_to_group(module_to_leaf))
        # G2 is the authoritative producer of cluster-to-cluster aggregates.
        # Its records are resolved-only, directed and separated by relation kind.
        edges.extend(
            ArchitectureGraphAggregateEdge(
                _id(self._job.run_id, edge.source_cluster_id, edge.target_cluster_id, edge.relation_kind),
                self._job.run_id, edge.source_cluster_id, edge.target_cluster_id, edge.relation_kind,
                edge.member_relation_count, len(edge.contributing_member_pairs),
                len({pair[0] for pair in edge.contributing_member_pairs}), len({pair[1] for pair in edge.contributing_member_pairs}),
                edge.contributing_relation_ids[:RELATION_ID_PREVIEW_LIMIT], len(edge.contributing_relation_ids),
            ) for edge in clusters.cluster_edges
        )
        edges.sort(key=lambda edge: (edge.source_group_id, edge.target_group_id, edge.relation_kind, edge.id))
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

    def _add_cluster_hierarchy(self, groups, projection):
        """Attach the accepted G2 projection without deriving membership here."""
        by_id = {group.id: group for group in groups}
        component_labels = {component.id: component.label for component in self._overview.main_components}
        clusters_by_region = defaultdict(list)
        for cluster in projection.clusters:
            clusters_by_region[cluster.containing_structural_group_id].append(cluster)
        residual_by_region = {residual.containing_structural_group_id: residual for residual in projection.residuals}
        added = []
        # Iterate every region that has clusters OR a residual, not just
        # cluster-producing regions. A region below MIN_CLUSTER_MEMBERS (or
        # with no internal resolved relations) still gets a residual record
        # with its real modules -- but with the old `clusters_by_region`-only
        # iteration, that residual (and its module children) were silently
        # never attached, so entering such a region showed 0 modules / 0
        # regions / 0 relations even though its own parent card correctly
        # reported real module counts. See qa notes for the reproduction on
        # a single-module leaf region ("docs").
        for region_id in sorted(set(clusters_by_region) | set(residual_by_region)):
            region = by_id[region_id]
            clusters = clusters_by_region.get(region_id, [])
            child_ids = []
            for cluster in sorted(clusters, key=lambda value: value.display_name):
                child_ids.append(cluster.id)
                module_ids = tuple(cluster.member_module_ids)
                added.append(ArchitectureGraphGroup(cluster.id, self._job.run_id, cluster.display_name, region.structural_path,
                    region_id, "relation_cluster", module_ids, module_ids, len(module_ids), False, cluster.id, False,
                    cluster.internal_relation_count, cluster.internal_relation_kind_counts, cluster.boundary_relation_count,
                    cluster.boundary_relation_kind_counts, cluster.algorithm))
                added.extend(ArchitectureGraphGroup(module_id, self._job.run_id, component_labels.get(module_id, module_id.rsplit(':', 1)[-1]),
                    region.structural_path, cluster.id, "module", (), (), 1, False) for module_id in module_ids)
            residual = residual_by_region.get(region_id)
            if residual and residual.member_module_ids:
                residual_id = _id(self._job.run_id, region_id, "residual")
                child_ids.append(residual_id)
                added.append(ArchitectureGraphGroup(residual_id, self._job.run_id, "Unclustered by recovered relations", region.structural_path,
                    region_id, "relation_residual", residual.member_module_ids, residual.member_module_ids, len(residual.member_module_ids), False,
                    None, True))
                added.extend(ArchitectureGraphGroup(module_id, self._job.run_id, component_labels.get(module_id, module_id.rsplit(':', 1)[-1]),
                    region.structural_path, residual_id, "module", (), (), 1, False, None, True) for module_id in residual.member_module_ids)
            by_id[region_id] = ArchitectureGraphGroup(**{**region.__dict__, "direct_child_group_ids": tuple((*region.direct_child_group_ids, *child_ids))})
        return [by_id[group.id] for group in groups] + added

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
