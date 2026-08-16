import { useEffect, useMemo, useState } from 'react';
import { Background, MiniMap, ReactFlow, ReactFlowProvider, type Edge, type Node, useViewport } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fetchApi } from '../../api/client';
import type { ObservatoryNode } from '../observatory/types';
import SemanticEdge from '../architecture-map/SemanticEdge';
import ArchitectureOutline from './ArchitectureOutline';
import ArchitectureRegionNode from './ArchitectureRegionNode';
import MapControls, { type ArchitectureViewMode } from './MapControls';
import { layoutArchitectureGraphProof } from './elkCompoundProof';
import {
  adaptArchitectureGraph,
  architectureGraphScope,
  filterGraphEdges,
  memberPreviews,
  summarizeArchitectureGraph,
  visibleGroupIds,
  type RelationFilter,
} from './graphAdapter';
import type { ArchitectureGraphResponse } from './graphTypes';

const nodeTypes = { architectureRegion: ArchitectureRegionNode };
const edgeTypes = { semantic: SemanticEdge };

function GraphSurface({ data, selectedNode, onSelectNode, onEnterNode, onHoverNode, requestedExpandId }: { data: ArchitectureGraphResponse; selectedNode: ObservatoryNode | null; onSelectNode: (node: ObservatoryNode | null) => void; onEnterNode: (node: ObservatoryNode, selectOnly?: boolean) => void; onHoverNode: (node: ObservatoryNode) => void; requestedExpandId?: string | null }) {
  const { nodes: sourceNodes, edges: sourceEdges, internalCounts } = useMemo(() => adaptArchitectureGraph(data), [data]);
  const members = useMemo(() => memberPreviews(data), [data]);
  const [layout, setLayout] = useState<{ nodes: Node[]; routed: string[] }>({ nodes: [], routed: [] });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ArchitectureViewMode>('map');
  const [relationFilter, setRelationFilter] = useState<RelationFilter>('strongest');
  const [minimapVisible, setMinimapVisible] = useState(true);
  const { zoom } = useViewport();
  const selectedNodeId = selectedNode?.id;
  const toggleExpanded = (id: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const visibleIds = useMemo(() => visibleGroupIds(sourceNodes, expandedIds), [expandedIds, sourceNodes]);
  // Semantic zoom (19.3): < 72% regions, 72–95% regions + clusters, ≥ 95% + modules.
  const detailLevel = zoom < 0.72 ? 'far' : zoom < 0.95 ? 'mid' : 'near';
  useEffect(() => {
    if (!requestedExpandId) return undefined;
    // Expand the requested group AND its ancestor chain, so a search hit
    // deep in the hierarchy becomes visible (19.6: locating a module
    // expands its parents and leaves the breadcrumb intact).
    const task = window.setTimeout(() => setExpandedIds((current) => {
      const byId = new Map(sourceNodes.map((node) => [node.id, node]));
      const next = new Set(current);
      let cursor: string | null | undefined = requestedExpandId;
      while (cursor && byId.has(cursor)) {
        next.add(cursor);
        cursor = byId.get(cursor)?.parentGroupId;
      }
      return next.size === current.size ? current : next;
    }), 0);
    return () => window.clearTimeout(task);
  }, [requestedExpandId, sourceNodes]);
  useEffect(() => {
    let cancelled = false;
    const groups = data.groups.filter((group) => visibleIds.has(group.id));
    // Selection dims unrelated architecture only when the selected node is
    // actually on this canvas — an entered scope keeps its (now off-canvas)
    // parent selected, which must not grey out the whole entered view.
    const dimAgainstId = selectedNodeId && visibleIds.has(selectedNodeId) ? selectedNodeId : null;
    void layoutArchitectureGraphProof(groups, data.aggregate_edges.filter((edge) => visibleIds.has(edge.source_group_id) && visibleIds.has(edge.target_group_id))).then((result) => {
      if (cancelled) return;
      setLayout({
        routed: result.routedEdgeIds,
        nodes: result.nodes.map((item) => {
          const source = sourceNodes.find((node) => node.id === item.id)!;
          const isContainer = sourceNodes.some((node) => node.parentGroupId === item.id);
          const connected = !dimAgainstId || source.id === dimAgainstId || sourceEdges.some((edge) => (edge.source === dimAgainstId && edge.target === source.id) || (edge.target === dimAgainstId && edge.source === source.id));
          const memberEntry = members.get(item.id);
          return {
            id: item.id,
            type: 'architectureRegion',
            position: item.position,
            parentId: item.parentId,
            extent: item.parentId ? 'parent' : undefined,
            className: dimAgainstId && !connected ? 'architecture-graph-node--dimmed' : undefined,
            style: { width: item.width, height: item.height },
            data: {
              ...source,
              isContainer,
              isExpanded: expandedIds.has(item.id),
              internalRelationCount: internalCounts.get(item.id) ?? 0,
              isSelected: selectedNodeId === item.id,
              detailLevel,
              memberPreview: memberEntry?.labels ?? [],
              memberModuleCount: memberEntry?.moduleCount ?? 0,
              onExpand: toggleExpanded,
              onEnter: onEnterNode,
            },
            draggable: false,
          };
        }),
      });
    });
    return () => { cancelled = true; };
  }, [data, detailLevel, expandedIds, internalCounts, members, onEnterNode, selectedNodeId, sourceEdges, sourceNodes, visibleIds]);
  const filteredEdges = useMemo(() => filterGraphEdges(sourceEdges, relationFilter), [relationFilter, sourceEdges]);
  const visibleEdges = filteredEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const edges: Edge[] = visibleEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, type: 'semantic', label: edge.label, markerEnd: { type: 'arrowclosed' }, className: `architecture-graph-edge architecture-graph-edge--${edge.kind}${selectedNode && edge.source !== selectedNode.id && edge.target !== selectedNode.id ? ' architecture-graph-edge--dimmed' : ''}`, data: { ...edge, edgeLabel: edge.label, visualKind: edge.kind === 'inherits' ? 'boundary' : 'dependency', edgeClass: `architecture-graph-edge architecture-graph-edge--${edge.kind}${selectedNode && edge.source !== selectedNode.id && edge.target !== selectedNode.id ? ' architecture-graph-edge--dimmed' : ''}`, routed: layout.routed.includes(edge.id) } }));
  const outline = (
    <ArchitectureOutline
      nodes={sourceNodes}
      edges={visibleEdges}
      visibleIds={visibleIds}
      expandedIds={expandedIds}
      selectedNodeId={selectedNodeId}
      onSelect={(node) => onSelectNode(node)}
      onToggleExpand={toggleExpanded}
      onEnter={(node) => onEnterNode(node)}
    />
  );
  return <>
    <div className={`architecture-graph-overview__body architecture-graph-overview__body--${view}`}>
      <div className="architecture-graph-overview__canvas" aria-hidden={view === 'outline'}>
        <ReactFlow nodes={layout.nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.16, duration: 0 }} minZoom={0.4} maxZoom={1.8} onNodeClick={(event, node) => { const value = node.data as unknown as ObservatoryNode; if (event.shiftKey && sourceNodes.some((candidate) => candidate.parentGroupId === value.id)) toggleExpanded(value.id); else onSelectNode(value); }} onNodeMouseEnter={(_, node) => onHoverNode(node.data as unknown as ObservatoryNode)} onPaneClick={() => onSelectNode(null)}>
          <Background gap={24} />
          {minimapVisible && <MiniMap pannable zoomable className="architecture-graph-minimap" />}
        </ReactFlow>
        <span className="architecture-graph-overview__lod" aria-hidden="true">
          {detailLevel === 'far' ? 'Regions' : detailLevel === 'mid' ? 'Regions + clusters' : 'Regions · clusters · modules'}
        </span>
      </div>
      {view !== 'map' && <div className="architecture-graph-overview__outline-pane">{outline}</div>}
    </div>
    {view === 'map' && (
      <details className="obs-graph-alternative architecture-graph-alternative">
        <summary>Architecture outline</summary>
        <div className="obs-graph-alternative__content">{outline}</div>
      </details>
    )}
    <MapControls
      view={view}
      onViewChange={setView}
      relationFilter={relationFilter}
      onRelationFilterChange={setRelationFilter}
      minimapVisible={minimapVisible}
      onToggleMinimap={() => setMinimapVisible((current) => !current)}
    />
  </>;
}

