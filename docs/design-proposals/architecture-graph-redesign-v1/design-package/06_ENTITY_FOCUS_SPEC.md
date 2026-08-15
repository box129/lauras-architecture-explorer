# 6. Entity focus

Preserved from Phase A, extended for the new layers.

## Layout

Three columns: **depended on by** — the entity, visually dominant, with a slate
selection border and elevation — **depends on**. Each neighbour shows its
relation kind and the group it belongs to, so the user never loses the map.

Under it, full width: **Architectural statements**, the entity's Layer-4 list,
each a `StatementCard` with its verdict, relation and evidence count.

## Rules

- The entity carries both ancestors as chips: its section and its cluster.
- Statements are visible without an extra click — this was the discoverability
  gap. The old "Architectural Explanation" was a button; here the statements
  themselves are the content.
- Clicking a neighbour re-centres in place. Clicking a statement pushes one crumb.
- With no model configured, the written explanation area states that plainly and
  the deterministic statements above are unaffected.

---

## Invariant E-1 — entity identity alignment (non-negotiable)

At every Entity Focus state:

    breadcrumb current entity
        === centred entity on the canvas
        === contextual-panel entity

**Implementation rule.** One resolver returns one entity object for the
breadcrumb's current node. The canvas, the panel and the statement list all
read *that object*. No surface may reach for a default or example entity, and
no mockup may show a different module in the centre than the breadcrumb names.

A module with no statements in the current run shows an explicit empty state
("No architectural statements were produced for this module in this run") — it
never falls back to another module's statements.
