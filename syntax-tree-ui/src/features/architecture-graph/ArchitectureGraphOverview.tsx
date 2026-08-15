import { useEffect, useMemo, useState } from 'react';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, type Edge, type Node, useViewport } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fetchApi } from '../../api/client';
import type { ObservatoryNode } from '../observatory/types';
import SemanticEdge from '../architecture-map/SemanticEdge';
import ArchitectureRegionNode from './ArchitectureRegionNode';
import { layoutArchitectureGraphProof } from './elkCompoundProof';
import { adaptArchitectureGraph, architectureGraphScope, visibleGraphEdges, visibleGroupIds } from './graphAdapter';
import type { ArchitectureGraphResponse } from './graphTypes';

const nodeTypes = { architectureRegion: ArchitectureRegionNode };
const edgeTypes = { semantic: SemanticEdge };

function GraphSurface({ data, selectedNode, onSelectNode, onEnterNode, onHoverNode, requestedExpandId }: { data: ArchitectureGraphResponse; selectedNode: ObservatoryNode | null; onSelectNode: (node: ObservatoryNode | null) => void; onEnterNode: (node: ObservatoryNode, selectOnly?: boolean) => void; onHoverNode: (node: ObservatoryNode) => void; requestedExpandId?: string | null }) {
  const { nodes: sourceNodes, edges: sourceEdges, internalCounts } = useMemo(() => adaptArchitectureGraph(data), [data]);
  const [layout, setLayout] = useState<{ nodes: Node[]; routed: string[] }>({ nodes: [], routed: [] });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { zoom } = useViewport();
  const selectedNodeId = selectedNode?.id;
  const toggleExpanded = (id: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const visibleIds = useMemo(() => visibleGroupIds(sourceNodes, expandedIds), [expandedIds, sourceNodes]);
  const detailLevel = zoom < 0.68 ? 'far' : zoom < 0.95 ? 'mid' : 'near';
  useEffect(() => {
    if (!requestedExpandId) return undefined;
    const task = window.setTimeout(() => setExpandedIds((current) => current.has(requestedExpandId) ? current : new Set([...current, requestedExpandId])), 0);
    return () => window.clearTimeout(task);
  }, [requestedExpandId]);
  useEffect(() => { let cancelled = false; const groups = data.groups.filter((group) => visibleIds.has(group.id)); void layoutArchitectureGraphProof(groups, data.aggregate_edges.filter((edge) => visibleIds.has(edge.source_group_id) && visibleIds.has(edge.target_group_id))).then((result) => { if (!cancelled) setLayout({ routed: result.routedEdgeIds, nodes: result.nodes.map((item) => { const source = sourceNodes.find((node) => node.id === item.id)!; const isContainer = sourceNodes.some((node) => node.parentGroupId === item.id); const connected = !selectedNodeId || source.id === selectedNodeId || sourceEdges.some((edge) => (edge.source === selectedNodeId && edge.target === source.id) || (edge.target === selectedNodeId && edge.source === source.id)); return { id: item.id, type: 'architectureRegion', position: item.position, parentId: item.parentId, extent: item.parentId ? 'parent' : undefined, className: selectedNodeId && !connected ? 'architecture-graph-node--dimmed' : undefined, style: { width: item.width, height: item.height }, data: { ...source, isContainer, isExpanded: expandedIds.has(item.id), internalRelationCount: internalCounts.get(item.id) ?? 0, isSelected: selectedNodeId === item.id, detailLevel, onExpand: toggleExpanded, onEnter: onEnterNode }, draggable: false }; }) }); }); return () => { cancelled = true; }; }, [data, detailLevel, expandedIds, internalCounts, onEnterNode, selectedNodeId, sourceEdges, sourceNodes, visibleIds]);
  const visibleEdges = visibleGraphEdges(sourceEdges, zoom).filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const edges: Edge[] = visibleEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, type: 'semantic', label: edge.label, markerEnd: { type: 'arrowclosed' }, className: `architecture-graph-edge architecture-graph-edge--${edge.kind}${selectedNode && edge.source !== selectedNode.id && edge.target !== selectedNode.id ? ' architecture-graph-edge--dimmed' : ''}`, data: { ...edge, edgeLabel: edge.label, visualKind: edge.kind === 'inherits' ? 'boundary' : 'dependency', edgeClass: `architecture-graph-edge architecture-graph-edge--${edge.kind}${selectedNode && edge.source !== selectedNode.id && edge.target !== selectedNode.id ? ' architecture-graph-edge--dimmed' : ''}`, routed: layout.routed.includes(edge.id) } }));
  const visibleNodes = sourceNodes.filter((node) => visibleIds.has(node.id));
  const labelFor = (id: string) => sourceNodes.find((node) => node.id === id)?.label ?? id;
  return <>
    <ReactFlow nodes={layout.nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.16, duration: 0 }} minZoom={0.4} maxZoom={1.8} onNodeClick={(event, node) => { const value = node.data as unknown as ObservatoryNode; if (event.shiftKey && sourceNodes.some((candidate) => candidate.parentGroupId === value.id)) toggleExpanded(value.id); else onSelectNode(value); }} onNodeMouseEnter={(_, node) => onHoverNode(node.data as unknown as ObservatoryNode)} onPaneClick={() => onSelectNode(null)}><Background gap={24} /><Controls showInteractive={false} /><MiniMap pannable zoomable /></ReactFlow>
    <details className="obs-graph-alternative architecture-graph-alternative"><summary>View architecture graph as accessible tables</summary><div className="obs-graph-alternative__content">
      <table><caption>Visible structural regions</caption><thead><tr><th scope="col">Region</th><th scope="col">Containment</th><th scope="col">Modules</th><th scope="col">Selected</th><th scope="col">Actions</th></tr></thead><tbody>{visibleNodes.map((node) => { const isContainer = sourceNodes.some((candidate) => candidate.parentGroupId === node.id); return <tr key={node.id}><th scope="row"><button type="button" className="obs-table-row-button" onClick={() => onSelectNode(node)}>{node.label}</button></th><td>{node.parentGroupId ? labelFor(node.parentGroupId) : 'Top level'}</td><td>{node.childrenCount}</td><td>{selectedNodeId === node.id ? 'Selected' : 'Not selected'}</td><td>{isContainer && <button type="button" onClick={() => toggleExpanded(node.id)}>{expandedIds.has(node.id) ? 'Collapse' : 'Expand'}</button>} {node.canDrilldown && <button type="button" onClick={() => onEnterNode(node)}>Enter</button>}</td></tr>; })}</tbody></table>
      <table><caption>Visible aggregate relations</caption><thead><tr><th scope="col">Direction</th><th scope="col">Relation kind</th><th scope="col">Relation count</th></tr></thead><tbody>{visibleEdges.map((edge) => <tr key={edge.id}><td>{labelFor(edge.source)} to {labelFor(edge.target)}</td><td>{edge.kind}</td><td>{Number((edge.sourceRefs?.member_relation_count as number[] | undefined)?.[0] ?? 0)}</td></tr>)}</tbody></table>
    </div></details>
  </>;
}

