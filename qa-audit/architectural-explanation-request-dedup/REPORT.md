# Bounded Product Remediation — Architectural-Explanation Request Deduplication

**Date:** 2026-08-13
**Scope:** Request-lifecycle fix only. No prompts, ClaimProposal schema, bounded-evidence construction, verifier semantics, relation extraction, parser behavior, D4, provenance contracts, source navigation, or any frozen/exploratory/confirmatory Flask evidence were touched.

## 1. Prior evidence commit (frozen, unmodified)

Flask confirmatory validation evidence: `32f221a`.

## 2. Root cause (investigated first, before any change)

`ArchitecturalExplanationPanel` (`features/observatory/VoiceRail.tsx`) mounts it via a toggle button (`aria-expanded`), and internally it calls `useArchitecturalExplanation(entityId, runId)` (`features/architectural-explanation/useArchitecturalExplanation.ts`). That hook's `useEffect` (dependent on a `useCallback`-memoized `load`) calls `getArchitecturalExplanation(entityId, runId)` (`features/architectural-explanation/api.ts`), which — **before this fix** — called `fetchApi(...)` (a real `POST`) directly, with no deduplication layer.

React 18's `<StrictMode>` (enabled in `src/main.tsx`, confirmed still present and unchanged) deliberately mounts every component, runs its effects, unmounts it (running cleanup), and immediately remounts it — specifically to help developers find missing-cleanup bugs. This happens once, synchronously, on initial mount, in development only. Each of the two effect instances gets its own independent `cancelled` closure and calls `load()` independently — and by the time `load()`'s `await getArchitecturalExplanation(...)` resolves, only the **surviving** (non-cleaned-up) instance's `isCancelled()` still reads `false`, so only its result is applied to state (`setExplanation`). Crucially, that guard only prevents a *stale* instance from **applying** its result — by the time the guard is checked, the network request has **already been sent**. With no request-level deduplication, this produced two independent, real, separately-billed `POST /api/entities/{id}/architectural-explanation` calls for one semantic explanation load, and — because each call independently samples the LLM — the two responses could genuinely differ in content (observed directly in the Flask confirmatory run: Target B's persisted first response had 2 claims; the browser rendered a second, later response with 3 claims, one of them `insufficient_evidence`).

This was proven, not assumed, before any code change: the confirmatory run's own backend access log showed two `POST .../architectural-explanation` lines per target (6 total for 3 semantic loads), and the browser-rendered content for Target B was independently confirmed (via its persisted first-response JSON vs. its own screenshots) to reflect the *second*, not the first, of those two real responses.

## 3. Request identity used for deduplication

`(runId, entityId)` — the smallest identity for which a change legitimately requires a new generation. No API credential, no architectural-explanation configuration value, and no unrelated analysis-run data is part of the key. Configuration changes are handled separately (§5) rather than folded into the key, since the frontend has no direct visibility into the backend's resolved provider/model identity — only into *when the user just saved new settings*.

## 4. Implementation approach

Reused the exact existing pattern already used by the sibling legacy node-explanation feature (`features/architecture-map/lensCache.ts`: a module-level `Map<string, Promise<T>>`, keyed by request identity, storing the **promise itself** rather than the eventual value) — the smallest solution consistent with the existing frontend architecture, not a new dependency or abstraction.

