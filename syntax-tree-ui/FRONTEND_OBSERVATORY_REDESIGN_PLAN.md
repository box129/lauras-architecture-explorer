# Syntax Tree Frontend Observatory Redesign Plan

## Purpose

This document defines the frontend direction for Syntax Tree at its peak:

> A codebase observatory that turns a repository into a calm, zoomable architecture map, and every time the user touches a concept, the system shows the exact code, flow, and explanation behind it.

The goal is not to make the current frontend prettier. The goal is to redesign the product surface around the actual vision:

- meaning before files
- concepts before folders
- flows before raw dependency graphs
- code as proof, not punishment
- agent answers as visual lenses, not just chat messages
- documentation generated after exploration, not before understanding

The current frontend stack is good enough to keep:

- React
- Vite
- Tailwind
- React Flow / `@xyflow/react`
- Monaco
- Zustand
- Framer Motion
- TipTap
- ELK layout

The current surface is what should be replaced. The design language, information architecture, motion system, and user journey need a full rebuild.

## Product Identity

Syntax Tree should not feel like:

- a dashboard
- a file explorer
- a generic graph viewer
- a VS Code clone
- a chatbot beside a repo
- a documentation generator

It should feel like:

> a codebase observatory.

An observatory has a focal subject. The viewer stands still while the lens focuses. The system reveals scale, movement, and hidden structure without overwhelming the user.

That metaphor gives the frontend its operating principles:

- one focal subject at a time
- calm chrome
- precise zooming
- visual explanation first
- source proof always nearby
- uncertainty shown quietly
- no fake confidence

## Core Product Promise

The frontend must make this loop feel natural:

```text
Scan repo
  -> see high-level architecture landscape
  -> click a concept
  -> zoom into that concept
  -> see explanation
  -> inspect exact code proof
  -> ask a question
  -> get a visual lens
  -> save lenses into a tour or documentation artifact
```

The user should never have to ask:

- Where is this implemented?
- Which files matter?
- What happens when this action runs?
- Is this source-backed or inferred?
- Can I trust this answer?

The UI should answer those questions by default.

## Design Principles

## 1. Meaning First

The first screen after scan must not show files, folders, imports, or a giant graph.

It should show 5 to 9 evidence-backed semantic areas, such as:

- Frontend
- Backend
- AI / Model Providers
- RAG Pipeline
- Auth and Users
- Data and Storage
- Deployment
- Realtime
- Tools and Integrations

Only show those areas when the backend supports them. Library repos should not be forced into app layers.

## 2. Progressive Depth

Every interaction moves from general to specific:

```text
Repo
  -> Product area
  -> Subsystem
  -> Concept or flow
  -> Source span
```

The user should always know:

- where they are
- what they are looking at
- what can be clicked next
- what code proves the current view
- what evidence is weak or missing

Breadcrumbs are mandatory.

## 3. Code As Proof

The code viewer is not the main product. The architecture map is.

Code appears when it proves the selected concept, node, flow step, or question lens.

The code panel should answer:

- why this file is open
- which lines matter
- which concept or step those lines prove
- whether the span is verified, inferred, stale, or insufficient

The user should not feel dumped into a whole file and abandoned.

## 4. Visual Agent Answers

The agent should not only reply in paragraphs.

Architecture questions should produce visual lenses:

- "How does login work?" -> Login Flow lens
- "How does a document affect the answer?" -> RAG Question lens
- "Where does the model response come from?" -> Provider Routing lens
- "What touches auth?" -> Cross-cutting Auth overlay

Text explanation remains important, but the canvas should become the answer.

## 5. Honesty Is A First-Class UI State

The UI must not hide backend uncertainty.

Every major object should be able to show:

- verified
- partial
- candidate
- inferred
- unsupported
- stale

These are not errors. They are part of the product's trust model.

When the backend says evidence is weak, the frontend should show that calmly rather than smoothing it away.

## Visual Language

## Palette

Use a restrained functional palette. The interface should feel calm, expensive, and precise.

Suggested light palette:

```text
Canvas Sand       #F8F5F1
Surface Paper     #FCFAF7
Ink               #1A1916
Stone             #8F8A82
Border            #DED8CF
Slate Blue        #3D5A80
Citrine           #C9A227
Clay              #A0522D
Sage              #7A9B68
Muted Red         #B45C4A
```

Color roles:

