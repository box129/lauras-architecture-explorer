# Syntax Tree System Brief For External LLM Critique

## Purpose Of This Document

This document is written for an external LLM critic. Its job is to understand the Syntax Tree system, critique the architecture, identify weak assumptions, and propose better engineering directions.

The system should be judged against this product vision:

> Syntax Tree turns a repository into a calm, zoomable architecture map. When the user touches a concept, flow, claim, or question, the system shows the exact code, source evidence, and explanation behind it.

This is not meant to be a normal code browser, dependency graph, static documentation generator, or chatbot. The intended product is a codebase comprehension studio: meaning first, code proof second, raw files only when needed.

## Repositories And Main Files To Read

Workspace root:

- `syntax-tree/` - backend analysis, semantic APIs, LLM orchestration, benchmark gauntlet.
- `syntax-tree-ui/` - frontend Observatory UI, React Flow canvas, proof pane, question lenses, docs studio.
- `bench-repos/` - benchmark repos such as Zod, httpx, requests, axios, express, itsdangerous.
- `benches_2/` - larger product benchmark targets and audit documents.
- `syntax-tree-e2e-fixtures/` - controlled product-style fixtures for end-to-end QA.

Backend files:

- `syntax-tree/syntax_tree/api/routers/analysis.py` - analysis lifecycle. Starts scans, runs extraction, semantic stages, LLM stages, architecture generation, and run metadata.
- `syntax-tree/syntax_tree/agents/llm_client.py` - LLM provider abstraction for OpenRouter/Blackbox, retries, JSON parsing, timeouts, key selection, token accounting.
- `syntax-tree/syntax_tree/api/dependencies.py` - runtime state, active graph, active run, LLM policy, validation mode.
- `syntax-tree/syntax_tree/pipeline/orchestrator.py` - file discovery, parsing, symbol/call extraction, import resolution.
- `syntax-tree/syntax_tree/discovery/file_discovery.py` - file role classification and ignored paths.
- `syntax-tree/syntax_tree/parser/typescript_adapter.py` - TypeScript/JavaScript extraction.
- `syntax-tree/syntax_tree/parser/python_adapter.py` - Python extraction.
- `syntax-tree/syntax_tree/resolver/reference_resolver.py` - cross-file call/import resolution.
- `syntax-tree/syntax_tree/api/routers/architecture_map.py` - typed architecture-map endpoint family.
- `syntax-tree/syntax_tree/api/projections/architecture_map.py` - read-only architecture-map projection from graph/semantic truth.
- `syntax-tree/syntax_tree/api/routers/implementation_slices.py` - generic click-to-code proof endpoint.
- `syntax-tree/syntax_tree/api/projections/implementation_slices.py` - code proof tab/highlight ranking.
- `syntax-tree/syntax_tree/semantic/concept_synthesis.py` - repo-shape-aware concept synthesis, deterministic candidates plus optional LLM refinement.
- `syntax-tree/syntax_tree/semantic/architecture_explanations.py` - analysis-time LLM explanations for architecture-map nodes.
- `syntax-tree/syntax_tree/semantic/flows.py` - backend route and flow tracing.
- `syntax-tree/syntax_tree/semantic/frontend_bridge.py` - frontend event/API call to backend route bridge.
- `syntax-tree/syntax_tree/semantic/flow_llm_review.py` - LLM review of flow truthfulness and clarity.
- `syntax-tree/syntax_tree/api/projections/question_lenses.py` - visual answer lenses for questions.
- `syntax-tree/syntax_tree/api/routers/query.py` - query endpoint that can return answers and visual lenses.
- `syntax-tree/syntax_tree/agents/documentation/` - docs planning/generation logic.
- `syntax-tree/scripts/benchmark_gauntlet.py` - benchmark lanes, corpus profiles, scoring, reports.
- `syntax-tree/FINAL_BACKEND_HARDENING_BEFORE_FRONTEND_PLAN.md` - current backend trust-hardening plan.
- `syntax-tree/END_TO_END_BRUTAL_QA_STRATEGY.md` - QA execution guide.

Frontend files:

