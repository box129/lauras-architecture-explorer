"""Analysis stage tracking for observability."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal


StageStatus = Literal["pending", "running", "completed", "failed", "skipped"]


@dataclass
class AnalysisStage:
    stage_name: str
    display_name: str
    status: StageStatus = "pending"
    sort_order: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    model: str = ""
    fallback_reason: str | None = None
    cache_hit: bool = False
    tool_calls: int = 0
    regions_returned: int = 0
    warnings: list[str] = field(default_factory=list)
    error: str = ""
    can_render_frontend: bool = False

    def start(self) -> None:
        self.status = "running"
        self.started_at = datetime.now(UTC)

    def complete(
        self,
        *,
        tokens_in: int = 0,
        tokens_out: int = 0,
        model: str = "",
        fallback_reason: str | None = None,
        cache_hit: bool = False,
        tool_calls: int = 0,
        regions_returned: int = 0,
        warnings: list[str] | None = None,
        can_render_frontend: bool = False,
    ) -> None:
        self.status = "completed"
        self.finished_at = datetime.now(UTC)
        if self.started_at:
            self.duration_ms = int((self.finished_at - self.started_at).total_seconds() * 1000)
        self.tokens_in = tokens_in
        self.tokens_out = tokens_out
        self.model = model
        self.fallback_reason = fallback_reason
        self.cache_hit = cache_hit
        self.tool_calls = tool_calls
        self.regions_returned = regions_returned
        self.warnings = warnings or []
        self.can_render_frontend = can_render_frontend

    def fail(self, error: str) -> None:
        self.status = "failed"
        self.finished_at = datetime.now(UTC)
        if self.started_at:
            self.duration_ms = int((self.finished_at - self.started_at).total_seconds() * 1000)
        self.error = error

    def skip(self, reason: str = "") -> None:
        self.status = "skipped"
        self.finished_at = datetime.now(UTC)
        if reason:
            self.warnings.append(reason)
