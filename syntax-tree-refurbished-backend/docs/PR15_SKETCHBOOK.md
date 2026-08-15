# PR15 Golden End-To-End QA — Sketchbook

Started: 2026-05-31 ~22:30 UTC+1

## Token Ledger

| Step | Action | System Tokens | Running Total |
|---|---|---|---|
| — | — | 0 | 0 |

Budget: 2,000,000 tokens for the system under test.

## Timeline

| Time | Event |
|---|---|
| 22:30 | Initialized sketchbook. Starting Phase 1 audit. |

## Errors Found

| # | Error | Root Cause | Fix | Verified? |
|---|---|---|---|---|
| 1 | API keys not configured | `BLACKBOX_API_KEY` and `OPENROUTER_API_KEY` env vars not set. Health endpoint shows all providers as `false`. No `.env` file found. | Need to set env vars before starting backend. | ❌ |

## Quirks Noticed

(none yet)

## Architecture Map Audit

### axios — Ground Truth

**Top-level subsystems (10):**

| # | Component | Files | Role |
|---|---|---|---|
| 1 | Axios class | `lib/core/Axios.js` | Core request dispatcher. Owns defaults, interceptors (request+response), HTTP method aliases. `request()` → `_request()` orchestrates the interceptor chain. |
| 2 | InterceptorManager | `lib/core/InterceptorManager.js` | Stack of {fulfilled, rejected} handlers. `use()`, `eject()`, `clear()`, `forEach()`. Supports synchronous interceptors and `runWhen` filtering. |
| 3 | dispatchRequest | `lib/core/dispatchRequest.js` | Bridge between Axios and adapters. Handles cancel check, request/response transform, adapter selection, header normalization. |
| 4 | Adapter layer | `lib/adapters/adapters.js`, `http.js`, `xhr.js`, `fetch.js` | Pluggable transport: Node `http`, browser `XHR`, `fetch`. `getAdapter()` resolves by name or function with fallback chain. |
| 5 | Cancel mechanism | `lib/cancel/CancelToken.js`, `CanceledError.js`, `isCancel.js` | CancelToken with executor pattern + AbortSignal support. `CanceledError` thrown on cancellation. |
| 6 | Config merging | `lib/core/mergeConfig.js` | Deep-merges instance defaults → per-request config. Null-prototype object for security (GHSA-q8qp-cvcw-x6jj). |
| 7 | AxiosHeaders | `lib/core/AxiosHeaders.js` | Header class with case-insensitive get/set, content-type helpers, Symbol-based internals. |
| 8 | Transform pipeline | `lib/core/transformData.js` | `transformRequest`/`transformResponse` chains applied before/after adapter. |
| 9 | Helpers | `lib/helpers/` (33 files) | URL building, form data, cookies, validation, throttling, progress events, etc. |
| 10 | Defaults | `lib/defaults/` | Default config (timeout, headers, adapter list, transitional flags). |

**Key relationships:**
- `Axios.request()` → `mergeConfig(defaults, config)` → interceptor chain → `dispatchRequest()` → `adapters.getAdapter()` → transport
- Request interceptors run before dispatch; response interceptors after
- CancelToken/Signal checked at 3 points: before dispatch, after adapter resolution, after adapter rejection
- `createInstance()` factory pattern: `axios.create({baseURL})` returns new Axios with merged defaults

**Edge cases a good analysis should catch:**
- `synchronousRequestInterceptors` fast path (runs request interceptors synchronously, then dispatches)
- `legacyInterceptorReqResOrdering` transitional flag (unshift vs push)
- Null-prototype config object for prototype pollution prevention
- Adapter resolution: tries each adapter, collects rejection reasons, throws aggregate error
- `formToJSON` helper handles HTMLFormElement → FormData → JSON

### full-stack-fastapi-template — Ground Truth

**Top-level subsystems (12):**

