"""Tests for the guarded static ``super()`` resolution
(``app.analysis.python_call_extractor``'s ``static_super`` fallback --
intervention C from the evidence-coverage diagnosis).

Bounded scope: a zero-argument ``super().method()`` call site resolves only
when the calling class's declared inheritance chain -- walked through real,
already-resolved ``inherits`` relations from the real (post-intervention-A)
``extract_inheritance_relations`` -- is strictly single-base and fully
resolved at every step looked past, and exactly one (nearest) ancestor
defines the method. Everything else refuses: ``super(C, self)``, multiple
inheritance, unresolved/external bases, no unique definer, nested
functions, and callers that never pass ``inherits`` at all.

Fixtures follow the exact same real-parse-then-real-symbols pattern as
``test_python_call_extractor_d4_inheritance.py`` -- every ``inherits``
relation consumed here is the real ``extract_inheritance_relations`` output
for the same job/symbols, never hand-invented.

The abstention tests at the bottom mirror the frozen false claims from the
real-repository evaluation corpus (a ``super().__init__()`` chain where a
false claim asserts the grandparent or an unrelated method as the target):
resolution must land on the *nearest* definer only, so those false claims
keep abstaining.
"""

from __future__ import annotations

from pathlib import Path
import uuid

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.python_call_extractor import extract_call_relations
from syntax_tree_refurbished.app.analysis.python_inheritance_extractor import (
    extract_inheritance_relations,
)
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.app.parsing.python_symbol_parser import parse_python_symbols
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.infra.filesystem.local_repo_reader import LocalRepoReader

RUN_ID = "run-static-super-1"


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


def _extract_with_real_inherits(
    tmp_path: Path, files: dict[str, str], run_id: str = RUN_ID, pass_inherits: bool = True
) -> tuple[list[ObservedProgramRelation], dict[str, ParsedSymbol]]:
    """Real symbols -> real extract_inheritance_relations -> real
    extract_call_relations(..., inherits=<that real output>)."""
    _write(tmp_path, files)
    job = _job_for(tmp_path, run_id)
    reader = SourceReader(job)
    symbols: list[ParsedSymbol] = []
    for rel_path in files:
        symbols.extend(parse_python_symbols(reader, reader.get_file(rel_path), job.run_id))
    by_qn = {s.qualified_name: s for s in symbols}
    inherits = extract_inheritance_relations(job, symbols, file_paths=list(files.keys()))
    kwargs = {"inherits": inherits} if pass_inherits else {}
    call_relations = list(
        extract_call_relations(job, symbols, file_paths=list(files.keys()), **kwargs)
    )
    return call_relations, by_qn


def _super_relation(
    relations: list[ObservedProgramRelation], source_id: str, reference: str
) -> ObservedProgramRelation:
    matches = [
        r
        for r in relations
        if r.source_entity_id == source_id
        and (r.target_reference == reference or r.resolution_basis == "static_super")
    ]
    assert len(matches) == 1, matches
    return matches[0]


# ---------------------------------------------------------------------------
# Positive: single-hop chain, nearest ancestor defines the method
# ---------------------------------------------------------------------------


def test_super_method_resolves_to_direct_base_definition(tmp_path: Path) -> None:
    source = """
class Base:
    def load(self):
        return "base"


class Child(Base):
    def load(self):
        return super().load()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/mod.py": source})
    child_load_id = by_qn["python:pkg/mod.py::Child.load"].id
    base_load_id = by_qn["python:pkg/mod.py::Base.load"].id

    rel = _super_relation(relations, child_load_id, "super().load")
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == base_load_id
    assert rel.target_reference is None
    assert rel.resolution_basis == "static_super"
    assert rel.confidence is None
    # Provenance: the walked inherits relation's own span (the
    # `class Child(Base)` base declaration) is carried as supporting
    # evidence.
    assert len(rel.supporting_resolution_spans) == 1
    assert rel.supporting_resolution_spans[0].path == "pkg/mod.py"


def test_super_init_resolves_along_generic_single_base_chain(tmp_path: Path) -> None:
    """The audited real-repository shape: a super().__init__() chain whose
    every base declaration is generic-parameterized (`Base[T]`), spanning
    files -- resolution walks the (intervention-A-resolved) inherits
    relations to the NEAREST defining ancestor only."""
    files = {
        "pkg/extension.py": """
