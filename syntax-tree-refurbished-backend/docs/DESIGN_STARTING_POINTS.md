# Design Starting Points

## Product Direction

The backend should support a code comprehension system that starts with meaning, not files.

The first durable artifact of an analysis run should be a System Overview: a source-grounded explanation of what the repo is, its main components, important anchors, relationships, gaps, and suggested follow-up questions.

## Core Principles

- Docs and README files guide investigation; they are not runtime proof.
- Code proof is implicit whenever code is referenced.
- Semantic anchors reveal what the system does.
- Raw readable code must remain available even when parsing fails.
- Parser output improves precision but must not gate AI reading.
- The AI should inspect evidence dynamically instead of receiving a giant static chunk dump.
- The system should understand progressively: overview first, details on demand, exact code only when needed.

## Candidate Core Objects

- `RepoSnapshot`
- `OrientationInventory`
- `SourceRegion`
- `SemanticAnchor`
- `EvidenceBrowserResult`
- `SystemOverview`
- `Lens`
- `InvestigationTrace`

These names are provisional.

## Current Non-Goals

- Rebuilding the old semantic concept table system.
- Treating Flow Lens as a separate core primitive.
- Building onboarding tours into the core backend.
- Making SQLite the product brain.
- Forcing every repo into app-style frontend/backend/auth/data layers.