export default function ArchitectureGraphOverview(props: { runId: string | null; selectedNode: ObservatoryNode | null; onSelectNode: (node: ObservatoryNode | null) => void; onEnterNode: (node: ObservatoryNode, selectOnly?: boolean) => void; onHoverNode: (node: ObservatoryNode) => void; requestedExpandId?: string | null; scopeGroupId?: string | null }) {
  const [data, setData] = useState<ArchitectureGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; void fetchApi<ArchitectureGraphResponse>('/architecture-graph').then((value) => { if (!cancelled) setData(value); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Architecture graph request failed'); }); return () => { cancelled = true; }; }, [props.runId]);
  const scoped = useMemo(() => data ? architectureGraphScope(data, props.scopeGroupId) : null, [data, props.scopeGroupId]);
  if (error || !scoped) return null;
  const summary = summarizeArchitectureGraph(scoped);
  // Inside an entered scope, its own internal relation counts describe the
  // real relations among the members on screen (live-audit defect 6).
  const scopeInternalTotal = props.scopeGroupId
    ? scoped.internal_relation_counts
        .filter((value) => value.group_id === props.scopeGroupId)
        .reduce((count, value) => count + value.member_relation_count, 0)
    : 0;
  const summaryLine = [
    `${summary.sourceModules} source module${summary.sourceModules === 1 ? '' : 's'}`,
    props.scopeGroupId ? null : `${summary.topLevelRegions} top-level region${summary.topLevelRegions === 1 ? '' : 's'}`,
    summary.sections > 0 ? `${summary.sections} section${summary.sections === 1 ? '' : 's'}` : null,
    summary.structuralClusters > 0 ? `${summary.structuralClusters} structural cluster${summary.structuralClusters === 1 ? '' : 's'}` : null,
    summary.ungroupedModules > 0 ? `${summary.ungroupedModules} ungrouped module${summary.ungroupedModules === 1 ? '' : 's'}` : null,
    scopeInternalTotal > 0 ? `${scopeInternalTotal} internal relation${scopeInternalTotal === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');
  return <main className="obs-canvas obs-canvas--react-flow architecture-graph-overview" aria-label="Architecture map"><ReactFlowProvider><GraphSurface {...props} data={scoped} /></ReactFlowProvider><div className="architecture-graph-overview__hint">{summaryLine}</div></main>;
}
