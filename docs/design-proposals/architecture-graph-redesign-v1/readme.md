# Syntax Tree — Design System

Syntax Tree ("Laura's Architecture Explorer") is a **local codebase-observability application**: point it at a
repository on disk and it turns the code into a calm, source-backed architecture map you can zoom through, ask
questions of, and drill into until you land on the exact file and line that justifies an answer. React 19 +
Vite frontend, FastAPI + SQLite backend, optional LLM providers (OpenRouter / Blackbox) for generated
explanations — with claim *verification* always deterministic and never LLM-decided.

The product's governing idea, visible in every surface: **never present something as known when it is only
inferred.** Statuses, dashed badges, "insufficient evidence" disclaimers and disabled-with-a-reason buttons all
exist to keep that promise.

## Surfaces represented

| Surface | What it is |
|---|---|
| **Observatory Entry** | The first screen. Hero question, three product promises, "Start a scan" panel (path + advanced settings), live analysis-progress panel with human stage copy, repository-orientation panel. |
| **Observatory Shell** | The working surface: 48px top bar (nav menu, breadcrumb, repo title, run picker), architecture-map canvas (React Flow node cards, edges, legend, minimap), 360px voice rail (simple / technical / evidence), floating question dock, code-companion drawer with Monaco. |
| **Repository documentation portal** | `/docs` — Georgia-serif document view over a component tree with dependency rows and syntax-highlighted source. |
| **Settings overlay** | Modal for architectural-explanation provider config. |
| **Legacy workspace** (deprecated) | `/legacy` — the earlier dark, Tailwind-token workspace. Kept only for reference; never build new work in it. |

## Sources this system was built from

- GitHub: **https://github.com/box129/lauras-architecture-explorer** (branch `main`) — the only source. Read further
  in it to go deeper than this system does; the frontend lives in `syntax-tree-ui/`, and the design truth is
  `syntax-tree-ui/src/index.css` (5,061 lines), `src/design/{tokens,motion,status,mapConfidence}.ts` and the
  feature folders under `src/features/observatory`, `architecture-map`, `architectural-explanation`.
- A verbatim copy of the upstream stylesheet is kept at `reference/upstream-index.css` for exact-value lookups.
- No Figma file, deck or brand-guideline document was provided.

## CONTENT FUNDAMENTALS

**Voice: a careful colleague reporting what was actually observed.** Calm, literal, faintly formal, never
enthusiastic. The product's whole credibility rests on not overstating, so the copy's default move is to name a
limit.

