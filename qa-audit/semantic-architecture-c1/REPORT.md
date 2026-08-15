# Phase C1 — Nested Deterministic Containment Visualization

Status: IMPLEMENTED AND LIVE-VALIDATED.

Starting HEAD: `40838aa` (post-P2 diagnosis freeze). Design freeze:
`373ebe5` ("Freeze semantic architecture overview design"). This report
covers the C1 implementation commit only — see §"Commit" below.

## Scope confirmation

Implemented: real nested/enclosing ReactFlow containers for the
deterministic directory-containment hierarchy, using the library's own
`parentId`/`extent:'parent'` sub-flow support (no new dependency), with
progressive disclosure (top-level expanded by default, deeper collapsed),
a truthful layered Overview summary, and accessible-table parity.

**Not implemented (explicitly out of scope for C1):** relation-based
clustering (C2), AI semantic labels/descriptions (C3), full right-panel
redesign (C4 — only reused the existing panel unchanged), Settings/AI
communication changes (C5).

## Exact hierarchy algorithm

`structural_fallback.build_containment_hierarchy()` (backend): a
recursive, path-compressing partition of `OverviewComponent` paths.

- At any prefix, partition real components into "direct files at this
  prefix" and "next-path-segment buckets."
- If exactly one bucket and no direct files exist, **compress forward**
  (accumulate the combined path) rather than rendering a pointless
  single-child wrapper container — e.g. a `backend` directory containing
  only `src/`, which itself branches, becomes one node labeled
  `"backend/src"`, never two nested boxes where the outer contains nothing
  but the inner.
- A real branch point (>= 2 sections) becomes a **container**; a node with
  no further real branching becomes a **leaf** (same as Phase B's existing
  bucket, now reachable at any depth, not only depth 1).
- Depth is hard-capped at `CONTAINER_MAX_DEPTH = 6`; beyond it, remaining
  content collapses into one flat leaf bucket labeled with the real
  remaining path. Live-verified this cap is not actually hit on either
  test repository — real max depth was 5 on `topic-similarity-mvp`.
- Root-level files get the existing `"Repository root files"` label; a
  branch point that has both direct files AND subdirectories gets an
  honestly-disambiguated `"{path} (direct files)"` sibling leaf (a real,
  live-exercised case: `"backend (direct files)"`, 8 files, alongside
  `backend/prisma`, `backend/scripts`, `backend/src`, `backend/tests`).

Container vs. leaf is a **derived** distinction (does any other node's
`parent_group_id` point at this id?), not a second `kind` value — both
share `kind="structural_group"` because they represent the same epistemic
fact (real directory containment) at different depths. Documented
explicitly in code as a deliberate choice, not an oversight.

## Backend contract changes

One new, optional (defaulted `None`) field: `ArchitectureMapNode
.parent_group_id: str | None`. No new route. `GET /api/architecture-map`
now eagerly returns **every** container/leaf-group node at every depth
(not just level 1) so the frontend can render true multi-level nesting on
one screen; individual leaf group members (real files) are still fetched
lazily via the existing `/children` route only when a leaf is entered.
`metadata.containment = {total_modules, top_level_regions,
total_sections}` added for the truthful summary line.

## Frontend compound-node implementation