from typing import Generic, TypeVar

T = TypeVar("T")


class ExtensionManager(Generic[T]):
    def __init__(self, namespace):
        self.namespace = namespace
""",
        "pkg/named.py": """
from typing import TypeVar

from pkg.extension import ExtensionManager

T = TypeVar("T")


class NamedExtensionManager(ExtensionManager[T]):
    def __init__(self, namespace, names):
        self.names = names
        super().__init__(namespace)
""",
        "pkg/hook.py": """
from typing import TypeVar

from pkg.named import NamedExtensionManager

T = TypeVar("T")


class HookManager(NamedExtensionManager[T]):
    def __init__(self, namespace, name):
        super().__init__(namespace, [name])
""",
    }
    relations, by_qn = _extract_with_real_inherits(tmp_path, files)
    hook_init_id = by_qn["python:pkg/hook.py::HookManager.__init__"].id
    named_init_id = by_qn["python:pkg/named.py::NamedExtensionManager.__init__"].id
    ext_init_id = by_qn["python:pkg/extension.py::ExtensionManager.__init__"].id

    # Hop 1: HookManager.__init__ -> NamedExtensionManager.__init__ (the
    # nearest definer -- NEVER the grandparent, which is the frozen false
    # claim R3-FDC-6's shape).
    hop1 = _super_relation(relations, hook_init_id, "super().__init__")
    assert hop1.resolution_status == "resolved"
    assert hop1.target_entity_id == named_init_id
    assert hop1.resolution_basis == "static_super"

    # Hop 2: NamedExtensionManager.__init__ -> ExtensionManager.__init__.
    # ExtensionManager's own unresolved external base (Generic[T]) does not
    # block this: the walk stops AT the definer and never looks past it.
    hop2 = _super_relation(relations, named_init_id, "super().__init__")
    assert hop2.resolution_status == "resolved"
    assert hop2.target_entity_id == ext_init_id

    # And no relation ever connects HookManager.__init__ straight to the
    # grandparent's __init__ (false-claim abstention preserved).
    assert not [
        r for r in relations if r.source_entity_id == hook_init_id and r.target_entity_id == ext_init_id
    ]


def test_super_skips_non_defining_ancestor_to_nearest_definer(tmp_path: Path) -> None:
    """A middle ancestor that does NOT define the method is looked past
    (its own single resolved base permitting), landing on the grandparent
    -- with every walked inherits hop carried as supporting spans."""
    source = """
class Grand:
    def setup(self):
        return "grand"


class Middle(Grand):
    pass


class Leaf(Middle):
    def setup(self):
        return super().setup()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/mod.py": source})
    leaf_setup_id = by_qn["python:pkg/mod.py::Leaf.setup"].id
    grand_setup_id = by_qn["python:pkg/mod.py::Grand.setup"].id

    rel = _super_relation(relations, leaf_setup_id, "super().setup")
    assert rel.resolution_status == "resolved"
    assert rel.target_entity_id == grand_setup_id
    assert len(rel.supporting_resolution_spans) == 2  # both walked hops


# ---------------------------------------------------------------------------
# Refusals: every guard, each proven by an unresolved outcome
# ---------------------------------------------------------------------------


def _assert_unresolved(relations: list[ObservedProgramRelation], source_id: str, reference: str) -> None:
    matches = [r for r in relations if r.source_entity_id == source_id and r.target_reference == reference]
    assert len(matches) == 1, matches
    assert matches[0].resolution_status == "unresolved"
    assert matches[0].target_entity_id is None
    assert matches[0].resolution_basis is None


def test_super_refuses_multiple_inheritance(tmp_path: Path) -> None:
    source = """
class A:
    def go(self):
        return "a"


class B:
    def other(self):
        return "b"


class Child(A, B):
    def go(self):
        return super().go()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/mod.py": source})
    _assert_unresolved(relations, by_qn["python:pkg/mod.py::Child.go"].id, "super().go")


def test_super_refuses_unresolved_external_base_on_walk(tmp_path: Path) -> None:
    """The calling class's own single base is external/unresolved: the
    method could live (or be reordered) there -- refuse."""
    source = """
