import type { AnalysisReadinessStage, AnalysisStageStatus } from '../../api/types';

export function readinessStagesFromPayload(raw: Record<string, unknown>): AnalysisReadinessStage[] {
  const progress = (raw.progress && typeof raw.progress === 'object'
    ? raw.progress
    : raw) as Record<string, unknown>;
  const stages = progress.readiness_stages;
  if (!Array.isArray(stages)) return [];
  return stages.filter((stage): stage is AnalysisReadinessStage => (
    stage &&
    typeof stage === 'object' &&
    typeof (stage as AnalysisReadinessStage).stage_name === 'string' &&
    typeof (stage as AnalysisReadinessStage).status === 'string'
  ));
}

export function readinessStatusLabel(status: AnalysisStageStatus) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Pending';
  }
}

export function readinessStageName(stage: AnalysisReadinessStage) {
  return stage.display_name || stage.stage_name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function readinessStatusClass(status: AnalysisStageStatus) {
  switch (status) {
    case 'ready':
      return 'text-success';
    case 'running':
      return 'text-accent';
    case 'failed':
      return 'text-warning';
    case 'skipped':
      return 'text-secondary';
    default:
      return 'text-secondary/60';
  }
}
