"""Analysis API DTOs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob


class AnalyzeRequest(BaseModel):
    repository_path: str = Field(min_length=1)
    analysis_mode: str = "standard"
    require_llm: bool = False
    comprehension_mode: str = "agentic"
    budget_profile: str = "strict"
    scope: str = "full_repo"
    model: str | None = None


class AnalyzeResponse(BaseModel):
    job_id: str
    run_id: str
    status: str


class AnalysisProgressDTO(BaseModel):
    stage: str
    total_files: int
    files_parsed: int
    files_total: int
    can_render_frontend: bool


class AnalysisStatusResponse(BaseModel):
    job_id: str
    analysis_run_id: str
    status: Literal["queued", "running", "completed", "failed"]
    stage: str
    repository_path: str
    error: str
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    progress: AnalysisProgressDTO
    run_metadata: dict[str, object]

    @classmethod
    def from_job(cls, job: AnalysisJob) -> "AnalysisStatusResponse":
        total = job.snapshot.file_count if job.snapshot else 0
        return cls(
            job_id=job.job_id,
            analysis_run_id=job.run_id,
            status=job.status,
            stage=job.stage,
            repository_path=job.repository_path,
            error=job.error,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            progress=AnalysisProgressDTO(
                stage=job.stage,
                total_files=total,
                files_parsed=total if job.status == "completed" else 0,
                files_total=total,
                can_render_frontend=job.status == "completed",
            ),
            run_metadata={
                "analysis_run_id": job.run_id,
                "repository_path": job.repository_path,
                "comprehension_mode": "refurbished",
                "scope": "snapshot",
                "llm_active": False,
                "fallback_used": False,
            },
        )

