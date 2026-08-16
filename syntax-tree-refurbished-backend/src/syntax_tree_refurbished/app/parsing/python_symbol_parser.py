"""Python symbol parser using the standard library AST."""

from __future__ import annotations

import ast
import hashlib

from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.core.models.file_record import FileRecord
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol, compute_stable_entity_key


def parse_python_symbols(reader: SourceReader, file: FileRecord, run_id: str) -> tuple[ParsedSymbol, ...]:
    content = str(reader.read_file_content(file.path)["content"])
    try:
        tree = ast.parse(content, filename=file.path)
    except SyntaxError:
        return ()

    symbols: list[ParsedSymbol] = []
    module_parent: str | None = None

    def visit_body(
        body: list[ast.stmt],
        parent_name: str = "",
        parent_id: str | None = None,
        parent_is_class: bool = False,
    ) -> None:
        for node in body:
            if isinstance(node, ast.ClassDef):
                symbol = _symbol(
                    reader=reader,
                    file=file,
                    run_id=run_id,
                    name=node.name,
                    kind="class",
                    start_line=node.lineno,
                    end_line=getattr(node, "end_lineno", node.lineno),
                    signature=f"class {node.name}",
                    exported=not node.name.startswith("_"),
                    async_=False,
                    parent_name=parent_name,
                    parent_id=parent_id,
                )
                symbols.append(symbol)
                visit_body(node.body, _join_name(parent_name, node.name), symbol.id, parent_is_class=True)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # "method" only when the immediate lexical parent is a class
                # body; a def nested inside another def (or at module scope)
                # is a plain function regardless of how deep it is nested.
                kind = "method" if parent_is_class else "function"
                signature = _function_signature(node)
                symbol = _symbol(
                    reader=reader,
                    file=file,
                    run_id=run_id,
                    name=node.name,
                    kind=kind,
                    start_line=node.lineno,
                    end_line=getattr(node, "end_lineno", node.lineno),
                    signature=signature,
                    exported=(not parent_name and not node.name.startswith("_")),
                    async_=isinstance(node, ast.AsyncFunctionDef),
                    parent_name=parent_name,
                    parent_id=parent_id or module_parent,
                )
                symbols.append(symbol)
                visit_body(node.body, _join_name(parent_name, node.name), symbol.id, parent_is_class=False)

    visit_body(tree.body)
    return tuple(symbols)


def _symbol(
    *,
    reader: SourceReader,
    file: FileRecord,
    run_id: str,
    name: str,
    kind: str,
    start_line: int,
    end_line: int,
    signature: str,
    exported: bool,
    async_: bool,
    parent_name: str,
    parent_id: str | None,
) -> ParsedSymbol:
    region = reader.read_range(file.path, start_line, end_line)
    qualified_name = f"{file.language}:{file.path}::{_join_name(parent_name, name)}"
    symbol_id = _stable_symbol_id(run_id, qualified_name, start_line, end_line)
    stable_entity_key = compute_stable_entity_key(
        path=file.path,
        qualified_name=qualified_name,
        kind=kind,
        signature=signature,
    )
    return ParsedSymbol(
        id=symbol_id,
        run_id=run_id,
        path=file.path,
        language=file.language,
        name=name,
        qualified_name=qualified_name,
        kind=kind,  # type: ignore[arg-type]
        start_line=start_line,
        end_line=end_line,
        source_region_id=region.id,
        signature=signature,
        exported=exported,
        async_=async_,
        parent_symbol_id=parent_id,
        stable_entity_key=stable_entity_key,
    )


def _function_signature(node: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    args = [arg.arg for arg in node.args.args]
    prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
    return f"{prefix} {node.name}({', '.join(args)})"


def _join_name(parent: str, name: str) -> str:
    return f"{parent}.{name}" if parent else name


def _stable_symbol_id(run_id: str, qualified_name: str, start_line: int, end_line: int) -> str:
    raw = "|".join([run_id, qualified_name, str(start_line), str(end_line)])
    return f"symbol:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"

