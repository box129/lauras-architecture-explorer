"""File language, role, manifest, and package-boundary classification."""

from __future__ import annotations

import json
import os
import re
import tomllib
from pathlib import Path

from syntax_tree_refurbished.core.models.file_record import ManifestRecord, PackageBoundary


LANGUAGE_BY_EXTENSION = {
    ".py": "python",
    ".pyi": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".svelte": "svelte",
    ".vue": "vue",
    ".go": "go",
    ".java": "java",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".c": "c",
    ".h": "c_header",
    ".hpp": "cpp_header",
    ".kt": "kotlin",
    ".swift": "swift",
    ".sql": "sql",
    ".md": "markdown",
    ".mdx": "markdown",
    ".rst": "rst",
    ".txt": "text",
    ".json": "json",
    ".toml": "toml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".ini": "ini",
    ".cfg": "ini",
    ".gradle": "gradle",
    ".lock": "lockfile",
}

MANIFEST_KINDS = {
    "package.json": "node_package",
    "pnpm-workspace.yaml": "pnpm_workspace",
    "yarn.lock": "yarn_lock",
    "package-lock.json": "npm_lock",
    "pyproject.toml": "python_project",
    "requirements.txt": "python_requirements",
    "poetry.lock": "poetry_lock",
    "go.mod": "go_module",
    "Cargo.toml": "rust_package",
    "pom.xml": "maven_project",
    "build.gradle": "gradle_project",
    "settings.gradle": "gradle_settings",
    "docker-compose.yml": "docker_compose",
    "docker-compose.yaml": "docker_compose",
}


def classify_language(path: str) -> str:
    name = os.path.basename(path)
    if name == "Dockerfile" or name.startswith("Dockerfile."):
        return "dockerfile"
    if name == "Makefile":
        return "makefile"
    return LANGUAGE_BY_EXTENSION.get(Path(path).suffix.lower(), "unknown")


def classify_role(path: str) -> str:
    normalized = path.replace("\\", "/").lower()
    parts = [part for part in normalized.split("/") if part]
    name = parts[-1] if parts else normalized

    if any(part in {"tests", "test", "__tests__", "__mocks__", "spec"} for part in parts):
        return "test"
    if any(token in name for token in (".spec.", ".test.", "_test.", "test_", "_spec.")):
        return "test"
    if any(part in {"examples", "example", "samples", "sample", "demo", "demos"} for part in parts):
        return "example"
    if any(part in {"docs", "doc"} for part in parts) or name.endswith((".md", ".mdx", ".rst")):
        return "docs"
    if any(part in {"scripts", "tools", ".github", ".gitlab", "ci", "bench", "benchmark", "benchmarks"} for part in parts):
        return "tooling"
    if any(part in {"deploy", "deployment", "k8s", "kubernetes", "helm", "terraform"} for part in parts):
        return "infrastructure"
    if name in MANIFEST_KINDS or any(part in {"config", "configs"} for part in parts):
        return "config"
    if any(token in name for token in (".generated.", ".gen.", ".min.")):
        return "generated"
    return "production"


def manifest_for(path: str, abs_path: Path) -> ManifestRecord | None:
    name = os.path.basename(path)
    kind = MANIFEST_KINDS.get(name)
    if not kind:
        return None
    return ManifestRecord(path=path, kind=kind, package_name=_package_name(kind, abs_path))


def package_boundary_for(manifest: ManifestRecord) -> PackageBoundary | None:
    if manifest.kind not in {
        "node_package",
        "python_project",
        "go_module",
        "rust_package",
        "maven_project",
        "gradle_project",
    }:
        return None
    parent = os.path.dirname(manifest.path).replace("\\", "/")
    return PackageBoundary(
        path=parent or ".",
        kind=manifest.kind,
        manifest_path=manifest.path,
        package_name=manifest.package_name,
    )


def _package_name(kind: str, path: Path) -> str:
    try:
        if kind == "node_package":
            return str(json.loads(path.read_text(encoding="utf-8")).get("name") or "")
        if kind == "python_project":
            data = tomllib.loads(path.read_text(encoding="utf-8"))
            project = data.get("project") if isinstance(data, dict) else {}
            if isinstance(project, dict) and project.get("name"):
                return str(project["name"])
            poetry = data.get("tool", {}).get("poetry", {}) if isinstance(data.get("tool"), dict) else {}
            if isinstance(poetry, dict) and poetry.get("name"):
                return str(poetry["name"])
        if kind == "go_module":
            text = path.read_text(encoding="utf-8", errors="replace")
            match = re.search(r"^\s*module\s+(.+?)\s*$", text, re.M)
            return match.group(1) if match else ""
        if kind == "rust_package":
            data = tomllib.loads(path.read_text(encoding="utf-8"))
            package = data.get("package") if isinstance(data, dict) else {}
            return str(package.get("name") or "") if isinstance(package, dict) else ""
    except Exception:
        return ""
    return ""