- **`features/architectural-explanation/api.ts`**: added a local `explanationCache: Map<string, Promise<ArchitecturalExplanationResponse>>` keyed by `` `${runId}:${entityId}` ``. `getArchitecturalExplanation()` now checks the cache first; if a promise (in-flight or already resolved) exists for that key, it is returned directly — no new `fetchApi` call is made. Storing the *promise*, not just the eventual value, is what deduplicates truly concurrent callers: a second caller that arrives while the first request is still in flight (exactly StrictMode's case) receives the same promise and therefore never triggers a second network request at all. Added `invalidateArchitecturalExplanationCache(entityId?, runId?)` for callers that need a guaranteed fresh generation.
- **`features/architectural-explanation/useArchitecturalExplanation.ts`**: `retry()` now calls `invalidateArchitecturalExplanationCache(entityId, runId)` before bumping the retry token, so an explicit Retry always forces a fresh request rather than replaying a cached (possibly failed) promise.
- **`features/settings/SettingsPanel.tsx`**: after a successful Save or Remove-key, calls `invalidateArchitecturalExplanationCache()` (full clear) — a configuration change can legitimately change what a regeneration would produce, so no previously cached response may be silently reused as if nothing changed.

**React StrictMode remains enabled** — `src/main.tsx` was not touched. The fix works *with* StrictMode's double-invoke, not by hiding it: the second effect instance's call is still made, it just resolves to the same, already-in-flight (or already-resolved) promise instead of triggering a second real request.

## 5. Stale-response handling

Already correctly handled by the **existing** `cancelled`-closure guard in `useArchitecturalExplanation.ts`, unchanged by this fix: `load`'s `useCallback` depends on `[entityId, runId]`, so switching entities creates a new `load` reference, which re-runs the effect, whose cleanup marks the *previous* entity's in-flight load `cancelled`. If entity A's request is still in flight when the user selects B, A's eventual resolution finds `isCancelled() === true` and never calls `setExplanation`, so it can never overwrite B's state — verified explicitly in CASE 5 of the new test suite (§7).

## 6. React StrictMode: remains enabled

Confirmed unchanged: `src/main.tsx` still wraps the app in `<StrictMode>`.

## 7. Before / after counts

| | Backend-request count per semantic load | Provider-invocation count per semantic load |
|---|---|---|
| **Before** (Flask confirmatory run, prior evidence) | 2 (observed for all 3 targets, backend access log) | 2 real, independently-sampled OpenAI calls |
| **After** (this fix) | **1** (safe-provider browser check, §8; real-OpenAI QA check, §9) | **1** |

## 8. Automated tests

New file `syntax-tree-ui/src/features/architectural-explanation/requestDeduplication.test.tsx` — 8 tests, reproducing the real trigger via `<StrictMode>` (React Testing Library honors StrictMode's double-invoke under jsdom) rather than only testing the cache module in isolation:

1. StrictMode mount/effect probing → exactly one backend request. **Empirically verified both ways**: the entire pre-fix `api.ts` was temporarily restored (`git show HEAD:...`) and all 8 new tests were re-run against it — all 8 failed (this StrictMode case specifically observed 2 calls, not 1); the fix was then restored and all 8 pass. Not asserted by inspection alone.
2. Two truly concurrent callers for the same `(runId, entityId)` share one in-flight request.
3. Same entity remaining selected across an ordinary rerender does not regenerate.
4. Deliberately selecting a different entity does issue a new request.
5. Leaving entity A before it resolves, then selecting B, never lets A overwrite B.
6. An explicit Retry after a failure issues a genuinely fresh request (bypasses the cached failure).
7. `invalidateArchitecturalExplanationCache()` forces the next load to re-fetch.
8. No credential-shaped value appears in the request cache key or URL.

Existing `ArchitecturalExplanationPanel.test.tsx` (10 tests) required one addition: `invalidateArchitecturalExplanationCache()` in its own `afterEach`, since its tests reuse the same `entityId` across cases and the new cache would otherwise leak state between them (a genuine test-isolation consequence of adding caching, not a product bug) — fixed, all 10 still pass.

**Totals:** Frontend vitest 29/29 passed (4 files) · typecheck clean · lint clean · build clean. No backend code was changed, so the backend suite was not re-run for this change (already green from the prior round).

## 9. Browser/E2E results

**Safe-provider check** (zero cost, zero backend/OpenAI traffic — `page.route()` intercepts the request in-browser before it ever leaves the page, against the REAL running dev server, REAL `main.tsx` StrictMode, REAL Vite build): analyzed `python_app`, one semantic load (OrderService) → 1 intercepted request; switching to a second entity (create_order) → cumulative 2 (exactly 1 new request) → `SAFE_PROVIDER_CHECK_PASS`. Evidence: `safe-provider-browser-check.json`.

## 10. Real-OpenAI QA verification

Runtime credential reconfirmed present (`enabled=true, configured=true, credentials_present=true`) before proceeding; never inspected. Selected one already-known Flask entity (the `Flask` class, `app.py:109-1625`, from the accepted confirmatory run's repository). Performed exactly one normal UI explanation load (`app.py → Flask → Architectural Explanation`, one click). Backend access log (`backend-log-evidence.txt`) shows **exactly one** `POST /api/entities/symbol:c3ebfe26f9af8244ba3e0bf5/architectural-explanation` line — no duplicate. Latency 5,418 ms, HTTP 200. The generated claims were **not** evaluated as a research sample (product QA only, per instructions) — the panel's rendered content (`real-openai-qa-single-load.png`) is included purely as evidence that the UI displays a single, unambiguous response, not as a scored claim-correctness sample.

## 11. Production implementation commit

`a3fdd8d` on `product/end-user-acceptance`.

## 12. UI displays the same single response generated for that load?

**Yes.** Since exactly one request was made, there is no ambiguity about "which of two responses" the UI shows — the rendered content in `real-openai-qa-single-load.png` is definitionally the response generated for that one request.

---
STOP FOR REVIEW.