- Sand: canvas background
- Paper: panels and node surfaces
- Ink: primary text and major lines
- Stone: secondary text and quiet chrome
- Slate Blue: focus, selected node, active lens
- Citrine: verified source evidence
- Clay: partial or inferred evidence
- Sage: supported flow progression
- Muted Red: real errors only

Avoid:

- purple-blue SaaS gradients
- loud rainbow node categories
- red for ordinary uncertainty
- decorative blobs or glow backgrounds
- excessive shadows

## Typography

Use one UI family and one monospace family.

Recommended:

- UI: Inter or Geist
- Code: JetBrains Mono, Berkeley Mono, or IBM Plex Mono

Scale:

```text
Display title: 20-24px
Section title: 16-18px
Body: 14-16px
Small UI: 12-13px
Code: 13-14px
```

Do not scale font size with viewport width. Use layout changes instead.

## Shape And Density

Cards and panels should be restrained:

- border radius: 8px maximum for cards
- node radius: 10px maximum only if the design needs softness
- icon buttons: square or circular, stable dimensions
- avoid cards inside cards
- avoid page sections styled as floating cards

The canvas needs space:

- top-level nodes should have generous gaps
- selected node should breathe
- rails should be calm and readable
- proof/code mode may be denser, but only after user intent

## Motion System

Motion is where the product can feel genuinely premium.

Use one main easing curve:

```css
cubic-bezier(0.16, 1, 0.3, 1)
```

Duration scale:

```text
80-120ms  micro interactions
240-320ms layout transitions
480-560ms full surface transitions
```

Rules:

- no bounce
- no decorative motion
- no different curve per component
- stagger groups by 24-32ms
- hover is subtle: 3-4 percent scale plus 1px outline
- layout skeletons instead of spinners after first scan

Motion meanings:

- zoom means change of abstraction
- fade means loss of focus
- slide-up means proof/code has entered
- slide-right means explanation/voice has entered
- dashed pulse means inferred or partial relation

## Primary App Surfaces

The redesigned frontend has five anchor surfaces.

## 1. Landscape Mode

This is the scan-complete first screen.

Purpose:

> Tell the user what kind of system this repo is.

Layout:

```text
Top bar:
  breadcrumb / repo title / run picker

Canvas:
  5 to 9 top-level semantic architecture nodes

Bottom:
  quiet question input

Rails:
  hidden by default
```

What appears:

- repo summary sentence
- evidence-backed top-level areas
- small evidence badges
- optional mini-map
- no code panel yet
- no file tree
- no raw dependency graph
- no dashboard metrics by default

Example:

```text
Open WebUI - self-hosted AI chat platform.
Backend: FastAPI. Frontend: SvelteKit. Real RAG, multi-provider routing,
websockets, auth, tools, and deployment configuration.
```

If evidence is partial:

```text
Open WebUI - analysis partial. Provider and RAG areas are source-backed,
but 18 percent of call edges remain unresolved.
```

Why:

This prevents the product from opening like a developer tool. It opens like a senior engineer giving the shape of the system.

## 2. Lens Mode

This is the main product mode. It appears after clicking a node, clicking a flow, or asking a question.

Purpose:

> Focus on one concept, show what it means, and keep proof nearby.

Layout:

```text
Top:
  breadcrumb and run state

Center:
  focused React Flow lens

Right:
  Voice rail with explanation, evidence, gaps, key files, related lenses

Bottom:
  Code Companion, hidden until useful
```

Examples:

- Backend lens
- RAG Pipeline lens
- Login Flow lens
- Model Providers lens
- "How does uploaded document affect answer?" question lens

The lens surface should be shared by browsing and questions. Clicking "RAG Pipeline" and asking "How does RAG work?" should both land in the same interaction model.

Why:

This unifies the product. It avoids separate mental models for architecture, chat, docs, and code.

## 3. Proof Mode

This mode appears when the user clicks a source-backed item:

- architecture node implementation
- concept evidence
- flow step
- question lens step
- citation pill

Purpose:

> Show exact code with context, but keep the architecture visible.

Layout:

```text
Canvas:
  remains visible, compressed if needed

Code Companion:
  expands to 35-55 percent of viewport

Voice rail:
  follows selected source span
```

Code Companion behavior:

- Monaco tabs come from backend implementation slices
- default tab is the highest-ranked source proof
- highlighted spans use line-range overlays and gutter annotations
- each tab has a reason
- stale spans show a subtle stale badge
- unsupported nodes show an explanation rather than fake tabs

