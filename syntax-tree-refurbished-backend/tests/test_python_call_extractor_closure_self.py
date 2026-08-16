"""Tests for closure-captured ``self`` resolution
(``app.analysis.python_call_extractor`` -- intervention D, correction 2).

Bounded scope: a bare ``self.method()`` call inside a function nested (at
any depth) inside a class method resolves to that class's own method ONLY
when ``self`` is genuinely captured from the enclosing method's lexical
scope. The binding is refused -- the call stays exactly as before, an
ordinary unresolved name -- when the nested function declares its own
``self`` parameter, rebinds ``self`` locally, when any scope on the chain
breaks lexical ownership (an intervening class body, a method that rebinds
``self``), or when the enclosing scope is not a class method with a real
first-positional ``self`` (staticmethod/classmethod, renamed receiver).
Parameter type annotations are never consulted as bindings, and ``super()``
in a nested function stays refused.

The positive and refusal shapes at the bottom mirror the frozen R1
(tenacity) evaluation corpus: ``BaseRetrying.wraps.wrapped_f`` calling
``self.copy()`` (true claim R1-TDC-5), the false-claim analog asserting a
call to a method ``wrapped_f`` never references (R1-FDC-5), and
``before_log.log_it`` calling ``retry_state.get_fn_name()`` through an
annotated parameter, which must stay unresolved (R1-TRC-2's honest
boundary).
"""

from __future__ import annotations

from pathlib import Path
import uuid

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.python_call_extractor import extract_call_relations
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.app.parsing.python_symbol_parser import parse_python_symbols
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation

from syntax_tree_refurbished.infra.filesystem.local_repo_reader import LocalRepoReader

RUN_ID = "run-closure-self-1"


def _extract(
    tmp_path: Path, files: dict[str, str]
) -> tuple[list[ObservedProgramRelation], dict[str, ParsedSymbol]]:
    for rel_path, content in files.items():
        full = tmp_path / rel_path
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content, encoding="utf-8")
    snapshot = LocalRepoReader(Settings(environment="test")).build_snapshot(
        run_id=RUN_ID, repo_path=str(tmp_path)
    )
    job = AnalysisJob(job_id=f"job:{uuid.uuid4().hex}", run_id=RUN_ID, repository_path=str(tmp_path))
    job.snapshot = snapshot
    reader = SourceReader(job)
    symbols: list[ParsedSymbol] = []
    for rel_path in files:
        symbols.extend(parse_python_symbols(reader, reader.get_file(rel_path), RUN_ID))
    relations = list(extract_call_relations(job, symbols, file_paths=list(files.keys())))
    return relations, {s.qualified_name: s for s in symbols}


def _relations_from(
    relations: list[ObservedProgramRelation], source_id: str
) -> list[ObservedProgramRelation]:
    return [r for r in relations if r.source_entity_id == source_id]


def _single(
    relations: list[ObservedProgramRelation], source_id: str, reference_or_none: str | None = None
) -> ObservedProgramRelation:
    matches = _relations_from(relations, source_id)
    if reference_or_none is not None:
        matches = [m for m in matches if m.target_reference == reference_or_none]
    assert len(matches) == 1, matches
    return matches[0]


# ---------------------------------------------------------------------------
# Positive: genuine capture of the enclosing method's `self`
# ---------------------------------------------------------------------------


