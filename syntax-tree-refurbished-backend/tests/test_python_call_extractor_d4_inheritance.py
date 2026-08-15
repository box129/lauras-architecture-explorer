"""Tests for D4: inheritance-aware ``self.method()`` resolution
(``app.analysis.python_call_extractor``'s ``inherited_self_method``
fallback).

Bounded scope, per the D4 task brief: resolves a bare ``self.method()``
call site when ``method`` is not defined on the calling class itself but
IS defined, uniquely and deterministically, on an ancestor reached
entirely through already-resolved ``inherits`` relations (real output
from ``app.analysis.python_inheritance_extractor``, passed in via the
new ``inherits=`` keyword -- never a direct/duplicated inheritance
computation of this test file's own). Explicitly NOT covered by this
fallback (see ``test_python_call_extractor.py``'s own existing coverage,
unaffected): ``super().method()``, nested functions, generic-parameterized
base classes, package re-export imports, dynamic dispatch.

Fixtures follow the exact same real-parse-then-real-symbols pattern
already established in ``test_python_call_extractor.py`` (see that file's
own module docstring) -- nothing here hand-invents a ``ParsedSymbol`` id
or an ``ObservedProgramRelation``; every relation consumed as ``inherits``
input is the real ``extract_inheritance_relations`` output for the same
job/symbols.
"""

from __future__ import annotations

from pathlib import Path
import uuid

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.python_call_extractor import (
    EXTRACTOR_VERSION,
    extract_call_relations,
)
from syntax_tree_refurbished.app.analysis.python_inheritance_extractor import (
    extract_inheritance_relations,
)
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.app.parsing.python_symbol_parser import parse_python_symbols
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.infra.filesystem.local_repo_reader import LocalRepoReader

RUN_ID = "run-d4-1"


# ---------------------------------------------------------------------------
# Fixture helpers (same pattern as test_python_call_extractor.py)
# ---------------------------------------------------------------------------


def _write(tmp_path: Path, files: dict[str, str]) -> None:
    for rel_path, content in files.items():
        full = tmp_path / rel_path
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content, encoding="utf-8")


def _job_for(repo_path: Path, run_id: str) -> AnalysisJob:
    snapshot = LocalRepoReader(Settings(environment="test")).build_snapshot(
        run_id=run_id, repo_path=str(repo_path)
    )
    job = AnalysisJob(job_id=f"job:{uuid.uuid4().hex}", run_id=run_id, repository_path=str(repo_path))
    job.snapshot = snapshot
    return job


def _symbols_for(job: AnalysisJob, rel_paths: list[str]) -> list[ParsedSymbol]:
    reader = SourceReader(job)
    symbols: list[ParsedSymbol] = []
    for rel_path in rel_paths:
        file = reader.get_file(rel_path)
        symbols.extend(parse_python_symbols(reader, file, job.run_id))
    return symbols


def _job_and_symbols(
    tmp_path: Path, files: dict[str, str], run_id: str = RUN_ID
) -> tuple[AnalysisJob, list[ParsedSymbol]]:
    _write(tmp_path, files)
    job = _job_for(tmp_path, run_id)
    symbols = _symbols_for(job, list(files.keys()))
    return job, symbols


def _extract_with_real_inherits(
    tmp_path: Path, files: dict[str, str], run_id: str = RUN_ID
) -> tuple[list[ObservedProgramRelation], dict[str, ParsedSymbol]]:
    """The canonical D4 pipeline order under test: real symbols -> real
    (unmodified) extract_inheritance_relations -> real
    extract_call_relations(..., inherits=<that real output>). Returns
    (call_relations, symbols_by_qualified_name)."""
    job, symbols = _job_and_symbols(tmp_path, files, run_id=run_id)
    by_qn = {s.qualified_name: s for s in symbols}
    inherits = extract_inheritance_relations(job, symbols, file_paths=list(files.keys()))
    call_relations = list(
        extract_call_relations(job, symbols, file_paths=list(files.keys()), inherits=inherits)
    )
    return call_relations, by_qn


def _only_relation_from(relations: list[ObservedProgramRelation], source_id: str) -> ObservedProgramRelation:
    matches = [r for r in relations if r.source_entity_id == source_id]
    assert len(matches) == 1, f"expected exactly one relation from {source_id!r}, found {len(matches)}"
    return matches[0]


