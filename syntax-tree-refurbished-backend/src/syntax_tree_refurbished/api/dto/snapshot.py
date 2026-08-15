"""Repo snapshot API DTOs."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from syntax_tree_refurbished.core.models.file_record import (
    FileRecord,
    ManifestRecord,
    PackageBoundary,
)
from syntax_tree_refurbished.core.models.repo_snapshot import (
    LanguageCount,
    ParserCoverage,
    RepoSnapshot,
)


class FileRecordDTO(BaseModel):
    path: str
    language: str
    role: str
    status: str
    readable: bool
    size_bytes: int
    line_count: int
    content_hash: str
    extension: str

    @classmethod
    def from_domain(cls, record: FileRecord) -> "FileRecordDTO":
        return cls(**record.__dict__)


class ManifestRecordDTO(BaseModel):
    path: str
    kind: str
    package_name: str

    @classmethod
    def from_domain(cls, manifest: ManifestRecord) -> "ManifestRecordDTO":
        return cls(**manifest.__dict__)


class PackageBoundaryDTO(BaseModel):
    path: str
    kind: str
    manifest_path: str
    package_name: str

    @classmethod
    def from_domain(cls, boundary: PackageBoundary) -> "PackageBoundaryDTO":
        return cls(**boundary.__dict__)


class LanguageCountDTO(BaseModel):
    language: str
    count: int

    @classmethod
    def from_domain(cls, count: LanguageCount) -> "LanguageCountDTO":
        return cls(**count.__dict__)


class ParserCoverageDTO(BaseModel):
    deeply_parsed_languages: list[str]
    text_indexed_languages: list[str]
    skipped_file_count: int
    readable_file_count: int

    @classmethod
    def from_domain(cls, coverage: ParserCoverage) -> "ParserCoverageDTO":
        return cls(
            deeply_parsed_languages=list(coverage.deeply_parsed_languages),
            text_indexed_languages=list(coverage.text_indexed_languages),
            skipped_file_count=coverage.skipped_file_count,
            readable_file_count=coverage.readable_file_count,
        )


class RepoSnapshotDTO(BaseModel):
    run_id: str
    repo_path: str
    repo_name: str
    file_count: int
    files: list[FileRecordDTO]
    languages: list[LanguageCountDTO]
    manifests: list[ManifestRecordDTO]
    package_boundaries: list[PackageBoundaryDTO]
    parser_coverage: ParserCoverageDTO
    created_at: datetime

    @classmethod
    def from_domain(cls, snapshot: RepoSnapshot) -> "RepoSnapshotDTO":
        return cls(
            run_id=snapshot.run_id,
            repo_path=snapshot.repo_path,
            repo_name=snapshot.repo_name,
            file_count=snapshot.file_count,
            files=[FileRecordDTO.from_domain(file) for file in snapshot.files],
            languages=[LanguageCountDTO.from_domain(item) for item in snapshot.languages],
            manifests=[ManifestRecordDTO.from_domain(item) for item in snapshot.manifests],
            package_boundaries=[
                PackageBoundaryDTO.from_domain(item) for item in snapshot.package_boundaries
            ],
            parser_coverage=ParserCoverageDTO.from_domain(snapshot.parser_coverage),
            created_at=snapshot.created_at,
        )

