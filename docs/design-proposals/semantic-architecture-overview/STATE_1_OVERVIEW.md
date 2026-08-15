# State 1 — Overview (implementation-ready specification)

Design-only document. Builds on `INFORMATION_MODEL.md`'s three-layer model
and confirmed ReactFlow `parentId`/`extent:'parent'` feasibility.

## Progressive disclosure rule

- **Default expansion depth: 1 level of Layer-1 nesting below root.** The
  Overview shows top-level structural regions (e.g. `backend`, `frontend`)
  as expanded containers; their immediate children (e.g. `backend/src`,
  `backend/tests`) render as collapsed sub-region headers with a count,
  not fully expanded module grids, until clicked.
- **Maximum children shown before collapsing a level: 6**, matching the
  representative-member cap already established in Phase B
  (`MAX_REPRESENTATIVE_MEMBERS = 5` + a `"+N more"` affordance) — reused
  unchanged as the visual convention, applied per nesting level instead of
  only at the leaf-member list.
- **"+ N more" behavior:** clicking it expands that one region in place
  (no navigation/breadcrumb push) up to a second cap (e.g. 20) before
  requiring the user to actually enter the region (breadcrumb push) to see
  the rest — mirrors the existing `hiddenNodeCount` pattern in
  `mapAdapter.ts`, generalized per-region instead of globally per-canvas.
- **How users expand:** a single click on a collapsed sub-region header
  toggles in-place expand/collapse (no history entry, no breadcrumb
  change) — a *second* click, or clicking a specific child once expanded,
  is what pushes breadcrumb/URL state (matches State 2's existing
  `enterNode`/`selectOnly` distinction, applied one level earlier).
- **Back vs. expansion:** Back never collapses an in-place expansion; it
  only pops navigation history (breadcrumb/URL) exactly as today. In-place
  expand/collapse state is ephemeral UI state, not navigation state — this
  matches how the mockups' own containers appear to behave (nothing in the
  concepts shows a collapse control triggering a page-level Back).
- **Entities are never permanently hidden.** Every leaf is reachable either
  by expanding enough levels in place, or by entering (breadcrumb push)
  the deepest visible container and continuing from there — the existing
  Phase B guarantee that a real component id resolves directly via
  `/nodes/{id}` regardless of nesting depth is preserved unchanged.

## Truthful summary wording (replaces "N areas · M links")

The current Phase B watermark ("3 areas · 0 links") is accurate but reads
as if the product tried and failed to find relationships. Replace with
layered, always-real counts:

```
267 source modules  ·  2 top-level regions  ·  18 repository sections
```

and, only when Layer 2 clustering actually ran and found something:

```
267 source modules  ·  2 top-level regions  ·  18 sections  ·  5 structural clusters
```

