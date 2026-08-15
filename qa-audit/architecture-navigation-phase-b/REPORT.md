# Architecture Navigation Redesign — Phase B (Deterministic Grouped Overview)

Status: IMPLEMENTED AND LIVE-VALIDATED.

Starting HEAD: `b311b1607cda531235697fba6b61036a023f7c0b` (Phase A, "Implement
architecture navigation state foundation").

This phase addresses Participant #1's central architecture-map finding: the
highest-level map looked like many visually similar, uncategorized boxes.
Phase B changes the highest-level Overview so the repository is presented
through deterministic structural groups instead of one flat wall of
source-file cards — without changing parser/claim/verifier semantics, and
without adding any LLM-based or keyword-based semantic classification.

## 1. Deterministic grouping rule

Implemented in `syntax_tree_refurbished/app/architecture_map/
structural_fallback.py` as `group_overview_components()` / `group_members()`
(new; the pre-existing `root_children`/`package_children`/`module_children`
functions, used only when `main_components` is completely empty, are
untouched).

**Activation.** Only when every `OverviewComponent` in the current
`SystemOverview.main_components` is file-shaped (`kind == "module"`,
`label` = repo-relative path) — i.e. exactly the shape
`build_static_structure` (the deterministic, no-LLM default path) produces.
An LLM/investigation-classified Overview (`kind == "component"`, human
labels like "Client Lifecycle") is never touched.

**Rule.** Group by the file's real immediate parent directory
(`_directory_of`, a plain POSIX `rsplit("/", 1)` — the same primitive
`root_children` already used and already tested). One flat bucket per
distinct directory string; a file two directories deep (`app/routes/api.py`)
groups under its own full immediate directory (`app/routes`), never rolled
up into a coarser parent (`app`) and never split further — no nested group
tree. Files directly at the repository root form one additional bucket,
labeled `"Repository root files"` (never a synthesized category name).

**Threshold (flat-repo degrade).** If the resulting section count
(directory buckets + 1 if a root bucket is non-empty) is `< 2`, grouping
does not activate at all — the Overview falls back to today's flat,
per-file list unchanged. This is what keeps a genuinely flat repository
(everything in one directory, or everything at root) honest rather than
wrapping it in one meaningless all-encompassing box.

**Root files:** their own honest `"Repository root files"` bucket, never
hidden, never merged into an unrelated directory.
**Nested directories:** each unique full directory path is its own flat
group; no multi-level tree.
**Singleton directories:** still form their own real group of size 1 — no
fabrication, just an honest small section.
**Empty directories:** cannot exist in the output — a bucket only exists
when a real, analyzed file produced a component in it.

## 2. User-facing terminology

**"Repository section"** (visible kind chip on the card, and in the
accessible table's Kind column) — chosen over "architectural domain"
precisely because the grouping is directory containment, not curated
architecture. Card titles are literal path fragments (`"routes"`,
`"src/flask"`), never Title Case invented prose. Confirmed live: Flask's
Overview shows `json`, `sansio`, `Repository root files` — not "Core
Runtime" / "Request Handling" or any other synthesized name.

## 3. Backend contract

No new DTO/model was introduced. A group is represented with the existing
`ArchitectureMapNode` contract, using a new, distinct `kind` value —
`"structural_group"` — added to `ArchitectureMapNodeKind` (`core/models/
architecture_map.py`) and to the frontend's matching TS union. This was the
smallest clean contract: `ArchitectureMapNode` already carries every real
fact a group needs to expose (`id`, `label`, `children_count` = member
count, `primary_files` = representative members, `can_drilldown`,
`description`, `graph_qn` = path). No new API route was added — a group is
resolved through the existing `GET /architecture-map`, `GET .../{id}`,
`GET .../{id}/children`, `.../evidence`, `.../explanation`, `.../
implementation` routes, all of which already dispatch generically on node
id. `ArchitectureMapProjector.project()`/`.node()`/`.children()` gained the
grouping/dispatch wiring; `_component_node()` gained an optional `level`
parameter so a member component can be projected at `level=2` inside its
group without duplicating construction logic. `PROJECTION_VERSION` was
bumped to `v2` (diagnostics-only; the projection cache key is
`overview_input_hash`, unaffected).

## 4–9. Behavior summary

- **Root files:** honest `"Repository root files"` group when >=1 other
  section exists; otherwise those files stay flat (see threshold above).
- **Nested directories:** flat, full-path buckets, no invented tree.
- **Flat repositories:** degrade to unchanged flat per-file Overview.
- **Representative members:** plain alphabetical first 5 (`primary_files`),
  no relevance ranking, no LLM.
- **Member counts:** `children_count` is the exact, real, un-capped member
  count of that one flat bucket — the representative list is capped for
  display, the count never is. No nested/direct ambiguity, since grouping
  has no nesting.
- **Overview edge strategy: NONE** (Strategy A). `ArchitectureMapProjector.
  _edges()` was generalized to accept whichever level-1 node set is
  actually visible; when it's groups, `SystemOverview.relationships`
  (file-to-file import edges) never match any group id, so the method falls
  through to plain root→group "contains" edges only — never an invented
  group-to-group relationship. Live-confirmed on Flask: 3 groups, 0 links
  in the canvas watermark and in the accessible relationships table; the
  API's raw edge list contains only 3 root→group containment edges.
- **Group confidence:** `None` (no fabricated percentage). This surfaced a
  real bug during live validation (see §10 below), now fixed.

## 10. Bug found and fixed during live validation: fabricated "0% map confidence"

`ObservatoryNode.confidence` was typed as a non-nullable `number`, and
`adaptArchitectureNode` coerced `node.confidence ?? 0`. A group's real
`confidence: null` therefore rendered in the entity panel as **"0% map
confidence"** — read naturally as "we are 0% confident this is real,"
which is worse than showing nothing, and a direct violation of the Phase B
brief's "do not fabricate a map-confidence percentage for a structural
group; show no confidence" requirement. Fixed by:

- widening `ObservatoryNode.confidence` to `number | null`;
- passing `node.confidence` through unmodified in `adaptArchitectureNode`
  (no more `?? 0` coercion);
- `VoiceRail.tsx` now renders "map confidence not available" instead of a
  percentage when `confidence == null`.

Verified live before/after: before the fix, the "sansio" group's panel
showed "0% map confidence"; after, it shows "map confidence not available".
A new regression test locks this in
(`VoiceRail.test.tsx`: *"never shows a fabricated '0% map confidence' for a
node with no confidence metric"*). This was the only correctness bug found
during the entire implementation/validation pass.

## 11. Entity types / icons

Groups use a new explicit `kind="structural_group"` (never a label
substring/filename guess) — dedicated icon (`FolderTree`, distinct from
`structural_package`'s `Folder`), `'stone'` accent (same family as the
other two real/deterministic kinds, signaling "structural fact" without
relying on color alone), and a visually larger "domain card" footprint
(`LensNode.tsx`'s `.obs-rf-node--group`, `mapLayout.ts`'s
`GROUP_NODE_WIDTH/HEIGHT = 288×148` vs. the standard `238×104`). Module/
class/function icon logic (the Participant #1 M2 fix: real `kind` wins over
a label-substring heuristic) is completely untouched.

## 12. Layout / density

Live-measured on the pinned Flask repo (`lauras-gt-r2-flask/research/
real-repo-pilot/repos/r2-medium/source/src/flask`, 24 analyzed modules):

- **Before (simulated, what an ungrouped Overview would show):** 24
  top-level file cards.
- **After (grouped, actual live response):** 3 group cards (`json`,
  `sansio`, `Repository root files`) — an 87.5% reduction in primary
  Overview interactive objects.
- `GET /api/architecture-map` returned 4 nodes total (root + 3 groups), 3
  edges (root→group containment only), in **29 ms**.
- Group drill-down (`GET .../nodes/{sansio}/children`) returned 3 real
  member modules in **41 ms**.
- The existing 40-node visible cap (`mapAdapter.ts`) was reviewed and left
  unchanged: grouping already collapses what used to be dozens of per-file
  cards down to a handful of sections, so the cap essentially never
  triggers for a grouped Overview; raising it would only matter for an
  ungrouped/flat repository, which Phase B does not change.
- No console errors were observed during the entire live walkthrough.

## 13. Accessible representation

The existing accessible `<details>` table (`ArchitectureMapCanvas.tsx`)
already mirrors whatever `fixture.nodes` the canvas renders — no
duplicate/second data path. It gained one new "Members" column (real
`childrenCount`, shown for every node kind, not just groups) so the group's
member count is available non-visually, not just member selection. Live
Flask table confirmed 3 rows (`json`/`sansio`/`Repository root files`),
correct Kind/Members columns, and an empty relationships table (0 links,
consistent with Edge Strategy A).

## 14. Search / direct access

No dedicated "search" UI exists in this frontend today, so nothing there
could regress. The relevant guarantee is that a file-level component's own
id keeps resolving directly (e.g. `GET /nodes/{module_id}`,
`.../evidence`, `.../explanation`) even when it's nested inside a group and
no longer a top-level Overview node — `ArchitectureMapProjector.node()`
gained an explicit fallback branch for exactly this case, and
`test_existing_routes_still_work_through_a_group` proves all four routes
(detail/evidence/explanation/implementation) keep working for both the
group and a member reached through it.

## 15. Phase A navigation regression result

Live-walked the exact scenario required: **Overview → Group ("Repository
root files") → Entity (helpers.py module) → Entity (abort symbol,
Architectural Explanation opened) → Back → Back (module) → Back
(group) → Back (Overview)**, using the single unified top-bar Back control
at every step. Breadcrumb tracked correctly at every level
(`flask > Repository root files > helpers.py > abort`). URL
pushState/query params updated on every navigation (`?lens=...&node=...`),
confirming browser Back/Forward compatibility is unaffected (same
`useArchitectureLens.ts` code path, unmodified — it is fully generic over
node id/kind, so no group-specific code was needed there at all).

## 16. Participant #1 remediation regression result

All confirmed intact during the live walkthrough: native repository Browse
(scan-start screen unaffected), always-on kind chip + drill-down chevron +
"select to explore" affordance, correct kind icons (module/component/code
group icons unchanged, group gets its own distinct icon), "Architectural
Explanation" panel with the "model proposes / Laura's independently
verifies" legend, SUPPORTED / INSUFFICIENT EVIDENCE plain-language
explanations, persistent unified Back, map-confidence vs. verification
status kept visually and lexically distinct (and, per §10, now more
correct than before this phase for the null-confidence case).

## 17. Test totals

- **Backend:** 551 tests, 0 failures (`pytest -q`, full suite, run against
  the checkout's own `.venv`-installed dependencies). New file
  `tests/test_architecture_map_grouping.py` (19 tests) covers all 10
  requirements in the Phase B brief's backend test section: deterministic/
  stable ids, real repository-structure membership, nested-directory
  handling, root-file handling, flat-repo degrade (2 variants + pure-
  function edge cases), no semantic/LLM naming, exact counts, unknown-id
  404, no group-to-group edges ever invented, and all existing routes
  (`/nodes/{id}`, `.../evidence`, `.../explanation`, `.../implementation`,
  `.../children`) continuing to work through a group and for a member
  reached via it. One pre-existing test
  (`test_overview_cache_isolation.py::test_canonical_python_app_remains_
  navigable`) was updated: it previously asserted `order_service` was a
  top-level label, which Phase B intentionally changes (it is now one
  drill-down step inside the `services` group) — updated to assert the new,
  correct reachability path rather than weakened or deleted.
- **Frontend:** 88 tests, 0 failures (`vitest run`, full suite). New/
  extended coverage: `mapAdapter.test.ts` (group icon distinctness, grouped-
  overview larger card sizing vs. flat, real member count/representative
  members, no-fabricated-confidence), `LensNode.test.tsx` (distinct group
  CSS class, real singular/plural member-count wording, real representative
  members text, always-visible "Select to explore" hint, "repository
  section" kind label matching in both visible chip and accessible name),
  `VoiceRail.test.tsx` (the confidence-fabrication regression test from
  §10).
- **Typecheck/build:** `tsc -b && vite build` succeeds with no errors (one
  pre-existing, unrelated chunk-size warning).
- **Lint:** `eslint .` clean, 0 warnings/errors.
- Backend `ruff` was not available in this environment (not installed in
  either the global Python or the project's own `.venv`) and was skipped;
  the full pytest suite was used as the correctness gate instead.

## 18. Live Flask walkthrough result

Full clean restart performed first (`stop-lauras.ps1` confirmed no stale
processes → `start-lauras.ps1` → `doctor.ps1` reported `READY`). Then, via
real Chrome browser automation against `http://127.0.0.1:5173`:

- Analyzed the pinned Flask repository fresh.
- **A–D confirmed:** highest-level Overview is visibly grouped (3 cards,
  not 24 same-looking file boxes); labels are truthful structural paths
  (`json`, `sansio`, `Repository root files`); no invented semantic
  category names anywhere.
- **E–H confirmed:** group cards are obviously interactive (hover
  highlight, "Select to explore" hint, chevron); selecting a group drills
  into its real members; Back returns predictably at every level;
  breadcrumb maintains orientation throughout.
- **I–L confirmed:** selecting an entity inside a group enters Phase A
  Entity Focus (bounded — one entity + real one-hop neighbors only);
  Architectural Explanation panel reachable and correct; evidence/source
  navigation pattern unchanged (not separately re-walked here, since Phase
  A already validated this path end-to-end and Phase B does not touch it).
- **M confirmed:** accessible table mirrors the exact same grouped state
  the canvas shows (3 rows, real Kind/Members columns, 0 relationships).
- **N–O confirmed:** clean, non-overlapping layout at both 1366×768 and
  1280×720; no hairball at any point in the walkthrough.
- Zero console errors observed across the entire session.

## 19. Confirmations

- **No Phase C inspector redesign implemented.** The right-panel changes
  in this pass are the minimum needed to show truthful group information
  (member count, representative members, "map confidence not available"
  fix) plus the pre-existing generic explanation panel, which already
  degrades honestly for a group id with no code changes required.
- **No new architectural inference added.** Every group fact traces to
  real directory containment; no narrative "why it matters" text was
  added anywhere.
- **No LLM semantic grouping added.** `group_overview_components` never
  calls a model and never uses `_architecture_label`/`_child_label`-style
  keyword heuristics.
- **Verifier/research semantics unchanged.** No file under
  `core/models/provenance.py`, `verify_proposition`, `ClaimProposer`, or
  the proposition vocabulary was touched.
- **Formal A/B/C study untouched.** No participant data was read, written,
  or referenced by this change.
- **Participant #2 not started.**

## 20. Final classification

**READY FOR PHASE C REVIEW**
