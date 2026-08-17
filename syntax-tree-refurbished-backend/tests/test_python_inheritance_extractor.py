"""Tests for the Python AST inheritance-relation extractor
(app.analysis.python_inheritance_extractor).

These tests exercise the *real* parsing pipeline end to end, following the
same proven pattern as ``tests/test_stable_entity_identity.py``: fixture
source is written to real files under ``tmp_path``, a real ``RepoSnapshot``
is built via ``LocalRepoReader``, and that is attached to a real
``AnalysisJob``. This is required because the extractor resolves entity ids
by looking up real ``ParsedSymbol`` records rather than minting its own
placeholder ids.

Round 3 change: the extractor itself no longer calls
``parse_python_symbols``. It now accepts an externally-supplied
``symbols: Iterable[ParsedSymbol]`` collection alongside ``job`` --
mirroring ``app.indexing.discover_semantic_anchors.discover_semantic_anchors``
-- so tests build ``symbols`` once (the single authoritative parse for each
scenario, via ``parse_python_symbols``, standing in for the real pipeline's
own parsing stage) and pass ``(job, symbols)`` into the extractor.

Covers: single inheritance, multiple inheritance (all resolvable), mixed
resolution (one local + one external base on the same class), a lone
unresolved external base, cross-file resolution via both `from ... import`
and module-attribute import, the extractor/parser scope-mismatch fallback
(a base that *looks* resolvable to this extractor's own bookkeeping but has
no matching real ParsedSymbol), determinism of emitted relation ids across
repeated extraction on identical input, and (new) proof that entity
identities come only from the injected ``symbols`` collection rather than a
hidden re-parse.
"""

from __future__ import annotations

from pathlib import Path
import uuid

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.python_inheritance_extractor import (
    EXTRACTOR_NAME,
    EXTRACTOR_VERSION,
    extract_inheritance_relations,
)
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.app.parsing.python_symbol_parser import parse_python_symbols
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
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


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _symbols_for(job: AnalysisJob) -> list[ParsedSymbol]:
    """The single, authoritative parse for a test scenario: run
    ``parse_python_symbols`` exactly once per readable Python file in
    ``job.snapshot`` to build the ``symbols`` collection handed to the
    extractor -- standing in for the real pipeline's own one-time parsing
    stage (``app.parsing.parse_supported_files.parse_supported_files``)."""
    assert job.snapshot is not None
    reader = SourceReader(job)
    symbols: list[ParsedSymbol] = []
    for file in job.snapshot.files:
        if file.readable and file.language == "python":
            symbols.extend(parse_python_symbols(reader, file, job.run_id))
    return symbols


def _class_symbol(job: AnalysisJob, rel_path: str, class_name: str) -> ParsedSymbol:
    """Independently re-derive the real ParsedSymbol for a top-level class,
    for use as the expected value in assertions (mirrors exactly what the
    extractor itself looks up internally)."""
    reader = SourceReader(job)
    file = reader.get_file(rel_path)
    symbols = parse_python_symbols(reader, file, job.run_id)
    matches = [s for s in symbols if s.kind == "class" and s.name == class_name]
    assert len(matches) == 1, f"expected exactly one {class_name} symbol, got {matches}"
    return matches[0]


def _only(relations, source_entity_id=None):
    if source_entity_id is not None:
        relations = [r for r in relations if r.source_entity_id == source_entity_id]
    assert len(relations) == 1, relations
    return relations[0]


# ---------------------------------------------------------------------------
# Single inheritance, base resolvable within the same file
# ---------------------------------------------------------------------------


