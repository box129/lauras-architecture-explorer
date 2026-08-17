# 4. Architecture Overview

The screen that must stop reading as inventory.

## Composition

- One top-level **region** per real top-level directory, drawn as an enclosing
  container that visibly *holds* its children. Containment is a box inside a
  box, not an indent.
- Immediate children render as **collapsed section headers with counts**.
  Default expansion: one level below root, max six children shown per level,
  then "+N more".
- A dense/flat section (the 50-file `src/services`) expands to show its
  **structural clusters** — squarer cards, `waypoints` icon, neutral names —
  and, mandatorily, the **Ungrouped bucket** for files no relation connects.
  The bucket is borderless and plainly worded so it cannot read as a cluster.
- Every cluster carries an **AI interpretation slot**, which by default is a
  `Generate AI interpretation` button (or the "no model configured" line).

## Summary line

```
51 source modules · 1 top-level region · 6 repository sections · 5 structural clusters
```

Real counts only. No link count unless edges are drawn. No confidence figure.

## Interaction

| Action | Result | History |
|---|---|---|
| click a region/section header | expand or collapse in place | none |
| click **Enter** on a region | push one crumb, scope the view | one entry |
| click a cluster card body | push one crumb into that cluster | one entry |
| click **Generate AI interpretation** | one model call for that cluster, cached | none |
| Back | pop one crumb — never collapses an expansion | pops one |

## Why this reads as architecture

Containment is spatial, counts are real, and the two things a directory
listing cannot tell you — *which modules actually depend on each other*, and
*which ones nothing connects* — are on screen at the top level.

---

## Final revision — Map and Outline (approved)

The Overview has **two named views**, switched from the canvas control cluster
(`role="radiogroup"`, labelled *Architecture view*).

**Map — the default.** The architecture map. Structural regions visibly
*contain* their subordinate regions and clusters: a region is a bordered
container, its children are drawn inside it, and depth is expressed by
containment, not by indentation alone. This is a presentation of the existing
C1 compound-node hierarchy. It is never a wall of peer cards.

**Outline — compact and accessible.** The same tree as a linear, keyboard-first
outline (`ArchitectureTree`). It is the accessible equivalent of the Map and
the compact-width fallback. It carries the same nodes, counts and provenance in
the same order.

The current view is named in the navigation bar: *Overview · Map* /
*Overview · Outline*. The choice is per session; Map is always the entry state.

### Ungrouped bucket

Collapsed by default. It renders as a dashed, low-weight row — never as a
cluster card, never as a sixth structural cluster:

- real module count ("Ungrouped · 24 modules")
- a neutral one-line reason ("no relation to any cluster in this run")
- an explicit **Show / Hide** affordance
- when expanded: a short neutral paragraph stating this is a result, not an
  error, and the module list

It is never hidden, and it is never promoted.
