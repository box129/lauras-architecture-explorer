"""Deterministic structural-navigation fallback for the architecture map.

Root cause this module exists to fix: ``ArchitectureMapProjector.children()``
returns real children for the map ROOT only from ``SystemOverview
.main_components`` -- a list produced by ``SystemOverviewGenerator``, which
is itself either LLM-generated (when a live legacy investigation model is
configured and reachable) or a degenerate single-node summary with **zero**
components when it is not. ``AnalysisController`` always analyzes with
``NoConfiguredModel()`` (unchanged, see its own module), so whether a
repository's map is navigable at all currently depends on whatever legacy
LLM configuration happens to be live at the moment someone first opens
``GET /api/architecture-map`` for that run -- for a small repository (few
files), the no-LLM summary path apparently never splits into multiple
components even when real, analyzed symbols exist. A real user hit exactly
this with ``research/provenance-evaluation/fixtures/python_app/``: the map
showed one root node, "1 areas - 0 links", with no way to reach any class
or method.

This module does NOT touch ``SystemOverviewGenerator``, ``ArchitectureMap
Projector``'s existing LLM-aware code paths, or ``AnalysisController`` --
it is a purely additive, deterministic alternative used ONLY when the
normal projection has nothing to offer. It builds a
``package (directory) -> module (file) -> symbol`` hierarchy directly from
``ParsedSymbol`` facts already persisted by the (non-LLM) parsing stage --
the exact same facts ``ArchitectureMapProjector._module_children``/
``_symbol_children``/``_static_symbol_node`` already use for the deepest,
already-deterministic level of a normal (LLM-classified) map. Those
existing functions are reused unchanged for the symbol level; this module
only adds the two levels above them (package, module) that would otherwise
require ``SystemOverview.main_components`` to exist at all.

No architecture is inferred: every package/module node here corresponds
1:1 to a real directory/file that real, persisted symbols were found in;
no relationship/edge is fabricated (a fallback node's "children" express
containment via the tree itself, not an ``ArchitectureMapEdge`` claiming a
semantic relationship). ``kind`` is a new, distinct value
(``structural_package`` / ``structural_module``) specifically so these
never look like an LLM-classified ``system``/``product_area``/``subsystem``/
``component`` node in the UI (both canvas and accessible table render
``kind`` as plain text -- see ``ArchitectureMapCanvas.tsx``).

Phase B/C1 addendum (``build_containment_hierarchy`` below): the functions
above activate only when ``SystemOverview.main_components`` is completely
empty. The MUCH more common deployed case is the opposite:
``build_static_structure`` (``app/analysis/static_structure.py``) already
produced one real, file-shaped ``OverviewComponent`` (``kind="module"``,
``label=<repo-relative path>``) per analyzed file -- so ``main_components``
is non-empty, but flat: every file is its own top-level Overview node, with
no grouping above it (this is the "wall of same-looking boxes" Participant
#1 could not read as an architecture, and -- even after Phase B's own
single-level directory grouping -- still substantially the shape
Participant #2 saw). ``build_containment_hierarchy`` generalizes this
module's existing, already-tested directory-grouping primitive
(``_directory_of``) to that common case, RECURSIVELY: it groups the flat,
file-shaped component list into a real, potentially multi-level
containment tree of ``kind="structural_group"`` Overview nodes by real
directory containment only, returned as the PRIMARY Overview node set (not
a last-resort fallback). ``kind`` is a third, distinct value from
``structural_package``/``structural_module`` specifically because it
groups something those two never see (a non-empty, file-shaped
``main_components`` list) -- conflating the two would make one ``kind``
value mean two different activation conditions, defeating the point of
``kind`` being a precise, inspectable signal. A container node (has real
sub-containers/leaf buckets) and a leaf node (has real member components
directly) share this SAME ``kind`` deliberately -- see
``build_containment_hierarchy``'s own docstring for why that is not a
missing distinction but a considered one.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
from collections import defaultdict

from syntax_tree_refurbished.core.models.architecture_map import ArchitectureMapEdge, ArchitectureMapNode
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.system_overview import OverviewComponent

PACKAGE_PREFIX = "structural-package:"
MODULE_PREFIX = "structural-module:"
GROUP_PREFIX = "structural-group:"

# Phase B (deterministic grouped Overview) activation/threshold constants --
# see build_containment_hierarchy()'s own docstring for the full rule.
MIN_SECTIONS_FOR_GROUPING = 2
MAX_REPRESENTATIVE_MEMBERS = 5
ROOT_BUCKET_KEY = ""
ROOT_BUCKET_LABEL = "Repository root files"
# Phase C1: hard bound on real (post-compression) containment nesting depth
# -- prevents a pathologically deep directory chain (e.g. a/b/c/d/e/f/g/...)
# from producing unbounded ReactFlow parent chains. Beyond this depth,
# everything still under the deepest allowed container collapses into one
# flat leaf bucket labeled with the real remaining path -- never hidden,
# never split further.
CONTAINER_MAX_DEPTH = 6


def is_package_id(node_id: str) -> bool:
    return node_id.startswith(PACKAGE_PREFIX)


def is_module_id(node_id: str) -> bool:
    return node_id.startswith(MODULE_PREFIX)


def is_group_id(node_id: str) -> bool:
    return node_id.startswith(GROUP_PREFIX)


def is_structural_fallback_id(node_id: str) -> bool:
    return is_package_id(node_id) or is_module_id(node_id)


def _stable_id(prefix: str, run_id: str, *parts: str) -> str:
    raw = "|".join([run_id, *parts])
    return f"{prefix}{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"


def _directory_of(path: str) -> str:
    """Repository-relative paths are always POSIX-style (see
    ``ParsedSymbol``'s own docstring: ``.relative_to(root).as_posix()``),
    so a plain ``/`` split is safe cross-platform. Returns "" for a file
    directly at the repository root (no package grouping needed)."""
    return path.rsplit("/", 1)[0] if "/" in path else ""


def _files_with_symbols(symbols: tuple[ParsedSymbol, ...]) -> dict[str, list[ParsedSymbol]]:
    by_file: dict[str, list[ParsedSymbol]] = defaultdict(list)
    for symbol in symbols:
        by_file[symbol.path].append(symbol)
    return dict(by_file)


def has_fallback_content(symbols: tuple[ParsedSymbol, ...]) -> bool:
    """Activation condition: real, analyzed symbols exist for this run.
    (Callers additionally require that the normal projection found zero
    real components before using this module at all -- see
    ``ArchitectureMapProjector._structural_fallback_children``.)"""
    return len(symbols) > 0


def root_children(
    run_id: str, symbols: tuple[ParsedSymbol, ...]
) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]]:
    """The map root's fallback children: one node per distinct package
    (directory) that contains at least one analyzed file, plus one node
    per analyzed file directly at the repository root (no package
    grouping needed for those)."""
    by_file = _files_with_symbols(symbols)
    by_directory: dict[str, list[str]] = defaultdict(list)
    root_level_files: list[str] = []
    for path in by_file:
        directory = _directory_of(path)
        if directory:
            by_directory[directory].append(path)
        else:
            root_level_files.append(path)

    nodes: list[ArchitectureMapNode] = []
    for directory, paths in sorted(by_directory.items()):
        nodes.append(_package_node(run_id, directory, paths, by_file))
    for path in sorted(root_level_files):
        nodes.append(_module_node(run_id, path, by_file[path]))
    return tuple(nodes), ()


def package_children(
    run_id: str, package_id: str, symbols: tuple[ParsedSymbol, ...]
) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]]:
    by_file = _files_with_symbols(symbols)
    paths_by_package_id = _directory_for_package_id(run_id, by_file)
    paths = paths_by_package_id.get(package_id, [])
    nodes = tuple(_module_node(run_id, path, by_file[path]) for path in sorted(paths))
    return nodes, ()


def module_children(
    run_id: str, module_id: str, symbols: tuple[ParsedSymbol, ...]
) -> tuple[tuple[ArchitectureMapNode, ...], tuple[ArchitectureMapEdge, ...]] | None:
    """Returns None (not an empty tuple) when ``module_id`` does not
    resolve to a known fallback module, so the caller can distinguish
    "this is a fallback module with zero top-level symbols" (empty tuple)
    from "this id is not a fallback module at all" (None)."""
    by_file = _files_with_symbols(symbols)
    for path, file_symbols in by_file.items():
        if _stable_id(MODULE_PREFIX, run_id, path) == module_id:
            top_level = tuple(s for s in file_symbols if not s.parent_symbol_id)
            return top_level_symbol_nodes(run_id, module_id, top_level), ()
    return None


def top_level_symbol_nodes(
    run_id: str, source_node_id: str, symbols: tuple[ParsedSymbol, ...]
) -> tuple[ArchitectureMapNode, ...]:
    """Builds real symbol nodes via the same construction shape
    ``ArchitectureMapProjector._static_symbol_node`` uses (id=real
    ``symbol.id``, so these are indistinguishable from, and behave
    identically to, symbol nodes reached through a normal LLM-classified
    map -- in particular they work with the existing ``Architectural
    Explanation`` button unchanged, since that only ever needs a real
    entity id). Deliberately duplicated here in miniature (only the
    fields this module can compute without a store lookup) rather than
    calling the projector's private method, to keep this module
    store-independent and unit-testable with plain ``ParsedSymbol``
    values; ``ArchitectureMapProjector`` still uses its own
    ``_static_symbol_node`` for children of a REAL symbol node (see
    ``children()``'s existing ``_symbol_children`` dispatch, unchanged).
    """
    nodes = []
    for symbol in symbols:
        nodes.append(
            ArchitectureMapNode(
                id=symbol.id,
                analysis_run_id=run_id,
                label=symbol.name,
                kind="component" if symbol.kind in {"class", "interface"} else "code_group",
                level=2,
                description=f"{symbol.signature or symbol.kind} in {symbol.path}:{symbol.start_line}-{symbol.end_line}.",
                status="verified",
                confidence=1.0,
                source_refs={"source_region_ids": [symbol.source_region_id], "symbol_ids": [symbol.id]},
                evidence_count=1,
                children_count=0,
                can_drilldown=False,
                primary_files=(symbol.path,),
                related_concept_ids=(),
                related_flow_ids=(),
                graph_qn=symbol.qualified_name,
                legacy_type=symbol.kind,
                warnings=(),
                unsupported_reason=None,
            )
        )
    return tuple(nodes)


def resolve_node(
    node_id: str, run_id: str, symbols: tuple[ParsedSymbol, ...]
) -> ArchitectureMapNode | None:
    """Resolves a package_id or module_id (NOT a real symbol id -- those
    are already handled by the projector's own ``_static_symbol``) to its
    own node representation, so ``ArchitectureMapProjector.node()`` can
    recognize a fallback id before ``children()`` is ever called for it
    (the ``/children`` route 404s upfront if ``.node()`` returns None)."""
    by_file = _files_with_symbols(symbols)
    by_directory: dict[str, list[str]] = defaultdict(list)
    for path in by_file:
        directory = _directory_of(path)
        if directory:
            by_directory[directory].append(path)

    for directory, paths in by_directory.items():
        if _stable_id(PACKAGE_PREFIX, run_id, directory) == node_id:
            return _package_node(run_id, directory, paths, by_file)
    for path, file_symbols in by_file.items():
        if _stable_id(MODULE_PREFIX, run_id, path) == node_id:
            return _module_node(run_id, path, file_symbols)
    return None


def _directory_for_package_id(run_id: str, by_file: dict[str, list[ParsedSymbol]]) -> dict[str, list[str]]:
    by_directory: dict[str, list[str]] = defaultdict(list)
    for path in by_file:
        directory = _directory_of(path)
        if directory:
            by_directory[directory].append(path)
    return {_stable_id(PACKAGE_PREFIX, run_id, directory): paths for directory, paths in by_directory.items()}


def _package_node(
    run_id: str, directory: str, paths: list[str], by_file: dict[str, list[ParsedSymbol]]
) -> ArchitectureMapNode:
    symbol_count = sum(len(by_file[p]) for p in paths)
    return ArchitectureMapNode(
        id=_stable_id(PACKAGE_PREFIX, run_id, directory),
        analysis_run_id=run_id,
        label=directory,
        kind="structural_package",
        level=1,
        description=(
            f"Directory '{directory}', containing {len(paths)} analyzed file(s) and {symbol_count} "
            "analyzed symbol(s). Structural fallback: no live LLM classified this as an architectural "
            "area, so this reflects real repository/file structure directly."
        ),
        status="verified",
        confidence=1.0,
        source_refs={"file_paths": list(paths)},
        evidence_count=symbol_count,
        children_count=len(paths),
        can_drilldown=len(paths) > 0,
        primary_files=tuple(sorted(paths)),
        related_concept_ids=(),
        related_flow_ids=(),
        graph_qn=directory,
        legacy_type=None,
        warnings=(),
        unsupported_reason=None,
    )


def _is_file_shaped(components: tuple[OverviewComponent, ...]) -> bool:
    return bool(components) and all(component.kind == "module" for component in components)


def _directory_sections(
    prefix: str, components: tuple[OverviewComponent, ...]
) -> tuple[list[OverviewComponent], dict[str, list[OverviewComponent]]]:
    """Partitions ``components`` (every real component whose path is
    ``prefix`` or a descendant of it) into files directly at ``prefix``
    and buckets of components one further path segment down, keyed by
    that segment. Same plain POSIX-split primitive ``root_children`` uses,
    generalized to an arbitrary prefix instead of only the repository
    root."""
    direct: list[OverviewComponent] = []
    subdirs: dict[str, list[OverviewComponent]] = defaultdict(list)
    offset = len(prefix) + 1 if prefix else 0
    for component in components:
        rest = component.label[offset:]
        if "/" in rest:
            subdirs[rest.split("/", 1)[0]].append(component)
        else:
            direct.append(component)
    return direct, subdirs


def _compress(
    prefix: str, components: tuple[OverviewComponent, ...], depth: int
) -> tuple[str, list[OverviewComponent], dict[str, list[OverviewComponent]], int, int]:
    """Follows a chain of single-child directories (no files directly
    present at any step) forward, accumulating the real combined path,
    until reaching either a real branch point (>= MIN_SECTIONS_FOR_GROUPING
    sections) or a terminal bucket (files present with nothing further to
    branch into, or CONTAINER_MAX_DEPTH reached). This is what turns a
    pointless chain of single-child wrapper directories (e.g. a repo where
    ``backend`` contains only ``src``, which contains only real branching)
    into ONE honestly-labeled node (``"backend/src"``) instead of two
    nested boxes where the outer one contains nothing but the inner one --
    while still fully recursing into genuine branch points at any depth.
    Returns ``(compressed_prefix, direct_files, subdirs, section_count,
    final_depth)``."""
    direct, subdirs = _directory_sections(prefix, components)
    section_count = (1 if direct else 0) + len(subdirs)
    if not direct and len(subdirs) == 1 and depth < CONTAINER_MAX_DEPTH:
        ((only_segment, only_components),) = subdirs.items()
        next_prefix = f"{prefix}/{only_segment}" if prefix else only_segment
        return _compress(next_prefix, tuple(only_components), depth + 1)
    return prefix, direct, subdirs, section_count, depth


@dataclass(frozen=True)
class ContainmentHierarchy:
    """The full result of ``build_containment_hierarchy()``: every real
    level of the deterministic containment tree, flattened into
    ``all_nodes`` (each carrying ``parent_group_id``, so a frontend can
    reconstruct real nested containers), plus the lookups
    ``ArchitectureMapProjector`` needs to resolve one specific node's
    children without re-walking the whole tree."""

    top_level: tuple[ArchitectureMapNode, ...]
    all_nodes: tuple[ArchitectureMapNode, ...]
    children_by_id: dict[str, tuple[ArchitectureMapNode, ...]]
    leaf_members_by_id: dict[str, tuple[OverviewComponent, ...]]


def build_containment_hierarchy(
    run_id: str, components: tuple[OverviewComponent, ...]
) -> ContainmentHierarchy | None:
    """Phase C1's primary-Overview grouping rule: a real, potentially
    multi-level deterministic containment tree (directory ancestry only --
    no relation clustering, no LLM, no keyword heuristic).

    Activates under the exact same conditions Phase B established: every
    component in ``components`` must be file-shaped (``kind == "module"``),
    and the repository-root partition itself must produce at least
    ``MIN_SECTIONS_FOR_GROUPING`` (2) sections -- otherwise returns
    ``None`` and the caller must fall back to today's flat per-file
    Overview (flat/nearly-flat repository degrade, unchanged from Phase B).

    Unlike Phase B, a "section" here is not always a single flat directory
    bucket: ``_compress`` walks forward through any chain of single-child
    directories (no files directly present) so a real branch point is
    never buried under a pointless one-child wrapper, and each real branch
    point recurses into its own children the same way -- so the returned
    tree can have real nesting to depth ``CONTAINER_MAX_DEPTH``. A node
    with no further real branching underneath it is a leaf
    (``leaf_members_by_id``); a node that does branch is a container
    (``children_by_id``) whose children are themselves either containers
    or leaves. Every node, container or leaf alike, is the SAME
    ``kind="structural_group"`` -- they differ only in whether the node id
    appears as a key in ``children_by_id`` (has real sub-containers/leaf
    buckets) or ``leaf_members_by_id`` (has real member components
    directly) in the returned ``ContainmentHierarchy``; this is a
    deliberately derived distinction, not a second kind value, since both
    represent the exact same epistemic fact (real directory containment)
    at different depths.

    Every node's ``children_count``/``primary_files`` are computed
    RECURSIVELY (every real file-backed module anywhere underneath it,
    not just its direct children) -- for a leaf this is identical to
    Phase B's existing direct-count meaning, since a leaf has no deeper
    nesting to differ from.
    """
    if not _is_file_shaped(components):
        return None
    prefix, direct, subdirs, section_count, _ = _compress("", components, 0)
    if section_count < MIN_SECTIONS_FOR_GROUPING:
        return None
    all_nodes: list[ArchitectureMapNode] = []
    children_by_id: dict[str, tuple[ArchitectureMapNode, ...]] = {}
    leaf_members_by_id: dict[str, tuple[OverviewComponent, ...]] = {}
    top_level: list[ArchitectureMapNode] = []
    # The compressed repository-root prefix never becomes a visible node
    # itself (it would be a single all-encompassing wrapper around 100% of
    # the repository, redundant with the map's own root node) -- its
    # direct files/subdirectories become the TOP-LEVEL nodes directly.
    if direct:
        top_level.append(
            _direct_files_bucket_node(run_id, prefix, direct, 1, None, all_nodes, leaf_members_by_id)
        )
    for segment, sub_components in sorted(subdirs.items()):
        sub_prefix = f"{prefix}/{segment}" if prefix else segment
        top_level.append(
            _build_node(
                run_id, sub_prefix, tuple(sub_components), 1, None,
                all_nodes, children_by_id, leaf_members_by_id,
            )
        )
    return ContainmentHierarchy(
        top_level=tuple(top_level),
        all_nodes=tuple(all_nodes),
        children_by_id=children_by_id,
        leaf_members_by_id=leaf_members_by_id,
    )


def _build_node(
    run_id: str,
    prefix: str,
    components: tuple[OverviewComponent, ...],
    depth: int,
    parent_id: str | None,
    all_nodes: list[ArchitectureMapNode],
    children_by_id: dict[str, tuple[ArchitectureMapNode, ...]],
    leaf_members_by_id: dict[str, tuple[OverviewComponent, ...]],
) -> ArchitectureMapNode:
    """Builds (and registers into ``all_nodes``/the lookup dicts) the node
    for ``prefix``, compressing it first if it is itself a single-child
    chain, then recursing into real children if it turns out to be a
    branch point."""
    compressed_prefix, direct, subdirs, section_count, final_depth = _compress(prefix, components, depth)
    is_container = section_count >= MIN_SECTIONS_FOR_GROUPING and final_depth < CONTAINER_MAX_DEPTH
    node_id = _stable_id(GROUP_PREFIX, run_id, "path", compressed_prefix)
    ordered = tuple(sorted(components, key=lambda c: c.label))
    node = ArchitectureMapNode(
        id=node_id,
        analysis_run_id=run_id,
        label=compressed_prefix,
        kind="structural_group",
        level=final_depth,
        description=_container_description(compressed_prefix, is_container, len(ordered)),
        status="verified",
        confidence=None,
        source_refs={"component_ids": [c.id for c in ordered]},
        evidence_count=0,
        children_count=len(ordered),
        can_drilldown=True,
        primary_files=tuple(c.label for c in ordered[:MAX_REPRESENTATIVE_MEMBERS]),
        related_concept_ids=(),
        related_flow_ids=(),
        graph_qn=compressed_prefix,
        legacy_type=None,
        warnings=(),
        unsupported_reason=None,
        parent_group_id=parent_id,
    )
    all_nodes.append(node)
    if not is_container:
        leaf_members_by_id[node_id] = ordered
        return node
    child_nodes: list[ArchitectureMapNode] = []
    if direct:
        child_nodes.append(
            _direct_files_bucket_node(
                run_id, compressed_prefix, direct, final_depth + 1, node_id, all_nodes, leaf_members_by_id
            )
        )
    for segment, sub_components in sorted(subdirs.items()):
        sub_prefix = f"{compressed_prefix}/{segment}"
        child_nodes.append(
            _build_node(
                run_id, sub_prefix, tuple(sub_components), final_depth + 1, node_id,
                all_nodes, children_by_id, leaf_members_by_id,
            )
        )
    children_by_id[node_id] = tuple(child_nodes)
    return node


def _direct_files_bucket_node(
    run_id: str,
    prefix: str,
    members: list[OverviewComponent],
    depth: int,
    parent_id: str | None,
    all_nodes: list[ArchitectureMapNode],
    leaf_members_by_id: dict[str, tuple[OverviewComponent, ...]],
) -> ArchitectureMapNode:
    """A leaf bucket for files that sit directly at ``prefix`` (the true
    repository root when ``prefix == ""``, honestly labeled
    ``ROOT_BUCKET_LABEL``; or, in the rarer case of a branch point that
    also has files directly in it alongside real subdirectories, labeled
    as that path's own direct files -- disambiguated from the sibling
    container node that shares the same real path)."""
    ordered = tuple(sorted(members, key=lambda c: c.label))
    label = ROOT_BUCKET_LABEL if not prefix else f"{prefix} (direct files)"
    node_id = _stable_id(GROUP_PREFIX, run_id, "direct-files", prefix)
    node = ArchitectureMapNode(
        id=node_id,
        analysis_run_id=run_id,
        label=label,
        kind="structural_group",
        level=depth,
        description=(
            f"{len(ordered)} module(s) directly at the repository root (not inside any subdirectory)."
            if not prefix
            else f"{len(ordered)} module(s) directly inside '{prefix}' (not inside any further subdirectory)."
        ),
        status="verified",
        confidence=None,
        source_refs={"component_ids": [c.id for c in ordered]},
        evidence_count=0,
        children_count=len(ordered),
        can_drilldown=True,
        primary_files=tuple(c.label for c in ordered[:MAX_REPRESENTATIVE_MEMBERS]),
        related_concept_ids=(),
        related_flow_ids=(),
        graph_qn=prefix or ROOT_BUCKET_KEY,
        legacy_type=None,
        warnings=(),
        unsupported_reason=None,
        parent_group_id=parent_id,
    )
    all_nodes.append(node)
    leaf_members_by_id[node_id] = ordered
    return node


def _container_description(prefix: str, is_container: bool, count: int) -> str:
    kind_word = "region" if is_container else "section"
    scope = "across its nested sections" if is_container else ""
    return (
        f"Repository {kind_word} '{prefix}', containing {count} module(s){' ' + scope if scope else ''}. "
        "Grouped by real directory containment only -- no architectural category was inferred."
    )


def _module_node(run_id: str, path: str, file_symbols: list[ParsedSymbol]) -> ArchitectureMapNode:
    top_level_count = sum(1 for s in file_symbols if not s.parent_symbol_id)
    return ArchitectureMapNode(
        id=_stable_id(MODULE_PREFIX, run_id, path),
        analysis_run_id=run_id,
        label=path.rsplit("/", 1)[-1],
        kind="structural_module",
        level=2,
        description=(
            f"File '{path}', containing {top_level_count} top-level analyzed symbol(s). Structural "
            "fallback: no live LLM classified this as an architectural area, so this reflects the real "
            "file directly."
        ),
        status="verified",
        confidence=1.0,
        source_refs={"symbol_ids": [s.id for s in file_symbols]},
        evidence_count=len(file_symbols),
        children_count=top_level_count,
        can_drilldown=top_level_count > 0,
        primary_files=(path,),
        related_concept_ids=(),
        related_flow_ids=(),
        graph_qn=path,
        legacy_type=None,
        warnings=(),
        unsupported_reason=None,
    )
