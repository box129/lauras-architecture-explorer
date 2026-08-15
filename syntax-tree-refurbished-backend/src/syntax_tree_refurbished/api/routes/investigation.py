"""Investigation routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from syntax_tree_refurbished.api.dto.investigation import InvestigateRequestDTO, InvestigateResponseDTO
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.investigation.engine import InvestigationEngine
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel, NoConfiguredModel, make_live_model
from syntax_tree_refurbished.config import Settings


router = APIRouter(tags=["investigation"])


@router.post("/investigate", response_model=InvestigateResponseDTO)
def investigate(payload: InvestigateRequestDTO, request: Request) -> InvestigateResponseDTO:
    job = _resolve_run(request, payload.run_id)
    model = _model(request)
    domain_request = payload.to_domain(job.run_id)
    result = InvestigationEngine(job=job, store=_store(request), model=model).investigate(domain_request)
    return InvestigateResponseDTO.from_domain(result)


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


def _model(request: Request) -> InvestigationModel:
    injected = getattr(request.app.state, "investigation_model", None)
    if injected is not None:
        return injected
    settings = _settings(request)
    if settings.environment == "test":
        return NoConfiguredModel()
    return make_live_model(settings)


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store