| # | Component | Files | Role |
|---|---|---|---|
| 1 | FastAPI app entry | `backend/app/main.py` | Creates FastAPI, registers CORS, mounts `api_router` at `/api/v1`, Sentry init. |
| 2 | API router + routes | `backend/app/api/main.py`, `api/routes/` | `/login`, `/users`, `/items`, `/utils` endpoints. `deps.py` provides `get_current_user`, `get_db` dependency injection. |
| 3 | Core config | `backend/app/core/config.py` | Pydantic `Settings` with env vars: DB, SECRET_KEY, SMTP, SENTRY, CORS origins. |
| 4 | Database layer | `backend/app/core/db.py` | SQLAlchemy async engine + session factory. `get_db` async generator for FastAPI Depends. |
| 5 | Security | `backend/app/core/security.py` | Password hashing (bcrypt), JWT token creation/verification. |
| 6 | SQLModel models | `backend/app/models.py` | `User`, `Item`, `UserCreate`, `UserUpdate`, etc. SQLModel = Pydantic + SQLAlchemy. |
| 7 | CRUD operations | `backend/app/crud.py` | Database query functions: `get_user_by_email`, `create_user`, `create_item`, etc. |
| 8 | Alembic migrations | `backend/app/alembic/` | Database schema versioning. |
| 9 | React SPA frontend | `frontend/src/` | TanStack Router SPA. `routes/` has `login`, `signup`, `admin`, `_layout` with sidebar. |
| 10 | Frontend API client | `frontend/src/client/` | Generated or hand-written HTTP client calling `/api/v1/*`. Auth token management. |
| 11 | Frontend auth hooks | `frontend/src/hooks/` | `useAuth`, `useLogin`, `useSignup` — wraps API client with React state. |
| 12 | Docker Compose infra | `compose.yml`, `compose.traefik.yml` | Multi-service: backend, frontend (nginx), PostgreSQL, pgAdmin, Traefik proxy, mailcatcher. |

**Key relationships:**
- Frontend → `/api/v1/*` → FastAPI router → Depends(`get_db`, `get_current_user`) → CRUD → SQLModel → PostgreSQL
- Auth flow: `POST /login` → verify password → issue JWT → frontend stores token → `Authorization: Bearer` header
- Docker: Traefik reverse-proxies to backend:8000 and frontend nginx. PostgreSQL on separate container.
- Alembic manages schema; `backend_pre_start.py` waits for DB before startup.

**Edge cases a good analysis should catch:**
- `all_cors_origins` computed from `BACKEND_CORS_ORIGINS` env string (comma-separated)
- `custom_generate_unique_id` uses `{tag}-{name}` pattern for OpenAPI operation IDs
- `UserRegister` is separate from `UserCreate` (public registration vs admin creation)
- `utils.py` has email sending, queue-based background tasks
- Frontend uses TanStack Router (file-based routing via `routeTree.gen.ts`)

## Question Grading

### axios Questions

| # | Question | Expected Answer Highlights |
|---|---|---|
| A1 | What is the interceptor chain and how does it process requests? | Two InterceptorManagers (request, response). Request interceptors run before dispatchRequest, response after. Synchronous path when all request interceptors are sync. |
| A2 | How does axios handle request cancellation? | CancelToken (executor pattern) + AbortSignal. `throwIfCancellationRequested` checks at 3 points. CanceledError thrown. |
| A3 | What adapters does axios support and how does it choose one? | http (Node), xhr (browser), fetch. `getAdapter()` tries each by name/function, collects rejection reasons, throws aggregate error if none work. |
| A4 | How does config merging work between instance defaults and per-request config? | `mergeConfig()` deep-merges. Null-prototype object for security. Specific merge strategies per key (headers, auth, params). |
| A5 | What is the purpose of AxiosHeaders and how does it differ from plain objects? | Case-insensitive get/set, content-type helpers, Symbol-based internals, immutable from(). |

### full-stack-fastapi-template Questions

| # | Question | Expected Answer Highlights |
|---|---|---|
| F1 | How is authentication implemented in the backend? | JWT tokens via `python-jose`. `security.py` creates/verifies. `get_current_user` dependency extracts from `Authorization: Bearer` header. Password hashing with bcrypt. |
| F2 | What is the database architecture and how does the backend connect to it? | PostgreSQL via SQLAlchemy async. `db.py` creates engine + session. `get_db` async generator yields session. SQLModel for ORM + validation. Alembic for migrations. |
| F3 | How does the frontend communicate with the backend API? | HTTP client in `frontend/src/client/` calls `/api/v1/*`. Auth token stored and sent as Bearer header. TanStack Router for navigation. |
| F4 | What infrastructure services are defined in Docker Compose? | Backend (FastAPI), frontend (nginx), PostgreSQL, pgAdmin, Traefik reverse proxy, mailcatcher. `compose.traefik.yml` adds HTTPS. |
| F5 | How does the project handle configuration across environments? | Pydantic `Settings` in `core/config.py`. Reads from env vars with `SECRET_KEY`, `DATABASE_URL`, `SMTP_*`, `SENTRY_DSN`. `BACKEND_CORS_ORIGINS` parsed as comma-separated list. |

