"""Precision-first Python AST "calls" relation extractor.

Produces ``ObservedProgramRelation`` (``relation_kind="calls"``) instances
from Python source, via pure static AST analysis -- no type inference, no
import execution, no bytecode.

--------------------------------------------------------------------------
Entity identity: real, run-scoped ``ParsedSymbol.id`` only (round 2 change)
--------------------------------------------------------------------------
An earlier version of this module was fully self-contained and minted its
own ad hoc dotted-qualname strings as entity ids (e.g. ``"pkg.mod.Foo.bar"``)
and, for anything it could not resolve, a placeholder string such as
``"unresolved:requests.get"`` stuffed into ``target_entity_id``. That is no
longer allowed by the shared contract (``core.models.program_relation``):
``target_entity_id`` may now *only* ever hold a real, run-scoped
``ParsedSymbol.id`` for an entity actually produced by the real parser in
this run; placeholder/textual targets belong in the separate
``target_reference`` field instead (see that module's docstring for the
full rationale).

This module therefore is no longer self-contained in the sense of minting
its own ids -- but as of round 3 it is *also* no longer self-contained in
the sense of doing its own parsing. Earlier (round 2) it drove the real
parsing pipeline itself (``infra.filesystem.local_repo_reader.LocalRepoReader``
+ ``app.evidence.source_reader.SourceReader`` +
``app.parsing.python_symbol_parser.parse_python_symbols``) against actual
files on disk to obtain real ``ParsedSymbol`` records. Now the caller (the
real analysis pipeline's controller, which already runs a "parsing" stage
via ``app.parsing.parse_supported_files.parse_supported_files`` once per
run) supplies both an already-snapshotted ``job: AnalysisJob`` and the
already-produced ``symbols: Iterable[ParsedSymbol]`` directly -- this module
never calls ``parse_python_symbols``/``parse_supported_files`` itself, so
there is exactly one authoritative parse per run, not one per extractor.
This module still constructs its own ``SourceReader(job)`` to read raw file
*content* for its own AST walk (that is not a re-parse -- it never derives
``ParsedSymbol`` records from it). This module's *own* AST-walking
resolution logic (see "What this extractor resolves" below) is otherwise
unchanged from round 1/round 2 -- it still independently determines, via
pure syntactic analysis, which internal dotted-qualname a call target or an
enclosing function/method corresponds to. What changed is purely where the
real ``ParsedSymbol`` lookup table used to translate an internal qualname
into a real entity id comes from:

1. The caller-supplied ``symbols`` are indexed once into
   ``symbol_table: dict[str, ParsedSymbol]``, keyed by the real parser's own
   ``qualified_name`` convention: ``f"{language}:{path}::{dotted_name}"``
   (see ``python_symbol_parser.py``'s ``_symbol``/``_join_name`` helpers --
   ``dotted_name`` is the dotted enclosing-class/function chain *within the
   file*, not module-path-prefixed). ``qualified_name`` is already globally
   unique (it embeds the file path), so ``symbol_table`` is built from the
   *entire* supplied ``symbols`` collection without pre-filtering by the
   analyzed file set -- simpler, and harmless, since a lookup can only ever
   hit a key this module itself computed from an analyzed file's own AST.
2. While building its own per-module syntactic index (``_build_module_index``
   / ``_ModuleIndex``), this module *also* computes, for every
   function/method/class node it visits, the same real ``qualified_name``
   string the real parser would produce for that same node (same dotted
   nesting, same file path, same language) and records a mapping from its
   own internal qualname (e.g. ``"pkg.mod.Foo.bar"``) to that real
   qualified_name (e.g. ``"python:pkg/mod.py::Foo.bar"``) --
   ``_ModuleIndex.internal_to_real_qn`` / ``_GlobalContext.internal_qn_to_real_qn``.
3. When this module's own resolution logic determines a call target (or an
   enclosing function/method) with certainty, it translates that internal
   qualname through the mapping in (2), then looks the resulting real
   qualified_name up in ``symbol_table`` from (1). If a real ``ParsedSymbol``
   is found, its ``.id`` becomes ``target_entity_id`` (or ``source_entity_id``
   for the enclosing scope) -- a genuine, run-scoped id for a symbol the real
   parser actually produced, never a self-invented string.
4. If no real ``ParsedSymbol`` is found for what this module's own logic
   believed was a resolvable target -- i.e. the two independent resolution
   passes disagree -- this module never fabricates an id. It downgrades that
   relation to ``resolution_status="unresolved"`` with ``target_entity_id``
   absent and ``target_reference`` set to the literal, as-written call
   expression instead. The same rule applies symmetrically to the *source*
   side: if the function/method a call site lives in has no matching real
   ``ParsedSymbol``, no relation is emitted for calls directly in that
   scope at all (there is no valid, non-fabricated ``source_entity_id`` to
   attach), though nested scopes inside it are still attempted independently
   (see ``_process_function``).

Known gap this surfaced: the real ``python_symbol_parser.parse_python_symbols``
only walks the direct ``body`` statement list of a ``Module``/``ClassDef``/
``FunctionDef`` node (via its own ``visit_body``), so a function or class
defined *nested inside a control-flow block* (e.g. ``if True:\\n    def
foo(): ...`` at module scope, or similarly inside a ``for``/``try``) never
becomes a real ``ParsedSymbol`` -- even though this extractor's own syntactic
walk (which does descend into control-flow bodies, via
``ast.iter_child_nodes``) can see it and would otherwise treat it as
resolvable. Per the rule above, calls to (or defined inside) such a target
correctly come out ``unresolved``/dropped rather than fabricated, so no
contract violation results, but it is a real precision gap in the *real*
parser worth flagging upstream; not fixed here since ``python_symbol_parser.py``
is frozen shared infrastructure for this workstream.

--------------------------------------------------------------------------
Cross-run logical identity (``stable_entity_key``) -- satisfied "for free"
--------------------------------------------------------------------------
This module does not add a stable/logical-identity field to
``ObservedProgramRelation`` -- the contract does not have one, by design
(see ``core.models.program_relation``'s docstring: cross-run correlation is
``ParsedSymbol.stable_entity_key``'s job, not this contract's). Nothing
further is required here *because* ``source_entity_id``/``target_entity_id``
are now real ``ParsedSymbol.id`` values (see above): a caller that wants to
recognize "the same logical entity" across two separate analysis runs looks
up each id in that run's own symbol store and compares
``stable_entity_key`` there, exactly as ``ParsedSymbol``'s own docstring
describes. Using self-invented qualname strings (round 1's scheme) would
have made that impossible, since those strings never pointed at a real
``ParsedSymbol`` to look ``stable_entity_key`` up on in the first place.

--------------------------------------------------------------------------
What this extractor resolves ("resolved" / "partial"), and how
--------------------------------------------------------------------------
- Same-module function calls: ``def a(): b()`` where ``b`` is a top-level
  function/class defined in the same file -> resolved.
- ``self.method()`` inside a class, where ``method`` is defined directly
  in that same class body -> resolved. If ``method`` is not found on the
  class itself (e.g. it's only defined on a base class), this is left
  unresolved on purpose: resolving through an inheritance chain requires
  knowing the base class's members, which is out of scope here (see the
  parallel "inheritance extractor" workstream).
- Direct class-attribute calls, ``SomeClass.static_method()``, and
  constructor-then-immediate-call chains, ``SomeClass().method()`` -- all
  resolved inline from the same expression, no cross-statement inference
  needed.
- ``obj = SomeClass(); obj.method()`` -- resolved via a lightweight,
  intentionally conservative value-flow heuristic (see "Variable-type
  tracking" below). Because this *is* a heuristic (not guaranteed correct
  the way a same-expression chain is), matches produced this way are
  emitted with ``resolution_status="partial"`` and a confidence score,
  never ``"resolved"``.
- Deterministically resolvable imports: ``from .other_module import
  other_function`` (or an absolute ``from pkg.mod import name``) where the
  source module is *part of the analyzed file set* and ``name`` is a
  top-level function/class actually defined there -> resolved (or partial,
  if reached via variable-type tracking as above). If the imported module
  is not part of the analyzed set (external/third-party, or simply not
  provided to the extractor), or the imported name cannot be confirmed as
  a top-level function/class in that module, the call is left unresolved
  with ``target_reference`` set -- never fabricated.
- A bare constructor call, ``SomeClass()``, with no method chained onto
  it, is itself emitted as a resolved "calls" relation with
  ``target_entity_id`` set to the class's own entity id. This is treated
  as an honest, unambiguous static fact (it's calling *something*, and
  that something is unambiguously identified), not a guess about which
  method (e.g. ``__init__``) ultimately runs.
- ``self.<attribute>.<method>()`` -- an attribute-chained call through a
  constructor-injected dependency -- when the caller also supplies
  ``bindings`` (see ``extract_call_relations``' ``bindings`` parameter and
  "Constructor-binding fallback resolution" below). This is a strictly
  *additive* fallback: it is attempted only for call sites the pipeline
  above already leaves ``"unresolved"`` (direct syntactic resolution never
  understands a two-level ``self.x.y()`` chain on its own), so every case
  the pipeline above already resolves is completely unaffected by it.
- ``self.<attribute>.<method>()`` -- an attribute-chained call through a
  dependency built by *direct construction* in ``__init__`` (``self.x =
  SomeClass(...)``, no constructor parameter/annotation involved at all)
  -- see "Direct-construction fallback resolution" below. Also a strictly
  additive fallback, attempted only when both the pipeline above AND the
  constructor-binding fallback above leave the call site ``"unresolved"``.
- ``self.method()`` where ``method`` is NOT defined on the calling class
  itself, but IS defined, uniquely and unambiguously, on a base class
  reached via caller-supplied, already-resolved ``inherits`` relations --
  see "Inheritance-aware self.method() fallback resolution" below. A
  third strictly additive fallback, attempted only when the ordinary
  same-class ``self.method()`` check above already left the call site
  ``"unresolved"``.
- ``self.method()`` inside a function *nested* (at any depth) inside a
  class method, when ``self`` is genuinely closure-captured from that
  enclosing method -- see "Closure-captured ``self`` resolution" below.

Closure-captured ``self`` resolution
--------------------------------------------------------------------------
A function nested inside a class method is NOT itself a method (it gets
``current_class=None`` -- see ``_process_function``), but Python's lexical
scoping means a bare ``self`` in its body can still deterministically
refer to the enclosing method's own ``self`` parameter, via an ordinary
closure capture:

    class C:
        def wraps(self, f):
            def wrapped_f(*args, **kw):
                copy = self.copy()   # <- C's own `self`, captured

``self.copy()`` there resolves exactly like the same call written directly
in the method body (same same-class ``methods`` lookup, plain
``resolution_status="resolved"``, no ``resolution_basis``), but ONLY when
the capture is provably unambiguous. The binding is REFUSED -- leaving the
call exactly as before, an ordinary unresolved name -- whenever any of
these hold (see ``_nested_closure_self_class``):

- the nested function declares its own parameter named ``self`` (any
  slot: positional, keyword-only, ``*args``/``**kwargs``);
- the nested function rebinds ``self`` locally in any form (assignment,
  ``del``, ``global``/``nonlocal``, a nested def/class/import/except/match
  binding of the name -- deliberately over-inclusive, refusal-only);
- lexical ownership is ambiguous: any scope between the method and the
  nested function that is not itself a validated self-capturing function
  (e.g. an intervening class body) breaks the chain, and so does the
  enclosing method rebinding ``self`` in its own scope;
- the enclosing scope is not a class method with a valid ``self``
  binding: its first positional parameter must literally be named
  ``self`` and it must not be decorated ``staticmethod``/``classmethod``.

Parameter *type annotations* are never consulted -- an annotation is a
claim about a value, not an observed binding, and resolving through one
would be exactly the fabrication this extractor refuses everywhere else
(so ``retry_state.get_fn_name()`` with ``retry_state: RetryCallState``
stays unresolved on purpose). The captured ``self`` enables ONLY the
direct same-class ``self.method()`` lookup: none of the additive fallbacks
below (``constructor_binding``, ``direct_construction``,
``inherited_self_method``, ``static_super``) fire from a nested function,
exactly as before -- ``current_class`` remains ``None`` there, and
``super()`` in particular MUST stay refused (zero-argument ``super()``
raises at runtime in a function nested inside a method; the ``__class__``
cell belongs to defs declared directly in the class body).

Constructor-binding fallback resolution (``resolution_basis="constructor_binding"``)
--------------------------------------------------------------------------------------
For a call site ``self.<attribute>.<method>(...)`` inside class ``C`` that
the rest of this module leaves ``"unresolved"``, and only when the caller
passed a non-empty ``bindings`` collection: look for exactly one
``ConstructorAttributeBinding`` (``core.models.constructor_binding``) whose
``owning_class_entity_id`` is ``C``'s real entity id and whose
``attribute_name`` matches ``<attribute>``. If found, and that binding's
``resolution_status == "resolved"`` (never for ``"partial"``/``"unresolved"``
bindings -- resolving a call through an uncertain binding would be exactly
the kind of fabrication this whole extractor refuses to do elsewhere), look
up ``<method>`` as a ``kind="method"`` symbol in the caller-supplied
``symbols`` whose ``parent_symbol_id`` equals the binding's
``target_type_entity_id``. Only if exactly one such method exists is the
call emitted as ``resolution_status="resolved"`` with
``resolution_basis="constructor_binding"`` and
``supporting_resolution_spans`` carrying the binding's annotation/assignment
spans (whichever are present) -- the call site's own span remains the
relation's primary span, unchanged. Any ambiguity anywhere in this chain
(no matching binding, more than one matching binding, a non-"resolved"
binding, zero or more than one matching method) leaves the call exactly as
it already was: ``"unresolved"`` with the literal call expression as
``target_reference``, never a guess.

Direct-construction fallback resolution (``resolution_basis="direct_construction"``)
--------------------------------------------------------------------------------------
For a call site ``self.<attribute>.<method>(...)`` inside class ``C`` that
is still ``"unresolved"`` after the pipeline above AND the
constructor-binding fallback above (this fallback is only ever attempted
when that one does not apply): look for a statement, anywhere in ``C``'s
own directly-declared ``__init__`` (its own body, plus ``if``/``try``/
``with`` blocks nested directly inside it -- never inside a nested
``def``/``class``), of the exact shape ``self.<attribute> =
<ClassExpr>(...)`` where ``<ClassExpr>`` is a bare name or single-level
dotted name (``SomeClass`` or ``some_module.SomeClass`` -- never a call
result, an attribute access on something other than a resolvable module,
or anything more complex) that this module's own existing constructor-call
resolution (``_resolve_constructor``, the same logic already used for a
bare ``SomeClass()`` call and for the variable-type-tracking heuristic
above) resolves unambiguously to a real analyzed class. If ``<attribute>``
is assigned this way more than once in ``__init__`` and the resolved class
disagrees between assignments, or if any assignment to that same attribute
in ``__init__`` is *not* of this exact shape, the attribute is dropped
entirely from consideration (never guessed) -- mirroring the
variable-type-tracking heuristic's "any ambiguity anywhere, don't guess"
rule. This produces a per-owning-class, per-attribute map, entirely
separate from the constructor-binding map above (keyed by
``(owning_class_entity_id, attribute_name)``, so the same attribute name
on two unrelated classes is never confused).

When a call site's ``<attribute>`` is present in this map for the
enclosing class, and the resolved class has exactly one method named
``<method>``, the call is emitted as ``resolution_status="resolved"`` with
``resolution_basis="direct_construction"`` and
``supporting_resolution_spans`` carrying the ``self.<attribute> =
<ClassExpr>(...)`` assignment's own span (there is no separate annotation
span here -- no parameter/annotation is involved at all). Zero or more
than one matching method, or the attribute simply not being in the map,
leaves the call exactly as it already was: never a guess.

Inheritance-aware self.method() fallback resolution (``resolution_basis="inherited_self_method"``)
--------------------------------------------------------------------------------------------------
For a call site ``self.method(...)`` inside class ``C`` where ``method``
is not found directly on ``C`` itself (the ordinary same-class check
above already leaves this ``"unresolved"``), and only when the caller
passed a non-empty ``inherits`` collection (already-resolved ``inherits``
relations, typically ``app.analysis.python_inheritance_extractor``'s own
output for the same run): walk the ``inherits`` graph outward from ``C``,
following only relations with ``resolution_status == "resolved"``
(never a partial/unresolved base -- see below), breadth-first, collecting
every ancestor class reached this way. For each such ancestor, check
whether it directly defines a method named ``method`` (via the same
``methods_by_parent`` index the constructor-binding fallback above
already builds from the caller-supplied ``symbols``). The call resolves
-- ``resolution_status="resolved"``, ``resolution_basis=
"inherited_self_method"`` -- if and only if:

1. Every class the walk has to look PAST -- ``C`` itself, and any visited
   ancestor that does NOT define ``method`` -- must itself have only
   resolved bases. If such a class has even one unresolved/external base,
   the whole call site stays ``"unresolved"``: that unresolved base could,
   in real Python's MRO, define ``method`` at exactly that point in the
   lookup order, and there is no way to rule that out without guessing.
   This is the same "any ambiguity anywhere, don't guess" discipline the
   variable-type-tracking heuristic already uses. Critically, this check
   does NOT apply to a class the walk finds ``method`` defined ON --
   Python's own method resolution would already stop there, so that
   class's own (possibly unresolved) bases are never consulted and never
   block the result. E.g. ``class Base(ABC): def method(self): ...`` --
   ``ABC`` being an unresolved external base never blocks resolving
   ``self.method()`` to ``Base.method``, since ``Base`` itself already
   answers the lookup before ``ABC`` would ever be consulted.
2. Exactly one ancestor among those visited defines ``method`` directly.
   Two or more distinct ancestors both defining ``method`` is a genuine
   override ambiguity this extractor's model cannot safely disambiguate
   (it does not attempt full C3 MRO linearization) -- left unresolved,
   never guessed. Multiple inheritance where only one branch's ancestor
   actually defines the method is NOT ambiguous under this rule (there is
   only one candidate) and resolves normally.

``supporting_resolution_spans`` carries the single ``inherits`` relation
whose target is the ancestor the method was found on (the specific base
declaration this resolution depended on) -- the call site's own span
remains the relation's primary span, unchanged. This fallback never
resolves a ``super().method()`` call (a structurally different AST shape
with its own separate ``static_super`` fallback -- see below), never
walks through a class this
extractor's own same-class lookup already resolved (so an overriding
``method`` defined directly on ``C`` is always preferred, exactly as
Python's own method resolution would pick the subclass's own definition
first), and never fires at all when ``inherits`` is omitted/empty --
every existing caller that does not pass ``inherits`` sees byte-identical
behavior to before this fallback existed.

Guarded static super() resolution (``resolution_basis="static_super"``)
------------------------------------------------------------------------
For a zero-argument ``super().method(...)`` call site inside a method of
class ``C``, and only when the caller passed ``inherits``: walk upward
from ``C`` through the caller-supplied resolved ``inherits`` relations,
requiring at every step (``C`` itself and every ancestor looked past)
exactly one declared base, fully resolved -- any multiple inheritance or
any unresolved/external base anywhere on the walk refuses resolution for
the whole call site, since the runtime MRO could then consult a class
this extractor cannot see or order. The nearest ancestor that defines
``method`` (exactly one matching real ``kind="method"`` symbol) is the
target -- exactly where Python's own MRO for that single-base chain would
stop; zero definers by chain end, or a duplicate definition on one
ancestor, refuses. ``super(C, self)`` (explicit two-argument form),
``super()`` calls in nested functions, and every other shape are never
touched. ``supporting_resolution_spans`` carries every ``inherits``
relation walked, in order (the chain of base declarations the resolution
depended on); the call site's own span remains the relation's primary
span. Residual static approximation, shared with ``inherited_self_method``
above: a *different* class using ``C`` in cooperative multiple
inheritance could reroute ``super()`` at runtime for instances of that
subclass -- the single-base-chain restriction keeps the resolved edge the
statically correct one for ``C``'s own declared hierarchy.

Variable-type tracking (the heuristic behind "partial" matches):
For each function/method body, every direct ``name = SomeConstructorCall()``
assignment (scanned across the *whole* function body, not just a single
branch) is recorded. A local variable is trusted as "of type
SomeConstructorCall's class" **only if every assignment to that name
within the function resolves, unambiguously, to the same class**-- if the
variable is ever assigned something else (an unresolved call, a literal,
a different class, a function parameter default, etc.) anywhere in the
function, it is treated as untyped for the *entire* function and any
``var.method()`` call through it is left unresolved rather than guessed.
This deliberately does not attempt control-flow-sensitive reasoning (which
branch runs when) -- it only asks "is there any ambiguity in this
function, anywhere" and refuses to guess if so.

--------------------------------------------------------------------------
What is explicitly OUT of scope (left "unresolved" on purpose)
--------------------------------------------------------------------------
- Any form of dynamic dispatch: calls through ``getattr``, ``**kwargs``
  unpacked into unknown objects, decorators that rewrap/replace a
  function's identity, metaclasses, ``__getattr__``/``__call__`` magic.
- Resolving ``self.method()`` up an inheritance chain is IN scope as of
  the ``inherited_self_method`` fallback above, but only when the caller
  supplies ``inherits`` and only under the strict uniqueness/no-unresolved-
  base conditions described there; still explicitly OUT of scope: any
  attribute access other than ``self.method()`` itself (e.g.
  ``self.attribute.method()`` still requires the constructor-binding or
  direct-construction fallbacks, unaffected by this one).
- ``super().method()`` calls are IN scope only in the one statically
  safe configuration handled by the ``static_super`` fallback (see
  "Guarded static super() resolution" below): zero-argument ``super()``,
  a fully resolved, strictly single-base inheritance chain, and exactly
  one (nearest) defining ancestor. Everything else -- ``super(C, self)``,
  any multiple inheritance or unresolved base on the walk, no unique
  definer -- remains out of scope and unresolved. The
  ``inherited_self_method`` fallback itself still never matches a
  ``super()`` shape.
- Star imports (``from x import *``): names introduced this way are not
  tracked at all, so calls to them are unresolved like any other unknown
  name.
- Relative imports with level >= 2. Bare ``from . import name`` (level ==
  1, no module clause) IS now resolved, but only in the one
  deterministically safe configuration: ``name`` maps to an analyzed
  submodule ``package.name``, and the package's ``__init__`` (when
  analyzed) does not bind ``name`` any other way -- a def/class of that
  name in the ``__init__`` resolves to that attribute instead (Python's
  own precedence), and any module-scope assignment or different import
  binding of the same name refuses resolution entirely rather than
  guessing between attribute and submodule. See
  ``_package_init_shadows_submodule``.
- Multi-segment dotted ``import pkg.sub.mod`` attribute-chain call sites
  (``pkg.sub.mod.func()``) -- only single-name ``import module[as alias]``
  plus ``alias.func()`` is resolved.
- Calls made directly in module-level code (outside any function/method)
  are not emitted at all: the contract asks for "the calling
  function/method's qualified name" as the source, and module-level code
  has no such entity in this scheme.
- No confidence is ever attached to a "resolved" relation (the contract
  forbids it); "unresolved" relations never carry a fabricated confidence
  either here (only "partial" ones do), since we have no real probability
  estimate for "this literal name, whatever it turns out to mean".

Precision over recall throughout: when in doubt, this extractor either
emits ``resolution_status="unresolved"`` with ``target_reference`` set to
the literal, as-written call expression, or (for bare module-level calls)
emits nothing at all. It never fabricates a plausible-looking but
unverified target entity id.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass, field
from typing import Iterable, Sequence

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.core.models.constructor_binding import ConstructorAttributeBinding
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import (
    ObservedProgramRelation,
    ResolutionEvidenceSpan,
)

EXTRACTOR_NAME = "python_call_extractor"
EXTRACTOR_VERSION = "0.6.0"

_PARTIAL_VAR_TRACKING_CONFIDENCE = 0.8

_SCOPE_BOUNDARY = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)
_FUNC_TYPES = (ast.FunctionDef, ast.AsyncFunctionDef)


# ---------------------------------------------------------------------------
# Per-module symbol index (pass 1: syntactic, single-file)
# ---------------------------------------------------------------------------


@dataclass
class _ClassInfo:
    qualname: str
    methods: dict[str, str] = field(default_factory=dict)  # method name -> qualname


@dataclass
class _ImportBinding:
    kind: str  # "from" | "module"
    target_module: str | None  # resolved absolute dotted module path, or None if unresolvable syntactically
    imported_name: str | None  # for kind == "from": the original imported name
    bare_package_import: bool = False
    """True only for the bare ``from . import X`` form (``level == 1``,
    no module clause): ``target_module`` is then the current *package*
    path itself ("" for a root-level module set), and ``X`` may resolve
    to the analyzed submodule ``package.X`` when the package ``__init__``
    does not shadow that name -- see ``_resolve_imports_for_module``."""


@dataclass
class _ModuleIndex:
    module_path: str
    file_path: str
    language: str
    tree: ast.Module
    top_level: dict[str, tuple[str, str]]  # name -> (kind "function"|"class", qualname)
    classes: dict[str, _ClassInfo]  # top-level class name -> info
    all_classes: dict[str, _ClassInfo]  # every class (any nesting) keyed by its qualname
    imports: dict[str, _ImportBinding]  # local bound name -> raw import binding
    qualnames: dict[int, str]  # id(node) -> dotted qualname, for FunctionDef/AsyncFunctionDef/ClassDef nodes
    internal_to_real_qn: dict[str, str]
    """Maps this module's own internal dotted qualname (e.g.
    ``"pkg.mod.Foo.bar"``) to the real qualified_name format produced by
    ``app.parsing.python_symbol_parser`` for the same symbol (e.g.
    ``"python:pkg/mod.py::Foo.bar"``), for every function/method/class node
    this module's own syntactic walk saw -- see module docstring."""
    module_scope_assigned: frozenset[str] = frozenset()
    """Every name bound by a Store context at this module's own scope
    (assignments, for/with targets, walrus, etc. -- never inside a nested
    function/class/lambda body). Consulted only by the bare
    ``from . import X`` submodule-binding resolution's shadowing guard: a
    package ``__init__`` that assigns ``X`` at module scope makes the
    runtime attribute win over the submodule, so the binding is refused
    rather than guessed."""


