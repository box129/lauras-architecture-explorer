"""SQLite-backed persistence for completed and in-progress analysis runs."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import asdict
from datetime import UTC, datetime
import json
from pathlib import Path
import sqlite3
from typing import Any, Callable, Iterable, Iterator

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import (
    InMemoryRunStore,
    normalize_repository_path,
)
from syntax_tree_refurbished.core.models.analysis_stage import AnalysisStage
from syntax_tree_refurbished.core.models.file_record import (
    FileRecord,
    ManifestRecord,
    PackageBoundary,
)
from syntax_tree_refurbished.core.models.orientation import OrientationItem
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import (
    ObservedProgramRelation,
    ResolutionEvidenceSpan,
)
from syntax_tree_refurbished.core.models.repo_snapshot import (
    LanguageCount,
    ParserCoverage,
    RepoSnapshot,
)
from syntax_tree_refurbished.core.models.semantic_anchor import SemanticAnchor
from syntax_tree_refurbished.core.models.source_region import SourceRegion


SCHEMA_VERSION = "1"


class SQLiteRunStore(InMemoryRunStore):
    """Keep the existing store API while durably mirroring core run artifacts."""

    def __init__(self, database_path: str) -> None:
        super().__init__()
        path = Path(database_path).expanduser()
        if not path.is_absolute():
            path = Path.cwd() / path
        self.database_path = str(path.resolve(strict=False))
        path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize_schema()
        self._restore()

    def put_job(self, job: AnalysisJob) -> None:
        with self._lock:
            super().put_job(job)
            self._persist_job(job)
            if job.snapshot:
                self._persist_snapshot(job.snapshot)
            if job.status == "completed":
                self._persist_active_run(job.run_id)

    def claim_job(self, job: AnalysisJob) -> tuple[AnalysisJob, bool]:
        with self._lock:
            claimed, created = super().claim_job(job)
            if created:
                self._persist_job(claimed)
            return claimed, created

    def set_completed(self, job: AnalysisJob, snapshot: RepoSnapshot) -> None:
        with self._lock:
            super().set_completed(job, snapshot)
            self._persist_snapshot(snapshot)
            self._persist_job(job)
            self._persist_active_run(job.run_id)

    def set_snapshot(self, job: AnalysisJob, snapshot: RepoSnapshot) -> None:
        with self._lock:
            super().set_snapshot(job, snapshot)
            self._persist_snapshot(snapshot)
            self._persist_job(job)

    def set_job_stage(self, job: AnalysisJob, stage: str) -> None:
        with self._lock:
            super().set_job_stage(job, stage)
            self._persist_job(job)

    def put_region(self, region: SourceRegion) -> None:
        self.put_regions((region,))

    def put_regions(self, regions: tuple[SourceRegion, ...]) -> None:
        with self._lock:
            super().put_regions(regions)
            self._write_many(
                """
                INSERT INTO source_regions(region_id, run_id, payload_json)
                VALUES (?, ?, ?)
                ON CONFLICT(region_id) DO UPDATE SET
                    run_id = excluded.run_id,
                    payload_json = excluded.payload_json
                """,
                ((region.id, region.run_id, _dump(region)) for region in regions),
            )

    def put_symbols(self, run_id: str, symbols: tuple[ParsedSymbol, ...]) -> None:
        with self._lock:
            super().put_symbols(run_id, symbols)
            self._persist_collection(run_id, "symbols", symbols)

    def put_relations(self, run_id: str, relations: tuple[ObservedProgramRelation, ...]) -> None:
        with self._lock:
            super().put_relations(run_id, relations)
            self._persist_relations(run_id, relations)

    def put_orientation_items(self, run_id: str, items: tuple[OrientationItem, ...]) -> None:
        with self._lock:
            super().put_orientation_items(run_id, items)
            self._persist_collection(run_id, "orientation", items)

    def put_anchors(self, run_id: str, anchors: tuple[SemanticAnchor, ...]) -> None:
        with self._lock:
            super().put_anchors(run_id, anchors)
            self._persist_collection(run_id, "anchors", anchors)

    def record_stage(self, run_id: str, stage: AnalysisStage) -> None:
        with self._lock:
            super().record_stage(run_id, stage)
            self._write(
                """
                INSERT INTO analysis_stages(run_id, stage_name, payload_json)
                VALUES (?, ?, ?)
                ON CONFLICT(run_id, stage_name) DO UPDATE SET
                    payload_json = excluded.payload_json
                """,
                (run_id, stage.stage_name, _dump(stage)),
            )

    def _initialize_schema(self) -> None:
        with self._connection() as connection:
            connection.executescript(
                """
                PRAGMA journal_mode = WAL;
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS store_metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS analysis_jobs (
                    job_id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL UNIQUE,
                    normalized_repository_path TEXT NOT NULL,
                    status TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_analysis_jobs_running_repository
                    ON analysis_jobs(normalized_repository_path, status);

                CREATE TABLE IF NOT EXISTS repo_snapshots (
                    run_id TEXT PRIMARY KEY,
                    payload_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS run_collections (
                    run_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    PRIMARY KEY(run_id, kind)
                );

                CREATE TABLE IF NOT EXISTS source_regions (
                    region_id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_source_regions_run
                    ON source_regions(run_id);

                CREATE TABLE IF NOT EXISTS analysis_stages (
                    run_id TEXT NOT NULL,
                    stage_name TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    PRIMARY KEY(run_id, stage_name)
                );

                CREATE TABLE IF NOT EXISTS program_relations (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    relation_kind TEXT NOT NULL,
                    source_entity_id TEXT NOT NULL,
                    target_entity_id TEXT,
                    target_reference TEXT,
                    span_path TEXT,
                    span_start_line INTEGER,
                    span_end_line INTEGER,
                    extractor_name TEXT NOT NULL,
                    extractor_version TEXT NOT NULL,
                    resolution_status TEXT NOT NULL,
                    confidence REAL,
                    resolution_basis TEXT,
                    supporting_resolution_spans_json TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_program_relations_run
                    ON program_relations(run_id);
                """
            )
            # Additive migration: `resolution_basis`/`supporting_resolution_spans_json`
            # were added to `program_relations` after the table above may already
            # exist on disk (from a DB file written before these columns existed).
            # `CREATE TABLE IF NOT EXISTS` is a no-op against an already-existing
            # table, so a pre-existing `program_relations` table would otherwise be
            # missing these columns entirely -- add them explicitly, guarded so this
            # is idempotent (safe to run every time the store starts, on both a
            # fresh DB where CREATE TABLE just made the columns already, and an old
            # DB that genuinely needs the ALTER).
            existing_columns = {
                row[1] for row in connection.execute("PRAGMA table_info(program_relations)")
            }
            if "resolution_basis" not in existing_columns:
                connection.execute("ALTER TABLE program_relations ADD COLUMN resolution_basis TEXT")
            if "supporting_resolution_spans_json" not in existing_columns:
                connection.execute(
                    "ALTER TABLE program_relations ADD COLUMN supporting_resolution_spans_json TEXT"
                )
            connection.execute(
                """
                INSERT INTO store_metadata(key, value) VALUES ('schema_version', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (SCHEMA_VERSION,),
            )

    def _restore(self) -> None:
        with self._lock, self._connection() as connection:
            jobs_by_run: dict[str, AnalysisJob] = {}
            for row in connection.execute(
                "SELECT payload_json FROM analysis_jobs ORDER BY rowid"
            ):
                job = _job_from_dict(json.loads(row[0]))
                super().put_job(job)
                jobs_by_run[job.run_id] = job

            for row in connection.execute("SELECT run_id, payload_json FROM repo_snapshots"):
                snapshot = _snapshot_from_dict(json.loads(row[1]))
                job = jobs_by_run.get(row[0])
                if job:
                    job.snapshot = snapshot

            collection_loaders: dict[str, tuple[Callable[[dict[str, Any]], Any], Callable[..., None]]] = {
                "symbols": (_symbol_from_dict, super().put_symbols),
                "orientation": (_orientation_from_dict, super().put_orientation_items),
                "anchors": (_anchor_from_dict, super().put_anchors),
            }
            for row in connection.execute(
                "SELECT run_id, kind, payload_json FROM run_collections"
            ):
                configured = collection_loaders.get(row[1])
                if not configured:
                    continue
                loader, putter = configured
                values = tuple(loader(item) for item in json.loads(row[2]))
                putter(row[0], values)

            for row in connection.execute("SELECT payload_json FROM source_regions"):
                super().put_region(_region_from_dict(json.loads(row[0])))

            relations_by_run: dict[str, list[ObservedProgramRelation]] = {}
            for row in connection.execute(
                """
                SELECT id, run_id, relation_kind, source_entity_id, target_entity_id,
                       target_reference, span_path, span_start_line, span_end_line,
                       extractor_name, extractor_version, resolution_status, confidence,
                       resolution_basis, supporting_resolution_spans_json
                FROM program_relations
                ORDER BY run_id, rowid
                """
            ):
                relation = ObservedProgramRelation(
                    id=row[0],
                    run_id=row[1],
                    relation_kind=row[2],
                    source_entity_id=row[3],
                    target_entity_id=row[4],
                    target_reference=row[5],
                    span_path=row[6],
                    span_start_line=row[7],
                    span_end_line=row[8],
                    extractor_name=row[9],
                    extractor_version=row[10],
                    resolution_status=row[11],
                    confidence=row[12],
                    resolution_basis=row[13],
                    supporting_resolution_spans=_load_supporting_spans(row[14]),
                )
                relations_by_run.setdefault(row[1], []).append(relation)
            for run_id, relations in relations_by_run.items():
                super().put_relations(run_id, tuple(relations))

            for row in connection.execute(
                "SELECT run_id, payload_json FROM analysis_stages ORDER BY run_id, rowid"
            ):
                super().record_stage(row[0], _stage_from_dict(json.loads(row[1])))

            active_row = connection.execute(
                "SELECT value FROM store_metadata WHERE key = 'active_run_id'"
            ).fetchone()
            if active_row and (active := jobs_by_run.get(active_row[0])) and active.status == "completed":
                self._active_run_id = active.run_id

        self._mark_interrupted_jobs_failed()

    def _mark_interrupted_jobs_failed(self) -> None:
        for job in tuple(self._jobs.values()):
            if job.status not in {"queued", "running"}:
                continue
            job.fail("Analysis was interrupted by a backend restart.")
            self._persist_job(job)
            for stage in self._stages_by_run.get(job.run_id, []):
                if stage.status == "running":
                    stage.fail("Analysis was interrupted by a backend restart.")
                    self.record_stage(job.run_id, stage)

    def _persist_job(self, job: AnalysisJob) -> None:
        self._write(
            """
            INSERT INTO analysis_jobs(
                job_id, run_id, normalized_repository_path, status, payload_json
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                run_id = excluded.run_id,
                normalized_repository_path = excluded.normalized_repository_path,
                status = excluded.status,
                payload_json = excluded.payload_json
            """,
            (
                job.job_id,
                job.run_id,
                normalize_repository_path(job.repository_path),
                job.status,
                json.dumps(_job_to_dict(job), sort_keys=True),
            ),
        )

    def _persist_snapshot(self, snapshot: RepoSnapshot) -> None:
        self._write(
            """
            INSERT INTO repo_snapshots(run_id, payload_json) VALUES (?, ?)
            ON CONFLICT(run_id) DO UPDATE SET payload_json = excluded.payload_json
            """,
            (snapshot.run_id, _dump(snapshot)),
        )

    def _persist_collection(self, run_id: str, kind: str, values: Iterable[Any]) -> None:
        self._write(
            """
            INSERT INTO run_collections(run_id, kind, payload_json) VALUES (?, ?, ?)
            ON CONFLICT(run_id, kind) DO UPDATE SET payload_json = excluded.payload_json
            """,
            (run_id, kind, json.dumps([asdict(value) for value in values], sort_keys=True)),
        )

    def _persist_relations(self, run_id: str, relations: Iterable[ObservedProgramRelation]) -> None:
        with self._connection() as connection:
            connection.execute("DELETE FROM program_relations WHERE run_id = ?", (run_id,))
            # OR IGNORE: relation.id is a deterministic, content-addressed
            # identity (see _relation_id's docstring -- "same inputs always
            # yield the same id"). Two ObservedProgramRelation values can
            # legitimately share an id when an extractor observes the exact
            # same fact more than once (e.g. two calls to the same
            # unresolved builtin target on the same source line, where span
            # identity is line-granular, not column-granular) -- per the
            # documented identity contract that is the same fact recorded
            # twice, not a genuine collision between two different facts, so
            # the duplicate insert is safely dropped rather than treated as
            # a hard failure.
            connection.executemany(
                """
                INSERT OR IGNORE INTO program_relations (
                    id, run_id, relation_kind, source_entity_id, target_entity_id,
                    target_reference, span_path, span_start_line, span_end_line,
                    extractor_name, extractor_version, resolution_status, confidence,
                    resolution_basis, supporting_resolution_spans_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    (
                        relation.id,
                        relation.run_id,
                        relation.relation_kind,
                        relation.source_entity_id,
                        relation.target_entity_id,
                        relation.target_reference,
                        relation.span_path,
                        relation.span_start_line,
                        relation.span_end_line,
                        relation.extractor_name,
                        relation.extractor_version,
                        relation.resolution_status,
                        relation.confidence,
                        relation.resolution_basis,
                        _dump_supporting_spans(relation.supporting_resolution_spans),
                    )
                    for relation in relations
                ),
            )

    def _persist_active_run(self, run_id: str) -> None:
        self._write(
            """
            INSERT INTO store_metadata(key, value) VALUES ('active_run_id', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (run_id,),
        )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=10, check_same_thread=False)
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        """Commit or roll back work and always release the database file handle."""
        connection = self._connect()
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _write(self, sql: str, parameters: tuple[Any, ...]) -> None:
        with self._connection() as connection:
            connection.execute(sql, parameters)

    def _write_many(self, sql: str, parameters: Iterable[tuple[Any, ...]]) -> None:
        with self._connection() as connection:
            connection.executemany(sql, parameters)


def _dump(value: Any) -> str:
    return json.dumps(asdict(value), default=_json_default, sort_keys=True)


def _dump_supporting_spans(spans: tuple[ResolutionEvidenceSpan, ...]) -> str | None:
    """NULL for the common case (no supporting resolution spans), never an
    empty-but-present JSON array, so a plain `program_relations` row from
    before this column existed and a relation with genuinely no supporting
    spans are indistinguishable in storage -- both round-trip to `()`."""
    if not spans:
        return None
    return json.dumps([asdict(span) for span in spans], sort_keys=True)


def _load_supporting_spans(payload: str | None) -> tuple[ResolutionEvidenceSpan, ...]:
    if not payload:
        return ()
    return tuple(ResolutionEvidenceSpan(**item) for item in json.loads(payload))


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"Unsupported JSON value: {type(value).__name__}")


def _job_to_dict(job: AnalysisJob) -> dict[str, Any]:
    return {
        "job_id": job.job_id,
        "run_id": job.run_id,
        "repository_path": job.repository_path,
        "status": job.status,
        "stage": job.stage,
        "error": job.error,
        "created_at": job.created_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


def _job_from_dict(raw: dict[str, Any]) -> AnalysisJob:
    return AnalysisJob(
        job_id=str(raw["job_id"]),
        run_id=str(raw["run_id"]),
        repository_path=str(raw["repository_path"]),
        status=str(raw.get("status", "queued")),  # type: ignore[arg-type]
        stage=str(raw.get("stage", "queued")),
        error=str(raw.get("error", "")),
        created_at=_datetime(raw["created_at"]) or datetime.now(UTC),
        started_at=_datetime(raw.get("started_at")),
        completed_at=_datetime(raw.get("completed_at")),
    )


def _snapshot_from_dict(raw: dict[str, Any]) -> RepoSnapshot:
    coverage = raw["parser_coverage"]
    return RepoSnapshot(
        run_id=str(raw["run_id"]),
        repo_path=str(raw["repo_path"]),
        repo_name=str(raw["repo_name"]),
        files=tuple(FileRecord(**item) for item in raw.get("files", [])),
        languages=tuple(LanguageCount(**item) for item in raw.get("languages", [])),
        manifests=tuple(ManifestRecord(**item) for item in raw.get("manifests", [])),
        package_boundaries=tuple(
            PackageBoundary(**item) for item in raw.get("package_boundaries", [])
        ),
        parser_coverage=ParserCoverage(
            deeply_parsed_languages=tuple(coverage.get("deeply_parsed_languages", [])),
            text_indexed_languages=tuple(coverage.get("text_indexed_languages", [])),
            skipped_file_count=int(coverage.get("skipped_file_count", 0)),
            readable_file_count=int(coverage.get("readable_file_count", 0)),
        ),
        created_at=_datetime(raw["created_at"]) or datetime.now(UTC),
    )


def _symbol_from_dict(raw: dict[str, Any]) -> ParsedSymbol:
    return ParsedSymbol(**raw)


def _orientation_from_dict(raw: dict[str, Any]) -> OrientationItem:
    return OrientationItem(
        **{
            **raw,
            "headings": tuple(raw.get("headings", [])),
            "signals": tuple(raw.get("signals", [])),
        }
    )


def _anchor_from_dict(raw: dict[str, Any]) -> SemanticAnchor:
    return SemanticAnchor(
        **{
            **raw,
            "related_symbol_ids": tuple(raw.get("related_symbol_ids", [])),
            "signals": tuple(raw.get("signals", [])),
        }
    )


def _region_from_dict(raw: dict[str, Any]) -> SourceRegion:
    return SourceRegion(**raw)


def _stage_from_dict(raw: dict[str, Any]) -> AnalysisStage:
    return AnalysisStage(
        **{
            **raw,
            "started_at": _datetime(raw.get("started_at")),
            "finished_at": _datetime(raw.get("finished_at")),
            "warnings": list(raw.get("warnings", [])),
        }
    )


def _datetime(value: Any) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(str(value))
