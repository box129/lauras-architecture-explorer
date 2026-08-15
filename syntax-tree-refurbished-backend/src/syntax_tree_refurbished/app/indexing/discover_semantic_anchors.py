"""Detect source-backed semantic anchors: entrypoints, boundaries, and public surfaces."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from pathlib import Path
from typing import Iterable

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.core.models.file_record import FileRecord
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.semantic_anchor import AnchorKind, SemanticAnchor
from syntax_tree_refurbished.core.models.source_region import SourceRegion


@dataclass(frozen=True)
class AnchorDiscoveryResult:
    anchors: tuple[SemanticAnchor, ...]
    source_regions: tuple[SourceRegion, ...]


@dataclass(frozen=True)
class _AnchorCandidate:
    kind: AnchorKind
    label: str
    path: str
    start_line: int
    end_line: int
    extraction_method: str
    confidence: float
    signals: tuple[str, ...]
    summary: str


HTTP_METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS"
ROUTE_DECORATOR_RE = re.compile(
    rf"@\s*(?:app|router|blueprint|bp)\.(?P<method>get|post|put|patch|delete|head|options|route)\s*\(\s*['\"](?P<path>[^'\"]+)['\"]",
    re.I,
)
PY_ROUTE_MAP_RE = re.compile(
    rf"routes\s*\[\s*['\"](?P<method>{HTTP_METHODS})\s+(?P<path>[^'\"]+)['\"]\s*\]",
    re.I,
)
JS_ROUTE_RE = re.compile(
    rf"\b(?:app|router|server)\.(?P<method>get|post|put|patch|delete|head|options|all)\s*\(\s*['`] (?P<path>[^'`]+)['`]",
    re.I | re.X,
)
FETCH_RE = re.compile(r"\b(?:fetch|axios\.\w+|httpx\.\w+|requests\.\w+)\s*\(", re.I)
SQL_SCHEMA_RE = re.compile(r"\b(create\s+table|alter\s+table|create\s+index)\b", re.I)
EXPORT_RE = re.compile(r"^\s*(?:export\s+)?(?:from\s+\.\w+\s+import|export\s+\{|\w+\s*=)\b")


def discover_semantic_anchors(
    job: AnalysisJob,
    symbols: Iterable[ParsedSymbol] = (),
) -> AnchorDiscoveryResult:
    if not job.snapshot:
        return AnchorDiscoveryResult(anchors=(), source_regions=())
    reader = SourceReader(job)
    symbol_list = tuple(symbols)
    candidates: list[_AnchorCandidate] = []
    for file in job.snapshot.files:
        if not file.readable:
            continue
        try:
            text = str(reader.read_file_content(file.path)["content"])
        except Exception:
            continue
        lines = text.splitlines()
        candidates.extend(_anchors_for_file(file, lines, text, symbol_list))
    candidates.extend(_public_export_anchors(job, symbol_list))
    deduped = _dedupe(candidates)
    anchors: list[SemanticAnchor] = []
    regions: list[SourceRegion] = []
    for candidate in sorted(deduped, key=lambda item: (_kind_order(item.kind), item.path, item.start_line, item.label)):
        try:
            region = reader.read_range(candidate.path, candidate.start_line, candidate.end_line)
        except Exception:
            continue
        related = _related_symbols(symbol_list, candidate.path, candidate.start_line, candidate.end_line)
        anchor = SemanticAnchor(
            id=_anchor_id(job.run_id, candidate),
            run_id=job.run_id,
            kind=candidate.kind,
            label=candidate.label,
            path=candidate.path,
            start_line=candidate.start_line,
            end_line=candidate.end_line,
            source_region_id=region.id,
            extraction_method=candidate.extraction_method,
            confidence=candidate.confidence,
            status="source_detected" if candidate.confidence >= 0.7 else "candidate",
            related_symbol_ids=related,
            signals=candidate.signals,
            summary=candidate.summary,
        )
        anchors.append(anchor)
        regions.append(region)
    return AnchorDiscoveryResult(anchors=tuple(anchors), source_regions=tuple(regions))


def _anchors_for_file(
    file: FileRecord,
    lines: list[str],
    text: str,
    symbols: tuple[ParsedSymbol, ...],
) -> list[_AnchorCandidate]:
    candidates: list[_AnchorCandidate] = []
    candidates.extend(_http_route_anchors(file, lines))
    candidates.extend(_frontend_screen_anchors(file))
    candidates.extend(_cli_anchors(file, lines, text))
    candidates.extend(_worker_anchors(file, lines, text))
    candidates.extend(_cron_anchors(file, lines, text))
    candidates.extend(_webhook_anchors(file, lines, text))
    candidates.extend(_db_schema_anchors(file, lines, text, symbols))
    candidates.extend(_queue_anchors(file, lines, text))
    candidates.extend(_external_api_anchors(file, lines, text))
    candidates.extend(_plugin_registry_anchors(file, lines, text))
    candidates.extend(_deployment_anchors(file))
    candidates.extend(_auth_anchors(file, lines, text))
    candidates.extend(_manifest_export_anchors(file, lines, text))
    candidates.extend(_python_package_export_anchors(file, lines))
    return candidates


def _http_route_anchors(file: FileRecord, lines: list[str]) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test", "example"}:
        return []
    candidates: list[_AnchorCandidate] = []
    for index, line in enumerate(lines, start=1):
        if match := ROUTE_DECORATOR_RE.search(line):
            method = match.group("method").upper()
            method = "ROUTE" if method == "ROUTE" else method
            path = match.group("path")
            candidates.append(
                _candidate(
                    "http_route",
                    f"{method} {path}",
                    file.path,
                    index,
                    "python_route_decorator",
                    0.92,
                    ("http", "route"),
                    f"HTTP route declared as {method} {path}.",
                )
            )
        if match := PY_ROUTE_MAP_RE.search(line):
            label = f"{match.group('method').upper()} {match.group('path')}"
            candidates.append(
                _candidate(
                    "http_route",
                    label,
                    file.path,
                    index,
                    "python_route_map_assignment",
                    0.9,
                    ("http", "route"),
                    f"HTTP route registered as {label}.",
                )
            )
        if match := JS_ROUTE_RE.search(line):
            label = f"{match.group('method').upper()} {match.group('path')}"
            candidates.append(
                _candidate(
                    "http_route",
                    label,
                    file.path,
                    index,
                    "javascript_route_call",
                    0.86,
                    ("http", "route"),
                    f"HTTP route registered as {label}.",
                )
            )
    return candidates


def _frontend_screen_anchors(file: FileRecord) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test", "example"} or file.language not in {"javascript", "typescript", "svelte", "vue"}:
        return []
    normalized = file.path.replace("\\", "/").lower()
    name = Path(file.path).name.lower()
    screen_like = (
        "/pages/" in f"/{normalized}"
        or "/routes/" in f"/{normalized}"
        or re.search(r"/app/.+/page\.(tsx|jsx|ts|js)$", normalized) is not None
        or name in {"+page.svelte", "page.tsx", "page.jsx", "page.ts", "page.js"}
    )
    if not screen_like:
        return []
    return [
        _candidate(
            "frontend_screen",
            _display_path_label(file.path),
            file.path,
            1,
            "frontend_route_file",
            0.78,
            ("frontend", "screen"),
            "Frontend page or route file.",
            end_line=min(max(file.line_count, 1), 8),
        )
    ]


def _cli_anchors(file: FileRecord, lines: list[str], text: str) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test"}:
        return []
    candidates: list[_AnchorCandidate] = []
    lowered_path = file.path.lower()
    for index, line in enumerate(lines, start=1):
        lowered = line.lower()
        if "__name__" in line and "__main__" in line:
            candidates.append(_candidate("cli_command", "Python module entrypoint", file.path, index, "python_main_guard", 0.86, ("cli",), "Python CLI/module entrypoint."))
        elif "argparse.argumentparser" in lowered or "click.command" in lowered or "typer(" in lowered:
            candidates.append(_candidate("cli_command", "CLI command setup", file.path, index, "cli_library_signal", 0.78, ("cli",), "CLI command or argument parser setup."))
    if Path(file.path).name in {"package.json"}:
        for script in _package_scripts(text):
            candidates.append(_candidate("cli_command", f"npm script: {script}", file.path, 1, "package_json_script", 0.72, ("cli", "script"), f"Package script named {script}."))
    elif any(part in lowered_path for part in ("/cli.", "/cmd/", "/commands/")):
        candidates.append(_candidate("cli_command", _display_path_label(file.path), file.path, 1, "cli_path_signal", 0.65, ("cli",), "CLI-related file path.", end_line=min(max(file.line_count, 1), 12)))
    return candidates


def _worker_anchors(file: FileRecord, lines: list[str], text: str) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test"}:
        return []
    candidates: list[_AnchorCandidate] = []
    path_signal = re.search(r"\b(worker|workers|consumer|job|jobs|task|tasks)\b", file.path, re.I)
    text_signal = re.search(r"@(shared_task|celery\.task)|\bnew\s+Worker\b|\bQueue\(", text, re.I)
    if path_signal or text_signal:
        line = _first_matching_line(lines, r"@(shared_task|celery\.task)|\bnew\s+Worker\b|\bQueue\(|def\s+\w*worker|class\s+\w*Worker") or 1
        candidates.append(_candidate("worker", _display_path_label(file.path), file.path, line, "worker_signal", 0.72 if text_signal else 0.62, ("worker", "job"), "Worker, consumer, job, or task entrypoint."))
    return candidates


def _cron_anchors(file: FileRecord, lines: list[str], text: str) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test"}:
        return []
    pattern = r"\b(cron\.schedule|schedule\.every|@scheduled|crontab|cronjob|schedule:)"
    line = _first_matching_line(lines, pattern)
    path_hit = re.search(r"\b(cron|schedule|scheduler)\b", file.path, re.I)
    if line or path_hit:
        return [_candidate("cron_job", _display_path_label(file.path), file.path, line or 1, "cron_or_schedule_signal", 0.74 if line else 0.6, ("cron", "schedule"), "Scheduled job or cron-related entrypoint.")]
    return []


def _webhook_anchors(file: FileRecord, lines: list[str], text: str) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test"}:
        return []
    line = _first_matching_line(lines, r"webhook")
    if line:
        return [_candidate("webhook", _display_path_label(file.path), file.path, line, "webhook_signal", 0.78, ("webhook",), "Webhook-related entrypoint or handler.")]
    return []


def _db_schema_anchors(
    file: FileRecord,
    lines: list[str],
    text: str,
    symbols: tuple[ParsedSymbol, ...],
) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test"}:
        return []
    candidates: list[_AnchorCandidate] = []
    if file.language == "sql" or re.search(r"\b(migration|migrations|schema\.prisma|models?)\b", file.path, re.I):
        line = _first_matching_line(lines, SQL_SCHEMA_RE.pattern) or 1
        candidates.append(_candidate("db_schema", _display_path_label(file.path), file.path, line, "schema_or_migration_file", 0.76, ("database", "schema"), "Database schema, model, or migration boundary."))
    for symbol in symbols:
        if symbol.path != file.path or symbol.kind != "class":
            continue
        signature = symbol.signature.lower()
        if "(base)" in signature or "models.model" in signature or "sqlmodel" in signature:
            candidates.append(_candidate("db_schema", symbol.name, file.path, symbol.start_line, "orm_model_symbol", 0.84, ("database", "model"), f"ORM/database model class {symbol.name}.", end_line=symbol.end_line))
    return candidates


def _queue_anchors(file: FileRecord, lines: list[str], text: str) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test"}:
        return []
    line = _first_matching_line(lines, r"\b(queue|publish|subscribe|consumer|producer|enqueue|dequeue|rabbitmq|kafka|sqs)\b")
    if line:
        return [_candidate("queue_boundary", _display_path_label(file.path), file.path, line, "queue_signal", 0.67, ("queue",), "Queue, message, publish, or consumer boundary.")]
    return []


def _external_api_anchors(file: FileRecord, lines: list[str], text: str) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test", "example"}:
        return []
    candidates: list[_AnchorCandidate] = []
    for index, line in enumerate(lines, start=1):
        if FETCH_RE.search(line) or re.search(r"https?://[^'\"\s]+", line):
            candidates.append(_candidate("external_api_client", _display_path_label(file.path), file.path, index, "outbound_http_signal", 0.68, ("external_api", "http"), "Outbound HTTP/API client boundary."))
            break
    return candidates


def _plugin_registry_anchors(file: FileRecord, lines: list[str], text: str) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test"}:
        return []
    line = _first_matching_line(lines, r"\b(plugin|extension|registry|register_plugin|register\()")
    if line and re.search(r"\b(plugin|extension|registry)\b", file.path + "\n" + text, re.I):
        return [_candidate("plugin_registry", _display_path_label(file.path), file.path, line, "plugin_registry_signal", 0.66, ("plugin", "registry"), "Plugin, extension, or registry boundary.")]
    return []


def _deployment_anchors(file: FileRecord) -> list[_AnchorCandidate]:
    name = Path(file.path).name.lower()
    if file.role == "infrastructure" or name in {"dockerfile", "docker-compose.yml", "docker-compose.yaml"} or name.endswith((".tf", ".yaml", ".yml")) and re.search(r"\b(k8s|deploy|helm|terraform|docker)\b", file.path, re.I):
        return [_candidate("deployment_unit", _display_path_label(file.path), file.path, 1, "deployment_file", 0.75, ("deployment",), "Deployment or infrastructure unit.", end_line=min(max(file.line_count, 1), 16))]
    return []


def _auth_anchors(file: FileRecord, lines: list[str], text: str) -> list[_AnchorCandidate]:
    if file.role in {"docs", "test"}:
        return []
    line = _first_matching_line(lines, r"\b(auth|authenticate|authorization|jwt|token|session|permission|login)\b")
    if line and re.search(r"\b(auth|jwt|token|session|permission|login)\b", file.path + "\n" + text, re.I):
        return [_candidate("auth_boundary", _display_path_label(file.path), file.path, line, "auth_signal", 0.7, ("auth",), "Authentication, authorization, token, or permission boundary.")]
    return []


def _manifest_export_anchors(file: FileRecord, lines: list[str], text: str) -> list[_AnchorCandidate]:
    if Path(file.path).name != "package.json":
        return []
    try:
        data = json.loads(text)
    except Exception:
        return []
    exports = data.get("exports")
    main = data.get("main")
    candidates: list[_AnchorCandidate] = []
    if exports:
        candidates.append(_candidate("public_export", "package exports", file.path, 1, "package_json_exports", 0.8, ("public_export", "package"), "Node package public export surface."))
    if main:
        candidates.append(_candidate("public_export", f"package main: {main}", file.path, 1, "package_json_main", 0.72, ("public_export", "package"), "Node package main entrypoint."))
    return candidates


def _python_package_export_anchors(file: FileRecord, lines: list[str]) -> list[_AnchorCandidate]:
    if Path(file.path).name != "__init__.py" or file.role in {"docs", "test", "example"}:
        return []
    candidates: list[_AnchorCandidate] = []
    import_re = re.compile(r"^\s*from\s+\.[\w.]+\s+import\s+(.+)$")
    all_re = re.compile(r"^\s*__all__\s*=\s*\[(.+)\]")
    for index, line in enumerate(lines, start=1):
        if match := import_re.search(line):
            imported = [part.strip().split(" as ")[0] for part in match.group(1).split(",")]
            for name in imported[:12]:
                if name and not name.startswith("_"):
                    candidates.append(_candidate("public_export", name, file.path, index, "python_package_init_import", 0.86, ("public_export", "package"), f"Python package export {name}."))
        elif match := all_re.search(line):
            for name in re.findall(r"['\"]([^'\"]+)['\"]", match.group(1))[:20]:
                candidates.append(_candidate("public_export", name, file.path, index, "python_dunder_all", 0.88, ("public_export", "package"), f"Python package __all__ export {name}."))
    return candidates


def _public_export_anchors(job: AnalysisJob, symbols: tuple[ParsedSymbol, ...]) -> list[_AnchorCandidate]:
    candidates: list[_AnchorCandidate] = []
    if not job.snapshot:
        return candidates
    for symbol in symbols:
        if not symbol.exported:
            continue
        if _is_test_or_docs_path(symbol.path):
            continue
        if _is_public_surface_file(symbol.path) or (symbol.language in {"javascript", "typescript"} and symbol.exported):
            candidates.append(
                _candidate(
                    "public_export",
                    symbol.qualified_name,
                    symbol.path,
                    symbol.start_line,
                    "parsed_exported_symbol",
                    0.82,
                    ("public_export", symbol.kind),
                    f"Public exported {symbol.kind} {symbol.qualified_name}.",
                    end_line=symbol.end_line,
                )
            )
    return candidates


def _candidate(
    kind: AnchorKind,
    label: str,
    path: str,
    start_line: int,
    extraction_method: str,
    confidence: float,
    signals: tuple[str, ...],
    summary: str,
    *,
    end_line: int | None = None,
) -> _AnchorCandidate:
    bounded_start = max(1, start_line)
    bounded_end = max(bounded_start, end_line or bounded_start)
    return _AnchorCandidate(
        kind=kind,
        label=label,
        path=path,
        start_line=bounded_start,
        end_line=bounded_end,
        extraction_method=extraction_method,
        confidence=confidence,
        signals=signals,
        summary=summary,
    )


def _dedupe(candidates: list[_AnchorCandidate]) -> tuple[_AnchorCandidate, ...]:
    best: dict[tuple[str, str, str, int], _AnchorCandidate] = {}
    for candidate in candidates:
        key = (candidate.kind, candidate.path, candidate.label.lower(), candidate.start_line)
        existing = best.get(key)
        if not existing or candidate.confidence > existing.confidence:
            best[key] = candidate
    return tuple(best.values())


def _related_symbols(
    symbols: tuple[ParsedSymbol, ...],
    path: str,
    start_line: int,
    end_line: int,
) -> tuple[str, ...]:
    related = [
        symbol.id
        for symbol in symbols
        if symbol.path == path
        and not (symbol.end_line < start_line or symbol.start_line > end_line)
    ]
    if related:
        return tuple(related[:8])
    enclosing = [
        symbol.id
        for symbol in symbols
        if symbol.path == path
        and symbol.start_line <= start_line
        and symbol.end_line >= end_line
    ]
    return tuple(enclosing[:8])


def _first_matching_line(lines: list[str], pattern: str) -> int | None:
    regex = re.compile(pattern, re.I)
    for index, line in enumerate(lines, start=1):
        if regex.search(line):
            return index
    return None


def _package_scripts(text: str) -> tuple[str, ...]:
    try:
        data = json.loads(text)
    except Exception:
        return ()
    scripts = data.get("scripts", {})
    if not isinstance(scripts, dict):
        return ()
    return tuple(str(key) for key in scripts)[:20]


def _display_path_label(path: str) -> str:
    normalized = path.replace("\\", "/")
    name = Path(normalized).name
    parent = Path(normalized).parent.as_posix()
    return f"{parent}/{name}" if parent and parent != "." else name


def _is_test_or_docs_path(path: str) -> bool:
    normalized = f"/{path.replace('\\', '/').lower()}/"
    return any(token in normalized for token in ("/tests/", "/test/", "/docs/", "/examples/"))


def _is_public_surface_file(path: str) -> bool:
    name = Path(path).name
    return name in {"index.ts", "index.js", "main.ts", "main.js"}


def _anchor_id(run_id: str, candidate: _AnchorCandidate) -> str:
    raw = "|".join(
        [
            run_id,
            candidate.kind,
            candidate.path,
            str(candidate.start_line),
            str(candidate.end_line),
            candidate.label,
            candidate.extraction_method,
        ]
    )
    return f"anchor:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"


def _kind_order(kind: str) -> int:
    order = {
        "http_route": 0,
        "frontend_screen": 1,
        "cli_command": 2,
        "worker": 3,
        "cron_job": 4,
        "webhook": 5,
        "db_schema": 6,
        "queue_boundary": 7,
        "external_api_client": 8,
        "public_export": 9,
        "plugin_registry": 10,
        "deployment_unit": 11,
        "auth_boundary": 12,
    }
    return order.get(kind, 99)