@dataclass
class _ResolvedImport:
    kind: str  # "function" | "class" | "module" | "unresolved"
    qualname: str | None = None  # for kind in ("function", "class")
    target: str | None = None  # module dotted path, for kind == "module"


def _module_path_for(file_path: str) -> str:
    normalized = file_path.replace("\\", "/")
    if normalized.startswith("./"):
        normalized = normalized[2:]
    if normalized.endswith(".py"):
        normalized = normalized[: -len(".py")]
    parts = [p for p in normalized.split("/") if p]
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def _package_path_for(module_path: str, file_path: str) -> str | None:
    is_init = file_path.replace("\\", "/").rstrip("/").endswith("__init__.py")
    if is_init:
        return module_path or None
    if "." not in module_path:
        return None
    return module_path.rsplit(".", 1)[0]


def _resolve_from_module(node: ast.ImportFrom, package_path: str | None) -> str | None:
    if node.level == 0:
        return node.module
    if node.level == 1 and node.module:
        if package_path:
            return f"{package_path}.{node.module}"
        return node.module
    if node.level == 1 and node.module is None:
        # Bare `from . import X`: anchor at the current package itself (""
        # for a root-level module set). Whether X then binds an attribute of
        # the package __init__ or the analyzed submodule `package.X` is
        # decided at cross-module resolution time -- see
        # `_resolve_imports_for_module` and the module docstring.
        return package_path if package_path is not None else ""
    # level >= 2 relative imports: not supported precisely enough to resolve
    # deterministically -- see module docstring.
    return None


