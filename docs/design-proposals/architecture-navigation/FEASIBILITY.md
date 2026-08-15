# Architecture Navigation Redesign — Feasibility

Status: DESIGN/DATA-FEASIBILITY REVIEW ONLY. No product source was changed to produce this
document. Evidence gathered by reading `syntax-tree-refurbished-backend` and `syntax-tree-ui`
at HEAD `02e19040999c89532ee4ca7db70680b6aa20667e` on `product/end-user-acceptance`.

## 1. Current graph architecture (backend)

Two independent generation paths feed the architecture map, selected per-request by whether a
live investigation model is injected:

- `syntax_tree_refurbished/api/routes/architecture_map.py:_model()` (lines 189-214) **always**
  returns `NoConfiguredModel()` unless `request.app.state.investigation_model` was explicitly
  set. The inline comment explains why: an earlier bug let ordinary map navigation fire live
  LLM traffic; this was deliberately closed so "merely opening the map or clicking through it"
  can never trigger a legacy provider call. In the deployed product today, **every
  `/api/architecture-map*` request goes through the deterministic path** unless a caller
  explicitly injects a model into app state.
- The deterministic path: `SystemOverviewGenerator._degraded_overview()`
  (`app/overview/system_overview_generator.py:181-257`) calls
  `build_static_structure()` (`app/analysis/static_structure.py:27-103`), which emits **one
  `OverviewComponent` per source file** (`kind="module"`, `label=<repo-relative path>`,
  `confidence=0.98`, `support_status="verified"`) plus deterministic AST/regex-derived
  `imports` relationships between files.
- `ArchitectureMapProjector` (`app/architecture_map/projection.py`) projects
  `SystemOverview.main_components` 1:1 into `ArchitectureMapNode`s at `level=1`, with `kind`
  assigned by a small closed keyword match over the node's own label+kind text (`_node_kind`,
  lines 828-834: `external_boundary` / `cross_cutting` / else `component`). No grouping layer
  exists above this level in the deterministic path.
- The **only** genuinely LLM-driven path (`_overview_from_investigation`, only reached when a
  live model *is* injected and *does* respond) asks the model directly for "main architecture
  areas" (`ARCHITECTURE_DISCOVERY_QUESTION`, `system_overview_generator.py:32-37`) and can
  produce named, semantically grouped components (matching the mockups' "Core Runtime" /
  "Request Handling" style names). This path is not the one the deployed map route uses today.
- A genuinely deterministic `package (directory) → module (file) → symbol` hierarchy already
  exists in code — `app/architecture_map/structural_fallback.py` — but is wired only as a
  last-resort fallback for the rare case where `main_components` is completely empty. It is
  **not** used as the primary grouping for an ordinary repository where per-file components
  already exist (which is the normal case).

## 2. What the current backend/frontend can support

Directly, without new code:

- A flat, one-node-per-file/module overview (what the product shows today).
- Drill-down from a module/component to its top-level symbols, and from a symbol to its
  children (`_module_children`/`_symbol_children`, `projection.py:478-522`) — real
  `parent_symbol_id` containment, no inference.
- Entity Focus (State 3) content: a node's evidence, explanation, and immediate
  dependency/containment edges, all already served by
  `GET /api/architecture-map/nodes/{id}` + `.../evidence` + `.../explanation`.
- Evidence/source continuity (State 4): `POST /api/entities/{id}/architectural-explanation`
  (L1 propose → L2 deterministic `verify_proposition` → L3 compose) already returns
  `ArchitecturalClaim` records with `support_status ∈ {supported, insufficient_evidence,
  contradicted}` and an ordered, source-region-backed `EvidenceChain`. The frontend already
  resolves an evidence item to an exact highlighted line range
  (`EvidenceItemRow.tsx:55-61` → `GET /api/source-regions/{id}` → `goToCode`).
