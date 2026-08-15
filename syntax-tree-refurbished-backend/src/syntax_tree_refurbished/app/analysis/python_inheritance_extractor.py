"""Deterministic Python AST inheritance-relation extractor.

Walks the Python files of a real, on-disk analysis snapshot (an
``AnalysisJob`` with its ``RepoSnapshot`` already attached -- see
``app.analysis.analysis_job.AnalysisJob``) and emits one
``ObservedProgramRelation`` (``relation_kind="inherits"``) per declared base
class of every ``class`` statement found -- one relation *per base*, so a
class with multiple inheritance yields multiple independent relations, each
with its own resolution verdict.

Entity identity: real ``ParsedSymbol.id`` only, never a fabricated string
-------------------------------------------------------------------------
An earlier version of this extractor was self-contained: it never touched
``app.parsing``/``core.models.parsed_symbol`` and instead minted its own
deterministic dotted-qualified-name strings as entity ids, falling back to
the literal base expression as a "best-effort placeholder" id when a base
couldn't be resolved. The shared ``ObservedProgramRelation`` contract
(``core.models.program_relation``) no longer allows that: ``target_entity_id``
may *only* ever be a real, run-scoped ``ParsedSymbol.id`` for a symbol that
was actually parsed in this run; a placeholder/textual guess belongs in the
separate ``target_reference`` field instead (see that module's docstring for
the full rationale). ``source_entity_id`` is likewise always expected to be a
real ``ParsedSymbol.id``.

To satisfy that, this extractor (as of round 3) accepts an already-parsed
``symbols: Iterable[ParsedSymbol]`` collection from its caller -- the same
``ParsedSymbol`` set the real pipeline's own parsing stage already produced
(see ``app.parsing.parse_supported_files.parse_supported_files``) -- and
indexes it into a lookup table keyed by ``qualified_name`` (the same
``f"{language}:{path}::{dotted_name}"`` convention
``app.parsing.python_symbol_parser`` uses -- see its ``_symbol`` helper),
restricted to ``kind == "class"`` symbols since those are the only ones
this extractor ever needs to point at. This extractor never calls
``parse_python_symbols``/``parse_supported_files`` itself -- there is
exactly one authoritative parse per run, performed once by the pipeline's
parsing stage, not one per extractor. This extractor's own AST walk -- which still
does the actual *inheritance-specific* work the generic symbol parser does
not do at all (same-file nested-class resolution, import-tracing to other
analyzed modules, distinguishing resolvable from external bases) -- computes
that exact same qualified-name string for a base class it believes it has
traced with certainty, and looks it up in the real table:

- If a real ``ParsedSymbol`` is found: ``resolution_status="resolved"`` and
  ``target_entity_id`` is that symbol's real, run-scoped ``.id``.
- If this extractor's own resolution logic and the real parser's symbol
  table *disagree* -- i.e. the base looks resolvable by this extractor's
  own AST bookkeeping, but no matching real ``ParsedSymbol`` exists for it
  (this can legitimately happen: this extractor is intentionally a little
  more permissive than ``parse_python_symbols`` about *where* it will still
  look for a class definition, e.g. inside a module-level ``try``/``if``
  block -- see "Known extractor/parser scope mismatch" below) -- this
  extractor never fabricates an id to paper over the gap. It falls back to
  ``resolution_status="unresolved"`` with ``target_reference`` set to the
  literal base expression, exactly as it would for a genuinely external
  base.
- Otherwise (external/third-party/stdlib name, dynamic expression, or an
  ambiguous/unresolvable reference), ``resolution_status="unresolved"``,
  ``target_entity_id`` is left unset, and ``target_reference`` carries the
  literal base expression exactly as written in source.

The same real-symbol lookup is used for ``source_entity_id`` (the id of the
subclass itself). If, for the same reasons as above, no real ``ParsedSymbol``
exists for the class currently being examined, this extractor cannot emit
*any* relation for that class's bases at all (there would be no valid,
non-fabricated ``source_entity_id`` to attach them to) -- those bases are
silently skipped rather than emitted with a fabricated source. This is a
narrow, intentional precision trade-off: no relation is *wrong*, some are
simply not emitted. See "Known extractor/parser scope mismatch" below for
the one situation where this actually arises in practice.

Cross-run logical identity, "for free"
---------------------------------------
This module does not add or compute any cross-run identity of its own, and
does not need to: because ``source_entity_id``/``target_entity_id`` are now
always real, run-scoped ``ParsedSymbol.id`` values (never self-invented
strings), a caller that wants to recognize "the same logical inheritance
relation" across two separate analysis runs of unchanged code can already do
so by resolving each id back to its ``ParsedSymbol`` (within that run's own
symbol store) and comparing ``ParsedSymbol.stable_entity_key``
(``core.models.parsed_symbol.compute_stable_entity_key``) -- exactly the
pattern documented in ``core.models.program_relation``'s "Cross-run logical
identity" section. This extractor satisfies that property purely by *not*
inventing its own ids; it does not need to carry a stable key itself.

Resolution semantics
---------------------
For each declared base of a class statement:

- If the base name/dotted-path can be traced, unambiguously, to a class
  defined in the analyzed source tree (either the same file, or another
  analyzed file reached via a traceable ``import``/``from ... import``
  statement -- including simple relative imports) *and* a matching real
  ``ParsedSymbol`` exists for that class, the relation is
  ``resolution_status="resolved"``.
- Otherwise the relation is ``resolution_status="unresolved"`` with
  ``target_reference`` set to the literal base expression as written (e.g.
  ``"SomeExternalLib.Base"``). This extractor never fabricates a
  plausible-looking id for a base it did not actually verify against a real
  parsed symbol.
- This extractor never emits ``resolution_status="partial"``: within the
  scope of static same-tree name/import resolution, a base is either
  unambiguously traced to a real analyzed symbol (resolved) or it isn't
  (unresolved). A future, heuristic-based resolution strategy (e.g.
  guessing across ambiguous star-imports) could legitimately populate
  "partial", but that is out of scope here.

What is out of scope
---------------------
- Star imports (``from module import *``): bases introduced this way are
  left unresolved, since tracing them would require guessing.
- ``sys.path`` manipulation, namespace packages, or any dynamic import
  machinery.
- Metaclasses / keyword arguments in the class statement (e.g.
  ``class Foo(Base, metaclass=Meta)``) -- only positional bases are
  inheritance relations; ``metaclass=`` and other keywords are ignored.
- Nested-class bases reached through a *value* other than a plain
  dotted-name chain (e.g. ``class Foo(some_factory()):``) -- always
  unresolved, with the unparsed source expression as ``target_reference``.
- Classes nested inside a function/method body are not tracked by this
  extractor's own class registry (import resolution does not reach into
  function-local scope), even though ``parse_python_symbols`` itself *does*
  descend into function bodies when building its generic symbol table.
  Neither the classes themselves (as inheritance *sources*) nor references
  to them (as inheritance *targets*) are considered by this extractor; this
  matches the previous (pre-adaptation) version's scope.

Known extractor/parser scope mismatch (module-level control-flow blocks)
--------------------------------------------------------------------------
This extractor's own class registry, for its own resolution purposes, still
does a "best-effort" descent into module/class-level ``if``/``try``/``with``
blocks (a common pattern: ``try/except ImportError`` fallback class
definitions, ``TYPE_CHECKING`` guards) -- inherited unchanged from the
previous version. ``parse_python_symbols`` does **not** do this: it only
walks direct ``ClassDef``/``FunctionDef`` statements in a body, so a class
defined inside such a block never gets a real ``ParsedSymbol`` at all. The
practical effect:

- If such a class is referenced as a *base* elsewhere, this extractor's own
  bookkeeping "finds" it, but the real-symbol lookup then fails -- so, per
  the fallback rule above, the relation is correctly reported as
  ``unresolved`` (with the literal name as ``target_reference``) rather than
  fabricating an id for a symbol the rest of the system has no record of.
- If such a class is itself a *source* of a relation (i.e. it has bases of
  its own), this extractor cannot find a real ``ParsedSymbol`` for it either,
  so those relations are skipped entirely (see above).

This is a deliberate precision trade-off, not an oversight: it is strictly
better for this extractor to under-report (skip/mark-unresolved) than to
invent an entity id that no other part of the system can actually resolve.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Iterable, Sequence

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation

EXTRACTOR_NAME = "python_inheritance_extractor"
EXTRACTOR_VERSION = "0.2.0"


@dataclass(frozen=True)
class _ImportedName:
    """A name bound in a file's module scope by an import statement, which
    -- if it points at another analyzed module -- can be used to resolve a
    base class reference back to that module's class registry."""

    target_module_path: str
    # None means "the whole module was imported" (import module [as alias]);
    # a string means "one attribute of that module was imported"
    # (from module import attr [as alias]).
    imported_attr: str | None


