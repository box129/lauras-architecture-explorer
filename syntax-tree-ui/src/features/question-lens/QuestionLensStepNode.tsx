import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { AlertTriangle, BookOpen, Braces, Database, Globe2, Monitor, Search, Server, Unplug } from 'lucide-react';
import type { QuestionLensStepDTO } from '../architecture-map/apiTypes';
import StatusBadge from '../observatory/StatusBadge';
import { questionStepStatus } from './questionLensProof';

interface QuestionLensStepNodeData {
  step: QuestionLensStepDTO;
  isSelected: boolean;
}

const iconByType = {
  frontend_event: Monitor,
  api_call: Globe2,
  route_handler: Search,
  auth_guard: BookOpen,
  service_call: Server,
  repository_call: Database,
  model_operation: Braces,
  database_boundary: Database,
  external_boundary: Unplug,
  unresolved_call: AlertTriangle,
};

export default function QuestionLensStepNode({ data }: NodeProps) {
  const nodeData = data as unknown as QuestionLensStepNodeData;
  const { step, isSelected } = nodeData;
  const status = questionStepStatus(step);
  const Icon = iconByType[step.step_type as keyof typeof iconByType] ?? BookOpen;
  const file = step.file_path ? step.file_path.split('/').pop() : '';
  return (
    <article className={isSelected ? 'obs-question-step obs-question-step--selected' : `obs-question-step obs-question-step--${status}`}>
      <Handle type="target" position={Position.Left} className="obs-flow-handle" />
      <div className="obs-question-step__icon">
        <Icon size={18} strokeWidth={1.7} />
      </div>
      <div className="obs-question-step__body">
        <div className="obs-question-step__meta">
          <span>{step.step_type.replaceAll('_', ' ') || 'answer step'}</span>
          <StatusBadge status={status} />
        </div>
        <strong>{step.label}</strong>
        {file && <small>{file}:{step.start_line}-{step.end_line}</small>}
        {step.gap_reason && <em>{step.gap_reason.replaceAll('_', ' ')}</em>}
      </div>
      <Handle type="source" position={Position.Right} className="obs-flow-handle" />
    </article>
  );
}
