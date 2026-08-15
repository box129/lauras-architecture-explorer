"""Focused lens artifacts for progressive drilldown and later question/docs flows."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

from syntax_tree_refurbished.core.models.grounding import GroundedClaim
from syntax_tree_refurbished.core.models.investigation import InvestigationMetrics


LensStatus = Literal["ready", "partial", "degraded_no_llm", "failed"]


@dataclass(frozen=True)
class LensChildComponent:
    id: str
    label: str
    kind: str
    summary: str
    responsibilities: tuple[str, ...]
    source_region_ids: tuple[str, ...]
    related_file_paths: tuple[str, ...]
    support_status: str
    confidence: float
    children_hint: tuple[str, ...] = ()


@dataclass(frozen=True)
class LensRelationship:
    from_child_id: str
    to_child_id: str
    label: str
    summary: str
    source_region_ids: tuple[str, ...]
    support_status: str


@dataclass(frozen=True)
class Lens:
    id: str
    analysis_run_id: str
    parent_node_id: str
    parent_component_id: str
    input_hash: str
    status: LensStatus
    title: str
    summary: str
    simple_explanation: str
    technical_explanation: str
    child_components: tuple[LensChildComponent, ...]
    relationships: tuple[LensRelationship, ...]
    claims: tuple[GroundedClaim, ...]
    important_regions: tuple[dict[str, object], ...]
    gaps: tuple[str, ...]
    suggested_questions: tuple[str, ...]
    metrics: InvestigationMetrics
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
