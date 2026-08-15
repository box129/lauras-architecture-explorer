"""Exact source reading and source-region creation."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.core.models.file_record import FileRecord
from syntax_tree_refurbished.core.models.source_region import SourceRegion


class SourceReadError(ValueError):
    pass


class SourceReader:
    def __init__(self, job: AnalysisJob):
        if not job.snapshot:
            raise SourceReadError("Repo snapshot is not ready.")
        self._job = job
        self._snapshot = job.snapshot
        self._root = Path(job.snapshot.repo_path).resolve()
        self._files = {file.path: file for file in job.snapshot.files}

    def list_files(self) -> tuple[FileRecord, ...]:
        return self._snapshot.files

    def get_file(self, path: str) -> FileRecord:
        normalized = _normalize_repo_path(path)
        record = self._files.get(normalized)
        if not record:
            raise SourceReadError(f"File not found in snapshot: {path}")
        return record

    def read_file_content(self, path: str) -> dict[str, object]:
        record = self.get_file(path)
        if not record.readable:
            raise SourceReadError(f"File is not readable: {path}")
        text = self._read_text(record.path)
        return {
            "file_path": record.path,
            "content": text,
            "line_count": record.line_count,
            "language": record.language,
            "content_hash": record.content_hash,
        }

    def read_range(self, path: str, start_line: int, end_line: int) -> SourceRegion:
        record = self.get_file(path)
        if not record.readable:
            raise SourceReadError(f"File is not readable: {path}")
        if start_line < 1:
            raise SourceReadError("start_line must be >= 1")
        if end_line < start_line:
            raise SourceReadError("end_line must be >= start_line")
        lines = self._read_lines(record.path)
        if start_line > len(lines):
            raise SourceReadError("start_line is beyond end of file")
        bounded_end = min(end_line, len(lines))
        text = "".join(lines[start_line - 1 : bounded_end])
        return self._region(
            record=record,
            start_line=start_line,
            end_line=bounded_end,
            text=text,
            region_type="range",
        )

    def read_whole_file(self, path: str, max_tokens: int = 30_000) -> SourceRegion:
        record = self.get_file(path)
        if not record.readable:
            raise SourceReadError(f"File is not readable: {path}")
        text = self._read_text(record.path)
        token_count = estimate_tokens(text)
        if token_count > max_tokens:
            raise SourceReadError(
                f"Whole file exceeds token budget: {token_count} tokens > {max_tokens}"
            )
        return self._region(
            record=record,
            start_line=1,
            end_line=max(1, record.line_count),
            text=text,
            region_type="whole_file",
        )

    def _region(
        self,
        *,
        record: FileRecord,
        start_line: int,
        end_line: int,
        text: str,
        region_type: str,
    ) -> SourceRegion:
        region_id = stable_region_id(
            run_id=self._job.run_id,
            path=record.path,
            start_line=start_line,
            end_line=end_line,
            content_hash=record.content_hash,
            region_type=region_type,
        )
        return SourceRegion(
            id=region_id,
            run_id=self._job.run_id,
            path=record.path,
            start_line=start_line,
            end_line=end_line,
            content_hash=record.content_hash,
            text=text,
            region_type=region_type,  # type: ignore[arg-type]
            token_count=estimate_tokens(text),
            parser_confidence=None,
        )

    def _read_text(self, rel_path: str) -> str:
        full_path = self._safe_path(rel_path)
        return full_path.read_text(encoding="utf-8", errors="replace")

    def _read_lines(self, rel_path: str) -> list[str]:
        text = self._read_text(rel_path)
        lines = text.splitlines(keepends=True)
        return lines if lines else [""]

    def _safe_path(self, rel_path: str) -> Path:
        full_path = (self._root / rel_path).resolve()
        if full_path != self._root and self._root not in full_path.parents:
            raise SourceReadError("Path escapes repository root.")
        return full_path


def stable_region_id(
    *,
    run_id: str,
    path: str,
    start_line: int,
    end_line: int,
    content_hash: str,
    region_type: str,
) -> str:
    raw = "|".join([run_id, path, str(start_line), str(end_line), content_hash, region_type])
    return f"region:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"


def estimate_tokens(text: str) -> int:
    # A cheap local estimate is enough for budgets. Later PRs can replace this.
    return max(1, (len(text) + 3) // 4) if text else 0


def _normalize_repo_path(path: str) -> str:
    normalized = path.replace("\\", "/").strip("/")
    if not normalized or normalized.startswith("../") or "/../" in f"/{normalized}/":
        raise SourceReadError("Invalid repository-relative path.")
    if os.path.isabs(path):
        raise SourceReadError("Expected repository-relative path.")
    return normalized

