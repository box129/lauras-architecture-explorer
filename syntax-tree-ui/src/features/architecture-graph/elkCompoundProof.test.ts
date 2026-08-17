import { describe, expect, it } from 'vitest';
import { layoutArchitectureGraphProof } from './elkCompoundProof';
import type { ArchitectureGraphAggregateEdgeDTO, ArchitectureGraphGroupDTO } from './graphTypes';

const group = (id: string, parent_group_id: string | null = null): ArchitectureGraphGroupDTO => ({ id, analysis_run_id: 'run:1', label: id, structural_path: id, parent_group_id, kind: parent_group_id ? 'structural_leaf' : 'structural_container', direct_member_module_ids: [], direct_child_group_ids: [], recursive_module_count: 1, can_drilldown: true });
const edge = (id: string, source_group_id: string, target_group_id: string): ArchitectureGraphAggregateEdgeDTO => ({ id, analysis_run_id: 'run:1', source_group_id, target_group_id, relation_kind: 'calls', member_relation_count: 1, distinct_member_pair_count: 1, distinct_source_member_count: 1, distinct_target_member_count: 1, relation_ids_preview: [], contributing_relation_count: 1 });

describe('ELK compound G0 proof', () => {
  it('packs nested groups into ReactFlow-compatible relative child coordinates and routes cross-container edges', async () => {
    const groups = [group('backend'), group('services', 'backend'), group('api', 'backend'), group('frontend'), group('ui', 'frontend')];
    const result = await layoutArchitectureGraphProof(groups, [edge('a', 'api', 'services'), edge('b', 'ui', 'api')]);
    expect(result.nodes.find((node) => node.id === 'services')?.parentId).toBe('backend');
    expect(result.nodes.find((node) => node.id === 'services')?.position.x).toBeGreaterThanOrEqual(0);
    expect(result.routedEdgeIds).toEqual(['a', 'b']);
  });
  it('is stable for identical medium/dense input', async () => {
    const groups = [group('region'), ...Array.from({ length: 12 }, (_, index) => group(`g${index}`, 'region'))];
    const edges = Array.from({ length: 24 }, (_, index) => edge(`e${index}`, `g${index % 12}`, `g${(index * 5 + 1) % 12}`));
    expect(await layoutArchitectureGraphProof(groups, edges)).toEqual(await layoutArchitectureGraphProof(groups, edges));
  });
});
