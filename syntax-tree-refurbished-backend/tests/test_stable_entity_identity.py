"""Tests for cross-run-stable symbol identity (``ParsedSymbol.stable_entity_key``).

These tests exercise the real parsing pipeline (``LocalRepoReader`` +
``parse_python_symbols`` / ``parse_js_ts_symbols``) with two independently
constructed, randomly-generated ``run_id`` values -- simulating two separate
analysis runs of the same on-disk source -- and assert that:

1. ``stable_entity_key`` is identical across the two simulated runs while
   ``id``/``run_id`` (run-scoped identity) differ.
2. Run-scoped ids remain distinct across runs (run isolation is preserved).
3. Same-named symbols defined in different files do not collide on
   ``stable_entity_key``.
4. Facts that should change the key (qualified name / file) do change it,
   and facts that should not (a different random run_id, or unrelated code
   elsewhere in the same file) do not.
"""

from __future__ import annotations

from pathlib import Path
import uuid

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.app.parsing.js_ts_symbol_parser import parse_js_ts_symbols
from syntax_tree_refurbished.app.parsing.python_symbol_parser import parse_python_symbols
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.parsed_symbol import compute_stable_entity_key
from syntax_tree_refurbished.infra.filesystem.local_repo_reader import LocalRepoReader


def _new_run_id() -> str:
    return f"run:{uuid.uuid4().hex}"


def _job_for(repo_path: Path, run_id: str) -> AnalysisJob:
    """Build a real AnalysisJob + RepoSnapshot for a temp repo, as a run would."""
    snapshot = LocalRepoReader(Settings(environment="test")).build_snapshot(
        run_id=run_id,
        repo_path=str(repo_path),
    )
    job = AnalysisJob(job_id=f"job:{uuid.uuid4().hex}", run_id=run_id, repository_path=str(repo_path))
    job.snapshot = snapshot
    return job


def _python_symbols(repo_path: Path, run_id: str, rel_path: str) -> tuple:
    job = _job_for(repo_path, run_id)
    reader = SourceReader(job)
    file = reader.get_file(rel_path)
    return parse_python_symbols(reader, file, run_id)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


SOURCE = (
    "class BillingService:\n"
    "    async def sync(self, account_id):\n"
    "        return account_id\n\n"
    "def run_job():\n"
    "    return BillingService()\n"
)


def test_same_source_two_runs_same_stable_key_different_run_scoped_id(tmp_path: Path) -> None:
    write(tmp_path / "service.py", SOURCE)

    run_id_a = _new_run_id()
    run_id_b = _new_run_id()
    assert run_id_a != run_id_b

    symbols_a = {s.name: s for s in _python_symbols(tmp_path, run_id_a, "service.py")}
    symbols_b = {s.name: s for s in _python_symbols(tmp_path, run_id_b, "service.py")}

    assert set(symbols_a) == {"BillingService", "sync", "run_job"}
    assert set(symbols_a) == set(symbols_b)

    for name in symbols_a:
        sym_a = symbols_a[name]
        sym_b = symbols_b[name]

        # Requirement 1: stable_entity_key matches across two separate runs
        # of identical source, but run-scoped identity differs.
        assert sym_a.stable_entity_key == sym_b.stable_entity_key
        assert sym_a.stable_entity_key != ""
        assert sym_a.id != sym_b.id
        assert sym_a.run_id != sym_b.run_id


def test_run_isolation_is_preserved(tmp_path: Path) -> None:
    """Requirement 2: run-scoped ids stay distinct across runs (no regression)."""
    write(tmp_path / "service.py", SOURCE)

    run_id_a = _new_run_id()
    run_id_b = _new_run_id()

    symbols_a = _python_symbols(tmp_path, run_id_a, "service.py")
    symbols_b = _python_symbols(tmp_path, run_id_b, "service.py")

    ids_a = {s.id for s in symbols_a}
    ids_b = {s.id for s in symbols_b}
    assert ids_a.isdisjoint(ids_b)

    for symbol in symbols_a:
        assert symbol.run_id == run_id_a
    for symbol in symbols_b:
        assert symbol.run_id == run_id_b


def test_same_named_symbols_in_different_files_do_not_collide(tmp_path: Path) -> None:
    """Requirement 3: path is part of the stable key, so same-name classes in
    different files must get different stable_entity_key values."""
    write(tmp_path / "a" / "mod.py", "class Foo:\n    pass\n")
    write(tmp_path / "b" / "mod.py", "class Foo:\n    pass\n")

    run_id = _new_run_id()
    symbols_a = _python_symbols(tmp_path, run_id, "a/mod.py")
    symbols_b = _python_symbols(tmp_path, run_id, "b/mod.py")

    assert len(symbols_a) == 1
    assert len(symbols_b) == 1
    foo_a, foo_b = symbols_a[0], symbols_b[0]

    assert foo_a.name == foo_b.name == "Foo"
    assert foo_a.path != foo_b.path
    assert foo_a.stable_entity_key != foo_b.stable_entity_key