- `syntax-tree-ui/src/App.tsx` - route selection: Observatory default, legacy fallback, preview/docs paths.
- `syntax-tree-ui/src/features/observatory/ObservatoryEntry.tsx` - new start/analyze/progress screen.
- `syntax-tree-ui/src/features/observatory/ObservatoryShell.tsx` - main Observatory workspace.
- `syntax-tree-ui/src/features/architecture-map/ArchitectureMapCanvas.tsx` - React Flow architecture map.
- `syntax-tree-ui/src/features/architecture-map/useArchitectureLens.ts` - architecture lens state, drilldown, URL state.
- `syntax-tree-ui/src/features/architecture-map/lensCache.ts` - cached calls to architecture map, flows, question lenses, proof endpoints.
- `syntax-tree-ui/src/features/code-companion/CodeCompanion.tsx` - bottom proof surface.
- `syntax-tree-ui/src/features/code-companion/useCodeCompanionData.ts` - implementation slice and source file loading.
- `syntax-tree-ui/src/features/flows/FlowLensCanvas.tsx` - movement-first flow view.
- `syntax-tree-ui/src/features/flows/FlowVoiceRail.tsx` - flow explanation rail.
- `syntax-tree-ui/src/features/question-lens/QuestionLensCanvas.tsx` - visual answer lens from query results.
- `syntax-tree-ui/src/features/question-lens/UnderstandingPane.tsx` - audience-friendly explanation pane.
- `syntax-tree-ui/src/features/observatory/QuestionDock.tsx` - question entry surface.
- `syntax-tree-ui/src/features/docs-studio/DocsStudio.tsx` - docs from saved lenses.
- `syntax-tree-ui/src/features/lens-library/` - saved lenses, tours, docs draft local storage.
- `syntax-tree-ui/src/index.css` - Observatory visual system.
- `syntax-tree-ui/vite.config.ts` - dev proxy; currently supports `VITE_API_TARGET`.

## What The System Is Supposed To Do

The backend scans a repo and creates a source-backed semantic model:

1. Discover files and assign roles such as production, docs, test, generated, config, infrastructure.
2. Parse source files into modules, classes, functions, imports, calls, source spans, and source file records.
3. Resolve cross-file references where possible.
4. Build source spans and retrieval chunks.
5. Build summaries, concepts, flows, frontend/API bridge records, and architecture hierarchy.
6. Optionally use an LLM for concept synthesis, flow review, architecture summaries, node explanations, query answers, and documentation.
7. Expose product-ready read models through APIs:
   - `/api/architecture-map`
   - `/api/architecture-map/nodes/{node_id}/children`
   - `/api/architecture-map/nodes/{node_id}/evidence`
   - `/api/architecture-map/nodes/{node_id}/implementation`
   - `/api/architecture-map/nodes/{node_id}/explanation`
   - `/api/implementation-slices`
   - `/api/flows`
   - `/api/query`
   - `/api/query-lenses/{lens_id}`
   - `/api/docs/plan`
   - `/api/docs/generate`

The frontend then renders those backend-owned meanings:

1. The user starts an analysis from the Observatory entry page.
2. When the scan completes, the UI opens an architecture map, not a file tree.
3. The user clicks nodes to drill into child lenses.
4. The voice rail explains the selected node using backend-provided explanation fields.
5. The Code Companion opens exact source tabs/highlights for proof.
6. Flow lenses show movement through frontend events, API calls, backend routes, services, repositories, and boundaries.
7. Question lenses turn natural-language questions into answer-shaped maps.
8. Saved lenses, tours, and Docs Studio let users turn exploration into source-backed documentation.

## Main Architectural Idea

The central design choice is a split between:

- canonical extracted truth: files, symbols, calls, source spans, graph nodes, semantic tables;
- product read models: architecture map nodes, implementation slices, flow DTOs, question lenses, docs outlines.

The backend owns meaning. The frontend owns layout, motion, interaction, and reading comfort.

This was chosen because the old UI/dashboard model made the frontend too tempted to invent architecture categories. If the frontend guesses "Frontend", "Backend", "Auth", "RAG", or "Deployment", it may look good while lying. The architecture map must come from backend evidence, not UI desire.

The API is therefore intended as a semantic contract:

- backend says what exists;
- backend says what is verified, insufficient, stale, unsupported, candidate, or legacy;
- backend says what source proves it;
- frontend decides how to show it calmly.

## Why The Architecture Was Chosen

