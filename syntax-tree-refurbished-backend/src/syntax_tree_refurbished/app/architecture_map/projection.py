"""Project SystemOverview into current Observatory architecture-map DTOs."""

from __future__ import annotations

import hashlib
from dataclasses import replace
from typing import Any

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.architecture_map import structural_fallback
from syntax_tree_refurbished.app.architecture_map.component_lens import ComponentLensGenerator
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel
from syntax_tree_refurbished.core.models.architecture_map import (
    ArchitectureMapDiagnostics,
    ArchitectureMapEdge,
    ArchitectureMapEvidence,
    ArchitectureMapNode,
    ArchitectureMapProjection,
    ArchitectureMapStatus,
    ImplementationHighlight,
    ImplementationSlice,
    ImplementationSourceTab,
)
from syntax_tree_refurbished.core.models.grounding import GroundedClaim
from syntax_tree_refurbished.core.models.lens import Lens, LensChildComponent
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.core.models.semantic_anchor import SemanticAnchor
from syntax_tree_refurbished.core.models.source_region import SourceRegion
from syntax_tree_refurbished.core.models.system_overview import OverviewComponent, SystemOverview


PROJECTION_VERSION = "system-overview-architecture-map-v3"
MAX_DEPTH = 4


class ArchitectureMapProjector:
    def __init__(self, *, job: AnalysisJob, store: InMemoryRunStore, overview: SystemOverview, model: InvestigationModel):
        if not job.snapshot:
            raise ValueError("Repo snapshot is not ready.")
        self._job = job
        self._store = store
        self._overview = overview
        self._model = model
        self._reader = SourceReader(job)
        self._components = {component.id: component for component in overview.main_components}

    def project(self) -> ArchitectureMapProjection:
        cached = self._store.get_architecture_map(self._job.run_id)
        if cached and cached.overview_input_hash == self._overview.input_hash:
            return cached
        root = self._root_node()
        component_nodes = tuple(self._component_node(component) for component in self._overview.main_components)
        if not component_nodes:
            # Deterministic structural-navigation fallback (see
            # app.architecture_map.structural_fallback's module docstring):
            # the LLM/heuristic-driven overview found zero components, but
            # real analyzed symbols may still exist -- reflect that in the
            # root's own drilldown metadata so the UI does not show "0
            # areas" while `children()` (below) actually returns fallback
            # nodes when the root is opened. This never overrides a
            # non-empty component list, and never touches
            # SystemOverviewGenerator/AnalysisController.
            fallback_symbols = self._store.get_symbols(self._job.run_id)
            if structural_fallback.has_fallback_content(fallback_symbols):
                fallback_children, _ = structural_fallback.root_children(self._job.run_id, fallback_symbols)
                root = replace(root, children_count=len(fallback_children), can_drilldown=bool(fallback_children))
        # Phase B/C1: when the Overview is a flat, file-shaped component
        # list (the deployed default -- see structural_fallback.build_
        # containment_hierarchy's own docstring), replace those per-file
        # level-1 nodes with a real, potentially multi-level deterministic
        # containment tree. Returns None (no grouping) for an LLM-
        # classified Overview, an empty Overview, or a flat/nearly-flat
        # repository -- in every one of those cases the existing per-file
        # `component_nodes` remain the level-1 set, completely unchanged
        # from Phase A. When it does activate, `nodes` eagerly carries
        # EVERY container/leaf-group node at every depth (never just
        # level-1) -- directory counts are small even for a large
        # repository, so this stays cheap, and it is what lets the
        # frontend render real nested ReactFlow parent/child containers on
        # one screen instead of one flat level at a time. Real member
        # files/symbols are still only fetched lazily via `/children`,
        # exactly as Phase B already did for its (always leaf, single-
        # level) groups.
        hierarchy = structural_fallback.build_containment_hierarchy(self._job.run_id, self._overview.main_components)
        level1_nodes = hierarchy.top_level if hierarchy else component_nodes
        nodes = (root, *hierarchy.all_nodes) if hierarchy else (root, *component_nodes)
        edges = self._edges(root, level1_nodes)
        diagnostics = self._diagnostics(level1_nodes)
        projection = ArchitectureMapProjection(
            analysis_run_id=self._job.run_id,
            overview_input_hash=self._overview.input_hash,
            root=root,
            nodes=nodes,
            edges=edges,
            diagnostics=diagnostics,
            metadata={
                "repository": {
                    "name": self._overview.repo_identity.get("name"),
                    "root_path": self._overview.repo_identity.get("path"),
                    "file_count": self._overview.repo_identity.get("file_count"),
                },
                "overview_id": self._overview.id,
                "overview_status": self._overview.status,
                "overview_cached": self._overview.metrics.cached,
                "llm_used": self._overview.metrics.llm_used,
                "model": self._overview.metrics.model,
                # Real, already-computed counts for a truthful Overview
                # summary line (never "N areas * M links" once grouped --
                # see docs/design-proposals/semantic-architecture-overview/
                # STATE_1_OVERVIEW.md). Absent (all zero/empty) when
                # grouping did not activate, so the frontend can fall back
                # to its pre-C1 wording unchanged.
                "containment": {
                    "total_modules": len(self._overview.main_components),
                    "top_level_regions": len(level1_nodes) if hierarchy else 0,
                    "total_sections": len(hierarchy.all_nodes) if hierarchy else 0,
                },
            },
        )
        self._store.put_architecture_map(projection)
        return projection

    def node(self, node_id: str) -> ArchitectureMapNode | None:
        projection = self.project()
        for node in projection.nodes:
            if node.id == node_id:
                return node
        # Phase B: when grouping is active, a real file-shaped component is
        # no longer in projection.nodes directly (its group is, instead) --
        # it is still a real, directly-addressable node (e.g. the direct
        # `/nodes/{id}` route, or an explanation/evidence/implementation
        # lookup reached via a group's children), so it must still resolve
        # by its own real id here.
        component = self._components.get(node_id)
        if component:
            return self._component_node(component)
        child = self._child_node(node_id)
        if child:
            return child
        symbol = self._static_symbol(node_id)
        if symbol:
            return self._static_symbol_node(symbol)
        if structural_fallback.is_structural_fallback_id(node_id):
            return structural_fallback.resolve_node(
                node_id, self._job.run_id, self._store.get_symbols(self._job.run_id)
            )
        return None

    def children(self, node_id: str) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]]:
        component = self._components.get(node_id)
        if component:
            if component.kind == "module":
                return self._module_children(component)
            return self._top_level_children(component)
        symbol = self._static_symbol(node_id)
        if symbol:
            return self._symbol_children(symbol)
        child = self._child_component(node_id)
        if child:
            return self._child_children(child, node_id)
        if structural_fallback.is_group_id(node_id):
            return self._group_children(node_id)
        fallback = self._structural_fallback_children(node_id)
        if fallback is not None:
            return fallback
        return (), ()

    def _group_children(self, group_id: str) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]]:
        """A structural_group's children depend on whether it is a
        container (Phase C1: has real sub-containers/leaf buckets one
        level down -- returned as-is, already fully-formed nodes with
        correct level/parent_group_id, no re-wrapping needed) or a leaf
        (its real member OverviewComponents, rendered one level below its
        own depth -- reuses `_component_node` unchanged, so a member
        reached this way behaves identically to the same component reached
        in an ungrouped Overview: same id, same evidence/explanation/
        implementation routes). No edges either way: containment here is
        expressed by the tree itself, exactly like structural_fallback's
        own package/module levels."""
        hierarchy = structural_fallback.build_containment_hierarchy(self._job.run_id, self._overview.main_components)
        if hierarchy is None:
            return (), ()
        container_children = hierarchy.children_by_id.get(group_id)
        if container_children is not None:
            return container_children, ()
        members = hierarchy.leaf_members_by_id.get(group_id)
        if members is None:
            return (), ()
        leaf_node = next((node for node in hierarchy.all_nodes if node.id == group_id), None)
        member_level = (leaf_node.level + 1) if leaf_node else 2
        return tuple(self._component_node(member, level=member_level) for member in members), ()

    def neighborhood(
        self, node_id: str
    ) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]]:
        """One-hop neighborhood of ``node_id`` via real recovered relations
        (imports/calls/inherits/contains) -- independent of parent/child
        containment, unlike ``children()``. Backs the Entity Focus state's
        bounded, deterministic graph.

        A relation whose relevant side has no ``target_entity_id`` (fully
        unresolved, or a "partial" match with no real entity) cannot point
        at a node the UI can render as a definite neighbor, so it is
        skipped entirely here -- never upgraded to resolved fact.
        """
        relations = self._store.get_relations(self._job.run_id)
        dependencies: dict[str, ArchitectureMapNode] = {}
        dependents: dict[str, ArchitectureMapNode] = {}
        edges: dict[str, ArchitectureMapEdge] = {}
        for relation in relations:
            if relation.source_entity_id == node_id and relation.target_entity_id:
                other = self.node(relation.target_entity_id)
                if not other or other.id == node_id:
                    continue
                dependencies[other.id] = other
                edge = self._neighborhood_edge(relation, source=node_id, target=other.id)
                edges[edge.id] = edge
            elif relation.target_entity_id == node_id and relation.source_entity_id != node_id:
                other = self.node(relation.source_entity_id)
                if not other:
                    continue
                dependents[other.id] = other
                edge = self._neighborhood_edge(relation, source=other.id, target=node_id)
                edges[edge.id] = edge
        return tuple(dependencies.values()), tuple(dependents.values()), tuple(edges.values())

    def _neighborhood_edge(self, relation: ObservedProgramRelation, *, source: str, target: str) -> ArchitectureMapEdge:
        # A "resolved" relation is a deterministic fact and carries no
        # confidence value by construction (ObservedProgramRelation's own
        # validation forbids it); a "partial" relation with a real entity
        # match keeps its real confidence. Neither is ever upgraded to the
        # other here.
        source_refs: dict[str, list[Any]] = {}
        if relation.span_path is not None:
            source_refs["relation_spans"] = [
                {"path": relation.span_path, "start_line": relation.span_start_line, "end_line": relation.span_end_line}
            ]
        return ArchitectureMapEdge(
            id=_stable_id("neighborhood-edge", self._job.run_id, source, target, relation.relation_kind, relation.resolution_status, relation.id),
            analysis_run_id=self._job.run_id,
            source=source,
            target=target,
            kind=relation.relation_kind,
            label=relation.relation_kind.replace("_", " "),
            confidence=relation.confidence,
            source_refs=source_refs,
        )

    def _structural_fallback_children(
        self, node_id: str
    ) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]] | None:
        """Deterministic fallback dispatch (see structural_fallback's
        module docstring) -- activates only for the map root when the
        normal LLM/heuristic projection produced zero components, or for
        one of this module's own package/module ids. Never touched for
        any node the normal projection already knows about (those are
        handled by the branches above, unchanged)."""
        symbols = self._store.get_symbols(self._job.run_id)
        if node_id == self._root_node().id and not self._components:
            if not structural_fallback.has_fallback_content(symbols):
                return None
            return structural_fallback.root_children(self._job.run_id, symbols)
        if structural_fallback.is_package_id(node_id):
            return structural_fallback.package_children(self._job.run_id, node_id, symbols)
        if structural_fallback.is_module_id(node_id):
            return structural_fallback.module_children(self._job.run_id, node_id, symbols)
        return None

    def _top_level_children(self, component: OverviewComponent) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]]:
        lens = self._lens_for_component(component)
        if lens.child_components:
            return self._children_from_lens(lens, parent_level=1)
        if not component.children_hint:
            return (), ()
        children: list[ArchitectureMapNode] = []
        edges: list[ArchitectureMapEdge] = []
        for index, label in enumerate(component.children_hint[:20]):
            child_id = _stable_id("arch-child", self._job.run_id, component.id, label)
            children.append(
                ArchitectureMapNode(
                    id=child_id,
                    analysis_run_id=self._job.run_id,
                    label=label,
                    kind="subsystem",
                    level=2,
                    description=f"{label} is suggested by the System Overview as a possible child area of {component.label}.",
                    status="insufficient",
                    confidence=None,
                    source_refs={"parent_component_ids": [component.id]},
                    evidence_count=0,
                    children_count=0,
                    can_drilldown=False,
                    primary_files=(),
                    related_concept_ids=(),
                    related_flow_ids=(),
                    graph_qn=None,
                    legacy_type=None,
                    warnings=("Child hint has not been investigated as its own source-backed lens yet.",),
                    unsupported_reason="child_lens_not_generated",
                )
            )
            edges.append(
                ArchitectureMapEdge(
                    id=_stable_id("edge", self._job.run_id, component.id, child_id, str(index)),
                    analysis_run_id=self._job.run_id,
                    source=component.id,
                    target=child_id,
                    kind="child_hint",
                    label="suggests",
                    confidence=None,
                    source_refs={"parent_component_ids": [component.id]},
                )
            )
        return tuple(children), tuple(edges)

    def _child_children(self, child: LensChildComponent, node_id: str) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]]:
        parent_lens = self._lens_for_child(child)
        parent_node = self._child_node_from_lens(parent_lens, child)
        if parent_node.level >= MAX_DEPTH:
            return (), ()
        sub_lens = ComponentLensGenerator(
            job=self._job,
            store=self._store,
            overview=self._overview,
            component=child,
            model=self._model,
            parent_lens=parent_lens,
        ).get_or_generate()
        if sub_lens.child_components:
            return self._children_from_lens(sub_lens, parent_level=parent_node.level)
        return (), ()

    def evidence(self, node_id: str, *, limit: int = 40) -> tuple[ArchitectureMapEvidence, ...]:
        node = self.node(node_id)
        if not node:
            return ()
        if node_id == self.project().root.id:
            regions = _overview_regions(self._overview, self._store)
            return tuple(self._evidence_from_region(node_id, region, "overview_region", 1.0) for region in regions[:limit])
        component = self._components.get(node_id)
        if component:
            rows = self._component_evidence(component)
            return rows[:limit]
        symbol = self._static_symbol(node_id)
        if symbol:
            region = self._store.get_region(symbol.source_region_id)
            return (
                (self._evidence_from_region(node_id, region, "parsed_symbol", 1.0),)
                if region
                else ()
            )
        child = self._child_component(node_id)
        if child:
            return self._child_evidence(child, node_id)[:limit]
        return ()

    def implementation_slice(self, *, subject_type: str, subject_id: str) -> ImplementationSlice:
        if subject_type not in {"architecture_node", "source_span"}:
            return self._unsupported_slice(subject_type=subject_type, subject_id=subject_id)
        if subject_type == "source_span":
            region = self._store.get_region(subject_id)
            if not region:
                return self._unsupported_slice(subject_type=subject_type, subject_id=subject_id)
            return self._slice_from_regions(
                node_id=subject_id,
                title=f"{region.path}:{region.start_line}-{region.end_line}",
                summary="Exact source-backed region.",
                subject_type=subject_type,
                subject_id=subject_id,
                regions=(region,),
                status="verified",
                warnings=(),
                gaps=(),
            )
        node = self.node(subject_id)
        if not node:
            return self._unsupported_slice(subject_type=subject_type, subject_id=subject_id)
        regions = tuple(self._regions_for_node(subject_id))
        if regions:
            return self._slice_from_regions(
                node_id=node.id,
                title=node.label,
                summary=node.description,
                subject_type=subject_type,
                subject_id=subject_id,
                regions=regions,
                status=node.status,
                warnings=node.warnings,
                gaps=(),
            )
        fallback = self._file_fallback_regions(node)
        if fallback:
            return self._slice_from_regions(
                node_id=node.id,
                title=node.label,
                summary=node.description,
                subject_type=subject_type,
                subject_id=subject_id,
                regions=fallback,
                status="insufficient",
                warnings=(*node.warnings, "No exact source region was attached; opened related file fallback."),
                gaps=("No exact source region was attached for this architecture node.",),
            )
        return ImplementationSlice(
            analysis_run_id=self._job.run_id,
            node_id=node.id,
            status="insufficient",
            subject={"type": subject_type, "id": subject_id},
            title=node.label,
            summary=node.description,
            primary_span_id="",
            evidence_strength=0.0,
            tabs=(),
            gaps=("No source-backed implementation slice was returned for this item.",),
            unsupported_reason="no_source_regions",
            warnings=node.warnings,
        )

    def _root_node(self) -> ArchitectureMapNode:
        repo_name = str(self._overview.repo_identity.get("name") or "System Overview")
        regions = _overview_regions(self._overview, self._store)
        status = "verified" if regions and self._overview.status == "ready" else "insufficient"
        return ArchitectureMapNode(
            id=_stable_id("arch-root", self._job.run_id, self._overview.id),
            analysis_run_id=self._job.run_id,
            label=repo_name,
            kind="system",
            level=0,
            description=self._overview.summary,
            status=status,
            confidence=_confidence(self._overview.repo_shape),
            source_refs={"overview_id": [self._overview.id], "source_region_ids": [region.id for region in regions[:20]]},
            evidence_count=len(regions),
            children_count=len(self._overview.main_components),
            can_drilldown=bool(self._overview.main_components),
            primary_files=tuple(_dedupe(region.path for region in regions[:5])),
            related_concept_ids=(),
            related_flow_ids=(),
            graph_qn=None,
            legacy_type=None,
            warnings=tuple(self._overview.gaps[:6]),
            unsupported_reason=None if regions else "overview_has_no_source_regions",
        )

    def _component_node(self, component: OverviewComponent, *, level: int = 1) -> ArchitectureMapNode:
        evidence = self._component_evidence(component)
        status = _node_status(component.support_status, bool(evidence), self._overview.status)
        cached_lens = self._store.get_lens(self._job.run_id, component.id)
        module_symbols = self._module_symbols(component) if component.kind == "module" else ()
        children_count = (
            len(module_symbols)
            if component.kind == "module"
            else len(cached_lens.child_components) if cached_lens else len(component.children_hint)
        )
        can_drilldown = (
            children_count > 0
            if component.kind == "module"
            else bool(cached_lens or component.children_hint or evidence or component.related_file_paths or component.anchor_ids)
        )
        warnings = tuple(
            _dedupe(
                [
                    *(
                        f"Claim is {claim.support_status}: {claim.claim.text}"
                        for claim in self._claims_for_component(component)
                        if claim.support_status != "verified"
                    ),
                    *(["No exact source-backed evidence attached."] if not evidence else []),
                ]
            )
        )
        return ArchitectureMapNode(
            id=component.id,
            analysis_run_id=self._job.run_id,
            label=component.label,
            kind=_node_kind(component),
            level=level,
            description=component.summary or _component_description(component, evidence),
            status=status,
            confidence=component.confidence,
            source_refs={
                "source_region_ids": [item.source_ref_id for item in evidence if item.source_ref_kind == "source_span"],
                "anchor_ids": list(component.anchor_ids),
                "related_file_paths": list(component.related_file_paths),
            },
            evidence_count=len(evidence),
            children_count=children_count,
            can_drilldown=can_drilldown,
            primary_files=tuple(_dedupe(item.file_path for item in evidence[:5])) or component.related_file_paths[:5],
            related_concept_ids=(),
            related_flow_ids=(),
            graph_qn=None,
            legacy_type=None,
            warnings=warnings,
            unsupported_reason=None if status != "unsupported" else "component_not_source_supported",
        )

    def _component_evidence(self, component: OverviewComponent) -> tuple[ArchitectureMapEvidence, ...]:
        rows: list[ArchitectureMapEvidence] = []
        seen_regions: set[str] = set()
        for region in self._regions_from_ids(component.source_region_ids):
            if region.id not in seen_regions and _region_matches_component(region, component):
                seen_regions.add(region.id)
                rows.append(self._evidence_from_region(component.id, region, "component_source_region", 1.0))
        for claim in self._claims_for_component(component):
            for region in _regions_from_claim(claim, self._store):
                if region.id not in seen_regions:
                    seen_regions.add(region.id)
                    score = 0.95 if claim.support_status == "verified" else 0.55
                    rows.append(self._evidence_from_region(component.id, region, "grounded_claim", score, claim.claim.text))
        for anchor in self._anchors_from_ids(component.anchor_ids):
            region = self._store.get_region(anchor.source_region_id)
            if region and region.id not in seen_regions:
                seen_regions.add(region.id)
                rows.append(self._evidence_from_region(component.id, region, f"semantic_anchor:{anchor.kind}", anchor.confidence, anchor.summary or anchor.label))
        return tuple(rows[:40])

    def _evidence_from_region(
        self,
        node_id: str,
        region: SourceRegion,
        kind: str,
        score: float,
        reason: str | None = None,
    ) -> ArchitectureMapEvidence:
        record = self._safe_file_record(region.path)
        return ArchitectureMapEvidence(
            id=_stable_id("evidence", self._job.run_id, node_id, region.id, kind),
            analysis_run_id=self._job.run_id,
            node_id=node_id,
            evidence_kind=kind,
            source_ref_kind="source_span",
            source_ref_id=region.id,
            file_path=region.path,
            language=record.language if record else "",
            start_line=region.start_line,
            end_line=region.end_line,
            text_preview=_preview(region.text),
            status="verified",
            confidence=score,
            score=score,
            reason=reason or "Source region attached to System Overview.",
            is_stale=False,
        )

    def _claims_for_component(self, component: OverviewComponent) -> tuple[GroundedClaim, ...]:
        searchable = " ".join(
            [
                component.label,
                component.summary,
                " ".join(component.responsibilities),
                " ".join(component.related_file_paths),
            ]
        ).lower()
        claims: list[GroundedClaim] = []
        for claim in self._overview.claims:
            text = claim.claim.text.lower()
            paths = [citation.citation.path or "" for citation in claim.citations]
            resolved_paths = [self._store.get_region(citation.resolved_region_id).path for citation in claim.citations if citation.resolved_region_id and self._store.get_region(citation.resolved_region_id)]
            if component.label.lower() in text or any(path and path.lower() in searchable for path in paths + resolved_paths):
                claims.append(claim)
        return tuple(claims)

    def _regions_for_node(self, node_id: str) -> tuple[SourceRegion, ...]:
        if node_id == self.project().root.id:
            return _overview_regions(self._overview, self._store)
        component = self._components.get(node_id)
        if not component:
            symbol = self._static_symbol(node_id)
            if symbol:
                region = self._store.get_region(symbol.source_region_id)
                return (region,) if region else ()
            child = self._child_component(node_id)
            if child:
                return tuple(
                    row
                    for row in (self._store.get_region(region_id) for region_id in child.source_region_ids)
                    if row
                )
            return ()
        return tuple(row for row in (self._store.get_region(item.source_ref_id) for item in self._component_evidence(component)) if row)

    def _lens_for_component(self, component: OverviewComponent) -> Lens:
        return ComponentLensGenerator(
            job=self._job,
            store=self._store,
            overview=self._overview,
            component=component,
            model=self._model,
        ).get_or_generate()

    def _module_symbols(self, component: OverviewComponent) -> tuple[ParsedSymbol, ...]:
        if not component.related_file_paths:
            return ()
        symbols = self._store.get_symbols_for_file(self._job.run_id, component.related_file_paths[0])
        return tuple(symbol for symbol in symbols if not symbol.parent_symbol_id)

    def _module_children(
        self,
        component: OverviewComponent,
    ) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]]:
        symbols = self._module_symbols(component)
        nodes = tuple(self._static_symbol_node(symbol, level=2) for symbol in symbols)
        edges = tuple(
            ArchitectureMapEdge(
                id=_stable_id("edge", self._job.run_id, component.id, symbol.id, "contains"),
                analysis_run_id=self._job.run_id,
                source=component.id,
                target=symbol.id,
                kind="contains",
                label="contains",
                confidence=1.0,
                source_refs={"source_region_ids": [symbol.source_region_id]},
            )
            for symbol in symbols
        )
        return nodes, edges

    def _symbol_children(
        self,
        symbol: ParsedSymbol,
    ) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]]:
        children = tuple(
            candidate
            for candidate in self._store.get_symbols(self._job.run_id)
            if candidate.parent_symbol_id == symbol.id
        )
        nodes = tuple(self._static_symbol_node(child, level=3) for child in children)
        edges = tuple(
            ArchitectureMapEdge(
                id=_stable_id("edge", self._job.run_id, symbol.id, child.id, "contains"),
                analysis_run_id=self._job.run_id,
                source=symbol.id,
                target=child.id,
                kind="contains",
                label="contains",
                confidence=1.0,
                source_refs={"source_region_ids": [child.source_region_id]},
            )
            for child in children
        )
        return nodes, edges

    def _static_symbol(self, node_id: str) -> ParsedSymbol | None:
        symbol = self._store.get_symbol(node_id)
        return symbol if symbol and symbol.run_id == self._job.run_id else None

    def _static_symbol_node(self, symbol: ParsedSymbol, *, level: int = 2) -> ArchitectureMapNode:
        region = self._store.get_region(symbol.source_region_id)
        children_count = sum(
            1
            for candidate in self._store.get_symbols(self._job.run_id)
            if candidate.parent_symbol_id == symbol.id
        )
        return ArchitectureMapNode(
            id=symbol.id,
            analysis_run_id=self._job.run_id,
            label=symbol.name,
            kind="component" if symbol.kind in {"class", "interface"} else "code_group",
            level=level,
            description=f"{symbol.signature or symbol.kind} in {symbol.path}:{symbol.start_line}-{symbol.end_line}.",
            status="verified" if region else "insufficient",
            confidence=1.0 if region else 0.6,
            source_refs={"source_region_ids": [symbol.source_region_id], "symbol_ids": [symbol.id]},
            evidence_count=1 if region else 0,
            children_count=children_count,
            can_drilldown=children_count > 0,
            primary_files=(symbol.path,),
            related_concept_ids=(),
            related_flow_ids=(),
            graph_qn=symbol.qualified_name,
            legacy_type=symbol.kind,
            warnings=(),
            unsupported_reason=None if region else "source_region_unavailable",
        )

    def _children_from_lens(self, lens: Lens, *, parent_level: int) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]]:
        nodes = tuple(self._child_node_from_lens(lens, child, parent_level=parent_level) for child in lens.child_components)
        edges = tuple(
            ArchitectureMapEdge(
                id=_stable_id("edge", self._job.run_id, relationship.from_child_id, relationship.to_child_id, relationship.label),
                analysis_run_id=self._job.run_id,
                source=relationship.from_child_id,
                target=relationship.to_child_id,
                kind="lens_relationship",
                label=relationship.label,
                confidence=0.8 if relationship.support_status == "verified" else 0.45,
                source_refs={"source_region_ids": list(relationship.source_region_ids)},
            )
            for relationship in lens.relationships
        )
        return nodes, edges

    def _child_node(self, node_id: str) -> ArchitectureMapNode | None:
        child = self._child_component(node_id)
        if not child:
            return None
        lens = self._lens_for_child(child)
        return self._child_node_from_lens(lens, child, parent_level=1)

    def _child_component(self, node_id: str) -> LensChildComponent | None:
        for component in self._overview.main_components:
            cached = self._store.get_lens(self._job.run_id, component.id)
            if not cached:
                continue
            for child in cached.child_components:
                if child.id == node_id:
                    return child
                sub_lens = self._store.get_lens(self._job.run_id, child.id)
                if sub_lens:
                    for sub_child in sub_lens.child_components:
                        if sub_child.id == node_id:
                            return sub_child
        return None

    def _lens_for_child(self, child: LensChildComponent) -> Lens:
        for component in self._overview.main_components:
            cached = self._store.get_lens(self._job.run_id, component.id)
            if cached and any(item.id == child.id for item in cached.child_components):
                return cached
            for top_child in (cached.child_components if cached else ()):
                sub_lens = self._store.get_lens(self._job.run_id, top_child.id)
                if sub_lens and any(item.id == child.id for item in sub_lens.child_components):
                    return sub_lens
        raise ValueError("Child lens not found.")

    def _child_node_from_lens(self, lens: Lens, child: LensChildComponent, *, parent_level: int) -> ArchitectureMapNode:
        evidence = self._child_evidence(child, child.id)
        status = _node_status(child.support_status, bool(evidence), lens.status)
        child_level = parent_level + 1
        can_drill = bool(child.children_hint) and child_level < MAX_DEPTH
        return ArchitectureMapNode(
            id=child.id,
            analysis_run_id=self._job.run_id,
            label=child.label,
            kind=_child_node_kind(child),
            level=child_level,
            description=child.summary or _child_description(child, evidence),
            status=status,
            confidence=child.confidence,
            source_refs={
                "source_region_ids": list(child.source_region_ids),
                "related_file_paths": list(child.related_file_paths),
                "parent_component_ids": [lens.parent_component_id],
                "lens_id": [lens.id],
            },
            evidence_count=len(evidence),
            children_count=len(child.children_hint),
            can_drilldown=can_drill,
            primary_files=tuple(_dedupe(item.file_path for item in evidence[:5])) or child.related_file_paths[:5],
            related_concept_ids=(),
            related_flow_ids=(),
            graph_qn=None,
            legacy_type=None,
            warnings=tuple(lens.gaps[:6]) if status != "verified" else (),
            unsupported_reason=None if status != "unsupported" else "child_component_not_source_supported",
        )

    def _child_evidence(self, child: LensChildComponent, node_id: str) -> tuple[ArchitectureMapEvidence, ...]:
        rows: list[ArchitectureMapEvidence] = []
        for region in self._regions_from_ids(child.source_region_ids):
            rows.append(self._evidence_from_region(node_id, region, f"lens_child:{child.kind}", 1.0, child.summary or child.label))
        return tuple(rows[:40])

    def _regions_from_ids(self, region_ids: tuple[str, ...]) -> tuple[SourceRegion, ...]:
        return tuple(region for region in (self._store.get_region(region_id) for region_id in region_ids) if region)

    def _anchors_from_ids(self, anchor_ids: tuple[str, ...]) -> tuple[SemanticAnchor, ...]:
        if not anchor_ids:
            return ()
        by_id = {anchor.id: anchor for anchor in self._store.get_anchors(self._job.run_id)}
        return tuple(by_id[anchor_id] for anchor_id in anchor_ids if anchor_id in by_id)

    def _file_fallback_regions(self, node: ArchitectureMapNode) -> tuple[SourceRegion, ...]:
        regions: list[SourceRegion] = []
        for path in node.primary_files[:5]:
            try:
                region = self._reader.read_range(path, 1, min(80, self._reader.get_file(path).line_count))
            except SourceReadError:
                continue
            self._store.put_region(region)
            regions.append(region)
        return tuple(regions)

    def _slice_from_regions(
        self,
        *,
        node_id: str,
        title: str,
        summary: str,
        subject_type: str,
        subject_id: str,
        regions: tuple[SourceRegion, ...],
        status: ArchitectureMapStatus,
        warnings: tuple[str, ...],
        gaps: tuple[str, ...],
    ) -> ImplementationSlice:
        by_file: dict[str, list[SourceRegion]] = {}
        for region in regions:
            by_file.setdefault(region.path, []).append(region)
        tabs: list[ImplementationSourceTab] = []
        for index, (path, file_regions) in enumerate(list(by_file.items())[:5]):
            record = self._safe_file_record(path)
            role = "primary" if index == 0 else "supporting"
            tabs.append(
                ImplementationSourceTab(
                    file_path=path,
                    language=record.language if record else "",
                    role=role,
                    summary=f"{len(file_regions)} highlighted source region(s).",
                    reason="Exact source evidence from the System Overview.",
                    source_span_ids=tuple(region.id for region in file_regions[:20]),
                    highlights=tuple(
                        ImplementationHighlight(
                            span_id=region.id,
                            start_line=region.start_line,
                            end_line=region.end_line,
                            status=status,
                            confidence=1.0 if status == "verified" else 0.5,
                        )
                        for region in file_regions[:20]
                    ),
                    is_stale=False,
                )
            )
        primary_span_id = tabs[0].source_span_ids[0] if tabs and tabs[0].source_span_ids else ""
        return ImplementationSlice(
            analysis_run_id=self._job.run_id,
            node_id=node_id,
            status=status,
            subject={"type": subject_type, "id": subject_id},
            title=title,
            summary=summary,
            primary_span_id=primary_span_id,
            evidence_strength=1.0 if status == "verified" and primary_span_id else 0.5 if primary_span_id else 0.0,
            tabs=tuple(tabs),
            gaps=gaps,
            unsupported_reason="" if tabs else "no_source_regions",
            warnings=warnings,
        )

    def _unsupported_slice(self, *, subject_type: str, subject_id: str) -> ImplementationSlice:
        return ImplementationSlice(
            analysis_run_id=self._job.run_id,
            node_id=subject_id,
            status="unsupported",
            subject={"type": subject_type, "id": subject_id},
            title="Unsupported proof request",
            summary="This subject type is not implemented in PR10.",
            primary_span_id="",
            evidence_strength=0.0,
            tabs=(),
            gaps=("Only architecture_node and source_span proof are supported in PR10.",),
            unsupported_reason="unsupported_subject_type",
            warnings=(),
        )

    def _edges(self, root: ArchitectureMapNode, level1_nodes: tuple[ArchitectureMapNode, ...]) -> tuple[ArchitectureMapEdge, ...]:
        # When Phase B grouping is active, `level1_nodes` are groups, whose
        # ids never appear in `self._overview.relationships` (those
        # reference real component ids one level deeper) -- so the loop
        # below naturally finds zero matching relationships and falls
        # through to the root->node "contains" edges below. That is the
        # intended, deliberate Overview edge strategy for Phase B (see
        # DATA_MAPPING.md/FEASIBILITY.md's group-to-group edge discussion):
        # plain root->group containment only, never an invented
        # group-to-group relationship rolled up from member edges.
        by_id = {node.id: node for node in level1_nodes}
        edges: list[ArchitectureMapEdge] = []
        for relationship in self._overview.relationships:
            if relationship.from_component_id not in by_id or relationship.to_component_id not in by_id:
                continue
            edges.append(
                ArchitectureMapEdge(
                    id=_stable_id("edge", self._job.run_id, relationship.from_component_id, relationship.to_component_id, relationship.label),
                    analysis_run_id=self._job.run_id,
                    source=relationship.from_component_id,
                    target=relationship.to_component_id,
                    kind=_relationship_kind(relationship.label),
                    label=relationship.label,
                    confidence=0.8 if relationship.support_status == "verified" else 0.45,
                    source_refs={"source_region_ids": list(relationship.source_region_ids)},
                )
            )
        if edges:
            return tuple(edges)
        return tuple(
            ArchitectureMapEdge(
                id=_stable_id("edge", self._job.run_id, root.id, node.id),
                analysis_run_id=self._job.run_id,
                source=root.id,
                target=node.id,
                kind="contains",
                label="contains",
                confidence=node.confidence,
                source_refs={},
            )
            for node in level1_nodes
        )

    def _diagnostics(self, nodes: tuple[ArchitectureMapNode, ...]) -> ArchitectureMapDiagnostics:
        warnings = tuple(_dedupe([*self._overview.gaps, *[warning for node in nodes for warning in node.warnings]]))[:20]
        return ArchitectureMapDiagnostics(
            repo_shape=str(self._overview.repo_shape.get("kind") or "") or None,
            projection_version=PROJECTION_VERSION,
            warnings=warnings,
            suppressed_app_only_nodes=(),
            nodes_without_evidence=tuple(node.id for node in nodes if node.evidence_count == 0),
            verified_node_count=sum(1 for node in nodes if node.status == "verified"),
            insufficient_node_count=sum(1 for node in nodes if node.status == "insufficient"),
            unsupported_node_count=sum(1 for node in nodes if node.status == "unsupported"),
        )

    def _safe_file_record(self, path: str):
        try:
            return self._reader.get_file(path)
        except SourceReadError:
            return None