# ---------------------------------------------------------------------------
# 1. Child inherits Base; self.method() resolves to Base.method.
# ---------------------------------------------------------------------------


def test_child_inherits_base_self_method_resolves_to_base_method(tmp_path: Path) -> None:
    source = """
class Base:
    def paint(self):
        return "base"


class Widget(Base):
    def render(self):
        return self.paint()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/widgets.py": source})
    render_id = by_qn["python:pkg/widgets.py::Widget.render"].id
    base_paint_id = by_qn["python:pkg/widgets.py::Base.paint"].id

    rel = _only_relation_from(relations, render_id)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == base_paint_id
    assert rel.target_reference is None
    assert rel.resolution_basis == "inherited_self_method"
    assert rel.confidence is None

    # Supporting resolution provenance records the inheritance evidence
    # used (the Widget(Base) declaration's own span), not just a bare
    # "trust me" resolved status.
    assert len(rel.supporting_resolution_spans) == 1
    span = rel.supporting_resolution_spans[0]
    assert span.path == "pkg/widgets.py"
    assert span.start_line > 0
    assert "inherits" in span.description.lower()


# ---------------------------------------------------------------------------
# 2. Two-level inheritance resolves through grandparent.
# ---------------------------------------------------------------------------


def test_two_level_inheritance_resolves_through_grandparent(tmp_path: Path) -> None:
    source = """
class GrandParent:
    def helper(self):
        return "gp"


class Parent(GrandParent):
    pass


class Child(Parent):
    def run(self):
        return self.helper()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/chain.py": source})
    run_id_ = by_qn["python:pkg/chain.py::Child.run"].id
    helper_id = by_qn["python:pkg/chain.py::GrandParent.helper"].id

    rel = _only_relation_from(relations, run_id_)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == helper_id
    assert rel.resolution_basis == "inherited_self_method"


# ---------------------------------------------------------------------------
# 3. Child override resolves to Child.method, not parent.
# ---------------------------------------------------------------------------


def test_child_override_resolves_to_child_method_not_parent(tmp_path: Path) -> None:
    source = """
class Base:
    def method(self):
        return "base"


class Child(Base):
    def method(self):
        return "child"

    def caller(self):
        return self.method()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/override.py": source})
    caller_id = by_qn["python:pkg/override.py::Child.caller"].id
    child_method_id = by_qn["python:pkg/override.py::Child.method"].id
    base_method_id = by_qn["python:pkg/override.py::Base.method"].id

    rel = _only_relation_from(relations, caller_id)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == child_method_id
    assert rel.target_entity_id != base_method_id
    # Resolved by the ordinary same-class pipeline, never reaching the new
    # fallback at all -- resolution_basis stays unset, exactly as it would
    # pre-D4.
    assert rel.resolution_basis is None


# ---------------------------------------------------------------------------
# 4. Multiple inheritance with a unique, provable MRO target resolves.
# ---------------------------------------------------------------------------


def test_multiple_inheritance_unique_target_resolves(tmp_path: Path) -> None:
    source = """
class Mixin:
    pass


class Provider:
    def fetch(self):
        return "data"


class Combined(Mixin, Provider):
    def run(self):
        return self.fetch()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/multi.py": source})
    run_id_ = by_qn["python:pkg/multi.py::Combined.run"].id
    fetch_id = by_qn["python:pkg/multi.py::Provider.fetch"].id

    rel = _only_relation_from(relations, run_id_)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == fetch_id
    assert rel.resolution_basis == "inherited_self_method"