def _record_import(node: ast.stmt, imports: dict[str, _ImportBinding], package_path: str | None) -> None:
    if isinstance(node, ast.Import):
        for alias in node.names:
            if "." in alias.name and alias.asname is None:
                # `import pkg.sub.mod` binds only the top package name and
                # requires a full attribute chain to reach the target;
                # unsupported (see module docstring) -- leave unbound so
                # any use resolves as an ordinary unknown name.
                continue
            bind_name = alias.asname or alias.name
            imports[bind_name] = _ImportBinding(kind="module", target_module=alias.name, imported_name=None)
    elif isinstance(node, ast.ImportFrom):
        for alias in node.names:
            if alias.name == "*":
                continue  # star import: cannot resolve deterministically
            bind_name = alias.asname or alias.name
            target_module = _resolve_from_module(node, package_path)
            imports[bind_name] = _ImportBinding(
                kind="from",
                target_module=target_module,
                imported_name=alias.name,
                bare_package_import=(node.module is None and node.level == 1),
            )


def _build_module_index(file_path: str, source: str, language: str) -> _ModuleIndex:
    tree = ast.parse(source, filename=file_path)
    module_path = _module_path_for(file_path)
    package_path = _package_path_for(module_path, file_path)

    top_level: dict[str, tuple[str, str]] = {}
    classes: dict[str, _ClassInfo] = {}
    all_classes: dict[str, _ClassInfo] = {}
    imports: dict[str, _ImportBinding] = {}
    qualnames: dict[int, str] = {}
    internal_to_real_qn: dict[str, str] = {}

    def qualname_for(scope_chain: list[str], name: str) -> str:
        segments = [module_path, *scope_chain, name] if module_path else [*scope_chain, name]
        return ".".join(segments)

    def real_qualname_for(scope_chain: list[str], name: str) -> str:
        # Mirrors python_symbol_parser.py's `_symbol`/`_join_name`: dotted
        # nesting *within the file* (no module-path prefix), joined onto
        # "{language}:{path}::".
        local_name = ".".join([*scope_chain, name])
        return f"{language}:{file_path}::{local_name}"

    def visit(node: ast.AST, scope_chain: list[str]) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, _FUNC_TYPES):
                qn = qualname_for(scope_chain, child.name)
                qualnames[id(child)] = qn
                internal_to_real_qn[qn] = real_qualname_for(scope_chain, child.name)
                if not scope_chain:
                    top_level[child.name] = ("function", qn)
                visit(child, scope_chain + [child.name])
            elif isinstance(child, ast.ClassDef):
                qn = qualname_for(scope_chain, child.name)
                qualnames[id(child)] = qn
                internal_to_real_qn[qn] = real_qualname_for(scope_chain, child.name)
                methods: dict[str, str] = {}
                for item in child.body:
                    if isinstance(item, _FUNC_TYPES):
                        methods[item.name] = f"{qn}.{item.name}"
                class_info = _ClassInfo(qualname=qn, methods=methods)
                all_classes[qn] = class_info
                if not scope_chain:
                    top_level[child.name] = ("class", qn)
                    classes[child.name] = class_info
                visit(child, scope_chain + [child.name])
            elif isinstance(child, (ast.Import, ast.ImportFrom)):
                if not scope_chain:
                    _record_import(child, imports, package_path)
            else:
                visit(child, scope_chain)

    visit(tree, [])
    return _ModuleIndex(
        module_path=module_path,
        file_path=file_path,
        language=language,
        tree=tree,
        top_level=top_level,
        classes=classes,
        all_classes=all_classes,
        imports=imports,
        qualnames=qualnames,
        internal_to_real_qn=internal_to_real_qn,
        module_scope_assigned=_module_scope_assigned_names(tree),
    )


def _module_scope_assigned_names(tree: ast.Module) -> frozenset[str]:
    """Collect every name bound by a Store context at module scope (never
    descending into nested function/class/lambda bodies). Deliberately
    over-inclusive (e.g. comprehension targets at module level are counted
    even though Python scopes them separately): this feeds a *refusal*
    guard, so over-detection can only ever keep a binding unresolved --
    never produce a wrong resolution."""
    names: set[str] = set()

    def walk(node: ast.AST) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, _SCOPE_BOUNDARY):
                continue
            if isinstance(child, ast.Name) and isinstance(child.ctx, ast.Store):
                names.add(child.id)
            walk(child)

    walk(tree)
    return frozenset(names)


# ---------------------------------------------------------------------------
# Cross-module resolution (pass 2)
# ---------------------------------------------------------------------------


def _resolve_imports_for_module(
    module_idx: _ModuleIndex, modules_by_path: dict[str, _ModuleIndex]
) -> dict[str, _ResolvedImport]:
    resolved: dict[str, _ResolvedImport] = {}
    for local_name, binding in module_idx.imports.items():
        if binding.kind == "from":
            target_module = binding.target_module
            # `is not None` (not truthiness): "" is the legitimate root
            # package for the bare `from . import X` form in a root-level
            # module set, and its __init__ module indexes under "".
            target_idx = modules_by_path.get(target_module) if target_module is not None else None
            if target_idx is not None and binding.imported_name is not None:
                hit = target_idx.top_level.get(binding.imported_name)
                if hit is not None:
                    # A def/class of this name in the target module wins --
                    # for the bare package form this is exactly Python's own
                    # semantics (the package attribute shadows the
                    # submodule).
                    kind, qn = hit
                    resolved[local_name] = _ResolvedImport(kind=kind, qualname=qn)
                    continue
            if (
                binding.bare_package_import
                and binding.imported_name is not None
                and target_module is not None
            ):
                # Bare `from . import X`: bind X as the analyzed submodule
                # `package.X`, but only when the package __init__ (if
                # analyzed) does not shadow the name -- see
                # `_package_init_shadows_submodule`. Anything ambiguous
                # stays unresolved, never guessed.
                submodule = (
                    f"{target_module}.{binding.imported_name}" if target_module else binding.imported_name
                )
                if submodule in modules_by_path and not _package_init_shadows_submodule(
                    target_idx, binding.imported_name
                ):
                    resolved[local_name] = _ResolvedImport(kind="module", target=submodule)
                    continue
            resolved[local_name] = _ResolvedImport(kind="unresolved")
        else:  # "module"
            target_module = binding.target_module
            if target_module is not None and target_module in modules_by_path:
                resolved[local_name] = _ResolvedImport(kind="module", target=target_module)
            else:
                resolved[local_name] = _ResolvedImport(kind="unresolved")
    return resolved


