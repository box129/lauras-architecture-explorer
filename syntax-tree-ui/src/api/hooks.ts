import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchApi, buildQueryString } from './client';
import type {
  StatsResponse,
  ArchitectureOverview,
  ArchitectureComponent,
  SubsystemResponse,
  LayerResponse,
  PatternResponse,
  ArchitectureViolation,
  ViewProjection,
  NodeResponse,
  PaginatedEdges,
  DocTreeItem,
  DocSectionResponse,
  DocOptionsResponse,
  SearchResponse,
  FileListItem,
  FileContentResponse,
  RunMetricsResponse,
  RunStagesResponse,
  RunEnrichmentResponse,
  RunOrientationResponse,
} from './types';

/* ─── Generic hook ─── */

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiGet<T>(url: string | null, pollMs = 0): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestedUrl = useRef<string | null>(null);
  const requestNumber = useRef(0);

  const fetchData = useCallback(async () => {
    const requestId = ++requestNumber.current;
    if (!url) {
      requestedUrl.current = null;
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const urlChanged = requestedUrl.current !== url;
    requestedUrl.current = url;
    setLoading(true);
    if (urlChanged) setData(null);
    setError(null);
    try {
      const result = await fetchApi<T>(url);
      if (requestId === requestNumber.current) setData(result);
    } catch (e) {
      if (requestId === requestNumber.current) {
        setError(e instanceof Error ? e.message : 'Request failed');
      }
    } finally {
      if (requestId === requestNumber.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!url || pollMs <= 0) return;
    const interval = globalThis.setInterval(() => void fetchData(), pollMs);
    return () => clearInterval(interval);
  }, [fetchData, pollMs, url]);

  return { data, loading, error, refetch: fetchData };
}

/* ─── Specific hooks ─── */

export function useStats() {
  return useApiGet<StatsResponse>('/stats');
}

export function useArchOverview() {
  return useApiGet<ArchitectureOverview>('/architecture/overview');
}

export function useComponents() {
  return useApiGet<{ components: ArchitectureComponent[] }>('/components');
}

export function useComponent(qn: string | null) {
  return useApiGet<Record<string, unknown>>(qn ? `/components/${encodeURIComponent(qn)}` : null);
}

export function useSubsystems() {
  return useApiGet<{ subsystems: SubsystemResponse[] }>('/subsystems');
}

export function useLayers() {
  return useApiGet<{ layers: LayerResponse[] }>('/layers');
}

export function usePatterns() {
  return useApiGet<{ patterns: PatternResponse[] }>('/patterns');
}

export function useViolations(severity?: string, violation_type?: string) {
  const qs = buildQueryString({ severity, violation_type });
  return useApiGet<{ violations: ArchitectureViolation[]; summary: Record<string, number> }>(`/violations${qs}`);
}

export function useRunMetrics(analysisRunId?: string | null) {
  return useApiGet<RunMetricsResponse>(
    analysisRunId ? `/runs/${encodeURIComponent(analysisRunId)}/metrics` : null,
  );
}

export function useRunStages(analysisRunId?: string | null, pollMs = 0) {
  return useApiGet<RunStagesResponse>(
    analysisRunId ? `/runs/${encodeURIComponent(analysisRunId)}/stages` : null,
    pollMs,
  );
}

export function useRunEnrichment(analysisRunId?: string | null, pollMs = 0) {
  return useApiGet<RunEnrichmentResponse>(
    analysisRunId ? `/runs/${encodeURIComponent(analysisRunId)}/enrichment` : null,
    pollMs,
  );
}

/* ─── View projections ─── */

export function useRunOrientation(analysisRunId?: string | null, pollMs = 0) {
  return useApiGet<RunOrientationResponse>(
    analysisRunId ? `/runs/${encodeURIComponent(analysisRunId)}/orientation` : null,
    pollMs,
  );
}

export function useArchitectureView(level = 'subsystem', expandQN?: string) {
  const qs = buildQueryString({ level, expand_qn: expandQN });
  return useApiGet<ViewProjection>(`/views/architecture${qs}`);
}

export function useLayeredView() {
  return useApiGet<ViewProjection>('/views/layered');
}

export function useDependencyView(scopeQN?: string, depth = 1) {
  const qs = buildQueryString({ scope_qn: scopeQN, depth });
  return useApiGet<ViewProjection>(`/views/dependency${qs}`);
}

export function useCallFlowView(startQN: string | null, maxDepth = 3) {
  const qs = startQN ? buildQueryString({ start_qn: startQN, max_depth: maxDepth }) : '';
  return useApiGet<ViewProjection>(startQN ? `/views/call-flow${qs}` : null);
}

export function useDataFlowView() {
  return useApiGet<ViewProjection>('/views/data-flow');
}

/* ─── Nodes & Edges ─── */

export function useNode(qn: string | null) {
  return useApiGet<NodeResponse>(qn ? `/nodes/${encodeURIComponent(qn)}` : null);
}

export function useEdges(sourceQN?: string, targetQN?: string, edgeType?: string) {
  const qs = buildQueryString({ source_qn: sourceQN, target_qn: targetQN, edge_type: edgeType });
  return useApiGet<PaginatedEdges>(`/edges${qs}`);
}

/* ─── Search ─── */

export function useSearch(query: string | null, limit = 20) {
  const qs = query ? buildQueryString({ q: query, limit }) : '';
  return useApiGet<SearchResponse>(query ? `/search${qs}` : null);
}

/* ─── Documentation ─── */

export function useDocTOC() {
  return useApiGet<{ sections: DocTreeItem[] }>('/docs');
}

export function useDocOptions() {
  return useApiGet<DocOptionsResponse>('/docs/options');
}

export function useDocSection(qn: string | null) {
  return useApiGet<DocSectionResponse>(qn ? `/docs/${encodeURIComponent(qn)}` : null);
}

/* ─── Files ─── */

export function useFileList() {
  return useApiGet<{ files: FileListItem[] }>('/files');
}

export function useFileContent(path: string | null) {
  const encodedPath = path
    ? path.split('/').map((segment) => encodeURIComponent(segment)).join('/')
    : null;
  return useApiGet<FileContentResponse>(encodedPath ? `/files/${encodedPath}` : null);
}
