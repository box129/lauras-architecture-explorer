import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchApi } from '../../api/client';
import type { ArchitectureMapResponse } from './apiTypes';

interface ArchitectureMapState {
  data: ArchitectureMapResponse | null;
  loading: boolean;
  error: string | null;
  statusCode: number | null;
  refetch: () => void;
}

export function useArchitectureMap(enabled: boolean, runId: string | null): ArchitectureMapState {
  const [data, setData] = useState<ArchitectureMapResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setData(null);
    setError(null);
    setStatusCode(null);
    try {
      const result = await fetchApi<ArchitectureMapResponse>('/architecture-map');
      if (runId && result.analysis_run_id !== runId) {
        throw new ApiError(409, 'The architecture map belongs to a different analysis run. Refresh the analysis and retry.');
      }
      setData(result);
    } catch (err) {
      setData(null);
      if (err instanceof ApiError) {
        setStatusCode(err.status);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Architecture map request failed');
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, runId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, statusCode, refetch };
}