def test_unresolved_base_beyond_the_matched_ancestor_does_not_block_resolution(tmp_path: Path) -> None:
    """Regression test for a real bug found against jd/tenacity: the class
    where `method` is actually found (Base) itself has a further,
    unresolved external base (ExternalABC) -- e.g. `class Base(ExternalABC):`.
    Python's own method resolution would already stop at Base.method
    before ever consulting ExternalABC, so ExternalABC being unresolved
    must NOT block this resolution (an earlier version of this fallback
    incorrectly blocked on it)."""
    source = """
from some_external_package import ExternalABC


class Base(ExternalABC):
    def paint(self):
        return "base"


class Widget(Base):
    def render(self):
        return self.paint()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/deep.py": source})
    render_id = by_qn["python:pkg/deep.py::Widget.render"].id
    base_paint_id = by_qn["python:pkg/deep.py::Base.paint"].id

    rel = _only_relation_from(relations, render_id)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == base_paint_id
    assert rel.resolution_basis == "inherited_self_method"


def test_unresolved_base_before_the_matched_ancestor_still_blocks(tmp_path: Path) -> None:
    """Contrast case: the unresolved base is on a class the walk must look
    PAST (Middle does not define `method`, and has an unresolved base of
    its own) before reaching a class that does define it further up
    (GrandParent.method). This must still block -- the unresolved base on
    Middle could itself define `method`, shadowing GrandParent's."""
    source = """
from some_external_package import ExternalMixin


class GrandParent:
    def method(self):
        return "gp"


class Middle(GrandParent, ExternalMixin):
    pass


class Child(Middle):
    def caller(self):
        return self.method()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/blocked.py": source})
    caller_id = by_qn["python:pkg/blocked.py::Child.caller"].id
    gp_method_id = by_qn["python:pkg/blocked.py::GrandParent.method"].id

    rel = _only_relation_from(relations, caller_id)
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_entity_id != gp_method_id
    assert rel.resolution_basis is None


# ---------------------------------------------------------------------------
# 5. Ambiguous / unresolved parent remains unresolved.
# ---------------------------------------------------------------------------


def test_unresolved_external_parent_blocks_inheritance_resolution(tmp_path: Path) -> None:
    """Child's base is an external/unanalyzed name (not defined anywhere in
    the analyzed tree) -- even though no OTHER analyzed ancestor defines
    `method`, the extractor must never assume the external base doesn't
    define it either. Must remain unresolved, not silently treated as
    "no candidates found, therefore nothing to resolve"."""
    source = """
from some_external_package import ExternalBase


class Child(ExternalBase):
    def caller(self):
        return self.method()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/external.py": source})
    caller_id = by_qn["python:pkg/external.py::Child.caller"].id

    rel = _only_relation_from(relations, caller_id)
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "self.method"
    assert rel.resolution_basis is None


def test_genuinely_ambiguous_multiple_definitions_remain_unresolved(tmp_path: Path) -> None:
    """Two DIFFERENT analyzed ancestors both define `method` -- a genuine
    override ambiguity this extractor's model does not attempt full C3 MRO
    linearization to resolve. Must remain unresolved, never guess between
    them."""
    source = """
class Left:
    def method(self):
        return "left"


class Right:
    def method(self):
        return "right"


class Combined(Left, Right):
    def run(self):
        return self.method()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/ambiguous.py": source})
    run_id_ = by_qn["python:pkg/ambiguous.py::Combined.run"].id
    left_method_id = by_qn["python:pkg/ambiguous.py::Left.method"].id
    right_method_id = by_qn["python:pkg/ambiguous.py::Right.method"].id

    rel = _only_relation_from(relations, run_id_)
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_entity_id != left_method_id
    assert rel.target_entity_id != right_method_id
    assert rel.resolution_basis is None


# ---------------------------------------------------------------------------
# 6. No cross-class name coincidence.
# ---------------------------------------------------------------------------


def test_no_cross_class_name_coincidence(tmp_path: Path) -> None:
    """An entirely unrelated class (not a base of Child at all) happens to
    define a same-named method. The real base class (Base) does NOT
    define `method` -- resolution must not accidentally pick up the
    unrelated class's method via a name-based shortcut."""
    source = """
class Unrelated:
    def method(self):
        return "unrelated"


class Base:
    def other_thing(self):
        return "base"


class Child(Base):
    def caller(self):
        return self.method()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/coincidence.py": source})
    caller_id = by_qn["python:pkg/coincidence.py::Child.caller"].id
    unrelated_method_id = by_qn["python:pkg/coincidence.py::Unrelated.method"].id

    rel = _only_relation_from(relations, caller_id)
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_entity_id != unrelated_method_id
    assert rel.target_reference == "self.method"


# ---------------------------------------------------------------------------
# 7. Existing same-class calls (and pre-D4 behavior without `inherits`)
#    are unchanged.
# ---------------------------------------------------------------------------


def test_existing_same_class_call_unaffected_by_inherits_kwarg(tmp_path: Path) -> None:
    """A same-class self.method() call, exercised WITH a real, non-empty
    `inherits` collection passed in -- confirms the new fallback never
    fires (and never changes anything) for a call the ordinary pipeline
    already resolves."""
    source = """
