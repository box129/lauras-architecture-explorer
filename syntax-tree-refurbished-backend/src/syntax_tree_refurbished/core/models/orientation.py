"""Orientation inventory domain models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


OrientationKind = Literal[
    "readme",
    "docs_page",
    "manifest",
    "example",
    "config",
    "deployment_note",
    "text_note",
]


@dataclass(frozen=True)
class OrientationItem:
    id: str
    run_id: str
    path: str
    kind: OrientationKind
    role: str
    trust_level: str
    title: str
    headings: tuple[str, ...]
    signals: tuple[str, ...]
    summary: str
    proof_allowed: bool = False

