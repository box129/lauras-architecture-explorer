import type { ObservatoryEdge, ObservatoryNode } from '../observatory/types';
import type { ArchitectureGraphResponse } from './graphTypes';

export interface ArchitectureGraphOverview {
  nodes: ObservatoryNode[];
  edges: ObservatoryEdge[];
  internalCounts: Map<string, number>;
}

export function adaptArchitectureGraph(response: ArchitectureGraphResponse): ArchitectureGraphOverview {
  const internalCounts = new Map<string, number>();
  for (const value of response.internal_relation_counts) internalCounts.set(value.group_id, (internalCounts.get(value.group_id) ?? 0) + value.member_relation_count);
  return {
    internalCounts,
    nodes: response.groups.map((group) => ({
      id: group.id, label: group.label, kind: 'structural_group', description: `Structural basis: ${group.structural_path}`,
      status: 'verified', confidence: null, evidenceCount: 0, childrenCount: group.recursive_module_count,
      canDrilldown: group.can_drilldown, primaryFiles: [], accent: group.kind === 'root_file_bucket' ? 'stone' : 'slateBlue',
      icon: group.kind === 'structural_container' ? 'FolderTree' : 'Folder', position: { x: 0, y: 0 },
      summary: group.structural_path, whatHappens: [`${group.recursive_module_count} source module${group.recursive_module_count === 1 ? '' : 's'}.`], relatedLenses: [],
      parentGroupId: group.parent_group_id, sourceRefs: { direct_member_module_ids: group.direct_member_module_ids, direct_child_group_ids: group.direct_child_group_ids },
    })),
    edges: response.aggregate_edges.map((edge) => ({
      id: edge.id, source: edge.source_group_id, target: edge.target_group_id, kind: edge.relation_kind,
      label: `${edge.relation_kind} · ${edge.member_relation_count}`, confidence: null,
      sourceRefs: { relation_ids_preview: edge.relation_ids_preview, member_relation_count: [edge.member_relation_count] },
    })),
  };
}

export function visibleGraphEdges(edges: ObservatoryEdge[], zoom: number): ObservatoryEdge[] {
  const minimum = zoom < 0.68 ? 3 : zoom < 0.95 ? 1 : 0;
  return edges.filter((edge) => Number((edge.sourceRefs?.member_relation_count as number[] | undefined)?.[0] ?? 0) >= minimum);
}

export function visibleGroupIds(nodes: ObservatoryNode[], expandedIds: ReadonlySet<string>, zoom: number): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const result = new Set<string>();
  for (const node of nodes) {
    let parent = node.parentGroupId;
    let visible = true;
    while (parent && byId.has(parent)) {
      if (!expandedIds.has(parent) && zoom < 0.95) { visible = false; break; }
      parent = byId.get(parent)?.parentGroupId;
    }
    if (visible) result.add(node.id);
  }
  return result;
}