Never state a links/relationship count at the Overview level unless a real
edge is being drawn (per `INFORMATION_MODEL.md`, Overview inter-group edges
remain deliberately absent — Strategy A from Phase B's own diagnosis).
Every number in the summary must be a real, already-computed count; no
placeholder or estimated figure.

## Textual wireframe — `topic-similarity-mvp`, using only real deterministic data

Source: the concrete exercise in
`qa-audit/post-p2-architecture-gap-diagnosis/DETERMINISTIC_CAPABILITY.md`.
Real structure: `backend/src/{config(7), controllers(31), middleware(2),
services(50, flat), utils(5)}` + `server.js`/`server.test.js` at root.
Real Layer-2 result inside `services/`: 5 clusters among 26/50 connected
files; 24/50 residual/ungrouped.

```
Overview                                          51 modules · 1 top-level region

┌─ backend ──────────────────────────────────────────────────── expanded ─┐
│  51 modules                                                              │
│                                                                          │
│  [ Repository root files ]        2 modules        collapsed, "+2"      │
│      server.js, server.test.js                                          │
│                                                                          │
│  [ src/config ]                   7 modules         collapsed, "+7"     │
│                                                                          │
│  [ src/controllers ]             31 modules         collapsed, "+31"    │
│                                                                          │
│  [ src/middleware ]               2 modules         collapsed, "+2"     │
│                                                                          │
│  ┌─ src/services ─────────────────────────────────────── expanded ──┐  │
│  │  50 modules · 5 structural clusters · 24 ungrouped                │  │
│  │                                                                    │  │
│  │  ┌─ Structural cluster 1 ── 5 modules ──────────────────────┐    │  │
│  │  │ [ AI INTERPRETATION EXAMPLE — not yet generated ]         │    │  │
│  │  │ auth.service.js, email.service.js,                        │    │  │
│  │  │ notification.service.js, notificationEvent.service.js,    │    │  │
│  │  │ submission.service.js                                     │    │  │
│  │  │ [ Generate AI interpretation ]                             │    │  │
│  │  └─────────────────────────────────────────────────────────┘    │  │
│  │                                                                    │  │
│  │  ┌─ Structural cluster 2 ── 4 modules ──────────────────────┐    │  │
│  │  │ adminReportExport, adminUser, auditLog,                   │    │  │
│  │  │ superviseeAssignment.service.js                           │    │  │
│  │  └─────────────────────────────────────────────────────────┘    │  │
│  │                                                                    │  │
│  │  [ Structural cluster 3 ]   2 modules   collapsed                │  │
│  │  [ Structural cluster 4 ]   2 modules   collapsed                │  │
│  │  [ Structural cluster 5 ]   2 modules   collapsed                │  │
│  │                                                                    │  │
│  │  ┌─ Ungrouped (no sibling relation found) ── 24 modules ────┐    │  │
│  │  │ contextSimilarity.service.js, readiness.service.js, ...   │    │  │
│  │  │ "+21 more"                                                 │    │  │
│  │  └─────────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  [ src/utils ]                    5 modules         collapsed, "+5"     │
└──────────────────────────────────────────────────────────────────────────┘
```

Notes:
- `[ AI INTERPRETATION EXAMPLE — not yet generated ]` marks that no label
  has actually been requested — per §23/§24, generation is on-demand
  (Option C, see `AI_INTERPRETATION_SPEC.md`), so the honest default state
  shows the neutral "Structural cluster 1" header with a `[Generate AI
  interpretation]` action, not a name.
- Cluster 1's real member list (`auth`, `email`, `notification`,
  `notificationEvent`, `submission`) is shown here **exactly as the
  concrete analysis found it** — no invented membership.
- `src/controllers` (31 files) has no Layer-2 pass in this wireframe
  because the concrete diagnosis only ran clustering on `services/`; per
  `INFORMATION_MODEL.md`'s fallback priority, any flat/dense directory is
  a Layer-2 candidate, so a real implementation would run the same pass
  there too — shown collapsed here because that exercise wasn't performed
  in the diagnosis and this document does not invent numbers.

## What the user clicks

1. Land on Overview: one expanded top-level region (`backend`, since this
   repo has only one), collapsed sub-regions underneath.
2. Click `src/services` header → expands in place (no navigation).
3. See 5 structural clusters + 1 ungrouped bucket, all neutrally labeled.
4. Click "Generate AI interpretation" on Cluster 1 → Layer 3 request (see
   `AI_INTERPRETATION_SPEC.md` for exact timing/caching) → header updates
   to show the AI name + "AI interpretation" chip once returned.
5. Click Cluster 1's card body (not the generate button) → breadcrumb
   push into State 2, scoped to that cluster's 5 real members.

## Target mockup-fidelity: **75%**

Restored: enclosing regions with real nesting (01a), reduced top-level
object count via progressive disclosure (01b), representative members
inside a container (01a/01b). Modified for truthfulness: group labels stay
path-based at Layer 1/2, semantic names only appear as explicitly-marked
Layer 3. Rejected: invented relationship lines between top-level regions
(no deterministic rule justifies them); "why it matters" narrative prose
at Layer 1/2 (no source for it deterministically). The 25-point gap from
100% is entirely the deliberately-rejected content, not missing
engineering.
