import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Node as RFNode,
  type Edge as RFEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { layoutHierarchy } from '../../../lib/layout/elk';
import type { V2HierarchyResult } from '../../../api/types';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorBanner from '../../shared/ErrorBanner';

interface Props {
  data: V2HierarchyResult | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Hierarchical, layered, non-overlapping renderer for v2 architecture output.
 * Uses ELK.js for layout; falls back to a grid if ELK fails.
 */
export default function HierarchyV2View({ data, loading, error, onRetry }: Props) {
  const [laidOut, setLaidOut] = useState<{ nodes: RFNode[]; edges: RFEdge[]; fallback: boolean } | null>(null);
  const [layoutErr, setLayoutErr] = useState<string | null>(null);

  const hierarchy = data?.hierarchy ?? null;
  const edges = useMemo(() => data?.edges ?? [], [data]);
  const hints = data?.layout_hints;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const out = await layoutHierarchy(hierarchy, edges, hints);
        if (!cancelled) setLaidOut(out);
      } catch (e) {
        if (!cancelled) setLayoutErr(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [hierarchy, edges, hints]);

  if (loading) return <LoadingSpinner className="flex-1" size={32} />;
  if (error) return <div className="flex-1 p-4"><ErrorBanner message={error} onRetry={onRetry} /></div>;
  if (!hierarchy) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary px-6 text-center">
        <div className="text-sm text-primary">No v2 hierarchy yet</div>
        <div className="text-xs max-w-md">
          Run analysis with <code>?engine=v2</code> on the analyze endpoint to populate this view.
        </div>
      </div>
    );
  }
  if (!laidOut) return <LoadingSpinner className="flex-1" size={28} />;

  return (
    <div className="h-full flex flex-col" data-testid="hierarchy-v2-view">
      <div className="px-3 py-2 text-xs text-secondary border-b border-slate-800 flex gap-4">
        <span>Repo: <span className="text-primary">{data?.repo_label}</span></span>
        <span>Model: <span className="text-primary">{data?.model || 'default'}</span></span>
        <span>Confidence: <span className="text-primary">{((data?.confidence ?? 0) * 100).toFixed(0)}%</span></span>
        <span>Tokens: <span className="text-primary">{(data?.total_tokens_in ?? 0) + (data?.total_tokens_out ?? 0)}</span></span>
        <span>Tools: <span className="text-primary">{data?.total_tool_calls ?? 0}</span></span>
        {laidOut.fallback && (
          <span className="text-amber-400" title="ELK layout failed; using grid fallback">grid fallback</span>
        )}
        {layoutErr && <span className="text-red-400" title={layoutErr}>layout warn</span>}
      </div>
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <ReactFlow
            nodes={laidOut.nodes}
            edges={laidOut.edges}
            fitView
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            className="bg-bg"
          >
            <Background color="#1A1A2E" gap={20} />
            <Controls />
            <MiniMap maskColor="rgba(15,15,26,0.8)" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
