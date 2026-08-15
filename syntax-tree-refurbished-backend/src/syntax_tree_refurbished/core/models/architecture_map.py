"""Frontend-compatible architecture map projection models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


ArchitectureMapStatus = Literal["verified", "insufficient", "unsupported", "stale", "candidate", "legacy"]

ArchitectureMapNodeKind = Literal[
    "system",
    "product_area",
    "subsystem",
    "component",
    "code_group",
    "concept",
    "flow",
    "external_boundary",
    "cross_cutting",
    "diagnostic",
    # Deterministic structural-navigation fallback (see
    # app.architecture_map.structural_fallback) -- real directories/files,
    # never an LLM-inferred architectural classification. Kept as
    # distinct kind values specifically so the UI never presents these as
    # equivalent to an LLM-classified area.
    "structural_package",
    "structural_module",
    # Phase B: a deterministic, directory-containment grouping of an
    # otherwise-flat, file-shaped Overview (see
    # app.architecture_map.structural_fallback.group_overview_components).
    # Distinct from structural_package/structural_module above: those two
    # activate only when main_components is completely empty; this one
    # activates for the far more common case of a non-empty but flat
    # (one-node-per-file) Overview -- never an LLM-inferred architectural
    # domain.
    "structural_group",
]


@dataclass(frozen=True)
class ArchitectureMapNode:
    id: str
    analysis_run_id: str
    label: str
    kind: ArchitectureMapNodeKind
    level: int
    description: str
    status: ArchitectureMapStatus
    confidence: float | None
    source_refs: dict[str, list[Any]]
    evidence_count: int
    children_count: int
    can_drilldown: bool
    primary_files: tuple[str, ...]
    related_concept_ids: tuple[str, ...]
    related_flow_ids: tuple[str, ...]
    graph_qn: str | None
    legacy_type: str | None
    warnings: tuple[str, ...]
    unsupported_reason: str | None
    # Phase C1 (nested deterministic containment): the id of this node's
    # immediate structural-containment parent within the SAME eagerly
    # -returned node set (another structural_group), or None for a
    # top-level node. Optional/defaulted so every pre-C1 call site
    # constructing an ArchitectureMapNode is unaffected. Never used for
    # anything but real, deterministic directory containment -- see
    # app.architecture_map.structural_fallback.build_containment_hierarchy.
    parent_group_id: str | None = None


@dataclass(frozen=True)
class ArchitectureMapEdge:
    id: str
    analysis_run_id: str
    source: str
    target: str
    kind: str
    label: str | None
    confidence: float | None
    source_refs: dict[str, list[Any]]


@dataclass(frozen=True)
class ArchitectureMapDiagnostics:
    repo_shape: str | None
    projection_version: str
    warnings: tuple[str, ...]
    suppressed_app_only_nodes: tuple[str, ...]
    nodes_without_evidence: tuple[str, ...]
    verified_node_count: int
    insufficient_node_count: int
    unsupported_node_count: int


@dataclass(frozen=True)
class ArchitectureMapProjection:
    analysis_run_id: str
    overview_input_hash: str
    root: ArchitectureMapNode
    nodes: tuple[ArchitectureMapNode, ...]
    edges: tuple[ArchitectureMapEdge, ...]
    diagnostics: ArchitectureMapDiagnostics
    metadata: dict[str, Any]


@dataclass(frozen=True)
class ArchitectureMapEvidence:
    id: str
    analysis_run_id: str
    node_id: str
    evidence_kind: str
    source_ref_kind: str
    source_ref_id: str
    file_path: str
    language: str
    start_line: int
    end_line: int
    text_preview: str
    status: ArchitectureMapStatus
    confidence: float | None
    score: float
    reason: str
    is_stale: bool


@dataclass(frozen=True)
class ImplementationHighlight:
    span_id: str
    start_line: int
    end_line: int
    status: ArchitectureMapStatus
    confidence: float | None


@dataclass(frozen=True)
class ImplementationSourceTab:
    file_path: str
    language: str
    role: str
    summary: str
    reason: str
    source_span_ids: tuple[str, ...]
    highlights: tuple[ImplementationHighlight, ...]
    is_stale: bool


@dataclass(frozen=True)
class ImplementationSlice:
    analysis_run_id: str
    node_id: str
    status: ArchitectureMapStatus
    subject: dict[str, str] | None
    title: str
    summary: str
    primary_span_id: str
    evidence_strength: float
    tabs: tuple[ImplementationSourceTab, ...]
    gaps: tuple[str, ...]
    unsupported_reason: str
    warnings: tuple[str, ...]
