/* ─── API Response Types ─── */

export interface NodeResponse {
  qualified_name: string;
  type: string;
  name: string;
  file_path: string;
  language: string;
  line_start: number;
  line_end: number;
  source: string;
  is_exported: boolean;
  is_async: boolean;
  parameters: Record<string, unknown>[];
  return_type: string;
  decorators: string[];
  docstring: string;
  parent_class: string;
  superclasses: string[];
  confidence: number | null;
  metadata: Record<string, unknown>;
  source_text?: string;
  snippet?: string;
}

export interface EdgeResponse {
  source_qn: string;
  target_qn: string;
  edge_type: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface PaginatedNodes {
  nodes: NodeResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedEdges {
  edges: EdgeResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface TraversalResponse {
  start_qn: string;
  direction: string;
  max_depth: number;
  reachable_count: number;
  nodes: string[];
  details?: NodeResponse[];
}

export interface SearchResponse {
  query: string;
  results: NodeResponse[];
  total: number;
}

export interface StatsResponse {
  total_nodes: number;
  total_edges: number;
  parsed_count: number;
  inferred_count: number;
  nodes_by_type: Record<string, number>;
  edges_by_type: Record<string, number>;
  nodes_by_language: Record<string, number>;
  avg_in_degree: number;
  avg_out_degree: number;
  connected_component_count: number;
  most_connected: unknown[][];
}

/* ─── Run metadata (shared across analysis, query, doc generation) ─── */

export interface RunMetadata {
  analysis_run_id?: string;
  repo_id?: string;
  parent_run_id?: string;
  validation_mode: boolean;
  llm_required: boolean;
  llm_active: boolean;
  model: string;
  llm_call_count: number;
  tokens_in: number;
  tokens_out: number;
  fallback_used: boolean;
  architecture_model_version: string;
  comprehension_mode: string;
  budget_profile: string;
  scope: string;
  files_inspected?: string[];
  symbols_inspected?: string[];
  evidence_sources?: unknown[];
  unresolved_gaps?: string[];
  active_job_id?: string;
  repository_path?: string;
}

export interface RunMetricArtifactTiming {
  name: string;
  stage: string;
  available: boolean;
  elapsed_ms: number;
  reason: string;
}

export interface RunMetricBottleneck {
  stage: string;
  status: string;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  estimated_cost: number;
}

export interface RunTraceStage {
  id: string;
  stage: string;
  status: string;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  estimated_cost: number;
  trace: Record<string, unknown>;
  created_at?: string | null;
}

export interface RunMetricsResponse {
  analysis_run_id: string;
  repo_id: string;
  repository_name: string;
  status: string;
  duration_ms: number;
  stage_count: number;
  failed_stage_count: number;
  warning_count: number;
  llm_stage_count: number;
  fallback_stage_count: number;
  tokens_in: number;
  tokens_out: number;
  estimated_cost: number;
  db_size_bytes: number;
  graph: Record<string, number>;
  artifacts: Record<string, number>;
  first_artifact_timings: RunMetricArtifactTiming[];
  bottlenecks: RunMetricBottleneck[];
  failures: RunTraceStage[];
  warnings: string[];
}

export type AnalysisStageStatus = 'pending' | 'running' | 'ready' | 'failed' | 'skipped';

export interface AnalysisReadinessStage {
  id: string;
  analysis_run_id: string;
  stage_name: string;
  display_name: string;
  status: AnalysisStageStatus;
  sort_order: number;
  started_at?: string | null;
  finished_at?: string | null;
  artifact_refs: Record<string, unknown>;
  blocking_error: string;
  warnings: string[];
  can_render_frontend: boolean;
  metadata: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RunStagesResponse {
  analysis_run_id: string;
  current_stage: string;
  status_counts: Record<string, number>;
  can_render_frontend: boolean;
  stages: AnalysisReadinessStage[];
}

export type EnrichmentJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface EnrichmentJob {
  id: string;
  analysis_run_id: string;
  job_type: string;
  status: EnrichmentJobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RunEnrichmentResponse {
  analysis_run_id: string;
  status_counts: Record<string, number>;
  jobs: EnrichmentJob[];
}

/* ─── Architecture ─── */

export type RepoOrientationStatus = 'pending' | 'ready' | 'insufficient' | 'failed';
export type RepoOrientationEvidenceStatus = 'candidate' | 'supported' | 'insufficient';

export interface RepoOrientationShape {
  kind: string;
  label: string;
  confidence: number;
  evidence: string[];
  signals: Record<string, unknown>;
}

export interface RepoOrientationLanguage {
  language: string;
  count: number;
}

export interface RepoOrientationFramework {
  name: string;
  ecosystem: string;
  confidence: number;
  evidence: string[];
  file_paths: string[];
}

export interface RepoOrientationArea {
  id: string;
  name: string;
  area_type: string;
  status: RepoOrientationEvidenceStatus;
  confidence: number;
  description: string;
  file_paths: string[];
  evidence: string[];
  sort_order: number;
}

export interface RepoOrientationFinding {
  id: string;
  category: string;
  label: string;
  status: RepoOrientationEvidenceStatus;
  confidence: number;
  description: string;
  file_paths: string[];
  evidence: string[];
  sort_order: number;
}

export interface RepoOrientationSuggestedReading {
  path: string;
  reason: string;
  priority: number;
  confidence: number;
}

export interface RepoOrientationUnknown {
  id: string;
  subject: string;
  reason: string;
  severity: 'info' | 'warning';
  suggested_investigation: string;
  evidence: string[];
}

export interface RunOrientationResponse {
  analysis_run_id: string;
  repo_id: string;
  repository_name: string;
  repository_path: string;
  status: RepoOrientationStatus;
  summary: string;
  generated_at?: string | null;
  duration_ms: number;
  repo_shape: RepoOrientationShape;
  counts: Record<string, number>;
  languages: RepoOrientationLanguage[];
  frameworks: RepoOrientationFramework[];
  areas: RepoOrientationArea[];
  findings: RepoOrientationFinding[];
  suggested_reading: RepoOrientationSuggestedReading[];
  unknowns: RepoOrientationUnknown[];
  warnings: string[];
}

export interface ArchitectureComponent {
  qualified_name: string;
  name: string;
  description: string;
  domain: string;
  member_count: number;
  cohesion: number;
  coupling: number;
  confidence: number;
  layer: string;
  subsystem: string;
}

export interface ArchitectureViolation {
  qualified_name: string;
  name: string;
  violation_type: string;
  severity: string;
  description: string;
  source_entity: string;
  target_entity: string;
  confidence: number;
}

export interface ArchitectureOverview {
  qualified_name: string;
  name: string;
  system_summary: string;
  health_score: number;
  key_findings: string[];
  total_subsystems: number;
  total_layers: number;
  total_components: number;
  total_code_groups: number;
  total_patterns: number;
  total_violations: number;
  architecture_model_version: string;
  views_available: string[];
  confidence: number;
  uncertainties: string[];
  evidence_summary: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  comprehension_mode: string;
  budget_profile: string;
  scope: string;
  repo_type: string;
}

export interface SubsystemResponse {
  qualified_name: string;
  name: string;
  description: string;
  component_count: number;
  architectural_style: string;
  confidence: number;
}

export interface LayerResponse {
  qualified_name: string;
  name: string;
  position: number;
  component_count: number;
}

export interface PatternResponse {
  qualified_name: string;
  name: string;
  pattern_type: string;
  confidence: number;
  participating_components: string[];
  description: string;
}

/* ─── View Projections ─── */

export interface ViewNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
  children?: ViewNode[];
}

export interface ViewEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  data?: Record<string, unknown>;
  style?: Record<string, unknown>;
  animated?: boolean;
  edge_type?: string;
}

export interface ArchitectureViewProjection {
  view_type: 'architecture';
  nodes: ViewNode[];
  edges: ViewEdge[];
  violations: ArchitectureViolation[];
}

export interface LayeredViewProjection {
  view_type: 'layered';
  layers: {
    position: number;
    name: string;
    qualified_name: string;
    nodes: { id: string; label: string; type: string }[];
  }[];
  edges: ViewEdge[];
  violations: ArchitectureViolation[];
}

export interface DependencyViewProjection {
  view_type: 'dependency';
  scope: string | null;
  nodes: ViewNode[];
  edges: ViewEdge[];
  empty_reason?: string;
}

export interface CallFlowViewProjection {
  view_type: 'call_flow';
  start: string;
  nodes: ViewNode[];
  edges: ViewEdge[];
  empty_reason?: string;
  requires_scope?: boolean;
  required_scope_type?: string;
}

export interface DataFlowViewProjection {
  view_type: 'data_flow';
  nodes: ViewNode[];
  edges: ViewEdge[];
  empty_reason?: string;
}

export type ViewProjection =
  | ArchitectureViewProjection
  | LayeredViewProjection
  | DependencyViewProjection
  | CallFlowViewProjection
  | DataFlowViewProjection;

/* ─── v2 Hierarchy (architecture_v2 agent output) ─── */

export interface V2HierarchyNode {
  id: string;
  label: string;
  kind: 'system' | 'macro_layer' | 'subsystem' | 'component' | 'module';
  rationale?: string;
  evidence?: string[];
  members?: string[];
  confidence?: number;
  stack?: string[];
  metadata?: Record<string, unknown>;
  children?: V2HierarchyNode[];
}

export interface V2HierarchyEdge {
  src: string;
  dst: string;
  type: string;
  evidence?: string[];
  weight?: number;
}

export interface V2LayoutHints {
  groups?: string[][];
  align_horizontal?: string[][];
  separate?: string[][];
}

export interface V2HierarchyResult {
  version: string;
  repo_label: string;
  hierarchy: V2HierarchyNode | null;
  edges: V2HierarchyEdge[];
  layout_hints: V2LayoutHints;
  trace?: unknown[];
  model?: string;
  total_tokens_in?: number;
  total_tokens_out?: number;
  total_tool_calls?: number;
  confidence?: number;
}

/* ─── Documentation ─── */

export interface DocTreeItem {
  qualified_name: string;
  title: string;
  doc_level: string;
  artifact_type: string;
  summary: string;
  target_entity_qn: string;
  code_references: unknown[];
  is_stale: boolean;
  user_edited: boolean;
  has_pending_comments: boolean;
  children: DocTreeItem[];
}

export interface DocSectionResponse {
  qualified_name: string;
  title: string;
  doc_level: string;
  artifact_type: string;
  generation_mode: string;
  generation_prompt: string;
  summary: string;
  body: string;
  ai_generated_body?: string;
  code_references: Record<string, unknown>[];
  embedded_diagrams: Record<string, unknown>[];
  parent_section: string;
  child_sections: string[];
  is_stale: boolean;
  stale_reason: string;
  user_edited: boolean;
  user_comments: { text: string; timestamp: string; status: string }[];
  target_entity_qn: string;
  confidence: number;
  certification_state?: string;
  verification_report?: Record<string, unknown>;
  verification_errors?: unknown[];
  verification_warnings?: unknown[];
  resolved_references?: DocMentionTarget[];
  approved_plan?: Partial<DocPlanResponse>;
  evidence_ledger?: EvidenceLedger;
  verified_claims?: string[];
  unsupported_claims?: string[];
  word_budget?: number;
  generation_stage?: string;
  planning_fallback_used?: boolean;
  planning_model?: string;
  planning_errors?: unknown[];
}

export interface DocGenerationScope {
  qualified_name: string;
  name: string;
  type: string;
  file_path?: string;
  line_start?: number;
}

export interface DocOptionsResponse {
  artifact_types: { value: string; label: string; description: string }[];
  scopes: Record<string, DocGenerationScope[]>;
}

export interface DocMentionTarget {
  qualified_name: string;
  label: string;
  name: string;
  type: string;
  file_path?: string;
  line_start?: number;
}

export interface DocMentionResponse {
  groups: Record<string, DocMentionTarget[]>;
}

export interface EvidenceLedger {
  scope?: DocMentionTarget;
  resolved_references?: DocMentionTarget[];
  architecture_entities?: DocMentionTarget[];
  code_entities?: DocMentionTarget[];
  files?: { file_path: string; language?: string; references?: string[] }[];
  dependencies?: { source_qn: string; target_qn: string; edge_type: string }[];
  patterns?: DocMentionTarget[];
  violations?: DocMentionTarget[];
  uncertainties?: unknown[];
}

export interface DocPlanResponse {
  plan_id: string;
  title: string;
  artifact_type: string;
  scope_qn: string;
  user_request: string;
  max_words: number;
  outline: string[];
  assumptions: string[];
  evidence_targets: string[];
  resolved_references: DocMentionTarget[];
  risks: string[];
  intended_claims?: string[];
  questions?: string[];
  planning_fallback_used?: boolean;
  planning_model?: string;
  planning_errors?: string[];
  unsupported_requested_terms?: string[];
  run_metadata?: RunMetadata;
  evidence_summary: {
    architecture_entities: number;
    code_entities: number;
    files: number;
    dependencies: number;
  };
}

export interface GenerateDocResponse {
  generated: boolean;
  message: string;
  qualified_name: string;
  artifact_type: string;
  generation_mode: string;
  run_metadata: RunMetadata & { unsupported_claims?: string[] };
}

/* ─── Query ─── */

export interface QueryResponse {
  answer_text: string;
  intent: string;
  citations: { entity_qn?: string; entity_name?: string; file_path?: string; line_start?: number; [key: string]: unknown }[];
  confidence: number;
  follow_ups: string[];
  diagrams: Record<string, unknown>[];
  conversation_id: string;
  turn_number: number;
  run_metadata?: RunMetadata;
}

/* ─── Analysis ─── */

export interface AnalysisProgress {
  stage: string;
  filesTotal: number;
  filesParsed: number;
  stagesCompleted: string[];
  stagesRemaining: string[];
  elapsedSeconds: number;
  currentFile?: string;
  readinessStages?: AnalysisReadinessStage[];
  canRenderFrontend?: boolean;
}

/* ─── Files ─── */

export interface FileListItem {
  file_path: string;
  language: string;
}

export interface FileContentResponse {
  file_path: string;
  content: string;
  entities: {
    qualified_name: string;
    type: string;
    name: string;
    line_start: number;
    line_end: number;
  }[];
  line_count: number;
  language: string;
}

/* ─── WebSocket message types ─── */

export type WSMessageType = 'status' | 'intent' | 'entities' | 'text_chunk' | 'complete' | 'error';

export interface WSMessage {
  type: WSMessageType;
  data: Record<string, unknown>;
}
