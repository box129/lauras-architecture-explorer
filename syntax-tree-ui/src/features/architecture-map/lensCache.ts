import { ApiError, fetchApi } from '../../api/client';
import { useSyntaxTreeStore } from '../../store';
import type {
  ArchitectureMapChildrenResponse,
  ArchitectureMapEvidenceResponse,
  ArchitectureMapNeighborhoodResponse,
  ArchitectureMapNodeDTO,
  ArchitectureNodeExplanationDTO,
  FileContentResponse,
  FlowDetailDTO,
  FlowListResponse,
  ImplementationSliceDTO,
  QueryResponseDTO,
  QuestionLensDTO,
  QuestionLensEvidenceResponse,
} from './apiTypes';

const childrenCache = new Map<string, Promise<ArchitectureMapChildrenResponse>>();
const neighborhoodCache = new Map<string, Promise<ArchitectureMapNeighborhoodResponse>>();
const nodeCache = new Map<string, Promise<ArchitectureMapNodeDTO>>();
const explanationCache = new Map<string, Promise<ArchitectureNodeExplanationDTO>>();
const evidenceCache = new Map<string, Promise<ArchitectureMapEvidenceResponse>>();
const implementationCache = new Map<string, Promise<ImplementationSliceDTO>>();
const fileContentCache = new Map<string, Promise<FileContentResponse>>();
const flowListCache = new Map<string, Promise<FlowListResponse>>();
const flowDetailCache = new Map<string, Promise<FlowDetailDTO>>();
const questionLensCache = new Map<string, Promise<QuestionLensDTO>>();
const questionLensEvidenceCache = new Map<string, Promise<QuestionLensEvidenceResponse>>();

function encodeNodeId(nodeId: string): string {
  return encodeURIComponent(nodeId);
}

