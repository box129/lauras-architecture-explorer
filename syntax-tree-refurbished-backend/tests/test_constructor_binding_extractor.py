"""Tests for the Python constructor-attribute-binding extractor
(app.analysis.constructor_binding_extractor).

These tests exercise the *real* parsing pipeline end to end, following the
same proven pattern as ``tests/test_stable_entity_identity.py`` /
``tests/test_python_inheritance_extractor.py``: fixture source is written
to real files under ``tmp_path``, a real ``RepoSnapshot`` is built via
``LocalRepoReader``, that is attached to a real ``AnalysisJob``, and real
``ParsedSymbol`` records are produced once via ``parse_python_symbols`` and
handed to the extractor alongside ``job`` -- never hand-built
``ParsedSymbol`` instances.

Covers: the canonical resolved case, an unannotated parameter, an
annotation that never resolves (external/stdlib name), a call on the RHS,
a different parameter/local on the RHS, multiple constructor-injected
attributes in one ``__init__`` resolving independently, an assignment to
``self.<attr>`` outside ``__init__`` (not a binding), and determinism.
"""

from __future__ import annotations

from pathlib import Path
import uuid

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.constructor_binding_extractor import (
    EXTRACTOR_NAME,
    EXTRACTOR_VERSION,
    UNANNOTATED_TYPE_REFERENCE,
    extract_constructor_attribute_bindings,
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
    stage."""
    assert job.snapshot is not None
    reader = SourceReader(job)
    symbols: list[ParsedSymbol] = []
    for file in job.snapshot.files:
        if file.readable and file.language == "python":
            symbols.extend(parse_python_symbols(reader, file, job.run_id))
    return symbols


def _class_symbol(job: AnalysisJob, rel_path: str, class_name: str) -> ParsedSymbol:
    """Independently re-derive the real ParsedSymbol for a top-level class,
    for use as the expected value in assertions."""
    reader = SourceReader(job)
    file = reader.get_file(rel_path)
    symbols = parse_python_symbols(reader, file, job.run_id)
    matches = [s for s in symbols if s.kind == "class" and s.name == class_name]
    assert len(matches) == 1, f"expected exactly one {class_name} symbol, got {matches}"
    return matches[0]


def _only(bindings, owning_class_entity_id=None):
    if owning_class_entity_id is not None:
        bindings = [b for b in bindings if b.owning_class_entity_id == owning_class_entity_id]
    assert len(bindings) == 1, bindings
    return bindings[0]


# ---------------------------------------------------------------------------
# Canonical resolved case: annotated parameter, bare assignment, type
# resolves to a real same-tree class via a `from ... import`.
# ---------------------------------------------------------------------------


def test_canonical_resolved_binding_via_import(tmp_path: Path) -> None:
    service_source = """
class OrderService:
    def create_order(self):
        pass
"""
    controller_source = """
from pkg.services import OrderService


class OrderController:
    def __init__(self, order_service: OrderService) -> None:
        self.order_service = order_service
"""
    write(tmp_path / "pkg" / "services.py", service_source)
    write(tmp_path / "pkg" / "controller.py", controller_source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)

    controller_symbol = _class_symbol(job, "pkg/controller.py", "OrderController")
    service_symbol = _class_symbol(job, "pkg/services.py", "OrderService")

    binding = _only(bindings)
    assert binding.owning_class_entity_id == controller_symbol.id
    assert binding.attribute_name == "order_service"
    assert binding.parameter_name == "order_service"
    assert binding.declared_type_reference == "OrderService"
    assert binding.resolution_status == "resolved"
    assert binding.target_type_entity_id == service_symbol.id
    assert binding.run_id == job.run_id

    # Spans point at real source lines.
    assert binding.annotation_span_path == "pkg/controller.py"
    assert binding.annotation_span_start_line == binding.annotation_span_end_line == 6
    assert binding.assignment_span_path == "pkg/controller.py"
    assert binding.assignment_span_start_line == binding.assignment_span_end_line == 7

    # Module-level constants sanity check.
    assert EXTRACTOR_NAME == "python_constructor_binding_extractor"
    assert EXTRACTOR_VERSION


# ---------------------------------------------------------------------------
# Unannotated parameter -> unresolved, target_type_entity_id=None.
# ---------------------------------------------------------------------------


def test_unannotated_parameter_is_unresolved(tmp_path: Path) -> None:
    source = """
class Widget:
    def __init__(self, thing):
        self.thing = thing
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    binding = _only(bindings, owning_class_entity_id=widget_symbol.id)
    assert binding.resolution_status == "unresolved"
    assert binding.target_type_entity_id is None
    assert binding.declared_type_reference == UNANNOTATED_TYPE_REFERENCE
    # No annotation span at all (no annotation to point at).
    assert binding.annotation_span_path is None
    assert binding.annotation_span_start_line is None
    assert binding.annotation_span_end_line is None
    # But the assignment span is still real.
    assert binding.assignment_span_path == "pkg/mod.py"


# ---------------------------------------------------------------------------
# Annotation references an external/unresolvable type -> unresolved.
# ---------------------------------------------------------------------------


def test_external_unresolvable_annotation_is_unresolved(tmp_path: Path) -> None:
    source = """
import datetime


class Widget:
    def __init__(self, created_at: datetime.datetime):
        self.created_at = created_at
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    binding = _only(bindings, owning_class_entity_id=widget_symbol.id)
    assert binding.resolution_status == "unresolved"
    assert binding.target_type_entity_id is None
    assert binding.declared_type_reference == "datetime.datetime"
    # Annotation span IS present here (there is a real annotation, it just
    # doesn't resolve).
    assert binding.annotation_span_path == "pkg/mod.py"


def test_complex_typing_construct_annotation_is_unresolved(tmp_path: Path) -> None:
    """Optional[...] / generics are never parsed into -- always unresolved,
    never a guess, per the module docstring's explicit out-of-scope list."""
    source = """
from typing import Optional


class RealDependency:
    pass


class Widget:
    def __init__(self, dep: Optional[RealDependency]):
        self.dep = dep
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    binding = _only(bindings, owning_class_entity_id=widget_symbol.id)
    assert binding.resolution_status == "unresolved"
    assert binding.target_type_entity_id is None
    assert binding.declared_type_reference == "Optional[RealDependency]"


def test_string_forward_reference_annotation_is_unresolved(tmp_path: Path) -> None:
    source = """
class RealDependency:
    pass


class Widget:
    def __init__(self, dep: "RealDependency"):
        self.dep = dep
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    binding = _only(bindings, owning_class_entity_id=widget_symbol.id)
    assert binding.resolution_status == "unresolved"
    assert binding.target_type_entity_id is None


# ---------------------------------------------------------------------------
# RHS is a call -> no binding produced at all.
# ---------------------------------------------------------------------------


def test_rhs_call_produces_no_binding(tmp_path: Path) -> None:
    source = """
class Thing:
    pass


def make_thing() -> "Thing":
    return Thing()


class Widget:
    def __init__(self, thing: Thing):
        self.thing = make_thing()
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    widget_bindings = [b for b in bindings if b.owning_class_entity_id == widget_symbol.id]
    assert widget_bindings == []


# ---------------------------------------------------------------------------
# RHS is a different parameter/local -> no binding produced.
# ---------------------------------------------------------------------------


def test_rhs_different_parameter_produces_no_binding(tmp_path: Path) -> None:
    source = """
class Thing:
    pass


class Widget:
    def __init__(self, thing: Thing, other: Thing):
        self.thing = other
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    widget_bindings = [b for b in bindings if b.owning_class_entity_id == widget_symbol.id]
    assert widget_bindings == []


def test_rhs_local_variable_produces_no_binding(tmp_path: Path) -> None:
    source = """
class Thing:
    pass


class Widget:
    def __init__(self, thing: Thing):
        local = thing
        self.thing = local
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    widget_bindings = [b for b in bindings if b.owning_class_entity_id == widget_symbol.id]
    assert widget_bindings == []


def test_rhs_boolexpr_produces_no_binding(tmp_path: Path) -> None:
    source = """
class Thing:
    pass


class Widget:
    def __init__(self, thing: Thing = None):
        self.thing = thing or Thing()
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    widget_bindings = [b for b in bindings if b.owning_class_entity_id == widget_symbol.id]
    assert widget_bindings == []


def test_tuple_assignment_produces_no_binding(tmp_path: Path) -> None:
    source = """
class Thing:
    pass


class Widget:
    def __init__(self, thing: Thing, other: Thing):
        self.thing, self.other = thing, other
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    widget_bindings = [b for b in bindings if b.owning_class_entity_id == widget_symbol.id]
    assert widget_bindings == []


def test_augmented_assignment_produces_no_binding(tmp_path: Path) -> None:
    source = """
class Widget:
    def __init__(self, count: int):
        self.count = 0
        self.count += count
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    # `self.count = 0` (Constant RHS, not a bare Name) and
    # `self.count += count` (AugAssign, not a plain Assign) are both out of
    # scope -- neither produces a binding.
    widget_bindings = [b for b in bindings if b.owning_class_entity_id == widget_symbol.id]
    assert widget_bindings == []


# ---------------------------------------------------------------------------
# Multiple constructor-injected attributes in one __init__.
# ---------------------------------------------------------------------------


def test_multiple_attributes_resolved_independently(tmp_path: Path) -> None:
    source = """
class OrderService:
    pass


class Widget:
    def __init__(
        self,
        order_service: OrderService,
        label: str,
        legacy_dep,
    ) -> None:
        self.order_service = order_service
        self.label = label
        self.legacy_dep = legacy_dep
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")
    order_service_symbol = _class_symbol(job, "pkg/mod.py", "OrderService")

    widget_bindings = {b.attribute_name: b for b in bindings if b.owning_class_entity_id == widget_symbol.id}
    assert set(widget_bindings) == {"order_service", "label", "legacy_dep"}

    assert widget_bindings["order_service"].resolution_status == "resolved"
    assert widget_bindings["order_service"].target_type_entity_id == order_service_symbol.id

    assert widget_bindings["label"].resolution_status == "unresolved"
    assert widget_bindings["label"].target_type_entity_id is None
    assert widget_bindings["label"].declared_type_reference == "str"

    assert widget_bindings["legacy_dep"].resolution_status == "unresolved"
    assert widget_bindings["legacy_dep"].target_type_entity_id is None
    assert widget_bindings["legacy_dep"].declared_type_reference == UNANNOTATED_TYPE_REFERENCE


# ---------------------------------------------------------------------------
# Assignment to self.<attr> outside __init__ -> not a binding at all.
# ---------------------------------------------------------------------------


def test_assignment_outside_init_is_not_a_binding(tmp_path: Path) -> None:
    source = """
class OrderService:
    pass


class Widget:
    def __init__(self) -> None:
        pass

    def configure(self, order_service: OrderService) -> None:
        self.order_service = order_service
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    widget_symbol = _class_symbol(job, "pkg/mod.py", "Widget")

    widget_bindings = [b for b in bindings if b.owning_class_entity_id == widget_symbol.id]
    assert widget_bindings == []


# ---------------------------------------------------------------------------
# Class with no real ParsedSymbol (extractor/parser scope mismatch) is
# skipped entirely rather than fabricating an owning_class_entity_id.
# ---------------------------------------------------------------------------


def test_class_defined_in_try_block_is_skipped_as_owner(tmp_path: Path) -> None:
    source = """
class OrderService:
    pass


try:
    class Widget:
        def __init__(self, order_service: OrderService) -> None:
            self.order_service = order_service
except ImportError:
    pass
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)

    bindings = extract_constructor_attribute_bindings(job, symbols)
    assert bindings == ()


# ---------------------------------------------------------------------------
# Determinism.
# ---------------------------------------------------------------------------


def test_extraction_is_deterministic_across_repeated_runs(tmp_path: Path) -> None:
    source = """
class OrderService:
    pass


class OrderController:
    def __init__(self, order_service: OrderService, label: str, legacy) -> None:
        self.order_service = order_service
        self.label = label
        self.legacy = legacy
"""
    write(tmp_path / "pkg" / "mod.py", source)
    run_id = _new_run_id()

    job_a = _job_for(tmp_path, run_id)
    job_b = _job_for(tmp_path, run_id)

    first = extract_constructor_attribute_bindings(job_a, _symbols_for(job_a))
    second = extract_constructor_attribute_bindings(job_b, _symbols_for(job_b))

    assert [b.id for b in first] == [b.id for b in second]
    assert len(first) == len(second) == 3
    assert len({b.id for b in first}) == 3  # every binding id is distinct
    assert first == second


# ---------------------------------------------------------------------------
# No hidden re-parse: entity ids come only from the injected symbols.
# ---------------------------------------------------------------------------


def test_emitted_entity_ids_come_only_from_the_injected_symbols(tmp_path: Path) -> None:
    source = """
class OrderService:
    pass


class OrderController:
    def __init__(self, order_service: OrderService) -> None:
        self.order_service = order_service
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    symbols = _symbols_for(job)
    symbol_ids = {s.id for s in symbols}
    assert symbol_ids

    bindings = extract_constructor_attribute_bindings(job, symbols)
    assert len(bindings) == 1
    binding = bindings[0]
    assert binding.owning_class_entity_id in symbol_ids
    assert binding.target_type_entity_id in symbol_ids


def test_pruned_symbol_set_forces_unresolved_proving_no_hidden_reparse(tmp_path: Path) -> None:
    source = """
class OrderService:
    pass


class OrderController:
    def __init__(self, order_service: OrderService) -> None:
        self.order_service = order_service
"""
    write(tmp_path / "pkg" / "mod.py", source)
    job = _job_for(tmp_path, _new_run_id())
    full_symbols = _symbols_for(job)
    service_symbol = next(s for s in full_symbols if s.kind == "class" and s.name == "OrderService")

    baseline = extract_constructor_attribute_bindings(job, full_symbols)
    assert _only(baseline).resolution_status == "resolved"

    pruned_symbols = [s for s in full_symbols if s.id != service_symbol.id]
    bindings = extract_constructor_attribute_bindings(job, pruned_symbols)

    for binding in bindings:
        assert binding.target_type_entity_id != service_symbol.id

    binding = _only(bindings)
    assert binding.resolution_status == "unresolved"
    assert binding.target_type_entity_id is None
    assert binding.declared_type_reference == "OrderService"