def test_single_inheritance_same_file_resolved(tmp_path: Path) -> None:
    source = """
class Base:
    pass


class Child(Base):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))

    assert len(relations) == 1
    relation = relations[0]
    base_symbol = _class_symbol(job, "pkg/mod.py", "Base")
    child_symbol = _class_symbol(job, "pkg/mod.py", "Child")

    assert relation.relation_kind == "inherits"
    assert relation.source_entity_id == child_symbol.id
    assert relation.target_entity_id == base_symbol.id
    assert relation.target_reference is None
    assert relation.resolution_status == "resolved"
    assert relation.confidence is None
    assert relation.span_path == "pkg/mod.py"
    assert relation.span_start_line == relation.span_end_line == 6
    assert relation.extractor_name == EXTRACTOR_NAME
    assert relation.extractor_version == EXTRACTOR_VERSION

    # Cross-run logical identity is inherited "for free" through real
    # ParsedSymbol.stable_entity_key -- not carried on the relation itself.
    assert base_symbol.stable_entity_key != ""
    assert child_symbol.stable_entity_key != ""


# ---------------------------------------------------------------------------
# Multiple inheritance, all bases resolvable
# ---------------------------------------------------------------------------


def test_multiple_inheritance_all_resolved(tmp_path: Path) -> None:
    source = """
class Mixin1:
    pass


class Mixin2:
    pass


class Combined(Mixin1, Mixin2):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))

    combined_symbol = _class_symbol(job, "pkg/mod.py", "Combined")
    mixin1_symbol = _class_symbol(job, "pkg/mod.py", "Mixin1")
    mixin2_symbol = _class_symbol(job, "pkg/mod.py", "Mixin2")

    combined_relations = [r for r in relations if r.source_entity_id == combined_symbol.id]
    assert len(combined_relations) == 2
    targets = {r.target_entity_id: r.resolution_status for r in combined_relations}
    assert targets == {
        mixin1_symbol.id: "resolved",
        mixin2_symbol.id: "resolved",
    }
    for r in combined_relations:
        assert r.confidence is None
        assert r.target_reference is None


# ---------------------------------------------------------------------------
# Multiple inheritance, mixed resolution: one local base, one external base
# ---------------------------------------------------------------------------


def test_multiple_inheritance_mixed_resolution(tmp_path: Path) -> None:
    source = """
import external_pkg


class LocalBase:
    pass


class Combined(LocalBase, external_pkg.ExternalBase):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))

    combined_symbol = _class_symbol(job, "pkg/mod.py", "Combined")
    local_base_symbol = _class_symbol(job, "pkg/mod.py", "LocalBase")

    combined_relations = [r for r in relations if r.source_entity_id == combined_symbol.id]
    assert len(combined_relations) == 2

    local_relation = next(r for r in combined_relations if r.resolution_status == "resolved")
    external_relation = next(r for r in combined_relations if r.resolution_status == "unresolved")

    assert local_relation.target_entity_id == local_base_symbol.id
    assert local_relation.target_reference is None
    assert local_relation.confidence is None

    # Placeholder is carried in target_reference, never fabricated as an id.
    assert external_relation.target_entity_id is None
    assert external_relation.target_reference == "external_pkg.ExternalBase"


# ---------------------------------------------------------------------------
# A lone unresolved external base
# ---------------------------------------------------------------------------


def test_lone_unresolved_external_base(tmp_path: Path) -> None:
    source = """
class Foo(SomeThirdPartyBase):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))
    foo_symbol = _class_symbol(job, "pkg/mod.py", "Foo")

    relation = _only(relations)
    assert relation.source_entity_id == foo_symbol.id
    assert relation.resolution_status == "unresolved"
    # No fabricated internal id at all: target_entity_id must be absent,
    # and the placeholder is exactly the literal name as written.
    assert relation.target_entity_id is None
    assert relation.target_reference == "SomeThirdPartyBase"


# ---------------------------------------------------------------------------
# Cross-file resolution via import
# ---------------------------------------------------------------------------


def test_cross_file_resolution_via_from_import(tmp_path: Path) -> None:
    base_source = """
class RemoteBase:
    pass
"""
    child_source = """
from pkg.base_module import RemoteBase


class Child(RemoteBase):
    pass
"""
    write(tmp_path / "pkg" / "base_module.py", base_source)
    write(tmp_path / "pkg" / "child_module.py", child_source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))

    child_symbol = _class_symbol(job, "pkg/child_module.py", "Child")
    remote_base_symbol = _class_symbol(job, "pkg/base_module.py", "RemoteBase")

    child_relations = [r for r in relations if r.source_entity_id == child_symbol.id]
    relation = _only(child_relations)
    assert relation.resolution_status == "resolved"
    assert relation.target_entity_id == remote_base_symbol.id