def extract_inheritance_relations(
    job: AnalysisJob,
    symbols: Iterable[ParsedSymbol],
    *,
    file_paths: Sequence[str] | None = None,
) -> tuple[ObservedProgramRelation, ...]:
    """Extract ``inherits`` relations from every Python file in ``job``'s
    attached ``RepoSnapshot``, using the caller-supplied ``symbols`` -- the
    same ``ParsedSymbol`` collection the real pipeline's own parsing stage
    already produced -- as the sole source of real entity ids. This
    extractor never calls ``parse_python_symbols`` itself; see module
    docstring.

    ``file_paths``, if given, restricts analysis to that set of
    repository-relative paths (same filtering semantics as
    ``python_call_extractor.extract_call_relations``); if omitted, every
    readable Python file in ``job.snapshot`` is analyzed.

    Deterministic: running this twice against the same ``job``/``symbols``
    (i.e. the same on-disk source, same snapshot, same run id, same parsed
    symbols) yields identical output, including ``ObservedProgramRelation.id``
    values -- this extractor's own AST walk is a pure function of file
    content and ``run_id``. Files with a ``SyntaxError`` are skipped
    (produce no relations for that file) rather than raising, matching the
    tolerant-parsing posture already used elsewhere in this codebase's
    parsers.
    """
    if not job.snapshot:
        return ()
    run_id = job.run_id
    reader = SourceReader(job)
    python_files = tuple(
        file for file in job.snapshot.files if file.readable and file.language == "python"
    )
    if file_paths is not None:
        allowed = set(file_paths)
        python_files = tuple(file for file in python_files if file.path in allowed)
    if not python_files:
        return ()

    # Real ParsedSymbol table (the only source of truth for entity ids),
    # keyed by qualified_name, restricted to class-kind symbols since those
    # are the only ones this extractor ever needs to point at. Sourced
    # directly from the caller-supplied `symbols` -- never re-parsed here.
    class_symbols_by_qualified_name: dict[str, ParsedSymbol] = {
        symbol.qualified_name: symbol for symbol in symbols if symbol.kind == "class"
    }

    # This extractor's own AST parse of the same file contents, needed for
    # inheritance-specific bookkeeping (class nesting, import tracing) that
    # the generic symbol parser does not perform.
    trees: dict[str, ast.Module] = {}
    for file in python_files:
        try:
            content = str(reader.read_file_content(file.path)["content"])
        except SourceReadError:
            continue
        try:
            trees[file.path] = ast.parse(content, filename=file.path)
        except SyntaxError:
            continue

    module_path_by_dotted: dict[str, str] = {
        _dotted_module_path(file.path): file.path for file in python_files if file.path in trees
    }

    # Pass 1: index every class defined in every analyzed file, by file path.
    # class_registry[file.path] -> {simple_class_name (top-level only): qualified_name}
    # all_classes[file.path] -> {dotted_local_name (any nesting): qualified_name}
    # `qualified_name` here always matches parse_python_symbols's own
    # convention, so it can be looked up directly in
    # class_symbols_by_qualified_name.
    class_registry: dict[str, dict[str, str]] = {}
    all_classes: dict[str, dict[str, str]] = {}
    for file in python_files:
        tree = trees.get(file.path)
        if tree is None:
            continue
        top_level: dict[str, str] = {}
        everywhere: dict[str, str] = {}
        _index_classes(tree.body, file.path, file.language, "", top_level, everywhere)
        class_registry[file.path] = top_level
        all_classes[file.path] = everywhere

    # Pass 2: index import bindings per file (module-scope only -- this
    # extractor does not track imports performed inside functions/classes).
    imports_by_file: dict[str, dict[str, _ImportedName]] = {}
    for file in python_files:
        tree = trees.get(file.path)
        if tree is None:
            continue
        imports_by_file[file.path] = _index_imports(tree.body, _dotted_module_path(file.path))

    # Pass 3: walk every class statement again, this time resolving bases.
    relations: list[ObservedProgramRelation] = []
    for file in python_files:
        tree = trees.get(file.path)
        if tree is None:
            continue
        relations.extend(
            _walk_for_relations(
                tree.body,
                file_path=file.path,
                language=file.language,
                run_id=run_id,
                class_registry=class_registry,
                local_classes=all_classes.get(file.path, {}),
                local_imports=imports_by_file.get(file.path, {}),
                module_path_by_dotted=module_path_by_dotted,
                class_symbols=class_symbols_by_qualified_name,
                parent_qualname="",
            )
        )
    return tuple(relations)


