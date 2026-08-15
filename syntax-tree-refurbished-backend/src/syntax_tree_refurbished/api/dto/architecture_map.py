"""Architecture-map compatibility DTOs."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from syntax_tree_refurbished.core.models.architecture_map import (
    ArchitectureMapDiagnostics,
    ArchitectureMapEdge,
    ArchitectureMapEvidence,
    ArchitectureMapNode,
    ArchitectureMapProjection,
    ImplementationHighlight,
    ImplementationSlice,
    ImplementationSourceTab,
)


class ArchitectureMapNodeDTO(BaseModel):
    id: str
    analysis_run_id: str
    label: str
    kind: str
    level: int
    description: str
    status: str
    confidence: float | None
    source_refs: dict[str, list[Any]]
    evidence_count: int
    children_count: int
    can_drilldown: bool
    primary_files: list[str]
    related_concept_ids: list[str]
    related_flow_ids: list[str]
    graph_qn: str | None
    legacy_type: str | None
    warnings: list[str]
    unsupported_reason: str | None
    parent_group_id: str | None = None

    @classmethod
    def from_domain(cls, node: ArchitectureMapNode) -> "ArchitectureMapNodeDTO":
        return cls(
            id=node.id,
            analysis_run_id=node.analysis_run_id,
            label=node.label,
            kind=node.kind,
            level=node.level,
            description=node.description,
            status=node.status,
            confidence=node.confidence,
            source_refs=node.source_refs,
            evidence_count=node.evidence_count,
            children_count=node.children_count,
            can_drilldown=node.can_drilldown,
            primary_files=list(node.primary_files),
            related_concept_ids=list(node.related_concept_ids),
            related_flow_ids=list(node.related_flow_ids),
            graph_qn=node.graph_qn,
            legacy_type=node.legacy_type,
            warnings=list(node.warnings),
            unsupported_reason=node.unsupported_reason,
            parent_group_id=node.parent_group_id,
        )


class ArchitectureMapEdgeDTO(BaseModel):
    id: str
    analysis_run_id: str
    source: str
    target: str
    kind: str
    label: str | None
    confidence: float | None
    source_refs: dict[str, list[Any]]

    @classmethod
    def from_domain(cls, edge: ArchitectureMapEdge) -> "ArchitectureMapEdgeDTO":
        return cls(**edge.__dict__)


class ArchitectureMapDiagnosticsDTO(BaseModel):
    repo_shape: str | None
    projection_version: str
    warnings: list[str]
    suppressed_app_only_nodes: list[str]
    nodes_without_evidence: list[str]
    verified_node_count: int
    insufficient_node_count: int
    unsupported_node_count: int

    @classmethod
    def from_domain(cls, diagnostics: ArchitectureMapDiagnostics) -> "ArchitectureMapDiagnosticsDTO":
        return cls(
            repo_shape=diagnostics.repo_shape,
            projection_version=diagnostics.projection_version,
            warnings=list(diagnostics.warnings),
            suppressed_app_only_nodes=list(diagnostics.suppressed_app_only_nodes),
            nodes_without_evidence=list(diagnostics.nodes_without_evidence),
            verified_node_count=diagnostics.verified_node_count,
            insufficient_node_count=diagnostics.insufficient_node_count,
            unsupported_node_count=diagnostics.unsupported_node_count,
        )


class ArchitectureMapResponse(BaseModel):
    analysis_run_id: str
    root: ArchitectureMapNodeDTO
    nodes: list[ArchitectureMapNodeDTO]
    edges: list[ArchitectureMapEdgeDTO]
    diagnostics: ArchitectureMapDiagnosticsDTO
    metadata: dict[str, Any]

    @classmethod
    def from_domain(cls, projection: ArchitectureMapProjection) -> "ArchitectureMapResponse":
        return cls(
            analysis_run_id=projection.analysis_run_id,
            root=ArchitectureMapNodeDTO.from_domain(projection.root),
            nodes=[ArchitectureMapNodeDTO.from_domain(node) for node in projection.nodes],
            edges=[ArchitectureMapEdgeDTO.from_domain(edge) for edge in projection.edges],
            diagnostics=ArchitectureMapDiagnosticsDTO.from_domain(projection.diagnostics),
            metadata=projection.metadata,
        )


class ArchitectureMapChildrenResponse(BaseModel):
    analysis_run_id: str
    node_id: str
    children: list[ArchitectureMapNodeDTO]
    edges: list[ArchitectureMapEdgeDTO]
    total: int


class ArchitectureMapNeighborhoodResponse(BaseModel):
    """One-hop neighborhood of a single node via real recovered relations
    (imports/calls/inherits/contains), independent of parent/child
    containment -- see ArchitectureMapProjector.neighborhood(). Backs the
    Entity Focus navigation state.
    """

    analysis_run_id: str
    node_id: str
    dependencies: list[ArchitectureMapNodeDTO]
    dependents: list[ArchitectureMapNodeDTO]
    edges: list[ArchitectureMapEdgeDTO]


class ArchitectureMapEvidenceDTO(BaseModel):
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
    status: str
    confidence: float | None
    score: float
    reason: str
    is_stale: bool

    @classmethod
    def from_domain(cls, evidence: ArchitectureMapEvidence) -> "ArchitectureMapEvidenceDTO":
        return cls(**evidence.__dict__)


class ArchitectureMapEvidenceResponse(BaseModel):
    analysis_run_id: str
    node_id: str
    node: ArchitectureMapNodeDTO
    evidence: list[ArchitectureMapEvidenceDTO]
    total: int
    limit: int


class ExplanationClaimDTO(BaseModel):
    text: str
    support: str
    evidence_ids: list[str]


class ExplanationFileDTO(BaseModel):
    file_path: str
    reason: str
    evidence_ids: list[str]


class ExplanationRelationshipDTO(BaseModel):
    label: str
    reason: str
    target_id: str


class ArchitectureNodeExplanationDTO(BaseModel):
    analysis_run_id: str
    node_id: str
    status: str
    generation_status: str
    model: str
    summary: str
    simple_explanation: str
    technical_explanation: str
    responsibilities: list[ExplanationClaimDTO]
    what_happens: list[ExplanationClaimDTO]
    key_files: list[ExplanationFileDTO]
    relationships: list[ExplanationRelationshipDTO]
    gaps: list[str]
    warnings: list[str]
    suggested_questions: list[str]
    evidence_ids: list[str]
    prompt_hash: str
    input_hash: str
    reason: str | None = None


class ImplementationHighlightDTO(BaseModel):
    span_id: str
    start_line: int
    end_line: int
    status: str
    confidence: float | None

    @classmethod
    def from_domain(cls, highlight: ImplementationHighlight) -> "ImplementationHighlightDTO":
        return cls(**highlight.__dict__)


class ImplementationSourceTabDTO(BaseModel):
    file_path: str
    language: str
    role: str
    summary: str
    reason: str
    source_span_ids: list[str]
    highlights: list[ImplementationHighlightDTO]
    is_stale: bool

    @classmethod
    def from_domain(cls, tab: ImplementationSourceTab) -> "ImplementationSourceTabDTO":
        return cls(
            file_path=tab.file_path,
            language=tab.language,
            role=tab.role,
            summary=tab.summary,
            reason=tab.reason,
            source_span_ids=list(tab.source_span_ids),
            highlights=[ImplementationHighlightDTO.from_domain(item) for item in tab.highlights],
            is_stale=tab.is_stale,
        )


class ImplementationSliceDTO(BaseModel):
    analysis_run_id: str
    node_id: str
    status: str
    subject: dict[str, str] | None
    title: str
    summary: str
    primary_span_id: str
    evidence_strength: float
    tabs: list[ImplementationSourceTabDTO]
    gaps: list[str]
    unsupported_reason: str
    warnings: list[str]

    @classmethod
    def from_domain(cls, slice_: ImplementationSlice) -> "ImplementationSliceDTO":
        return cls(
            analysis_run_id=slice_.analysis_run_id,
            node_id=slice_.node_id,
            status=slice_.status,
            subject=slice_.subject,
            title=slice_.title,
            summary=slice_.summary,
            primary_span_id=slice_.primary_span_id,
            evidence_strength=slice_.evidence_strength,
            tabs=[ImplementationSourceTabDTO.from_domain(tab) for tab in slice_.tabs],
            gaps=list(slice_.gaps),
            unsupported_reason=slice_.unsupported_reason,
            warnings=list(slice_.warnings),
        )
