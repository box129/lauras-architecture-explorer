"""File inventory domain models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


FileRole = Literal[
    "production",
    "test",
    "example",
    "docs",
    "config",
    "tooling",
    "generated",
    "infrastructure",
    "unknown",
]

FileStatus = Literal[
    "readable",
    "skipped_binary",
    "skipped_too_large",
    "skipped_error",
]


@dataclass(frozen=True)
class FileRecord:
    path: str
    language: str
    role: FileRole
    status: FileStatus
    readable: bool
    size_bytes: int
    line_count: int
    content_hash: str
    extension: str


@dataclass(frozen=True)
class ManifestRecord:
    path: str
    kind: str
    package_name: str


@dataclass(frozen=True)
class PackageBoundary:
    path: str
    kind: str
    manifest_path: str
    package_name: str