def _symbol_qualified_name(language: str, path: str, dotted_name: str) -> str:
    """Reproduce ``python_symbol_parser._symbol``'s ``qualified_name``
    convention exactly, so a name this extractor traces can be looked up
    directly against the real ``ParsedSymbol`` table."""
    return f"{language}:{path}::{dotted_name}"


def _dotted_module_path(path: str) -> str:
    """Best-effort dotted module path for a repo-relative file path, used
    only to resolve ``import``/``from ... import`` statements to other
    analyzed files. Duplicated here (rather than imported from elsewhere in
    the codebase) to keep this extractor's dependency surface minimal and
    stable -- it is a small, self-contained convention."""
    stem = path[:-3] if path.endswith(".py") else path
    if stem == "__init__":
        return ""
    if stem.endswith("/__init__"):
        stem = stem[: -len("/__init__")]
    return stem.replace("/", ".")


def _index_classes(
    body: list[ast.stmt],
    file_path: str,
    language: str,
    parent_qualname: str,
    top_level: dict[str, str],
    everywhere: dict[str, str],
) -> None:
    for node in body:
        if isinstance(node, ast.ClassDef):
            qualname = f"{parent_qualname}.{node.name}" if parent_qualname else node.name
            symbol_qualified_name = _symbol_qualified_name(language, file_path, qualname)
            everywhere[qualname] = symbol_qualified_name
            if not parent_qualname:
                top_level[node.name] = symbol_qualified_name
            _index_classes(node.body, file_path, language, qualname, top_level, everywhere)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Classes nested inside functions are not reachable via static
            # import resolution the way module/class-nested ones are; skip
            # descending into function bodies for indexing purposes.
            continue
        elif isinstance(node, (ast.If, ast.Try, ast.With)):
            # Best-effort: still index classes defined inside simple
            # control-flow blocks at module/class level (common pattern:
            # try/except ImportError fallback classes, TYPE_CHECKING
            # guards). Note: parse_python_symbols does NOT do this, so a
            # class found only via this branch will not have a matching
            # real ParsedSymbol -- see the module docstring's "Known
            # extractor/parser scope mismatch" section. That is handled
            # gracefully at resolution time (falls back to unresolved), not
            # here.
            for attr in ("body", "orelse", "finalbody"):
                sub = getattr(node, attr, None)
                if sub:
                    _index_classes(sub, file_path, language, parent_qualname, top_level, everywhere)


