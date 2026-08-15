import { describe, expect, it } from 'vitest';
import { adaptArchitectureGraph, architectureGraphScope, visibleGraphEdges, visibleGroupIds } from './graphAdapter';
import type { ArchitectureGraphResponse } from './graphTypes';

const response: ArchitectureGraphResponse = { schema_version: 'architecture-graph/v1', analysis_run_id: 'run:1', groups: [
  { id: 'backend', analysis_run_id: 'run:1', label: 'backend', structural_path: 'backend', parent_group_id: null, kind: 'structural_container', direct_member_module_ids: [], direct_child_group_ids: ['services'], recursive_module_count: 3, can_drilldown: true },
  { id: 'services', analysis_run_id: 'run:1', label: 'services', structural_path: 'backend/services', parent_group_id: 'backend', kind: 'structural_leaf', direct_member_module_ids: ['module:1'], direct_child_group_ids: [], recursive_module_count: 1, can_drilldown: true },
], aggregate_edges: [{ id: 'calls', analysis_run_id: 'run:1', source_group_id: 'backend', target_group_id: 'services', relation_kind: 'calls', member_relation_count: 4, distinct_member_pair_count: 2, distinct_source_member_count: 2, distinct_target_member_count: 1, relation_ids_preview: ['relation:1'], contributing_relation_count: 4 }], internal_relation_counts: [{ group_id: 'services', relation_kind: 'calls', member_relation_count: 2 }] };

describe('architecture graph adapter', () => {
  it('preserves deterministic ids, containment, aggregate relation counts and path basis', () => {
    const graph = adaptArchitectureGraph(response);
    expect(graph.nodes.find((node) => node.id === 'services')?.parentGroupId).toBe('backend');
    expect(graph.nodes.find((node) => node.id === 'services')?.summary).toBe('backend/services');
    expect(graph.edges[0]).toMatchObject({ id: 'calls', source: 'backend', target: 'services', kind: 'calls', label: 'calls · 4' });
    expect(graph.internalCounts.get('services')).toBe(2);
  });
  it('uses deterministic semantic LOD thresholds without removing facts', () => {
    const graph = adaptArchitectureGraph(response);
    expect(visibleGraphEdges(graph.edges, 0.5)).toHaveLength(1);
    expect(visibleGraphEdges([{ ...graph.edges[0], sourceRefs: { member_relation_count: [1] } }], 0.5)).toHaveLength(0);
    expect(visibleGraphEdges([{ ...graph.edges[0], sourceRefs: { member_relation_count: [1] } }], 0.8)).toHaveLength(1);
  });
  it('projects an entered structural scope without inventing boundary relations', () => {
    const scoped = architectureGraphScope({
      ...response,
      groups: [...response.groups, { id: 'api', analysis_run_id: 'run:1', label: 'api', structural_path: 'backend/api', parent_group_id: 'backend', kind: 'structural_leaf', direct_member_module_ids: ['module:2'], direct_child_group_ids: [], recursive_module_count: 1, can_drilldown: true }, { id: 'frontend', analysis_run_id: 'run:1', label: 'frontend', structural_path: 'frontend', parent_group_id: null, kind: 'structural_leaf', direct_member_module_ids: ['module:3'], direct_child_group_ids: [], recursive_module_count: 1, can_drilldown: true }],
      aggregate_edges: [...response.aggregate_edges, { ...response.aggregate_edges[0], id: 'boundary', source_group_id: 'services', target_group_id: 'frontend' }],
    }, 'backend');
    expect(scoped?.groups.map((group) => [group.id, group.parent_group_id])).toEqual([['services', null], ['api', null]]);
    expect(scoped?.aggregate_edges).toEqual([]);
  });
  it('keeps deep containment hidden until every ancestor is explicitly expanded', () => {
    const graph = adaptArchitectureGraph({ ...response, groups: [...response.groups, { ...response.groups[1], id: 'deep', parent_group_id: 'services', structural_path: 'backend/services/deep' }] });
    expect([...visibleGroupIds(graph.nodes, new Set())]).toEqual(['backend']);
    expect([...visibleGroupIds(graph.nodes, new Set(['backend']))]).toEqual(['backend', 'services']);
    expect([...visibleGroupIds(graph.nodes, new Set(['backend', 'services']))]).toEqual(['backend', 'services', 'deep']);
  });
  it('preserves backend-projected cluster and residual hierarchy without client clustering', () => {
    const graph = adaptArchitectureGraph({ ...response, schema_version: 'architecture-graph/v2', groups: [...response.groups,
      { id: 'cluster:1', analysis_run_id: 'run:1', label: 'Structural cluster 1', structural_path: 'backend/services', parent_group_id: 'services', kind: 'relation_cluster', direct_member_module_ids: ['module:1'], direct_child_group_ids: ['module:1'], recursive_module_count: 1, can_drilldown: false, cluster_id: 'cluster:1', internal_relation_count: 3, boundary_relation_count: 1 },
      { id: 'residual:1', analysis_run_id: 'run:1', label: 'Unclustered by recovered relations', structural_path: 'backend/services', parent_group_id: 'services', kind: 'relation_residual', direct_member_module_ids: ['module:2'], direct_child_group_ids: ['module:2'], recursive_module_count: 1, can_drilldown: false, residual: true },
      { id: 'module:1', analysis_run_id: 'run:1', label: 'a.py', structural_path: 'backend/services', parent_group_id: 'cluster:1', kind: 'module', direct_member_module_ids: [], direct_child_group_ids: [], recursive_module_count: 1, can_drilldown: false },
    ] });
    expect(graph.nodes.find((node) => node.id === 'cluster:1')?.sourceRefs?.graph_kind).toEqual(['relation_cluster']);
    expect(graph.nodes.find((node) => node.id === 'residual:1')?.description).toContain('not placed');
    expect([...visibleGroupIds(graph.nodes, new Set(['backend', 'services', 'cluster:1']))]).toContain('module:1');
  });
});
