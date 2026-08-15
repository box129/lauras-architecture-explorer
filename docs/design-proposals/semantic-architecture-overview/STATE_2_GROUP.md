# State 2 — Group Drill-Down (implementation-ready specification)

Design-only document. Redesigns State 2 per `concept-02-area-drilldown.png`
using the three-layer model from `INFORMATION_MODEL.md`.

## What changes from current Phase B

Phase B's State 2 (entering a `structural_group`) shows member components
in the same flat grid as Overview, with **zero edges** (`_group_children()`
returns `(), ()` by construction — confirmed in code). This is the single
largest concrete gap versus `concept-02`, which shows a real, directed
dependency graph inside the selected area. This state must close that gap
using data Laura's already has (import/call/inherit edges among the
group's real members), not new inference.

## Breadcrumb

```
Overview  >  backend  >  src/services  >  Structural cluster 1
```

Every level a real Layer-1 or Layer-2 boundary the user actually entered —
matches Phase A's existing breadcrumb mechanics exactly (`ArchitectureLensCrumb[]`),
extended only in that a crumb may now represent a Layer-2 cluster id, not
only a Layer-1 directory/module id. No new breadcrumb component needed.

## Main graph

- **Selected group's real members only** (reduced scope, as today).
- **Real relation edges among those members** — the actual fix: wire the
  existing `imports`/`calls`/`inherits` relation facts (already recovered
  for Entity Focus's neighborhood query) into this state's `children`
  response so member-to-member edges render, directed, labeled by real
  `relation_kind` — exactly like `concept-02`'s solid "Depends on"/dashed
  "Context/Creates" arrows. No relation is fabricated: an edge renders
  only if a real `ObservedProgramRelation` connects two members currently
  visible in this scope; nothing outside scope is pulled in (same
  discipline Entity Focus's neighborhood query already follows).
- If the group is a Layer-2 structural cluster, these ARE the edges that
  justified the clustering in the first place — the graph should read as
  "here is why these belong together," reusing the same fact the cluster
  was derived from rather than a separate computation.

## Right panel

```
┌ Structural cluster 1 ──────────────────────────────┐
│ [AI interpretation, if generated -- see below]      │
│                                                       │
│ 5 modules in this cluster                            │
│ 6 internal relations (imports/calls) among them      │
│                                                       │
│ Members                                              │
│  auth.service.js                                     │
│  email.service.js                                    │
│  notification.service.js                             │
│  notificationEvent.service.js                        │
│  submission.service.js                                │
│                                                       │
│ [ Generate AI interpretation ]  (if not yet requested)│
│ Why these modules are grouped ▸  (disclosure, see     │
│                                    AI_INTERPRETATION_ │
│                                    SPEC.md)            │
└───────────────────────────────────────────────────────┘
```

If a Layer-3 name/description was already generated for this group, it
renders **above** the neutral "Structural cluster N" identity (never
replacing it — see `INFORMATION_MODEL.md`'s visual spec, column D), with
its own "AI interpretation" chip. The right panel **stops showing
`RepoOrientationPanel`'s repo-wide README/orientation content the moment
any group is selected** — see `RIGHT_PANEL_SPEC.md` for the full per-state
table; this document only asserts the State-2-specific requirement that
the panel must be about the selected group, not repo-wide guidance
material.

## Fidelity target: **70%**

Restored: real dependency graph inside the area (the single biggest fix
in this document), key-facts right panel. Modified for truthfulness: "What
it does"/"Why it matters" prose in the mockup becomes real relation counts
+ member list + optional clearly-marked AI description, never unmarked
narrative. Rejected: nothing else — this state was already the closest to
its mockup in mechanics (Phase A's real children-endpoint pattern), it
just needed real edges wired in.