def _overview_regions(overview: SystemOverview, store: InMemoryRunStore) -> tuple[SourceRegion, ...]:
    regions: list[SourceRegion] = []
    for raw in overview.important_regions:
        region_id = raw.get("source_region_id")
        region = store.get_region(str(region_id or ""))
        if region:
            regions.append(region)
    for claim in overview.claims:
        for region in _regions_from_claim(claim, store):
            if region.id not in {existing.id for existing in regions}:
                regions.append(region)
    return tuple(regions)


def _regions_from_claim(claim: GroundedClaim, store: InMemoryRunStore) -> tuple[SourceRegion, ...]:
    regions: list[SourceRegion] = []
    for validation in claim.citations:
        if validation.resolved_region_id:
            region = store.get_region(validation.resolved_region_id)
            if region:
                regions.append(region)
    return tuple(regions)


def _node_status(support_status: str, has_evidence: bool, overview_status: str) -> ArchitectureMapStatus:
    if overview_status == "degraded_no_llm":
        return "insufficient"
    if support_status == "orientation_only":
        return "candidate"
    if support_status == "unsupported":
        return "unsupported"
    if has_evidence:
        return "verified"
    return "insufficient"


def _node_kind(component: OverviewComponent) -> str:
    label = f"{component.label} {component.kind}".lower()
    if any(term in label for term in ("external", "transport", "provider", "api client")):
        return "external_boundary"
    if any(term in label for term in ("auth", "config", "observability", "logging")):
        return "cross_cutting"
    return "component"


