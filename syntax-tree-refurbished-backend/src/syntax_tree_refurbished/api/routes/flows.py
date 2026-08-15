"""Flow compatibility routes for the Observatory frontend."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore


router = APIRouter(tags=["flows"])


@router.get("/flows")
def list_flows(
    request: Request,
    run_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    resolved = _resolve_run_id(request, run_id)
    return {
        "analysis_run_id": resolved,
        "flows": [],
        "total": 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/flows/{flow_id:path}")
def get_flow(flow_id: str, request: Request, run_id: str | None = None) -> dict:
    _resolve_run_id(request, run_id)
    raise HTTPException(status_code=404, detail=f"Flow not found: {flow_id}")


def _resolve_run_id(request: Request, run_id: str | None) -> str:
    return resolve_ready_run(request, run_id).run_id


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store