### 1. Source spans as the proof unit

Every serious claim should trace back to a source span, symbol, file, flow step, or graph reference. This makes the product different from a chatbot: the answer is inspectable.

Why this is good:

- Users can click from concept to code.
- Documentation can cite real files and lines.
- Unsupported claims can be visibly downgraded.
- The product can be audited by tests.

Risk:

- Source spans are only as good as parsing, file-role classification, and reference resolution.
- If spans are missing, the system can become too cautious or too generic.

### 2. Read-only architecture-map projection

The architecture map is currently a projection over graph hierarchy plus semantic tables, not a canonical persisted table.

Why this is good:

- Avoids locking into the wrong schema too early.
- Lets graph, concepts, flows, and evidence evolve independently.
- Keeps architecture-map IDs deterministic without adding migration risk.

Risk:

- Projection can become complex and slow.
- Recomputing details/children/evidence can duplicate work.
- If projection logic catches exceptions silently, the frontend sees empty maps instead of real failures.

### 3. Analysis-time explanations instead of click-time LLM

Node explanations are generated during analysis and cached. The frontend fetches them instantly when a node is selected.

Why this is good:

- Clicks stay fast.
- LLM cost is attached to analysis, not every interaction.
- Explanations can be validated and cached.
- The UI can work offline after analysis.

Risk:

- Analysis time increases.
- Large repos can generate too many explanation calls.
- If explanations are generated before the architecture map is stable, cached prose may describe weak structure.

### 4. Deterministic first, LLM second

The system tries to build deterministic candidates and then let the LLM refine names, groupings, explanations, and reviews.

Why this is good:

- LLMs improve wording and high-level meaning.
- Deterministic candidates keep the LLM grounded.
- Validation mode can fail if the LLM silently falls back.

Risk:

- Deterministic candidates can be weak or biased.
- The LLM can still overstate evidence unless gated.
- If the candidate set is wrong, the LLM may polish the wrong answer.

### 5. Observatory UI instead of dashboard UI

The new frontend is built around a calm canvas, rail, question dock, and code companion.

Why this is good:

- Non-technical users start with meaning, not files.
- Developers can still inspect code when needed.
- The UI supports architecture, flows, questions, proof, docs, and tours in one mental model.

Risk:

- If backend data is weak, the premium UI can make weak claims look authoritative.
- Complex states can accumulate: architecture lens, flow lens, question lens, proof state, saved lens, docs route.
- Without strong URL/run state, multi-tab behavior can be confusing.

## How The Current Pipeline Works

In simplified form, `analysis.py` runs:

1. Configure runtime policy and LLM.
2. Run extraction via `PipelineOrchestrator`.
3. Store graph and source information.
4. Build source spans.
5. Build retrieval chunks.
6. Build semantic summaries.
7. Build deterministic semantic concepts.
8. Build backend flows.
9. Build frontend-to-backend flow bridge.
10. Run LLM flow review if configured.
11. Run architecture agent.
12. Run concept synthesis.
13. Generate architecture-node explanations.
14. Record semantic consistency and finish the job.

The critic should notice that this is a mostly serial pipeline. It creates a lot of useful artifacts, but it also means one slow stage can delay the whole product experience.

## Main Problems And Why They Exist

### Problem 1: Large-repo performance is not solved deeply enough

Why it exists:

The current system was built around proving semantic correctness on small and medium benchmark repos. It can scan and reason, but it does not yet have a dedicated large-repo operating mode.

Large repos need different behavior:

- package-level indexing;
- staged readiness;
- scoped scans;
- resumable jobs;
- cold/warm cache timing;
- async LLM enrichment;
- strict budget ceilings;
- role-aware exclusion of docs/tests/assets/generated files;
- user-visible partial results before all enrichment finishes.

Without this, repos like Zod, Open WebUI, Plane, and especially n8n can turn the pipeline into a long blocking job.

Likely solution:

Introduce explicit analysis tiers:

- Tier 0: repo reconnaissance and file role map.
- Tier 1: deterministic source graph and first architecture map.
- Tier 2: source proof and flows.
- Tier 3: LLM explanations/concept refinement/docs/query enrichment.
- Tier 4: large-repo background enrichment.

