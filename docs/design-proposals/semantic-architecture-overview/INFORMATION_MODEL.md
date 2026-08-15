# Information Model — Three Layers, Containment Feasibility, Visual Spec

Design-only document.

## The three layers (+ the pre-existing fourth)

### Layer 1 — Deterministic structure

- **Examples:** `backend`, `backend/src`, `backend/tests`, `frontend`.
- **Source:** repository directory containment — exactly what Phase B's
  `structural_fallback.group_overview_components()` already computes,
  generalized to represent full ancestor paths, not just one flat
  immediate-directory level (see §"Nested containment" below).
- **Presentation:** an enclosing region/container. Real ReactFlow parent
  node.
- **Epistemic meaning:** directly structural, deterministic, 100%
  reproducible from a fixed analysis run.

### Layer 2 — Deterministic structural cluster

- **Examples:** a dependency-dense sub-group of `services/`'s 50 flat
  files (concretely found on `topic-similarity-mvp`: `{auth, email,
  notification, notificationEvent, submission}.service.js`).
- **Source:** a formally defined relation-based clustering rule over
  already-recovered `imports`/`calls`/`inherits` edges (community
  detection or equivalent — see `IMPLEMENTATION_PLAN.md` Phase C2 for the
  exact algorithm choice and its scope).
- **Presentation:** a nested structural cluster/card **inside** its Layer-1
  region — never a sibling of Layer-1 regions, never presented as if it
  were directory-based.
- **Epistemic meaning:** mechanically derived grouping. Membership is
  reproducible for a fixed algorithm/library version; not a canonically
  unique partition (a different clustering method could produce a
  different, still-defensible split — this must be disclosed, not hidden).
- **Must NOT automatically receive a semantic name.** Default label is
  neutral and honest: `"Structural cluster 3"`, `"Cluster of 5"`, or
  similar — never a guessed category word.

### Layer 3 — AI architectural interpretation

- **Example:** `"Authentication & Session Management"` for the cluster
  above.
- **Source:** LLM interpretation of a **fixed** Layer 1 or Layer 2 group —
  the model receives the real member list and real supporting relation
  facts and returns a name + short description.
- **Allowed output:** a human-readable group name; a short (1–2 sentence)
  architectural description.
- **Not allowed:** changing group membership; inventing an edge; marking
  itself SUPPORTED/verified; changing any verifier result; being generated
  or displayed without the user being able to see it was AI-authored.
- **Presentation:** always visibly labeled "AI interpretation" (or
  equivalent), always visually distinct from Layers 1–2 and from Layer 4.

### Layer 4 — Verified architectural statement (pre-existing, unchanged)

- **Example:** `"AuthController calls JwtService"` — `SUPPORTED`.
- **Source:** the existing L1(propose)/L2(verify)/L3(compose) claim
  pipeline (`ArchitecturalClaim`/`ClaimSupportStatus`).
- Untouched by this design. Cited here only to make the four-way
  distinction explicit and to forbid any visual overlap with Layer 3.

## Nested/enclosing containers — feasibility

**Question: can the current deterministic hierarchy be visualized as real
nested enclosing containers? Answer: YES.**

- `syntax-tree-ui` already depends on `@xyflow/react@12.10.2` (confirmed in
  `package.json`/`node_modules`), which natively ships **sub-flow / group
  node** support: a node can declare `parentId` + `extent: 'parent'` (+
  optional `expandParent`), and ReactFlow renders it positioned and
  clipped inside its parent node's bounds automatically — this is an
  official, current-version library feature, not a workaround.
- This means Layer 1 containment (`backend` containing `backend/src`
  containing a Layer-2 cluster containing module nodes) can be represented
  as real parent/child ReactFlow nodes with real visual nesting — exactly
  the mockups' large-enclosing-region look — **without new research
  semantics** and without a different graphing library.
- **What's actually needed, precisely:**
  1. Backend: `structural_fallback`'s grouping needs to expose the full
     ancestor chain per group (today it only computes one flat
     immediate-directory level), so the frontend can assign correct
     `parentId` relationships between a directory group and its parent
     directory group. This is a bounded extension of an existing pure
     function, not new inference.
  2. Frontend: a new node-type/rendering path for a "container" node
     (distinct from the current flat `LensNode`) that renders a
     header + bounding region, plus a parent-aware layout pass (ReactFlow
     ships Dagre/ELK-compatible layout helpers commonly used with
     sub-flows; exact library choice is an implementation decision for
     Phase C1, not fixed here).
  3. Depth/collapse rules so a 2,000-module repository doesn't render every
     nested level simultaneously (see `STATE_1_OVERVIEW.md`'s progressive-
     disclosure rule).