Why:

This is the "show me the code" moment. It must feel precise and trustworthy.

## 4. Question Agent Surface

This is not a generic chat panel.

Purpose:

> Let the user ask architecture questions and receive visual answers.

Placement:

- bottom centered input
- max width around 720px
- max 3 lines before expand
- follows current lens context

Behavior:

- placeholder suggestions change based on current lens
- submitting creates or requests a question lens
- answer streams in the right rail or compact answer area
- citations appear as source pills
- clicking a source pill opens Proof Mode
- clicking an entity pill opens a Lens
- answer can be saved as a lens

Example placeholders in RAG Pipeline:

```text
How does a document affect the answer?
Where is the vector DB configured?
What happens if retrieval fails?
```

Why:

The agent becomes a controller for the architecture canvas, not a chatbot living beside it.

## 5. Docs Studio

Docs should feel like assembling proof-backed understanding, not asking an AI to dump markdown.

Purpose:

> Turn explored lenses into an artifact.

Route:

```text
/repo/:repoId/run/:runId/docs
```

Layout:

```text
Left:
  saved lenses and architecture areas

Middle:
  editable outline

Right:
  generated markdown preview

Bottom or rail:
  evidence coverage and unsupported claims
```

Behavior:

- user drags saved lenses into an outline
- docs plan appears before generation
- user accepts, edits, regenerates, or cancels
- generated sections show evidence dots per paragraph
- unsupported claims are visible
- markdown export first, PDF/HTML later

Why:

This makes documentation feel controlled and grounded.

## Signature Interaction: Focal Zoom

The most important interaction is clicking a node.

Target sequence:

1. User hovers a node.
2. Node scales by 3-4 percent.
3. Slate-blue outline appears.
4. Voice rail prefetches one-sentence summary.
5. User clicks.
6. Sibling nodes fade to 30-40 percent opacity.
7. Selected node centers.
8. Children load inside or around the selected region.
9. Breadcrumb updates.
10. Evidence badge and uncertainty message appear.
11. Code Companion slides up only when useful.

Timing:

```text
hover response: 80-120ms
focal zoom: 280-320ms
rail entrance: 240-320ms
code companion entrance: 280-320ms
```

Reason:

This gives the product a memorable feeling. The user does not navigate pages. They move attention through meaning.

## Canvas Design

## Node Types

Use one primary node component:

```text
LensNode
```

Props:

- id
- label
- kind
- description
- status
- confidence
- evidenceCount
- childrenCount
- canDrilldown
- primaryFiles
- icon
- accent
- warnings
- unsupportedReason

Avoid separate visual components for subsystem/component/function unless there is a genuine UX difference. Different backend kinds can be rendered by the same flexible node shell.

## Node Visual Anatomy

```text
Icon        Title
            One-line description

Evidence badge     Children count / file count
```

Badges:

- verified: filled citrine dot
- partial: half-filled clay dot
- candidate: hollow stone dot
- inferred: dashed ring
- unsupported: muted red slash or warning chip
- stale: small clock marker

Do not rely on color alone. Shape must carry meaning.

## Edge Types

Edges need semantic meaning.

Recommended edge styles:

- hierarchy: soft solid neutral
- dependency: thin neutral
- flow: directional slate/sage
- inferred: dashed clay
- external boundary: dotted line ending at boundary node
- contradiction/unsupported: muted red, only in diagnostics

Never let edges become ornamental. If the user cannot tell what an edge means, it should not be on the default canvas.

## Layout Modes

Support these modes over time:

1. Architecture landscape
2. Concept drilldown
3. Flow lens
4. Question lens
5. Cross-cutting overlay
6. Diff between runs
7. Time scrubber

Initial build should support 1-4.

## Voice Rail

The right rail is the guide.

Default width:

```text
360px desktop
full-screen drawer on mobile
```

Sections:

1. Title and status
2. One paragraph explanation
3. Evidence/uncertainty note
4. What happens here
5. Key files
6. Related lenses
7. Actions

Do not show every section at once if it creates clutter. Make lower sections collapsible.

The rail should be written in simple language:

- "This part handles document ingestion and retrieval."
- "Some retrieval paths are inferred from file structure."
- "No source-backed implementation was found for this node."

Avoid:

- generic AI prose
- marketing adjectives
- dense tables
- raw JSON or QNs by default

## Code Companion

