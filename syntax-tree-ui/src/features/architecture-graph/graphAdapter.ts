import type { ObservatoryEdge, ObservatoryNode } from '../observatory/types';
import type { ArchitectureGraphResponse } from './graphTypes';

export interface ArchitectureGraphOverview {
  nodes: ObservatoryNode[];
  edges: ObservatoryEdge[];
  internalCounts: Map<string, number>;
}

/** Keeps Enter on the deterministic graph contract as a strict subtree projection. */
export function architectureGraphScope(response: ArchitectureGraphResponse, scopeGroupId?: string | null): ArchitectureGraphResponse | null {
  if (!scopeGroupId) return response;
  const byId = new Map(response.groups.map((group) => [group.id, group]));
  if (!byId.has(scopeGroupId)) return null;
  const inScope = new Set<string>();
  for (const group of response.groups) {
    let current: string | null = group.id;
    while (current) {
      if (current === scopeGroupId) { inScope.add(group.id); break; }
      current = byId.get(current)?.parent_group_id ?? null;
    }
  }
  return {
    ...response,
    groups: response.groups.filter((group) => group.id !== scopeGroupId && inScope.has(group.id)).map((group) => group.parent_group_id === scopeGroupId ? { ...group, parent_group_id: null } : group),
    aggregate_edges: response.aggregate_edges.filter((edge) => inScope.has(edge.source_group_id) && edge.source_group_id !== scopeGroupId && inScope.has(edge.target_group_id) && edge.target_group_id !== scopeGroupId),
    // The scope's OWN internal relation counts stay in the projection:
    // they are the real resolved relations among the members now on
    // screen (live-audit defect: entering a region with 16 internal
    // relations displayed "Relations 0" because these rows were dropped
    // along with the scope group itself).
    internal_relation_counts: response.internal_relation_counts.filter((value) => inScope.has(value.group_id)),
  };
}

/** The final structural path segment is a truthful, compact map label. The
 * complete path remains available as `summary` for provenance. */
function mapLabel(label: string): string {
  if (label.endsWith(' (direct files)')) return 'Direct files';
  const segments = label.replaceAll('\\', '/').split('/').filter(Boolean);
  return segments.at(-1) ?? label;
}

