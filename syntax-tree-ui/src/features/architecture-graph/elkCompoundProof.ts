import ELK, { type ElkExtendedEdge, type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { ArchitectureGraphAggregateEdgeDTO, ArchitectureGraphGroupDTO } from './graphTypes';

export interface CompoundLayoutNode {
  id: string;
  parentId?: string;
  position: { x: number; y: number };
  width: number;
  height: number;
}

export interface CompoundLayoutResult {
  nodes: CompoundLayoutNode[];
  routedEdgeIds: string[];
}

const elk = new ELK();
const options = { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.spacing.nodeNode': '36', 'elk.layered.spacing.nodeNodeBetweenLayers': '90', 'elk.padding': '[top=52,left=28,bottom=28,right=28]' };

/** G0-only adapter: deterministic DTO -> ELK hierarchy -> ReactFlow-relative coordinates. */
export async function layoutArchitectureGraphProof(groups: ArchitectureGraphGroupDTO[], edges: ArchitectureGraphAggregateEdgeDTO[]): Promise<CompoundLayoutResult> {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const children = new Map<string, ArchitectureGraphGroupDTO[]>();
  for (const group of groups) if (group.parent_group_id && byId.has(group.parent_group_id)) children.set(group.parent_group_id, [...(children.get(group.parent_group_id) ?? []), group]);
  const build = (group: ArchitectureGraphGroupDTO): ElkNode => ({ id: group.id, width: children.has(group.id) ? 300 : 180, height: children.has(group.id) ? 120 : 82, layoutOptions: options, children: (children.get(group.id) ?? []).sort((a, b) => a.id.localeCompare(b.id)).map(build) });
  const root: ElkNode = { id: '__root__', layoutOptions: options, children: groups.filter((group) => !group.parent_group_id || !byId.has(group.parent_group_id)).sort((a, b) => a.id.localeCompare(b.id)).map(build) };
  root.edges = edges.filter((edge) => byId.has(edge.source_group_id) && byId.has(edge.target_group_id)).sort((a, b) => a.id.localeCompare(b.id)).map((edge): ElkExtendedEdge => ({ id: edge.id, sources: [edge.source_group_id], targets: [edge.target_group_id] }));
  const laid = await elk.layout(root);
  const nodes: CompoundLayoutNode[] = [];
  const emit = (node: ElkNode, parentId?: string) => {
    if (node.id !== '__root__') nodes.push({ id: node.id, ...(parentId ? { parentId } : {}), position: { x: node.x ?? 0, y: node.y ?? 0 }, width: node.width ?? 0, height: node.height ?? 0 });
    for (const child of node.children ?? []) emit(child, node.id === '__root__' ? undefined : node.id);
  };
  emit(laid);
  return { nodes, routedEdgeIds: (laid.edges ?? []).filter((edge) => (edge.sections?.length ?? 0) > 0).map((edge) => edge.id).sort() };
}
