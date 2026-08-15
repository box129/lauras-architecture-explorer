"""Parsed symbol and definition/reference routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from syntax_tree_refurbished.api.dto.source import SourceRegionDTO
from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.api.dto.symbols import (
    DefinitionHitDTO,
    FindDefinitionRequest,
    FindDefinitionResponse,
    FindReferencesRequest,
    FindReferencesResponse,
    ParsedSymbolDTO,
    ReferenceHitDTO,
    SymbolListResponse,
)
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.evidence.evidence_browser import EvidenceBrowser


router = APIRouter(tags=["symbols"])


@router.get("/runs/{run_id}/symbols", response_model=SymbolListResponse)
def run_symbols(run_id: str, request: Request, path: str | None = None) -> SymbolListResponse:
    job = _resolve_run(request, run_id)
    symbols = _store(request).get_symbols_for_file(run_id, path) if path else _store(request).get_symbols(run_id)
    return SymbolListResponse(
        analysis_run_id=job.run_id,
        symbols=[ParsedSymbolDTO.from_domain(symbol) for symbol in symbols],
        total=len(symbols),
    )


@router.get("/source/files/{path:path}/symbols", response_model=SymbolListResponse)
def file_symbols(path: str, request: Request, run_id: str | None = None) -> SymbolListResponse:
    job = _resolve_run(request, run_id)
    symbols = _store(request).get_symbols_for_file(job.run_id, path)
    return SymbolListResponse(
        analysis_run_id=job.run_id,
        symbols=[ParsedSymbolDTO.from_domain(symbol) for symbol in symbols],
        total=len(symbols),
    )


@router.post("/evidence/find-definition", response_model=FindDefinitionResponse)
def find_definition(payload: FindDefinitionRequest, request: Request) -> FindDefinitionResponse:
    job = _resolve_run(request, payload.run_id)
    hits = EvidenceBrowser(job, _store(request)).find_definition(
        query=payload.query,
        path=payload.path,
        limit=payload.limit,
    )
    for hit in hits:
        _store(request).put_region(hit.region)
    return FindDefinitionResponse(
        analysis_run_id=job.run_id,
        query=payload.query,
        hits=[
            DefinitionHitDTO(
                symbol=ParsedSymbolDTO.from_domain(hit.symbol),
                region=SourceRegionDTO.from_domain(hit.region),
                score=hit.score,
                method=hit.method,
            )
            for hit in hits
        ],
        total=len(hits),
    )


@router.post("/evidence/find-references", response_model=FindReferencesResponse)
def find_references(payload: FindReferencesRequest, request: Request) -> FindReferencesResponse:
    job = _resolve_run(request, payload.run_id)
    hits = EvidenceBrowser(job, _store(request)).find_references(
        query=payload.query,
        path=payload.path,
        limit=payload.limit,
    )
    for hit in hits:
        _store(request).put_region(hit.region)
    return FindReferencesResponse(
        analysis_run_id=job.run_id,
        query=payload.query,
        hits=[
            ReferenceHitDTO(
                region=SourceRegionDTO.from_domain(hit.region),
                matched_lines=list(hit.matched_lines),
                score=hit.score,
                method=hit.method,
            )
            for hit in hits
        ],
        total=len(hits),
    )


def _resolve_run(request: Request, run_id: str | None) -> AnalysisJob:
    return resolve_ready_run(request, run_id)


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store