The UI should be allowed to open after Tier 1 or Tier 2 with clear readiness labels. LLM enrichment should continue in the background.

### Problem 2: The pipeline is too serial

Why it exists:

The system evolved by adding phases one after another: extraction, summaries, concepts, flows, review, architecture, synthesis, explanations. This is easier to reason about and test, but it is not optimized for latency.

Some stages depend on previous stages, but not all dependencies are strict. For example, source summaries, deterministic concepts, some route extraction, and file role diagnostics can often run independently after extraction.

Likely solution:

Build a stage dependency graph:

- hard prerequisites: file discovery -> parse -> source spans;
- parallel deterministic stages: summaries, concept seeds, flow route extraction, repo shape, file role diagnostics;
- deferred LLM stages: concept synthesis, architecture explanations, flow review, docs/query enrichment;
- materialized checkpoints after each stage.

The analysis job should become resumable and observable at stage granularity.

### Problem 3: LLM stages can dominate runtime

Why it exists:

LLM calls are network-bound, model-bound, rate-limit-bound, and sometimes timeout-prone. The system currently uses LLMs in several high-value places:

- architecture synthesis;
- concept synthesis;
- flow LLM review;
- architecture node explanations;
- query answers;
- question lenses;
- docs planning/generation.

`architecture_explanations.py` can generate explanations for many nodes. With Blackbox it uses smaller batches to reduce JSON failure risk, which improves reliability but can hurt speed.

Likely solution:

Treat LLM work as budgeted enrichment:

- cap nodes by repo size and evidence strength;
- batch where safe;
- chunk where prompts are too large;
- use cheaper/faster models for first-pass naming;
- reserve Sonnet-class models for high-value summaries, contradiction repair, docs, and user questions;
- cache by prompt hash + input hash;
- expose `llm_pending`, `llm_cached`, `llm_failed`, and `fallback_no_llm` states instead of blocking all analysis.

### Problem 4: Flow LLM review is a timeout risk

Why it exists:

Flow review currently packages sampled flow payloads into a single structured review call. This is attractive because the LLM can compare flows and suggest merges, but it creates a large prompt and a large JSON response. That is fragile with slower providers or large flow sets.

We have already seen live Blackbox/Sonnet validation timeout in this area.

Likely solution:

Change flow review to a chunked map-reduce process:

1. Review each flow or small flow batch independently.
2. Store per-flow review results.
3. Run an optional second pass only for merge suggestions.
4. Fail closed in validation mode only for the chunk that fails.
5. Keep deterministic flow status available even if LLM review is pending.

The prompt should also be smaller: no unnecessary previews, hard limits per step, and clear output schema.

### Problem 5: Benchmarking is correctness-first, not performance-first

Why it exists:

The benchmark gauntlet was designed to answer: "Did the system hallucinate? Did it find expected concepts? Did it produce evidence-backed maps, flows, queries, and docs?"

That is necessary, but it does not fully answer: "Can a user run this on a real repo and get useful results quickly?"

Current gaps:

- per-stage memory is not deeply reported;
- SQLite DB growth is not central;
- cold vs warm cache timings are not first-class;
- incremental rerun speed is not a hard gate;
- UI-perceived readiness is not measured;
- large monorepo mode is not benchmarked separately;
- LLM token/cost/latency budgets are still not enforced everywhere.

Likely solution:

Add a performance gauntlet separate from truth gauntlet:

- cold scan timing;
- warm incremental scan timing;
- per-stage wall time;
- peak memory;
- SQLite file sizes;
- artifact cache hit rate;
- LLM calls/tokens/cost per stage;
- time to first architecture map;
- time to first source proof;
- time to first useful question answer;
- UI video/screenshot review in real API mode.

### Problem 6: The backend hardening plan is a trust floor, not the final ceiling

Why it exists:

`FINAL_BACKEND_HARDENING_BEFORE_FRONTEND_PLAN.md` is mainly about preventing trust-breaking output: fake layers, invalid citations, keyword-only verified claims, unsupported docs, silent fallbacks, and contradiction between prose and evidence.

That is the right foundation. But peak system quality also requires runtime excellence, UX readiness, scaling behavior, operational safety, and cost control.

Likely solution:

Keep the backend hardening plan, but add a separate "Runtime And Scale Plan" with explicit exit gates:

