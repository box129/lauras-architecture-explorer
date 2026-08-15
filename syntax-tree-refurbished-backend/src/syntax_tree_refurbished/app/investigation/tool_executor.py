"""Backend-controlled tools exposed to the investigation model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from syntax_tree_refurbished.api.dto.anchors import SemanticAnchorDTO
from syntax_tree_refurbished.api.dto.orientation import OrientationItemDTO
from syntax_tree_refurbished.api.dto.symbols import ParsedSymbolDTO
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.evidence.evidence_browser import EvidenceBrowser
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.core.models.source_region import SourceRegion


@dataclass(frozen=True)
class ToolResult:
    status: str
    result_count: int
    returned_region_ids: tuple[str, ...]
    observation: str
    payload: dict[str, Any]


class InvestigationToolExecutor:
    def __init__(self, *, job: AnalysisJob, store: InMemoryRunStore):
        self._job = job
        self._store = store
        self._browser = EvidenceBrowser(job, store)
        self._reader = SourceReader(job)

    def execute(self, tool: str, args: dict[str, Any]) -> ToolResult:
        tool = _normalize_tool_name(tool)
        try:
            if tool == "search_code":
                return self._search_code(args)
            if tool == "search_files":
                return self._search_files(args)
            if tool == "read_range":
                return self._read_range(args)
            if tool == "smart_read":
                return self._smart_read(args)
            if tool == "read_whole_file":
                return self._read_whole_file(args)
            if tool == "expand_region":
                return self._expand_region(args)
            if tool == "get_source_region":
                return self._get_source_region(args)
            if tool == "get_file_outline":
                return self._get_file_outline(args)
            if tool == "find_definition":
                return self._find_definition(args)
            if tool == "find_references":
                return self._find_references(args)
            if tool == "list_anchors":
                return self._list_anchors(args)
            if tool == "list_orientation":
                return self._list_orientation()
            if tool == "list_symbols":
                return self._list_symbols(args)
            return ToolResult("error", 0, (), f"Unsupported tool: {tool}", {"error": "unsupported_tool"})
        except Exception as exc:
            return ToolResult("error", 0, (), str(exc), {"error": str(exc)})

    def _search_code(self, args: dict[str, Any]) -> ToolResult:
        hits = self._browser.search_code(
            query=_query(args),
            limit=_int(args.get("limit"), 10, 1, 25),
            context_lines=_int(args.get("context_lines"), 2, 0, 8),
            role=_optional_str(args.get("role")),
            language=_optional_str(args.get("language")),
        )
        path_filter = _optional_str(args.get("path") or args.get("file_path"))
        if path_filter:
            hits = tuple(hit for hit in hits if hit.region.path == path_filter)
        for hit in hits:
            self._store.put_region(hit.region)
        payload = {
            "hits": [
                {
                    "path": hit.region.path,
                    "start_line": hit.region.start_line,
                    "end_line": hit.region.end_line,
                    "source_region_id": hit.region.id,
                    "content_hash": hit.region.content_hash,
                    "preview": hit.preview,
                    "score": hit.score,
                    "why": "code_search_match",
                }
                for hit in hits
            ]
        }
        return _result("ok", payload["hits"], "Search returned code regions.")

    def _search_files(self, args: dict[str, Any]) -> ToolResult:
        hits = self._browser.search_files(
            query=_query(args),
            limit=_int(args.get("limit"), 10, 1, 50),
            role=_optional_str(args.get("role")),
            language=_optional_str(args.get("language")),
        )
        payload = {
            "hits": [
                {
                    "path": hit.file.path,
                    "role": hit.file.role,
                    "language": hit.file.language,
                    "line_count": hit.file.line_count,
                    "content_hash": hit.file.content_hash,
                    "score": hit.score,
                    "why": hit.reason,
                }
                for hit in hits
            ]
        }
        return _result("ok", payload["hits"], "Search returned file candidates.")

    def _read_range(self, args: dict[str, Any]) -> ToolResult:
        region = self._reader.read_range(
            _path(args),
            _int(args.get("start_line"), 1, 1, 1_000_000),
            _int(args.get("end_line"), 1, 1, 1_000_000),
        )
        self._store.put_region(region)
        return _region_result(region, "Read exact source range.")

    def _read_whole_file(self, args: dict[str, Any]) -> ToolResult:
        region = self._reader.read_whole_file(
            _path(args),
            max_tokens=_int(args.get("max_tokens"), 18_000, 1, 40_000),
        )
        self._store.put_region(region)
        return _region_result(region, "Read whole file within budget.")

    def _smart_read(self, args: dict[str, Any]) -> ToolResult:
        region_id = _optional_str(args.get("region_id") or args.get("source_region_id"))
        if region_id:
            return self._get_source_region({"region_id": region_id})
        path = _path(args)
        if args.get("start_line") is not None or args.get("end_line") is not None:
            return self._read_range(
                {
                    "path": path,
                    "start_line": _int(args.get("start_line"), 1, 1, 1_000_000),
                    "end_line": _int(args.get("end_line"), _int(args.get("start_line"), 1, 1, 1_000_000), 1, 1_000_000),
                }
            )
        return self._read_whole_file({"path": path, "max_tokens": args.get("max_tokens", 18_000)})

    def _expand_region(self, args: dict[str, Any]) -> ToolResult:
        source = self._store.get_region(str(args.get("region_id") or ""))
        if not source:
            return ToolResult("error", 0, (), "Source region not found.", {"error": "region_not_found"})
        region = self._browser.expand_region(
            region=source,
            mode=str(args.get("mode") or "both"),  # type: ignore[arg-type]
            lines=_int(args.get("lines"), 80, 1, 500),
            max_tokens=_int(args.get("max_tokens"), 18_000, 1, 40_000),
        )
        self._store.put_region(region)
        return _region_result(region, "Expanded source region.")

    def _get_source_region(self, args: dict[str, Any]) -> ToolResult:
        region = self._store.get_region(str(args.get("region_id") or args.get("source_region_id") or ""))
        if not region:
            return ToolResult("error", 0, (), "Source region not found.", {"error": "region_not_found"})
        return _region_result(region, "Returned existing source region.")

    def _get_file_outline(self, args: dict[str, Any]) -> ToolResult:
        items = self._browser.get_file_outline(_path(args))
        payload = {"items": [item.__dict__ for item in items[:80]]}
        return _result("ok", payload["items"], "Returned file outline.")

    def _find_definition(self, args: dict[str, Any]) -> ToolResult:
        hits = self._browser.find_definition(
            query=_query(args),
            path=_optional_str(args.get("path") or args.get("file_path")),
            limit=_int(args.get("limit"), 10, 1, 25),
        )
        for hit in hits:
            self._store.put_region(hit.region)
        payload = {
            "hits": [
                {
                    "symbol": ParsedSymbolDTO.from_domain(hit.symbol).model_dump(),
                    "path": hit.region.path,
                    "start_line": hit.region.start_line,
                    "end_line": hit.region.end_line,
                    "source_region_id": hit.region.id,
                    "content_hash": hit.region.content_hash,
                    "preview": _preview(hit.region.text),
                    "score": hit.score,
                    "why": hit.method,
                }
                for hit in hits
            ]
        }
        return _result("ok", payload["hits"], "Definition lookup returned candidates.")

    def _find_references(self, args: dict[str, Any]) -> ToolResult:
        hits = self._browser.find_references(
            query=_query(args),
            path=_optional_str(args.get("path") or args.get("file_path")),
            limit=_int(args.get("limit"), 10, 1, 25),
        )
        for hit in hits:
            self._store.put_region(hit.region)
        payload = {
            "hits": [
                {
                    "path": hit.region.path,
                    "start_line": hit.region.start_line,
                    "end_line": hit.region.end_line,
                    "source_region_id": hit.region.id,
                    "content_hash": hit.region.content_hash,
                    "preview": _preview(hit.region.text),
                    "score": hit.score,
                    "why": hit.method,
                }
                for hit in hits
            ]
        }
        return _result("ok", payload["hits"], "Reference lookup returned source regions.")

    def _list_anchors(self, args: dict[str, Any]) -> ToolResult:
        kind = _optional_str(args.get("kind"))
        anchors = self._store.get_anchors(self._job.run_id)
        if kind:
            anchors = tuple(anchor for anchor in anchors if anchor.kind == kind)
        payload = {"anchors": [SemanticAnchorDTO.from_domain(anchor).model_dump() for anchor in anchors[:120]]}
        return _result("ok", payload["anchors"], "Returned semantic anchors.")

    def _list_orientation(self) -> ToolResult:
        items = self._store.get_orientation_items(self._job.run_id)
        payload = {"items": [OrientationItemDTO.from_domain(item).model_dump() for item in items[:80]]}
        return _result("ok", payload["items"], "Returned guidance-only orientation material.")

    def _list_symbols(self, args: dict[str, Any]) -> ToolResult:
        path = _optional_str(args.get("path"))
        symbols = self._store.get_symbols_for_file(self._job.run_id, path) if path else self._store.get_symbols(self._job.run_id)
        payload = {"symbols": [ParsedSymbolDTO.from_domain(symbol).model_dump() for symbol in symbols[:200]]}
        return _result("ok", payload["symbols"], "Returned parsed symbols.")


def _result(status: str, rows: list[dict[str, Any]], observation: str) -> ToolResult:
    region_ids = tuple(str(row["source_region_id"]) for row in rows if row.get("source_region_id"))
    return ToolResult(
        status=status,
        result_count=len(rows),
        returned_region_ids=region_ids,
        observation=f"{observation} Count: {len(rows)}.",
        payload={"results": rows},
    )


def _region_result(region: SourceRegion, observation: str) -> ToolResult:
    return ToolResult(
        status="ok",
        result_count=1,
        returned_region_ids=(region.id,),
        observation=f"{observation} {region.path}:{region.start_line}-{region.end_line}.",
        payload={
            "results": [
                {
                    "path": region.path,
                    "start_line": region.start_line,
                    "end_line": region.end_line,
                    "source_region_id": region.id,
                    "content_hash": region.content_hash,
                    "preview": _preview(region.text),
                    "text": region.text[:12_000],
                    "why": region.region_type,
                }
            ]
        },
    )


def _preview(text: str, limit: int = 420) -> str:
    return " ".join(text.strip().split())[:limit]


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _normalize_tool_name(tool: str) -> str:
    normalized = tool.strip()
    aliases = {
        "search": "search_code",
        "search_codebase": "search_code",
        "search_repo": "search_code",
        "search_repository": "search_code",
        "grep": "search_code",
        "search_in_file": "search_code",
        "grep_in_file": "search_code",
        "search_file": "search_code",
        "find_text": "search_code",
        "read": "smart_read",
        "read_file": "read_whole_file",
        "open_file": "read_whole_file",
        "read_source_region": "get_source_region",
        "get_source_region": "get_source_region",
        "source_region": "get_source_region",
        "outline": "get_file_outline",
    }
    return aliases.get(normalized, normalized)


def _query(args: dict[str, Any]) -> str:
    for key in ("query", "q", "pattern", "term", "text", "name"):
        value = args.get(key)
        if value:
            return str(value)
    return ""


def _path(args: dict[str, Any]) -> str:
    return str(args.get("path") or args.get("file_path") or args.get("file") or "")
