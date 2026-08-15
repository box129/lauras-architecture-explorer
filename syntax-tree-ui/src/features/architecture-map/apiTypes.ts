export type ArchitectureMapStatus =
  | 'verified'
  | 'insufficient'
  | 'unsupported'
  | 'stale'
  | 'candidate'
  | 'legacy';

export type ArchitectureMapNodeKind =
  | 'system'
  | 'product_area'
  | 'subsystem'
  | 'component'
  | 'code_group'
  | 'concept'
  | 'flow'
  | 'external_boundary'
  | 'cross_cutting'
  | 'diagnostic'
  // Deterministic structural-navigation fallback: real directories/files,
  // never an LLM-inferred architectural classification.
  | 'structural_package'
  | 'structural_module'
  // Phase B: a deterministic directory-containment grouping of an
  // otherwise-flat, file-shaped Overview -- see structural_fallback
  // .group_overview_components on the backend. Never an LLM-inferred
  // architectural domain.
  | 'structural_group';

export interface ArchitectureMapNodeDTO {
  id: string;
  analysis_run_id: string;
  label: string;
  kind: ArchitectureMapNodeKind;
  level: number;
  description: string;
  status: ArchitectureMapStatus;
  confidence: number | null;
  source_refs: Record<string, unknown[]>;
  evidence_count: number;
  children_count: number;
  can_drilldown: boolean;
  primary_files: string[];
  related_concept_ids: string[];
  related_flow_ids: string[];
  graph_qn: string | null;
  legacy_type: string | null;
  warnings: string[];
  unsupported_reason: string | null;
  // Phase C1: id of this node's immediate structural-containment parent
  // within the same eagerly-returned node set, or null/undefined for a
  // top-level node. Optional (mirrors the backend DTO's own default) so
  // existing fixtures/tests that predate this field keep compiling.
  // Real directory containment only -- never LLM-inferred.
  parent_group_id?: string | null;
}

export interface ArchitectureMapEdgeDTO {
  id: string;
  analysis_run_id: string;
  source: string;
  target: string;
  kind: string;
  label: string | null;
  confidence: number | null;
  source_refs: Record<string, unknown[]>;
}

export interface ArchitectureMapDiagnosticsDTO {
  repo_shape: string | null;
  projection_version: string;
  warnings: string[];
  suppressed_app_only_nodes: string[];
  nodes_without_evidence: string[];
  verified_node_count: number;
  insufficient_node_count: number;
  unsupported_node_count: number;
}

export interface ArchitectureMapResponse {
  analysis_run_id: string;
  root: ArchitectureMapNodeDTO;
  nodes: ArchitectureMapNodeDTO[];
  edges: ArchitectureMapEdgeDTO[];
  diagnostics: ArchitectureMapDiagnosticsDTO;
  metadata: Record<string, unknown>;
}

export interface ArchitectureMapChildrenResponse {
  analysis_run_id: string;
  node_id: string;
  children: ArchitectureMapNodeDTO[];
  edges: ArchitectureMapEdgeDTO[];
  total: number;
}

// One-hop neighborhood of a single node via real recovered relations
// (imports/calls/inherits/contains), independent of parent/child
// containment. Backs the Entity Focus state's bounded, deterministic
// graph -- see api/routes/architecture_map.py's `/neighborhood` route.
export interface ArchitectureMapNeighborhoodResponse {
  analysis_run_id: string;
  node_id: string;
  dependencies: ArchitectureMapNodeDTO[];
  dependents: ArchitectureMapNodeDTO[];
  edges: ArchitectureMapEdgeDTO[];
}

export interface ArchitectureMapEvidenceDTO {
  id: string;
  analysis_run_id: string;
  node_id: string;
  evidence_kind: string;
  source_ref_kind: string;
  source_ref_id: string;
  file_path: string;
  language: string;
  start_line: number;
  end_line: number;
  text_preview: string;
  status: ArchitectureMapStatus;
  confidence: number | null;
  score: number;
  reason: string;
  is_stale: boolean;
}

export interface ArchitectureMapEvidenceResponse {
  analysis_run_id: string;
  node_id: string;
  node: ArchitectureMapNodeDTO;
  evidence: ArchitectureMapEvidenceDTO[];
  total: number;
  limit: number;
}

export type ExplanationSupport =
  | 'verified'
  | 'inferred'
  | 'insufficient'
  | 'unsupported'
  | 'stale';

export interface ExplanationClaimDTO {
  text: string;
  support: ExplanationSupport;
  evidence_ids: string[];
}

export interface ExplanationFileDTO {
  file_path: string;
  reason: string;
  evidence_ids: string[];
}

export interface ExplanationRelationshipDTO {
  label: string;
  reason: string;
  target_id: string;
}

export interface ArchitectureNodeExplanationDTO {
  analysis_run_id: string;
  node_id: string;
  status: ArchitectureMapStatus;
  generation_status:
    | 'llm_generated'
    | 'cached'
    | 'fallback_no_llm'
    | 'llm_failed'
    | 'stale'
    | 'not_generated'
    | string;
  model: string;
  summary: string;
  simple_explanation: string;
  technical_explanation: string;
  responsibilities: ExplanationClaimDTO[];
  what_happens: ExplanationClaimDTO[];
  key_files: ExplanationFileDTO[];
  relationships: ExplanationRelationshipDTO[];
  gaps: string[];
  warnings: string[];
  suggested_questions: string[];
  evidence_ids: string[];
  prompt_hash: string;
  input_hash: string;
  reason?: string;
}