- large-repo mode;
- async enrichment;
- resumable runs;
- stage checkpoints;
- budget manager;
- provider failover;
- real API-mode frontend video;
- full self-analysis benchmark;
- large TypeScript monorepo benchmark;
- Open WebUI/Plane/n8n scoped benchmark strategy.

## Key Design Tensions

### Truth vs speed

Source-backed evidence, gates, LLM review, and implementation slices improve trust but add latency. The product needs staged readiness so users can start exploring before every explanation is perfect.

### Simplicity vs architecture accuracy

A calm first screen wants 5-9 concepts. Real repos have hundreds of modules and messy cross-cutting concerns. The backend must compress without lying.

### Determinism vs intelligence

Deterministic extraction is auditable. LLMs provide semantic grouping and explanation. The system needs both, but the LLM must never become the sole source of verified truth.

### Frontend polish vs backend uncertainty

A premium UI makes claims feel more trustworthy. If backend certainty is weak, the UI must expose that weakness clearly without overwhelming non-technical users.

### Generic platform vs benchmark overfitting

Benchmarks are needed, but production logic must not hardcode repo names or benchmark-specific paths. Repo shape must come from evidence.

## Prime Assumptions The Critic Should Challenge

1. The backend should own all architecture meaning.
2. Source spans are the right atomic proof unit.
3. A read-only projection is better than a persisted architecture-map table at this stage.
4. Node explanations should be generated during analysis, not on click.
5. LLM refinement should operate only on deterministic candidates.
6. Sonnet-class models are worth using for high-value synthesis and explanation.
7. Deterministic fallback is acceptable only as an explicit degraded state.
8. The Observatory UI can make non-technical users understand architecture without oversimplifying it.
9. Saved lenses and Docs Studio should be based on explored evidence, not blank prompts.
10. Large repos should be handled through staged readiness, not by trying to finish everything before opening the UI.
11. Validation mode should fail closed when configured LLM usage silently falls back.
12. Keyword-only evidence should never create verified architecture.
13. The same API can serve students, lecturers, founders, junior developers, and senior engineers by layering explanation depth.
14. The system can eventually analyze itself as a meaningful benchmark.

## What The Critic Should Specifically Evaluate

The external critic should answer:

1. Is the split between extracted truth and product read models correct?
2. Is a read-only architecture-map projection still appropriate, or should architecture maps become persisted artifacts?
3. Does the pipeline need a full job DAG instead of a serial analysis router?
4. Are architecture explanations being generated at the right time?
5. Is the LLM being used in the right places?
6. Which stages should be deterministic-only?
7. What is the minimum viable large-repo mode?
8. How should the system handle a repo like n8n with around 19k files?
9. Is the Observatory frontend likely to hide backend uncertainty, or surface it well?
10. What should be removed, simplified, or deferred?
11. Which assumptions are dangerous?
12. What should the next three engineering milestones be?

## Proposed Solution Direction

The likely best direction is not to throw away the current architecture. The current architecture has the correct product contract: backend-owned meaning, source-backed evidence, code proof, and frontend as observatory.

But the runtime model needs to evolve:

1. Keep the current deterministic extraction and semantic APIs.
2. Add explicit large-repo mode.
3. Convert analysis into resumable stage checkpoints.
4. Make first architecture map available before expensive enrichment completes.
5. Move LLM work into budgeted background enrichment.
6. Chunk and cache all LLM stages.
7. Add a contradiction gate for prose and docs.
8. Add performance gauntlet metrics that track user-perceived readiness.
9. Make self-analysis a required benchmark.
10. Keep the frontend premium, but force it to display uncertainty and unsupported states.

## A Good Critical Answer Would Look Like

A strong critique should not simply say "use RAG" or "use agents." It should:

- identify where the current pipeline is structurally slow;
- separate correctness failures from runtime failures;
- challenge whether every LLM stage is necessary;
- propose concrete stage boundaries;
- propose a large-repo strategy;
- explain whether the frontend/backend contract is sound;
- identify which current code paths should be simplified;
- specify measurable exit criteria.

The critic should be harsh about anything that makes weak backend evidence look polished. The product's moat is not that it produces beautiful diagrams. The moat is that the beautiful diagram is honest and can prove itself with exact code.