export function adaptArchitectureGraph(response: ArchitectureGraphResponse): ArchitectureGraphOverview {
  const internalCounts = new Map<string, number>();
  for (const value of response.internal_relation_counts) internalCounts.set(value.group_id, (internalCounts.get(value.group_id) ?? 0) + value.member_relation_count);
  return {
    internalCounts,
    nodes: response.groups.map((group) => ({
      id: group.id, label: group.kind === 'relation_residual' ? 'Ungrouped' : (group.parent_group_id ? mapLabel(group.label) : group.label), kind: group.kind === 'module' ? 'structural_module' : 'structural_group', description: group.kind === 'relation_cluster' ? 'Derived mechanically from resolved source relationships.' : group.kind === 'relation_residual' ? 'These modules were not placed in a deterministic relation cluster from the currently recovered resolved relationships.' : `Structural basis: ${group.structural_path}`,
      // Structural regions, relation clusters, and residual groups are
      // deterministic structural facts, not verified evidence-backed
      // claims -- applying the "Verified" status here would misuse the
      // same badge the evidence/claims system uses for source-backed
      // support. 'candidate' is the closest existing status that does not
      // overclaim while these nodes carry no evidenceCount of their own.
      status: 'candidate', confidence: null, evidenceCount: 0, childrenCount: group.recursive_module_count,
      canDrilldown: group.can_drilldown, primaryFiles: [], accent: group.kind === 'root_file_bucket' ? 'stone' : 'slateBlue',
      icon: group.kind === 'structural_container' ? 'FolderTree' : 'Folder', position: { x: 0, y: 0 },
      summary: group.structural_path, whatHappens: [`${group.recursive_module_count} source module${group.recursive_module_count === 1 ? '' : 's'}.`], relatedLenses: [],
      parentGroupId: group.parent_group_id, sourceRefs: { direct_member_module_ids: group.direct_member_module_ids, direct_child_group_ids: group.direct_child_group_ids, graph_kind: [group.kind], residual: [Boolean(group.residual)], internal_relation_count: [group.internal_relation_count ?? 0], internal_relation_kind_counts: [group.internal_relation_kind_counts ?? []], boundary_relation_count: [group.boundary_relation_count ?? 0], boundary_relation_kind_counts: [group.boundary_relation_kind_counts ?? []], algorithm: [group.algorithm ?? ''] },
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

/** Relation filter for the map control cluster (19_ARCHITECTURE_GRAPH_SPEC).
 * `strongest` keeps aggregate edges at or above the spec threshold of 6 —
 * relaxed to the strongest real aggregate when nothing reaches 6, so a
 * sparse repository still shows its strongest genuine relations instead of
 * a silently empty map. Every count is a sum of real member relations. */
export type RelationFilter = 'strongest' | 'all' | 'imports' | 'calls' | 'inherits' | 'none';

const STRONGEST_AGGREGATE_THRESHOLD = 6;

function edgeCount(edge: ObservatoryEdge): number {
  return Number((edge.sourceRefs?.member_relation_count as number[] | undefined)?.[0] ?? 0);
}

export function filterGraphEdges(edges: ObservatoryEdge[], filter: RelationFilter): ObservatoryEdge[] {
  if (filter === 'none') return [];
  if (filter === 'all') return edges;
  if (filter === 'strongest') {
    const maxCount = edges.reduce((max, edge) => Math.max(max, edgeCount(edge)), 0);
    const threshold = Math.min(STRONGEST_AGGREGATE_THRESHOLD, maxCount);
    return edges.filter((edge) => edgeCount(edge) >= threshold && edgeCount(edge) > 0);
  }
  return edges.filter((edge) => edge.kind === filter);
}

/** Real child-module labels for a group, for the cluster/section member
 * chips. Only genuine `kind === 'module'` children are listed — nothing is
 * synthesized when the backend returned no module nodes for a group. */
export function memberPreviews(response: ArchitectureGraphResponse, limit = 4): Map<string, { labels: string[]; moduleCount: number }> {
  const result = new Map<string, { labels: string[]; moduleCount: number }>();
  for (const group of response.groups) {
    if (group.kind !== 'module' || !group.parent_group_id) continue;
    const entry = result.get(group.parent_group_id) ?? { labels: [], moduleCount: 0 };
    entry.moduleCount += 1;
    if (entry.labels.length < limit) entry.labels.push(group.label);
    result.set(group.parent_group_id, entry);
  }
  return result;
}

export interface ArchitectureGraphSummary {
  sourceModules: number;
  topLevelRegions: number;
  sections: number;
  structuralClusters: number;
  ungroupedModules: number;
}

/** Real counts only (04_ARCHITECTURE_OVERVIEW_SPEC's summary line). */
export function summarizeArchitectureGraph(response: ArchitectureGraphResponse): ArchitectureGraphSummary {
  const topLevel = response.groups.filter((group) => !group.parent_group_id);
  return {
    sourceModules: topLevel.reduce((count, group) => count + group.recursive_module_count, 0),
    topLevelRegions: topLevel.length,
    sections: response.groups.filter((group) => group.kind === 'structural_container' && group.parent_group_id).length,
    structuralClusters: response.groups.filter((group) => group.kind === 'relation_cluster').length,
    ungroupedModules: response.groups.filter((group) => group.kind === 'relation_residual').reduce((count, group) => count + group.recursive_module_count, 0),
  };
}

export function visibleGroupIds(nodes: ObservatoryNode[], expandedIds: ReadonlySet<string>): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const result = new Set<string>();
  for (const node of nodes) {
    let parent = node.parentGroupId;
    let visible = true;
    while (parent && byId.has(parent)) {
      // Nested containment is progressive disclosure at every zoom. Zoom
      // changes node detail and edge density; only an explicit Expand makes
      // a child a visible peer on the same root canvas.
      if (!expandedIds.has(parent)) { visible = false; break; }
      parent = byId.get(parent)?.parentGroupId;
    }
    if (visible) result.add(node.id);
  }
  return result;
}
