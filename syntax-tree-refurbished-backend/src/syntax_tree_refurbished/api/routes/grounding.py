"""Grounding validation routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from syntax_tree_refurbished.api.dto.grounding import (
    GroundingValidationRequest,
    GroundingValidationResponse,
)
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.grounding.citation_validator import CitationValidator, GroundingError


router = APIRouter(tags=["grounding"])


@router.post("/grounding/validate", response_model=GroundingValidationResponse)
def validate_grounding(
    payload: GroundingValidationRequest,
    request: Request,
) -> GroundingValidationResponse:
    job = _resolve_run(request, payload.run_id)
    try:
        result = CitationValidator(job=job, store=_store(request)).validate_claims(
            tuple(claim.to_domain() for claim in payload.claims)
        )
    except GroundingError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return GroundingValidationResponse.from_domain(result)


def _resolve_run(request: Request, run_id: str | None) -> AnalysisJob:
    store = _store(request)
    resolved_run_id = run_id or store.active_run_id
    if not resolved_run_id:
        raise HTTPException(status_code=503, detail="No active analysis run.")
    job = store.get_run(resolved_run_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis run not found.")
    if not job.snapshot:
        raise HTTPException(status_code=409, detail="Repo snapshot is not ready.")
    return job


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store