- **Person.** Second person for what the user does ("What repo do you want to understand?", "Paste a local
  repository path"). Third person for the system ("Syntax Tree scans a repository…", "The backend found this
  area, but source evidence is incomplete."). Never "we", never "I", never "let's".
- **Casing.** Sentence case everywhere — buttons ("Build architecture map", "Analyze another repository"),
  headings, menu items. UPPERCASE is reserved for two things: small field/eyebrow labels
  (`REPOSITORY PATH`, `COMPONENT`, `structural group`) and verification verdicts (`SUPPORTED`,
  `INSUFFICIENT EVIDENCE`, `CONTRADICTED`).
- **Emoji: never.** Not in UI, not in docs. Icons carry all glyph duty.
- **No exclamation marks, no "Oops", no "Something went wrong".** Errors name the cause and the next action:
  *"The frontend is running, but the backend is not reachable on port 8000. Start the backend and try again."*
- **Pipeline jargon is translated at the boundary.** `graph_index` → "Building the code graph";
  `repo_orientation` → "Orienting repository"; `flow_index` → "Tracing flows and frontend bridges". Raw ids stay
  available (mono, de-emphasised, copyable) but never lead.
- **Hedging is explicit, not vague.** "map confidence not available" instead of "0%". "Insufficient evidence"
  instead of "low confidence". "Select to expand" vs "Select to explore" — the label states which one happens.
- **Terminology discipline.** A deterministic directory grouping is a *repository section*, never an
  "architectural domain". A percentage is *map confidence* — "how confident Laura's structural analysis is that
  this area was correctly identified and classified" — and is never called AI confidence or claim confidence.
- **Microcopy examples worth copying:** "Architecture claims stay tied to files, spans, and evidence." ·
  "The first screen explains the system shape, not the folder tree." · "No source evidence rows returned for
  this node." · "Building a source-backed lens…" · "Preparing the analysis job."

## VISUAL FOUNDATIONS

**The feel: a warm paper observatory.** Off-white, low-contrast, no chrome for its own sake; the only saturated
color is meaning-bearing. The predecessor was a dark navy/crimson dashboard — the current system is its
deliberate opposite.

- **Color.** Canvas `#F8F5F1`, paper `#FCFAF7`, ink `#1A1916`, stone `#625F59`, border `#DED8CF`. One lead accent,
  slate blue `#3D5A80` (actions, focus, selection, links). Meaning accents: citrine `#755D00` (verified,
  progress), clay `#A0522D` (partial/inferred/gaps), sage `#4F7142` (completed stages), muted red `#873D31`
  (unsupported). Brighter `tokens.ts` variants (`#C9A227`, `#7A9B68`, `#B45C4A`) are for graph fills only.
  Tints are built with `color-mix(in srgb, … n%, …)` — usually 5–12% for backgrounds, 18–40% for borders.
- **Type.** Inter for everything UI, at deliberately off-grid weights (400/500/600/**650** buttons/**680**
  labels/700/**720** hero/800 eyebrows). JetBrains Mono for paths, spans, extractor versions, run ids, code.
  Georgia 500 *only* in the documentation portal. Hero `clamp(44px, 5vw, 72px)` at line-height 0.96; body 13px
  at 1.55; prose 15px at 1.75. Half-pixel sizes (10.5, 11.5, 12.5, 15.5) are intentional — do not round them.
- **Backgrounds.** No photography, no illustration, no pattern, no texture. The single gradient in the product is
  the canvas wash: two ~8–9% radial washes (citrine at 45% 26%, slate at 72% 18%) over canvas. Everything else
  is flat paper.
- **Cards.** Paper or translucent paper, 1px `--obs-border`, radius 10 (nodes) / 12 (panels, dialogs) / 14–16
  (dock, code companion), plus an ink-tinted shadow. Never a colored left border, never a gradient fill.
- **Shadows** are always ink-tinted (`rgba(26,25,22,…)`), never black, and scale with layer: nodes 0.055 →
  panels 0.08 → dock 0.09 → companion 0.13 → modal 0.28. Selection swaps in a slate-tinted shadow
  `0 16px 42px rgba(61,90,128,.14)`. Inner shadow appears once, as the "stale" status dot's `inset 3px 0 0`.
- **Transparency & blur.** Chrome floats: top bars `rgba(252,250,247,.86)` + `blur(18px)`, voice rail `.76`,
  question dock `.9`, code companion `.96`. Anything floating **over** the map gets a solid-enough backdrop —
  a real user read transparent overlays as "components overlapping each other".
- **Animation.** One curve for everything: `cubic-bezier(0.16, 1, 0.3, 1)`. Micro 120ms (hover/color), layout
  280ms (progress, position), surface 520ms (panels). Only three keyframes exist: spin (900ms linear), edge-flow
  dash, pulse ring. Nothing bounces, nothing slides in from off-screen.
- **Hover / press.** Node cards `scale(1.035)` plus a slate border; primary button lifts `translateY(-1px)` and
  darkens 12% toward ink; quiet buttons deepen their slate tint 5.5% → 9%; icon buttons gain a 7% slate wash and
  an 18% border. No shrink-on-press, no ripple.
- **Focus & disabled.** `outline: 3px solid var(--obs-slate-blue)` with 2px offset and a white inner ring — always
  visible, never removed. Disabled = 40–55% opacity, `cursor: not-allowed`, label intact, and (in the product's
  own rule) an explanation of *why*.
- **Layout rules.** Fixed 48px top bar; fixed 360px voice rail (420px in question mode); question dock pinned
  bottom, max 780px, and it moves up when the code companion opens; map canvas padded `26px 34px 112px`; prose
  capped at 760px, hero at 1180px. Breakpoints: 980px (hero stacks), 760px (docs grid collapses), 680px
  (padding tightens).
- **Imagery.** There is none, and that is the point: the map, the type and the status dots are the visuals.

## ICONOGRAPHY

- Upstream uses **lucide-react**, stroke width 1.6–1.9 (not the 2.0 default), sizes 12–20 inline and 25–30 inside
  node icon circles. Icons are monochrome and inherit `currentColor`; they never carry a fill or a brand color.
- Recurring glyphs: `git-branch` (brand lockup), `sparkles` (AI/eyebrow), `shield-check`, `compass`, `clock`,
  `folder-open`, `folder-tree`, `file-text`, `file-code-2`, `network`, `workflow`, `boxes`, `component`,
  `database`, `search-code`, `circle-alert`, `alert-triangle`, `circle-check-big`, `circle-x`, `loader-circle`,
  `chevron-right`/`chevron-down`, `arrow-left`, `arrow-right`, `arrow-up-right`, `copy`, `send`, `bookmark-plus`,
  `book-open`, `settings`, `x`.
- **The glyphs are vendored, not linked.** 52 lucide SVGs live in `assets/icons/` (copied from
  `lucide-icons/lucide`), and their markup is inlined in `components/core/Icon.jsx` as `iconGlyphs`. Rendering is
  a real `<svg>` at stroke width 1.75 — inside upstream's 1.6–1.9 range — inheriting `currentColor`. No CDN, no
  fetch, no CSS mask: icons must survive offline use and rasterised export, because the icon channel is one of
  the four that carry the epistemic distinction.
- **Icon fonts, sprites and emoji are not used.** Two unicode-ish marks do real work: the 9px status dot family
  (shape-coded, in `StatusBadge`) and `<kbd>Ctrl J</kbd>` in the question dock.
- **No logo exists.** The repository's `favicon.svg`, `icons.svg` and `assets/hero.png` are unrelated purple
  boilerplate (`#863bff` / `#aa3bff`) never referenced by the Observatory UI, so they were **not** adopted; they
  are not this product's brand. Wherever a mark would go, set **Syntax Tree** in Inter 650 next to a
  `git-branch` glyph, exactly as the app's own top bar does. Do not draw or invent a logo.

### Intentional additions

Nothing upstream is a shared "Button" or "Panel" component — those patterns live as CSS classes in
`index.css`. This system promotes them to components so consumers stop re-deriving them:

- **Button, IconButton, Chip, Callout, Panel** — lifted verbatim from `.observatory-entry__start`,
  `.obs-icon-button`, `.obs-chip`, `.obs-warning`, `.observatory-entry__panel`.
- **Icon** — a wrapper so lucide glyphs work without a bundler.
- **TabRail, ProgressMeter, PromiseCard, StateCard, StageRow, FileList, MapLegend** — each is one real upstream
  markup block (`.obs-voice-tabs`, `.observatory-progress__meter`, `.observatory-entry__promise`,
  `.obs-state-card`, `.observatory-progress__stage`, `.obs-file-list`, `.obs-legend`) given a name.

No component here exists without a counterpart in the source.

## Index

- `styles.css` — the one file consumers link. `@import` list only.
- `tokens/` — `colors.css` (Observatory palette, semantic aliases, status/stage colors, deprecated `.st-legacy`
  dark scope), `typography.css` (Google-Fonts Inter + JetBrains Mono, sizes, weights, tracking),
  `spacing.css` (spacing scale, radii, fixed layout metrics), `motion.css` (easing, durations, keyframes),
  `elevation.css` (shadows, blurs, scrim, canvas wash), `base.css` (element defaults, focus ring, scrollbars).
- `components/`
  - `core/` — Button, IconButton, Icon, StatusBadge, Chip, Callout, Panel
  - `forms/` — PathInput, TextInput, SegmentedControl, CheckField
  - `navigation/` — BreadcrumbTrail, RunPicker, TabRail
  - `map/` — LensNode, MapLegend
  - `evidence/` — ClaimCard, EvidenceRow, FileList
  - `feedback/` — StateCard, StageRow, ProgressMeter, PromiseCard
  
  Each directory has one `*.card.html` thumbnail; each component has `.d.ts` (props + adherence) and
  `.prompt.md` (what/when + usage).
  - `epistemic/` — ProvenanceChip, AIInterpretationCard, StatementCard, StructuralRegion, ClusterCard,
    ArchitectureTree, ThemeToggle (the redesign's provenance language)
- `guidelines/` — 21 foundation specimen cards (Colors, Type, Spacing, Brand, Theme groups).
- `design-package/` — the external UI/UX redesign: 17 specs, answers to the review questions, and the
  recommended direction. Start at `design-package/00_README.md`.
- `ui_kits/lauras-redesign/` — the redesign prototype (all twelve required mockups as live states).
- `reference/upstream-index.css` — verbatim upstream stylesheet, for exact-value lookups.
- `thumbnail.html` — project tile. `SKILL.md` — Agent-Skills entry point. `github.md` — upstream sync record.

**Two UI kits, deliberately different jobs:** `ui_kits/syntax-tree/` recreates the product *as built today*;
`ui_kits/lauras-redesign/` proposes what it should become. Keep both — the recreation is the reference the
redesign is judged against.

## Themes

`tokens/theme.css` adds a light/dark/system layer on top of the base palette. With no `data-theme` on
`<html>` the OS preference decides; `data-theme="light"|"dark"` is an explicit, persisted choice. Because the
dark scope re-declares the `--obs-*` base tokens, every component in this system themes automatically — build
with semantic tokens (`--bg-surface`, `--text-primary`, `--ai-accent`, `--verification-supported`) and you get
both themes for free.

## Using this system

1. Link `styles.css`; use `var(--obs-*)` / semantic aliases, never raw hex.
2. Compose from the components above rather than re-styling upstream class names.
3. Copy exact upstream numbers when you extend it — if the source says 12.5px, write 12.5px.
4. Keep the honesty rules: statuses shape-coded, scores dashed, gaps stated, disabled things explained.
