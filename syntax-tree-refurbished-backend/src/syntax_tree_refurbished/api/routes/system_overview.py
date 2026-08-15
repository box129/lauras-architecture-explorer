"""System overview routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from syntax_tree_refurbished.api.dto.system_overview import SystemOverviewResponse
from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel, NoConfiguredModel, make_live_model
from syntax_tree_refurbished.app.overview.system_overview_generator import SystemOverviewGenerator
from syntax_tree_refurbished.config import Settings


router = APIRouter(tags=["system-overview"])


@router.get("/system-overview", response_model=SystemOverviewResponse)
def active_system_overview(
    request: Request,
    run_id: str | None = None,
    validation_mode: bool = False,
) -> SystemOverviewResponse:
    job = _resolve_run(request, run_id)
    overview = SystemOverviewGenerator(
        job=job,
        store=_store(request),
        model=_model(request),
    ).get_or_generate(validation_mode=validation_mode)
    return SystemOverviewResponse.from_domain(overview)


@router.get("/runs/{run_id}/system-overview", response_model=SystemOverviewResponse)
def run_system_overview(
    run_id: str,
    request: Request,
    validation_mode: bool = False,
) -> SystemOverviewResponse:
    return active_system_overview(request=request, run_id=run_id, validation_mode=validation_mode)


def _resolve_run(request: Request, run_id: str | None) -> AnalysisJob:
    return resolve_ready_run(request, run_id)


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