export interface ImplementationHighlightDTO {
  span_id: string;
  start_line: number;
  end_line: number;
  status: ArchitectureMapStatus;
  confidence: number | null;
}

export interface ImplementationSourceTabDTO {
  file_path: string;
  language: string;
  role: string;
  summary: string;
  reason: string;
  source_span_ids: string[];
  highlights: ImplementationHighlightDTO[];
  is_stale: boolean;
}

export interface ImplementationSubjectDTO {
  type: 'architecture_node' | 'concept' | 'flow' | 'flow_step' | 'source_span' | 'question_lens' | string;
  id: string;
}

export interface ImplementationSliceDTO {
  analysis_run_id: string;
  node_id: string;
  status: ArchitectureMapStatus;
  subject: ImplementationSubjectDTO | null;
  title: string;
  summary: string;
  primary_span_id: string;
  evidence_strength: number;
  tabs: ImplementationSourceTabDTO[];
  gaps: string[];
  unsupported_reason: string;
  warnings: string[];
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

export interface CodeCompanionSelection {
  subject_type: string;
  subject_id: string;
  title?: string;
  file_path?: string;
  span_id?: string;
  start_line?: number;
  evidence_id?: string;
  reason?: string;
  open?: boolean;
}

export interface SourceSpanDTO {
  id: string;
  analysis_run_id: string;
  file_path: string;
  language: string;
  start_line: number;
  end_line: number;
  text_preview: string;
  content?: string | null;
  text_hash: string;
  current_text_hash: string;
  is_stale: boolean;
  symbol_id: string;
  qualified_name: string;
  kind: string;
  status: string;
  confidence: number | null;
}

export interface SymbolDTO {
  id: string;
  node_id: string;
  qualified_name: string;
  name: string;
  type: string;
  file_path: string;
}

export interface RouteEndpointDTO {
  id: string;
  method: string;
  path_template: string;
  framework: string;
  handler_symbol_id: string;
  span_id: string;
  auth_hint: string;
  status: string;
  confidence: number | null;
}

export interface FrontendEventDTO {
  id: string;
  event_type: string;
  event_label: string;
  framework: string;
  span_id: string;
  component_symbol_id: string;
  handler_symbol_id: string;
  status: string;
  confidence: number | null;
}

export interface ApiCallDTO {
  id: string;
  method: string;
  url_template: string;
  client_kind: string;
  span_id: string;
  caller_symbol_id: string;
  resolved_route_id: string;
  status: string;
  confidence: number | null;
}

export interface FlowListItemDTO {
  id: string;
  analysis_run_id: string;
  name: string;
  trigger_kind: string;
  trigger_id: string;
  status: string;
  confidence: number | null;
  unsupported_reason: string;
  evidence_count: number;
  step_count: number;
  first_source_span: SourceSpanDTO | null;
  trigger_summary: string;
  user_action_label: string;
  simple_explanation: string;
  technical_explanation: string;
  related_architecture_node_ids: string[];
  related_concept_ids: string[];
  gap_count: number;
  boundary_count: number;
}

export interface FlowStepDTO {
  id: string;
  analysis_run_id: string;
  step_order: number;
  step_type: string;
  description: string;
  boundary_kind: string | null;
  source_span: SourceSpanDTO;
  symbol: SymbolDTO | null;
  linked_route: RouteEndpointDTO | null;
  linked_api_call: ApiCallDTO | null;
  linked_frontend_event: FrontendEventDTO | null;
  confidence: number | null;
  gap_reason: string;
}

export interface FlowDetailDTO {
  flow: FlowListItemDTO;
  trigger: Record<string, unknown>;
  steps: FlowStepDTO[];
}

export interface FlowListResponse {
  analysis_run_id: string;
  flows: FlowListItemDTO[];
  total: number;
  limit: number;
  offset: number;
}

export interface QuestionLensGapDTO {
  reason: string;
  severity: string;
  source_ref_kind: string;
  source_ref_id: string;
}

export interface QuestionLensStepDTO {
  id: string;
  label: string;
  step_type: string;
  status: ArchitectureMapStatus | string;
  confidence: number | null;
  source_span_id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  gap_reason: string;
}

export interface QuestionLensDTO {
  id: string;
  analysis_run_id: string;
  type: string;
  title: string;
  status: ArchitectureMapStatus | string;
  intent: string;
  subject_type: string;
  subject_id: string;
  description: string;
  simple_explanation: string;
  technical_explanation: string;
  confidence: number | null;
  steps: QuestionLensStepDTO[];
  evidence: ArchitectureMapEvidenceDTO[];
  source_tabs: ImplementationSourceTabDTO[];
  related_architecture_node_ids: string[];
  related_concept_ids: string[];
  related_flow_ids: string[];
  gaps: QuestionLensGapDTO[];
  searched_areas: string[];
  unsupported_reason: string;
  metadata: Record<string, unknown>;
}

export interface QueryResponseDTO {
  analysis_run_id: string;
  answer_text: string;
  intent: string;
  citations: Record<string, unknown>[];
  confidence: number;
  follow_ups: string[];
  diagrams: Record<string, unknown>[];
  visual_lenses: QuestionLensDTO[];
  lens_count: number;
  unsupported_reasons: string[];
  evidence_coverage: Record<string, unknown>;
  conversation_id: string;
  turn_number: number;
  run_metadata: Record<string, unknown>;
}

export interface QuestionLensEvidenceResponse {
  analysis_run_id: string;
  lens_id: string;
  evidence: ArchitectureMapEvidenceDTO[];
  total: number;
}
