import { evidenceStatusMeta, type EvidenceStatus } from '../../design/status';
import type { CodeCompanionSelection, FlowDetailDTO, FlowStepDTO } from '../architecture-map/apiTypes';

export function stepStatus(step: FlowStepDTO): EvidenceStatus {
  if (step.gap_reason || step.step_type === 'unresolved_call') return 'insufficient';
  if (step.source_span.is_stale) return 'stale';
  const raw = step.source_span.status as EvidenceStatus;
  return raw && raw in evidenceStatusMeta ? raw : 'verified';
}

export function stepProofSelection(flowDetail: FlowDetailDTO, step: FlowStepDTO): CodeCompanionSelection {
  return {
    subject_type: 'flow_step',
    subject_id: step.id,
    title: `${flowDetail.flow.name}: ${step.description || step.step_type}`,
    file_path: step.source_span.file_path,
    span_id: step.source_span.id,
    start_line: step.source_span.start_line,
    reason: step.gap_reason || step.description,
    open: true,
  };
}
