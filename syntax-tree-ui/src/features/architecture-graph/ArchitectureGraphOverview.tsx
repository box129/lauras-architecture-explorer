import { useEffect, useMemo, useState } from 'react';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, type Edge, type Node, useViewport } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fetchApi } from '../../api/client';
import type { ObservatoryNode } from '../observatory/types';
import SemanticEdge from '../architecture-map/SemanticEdge';
import ArchitectureRegionNode from './ArchitectureRegionNode';
import { layoutArchitectureGraphProof } from './elkCompoundProof';
import { adaptArchitectureGraph, visibleGraphEdges, visibleGroupIds } from './graphAdapter';
import type { ArchitectureGraphResponse } from './graphTypes';

const nodeTypes = { architectureRegion: ArchitectureRegionNode };
const edgeTypes = { semantic: SemanticEdge };

function GraphSurface({ data, selectedNode, onSelectNode, onEnterNode, onHoverNode }: { data: ArchitectureGraphResponse; selectedNode: ObservatoryNode | null; onSelectNode: (node: ObservatoryNode | null) => void; onEnterNode: (node: ObservatoryNode, selectOnly?: boolean) => void; onHoverNode: (node: ObservatoryNode) => void }) {
  const { nodes: sourceNodes, edges: sourceEdges, internalCounts } = useMemo(() => adaptArchitectureGraph(data), [data]);
  const [layout, setLayout] = useState<{ nodes: Node[]; routed: string[] }>({ nodes: [], routed: [] });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { zoom } = useViewport();
  const selectedNodeId = selectedNode?.id;
  const visibleIds = useMemo(() => visibleGroupIds(sourceNodes, expandedIds, zoom), [expandedIds, sourceNodes, zoom]);
  const detailLevel = zoom < 0.68 ? 'far' : zoom < 0.95 ? 'mid' : 'near';
  useEffect(() => { let cancelled = false; const groups = data.groups.filter((group) => visibleIds.has(group.id)); void layoutArchitectureGraphProof(groups, data.aggregate_edges.filter((edge) => visibleIds.has(edge.source_group_id) && visibleIds.has(edge.target_group_id))).then((result) => { if (!cancelled) setLayout({ routed: result.routedEdgeIds, nodes: result.nodes.map((item) => { const source = sourceNodes.find((node) => node.id === item.id)!; const isContainer = sourceNodes.some((node) => node.parentGroupId === item.id); const connected = !selectedNodeId || source.id === selectedNodeId || sourceEdges.some((edge) => (edge.source === selectedNodeId && edge.target === source.id) || (edge.target === selectedNodeId && edge.source === source.id)); return { id: item.id, type: 'architectureRegion', position: item.position, parentId: item.parentId, extent: item.parentId ? 'parent' : undefined, className: selectedNodeId && !connected ? 'architecture-graph-node--dimmed' : undefined, style: { width: item.width, height: item.height }, data: { ...source, isContainer, isExpanded: false, internalRelationCount: internalCounts.get(item.id) ?? 0, isSelected: selectedNodeId === item.id, detailLevel, expandHint: isContainer ? 'Shift+click to expand or collapse. Double-click to enter.' : undefined }, draggable: false }; }) }); }); return () => { cancelled = true; }; }, [data, detailLevel, expandedIds, internalCounts, selectedNodeId, sourceEdges, sourceNodes, visibleIds]);
  const visibleEdges = visibleGraphEdges(sourceEdges, zoom).filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const edges: Edge[] = visibleEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, type: 'semantic', label: edge.label, markerEnd: { type: 'arrowclosed' }, className: `architecture-graph-edge architecture-graph-edge--${edge.kind}${selectedNode && edge.source !== selectedNode.id && edge.target !== selectedNode.id ? ' architecture-graph-edge--dimmed' : ''}`, data: { ...edge, edgeLabel: edge.label, visualKind: edge.kind === 'inherits' ? 'boundary' : 'dependency', edgeClass: `architecture-graph-edge architecture-graph-edge--${edge.kind}${selectedNode && edge.source !== selectedNode.id && edge.target !== selectedNode.id ? ' architecture-graph-edge--dimmed' : ''}`, routed: layout.routed.includes(edge.id) } }));
  return <ReactFlow nodes={layout.nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView minZoom={0.35} maxZoom={1.8} onNodeClick={(event, node) => { const value = node.data as unknown as ObservatoryNode; if (event.shiftKey && sourceNodes.some((candidate) => candidate.parentGroupId === value.id)) setExpandedIds((current) => { const next = new Set(current); if (next.has(value.id)) next.delete(value.id); else next.add(value.id); return next; }); else onSelectNode(value); }} onNodeDoubleClick={(_, node) => onEnterNode(node.data as unknown as ObservatoryNode)} onNodeMouseEnter={(_, node) => onHoverNode(node.data as unknown as ObservatoryNode)} onPaneClick={() => onSelectNode(null)}><Background gap={24} /><Controls showInteractive={false} /><MiniMap pannable zoomable /></ReactFlow>;
}

export default function ArchitectureGraphOverview(props: { runId: string | null; selectedNode: ObservatoryNode | null; onSelectNode: (node: ObservatoryNode | null) => void; onEnterNode: (node: ObservatoryNode, selectOnly?: boolean) => void; onHoverNode: (node: ObservatoryNode) => void }) {
  const [data, setData] = useState<ArchitectureGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; void fetchApi<ArchitectureGraphResponse>('/architecture-graph').then((value) => { if (!cancelled) setData(value); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Architecture graph request failed'); }); return () => { cancelled = true; }; }, [props.runId]);
  if (error || !data) return null;
  return <main className="obs-canvas obs-canvas--react-flow architecture-graph-overview" aria-label="Architecture-first graph"><ReactFlowProvider><GraphSurface {...props} data={data} /></ReactFlowProvider><div className="architecture-graph-overview__hint">Resolved structural relations · zoom out for strongest flows · select a region to focus its connections</div></main>;
}