def _package_init_shadows_submodule(
    package_idx: _ModuleIndex | None, name: str
) -> bool:
    """Shadowing guard for the bare ``from . import X`` submodule binding:
    Python binds the package's own attribute ``X`` in preference to the
    submodule whenever the package ``__init__`` defines one. The caller has
    already handled the def/class case (top_level hit wins outright); this
    guard refuses the submodule binding when the analyzed ``__init__``
    could bind ``X`` any other way:

    - a module-scope assignment of any Store form (``X = ...``, ``for X
      in ...``, ``with ... as X``, walrus);
    - an import binding of ``X`` that is anything other than the package's
      own bare ``from . import X`` of this very submodule (that specific
      self-consistent form binds the submodule itself, so it does not
      shadow).

    ``package_idx is None`` means the package ``__init__`` is not in the
    analyzed/parsed module set at all -- nothing observed can shadow, and a
    package whose ``__init__`` genuinely failed to parse could not be
    imported at runtime either, so the binding is allowed."""
    if package_idx is None:
        return False
    if name in package_idx.top_level:
        return True  # defensive: caller normally resolved this case already
    if name in package_idx.module_scope_assigned:
        return True
    own_binding = package_idx.imports.get(name)
    if own_binding is not None:
        is_same_bare_submodule_import = (
            own_binding.kind == "from"
            and own_binding.bare_package_import
            and own_binding.imported_name == name
            and own_binding.target_module == package_idx.module_path
        )
        if not is_same_bare_submodule_import:
            return True
    return False


@dataclass
class _GlobalContext:
    modules_by_path: dict[str, _ModuleIndex]
    classes_by_qualname: dict[str, _ClassInfo]
    resolved_imports_by_module: dict[str, dict[str, _ResolvedImport]]
    symbol_table: dict[str, ParsedSymbol]
    """Real ``ParsedSymbol`` records produced by the real
    ``parse_python_symbols`` parser, keyed by its own ``qualified_name``
    convention (``"{language}:{path}::{dotted_name}"``)."""
    internal_qn_to_real_qn: dict[str, str]
    """Union, across all analyzed modules, of each module's
    ``internal_to_real_qn`` -- see ``_ModuleIndex`` docstring."""
    methods_by_parent: dict[str, list[ParsedSymbol]]
    """Real ``kind="method"`` symbols from the raw, caller-supplied
    ``symbols`` collection (deliberately NOT the qualified_name-deduplicated
    ``symbol_table`` -- two distinct real ``ParsedSymbol`` records can share
    one ``qualified_name`` (e.g. two same-named methods in one class body,
    which ``symbol_table``'s dict would collapse to one), and losing that
    distinction here would silently hide a genuine ambiguity from the
    constructor-binding fallback), indexed by their ``parent_symbol_id`` --
    used only by that fallback (see module docstring) to look up
    ``<method>`` on a binding's resolved ``target_type_entity_id`` class,
    independently of this module's own internal-qualname scheme."""
    bindings_by_key: dict[tuple[str, str], list[ConstructorAttributeBinding]]
    """Caller-supplied ``ConstructorAttributeBinding`` records, indexed by
    ``(owning_class_entity_id, attribute_name)``. More than one entry under
    the same key is treated as ambiguous by the fallback resolver (never
    guessed between) -- see module docstring."""
    direct_construction_by_key: dict[tuple[str, str], tuple[str, str, int, int]]
    """This module's own direct-construction facts (Case B -- see module
    docstring "Direct-construction fallback resolution"), indexed by
    ``(owning_class_entity_id, attribute_name)`` -- structurally separate
    from ``bindings_by_key`` above (a different technique, no caller input
    involved). Each value is ``(target_class_entity_id, span_path,
    span_start_line, span_end_line)`` for the resolved
    ``self.<attribute> = <ClassExpr>(...)`` assignment found in the owning
    class's own ``__init__``. Populated in a second pass, after the rest of
    this ``_GlobalContext`` already exists, because resolving a
    ``<ClassExpr>`` reuses this same context's own class/import resolution
    machinery (``_resolve_constructor``) -- see
    ``_build_direct_construction_index``."""
    inherits_by_source: dict[str, list[ObservedProgramRelation]]
    """Caller-supplied ``inherits`` relations (``relation_kind="inherits"``)
    with ``resolution_status == "resolved"``, grouped by
    ``source_entity_id`` (the subclass), preserving the caller's own
    relative ordering (which, for one class's own bases, mirrors the
    declared base-list order -- see
    ``python_inheritance_extractor``'s own emission order) -- used only by
    the inheritance-aware ``self.method()`` fallback (see module
    docstring, "Inheritance-aware self.method() fallback resolution").
    Empty when the caller does not pass ``inherits`` (the default), which
    is what makes that fallback a no-op unless explicitly opted into."""
    has_unresolved_base: set[str]
    """Set of ``source_entity_id`` values (subclasses) that have AT LEAST
    ONE ``inherits`` relation in the caller-supplied ``inherits``
    collection whose ``resolution_status`` is NOT ``"resolved"`` -- i.e. an
    external/unresolved base class. Consulted by the inheritance-aware
    ``self.method()`` fallback to refuse resolution through any class
    (including transitively-visited ancestors) that has an unresolved
    base, since that base could hide an overriding method definition this
    extractor has no way to see -- never a guess."""


def _index_inherits(
    inherits: Iterable[ObservedProgramRelation],
) -> tuple[dict[str, list[ObservedProgramRelation]], set[str]]:
    """Group caller-supplied ``inherits`` relations by ``source_entity_id``,
    separating resolved bases (usable for the inheritance-aware fallback)
    from any unresolved/external base (which blocks that fallback for the
    owning class entirely -- see ``_GlobalContext.has_unresolved_base``)."""
    inherits_by_source: dict[str, list[ObservedProgramRelation]] = {}
    has_unresolved_base: set[str] = set()
    for rel in inherits:
        if rel.relation_kind != "inherits":
            continue  # defensive: caller contract is "inherits relations only"
        if rel.resolution_status == "resolved" and rel.target_entity_id:
            inherits_by_source.setdefault(rel.source_entity_id, []).append(rel)
        else:
            has_unresolved_base.add(rel.source_entity_id)
    return inherits_by_source, has_unresolved_base


def _build_global_context(
    modules: list[_ModuleIndex],
    symbol_table: dict[str, ParsedSymbol],
    bindings: Iterable[ConstructorAttributeBinding],
    all_symbols: Iterable[ParsedSymbol],
    inherits: Iterable[ObservedProgramRelation] = (),
) -> _GlobalContext:
    modules_by_path = {m.module_path: m for m in modules}
    classes_by_qualname: dict[str, _ClassInfo] = {}
    internal_qn_to_real_qn: dict[str, str] = {}
    for m in modules:
        for class_info in m.all_classes.values():
            classes_by_qualname[class_info.qualname] = class_info
        internal_qn_to_real_qn.update(m.internal_to_real_qn)
    resolved_imports_by_module = {
        m.module_path: _resolve_imports_for_module(m, modules_by_path) for m in modules
    }

    methods_by_parent: dict[str, list[ParsedSymbol]] = {}
    for symbol in all_symbols:
        if symbol.kind == "method" and symbol.parent_symbol_id:
            methods_by_parent.setdefault(symbol.parent_symbol_id, []).append(symbol)

    bindings_by_key: dict[tuple[str, str], list[ConstructorAttributeBinding]] = {}
    for binding in bindings:
        key = (binding.owning_class_entity_id, binding.attribute_name)
        bindings_by_key.setdefault(key, []).append(binding)

    inherits_by_source, has_unresolved_base = _index_inherits(inherits)

    globals_ctx = _GlobalContext(
        modules_by_path=modules_by_path,
        classes_by_qualname=classes_by_qualname,
        resolved_imports_by_module=resolved_imports_by_module,
        symbol_table=symbol_table,
        internal_qn_to_real_qn=internal_qn_to_real_qn,
        methods_by_parent=methods_by_parent,
        bindings_by_key=bindings_by_key,
        direct_construction_by_key={},
        inherits_by_source=inherits_by_source,
        has_unresolved_base=has_unresolved_base,
    )
    # Second pass: populate direct_construction_by_key. This reuses
    # _resolve_constructor, which itself needs a fully-formed _GlobalContext
    # (classes_by_qualname, resolved_imports_by_module, symbol_table,
    # internal_qn_to_real_qn) -- hence building it only after the rest of
    # `globals_ctx` above already exists. `_GlobalContext` is a plain
    # (non-frozen) dataclass specifically to allow this in-place fill-in,
    # exactly like `bindings_by_key`/`methods_by_parent` did not need a
    # second pass but this field genuinely does.
    globals_ctx.direct_construction_by_key = _build_direct_construction_index(modules, globals_ctx)
    return globals_ctx


def _lookup_real_symbol(internal_qn: str | None, globals_ctx: _GlobalContext) -> ParsedSymbol | None:
    """Translate this module's own internal dotted qualname into a real,
    run-scoped ``ParsedSymbol`` produced by the real parser, or ``None`` if
    no such symbol exists (either because ``internal_qn`` is ``None``, or
    because this module's own resolution and the real parser's symbol table
    disagree -- see module docstring, "Known gap"). Callers must never
    fabricate an id when this returns ``None``."""
    if internal_qn is None:
        return None
    real_qn = globals_ctx.internal_qn_to_real_qn.get(internal_qn)
    if real_qn is None:
        return None
    return globals_ctx.symbol_table.get(real_qn)


# ---------------------------------------------------------------------------
# Call-target resolution (pass 3, per function scope)
# ---------------------------------------------------------------------------


@dataclass
class _Ctx:
    module_idx: _ModuleIndex
    current_class: _ClassInfo | None
    var_types: dict[str, str]
    resolved_imports: dict[str, _ResolvedImport]
    globals_ctx: _GlobalContext
    local_defs: dict[str, tuple[str, str]] = field(default_factory=dict)
    """Functions/classes defined directly in the current function's own
    scope (e.g. a nested ``def`` or a locally-defined class) -- checked
    before module top-level names, mirroring Python's own name lookup
    (local scope before module scope)."""
    closure_self_class: _ClassInfo | None = None
    """Set ONLY for a function nested (at any depth) inside a class method
    when ``self`` in this function's body deterministically refers to the
    enclosing method's own ``self`` parameter -- i.e. it is genuinely
    captured from that enclosing lexical scope, with no scope on the chain
    rebinding or shadowing it (see module docstring, "Closure-captured
    ``self`` resolution", and ``_nested_closure_self_class`` for the exact
    refusal conditions). ``None`` everywhere else: directly inside a method
    (``current_class`` covers that case), at module scope, and for any
    nested function where the capture is not provably safe. Mutually
    exclusive with ``current_class`` by construction (a scope is either a
    method itself or a nested function, never both)."""


