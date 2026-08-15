"""Deterministic, source-backed module structure for offline workflows."""

from __future__ import annotations

import ast
import hashlib
from pathlib import PurePosixPath
import re

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.core.models.system_overview import OverviewComponent, OverviewRelationship


SUPPORTED_LANGUAGES = {"python", "javascript", "typescript", "tsx", "jsx"}
JS_IMPORT_RE = re.compile(
    r"(?:\bimport\s+(?:[^'\"]+?\s+from\s+)?|\bexport\s+[^'\"]+?\s+from\s+|\brequire\s*\()"
    r"['\"](?P<module>[^'\"]+)['\"]"
)


def module_component_id(run_id: str, path: str) -> str:
    return _stable_id("module", run_id, _normalized(path))


def build_static_structure(
    job: AnalysisJob,
    store: InMemoryRunStore,
) -> tuple[tuple[OverviewComponent, ...], tuple[OverviewRelationship, ...]]:
    """Build module nodes and import edges without executing repository code."""
    if not job.snapshot:
        return (), ()
    reader = SourceReader(job)
    files = tuple(
        file
        for file in job.snapshot.files
        if file.readable and file.language in SUPPORTED_LANGUAGES
    )
    components: list[OverviewComponent] = []
    component_by_path: dict[str, OverviewComponent] = {}
    for file in files:
        path = _normalized(file.path)
        symbols = store.get_symbols_for_file(job.run_id, path)
        try:
            region = reader.read_range(path, 1, max(1, min(file.line_count, 2_000)))
            store.put_region(region)
            region_ids = (region.id,)
        except SourceReadError:
            region_ids = tuple(symbol.source_region_id for symbol in symbols)
        top_level = tuple(symbol for symbol in symbols if not symbol.parent_symbol_id)
        summary = _module_summary(path, file.language, symbols)
        component = OverviewComponent(
            id=module_component_id(job.run_id, path),
            label=path,
            kind="module",
            summary=summary,
            responsibilities=tuple(symbol.signature or symbol.name for symbol in top_level[:12]),
            source_region_ids=region_ids,
            anchor_ids=(),
            related_file_paths=(path,),
            support_status="verified",
            confidence=0.98,
            children_hint=tuple(symbol.name for symbol in top_level[:20]),
        )
        components.append(component)
        component_by_path[path] = component

    relationships: list[OverviewRelationship] = []
    seen: set[tuple[str, str, str]] = set()
    for file in files:
        source_path = _normalized(file.path)
        source = component_by_path.get(source_path)
        if not source:
            continue
        try:
            content = str(reader.read_file_content(source_path)["content"])
        except SourceReadError:
            continue
        targets = (
            _python_import_targets(source_path, content, set(component_by_path))
            if file.language == "python"
            else _js_import_targets(source_path, content, set(component_by_path))
        )
        for target_path in targets:
            target = component_by_path.get(target_path)
            if not target or target.id == source.id:
                continue
            key = (source.id, target.id, "imports")
            if key in seen:
                continue
            seen.add(key)
            relationships.append(
                OverviewRelationship(
                    from_component_id=source.id,
                    to_component_id=target.id,
                    label="imports",
                    summary=f"{source_path} imports {target_path}.",
                    source_region_ids=source.source_region_ids[:1],
                    support_status="verified",
                )
            )
    return tuple(components), tuple(relationships)


def _module_summary(path: str, language: str, symbols) -> str:
    if not symbols:
        return f"{path} is a {language} module with no parsed declarations."
    labels = ", ".join(symbol.name for symbol in symbols[:8])
    suffix = "" if len(symbols) <= 8 else f", and {len(symbols) - 8} more"
    return f"{path} defines {labels}{suffix}."


def _python_import_targets(source_path: str, content: str, known_paths: set[str]) -> tuple[str, ...]:
    try:
        tree = ast.parse(content, filename=source_path)
    except SyntaxError:
        return ()
    module_paths = _python_module_paths(known_paths)
    output: list[str] = []
    source_module = _python_module_name(source_path)
    if source_path == "__init__.py":
        source_package = ""
    elif source_path.endswith("/__init__.py"):
        source_package = source_module.removesuffix(".__init__")
    else:
        source_package = source_module.rpartition(".")[0]
    for node in ast.walk(tree):
        candidates: list[str] = []
        if isinstance(node, ast.Import):
            candidates.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            prefix = source_package.split(".") if source_package else []
            if node.level:
                trim = max(0, node.level - 1)
                if trim:
                    prefix = prefix[:-trim] if trim <= len(prefix) else []
                base = ".".join([*prefix, *(node.module or "").split(".")]).strip(".")
            else:
                base = node.module or ""
            if base:
                candidates.append(base)
            candidates.extend(f"{base}.{alias.name}".strip(".") for alias in node.names)
        for module in candidates:
            target = module_paths.get(module)
            if target and target not in output:
                output.append(target)
    return tuple(output)


def _python_module_paths(paths: set[str]) -> dict[str, str]:
    output: dict[str, str] = {}
    for path in paths:
        if not path.endswith(".py"):
            continue
        module = _python_module_name(path)
        output[module] = path
        if path.endswith("/__init__.py"):
            output[module.removesuffix(".__init__")] = path
        elif path == "__init__.py":
            output["__init__"] = path
    return output


def _python_module_name(path: str) -> str:
    return path.removesuffix(".py").replace("/", ".")


def _js_import_targets(source_path: str, content: str, known_paths: set[str]) -> tuple[str, ...]:
    output: list[str] = []
    parent = PurePosixPath(source_path).parent
    for match in JS_IMPORT_RE.finditer(content):
        module = match.group("module")
        if not module.startswith("."):
            continue
        base = _normalized(str(parent / module))
        candidates = [
            base,
            *(f"{base}{suffix}" for suffix in (".ts", ".tsx", ".js", ".jsx")),
            *(f"{base}/index{suffix}" for suffix in (".ts", ".tsx", ".js", ".jsx")),
        ]
        target = next((candidate for candidate in candidates if candidate in known_paths), None)
        if target and target not in output:
            output.append(target)
    return tuple(output)


def _normalized(path: str) -> str:
    parts: list[str] = []
    for part in path.replace("\\", "/").split("/"):
        if not part or part == ".":
            continue
        if part == "..":
            if parts:
                parts.pop()
            continue
        parts.append(part)
    return "/".join(parts)


def _stable_id(prefix: str, *parts: str) -> str:
    raw = "|".join(str(part) for part in parts)
    return f"{prefix}:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"
