# PR Roadmap And Test Strategy

## Purpose

This roadmap describes the PR sequence needed to reach the refurbished backend architecture.

The product north star is fast system comprehension: the system should help a new engineer understand what is happening in an unfamiliar repository within minutes, like onboarding an intern into a workplace. The priority is a trustworthy System Overview, source-backed architecture areas, exact proof, and progressive drilldown into details only when needed.

Each PR should prove one capability without drifting away from the core philosophy:

```text
index everything readable;
find semantic anchors;
generate one reusable System Overview;
investigate progressively;
attach source regions whenever code is referenced;
validate citations;
keep the frontend compatible;
avoid rebuilding semantic-table soup.
```

## Philosophy Guardrails

Every PR should be checked against these rules:

- The parser is a precision accelerator, not the only way the AI can read code.
- README/docs/manifests guide investigation; they are not runtime proof by default.
- Code proof is implicit whenever code is referenced.
- Flow Lens should be dropped as a near-term product surface; step-by-step behavior can exist inside a general lens later, but it must not distract from system comprehension.
- System Overview is the shared understanding artifact.
- Deeper understanding happens on demand through lenses.
- Internal models remain simple: `SystemOverview`, `Lens`, `SourceRegion`, `SemanticAnchor`, `RepoSnapshot`.
- Frontend DTOs are compatibility outputs, not internal architecture.
- The LLM reasons, but the backend controls exact files, line ranges, hashes, and citations.

## PR0: Project Skeleton And Health

### Goal

Create a runnable refurbished backend without touching the old backend.

### Scope

- Add Python project skeleton.
- Add FastAPI app.
- Add config loading.
- Add health endpoint.
- Add test setup.
- Add basic logging.

### Endpoints

```text
GET /api/health
```

### Tests

- Backend starts.
- Health endpoint returns status, version, runtime, and no secrets.
- Test suite runs from a clean checkout.

### Philosophy Check

No old semantic tables, architecture projections, or flow subsystems are imported.

## PR1: Repo Snapshot And File Inventory

### Goal

Build a deterministic inventory of the repo.

### Scope

- Scan local repo path.
- Detect files, folders, size, line count, hash.
- Detect readable vs binary vs too large.
- Classify file roles: production, docs, config, test, example, generated, infrastructure.
- Detect language guesses.
- Detect manifests and package/workspace boundaries.
- Produce `RepoSnapshot`.

### Endpoints

```text
POST /api/analyze
GET  /api/analyze/{job_id}/status
GET  /api/runs/{run_id}/snapshot
```

### Tests

- `realistic_app` inventory is accurate.
- `httpx` inventory identifies Python package files and docs/config files.
- `zod` inventory identifies monorepo/workspace package boundaries.
- Binary and oversized files are skipped with clear reasons.
- Generated/vendor folders are not treated as core source.
- File hashes are stable across repeated scans.

### Strenuous Test

Run inventory on a large repo such as `n8n` or Open WebUI and confirm:

- scan completes without LLM;
- no memory spike from reading all files into one string;
- skipped files are counted honestly;
- readable file count and language counts are plausible.

### Philosophy Check

The snapshot only says what exists. It does not invent architecture.

## PR2: Raw Source Regions And Source Access

### Goal

Make every readable file accessible to the AI, even when parsing fails.

### Scope

- Create `SourceRegion` model.
- Implement line-range reading.
- Implement whole-file reading under token/size budget.
- Generate stable region IDs.
- Include path, line range, content hash, token count, region type.
- Store/read source regions.

### Endpoints

```text
GET  /api/source/files
GET  /api/source/files/{path}
GET  /api/source-regions/{id}
POST /api/evidence/read-range
```

### Tests

- Read exact lines from Python, TypeScript, Markdown, JSON, YAML, Go, Java, Rust, `.txt`.
- Whole-file read is allowed for small files.
- Large whole-file read fails gracefully with budget reason.
- Returned line numbers match actual file content.
- Region IDs are stable for same file hash and line range.
- File path traversal outside repo is rejected.

### Strenuous Test

Use a file with 5k+ lines:

- read middle range;
- expand around range;
- verify hashes and line boundaries;
- verify response does not include unrelated file content.

### Philosophy Check

Parser failure must not prevent raw source access.

## PR3: Evidence Browser

### Goal

Provide IDE-like source navigation for LLM investigation.

### Scope

Implement:

- `search_code`;
- `search_files`;
- `read_range`;
- `read_whole_file`;
- `expand_region`;
- `get_file_outline` with fallback heuristics.

Fallback outline should use headings, indentation, braces, and regex when AST is unavailable.

### Endpoints

