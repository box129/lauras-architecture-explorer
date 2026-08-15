"""Tests for the Python AST "calls" extractor
(app.analysis.python_call_extractor). Covers the "reliable cases" from the
Phase 4 extractor brief: same-module calls, self.method() calls, locally
resolvable class/method calls, deterministic imported-name calls, and an
explicit ambiguous case that must come out unresolved rather than guessed.

Round 3 change: the extractor no longer parses anything itself. It now
accepts an already-snapshotted ``AnalysisJob`` plus an externally-supplied
``symbols: Iterable[ParsedSymbol]`` collection -- the same ``ParsedSymbol``
set the real pipeline's own parsing stage (``parse_supported_files``)
already produces once per run -- mirroring the pattern already used by
``app.indexing.discover_semantic_anchors.discover_semantic_anchors``.
Fixtures build the real ``job`` and real ``symbols`` (via a single call to
``parse_python_symbols`` per fixture file, the exact same proven pattern
used in ``tests/test_stable_entity_identity.py``) and pass both into the
extractor; "resolved"/"partial" assertions compare against those same real
``ParsedSymbol`` records rather than a hand-written qualname literal.
"unresolved"/downgraded-"partial" assertions check ``target_entity_id is
None`` and ``target_reference`` equals the literal, as-written call
expression.
"""

from __future__ import annotations

from pathlib import Path
import uuid

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.python_call_extractor import (
    EXTRACTOR_NAME,
    EXTRACTOR_VERSION,
    extract_call_relations,
)
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.app.parsing.python_symbol_parser import parse_python_symbols
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.constructor_binding import ConstructorAttributeBinding
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.infra.filesystem.local_repo_reader import LocalRepoReader

RUN_ID = "run-1"


# ---------------------------------------------------------------------------
# Fixture / real-symbol-identity helpers
# ---------------------------------------------------------------------------


def _write(tmp_path: Path, files: dict[str, str]) -> None:
    for rel_path, content in files.items():
        full = tmp_path / rel_path
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content, encoding="utf-8")


def _job_for(repo_path: Path, run_id: str) -> AnalysisJob:
    """Build a real AnalysisJob + RepoSnapshot for a temp repo, as a run
    would -- the same proven pattern used in
    ``tests/test_stable_entity_identity.py``."""
    snapshot = LocalRepoReader(Settings(environment="test")).build_snapshot(
        run_id=run_id,
        repo_path=str(repo_path),
    )
    job = AnalysisJob(job_id=f"job:{uuid.uuid4().hex}", run_id=run_id, repository_path=str(repo_path))
    job.snapshot = snapshot
    return job


def _symbols_for(job: AnalysisJob, rel_paths: list[str]) -> list[ParsedSymbol]:
    """The single, authoritative parse for a test scenario: run
    ``parse_python_symbols`` exactly once per analyzed file to build the
    ``symbols`` collection handed to the extractor -- standing in for the
    real pipeline's own one-time parsing stage
    (``app.parsing.parse_supported_files.parse_supported_files``)."""
    reader = SourceReader(job)
    symbols: list[ParsedSymbol] = []
    for rel_path in rel_paths:
        file = reader.get_file(rel_path)
        symbols.extend(parse_python_symbols(reader, file, job.run_id))
    return symbols


def _extract(tmp_path: Path, files: dict[str, str], run_id: str = RUN_ID) -> list[ObservedProgramRelation]:
    _write(tmp_path, files)
    job = _job_for(tmp_path, run_id)
    symbols = _symbols_for(job, list(files.keys()))
    return list(extract_call_relations(job, symbols, file_paths=list(files.keys())))


def _extract_source(
    tmp_path: Path, source: str, *, path: str = "module.py", run_id: str = RUN_ID
) -> list[ObservedProgramRelation]:
    return _extract(tmp_path, {path: source}, run_id=run_id)


def _real_symbols(tmp_path: Path, run_id: str, rel_path: str) -> dict[str, ParsedSymbol]:
    """Independently re-run the real parser against the same on-disk
    fixture/run_id the extractor used, keyed by ``qualified_name``, so
    tests can assert against real entity ids without duplicating the
    extractor's own internal id-translation logic."""
    job = _job_for(tmp_path, run_id)
    reader = SourceReader(job)
    file = reader.get_file(rel_path)
    return {s.qualified_name: s for s in parse_python_symbols(reader, file, run_id)}


# ---------------------------------------------------------------------------
# Same-module function calls
# ---------------------------------------------------------------------------


def test_same_module_function_call_resolved(tmp_path: Path) -> None:
    source = """
def helper():
    return 1


def caller():
    return helper()
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    real = _real_symbols(tmp_path, RUN_ID, "pkg/mod.py")
    helper_id = real["python:pkg/mod.py::helper"].id
    caller_id = real["python:pkg/mod.py::caller"].id

    calls = [r for r in relations if r.target_entity_id == helper_id]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.relation_kind == "calls"
    assert rel.source_entity_id == caller_id
    assert rel.resolution_status == "resolved"
    assert rel.confidence is None
    assert rel.target_reference is None
    assert rel.span_path == "pkg/mod.py"
    assert rel.extractor_name == EXTRACTOR_NAME
    assert rel.extractor_version == EXTRACTOR_VERSION


def test_unknown_bare_name_call_is_unresolved_with_literal_reference(tmp_path: Path) -> None:
    source = """