def _relationship_kind(label: str) -> str:
    normalized = "_".join(label.lower().strip().split())
    return normalized or "dependency"


def _child_node_kind(child: LensChildComponent) -> str:
    if child.kind == "code_group":
        return "code_group"
    label = f"{child.label} {child.kind}".lower()
    if any(term in label for term in ("transport", "external", "boundary", "provider")):
        return "external_boundary"
    if any(term in label for term in ("auth", "config", "logging", "observability")):
        return "cross_cutting"
    return "subsystem"


def component_level(_: OverviewComponent) -> int:
    return 1


def _component_description(component: OverviewComponent, evidence: tuple[ArchitectureMapEvidence, ...]) -> str:
    if component.responsibilities:
        return " ".join(component.responsibilities[:2])
    if evidence:
        return f"{component.label} is backed by {len(evidence)} source evidence item(s)."
    return f"{component.label} appears in the System Overview, but needs deeper investigation for source-backed detail."


def _child_description(child: LensChildComponent, evidence: tuple[ArchitectureMapEvidence, ...]) -> str:
    if child.responsibilities:
        return " ".join(child.responsibilities[:2])
    if evidence:
        return f"{child.label} is backed by {len(evidence)} source evidence item(s)."
    return f"{child.label} was identified in a focused drilldown, but needs stronger source evidence."


