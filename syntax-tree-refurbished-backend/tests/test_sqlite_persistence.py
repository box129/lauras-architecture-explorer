from __future__ import annotations

import sqlite3
from pathlib import Path

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.analysis.analysis_controller import AnalysisController
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.analysis.sqlite_run_store import SQLiteRunStore
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.program_relation import (
    ObservedProgramRelation,
    ResolutionEvidenceSpan,
)


def test_completed_analysis_restores_core_artifacts_from_sqlite(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    write(repository / "README.md", "# Demo\n\nSmall API fixture.\n")
    write(
        repository / "app.py",
        "@router.get('/health')\n"
        "def health():\n"
        "    return {'ok': True}\n",
    )
    database = tmp_path / "state" / "backend.sqlite"
    settings = Settings(environment="integration", database_path=str(database))

    first_app = create_app(settings)
    first_controller = AnalysisController(
        settings=settings,
        store=first_app.state.run_store,
    )
    job = first_controller.start(str(repository))
    first_controller.run(job)

    assert database.is_file()
    assert job.status == "completed"
    assert first_app.state.run_store.get_symbols(job.run_id)
    assert first_app.state.run_store.get_orientation_items(job.run_id)
    assert first_app.state.run_store.get_anchors(job.run_id)
    anchor_region_id = first_app.state.run_store.get_anchors(job.run_id)[0].source_region_id
    assert first_app.state.run_store.get_region(anchor_region_id)
    assert len(first_app.state.run_store.get_stages(job.run_id)) == 6

    restored_app = create_app(settings)
    restored = restored_app.state.run_store.get_run(job.run_id)

    assert isinstance(restored_app.state.run_store, SQLiteRunStore)
    assert restored is not None
    assert restored.status == "completed"
    assert restored.snapshot is not None
    assert {item.path for item in restored.snapshot.files} == {"README.md", "app.py"}
    assert restored_app.state.run_store.get_job(job.job_id) is restored
    assert restored_app.state.run_store.get_symbols(job.run_id)
    assert restored_app.state.run_store.get_orientation_items(job.run_id)
    assert restored_app.state.run_store.get_anchors(job.run_id)
    assert restored_app.state.run_store.get_region(anchor_region_id)
    assert [stage.status for stage in restored_app.state.run_store.get_stages(job.run_id)] == [
        "completed",
        "completed",
        "completed",
        "completed",
        "completed",
        "completed",
    ]
    assert restored_app.state.run_store.active_run_id == job.run_id

    with sqlite3.connect(database) as connection:
        assert connection.execute("PRAGMA user_version").fetchone() is not None
        assert connection.execute("SELECT COUNT(*) FROM analysis_jobs").fetchone()[0] == 1


def test_only_running_duplicate_repository_is_reused(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    nested = repository / "nested"
    nested.mkdir(parents=True)
    write(repository / "app.py", "def main():\n    return 1\n")
    settings = Settings(environment="integration", database_path=str(tmp_path / "backend.sqlite"))
    app = create_app(settings)
    controller = AnalysisController(settings=settings, store=app.state.run_store)

    first, first_created = controller.start_or_reuse(str(repository))
    duplicate, duplicate_created = controller.start_or_reuse(
        f'"{nested / ".."}"'
    )

    assert first_created is True
    assert duplicate_created is False
    assert duplicate is first

    controller.run(first)
    next_run, next_created = controller.start_or_reuse(str(repository))

    assert first.status == "completed"
    assert next_created is True
    assert next_run.run_id != first.run_id


def test_interrupted_run_is_restored_as_failed(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    write(repository / "app.py", "def main():\n    return 1\n")
    settings = Settings(environment="integration", database_path=str(tmp_path / "backend.sqlite"))
    first_app = create_app(settings)
    controller = AnalysisController(settings=settings, store=first_app.state.run_store)
    job = controller.start(str(repository))

    restored_app = create_app(settings)
    restored = restored_app.state.run_store.get_job(job.job_id)

    assert restored is not None
    assert restored.status == "failed"
    assert restored.stage == "failed"
    assert "interrupted" in restored.error.lower()


def test_failed_analysis_remains_distinguishable_after_restart(tmp_path: Path) -> None:
    settings = Settings(environment="integration", database_path=str(tmp_path / "backend.sqlite"))
    first_app = create_app(settings)
    controller = AnalysisController(settings=settings, store=first_app.state.run_store)
    job = controller.start(str(tmp_path / "missing-repository"))

    controller.run(job)
    restored_app = create_app(settings)
    restored = restored_app.state.run_store.get_run(job.run_id)

    assert restored is not None
    assert restored.status == "failed"
    assert restored.snapshot is None
    assert restored.error
    assert restored_app.state.run_store.active_run_id is None


def test_memory_configuration_keeps_isolated_in_memory_store() -> None:
    app = create_app(Settings(environment="test", database_path=":memory:"))

    assert type(app.state.run_store) is InMemoryRunStore


def test_sqlite_store_releases_database_file_handles(tmp_path: Path) -> None:
    database = tmp_path / "state" / "backend.sqlite"
    store = SQLiteRunStore(str(database))
    repository = tmp_path / "repository"
    write(repository / "app.py", "def main():\n    return 1\n")
    controller = AnalysisController(
        settings=Settings(environment="integration", database_path=str(database)),
        store=store,
    )
    job = controller.start(str(repository))
    controller.run(job)

    moved_database = tmp_path / "state" / "backend-moved.sqlite"
    database.replace(moved_database)

    assert moved_database.is_file()



# ---------------------------------------------------------------------------
# ObservedProgramRelation persistence (put_relations / get_relations)
# ---------------------------------------------------------------------------
#
# These tests exercise the run_store layer directly (InMemoryRunStore and
# SQLiteRunStore), bypassing AnalysisController entirely, since relation
# persistence is a store-layer concern independent of how/when relations get
# produced during a real analysis run.


def _relation(**overrides) -> ObservedProgramRelation:
    kwargs = dict(
        run_id="run-a",
        relation_kind="calls",
        source_entity_id="pkg.mod.Foo.bar",
        extractor_name="python_call_extractor",
        extractor_version="0.1.0",
        resolution_status="resolved",
        target_entity_id="pkg.mod.Baz.qux",
        span_path="pkg/mod.py",
        span_start_line=10,
        span_end_line=10,
    )
    kwargs.update(overrides)
    return ObservedProgramRelation.create(**kwargs)


def _all_field_relations(run_id: str) -> tuple[ObservedProgramRelation, ...]:
    """One relation per resolution_status, exercising every field including
    the nullable ones and the all-or-nothing span group."""
    resolved = _relation(
        run_id=run_id,
        relation_kind="calls",
        source_entity_id="pkg.mod.Foo.bar",
        target_entity_id="pkg.mod.Baz.qux",
        target_reference="Baz.qux(...)",
        span_path="pkg/mod.py",
        span_start_line=10,
        span_end_line=12,
        confidence=None,
    )
    partial = _relation(
        run_id=run_id,
        relation_kind="inherits",
        source_entity_id="pkg.mod.Sub",
        resolution_status="partial",
        target_entity_id="pkg.mod.Base",
        target_reference="Base",
        span_path=None,
        span_start_line=None,
        span_end_line=None,
        confidence=0.6,
    )
    unresolved = _relation(
        run_id=run_id,
        relation_kind="imports",
        source_entity_id="pkg.mod.Foo",
        resolution_status="unresolved",
        target_entity_id=None,
        target_reference="dynamic_module",
        span_path="pkg/mod.py",
        span_start_line=1,
        span_end_line=1,
        confidence=0.0,
    )
    return (resolved, partial, unresolved)


def test_in_memory_store_relations_round_trip_all_fields() -> None:
    store = InMemoryRunStore()
    relations = _all_field_relations("run-a")

    store.put_relations("run-a", relations)

    assert store.get_relations("run-a") == relations


def test_in_memory_store_relations_run_isolation() -> None:
    store = InMemoryRunStore()
    relations_a = _all_field_relations("run-a")
    relations_b = _all_field_relations("run-b")

    store.put_relations("run-a", relations_a)
    store.put_relations("run-b", relations_b)

    assert store.get_relations("run-a") == relations_a
    assert store.get_relations("run-b") == relations_b
    assert store.get_relations("run-nonexistent") == ()


def test_sqlite_store_relations_round_trip_all_fields(tmp_path: Path) -> None:
    """Every scalar field -- including the nullable ones (target_entity_id,
    target_reference, confidence) and the all-or-nothing span group -- must
    survive a write followed by a fresh reload from disk."""
    database = tmp_path / "backend.sqlite"
    relations = _all_field_relations("run-a")

    store = SQLiteRunStore(str(database))
    store.put_relations("run-a", relations)

    assert store.get_relations("run-a") == relations

    reloaded = SQLiteRunStore(str(database))
    assert reloaded.get_relations("run-a") == relations


def test_sqlite_store_unresolved_relation_target_entity_id_none_round_trips(
    tmp_path: Path,
) -> None:
    """Dedicated NULL-handling test: an unresolved relation's target_entity_id
    must come back as None, not the empty string or some other NULL-ish
    stand-in, after a real SQLite write + reload round trip."""
    database = tmp_path / "backend.sqlite"
    unresolved = _relation(
        run_id="run-a",
        relation_kind="calls",
        source_entity_id="pkg.mod.Foo.bar",
        resolution_status="unresolved",
        target_entity_id=None,
        target_reference="requests.get",
        span_path=None,
        span_start_line=None,
        span_end_line=None,
        confidence=0.2,
    )

    store = SQLiteRunStore(str(database))
    store.put_relations("run-a", (unresolved,))

    fetched = store.get_relations("run-a")
    assert len(fetched) == 1
    assert fetched[0].target_entity_id is None
    assert fetched[0].target_reference == "requests.get"
    assert fetched[0].span_path is None
    assert fetched[0].span_start_line is None
    assert fetched[0].span_end_line is None

    reloaded = SQLiteRunStore(str(database))
    refetched = reloaded.get_relations("run-a")
    assert len(refetched) == 1
    assert refetched[0].target_entity_id is None
    assert refetched[0] == unresolved


def test_sqlite_store_relations_no_leakage_across_repositories(tmp_path: Path) -> None:
    """Requirement 5: two different run_ids for two different
    repository_paths must never leak relations into each other, mirroring
    the run-isolation convention used for symbol identity
    (see test_stable_entity_identity.py)."""
    database = tmp_path / "backend.sqlite"
    repo_a = tmp_path / "repo-a"
    repo_b = tmp_path / "repo-b"
    repo_a.mkdir()
    repo_b.mkdir()

    store = SQLiteRunStore(str(database))
    job_a = AnalysisJob(job_id="job-a", run_id="run-a", repository_path=str(repo_a))
    job_b = AnalysisJob(job_id="job-b", run_id="run-b", repository_path=str(repo_b))
    store.put_job(job_a)
    store.put_job(job_b)

    relations_a = _all_field_relations("run-a")
    relations_b = _all_field_relations("run-b")
    store.put_relations("run-a", relations_a)
    store.put_relations("run-b", relations_b)

    assert store.get_relations("run-a") == relations_a
    assert store.get_relations("run-b") == relations_b
    assert set(r.id for r in store.get_relations("run-a")).isdisjoint(
        set(r.id for r in store.get_relations("run-b"))
    )

    reloaded = SQLiteRunStore(str(database))
    assert reloaded.get_relations("run-a") == relations_a
    assert reloaded.get_relations("run-b") == relations_b
    assert reloaded.get_run("run-a").repository_path == str(repo_a)
    assert reloaded.get_run("run-b").repository_path == str(repo_b)


def test_sqlite_store_backward_compatible_with_db_missing_relations_table(
    tmp_path: Path,
) -> None:
    """Requirement 4: a database file written by a version of the store that
    predates ObservedProgramRelation persistence (no program_relations table
    at all) must still load cleanly, and get_relations on any run_id against
    that store must return an empty tuple rather than raising.

    This state is realistically reachable: any database file that already
    exists on disk from before this change was made was written by code that
    never created program_relations. SQLiteRunStore's schema initialization
    uses CREATE TABLE IF NOT EXISTS, so opening such a file adds the new
    table (and leaves pre-existing data untouched) instead of failing.
    """
    database = tmp_path / "old-backend.sqlite"

    # Recreate the pre-relations schema by hand and seed it with a completed
    # job, simulating a database file left behind by an older build.
    with sqlite3.connect(database) as connection:
        connection.executescript(
            """
            PRAGMA journal_mode = WAL;

            CREATE TABLE store_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE analysis_jobs (
                job_id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL UNIQUE,
                normalized_repository_path TEXT NOT NULL,
                status TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE repo_snapshots (
                run_id TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE run_collections (
                run_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                PRIMARY KEY(run_id, kind)
            );

            CREATE TABLE source_regions (
                region_id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE analysis_stages (
                run_id TEXT NOT NULL,
                stage_name TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                PRIMARY KEY(run_id, stage_name)
            );
            """
        )
        connection.execute(
            "INSERT INTO store_metadata(key, value) VALUES ('schema_version', '1')"
        )
        connection.execute(
            """
            INSERT INTO analysis_jobs(
                job_id, run_id, normalized_repository_path, status, payload_json
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                "old-job",
                "old-run",
                "c:/old/repo",
                "completed",
                (
                    '{"job_id": "old-job", "run_id": "old-run", '
                    '"repository_path": "c:/old/repo", "status": "completed", '
                    '"stage": "complete", "error": "", '
                    '"created_at": "2020-01-01T00:00:00+00:00", '
                    '"started_at": "2020-01-01T00:00:00+00:00", '
                    '"completed_at": "2020-01-01T00:00:01+00:00"}'
                ),
            ),
        )
        connection.execute(
            "INSERT INTO store_metadata(key, value) VALUES ('active_run_id', 'old-run')"
        )

    store = SQLiteRunStore(str(database))

    assert store.get_relations("old-run") == ()
    assert store.get_relations("any-other-run") == ()

    old_job = store.get_job("old-job")
    assert old_job is not None
    assert old_job.status == "completed"

    with sqlite3.connect(database) as connection:
        table_names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
    assert "program_relations" in table_names


# ---------------------------------------------------------------------------
# Resolution provenance (resolution_basis / supporting_resolution_spans)
# ---------------------------------------------------------------------------


def _binding_resolved_relation(run_id: str) -> ObservedProgramRelation:
    return _relation(
        run_id=run_id,
        relation_kind="calls",
        source_entity_id="pkg.mod.Controller.handle",
        target_entity_id="pkg.mod.Service.process",
        span_path="pkg/mod.py",
        span_start_line=22,
        span_end_line=22,
        resolution_basis="constructor_binding",
        supporting_resolution_spans=(
            ResolutionEvidenceSpan(
                path="pkg/mod.py", start_line=17, end_line=17, description="constructor parameter annotation"
            ),
            ResolutionEvidenceSpan(
                path="pkg/mod.py", start_line=18, end_line=18, description="attribute assignment"
            ),
        ),
    )


def test_in_memory_store_relation_resolution_provenance_round_trips() -> None:
    store = InMemoryRunStore()
    relation = _binding_resolved_relation("run-a")

    store.put_relations("run-a", (relation,))

    (fetched,) = store.get_relations("run-a")
    assert fetched.resolution_basis == "constructor_binding"
    assert fetched.supporting_resolution_spans == relation.supporting_resolution_spans


def test_sqlite_store_relation_resolution_provenance_round_trips(tmp_path: Path) -> None:
    """resolution_basis + the ordered supporting_resolution_spans tuple
    (including each span's description) must survive a real SQLite write
    and a fresh reload from disk, not just an in-process round trip."""
    database = tmp_path / "backend.sqlite"
    relation = _binding_resolved_relation("run-a")

    store = SQLiteRunStore(str(database))
    store.put_relations("run-a", (relation,))

    (fetched,) = store.get_relations("run-a")
    assert fetched == relation

    reloaded = SQLiteRunStore(str(database))
    (refetched,) = reloaded.get_relations("run-a")
    assert refetched == relation
    assert refetched.resolution_basis == "constructor_binding"
    assert [s.description for s in refetched.supporting_resolution_spans] == [
        "constructor parameter annotation",
        "attribute assignment",
    ]


def test_sqlite_store_relation_without_resolution_basis_still_round_trips(tmp_path: Path) -> None:
    """The common case (no resolution_basis) must remain NULL/empty, not a
    stray empty-JSON-array or empty string, after a real round trip --
    this is the backward-compatibility guarantee for every relation
    produced before these fields existed."""
    database = tmp_path / "backend.sqlite"
    relation = _relation(run_id="run-a")  # no resolution_basis/supporting_resolution_spans

    store = SQLiteRunStore(str(database))
    store.put_relations("run-a", (relation,))

    (fetched,) = store.get_relations("run-a")
    assert fetched.resolution_basis is None
    assert fetched.supporting_resolution_spans == ()

    with sqlite3.connect(database) as connection:
        row = connection.execute(
            "SELECT resolution_basis, supporting_resolution_spans_json FROM program_relations"
        ).fetchone()
    assert row == (None, None)


def test_sqlite_store_backward_compatible_with_relations_table_missing_new_columns(
    tmp_path: Path,
) -> None:
    """A database file written by a version of the store that has
    `program_relations` but predates the resolution_basis/
    supporting_resolution_spans_json columns must still open cleanly --
    `CREATE TABLE IF NOT EXISTS` is a no-op against an already-existing
    table, so opening such a file must go through the explicit
    `ALTER TABLE ... ADD COLUMN` migration path instead of failing."""
    database = tmp_path / "pre-resolution-provenance.sqlite"

    with sqlite3.connect(database) as connection:
        connection.executescript(
            """
            PRAGMA journal_mode = WAL;

            CREATE TABLE store_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE analysis_jobs (
                job_id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL UNIQUE,
                normalized_repository_path TEXT NOT NULL,
                status TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE repo_snapshots (
                run_id TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE run_collections (
                run_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                PRIMARY KEY(run_id, kind)
            );

            CREATE TABLE source_regions (
                region_id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE analysis_stages (
                run_id TEXT NOT NULL,
                stage_name TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                PRIMARY KEY(run_id, stage_name)
            );

            CREATE TABLE program_relations (
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
                confidence REAL
            );
            """
        )
        connection.execute(
            "INSERT INTO store_metadata(key, value) VALUES ('schema_version', '1')"
        )
        connection.execute(
            """
            INSERT INTO program_relations (
                id, run_id, relation_kind, source_entity_id, target_entity_id,
                target_reference, span_path, span_start_line, span_end_line,
                extractor_name, extractor_version, resolution_status, confidence
            ) VALUES ('relation:old', 'old-run', 'calls', 'pkg.A.f', 'pkg.B.g',
                      NULL, 'pkg/mod.py', 5, 5, 'python_call_extractor', '0.1.0',
                      'resolved', NULL)
            """
        )

    store = SQLiteRunStore(str(database))

    (old_relation,) = store.get_relations("old-run")
    assert old_relation.id == "relation:old"
    assert old_relation.resolution_basis is None
    assert old_relation.supporting_resolution_spans == ()

    # And the store is fully writable/queryable going forward, including
    # for relations that DO use the new fields.
    new_relation = _binding_resolved_relation("old-run")
    store.put_relations("old-run", (old_relation, new_relation))
    fetched = {r.id: r for r in store.get_relations("old-run")}
    assert fetched["relation:old"].resolution_basis is None
    assert fetched[new_relation.id].resolution_basis == "constructor_binding"

    with sqlite3.connect(database) as connection:
        columns = {row[1] for row in connection.execute("PRAGMA table_info(program_relations)")}
    assert {"resolution_basis", "supporting_resolution_spans_json"} <= columns


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