def _unparse(node: ast.AST) -> str:
    try:
        return ast.unparse(node)
    except Exception:
        return "<unrepresentable-call-target>"


def _resolve_callable_name(name: str, ctx: _Ctx) -> tuple[str, str] | None:
    if name in ctx.local_defs:
        return ctx.local_defs[name]
    if name in ctx.module_idx.top_level:
        return ctx.module_idx.top_level[name]
    ri = ctx.resolved_imports.get(name)
    if ri is not None and ri.kind in ("function", "class"):
        return (ri.kind, ri.qualname)  # type: ignore[return-value]
    return None


def _resolve_module_attr(module_path: str, attr_name: str, ctx: _Ctx) -> tuple[str, str] | None:
    target_idx = ctx.globals_ctx.modules_by_path.get(module_path)
    if target_idx is None:
        return None
    return target_idx.top_level.get(attr_name)


def _class_info_for_name(name: str, ctx: _Ctx) -> _ClassInfo | None:
    """Resolve a bare Name used as a class reference: a class defined
    locally in the current function's own scope, a module top-level class,
    or an imported class binding."""
    local = ctx.local_defs.get(name)
    if local is not None and local[0] == "class":
        info = ctx.globals_ctx.classes_by_qualname.get(local[1])
        if info is not None:
            return info
    if name in ctx.module_idx.classes:
        return ctx.module_idx.classes[name]
    ri = ctx.resolved_imports.get(name)
    if ri is not None and ri.kind == "class" and ri.qualname is not None:
        return ctx.globals_ctx.classes_by_qualname.get(ri.qualname)
    return None


def _resolve_call(func_expr: ast.expr, ctx: _Ctx) -> tuple[str, str | None, float | None] | None:
    """Resolve a Call node's ``func`` expression to a relation tuple
    ``(resolution_status, internal_qualname_or_None, confidence)``, or
    return None to mean "do not emit a relation for this call at all"
    (currently unused, reserved for future scope exclusions).

    ``internal_qualname_or_None`` is this module's *own* dotted-qualname
    scheme (not yet a real entity id) when the status is "resolved" or
    "partial"; it is ``None`` when "unresolved" -- the literal, as-written
    target text is derived separately from the call node itself at emission
    time (see ``_finalize_target``), not threaded through here.
    """

    if isinstance(func_expr, ast.Name):
        hit = _resolve_callable_name(func_expr.id, ctx)
        if hit is not None:
            _kind, qn = hit
            return ("resolved", qn, None)
        return ("unresolved", None, None)

    if isinstance(func_expr, ast.Attribute):
        value = func_expr.value
        attr = func_expr.attr

        if isinstance(value, ast.Name) and value.id == "self" and (
            ctx.current_class is not None or ctx.closure_self_class is not None
        ):
            # `self` either is the current method's own first parameter
            # (current_class) or is deterministically captured from the
            # enclosing method's scope by a nested function
            # (closure_self_class -- see module docstring, "Closure-captured
            # `self` resolution"). Both bind `self` to an instance of the
            # same statically-known class, so the same same-class method
            # lookup applies.
            owner_class = ctx.current_class if ctx.current_class is not None else ctx.closure_self_class
            method_qn = owner_class.methods.get(attr)
            if method_qn is not None:
                return ("resolved", method_qn, None)
            return ("unresolved", None, None)

        if isinstance(value, ast.Name):
            ri = ctx.resolved_imports.get(value.id)
            if ri is not None and ri.kind == "module" and ri.target is not None:
                hit = _resolve_module_attr(ri.target, attr, ctx)
                if hit is not None:
                    _kind, qn = hit
                    return ("resolved", qn, None)
                return ("unresolved", None, None)

            class_info = _class_info_for_name(value.id, ctx)
            if class_info is not None:
                method_qn = class_info.methods.get(attr)
                if method_qn is not None:
                    return ("resolved", method_qn, None)
                return ("unresolved", None, None)

            if value.id in ctx.var_types:
                class_qn = ctx.var_types[value.id]
                typed_class = ctx.globals_ctx.classes_by_qualname.get(class_qn)
                if typed_class is not None:
                    method_qn = typed_class.methods.get(attr)
                    if method_qn is not None:
                        return ("partial", method_qn, _PARTIAL_VAR_TRACKING_CONFIDENCE)
                return ("unresolved", None, None)

            return ("unresolved", None, None)

        if isinstance(value, ast.Call):
            inner_class_qn = _resolve_constructor(value, ctx)
            if inner_class_qn is not None:
                typed_class = ctx.globals_ctx.classes_by_qualname.get(inner_class_qn)
                if typed_class is not None:
                    method_qn = typed_class.methods.get(attr)
                    if method_qn is not None:
                        return ("resolved", method_qn, None)
            return ("unresolved", None, None)

        return ("unresolved", None, None)

    return ("unresolved", None, None)


def _resolve_constructor(call_node: ast.Call, ctx: _Ctx) -> str | None:
    """If ``call_node`` is an unambiguous, statically-resolved call to a
    known class (i.e. a constructor call), return that class's internal
    qualname. Otherwise return None (including when the call resolves to a
    function, a method, or nothing at all)."""
    result = _resolve_call(call_node.func, ctx)
    if result is None:
        return None
    status, target, _confidence = result
    if status == "resolved" and target in ctx.globals_ctx.classes_by_qualname:
        return target
    return None


def _resolve_via_binding(
    func_expr: ast.expr, ctx: _Ctx
) -> tuple[str, tuple[ResolutionEvidenceSpan, ...]] | None:
    """Fallback resolution for ``self.<attribute>.<method>()`` call sites
    the rest of this module's own syntactic resolution cannot understand
    (see module docstring, "Constructor-binding fallback resolution").
    Returns ``(real_method_entity_id, supporting_resolution_spans)`` only
    when every step resolves unambiguously to a real entity; ``None``
    otherwise, signalling "leave this call site exactly as the rest of the
    pipeline already resolved it" -- never a guess.
    """
    if not isinstance(func_expr, ast.Attribute):
        return None
    method_name = func_expr.attr

    attribute_access = func_expr.value
    if not isinstance(attribute_access, ast.Attribute):
        return None
    attribute_name = attribute_access.attr

    self_ref = attribute_access.value
    if not (isinstance(self_ref, ast.Name) and self_ref.id == "self"):
        return None

    if ctx.current_class is None:
        return None
    class_symbol = _lookup_real_symbol(ctx.current_class.qualname, ctx.globals_ctx)
    if class_symbol is None:
        return None

    matching_bindings = ctx.globals_ctx.bindings_by_key.get((class_symbol.id, attribute_name), [])
    if len(matching_bindings) != 1:
        # No binding for this attribute, or more than one (ambiguous) --
        # never guess which one applies.
        return None
    binding = matching_bindings[0]
    if binding.resolution_status != "resolved" or not binding.target_type_entity_id:
        # A "partial"/"unresolved" binding must never be used to resolve a
        # call -- see module docstring.
        return None

    method_candidates = [
        symbol
        for symbol in ctx.globals_ctx.methods_by_parent.get(binding.target_type_entity_id, [])
        if symbol.name == method_name
    ]
    if len(method_candidates) != 1:
        # No matching method, or more than one (ambiguous) -- never guess.
        return None
    method_symbol = method_candidates[0]

    spans: list[ResolutionEvidenceSpan] = []
    if binding.annotation_span_path is not None:
        spans.append(
            ResolutionEvidenceSpan(
                path=binding.annotation_span_path,
                start_line=binding.annotation_span_start_line,
                end_line=binding.annotation_span_end_line,
                description="constructor parameter annotation",
            )
        )
    if binding.assignment_span_path is not None:
        spans.append(
            ResolutionEvidenceSpan(
                path=binding.assignment_span_path,
                start_line=binding.assignment_span_start_line,
                end_line=binding.assignment_span_end_line,
                description="attribute assignment",
            )
        )
    return method_symbol.id, tuple(spans)


def _resolve_via_direct_construction(
    func_expr: ast.expr, ctx: _Ctx
) -> tuple[str, tuple[ResolutionEvidenceSpan, ...]] | None:
    """Fallback resolution for ``self.<attribute>.<method>()`` call sites
    still unresolved after both the pipeline above AND
    ``_resolve_via_binding`` (see module docstring, "Direct-construction
    fallback resolution"). Returns ``(real_method_entity_id,
    supporting_resolution_spans)`` only when every step resolves
    unambiguously to a real entity; ``None`` otherwise, signalling "leave
    this call site exactly as it already was" -- never a guess.
    """
    if not isinstance(func_expr, ast.Attribute):
        return None
    method_name = func_expr.attr

    attribute_access = func_expr.value
    if not isinstance(attribute_access, ast.Attribute):
        return None
    attribute_name = attribute_access.attr

    self_ref = attribute_access.value
    if not (isinstance(self_ref, ast.Name) and self_ref.id == "self"):
        return None

    if ctx.current_class is None:
        return None
    class_symbol = _lookup_real_symbol(ctx.current_class.qualname, ctx.globals_ctx)
    if class_symbol is None:
        return None

    entry = ctx.globals_ctx.direct_construction_by_key.get((class_symbol.id, attribute_name))
    if entry is None:
        # No direct-construction fact recorded for this (owning class,
        # attribute) pair -- never guess.
        return None
    target_class_entity_id, span_path, span_start_line, span_end_line = entry

    method_candidates = [
        symbol
        for symbol in ctx.globals_ctx.methods_by_parent.get(target_class_entity_id, [])
        if symbol.name == method_name
    ]
    if len(method_candidates) != 1:
        # No matching method, or more than one (ambiguous) -- never guess.
        return None
    method_symbol = method_candidates[0]

    spans = (
        ResolutionEvidenceSpan(
            path=span_path,
            start_line=span_start_line,
            end_line=span_end_line,
            description="direct construction assignment",
        ),
    )
    return method_symbol.id, spans


