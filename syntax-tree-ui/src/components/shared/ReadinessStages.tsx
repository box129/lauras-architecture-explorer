import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import type { AnalysisReadinessStage, AnalysisStageStatus } from '../../api/types';
import { readinessStageName, readinessStatusClass, readinessStatusLabel } from './readinessStageUtils';

function StageIcon({ status }: { status: AnalysisStageStatus }) {
  if (status === 'ready') return <CheckCircle2 size={14} className="text-success shrink-0" />;
  if (status === 'running') return <Loader2 size={14} className="text-accent shrink-0 animate-spin" />;
  if (status === 'failed') return <XCircle size={14} className="text-warning shrink-0" />;
  if (status === 'skipped') return <AlertTriangle size={14} className="text-secondary shrink-0" />;
  return <Circle size={14} className="text-secondary/40 shrink-0" />;
}

export function ReadinessStageList({
  stages,
  compact = false,
}: {
  stages: AnalysisReadinessStage[];
  compact?: boolean;
}) {
  if (!stages.length) {
    return (
      <div className="flex items-center gap-2 text-xs text-secondary">
        <Loader2 size={14} className="text-accent shrink-0 animate-spin" />
        <span>Waiting for durable stage state.</span>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'grid grid-cols-1 md:grid-cols-2 gap-2'}>
      {stages.map((stage) => (
        <div
          key={stage.id || stage.stage_name}
          className={`border border-border rounded-lg ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'} min-w-0`}
          title={stage.blocking_error || stage.warnings.join('\n') || undefined}
        >
          <div className="flex items-center gap-2 min-w-0">
            <StageIcon status={stage.status} />
            <span className="text-primary truncate">{readinessStageName(stage)}</span>
            <span className={`ml-auto text-[10px] shrink-0 ${readinessStatusClass(stage.status)}`}>
              {readinessStatusLabel(stage.status)}
            </span>
          </div>
          {!compact && (
            <div className="mt-1 flex items-center gap-2 text-[10px] text-secondary min-w-0">
              {stage.can_render_frontend && stage.status === 'ready' && (
                <span className="px-1.5 py-0.5 rounded bg-success/15 text-success shrink-0">frontend ready</span>
              )}
              {stage.blocking_error ? (
                <span className="truncate text-warning">{stage.blocking_error}</span>
              ) : stage.warnings.length ? (
                <span className="truncate">{stage.warnings[0]}</span>
              ) : (
                <span className="truncate">{Object.keys(stage.artifact_refs).length} artifact refs</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
