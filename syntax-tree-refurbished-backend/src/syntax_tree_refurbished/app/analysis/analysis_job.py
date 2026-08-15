"""Analysis job records."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.core.models.repo_snapshot import RepoSnapshot


AnalysisStatus = Literal["queued", "running", "completed", "failed"]


@dataclass
class AnalysisJob:
    job_id: str
    run_id: str
    repository_path: str
    status: AnalysisStatus = "queued"
    stage: str = "queued"
    error: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    started_at: datetime | None = None
    completed_at: datetime | None = None
    snapshot: RepoSnapshot | None = None
    relations: tuple[ObservedProgramRelation, ...] = ()
    """Raw structural facts (``calls``/``inherits``/...) produced by the
    "relations" stage of ``AnalysisController.run()``, sourced from the same
    ``ParsedSymbol`` set the "parsing" stage already produced. This is a
    least-coupled attachment point only: persistence (``store.put_relations``
    / ``store.get_relations``) is a separate, not-yet-landed workstream
    (run-store relation persistence); nothing here reads or writes the run
    store. A future integration step will wire this field into that store
    once it lands, the same way ``job.snapshot`` is set directly on the job
    by the "snapshot" stage and only *separately* persisted via
    ``store.set_snapshot``/``store.set_completed``."""

    def start(self) -> None:
        self.status = "running"
        self.stage = "repo_snapshot"
        self.started_at = datetime.now(UTC)

    def complete(self, snapshot: RepoSnapshot) -> None:
        self.status = "completed"
        self.stage = "complete"
        self.completed_at = datetime.now(UTC)
        self.snapshot = snapshot

    def fail(self, error: str) -> None:
        self.status = "failed"
        self.stage = "failed"
        self.error = error
        self.completed_at = datetime.now(UTC)

