"""Resolve the analysis run explicitly selected by an API client."""

from __future__ import annotations

from fastapi import HTTPException, Request

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore


RUN_ID_HEADER = "X-Syntax-Tree-Run-Id"


def resolve_ready_run(request: Request, run_id: str | None = None) -> AnalysisJob:
    """Resolve query, header, then active run; never silently cross repositories."""
    store: InMemoryRunStore = request.app.state.run_store
    header_run_id = request.headers.get(RUN_ID_HEADER)
    resolved_run_id = run_id or header_run_id or store.active_run_id
    if not resolved_run_id:
        raise HTTPException(status_code=503, detail="No active analysis run.")
    job = store.get_run(resolved_run_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis run not found.")
    if job.status == "failed":
        raise HTTPException(status_code=409, detail="Analysis run failed and has no ready result.")
    if job.status != "completed":
        raise HTTPException(status_code=409, detail="Analysis run is not complete yet.")
    if not job.snapshot:
        raise HTTPException(status_code=409, detail="Repo snapshot is not ready.")
    return job
