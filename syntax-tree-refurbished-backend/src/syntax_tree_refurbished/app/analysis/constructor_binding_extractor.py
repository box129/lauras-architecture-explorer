"""Deterministic Python AST constructor-attribute-binding extractor.

Produces ``ConstructorAttributeBinding`` (``core.models.constructor_binding``)
instances from Python source, via pure static AST analysis -- no type
inference, no import execution, no bytecode, no LLM/embeddings/network calls.

This is a *supporting* raw-fact extractor for call resolution, not a call
extractor itself (see ``core.models.constructor_binding``'s module
docstring for the full rationale and the ``ObservedProgramRelation``
hand-off it exists to feed). It recognizes exactly one conservative,
constructor-injected-dependency idiom, in every class's ``__init__`` only:

    def __init__(self, <parameter>: <Type>, ...):
        ...
        self.<attribute> = <parameter>
        ...

--------------------------------------------------------------------------
Entity identity: real, run-scoped ``ParsedSymbol.id`` only
--------------------------------------------------------------------------
Exactly the same discipline already established by
``python_call_extractor``/``python_inheritance_extractor``: this module
never mints its own entity ids and never re-parses. The caller supplies an
already-snapshotted ``job: AnalysisJob`` and the already-produced
``symbols: Iterable[ParsedSymbol]`` (the same collection the real parsing
stage already produced -- see ``app.parsing.parse_supported_files``). Those
are indexed once into ``class_symbols_by_qualified_name``, keyed by the real
parser's own ``qualified_name`` convention
(``f"{language}:{path}::{dotted_name}"``, see
``python_symbol_parser.py``'s ``_symbol``/``_join_name`` helpers).

This module's own AST walk (needed for constructor-binding-specific
bookkeeping the generic symbol parser does not do at all: parameter
annotations, assignment shape, import tracing for the annotation's type)
computes the same qualified-name string for a class it is examining and
looks it up in that real table:

- If no real ``ParsedSymbol`` exists for the class whose ``__init__`` is
  being examined (the same "extractor/parser scope mismatch" edge case the
  inheritance extractor documents -- e.g. a class defined inside a
  module-level ``try``/``if`` block, which this module's own bookkeeping
  still notices but the real parser does not), this module never fabricates
  an ``owning_class_entity_id``: bindings for that class are skipped
  entirely.
- If the parameter's annotation resolves, through the same import-tracing
  logic already used by ``python_inheritance_extractor`` for base classes,
  to a real analyzed class ``ParsedSymbol``, the binding is
  ``resolution_status="resolved"`` with a real ``target_type_entity_id``.
- Otherwise ``resolution_status="unresolved"``, ``target_type_entity_id``
  is absent, and ``declared_type_reference`` carries the literal annotation
  text (or a fixed placeholder -- see "Unannotated parameters" below -- when
  there is no annotation at all).

This module never emits ``resolution_status="partial"`` -- that status is
reserved by the contract for a future, more permissive resolution
technique; within the scope of this first version, a parameter's
annotation is either unambiguously traced to a real analyzed class or it
isn't.

--------------------------------------------------------------------------
The recognized pattern, exactly
--------------------------------------------------------------------------
For every ``class`` statement in every analyzed Python file, only its own
directly-declared ``__init__`` method (a plain, synchronous
``ast.FunctionDef`` named ``__init__`` appearing directly in the class
body -- never a base class's ``__init__``, never one found only inside a
nested ``if``/``try``/``with`` block at class-body level, never
``async def __init__``) is examined. Only statements that are (a) directly
in ``__init__``'s own body or (b) nested only inside ``if``/``try``/``with``
blocks *within* ``__init__`` (never inside a nested ``def``/``class``, so
a closure or locally-defined class inside ``__init__`` can never contribute
a binding) are considered.

A binding is produced for a statement if, and only if, ALL of the
following hold:

1. The statement is a plain ``ast.Assign`` with exactly one target.
2. That target is ``ast.Attribute(value=ast.Name(id="self"), attr=<name>)``
   -- exactly ``self.<attribute>``, nothing more complex (no
   ``self.x.y = ...``, no tuple/multiple targets, no augmented assignment,
   no annotated assignment).
3. The assignment's value is *exactly* ``ast.Name(id=<name>)`` -- the
   *same* ``<name>`` as the attribute in (2) (i.e. the recognized idiom is
   narrowly ``self.<name> = <name>``, never ``self.<attribute> =
   <a differently-named parameter>``) -- and that name is one of
   ``__init__``'s own parameters (positional-or-keyword, positional-only,
   or keyword-only -- never ``*args``/``**kwargs``). Anything else on the
   right-hand side (a call, an attribute/method chain, a boolean/binary
   expression, a *different* parameter, a local variable, a literal, ...)
   means NO binding is produced for that statement at all -- not
   "unresolved", nothing. This is a deliberate precision trade-off: a
   constructor that binds an attribute from a differently-named parameter
   (``self.svc = order_service``) is real DI too, but distinguishing that
   intentional case from an accidental/unrelated same-shape assignment
   without also risking name-based guessing is out of scope for this first,
   deliberately narrow version -- see ``core.models.constructor_binding``'s
   "no name-based guessing" rule, which this mirrors defensively even
   though it is phrased there in terms of resolving *types*, not attribute
   names.

Only after both (2) and (3) match does annotation resolution decide
``resolution_status``:

- No annotation on the matched parameter (``ast.arg.annotation is None``):
  ``resolution_status="unresolved"``, ``target_type_entity_id=None``. See
  "Unannotated parameters" below for the ``declared_type_reference`` value
  used in this case.
- Annotation is a simple name (``OrderService``) or dotted name
  (``some_module.OrderService``) that resolves, via the same import-tracing
  logic ``python_inheritance_extractor`` already applies to base classes
  (same-file class registry + module-scope import bindings, including
  simple relative imports), to a real analyzed class ``ParsedSymbol``:
  ``resolution_status="resolved"``, ``target_type_entity_id`` set to that
  symbol's real ``.id``, ``declared_type_reference`` set to the annotation's
  literal source text.
- Annotation is a simple/dotted name that does *not* resolve to a real
  analyzed class (external/third-party/stdlib type, unresolved import,
  ambiguous match): ``resolution_status="unresolved"``,
  ``target_type_entity_id=None``, ``declared_type_reference`` set to the
  annotation's literal source text.
- Annotation is anything more complex than a simple/dotted name
  (``Optional[OrderService]``, ``OrderService | None``, a string-quoted
  forward reference, a generic, ...): never parsed into.
  ``resolution_status="unresolved"``, ``target_type_entity_id=None``,
  ``declared_type_reference`` set to the annotation's literal source text
  (via ``ast.unparse``) -- this module does not attempt to guess a class
  out of complex typing syntax, it only records what was written.

Never any name-based guessing: a binding is only ever "resolved" because
the parameter's own type annotation traced, through actual import
resolution, to a real class ``ParsedSymbol`` -- never because
``attribute_name``/``parameter_name`` happens to look like a class name.

--------------------------------------------------------------------------
Unannotated parameters
--------------------------------------------------------------------------
``ConstructorAttributeBinding`` requires a non-empty ``declared_type_reference``
even for an ``unresolved`` binding (see its ``__post_init__``), but there is
no literal annotation text at all when the parameter carries none. This
module uses the fixed placeholder ``"<unannotated>"`` (module constant
``UNANNOTATED_TYPE_REFERENCE``) in that case -- never an empty string, never
a guess at a type. See "Known gap" below: the shared contract's own module
docstring's "Scope, deliberately narrow" section lists "an unannotated
parameter (no declared type to resolve against)" alongside things for which
"a binding ... should simply not be produced", which reads as in tension
with ``BindingResolutionStatus``'s own docstring one section below it
(explicitly: "'unresolved': ... the parameter has no annotation ..."). This
extractor follows the latter (and the task brief that commissioned it, which
explicitly requires an unresolved binding, not silence, for this case) --
an unannotated-but-otherwise-exactly-matching assignment still produces a
binding, just an unresolved one.

--------------------------------------------------------------------------
Explicitly out of scope (no binding produced at all, not a degraded one)
--------------------------------------------------------------------------
- Factories/builder functions (``self.x = make_x()``).
- Service locators/registries (``self.x = container.get(X)``).
- Any right-hand side that is not exactly a bare reference to the
  *same-named* ``__init__`` parameter as the attribute being assigned (a
  differently-named parameter, a local variable, a literal, a
  boolean/binary expression, ``self.x = self.x or Default()``, etc.).
- Tuple/multiple assignment, augmented assignment, annotated assignment
  with a non-trivial value (this module only ever matches plain
  ``ast.Assign`` in the first place, so ``ast.AnnAssign``/``ast.AugAssign``
  are structurally never considered).
- Dynamic rebinding of ``self.<attribute>`` anywhere outside ``__init__``:
  structurally impossible here, since this module only ever looks at
  ``__init__``'s own body (plus ``if``/``try``/``with`` nested directly
  inside it) in the first place -- other methods are never visited by this
  extractor at all.
- ``*args``/``**kwargs`` constructor parameters.
- Star imports, ``sys.path`` manipulation, and any dynamic import
  machinery, exactly as already documented by
  ``python_inheritance_extractor``.

--------------------------------------------------------------------------
Cross-run logical identity
--------------------------------------------------------------------------
As with the other two extractors, no separate stable-identity field is
needed here: ``owning_class_entity_id``/``target_type_entity_id`` are
always real ``ParsedSymbol.id`` values, so cross-run correlation is always
available "for free" via ``ParsedSymbol.stable_entity_key`` lookup in the
caller's own symbol store.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Iterable, Sequence

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.core.models.constructor_binding import ConstructorAttributeBinding
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol

EXTRACTOR_NAME = "python_constructor_binding_extractor"
EXTRACTOR_VERSION = "0.1.0"

UNANNOTATED_TYPE_REFERENCE = "<unannotated>"
"""Placeholder ``declared_type_reference`` used when the matched
constructor parameter has no annotation at all -- see the module
docstring's "Unannotated parameters" section."""


