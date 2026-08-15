import { fetchApi } from '../../api/client';
import type { ArchitecturalExplanationResponse, SourceRegionDTO } from './apiTypes';

/**
 * In-flight/resolved request cache for POST .../architectural-explanation,
 * keyed by (runId, entityId) -- the smallest identity that legitimately
 * requires a new generation (see this module's own docstring below).
 * Mirrors the exact pattern already used by
 * features/architecture-map/lensCache.ts for the sibling legacy
 * node-explanation endpoint (a Map from key -> Promise<T>, not Map from
 * key -> resolved T): storing the PROMISE, not just the eventual value,
 * is what deduplicates truly concurrent callers -- a second caller that
 * arrives while the first request is still in flight gets the SAME
 * promise and therefore never issues a second network request at all.
 *
 * This exists specifically to fix a real product defect: React
 * StrictMode's development-only mount -> unmount -> remount probe runs
 * useArchitecturalExplanation's effect twice on initial mount, and
 * without this cache each invocation called this function directly,
 * issuing two independent real POST requests (two real, separately
 * billed, independently-sampled LLM calls per semantic explanation
 * load) whose responses could genuinely differ. See
 * qa-audit/architectural-explanation-request-dedup/REPORT.md for the
 * full investigation and evidence.
 */
const explanationCache = new Map<string, Promise<ArchitecturalExplanationResponse>>();

function explanationCacheKey(entityId: string, runId?: string): string {
  return `${runId ?? 'no-run'}:${entityId}`;
}

/**
 * Calls the (not-yet-registered, documented-contract-only) V2 endpoint:
 * POST /api/entities/{entity_id}/architectural-explanation
 *
 * `entity_id` is a real ParsedSymbol id (e.g. "symbol:abc123..."). An empty
 * JSON body is valid per the documented request DTO; `run_id` is sent as an
 * optional query param, matching this codebase's existing run-resolution
 * convention (explicit query param, else the active run via header/store).
 *
 * Deduplicated per (runId, entityId) -- see explanationCache above. A
 * concurrent or StrictMode-duplicate call for the SAME entity in the SAME
 * run reuses the one in-flight request instead of issuing a second one.
 * Callers that need a guaranteed fresh generation (an explicit Retry
 * action, or after architectural-explanation configuration changes) must
 * call invalidateArchitecturalExplanationCache first.
 */
export function getArchitecturalExplanation(entityId: string, runId?: string) {
  const key = explanationCacheKey(entityId, runId);
  const cached = explanationCache.get(key);
  if (cached) return cached;

  const query = runId ? `?run_id=${encodeURIComponent(runId)}` : '';
  const request = fetchApi<ArchitecturalExplanationResponse>(
    `/entities/${encodeURIComponent(entityId)}/architectural-explanation${query}`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
  explanationCache.set(key, request);
  return request;
}

/**
 * Forces the next getArchitecturalExplanation call for this (entityId,
 * runId) to issue a fresh request instead of reusing a cached one -- used
 * by the explicit Retry action, and by Settings whenever the
 * architectural-explanation configuration is saved (a config change can
 * legitimately change what a regeneration would produce, so any
 * previously cached response must not be reused as if nothing changed).
 * Omitting entityId clears every cached explanation (used by the
 * Settings case, which has no single entity to target).
 */
export function invalidateArchitecturalExplanationCache(entityId?: string, runId?: string): void {
  if (entityId === undefined) {
    explanationCache.clear();
    return;
  }
  explanationCache.delete(explanationCacheKey(entityId, runId));
}

/**
 * Resolves a `source_region_id` (found on evidence-chain items) to an exact
 * file path + line range + source text. Reuses the already-registered
 * `GET /api/source-regions/{region_id}` route (`api/routes/source.py`) --
 * this route is existing, working infrastructure, not part of the frozen
 * new claim/explanation contract, so it is called directly rather than
 * mocked-only in the app itself (tests still mock it).
 */
export function getSourceRegion(regionId: string) {
  return fetchApi<SourceRegionDTO>(`/source-regions/${encodeURIComponent(regionId)}`);
}