def _resolve_via_inheritance(
    func_expr: ast.expr, ctx: _Ctx
) -> tuple[str, tuple[ResolutionEvidenceSpan, ...]] | None:
    """Fallback resolution for a bare ``self.method()`` call site the
    ordinary same-class check already leaves ``"unresolved"`` (see module
    docstring, "Inheritance-aware self.method() fallback resolution").
    Returns ``(real_method_entity_id, supporting_resolution_spans)`` only
    when the caller supplied ``inherits`` and the walk finds exactly one
    ancestor defining the method with zero unresolved bases anywhere
    visited; ``None`` otherwise -- never a guess.
    """
    if not isinstance(func_expr, ast.Attribute):
        return None
    method_name = func_expr.attr

    self_ref = func_expr.value
    if not (isinstance(self_ref, ast.Name) and self_ref.id == "self"):
        return None
    # Deliberately excludes super().method() -- func_expr.value there is an
    # ast.Call (super()), not an ast.Name, so the check above already
    # rejects it; this fallback only ever matches a bare `self.<name>`
    # attribute access.

    if ctx.current_class is None:
        return None
    class_symbol = _lookup_real_symbol(ctx.current_class.qualname, ctx.globals_ctx)
    if class_symbol is None:
        return None

    if not ctx.globals_ctx.inherits_by_source and not ctx.globals_ctx.has_unresolved_base:
        # No `inherits` collection was supplied at all -- this fallback is a
        # deliberate no-op in that case (see module docstring), not just an
        # empty search that happens to find nothing.
        return None

    visited: set[str] = {class_symbol.id}
    # `frontier` holds classes whose bases we are about to explore because
    # the class itself does NOT define `method_name` (or is the starting
    # class, which the caller already confirmed doesn't). A class that DOES
    # define the method is a stopping point for its own branch -- its own
    # bases are never explored and its own unresolved-base status (if any)
    # is irrelevant, because Python's own method resolution would already
    # have picked this class's definition before ever needing to consult
    # anything further up that branch. Only classes we still need to look
    # PAST (because they didn't define the method) can hide a
    # precedence-relevant unresolved base.
    frontier: list[str] = [class_symbol.id]
    found: list[tuple[ParsedSymbol, ObservedProgramRelation]] = []

    while frontier:
        next_frontier: list[str] = []
        for current_id in frontier:
            if current_id in ctx.globals_ctx.has_unresolved_base:
                # `current_id` does not define `method_name` (see above) and
                # has at least one base this run's inheritance extraction
                # could not resolve -- that unresolved base might define
                # `method_name` at exactly this point in the MRO, and there
                # is no way to know without guessing. Never guess: the
                # whole call site stays unresolved.
                return None
            for rel in ctx.globals_ctx.inherits_by_source.get(current_id, ()):
                parent_id = rel.target_entity_id
                if parent_id is None or parent_id in visited:
                    continue
                visited.add(parent_id)
                candidates = [
                    symbol
                    for symbol in ctx.globals_ctx.methods_by_parent.get(parent_id, [])
                    if symbol.name == method_name
                ]
                if len(candidates) == 1:
                    found.append((candidates[0], rel))
                    # Stop here on this branch: `parent_id` defines the
                    # method, so it is never added to next_frontier -- its
                    # own bases (and their resolved/unresolved status) are
                    # irrelevant to this branch's answer.
                elif len(candidates) > 1:
                    # The same class defines this method more than once as
                    # a real symbol (e.g. duplicate defs) -- genuinely
                    # ambiguous, never guess.
                    return None
                else:
                    # `parent_id` does not define the method itself --
                    # keep looking past it, on the next level. Its own
                    # unresolved-base status (if any) is checked when it is
                    # popped off `frontier` above.
                    next_frontier.append(parent_id)
        frontier = next_frontier

    if len(found) != 1:
        # Zero ancestors define the method (nothing to resolve to), or two
        # or more DIFFERENT ancestors both define it (a real override
        # ambiguity this extractor's model cannot safely order without
        # full MRO linearization) -- never guess either way.
        return None

    method_symbol, via_relation = found[0]
    span = ResolutionEvidenceSpan(
        path=via_relation.span_path or ctx.module_idx.file_path,
        start_line=via_relation.span_start_line or 0,
        end_line=via_relation.span_end_line or via_relation.span_start_line or 0,
        description="inherits relation used to resolve self.method() through a base class",
    )
    return method_symbol.id, (span,)


def _resolve_via_static_super(
    func_expr: ast.expr, ctx: _Ctx
) -> tuple[str, tuple[ResolutionEvidenceSpan, ...]] | None:
    """Fallback resolution for a zero-argument ``super().method()`` call
    site (see module docstring, "Guarded static super() resolution").
    Returns ``(real_method_entity_id, supporting_resolution_spans)`` only
    when the calling class's declared inheritance chain is fully resolved,
    strictly single-base at every step, and exactly one ancestor (the
    nearest) defines the method; ``None`` otherwise -- never a guess.

    Guards, in order:

    - AST shape: ``super().<name>(...)`` with a bare, zero-argument
      ``super()`` only. The two-argument ``super(C, self)`` form (which can
      deliberately re-anchor the lookup anywhere) is refused.
    - Scope: the call must be directly inside a method of a class this
      module's own walk tracked (``ctx.current_class``); nested functions
      (which get ``current_class=None`` -- see ``_process_function``) never
      fire this fallback.
    - The caller must have supplied ``inherits`` relations at all (same
      opt-in rule as the ``inherited_self_method`` fallback).
    - Chain walk, starting AT the calling class (``super()`` skips the
      calling class's own definition of the method by construction): every
      class the walk stands on must have exactly one declared base, and
      that base must be resolved. A class with any unresolved/external
      base, or with two or more bases (multiple inheritance -- where the
      runtime MRO could interleave the other branch), refuses resolution
      for the whole call site.
    - The first ancestor that defines the method (exactly one real
      ``kind="method"`` symbol of that name under it) is the target --
      precisely where Python's own MRO for a single-base chain stops. An
      ancestor defining the method more than once (duplicate defs) refuses.
      A chain that ends (a class with zero declared bases) without any
      definer refuses -- no unique defining ancestor.
    """
    if not isinstance(func_expr, ast.Attribute):
        return None
    method_name = func_expr.attr

    inner = func_expr.value
    if not (
        isinstance(inner, ast.Call)
        and isinstance(inner.func, ast.Name)
        and inner.func.id == "super"
        and not inner.args
        and not inner.keywords
    ):
        return None

    if ctx.current_class is None:
        return None
    class_symbol = _lookup_real_symbol(ctx.current_class.qualname, ctx.globals_ctx)
    if class_symbol is None:
        return None

    if not ctx.globals_ctx.inherits_by_source and not ctx.globals_ctx.has_unresolved_base:
        # No `inherits` collection was supplied at all -- deliberate no-op,
        # same rule as `_resolve_via_inheritance`.
        return None

    visited: set[str] = {class_symbol.id}
    current_id = class_symbol.id
    spans: list[ResolutionEvidenceSpan] = []
    while True:
        if current_id in ctx.globals_ctx.has_unresolved_base:
            # An unresolved/external base could define (or reorder the
            # lookup of) the method at exactly this point -- never guess.
            return None
        base_relations = ctx.globals_ctx.inherits_by_source.get(current_id, ())
        if len(base_relations) != 1:
            # Zero bases: the chain ended without a defining ancestor.
            # Two or more resolved bases: multiple inheritance, where the
            # runtime MRO after `current_id` may interleave the other
            # branch -- refused either way.
            return None
        rel = base_relations[0]
        parent_id = rel.target_entity_id
        if parent_id is None or parent_id in visited:
            return None
        visited.add(parent_id)
        spans.append(
            ResolutionEvidenceSpan(
                path=rel.span_path or ctx.module_idx.file_path,
                start_line=rel.span_start_line or 0,
                end_line=rel.span_end_line or rel.span_start_line or 0,
                description="inherits relation walked to resolve super().method() along a single-base chain",
            )
        )
        candidates = [
            symbol
            for symbol in ctx.globals_ctx.methods_by_parent.get(parent_id, [])
            if symbol.name == method_name
        ]
        if len(candidates) > 1:
            return None  # duplicate defs on one class -- genuinely ambiguous
        if len(candidates) == 1:
            return candidates[0].id, tuple(spans)
        # `parent_id` does not define the method -- keep walking past it;
        # its own base-shape/resolution guards apply at the top of the next
        # iteration, exactly because the lookup must look PAST it.
        current_id = parent_id


# ---------------------------------------------------------------------------
# Own-scope traversal helpers
# ---------------------------------------------------------------------------


def _iter_own_scope(node: ast.AST):
    """Yield every descendant of ``node`` that belongs to the *same* Python
    scope -- i.e. do not descend into nested function/class/lambda bodies
    (though the boundary nodes themselves are yielded, so callers can
    recurse into them separately with updated context)."""
    for child in ast.iter_child_nodes(node):
        yield child
        if isinstance(child, _SCOPE_BOUNDARY):
            continue
        yield from _iter_own_scope(child)


def _has_parameter_named(func_node: ast.FunctionDef | ast.AsyncFunctionDef, name: str) -> bool:
    """True if ``func_node`` declares a parameter of this name anywhere in
    its signature (positional-only, positional, keyword-only, ``*args`` or
    ``**kwargs``)."""
    arguments = func_node.args
    params = [*arguments.posonlyargs, *arguments.args, *arguments.kwonlyargs]
    if arguments.vararg is not None:
        params.append(arguments.vararg)
    if arguments.kwarg is not None:
        params.append(arguments.kwarg)
    return any(param.arg == name for param in params)


def _binds_name_in_own_scope(func_node: ast.AST, name: str) -> bool:
    """True if ``func_node``'s own scope (never a nested function/class/
    lambda body) binds ``name`` in any way other than as a parameter: an
    assignment/for/with/walrus Store, a ``del``, a ``global``/``nonlocal``
    declaration, a nested def/class of that name, an import binding, an
    ``except ... as`` name, or a match-pattern capture. Deliberately
    over-inclusive (e.g. comprehension targets, which Python actually
    scopes separately, still count): this feeds a *refusal* guard, so
    over-detection can only ever keep a closure binding unused -- never
    produce a wrong resolution."""
    for node in _iter_own_scope(func_node):
        if isinstance(node, ast.Name) and node.id == name and isinstance(node.ctx, (ast.Store, ast.Del)):
            return True
        if isinstance(node, (ast.Global, ast.Nonlocal)) and name in node.names:
            return True
        if isinstance(node, (*_FUNC_TYPES, ast.ClassDef)) and node.name == name:
            return True
        if isinstance(node, ast.alias) and (node.asname or node.name.split(".")[0]) == name:
            return True
        if isinstance(node, ast.ExceptHandler) and node.name == name:
            return True
        if isinstance(node, (ast.MatchAs, ast.MatchStar)) and node.name == name:
            return True
    return False


