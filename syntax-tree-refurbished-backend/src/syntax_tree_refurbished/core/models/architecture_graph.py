"""Versioned, deterministic architecture-graph projection models."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ARCHITECTURE_GRAPH_SCHEMA_VERSION = "architecture-graph/v2"
GraphRelationKind = Literal["contains", "imports", "calls", "inherits"]

@dataclass(frozen=True)
class ArchitectureGraphGroup:
    """Leaves list modules; containers list direct child groups."""
    id: str
    analysis_run_id: str
    label: str
    structural_path: str
    parent_group_id: str | None
    kind: Literal["structural_container", "structural_leaf", "root_file_bucket", "relation_cluster", "relation_residual", "module"]
    direct_member_module_ids: tuple[str, ...]
    direct_child_group_ids: tuple[str, ...]
    recursive_module_count: int
    can_drilldown: bool
    # G3 additions. These fields intentionally contain only G2-derived facts.
    cluster_id: str | None = None
    residual: bool = False
    internal_relation_count: int = 0
    internal_relation_kind_counts: tuple[tuple[str, int], ...] = ()
    boundary_relation_count: int = 0
    boundary_relation_kind_counts: tuple[tuple[str, int], ...] = ()
    algorithm: str | None = None

@dataclass(frozen=True)
class ArchitectureGraphInternalRelationCount:
    group_id: str
    relation_kind: GraphRelationKind
    member_relation_count: int

@dataclass(frozen=True)
class ArchitectureGraphAggregateEdge:
    """One directed, per-kind aggregate of resolved member relations only."""
    id: str
    analysis_run_id: str
    source_group_id: str
    target_group_id: str
    relation_kind: GraphRelationKind
    member_relation_count: int
    distinct_member_pair_count: int
    distinct_source_member_count: int
    distinct_target_member_count: int
    relation_ids_preview: tuple[str, ...]
    contributing_relation_count: int

@dataclass(frozen=True)
class ArchitectureGraphProjection:
    schema_version: str
    analysis_run_id: str
    groups: tuple[ArchitectureGraphGroup, ...]
    aggregate_edges: tuple[ArchitectureGraphAggregateEdge, ...]
    internal_relation_counts: tuple[ArchitectureGraphInternalRelationCount, ...]