```text
POST /api/evidence/search-code
POST /api/evidence/search-files
POST /api/evidence/expand-region
GET  /api/source/files/{path}/outline
```

### Tests

- Search finds code across parsed and unparsed readable files.
- Search results include path and exact line range.
- Expand region returns a larger valid source region.
- Markdown outline uses headings.
- Unsupported-language outline still returns useful lexical regions.
- Search respects file role filters.

### Strenuous Test

Ask the evidence browser to locate a known behavior in a mixed fixture:

- one hit in parsed Python;
- one hit in raw Go/Java/Rust;
- one hit in docs;
- verify proof status differs between source and orientation material.

### Philosophy Check

Static chunks are entry points, not the final reading unit.

## PR4: Parser Precision Layer

### Goal

Add structured parsing where available without making parsing mandatory for comprehension.

### Scope

- Add parser capability registry.
- Parse Python, JavaScript, TypeScript/TSX initially.
- Extract symbols, imports, calls, exports where possible.
- Link parsed symbols to source regions.
- Implement parsed-first `find_definition`.
- Implement parsed-first `find_references` with text fallback.

### Endpoints

```text
POST /api/evidence/find-definition
POST /api/evidence/find-references
```

### Tests

- Python symbols have exact regions.
- TypeScript classes/functions/interfaces have exact regions.
- Parser errors do not block raw file regions.
- Definitions can be found by symbol/name for parsed code.
- References fall back to text search when parsed call graph is unavailable.
- Parser coverage report distinguishes deeply parsed, text-indexed, skipped.

### Strenuous Test

Use a mixed-language fixture where one file is syntactically invalid:

- parser reports error;
- file remains readable;
- evidence browser can still read relevant ranges;
- system does not mark it deeply parsed.

### Philosophy Check

Parser output improves precision but never becomes the gatekeeper for AI reading.

## PR5: Orientation Inventory

### Goal

Make README/docs/manifests visible to the agent as guidance, not proof.

### Scope

- Detect README, docs pages, examples, tutorials, manifests, deployment notes.
- Extract Markdown headings and small summaries.
- Extract manifest metadata.
- Mark `proof_allowed=false` by default.
- Produce `OrientationItem` list.

### Endpoints

```text
GET /api/runs/{run_id}/orientation
GET /api/runs/{run_id}/orientation-inventory
```

### Tests

- README is detected and summarized.
- Docs headings are extracted.
- `package.json`, `pyproject.toml`, `requirements.txt` are classified as manifests/config.
- Orientation items cannot mark runtime claims as verified.
- If docs claim a feature but no source is inspected, claim status remains orientation-only or uncertain.

### Strenuous Test

Fixture contains a README that lies about a fake feature.

Expected:

- orientation inventory records the claim/signal;
- no architecture component is verified from docs alone;
- question about fake feature is answered as not source-verified.

### Philosophy Check

Docs guide investigation. Code proves behavior.

## PR6: Semantic Anchor Discovery

### Goal

Find behavioral doors into the system.

### Scope

Detect anchors:

- HTTP routes;
- frontend pages/screens;
- CLI commands;
- workers;
- cron jobs;
- webhooks;
- DB schemas/models/migrations;
- queue consumers/publishers;
- external API clients;
- public exports;
- plugin/registry patterns;
- deployment units.

Each anchor includes path, line range, source region, confidence, extraction method, and related symbols.

### Endpoints

```text
GET /api/runs/{run_id}/anchors
```

### Tests

- Full-stack fixture exposes route, frontend, auth, DB anchors.
- `httpx` exposes library/public API anchors, not web app anchors.
- `itsdangerous` exposes signing/serialization/package anchors.
- CLI fixture exposes command anchors.
- Queue/cron fixture exposes worker/scheduled anchors.
- External API client fixture detects outbound boundary anchors.

### Strenuous Test

Legacy mixed fixture with:

- config-driven job;
- CLI command;
- route handler;
- DB migration;
- plugin registry.

Expected:

- anchors are found without requiring perfect call graph;
- confidence/extraction methods are clear;
- unsupported patterns are reported as gaps.

### Philosophy Check

The system starts from behavior entrypoints and boundaries, not folder names.

## PR7: Grounding And Citation Validation

### Goal

Prevent hallucinated file paths, lines, and proof.

### Scope

- Add support statuses:
  - verified;
  - inferred;
  - orientation_only;
  - uncertain;
  - unsupported;
  - not_inspected.
- Validate cited region IDs.
- Validate line ranges.
- Validate file hashes.
- Reject/downgrade claims that cite unseen regions.
- Record grounding failures.

### Tests

- Valid citation passes.
- Nonexistent file citation fails.
- Line range outside region fails.
- Citation to region not shown to LLM fails.
- Orientation-only evidence cannot verify code behavior.
- Claim is downgraded when citation support is weak.