function encodeFilePath(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function runScopedKey(key: string): string {
  const state = useSyntaxTreeStore.getState();
  return `${state.analysisRunId ?? state.analysisJobId ?? 'no-active-run'}:${key}`;
}

export function getArchitectureNode(nodeId: string) {
  const key = runScopedKey(nodeId);
  const cached = nodeCache.get(key);
  if (cached) return cached;
  const request = fetchApi<ArchitectureMapNodeDTO>(`/architecture-map/nodes/${encodeNodeId(nodeId)}`);
  nodeCache.set(key, request);
  return request;
}

export function getArchitectureChildren(nodeId: string) {
  const key = runScopedKey(nodeId);
  const cached = childrenCache.get(key);
  if (cached) return cached;
  const request = fetchApi<ArchitectureMapChildrenResponse>(`/architecture-map/nodes/${encodeNodeId(nodeId)}/children`);
  childrenCache.set(key, request);
  return request;
}

export function getArchitectureNeighborhood(nodeId: string) {
  const key = runScopedKey(nodeId);
  const cached = neighborhoodCache.get(key);
  if (cached) return cached;
  const request = fetchApi<ArchitectureMapNeighborhoodResponse>(`/architecture-map/nodes/${encodeNodeId(nodeId)}/neighborhood`);
  neighborhoodCache.set(key, request);
  return request;
}

export function getArchitectureNodeExplanation(nodeId: string) {
  const key = runScopedKey(nodeId);
  const cached = explanationCache.get(key);
  if (cached) return cached;
  const request = fetchApi<ArchitectureNodeExplanationDTO>(`/architecture-map/nodes/${encodeNodeId(nodeId)}/explanation`);
  explanationCache.set(key, request);
  return request;
}

export function getArchitectureNodeEvidence(nodeId: string) {
  const key = runScopedKey(nodeId);
  const cached = evidenceCache.get(key);
  if (cached) return cached;
  const request = fetchApi<ArchitectureMapEvidenceResponse>(`/architecture-map/nodes/${encodeNodeId(nodeId)}/evidence?limit=40`);
  evidenceCache.set(key, request);
  return request;
}

export function getArchitectureNodeImplementation(nodeId: string) {
  const key = runScopedKey(`architecture_node:${nodeId}`);
  const cached = implementationCache.get(key);
  if (cached) return cached;
  const request = fetchApi<ImplementationSliceDTO>(`/architecture-map/nodes/${encodeNodeId(nodeId)}/implementation`);
  implementationCache.set(key, request);
  return request;
}

export function getImplementationSlice(subjectType: string, subjectId: string) {
  if (subjectType === 'architecture_node') return getArchitectureNodeImplementation(subjectId);
  if (subjectType === 'question_lens') return getQuestionLensImplementation(subjectId);
  const key = runScopedKey(`${subjectType}:${subjectId}`);
  const cached = implementationCache.get(key);
  if (cached) return cached;
  const request = fetchApi<ImplementationSliceDTO>(`/implementation-slices?subject_type=${encodeURIComponent(subjectType)}&subject_id=${encodeURIComponent(subjectId)}`);
  implementationCache.set(key, request);
  return request;
}

export function submitQuery(question: string, conversationId?: string) {
  return fetchApi<QueryResponseDTO>('/query', {
    method: 'POST',
    body: JSON.stringify({
      question,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    }),
  });
}

export function getQuestionLens(lensId: string) {
  const key = runScopedKey(lensId);
  const cached = questionLensCache.get(key);
  if (cached) return cached;
  const request = fetchApi<QuestionLensDTO>(`/query-lenses/${encodeURIComponent(lensId)}`);
  questionLensCache.set(key, request);
  return request;
}

export function getQuestionLensEvidence(lensId: string) {
  const key = runScopedKey(lensId);
  const cached = questionLensEvidenceCache.get(key);
  if (cached) return cached;
  const request = fetchApi<QuestionLensEvidenceResponse>(`/query-lenses/${encodeURIComponent(lensId)}/evidence`);
  questionLensEvidenceCache.set(key, request);
  return request;
}

export function getQuestionLensImplementation(lensId: string) {
  const key = runScopedKey(`question_lens:${lensId}`);
  const cached = implementationCache.get(key);
  if (cached) return cached;
  const request = fetchApi<ImplementationSliceDTO>(`/query-lenses/${encodeURIComponent(lensId)}/implementation`);
  implementationCache.set(key, request);
  return request;
}

export function getFileContent(filePath: string) {
  const key = runScopedKey(filePath);
  const cached = fileContentCache.get(key);
  if (cached) return cached;
  const request = fetchApi<FileContentResponse>(`/files/${encodeFilePath(filePath)}`);
  fileContentCache.set(key, request);
  return request;
}

export function getFlowList() {
  const key = runScopedKey('flows:limit=50');
  const cached = flowListCache.get(key);
  if (cached) return cached;
  const request = fetchApi<FlowListResponse>('/flows?limit=50');
  flowListCache.set(key, request);
  return request;
}

export function getFlowDetail(flowId: string) {
  const key = runScopedKey(flowId);
  const cached = flowDetailCache.get(key);
  if (cached) return cached;
  const request = fetchApi<FlowDetailDTO>(`/flows/${encodeURIComponent(flowId)}`);
  flowDetailCache.set(key, request);
  return request;
}

export function prefetchArchitectureChildren(node: { id: string; canDrilldown: boolean; childrenCount: number }) {
  if (!node.canDrilldown) return;
  window.setTimeout(() => {
    void getArchitectureChildren(node.id).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return;
      return undefined;
    });
  }, 100);
}

export function prefetchArchitectureImplementation(node: { id: string; evidenceCount?: number; evidence_count?: number }) {
  if ((node.evidenceCount ?? node.evidence_count ?? 0) <= 0) return;
  window.setTimeout(() => {
    void getArchitectureNodeImplementation(node.id).catch(() => undefined);
  }, 120);
}

export function clearArchitectureLensCache() {
  childrenCache.clear();
  neighborhoodCache.clear();
  nodeCache.clear();
  explanationCache.clear();
  evidenceCache.clear();
  implementationCache.clear();
  fileContentCache.clear();
  flowListCache.clear();
  flowDetailCache.clear();
  questionLensCache.clear();
  questionLensEvidenceCache.clear();
}
