"""Orientation inventory routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from syntax_tree_refurbished.api.dto.orientation import (
    OrientationInventoryResponse,
    OrientationItemDTO,
    RunOrientationSummaryResponse,
)
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore


router = APIRouter(tags=["orientation"])


@router.get("/runs/{run_id}/orientation-inventory", response_model=OrientationInventoryResponse)
def orientation_inventory(run_id: str, request: Request) -> OrientationInventoryResponse:
    job = _resolve_run(request, run_id)
    items = _store(request).get_orientation_items(job.run_id)
    return OrientationInventoryResponse(
        analysis_run_id=job.run_id,
        items=[OrientationItemDTO.from_domain(item) for item in items],
        total=len(items),
        guidance_only_count=sum(1 for item in items if item.trust_level == "guidance_only"),
        proof_allowed_count=sum(1 for item in items if item.proof_allowed),
    )


@router.get("/runs/{run_id}/orientation", response_model=RunOrientationSummaryResponse)
def run_orientation(run_id: str, request: Request) -> RunOrientationSummaryResponse:
    job = _resolve_run(request, run_id)
    snapshot = job.snapshot
    if not snapshot:
        raise HTTPException(status_code=409, detail="Repo snapshot is not ready.")
    items = _store(request).get_orientation_items(job.run_id)
    top = items[:5]
    return RunOrientationSummaryResponse(
        analysis_run_id=job.run_id,
        repo_id=job.run_id,
        repository_name=snapshot.repo_name,
        repository_path=snapshot.repo_path,
        status="ready",
        summary=_summary(snapshot.repo_name, top),
        duration_ms=0,
        repo_shape={
            "kind": "snapshot_orientation",
            "label": "Snapshot orientation",
            "confidence": 0.5,
            "evidence": [item.path for item in top],
            "signals": {"orientation_items": len(items)},
        },
        counts={
            "files": snapshot.file_count,
            "orientation_items": len(items),
            "manifests": len(snapshot.manifests),
        },
        languages=[
            {"language": item.language, "count": item.count}
            for item in snapshot.languages
        ],
        frameworks=[],
        areas=[],
        findings=[
            {
                "id": item.id,
                "category": "orientation",
                "label": item.title,
                "status": "candidate",
                "confidence": 0.5,
                "description": item.summary,
                "file_paths": [item.path],
                "evidence": [],
                "sort_order": index,
            }
            for index, item in enumerate(top)
        ],
        suggested_reading=[
            {"path": item.path, "reason": f"{item.kind} guidance-only material, not proof.", "priority": index + 1, "confidence": 0.5}
            for index, item in enumerate(top)
        ],
        unknowns=[],
        warnings=["Orientation material is guidance-only and does not verify runtime behavior."],
    )


def _summary(repo_name: str, items) -> str:
    if not items:
        return f"{repo_name} has no orientation inventory yet."
    return f"{repo_name} has {len(items)} high-priority orientation files available as guidance-only context."


def _resolve_run(request: Request, run_id: str) -> AnalysisJob:
    job = _store(request).get_run(run_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis run not found.")
    if not job.snapshot:
        raise HTTPException(status_code=409, detail="Repo snapshot is not ready.")
    return job


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store
