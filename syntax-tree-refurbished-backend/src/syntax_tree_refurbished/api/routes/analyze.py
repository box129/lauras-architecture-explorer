"""Analysis routes."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, WebSocket, WebSocketDisconnect

from syntax_tree_refurbished.api.dto.analysis import (
    AnalysisStatusResponse,
    AnalyzeRequest,
    AnalyzeResponse,
)
from syntax_tree_refurbished.app.analysis.analysis_controller import AnalysisController
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.config import Settings


router = APIRouter(tags=["analysis"])


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    payload: AnalyzeRequest,
    request: Request,
    background_tasks: BackgroundTasks,
) -> AnalyzeResponse:
    controller = AnalysisController(settings=_settings(request), store=_store(request))
    job, created = controller.start_or_reuse(payload.repository_path)
    if created:
        background_tasks.add_task(controller.run, job)
    return AnalyzeResponse(job_id=job.job_id, run_id=job.run_id, status=job.status)


@router.get("/analyze/{job_id}/status", response_model=AnalysisStatusResponse)
def analysis_status(job_id: str, request: Request) -> AnalysisStatusResponse:
    job = _store(request).get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    return AnalysisStatusResponse.from_job(job)


@router.websocket("/ws/analyze/{job_id}")
async def analysis_progress(websocket: WebSocket, job_id: str) -> None:
    """Stream the same analysis status contract used by the polling endpoint."""
    await websocket.accept()
    store: InMemoryRunStore = websocket.app.state.run_store
    previous_payload: dict[str, object] | None = None

    try:
        while True:
            job = store.get_job(job_id)
            if job is None:
                await websocket.send_json(
                    {
                        "event": "error",
                        "data": {
                            "status": "failed",
                            "error": "Analysis job not found.",
                        },
                    }
                )
                await websocket.close(code=4404)
                return

            payload = AnalysisStatusResponse.from_job(job).model_dump(mode="json")
            if payload != previous_payload:
                await websocket.send_json({"event": "status_update", "data": payload})
                previous_payload = payload

            if job.status == "completed":
                await websocket.send_json({"event": "pipeline_complete", "data": payload})
                await websocket.close(code=1000)
                return
            if job.status == "failed":
                await websocket.send_json({"event": "error", "data": payload})
                await websocket.close(code=1011)
                return

            await asyncio.sleep(0.25)
    except WebSocketDisconnect:
        return


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store