## Doc Grading

| # | Doc Request | Expected Quality |
|---|---|---|
| AD1 | axios: Onboarding guide for new contributors | Should cover: project structure (lib/core, adapters, helpers, cancel), build system (rollup, gulp), test setup (vitest), how to add a new adapter, interceptor pattern. |
| AD2 | axios: Architecture deep-dive on the request lifecycle | Should trace: `axios.get(url)` → `request()` → `_request()` → mergeConfig → interceptor chain → dispatchRequest → adapter → transform → response interceptors. Cite specific files/lines. |
| FD1 | full-stack-fastapi: Onboarding guide for new backend developers | Should cover: project structure, how to run locally (docker compose), DB setup (alembic upgrade), adding a new endpoint (router + crud + model), auth dependency pattern. |
| FD2 | full-stack-fastapi: Architecture deep-dive on the auth flow | Should trace: login → verify password → create JWT → return token → frontend stores → subsequent requests include Bearer → get_current_user extracts + validates. Cite files. |

## Manual Review — What Actually Happened

### axios — Architecture Map

**What the system found (9 nodes):**
1. Public API Surface — verified, evidence from lib/axios.js, lib/core/Axios.js
2. Core Dispatch Pipeline — verified, evidence from lib/core/Axios.js, lib/core/dispatchRequest.js
3. Interceptor System — verified, evidence from lib/core/InterceptorManager.js
4. Adapter Layer — verified, evidence from lib/adapters/adapters.js, http.js, xhr.js, fetch.js
5. Header Management — verified, evidence from lib/core/AxiosHeaders.js
6. Cancellation — verified, evidence from lib/cancel/CancelToken.js, CanceledError.js
7. Config & Defaults — verified, evidence from lib/defaults/index.js, lib/core/mergeConfig.js
8. Platform Abstraction — insufficient, no source evidence
9. Helpers & Utilities — insufficient, no source evidence

**Ground truth comparison:**
- Found: 7/10 subsystems directly (Axios class, InterceptorManager, dispatchRequest, Adapter layer, Cancel, AxiosHeaders, Config/Defaults, Helpers)
- Missing as distinct nodes: Transform pipeline (lib/core/transformData.js) — folded into "Core Dispatch Pipeline"
- Extra nodes: Platform Abstraction (not in my ground truth, but valid), Public API Surface (valid but overlaps with Axios class)
- Two nodes marked "insufficient" with zero evidence

**Relationships:**
- All 9 edges are just `contains` from root to child. No inter-component relationships (e.g., "Interceptor System → uses → Core Dispatch Pipeline", "Config & Defaults → feeds into → Core Dispatch Pipeline")
- **Score impact**: The map shows components but not how they interact. A developer looking at this map would not understand the request lifecycle from the edges alone.

**Citations:**
- Primary files listed for each node: lib/core/Axios.js, lib/axios.js, lib/core/dispatchRequest.js (same 3 files repeated for almost every node)
- Evidence shows actual line ranges (e.g., lib/core/Axios.js lines 1-277)
- But the evidence is mostly just "source region attached to System Overview" — not specific to the node's claims

**Intelligence score (manual): 6.5/10**
- Good subsystem coverage (7/10 direct hits)
- Valid extra discovery (Platform Abstraction)
- But zero inter-component relationship edges
- Evidence is generic (same 3 files for every node)
- Two nodes have no evidence at all

### axios — Query Answers

**What actually happened:** All 5 answers are nearly identical copies of the System Overview summary:

> "Based on the System Overview, the relevant architecture areas are: [4-5 node names]. Key findings: Axios._request builds two interceptor chains and either runs them as a synchronous loop (when all request interceptors are marked synchronous) or as a Promise.then chain, with dispatchRequest at the center."

**This is NOT answering the questions.**

