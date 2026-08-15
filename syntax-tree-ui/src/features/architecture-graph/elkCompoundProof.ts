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
const rootOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '88',
  'elk.layered.spacing.nodeNodeBetweenLayers': '150',
  'elk.padding': '[top=44,left=52,bottom=52,right=52]',
  'elk.edgeRouting': 'ORTHOGONAL',
};

const compoundOptions = {
  ...rootOptions,
  'elk.spacing.nodeNode': '32',
  'elk.layered.spacing.nodeNodeBetweenLayers': '56',
  // Reserve a quiet header band and enough interior/gutter space for child
  // packing. ELK still expands the parent from the measured child bounds.
  'elk.padding': '[top=76,left=30,bottom=34,right=44]',
};

/** G0-only adapter: deterministic DTO -> ELK hierarchy -> ReactFlow-relative coordinates. */
export async function layoutArchitectureGraphProof(groups: ArchitectureGraphGroupDTO[], edges: ArchitectureGraphAggregateEdgeDTO[]): Promise<CompoundLayoutResult> {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const children = new Map<string, ArchitectureGraphGroupDTO[]>();
  for (const group of groups) if (group.parent_group_id && byId.has(group.parent_group_id)) children.set(group.parent_group_id, [...(children.get(group.parent_group_id) ?? []), group]);
  const build = (group: ArchitectureGraphGroupDTO): ElkNode => {
    const hasChildren = children.has(group.id);
    const isTopLevel = !group.parent_group_id || !byId.has(group.parent_group_id);
    return {
      id: group.id,
      // These are minima, not authored map coordinates. Containers grow when
      // their packed children need more room; top-level regions reserve the
      // map-scale surface that makes containment secondary to relations.
      width: hasChildren ? (isTopLevel ? 460 : 300) : (isTopLevel ? 280 : 176),
      height: hasChildren ? (isTopLevel ? 270 : 132) : (isTopLevel ? 142 : 76),
      layoutOptions: compoundOptions,
      children: (children.get(group.id) ?? []).sort((a, b) => a.id.localeCompare(b.id)).map(build),
    };
  };
  const root: ElkNode = { id: '__root__', layoutOptions: rootOptions, children: groups.filter((group) => !group.parent_group_id || !byId.has(group.parent_group_id)).sort((a, b) => a.id.localeCompare(b.id)).map(build) };
  // ELK does not route every edge whose endpoints live in separate nested
  // compounds when attached at the artificial root. Route those through their
  // nearest root children; the original aggregate-edge id remains intact for
  // later ReactFlow gutter/handle rendering.
  const rootRepresentative = (id: string): string => {
    let current = id;
    while (byId.get(current)?.parent_group_id && byId.has(byId.get(current)?.parent_group_id ?? '')) current = byId.get(current)?.parent_group_id ?? current;
    return current;
  };
  root.edges = edges.filter((edge) => byId.has(edge.source_group_id) && byId.has(edge.target_group_id)).sort((a, b) => a.id.localeCompare(b.id)).map((edge): ElkExtendedEdge => {
    const sourceRoot = rootRepresentative(edge.source_group_id);
    const targetRoot = rootRepresentative(edge.target_group_id);
    return sourceRoot === targetRoot
      ? { id: edge.id, sources: [edge.source_group_id], targets: [edge.target_group_id] }
      : { id: edge.id, sources: [sourceRoot], targets: [targetRoot] };
  });
  const laid = await elk.layout(root);
  // A root without a cross-region relation is not made to look connected.
  // ELK has no relation to rank it against, so place it in a stable secondary
  // lane beside the connected map rather than letting it strand above it.
  const connectedRoots = new Set((laid.edges ?? []).flatMap((edge) => [...(edge.sources ?? []), ...(edge.targets ?? [])]));
  const rootChildren = laid.children ?? [];
  const connectedExtent = rootChildren.filter((child) => connectedRoots.has(child.id)).reduce((extent, child) => Math.max(extent, (child.x ?? 0) + (child.width ?? 0)), 0);
  const detached = rootChildren.filter((child) => !connectedRoots.has(child.id)).sort((a, b) => a.id.localeCompare(b.id));
  detached.forEach((child, index) => { child.x = connectedExtent + 150; child.y = 48 + index * ((child.height ?? 0) + 64); });
  const nodes: CompoundLayoutNode[] = [];
  const emit = (node: ElkNode, parentId?: string) => {
    if (node.id !== '__root__') nodes.push({ id: node.id, ...(parentId ? { parentId } : {}), position: { x: node.x ?? 0, y: node.y ?? 0 }, width: node.width ?? 0, height: node.height ?? 0 });
    for (const child of node.children ?? []) emit(child, node.id === '__root__' ? undefined : node.id);
  };
  emit(laid);
  return { nodes, routedEdgeIds: (laid.edges ?? []).filter((edge) => (edge.sections?.length ?? 0) > 0).map((edge) => edge.id).sort() };
}
