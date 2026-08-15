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
import type { CodeCompanionSelection, QuestionLensDTO, QuestionLensStepDTO } from '../architecture-map/apiTypes';
import { ArchitectureMapEmptyState, ArchitectureMapErrorState, ArchitectureMapSkeleton } from '../architecture-map/ArchitectureMapStates';
import QuestionLensStepNode from './QuestionLensStepNode';
import { questionLensProofSelection, questionStepProofSelection } from './questionLensProof';

interface QuestionLensCanvasProps {
  lens: QuestionLensDTO | null;
  question: string;
  selectedStepId: string | null;
  loading: boolean;
  error: string | null;
  onBackToArchitecture: () => void;
  onOpenProof: (selection: CodeCompanionSelection) => void;
  onSelectStep: (stepId: string | null) => void;
}

const nodeTypes = { questionStep: QuestionLensStepNode };

export default function QuestionLensCanvas({
  lens,
  question,
  selectedStepId,
  loading,
  error,
  onBackToArchitecture,
  onOpenProof,
  onSelectStep,
}: QuestionLensCanvasProps) {
  const steps = useMemo(() => lens?.steps ?? [], [lens?.steps]);
  const nodes = useMemo<RFNode[]>(() => {
    if (!steps.length) return [];
    return steps.map((step, index) => ({
      id: step.id,
      type: 'questionStep',
      position: positionForStep(step, index, steps.length),
      data: { step, isSelected: selectedStepId === step.id } as unknown as Record<string, unknown>,
      draggable: false,
    }));
  }, [selectedStepId, steps]);

  const edges = useMemo<RFEdge[]>(() => {
    if (!steps.length) return [];
    return steps.slice(0, -1).map((step, index) => {
      const next = steps[index + 1];
      const gap = Boolean(step.gap_reason || next.gap_reason);
      return {
        id: `${step.id}-${next.id}`,
        source: step.id,
        target: next.id,
        type: 'smoothstep',
        animated: gap,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: {
          strokeWidth: 1.25,
          stroke: gap ? '#A0522D' : '#9A9890',
        },
      };
    });
  }, [steps]);

  if (loading) return <ArchitectureMapSkeleton />;
  if (error) {
    return (
      <ArchitectureMapErrorState
        title="Question lens unavailable"
        message={error}
        actionLabel="Back to architecture"
        onRetry={onBackToArchitecture}
      />
    );
  }
  if (!lens) {
    return (
      <ArchitectureMapEmptyState
        title="No visual lens for this answer"
        message="The answer pane can still explain the result, but the backend did not return enough source-backed structure to redraw the canvas."
      />
    );
  }
  if (lens.type === 'unsupported' || lens.status === 'unsupported') {
    return (
      <main className="obs-question-canvas obs-question-canvas--unsupported">
        <section className="obs-question-header">
          <button type="button" onClick={onBackToArchitecture}>
            <ArrowLeft size={15} strokeWidth={1.8} />
            Back to architecture
          </button>
          <div>
            <span>Question Lens</span>
            <h1>{lens.title}</h1>
            <p>{lens.simple_explanation || lens.unsupported_reason}</p>
          </div>
        </section>
        <div className="obs-question-unsupported-card">
          <strong>No source-backed structure found</strong>
          <p>{lens.unsupported_reason || 'The backend did not find evidence for the requested claim.'}</p>
          {lens.searched_areas.length > 0 && <small>Searched: {lens.searched_areas.join(', ')}</small>}
        </div>
      </main>
    );
  }
  if (!lens.steps.length) {
    return (
      <main className="obs-question-canvas">
        <section className="obs-question-header">
          <button type="button" onClick={onBackToArchitecture}>
            <ArrowLeft size={15} strokeWidth={1.8} />
            Back to architecture
          </button>
          <div>
            <span>Question Lens</span>
            <h1>{lens.title}</h1>
            <p>{lens.simple_explanation || lens.description}</p>
          </div>
          {lens.evidence.length > 0 && (
            <button type="button" onClick={() => onOpenProof(questionLensProofSelection(lens))}>
              <Code2 size={15} strokeWidth={1.8} />
              View answer proof
            </button>
          )}
        </section>
        <div className="obs-question-answer-card">
          <strong>{question || lens.title}</strong>
          <p>{lens.simple_explanation || lens.description}</p>
          <span>{lens.evidence.length} evidence items</span>
        </div>
      </main>
    );
  }

  return (
    <main className="obs-question-canvas" aria-label={`${lens.title} question lens`}>
      <section className="obs-question-header">
        <button type="button" onClick={onBackToArchitecture}>
          <ArrowLeft size={15} strokeWidth={1.8} />
          Back to architecture
        </button>
        <div>
          <span>Question Lens</span>
          <h1>{lens.title}</h1>
          <p>{lens.simple_explanation || lens.description}</p>
        </div>
        <button type="button" onClick={() => onOpenProof(questionLensProofSelection(lens))}>
          <Code2 size={15} strokeWidth={1.8} />
          View answer proof
        </button>
      </section>
      <ReactFlowProvider>
        <ReactFlow
          key={lens.id}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.18, duration: 520 }}
          minZoom={0.28}
          maxZoom={1.45}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnScroll
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => onSelectStep(node.id)}
          onNodeDoubleClick={(_, node) => {
            const step = node.data.step as QuestionLensStepDTO;
            onOpenProof(questionStepProofSelection(lens, step));
          }}
          onPaneClick={() => onSelectStep(null)}
          className="obs-rf obs-question-rf"
        >
          <Background color="rgba(154, 152, 144, 0.18)" gap={28} />
        </ReactFlow>
      </ReactFlowProvider>
    </main>
  );
}

function positionForStep(step: QuestionLensStepDTO, index: number, total: number) {
  if (step.gap_reason || step.step_type === 'unresolved_call') {
    return { x: 92 + index * 152, y: 500 };
  }
  const baseline = total > 5 ? 292 : 318;
  const wave = index % 2 === 0 ? -48 : 48;
  return { x: 72 + index * 150, y: baseline + wave };
}