export default function ArchitectureGraphOverview(props: { runId: string | null; selectedNode: ObservatoryNode | null; onSelectNode: (node: ObservatoryNode | null) => void; onEnterNode: (node: ObservatoryNode, selectOnly?: boolean) => void; onHoverNode: (node: ObservatoryNode) => void; requestedExpandId?: string | null; scopeGroupId?: string | null }) {
  const [data, setData] = useState<ArchitectureGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; void fetchApi<ArchitectureGraphResponse>('/architecture-graph').then((value) => { if (!cancelled) setData(value); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Architecture graph request failed'); }); return () => { cancelled = true; }; }, [props.runId]);
  const scoped = useMemo(() => data ? architectureGraphScope(data, props.scopeGroupId) : null, [data, props.scopeGroupId]);
  if (error || !scoped) return null;
  const topLevelModules = scoped.groups.filter((group) => !group.parent_group_id).reduce((count, group) => count + group.recursive_module_count, 0);
  const allModules = Math.max(0, ...scoped.groups.map((group) => group.recursive_module_count));
  return <main className="obs-canvas obs-canvas--react-flow architecture-graph-overview" aria-label="Architecture-first graph"><ReactFlowProvider><GraphSurface {...props} data={scoped} /></ReactFlowProvider><div className="architecture-graph-overview__hint">{props.scopeGroupId ? 'Entered structural scope' : `${topLevelModules} modules across visible top-level regions${allModules > topLevelModules ? '; nested modules remain available through Expand' : ''}`} · resolved structural relations only</div></main>;
}