def test_stable_key_changes_with_qualified_name_or_path_but_not_with_run_id() -> None:
    """Requirement 4: sanity-check what should and shouldn't move the key."""
    base = dict(path="pkg/service.py", qualified_name="python:pkg/service.py::Foo", kind="class", signature="class Foo")

    baseline = compute_stable_entity_key(**base)

    # Should NOT change: run_id is not even an input to compute_stable_entity_key,
    # so two different (random) run_ids can never affect the result.
    same_again = compute_stable_entity_key(**base)
    assert same_again == baseline

    # SHOULD change: different qualified name (e.g. renamed / different symbol).
    changed_name = compute_stable_entity_key(**{**base, "qualified_name": "python:pkg/service.py::Bar"})
    assert changed_name != baseline

    # SHOULD change: different file.
    changed_path = compute_stable_entity_key(**{**base, "path": "pkg/other.py"})
    assert changed_path != baseline

    # SHOULD change: different kind (e.g. class vs function with the same name).
    changed_kind = compute_stable_entity_key(**{**base, "kind": "function"})
    assert changed_kind != baseline


def test_stable_key_unaffected_by_unrelated_code_elsewhere_in_the_file(tmp_path: Path) -> None:
    """Requirement 4 (practical case): appending an unrelated function to the
    end of the file (which does not change BillingService's own defining
    facts) must not change BillingService's stable_entity_key, even though
    it does shift nothing here but would shift line numbers for symbols
    *after* it -- proving the key is not keyed off start/end line."""
    write(tmp_path / "service.py", SOURCE)
    run_id = _new_run_id()
    before = {s.name: s for s in _python_symbols(tmp_path, run_id, "service.py")}

    # Prepend unrelated code, which shifts every subsequent symbol's line
    # numbers but leaves BillingService's own qualified name/kind/signature
    # untouched.
    write(
        tmp_path / "service.py",
        "import os\n\n\ndef unrelated_helper():\n    return os.getcwd()\n\n\n" + SOURCE,
    )
    after = {s.name: s for s in _python_symbols(tmp_path, run_id, "service.py")}

    assert before["BillingService"].start_line != after["BillingService"].start_line
    assert before["BillingService"].stable_entity_key == after["BillingService"].stable_entity_key
    assert before["sync"].stable_entity_key == after["sync"].stable_entity_key
    assert before["run_job"].stable_entity_key == after["run_job"].stable_entity_key

    # And, as always, run-scoped ids DO move with the line numbers -- the
    # run-scoped id hash still includes start/end line by design.
    assert before["BillingService"].id != after["BillingService"].id


def test_js_ts_symbols_also_get_stable_entity_keys(tmp_path: Path) -> None:
    write(
        tmp_path / "client.ts",
        "export class ApiClient {\n"
        "  async login(email) {\n"
        "    return email\n"
        "  }\n"
        "}\n",
    )

    run_id_a = _new_run_id()
    run_id_b = _new_run_id()

    job_a = _job_for(tmp_path, run_id_a)
    reader_a = SourceReader(job_a)
    file_a = reader_a.get_file("client.ts")
    symbols_a = {s.name: s for s in parse_js_ts_symbols(reader_a, file_a, run_id_a)}

    job_b = _job_for(tmp_path, run_id_b)
    reader_b = SourceReader(job_b)
    file_b = reader_b.get_file("client.ts")
    symbols_b = {s.name: s for s in parse_js_ts_symbols(reader_b, file_b, run_id_b)}

    assert set(symbols_a) == {"ApiClient", "login"}
    for name in symbols_a:
        assert symbols_a[name].stable_entity_key == symbols_b[name].stable_entity_key
        assert symbols_a[name].stable_entity_key != ""
        assert symbols_a[name].id != symbols_b[name].id


def test_old_persisted_rows_without_stable_entity_key_still_construct(tmp_path: Path) -> None:
    """Compatibility check: a ParsedSymbol dict lacking stable_entity_key
    (as any row persisted before this change would be) must still
    round-trip via ParsedSymbol(**row), matching how SQLiteRunStore
    rehydrates rows today."""
    from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol

    legacy_row = {
        "id": "symbol:deadbeefdeadbeefdeadbeef",
        "run_id": "run:legacy",
        "path": "old/module.py",
        "language": "python",
        "name": "Legacy",
        "qualified_name": "python:old/module.py::Legacy",
        "kind": "class",
        "start_line": 1,
        "end_line": 5,
        "source_region_id": "region:deadbeefdeadbeefdeadbeef",
        "signature": "class Legacy",
        "exported": True,
        "async_": False,
        "parent_symbol_id": None,
        # no "stable_entity_key" key at all -- simulates a pre-migration row.
    }

    symbol = ParsedSymbol(**legacy_row)
    assert symbol.stable_entity_key == ""
