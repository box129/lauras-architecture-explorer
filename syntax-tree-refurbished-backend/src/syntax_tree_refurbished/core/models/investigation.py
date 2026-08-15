"""Investigation loop domain models."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from syntax_tree_refurbished.core.models.grounding import GroundedClaim


InvestigationMode = Literal["architecture_discovery", "focused_question", "component_drilldown"]
InvestigationStatus = Literal["completed", "partial", "failed", "degraded_no_llm"]


@dataclass(frozen=True)
class InvestigationBudget:
    max_tool_calls: int = 24
    max_source_regions: int = 18
    max_tokens: int = 24_000
    timeout_seconds: int = 90


@dataclass(frozen=True)
class InvestigationFocus:
    anchor_ids: tuple[str, ...] = ()
    file_paths: tuple[str, ...] = ()
    symbol_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class InvestigationRequest:
    run_id: str
    question: str
    mode: InvestigationMode
    focus: InvestigationFocus = field(default_factory=InvestigationFocus)
    budget: InvestigationBudget = field(default_factory=InvestigationBudget)
    validation_mode: bool = False


@dataclass(frozen=True)
class ToolTraceEntry:
    index: int
    tool: str
    args: dict[str, Any]
    reason: str
    status: str
    result_count: int
    returned_region_ids: tuple[str, ...]
    observation: str


@dataclass(frozen=True)
class InvestigationMetrics:
    llm_used: bool
    model: str
    tool_calls: int
    regions_returned: int
    tokens_in: int
    tokens_out: int
    latency_ms: int
    fallback_reason: str | None = None


@dataclass(frozen=True)
class InvestigationAnswer:
    summary: str
    simple_explanation: str
    technical_explanation: str


@dataclass(frozen=True)
class InvestigationResult:
    run_id: str
    status: InvestigationStatus
    question: str
    mode: InvestigationMode
    answer: InvestigationAnswer
    resolved_hypotheses: tuple[dict[str, Any], ...]
    rejected_hypotheses: tuple[dict[str, Any], ...]
    remaining_uncertainties: tuple[dict[str, Any], ...]
    component_hypotheses: tuple[dict[str, Any], ...]
    relationships: tuple[dict[str, Any], ...]
    claims: tuple[GroundedClaim, ...]
    important_regions: tuple[dict[str, Any], ...]
    suggested_next_questions: tuple[str, ...]
    tool_trace: tuple[ToolTraceEntry, ...]
    gaps: tuple[str, ...]
    metrics: InvestigationMetrics
    metadata: dict[str, Any] = field(default_factory=dict)
