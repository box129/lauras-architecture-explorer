"""System overview / architecture brief domain models."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

from syntax_tree_refurbished.core.models.grounding import GroundedClaim


OverviewStatus = Literal["ready", "partial", "degraded_no_llm", "failed"]

# Cache-identity discriminator (see SystemOverviewGenerator.get_or_generate
# and build_overview_input_hash): "no_model" for anything produced without
# a genuine successful LLM investigation (NoConfiguredModel, or a live
# model that was attempted but never produced a usable reply -- both are
# the same deterministic, source-backed content in substance); "live_model"
# only for an overview actually built from a successful investigation
# (investigation.metrics.llm_used is True). This is part of the cache key
# (folded into input_hash) specifically so a cache entry produced under one
# mode can never be silently served back for the other mode.
GenerationMode = Literal["no_model", "live_model"]


@dataclass(frozen=True)
class OverviewComponent:
    id: str
    label: str
    kind: str
    summary: str
    responsibilities: tuple[str, ...]
    source_region_ids: tuple[str, ...]
    anchor_ids: tuple[str, ...]
    related_file_paths: tuple[str, ...]
    support_status: str
    confidence: float
    children_hint: tuple[str, ...] = ()


@dataclass(frozen=True)
class OverviewRelationship:
    from_component_id: str
    to_component_id: str
    label: str
    summary: str
    source_region_ids: tuple[str, ...]
    support_status: str


@dataclass(frozen=True)
class SystemOverviewMetrics:
    cached: bool
    llm_used: bool
    model: str
    latency_ms: int
    tool_calls: int
    regions_returned: int
    tokens_in: int
    tokens_out: int
    input_hash: str
    generation_mode: GenerationMode


@dataclass(frozen=True)
class SystemOverview:
    id: str
    analysis_run_id: str
    input_hash: str
    status: OverviewStatus
    repo_identity: dict[str, Any]
    repo_shape: dict[str, Any]
    summary: str
    main_components: tuple[OverviewComponent, ...]
    relationships: tuple[OverviewRelationship, ...]
    semantic_anchors: tuple[dict[str, Any], ...]
    important_files: tuple[str, ...]
    important_regions: tuple[dict[str, Any], ...]
    claims: tuple[GroundedClaim, ...]
    orientation_notes: tuple[dict[str, Any], ...]
    gaps: tuple[str, ...]
    suggested_questions: tuple[str, ...]
    suggested_lenses: tuple[dict[str, Any], ...]
    investigation_summaries: tuple[dict[str, Any], ...]
    metrics: SystemOverviewMetrics
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