def _index_imports(body: list[ast.stmt], module_path: str) -> dict[str, _ImportedName]:
    bindings: dict[str, _ImportedName] = {}
    for node in body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.asname:
                    bindings[alias.asname] = _ImportedName(target_module_path=alias.name, imported_attr=None)
                else:
                    # `import a.b.c` binds the top-level name `a` in scope,
                    # but the full dotted path `a.b.c` is also a valid
                    # attribute chain reaching the submodule directly (per
                    # Python's submodule-import semantics) -- register both
                    # so `a.b.c.SomeClass` resolves without needing to also
                    # know `a`'s own class registry.
                    top_name = alias.name.split(".")[0]
                    bindings[top_name] = _ImportedName(target_module_path=top_name, imported_attr=None)
                    bindings[alias.name] = _ImportedName(target_module_path=alias.name, imported_attr=None)
        elif isinstance(node, ast.ImportFrom):
            target_module = _resolve_relative_module(node, module_path)
            if target_module is None:
                continue
            for alias in node.names:
                if alias.name == "*":
                    continue
                bound_name = alias.asname or alias.name
                bindings[bound_name] = _ImportedName(
                    target_module_path=target_module, imported_attr=alias.name
                )
    return bindings


def _resolve_relative_module(node: ast.ImportFrom, current_module_path: str) -> str | None:
    """Resolve ``from X import Y`` (X possibly relative) to an absolute
    dotted module path, using ``current_module_path`` as the importing
    module's own dotted path. Returns None if the module clause is entirely
    absent and there is no way to anchor it (shouldn't normally happen)."""
    if node.level == 0:
        return node.module
    # Relative import: level 1 == "current package", level 2 == "parent
    # package", etc. current_module_path's *package* is itself minus its
    # last dotted component (i.e. treat current_module_path as a module
    # inside that package, mirroring standard package-relative semantics).
    package_parts = current_module_path.split(".")[:-1]
    # level=1 anchors at package_parts as-is; each extra level strips one
    # more trailing component.
    strip = node.level - 1
    if strip > 0:
        package_parts = package_parts[:-strip] if strip <= len(package_parts) else []
    base = ".".join(package_parts)
    if node.module:
        return f"{base}.{node.module}" if base else node.module
    return base or None


