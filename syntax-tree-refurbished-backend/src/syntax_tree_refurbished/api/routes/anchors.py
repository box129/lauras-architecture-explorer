"""Semantic anchor routes."""

from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, HTTPException, Request

from syntax_tree_refurbished.api.dto.anchors import (
    AnchorKindCountDTO,
    SemanticAnchorDTO,
    SemanticAnchorListResponse,
)
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore


router = APIRouter(tags=["anchors"])


@router.get("/runs/{run_id}/anchors", response_model=SemanticAnchorListResponse)
def run_anchors(run_id: str, request: Request, kind: str | None = None) -> SemanticAnchorListResponse:
    job = _resolve_run(request, run_id)
    anchors = _store(request).get_anchors(job.run_id)
    if kind:
        anchors = tuple(anchor for anchor in anchors if anchor.kind == kind)
    counts = Counter(anchor.kind for anchor in anchors)
    return SemanticAnchorListResponse(
        analysis_run_id=job.run_id,
        anchors=[SemanticAnchorDTO.from_domain(anchor) for anchor in anchors],
        total=len(anchors),
        by_kind=[
            AnchorKindCountDTO(kind=anchor_kind, count=count)
            for anchor_kind, count in sorted(counts.items())
        ],
    )


def _resolve_run(request: Request, run_id: str) -> AnalysisJob:
    job = _store(request).get_run(run_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis run not found.")
    if not job.snapshot:
        raise HTTPException(status_code=409, detail="Repo snapshot is not ready.")
    return job


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store