def test_nested_function_capturing_enclosing_self_resolves(tmp_path: Path) -> None:
    source = """
class BaseRetrying:
    def copy(self):
        return self

    def wraps(self, f):
        def wrapped_f(*args, **kw):
            copy = self.copy()
            return copy
        return wrapped_f
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    wrapped_f_id = by_qn["python:pkg/mod.py::BaseRetrying.wraps.wrapped_f"].id
    copy_id = by_qn["python:pkg/mod.py::BaseRetrying.copy"].id

    rel = _single(relations, wrapped_f_id)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == copy_id
    assert rel.target_reference is None
    assert rel.confidence is None
    # Same plain same-class resolution as inside the method body itself --
    # no special basis, and the primary span is the call site.
    assert rel.resolution_basis is None
    assert rel.span_path == "pkg/mod.py"


def test_doubly_nested_function_still_captures_self(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    def m(self):
        def outer():
            def inner():
                return self.target()
            return inner
        return outer
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    inner_id = by_qn["python:pkg/mod.py::C.m.outer.inner"].id
    target_id = by_qn["python:pkg/mod.py::C.target"].id

    rel = _single(relations, inner_id)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == target_id


def test_capture_inside_async_method_resolves(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    async def m(self):
        def cb():
            return self.target()
        return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    target_id = by_qn["python:pkg/mod.py::C.target"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == target_id


# ---------------------------------------------------------------------------
# Refusals: the nested function's own scope invalidates the capture
# ---------------------------------------------------------------------------


def test_nested_function_with_own_self_parameter_refuses(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    def m(self):
        def cb(self):
            return self.target()
        return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "self.target"


def test_nested_function_with_self_as_keyword_only_parameter_refuses(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    def m(self):
        def cb(*, self=None):
            return self.target()
        return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "unresolved"


def test_nested_function_rebinding_self_locally_refuses(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    def m(self, other):
        def cb():
            self = other
            return self.target()
        return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "unresolved"
    assert rel.target_reference == "self.target"


def test_nested_function_rebinding_self_via_for_loop_refuses(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    def m(self, items):
        def cb():
            for self in items:
                pass
            return self.target()
        return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "unresolved"


def test_nested_function_declaring_nonlocal_self_refuses(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    def m(self):
        def cb():
            nonlocal self
            return self.target()
        return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "unresolved"


# ---------------------------------------------------------------------------
# Refusals: the enclosing chain invalidates the capture
# ---------------------------------------------------------------------------


def test_enclosing_method_rebinding_self_refuses(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    def m(self, other):
        self = other
        def cb():
            return self.target()
        return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "unresolved"


def test_staticmethod_enclosing_scope_refuses(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    @staticmethod
    def m(self):
        def cb():
            return self.target()
        return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "unresolved"


def test_method_without_self_first_parameter_refuses(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    def m(this):
        def cb():
            return self.target()
        return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "unresolved"


def test_intervening_class_body_breaks_the_chain(tmp_path: Path) -> None:
    """A def declared in a class body nested inside a method belongs to
    that inner class -- lexical ownership of `self` across the class
    boundary is ambiguous and refused."""
    source = """
class C:
    def target(self):
        return 1

    def m(self):
        class Inner:
            def handler(inner_self):
                return self.target()
        return Inner
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    handler_id = by_qn["python:pkg/mod.py::C.m.Inner.handler"].id
    rel = _single(relations, handler_id)
    assert rel.resolution_status == "unresolved"
    assert rel.target_reference == "self.target"


def test_module_level_nested_function_with_free_self_stays_unresolved(tmp_path: Path) -> None:
    source = """
def factory():
    def cb():
        return self.target()
    return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::factory.cb"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "unresolved"
    assert rel.target_reference == "self.target"


def test_super_in_nested_function_stays_refused(tmp_path: Path) -> None:
    """Zero-argument super() raises at runtime inside a function nested in
    a method (no __class__ cell) -- the capture must never turn it into a
    resolved call, even with real, fully-resolved inherits supplied (the
    configuration where the static_super fallback WOULD fire for the same
    call written directly in the method body)."""
    from syntax_tree_refurbished.app.analysis.python_inheritance_extractor import (
        extract_inheritance_relations,
    )

    source = """
class Base:
    def load(self):
        return 1


class C(Base):
    def m(self):
        def cb():
            return super().load()
        return cb
