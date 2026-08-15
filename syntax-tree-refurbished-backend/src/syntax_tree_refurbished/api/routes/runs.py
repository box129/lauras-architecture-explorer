"""Run artifact routes — snapshot, metrics, stages."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from syntax_tree_refurbished.api.dto.snapshot import RepoSnapshotDTO
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore


router = APIRouter(tags=["runs"])


@router.get("/runs/{run_id}/snapshot", response_model=RepoSnapshotDTO)
def run_snapshot(run_id: str, request: Request) -> RepoSnapshotDTO:
    job = _store(request).get_run(run_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis run not found.")
    if not job.snapshot:
        raise HTTPException(status_code=409, detail="Repo snapshot is not ready.")
    return RepoSnapshotDTO.from_domain(job.snapshot)


@router.get("/runs/{run_id}/metrics")
def run_metrics(run_id: str, request: Request) -> dict:
    job = _store(request).get_run(run_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis run not found.")

    store = _store(request)
    stages = store.get_stages(run_id)
    overview = store.get_system_overview(run_id)

    failed = [s for s in stages if s.status == "failed"]
    llm_stages = [s for s in stages if s.tokens_in > 0 or s.tokens_out > 0]
    fallback_stages = [s for s in stages if s.fallback_reason]
    cache_hits = [s for s in stages if s.cache_hit]

    total_tokens_in = sum(s.tokens_in for s in stages)
    total_tokens_out = sum(s.tokens_out for s in stages)
    total_duration_ms = sum(s.duration_ms for s in stages)
    estimated_cost = _estimate_cost(total_tokens_in, total_tokens_out)

    bottlenecks = sorted(
        [{
            "stage": s.stage_name,
            "status": s.status,
            "duration_ms": s.duration_ms,
            "tokens_in": s.tokens_in,
            "tokens_out": s.tokens_out,
            "estimated_cost": _estimate_cost(s.tokens_in, s.tokens_out),
        } for s in stages if s.duration_ms > 0],
        key=lambda b: b["duration_ms"],
        reverse=True,
    )[:8]

    return {
        "analysis_run_id": run_id,
        "repo_id": getattr(job, "repo_id", ""),
        "repository_name": job.snapshot.repo_path if job.snapshot else "",
        "status": job.status,
        "duration_ms": total_duration_ms,
        "stage_count": len(stages),
        "failed_stage_count": len(failed),
        "warning_count": sum(len(s.warnings) for s in stages),
        "llm_stage_count": len(llm_stages),
        "fallback_stage_count": len(fallback_stages),
        "tokens_in": total_tokens_in,
        "tokens_out": total_tokens_out,
        "estimated_cost": estimated_cost,
        "db_size_bytes": 0,
        "graph": {
            "components": len(overview.main_components) if overview else 0,
            "claims": len(overview.claims) if overview else 0,
            "relationships": len(overview.relationships) if overview else 0,
        },
        "artifacts": {
            "stages": len(stages),
            "cache_hits": len(cache_hits),
            "fallbacks": len(fallback_stages),
        },
        "first_artifact_timings": [],
        "bottlenecks": bottlenecks,
        "failures": [{
            "id": s.stage_name,
            "stage": s.stage_name,
            "status": s.status,
            "duration_ms": s.duration_ms,
            "tokens_in": s.tokens_in,
            "tokens_out": s.tokens_out,
            "estimated_cost": _estimate_cost(s.tokens_in, s.tokens_out),
            "trace": {"error": s.error},
        } for s in failed],
        "warnings": [w for s in stages for w in s.warnings],
    }


@router.get("/runs/{run_id}/stages")
def run_stages(run_id: str, request: Request) -> dict:
    job = _store(request).get_run(run_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis run not found.")

    stages = _store(request).get_stages(run_id)
    status_counts: dict[str, int] = {}
    for s in stages:
        status_counts[s.status] = status_counts.get(s.status, 0) + 1

    current = "idle"
    for s in sorted(stages, key=lambda x: x.sort_order):
        if s.status == "running":
            current = s.stage_name
            break
    if current == "idle":
        for s in reversed(sorted(stages, key=lambda x: x.sort_order)):
            if s.status == "completed":
                current = s.stage_name
                break

    can_render = any(s.can_render_frontend for s in stages)

    return {
        "analysis_run_id": run_id,
        "current_stage": current,
        "status_counts": status_counts,
        "can_render_frontend": can_render,
        "stages": [{
            "id": s.stage_name,
            "analysis_run_id": run_id,
            "stage_name": s.stage_name,
            "display_name": s.display_name,
            "status": s.status,
            "sort_order": s.sort_order,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "finished_at": s.finished_at.isoformat() if s.finished_at else None,
            "artifact_refs": {},
            "blocking_error": s.error,
            "warnings": s.warnings,
            "can_render_frontend": s.can_render_frontend,
        } for s in sorted(stages, key=lambda x: x.sort_order)],
    }


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store


def _estimate_cost(tokens_in: int, tokens_out: int) -> float:
    return round((tokens_in * 3.0 + tokens_out * 15.0) / 1_000_000, 6)

