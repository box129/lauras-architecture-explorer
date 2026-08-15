# 20. Architecture-first recomposition — review handoff

This revision responds to the central usability complaint that the high-level
map still looked like a filesystem.

## What changed in the prototype

- `Backend` / `Frontend` remain large deterministic structural frames.
- Intermediate directory ancestry (`backend/src/...`) is demoted from primary
  visual objects to **structural basis metadata**.
- `controllers`, `services`, `middleware`, `config`, `utils`, `tests` are laid
  out by their deterministic relation flow rather than as a directory stack.
- `services` becomes a large architecture area containing the five real
  deterministic relation clusters.
- Cluster names such as `Authentication & Sessions` are explicitly marked
  **AI interpretation** and disappear when AI labels are switched off.
- Strong group-level relations are visible by default.
- The residual ungrouped set is a quiet collapsed strip, not a competing
  architecture region.
- Search, semantic zoom, Map/Outline, minimap, selection dimming and Entity
  Focus remain part of the graph-first experience.

## Files changed for this prototype revision

- `ui_kits/lauras-graph/graph-data.js`
- `ui_kits/lauras-graph/GraphCanvas.jsx`
- `ui_kits/lauras-graph/GraphScreens.jsx`
- `ui_kits/lauras-graph/index.html`
- `tokens/theme.css`
- `design-package/19_ARCHITECTURE_GRAPH_SPEC.md`

## What is still illustrative

All semantic architectural names are design examples. They must not be copied
into production as hard-coded truth. Production should obtain an optional
semantic name only after the deterministic group membership is fixed.

Edge counts in the prototype represent the existing design-example relation
counts. Production group-edge aggregation requires a documented deterministic
contract over resolved member-level relations.

## Recommended production sequence

1. Implement deterministic aggregate edge DTO/contract.
2. Implement containment-aware auto-layout and edge routing.
3. Port the architecture-first node/region composition.
4. Add semantic zoom / level-of-detail.
5. Synchronize Map + Outline.
6. Add deterministic relation clustering.
7. Add optional AI names/descriptions on fixed groups.
8. Re-run formative usability review before formal study freeze.