### Strenuous Test

Feed a fake LLM response with:

- one real citation;
- one invented file;
- one real file but wrong line range;
- one docs-only proof claim.

Expected:

- only real source citation remains verified;
- other claims are downgraded or rejected.

### Philosophy Check

The LLM can reason, but the backend decides what proof exists.

## PR8: LLM Investigation Engine

### Goal

Let the LLM inspect the repo dynamically with controlled budgets.

### Scope

- Implement investigation loop.
- Give LLM evidence-browser tools.
- Enforce max tool calls, token budget, file budget, and timeout.
- Record tool calls and returned region IDs.
- Require structured output.
- Support live model validation mode.
- Allow fallback only with explicit degraded status.

### Endpoint

```text
POST /api/investigate
```

### Tests

- Investigation can answer a focused question using tool calls.
- Tool budget is enforced.
- Returned claims cite only returned regions.
- Live LLM metadata is recorded when configured.
- Validation mode fails on silent fallback.
- Non-validation mode records fallback reason clearly.

### Strenuous Test

Question:

```text
How does a request reach the transport layer in httpx?
```

Expected:

- agent searches/reads relevant files;
- cites `_api.py`, `_client.py`, and `_transports/*` where appropriate;
- does not invent frontend/backend app behavior;
- result stays within tool/token budget.

### Philosophy Check

The agent investigates progressively instead of receiving the whole repo.

## PR9: System Overview Artifact

### Goal

Produce the shared understanding artifact during architectural discovery.

### Scope

- Generate `SystemOverview` from snapshot, orientation, anchors, and source investigation.
- Include main components, relationships, important regions, gaps, suggested questions.
- Cache by run/input hashes.
- Expose endpoint.

### Endpoint

```text
GET /api/system-overview
```

### Tests

- `httpx` overview identifies Python HTTP client library shape.
- Full-stack fixture overview identifies frontend/backend/auth/persistence/deployment when supported.
- Library repos do not get fake app/RAG/chat areas.
- Overview claims have support statuses.
- Important source regions are attached where code is referenced.
- Docs-only claims are not verified.

### Strenuous Test

Run overview generation on five repo shapes:

- tiny library;
- HTTP client library;
- full-stack app;
- TypeScript monorepo;
- legacy mixed fixture.

Expected:

- each overview has repo-appropriate components;
- no one-size-fits-all frontend/backend template;
- known gaps are explicit.

### Philosophy Check

System Overview is the shared understanding for the run.

## PR10: Architecture Map Frontend Compatibility

### Goal

Feed the current Observatory architecture canvas from the new System Overview.

### Scope

- Implement architecture-map compatibility adapter.
- Map overview components to nodes.
- Map overview relationships to edges.
- Map component source regions to evidence/implementation.
- Implement node details, children, explanation, evidence, implementation.

### Endpoints

```text
GET /api/architecture-map
GET /api/architecture-map/nodes/{id}
GET /api/architecture-map/nodes/{id}/children
GET /api/architecture-map/nodes/{id}/explanation
GET /api/architecture-map/nodes/{id}/evidence
GET /api/architecture-map/nodes/{id}/implementation
GET /api/implementation-slices
GET /api/files/{path}
```

### Tests

- Current frontend can render map without code changes.
- Node click opens explanation.
- Source proof opens exact source regions.
- Missing proof returns insufficient, not fake code.
- Node IDs are stable for a run.
- Library repo map does not show app-only areas.

### Strenuous Test

Run current frontend against new backend using `httpx`.

Expected:

- architecture map renders;
- top-level nodes match library shape;
- clicking nodes opens rail;
- proof opens `_client.py`/related source regions;
- no Open WebUI fixture text appears.

### Philosophy Check

Frontend DTOs are compatibility outputs, not the internal model.

## PR11: Progressive Lens Drilldown

### Goal

Support deeper understanding on demand.

### Scope

- Generate component lens from selected overview component.
- Generate child/subcomponent lenses when requested.
- Reuse System Overview as context.
- Attach source regions.
- Return children through compatibility endpoint.

### Tests

- Click major component -> deeper lens generated or retrieved.
- Lens uses previous overview context.
- Lens does not re-discover whole repo.
- Exact source regions attached when code is referenced.
- Lens can honestly return gaps/insufficient status.

### Strenuous Test

For `httpx`:

- root overview;
- click Client Lifecycle;
- drill into Sync/Async client behavior;
- verify source regions from `_client.py`.

### Philosophy Check

Overview first, details on demand, code only when needed.

## PR12: Question Agent Compatibility

### Goal

