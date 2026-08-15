"""Semantic anchor DTOs."""

from __future__ import annotations

from pydantic import BaseModel

from syntax_tree_refurbished.core.models.semantic_anchor import SemanticAnchor


class SemanticAnchorDTO(BaseModel):
    id: str
    analysis_run_id: str
    kind: str
    label: str
    path: str
    start_line: int
    end_line: int
    source_region_id: str
    extraction_method: str
    confidence: float
    status: str
    related_symbol_ids: list[str]
    signals: list[str]
    summary: str

    @classmethod
    def from_domain(cls, anchor: SemanticAnchor) -> "SemanticAnchorDTO":
        return cls(
            id=anchor.id,
            analysis_run_id=anchor.run_id,
            kind=anchor.kind,
            label=anchor.label,
            path=anchor.path,
            start_line=anchor.start_line,
            end_line=anchor.end_line,
            source_region_id=anchor.source_region_id,
            extraction_method=anchor.extraction_method,
            confidence=anchor.confidence,
            status=anchor.status,
            related_symbol_ids=list(anchor.related_symbol_ids),
            signals=list(anchor.signals),
            summary=anchor.summary,
        )


class AnchorKindCountDTO(BaseModel):
    kind: str
    count: int


class SemanticAnchorListResponse(BaseModel):
    analysis_run_id: str
    anchors: list[SemanticAnchorDTO]
    total: int
    by_kind: list[AnchorKindCountDTO]

