# Laura's — external UI/UX product redesign

Design package for the checkpoint `1ad6f0ba3807bc5e19ac3554ca08fb74ed769d3a`
(tag `v1-claude-design-review`) of **box129/lauras-architecture-explorer**.

No production code was changed. Everything here is a design artifact:
specs in this folder, live mockups in `../ui_kits/lauras-redesign/`,
tokens in `../tokens/theme.css`, components in `../components/epistemic/`.

| # | Document |
|---|---|
| 1 | [CURRENT_PRODUCT_AUDIT](01_CURRENT_PRODUCT_AUDIT.md) |
| 2 | [INFORMATION_ARCHITECTURE](02_INFORMATION_ARCHITECTURE.md) |
| 3 | [LANDING_PAGE_SPEC](03_LANDING_PAGE_SPEC.md) |
| 4 | [ARCHITECTURE_OVERVIEW_SPEC](04_ARCHITECTURE_OVERVIEW_SPEC.md) |
| 5 | [GROUP_VIEW_SPEC](05_GROUP_VIEW_SPEC.md) |
| 6 | [ENTITY_FOCUS_SPEC](06_ENTITY_FOCUS_SPEC.md) |
| 7 | [EVIDENCE_SOURCE_SPEC](07_EVIDENCE_SOURCE_SPEC.md) |
| 8 | [CONTEXTUAL_PANEL_SPEC](08_CONTEXTUAL_PANEL_SPEC.md) |
| 9 | [AI_VISUAL_LANGUAGE](09_AI_VISUAL_LANGUAGE.md) |
| 10 | [VERIFIED_CLAIM_VISUAL_LANGUAGE](10_VERIFIED_CLAIM_VISUAL_LANGUAGE.md) |
| 11 | [THEME_SYSTEM](11_THEME_SYSTEM.md) |
| 12 | [ACCESSIBILITY_SPEC](12_ACCESSIBILITY_SPEC.md) |
| 13 | [RESPONSIVE_SPEC](13_RESPONSIVE_SPEC.md) |
| 14 | [SETTINGS_SPEC](14_SETTINGS_SPEC.md) |
| 15 | [DOC_STUDIO_INTEGRATION](15_DOC_STUDIO_INTEGRATION.md) |
| 16 | [COMPONENT_INVENTORY](16_COMPONENT_INVENTORY.md) |
| 17 | [IMPLEMENTATION_PRIORITIES](17_IMPLEMENTATION_PRIORITIES.md) |
| — | [DESIGN_QUESTIONS answered + recommended direction](18_DESIGN_QUESTIONS.md) |

## Mockups

All twelve required visuals live in one interactive prototype,
`../ui_kits/lauras-redesign/index.html` — states, not screenshots, so a
reviewer can walk the whole journey and flip the theme at any point.

| Required deliverable | Where |
|---|---|
| 1–2. Landing, light + dark | first screen; theme control top-right |
| 3–4. Architecture Overview, light + dark | Browse repository → analysis completes |
| 5. Group / drill-down | Enter `src/services`, or a cluster |
| 6. Entity Focus | select a module inside a group |
| 7. Statement + evidence | "View evidence" on any statement |
| 8. Source with exact highlight | right pane of the evidence state |
| 9. Settings — AI + theme | global nav → Settings |
| 10. Accessible architecture view | canvas controls → Tree view |
| 11. Responsive 1366×768 | resize; see RESPONSIVE_SPEC for the rules |
| 12. Component / token sheet | Design System tab: Theme + Components groups |

The prototype's structural figures come from the repository's own
`DETERMINISTIC_CAPABILITY.md` exercise on `topic-similarity-mvp`.
Statement, evidence and source text are design examples and are labelled
as such on screen.

- `19_ARCHITECTURE_GRAPH_SPEC.md` — the graph-first Map canvas: three visual
  levels, aggregated relations, semantic zoom, expand vs enter, entity focus,
  orientation, repository shapes. Prototype: `ui_kits/lauras-graph/index.html`.