def _is_instance_method_with_self(method_node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    """True only when ``method_node`` (a def declared directly in a class
    body) observably binds ``self`` as its own first positional parameter:
    the first positional (or positional-only) parameter is literally named
    ``self``, and no ``staticmethod``/``classmethod`` decorator changes what
    that parameter receives. Purely syntactic -- parameter *type
    annotations* are never consulted (an annotation is a claim, not an
    observed binding)."""
    for decorator in method_node.decorator_list:
        if isinstance(decorator, ast.Name) and decorator.id in ("staticmethod", "classmethod"):
            return False
        if isinstance(decorator, ast.Attribute) and decorator.attr in ("staticmethod", "classmethod"):
            return False
    positional = [*method_node.args.posonlyargs, *method_node.args.args]
    return bool(positional) and positional[0].arg == "self"


def _nested_closure_self_class(
    nested_node: ast.FunctionDef | ast.AsyncFunctionDef,
    enclosing_node: ast.AST,
    current_class: _ClassInfo | None,
    closure_self_class: _ClassInfo | None,
) -> _ClassInfo | None:
    """Decide whether ``self`` inside ``nested_node`` (a def declared
    directly in ``enclosing_node``'s scope) deterministically refers to an
    enclosing class method's own ``self`` parameter -- and if so, which
    class it is an instance of. Returns ``None`` (refusal) unless every
    condition holds; a refusal means the nested function's ``self`` is
    treated exactly as before this fallback existed (an ordinary unknown
    name), never a guess.

    Refuses when:

    - the enclosing scope is not a class method with a valid ``self``
      binding: either ``enclosing_node`` is a def directly in a class body
      (``current_class``) whose first positional parameter must literally
      be ``self`` with no ``staticmethod``/``classmethod`` decorator
      (``_is_instance_method_with_self``), or ``enclosing_node`` is itself
      a nested function that already carries a validated
      ``closure_self_class`` -- anything else (module scope, a method
      without a real ``self``, a class body in between) has no safe
      ``self`` to capture;
    - the enclosing method rebinds ``self`` anywhere in its own scope
      (the captured cell's value would then be whatever the rebinding
      produced -- lexical ownership becomes ambiguous);
    - the nested function declares its own parameter named ``self`` (its
      ``self`` is then a local, not the capture);
    - the nested function rebinds ``self`` locally in any form
      (``_binds_name_in_own_scope`` -- assignment, ``del``,
      ``global``/``nonlocal``, a nested def/class/import/except/match
      binding of that name).

    Intermediate nested functions on a deeper chain were already validated
    by this same function when they were entered (their surviving
    ``closure_self_class`` proves they neither shadow nor rebind ``self``),
    so passing it through is sound without re-checking them here.
    """
    if current_class is not None:
        if not isinstance(enclosing_node, _FUNC_TYPES):
            return None
        if not _is_instance_method_with_self(enclosing_node):
            return None
        if _binds_name_in_own_scope(enclosing_node, "self"):
            return None
        owner = current_class
    else:
        owner = closure_self_class
    if owner is None:
        return None
    if _has_parameter_named(nested_node, "self"):
        return None
    if _binds_name_in_own_scope(nested_node, "self"):
        return None
    return owner


def _infer_var_types(func_node: ast.AST, ctx: _Ctx) -> dict[str, str]:
    """See module docstring, "Variable-type tracking". A name is trusted
    only if every direct assignment to it in this function's own scope
    resolves to the same class, unambiguously."""
    candidates: dict[str, set[str | None]] = {}
    for node in _iter_own_scope(func_node):
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            resolved_type: str | None = None
            if isinstance(node.value, ast.Call):
                resolved_type = _resolve_constructor(node.value, ctx)
            candidates.setdefault(name, set()).add(resolved_type)

    var_types: dict[str, str] = {}
    for name, types in candidates.items():
        if len(types) == 1:
            (only,) = types
            if only is not None:
                var_types[name] = only
    return var_types


# ---------------------------------------------------------------------------
# Direct-construction index (Case B -- built once, globally, before any
# per-function relation emission; consumed by ``_resolve_via_direct_construction``)
# ---------------------------------------------------------------------------


def _find_own_init(class_node: ast.ClassDef) -> ast.FunctionDef | None:
    """Only a plain, synchronous ``__init__`` declared directly in the
    class body counts -- never a base class's, never ``async def
    __init__``, never one found only inside a nested ``if``/``try``/``with``
    block at class-body level. Identical restriction to
    ``constructor_binding_extractor._find_init``, duplicated here (not
    imported) to keep this module's own AST walk independently
    self-contained, matching that module's own stated rationale for
    duplicating its helpers rather than importing them."""
    for node in class_node.body:
        if isinstance(node, ast.FunctionDef) and node.name == "__init__":
            return node
    return None


def _direct_construction_map_for_class(
    class_node: ast.ClassDef,
    module_idx: _ModuleIndex,
    class_info: _ClassInfo,
    resolved_imports: dict[str, _ResolvedImport],
    globals_ctx: _GlobalContext,
) -> dict[str, tuple[str, str, int, int]]:
    """Scan ``class_node``'s own ``__init__`` for ``self.<attribute> =
    <ClassExpr>(...)`` statements (direct construction -- see module
    docstring "Direct-construction fallback resolution") and resolve each
    ``<ClassExpr>`` via this module's own existing constructor-call
    resolution machinery (``_resolve_constructor`` -- the same logic
    already used for a bare ``SomeClass()`` call and for the
    variable-type-tracking heuristic). Returns ``attribute_name ->
    (target_class_entity_id, span_path, span_start_line, span_end_line)``
    for attributes that resolve unambiguously; an attribute assigned more
    than once with disagreeing resolutions, or ever assigned something
    other than this exact shape anywhere in ``__init__``, is dropped
    entirely -- never guessed (mirrors ``_infer_var_types``'s "any
    ambiguity anywhere, don't guess" discipline)."""
    init_node = _find_own_init(class_node)
    if init_node is None:
        return {}

    local_defs: dict[str, tuple[str, str]] = {}
    for node in _iter_own_scope(init_node):
        if isinstance(node, _FUNC_TYPES):
            local_defs[node.name] = ("function", module_idx.qualnames[id(node)])
        elif isinstance(node, ast.ClassDef):
            local_defs[node.name] = ("class", module_idx.qualnames[id(node)])

    ctx = _Ctx(
        module_idx=module_idx,
        current_class=class_info,
        var_types={},
        resolved_imports=resolved_imports,
        globals_ctx=globals_ctx,
        local_defs=local_defs,
    )

    candidates: dict[str, set[str | None]] = {}
    spans: dict[str, tuple[int, int]] = {}
    for node in _iter_own_scope(init_node):
        if not (isinstance(node, ast.Assign) and len(node.targets) == 1):
            continue
        target = node.targets[0]
        if not (
            isinstance(target, ast.Attribute)
            and isinstance(target.value, ast.Name)
            and target.value.id == "self"
        ):
            continue
        attribute_name = target.attr

        resolved_id: str | None = None
        value = node.value
        if isinstance(value, ast.Call) and isinstance(value.func, (ast.Name, ast.Attribute)):
            internal_qn = _resolve_constructor(value, ctx)
            if internal_qn is not None:
                real_symbol = _lookup_real_symbol(internal_qn, globals_ctx)
                if real_symbol is not None:
                    resolved_id = real_symbol.id
        # Any other RHS shape (a call whose func isn't a bare/dotted name,
        # a non-call expression, ...) records `None` as a candidate for
        # this attribute -- deliberately contaminating it so a later
        # ambiguity check drops the whole attribute rather than guessing.
        candidates.setdefault(attribute_name, set()).add(resolved_id)
        if resolved_id is not None:
            end_line = node.end_lineno if node.end_lineno is not None else node.lineno
            spans[attribute_name] = (node.lineno, end_line)

    result: dict[str, tuple[str, str, int, int]] = {}
    for attribute_name, resolved_ids in candidates.items():
        if len(resolved_ids) == 1:
            (only,) = resolved_ids
            if only is not None:
                start_line, end_line = spans[attribute_name]
                result[attribute_name] = (only, module_idx.file_path, start_line, end_line)
    return result


def _build_direct_construction_index(
    modules: list[_ModuleIndex], globals_ctx: _GlobalContext
) -> dict[tuple[str, str], tuple[str, str, int, int]]:
    """Build the full ``direct_construction_by_key`` index across every
    analyzed class in every analyzed module -- see ``_GlobalContext``
    docstring. Keyed by ``(owning_class_entity_id, attribute_name)`` (never
    a bare attribute name), so the same attribute name bound to different
    classes on two unrelated owning classes can never be confused with each
    other."""
    index: dict[tuple[str, str], tuple[str, str, int, int]] = {}
    for module_idx in modules:
        resolved_imports = globals_ctx.resolved_imports_by_module[module_idx.module_path]
        for class_node in ast.walk(module_idx.tree):
            if not isinstance(class_node, ast.ClassDef):
                continue
            qualname = module_idx.qualnames.get(id(class_node))
            if qualname is None:
                continue
            class_info = globals_ctx.classes_by_qualname.get(qualname)
            if class_info is None:
                continue
            owning_symbol = _lookup_real_symbol(qualname, globals_ctx)
            if owning_symbol is None:
                # No real ParsedSymbol for this class (extractor/parser
                # scope mismatch -- see module docstring "Known gap") --
                # never fabricate an owning_class_entity_id for it.
                continue
            per_attribute = _direct_construction_map_for_class(
                class_node, module_idx, class_info, resolved_imports, globals_ctx
            )
            for attribute_name, entry in per_attribute.items():
                index[(owning_symbol.id, attribute_name)] = entry
    return index


# ---------------------------------------------------------------------------
# Relation emission (pass 3, continued)
# ---------------------------------------------------------------------------


def _finalize_target(
    resolution: tuple[str, str | None, float | None],
    call_node: ast.Call,
    globals_ctx: _GlobalContext,
) -> tuple[str, str | None, str | None, float | None]:
    """Translate an internal ``(status, internal_qualname_or_None,
    confidence)`` resolution into the real ``(status, target_entity_id,
    target_reference, confidence)`` the shared contract requires, per
    ``resolution_status`` (see ``core.models.program_relation``):

    - "resolved": look the internal qualname up as a real ``ParsedSymbol``.
      If found, ``target_entity_id`` is its ``.id`` and ``target_reference``
      stays unset. If NOT found (this module's own resolution and the real
      parser's symbol table disagree -- see module docstring "Known gap"),
      never fabricate an id: downgrade to "unresolved" with
      ``target_reference`` set to the literal call expression instead.
    - "partial": ``target_reference`` is always set to the literal call
      expression (required regardless, per contract); ``target_entity_id``
      is populated only if the heuristic's target also resolves to a real
      ``ParsedSymbol``.
    - "unresolved": ``target_entity_id`` stays unset; ``target_reference``
      is the literal call expression.
    """
    status, internal_qn, confidence = resolution
    literal_expr = _unparse(call_node.func)

    if status == "resolved":
        symbol = _lookup_real_symbol(internal_qn, globals_ctx)
        if symbol is not None:
            return "resolved", symbol.id, None, None
        return "unresolved", None, literal_expr, None

    if status == "partial":
        symbol = _lookup_real_symbol(internal_qn, globals_ctx)
        target_entity_id = symbol.id if symbol is not None else None
        return "partial", target_entity_id, literal_expr, confidence

    return "unresolved", None, literal_expr, None


def _make_relation(
    *,
    run_id: str,
    source_entity_id: str,
    resolution: tuple[str, str | None, float | None],
    module_idx: _ModuleIndex,
    call_node: ast.Call,
    globals_ctx: _GlobalContext,
    ctx: _Ctx,
) -> ObservedProgramRelation:
    status, target_entity_id, target_reference, confidence = _finalize_target(resolution, call_node, globals_ctx)

    resolution_basis = None
    supporting_resolution_spans: tuple[ResolutionEvidenceSpan, ...] = ()
    if status == "unresolved":
        # Additive fallback only: attempted exclusively for call sites the
        # pipeline above already left unresolved -- see module docstring
        # "Constructor-binding fallback resolution". Never overrides an
        # already-resolved/partial outcome.
        binding_hit = _resolve_via_binding(call_node.func, ctx)
        if binding_hit is not None:
            target_entity_id, supporting_resolution_spans = binding_hit
            status = "resolved"
            target_reference = None
            confidence = None
            resolution_basis = "constructor_binding"
        else:
            # Second, structurally separate additive fallback: only
            # attempted when the constructor-binding fallback above also
            # did not apply -- see module docstring "Direct-construction
            # fallback resolution".
            direct_construction_hit = _resolve_via_direct_construction(call_node.func, ctx)
            if direct_construction_hit is not None:
                target_entity_id, supporting_resolution_spans = direct_construction_hit
                status = "resolved"
                target_reference = None
                confidence = None
                resolution_basis = "direct_construction"
            else:
                # Third, structurally separate additive fallback: a plain
                # self.method() call (not self.<attribute>.<method>(), and
                # never super().method()) left unresolved because `method`
                # isn't defined on the calling class itself -- see module
                # docstring "Inheritance-aware self.method() fallback
                # resolution". Mutually exclusive by AST shape with the two
                # fallbacks above (those require a self.<attribute>.<method>()
                # two-hop chain; this one requires a bare self.<method>()
                # single-hop attribute access), so there is no ordering
                # ambiguity between them.
                inheritance_hit = _resolve_via_inheritance(call_node.func, ctx)
                if inheritance_hit is not None:
                    target_entity_id, supporting_resolution_spans = inheritance_hit
                    status = "resolved"
                    target_reference = None
                    confidence = None
                    resolution_basis = "inherited_self_method"
                else:
                    # Fourth, structurally separate additive fallback: a
                    # zero-argument super().method() call -- see module
                    # docstring "Guarded static super() resolution".
                    # Mutually exclusive by AST shape with all three
                    # fallbacks above (those require a bare `self` Name at
                    # the root of the attribute chain; this one requires a
                    # `super()` Call there), so there is no ordering
                    # ambiguity between them.
                    static_super_hit = _resolve_via_static_super(call_node.func, ctx)
                    if static_super_hit is not None:
                        target_entity_id, supporting_resolution_spans = static_super_hit
                        status = "resolved"
                        target_reference = None
                        confidence = None
                        resolution_basis = "static_super"

    end_line = call_node.end_lineno if call_node.end_lineno is not None else call_node.lineno
    return ObservedProgramRelation.create(
        run_id=run_id,
        relation_kind="calls",
        source_entity_id=source_entity_id,
        extractor_name=EXTRACTOR_NAME,
        extractor_version=EXTRACTOR_VERSION,
        resolution_status=status,  # type: ignore[arg-type]
        target_entity_id=target_entity_id,
        target_reference=target_reference,
        span_path=module_idx.file_path,
        span_start_line=call_node.lineno,
        span_end_line=end_line,
        confidence=confidence,
        resolution_basis=resolution_basis,  # type: ignore[arg-type]
        supporting_resolution_spans=supporting_resolution_spans,
    )


def _process_function(
    func_node: ast.AST,
    module_idx: _ModuleIndex,
    current_class: _ClassInfo | None,
    globals_ctx: _GlobalContext,
    run_id: str,
    closure_self_class: _ClassInfo | None = None,
) -> list[ObservedProgramRelation]:
    internal_qualname = module_idx.qualnames[id(func_node)]
    source_symbol = _lookup_real_symbol(internal_qualname, globals_ctx)
    resolved_imports = globals_ctx.resolved_imports_by_module[module_idx.module_path]
    local_defs: dict[str, tuple[str, str]] = {}
    for node in _iter_own_scope(func_node):
        if isinstance(node, _FUNC_TYPES):
            local_defs[node.name] = ("function", module_idx.qualnames[id(node)])
        elif isinstance(node, ast.ClassDef):
            local_defs[node.name] = ("class", module_idx.qualnames[id(node)])

    typing_ctx = _Ctx(
        module_idx=module_idx,
        current_class=current_class,
        var_types={},
        resolved_imports=resolved_imports,
        globals_ctx=globals_ctx,
        local_defs=local_defs,
        closure_self_class=closure_self_class,
    )
    var_types = _infer_var_types(func_node, typing_ctx)
    ctx = _Ctx(
        module_idx=module_idx,
        current_class=current_class,
        var_types=var_types,
        resolved_imports=resolved_imports,
        globals_ctx=globals_ctx,
        local_defs=local_defs,
        closure_self_class=closure_self_class,
    )

    relations: list[ObservedProgramRelation] = []
    for node in _iter_own_scope(func_node):
        if isinstance(node, ast.Call):
            if source_symbol is None:
                # No real, run-scoped ParsedSymbol exists for the enclosing
                # function/method itself (see module docstring "Known
                # gap") -- there is no valid, non-fabricated entity to use
                # as source_entity_id, so calls made directly in this scope
                # cannot be emitted as relations at all.
                continue
            resolution = _resolve_call(node.func, ctx)
            if resolution is None:
                continue
            relations.append(
                _make_relation(
                    run_id=run_id,
                    source_entity_id=source_symbol.id,
                    resolution=resolution,
                    module_idx=module_idx,
                    call_node=node,
                    globals_ctx=globals_ctx,
                    ctx=ctx,
                )
            )
        elif isinstance(node, _FUNC_TYPES):
            # Nested function: its own source entity, not a method of the
            # enclosing class even if the enclosing scope is a method
            # (current_class is therefore never propagated). What CAN
            # propagate is a deterministic closure capture of the enclosing
            # method's `self` -- computed here, with every refusal condition
            # checked, and None whenever the capture is not provably safe
            # (see _nested_closure_self_class).
            nested_closure = _nested_closure_self_class(
                node, func_node, current_class, closure_self_class
            )
            relations.extend(
                _process_function(
                    node, module_idx, None, globals_ctx, run_id, closure_self_class=nested_closure
                )
            )
        elif isinstance(node, ast.ClassDef):
            relations.extend(_process_class(node, module_idx, globals_ctx, run_id))

    return relations


def _process_class(
    class_node: ast.ClassDef,
    module_idx: _ModuleIndex,
    globals_ctx: _GlobalContext,
    run_id: str,
) -> list[ObservedProgramRelation]:
    class_info = module_idx.classes.get(class_node.name)  # None for nested (non-top-level) classes
    relations: list[ObservedProgramRelation] = []
    for item in class_node.body:
        if isinstance(item, _FUNC_TYPES):
            relations.extend(_process_function(item, module_idx, class_info, globals_ctx, run_id))
        elif isinstance(item, ast.ClassDef):
            relations.extend(_process_class(item, module_idx, globals_ctx, run_id))
    return relations


def _process_module(module_idx: _ModuleIndex, globals_ctx: _GlobalContext, run_id: str) -> list[ObservedProgramRelation]:
    relations: list[ObservedProgramRelation] = []
    for node in module_idx.tree.body:
        if isinstance(node, _FUNC_TYPES):
            relations.extend(_process_function(node, module_idx, None, globals_ctx, run_id))
        elif isinstance(node, ast.ClassDef):
            relations.extend(_process_class(node, module_idx, globals_ctx, run_id))
        # Bare module-level calls are intentionally not emitted -- see
        # module docstring ("What is explicitly OUT of scope").
    return relations


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def extract_call_relations(
    job: AnalysisJob,
    symbols: Iterable[ParsedSymbol],
    *,
    file_paths: Sequence[str] | None = None,
    bindings: Iterable[ConstructorAttributeBinding] = (),
    inherits: Iterable[ObservedProgramRelation] = (),
) -> tuple[ObservedProgramRelation, ...]:
    """Extract ``calls`` relations from a real, already-snapshotted
    ``AnalysisJob``, using the caller-supplied ``symbols`` -- the same
    ``ParsedSymbol`` collection the real pipeline's own parsing stage
    already produced (see ``app.parsing.parse_supported_files.parse_supported_files``)
    -- as the sole source of real, run-scoped entity ids. This module never
    parses symbols itself (see module docstring's "Entity identity"
    section): it only reads raw file *content* (via ``SourceReader``) for
    its own AST walk, and looks up ids in ``symbols``.

    ``job`` must already have a ``RepoSnapshot`` attached (``job.snapshot``).
    ``file_paths`` is a list of repository-relative paths (POSIX-style,
    e.g. ``"pkg/mod.py"``) to analyze together as one tree, so imports
    between them (see module docstring for exactly which import forms are
    resolved) can be resolved deterministically; a name imported from a
    file not present in ``file_paths`` is treated as external and left
    unresolved. If ``file_paths`` is omitted, every readable ``*.py``/
    ``*.pyi`` file discovered under ``job.snapshot`` is analyzed.

    ``bindings`` is an optional, additive collection of
    ``ConstructorAttributeBinding`` (``core.models.constructor_binding``)
    records -- typically produced by a separate constructor-binding
    extractor -- consulted only as a fallback for ``self.<attribute>.<method>()``
    call sites this module's own direct syntactic resolution cannot resolve
    (see module docstring, "Constructor-binding fallback resolution").
    Defaults to ``()``: omitting it entirely reproduces exactly the same
    output as before this parameter existed, for every existing caller.

    ``inherits`` is an optional, additive collection of already-resolved
    ``ObservedProgramRelation`` (``relation_kind="inherits"``) records --
    typically ``app.analysis.python_inheritance_extractor``'s own output
    for the same run -- consulted only as a fallback for a bare
    ``self.method()`` call site left unresolved because ``method`` isn't
    defined on the calling class itself (see module docstring,
    "Inheritance-aware self.method() fallback resolution"). Defaults to
    ``()``: omitting it entirely reproduces exactly the same output as
    before this parameter existed, for every existing caller.

    Returns a tuple of ``ObservedProgramRelation`` (``relation_kind ==
    "calls"``), in file-then-source order (stable, but not an API
    guarantee beyond determinism: the same inputs always produce the same
    sequence, including the same relation ids).
    """
    run_id = job.run_id
    reader = SourceReader(job)

    if file_paths is None:
        paths = sorted(f.path for f in reader.list_files() if f.language == "python" and f.readable)
    else:
        paths = sorted(file_paths)

    # Materialize once: both the qualified_name-keyed table below and the
    # constructor-binding fallback's own by-parent method index need to walk
    # the caller-supplied symbols, and `symbols` is only an Iterable (may not
    # be safely re-iterable).
    symbols_list: list[ParsedSymbol] = list(symbols)

    # Index every caller-supplied symbol by its qualified_name. Not
    # filtered to the analyzed file set: qualified_name already embeds the
    # file path (see module docstring point 1), so a broader table is
    # simpler and harmless -- this module's own resolution logic can only
    # ever look up a key it derived from an analyzed file's own AST.
    symbol_table: dict[str, ParsedSymbol] = {symbol.qualified_name: symbol for symbol in symbols_list}

    modules: list[_ModuleIndex] = []
    for path in paths:
        file = reader.get_file(path)
        content = str(reader.read_file_content(path)["content"])
        modules.append(_build_module_index(path, content, language=file.language))

    globals_ctx = _build_global_context(modules, symbol_table, bindings, symbols_list, inherits)

    relations: list[ObservedProgramRelation] = []
    for module_idx in modules:
        relations.extend(_process_module(module_idx, globals_ctx, run_id))
    return tuple(relations)
