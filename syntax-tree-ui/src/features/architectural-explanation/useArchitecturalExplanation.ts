import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import type { ArchitecturalExplanationResponse } from './apiTypes';
import { getArchitecturalExplanation, invalidateArchitecturalExplanationCache } from './api';

interface ArchitecturalExplanationState {
  explanation: ArchitecturalExplanationResponse | null;
  isLoading: boolean;
  error: string | null;
  /**
   * True specifically when the backend reported the configured LLM
   * provider itself as unreachable (HTTP 503 from
   * POST .../architectural-explanation -- see api/routes
   * /architectural_explanation.py's `_verify_claims_or_503`), as
   * opposed to any other error (e.g. entity not found). Lets the panel
   * show the task-required "Architectural explanation unavailable" copy
   * with Retry/Open Settings instead of a generic error line.
   */
  isProviderUnavailable: boolean;
  retry: () => void;
}

/**
 * Loading/error/data hook for the architectural-explanation vertical slice.
 * Mirrors the shape of `architecture-map/useNodeExplanation.ts`, but talks
 * to this feature's own endpoint (claim-proposition-backed, real
 * `support_status` per claim) rather than the heuristic node-explanation
 * endpoint that hook uses.
 */
export function useArchitecturalExplanation(
  entityId: string | null,
  runId?: string,
): ArchitecturalExplanationState {
  const [explanation, setExplanation] = useState<ArchitecturalExplanationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProviderUnavailable, setIsProviderUnavailable] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const load = useCallback(async (isCancelled: () => boolean) => {
    if (!entityId) return;
    setIsLoading(true);
    setError(null);
    setIsProviderUnavailable(false);
    try {
      const result = await getArchitecturalExplanation(entityId, runId);
      if (isCancelled()) return;
      setExplanation(result);
    } catch (err) {
      if (isCancelled()) return;
      setExplanation(null);
      setIsProviderUnavailable(err instanceof ApiError && err.status === 503);
      setError(err instanceof Error ? err.message : 'Architectural explanation request failed');
    } finally {
      if (!isCancelled()) setIsLoading(false);
    }
  }, [entityId, runId]);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load, retryToken]);

  const retry = useCallback(() => {
    // A cached (possibly failed) response must never block an explicit
    // Retry -- force the next load() to issue a genuinely fresh request.
    if (entityId) invalidateArchitecturalExplanationCache(entityId, runId);
    setRetryToken((t) => t + 1);
  }, [entityId, runId]);

  if (!entityId) {
    return { explanation: null, isLoading: false, error: null, isProviderUnavailable: false, retry };
  }

  return { explanation, isLoading, error, isProviderUnavailable, retry };
}
