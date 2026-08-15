import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import {
  AlertTriangle,
  Braces,
  Database,
  Globe2,
  KeyRound,
  Monitor,
  Route,
  Server,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import StatusBadge from '../observatory/StatusBadge';
import type { FlowStepDTO } from '../architecture-map/apiTypes';
import { stepStatus } from './flowProof';

interface FlowStepNodeData {
  step: FlowStepDTO;
  isSelected: boolean;
}

const iconByType = {
  frontend_event: Monitor,
  api_call: Globe2,
  route_handler: Route,
  middleware: ShieldCheck,
  auth_guard: KeyRound,
  service_call: Server,
  repository_call: Database,
  model_operation: Braces,
  database_boundary: Database,
  external_boundary: Unplug,
  unresolved_call: AlertTriangle,
};

export default function FlowStepNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowStepNodeData;
  const { step, isSelected } = nodeData;
  const status = stepStatus(step);
  const Icon = iconByType[step.step_type as keyof typeof iconByType] ?? Server;
  const file = step.source_span.file_path.split('/').pop() || step.source_span.file_path;
  return (
    <article className={isSelected ? 'obs-flow-step obs-flow-step--selected' : `obs-flow-step obs-flow-step--${status}`}>
      <Handle type="target" position={Position.Left} className="obs-flow-handle" />
      <div className="obs-flow-step__icon">
        <Icon size={18} strokeWidth={1.7} />
      </div>
      <div className="obs-flow-step__body">
        <div className="obs-flow-step__meta">
          <span>{step.step_type.replaceAll('_', ' ')}</span>
          <StatusBadge status={status} />
        </div>
        <strong>{step.description || step.step_type.replaceAll('_', ' ')}</strong>
        <small>{file}:{step.source_span.start_line}-{step.source_span.end_line}</small>
        {step.gap_reason && (
          <em>{step.gap_reason.replaceAll('_', ' ')}</em>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="obs-flow-handle" />
    </article>
  );
}
