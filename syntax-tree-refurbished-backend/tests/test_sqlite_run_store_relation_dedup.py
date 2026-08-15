"""Regression test for a pre-existing (pre-Phase-6) SQLite persistence bug
discovered while running the V2 vertical-slice's real-repository browser
acceptance flow: analyzing a real-world repository (Tenacity, Flask) failed
outright with ``UNIQUE constraint failed: program_relations.id`` while the
same analysis succeeded fine against ``InMemoryRunStore``.

Root cause (confirmed via direct extraction on Flask's real source, see the
V2 Phase-6 report): ``ObservedProgramRelation.id`` is a deterministic,
content-addressed identity keyed on
(run_id, relation_kind, source_entity_id, target_entity_id/reference,
span_path/span_start_line/span_end_line) -- see
``core.models.program_relation.compute_relation_id``'s own docstring:
"Same inputs always yield the same id". Real source can genuinely produce
two *distinct extractor observations* that hash to the same id -- e.g. two
separate ``isinstance(...)`` calls on the same source line, where span
identity is line-granular (not column-granular). Per the id scheme's own
documented contract, two relations sharing an id are the same fact, so
persisting the second occurrence should be a no-op, not a hard failure.

``SQLiteRunStore._persist_relations`` used a plain ``INSERT`` against
``program_relations``, whose ``id`` column is declared ``PRIMARY KEY``, so
the second (duplicate) row triggered ``sqlite3.IntegrityError``. This test
reproduces that directly with two relations sharing computed ids and
asserts the store now accepts the batch and materializes one row per unique
id.
"""

from __future__ import annotations

from pathlib import Path

from syntax_tree_refurbished.app.analysis.sqlite_run_store import SQLiteRunStore
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation


def test_put_relations_deduplicates_relations_sharing_a_computed_id(tmp_path: Path) -> None:
    store = SQLiteRunStore(str(tmp_path / "backend.sqlite"))
    run_id = "run:dedup-test"

    # Two independent extractor observations of "this function calls the
    # builtin isinstance" on the exact same source line -- e.g.
    # `if isinstance(x, A) and isinstance(x, B):` -- which legitimately
    # compute the SAME relation id under the documented identity scheme.
    first = ObservedProgramRelation.create(
        run_id=run_id,
        relation_kind="calls",
        source_entity_id="symbol:caller",
        target_reference="isinstance",
        span_path="app.py",
        span_start_line=10,
        span_end_line=10,
        extractor_name="python_call_extractor",
        extractor_version="0.3.0",
        resolution_status="unresolved",
        confidence=0.5,
    )
    second = ObservedProgramRelation.create(
        run_id=run_id,
        relation_kind="calls",
        source_entity_id="symbol:caller",
        target_reference="isinstance",
        span_path="app.py",
        span_start_line=10,
        span_end_line=10,
        extractor_name="python_call_extractor",
        extractor_version="0.3.0",
        resolution_status="unresolved",
        confidence=0.5,
    )
    assert first.id == second.id

    # The regression: this used to raise sqlite3.IntegrityError
    # ("UNIQUE constraint failed: program_relations.id") because
    # `_persist_relations` used a plain INSERT against the `id TEXT PRIMARY
    # KEY` column.
    store.put_relations(run_id, (first, second))

    # In-memory layer intentionally stores exactly what it was given (no
    # dedup contract there -- InMemoryRunStore.put_relations is a plain
    # passthrough); the dedup guarantee this test targets is specifically
    # the SQLite persistence layer's PRIMARY KEY-backed identity, so verify
    # it via a reopened store reading only from disk.
    reopened = SQLiteRunStore(str(tmp_path / "backend.sqlite"))
    reopened_relations = reopened.get_relations(run_id)
    assert len(reopened_relations) == 1
    assert reopened_relations[0].id == first.id
