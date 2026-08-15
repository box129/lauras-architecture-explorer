import { evidenceStatusMeta, type EvidenceStatus } from '../../design/status';
import type { CodeCompanionSelection, QuestionLensDTO, QuestionLensStepDTO } from '../architecture-map/apiTypes';

export function questionStepStatus(step: QuestionLensStepDTO): EvidenceStatus {
  if (step.gap_reason) return 'insufficient';
  const raw = step.status as EvidenceStatus;
  return raw && raw in evidenceStatusMeta ? raw : 'candidate';
}

export function questionLensProofSelection(lens: QuestionLensDTO): CodeCompanionSelection {
  return {
    subject_type: 'question_lens',
    subject_id: lens.id,
    title: lens.title,
    open: true,
  };
}

export function questionStepProofSelection(lens: QuestionLensDTO, step: QuestionLensStepDTO): CodeCompanionSelection {
  return {
    subject_type: 'question_lens',
    subject_id: lens.id,
    title: `${lens.title}: ${step.label}`,
    file_path: step.file_path,
    span_id: step.source_span_id,
    start_line: step.start_line,
    reason: step.gap_reason || step.label,
    open: true,
  };
}