def caller():
    return some_builtin_or_unknown(1, 2)
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    assert len(relations) == 1
    rel = relations[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "some_builtin_or_unknown"
    assert rel.confidence is None


# ---------------------------------------------------------------------------
# self.method() calls
# ---------------------------------------------------------------------------


def test_self_method_call_resolved_to_own_class_method(tmp_path: Path) -> None:
    source = """
class Widget:
    def render(self):
        return self.paint()

    def paint(self):
        return "ok"
"""
    relations = _extract_source(tmp_path, source, path="pkg/widgets.py")
    real = _real_symbols(tmp_path, RUN_ID, "pkg/widgets.py")
    render_id = real["python:pkg/widgets.py::Widget.render"].id
    paint_id = real["python:pkg/widgets.py::Widget.paint"].id

    assert len(relations) == 1
    rel = relations[0]
    assert rel.source_entity_id == render_id
    assert rel.target_entity_id == paint_id
    assert rel.resolution_status == "resolved"
    assert rel.confidence is None


def test_self_method_not_defined_locally_is_unresolved_not_guessed_via_inheritance(tmp_path: Path) -> None:
    source = """
class Base:
    def paint(self):
        return "base"


class Widget(Base):
    def render(self):
        return self.paint()
"""
    relations = _extract_source(tmp_path, source, path="pkg/widgets.py")
    real = _real_symbols(tmp_path, RUN_ID, "pkg/widgets.py")
    render_id = real["python:pkg/widgets.py::Widget.render"].id
    base_paint_id = real["python:pkg/widgets.py::Base.paint"].id

    assert len(relations) == 1
    rel = relations[0]
    assert rel.source_entity_id == render_id
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "self.paint"
    # Must NOT have guessed the inherited Base.paint target.
    assert rel.target_entity_id != base_paint_id


# ---------------------------------------------------------------------------
# Locally resolvable class/method calls
# ---------------------------------------------------------------------------


def test_inline_constructor_chain_call_resolved(tmp_path: Path) -> None:
    source = """
class Greeter:
    def greet(self):
        return "hi"


def caller():
    return Greeter().greet()
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    real = _real_symbols(tmp_path, RUN_ID, "pkg/mod.py")
    greeter_id = real["python:pkg/mod.py::Greeter"].id
    greet_id = real["python:pkg/mod.py::Greeter.greet"].id
    caller_id = real["python:pkg/mod.py::caller"].id

    # Two relations at the same call site: the constructor call itself, and
    # the chained .greet() call.
    assert len(relations) == 2
    constructor_calls = [r for r in relations if r.target_entity_id == greeter_id]
    assert len(constructor_calls) == 1
    constructor_rel = constructor_calls[0]
    assert constructor_rel.resolution_status == "resolved"
    assert constructor_rel.source_entity_id == caller_id

    greet_calls = [r for r in relations if r.target_entity_id == greet_id]
    assert len(greet_calls) == 1
    rel = greet_calls[0]
    assert rel.source_entity_id == caller_id
    assert rel.resolution_status == "resolved"
    assert rel.confidence is None


def test_class_static_method_direct_call_resolved(tmp_path: Path) -> None:
    source = """
class MathOps:
    @staticmethod
    def add_one(x):
        return x + 1


def caller():
    return MathOps.add_one(5)
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    real = _real_symbols(tmp_path, RUN_ID, "pkg/mod.py")
    caller_id = real["python:pkg/mod.py::caller"].id
    add_one_id = real["python:pkg/mod.py::MathOps.add_one"].id

    assert len(relations) == 1
    rel = relations[0]
    assert rel.source_entity_id == caller_id
    assert rel.target_entity_id == add_one_id
    assert rel.resolution_status == "resolved"


def test_variable_assigned_then_method_called_is_partial_with_confidence(tmp_path: Path) -> None:
    source = """
class Greeter:
    def greet(self):
        return "hi"


def caller():
    g = Greeter()
    return g.greet()
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    real = _real_symbols(tmp_path, RUN_ID, "pkg/mod.py")
    greet_id = real["python:pkg/mod.py::Greeter.greet"].id

    greet_calls = [r for r in relations if r.target_entity_id == greet_id]
    assert len(greet_calls) == 1
    rel = greet_calls[0]
    assert rel.resolution_status == "partial"
    assert rel.confidence is not None
    assert 0.0 <= rel.confidence <= 1.0
    # "partial" always carries target_reference regardless of whether a
    # real target_entity_id was also found.
    assert rel.target_reference == "g.greet"


# ---------------------------------------------------------------------------
# Deterministic imported-name calls
# ---------------------------------------------------------------------------


def test_deterministic_relative_import_call_resolved(tmp_path: Path) -> None:
    files = {
        "pkg/other_module.py": """
def other_function():
    return 42
""",
        "pkg/mod.py": """
from .other_module import other_function


def caller():
    return other_function()
""",
    }
    relations = _extract(tmp_path, files)
    real_mod = _real_symbols(tmp_path, RUN_ID, "pkg/mod.py")
    real_other = _real_symbols(tmp_path, RUN_ID, "pkg/other_module.py")
    caller_id = real_mod["python:pkg/mod.py::caller"].id
    other_function_id = real_other["python:pkg/other_module.py::other_function"].id

    calls = [r for r in relations if r.span_path == "pkg/mod.py"]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.source_entity_id == caller_id
    assert rel.target_entity_id == other_function_id
    assert rel.resolution_status == "resolved"
    assert rel.confidence is None


def test_deterministic_import_of_class_then_inline_method_call_resolved(tmp_path: Path) -> None:
    files = {
        "pkg/service.py": """
class Service:
    def run(self):
        return "done"
""",
        "pkg/mod.py": """
from .service import Service


def caller():
    return Service().run()
""",
    }
    relations = _extract(tmp_path, files)
    real_mod = _real_symbols(tmp_path, RUN_ID, "pkg/mod.py")
    real_service = _real_symbols(tmp_path, RUN_ID, "pkg/service.py")
    caller_id = real_mod["python:pkg/mod.py::caller"].id
    run_id = real_service["python:pkg/service.py::Service.run"].id

    run_calls = [r for r in relations if r.target_entity_id == run_id]
    assert len(run_calls) == 1
    rel = run_calls[0]
    assert rel.source_entity_id == caller_id
    assert rel.resolution_status == "resolved"


def test_external_import_call_is_unresolved_not_fabricated(tmp_path: Path) -> None:
    source = """
import requests


def caller():
    return requests.get("http://example.com")
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    assert len(relations) == 1
    rel = relations[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "requests.get"


def test_import_from_module_not_in_tree_is_unresolved(tmp_path: Path) -> None:
    source = """
from .missing_module import missing_function


def caller():
    return missing_function()
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    assert len(relations) == 1
    rel = relations[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "missing_function"


# ---------------------------------------------------------------------------
# Ambiguous cases -- must be unresolved, never a guessed target
# ---------------------------------------------------------------------------


def test_attribute_call_through_unknown_typed_parameter_is_unresolved(tmp_path: Path) -> None:
    """Calling a method on a value of statically-unknown type (a plain
    function parameter) must never be resolved to a guessed target."""
    source = """
def caller(handler):
    return handler.run()
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    assert len(relations) == 1
    rel = relations[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "handler.run"


def test_kwargs_constructed_object_call_is_unresolved(tmp_path: Path) -> None:
    """An object built via **kwargs through an unresolvable factory call
    must not be guessed at when a method is later called on it."""
    source = """
def make(**kwargs):
    return kwargs


def caller(**kwargs):
    obj = make(**kwargs)
    return obj.method()
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    method_calls = [r for r in relations if r.target_reference == "obj.method"]
    assert len(method_calls) == 1
    rel = method_calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None


def test_variable_assigned_two_different_classes_is_unresolved_not_guessed(tmp_path: Path) -> None:
    """A variable assigned different concrete classes on different code
    paths is genuinely ambiguous statically; must not resolve to either."""
    source = """
class ClassA:
    def method(self):
        return "a"


class ClassB:
    def method(self):
        return "b"


def caller(flag):
    if flag:
        obj = ClassA()
    else:
        obj = ClassB()
    return obj.method()
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    resolved_or_partial_method_calls = [
        r
        for r in relations
        if r.target_reference == "obj.method" and r.resolution_status in ("resolved", "partial")
    ]
    assert len(resolved_or_partial_method_calls) == 0
    unresolved_calls = [
        r
        for r in relations
        if r.target_reference == "obj.method" and r.resolution_status == "unresolved"
    ]
    assert len(unresolved_calls) == 1
    assert unresolved_calls[0].target_entity_id is None


def test_super_call_is_unresolved(tmp_path: Path) -> None:
    source = """
class Base:
    def paint(self):
        return "base"


class Widget(Base):
    def paint(self):
        return super().paint()
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    real = _real_symbols(tmp_path, RUN_ID, "pkg/mod.py")
    base_paint_id = real["python:pkg/mod.py::Base.paint"].id

    paint_calls = [r for r in relations if r.target_reference and "paint" in r.target_reference]
    assert len(paint_calls) == 1
    rel = paint_calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_entity_id != base_paint_id


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------


def test_extraction_is_deterministic_across_runs(tmp_path: Path) -> None:
    files = {
        "pkg/other_module.py": """
def other_function():
    return 1
""",
        "pkg/mod.py": """
from .other_module import other_function


class Widget:
    def render(self):
        return self.paint()

    def paint(self):
        return other_function()


def caller():
    w = Widget()
    return w.render()
""",
    }
    _write(tmp_path, files)
    job_a = _job_for(tmp_path, RUN_ID)
    job_b = _job_for(tmp_path, RUN_ID)
    symbols_a = _symbols_for(job_a, list(files.keys()))
    symbols_b = _symbols_for(job_b, list(files.keys()))
    first = extract_call_relations(job_a, symbols_a, file_paths=list(files.keys()))
    second = extract_call_relations(job_b, symbols_b, file_paths=list(files.keys()))

    assert len(first) == len(second)
    assert len(first) > 0
    first_ids = [r.id for r in first]
    second_ids = [r.id for r in second]
    assert first_ids == second_ids
    assert len(set(first_ids)) == len(first_ids), "relation ids should be unique per call site"

    first_targets = [r.target_entity_id for r in first]
    second_targets = [r.target_entity_id for r in second]
    assert first_targets == second_targets


def test_extraction_ids_differ_across_run_ids(tmp_path: Path) -> None:
    source = """
def helper():
    return 1


def caller():
    return helper()
"""
    _write(tmp_path, {"pkg/mod.py": source})
    job_a = _job_for(tmp_path, "run-a")
    job_b = _job_for(tmp_path, "run-b")
    symbols_a = _symbols_for(job_a, ["pkg/mod.py"])
    symbols_b = _symbols_for(job_b, ["pkg/mod.py"])
    rel_a = extract_call_relations(job_a, symbols_a, file_paths=["pkg/mod.py"])[0]
    rel_b = extract_call_relations(job_b, symbols_b, file_paths=["pkg/mod.py"])[0]
    assert rel_a.id != rel_b.id
    assert rel_a.target_entity_id != rel_b.target_entity_id
    assert rel_a.source_entity_id != rel_b.source_entity_id


# ---------------------------------------------------------------------------
# Nested functions / module path derivation
# ---------------------------------------------------------------------------


def test_nested_function_gets_own_real_entity_and_own_calls(tmp_path: Path) -> None:
    source = """
def outer():
    def inner():
        return helper()
    return inner()


def helper():
    return 1
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    real = _real_symbols(tmp_path, RUN_ID, "pkg/mod.py")
    outer_id = real["python:pkg/mod.py::outer"].id
    inner_id = real["python:pkg/mod.py::outer.inner"].id
    helper_id = real["python:pkg/mod.py::helper"].id

    inner_calls = [r for r in relations if r.source_entity_id == inner_id]
    assert len(inner_calls) == 1
    assert inner_calls[0].target_entity_id == helper_id
    assert inner_calls[0].resolution_status == "resolved"

    outer_calls = [r for r in relations if r.source_entity_id == outer_id]
    assert len(outer_calls) == 1
    assert outer_calls[0].target_entity_id == inner_id


def test_init_module_path_drops_trailing_init_segment_for_internal_scheme_only(tmp_path: Path) -> None:
    """The extractor's own internal dotted-qualname scheme normalizes
    __init__.py paths, but the real ParsedSymbol identity (what actually
    ends up in the relation) is keyed off the literal file path, matching
    ``python_symbol_parser``'s own convention exactly."""
    source = """
def helper():
    return 1


def caller():
    return helper()
"""
    relations = _extract_source(tmp_path, source, path="pkg/sub/__init__.py")
    real = _real_symbols(tmp_path, RUN_ID, "pkg/sub/__init__.py")
    caller_id = real["python:pkg/sub/__init__.py::caller"].id
    helper_id = real["python:pkg/sub/__init__.py::helper"].id

    assert len(relations) == 1
    rel = relations[0]
    assert rel.source_entity_id == caller_id
    assert rel.target_entity_id == helper_id


def test_module_level_calls_are_not_emitted(tmp_path: Path) -> None:
    source = """
def helper():
    return 1


helper()
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    assert relations == []


# ---------------------------------------------------------------------------
# Real-symbol-table integration: known gap (control-flow-nested definitions)
# ---------------------------------------------------------------------------


def test_function_nested_in_control_flow_block_has_no_real_symbol_so_is_dropped(tmp_path: Path) -> None:
    """The real python_symbol_parser only walks direct ``body`` statement
    lists (Module/ClassDef/FunctionDef), so a function defined nested
    inside an ``if`` block at module scope never becomes a real
    ParsedSymbol -- see the extractor's module docstring, "Known gap". A
    call to such a function must come out unresolved (never a fabricated
    id). The call made *inside* that nested function (``helper()``) never
    produces a relation either -- ``_process_module`` only dispatches into
    direct top-level function/class statements, so a def nested inside an
    ``if`` at module scope is never even visited for its own call sites."""
    source = """
if True:
    def conditionally_defined():
        return helper()


def caller():
    return conditionally_defined()


def helper():
    return 1
"""
    relations = _extract_source(tmp_path, source, path="pkg/mod.py")
    real = _real_symbols(tmp_path, RUN_ID, "pkg/mod.py")
    assert "python:pkg/mod.py::conditionally_defined" not in real

    assert len(relations) == 1
    rel = relations[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "conditionally_defined"


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
    than deriving its own via a hidden re-parse (which would be free to
    mint different ``ParsedSymbol.id`` values, e.g. under a different
    internal run_id)."""
    files = {
        "pkg/other_module.py": """
def other_function():
    return 1
""",
        "pkg/mod.py": """
from .other_module import other_function


class Widget:
    def render(self):
        return self.paint()

    def paint(self):
        return other_function()


def caller():
    w = Widget()
    return w.render()
""",
    }
    _write(tmp_path, files)
    job = _job_for(tmp_path, RUN_ID)
    symbols = _symbols_for(job, list(files.keys()))
    symbol_ids = {s.id for s in symbols}
    assert symbol_ids, "fixture must produce at least one real symbol"

    relations = extract_call_relations(job, symbols, file_paths=list(files.keys()))
    assert len(relations) > 0

    for rel in relations:
        assert rel.source_entity_id in symbol_ids
        if rel.target_entity_id is not None:
            assert rel.target_entity_id in symbol_ids


def test_pruned_symbol_set_forces_unresolved_proving_no_hidden_reparse(tmp_path: Path) -> None:
    """Deliberately omit a real symbol (``helper``) from the injected
    ``symbols`` collection before handing it to the extractor. If the
    extractor were secretly still calling ``parse_python_symbols`` itself
    (e.g. to "backfill" what it was given), the omitted symbol's real id
    would still show up as ``target_entity_id`` for the call to ``helper``.
    Since it does not -- the call is downgraded to "unresolved" instead --
    this structurally proves the extractor has no path back to a fresh
    parse and can only ever use the exact ``symbols`` collection it was
    handed."""
    source = """
def helper():
    return 1


def caller():
    return helper()
"""
    _write(tmp_path, {"pkg/mod.py": source})
    job = _job_for(tmp_path, RUN_ID)
    full_symbols = _symbols_for(job, ["pkg/mod.py"])
    helper_symbol = next(s for s in full_symbols if s.qualified_name == "python:pkg/mod.py::helper")

    # Sanity check with the full (un-pruned) set: the call resolves.
    baseline = extract_call_relations(job, full_symbols, file_paths=["pkg/mod.py"])
    baseline_helper_calls = [r for r in baseline if r.target_entity_id == helper_symbol.id]
    assert len(baseline_helper_calls) == 1
    assert baseline_helper_calls[0].resolution_status == "resolved"

    # Now prune `helper` out of the supplied symbols and re-extract against
    # the SAME job/on-disk source.
    pruned_symbols = [s for s in full_symbols if s.id != helper_symbol.id]
    assert len(pruned_symbols) == len(full_symbols) - 1

    relations = extract_call_relations(job, pruned_symbols, file_paths=["pkg/mod.py"])

    # The omitted symbol's real id must never appear anywhere in the output
    # -- if it did, that would be proof of a hidden re-parse backfilling it.
    for rel in relations:
        assert rel.source_entity_id != helper_symbol.id
        assert rel.target_entity_id != helper_symbol.id

    helper_calls = [r for r in relations if r.target_reference == "helper"]
    assert len(helper_calls) == 1
    rel = helper_calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None


def test_stable_entity_key_round_trips_through_injected_symbols(tmp_path: Path) -> None:
    """``stable_entity_key`` is an untouched ``ParsedSymbol`` field (see
    module docstring point 4 in the harmonization brief); confirm it still
    round-trips correctly through the injected-symbols path: an entity id
    emitted by the extractor still resolves back (via the exact ``symbols``
    collection handed in) to a ``ParsedSymbol`` with a valid, non-empty
    ``stable_entity_key``, exactly as it would have before this change."""
    source = """
def helper():
    return 1


def caller():
    return helper()
"""
    _write(tmp_path, {"pkg/mod.py": source})
    job = _job_for(tmp_path, RUN_ID)
    symbols = _symbols_for(job, ["pkg/mod.py"])
    symbols_by_id = {s.id: s for s in symbols}

    relations = extract_call_relations(job, symbols, file_paths=["pkg/mod.py"])
    resolved = [r for r in relations if r.resolution_status == "resolved"]
    assert len(resolved) == 1
    rel = resolved[0]

    source_symbol = symbols_by_id[rel.source_entity_id]
    target_symbol = symbols_by_id[rel.target_entity_id]
    assert source_symbol.stable_entity_key != ""
    assert target_symbol.stable_entity_key != ""
    assert source_symbol.stable_entity_key != target_symbol.stable_entity_key



# ---------------------------------------------------------------------------
# Constructor-binding fallback resolution
# (``self.<attribute>.<method>()`` via caller-supplied ``bindings``)
# ---------------------------------------------------------------------------


_CONTROLLER_SERVICE_SOURCE = """
class OrderService:
    def create_order(self, payload):
        return payload


class OrderController:
    def __init__(self, order_service: OrderService) -> None:
        self.order_service = order_service

    def place_order(self, payload):
        return self.order_service.create_order(payload)
"""
# Line numbers (1-indexed, matching the leading blank line above):
#   8: `def __init__(self, order_service: OrderService) -> None:`  (annotation)
#   9: `self.order_service = order_service`                        (assignment)
_ANNOTATION_LINE = 8
_ASSIGNMENT_LINE = 9


def _job_and_symbols(
    tmp_path: Path, files: dict[str, str], run_id: str = RUN_ID
) -> tuple[AnalysisJob, list[ParsedSymbol]]:
    _write(tmp_path, files)
    job = _job_for(tmp_path, run_id)
    symbols = _symbols_for(job, list(files.keys()))
    return job, symbols


def _resolved_binding(
    *,
    owning_class_entity_id: str,
    target_type_entity_id: str,
    attribute_name: str = "order_service",
    parameter_name: str = "order_service",
    declared_type_reference: str = "OrderService",
    with_spans: bool = True,
) -> ConstructorAttributeBinding:
    span_kwargs = {}
    if with_spans:
        span_kwargs = dict(
            annotation_span_path="pkg/mod.py",
            annotation_span_start_line=_ANNOTATION_LINE,
            annotation_span_end_line=_ANNOTATION_LINE,
            assignment_span_path="pkg/mod.py",
            assignment_span_start_line=_ASSIGNMENT_LINE,
            assignment_span_end_line=_ASSIGNMENT_LINE,
        )
    return ConstructorAttributeBinding.create(
        run_id=RUN_ID,
        owning_class_entity_id=owning_class_entity_id,
        attribute_name=attribute_name,
        parameter_name=parameter_name,
        declared_type_reference=declared_type_reference,
        resolution_status="resolved",
        target_type_entity_id=target_type_entity_id,
        **span_kwargs,
    )


def test_constructor_binding_resolves_self_attribute_method_call(tmp_path: Path) -> None:
    """The canonical case: a controller class with a constructor-injected
    service attribute. A hand-constructed, resolved ConstructorAttributeBinding
    passed via `bindings=` must resolve the previously-unresolvable
    `self.order_service.create_order(...)` call site."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _CONTROLLER_SERVICE_SOURCE})
    by_qn = {s.qualified_name: s for s in symbols}
    controller_id = by_qn["python:pkg/mod.py::OrderController"].id
    service_id = by_qn["python:pkg/mod.py::OrderService"].id
    place_order_id = by_qn["python:pkg/mod.py::OrderController.place_order"].id
    create_order_id = by_qn["python:pkg/mod.py::OrderService.create_order"].id

    binding = _resolved_binding(owning_class_entity_id=controller_id, target_type_entity_id=service_id)

    relations = list(
        extract_call_relations(job, symbols, file_paths=["pkg/mod.py"], bindings=[binding])
    )

    calls = [r for r in relations if r.source_entity_id == place_order_id]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == create_order_id
    assert rel.resolution_basis == "constructor_binding"
    assert rel.target_reference is None
    assert rel.confidence is None
    # Primary span remains the call site itself, unchanged.
    assert rel.span_path == "pkg/mod.py"

    assert len(rel.supporting_resolution_spans) == 2
    descriptions = {s.description for s in rel.supporting_resolution_spans}
    assert descriptions == {"constructor parameter annotation", "attribute assignment"}
    annotation_span = next(
        s for s in rel.supporting_resolution_spans if s.description == "constructor parameter annotation"
    )
    assignment_span = next(
        s for s in rel.supporting_resolution_spans if s.description == "attribute assignment"
    )
    assert annotation_span.path == "pkg/mod.py"
    assert annotation_span.start_line == _ANNOTATION_LINE
    assert annotation_span.end_line == _ANNOTATION_LINE
    assert assignment_span.path == "pkg/mod.py"
    assert assignment_span.start_line == _ASSIGNMENT_LINE
    assert assignment_span.end_line == _ASSIGNMENT_LINE


def test_unresolved_binding_does_not_resolve_call(tmp_path: Path) -> None:
    """A binding that is itself resolution_status="unresolved" must NOT be
    used to resolve the call -- never resolve through an uncertain binding."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _CONTROLLER_SERVICE_SOURCE})
    by_qn = {s.qualified_name: s for s in symbols}
    controller_id = by_qn["python:pkg/mod.py::OrderController"].id
    place_order_id = by_qn["python:pkg/mod.py::OrderController.place_order"].id

    binding = ConstructorAttributeBinding.create(
        run_id=RUN_ID,
        owning_class_entity_id=controller_id,
        attribute_name="order_service",
        parameter_name="order_service",
        declared_type_reference="SomeExternalThing",
        resolution_status="unresolved",
    )

    relations = list(
        extract_call_relations(job, symbols, file_paths=["pkg/mod.py"], bindings=[binding])
    )

    calls = [r for r in relations if r.source_entity_id == place_order_id]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "self.order_service.create_order"
    assert rel.resolution_basis is None
    assert rel.supporting_resolution_spans == ()


def test_binding_for_different_attribute_has_no_effect(tmp_path: Path) -> None:
    """A binding for a DIFFERENT attribute name than the one used in the
    call site must not affect that call site."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _CONTROLLER_SERVICE_SOURCE})
    by_qn = {s.qualified_name: s for s in symbols}
    controller_id = by_qn["python:pkg/mod.py::OrderController"].id
    service_id = by_qn["python:pkg/mod.py::OrderService"].id
    place_order_id = by_qn["python:pkg/mod.py::OrderController.place_order"].id

    binding = _resolved_binding(
        owning_class_entity_id=controller_id,
        target_type_entity_id=service_id,
        attribute_name="some_other_attribute",
        parameter_name="some_other_attribute",
    )

    relations = list(
        extract_call_relations(job, symbols, file_paths=["pkg/mod.py"], bindings=[binding])
    )

    calls = [r for r in relations if r.source_entity_id == place_order_id]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "self.order_service.create_order"
    assert rel.resolution_basis is None


def test_binding_resolved_target_with_zero_matching_methods_falls_through(tmp_path: Path) -> None:
    """The resolved target type has ZERO methods matching the called name
    -> falls through, not resolved."""
    source = """
class OrderService:
    def create_order(self, payload):
        return payload


class OrderController:
    def __init__(self, order_service: OrderService) -> None:
        self.order_service = order_service

    def place_order(self, payload):
        return self.order_service.update_order(payload)
"""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": source})
    by_qn = {s.qualified_name: s for s in symbols}
    controller_id = by_qn["python:pkg/mod.py::OrderController"].id
    service_id = by_qn["python:pkg/mod.py::OrderService"].id
    place_order_id = by_qn["python:pkg/mod.py::OrderController.place_order"].id

    binding = _resolved_binding(
        owning_class_entity_id=controller_id, target_type_entity_id=service_id, with_spans=False
    )

    relations = list(
        extract_call_relations(job, symbols, file_paths=["pkg/mod.py"], bindings=[binding])
    )

    calls = [r for r in relations if r.source_entity_id == place_order_id]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "self.order_service.update_order"
    assert rel.resolution_basis is None


def test_binding_resolved_target_with_ambiguous_multiple_methods_falls_through(tmp_path: Path) -> None:
    """The resolved target type has MULTIPLE matching methods (a class body
    with two same-named methods -- syntactically legal, just shadowing) ->
    falls through, not resolved, never picks one arbitrarily."""
    source = """
class OrderService:
    def create_order(self, payload):
        return "first"

    def create_order(self, payload):
        return "second"


class OrderController:
    def __init__(self, order_service: OrderService) -> None:
        self.order_service = order_service

    def place_order(self, payload):
        return self.order_service.create_order(payload)
"""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": source})
    by_qn = {s.qualified_name: s for s in symbols}
    controller_id = by_qn["python:pkg/mod.py::OrderController"].id
    service_id = by_qn["python:pkg/mod.py::OrderService"].id
    place_order_id = by_qn["python:pkg/mod.py::OrderController.place_order"].id

    create_order_symbols = [s for s in symbols if s.qualified_name == "python:pkg/mod.py::OrderService.create_order"]
    assert len(create_order_symbols) == 2, "fixture must produce two distinct real method symbols to be ambiguous"

    binding = _resolved_binding(
        owning_class_entity_id=controller_id, target_type_entity_id=service_id, with_spans=False
    )

    relations = list(
        extract_call_relations(job, symbols, file_paths=["pkg/mod.py"], bindings=[binding])
    )

    calls = [r for r in relations if r.source_entity_id == place_order_id]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "self.order_service.create_order"
    assert rel.resolution_basis is None


def test_call_without_bindings_kwarg_matches_prior_unresolved_behavior(tmp_path: Path) -> None:
    """Explicit backward-compatibility regression: calling
    extract_call_relations the OLD way -- no `bindings` kwarg at all -- must
    reproduce exactly the pre-existing behavior for the
    `self.<attribute>.<method>()` pattern (unresolved, literal
    target_reference, no resolution_basis/supporting_resolution_spans),
    proving the new fallback path never silently activates unless the
    caller explicitly supplies bindings."""
    relations = _extract_source(tmp_path, _CONTROLLER_SERVICE_SOURCE, path="pkg/mod.py")
    calls = [r for r in relations if r.target_reference == "self.order_service.create_order"]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.resolution_basis is None
    assert rel.supporting_resolution_spans == ()


def test_default_empty_bindings_matches_omitted_bindings_kwarg(tmp_path: Path) -> None:
    """Passing `bindings=()` explicitly must be indistinguishable from
    omitting the kwarg entirely -- both use the same default."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _CONTROLLER_SERVICE_SOURCE})
    without_kwarg = extract_call_relations(job, symbols, file_paths=["pkg/mod.py"])
    with_empty_bindings = extract_call_relations(job, symbols, file_paths=["pkg/mod.py"], bindings=())
    assert [r.id for r in without_kwarg] == [r.id for r in with_empty_bindings]
    assert without_kwarg == with_empty_bindings


def test_existing_self_method_regression_fixture_unaffected_by_bindings_param(tmp_path: Path) -> None:
    """Existing self.-attribute-call test fixture (single-level
    self.method(), from test_self_method_call_resolved_to_own_class_method)
    must resolve identically whether or not bindings= is passed -- the new
    fallback only ever applies to the two-level self.<attr>.<method>()
    shape it never previously resolved."""
    source = """
class Widget:
    def render(self):
        return self.paint()

    def paint(self):
        return "ok"
"""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/widgets.py": source})
    baseline = extract_call_relations(job, symbols, file_paths=["pkg/widgets.py"])
    with_bindings = extract_call_relations(
        job, symbols, file_paths=["pkg/widgets.py"], bindings=[]
    )
    assert baseline == with_bindings
    assert len(baseline) == 1
    assert baseline[0].resolution_status == "resolved"
    assert baseline[0].resolution_basis is None


def test_constructor_binding_resolution_is_deterministic_across_runs(tmp_path: Path) -> None:
    """Same job/symbols/bindings twice -> identical output, including
    identical relation ids."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _CONTROLLER_SERVICE_SOURCE})
    by_qn = {s.qualified_name: s for s in symbols}
    controller_id = by_qn["python:pkg/mod.py::OrderController"].id
    service_id = by_qn["python:pkg/mod.py::OrderService"].id
    binding = _resolved_binding(owning_class_entity_id=controller_id, target_type_entity_id=service_id)

    first = extract_call_relations(job, symbols, file_paths=["pkg/mod.py"], bindings=[binding])
    second = extract_call_relations(job, symbols, file_paths=["pkg/mod.py"], bindings=[binding])

    assert len(first) == len(second)
    assert len(first) > 0
    assert [r.id for r in first] == [r.id for r in second]
    assert first == second
    resolved_via_binding = [r for r in first if r.resolution_basis == "constructor_binding"]
    assert len(resolved_via_binding) == 1


def test_extract_call_relations_returns_a_tuple(tmp_path: Path) -> None:
    """Return type is ``tuple[ObservedProgramRelation, ...]``, matching the
    inheritance extractor's return type."""
    source = """
def helper():
    return 1


def caller():
    return helper()
"""
    _write(tmp_path, {"pkg/mod.py": source})
    job = _job_for(tmp_path, RUN_ID)
    symbols = _symbols_for(job, ["pkg/mod.py"])
    relations = extract_call_relations(job, symbols, file_paths=["pkg/mod.py"])
    assert isinstance(relations, tuple)


# ---------------------------------------------------------------------------
# Case B: direct-construction fallback resolution
# (``resolution_basis="direct_construction"``) -- ``self.<attribute> =
# <ClassExpr>(...)`` in ``__init__`` (no constructor parameter/annotation
# involved at all), read via ``self.<attribute>.<method>()`` in ANY method.
#
# Deliberately uses fixture class/attribute names that do not appear
# anywhere in ``research/provenance-evaluation/fixtures/python_app/`` (or
# in the constructor-binding fallback fixtures above), to prove this
# resolution path is generic AST-shape matching, not name-specific.
# ---------------------------------------------------------------------------


def _line_of(source: str, needle: str) -> int:
    """Locate the 1-indexed line number of the first line containing
    ``needle`` in ``source`` -- used instead of manually counted line
    constants so fixture edits can't silently desynchronize expected spans
    from the actual source."""
    for i, line in enumerate(source.splitlines(), start=1):
        if needle in line:
            return i
    raise AssertionError(f"{needle!r} not found in source")


_DIRECT_CONSTRUCTION_SOURCE = """
class ConsoleNotifier:
    def dispatch(self, message):
        return message


class ReportBuilder:
    def __init__(self):
        self.notifier = ConsoleNotifier()

    def build(self, message):
        return self.notifier.dispatch(message)
"""


def test_direct_construction_resolves_self_attribute_method_call(tmp_path: Path) -> None:
    """The canonical Case B: a bare ``self.<attribute> = SomeClass()`` in
    ``__init__`` (no constructor parameter/annotation involved), read via
    ``self.<attribute>.<method>()`` in a DIFFERENT method -- must resolve
    without any ``bindings=`` input at all (this is this module's own new
    fallback, not the constructor-binding one)."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _DIRECT_CONSTRUCTION_SOURCE})
    by_qn = {s.qualified_name: s for s in symbols}
    build_id = by_qn["python:pkg/mod.py::ReportBuilder.build"].id
    dispatch_id = by_qn["python:pkg/mod.py::ConsoleNotifier.dispatch"].id

    relations = list(extract_call_relations(job, symbols, file_paths=["pkg/mod.py"]))

    calls = [r for r in relations if r.source_entity_id == build_id and r.target_entity_id == dispatch_id]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.resolution_status == "resolved"
    assert rel.resolution_basis == "direct_construction"
    assert rel.target_reference is None
    assert rel.confidence is None
    # Primary span remains the call site itself, unchanged.
    assert rel.span_path == "pkg/mod.py"

    assert len(rel.supporting_resolution_spans) == 1
    span = rel.supporting_resolution_spans[0]
    assert span.description == "direct construction assignment"
    assert span.path == "pkg/mod.py"
    expected_line = _line_of(_DIRECT_CONSTRUCTION_SOURCE, "self.notifier = ConsoleNotifier()")
    assert span.start_line == expected_line
    assert span.end_line == expected_line


def test_direct_construction_does_not_require_bindings_kwarg(tmp_path: Path) -> None:
    """Case B is this module's own AST-derived fact, not caller-supplied
    input -- it must resolve identically whether or not ``bindings=`` is
    passed at all."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _DIRECT_CONSTRUCTION_SOURCE})
    without_bindings = extract_call_relations(job, symbols, file_paths=["pkg/mod.py"])
    with_empty_bindings = extract_call_relations(job, symbols, file_paths=["pkg/mod.py"], bindings=())
    assert without_bindings == with_empty_bindings
    resolved_via_direct_construction = [
        r for r in without_bindings if r.resolution_basis == "direct_construction"
    ]
    assert len(resolved_via_direct_construction) == 1


_CASE_B_AND_CASE_C_COEXIST_SOURCE = """
class ConsoleNotifier:
    def dispatch(self, message):
        return message


class MixedController:
    def __init__(self, injected_handler):
        self.injected_handler = injected_handler
        self.notifier = ConsoleNotifier()

    def use_injected(self):
        return self.injected_handler.run()

    def use_built(self):
        return self.notifier.dispatch("hi")
"""


def test_case_b_and_case_c_coexist_without_cross_triggering(tmp_path: Path) -> None:
    """Case C's pattern (``self.x = <bare parameter name>``, untyped) and
    Case B's pattern (``self.x = ClassName(...)``) are syntactically
    disjoint. In the SAME class's ``__init__``, one attribute uses each
    pattern; each call site must resolve (or not) completely independently
    -- Case C's untyped injection must remain unresolved (never guessed,
    and unaffected by the fact no ``bindings=`` were supplied for it
    either), while Case B's direct construction resolves normally."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _CASE_B_AND_CASE_C_COEXIST_SOURCE})
    by_qn = {s.qualified_name: s for s in symbols}
    use_injected_id = by_qn["python:pkg/mod.py::MixedController.use_injected"].id
    use_built_id = by_qn["python:pkg/mod.py::MixedController.use_built"].id
    dispatch_id = by_qn["python:pkg/mod.py::ConsoleNotifier.dispatch"].id

    relations = list(extract_call_relations(job, symbols, file_paths=["pkg/mod.py"]))

    injected_calls = [r for r in relations if r.source_entity_id == use_injected_id]
    assert len(injected_calls) == 1
    injected_rel = injected_calls[0]
    assert injected_rel.resolution_status == "unresolved"
    assert injected_rel.target_entity_id is None
    assert injected_rel.target_reference == "self.injected_handler.run"
    assert injected_rel.resolution_basis is None

    built_calls = [r for r in relations if r.source_entity_id == use_built_id]
    assert len(built_calls) == 1
    built_rel = built_calls[0]
    assert built_rel.resolution_status == "resolved"
    assert built_rel.target_entity_id == dispatch_id
    assert built_rel.resolution_basis == "direct_construction"


_CROSS_CONTAMINATION_SOURCE = """
class AlertHandler:
    def process(self, payload):
        return "alert:" + payload


class ReportHandler:
    def process(self, payload):
        return "report:" + payload


class AlertPipeline:
    def __init__(self):
        self.handler = AlertHandler()

    def run(self, payload):
        return self.handler.process(payload)


class ReportPipeline:
    def __init__(self):
        self.handler = ReportHandler()

    def run(self, payload):
        return self.handler.process(payload)
"""


def test_same_attribute_name_different_owning_classes_never_cross_contaminates(tmp_path: Path) -> None:
    """Two unrelated classes both use the SAME attribute name (``handler``)
    for direct construction, bound to two DIFFERENT classes. Each call
    site must resolve to its OWN class's method -- never the other's. This
    is only possible if the direct-construction index is keyed by
    ``(owning_class_entity_id, attribute_name)``, never attribute name
    alone."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _CROSS_CONTAMINATION_SOURCE})
    by_qn = {s.qualified_name: s for s in symbols}
    alert_run_id = by_qn["python:pkg/mod.py::AlertPipeline.run"].id
    report_run_id = by_qn["python:pkg/mod.py::ReportPipeline.run"].id
    alert_process_id = by_qn["python:pkg/mod.py::AlertHandler.process"].id
    report_process_id = by_qn["python:pkg/mod.py::ReportHandler.process"].id
    assert alert_process_id != report_process_id

    relations = list(extract_call_relations(job, symbols, file_paths=["pkg/mod.py"]))

    alert_calls = [r for r in relations if r.source_entity_id == alert_run_id]
    assert len(alert_calls) == 1
    alert_rel = alert_calls[0]
    assert alert_rel.resolution_status == "resolved"
    assert alert_rel.resolution_basis == "direct_construction"
    assert alert_rel.target_entity_id == alert_process_id
    assert alert_rel.target_entity_id != report_process_id

    report_calls = [r for r in relations if r.source_entity_id == report_run_id]
    assert len(report_calls) == 1
    report_rel = report_calls[0]
    assert report_rel.resolution_status == "resolved"
    assert report_rel.resolution_basis == "direct_construction"
    assert report_rel.target_entity_id == report_process_id
    assert report_rel.target_entity_id != alert_process_id


_NONEXISTENT_METHOD_SOURCE = """
class ConsoleNotifier:
    def dispatch(self, message):
        return message


class ReportBuilder:
    def __init__(self):
        self.notifier = ConsoleNotifier()

    def build(self, message):
        return self.notifier.does_not_exist(message)
"""


def test_direct_construction_nonexistent_method_does_not_resolve(tmp_path: Path) -> None:
    """The direct-constructed class exists and is resolved, but the CALLED
    method does not exist on it at all -> falls through, not resolved."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _NONEXISTENT_METHOD_SOURCE})
    by_qn = {s.qualified_name: s for s in symbols}
    build_id = by_qn["python:pkg/mod.py::ReportBuilder.build"].id

    relations = list(extract_call_relations(job, symbols, file_paths=["pkg/mod.py"]))

    calls = [r for r in relations if r.source_entity_id == build_id]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "self.notifier.does_not_exist"
    assert rel.resolution_basis is None
    assert rel.supporting_resolution_spans == ()


_AMBIGUOUS_METHOD_SOURCE = """
class ConsoleNotifier:
    def dispatch(self, message):
        return "first"

    def dispatch(self, message):
        return "second"


class ReportBuilder:
    def __init__(self):
        self.notifier = ConsoleNotifier()

    def build(self, message):
        return self.notifier.dispatch(message)
"""


def test_direct_construction_ambiguous_multiple_methods_does_not_resolve(tmp_path: Path) -> None:
    """The direct-constructed class has TWO same-named methods (same
    ambiguity-construction technique as the constructor-binding fallback's
    own ambiguous-method test) -> falls through, not resolved, never
    guesses between them."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _AMBIGUOUS_METHOD_SOURCE})
    dispatch_symbols = [
        s for s in symbols if s.qualified_name == "python:pkg/mod.py::ConsoleNotifier.dispatch"
    ]
    assert len(dispatch_symbols) == 2, "fixture must produce two distinct real method symbols to be ambiguous"
    by_qn = {s.qualified_name: s for s in symbols}
    build_id = by_qn["python:pkg/mod.py::ReportBuilder.build"].id

    relations = list(extract_call_relations(job, symbols, file_paths=["pkg/mod.py"]))

    calls = [r for r in relations if r.source_entity_id == build_id]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "self.notifier.dispatch"
    assert rel.resolution_basis is None


_UNRESOLVABLE_CONSTRUCTOR_EXPR_SOURCE = """
import external_package


class ReportBuilder:
    def __init__(self):
        self.notifier = external_package.Notifier()

    def build(self, message):
        return self.notifier.dispatch(message)
"""


def test_direct_construction_unresolvable_class_expr_never_fabricates(tmp_path: Path) -> None:
    """``<ClassExpr>`` referencing an external/unresolvable import must
    never be added to the direct-construction map -- no guessing (mirrors
    Case A/C's "no fabrication" rule)."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _UNRESOLVABLE_CONSTRUCTOR_EXPR_SOURCE})
    by_qn = {s.qualified_name: s for s in symbols}
    build_id = by_qn["python:pkg/mod.py::ReportBuilder.build"].id

    relations = list(extract_call_relations(job, symbols, file_paths=["pkg/mod.py"]))

    calls = [r for r in relations if r.source_entity_id == build_id]
    assert len(calls) == 1
    rel = calls[0]
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "self.notifier.dispatch"
    assert rel.resolution_basis is None


def test_direct_construction_resolution_is_deterministic_across_runs(tmp_path: Path) -> None:
    """Same job/symbols/bindings twice -> identical output, including
    identical relation ids."""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/mod.py": _DIRECT_CONSTRUCTION_SOURCE})

    first = extract_call_relations(job, symbols, file_paths=["pkg/mod.py"])
    second = extract_call_relations(job, symbols, file_paths=["pkg/mod.py"])

    assert len(first) == len(second)
    assert len(first) > 0
    assert [r.id for r in first] == [r.id for r in second]
    assert first == second
    resolved_via_direct_construction = [r for r in first if r.resolution_basis == "direct_construction"]
    assert len(resolved_via_direct_construction) == 1