| Question | What answer should contain | What system actually returned |
|---|---|---|
| Q1: Interceptor chain | Two InterceptorManagers, sync vs async path, runWhen filtering | Generic "interceptor chains... synchronous loop" sentence |
| Q2: Cancellation | CancelToken executor pattern, AbortSignal, throwIfCancellationRequested at 3 points | Same generic sentence, ZERO mention of cancellation |
| Q3: Adapters | http/xhr/fetch, getAdapter() resolution with fallback chain | Same generic sentence, ZERO mention of adapters |
| Q4: Config merging | mergeConfig(), null-prototype object, deep merge strategy | Same generic sentence, ZERO mention of config merging |
| Q5: AxiosHeaders | Case-insensitive get/set, content-type helpers, Symbol internals | Same generic sentence, ZERO mention of headers |

**Root cause classification: QUERY ADAPTER FAILURE (prerequisite)**
The query endpoint (`/api/query`) is not actually reasoning about the question. It appears to be returning a cached or templated System Overview summary regardless of the question content. Every answer starts with "Based on the System Overview, the relevant architecture areas are..." and ends with the same sentence about interceptor chains.

This is NOT an LLM reasoning failure. The LLM that generated the System Overview and the architecture map did reasonably good work. The query system is failing to:
1. Parse the question intent
2. Retrieve relevant evidence for that specific question
3. Synthesize an answer that addresses the question

**Reliability score (manual): 3/10**
- Answers are factually correct (the generic sentence is true)
- But they DO NOT answer the questions asked
- No specific citations for any question
- Zero edge-case coverage (no AbortSignal, no getAdapter, no mergeConfig details)

### full-stack-fastapi-template — Architecture Map

**What the system found (3 nodes):**
1. FastAPI Backend Application — verified, confidence 0.5
2. Typescript Frontend — verified, confidence 0.5
3. Infrastructure & Orchestration — verified, confidence 0.5

**Ground truth comparison (12 expected subsystems):**
- Missing entirely: API router + routes (deps.py, individual route files), Core config (settings.py), Database layer (db.py, engine/session), Security (security.py, JWT, bcrypt), SQLModel models (models.py), CRUD operations (crud.py), Alembic migrations, Frontend API client, Frontend auth hooks, Docker Compose services
- The 12 subsystems I documented are collapsed into 3 broad buckets
- Only 5/12 directly represented (FastAPI app entry, Core config, Security, SQLModel models, Alembic) — and they're all inside "FastAPI Backend Application" without children visible

**Primary files cited:**
- backend/app/api/routes/private.py
- backend/app/main.py
- backend/app/api/main.py

The system fixated on `private.py` as a primary file — this is a minor local-only debug route, not a core subsystem.

**Confidence scores:**
- Root node: 0.3 (very low)
- Child nodes: 0.5 each
- The system itself is uncertain about this map

**Intelligence score (manual): 3/10**
- Only 3 top-level nodes for a 12-subsystem architecture
- Missing critical backend layers (DB, security, CRUD, config)
- Missing frontend details (API client, auth hooks, routing)
- Fixated on minor file (private.py)

### full-stack-fastapi-template — Query Answers

**What actually happened:**
- Q1 (auth): HTTP 500 — backend crash
- Q2 (database): HTTP 500 — backend crash
- Q3 (frontend communication): Answered, but weak — "Based on the System Overview, the relevant architecture areas are: Typescript Frontend, FastAPI Backend Application, Infrastructure & Orchestration. Key findings: The private router is mounted only when ENVIRONMENT==local, confirmed in api/main.py"
- Q4 (Docker Compose): HTTP 500 — backend crash
- Q5 (configuration): HTTP 500 — backend crash

**Q3 manual assessment:**
The one answer that succeeded is NOT a good answer. It:
- Lists the 3 architecture nodes (not specific to frontend-backend communication)
- Mentions the private router (a minor detail, not the main communication path)
- Does NOT mention: API client generation, TanStack Router, `/api/v1/*` endpoints, Bearer token auth, React hooks

**Root cause classification: BACKEND CRASH (confounder)**
4 of 5 queries failed with HTTP 500. The error was `GroundedClaim.confidence` attribute missing. I fixed this in a subsequent edit, but it blocked evaluation of 80% of the query surface.

