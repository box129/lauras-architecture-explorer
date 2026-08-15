# Right Panel — State-Aware Redesign + Accessibility Model

Design-only document. Addresses the concrete mismatch documented in
`MOCKUP_FIDELITY_AUDIT.md`: Phase B's default (nothing-selected) right
panel is `RepoOrientationPanel.tsx` — repo-wide "Snapshot orientation" /
README guidance — which has no relationship to whichever group is
currently on screen, and does not match any of the four mockups' panel
behavior (all four mockups show panel content that tracks the current
selection).

## Per-state panel content

| State | Panel shows | What disappears/moves |
|---|---|---|
| **State 1, nothing selected** | Repository-level real counts (module/section/cluster counts — the same numbers as the new summary line, see `STATE_1_OVERVIEW.md`); a compact, clearly-labeled "Orientation" sub-section retaining `RepoOrientationPanel`'s existing README-guidance content, but demoted to a collapsed/secondary position rather than being the entire panel | `RepoOrientationPanel`'s content is **not deleted** — it becomes one collapsible sub-section of the State-1 panel, not the default full panel |
| **State 1, a Layer-1/2 group hovered/selected but not entered** | That group's real member count, representative members, AI interpretation if generated (Component A from `AI_INTERPRETATION_SPEC.md`) | orientation content collapses/hides while a group is focused, matching the mockups' "panel follows selection" behavior |
| **State 2, inside a group** | Selected cluster's structural facts (member list, relation counts), AI name/description if generated, "Why these modules are grouped" disclosure | none of State 1's repo-wide orientation content is shown here |
| **State 3, Entity Focus** | Existing Architectural Explanation panel content, unchanged, plus the Layer-1/2 ancestry line specified in `STATE_3_ENTITY.md` | — |
| **State 4, Evidence** | Existing claim/evidence/source panel content, unchanged | — |

**Nothing is deleted in this design pass.** `RepoOrientationPanel`'s
content remains fully present and reachable; it is relocated to a
secondary, collapsed position specifically at State 1's unselected default,
where it was previously occupying the entire panel and visually competing
with the new grouped Overview it has no relationship to (this was the
literal mismatch Participant #2's screenshot showed: graph on the left,
unrelated "No strong areas yet" README guidance on the right).

## Accessibility model

The nested containment tree (Layer 1 → Layer 2 → entities) must be
representable as an accessible tree/table equivalent, extending — not
replacing — the existing `<details>` accessible-table pattern
(`ArchitectureMapCanvas.tsx`) that Phase A/B already established and that
this design's canvas changes must keep mirroring exactly.

- **Roles:** the container hierarchy maps to a standard nested
  `<details>`/`<summary>` tree (matching the existing accessible-table
  `<details>` wrapper already used for the flat case), OR an ARIA
  `role="tree"`/`role="treeitem"` structure if the implementation phase
  determines richer keyboard semantics are needed — either is acceptable
  as long as nesting depth is conveyed via `aria-level`/native nesting, not
  visual indentation alone.
- **Keyboard expand/collapse:** Enter/Space toggles a collapsed region
  exactly as the existing row-button pattern already does for entering a
  node (`obs-table-row-button`) — no new interaction vocabulary, the
  existing `onEnterNode(node, selectOnly)` callback contract is reused
  unchanged (confirmed generic over any node kind since Phase B).
  Arrow-key tree navigation is a reasonable *additional* enhancement but
  not required to match current accessibility parity.
- **Focus behavior:** expanding a region moves focus to its first visible
  child, matching standard disclosure-widget expectations; collapsing
  returns focus to the region's own header — consistent with the existing
  auto-collapse-on-stray-click discipline already documented in
  `ArchitectureMapCanvas.tsx`'s accessible-table code.
- **Group activation:** identical semantics to today's row button —
  `onEnterNode(node, event.altKey)` — reused for a Layer-1 region, a
  Layer-2 cluster, or a leaf entity alike; the accessible table gains one
  new "Layer" or "Kind" column value (`region`/`cluster`/`module`/...)
  rather than a parallel implementation.
- **AI interpretation accessible labels:** as specified in
  `AI_INTERPRETATION_SPEC.md`, the "AI interpretation:" prefix must be
  present in whatever text node/`aria-label` announces a Layer-3-labeled
  cluster in the accessible table, exactly matching the canvas card's
  accessible name — never a sighted-only distinction.
- **Deterministic vs. AI distinction, non-visually:** the accessible table
  gets one more real column: `Origin` (`deterministic` / `AI
  interpretation`), so a screen-reader/table user gets the same
  epistemic signal a sighted user gets from the chip/icon/color
  combination — satisfying "do not rely on color alone" for
  non-visual users too, not just colorblind sighted users.