Make current Question Dock work from System Overview and focused investigation.

### Scope

- Implement `/api/query`.
- Start from System Overview.
- Run focused investigation only if needed.
- Return current `QueryResponseDTO`.
- Store/retrieve Lens through query-lens compatibility endpoints.

### Endpoints

```text
POST /api/query
GET  /api/query-lenses/{id}
GET  /api/query-lenses/{id}/evidence
GET  /api/query-lenses/{id}/implementation
```

### Tests

- Question uses overview as context.
- Source-backed answer cites valid source regions.
- Unsupported app question on library repo returns corrective unsupported answer.
- Follow-up questions are generated from actual overview/lens context.
- Understanding Pane can render response.

### Strenuous Test

Questions on `httpx`:

- How do sync and async clients differ?
- How does a request reach the transport layer?
- Does this repo have frontend routes or RAG?

Expected:

- first two cite code;
- third is calmly unsupported/corrective.

### Philosophy Check

Question agent does not start from scratch.

## PR13: Docs Compatibility

### Goal

Make docs generation use the System Overview instead of rediscovering the repo.

### Scope

- Implement docs plan/generate.
- Use System Overview, selected lenses, user prompt, audience.
- Fetch extra source regions only for requested detail.
- Preserve gaps and uncertainty.

### Endpoints

```text
POST /api/docs/plan
POST /api/docs/generate
```

### Tests

- Plan is generated from System Overview.
- Generated docs mention gaps when evidence is insufficient.
- Docs do not make docs-only claims verified.
- Architecture docs for `httpx` are library-appropriate.
- Full-stack docs are app-appropriate when evidence supports it.

### Strenuous Test

Generate onboarding docs for `httpx`.

Expected:

- public API, clients, transports, models, auth/config are covered;
- no frontend/backend server/RAG hallucination;
- code references point to valid source regions.

### Philosophy Check

Docs are downstream of shared understanding, not a separate architecture discovery agent.

## PR14: Runtime Metrics, Health, And Observability

### Goal

Make the system measurable and debuggable.

### Scope

- Health endpoint with masked provider status.
- Analysis progress stages.
- Token/cost/tool-call metrics.
- Per-stage timing.
- Cache hit/miss metrics.
- LLM fallback reason.
- Parser coverage report.

### Tests

- Health never exposes secrets.
- Metrics report LLM calls and fallback state.
- Stage timings are recorded.
- Parser coverage is visible.
- Large repo run reports memory/time reasonably.

### Strenuous Test

Run `zod` or n8n-like repo.

Expected:

- no unexplained long stall;
- stages show where time is spent;
- partial readiness is visible.

### Philosophy Check

Failures and uncertainty are explicit, not hidden behind frontend polish.

## PR15: Golden End-To-End QA

### Goal

Prove the refurbished backend works with the current frontend and stays aligned with the philosophy.

### Repos

- `realistic_app`
- `httpx`
- `full-stack-fastapi-template`
- `zod`
- large/legacy target such as n8n or Open WebUI when available

### Tests

- Start backend and frontend.
- Analyze each repo.
- Render architecture map.
- Click top-level nodes.
- Drill into at least one component.
- Ask a question.
- Open source proof.
- Generate docs.
- Capture screenshots/video.
- Run live LLM validation for at least `httpx` and one full-stack repo.

### Strenuous Acceptance

The system fails the PR if:

- frontend cannot render the map;
- source code cannot be read when parser fails;
- docs are used as verified runtime proof;
- library repos get app-only architecture;
- question agent starts cold instead of using overview;
- code references lack valid source regions;
- LLM fallback is silent;
- old semantic concept/flow subsystem becomes the internal brain again.

### Philosophy Check

The system behaves as a source-grounded investigation engine, not a precomputed semantic table machine.

## PR16: Legacy Cutover Decision

### Goal

Decide what old backend/frontend surfaces remain.

### Scope

- Compare old backend vs refurbished backend on golden repos.
- Keep only useful extraction/parsing ideas.
- Move old system behind explicit legacy path if needed.
- Remove dependency on old flow/concept projections from main path.

### Tests

- Current frontend works on refurbished backend.
- Legacy fallback is optional.
- No main product path calls old semantic projection as source of truth.

### Philosophy Check

The old backend must not quietly become the new backend again.

## Final Acceptance Standard

The refurbished system is ready when:

- it can index large repos without pretending to understand everything;
- it can read raw source even when parsing is weak;
- it finds semantic anchors;
- it generates a reusable System Overview;
- it answers questions from the overview plus focused investigation;
- it generates docs from the overview;
- every code reference has a valid source region;
- current frontend renders it through compatibility adapters;
- the architecture remains simple internally.