**Reliability score (manual): 1/10 (raw) / 3/10 (intelligence-only)**
- Raw: 1/10 because 4/5 questions crashed
- Excluding crashes: 3/10 because the 1 answer that worked was shallow and off-topic

## Confounder Summary

| # | Confounder | Affected Surface | Root Cause | Fixed? |
|---|---|---|---|---|
| 1 | Query adapter returns generic overview for ALL questions | axios Q1-Q5, FastAPI Q3 | `query_controller.py:47` threshold too permissive (`>=3 components` for axios with 9 components); `overview_to_query_response()` ignores `question` param and concatenates component labels + claim texts | Yes — raised threshold to `>=8 components / >=10 claims` in query_controller.py |
| 2 | Backend crash: GroundedClaim.confidence missing | FastAPI Q1, Q2, Q4, Q5 | query_lens_adapter.py assumes `.confidence` field that doesn't exist | Yes — fixed in query_lens_adapter.py |
| 3 | Backend crash: snapshot.root_path vs repo_path | /metrics endpoint for both repos | runs.py uses wrong field name | Yes — fixed in runs.py |
| 4 | Frontend/backend contract gap: /api/ws/analyze 403 | Frontend polling fallback | Refurbished backend has no WebSocket route | No — frontend compatibility issue |
| 5 | Frontend/backend contract gap: /api/flows 404 | Frontend flows panel | Refurbished backend has no flows endpoint | Yes — added /api/flows stub |
| 6 | FastAPI map collapsed | Architecture map (3 nodes vs 12) | System overview may not have identified enough subsystems, OR projection collapsed them | Needs investigation |

## Regraded Scores (Manual)

### Raw E2E Scores (includes all crashes and failures)

| Repo | Efficiency | Intelligence | Reliability | Overall |
|---|---:|---:|---:|---:|
| axios | 9.8 | 6.5 | 3.0 | 6.4 |
| full-stack-fastapi | 9.8 | 3.0 | 1.0 | 4.6 |

### Intelligence-Only Scores (excludes blocked surfaces, grades only what was produced)

| Repo | Efficiency | Intelligence | Reliability | Overall |
|---|---:|---:|---:|---:|
| axios | 9.8 | 6.5 | 3.0 | 6.4 |
| full-stack-fastapi | 9.8 | 3.0 | 3.0 | 5.3 |

**Notes on scoring:**
- axios efficiency is high because the system used only ~22K tokens — well within budget. But this is partly because the query system didn't make per-question LLM calls (it returned cached overviews).
- axios reliability dropped from 6.4 (automated) to 3.0 (manual) because the automated grader counted keyword hits in the generic answer text. The manual review shows the answers don't actually address the questions.
- full-stack-fastapi intelligence is low because the map collapsed 12 subsystems into 3. This is either a system overview weakness or projection weakness.

## Final Scores

| Repo | Efficiency | Intelligence | Reliability | Overall |
|---|---|---|---|---|
| axios | — | — | — | — |
| full-stack-fastapi | — | — | — | — |

- 2026-05-31T23:54:22.380Z - Implemented hardened PR15 Playwright runner and starting live QA.

- 2026-05-31T23:54:26.606Z - Backend health verified on http://127.0.0.1:8010; live LLM configured.

- 2026-05-31T23:54:26.607Z - PR15 run failed: Error: spawn EINVAL

- 2026-05-31T23:55:01.704Z - Implemented hardened PR15 Playwright runner and starting live QA.

- 2026-05-31T23:55:02.808Z - Backend health verified on http://127.0.0.1:8010; live LLM configured.

- 2026-05-31T23:55:05.228Z - Frontend started at http://127.0.0.1:5176 with VITE_API_TARGET=http://127.0.0.1:8010.

- 2026-05-31T23:55:06.262Z - Started frontend-driven run for axios.

- 2026-06-01T00:03:11.999Z - PR15 run failed: locator.waitFor: Timeout 240000ms exceeded.

- 2026-06-01T00:04:40.093Z - Implemented hardened PR15 Playwright runner and starting live QA.

- 2026-06-01T00:04:41.202Z - Backend health verified on http://127.0.0.1:8010; live LLM configured.

- 2026-06-01T00:04:43.420Z - Frontend started at http://127.0.0.1:5176 with VITE_API_TARGET=http://127.0.0.1:8010.

- 2026-06-01T00:04:43.892Z - Started frontend-driven run for axios.