- **Verdict for the parent request's exact question:** "Can current
  deterministic hierarchy be visualized as real nested enclosing
  containers?" → **YES**, using ReactFlow's own `parentId`/`extent:
  'parent'` facility already present in the installed library version.
  "Can ReactFlow/current frontend support compound/nested nodes?" → **YES**,
  confirmed directly from the installed package's type definitions
  (`@xyflow/system`'s `NodeBase.parentId`/`extent`/`expandParent` fields).

## Visual container specification

| | A. Deterministic path container (Layer 1) | B. Deterministic relation cluster (Layer 2) | C. Module/entity (existing) | D. AI semantic label (Layer 3, overlay on B) |
|---|---|---|---|---|
| Border | solid, 1.5px, neutral `stone` family (same token Phase B already uses for `structural_group`) | solid, 1px, distinct dash-free but visually "nested" — inset by consistent padding from parent border | existing `LensNode` border (unchanged) | no separate border — a labeled sub-region of B's card, not a new box |
| Background | very light neutral tint (already established: `color-mix(stone 5%, base)`) | slightly different neutral tint than its Layer-1 parent, so nesting is visible without reading text | existing (unchanged) | tinted call-out strip at the top of B's card, distinct background from B's body |
| Header | path fragment label, large, e.g. `backend/src` | neutral label, e.g. `"Structural cluster 3"` | existing kind chip + label | "AI interpretation" chip (icon: sparkle/wand, distinct from `StatusBadge`) + the AI name, visually above/before the neutral B header, in a different font weight or a bordered call-out — never replacing B's neutral header outright, so a user can always see the neutral ground-truth label even when the AI label is present |
| Icon | `FolderTree` (existing) or a directory-tree variant scoped to depth | a distinct "cluster" icon (e.g. `Share2`/`Waypoints` — not yet used elsewhere in the kind-icon table, so no collision) | existing per-kind icons (unchanged) | a sparkle/AI icon, never a folder/cluster icon |
| Nesting treatment | real ReactFlow parent node; children rendered inside its bounds | real ReactFlow parent node nested inside its Layer-1 parent | leaf, rendered inside whichever ancestor (Layer 1 or Layer 2) is its immediate parent | overlay only, not a nesting level of its own |
| Count placement | "N modules" (recursive: total leaves under this region) top-right of header, matching Phase B's existing convention | "N modules" (direct members of this cluster only — must not silently mean the same thing as A's recursive count; label explicitly, e.g. "5 modules in this cluster") | existing (unchanged) | none — count belongs to B, not to the AI label |
| Selection | existing `.obs-rf-node--selected` treatment, applied to whichever level (A/B/C) was clicked | same | same | AI label is never independently selectable — selecting B selects its AI label too |
| Hover | existing hover elevation, scoped so hovering a child does not visually "steal" its parent's hover state | same | same | none independent of B |
| Focus | standard focus ring, same accessible-name pattern as Phase A/B (`"{label}, {kind}, {status}, select to explore"`) extended to state whether the group is a Layer-1 region, Layer-2 cluster, or has an AI-interpreted name | same | same | AI name is announced as part of B's accessible name, with an explicit "AI interpretation" prefix (see `AI_INTERPRETATION_SPEC.md`) |
| Drill-down affordance | existing chevron, scoped to "expand this region" (in-place, not a new page) vs. "enter/focus this region" (breadcrumb push) — see `STATE_1_OVERVIEW.md` for the exact interaction split | same | existing (unchanged) | none |

**Never color-alone:** every distinction above is carried by icon + header
text + structural nesting position, consistent with the project's existing
"do not rely on color alone" convention (already enforced for
`structural_group` vs `structural_package`/`structural_module` in Phase B).

## Relation-cluster visualization inside a directory (§22 of the request)

A directory group and a relation cluster are never the same visual object.
Concretely, inside `backend/src/services` (Layer 1, real directory):

```
┌─ backend/src/services ─────────────────────────────┐  Layer 1 (real directory)
│  50 modules                                          │
│                                                       │
│  ┌─ Structural cluster A ─────────────┐              │  Layer 2 (relation-derived)
│  │  5 modules in this cluster          │              │
│  │  ┌──────────────────────────────┐  │              │
│  │  │ Authentication & Sessions     │  │              │  Layer 3 (AI interpretation,
│  │  │ AI interpretation             │  │              │  overlay on Layer 2 only)
│  │  └──────────────────────────────┘  │              │
│  │  auth.service.js  email.service.js  │              │
│  │  notification.service.js  +2 more   │              │
│  └──────────────────────────────────────┘            │
│                                                       │
│  ┌─ Structural cluster B ─────────────┐  ...          │
│                                                       │
│  ┌─ Ungrouped (24 modules) ───────────┐              │  honest residual bucket --
│  │  contextSimilarity.service.js       │              │  no forced membership
│  │  readiness.service.js  ...          │              │
│  └──────────────────────────────────────┘            │
└───────────────────────────────────────────────────────┘
```

The "Ungrouped" residual bucket is required, not optional: per the
concrete `topic-similarity-mvp` exercise, 24/50 `services/` files had no
sibling import edge at all — forcing them into a cluster would fabricate
membership. An honest residual bucket at the bottom of a Layer-1 region,
styled visually like a plain flat list (no cluster border), communicates
"these files exist here but no relation evidence groups them further."

## Cross-repository fallback priority (§29)

```
1. Containment hierarchy, where it is informative
     (i.e. produces >= 2 sections per group_overview_components' existing
     threshold rule, generalized recursively per level)
       ↓
2. Deterministic relation clustering (Layer 2), applied WITHIN any region
   that stayed flat/dense after step 1 (e.g. a 50-file flat directory)
       ↓
3. AI naming (Layer 3), only after Layer 1/2 membership is fixed, and only
   as an explicit, attributable, opt-in action (see AI_INTERPRETATION_SPEC.md
   for exact timing)
```

This directly generalizes the concrete finding: Flask-shaped repositories
(clear `backend`/`frontend`-style hierarchy, but genuinely flat within one
directory like `src/flask/`) lean on step 1 more; `topic-similarity-mvp`-
shaped repositories (deep-enough hierarchy but one dominating flat
directory) need step 2 to do real work inside that one directory. Neither
step assumes any particular directory name (`backend`/`controllers`/etc.)
— the fallback is priority-ordered by whether each step actually produces
a useful reduction for *this* repository's real shape, not by matching
expected folder names.
