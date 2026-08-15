"""System overview DTOs."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from syntax_tree_refurbished.api.dto.grounding import GroundedClaimDTO
from syntax_tree_refurbished.core.models.system_overview import (
    OverviewComponent,
    OverviewRelationship,
    SystemOverview,
    SystemOverviewMetrics,
)


class OverviewComponentDTO(BaseModel):
    id: str
    label: str
    kind: str
    summary: str
    responsibilities: list[str]
    source_region_ids: list[str]
    anchor_ids: list[str]
    related_file_paths: list[str]
    support_status: str
    confidence: float
    children_hint: list[str]

    @classmethod
    def from_domain(cls, component: OverviewComponent) -> "OverviewComponentDTO":
        return cls(
            id=component.id,
            label=component.label,
            kind=component.kind,
            summary=component.summary,
            responsibilities=list(component.responsibilities),
            source_region_ids=list(component.source_region_ids),
            anchor_ids=list(component.anchor_ids),
            related_file_paths=list(component.related_file_paths),
            support_status=component.support_status,
            confidence=component.confidence,
            children_hint=list(component.children_hint),
        )


class OverviewRelationshipDTO(BaseModel):
    from_component_id: str
    to_component_id: str
    label: str
    summary: str
    source_region_ids: list[str]
    support_status: str

    @classmethod
    def from_domain(cls, relationship: OverviewRelationship) -> "OverviewRelationshipDTO":
        return cls(
            from_component_id=relationship.from_component_id,
            to_component_id=relationship.to_component_id,
            label=relationship.label,
            summary=relationship.summary,
            source_region_ids=list(relationship.source_region_ids),
            support_status=relationship.support_status,
        )


class SystemOverviewMetricsDTO(BaseModel):
    cached: bool
    llm_used: bool
    model: str
    latency_ms: int
    tool_calls: int
    regions_returned: int
    tokens_in: int
    tokens_out: int
    input_hash: str

    @classmethod
    def from_domain(cls, metrics: SystemOverviewMetrics) -> "SystemOverviewMetricsDTO":
        return cls(**metrics.__dict__)


class SystemOverviewResponse(BaseModel):
    id: str
    analysis_run_id: str
    input_hash: str
    status: str
    repo_identity: dict[str, Any]
    repo_shape: dict[str, Any]
    summary: str
    main_components: list[OverviewComponentDTO]
    relationships: list[OverviewRelationshipDTO]
    semantic_anchors: list[dict[str, Any]]
    important_files: list[str]
    important_regions: list[dict[str, Any]]
    claims: list[GroundedClaimDTO]
    orientation_notes: list[dict[str, Any]]
    gaps: list[str]
    suggested_questions: list[str]
    suggested_lenses: list[dict[str, Any]]
    investigation_summaries: list[dict[str, Any]]
    metrics: SystemOverviewMetricsDTO
    created_at: datetime

    @classmethod
    def from_domain(cls, overview: SystemOverview) -> "SystemOverviewResponse":
        return cls(
            id=overview.id,
            analysis_run_id=overview.analysis_run_id,
            input_hash=overview.input_hash,
            status=overview.status,
            repo_identity=overview.repo_identity,
            repo_shape=overview.repo_shape,
            summary=overview.summary,
            main_components=[OverviewComponentDTO.from_domain(item) for item in overview.main_components],
            relationships=[OverviewRelationshipDTO.from_domain(item) for item in overview.relationships],
            semantic_anchors=list(overview.semantic_anchors),
            important_files=list(overview.important_files),
            important_regions=list(overview.important_regions),
            claims=[GroundedClaimDTO.from_domain(claim) for claim in overview.claims],
            orientation_notes=list(overview.orientation_notes),
            gaps=list(overview.gaps),
            suggested_questions=list(overview.suggested_questions),
            suggested_lenses=list(overview.suggested_lenses),
            investigation_summaries=list(overview.investigation_summaries),
            metrics=SystemOverviewMetricsDTO.from_domain(overview.metrics),
            created_at=overview.created_at,
        )

