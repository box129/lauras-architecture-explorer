"""Query endpoints — REST for Question Dock compatibility."""

from __future__ import annotations

import anyio
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from syntax_tree_refurbished.api.dto.architecture_map import (
    ArchitectureMapEvidenceDTO,
    ImplementationSliceDTO,
)
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel, NoConfiguredModel, make_live_model
from syntax_tree_refurbished.app.overview.system_overview_generator import SystemOverviewGenerator
from syntax_tree_refurbished.app.query.query_controller import QueryController
from syntax_tree_refurbished.app.query.query_lens_adapter import lens_to_question_lens_dto
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.system_overview import SystemOverview


class QueryRequest(BaseModel):
    question: str
    conversation_id: str | None = None


router = APIRouter(tags=["query"])


@router.post("/query")
async def query_post(request: Request, body: QueryRequest, run_id: str | None = None) -> dict:
    if not body.question.strip():
        raise HTTPException(status_code=422, detail="question must contain non-whitespace text.")
    controller = _controller(request, run_id)
    try:
        with anyio.fail_after(15):
            return await anyio.to_thread.run_sync(
                controller.answer,
                body.question,
                body.conversation_id,
                abandon_on_cancel=True,
            )
    except TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail="Repository query timed out after 15 seconds. You can retry or refine the question.",
        ) from exc


@router.get("/query-lenses/{lens_id:path}/evidence")
def get_query_lens_evidence(lens_id: str, request: Request, run_id: str | None = None) -> dict:
    controller = _controller(request, run_id)
    lens = controller.get_lens(lens_id)
    if not lens:
        raise HTTPException(status_code=404, detail="Question lens not found.")
    if isinstance(lens, dict):
        evidence = lens.get("evidence", [])
        return {
            "analysis_run_id": lens["analysis_run_id"],
            "lens_id": lens_id,
            "evidence": evidence,
            "total": len(evidence),
        }
    store = _store(request)
    evidence: list[dict] = []
    for claim in lens.claims:
        for citation in claim.citations:
            if not citation.resolved_region_id:
                continue
            region = store.get_region(citation.resolved_region_id)
            if not region:
                continue
            evidence.append({
                "id": f"evidence-{claim.claim.id}",
                "analysis_run_id": lens.analysis_run_id,
                "node_id": lens.parent_node_id,
                "evidence_kind": "claim",
                "source_ref_kind": "source_region",
                "source_ref_id": region.id,
                "file_path": region.path,
                "language": _region_language(region),
                "start_line": region.start_line,
                "end_line": region.end_line,
                "text_preview": _region_text(region)[:200],
                "status": claim.support_status,
                "confidence": claim.confidence,
                "score": claim.confidence,
                "reason": claim.claim.text,
                "is_stale": False,
            })
    return {
        "analysis_run_id": lens.analysis_run_id,
        "lens_id": lens_id,
        "evidence": [ArchitectureMapEvidenceDTO(**item).model_dump() for item in evidence],
        "total": len(evidence),
    }


@router.get("/query-lenses/{lens_id:path}/implementation")
def get_query_lens_implementation(
    lens_id: str,
    request: Request,
    run_id: str | None = None,
    max_tabs: int = 5,
    max_highlights: int = 20,
) -> dict:
    controller = _controller(request, run_id)
    lens = controller.get_lens(lens_id)
    if not lens:
        raise HTTPException(status_code=404, detail="Question lens not found.")
    job = _resolve_run(request, run_id)
    if isinstance(lens, dict):
        tabs = lens.get("source_tabs", [])
        primary_span = tabs[0]["source_span_ids"][0] if tabs and tabs[0].get("source_span_ids") else ""
        return {
            "analysis_run_id": job.run_id,
            "node_id": lens_id,
            "status": lens.get("status", "insufficient"),
            "subject": {"type": "question_lens", "id": lens_id},
            "title": lens.get("title", "Search result"),
            "summary": lens.get("description", ""),
            "primary_span_id": primary_span,
            "evidence_strength": lens.get("confidence") or 0.0,
            "tabs": tabs,
            "gaps": [gap.get("reason", "") for gap in lens.get("gaps", [])],
            "unsupported_reason": lens.get("unsupported_reason", ""),
            "warnings": [],
        }
    from syntax_tree_refurbished.app.query.query_lens_adapter import build_implementation_slice_from_lens
    return build_implementation_slice_from_lens(
        lens=lens,
        store=_store(request),
        analysis_run_id=job.run_id,
    )


# Registered after /evidence and /implementation on purpose: {lens_id:path} is a greedy
# converter that matches slashes, so if this bare route were declared first it would swallow
# every request to the more specific suffixed routes above (FastAPI/Starlette match routes in
# registration order). Lens IDs are always `{prefix}:{sha1-hex}` (see _stable_id /
# _stable_symbol_id) and never contain a literal slash, so this ordering fix does not narrow
# the accepted ID contract.
@router.get("/query-lenses/{lens_id:path}")
def get_query_lens(lens_id: str, request: Request, run_id: str | None = None) -> dict:
    controller = _controller(request, run_id)
    lens = controller.get_lens(lens_id)
    if not lens:
        raise HTTPException(status_code=404, detail="Question lens not found.")
    if isinstance(lens, dict):
        return lens
    return lens_to_question_lens_dto(lens, _store(request))


def _controller(request: Request, run_id: str | None) -> QueryController:
    job = _resolve_run(request, run_id)
    return QueryController(
        job=job,
        store=_store(request),
        overview=_overview(request, job),
        model=_model(request),
    )


def _overview(request: Request, job: AnalysisJob) -> SystemOverview:
    return SystemOverviewGenerator(
        job=job,
        store=_store(request),
        model=_model(request),
    ).get_or_generate()


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


def _region_language(region) -> str:
    language = getattr(region, "language", None)
    if isinstance(language, str):
        return language
    path = str(getattr(region, "path", ""))
    suffix = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return {
        "py": "python",
        "js": "javascript",
        "jsx": "javascript",
        "ts": "typescript",
        "tsx": "typescript",
        "md": "markdown",
        "json": "json",
        "yml": "yaml",
        "yaml": "yaml",
    }.get(suffix, "")


def _region_text(region) -> str:
    text = getattr(region, "content", None)
    if isinstance(text, str):
        return text
    text = getattr(region, "text", None)
    return text if isinstance(text, str) else ""