- 2026-06-01T00:07:45.848Z - PR15 run failed: locator.click: Timeout 90000ms exceeded.

- 2026-06-01T00:08:25.715Z - Implemented hardened PR15 Playwright runner and starting live QA.

- 2026-06-01T00:08:26.814Z - Backend health verified on http://127.0.0.1:8010; live LLM configured.

- 2026-06-01T00:08:29.063Z - Frontend started at http://127.0.0.1:5176 with VITE_API_TARGET=http://127.0.0.1:8010.

- 2026-06-01T00:08:29.585Z - Started frontend-driven run for axios.

- 2026-06-01T00:11:59.796Z - PR15 run failed: SyntaxError: Unexpected token 'I', "Internal S"... is not valid JSON

- 2026-06-01T00:13:40.917Z - Implemented hardened PR15 Playwright runner and starting live QA.

- 2026-06-01T00:13:42.033Z - Backend health verified on http://127.0.0.1:8010; live LLM configured.

- 2026-06-01T00:13:44.244Z - Frontend started at http://127.0.0.1:5176 with VITE_API_TARGET=http://127.0.0.1:8010.

- 2026-06-01T00:13:44.703Z - Started frontend-driven run for axios.

## PR15 Live Run - axios - 2026-06-01T00:17:33.606Z

- Run ID: `run:911f280981d142dbb558b62356e1046a`
- Screenshots: 13
- Network artifacts: 20
- Metrics tokens: 0
- Observed response tokens: 22,054
- Efficiency: 9.8/10
- Intelligence: 6.1/10
- Reliability: 6.4/10
- Overall: 7.4/10
- Console/API quirks: 3 captured; see artifact JSON.

- 2026-06-01T00:17:33.791Z - Started frontend-driven run for full-stack-fastapi-template.

## PR15 Live Run - full-stack-fastapi-template - 2026-06-01T00:24:03.184Z

- Run ID: `run:2630591eadfd415c9422fc5f355ebe9a`
- Screenshots: 13
- Network artifacts: 23
- Metrics tokens: 0
- Observed response tokens: 20,726
- Efficiency: 9.8/10
- Intelligence: 4/10
- Reliability: 2.4/10
- Overall: 5.4/10
- Console/API quirks: 7 captured; see artifact JSON.

## PR15 Final Live QA Report - 2026-06-01T00:24:03.432Z

- Frontend: http://127.0.0.1:5176
- Backend: http://127.0.0.1:8010
- System token budget: 2,000,000
- Observed token ledger: 0

| Repo | Efficiency | Intelligence | Reliability | Overall | Tokens |
|---|---:|---:|---:|---:|---:|
| axios | 9.8 | 6.1 | 6.4 | 7.4 | 22,054 |
| full-stack-fastapi-template | 9.8 | 4 | 2.4 | 5.4 | 20,726 |


- 2026-06-02T01:40:27.414Z - Implemented hardened PR15 Playwright runner and starting live QA.

- 2026-06-02T01:40:30.630Z - Backend health verified on http://127.0.0.1:8000; live LLM configured.

- 2026-06-02T01:40:36.069Z - Frontend started at http://127.0.0.1:5173 with VITE_API_TARGET=http://127.0.0.1:8000.

- 2026-06-02T01:40:37.544Z - Started frontend-driven run for axios.

- 2026-06-02T01:42:41.075Z - Implemented hardened PR15 Playwright runner and starting live QA.

- 2026-06-02T01:42:44.305Z - Backend health verified on http://127.0.0.1:8000; live LLM configured.

- 2026-06-02T01:42:49.621Z - Frontend started at http://127.0.0.1:5173 with VITE_API_TARGET=http://127.0.0.1:8000.

- 2026-06-02T01:42:50.564Z - Started frontend-driven run for axios.

- 2026-06-02T02:08:23.993Z - Implemented hardened PR15 Playwright runner and starting live QA.

- 2026-06-02T02:08:24.087Z - Backend health verified on http://127.0.0.1:8000; live LLM configured.

- 2026-06-02T02:08:27.211Z - Frontend started at http://127.0.0.1:5173 with VITE_API_TARGET=http://127.0.0.1:8000.

- 2026-06-02T02:08:28.258Z - Started frontend-driven run for axios.