def _walk_for_relations(
    body: list[ast.stmt],
    *,
    file_path: str,
    language: str,
    run_id: str,
    class_registry: dict[str, dict[str, str]],
    local_classes: dict[str, str],
    local_imports: dict[str, _ImportedName],
    module_path_by_dotted: dict[str, str],
    class_symbols: dict[str, ParsedSymbol],
    parent_qualname: str,
) -> list[ObservedProgramRelation]:
    relations: list[ObservedProgramRelation] = []
    for node in body:
        if isinstance(node, ast.ClassDef):
            qualname = f"{parent_qualname}.{node.name}" if parent_qualname else node.name
            source_qualified_name = _symbol_qualified_name(language, file_path, qualname)
            source_symbol = class_symbols.get(source_qualified_name)
            if source_symbol is not None:
                for base in node.bases:
                    relations.append(
                        _relation_for_base(
                            base,
                            source_entity_id=source_symbol.id,
                            file_path=file_path,
                            run_id=run_id,
                            class_registry=class_registry,
                            local_classes=local_classes,
                            local_imports=local_imports,
                            module_path_by_dotted=module_path_by_dotted,
                            class_symbols=class_symbols,
                            enclosing_qualname=parent_qualname,
                        )
                    )
            # else: no real ParsedSymbol for this class (see module
            # docstring's "Known extractor/parser scope mismatch") -- skip
            # its bases entirely rather than fabricate a source_entity_id.
            relations.extend(
                _walk_for_relations(
                    node.body,
                    file_path=file_path,
                    language=language,
                    run_id=run_id,
                    class_registry=class_registry,
                    local_classes=local_classes,
                    local_imports=local_imports,
                    module_path_by_dotted=module_path_by_dotted,
                    class_symbols=class_symbols,
                    parent_qualname=qualname,
                )
            )
        elif isinstance(node, (ast.If, ast.Try, ast.With)):
            for attr in ("body", "orelse", "finalbody"):
                sub = getattr(node, attr, None)
                if sub:
                    relations.extend(
                        _walk_for_relations(
                            sub,
                            file_path=file_path,
                            language=language,
                            run_id=run_id,
                            class_registry=class_registry,
                            local_classes=local_classes,
                            local_imports=local_imports,
                            module_path_by_dotted=module_path_by_dotted,
                            class_symbols=class_symbols,
                            parent_qualname=parent_qualname,
                        )
                    )
    return relations


def _relation_for_base(
    base: ast.expr,
    *,
    source_entity_id: str,
    file_path: str,
    run_id: str,
    class_registry: dict[str, dict[str, str]],
    local_classes: dict[str, str],
    local_imports: dict[str, _ImportedName],
    module_path_by_dotted: dict[str, str],
    class_symbols: dict[str, ParsedSymbol],
    enclosing_qualname: str,
) -> ObservedProgramRelation:
    target_symbol = _resolve_base(
        base,
        class_registry=class_registry,
        local_classes=local_classes,
        local_imports=local_imports,
        module_path_by_dotted=module_path_by_dotted,
        class_symbols=class_symbols,
        enclosing_qualname=enclosing_qualname,
    )
    start_line = getattr(base, "lineno", None)
    end_line = getattr(base, "end_lineno", start_line)

    if target_symbol is not None:
        return ObservedProgramRelation.create(
            run_id=run_id,
            relation_kind="inherits",
            source_entity_id=source_entity_id,
            target_entity_id=target_symbol.id,
            extractor_name=EXTRACTOR_NAME,
            extractor_version=EXTRACTOR_VERSION,
            resolution_status="resolved",
            span_path=file_path,
            span_start_line=start_line,
            span_end_line=end_line,
        )

    # No real analyzed entity to point at -- either genuinely external, or
    # this extractor's own bookkeeping traced a class that has no matching
    # real ParsedSymbol (see module docstring). Either way: never fabricate
    # an id, carry the literal expression as target_reference instead.
    literal_expression = _unparse(base)
    return ObservedProgramRelation.create(
        run_id=run_id,
        relation_kind="inherits",
        source_entity_id=source_entity_id,
        target_reference=literal_expression,
        extractor_name=EXTRACTOR_NAME,
        extractor_version=EXTRACTOR_VERSION,
        resolution_status="unresolved",
        span_path=file_path,
        span_start_line=start_line,
        span_end_line=end_line,
    )


