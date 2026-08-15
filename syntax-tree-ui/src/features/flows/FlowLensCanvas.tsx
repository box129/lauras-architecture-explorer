import { useMemo } from 'react';
import {
  Background,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge as RFEdge,
  type Node as RFNode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Code2 } from 'lucide-react';
import type { CodeCompanionSelection, FlowDetailDTO, FlowStepDTO } from '../architecture-map/apiTypes';
import { ArchitectureMapEmptyState, ArchitectureMapErrorState, ArchitectureMapSkeleton } from '../architecture-map/ArchitectureMapStates';
import FlowStepNode from './FlowStepNode';
import { stepProofSelection } from './flowProof';

interface FlowLensCanvasProps {
  flowDetail: FlowDetailDTO | null;
  selectedStepId: string | null;
  loading: boolean;
  error: string | null;
  hasFlows: boolean;
  onBackToArchitecture: () => void;
  onSelectStep: (stepId: string | null) => void;
  onOpenProof: (selection: CodeCompanionSelection) => void;
}

const nodeTypes = { flowStep: FlowStepNode };

const laneMeta = [
  { id: 'frontend', label: 'Frontend', y: 118 },
  { id: 'api', label: 'API Client', y: 202 },
  { id: 'backend', label: 'Backend Entry', y: 286 },
  { id: 'domain', label: 'Service / Domain', y: 370 },
  { id: 'boundary', label: 'Data / External Boundary', y: 454 },
  { id: 'gaps', label: 'Gaps', y: 538 },
];

export default function FlowLensCanvas({
  flowDetail,
  selectedStepId,
  loading,
  error,
  hasFlows,
  onBackToArchitecture,
  onSelectStep,
  onOpenProof,
}: FlowLensCanvasProps) {
  const nodes = useMemo<RFNode[]>(() => (
    (flowDetail?.steps ?? []).map((step, index) => ({
      id: step.id,
      type: 'flowStep',
      position: { x: 96 + index * 260, y: laneY(step, index) },
      data: { step, isSelected: selectedStepId === step.id } as unknown as Record<string, unknown>,
      draggable: false,
    }))
  ), [flowDetail?.steps, selectedStepId]);

  const edges = useMemo<RFEdge[]>(() => (
    (flowDetail?.steps ?? []).slice(0, -1).map((step, index) => {
      const next = flowDetail?.steps[index + 1];
      return {
        id: `${step.id}-${next?.id}`,
        source: step.id,
        target: next?.id ?? step.id,
        type: 'smoothstep',
        animated: Boolean(next?.gap_reason || step.gap_reason),
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: {
          strokeWidth: 1.2,
          stroke: next?.gap_reason || step.gap_reason ? '#A0522D' : '#9A9890',
        },
      };
    })
  ), [flowDetail?.steps]);

  if (loading) return <ArchitectureMapSkeleton />;

  if (error) {
    return (
      <ArchitectureMapErrorState
        title="Flow lens unavailable"
        message={error}
        actionLabel="Back to architecture"
        onRetry={onBackToArchitecture}
      />
    );
  }

  if (!hasFlows) {
    return (
      <ArchitectureMapEmptyState
        title="No source-backed flows yet"
        message="The backend did not return useful flows for this run. The UI will not invent movement paths without route, API, or source-span evidence."
      />
    );
  }

  if (!flowDetail) {
    return (
      <ArchitectureMapEmptyState
        title="Choose a flow"
        message="Select a related flow from the architecture rail to inspect how work moves through the system."
      />
    );
  }

  return (
    <main className="obs-flow-canvas" aria-label={`${flowDetail.flow.name} flow lens`}>
      <section className="obs-flow-header">
        <button type="button" onClick={onBackToArchitecture}>
          <ArrowLeft size={15} strokeWidth={1.8} />
          Back to architecture
        </button>
        <div>
          <span>{flowDetail.flow.user_action_label || flowDetail.flow.trigger_summary || 'Flow lens'}</span>
          <h1>{flowDetail.flow.name}</h1>
          <p>{flowDetail.flow.simple_explanation || flowDetail.flow.trigger_summary}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenProof({
            subject_type: 'flow',
            subject_id: flowDetail.flow.id,
            title: flowDetail.flow.name,
            open: true,
          })}
        >
          <Code2 size={15} strokeWidth={1.8} />
          View full flow proof
        </button>
      </section>
      <ReactFlowProvider>
        <ReactFlow
          key={flowDetail.flow.id}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, duration: 520 }}
          minZoom={0.28}
          maxZoom={1.45}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnScroll
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => onSelectStep(node.id)}
          onNodeDoubleClick={(_, node) => {
            const step = node.data.step as FlowStepDTO;
            onOpenProof(stepProofSelection(flowDetail, step));
          }}
          onPaneClick={() => onSelectStep(null)}
          className="obs-rf obs-flow-rf"
        >
          <Background color="rgba(154, 152, 144, 0.18)" gap={28} />
          <div className="obs-flow-lanes" aria-hidden="true">
            {laneMeta.map((lane) => (
              <div className="obs-flow-lane" key={lane.id} style={{ top: lane.y }}>
                <span>{lane.label}</span>
              </div>
            ))}
          </div>
        </ReactFlow>
      </ReactFlowProvider>
    </main>
  );
}

function laneY(step: FlowStepDTO, index: number) {
  if (step.gap_reason || step.step_type === 'unresolved_call') return 538;
  const sameLaneOffset = index % 2 === 0 ? -12 : 12;
  switch (step.step_type) {
    case 'frontend_event':
      return 118;
    case 'api_call':
      return 202;
    case 'route_handler':
    case 'middleware':
    case 'auth_guard':
      return 286;
    case 'service_call':
    case 'model_operation':
      return 370 + sameLaneOffset;
    case 'repository_call':
    case 'database_boundary':
    case 'external_boundary':
      return 454 + sameLaneOffset;
    default:
      return 400;
  }
}
