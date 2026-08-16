"""Tests for the nested-definition symbol-kind taxonomy
(``app.parsing.python_symbol_parser`` -- intervention D, correction 1).

The rule under test: a def is ``kind="method"`` if and only if its
IMMEDIATE lexical parent is a class body; a def whose immediate parent is
another function (or the module itself) is ``kind="function"``, no matter
how deeply it is nested or what the outer scopes are. The old behavior
classified any def with a non-empty parent_name as a method, which
mislabeled every function nested inside another def.
"""

from __future__ import annotations

from pathlib import Path
import uuid

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.app.parsing.python_symbol_parser import parse_python_symbols
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.infra.filesystem.local_repo_reader import LocalRepoReader

RUN_ID = "run-nested-defs-1"


def _parse(tmp_path: Path, source: str) -> dict[str, ParsedSymbol]:
    full = tmp_path / "pkg" / "mod.py"
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(source, encoding="utf-8")
    snapshot = LocalRepoReader(Settings(environment="test")).build_snapshot(
        run_id=RUN_ID, repo_path=str(tmp_path)
    )
    job = AnalysisJob(job_id=f"job:{uuid.uuid4().hex}", run_id=RUN_ID, repository_path=str(tmp_path))
    job.snapshot = snapshot
    reader = SourceReader(job)
    symbols = parse_python_symbols(reader, reader.get_file("pkg/mod.py"), RUN_ID)
    return {s.qualified_name: s for s in symbols}


def test_def_nested_in_method_is_function_not_method(tmp_path: Path) -> None:
    by_qn = _parse(
        tmp_path,
        "class C:\n"
        "    def outer(self):\n"
        "        def inner():\n"
        "            return 1\n"
        "        return inner\n",
    )
    assert by_qn["python:pkg/mod.py::C"].kind == "class"
    assert by_qn["python:pkg/mod.py::C.outer"].kind == "method"
    assert by_qn["python:pkg/mod.py::C.outer.inner"].kind == "function"


def test_def_nested_in_module_level_function_is_function(tmp_path: Path) -> None:
    by_qn = _parse(
        tmp_path,
        "def factory():\n"
        "    def product():\n"
        "        return 1\n"
        "    return product\n",
    )
    assert by_qn["python:pkg/mod.py::factory"].kind == "function"
    assert by_qn["python:pkg/mod.py::factory.product"].kind == "function"


def test_deeply_nested_defs_are_all_functions(tmp_path: Path) -> None:
    by_qn = _parse(
        tmp_path,
        "class C:\n"
        "    def m(self):\n"
        "        def a():\n"
        "            def b():\n"
        "                return 1\n"
        "            return b\n"
        "        return a\n",
    )
    assert by_qn["python:pkg/mod.py::C.m"].kind == "method"
    assert by_qn["python:pkg/mod.py::C.m.a"].kind == "function"
    assert by_qn["python:pkg/mod.py::C.m.a.b"].kind == "function"


def test_method_of_class_nested_in_function_is_method(tmp_path: Path) -> None:
    """The rule is about the IMMEDIATE parent: a def directly inside a
    class body is a method even when that class is itself declared inside
    a function."""
    by_qn = _parse(
        tmp_path,
        "def make_class():\n"
        "    class Local:\n"
        "        def m(self):\n"
        "            return 1\n"
        "    return Local\n",
    )
    assert by_qn["python:pkg/mod.py::make_class"].kind == "function"
    assert by_qn["python:pkg/mod.py::make_class.Local"].kind == "class"
    assert by_qn["python:pkg/mod.py::make_class.Local.m"].kind == "method"


def test_method_of_nested_class_is_method(tmp_path: Path) -> None:
    by_qn = _parse(
        tmp_path,
        "class Outer:\n"
        "    class Inner:\n"
        "        def m(self):\n"
        "            return 1\n",
    )
    assert by_qn["python:pkg/mod.py::Outer.Inner"].kind == "class"
    assert by_qn["python:pkg/mod.py::Outer.Inner.m"].kind == "method"


def test_ordinary_methods_and_functions_unchanged(tmp_path: Path) -> None:
    by_qn = _parse(
        tmp_path,
        "class C:\n"
        "    def m(self):\n"
        "        return 1\n"
        "    async def am(self):\n"
        "        return 2\n"
        "def f():\n"
        "    return 3\n"
        "async def af():\n"
        "    return 4\n",
    )
    assert by_qn["python:pkg/mod.py::C.m"].kind == "method"
    assert by_qn["python:pkg/mod.py::C.am"].kind == "method"
    assert by_qn["python:pkg/mod.py::C.am"].async_ is True
    assert by_qn["python:pkg/mod.py::f"].kind == "function"
    assert by_qn["python:pkg/mod.py::af"].kind == "function"


def test_async_def_nested_in_method_is_function(tmp_path: Path) -> None:
    by_qn = _parse(
        tmp_path,
        "class C:\n"
        "    def m(self):\n"
        "        async def inner():\n"
        "            return 1\n"
        "        return inner\n",
    )
    inner = by_qn["python:pkg/mod.py::C.m.inner"]
    assert inner.kind == "function"
    assert inner.async_ is True