The Code Companion is the proof surface.

Position:

- bottom panel by default
- can expand vertically
- can detach later as a right/bottom split

Behavior:

- hidden until there is selected source proof
- opens from implementation slices
- shows tabs only when multiple files exist
- highlights exact source spans
- syncs with selected canvas step
- supports copied source reference
- supports "open full file" but does not default to full-file browsing

Tab metadata:

- file path
- language
- reason
- role
- summary
- stale status
- source span count

Highlight metadata:

- start line
- end line
- status
- confidence
- reason

Monaco theme:

- custom light theme based on Sand/Paper/Ink
- restrained syntax colors
- no VS Code default theme
- line highlight should be soft and readable

Reason:

If the canvas is the explanation and the rail is the guide, Monaco is the proof. It should feel like a microscope, not a workspace dump.

## Honesty Surfaces

These are not optional. They are what make the product serious.

## Evidence Badges

Every node, flow step, and major answer should expose evidence state.

The badge should be small but consistent.

## Claim Dots

Agent prose should eventually show sentence-level evidence dots:

- source-cited
- inferred
- framework reasoning
- unsupported

Initial version can show paragraph-level dots.

## Inference Opt-In

When no source-cited answer exists, do not immediately show confident inference.

Offer:

```text
No source-cited answer found. Infer from file structure?
```

This lets the user choose lower-certainty reasoning.

## Self-Correction Notice

If the backend contradiction gate rewrites or rejects overconfident output, show a calm notice:

```text
The system flagged its first draft as overconfident and rewrote it.
```

Reason:

This increases trust. It shows the system is self-checking rather than hiding failure.

## URL And State Model

The frontend should be deep-linkable.

Suggested route structure:

```text
/repo/:repoId/run/:runId
/repo/:repoId/run/:runId/map
/repo/:repoId/run/:runId/lens/:lensId
/repo/:repoId/run/:runId/node/:nodeId
/repo/:repoId/run/:runId/docs
```

Query params:

```text
?file=backend/open_webui/routers/retrieval.py
?line=120
?span=source_span_id
?mode=proof
```

Why:

Shareable product states are a serious-product signal. A user should be able to send a link to "the RAG retrieval lens with the retriever source span open."

## Data Contracts

The frontend should consume typed semantic contracts first.

Primary APIs:

- `GET /api/architecture-map`
- `GET /api/architecture-map/nodes/{node_id}`
- `GET /api/architecture-map/nodes/{node_id}/children`
- `GET /api/architecture-map/nodes/{node_id}/evidence`
- `GET /api/architecture-map/nodes/{node_id}/implementation`
- `GET /api/implementation-slices`
- `GET /api/concepts`
- `GET /api/concepts/{concept_id}`
- `GET /api/flows`
- `GET /api/flows/{flow_id}`
- `GET /api/query-lenses/{lens_id}`
- `POST /api/query`
- `POST /api/docs/plan`
- `POST /api/docs/generate`

Legacy APIs may remain in diagnostics:

- `/api/views/*`
- `/api/nodes`
- `/api/edges`
- `/api/components`
- `/api/subsystems`
- `/api/layers`

Frontend rule:

> Product screens render backend-owned meaning. The frontend may arrange, animate, and filter. It must not invent product architecture.

## Frontend Architecture

## Suggested Directory Structure

```text
src/
  app/
    routes/
    shell/
    providers/
  design/
    tokens.ts
    motion.ts
    theme.css
  features/
    observatory/
      ObservatoryShell.tsx
      TopBar.tsx
      Breadcrumbs.tsx
      RunPicker.tsx
    architecture-map/
      ArchitectureMapCanvas.tsx
      LensNode.tsx
      SemanticEdge.tsx
      useArchitectureMap.ts
      mapLayout.ts
      mapTypes.ts
    lenses/
      LensSurface.tsx
      FlowLens.tsx
      QuestionLens.tsx
      CrossCuttingOverlay.tsx
      useLens.ts
    code-companion/
      CodeCompanion.tsx
      MonacoProofViewer.tsx
      SourceTabs.tsx
      SpanAnnotation.tsx
      monacoTheme.ts
    voice-rail/
      VoiceRail.tsx
      EvidenceSummary.tsx
      KeyFiles.tsx
      RelatedLenses.tsx
    question-agent/
      QuestionBar.tsx
      QueryStream.ts
      CitationPill.tsx
    docs-studio/
      DocsStudio.tsx
      OutlineEditor.tsx
      LensTray.tsx
      CoverageRail.tsx
  api/
    client.ts
    semanticTypes.ts
    generatedTypes.ts
  state/
    observatoryStore.ts
    lensStore.ts
```