import external_pkg


class Child(external_pkg.Base):
    def go(self):
        return super().go()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/mod.py": source})
    _assert_unresolved(relations, by_qn["python:pkg/mod.py::Child.go"].id, "super().go")


def test_super_refuses_when_middle_ancestor_has_unresolved_base(tmp_path: Path) -> None:
    """An ancestor that must be looked PAST has an unresolved base -- that
    base could define the method at exactly that point in the MRO."""
    source = """
import external_pkg


class Grand:
    def setup(self):
        return "grand"


class Middle(Grand, external_pkg.Mixin):
    pass


class Leaf(Middle):
    def setup(self):
        return super().setup()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/mod.py": source})
    _assert_unresolved(relations, by_qn["python:pkg/mod.py::Leaf.setup"].id, "super().setup")


def test_super_refuses_when_no_ancestor_defines_the_method(tmp_path: Path) -> None:
    source = """
class Base:
    pass


class Child(Base):
    def go(self):
        return super().go()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/mod.py": source})
    _assert_unresolved(relations, by_qn["python:pkg/mod.py::Child.go"].id, "super().go")


def test_two_argument_super_form_stays_unresolved(tmp_path: Path) -> None:
    """`super(Child, self).go()` can re-anchor the lookup arbitrarily --
    never resolved by the zero-argument-only guard."""
    source = """
class Base:
    def go(self):
        return "base"


class Child(Base):
    def go(self):
        return super(Child, self).go()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/mod.py": source})
    _assert_unresolved(
        relations, by_qn["python:pkg/mod.py::Child.go"].id, "super(Child, self).go"
    )


def test_super_in_nested_function_stays_unresolved(tmp_path: Path) -> None:
    """Nested functions get current_class=None (existing behavior) -- the
    static_super fallback never fires there."""
    source = """
class Base:
    def go(self):
        return "base"


class Child(Base):
    def go(self):
        def inner():
            return super().go()
        return inner()
"""
    relations, by_qn = _extract_with_real_inherits(tmp_path, {"pkg/mod.py": source})
    inner_id = by_qn["python:pkg/mod.py::Child.go.inner"].id
    _assert_unresolved(relations, inner_id, "super().go")


def test_super_without_inherits_supplied_stays_unresolved(tmp_path: Path) -> None:
    """Callers that never pass `inherits` see byte-identical behavior to
    before this fallback existed."""
    source = """
class Base:
    def go(self):
        return "base"


class Child(Base):
    def go(self):
        return super().go()
"""
    relations, by_qn = _extract_with_real_inherits(
        tmp_path, {"pkg/mod.py": source}, pass_inherits=False
    )
    _assert_unresolved(relations, by_qn["python:pkg/mod.py::Child.go"].id, "super().go")


def test_false_reachability_hop_after_super_resolution_still_mismatches(tmp_path: Path) -> None:
    """Mirror of frozen false claim R3-FRC-2's shape: with hop 1
    (super().__init__) now resolved, the resolved target is the direct
    parent's __init__ -- a false claim asserting the next hop reaches an
    unrelated method finds no relation connecting them."""
    files = {
        "pkg/extension.py": """
class ExtensionManager:
    def __init__(self, namespace):
        self.namespace = namespace

    def map(self, func):
        return func
""",
        "pkg/named.py": """
from pkg.extension import ExtensionManager


class NamedExtensionManager(ExtensionManager):
    def __init__(self, namespace, names):
        self.names = names
        super().__init__(namespace)
""",
    }
    relations, by_qn = _extract_with_real_inherits(tmp_path, files)
    named_init_id = by_qn["python:pkg/named.py::NamedExtensionManager.__init__"].id
    map_id = by_qn["python:pkg/extension.py::ExtensionManager.map"].id

    # The resolved super() edge exists and targets __init__...
    hop = _super_relation(relations, named_init_id, "super().__init__")
    assert hop.target_entity_id == by_qn["python:pkg/extension.py::ExtensionManager.__init__"].id
    # ...and nothing connects the __init__ chain to `map` (the false
    # claim's asserted continuation) -- abstention preserved.
    assert not [r for r in relations if r.source_entity_id == named_init_id and r.target_entity_id == map_id]
