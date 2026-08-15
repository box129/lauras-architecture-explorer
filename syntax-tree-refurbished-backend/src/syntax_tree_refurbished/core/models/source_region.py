"""Source region domain model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


RegionType = Literal["range", "whole_file"]


@dataclass(frozen=True)
class SourceRegion:
    id: str
    run_id: str
    path: str
    start_line: int
    end_line: int
    content_hash: str
    text: str
    region_type: RegionType
    token_count: int
    parser_confidence: float | None

    @property
    def line_count(self) -> int:
        return max(0, self.end_line - self.start_line + 1)