def test_cross_file_resolution_via_module_attribute(tmp_path: Path) -> None:
    base_source = """
class RemoteBase:
    pass
"""
    child_source = """
import pkg.base_module


class Child(pkg.base_module.RemoteBase):
    pass
"""
    write(tmp_path / "pkg" / "base_module.py", base_source)
    write(tmp_path / "pkg" / "child_module.py", child_source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))

    child_symbol = _class_symbol(job, "pkg/child_module.py", "Child")
    remote_base_symbol = _class_symbol(job, "pkg/base_module.py", "RemoteBase")

    child_relations = [r for r in relations if r.source_entity_id == child_symbol.id]
    relation = _only(child_relations)
    assert relation.resolution_status == "resolved"
    assert relation.target_entity_id == remote_base_symbol.id


# ---------------------------------------------------------------------------
# Extractor/parser scope mismatch: never fabricate when the real parser
# disagrees with this extractor's own (more permissive) bookkeeping.
# ---------------------------------------------------------------------------


def test_base_defined_in_try_block_falls_back_to_unresolved(tmp_path: Path) -> None:
    """`parse_python_symbols` does not descend into module-level try/except
    blocks, so a class defined only there has no real ParsedSymbol. This
    extractor's own class registry *does* still notice such a class (a
    deliberate best-effort carryover from the previous version), which
    means the two disagree -- exercising the "never fabricate, fall back to
    unresolved" rule from the module docstring."""
    source = """
try:
    class Base:
        pass
except ImportError:
    class Base:
        pass


class Child(Base):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))
    child_symbol = _class_symbol(job, "pkg/mod.py", "Child")

    relation = _only(relations)
    assert relation.source_entity_id == child_symbol.id
    assert relation.resolution_status == "unresolved"
    assert relation.target_entity_id is None
    assert relation.target_reference == "Base"


def test_class_defined_in_try_block_as_source_is_skipped(tmp_path: Path) -> None:
    """A class that itself has no real ParsedSymbol (because it's declared
    inside a module-level try/except) cannot be a relation's
    source_entity_id -- there is nothing valid to attach the relation to,
    so it is skipped entirely rather than fabricated."""
    source = """
class Base:
    pass


try:
    class Child(Base):
        pass
except ImportError:
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))
    assert relations == ()


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------


def test_extraction_is_deterministic_across_repeated_runs(tmp_path: Path) -> None:
    source = """
import external_pkg


class Mixin1:
    pass


class Mixin2:
    pass


class Combined(Mixin1, Mixin2, external_pkg.ExternalBase):
    pass


class Foo(SomeThirdPartyBase):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    run_id = _new_run_id()

    job_a = _job_for(tmp_path, run_id)
    job_b = _job_for(tmp_path, run_id)

    first = extract_inheritance_relations(job_a, _symbols_for(job_a))
    second = extract_inheritance_relations(job_b, _symbols_for(job_b))

    assert [r.id for r in first] == [r.id for r in second]
    assert len(first) == len(second) == 4
    assert len({r.id for r in first}) == 4  # every relation id is distinct


# ---------------------------------------------------------------------------
# Round 3: injected-``symbols`` compatibility -- one authoritative parse,
# real entity identities reused (never re-derived) by the extractor.
# ---------------------------------------------------------------------------


def test_emitted_entity_ids_come_only_from_the_injected_symbols(tmp_path: Path) -> None:
    """Prove there is exactly one authoritative parse per test scenario:
    ``_symbols_for`` calls ``parse_python_symbols`` exactly once (per file)
    to build ``symbols``, that exact collection is handed to the extractor
    alongside ``job``, and every ``source_entity_id``/``target_entity_id``
    the extractor emits must be a member of ``{s.id for s in symbols}`` --
    i.e. the extractor used the supplied symbol identities verbatim rather
    than deriving its own via a hidden re-parse."""
    source = """
class Mixin1:
    pass


class Mixin2:
    pass


class Combined(Mixin1, Mixin2):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)
    symbol_ids = {s.id for s in symbols}
    assert symbol_ids, "fixture must produce at least one real symbol"

    relations = extract_inheritance_relations(job, symbols)
    assert len(relations) > 0

    for rel in relations:
        assert rel.source_entity_id in symbol_ids
        if rel.target_entity_id is not None:
            assert rel.target_entity_id in symbol_ids


