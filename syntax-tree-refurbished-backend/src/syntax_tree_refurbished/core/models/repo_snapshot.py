"""Repo snapshot domain model."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from syntax_tree_refurbished.core.models.file_record import (
    FileRecord,
    ManifestRecord,
    PackageBoundary,
)


@dataclass(frozen=True)
class LanguageCount:
    language: str
    count: int


@dataclass(frozen=True)
class ParserCoverage:
    deeply_parsed_languages: tuple[str, ...]
    text_indexed_languages: tuple[str, ...]
    skipped_file_count: int
    readable_file_count: int


@dataclass(frozen=True)
class RepoSnapshot:
    run_id: str
    repo_path: str
    repo_name: str
    files: tuple[FileRecord, ...]
    languages: tuple[LanguageCount, ...]
    manifests: tuple[ManifestRecord, ...]
    package_boundaries: tuple[PackageBoundary, ...]
    parser_coverage: ParserCoverage
    created_at: datetime

    @property
    def file_count(self) -> int:
        return len(self.files)

    @staticmethod
    def created_now(
        *,
        run_id: str,
        repo_path: str,
        repo_name: str,
        files: tuple[FileRecord, ...],
        languages: tuple[LanguageCount, ...],
        manifests: tuple[ManifestRecord, ...],
        package_boundaries: tuple[PackageBoundary, ...],
        parser_coverage: ParserCoverage,
    ) -> "RepoSnapshot":
        return RepoSnapshot(
            run_id=run_id,
            repo_path=repo_path,
            repo_name=repo_name,
            files=files,
            languages=languages,
            manifests=manifests,
            package_boundaries=package_boundaries,
            parser_coverage=parser_coverage,
            created_at=datetime.now(UTC),
        )

