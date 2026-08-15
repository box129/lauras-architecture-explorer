"""Build guidance-only orientation inventory from docs, manifests, and common text files."""

from __future__ import annotations

import json
import re
import tomllib
from pathlib import Path

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.core.models.file_record import FileRecord
from syntax_tree_refurbished.core.models.orientation import OrientationItem


MAX_SUMMARY_CHARS = 360


SIGNAL_TERMS = (
    "api",
    "auth",
    "authentication",
    "authorization",
    "cli",
    "client",
    "database",
    "deployment",
    "docker",
    "event",
    "frontend",
    "http",
    "integration",
    "job",
    "queue",
    "route",
    "server",
    "service",
    "test",
    "transport",
    "webhook",
    "worker",
    "workflow",
)


def build_orientation_inventory(job: AnalysisJob) -> tuple[OrientationItem, ...]:
    if not job.snapshot:
        return ()
    reader = SourceReader(job)
    items: list[OrientationItem] = []
    for file in job.snapshot.files:
        if not file.readable:
            continue
        kind = _orientation_kind(file)
        if not kind:
            continue
        try:
            text = str(reader.read_file_content(file.path)["content"])
        except Exception:
            continue
        items.append(_item_from_file(job.run_id, file, kind, text))
    return tuple(sorted(items, key=lambda item: (_priority(item), item.path)))


def _orientation_kind(file: FileRecord) -> str | None:
    name = Path(file.path).name.lower()
    if name.startswith("readme") and file.language in {"markdown", "rst", "text"}:
        return "readme"
    if file.role == "docs" and file.language in {"markdown", "rst", "text"}:
        return "docs_page"
    if file.role == "example" and file.language in {"markdown", "rst", "text", "python", "javascript", "typescript"}:
        return "example"
    if file.role == "infrastructure" and file.language in {"markdown", "text", "yaml", "json", "dockerfile"}:
        return "deployment_note"
    if file.role == "config" or Path(file.path).name in {
        "package.json",
        "pyproject.toml",
        "requirements.txt",
        "go.mod",
        "Cargo.toml",
        "docker-compose.yml",
        "docker-compose.yaml",
    }:
        return "manifest" if _is_manifest(file.path) else "config"
    if file.language in {"text", "rst"}:
        return "text_note"
    return None


def _is_manifest(path: str) -> bool:
    return Path(path).name in {
        "package.json",
        "pyproject.toml",
        "requirements.txt",
        "go.mod",
        "Cargo.toml",
        "docker-compose.yml",
        "docker-compose.yaml",
    }


def _item_from_file(run_id: str, file: FileRecord, kind: str, text: str) -> OrientationItem:
    title = _title(file, text, kind)
    headings = tuple(_headings(text, file.language))
    signals = tuple(
        sorted(
            _signals(
                " ".join(
                    [
                        file.path,
                        title,
                        " ".join(headings),
                        text[:20_000],
                        _first_paragraph(text),
                        _manifest_text(file.path, text),
                    ]
                )
            )
        )
    )
    summary = _summary(file, text, title, headings, kind)
    return OrientationItem(
        id=_orientation_id(run_id, file.path),
        run_id=run_id,
        path=file.path,
        kind=kind,  # type: ignore[arg-type]
        role="orientation",
        trust_level="guidance_only" if kind != "manifest" else "metadata_guidance",
        title=title,
        headings=headings,
        signals=signals,
        summary=summary,
        proof_allowed=False,
    )


def _title(file: FileRecord, text: str, kind: str) -> str:
    if file.language == "markdown":
        for line in text.splitlines():
            match = re.match(r"^\s{0,3}#\s+(.+?)\s*$", line)
            if match:
                return match.group(1).strip()
    manifest_title = _manifest_title(file.path, text)
    if manifest_title:
        return manifest_title
    name = Path(file.path).name
    if kind == "readme":
        return "README"
    return name


def _headings(text: str, language: str) -> list[str]:
    if language == "markdown":
        return [
            match.group(2).strip()
            for line in text.splitlines()
            if (match := re.match(r"^\s{0,3}(#{1,6})\s+(.+?)\s*$", line))
        ][:40]
    headings: list[str] = []
    lines = text.splitlines()
    for index, line in enumerate(lines[:-1]):
        if line.strip() and re.match(r"^\s*(=+|-+)\s*$", lines[index + 1]):
            headings.append(line.strip())
    return headings[:40]


def _manifest_title(path: str, text: str) -> str:
    name = Path(path).name
    try:
        if name == "package.json":
            data = json.loads(text)
            return str(data.get("name") or "")
        if name == "pyproject.toml":
            data = tomllib.loads(text)
            project = data.get("project") if isinstance(data, dict) else {}
            if isinstance(project, dict) and project.get("name"):
                return str(project["name"])
            poetry = data.get("tool", {}).get("poetry", {}) if isinstance(data.get("tool"), dict) else {}
            if isinstance(poetry, dict) and poetry.get("name"):
                return str(poetry["name"])
        if name == "Cargo.toml":
            data = tomllib.loads(text)
            package = data.get("package") if isinstance(data, dict) else {}
            if isinstance(package, dict) and package.get("name"):
                return str(package["name"])
    except Exception:
        return ""
    return ""


def _manifest_text(path: str, text: str) -> str:
    name = Path(path).name
    try:
        if name == "package.json":
            data = json.loads(text)
            scripts = data.get("scripts", {}) if isinstance(data, dict) else {}
            deps = data.get("dependencies", {}) if isinstance(data, dict) else {}
            return " ".join([str(data.get("description") or ""), " ".join(scripts), " ".join(deps)])
        if name == "pyproject.toml":
            data = tomllib.loads(text)
            project = data.get("project", {}) if isinstance(data, dict) else {}
            deps = project.get("dependencies", []) if isinstance(project, dict) else []
            return " ".join([str(project.get("description") or ""), " ".join(map(str, deps))])
    except Exception:
        return ""
    return ""


def _signals(text: str) -> set[str]:
    haystack = text.lower()
    return {term for term in SIGNAL_TERMS if re.search(rf"\b{re.escape(term)}s?\b", haystack)}


def _summary(file: FileRecord, text: str, title: str, headings: tuple[str, ...], kind: str) -> str:
    if kind == "manifest":
        manifest = _manifest_text(file.path, text)
        if manifest:
            return f"{Path(file.path).name} describes package metadata and signals: {manifest[:MAX_SUMMARY_CHARS]}"
    first_para = _first_paragraph(text)
    if first_para:
        return first_para[:MAX_SUMMARY_CHARS]
    if headings:
        return f"{title} contains sections: {', '.join(headings[:6])}."
    return f"{Path(file.path).name} is available as guidance-only orientation material."


def _first_paragraph(text: str) -> str:
    lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            if lines:
                break
            continue
        lines.append(stripped)
    return " ".join(lines)


def _orientation_id(run_id: str, path: str) -> str:
    import hashlib

    return f"orient:{hashlib.sha1('|'.join([run_id, path]).encode('utf-8')).hexdigest()[:24]}"


def _priority(item: OrientationItem) -> int:
    order = {
        "readme": 0,
        "manifest": 1,
        "docs_page": 2,
        "deployment_note": 3,
        "example": 4,
        "config": 5,
        "text_note": 6,
    }
    return order.get(item.kind, 99)
