"""Semantic anchor domain model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


AnchorKind = Literal[
    "http_route",
    "frontend_screen",
    "cli_command",
    "worker",
    "cron_job",
    "webhook",
    "db_schema",
    "queue_boundary",
    "external_api_client",
    "public_export",
    "plugin_registry",
    "deployment_unit",
    "auth_boundary",
]

AnchorStatus = Literal["source_detected", "candidate"]


@dataclass(frozen=True)
class SemanticAnchor:
    id: str
    run_id: str
    kind: AnchorKind
    label: str
    path: str
    start_line: int
    end_line: int
    source_region_id: str
    extraction_method: str
    confidence: float
    status: AnchorStatus
    related_symbol_ids: tuple[str, ...]
    signals: tuple[str, ...]
    summary: str