**Mechanism used: ReactFlow's own `parentId` + `extent:'parent'`**
(confirmed present in the already-installed `@xyflow/react@12.10.2`) — no
new graphing library. `mapLayout.ts`'s new `layoutContainmentNodes()`
recursively lays out an expanded container's children relative to the
container's own top-left corner (exactly what ReactFlow's sub-flow
positioning requires), sizing each container to fit its content;
collapsed containers/leaves render as one fixed-size card and contribute
none of their descendants to the result at all. `LensNode.tsx` gained a
plain "enclosing frame" render mode (header + count + collapse control)
for an expanded container, alongside its existing collapsed-card mode
(now reading "Select to expand" for a container vs. the original "Select
to explore" for a leaf).

## Progressive disclosure / expansion / navigation semantics

- Default: every top-level container expanded (revealing its direct
  children); everything deeper starts collapsed.
- Expand/collapse is **local, ephemeral canvas state** (`useState` in
  `ArchitectureMapCanvas.tsx`, reset when the user navigates to a
  different scope) — it never touches breadcrumb/URL/lens-stack state.
- Clicking a collapsed container toggles expand in place; clicking an
  expanded container's header collapses it. Neither ever calls
  `onEnterNode`. Clicking a **leaf** (real module/symbol, or a
  structural_group with no further real sub-containers) navigates exactly
  as Phase A/B always did — same callback, same breadcrumb push, unchanged.
- Live-verified: full **Overview → Group → Module → Entity → Back → Back →
  Back → Overview** chain works unmodified through the new nested Overview.

## Root-file / flat-repo / nested-directory behavior

- **Root files:** honest `"Repository root files"` bucket, unchanged from
  Phase B, live-confirmed on Flask (18 files).
- **Flat repository:** unchanged — Flask (single-level, no real branching
  beyond depth 1) renders identically to Phase B's own screenshots, same
  card size (`GROUP_NODE_WIDTH/HEIGHT`), confirming C1 does not make a
  flatter repository worse.
- **Nested directories:** live-confirmed 3+ real levels simultaneously
  visible on `topic-similarity-mvp` (`backend` → `backend/src` →
  `backend/src/services`), each with real counts, no invented labels.

## Recursive count definition

`children_count` on every group node (container or leaf) is the real,
recursive count of file-backed leaf components anywhere underneath it —
verified live: `backend` (117) = `backend (direct files)` (8) +
`backend/prisma` (4) + `backend/scripts` (4) + `backend/src` (97) +
`backend/tests` (4) = 117. Exact, consistent, single definition throughout.

## Overview summary wording

Replaced the old `"N areas · M links"` canvas watermark with a truthful,
real-count layered line whenever backend containment metadata is present:
live-confirmed **`"267 source modules · 6 top-level regions · 62
repository sections"`** on `topic-similarity-mvp`, and **`"24 source
modules · 3 top-level regions · 3 repository sections"`** on Flask. Falls
back to the original `"N areas · M links"` wording for any fixture without
containment metadata (State 2 leaf drilldown, Entity Focus, an
LLM-classified Overview) — unchanged there.

## `topic-similarity-mvp` — real measured numbers

- **267** total analyzed modules, **63** total hierarchy nodes (root + 62
  groups), **6** initially-visible top-level containers, **13** containers
  total, **49** leaves total, max real nesting depth **5**.
- Overview fetch: **20 ms**. `backend/src` (a real container, 97 recursive
  modules) `/children` fetch (recomputes the whole hierarchy fresh, same
  pattern Phase B already used): **334 ms** — noted as the one real cost
  of this design (full-hierarchy recomputation per `/children` call);
  acceptable for a single interactive click but flagged for Phase C2 to
  consider caching if it becomes a real Phase C2 concern at larger scale.
  A leaf's own `/children` (50 real files in `backend/src/services`, the
  exact flat directory the post-P2 diagnosis flagged): **58 ms**.
- Expansion of an already-eagerly-fetched container (`backend`,
  `backend/src`) has **no network cost at all** — it is pure client-side
  state, confirmed by direct interaction (instant reveal, no loading
  state) — a genuine improvement over a per-level-fetch design.
- Compared with Phase B's own measured Flask numbers (29 ms Overview
  fetch, 41 ms group drill-down, 24 modules) — `topic-similarity-mvp` is
  ~11x larger by module count and stays well within interactive latency
  for every operation measured.

## Viewport results

- **1366×768:** clean, no overlap, all nested regions readable
  (`screenshots/07-topic-overview-1366x768.jpg`).
- **1280×720:** entire 6-region Overview fits with fit-to-view, no
  hairball, no overlap (`screenshots/08-topic-overview-1280x720.jpg`).
- 1920×1080 not available in this environment (no larger display/window
  surface); not tested.

## Flask regression result

