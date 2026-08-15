/** Neutral deterministic contract mirror. No model or AI fields are permitted. */
export interface ArchitectureGraphGroupDTO {
  analysis_run_id: string;
  id: string;
  label: string;
  structural_path: string;
  parent_group_id: string | null;
  kind: 'structural_container' | 'structural_leaf' | 'root_file_bucket' | 'relation_cluster' | 'relation_residual' | 'module';
  direct_member_module_ids: string[];
  direct_child_group_ids: string[];
  recursive_module_count: number;
  can_drilldown: boolean;
  cluster_id?: string | null;
  residual?: boolean;
  internal_relation_count?: number;
  internal_relation_kind_counts?: [string, number][];
  boundary_relation_count?: number;
  boundary_relation_kind_counts?: [string, number][];
  algorithm?: string | null;
}

export interface ArchitectureGraphAggregateEdgeDTO {
  analysis_run_id: string;
  id: string;
  source_group_id: string;
  target_group_id: string;
  relation_kind: 'contains' | 'imports' | 'calls' | 'inherits';
  member_relation_count: number;
  distinct_member_pair_count: number;
  distinct_source_member_count: number;
  distinct_target_member_count: number;
  relation_ids_preview: string[];
  contributing_relation_count: number;
}

export interface ArchitectureGraphResponse {
  schema_version: 'architecture-graph/v1' | 'architecture-graph/v2';
  analysis_run_id: string;
  groups: ArchitectureGraphGroupDTO[];
  aggregate_edges: ArchitectureGraphAggregateEdgeDTO[];
  internal_relation_counts: { group_id: string; relation_kind: string; member_relation_count: number }[];
}

export interface ClusterInterpretationResponse { analysis_run_id: string; cluster_id: string; status: 'available' | 'unavailable'; interpretation?: { cluster_id: string; label: string; description: string; provider: string; model: string } | null; }
