repo: box129/lauras-architecture-explorer
branch: main
path: syntax-tree-ui

## Last sync

tag: v1-claude-design-review

date: 2026-08-15T05:36:00Z
commit: 1ad6f0ba3807bc5e19ac3554ca08fb74ed769d3a

### Updated in this project
- Extracted the Observatory token system (colors, type, spacing, motion, elevation) from `src/index.css` and `src/design/*.ts`.
- Authored 21 components across core, forms, navigation, map, evidence and feedback groups.
- Added 18 foundation specimen cards plus per-directory component cards.
- Recorded content, visual and iconography foundations in `readme.md`; flagged that the repo ships no logo.
- Read the design-review checkpoint's proposal docs and produced a full external UI/UX redesign package.
- Added a light/dark/system theme token layer and seven provenance components.

## Screen map

| Project file | Built from |
|---|---|
| tokens/colors.css | syntax-tree-ui/src/index.css (:root, @theme), src/design/tokens.ts, src/design/status.ts |
| tokens/typography.css | src/index.css (font stacks, sizes), src/design/tokens.ts |
| tokens/spacing.css | src/index.css (paddings/radii), src/design/tokens.ts (layout) |
| tokens/motion.css | src/design/motion.ts, src/index.css keyframes |
| tokens/elevation.css | src/index.css (box-shadow, backdrop-filter, .observatory-shell background) |
| components/core/StatusBadge | src/features/observatory/StatusBadge.tsx, src/design/status.ts, .obs-status* CSS |
| components/core/Button, IconButton, Chip, Callout, Panel | src/index.css (.observatory-entry__start, .obs-icon-button, .obs-chip, .obs-warning, .observatory-entry__panel) |
| components/forms/* | src/features/observatory/ObservatoryEntry.tsx, .observatory-entry__* CSS |
| components/navigation/BreadcrumbTrail | src/features/observatory/BreadcrumbTrail.tsx |
| components/navigation/RunPicker | src/features/observatory/RunPicker.tsx |
| components/navigation/TabRail | src/features/observatory/VoiceRail.tsx, .obs-voice-tabs CSS |
| components/map/LensNode, MapLegend | src/features/architecture-map/LensNode.tsx, .obs-rf-node*/.obs-legend CSS |
| components/evidence/ClaimCard | src/features/architectural-explanation/ClaimCard.tsx, .la-claim-card CSS |
| components/evidence/EvidenceRow, FileList | src/features/observatory/VoiceRail.tsx, .obs-evidence-list/.obs-file-list CSS |
| components/feedback/StateCard | src/features/architecture-map/ArchitectureMapStates.tsx |
| components/feedback/StageRow, ProgressMeter, PromiseCard | src/features/observatory/ObservatoryEntry.tsx |
| guidelines/* | src/index.css, src/design/*.ts |
| tokens/theme.css | docs/design-proposals/semantic-architecture-overview/INFORMATION_MODEL.md, AI_INTERPRETATION_SPEC.md |
| components/epistemic/* | semantic-architecture-overview/{INFORMATION_MODEL,AI_INTERPRETATION_SPEC,RIGHT_PANEL_SPEC}.md |
| ui_kits/lauras-redesign/* | semantic-architecture-overview/STATE_1..4_*.md, architecture-navigation/STATE_MODEL.md, DESIGN_REVIEW_CHECKPOINT.md |
| design-package/* | all of docs/design-proposals/, qa-audit findings cited in DESIGN_PRINCIPLES.md |