Live-confirmed identical to Phase B's own behavior: 3 flat top-level
groups (`Repository root files`, `json`, `sansio`), same larger domain-card
sizing, same truthful summary format. Full navigation chain (group →
module → symbol → Entity Focus/explanation → Back ×3 → Overview)
confirmed working end-to-end with zero console errors.

## Phase A navigation / Participant #1 remediation regression result

Both fully intact, live-verified: unified Back (single control, all
levels), breadcrumb tracks every level correctly, correct kind
icons/labels throughout (no filename-substring override), Entity Focus
and its explanation panel reachable from within the new nested Overview,
evidence/source flow unaffected (not re-walked in depth this pass — Phase
B already validated it end-to-end and C1 touches none of that code).

## Accessible representation result

Live-confirmed: the accessible table gained a real `Parent section`
column and only lists nodes currently visible on canvas (same
expand/collapse state, verified by expanding `backend/src` on canvas and
seeing its children appear correctly attributed to `backend/src` in the
table). A container's row activates the same `toggleExpand` used by the
canvas rather than navigating — confirmed both via direct DOM inspection
and dedicated frontend tests.

## Test totals

- **Backend:** 565 tests, 0 failures (full `pytest -q` suite). 20 tests in
  the rewritten/extended `test_architecture_map_grouping.py` cover: path
  hierarchy determinism, correct parent-child relationships, correct
  depth, exact recursive counts, root-file handling, nested-directory
  handling (including the compressed single-child-chain case), flat-repo
  graceful fallback, stable ids, no LLM/provider dependency anywhere in
  this code path, no relation-based clustering (not implemented at all),
  existing architecture-map endpoints preserved, unknown ids handled
  correctly (404), and container-vs-leaf dispatch through the real HTTP
  routes.
- **Frontend:** 106 tests, 0 failures (full `vitest run` suite). New: a
  dedicated `mapLayout.test.ts` (nested layout, default expansion,
  expand/collapse geometry, orphan-parent defensiveness), extended
  `mapAdapter.test.ts` (`hasContainment` detection, placeholder positions,
  `parent_group_id` passthrough, truthful summary line), extended
  `LensNode.test.tsx` (collapsed-container vs. leaf wording, expanded-frame
  rendering, explicit "no AI interpretation content anywhere" assertion),
  extended `ArchitectureMapCanvas.test.tsx` (accessible table
  visible-state parity, `Parent section` column, container-row
  toggles-not-navigates). Real ReactFlow canvas node interaction was not
  tested here (jsdom cannot measure real DOM layout, so ReactFlow keeps
  custom nodes `visibility:hidden` until measured — a known limitation
  this test file already documented before this phase); covered instead
  by the live browser walkthrough above.
- **Typecheck/build:** `tsc -b && vite build` succeeds, no errors (one
  pre-existing, unrelated chunk-size warning).
- **Lint:** `eslint .` clean.

## Confirmations

- **No relation clustering implemented:** confirmed — no community
  detection, SCC, import/call-density grouping, or hub suppression exists
  anywhere in this commit; grouping is directory-path-only.
- **No AI group labels implemented:** confirmed — no provider call, no
  "Generate AI interpretation" affordance, no new Settings/model-routing
  code exists in this commit; a dedicated frontend test asserts no
  "AI interpretation" text can render from any C1 component.
- **No C4 right-panel redesign implemented:** confirmed — the right panel
  is byte-for-byte the same component tree as before this phase; C1 only
  relies on it continuing to show real, correct content for whatever node
  is selected (unchanged behavior, not a new code path).
- **No C5 Settings redesign implemented:** confirmed — `SettingsPanel.tsx`
  was not touched.
- **Research semantics unchanged:** confirmed — no file under
  `core/models/provenance.py`, `verify_proposition`, `ClaimProposer`, or
  the proposition vocabulary was touched.
- **Formal-study materials unchanged:** confirmed — no `research/` path
  changed in this commit.
- **No participant session started:** confirmed.

## Final classification

**READY FOR C1 VISUAL REVIEW**
