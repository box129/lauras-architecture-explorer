"""Lightweight JavaScript/TypeScript symbol parser."""

from __future__ import annotations

import hashlib
import re

from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.core.models.file_record import FileRecord
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol, compute_stable_entity_key


PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^\s*(export\s+)?interface\s+([A-Za-z_$][\w$]*)"), "interface"),
    (re.compile(r"^\s*(export\s+)?type\s+([A-Za-z_$][\w$]*)"), "type_alias"),
    (re.compile(r"^\s*(export\s+)?class\s+([A-Za-z_$][\w$]*)"), "class"),
    (re.compile(r"^\s*(export\s+)?(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)"), "function"),
    (re.compile(r"^\s*(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?\(([^)]*)\)\s*=>"), "function"),
    (re.compile(r"^\s*(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?([A-Za-z_$][\w$]*)\s*=>"), "function"),
)


def parse_js_ts_symbols(reader: SourceReader, file: FileRecord, run_id: str) -> tuple[ParsedSymbol, ...]:
    content = str(reader.read_file_content(file.path)["content"])
    lines = content.splitlines()
    symbols: list[ParsedSymbol] = []
    class_stack: list[tuple[str, int, int]] = []

    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped == "}":
            class_stack = [(name, start, depth) for name, start, depth in class_stack if depth > _brace_depth(line)]
        matched = _match_declaration(line)
        if matched:
            name, kind, exported, async_, signature = matched
            end_line = _find_region_end(lines, index)
            parent_name = class_stack[-1][0] if class_stack and kind == "method" else ""
            symbols.append(
                _symbol(
                    reader=reader,
                    file=file,
                    run_id=run_id,
                    name=name,
                    kind=kind,
                    start_line=index,
                    end_line=end_line,
                    signature=signature,
                    exported=exported,
                    async_=async_,
                    parent_name=parent_name,
                    parent_id=None,
                )
            )
            if kind == "class":
                class_stack.append((name, index, _brace_depth(line)))
            continue
        method = _match_method(line)
        if method and class_stack:
            name, async_, signature = method
            end_line = _find_region_end(lines, index)
            symbols.append(
                _symbol(
                    reader=reader,
                    file=file,
                    run_id=run_id,
                    name=name,
                    kind="method",
                    start_line=index,
                    end_line=end_line,
                    signature=signature,
                    exported=False,
                    async_=async_,
                    parent_name=class_stack[-1][0],
                    parent_id=None,
                )
            )
    return tuple(symbols)


def _match_declaration(line: str) -> tuple[str, str, bool, bool, str] | None:
    for pattern, kind in PATTERNS:
        match = pattern.search(line)
        if not match:
            continue
        groups = match.groups()
        exported = bool(groups[0])
        if kind == "function" and "function" in pattern.pattern:
            async_ = bool(groups[1])
            name = groups[2]
            params = groups[3] if len(groups) > 3 else ""
            signature = f"{'async ' if async_ else ''}function {name}({params})"
        elif kind == "function":
            name = groups[1]
            async_ = bool(groups[2])
            params = groups[3] if len(groups) > 3 and groups[3] is not None else ""
            signature = f"{'async ' if async_ else ''}const {name} = ({params}) =>"
        else:
            name = groups[1]
            async_ = False
            signature = f"{kind} {name}"
        return name, kind, exported, async_, signature
    return None


def _match_method(line: str) -> tuple[str, bool, str] | None:
    match = re.search(r"^\s*(async\s+)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{?", line)
    if not match:
        return None
    name = match.group(2)
    if name in {"if", "for", "while", "switch", "catch"}:
        return None
    async_ = bool(match.group(1))
    return name, async_, f"{'async ' if async_ else ''}{name}({match.group(3)})"


def _find_region_end(lines: list[str], start_line: int) -> int:
    depth = 0
    seen_brace = False
    for index in range(start_line, len(lines) + 1):
        line = lines[index - 1]
        depth += line.count("{") - line.count("}")
        seen_brace = seen_brace or "{" in line
        if seen_brace and depth <= 0:
            return index
        if not seen_brace and index > start_line:
            return index - 1
    return start_line


def _brace_depth(line: str) -> int:
    return line.count("{") - line.count("}")


def _symbol(
    *,
    reader: SourceReader,
    file: FileRecord,
    run_id: str,
    name: str,
    kind: str,
    start_line: int,
    end_line: int,
    signature: str,
    exported: bool,
    async_: bool,
    parent_name: str,
    parent_id: str | None,
) -> ParsedSymbol:
    region = reader.read_range(file.path, start_line, end_line)
    qualified_name = f"{file.language}:{file.path}::{parent_name + '.' if parent_name else ''}{name}"
    symbol_id = _stable_symbol_id(run_id, qualified_name, start_line, end_line)
    stable_entity_key = compute_stable_entity_key(
        path=file.path,
        qualified_name=qualified_name,
        kind=kind,
        signature=signature,
    )
    return ParsedSymbol(
        id=symbol_id,
        run_id=run_id,
        path=file.path,
        language=file.language,
        name=name,
        qualified_name=qualified_name,
        kind=kind,  # type: ignore[arg-type]
        start_line=start_line,
        end_line=end_line,
        source_region_id=region.id,
        signature=signature,
        exported=exported,
        async_=async_,
        parent_symbol_id=parent_id,
        stable_entity_key=stable_entity_key,
    )


def _stable_symbol_id(run_id: str, qualified_name: str, start_line: int, end_line: int) -> str:
    raw = "|".join([run_id, qualified_name, str(start_line), str(end_line)])
    return f"symbol:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"

