# 16. Component inventory

| Existing component | Disposition | Note |
|---|---|---|
| `ObservatoryEntry` | **REPLACE** | Becomes the landing page; the env-form character goes, the folder picker and progress panel stay. |
| `observatory-entry__promise` | RETAIN, RESTYLE | Three-up "what you'll get". |
| `observatory-progress__stage/meter` | RETAIN | Human stage copy already correct; reused as-is. |
| `RepoOrientationPanel` | **RELOCATE** | From the whole default panel to one collapsed `<details>` in the Overview panel. Nothing deleted. |
| `ObservatoryTopBar` | **MERGE** | Splits into global nav (52px) + breadcrumb bar (44px) with one Back. |
| Top-bar ArrowLeft / "Back to parent" / Doc Studio "← Back" / code-viewer Back | **MERGE** | One Back control, one meaning. |
| `BreadcrumbTrail` | RETAIN | Extended to accept a cluster crumb. |
| `RunPicker` | **RELOCATE** | Human freshness stays in the header; the run hash moves to Settings → Technical details. |
| `LensNode` | RETAIN for entities, **REPLACE** at group level | Groups become `StructuralRegion` / `ClusterCard`. |
| `ArchitectureMapCanvas` accessible table | **REPLACE** | Becomes `ArchitectureTree`, a peer view with an Origin column. |
| Bottom interaction bar | **REPLACE** | Floating 36px control cluster. |
| `VoiceRail` (simple/technical/evidence) | **MERGE** | Folds into the state-aware contextual panel; the reading-level tabs survive at Entity state only. |
| `ClaimCard` | **RESTYLE** → `StatementCard` | Same semantics, new visual language, "claim" removed from copy. |
| `EvidenceItemRow` | RETAIN, RESTYLE | Becomes a numbered chain item with an evidence-kind chip. |
| Source overlay / code companion | RETAIN, RESTYLE | Becomes a permanent pane in the evidence state; highlight gains a solid edge. |
| `StatusBadge` | RETAIN unchanged | The one thing that must not move. |
| Map-confidence chip | **REMOVE FROM NORMAL UX** | No numeric confidence where none is meaningful. |
| `SettingsPanel` | **REPLACE** | Two-column surface map + appearance + technical details. |
| `DocsStudio` | **RESTYLE + RELOCATE** | Global destination, provenance-aware section picker. |
| Question dock | **RELOCATE** (later phase) | Out of scope for this pass; do not re-add a tall bottom bar. |

**New:** `ProvenanceChip`, `AIInterpretationCard`, `StatementCard`,
`StructuralRegion`, `ClusterCard`, `ArchitectureTree`, `ThemeToggle`.
All seven are built and live in `../components/epistemic/`.