def _resolve_base(
    base: ast.expr,
    *,
    class_registry: dict[str, dict[str, str]],
    local_classes: dict[str, str],
    local_imports: dict[str, _ImportedName],
    module_path_by_dotted: dict[str, str],
    class_symbols: dict[str, ParsedSymbol],
    enclosing_qualname: str,
) -> ParsedSymbol | None:
    """Try to resolve a base-class expression to a real ``ParsedSymbol`` for
    a class defined somewhere in the analyzed source tree. Returns None if
    it cannot be traced with certainty to a real, analyzed symbol."""
    if isinstance(base, ast.Name):
        return _resolve_simple_name(
            base.id,
            class_registry=class_registry,
            local_classes=local_classes,
            local_imports=local_imports,
            module_path_by_dotted=module_path_by_dotted,
            class_symbols=class_symbols,
            enclosing_qualname=enclosing_qualname,
        )
    if isinstance(base, ast.Attribute):
        dotted = _attribute_to_dotted(base)
        if dotted is None:
            return None
        return _resolve_dotted_attribute(
            dotted,
            local_imports=local_imports,
            class_registry=class_registry,
            module_path_by_dotted=module_path_by_dotted,
            class_symbols=class_symbols,
        )
    return None


def _resolve_simple_name(
    name: str,
    *,
    class_registry: dict[str, dict[str, str]],
    local_classes: dict[str, str],
    local_imports: dict[str, _ImportedName],
    module_path_by_dotted: dict[str, str],
    class_symbols: dict[str, ParsedSymbol],
    enclosing_qualname: str,
) -> ParsedSymbol | None:
    # 1. Same-file resolution: prefer a class reachable by walking outward
    #    from the enclosing scope (innermost match wins), matching normal
    #    Python name-resolution intuition for nested classes referencing
    #    siblings/ancestors' siblings.
    scope_parts = enclosing_qualname.split(".") if enclosing_qualname else []
    for depth in range(len(scope_parts), -1, -1):
        prefix = ".".join(scope_parts[:depth])
        candidate_key = f"{prefix}.{name}" if prefix else name
        qualified_name = local_classes.get(candidate_key)
        if qualified_name is not None:
            return class_symbols.get(qualified_name)

    # 2. Cross-file resolution via an import binding in this file's module
    #    scope: `from other_module import Name` or `import other_module` +
    #    bare `Name` would not apply here (bare Name only applies to
    #    from-imports; `import module` binds `module`, not its members).
    imported = local_imports.get(name)
    if imported is not None and imported.imported_attr is not None:
        target_path = module_path_by_dotted.get(imported.target_module_path)
        if target_path is not None:
            qualified_name = class_registry.get(target_path, {}).get(imported.imported_attr)
            if qualified_name is not None:
                return class_symbols.get(qualified_name)
    return None


def _resolve_dotted_attribute(
    dotted: str,
    *,
    local_imports: dict[str, _ImportedName],
    class_registry: dict[str, dict[str, str]],
    module_path_by_dotted: dict[str, str],
    class_symbols: dict[str, ParsedSymbol],
) -> ParsedSymbol | None:
    # Only handle the common shape `module_alias.ClassName` (single
    # attribute hop off an `import module [as alias]` binding). Deeper
    # chains (e.g. `pkg.sub.ClassName` off `import pkg.sub`) are matched by
    # comparing the full leading dotted path against import bindings too.
    parts = dotted.split(".")
    for split_at in range(1, len(parts)):
        head = ".".join(parts[:split_at])
        tail = parts[split_at:]
        if len(tail) != 1:
            continue
        imported = local_imports.get(head)
        if imported is not None and imported.imported_attr is None:
            target_path = module_path_by_dotted.get(imported.target_module_path)
            if target_path is not None:
                qualified_name = class_registry.get(target_path, {}).get(tail[0])
                if qualified_name is not None:
                    return class_symbols.get(qualified_name)
    return None


def _attribute_to_dotted(node: ast.expr) -> str | None:
    parts: list[str] = []
    current: ast.expr = node
    while isinstance(current, ast.Attribute):
        parts.append(current.attr)
        current = current.value
    if isinstance(current, ast.Name):
        parts.append(current.id)
        return ".".join(reversed(parts))
    return None


def _unparse(node: ast.expr) -> str:
    try:
        return ast.unparse(node)
    except Exception:
        return "<unresolvable base expression>"
