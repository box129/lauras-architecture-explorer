"""Grounding and citation validation models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


SupportStatus = Literal[
    "verified",
    "inferred",
    "orientation_only",
    "uncertain",
    "unsupported",
    "not_inspected",
]

CitationKind = Literal[
    "source_region",
    "semantic_anchor",
    "parsed_symbol",
    "orientation_item",
    "file_range",
]


@dataclass(frozen=True)
class Citation:
    kind: CitationKind
    ref_id: str | None = None
    path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    content_hash: str | None = None


@dataclass(frozen=True)
class Claim:
    id: str
    text: str
    requested_status: SupportStatus
    citations: tuple[Citation, ...]


@dataclass(frozen=True)
class CitationValidation:
    citation: Citation
    valid: bool
    support_status: SupportStatus
    resolved_region_id: str | None
    reason: str


@dataclass(frozen=True)
class GroundedClaim:
    claim: Claim
    support_status: SupportStatus
    citations: tuple[CitationValidation, ...]
    failures: tuple[str, ...]


@dataclass(frozen=True)
class GroundingResult:
    run_id: str
    claims: tuple[GroundedClaim, ...]
    verified_count: int
    downgraded_count: int
    failure_count: int