@dataclass(frozen=True)
class _ImportedName:
    """A name bound in a file's module scope by an import statement, which
    -- if it points at another analyzed module -- can be used to resolve a
    type annotation reference back to that module's class registry.
    Identical shape/semantics to ``python_inheritance_extractor``'s helper
    of the same name; duplicated here (not imported) to keep this module's
    dependency surface minimal and independently stable, matching that
    module's own stated rationale for duplicating ``_dotted_module_path``."""

    target_module_path: str
    imported_attr: str | None


def extract_constructor_attribute_bindings(
    job: AnalysisJob,
    symbols: Iterable[ParsedSymbol],
    *,
    file_paths: Sequence[str] | None = None,
) -> tuple[ConstructorAttributeBinding, ...]:
    """Extract ``ConstructorAttributeBinding`` facts from every Python file
    in ``job``'s attached ``RepoSnapshot``, using the caller-supplied
    ``symbols`` -- the same ``ParsedSymbol`` collection the real pipeline's
    own parsing stage already produced -- as the sole source of real entity
    ids. This extractor never calls ``parse_python_symbols`` itself; see
    module docstring.

    ``file_paths``, if given, restricts analysis to that set of
    repository-relative paths (same filtering semantics as
    ``python_call_extractor.extract_call_relations`` /
    ``python_inheritance_extractor.extract_inheritance_relations``); if
    omitted, every readable Python file in ``job.snapshot`` is analyzed.

    Deterministic: running this twice against the same ``job``/``symbols``
    (i.e. the same on-disk source, same snapshot, same run id, same parsed
    symbols) yields identical output, including
    ``ConstructorAttributeBinding.id`` values. Files with a ``SyntaxError``
    are skipped (produce no bindings for that file) rather than raising,
    matching the tolerant-parsing posture already used elsewhere in this
    codebase's parsers/extractors.
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
    # keyed by qualified_name, restricted to class-kind symbols. Sourced
    # directly from the caller-supplied `symbols` -- never re-parsed here.
    class_symbols_by_qualified_name: dict[str, ParsedSymbol] = {
        symbol.qualified_name: symbol for symbol in symbols if symbol.kind == "class"
    }

    # This extractor's own AST parse of the same file contents, needed for
    # constructor-binding-specific bookkeeping (parameter annotations,
    # assignment shape, import tracing) that the generic symbol parser does
    # not perform.
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

    # Pass 1: index every class defined in every analyzed file, by file path
    # (mirrors python_inheritance_extractor's class_registry/all_classes).
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

    # Pass 2: index import bindings per file (module-scope only).
    imports_by_file: dict[str, dict[str, _ImportedName]] = {}
    for file in python_files:
        tree = trees.get(file.path)
        if tree is None:
            continue
        imports_by_file[file.path] = _index_imports(tree.body, _dotted_module_path(file.path))

    # Pass 3: walk every class statement again, this time examining its
    # own __init__ (if any) for the recognized binding pattern.
    bindings: list[ConstructorAttributeBinding] = []
    for file in python_files:
        tree = trees.get(file.path)
        if tree is None:
            continue
        bindings.extend(
            _walk_for_bindings(
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
    return tuple(bindings)


def _symbol_qualified_name(language: str, path: str, dotted_name: str) -> str:
    """Reproduce ``python_symbol_parser._symbol``'s ``qualified_name``
    convention exactly, so a name this extractor traces can be looked up
    directly against the real ``ParsedSymbol`` table."""
    return f"{language}:{path}::{dotted_name}"


def _dotted_module_path(path: str) -> str:
    """Best-effort dotted module path for a repo-relative file path, used
    only to resolve ``import``/``from ... import`` statements to other
    analyzed files. Identical to ``python_inheritance_extractor``'s helper
    of the same name; duplicated rather than imported, matching that
    module's own stated rationale."""
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
            # control-flow blocks at module/class level (mirrors
            # python_inheritance_extractor exactly, including its
            # extractor/parser scope-mismatch consequence -- see that
            # module's docstring).
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
    dotted module path. Identical logic to
    ``python_inheritance_extractor._resolve_relative_module``, duplicated
    here for the same dependency-minimization reason."""
    if node.level == 0:
        return node.module
    package_parts = current_module_path.split(".")[:-1]
    strip = node.level - 1
    if strip > 0:
        package_parts = package_parts[:-strip] if strip <= len(package_parts) else []
    base = ".".join(package_parts)
    if node.module:
        return f"{base}.{node.module}" if base else node.module
    return base or None


def _walk_for_bindings(
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
) -> list[ConstructorAttributeBinding]:
    bindings: list[ConstructorAttributeBinding] = []
    for node in body:
        if isinstance(node, ast.ClassDef):
            qualname = f"{parent_qualname}.{node.name}" if parent_qualname else node.name
            owning_qualified_name = _symbol_qualified_name(language, file_path, qualname)
            owning_symbol = class_symbols.get(owning_qualified_name)
            if owning_symbol is not None:
                init_node = _find_init(node.body)
                if init_node is not None:
                    bindings.extend(
                        _process_init(
                            init_node,
                            owning_symbol=owning_symbol,
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
            # else: no real ParsedSymbol for this class (extractor/parser
            # scope mismatch, e.g. a class defined only inside a
            # module-level try/if block) -- skip producing bindings for it
            # entirely rather than fabricate an owning_class_entity_id.
            bindings.extend(
                _walk_for_bindings(
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
                    bindings.extend(
                        _walk_for_bindings(
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
    return bindings


def _find_init(class_body: list[ast.stmt]) -> ast.FunctionDef | None:
    """Only a plain, synchronous ``__init__`` declared directly in the
    class body counts. Never descends into nested ``if``/``try``/``with``
    blocks at class-body level (a constructor conditionally defined that
    way is exotic enough to be out of scope for this first version), and
    never matches ``async def __init__`` (not a meaningful constructor in
    normal instantiation semantics)."""
    for node in class_body:
        if isinstance(node, ast.FunctionDef) and node.name == "__init__":
            return node
    return None


def _process_init(
    init_node: ast.FunctionDef,
    *,
    owning_symbol: ParsedSymbol,
    file_path: str,
    run_id: str,
    class_registry: dict[str, dict[str, str]],
    local_classes: dict[str, str],
    local_imports: dict[str, _ImportedName],
    module_path_by_dotted: dict[str, str],
    class_symbols: dict[str, ParsedSymbol],
    enclosing_qualname: str,
) -> list[ConstructorAttributeBinding]:
    # Map of parameter name -> its ast.arg, restricted to __init__'s own
    # positional-only / positional-or-keyword / keyword-only parameters
    # (never *args/**kwargs), and never `self`.
    params: dict[str, ast.arg] = {}
    positional = list(init_node.args.posonlyargs) + list(init_node.args.args)
    if positional and positional[0].arg == "self":
        positional = positional[1:]
    for arg in positional:
        params[arg.arg] = arg
    for arg in init_node.args.kwonlyargs:
        params[arg.arg] = arg

    if not params:
        return []

    bindings: list[ConstructorAttributeBinding] = []
    for stmt in _init_own_assignments(init_node.body):
        binding = _binding_for_statement(
            stmt,
            params=params,
            owning_symbol=owning_symbol,
            file_path=file_path,
            run_id=run_id,
            class_registry=class_registry,
            local_classes=local_classes,
            local_imports=local_imports,
            module_path_by_dotted=module_path_by_dotted,
            class_symbols=class_symbols,
            enclosing_qualname=enclosing_qualname,
        )
        if binding is not None:
            bindings.append(binding)
    return bindings


def _init_own_assignments(body: list[ast.stmt]) -> list[ast.Assign]:
    """Collect plain ``ast.Assign`` statements that are either directly in
    ``__init__``'s own body, or nested only inside ``if``/``try``/``with``
    blocks within it. Deliberately never descends into a nested
    ``def``/``class`` inside ``__init__`` -- an assignment inside a closure
    or a locally-defined class is not "the constructor's own"
    ``self.attribute = parameter`` assignment even if it happens to look
    like one syntactically, and dynamic rebinding of ``self.<attribute>``
    outside ``__init__`` proper must never be treated as this pattern (see
    module docstring)."""
    statements: list[ast.Assign] = []
    for node in body:
        if isinstance(node, ast.Assign):
            statements.append(node)
        elif isinstance(node, (ast.If, ast.Try, ast.With)):
            for attr in ("body", "orelse", "finalbody"):
                sub = getattr(node, attr, None)
                if sub:
                    statements.extend(_init_own_assignments(sub))
    return statements


def _binding_for_statement(
    stmt: ast.Assign,
    *,
    params: dict[str, ast.arg],
    owning_symbol: ParsedSymbol,
    file_path: str,
    run_id: str,
    class_registry: dict[str, dict[str, str]],
    local_classes: dict[str, str],
    local_imports: dict[str, _ImportedName],
    module_path_by_dotted: dict[str, str],
    class_symbols: dict[str, ParsedSymbol],
    enclosing_qualname: str,
) -> ConstructorAttributeBinding | None:
    if len(stmt.targets) != 1:
        return None
    target = stmt.targets[0]
    if not (
        isinstance(target, ast.Attribute)
        and isinstance(target.value, ast.Name)
        and target.value.id == "self"
    ):
        return None
    attribute_name = target.attr

    value = stmt.value
    if not isinstance(value, ast.Name):
        # Anything other than a bare Name (call, attribute/method chain,
        # boolexpr, literal, ...) is out of scope -- no binding at all.
        return None

    parameter_name = value.id
    if parameter_name != attribute_name:
        # The RHS is a bare name, but it does not match the attribute being
        # assigned (`self.thing = other`, a *different* parameter or a
        # local variable that merely happens to share a name with some
        # other parameter) -- out of scope. The recognized idiom is exactly
        # `self.<name> = <name>`; only this narrow, unambiguous shape is
        # treated as constructor injection of that specific attribute.
        return None
    param_arg = params.get(parameter_name)
    if param_arg is None:
        # Bare name matches the attribute, but is not actually one of
        # __init__'s own parameters (e.g. a local variable shadowing the
        # attribute name) -- out of scope.
        return None

    assignment_start = stmt.lineno
    assignment_end = getattr(stmt, "end_lineno", assignment_start)

    annotation = param_arg.annotation
    if annotation is None:
        return ConstructorAttributeBinding.create(
            run_id=run_id,
            owning_class_entity_id=owning_symbol.id,
            attribute_name=attribute_name,
            parameter_name=parameter_name,
            declared_type_reference=UNANNOTATED_TYPE_REFERENCE,
            resolution_status="unresolved",
            target_type_entity_id=None,
            assignment_span_path=file_path,
            assignment_span_start_line=assignment_start,
            assignment_span_end_line=assignment_end,
        )

    declared_type_reference = _unparse(annotation)
    annotation_start = getattr(annotation, "lineno", None)
    annotation_end = getattr(annotation, "end_lineno", annotation_start)

    target_symbol = _resolve_type_annotation(
        annotation,
        class_registry=class_registry,
        local_classes=local_classes,
        local_imports=local_imports,
        module_path_by_dotted=module_path_by_dotted,
        class_symbols=class_symbols,
        enclosing_qualname=enclosing_qualname,
    )

    if target_symbol is not None:
        return ConstructorAttributeBinding.create(
            run_id=run_id,
            owning_class_entity_id=owning_symbol.id,
            attribute_name=attribute_name,
            parameter_name=parameter_name,
            declared_type_reference=declared_type_reference,
            resolution_status="resolved",
            target_type_entity_id=target_symbol.id,
            annotation_span_path=file_path,
            annotation_span_start_line=annotation_start,
            annotation_span_end_line=annotation_end,
            assignment_span_path=file_path,
            assignment_span_start_line=assignment_start,
            assignment_span_end_line=assignment_end,
        )

    # Annotation present but either (a) a complex typing construct this
    # module deliberately never parses into, or (b) a simple/dotted name
    # that does not trace to a real analyzed class -- either way,
    # unresolved, never a fabricated target.
    return ConstructorAttributeBinding.create(
        run_id=run_id,
        owning_class_entity_id=owning_symbol.id,
        attribute_name=attribute_name,
        parameter_name=parameter_name,
        declared_type_reference=declared_type_reference,
        resolution_status="unresolved",
        target_type_entity_id=None,
        annotation_span_path=file_path,
        annotation_span_start_line=annotation_start,
        annotation_span_end_line=annotation_end,
        assignment_span_path=file_path,
        assignment_span_start_line=assignment_start,
        assignment_span_end_line=assignment_end,
    )


def _resolve_type_annotation(
    annotation: ast.expr,
    *,
    class_registry: dict[str, dict[str, str]],
    local_classes: dict[str, str],
    local_imports: dict[str, _ImportedName],
    module_path_by_dotted: dict[str, str],
    class_symbols: dict[str, ParsedSymbol],
    enclosing_qualname: str,
) -> ParsedSymbol | None:
    """Try to resolve a type-annotation expression to a real
    ``ParsedSymbol`` for a class defined somewhere in the analyzed source
    tree. Only a simple name (``OrderService``) or a dotted attribute chain
    (``some_module.OrderService``) is ever attempted -- exactly mirroring
    ``python_inheritance_extractor._resolve_base``'s handling of base-class
    expressions. Anything else (``ast.Subscript`` for ``Optional[X]``/
    generics, ``ast.BinOp`` for ``X | None``, ``ast.Constant`` for a
    string-quoted forward reference, etc.) returns ``None`` unconditionally
    -- this module never attempts to parse into complex typing syntax."""
    if isinstance(annotation, ast.Name):
        return _resolve_simple_name(
            annotation.id,
            class_registry=class_registry,
            local_classes=local_classes,
            local_imports=local_imports,
            module_path_by_dotted=module_path_by_dotted,
            class_symbols=class_symbols,
            enclosing_qualname=enclosing_qualname,
        )
    if isinstance(annotation, ast.Attribute):
        dotted = _attribute_to_dotted(annotation)
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
    #    from the enclosing scope (innermost match wins) -- identical
    #    approach to python_inheritance_extractor._resolve_simple_name.
    scope_parts = enclosing_qualname.split(".") if enclosing_qualname else []
    for depth in range(len(scope_parts), -1, -1):
        prefix = ".".join(scope_parts[:depth])
        candidate_key = f"{prefix}.{name}" if prefix else name
        qualified_name = local_classes.get(candidate_key)
        if qualified_name is not None:
            return class_symbols.get(qualified_name)

    # 2. Cross-file resolution via an import binding in this file's module
    #    scope: `from other_module import Name`.
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
    # attribute hop off an `import module [as alias]` binding), identical
    # to python_inheritance_extractor._resolve_dotted_attribute.
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
        return "<unparsable annotation>"
