/** Neutral G0 contract mirror. No model or AI fields are permitted. */
export interface ArchitectureGraphGroupDTO {
  id: string;
  label: string;
  structural_path: string;
  parent_group_id: string | null;
  kind: 'structural_container' | 'structural_leaf' | 'root_file_bucket';
  direct_member_module_ids: string[];
  direct_child_group_ids: string[];
  recursive_module_count: number;
}

export interface ArchitectureGraphAggregateEdgeDTO {
  id: string;
  source_group_id: string;
  target_group_id: string;
  relation_kind: 'contains' | 'imports' | 'calls' | 'inherits';
  member_relation_count: number;
}
