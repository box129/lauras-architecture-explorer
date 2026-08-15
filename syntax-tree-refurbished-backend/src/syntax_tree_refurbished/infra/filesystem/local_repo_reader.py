"""Local filesystem repo inventory."""

from __future__ import annotations

import hashlib
import os
from collections import Counter
from pathlib import Path

from syntax_tree_refurbished.config import Settings
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
from syntax_tree_refurbished.infra.filesystem.file_classifier import (
    classify_language,
    classify_role,
    manifest_for,
    package_boundary_for,
)
from syntax_tree_refurbished.infra.filesystem.ignore_rules import IGNORED_DIRECTORIES, IGNORED_FILES
from syntax_tree_refurbished.infra.filesystem.text_detection import looks_binary


DEEP_PARSE_LANGUAGES = ("javascript", "python", "typescript")


class LocalRepoReader:
    def __init__(self, settings: Settings):
        self._settings = settings

    def build_snapshot(self, *, run_id: str, repo_path: str) -> RepoSnapshot:
        repo_path = repo_path.strip().strip('"').strip("'")
        root = Path(repo_path).expanduser().resolve()
        if not root.exists() or not root.is_dir():
            raise ValueError(f"Repository path does not exist or is not a directory: {repo_path}")

        files: list[FileRecord] = []
        manifests: list[ManifestRecord] = []
        package_boundaries: list[PackageBoundary] = []

        for current, dirs, names in os.walk(root):
            dirs[:] = sorted(d for d in dirs if d not in IGNORED_DIRECTORIES)
            current_path = Path(current)
            for name in sorted(names):
                if name in IGNORED_FILES:
                    continue
                abs_path = current_path / name
                if abs_path.is_symlink() or not abs_path.is_file():
                    continue
                rel_path = abs_path.relative_to(root).as_posix()
                record = self._inspect_file(root, abs_path, rel_path)
                files.append(record)
                manifest = manifest_for(rel_path, abs_path)
                if manifest:
                    manifests.append(manifest)
                    boundary = package_boundary_for(manifest)
                    if boundary:
                        package_boundaries.append(boundary)

        files_tuple = tuple(sorted(files, key=lambda item: item.path))
        languages = tuple(
            LanguageCount(language=language, count=count)
            for language, count in sorted(Counter(file.language for file in files_tuple).items())
        )
        readable_count = sum(1 for file in files_tuple if file.readable)
        skipped_count = sum(1 for file in files_tuple if not file.readable)
        text_indexed_languages = tuple(
            sorted({file.language for file in files_tuple if file.readable and file.language not in DEEP_PARSE_LANGUAGES})
        )
        parser_coverage = ParserCoverage(
            deeply_parsed_languages=DEEP_PARSE_LANGUAGES,
            text_indexed_languages=text_indexed_languages,
            skipped_file_count=skipped_count,
            readable_file_count=readable_count,
        )

        return RepoSnapshot.created_now(
            run_id=run_id,
            repo_path=str(root),
            repo_name=root.name,
            files=files_tuple,
            languages=languages,
            manifests=tuple(sorted(manifests, key=lambda item: item.path)),
            package_boundaries=tuple(sorted(package_boundaries, key=lambda item: item.path)),
            parser_coverage=parser_coverage,
        )

    def _inspect_file(self, root: Path, abs_path: Path, rel_path: str) -> FileRecord:
        try:
            size_bytes = abs_path.stat().st_size
        except OSError:
            return _error_record(rel_path)

        language = classify_language(rel_path)
        role = classify_role(rel_path)
        extension = abs_path.suffix.lower()

        try:
            content_hash = _hash_file(abs_path)
        except OSError:
            return _error_record(rel_path, language=language, role=role, extension=extension)

        if size_bytes > self._settings.max_file_size_bytes:
            return FileRecord(
                path=rel_path,
                language=language,
                role=role,
                status="skipped_too_large",
                readable=False,
                size_bytes=size_bytes,
                line_count=0,
                content_hash=content_hash,
                extension=extension,
            )

        try:
            sample = abs_path.read_bytes()[:8192]
            if looks_binary(sample):
                return FileRecord(
                    path=rel_path,
                    language=language,
                    role=role,
                    status="skipped_binary",
                    readable=False,
                    size_bytes=size_bytes,
                    line_count=0,
                    content_hash=content_hash,
                    extension=extension,
                )
            text = abs_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return _error_record(rel_path, language=language, role=role, extension=extension)

        line_count = text.count("\n") + (1 if text and not text.endswith("\n") else 0)
        if line_count > self._settings.max_lines_per_file:
            return FileRecord(
                path=rel_path,
                language=language,
                role=role,
                status="skipped_too_large",
                readable=False,
                size_bytes=size_bytes,
                line_count=line_count,
                content_hash=content_hash,
                extension=extension,
            )

        return FileRecord(
            path=rel_path,
            language=language,
            role=role,
            status="readable",
            readable=True,
            size_bytes=size_bytes,
            line_count=line_count,
            content_hash=content_hash,
            extension=extension,
        )


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _error_record(
    rel_path: str,
    *,
    language: str = "unknown",
    role: str = "unknown",
    extension: str = "",
) -> FileRecord:
    return FileRecord(
        path=rel_path,
        language=language,
        role=role,
        status="skipped_error",
        readable=False,
        size_bytes=0,
        line_count=0,
        content_hash="",
        extension=extension,
    )

