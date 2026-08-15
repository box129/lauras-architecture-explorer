# Refurbished Backend Architecture And Frontend Compatibility

## Core Idea

The backend should stay simple.

It should not try to precompute every possible semantic object. It should index the repo, discover important anchors, let the LLM investigate with source-reading tools, validate citations, and return frontend-friendly lenses.

The core internal objects are:

- `SystemOverview`
- `Lens`
- `SourceRegion`
- `SemanticAnchor`
- `RepoSnapshot`

The current frontend can remain mostly intact if the new backend exposes compatibility endpoints that translate these objects into the DTOs the UI already expects.

## Backend Flow

```text
Repo
  -> repo snapshot
  -> readable source index
  -> parser output where available
  -> orientation inventory
  -> semantic anchors
  -> LLM architectural investigation
  -> grounding/citation validation
  -> System Overview
  -> progressive lenses on demand
```

## Scan-Time Work

At scan time, the backend should produce:

- file inventory;
- raw readable source access;
- parser output where supported;
- docs/README/manifest orientation inventory;
- semantic anchors;
- System Overview;
- top-level architecture map derived from the overview.

The scan should not attempt to fully understand every file or every behavior.

## On-Demand Work

When the user clicks deeper or asks a question, the backend should investigate only that area.

```text
System Overview
  -> component lens
  -> subcomponent lens
  -> behavior lens
  -> exact source regions
```

Each deeper lens should use the previous level as context.

## Orientation Vs Proof

README, docs, examples, and manifests guide the AI.

They are not runtime proof by default.

Code, source regions, parsed symbols, anchors, routes, calls, schemas, and implementation slices prove claims.

## Evidence Browser

The LLM should navigate the repo through backend tools instead of receiving the whole repo or only static chunks.

Core operations:

- search code;
- search files;
- get file outline;
- read range;
- read whole file under budget;
- read enclosing region;
- expand region;
- find definitions;
- find references;
- get imports;
- get callers/callees where parser data exists;
- get related files.

For supported languages, use parser data.

For unsupported languages, degrade to text search, line windows, braces, indentation, headings, and regex outlines.

The backend decides exact paths, line ranges, hashes, and region IDs. The LLM cites returned region IDs. The backend validates them.

## System Overview

The System Overview is generated during architectural discovery.

It should cover:

- repo identity and shape;
- main components;
- major relationships;
- semantic anchors;
- important files and source regions;
- runtime/deployment shape where relevant;
- usage shape where relevant;
- known gaps and uncertainty;
- suggested follow-up questions.

The architecture map, question agent, and docs generator should all start from this overview.

## Lenses

A lens is the general product response object.

It can represent:

- architecture view;
- component deep dive;
- question answer;
- behavior walkthrough;
- documentation context.

Flow Lens should not be a separate core primitive. If a lens needs steps, it has steps.

Code proof is also not a separate core primitive. Whenever code is referenced, source regions are attached implicitly.

## Frontend Compatibility

The current frontend expects many endpoint shapes.

The new backend can remain simple internally and provide adapters externally.

### Architecture Map

```text
GET /api/architecture-map
```

Mapping:

```text
SystemOverview -> ArchitectureMapResponse
main_components -> nodes
relationships -> edges
```

### Node Detail And Drilldown

```text
GET /api/architecture-map/nodes/{id}
GET /api/architecture-map/nodes/{id}/children
GET /api/architecture-map/nodes/{id}/explanation
```

Mapping:

```text
overview component / component lens -> node detail, children, explanation
```

### Source Proof

```text
GET /api/architecture-map/nodes/{id}/implementation
GET /api/implementation-slices
GET /api/files/{path}
```

Mapping:

```text
SourceRegion[] -> ImplementationSliceDTO
SourceRegion path/range -> file content and highlights
```

### Questions

```text
POST /api/query
GET /api/query-lenses/{id}
GET /api/query-lenses/{id}/evidence
GET /api/query-lenses/{id}/implementation
```

Mapping:

```text
LLM investigation -> Lens -> QuestionLensDTO compatibility response
```

### Docs

```text
POST /api/docs/plan
POST /api/docs/generate
```

Mapping:

```text
SystemOverview + selected lenses + user request -> docs plan/generation
```

### Analysis Progress

```text
POST /api/analyze
GET /api/analyze/{job_id}/status
WS /api/ws/analyze/{job_id}
GET /api/runs/{run_id}/orientation
```

Mapping:

```text
analysis controller stages -> current frontend progress model
```

## Compatibility Rule

Internally simple.

Externally compatible.

Do not let legacy DTOs define the new backend brain.

The new internal model should stay:

```text
SystemOverview + Lens + SourceRegion + SemanticAnchor
```

