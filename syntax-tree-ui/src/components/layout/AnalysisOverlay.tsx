import { useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useSyntaxTreeStore } from '../../store';
import type { RunMetadata } from '../../api/types';
import { buildWebSocketUrl } from '../../api/websocket';
import { ReadinessStageList } from '../shared/ReadinessStages';
import { readinessStagesFromPayload } from '../shared/readinessStageUtils';

function formatStageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveStages(
  completed: string[],
  current: string,
  remaining: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...completed, current, ...remaining]) {
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

export default function AnalysisOverlay() {
  const analysisJobId = useSyntaxTreeStore((s) => s.analysisJobId);
  const analysisProgress = useSyntaxTreeStore((s) => s.analysisProgress);
  const analysisStatus = useSyntaxTreeStore((s) => s.analysisStatus);
  const analysisError = useSyntaxTreeStore((s) => s.analysisError);
  const analysisRunMetadata = useSyntaxTreeStore((s) => s.analysisRunMetadata);
  const setAnalysisStatus = useSyntaxTreeStore((s) => s.setAnalysisStatus);
  const setAnalysisProgress = useSyntaxTreeStore((s) => s.setAnalysisProgress);
  const setAnalysisError = useSyntaxTreeStore((s) => s.setAnalysisError);
  const setAnalysisRunMetadata = useSyntaxTreeStore((s) => s.setAnalysisRunMetadata);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!analysisJobId || analysisStatus !== 'running') return;

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const captureRunMetadata = (raw: Record<string, unknown>) => {
      const top = raw.run_metadata as RunMetadata | undefined;
      const nested = (raw.metadata as Record<string, unknown> | undefined)?.run_metadata as
        | RunMetadata
        | undefined;
      const meta = top ?? nested;
      if (meta && typeof meta === 'object') {
        setAnalysisRunMetadata(meta);
      }
    };

    const applyProgress = (raw: Record<string, unknown>) => {
      const progress = (raw.progress && typeof raw.progress === 'object'
        ? raw.progress
        : raw) as Record<string, unknown>;

      const elapsedTop = Number(raw.elapsed_seconds || 0);
      const elapsedNested = Number(progress.elapsed_seconds || 0);

      const readinessStages = readinessStagesFromPayload(raw);
      setAnalysisProgress({
        stage: String(progress.stage || progress.current_stage || raw.stage || ''),
        filesTotal: Number(progress.total_files || progress.files_total || 0),
        filesParsed: Number(progress.files_parsed || 0),
        stagesCompleted: Array.isArray(progress.stages_completed)
          ? (progress.stages_completed as string[])
          : [],
        stagesRemaining: Array.isArray(progress.stages_remaining)
          ? (progress.stages_remaining as string[])
          : [],
        elapsedSeconds: elapsedTop || elapsedNested,
        currentFile: typeof progress.current_file === 'string' ? progress.current_file : undefined,
        readinessStages,
        canRenderFrontend: Boolean(progress.can_render_frontend),
      });

      captureRunMetadata(raw);
    };

    const applyTerminalStatus = (raw: Record<string, unknown>) => {
      const progress = (raw.progress && typeof raw.progress === 'object'
        ? raw.progress
        : {}) as Record<string, unknown>;
      captureRunMetadata(raw);
      if (raw.status === 'completed') {
        setAnalysisStatus('completed');
      } else if (raw.status === 'failed') {
        setAnalysisError(String(progress.error || raw.error || 'Analysis failed'));
        setAnalysisStatus('failed');
      }
    };

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/analyze/${analysisJobId}/status`);
        const data = await res.json();
        if (data.status === 'completed' || data.status === 'failed') {
          applyTerminalStatus(data);
          if (pollInterval) clearInterval(pollInterval);
          pollInterval = null;
        } else {
          applyProgress(data);
        }
      } catch { /* ignore polling errors */ }
    };

    const startPolling = () => {
      if (!pollInterval) {
        pollInterval = setInterval(pollStatus, 2000);
      }
    };

    const ws = new WebSocket(buildWebSocketUrl(`/api/ws/analyze/${analysisJobId}`));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'status_update' || msg.event === 'progress') {
          applyProgress(msg.data || {});
        } else if (msg.event === 'pipeline_complete') {
          applyTerminalStatus(msg.data || { status: 'completed' });
        } else if (msg.event === 'error') {
          const data = (msg.data || {}) as Record<string, unknown>;
          const progress = (data.progress as Record<string, unknown> | undefined) || {};
          captureRunMetadata(data);
          setAnalysisError(
            String(progress.error || data.message || data.error || 'Analysis failed'),
          );
          setAnalysisStatus('failed');
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => {
      // WebSocket not available — fall back to polling
      startPolling();
    };

    ws.onclose = () => {
      // If still "running" when WebSocket closes, check final status
      if (useSyntaxTreeStore.getState().analysisStatus === 'running') {
        void pollStatus();
        startPolling();
      }
    };

    return () => {
      ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [analysisJobId, analysisStatus, setAnalysisStatus, setAnalysisProgress, setAnalysisError, setAnalysisRunMetadata]);

  const currentStage = analysisProgress?.stage || '';
  const completedStages = analysisProgress?.stagesCompleted || [];
  const remainingStages = analysisProgress?.stagesRemaining || [];
  const readinessStages = analysisProgress?.readinessStages ?? [];
  const stages = readinessStages.length ? [] : deriveStages(completedStages, currentStage, remainingStages);

  return (
    <div className="fixed inset-0 z-40 bg-bg/95 flex items-center justify-center">
      <div className="w-[560px] bg-surface border border-border rounded-xl p-8">
        <div className="text-center mb-6">
          {analysisStatus === 'failed' ? (
            <XCircle size={40} className="text-accent mx-auto mb-3" />
          ) : (
            <Loader2 size={40} className="text-accent mx-auto mb-3 animate-spin" />
          )}
          <h2 className="text-lg font-semibold text-primary">
            {analysisStatus === 'failed' ? 'Analysis Failed' : 'Analyzing Repository'}
          </h2>
          {analysisError && (
            <p className="text-sm text-accent mt-2 wrap-break-word">{analysisError}</p>
          )}
        </div>

        {/* Progress bar */}
        {analysisProgress && analysisProgress.filesTotal > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-secondary mb-1">
              <span>Files parsed</span>
              <span>{analysisProgress.filesParsed} / {analysisProgress.filesTotal}</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{
                  width: `${(analysisProgress.filesParsed / analysisProgress.filesTotal) * 100}%`,
                }}
              />
            </div>
            {analysisProgress.currentFile && (
              <div className="text-[10px] text-secondary/60 mt-1 truncate font-mono">
                {analysisProgress.currentFile}
              </div>
            )}
          </div>
        )}

        {/* Stage checklist */}
        <div className="space-y-2">
          {readinessStages.length === 0 && stages.length === 0 && (
            <div className="flex items-center gap-2.5 text-sm">
              <Loader2 size={14} className="text-accent shrink-0 animate-spin" />
              <span className="text-primary">Initializing…</span>
            </div>
          )}
          {readinessStages.length > 0 && <ReadinessStageList stages={readinessStages} compact />}
          {stages.map((stage) => {
            const isDone = completedStages.includes(stage) || analysisStatus === 'completed';
            const isCurrent = currentStage === stage && analysisStatus === 'running';

            return (
              <div key={stage} className="flex items-center gap-2.5 text-sm">
                {isDone ? (
                  <CheckCircle2 size={14} className="text-success shrink-0" />
                ) : isCurrent ? (
                  <Loader2 size={14} className="text-accent shrink-0 animate-spin" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                )}
                <span className={isDone ? 'text-secondary' : isCurrent ? 'text-primary' : 'text-secondary/50'}>
                  {formatStageLabel(stage)}
                </span>
              </div>
            );
          })}
        </div>

        {/* AI run details */}
        {analysisRunMetadata && (
          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-secondary uppercase tracking-wide">AI run</span>
              <div className="flex gap-1">
                {analysisRunMetadata.validation_mode && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/15 text-info">validation</span>
                )}
                {analysisRunMetadata.fallback_used && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent flex items-center gap-1">
                    <AlertTriangle size={10} /> fallback
                  </span>
                )}
                {!analysisRunMetadata.llm_active && !analysisRunMetadata.fallback_used && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-border text-secondary">no LLM</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div className="text-secondary">Model</div>
              <div className="text-primary font-mono truncate">{analysisRunMetadata.model || '—'}</div>
              <div className="text-secondary">Mode</div>
              <div className="text-primary">{analysisRunMetadata.comprehension_mode || '—'}</div>
              <div className="text-secondary">Scope</div>
              <div className="text-primary">{analysisRunMetadata.scope || '—'}</div>
              <div className="text-secondary">Tokens (in / out)</div>
              <div className="text-primary font-mono">
                {analysisRunMetadata.tokens_in.toLocaleString()} / {analysisRunMetadata.tokens_out.toLocaleString()}
              </div>
              <div className="text-secondary">LLM calls</div>
              <div className="text-primary">{analysisRunMetadata.llm_call_count}</div>
            </div>
          </div>
        )}

        {analysisProgress?.elapsedSeconds != null && analysisProgress.elapsedSeconds > 0 && (
          <p className="text-[10px] text-secondary/60 text-center mt-4">
            Elapsed: {Math.round(analysisProgress.elapsedSeconds)}s
          </p>
        )}

        {analysisStatus === 'failed' && (
          <button
            onClick={() => {
              setAnalysisStatus('idle');
              setAnalysisProgress(null);
              setAnalysisError(null);
              setAnalysisRunMetadata(null);
            }}
            className="w-full mt-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