"""
    full = tmp_path / "pkg" / "mod.py"
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(source, encoding="utf-8")
    snapshot = LocalRepoReader(Settings(environment="test")).build_snapshot(
        run_id=RUN_ID, repo_path=str(tmp_path)
    )
    job = AnalysisJob(job_id=f"job:{uuid.uuid4().hex}", run_id=RUN_ID, repository_path=str(tmp_path))
    job.snapshot = snapshot
    reader = SourceReader(job)
    symbols = list(parse_python_symbols(reader, reader.get_file("pkg/mod.py"), RUN_ID))
    inherits = extract_inheritance_relations(job, symbols, file_paths=["pkg/mod.py"])
    relations = list(
        extract_call_relations(job, symbols, file_paths=["pkg/mod.py"], inherits=inherits)
    )
    by_qn = {s.qualified_name: s for s in symbols}
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    from_cb = _relations_from(relations, cb_id)
    assert from_cb, "the super().load() call site should still be emitted (unresolved)"
    for rel in from_cb:
        assert rel.resolution_status == "unresolved"
        assert rel.resolution_basis is None


# ---------------------------------------------------------------------------
# Boundaries that must not move
# ---------------------------------------------------------------------------


def test_annotated_parameter_is_never_a_binding(tmp_path: Path) -> None:
    """The R1-TRC-2 boundary: `retry_state.get_fn_name()` with
    `retry_state: RetryCallState` must stay unresolved -- an annotation is
    a claim, not an observed binding."""
    files = {
        "pkg/__init__.py": """
class RetryCallState:
    def get_fn_name(self):
        return "x"
""",
        "pkg/before.py": """
from pkg import RetryCallState


def before_log(logger):
    def log_it(retry_state: "RetryCallState"):
        fn_name = retry_state.get_fn_name()
    return log_it
""",
    }
    relations, by_qn = _extract(tmp_path, files)
    log_it_id = by_qn["python:pkg/before.py::before_log.log_it"].id
    rel = _single(relations, log_it_id)
    assert rel.resolution_status == "unresolved"
    assert rel.target_entity_id is None
    assert rel.target_reference == "retry_state.get_fn_name"


def test_ordinary_method_self_calls_unchanged(tmp_path: Path) -> None:
    source = """
class C:
    def target(self):
        return 1

    def m(self):
        return self.target()
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    m_id = by_qn["python:pkg/mod.py::C.m"].id
    target_id = by_qn["python:pkg/mod.py::C.target"].id
    rel = _single(relations, m_id)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == target_id
    assert rel.resolution_basis is None


def test_ordinary_nested_function_calls_unchanged(tmp_path: Path) -> None:
    """A nested function calling a plain module-level function (no `self`
    involved) resolves exactly as before."""
    source = """
def helper():
    return 1


class C:
    def m(self):
        def cb():
            return helper()
        return cb
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    cb_id = by_qn["python:pkg/mod.py::C.m.cb"].id
    helper_id = by_qn["python:pkg/mod.py::helper"].id
    rel = _single(relations, cb_id)
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == helper_id


def test_false_claim_analog_wrapped_f_does_not_call_unreferenced_method(tmp_path: Path) -> None:
    """R1-FDC-5 analog: the capture resolves only the calls that exist --
    it must never conjure a relation to a method the nested function does
    not reference."""
    source = """
class BaseRetrying:
    def copy(self):
        return self

    def _run_retry(self):
        return 2

    def wraps(self, f):
        def wrapped_f(*args, **kw):
            copy = self.copy()
            return copy
        return wrapped_f
"""
    relations, by_qn = _extract(tmp_path, {"pkg/mod.py": source})
    wrapped_f_id = by_qn["python:pkg/mod.py::BaseRetrying.wraps.wrapped_f"].id
    run_retry_id = by_qn["python:pkg/mod.py::BaseRetrying._run_retry"].id
    from_wrapped = _relations_from(relations, wrapped_f_id)
    assert len(from_wrapped) == 1
    assert all(r.target_entity_id != run_retry_id for r in from_wrapped)
