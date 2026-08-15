"""Lightweight evidence browser over readable repo source."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.core.models.file_record import FileRecord
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.source_region import SourceRegion


ExpandMode = Literal["up", "down", "both", "whole_file"]


@dataclass(frozen=True)
class CodeSearchHit:
    region: SourceRegion
    matched_lines: tuple[int, ...]
    preview: str
    score: float


@dataclass(frozen=True)
class FileSearchHit:
    file: FileRecord
    score: float
    reason: str


@dataclass(frozen=True)
class OutlineItem:
    label: str
    kind: str
    start_line: int
    end_line: int
    confidence: float


@dataclass(frozen=True)
class DefinitionHit:
    symbol: ParsedSymbol
    region: SourceRegion
    score: float
    method: str


@dataclass(frozen=True)
class ReferenceHit:
    region: SourceRegion
    matched_lines: tuple[int, ...]
    score: float
    method: str


class EvidenceBrowser:
    def __init__(self, job: AnalysisJob, store: InMemoryRunStore | None = None):
        self._job = job
        self._reader = SourceReader(job)
        self._store = store

    def search_files(
        self,
        *,
        query: str,
        limit: int = 20,
        role: str | None = None,
        language: str | None = None,
    ) -> tuple[FileSearchHit, ...]:
        terms = _terms(query)
        if not terms:
            return ()
        hits: list[FileSearchHit] = []
        for file in self._reader.list_files():
            if role and file.role != role:
                continue
            if language and file.language != language:
                continue
            haystack = file.path.lower()
            score = sum(1.0 for term in terms if term in haystack)
            if score <= 0:
                continue
            if file.role == "production":
                score += 0.2
            hits.append(FileSearchHit(file=file, score=score, reason="path_match"))
        return tuple(sorted(hits, key=lambda hit: (-hit.score, hit.file.path))[:limit])

    def search_code(
        self,
        *,
        query: str,
        limit: int = 20,
        context_lines: int = 2,
        role: str | None = None,
        language: str | None = None,
    ) -> tuple[CodeSearchHit, ...]:
        terms = _terms(query)
        if not terms:
            return ()
        hits: list[CodeSearchHit] = []
        for file in self._reader.list_files():
            if not file.readable:
                continue
            if role and file.role != role:
                continue
            if language and file.language != language:
                continue
            try:
                content = self._reader.read_file_content(file.path)["content"]
            except SourceReadError:
                continue
            lines = str(content).splitlines()
            matching = [
                line_number
                for line_number, line in enumerate(lines, start=1)
                if all(term in line.lower() for term in terms)
            ]
            for line_number in matching:
                start = max(1, line_number - context_lines)
                end = min(max(1, file.line_count), line_number + context_lines)
                region = self._reader.read_range(file.path, start, end)
                hits.append(
                    CodeSearchHit(
                        region=region,
                        matched_lines=(line_number,),
                        preview=_preview(region.text),
                        score=_score_code_hit(file, line_number, terms),
                    )
                )
        return tuple(sorted(hits, key=lambda hit: (-hit.score, hit.region.path, hit.region.start_line))[:limit])

    def expand_region(
        self,
        *,
        region: SourceRegion,
        mode: ExpandMode,
        lines: int = 80,
        max_tokens: int = 30_000,
    ) -> SourceRegion:
        file = self._reader.get_file(region.path)
        if mode == "whole_file":
            return self._reader.read_whole_file(region.path, max_tokens=max_tokens)
        if lines < 1:
            raise SourceReadError("lines must be >= 1")
        if mode == "up":
            start = max(1, region.start_line - lines)
            end = region.end_line
        elif mode == "down":
            start = region.start_line
            end = min(file.line_count, region.end_line + lines)
        elif mode == "both":
            start = max(1, region.start_line - lines)
            end = min(file.line_count, region.end_line + lines)
        else:
            raise SourceReadError(f"Unsupported expand mode: {mode}")
        return self._reader.read_range(region.path, start, end)

    def get_file_outline(self, path: str) -> tuple[OutlineItem, ...]:
        file = self._reader.get_file(path)
        if not file.readable:
            raise SourceReadError(f"File is not readable: {path}")
        parsed = self._symbols_for_file(file.path)
        if parsed:
            return tuple(
                OutlineItem(
                    label=symbol.name,
                    kind=symbol.kind,
                    start_line=symbol.start_line,
                    end_line=symbol.end_line,
                    confidence=0.9,
                )
                for symbol in parsed
            )
        content = str(self._reader.read_file_content(file.path)["content"])
        lines = content.splitlines()
        if file.language in {"markdown", "rst", "text"} or file.role == "docs":
            items = _markdown_outline(lines)
            if items:
                return tuple(items)
        items = _code_outline(lines, file.language)
        if items:
            return tuple(items)
        if lines:
            return (
                OutlineItem(
                    label=file.path,
                    kind="file",
                    start_line=1,
                    end_line=max(1, len(lines)),
                    confidence=0.35,
                ),
            )
        return ()

    def find_definition(
        self,
        *,
        query: str,
        path: str | None = None,
        limit: int = 20,
    ) -> tuple[DefinitionHit, ...]:
        terms = _terms(query)
        if not terms:
            return ()
        hits: list[DefinitionHit] = []
        for symbol in self._symbols():
            if path and symbol.path != path:
                continue
            haystack = f"{symbol.name} {symbol.qualified_name}".lower()
            score = sum(1.0 for term in terms if term in haystack)
            if symbol.name.lower() == query.lower():
                score += 3.0
            if score <= 0:
                continue
            try:
                region = self._reader.read_range(symbol.path, symbol.start_line, symbol.end_line)
            except SourceReadError:
                continue
            hits.append(DefinitionHit(symbol=symbol, region=region, score=score, method="parsed_symbol"))
        return tuple(sorted(hits, key=lambda hit: (-hit.score, hit.symbol.path, hit.symbol.start_line))[:limit])

    def find_references(
        self,
        *,
        query: str,
        limit: int = 20,
        path: str | None = None,
    ) -> tuple[ReferenceHit, ...]:
        hits = self.search_code(query=query, limit=limit, context_lines=1)
        if path:
            hits = tuple(hit for hit in hits if hit.region.path == path)
        return tuple(
            ReferenceHit(
                region=hit.region,
                matched_lines=hit.matched_lines,
                score=max(0.1, hit.score - 0.5),
                method="text_search_fallback",
            )
            for hit in hits[:limit]
        )

    def _symbols(self) -> tuple[ParsedSymbol, ...]:
        return self._store.get_symbols(self._job.run_id) if self._store else ()

    def _symbols_for_file(self, path: str) -> tuple[ParsedSymbol, ...]:
        return tuple(symbol for symbol in self._symbols() if symbol.path == path)


def _terms(query: str) -> tuple[str, ...]:
    return tuple(term for term in re.split(r"\s+", query.lower().strip()) if term)


def _score_code_hit(file: FileRecord, line_number: int, terms: tuple[str, ...]) -> float:
    score = float(len(terms))
    if file.role == "production":
        score += 0.4
    if line_number <= 20:
        score += 0.1
    return score


def _preview(text: str, limit: int = 220) -> str:
    return " ".join(text.strip().split())[:limit]


def _markdown_outline(lines: list[str]) -> list[OutlineItem]:
    headings: list[tuple[int, str]] = []
    for index, line in enumerate(lines, start=1):
        match = re.match(r"^\s{0,3}(#{1,6})\s+(.+?)\s*$", line)
        if match:
            headings.append((index, match.group(2).strip()))
            continue
        if index < len(lines) and re.match(r"^\s*(=+|-+)\s*$", lines[index]):
            stripped = line.strip()
            if stripped:
                headings.append((index, stripped))
    return _items_from_starts(headings, len(lines), "section", 0.75)


def _code_outline(lines: list[str], language: str) -> list[OutlineItem]:
    starts: list[tuple[int, str]] = []
    patterns = _patterns_for_language(language)
    for index, line in enumerate(lines, start=1):
        for pattern in patterns:
            match = pattern.search(line)
            if match:
                label = next((group for group in match.groups() if group), line.strip())
                starts.append((index, label.strip()))
                break
    return _items_from_starts(starts, len(lines), "symbol", 0.55)


def _patterns_for_language(language: str) -> tuple[re.Pattern[str], ...]:
    common = (
        re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)"),
        re.compile(r"^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)"),
        re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>"),
    )
    if language == "python":
        return (
            re.compile(r"^\s*class\s+([A-Za-z_][\w]*)"),
            re.compile(r"^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)"),
        )
    if language in {"javascript", "typescript", "svelte", "vue"}:
        return common
    if language == "go":
        return (re.compile(r"^\s*func\s+(?:\([^)]+\)\s*)?([A-Za-z_][\w]*)"),)
    if language == "rust":
        return (
            re.compile(r"^\s*(?:pub\s+)?fn\s+([A-Za-z_][\w]*)"),
            re.compile(r"^\s*(?:pub\s+)?(?:struct|enum|trait|impl)\s+([A-Za-z_][\w]*)?"),
        )
    if language == "java":
        return (
            re.compile(r"^\s*(?:public|private|protected)?\s*(?:class|interface|enum)\s+([A-Za-z_][\w]*)"),
            re.compile(r"^\s*(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+([A-Za-z_][\w]*)\s*\("),
        )
    return common


def _items_from_starts(
    starts: list[tuple[int, str]],
    total_lines: int,
    kind: str,
    confidence: float,
) -> list[OutlineItem]:
    items: list[OutlineItem] = []
    for index, (start_line, label) in enumerate(starts):
        next_start = starts[index + 1][0] if index + 1 < len(starts) else total_lines + 1
        items.append(
            OutlineItem(
                label=label,
                kind=kind,
                start_line=start_line,
                end_line=max(start_line, next_start - 1),
                confidence=confidence,
            )
        )
    return items
