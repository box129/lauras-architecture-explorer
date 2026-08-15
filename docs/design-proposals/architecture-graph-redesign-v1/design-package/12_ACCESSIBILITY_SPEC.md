# 12. Accessibility

## The tree is a peer view, not an overlay

`ArchitectureTree` replaces the table overlay. It is reached from the same
control cluster as zoom and fit — **Tree view** — and occupies the same canvas
area, not a sheet on top of it.

- `role="tree"` / `role="treeitem"` with `aria-level` and `aria-expanded`.
- Enter/Space expands a container or activates a leaf — the same semantics the
  canvas click has.
- Columns: **Name · Modules · Origin**. `Origin` is the epistemic column:
  STRUCTURE / STRUCTURAL CLUSTER / AI INTERPRETATION / Ungrouped.
- An AI-named row announces *"AI interpretation: Authentication & Sessions —
  Structural cluster 1"*. The attribution prefix is never dropped.

## Across the product

- Focus ring: 3px `focus.ring` + 2px offset + a contrasting inner ring. Never removed.
- Every distinction uses at least three of shape, icon, word, colour.
- Status dots are shape-coded; the evidence highlight has a solid edge as well
  as a tint.
- Icon-only controls carry a real `aria-label`; the theme control is a
  `radiogroup`.
- Disabled controls keep their label, drop to ~45% opacity, and state why.
- Source view is selectable text, not an image; line numbers are outside the
  copyable region.
