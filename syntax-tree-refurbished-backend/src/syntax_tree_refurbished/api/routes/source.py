"""Source file and source region routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from syntax_tree_refurbished.api.dto.source import (
    CodeSearchHitDTO,
    CodeSearchResponse,
    ExpandRegionRequest,
    FileOutlineResponse,
    FileSearchHitDTO,
    FileSearchResponse,
    OutlineItemDTO,
    ReadRangeRequest,
    ReadWholeFileRequest,
    SearchCodeRequest,
    SearchFilesRequest,
    SourceFileContentResponse,
    SourceFileDTO,
    SourceFileListResponse,
    SourceRegionDTO,
)
from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.evidence.evidence_browser import EvidenceBrowser
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader


router = APIRouter(tags=["source"])


@router.get("/source/files", response_model=SourceFileListResponse)
def source_files(request: Request, run_id: str | None = None) -> SourceFileListResponse:
    job = _resolve_run(request, run_id)
    reader = SourceReader(job)
    files = [SourceFileDTO.from_domain(file) for file in reader.list_files()]
    return SourceFileListResponse(analysis_run_id=job.run_id, files=files, total=len(files))


@router.get("/source/file-outline", response_model=FileOutlineResponse)
def source_file_outline(path: str, request: Request, run_id: str | None = None) -> FileOutlineResponse:
    job = _resolve_run(request, run_id)
    try:
        items = EvidenceBrowser(job, _store(request)).get_file_outline(path)
    except SourceReadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileOutlineResponse(
        analysis_run_id=job.run_id,
        path=path,
        items=[OutlineItemDTO(**item.__dict__) for item in items],
        total=len(items),
    )


@router.get("/source/files/{path:path}", response_model=SourceFileContentResponse)
@router.get("/files/{path:path}", response_model=SourceFileContentResponse)
def source_file_content(path: str, request: Request, run_id: str | None = None) -> SourceFileContentResponse:
    job = _resolve_run(request, run_id)
    try:
        payload = SourceReader(job).read_file_content(path)
    except SourceReadError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SourceFileContentResponse(**payload)


@router.post("/evidence/read-range", response_model=SourceRegionDTO)
def read_range(payload: ReadRangeRequest, request: Request) -> SourceRegionDTO:
    job = _resolve_run(request, payload.run_id)
    try:
        region = SourceReader(job).read_range(payload.path, payload.start_line, payload.end_line)
    except SourceReadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _store(request).put_region(region)
    return SourceRegionDTO.from_domain(region)


@router.post("/evidence/read-whole-file", response_model=SourceRegionDTO)
def read_whole_file(payload: ReadWholeFileRequest, request: Request) -> SourceRegionDTO:
    job = _resolve_run(request, payload.run_id)
    try:
        region = SourceReader(job).read_whole_file(payload.path, payload.max_tokens)
    except SourceReadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _store(request).put_region(region)
    return SourceRegionDTO.from_domain(region)


@router.post("/evidence/search-code", response_model=CodeSearchResponse)
def search_code(payload: SearchCodeRequest, request: Request) -> CodeSearchResponse:
    job = _resolve_run(request, payload.run_id)
    hits = EvidenceBrowser(job).search_code(
        query=payload.query,
        limit=payload.limit,
        context_lines=payload.context_lines,
        role=payload.role,
        language=payload.language,
    )
    for hit in hits:
        _store(request).put_region(hit.region)
    return CodeSearchResponse(
        analysis_run_id=job.run_id,
        query=payload.query,
        hits=[
            CodeSearchHitDTO(
                region=SourceRegionDTO.from_domain(hit.region),
                matched_lines=list(hit.matched_lines),
                preview=hit.preview,
                score=hit.score,
            )
            for hit in hits
        ],
        total=len(hits),
    )


@router.post("/evidence/search-files", response_model=FileSearchResponse)
def search_files(payload: SearchFilesRequest, request: Request) -> FileSearchResponse:
    job = _resolve_run(request, payload.run_id)
    hits = EvidenceBrowser(job).search_files(
        query=payload.query,
        limit=payload.limit,
        role=payload.role,
        language=payload.language,
    )
    return FileSearchResponse(
        analysis_run_id=job.run_id,
        query=payload.query,
        hits=[
            FileSearchHitDTO(
                file=SourceFileDTO.from_domain(hit.file),
                score=hit.score,
                reason=hit.reason,
            )
            for hit in hits
        ],
        total=len(hits),
    )


@router.post("/evidence/expand-region", response_model=SourceRegionDTO)
def expand_region(payload: ExpandRegionRequest, request: Request) -> SourceRegionDTO:
    job = _resolve_run(request, payload.run_id)
    source = _store(request).get_region(payload.region_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source region not found.")
    try:
        expanded = EvidenceBrowser(job).expand_region(
            region=source,
            mode=payload.mode,  # type: ignore[arg-type]
            lines=payload.lines,
            max_tokens=payload.max_tokens,
        )
    except SourceReadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _store(request).put_region(expanded)
    return SourceRegionDTO.from_domain(expanded)


@router.get("/source-regions/{region_id}", response_model=SourceRegionDTO)
def source_region(region_id: str, request: Request) -> SourceRegionDTO:
    region = _store(request).get_region(region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Source region not found.")
    return SourceRegionDTO.from_domain(region)


def _resolve_run(request: Request, run_id: str | None) -> AnalysisJob:
    return resolve_ready_run(request, run_id)


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store