def test_pruned_symbol_set_forces_unresolved_proving_no_hidden_reparse(tmp_path: Path) -> None:
    """Deliberately omit a real symbol (``Base``) from the injected
    ``symbols`` collection before handing it to the extractor. If the
    extractor were secretly still calling ``parse_python_symbols`` itself
    to backfill what it was given, the omitted symbol's real id would still
    show up as ``target_entity_id`` for ``Child``'s base. Since it does not
    -- the relation is downgraded to "unresolved" instead -- this
    structurally proves the extractor has no path back to a fresh parse and
    can only ever use the exact ``symbols`` collection it was handed."""
    source = """
class Base:
    pass


class Child(Base):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    full_symbols = _symbols_for(job)
    base_symbol = next(s for s in full_symbols if s.kind == "class" and s.name == "Base")
    child_symbol = next(s for s in full_symbols if s.kind == "class" and s.name == "Child")

    # Sanity check with the full (un-pruned) set: the base resolves.
    baseline = extract_inheritance_relations(job, full_symbols)
    baseline_relation = _only(baseline)
    assert baseline_relation.target_entity_id == base_symbol.id
    assert baseline_relation.resolution_status == "resolved"

    # Now prune `Base` out of the supplied symbols and re-extract against
    # the SAME job/on-disk source.
    pruned_symbols = [s for s in full_symbols if s.id != base_symbol.id]
    assert len(pruned_symbols) == len(full_symbols) - 1

    relations = extract_inheritance_relations(job, pruned_symbols)

    # The omitted symbol's real id must never appear anywhere in the
    # output -- if it did, that would be proof of a hidden re-parse
    # backfilling it.
    for rel in relations:
        assert rel.source_entity_id != base_symbol.id
        assert rel.target_entity_id != base_symbol.id

    relation = _only(relations)
    assert relation.source_entity_id == child_symbol.id
    assert relation.resolution_status == "unresolved"
    assert relation.target_entity_id is None
    assert relation.target_reference == "Base"


def test_stable_entity_key_round_trips_through_injected_symbols(tmp_path: Path) -> None:
    """``stable_entity_key`` is an untouched ``ParsedSymbol`` field;
    confirm it still round-trips correctly through the injected-symbols
    path: an entity id emitted by the extractor still resolves back (via
    the exact ``symbols`` collection handed in) to a ``ParsedSymbol`` with
    a valid, non-empty ``stable_entity_key``, exactly as it would have
    before this change."""
    source = """
class Base:
    pass


class Child(Base):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)
    symbols_by_id = {s.id: s for s in symbols}

    relations = extract_inheritance_relations(job, symbols)
    resolved = [r for r in relations if r.resolution_status == "resolved"]
    assert len(resolved) == 1
    rel = resolved[0]

    source_symbol = symbols_by_id[rel.source_entity_id]
    target_symbol = symbols_by_id[rel.target_entity_id]
    assert source_symbol.stable_entity_key != ""
    assert target_symbol.stable_entity_key != ""
    assert source_symbol.stable_entity_key != target_symbol.stable_entity_key


# ---------------------------------------------------------------------------
# Generic-parameterized (ast.Subscript) bases -- intervention A
# ---------------------------------------------------------------------------


def test_generic_subscript_base_same_file_resolved(tmp_path: Path) -> None:
    """`class Child(Base[T])` resolves to the analyzed class `Base`: the
    subscript arguments are type parameters, not part of the inheritance
    target's identity."""
    source = """
from typing import TypeVar

T = TypeVar("T")


class Base:
    pass


class Child(Base[T]):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))

    child_symbol = _class_symbol(job, "pkg/mod.py", "Child")
    base_symbol = _class_symbol(job, "pkg/mod.py", "Base")
    relation = _only(relations, source_entity_id=child_symbol.id)
    assert relation.resolution_status == "resolved"
    assert relation.target_entity_id == base_symbol.id
    assert relation.target_reference is None


def test_generic_subscript_base_cross_file_from_import_resolved(tmp_path: Path) -> None:
    """The audited real-repository shape: a subclass in one module whose
    declared base is a `from .sibling import Name` import parameterized
    with a type variable (`class Child(RemoteBase[T])`)."""
    write(
        tmp_path / "pkg" / "base_module.py",
        """