- Breadcrumbs and a lens/back stack already exist (`useArchitectureLens.ts`), just with
  inconsistent Back affordances across four surfaces (see DATA_MAPPING.md and
  STATE_MODEL.md's navigation section).
- An accessible, non-canvas table view of the same node/edge data already exists
  (`ArchitectureMapCanvas.tsx:128-212`), reusing the identical `onEnterNode` handler as the
  canvas — this must be preserved verbatim by any redesign.

With a deterministic backend change (new code, no new inference — classification B):

- Grouping the flat file-level overview into folder/package clusters, by generalizing
  `structural_fallback.py`'s already-implemented package/module hierarchy from "empty-state
  fallback only" to "primary grouping whenever `main_components` are file-shaped." This is
  Option A's clustered overview.
- Group-to-group edge aggregation, IF explicitly defined as a deterministic roll-up of member
  edges (see DATA_MAPPING.md's relationship-aggregation entry) rather than a new semantic
  claim.

Only with new architectural inference (classification C — must not ship as ordinary UX work):

- Any named, semantic "domain" grouping above the file/folder level (e.g. "Request Lifecycle",
  "Core Flask Framework", "Business Logic"). The only code that can currently produce names
  like this is (a) live LLM `component_hypotheses` — non-deterministic, re-runs can disagree,
  and the map route is deliberately wired to avoid it by default — or (b) the hardcoded
  label-normalization heuristics `_architecture_label`/`_child_label`
  (`system_overview_generator.py:529-565`, `component_lens.py:455-470`), which are a fixed
  keyword list (`client`, `transport`, `auth`, `cookie`, `config`, `timeout`, `url`, `content`,
  `decoder`, `multipart`, `cli`, `route`, `page`, `worker`) tuned for an HTTP-client-library
  shaped repository and explicitly not general. Neither is safe to present as recovered
  architectural truth.
- A "contradicted"-aware presentation for the *older* `GroundedClaim`/`SupportStatus` claim
  vocabulary (`core/models/grounding.py`) used by `SystemOverview.claims` — its own downstream
  reshaper (`app/provenance/claim_projection.py:42-56`) documents explicitly that it can never
  produce "contradicted" because the underlying grounding validator has no contradiction
  detector. This vocabulary is a dead end for State 4 purposes; State 4 should use the live L1/
  L2/L3 pipeline instead (see Data Mapping).

## 3. Deterministic derivations available today (classification B building blocks)

- `ParsedSymbol.parent_symbol_id` — real containment, already used for module/symbol
  drill-down.
- `structural_fallback._directory_of(path)` — a plain POSIX directory split, already
  implemented and tested; directly reusable to group file-level components by their immediate
  containing directory.
- `ObservedProgramRelation.resolution_status ∈ {resolved, partial, unresolved}` — a resolved
  relation is a deterministic fact (its `confidence` field is required to be unset by
  validation, `program_relation.py:344-348`); partial/unresolved relations carry an explicit
  confidence and a `target_reference` string instead of a proven target. Any new aggregated
  edge must preserve this distinction rather than averaging it away.
- `SourceRegion` (`path`, `start_line`, `end_line`, `content_hash`) is the one deterministic
  unit every evidence/source view already anchors to.

## 4. Major implementation risks

- **Conflating file-level flatness with meaningful architecture.** The deterministic default
  path is a flat file list; a redesign that visually clusters it must not imply those clusters
  are semantically curated when they are just folder membership. Every group label sourced this
  way should read as a path fragment (`"src/flask"`, `"routes"`), not a synthesized name.
- **Silent LLM activation.** Any redesign that wants richer, named domain cards must not
  reintroduce automatic LLM calls into ordinary map navigation — the project has already fixed
  this bug once (`architecture_map.py:189-214`'s own comment documents the incident). If domain
  cards are ever backed by live investigation output, that must stay an explicit, user-visible,
  opt-in action, never a default view.
- **Two Flask/httpx-shaped heuristics could be mistaken for general logic.**
  `_architecture_label`/`_child_label`/`_node_kind`/`_region_matches_component` all embed
  keyword lists tuned to one repository shape. Reusing them for cross-repository domain naming
  would silently produce wrong or absent labels on a differently-shaped repo (e.g. a Java
  service, a documentation-heavy monorepo, a repo with no obvious `client`/`auth`/`route`
  vocabulary in its filenames).
- **Two parallel claim vocabularies.** `GroundedClaim`/`SupportStatus` (six-way, from
  `SystemOverview.claims`) and `ArchitecturalClaim`/`ClaimSupportStatus` (three-way, from the
  live L1/L2/L3 pipeline) must not be merged in the UI. Only the second is what
  `ArchitecturalExplanationPanel`/`ClaimCard` render today; the first only ever surfaces as
  plain warning strings on a map node (`projection.py:340-351`).
- **Four inconsistent Back affordances already exist** (top-bar arrow/hamburger toggle,
  entity-panel "Back to parent", Doc Studio's own textual back link, and the just-fixed
  code-viewer Back). A four-state model that claims "one consistent navigation model" must
  actually unify these, not add a fifth.

## 5. Cross-repository considerations

- The deterministic file-level default (`build_static_structure`) is already
  language/shape-agnostic within its supported set (`SUPPORTED_LANGUAGES = {python, javascript,
  typescript, tsx, jsx}`, `static_structure.py:16`) — safe to build on.
- `structural_fallback.py`'s package/module hierarchy is likewise shape-agnostic: it groups by
  real directory containment only, with no keyword matching at all. This is the correct
  foundation for a cross-repository-safe Option A.
- Any grouping strategy that assumes a "product_area" always corresponds to an obvious
  directory (Flask's own `src/flask/` is nearly flat — most of its files sit directly in one
  directory) must degrade gracefully to per-file nodes rather than inventing a split. The
  mockup's Flask-specific "Core Runtime" vs "Request Handling" split spans files that live in
  the *same* directory, so it could only have come from semantic (LLM or hand-authored)
  grouping — not from directory structure — and is explicitly called out as illustrative, not
  reproducible deterministically, in `README.md:47-49`.

See `DATA_MAPPING.md` for the element-by-element classification, `OVERVIEW_COMPARISON.md` for
the Option A/B/Hybrid decision, `STATE_MODEL.md` for the four-state UX contract, and
`IMPLEMENTATION_PLAN.md` for phased, bounded scope.