def _region_matches_component(region: SourceRegion, component: OverviewComponent) -> bool:
    related_paths = {path.lower() for path in component.related_file_paths}
    if related_paths and region.path.lower() in related_paths:
        return True
    haystack = f"{component.label} {component.summary} {' '.join(component.responsibilities)}".lower()
    path = region.path.lower()
    keyword_paths = [
        (("api", "public", "convenience", "request"), ("_api", "__init__", "/api", "request")),
        (("client", "lifecycle", "sync", "async"), ("client", "session")),
        (("transport", "adapter", "boundary"), ("transport", "adapter")),
        (("auth", "cookie"), ("auth", "cookie")),
        (("model", "request", "response"), ("model", "request", "response")),
        (("config", "timeout", "limit"), ("config", "timeout", "limit")),
        (("url",), ("url",)),
        (("content", "decoder", "multipart"), ("content", "decoder", "multipart")),
        (("cli", "command"), ("_main", "cli", "command")),
        (("route", "backend", "api"), ("route", "router", "endpoint")),
        (("frontend", "screen", "page"), ("frontend", "page", ".svelte", ".tsx")),
        (("deployment", "infra"), ("docker", "compose", "deploy", "k8s")),
    ]
    for label_terms, path_terms in keyword_paths:
        if any(term in haystack for term in label_terms) and any(term in path for term in path_terms):
            return True
    leaf = path.rsplit("/", 1)[-1].rsplit(".", 1)[0].strip("_-")
    return bool(leaf and leaf in haystack)


def _confidence(value: dict[str, Any]) -> float | None:
    try:
        return float(value.get("confidence"))
    except (AttributeError, TypeError, ValueError):
        return None


def _preview(text: str, limit: int = 360) -> str:
    return " ".join(text.strip().split())[:limit]


def _dedupe(values) -> tuple[str, ...]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value or "").strip()
        if text and text not in seen:
            seen.add(text)
            output.append(text)
    return tuple(output)


def _stable_id(prefix: str, *parts: str) -> str:
    raw = "|".join(str(part) for part in parts)
    return f"{prefix}:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"