from typing import Generic, TypeVar

T = TypeVar("T")


class RemoteBase(Generic[T]):
    pass
""",
    )
    write(
        tmp_path / "pkg" / "child_module.py",
        """
from typing import TypeVar

from pkg.base_module import RemoteBase

T = TypeVar("T")


class Child(RemoteBase[T]):
    pass
""",
    )
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))

    child_symbol = _class_symbol(job, "pkg/child_module.py", "Child")
    base_symbol = _class_symbol(job, "pkg/base_module.py", "RemoteBase")
    relation = _only(relations, source_entity_id=child_symbol.id)
    assert relation.resolution_status == "resolved"
    assert relation.target_entity_id == base_symbol.id

    # RemoteBase's own declared base (`Generic[T]`) resolves through the
    # same subscript handling to... nothing analyzed: `Generic` is external,
    # so its relation must stay unresolved with the full literal expression
    # (subscript included) as target_reference -- never a guess.
    base_own = _only(relations, source_entity_id=base_symbol.id)
    assert base_own.resolution_status == "unresolved"
    assert base_own.target_entity_id is None
    assert base_own.target_reference == "Generic[T]"


def test_generic_subscript_module_attribute_origin_resolved(tmp_path: Path) -> None:
    """`class Child(pkg.base_module.RemoteBase[T])` -- the subscript origin
    is a dotted-attribute chain off an `import pkg.base_module` binding."""
    write(
        tmp_path / "pkg" / "base_module.py",
        """
class RemoteBase:
    pass
""",
    )
    write(
        tmp_path / "pkg" / "child_module.py",
        """
from typing import TypeVar

import pkg.base_module

T = TypeVar("T")


class Child(pkg.base_module.RemoteBase[T]):
    pass
""",
    )
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))

    child_symbol = _class_symbol(job, "pkg/child_module.py", "Child")
    base_symbol = _class_symbol(job, "pkg/base_module.py", "RemoteBase")
    relation = _only(relations, source_entity_id=child_symbol.id)
    assert relation.resolution_status == "resolved"
    assert relation.target_entity_id == base_symbol.id


def test_subscript_with_unresolvable_origin_stays_unresolved(tmp_path: Path) -> None:
    """A subscript whose origin is not a plain name/attribute chain (here a
    call expression) must never resolve -- same rule as the non-subscript
    `class Foo(some_factory()):` case."""
    source = """
class Foo(make_base()[int]):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))

    relation = _only(relations)
    assert relation.resolution_status == "unresolved"
    assert relation.target_entity_id is None
    assert relation.target_reference == "make_base()[int]"


def test_subscript_chain_emits_only_direct_base_relations(tmp_path: Path) -> None:
    """Abstention analog of the frozen false inheritance claims: in a
    three-level generic chain A(B[T]), B(C[T]), no A->C relation may ever
    be emitted -- each class's relation points only at its own directly
    declared base, so a false 'A inherits C' direct-relation claim keeps
    abstaining after this change."""
    source = """
from typing import TypeVar

T = TypeVar("T")


class C:
    pass


class B(C[T]):
    pass


class A(B[T]):
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())

    relations = extract_inheritance_relations(job, _symbols_for(job))

    a = _class_symbol(job, "pkg/mod.py", "A")
    b = _class_symbol(job, "pkg/mod.py", "B")
    c = _class_symbol(job, "pkg/mod.py", "C")

    a_rel = _only(relations, source_entity_id=a.id)
    assert (a_rel.resolution_status, a_rel.target_entity_id) == ("resolved", b.id)
    b_rel = _only(relations, source_entity_id=b.id)
    assert (b_rel.resolution_status, b_rel.target_entity_id) == ("resolved", c.id)
    # No relation -- resolved or otherwise -- may connect A to C directly.
    assert not [
        r for r in relations if r.source_entity_id == a.id and r.target_entity_id == c.id
    ]
