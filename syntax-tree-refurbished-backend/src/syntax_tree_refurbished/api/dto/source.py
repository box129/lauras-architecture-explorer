"""Source file and source region DTOs."""

from __future__ import annotations

from pydantic import BaseModel, Field

from syntax_tree_refurbished.core.models.file_record import FileRecord
from syntax_tree_refurbished.core.models.source_region import SourceRegion


class SourceFileDTO(BaseModel):
    path: str
    language: str
    role: str
    status: str
    readable: bool
    size_bytes: int
    line_count: int
    content_hash: str

    @classmethod
    def from_domain(cls, record: FileRecord) -> "SourceFileDTO":
        return cls(
            path=record.path,
            language=record.language,
            role=record.role,
            status=record.status,
            readable=record.readable,
            size_bytes=record.size_bytes,
            line_count=record.line_count,
            content_hash=record.content_hash,
        )


class SourceFileListResponse(BaseModel):
    analysis_run_id: str
    files: list[SourceFileDTO]
    total: int


class SourceFileContentResponse(BaseModel):
    file_path: str
    content: str
    entities: list[dict[str, object]] = Field(default_factory=list)
    line_count: int
    language: str
    content_hash: str


class SourceRegionDTO(BaseModel):
    id: str
    analysis_run_id: str
    path: str
    start_line: int
    end_line: int
    content_hash: str
    text: str
    region_type: str
    token_count: int
    parser_confidence: float | None

    @classmethod
    def from_domain(cls, region: SourceRegion) -> "SourceRegionDTO":
        return cls(
            id=region.id,
            analysis_run_id=region.run_id,
            path=region.path,
            start_line=region.start_line,
            end_line=region.end_line,
            content_hash=region.content_hash,
            text=region.text,
            region_type=region.region_type,
            token_count=region.token_count,
            parser_confidence=region.parser_confidence,
        )


class ReadRangeRequest(BaseModel):
    path: str = Field(min_length=1)
    start_line: int = Field(ge=1)
    end_line: int = Field(ge=1)
    run_id: str | None = None


class ReadWholeFileRequest(BaseModel):
    path: str = Field(min_length=1)
    max_tokens: int = Field(default=30_000, ge=1)
    run_id: str | None = None


class SearchCodeRequest(BaseModel):
    query: str = Field(min_length=1)
    run_id: str | None = None
    limit: int = Field(default=20, ge=1, le=100)
    context_lines: int = Field(default=2, ge=0, le=20)
    role: str | None = None
    language: str | None = None


class SearchFilesRequest(BaseModel):
    query: str = Field(min_length=1)
    run_id: str | None = None
    limit: int = Field(default=20, ge=1, le=100)
    role: str | None = None
    language: str | None = None


class CodeSearchHitDTO(BaseModel):
    region: SourceRegionDTO
    matched_lines: list[int]
    preview: str
    score: float


class CodeSearchResponse(BaseModel):
    analysis_run_id: str
    query: str
    hits: list[CodeSearchHitDTO]
    total: int


class FileSearchHitDTO(BaseModel):
    file: SourceFileDTO
    score: float
    reason: str


class FileSearchResponse(BaseModel):
    analysis_run_id: str
    query: str
    hits: list[FileSearchHitDTO]
    total: int


class ExpandRegionRequest(BaseModel):
    region_id: str = Field(min_length=1)
    mode: str = "both"
    lines: int = Field(default=80, ge=1, le=1000)
    max_tokens: int = Field(default=30_000, ge=1)
    run_id: str | None = None


class OutlineItemDTO(BaseModel):
    label: str
    kind: str
    start_line: int
    end_line: int
    confidence: float


class FileOutlineResponse(BaseModel):
    analysis_run_id: str
    path: str
    items: list[OutlineItemDTO]
    total: int