class Widget:
    def render(self):
        return self.paint()

    def paint(self):
        return "ok"
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/same_class.py": source})
    render_id = by_qn["python:pkg/same_class.py::Widget.render"].id
    paint_id = by_qn["python:pkg/same_class.py::Widget.paint"].id

    rel = _only_relation_from(relations, render_id)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == paint_id
    assert rel.resolution_basis is None


def test_self_method_via_inheritance_stays_unresolved_when_inherits_kwarg_omitted(tmp_path: Path) -> None:
    """The exact same scenario as test 1 above, but calling
    extract_call_relations WITHOUT the new `inherits=` keyword at all --
    must reproduce byte-identical pre-D4 behavior (unresolved, never
    guessed), proving the fallback is strictly opt-in and every existing
    caller that doesn't pass `inherits` is completely unaffected."""
    source = """
class Base:
    def paint(self):
        return "base"


class Widget(Base):
    def render(self):
        return self.paint()
"""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/widgets.py": source})
    by_qn = {s.qualified_name: s for s in symbols}
    render_id = by_qn["python:pkg/widgets.py::Widget.render"].id
    base_paint_id = by_qn["python:pkg/widgets.py::Base.paint"].id

    relations = list(extract_call_relations(job, symbols, file_paths=["pkg/widgets.py"]))
    rel = _only_relation_from(relations, render_id)
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_entity_id != base_paint_id
    assert rel.target_reference == "self.paint"


# ---------------------------------------------------------------------------
# 8. Real ParsedSymbol ids only.
# ---------------------------------------------------------------------------


def test_inheritance_resolved_target_is_a_real_parsed_symbol_id(tmp_path: Path) -> None:
    source = """
class Base:
    def paint(self):
        return "base"


class Widget(Base):
    def render(self):
        return self.paint()
"""
    job, symbols = _job_and_symbols(tmp_path, {"pkg/widgets.py": source})
    real_ids = {s.id for s in symbols}
    inherits = extract_inheritance_relations(job, symbols, file_paths=["pkg/widgets.py"])
    relations = list(
        extract_call_relations(job, symbols, file_paths=["pkg/widgets.py"], inherits=inherits)
    )
    resolved = [r for r in relations if r.resolution_basis == "inherited_self_method"]
    assert len(resolved) == 1
    rel = resolved[0]
    # target_entity_id (and source_entity_id) must be real, run-scoped
    # ParsedSymbol ids -- never a fabricated/self-invented string.
    assert rel.target_entity_id in real_ids
    assert rel.source_entity_id in real_ids
    assert rel.extractor_version == EXTRACTOR_VERSION


# ---------------------------------------------------------------------------
# 9. Deterministic output.
# ---------------------------------------------------------------------------


def test_inheritance_resolution_is_deterministic_across_runs(tmp_path: Path) -> None:
    source = """
class Base:
    def paint(self):
        return "base"


class Widget(Base):
    def render(self):
        return self.paint()
"""
    _write(tmp_path, {"pkg/widgets.py": source})

    def run_once(run_id: str) -> list[ObservedProgramRelation]:
        job = _job_for(tmp_path, run_id)
        symbols = _symbols_for(job, ["pkg/widgets.py"])
        inherits = extract_inheritance_relations(job, symbols, file_paths=["pkg/widgets.py"])
        return list(
            extract_call_relations(job, symbols, file_paths=["pkg/widgets.py"], inherits=inherits)
        )

    first = run_once(RUN_ID)
    second = run_once(RUN_ID)
    assert first == second

    resolved_first = [r for r in first if r.resolution_basis == "inherited_self_method"]
    assert len(resolved_first) == 1
    assert resolved_first[0].resolution_status == "resolved"

    # Different run_id changes the ids (by design, run-scoped), but the
    # resolution VERDICT (status + basis) is identical.
    third = run_once("run-d4-2")
    resolved_third = [r for r in third if r.resolution_basis == "inherited_self_method"]
    assert len(resolved_third) == 1
    assert resolved_third[0].resolution_status == "resolved"
    assert resolved_third[0].id != resolved_first[0].id
    assert resolved_third[0].target_entity_id != resolved_first[0].target_entity_id
