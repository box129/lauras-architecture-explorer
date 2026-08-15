import { useMemo } from 'react';
import { MousePointer2 } from 'lucide-react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useSyntaxTreeStore } from '../../store';
import { useApiGet } from '../../api/hooks';
import { buildQueryString } from '../../api/client';
import type {
  ViewProjection, LayeredViewProjection, ViewNode, ViewEdge, V2HierarchyResult,
} from '../../api/types';
import HierarchyV2View from './v2/HierarchyV2View';
import ViewToolbar from './ViewToolbar';
import ComponentNode from './ComponentNode';
import SubsystemNode from './SubsystemNode';
import FunctionNode from './FunctionNode';
import DependencyEdge from './DependencyEdge';
import ViolationEdge from './ViolationEdge';
import ImpactRipple from './ImpactRipple';
import Narrator from './Narrator';
import ContextMenu from './ContextMenu';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorBanner from '../shared/ErrorBanner';

const nodeTypes = {
  subsystem: SubsystemNode,
  component: ComponentNode,
  function: FunctionNode,
  method: FunctionNode,
  module: FunctionNode,
};

const edgeTypes = {
  dependency: DependencyEdge,
  violation: ViolationEdge,
};

function convertViewNodes(viewNodes: ViewNode[]): Node[] {
  return viewNodes.map((vn) => ({
    id: vn.id,
    type: vn.type === 'subsystem' ? 'subsystem' : (vn.type === 'function' || vn.type === 'method') ? 'function' : 'component',
    position: vn.position || { x: 0, y: 0 },
    data: {
      qn: vn.id,
      name: vn.label,
      domain: (vn.data?.domain as string) || '',
      memberCount: (vn.data?.member_count as number) || (vn.data?.component_count as number) || 0,
      cohesion: (vn.data?.cohesion as number) || 0,
      coupling: (vn.data?.coupling as number) || 0,
      layer: (vn.data?.layer as string) || '',
      degree: (vn.data?.degree as number) || 0,
      maxDegree: (vn.data?.max_degree as number) || 10,
      description: (vn.data?.description as string) || '',
      componentCount: (vn.data?.component_count as number) || 0,
      healthScore: (vn.data?.health_score as number) || 0,
      filePath: (vn.data?.file_path as string) || vn.data?.filePath as string || '',
      lineStart: (vn.data?.line_start as number) || 1,
      depth: (vn.data?.depth as number) || 0,
    },
  }));
}

function convertLayeredNodes(projection: LayeredViewProjection): Node[] {
  const nodes: Node[] = [];
  for (const layer of projection.layers) {
    const yBase = layer.position * 180;
    for (let i = 0; i < layer.nodes.length; i++) {
      const ln = layer.nodes[i];
      nodes.push({
        id: ln.id,
        type: 'component',
        position: { x: i * 240 + 40, y: yBase + 40 },
        data: {
          qn: ln.id,
          name: ln.label,
          domain: layer.name,
          memberCount: 0,
          cohesion: 0,
          coupling: 0,
          layer: layer.name,
          degree: 0,
          maxDegree: 1,
        },
      });
    }
  }
  return nodes;
}

function convertViewEdges(viewEdges: ViewEdge[]): Edge[] {
  return viewEdges.map((ve) => ({
    id: ve.id,
    source: ve.source,
    target: ve.target,
    type: ve.style?.stroke === '#E94560' || ve.data?.is_violation ? 'violation' : 'dependency',
    data: {
      ...ve.data,
      label: ve.label,
    },
    animated: ve.animated,
  }));
}

/** Build the URL for the active view type — only this one gets fetched. */
function buildViewUrl(viewType: string, scopeQN: string | null): string | null {
  switch (viewType) {
    case 'architecture':
      return `/views/architecture${buildQueryString({ level: 'subsystem' })}`;
    case 'layered':
      return '/views/layered';
    case 'dependency':
      return `/views/dependency${buildQueryString({ scope_qn: scopeQN, depth: 2 })}`;
    case 'call-flow':
      return scopeQN
        ? `/views/call-flow${buildQueryString({ start_qn: scopeQN, max_depth: 3 })}`
        : null;
    case 'data-flow':
      return '/views/data-flow';
    default:
      return '/views/architecture?level=subsystem';
  }
}

function ArchitectureCanvas() {
  const viewType = useSyntaxTreeStore((s) => s.viewType);
  const scopeQN = useSyntaxTreeStore((s) => s.scopeQN);

  // Fetch the view projection
  const url = viewType === 'hierarchy-v2' ? null : buildViewUrl(viewType, scopeQN);
  const { data, loading, error, refetch } = useApiGet<ViewProjection>(url);

  const viewIsEmpty = data && !loading && (
    (data.view_type === 'layered' && (data as LayeredViewProjection).layers?.length === 0) ||
    (data.view_type !== 'layered' && ((data as unknown as { nodes: unknown[] }).nodes?.length ?? 0) === 0)
  );

  const { nodes, edges } = useMemo(() => {
    if (data) {
      if (data.view_type === 'layered') {
        const lp = data as LayeredViewProjection;
        return {
          nodes: convertLayeredNodes(lp),
          edges: convertViewEdges(lp.edges),
        };
      }
      const vp = data as unknown as { nodes: ViewNode[]; edges: ViewEdge[] };
      return {
        nodes: convertViewNodes(vp.nodes || []),
        edges: convertViewEdges(vp.edges || []),
      };
    }
    return { nodes: [], edges: [] };
  }, [data]);

  // v2 hierarchy view goes through a different fetch + renderer.
  if (viewType === 'hierarchy-v2') {
    return <HierarchyV2Canvas />;
  }

  if (loading) return <LoadingSpinner className="flex-1" size={32} />;
  if (error) return <div className="flex-1 p-4"><ErrorBanner message={error} onRetry={refetch} /></div>;
  if (!url || viewIsEmpty) {
    const reason = !url
      ? 'Select a function or method from the graph or inspector before opening Call Flow.'
      : ((data as unknown as { empty_reason?: string })?.empty_reason || 'This projection has no nodes for the current analysis.');
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary px-6 text-center">
        <MousePointer2 size={34} className="opacity-40" />
        <div className="text-sm text-primary">No view data</div>
        <div className="text-xs max-w-md">{reason}</div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-bg"
    >
      <Background color="#1A1A2E" gap={20} />
      <Controls />
      <MiniMap
        nodeColor={(n) => {
          if (n.type === 'subsystem') return '#2A2A3E';
          return '#E94560';
        }}
        maskColor="rgba(15, 15, 26, 0.8)"
      />
      <ImpactRipple />
      <Narrator />
    </ReactFlow>
  );
}

function HierarchyV2Canvas() {
  const { data, loading, error, refetch } = useApiGet<V2HierarchyResult>('/architecture/v2/hierarchy');
  return <HierarchyV2View data={data ?? null} loading={loading} error={error} onRetry={refetch} />;
}

export default function ArchitectureView() {
  return (
    <div className="h-full flex flex-col">
      <ViewToolbar />
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <ArchitectureCanvas />
        </ReactFlowProvider>
        <ContextMenu />
      </div>
    </div>
  );
}
