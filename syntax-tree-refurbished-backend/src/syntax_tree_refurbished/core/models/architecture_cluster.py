"""Versioned, deterministic relation-derived cluster contracts.

These are structural derivations, not verifier-backed architectural claims.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ARCHITECTURE_CLUSTER_SCHEMA_VERSION = "architecture-clusters/v1"
CLUSTER_ALGORITHM = "bridge-separated-affinity-components/v1"
ClusterRelationKind = Literal["contains", "imports", "calls", "inherits"]


@dataclass(frozen=True)
class ArchitectureRelationCluster:
    id: str
    analysis_run_id: str
    containing_structural_group_id: str
    display_name: str
    member_module_ids: tuple[str, ...]
    member_count: int
    internal_relation_count: int
    internal_relation_kind_counts: tuple[tuple[ClusterRelationKind, int], ...]
    boundary_relation_count: int
    boundary_relation_kind_counts: tuple[tuple[ClusterRelationKind, int], ...]
    contributing_relation_ids: tuple[str, ...]
    algorithm: str


@dataclass(frozen=True)
class ArchitectureClusterResidual:
    """Members not placed in a useful recovered relation cluster."""
    containing_structural_group_id: str
    member_module_ids: tuple[str, ...]
    reason: Literal["region_too_small", "no_internal_resolved_relations", "insufficient_relation_core"]
    member_reasons: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class ArchitectureClusterEdge:
    """Future-G3-ready directed, per-kind aggregate with raw relation provenance."""
    source_cluster_id: str
    target_cluster_id: str
    relation_kind: ClusterRelationKind
    member_relation_count: int
    contributing_member_pairs: tuple[tuple[str, str], ...]
    contributing_relation_ids: tuple[str, ...]


@dataclass(frozen=True)
class ArchitectureClusterProjection:
    schema_version: str
    analysis_run_id: str
    algorithm: str
    clusters: tuple[ArchitectureRelationCluster, ...]
    residuals: tuple[ArchitectureClusterResidual, ...]
    cluster_edges: tuple[ArchitectureClusterEdge, ...]
