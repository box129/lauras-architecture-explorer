"""Investigation API DTOs."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from syntax_tree_refurbished.api.dto.grounding import GroundedClaimDTO
from syntax_tree_refurbished.core.models.investigation import (
    InvestigationAnswer,
    InvestigationBudget,
    InvestigationFocus,
    InvestigationMetrics,
    InvestigationRequest,
    InvestigationResult,
    ToolTraceEntry,
)


class InvestigationBudgetDTO(BaseModel):
    max_tool_calls: int = Field(default=24, ge=1, le=80)
    max_source_regions: int = Field(default=18, ge=1, le=80)
    max_tokens: int = Field(default=24_000, ge=2000, le=120_000)
    timeout_seconds: int = Field(default=90, ge=5, le=600)

    def to_domain(self) -> InvestigationBudget:
        return InvestigationBudget(
            max_tool_calls=self.max_tool_calls,
            max_source_regions=self.max_source_regions,
            max_tokens=self.max_tokens,
            timeout_seconds=self.timeout_seconds,
        )


class InvestigationFocusDTO(BaseModel):
    anchor_ids: list[str] = Field(default_factory=list)
    file_paths: list[str] = Field(default_factory=list)
    symbol_ids: list[str] = Field(default_factory=list)

    def to_domain(self) -> InvestigationFocus:
        return InvestigationFocus(
            anchor_ids=tuple(self.anchor_ids),
            file_paths=tuple(self.file_paths),
            symbol_ids=tuple(self.symbol_ids),
        )


class InvestigateRequestDTO(BaseModel):
    run_id: str | None = None
    question: str = Field(min_length=1)
    mode: str = "focused_question"
    focus: InvestigationFocusDTO = Field(default_factory=InvestigationFocusDTO)
    budget: InvestigationBudgetDTO = Field(default_factory=InvestigationBudgetDTO)
    validation_mode: bool = False

    def to_domain(self, run_id: str) -> InvestigationRequest:
        return InvestigationRequest(
            run_id=run_id,
            question=self.question,
            mode=self.mode,  # type: ignore[arg-type]
            focus=self.focus.to_domain(),
            budget=self.budget.to_domain(),
            validation_mode=self.validation_mode,
        )


class InvestigationAnswerDTO(BaseModel):
    summary: str
    simple_explanation: str
    technical_explanation: str

    @classmethod
    def from_domain(cls, answer: InvestigationAnswer) -> "InvestigationAnswerDTO":
        return cls(
            summary=answer.summary,
            simple_explanation=answer.simple_explanation,
            technical_explanation=answer.technical_explanation,
        )


class ToolTraceEntryDTO(BaseModel):
    index: int
    tool: str
    args: dict[str, Any]
    reason: str
    status: str
    result_count: int
    returned_region_ids: list[str]
    observation: str

    @classmethod
    def from_domain(cls, entry: ToolTraceEntry) -> "ToolTraceEntryDTO":
        return cls(
            index=entry.index,
            tool=entry.tool,
            args=entry.args,
            reason=entry.reason,
            status=entry.status,
            result_count=entry.result_count,
            returned_region_ids=list(entry.returned_region_ids),
            observation=entry.observation,
        )


class InvestigationMetricsDTO(BaseModel):
    llm_used: bool
    model: str
    tool_calls: int
    regions_returned: int
    tokens_in: int
    tokens_out: int
    latency_ms: int
    fallback_reason: str | None

    @classmethod
    def from_domain(cls, metrics: InvestigationMetrics) -> "InvestigationMetricsDTO":
        return cls(**metrics.__dict__)


class InvestigateResponseDTO(BaseModel):
    analysis_run_id: str
    status: str
    question: str
    mode: str
    answer: InvestigationAnswerDTO
    resolved_hypotheses: list[dict[str, Any]]
    rejected_hypotheses: list[dict[str, Any]]
    remaining_uncertainties: list[dict[str, Any]]
    component_hypotheses: list[dict[str, Any]]
    relationships: list[dict[str, Any]]
    claims: list[GroundedClaimDTO]
    important_regions: list[dict[str, Any]]
    suggested_next_questions: list[str]
    tool_trace: list[ToolTraceEntryDTO]
    gaps: list[str]
    metrics: InvestigationMetricsDTO
    metadata: dict[str, Any]

    @classmethod
    def from_domain(cls, result: InvestigationResult) -> "InvestigateResponseDTO":
        return cls(
            analysis_run_id=result.run_id,
            status=result.status,
            question=result.question,
            mode=result.mode,
            answer=InvestigationAnswerDTO.from_domain(result.answer),
            resolved_hypotheses=list(result.resolved_hypotheses),
            rejected_hypotheses=list(result.rejected_hypotheses),
            remaining_uncertainties=list(result.remaining_uncertainties),
            component_hypotheses=list(result.component_hypotheses),
            relationships=list(result.relationships),
            claims=[GroundedClaimDTO.from_domain(claim) for claim in result.claims],
            important_regions=list(result.important_regions),
            suggested_next_questions=list(result.suggested_next_questions),
            tool_trace=[ToolTraceEntryDTO.from_domain(entry) for entry in result.tool_trace],
            gaps=list(result.gaps),
            metrics=InvestigationMetricsDTO.from_domain(result.metrics),
            metadata=result.metadata,
        )
