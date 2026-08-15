import { useCallback, useEffect, useState } from 'react';
import type {
  ArchitectureMapEvidenceDTO,
  ArchitectureNodeExplanationDTO,
} from './apiTypes';
import {
  getArchitectureNodeEvidence,
  getArchitectureNodeExplanation,
} from './lensCache';

interface NodeExplanationState {
  explanation: ArchitectureNodeExplanationDTO | null;
  evidence: ArchitectureMapEvidenceDTO[];
  loading: boolean;
  error: string | null;
}

export function useNodeExplanation(
  nodeId: string | null,
  enabled: boolean,
  fixtureExplanation?: ArchitectureNodeExplanationDTO | null,
  fixtureEvidence: ArchitectureMapEvidenceDTO[] = [],
): NodeExplanationState {
  const [explanation, setExplanation] = useState<ArchitectureNodeExplanationDTO | null>(null);
  const [evidence, setEvidence] = useState<ArchitectureMapEvidenceDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isCancelled: () => boolean) => {
    if (!nodeId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [nextExplanation, evidenceResponse] = await Promise.all([
        getArchitectureNodeExplanation(nodeId),
        getArchitectureNodeEvidence(nodeId).catch(() => null),
      ]);
      if (isCancelled()) return;
      setExplanation(nextExplanation);
      setEvidence(evidenceResponse?.evidence ?? []);
    } catch (err) {
      if (isCancelled()) return;
      setExplanation(null);
      setEvidence([]);
      setError(err instanceof Error ? err.message : 'Explanation request failed');
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, [enabled, nodeId]);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!nodeId) {
    return { explanation: null, evidence: [], loading: false, error: null };
  }
  if (!enabled) {
    return { explanation: fixtureExplanation ?? null, evidence: fixtureEvidence, loading: false, error: null };
  }

  return { explanation, evidence, loading, error };
}