Reason:

Feature folders make the redesign easier to build in parallel while keeping legacy components alive until replaced.

## State Model

Use Zustand, but split state by concern.

Core state:

- active repo
- active run
- current surface
- current lens
- selected node
- selected source span
- breadcrumb stack
- code companion state
- voice rail state
- saved lenses/tour

Avoid one giant store becoming a dumping ground.

## Development Phases

## Phase 0: Design Tokens And Shell

Goal:

Create the visual foundation without touching backend logic.

Build:

- color tokens
- typography tokens
- motion tokens
- base app shell
- top bar
- empty canvas area
- bottom question bar
- right voice rail shell
- responsive layout rules

Acceptance:

- app looks like the new product even with mock content
- no legacy dashboard visual language leaks into the shell
- layout works at desktop and laptop sizes

## Phase 1: Semantic Architecture Canvas

Goal:

Render `/api/architecture-map` as the new default product surface.

Build:

- `ArchitectureMapCanvas`
- `LensNode`
- semantic edge renderer
- status badges
- minimap
- loading skeleton
- unsupported/insufficient states
- top-level map mode

Acceptance:

- existing backend data can render without frontend semantic invention
- library repos do not show forced app layers if backend does not provide them
- node statuses are visible

## Phase 2: Focal Zoom And Breadcrumbs

Goal:

Make the signature click interaction real.

Build:

- hover prefetch
- click-to-focus
- sibling fade
- child loading
- breadcrumb stack
- back/zoom-out
- URL state sync

Acceptance:

- clicking a node feels like zooming into meaning, not opening a page
- breadcrumbs are always accurate
- drilldown uses backend children endpoint

## Phase 3: Voice Rail

Goal:

Give every selected object a calm explanation.

Build:

- title/status header
- explanation text
- uncertainty note
- what happens here
- key files
- related lenses
- actions

Acceptance:

- rail explains selected node without overwhelming
- weak evidence is visible
- no raw QNs by default

## Phase 4: Code Companion

Goal:

Make click-to-code proof work.

Build:

- implementation slice fetcher
- Monaco proof viewer
- source tabs
- highlight overlays
- gutter annotations
- stale/unsupported states
- animated scroll to selected span

Acceptance:

- clicking verified nodes opens exact source tabs/highlights
- unsupported nodes show a reason, not empty editor
- selected flow step syncs to code

## Phase 5: Flow Lens

Goal:

Render movement through the system.

Build:

- flow layout
- flow step nodes
- directional edge styling
- boundary nodes
- gaps/unresolved markers
- click step -> code span

Acceptance:

- login/create-order/RAG/provider flows render as readable motion
- partial flows are useful and honest
- no giant dependency graph

## Phase 6: Question Lens

Goal:

Make the agent answer visually.

Build:

- question bar wired to query
- visual_lenses consumption
- query-lens route
- citation/entity pills
- save lens
- unsupported/inferred handling

Acceptance:

- asking an architecture question can redraw the canvas
- answer text and visual lens stay synchronized
- citations open proof mode

## Phase 7: Docs Studio

Goal:

Generate documentation from explored architecture.

Build:

- saved lens tray
- outline editor
- docs plan review
- generate flow
- markdown editor/preview
- coverage labels
- evidence dots

Acceptance:

- user sees and edits outline before generation
- generated docs show evidence coverage
- unsupported claims are visible

## Phase 8: Wow Features

These come after the core experience works.

Potential features:

1. Run diff mode
   - compare two scans
   - new/removed/changed architecture nodes
   - code diff in Code Companion

2. Time scrubber
   - scrub between historical runs
   - components fade in/out
   - architecture evolution becomes visible

3. Cross-cutting overlay
   - show where auth/logging/config/error handling touches the system
   - overlay edges across current lens

4. Audience mode
   - explain for junior dev, senior dev, PM, lecturer, student
   - same lens, different voice

5. Lens tours
   - saved lenses become a guided walkthrough
   - shareable onboarding link

Reason:

These are the features people remember. They should not distract from the core, but they can make the product feel category-defining.

## Responsive Behavior

Desktop is primary.

Minimum serious desktop layout:

```text
Canvas: main area
Voice rail: right side
Code Companion: bottom
Question bar: bottom center
```

Tablet:

- voice rail becomes overlay drawer
- code companion can become full lower sheet
- canvas remains primary

Mobile:

- read-only exploration first
- stacked lens cards
- code proof opens full screen
- docs editing may be limited

This product is naturally desktop-heavy. Do not damage desktop quality to force mobile parity.

## Accessibility

Production-grade means keyboard and screen-reader support.

Required:

- keyboard navigation through nodes
- focus ring distinct from selected state
- `Cmd/Ctrl + K` command palette
- `Cmd/Ctrl + J` focus question bar
- `Esc` closes rail/drawer or exits proof mode
- arrow keys move through sibling nodes
- enter opens selected node
- all color statuses also use shape/text labels
- canvas has textual outline fallback
- code highlights are announced in source list

## Performance Requirements

The UI should feel instant even when backend analysis is slow.

Rules:

- prefetch node detail on hover
- cache implementation slices by subject id
- virtualize long source/evidence lists
- lazy-load Monaco
- lazy-load docs studio
- avoid rendering all graph nodes at once
- use React Flow only for current lens scope
- keep raw huge graph in diagnostics, not product canvas

Budgets:

```text
Initial shell paint: under 1s after JS loaded
Node hover response: under 120ms
Node click visual response: under 100ms
Lens transition: under 400ms including skeleton
Code companion open: under 500ms if slice cached
Canvas nodes in default product view: ideally under 40
```

## Testing Plan

## Unit Tests

- token utility functions
- node status badge rendering
- route/state serialization
- implementation slice tab selection
- evidence status mapping
- citation pill behavior

## Integration Tests

- architecture map loads
- click node -> children load
- click node -> voice rail opens
- click node with implementation -> code companion opens
- click flow step -> Monaco scrolls to span
- query returns lens -> canvas updates
- docs plan -> generate flow

## Visual Regression

Use Playwright screenshots for:

- landscape mode
- selected node lens
- RAG flow lens
- proof mode
- unsupported node
- no active run
- backend error
- docs plan review

## Accessibility Tests

- keyboard-only node navigation
- screen-reader labels for node statuses
- focus trap in drawers
- contrast checks for status badges

## Migration Strategy

Do not delete everything on day one.

Recommended approach:

1. Build new shell beside old shell.
2. Add feature flag:

```text
VITE_OBSERVATORY_UI=1
```

3. Route new product path to observatory shell.
4. Keep legacy views in a diagnostics route.
5. Replace current architecture view with semantic canvas.
6. Replace current code viewer with Code Companion.
7. Replace query panel with Question Agent surface.
8. Replace docs surface with Docs Studio.
9. Remove unused legacy components only after new workflows pass tests.

Why:

This keeps momentum without creating a risky big-bang rewrite.

## Development Order

Recommended build order:

1. Design tokens and shell
2. Landscape mock using static fixture
3. Architecture map API client/types
4. Real architecture landscape rendering
5. Focal zoom and breadcrumbs
6. Voice rail
7. Code Companion
8. Flow lens
9. Question lens
10. Docs Studio
11. Diagnostics/legacy quarantine
12. Wow features

This order creates a demo quickly while preserving a path to production.

## What We Should Not Do

- Do not hardcode Open WebUI UI nodes client-side.
- Do not derive product hierarchy from file names in the frontend.
- Do not hide backend uncertainty.
- Do not show a giant graph by default.
- Do not make the code editor the main screen.
- Do not ship a beautiful UI that implies false certainty.
- Do not delete legacy components until the replacement workflow works.
- Do not make the first screen a dashboard.
- Do not use health scores as the main UX.
- Do not use spinners where skeletons can show structure.

## Definition Of Peak

The frontend is at peak when this is true:

- A non-expert can open a repo and understand the system shape in under 30 seconds.
- A developer can click any meaningful concept and see the exact code behind it.
- A user can ask an architecture question and receive a visual, source-backed lens.
- Flows are readable as movement, not raw graph noise.
- Uncertainty is visible without being scary.
- Documentation is generated from explored, source-backed lenses.
- The product feels calm, fluid, precise, and trustworthy.
- The frontend never invents architecture meaning.

## One-Sentence Product Target

Syntax Tree should feel like a calm observatory for software systems: the canvas explains the architecture, the agent guides attention, and the code companion proves every claim.

