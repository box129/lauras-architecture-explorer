"""Orientation inventory DTOs."""

from __future__ import annotations

from pydantic import BaseModel

from syntax_tree_refurbished.core.models.orientation import OrientationItem


class OrientationItemDTO(BaseModel):
    id: str
    analysis_run_id: str
    path: str
    kind: str
    role: str
    trust_level: str
    title: str
    headings: list[str]
    signals: list[str]
    summary: str
    proof_allowed: bool

    @classmethod
    def from_domain(cls, item: OrientationItem) -> "OrientationItemDTO":
        return cls(
            id=item.id,
            analysis_run_id=item.run_id,
            path=item.path,
            kind=item.kind,
            role=item.role,
            trust_level=item.trust_level,
            title=item.title,
            headings=list(item.headings),
            signals=list(item.signals),
            summary=item.summary,
            proof_allowed=item.proof_allowed,
        )


class OrientationInventoryResponse(BaseModel):
    analysis_run_id: str
    items: list[OrientationItemDTO]
    total: int
    guidance_only_count: int
    proof_allowed_count: int


class RunOrientationSummaryResponse(BaseModel):
    analysis_run_id: str
    repo_id: str
    repository_name: str
    repository_path: str
    status: str
    summary: str
    duration_ms: int
    repo_shape: dict[str, object]
    counts: dict[str, int]
    languages: list[dict[str, object]]
    frameworks: list[dict[str, object]]
    areas: list[dict[str, object]]
    findings: list[dict[str, object]]
    suggested_reading: list[dict[str, object]]
    unknowns: list[dict[str, object]]
    warnings: list[str]

