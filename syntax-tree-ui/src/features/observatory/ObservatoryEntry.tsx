import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderOpen,
  GitBranch,
  Loader2,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { ApiError, fetchApi } from '../../api/client';
import { useRunOrientation } from '../../api/hooks';
import type { RunMetadata } from '../../api/types';
import { buildWebSocketUrl } from '../../api/websocket';
import RepoOrientationPanel from '../../components/shared/RepoOrientationPanel';
import ThemeToggle from '../../components/shared/ThemeToggle';
import { readinessStagesFromPayload } from '../../components/shared/readinessStageUtils';
import { useSyntaxTreeStore } from '../../store';
import FolderBrowserDialog from './FolderBrowserDialog';

type AnalysisMode = 'standard' | 'validation';
type ComprehensionMode = 'classic' | 'agentic';
type BudgetProfile = 'strict' | 'balanced' | 'max_quality';
type Scope = 'backend' | 'full_repo';

interface AnalyzeResponse {
  job_id: string;
  run_id: string;
  status: string;
}

const RECENT_REPOS_KEY = 'syntax-tree.observatory.recentRepos.v1';

const stageCopy: Record<string, string> = {
  queued: 'Queued for analysis',
  analysis_start: 'Run accepted',
  repo_orientation: 'Orienting repository',
  source_discovery: 'Discovering and parsing source',
  graph_index: 'Building the code graph',
  source_index: 'Indexing source evidence',
  semantic_index: 'Building semantic index',
  flow_index: 'Tracing flows and frontend bridges',
  first_map: 'Building the first map',
  semantic_consistency: 'Checking consistency',
  complete: 'Analysis complete',
  discovery: 'Reading source files',
  parsing: 'Reading source files',
  source_summaries: 'Summarizing important files',
  semantic_concepts: 'Finding architecture areas',
  concept_synthesis: 'Naming source-backed concepts',
  flow_tracing: 'Tracing flows',
  flow_review: 'Checking movement through the system',
  architecture_explanations: 'Building explanations',
  documentation_grounding: 'Preparing documentation evidence',
  implementation_slices: 'Preparing source proof',
};

export default function ObservatoryEntry() {
  const [repoPath, setRepoPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('standard');
  const [requireLlm, setRequireLlm] = useState(false);
  const [comprehensionMode, setComprehensionMode] = useState<ComprehensionMode>('agentic');
  const [budgetProfile, setBudgetProfile] = useState<BudgetProfile>('strict');
  const [scope, setScope] = useState<Scope>('backend');
  const [model, setModel] = useState('');
  const [recentRepos, setRecentRepos] = useState<string[]>(() => readRecentRepos());
  const [browserOpen, setBrowserOpen] = useState(false);

  const analysisStatus = useSyntaxTreeStore((s) => s.analysisStatus);
  const analysisError = useSyntaxTreeStore((s) => s.analysisError);
  const resetAnalysis = useSyntaxTreeStore((s) => s.resetAnalysis);
  const openSettings = useSyntaxTreeStore((s) => s.openSettings);
  const setAnalysisStatus = useSyntaxTreeStore((s) => s.setAnalysisStatus);
  const setAnalysisJobId = useSyntaxTreeStore((s) => s.setAnalysisJobId);
  const setAnalysisRunId = useSyntaxTreeStore((s) => s.setAnalysisRunId);
  const setAnalysisRepositoryPath = useSyntaxTreeStore((s) => s.setAnalysisRepositoryPath);
  const setAnalysisError = useSyntaxTreeStore((s) => s.setAnalysisError);
  const setAnalysisProgress = useSyntaxTreeStore((s) => s.setAnalysisProgress);

  useObservatoryAnalysisProgress();

  useEffect(() => {
    document.documentElement.classList.add('observatory-active');
    return () => document.documentElement.classList.remove('observatory-active');
  }, []);

  const effectiveRequireLlm = analysisMode === 'validation' ? true : requireLlm;
  const busy = loading || analysisStatus === 'running';
  const canStart = repoPath.trim().length > 0 && !busy;
  const normalizedError = startError || analysisError;

  const startAnalysis = async () => {
    if (!repoPath.trim() || busy) return;
    setLoading(true);
    setStartError(null);
    setAnalysisError(null);
    try {
      const body: Record<string, unknown> = {
        repository_path: repoPath.trim(),
        analysis_mode: analysisMode,
        require_llm: effectiveRequireLlm,
        comprehension_mode: comprehensionMode,
        budget_profile: budgetProfile,
        scope,
      };
      if (model.trim()) body.model = model.trim();

      const result = await fetchApi<AnalyzeResponse>('/analyze', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!result.job_id || !result.run_id) {
        throw new ApiError(502, 'The analysis start response did not include both job_id and run_id.');
      }
      setAnalysisJobId(result.job_id);
      setAnalysisRunId(result.run_id);
      setAnalysisRepositoryPath(repoPath.trim());
      setAnalysisProgress({
        stage: 'queued',
        filesTotal: 0,
        filesParsed: 0,
        stagesCompleted: [],
        stagesRemaining: [],
        elapsedSeconds: 0,
        readinessStages: [],
        canRenderFrontend: false,
      });
      setAnalysisStatus('running');
      const nextRecent = rememberRepo(repoPath.trim(), recentRepos);
      setRecentRepos(nextRecent);
    } catch (error) {
      setStartError(formatStartError(error));
      setAnalysisStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="observatory-entry">
      <section className="observatory-entry__topbar">
        <div className="observatory-entry__brand">
          <GitBranch size={18} strokeWidth={1.9} />
          <span>Laura&rsquo;s</span>
        </div>
        <div className="observatory-entry__topbar-actions">
          <ThemeToggle />
          <button
            type="button"
            className="observatory-entry__settings-button"
            onClick={openSettings}
            aria-label="Open settings"
          >
            <SettingsIcon size={15} strokeWidth={1.8} />
            Settings
          </button>
        </div>
      </section>

      <section className="observatory-entry__hero">
        <div className="observatory-entry__copy">
          <h1>Understand an unfamiliar codebase.</h1>
          <p>
            Laura&rsquo;s reads a repository on your machine, maps how it is put together,
            and keeps every architectural statement attached to the exact source that
            supports it.
          </p>
          <p className="observatory-entry__no-ai-note">
            Source analysis runs entirely without AI. A model is optional, and only ever
            adds interpretation on top.
          </p>
          <div className="observatory-entry__promise-grid">
            <PromiseItem icon={<GitBranch size={17} />} title="Architecture" text="See the regions a repository is actually made of, and what contains what." />
            <PromiseItem icon={<Clock size={17} />} title="Explore" text="Drill from a region into a cluster, into a module, into a single function." />
            <PromiseItem icon={<ShieldCheck size={17} />} title="Verify" text="Follow any architectural statement to the file and lines behind it." />
          </div>
        </div>

        <div className="observatory-entry__panel" aria-label="Start repository analysis">
          <div className="observatory-entry__panel-header">
          <div>
            <h2>Choose repository</h2>
            <p>Select a local folder to begin analysis. The architecture overview opens when the source is ready.</p>
            </div>
            <span className="observatory-entry__status-pill">Local folder</span>
          </div>

          <label className="observatory-entry__label" htmlFor="observatory-repo-path">Repository path</label>
          <div className="observatory-entry__input-row">
            <FolderOpen size={16} strokeWidth={1.7} />
            <input
              id="observatory-repo-path"
              value={repoPath}
              onChange={(event) => setRepoPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void startAnalysis();
              }}
              placeholder="Enter an absolute local repository path"
            />
            <button
              type="button"
              className="observatory-entry__browse-button"
              onClick={() => setBrowserOpen(true)}
            >
              Browse&hellip;
            </button>
          </div>

          {recentRepos.length > 0 && (
            <div className="observatory-entry__recent" aria-label="Recent repository paths">
              {recentRepos.slice(0, 3).map((path) => (
                <button key={path} type="button" onClick={() => setRepoPath(path)}>
                  {shortenPath(path)}
                </button>
              ))}
            </div>
          )}

          <details
            className="observatory-entry__advanced"
            open={advancedOpen}
            onToggle={(event) => setAdvancedOpen((event.target as HTMLDetailsElement).open)}
          >
            <summary>
              <ChevronDown size={14} className={advancedOpen ? '' : 'observatory-entry__chevron--closed'} />
              Optional analysis settings
            </summary>
            <div className="observatory-entry__advanced-body">
              <SegmentedField
                label="Analysis mode"
                value={analysisMode}
                onChange={(value) => setAnalysisMode(value as AnalysisMode)}
                options={[
                  { value: 'standard', label: 'Standard', description: 'Falls back honestly when the LLM is unavailable.' },
                  { value: 'validation', label: 'Validation', description: 'Requires live LLM-backed reasoning.' },
                ]}
              />
              <label className="observatory-entry__check">
                <input
                  type="checkbox"
                  checked={effectiveRequireLlm}
                  disabled={analysisMode === 'validation'}
                  onChange={(event) => setRequireLlm(event.target.checked)}
                />
                Require live LLM explanations
              </label>
              <SegmentedField
                label="Comprehension mode"
                value={comprehensionMode}
                onChange={(value) => setComprehensionMode(value as ComprehensionMode)}
                options={[
                  { value: 'agentic', label: 'Agentic' },
                  { value: 'classic', label: 'Classic' },
                ]}
              />
              <SegmentedField
                label="Budget"
                value={budgetProfile}
                onChange={(value) => setBudgetProfile(value as BudgetProfile)}
                options={[
                  { value: 'strict', label: 'Strict' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'max_quality', label: 'Max quality' },
                ]}
              />
              <SegmentedField
                label="Scope"
                value={scope}
                onChange={(value) => setScope(value as Scope)}
                options={[
                  { value: 'backend', label: 'Backend' },
                  { value: 'full_repo', label: 'Full repo' },
                ]}
              />
              <div>
                <label className="observatory-entry__label" htmlFor="observatory-model">Model override</label>
                <input
                  id="observatory-model"
                  className="observatory-entry__text-input"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="leave empty to use configured default"
                />
              </div>
            </div>
          </details>

          {normalizedError && (
            <div className="observatory-entry__error">
              <AlertCircle size={16} />
              <span>{normalizedError}</span>
            </div>
          )}

          <button
            className="observatory-entry__start"
            type="button"
            disabled={!canStart}
            onClick={() => void startAnalysis()}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="observatory-spin" />
                Starting scan
              </>
            ) : (
              <>
                Browse repository
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="observatory-entry__hint">
            Laura's reads the repository locally through the connected analysis service. If analysis cannot start,
            this screen will explain what needs attention.
          </p>
        </div>
      </section>

      {(analysisStatus === 'running' || analysisStatus === 'failed') && (
        <ObservatoryProgressPanel onReset={resetAnalysis} />
      )}

      {browserOpen && (
        <FolderBrowserDialog
          onCancel={() => setBrowserOpen(false)}
          onSelect={(path) => {
            setRepoPath(path);
            setBrowserOpen(false);
          }}
        />
      )}
    </main>
  );
}

function ObservatoryProgressPanel({ onReset }: { onReset: () => void }) {
  const progress = useSyntaxTreeStore((s) => s.analysisProgress);
  const status = useSyntaxTreeStore((s) => s.analysisStatus);
  const error = useSyntaxTreeStore((s) => s.analysisError);
  const meta = useSyntaxTreeStore((s) => s.analysisRunMetadata);
  const storedAnalysisRunId = useSyntaxTreeStore((s) => s.analysisRunId);
  const analysisRunId = storedAnalysisRunId ?? meta?.analysis_run_id ?? progress?.readinessStages?.[0]?.analysis_run_id ?? null;
  const graphReady = status === 'completed' || progress?.canRenderFrontend === true;
  const {
    data: orientation,
    loading: orientationLoading,
    error: orientationError,
  } = useRunOrientation(graphReady ? analysisRunId : null, graphReady && status === 'running' ? 1500 : 0);

  const stages = useMemo(() => {
    if (progress?.readinessStages?.length) {
      return progress.readinessStages;
    }
    const seen = new Set<string>();
    const values = [
      ...(progress?.stagesCompleted ?? []),
      progress?.stage ?? '',
      ...(progress?.stagesRemaining ?? []),
    ].filter(Boolean);
    return values.filter((stage) => {
      if (seen.has(stage)) return false;
      seen.add(stage);
      return true;
    });
  }, [progress]);

  const parsedPercent = progress?.filesTotal
    ? Math.min(100, Math.round((progress.filesParsed / progress.filesTotal) * 100))
    : 0;

  return (
    <section className="observatory-progress" aria-live="polite">
      <div className="observatory-progress__header">
        <div>
          <span className="observatory-entry__eyebrow">
            {status === 'failed' ? <XCircle size={14} /> : <Loader2 size={14} className="observatory-spin" />}
            {status === 'failed' ? 'Scan stopped' : 'Building the architecture map'}
          </span>
          <h2>{status === 'failed' ? 'The scan needs attention' : friendlyStage(progress?.stage)}</h2>
        </div>
        {status === 'failed' && (
          <button type="button" onClick={onReset}>
            <RotateCcw size={14} />
            Reset
          </button>
        )}
      </div>

      {error && (
        <div className="observatory-entry__error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {progress?.filesTotal ? (
        <div className="observatory-progress__meter">
          <div className="observatory-progress__meter-label">
            <span>Reading files</span>
            <span>{progress.filesParsed} / {progress.filesTotal}</span>
          </div>
          <div className="observatory-progress__bar">
            <span style={{ width: `${parsedPercent}%` }} />
          </div>
          {progress.currentFile && <p>{progress.currentFile}</p>}
        </div>
      ) : (
        <p className="observatory-progress__quiet">Preparing the analysis job.</p>
      )}

      <RepoOrientationPanel
        orientation={orientation}
        loading={orientationLoading || (!orientation && status === 'running')}
        error={orientationError}
        compact
      />

      <div className="observatory-progress__stages">
        {stages.length === 0 ? (
          <StageRow state="current" label="Preparing source scan" />
        ) : stages.map((stage) => {
          if (typeof stage === 'object') {
            return (
              <StageRow
                key={stage.id || stage.stage_name}
                state={stage.status === 'ready' ? 'done' : stage.status === 'running' ? 'current' : stage.status}
                label={stage.display_name || friendlyStage(stage.stage_name)}
                title={stage.blocking_error || stage.warnings.join('\n') || undefined}
              />
            );
          }
          const completed = progress?.stagesCompleted.includes(stage);
          const current = progress?.stage === stage && status === 'running';
          return (
            <StageRow
              key={stage}
              state={completed ? 'done' : current ? 'current' : 'waiting'}
              label={friendlyStage(stage)}
            />
          );
        })}
      </div>

      {meta && (
        <div className="observatory-progress__meta">
          <span>{meta.model || 'Configured model'}</span>
          <span>{meta.comprehension_mode || 'analysis'} mode</span>
          <span>{meta.llm_active ? 'LLM active' : meta.fallback_used ? 'Fallback used' : 'No live LLM'}</span>
        </div>
      )}
    </section>
  );
}

function StageRow({
  state,
  label,
  title,
}: {
  state: 'done' | 'current' | 'waiting' | 'pending' | 'failed' | 'skipped';
  label: string;
  title?: string;
}) {
  return (
    <div className={`observatory-progress__stage observatory-progress__stage--${state}`} title={title}>
      {state === 'done' ? (
        <CheckCircle2 size={15} />
      ) : state === 'current' ? (
        <Loader2 size={15} className="observatory-spin" />
      ) : state === 'failed' ? (
        <XCircle size={15} />
      ) : state === 'skipped' ? (
        <AlertCircle size={15} />
      ) : (
        <span />
      )}
      <p>{label}</p>
    </div>
  );
}

function PromiseItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="observatory-entry__promise">
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function SegmentedField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; description?: string }[];
}) {
  return (
    <div>
      <span className="observatory-entry__label">{label}</span>
      <div className="observatory-entry__segments">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'is-active' : ''}
            title={option.description}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function useObservatoryAnalysisProgress() {
  const analysisJobId = useSyntaxTreeStore((s) => s.analysisJobId);
  const analysisStatus = useSyntaxTreeStore((s) => s.analysisStatus);
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
      const nested = (raw.metadata as Record<string, unknown> | undefined)?.run_metadata as RunMetadata | undefined;
      const meta = top ?? nested;
      if (meta && typeof meta === 'object') setAnalysisRunMetadata(meta);
    };

    const applyProgress = (raw: Record<string, unknown>) => {
      const progress = (raw.progress && typeof raw.progress === 'object' ? raw.progress : raw) as Record<string, unknown>;
      setAnalysisProgress({
        stage: String(progress.stage || progress.current_stage || raw.stage || ''),
        filesTotal: Number(progress.total_files || progress.files_total || 0),
        filesParsed: Number(progress.files_parsed || 0),
        stagesCompleted: Array.isArray(progress.stages_completed) ? (progress.stages_completed as string[]) : [],
        stagesRemaining: Array.isArray(progress.stages_remaining) ? (progress.stages_remaining as string[]) : [],
        elapsedSeconds: Number(raw.elapsed_seconds || progress.elapsed_seconds || 0),
        currentFile: typeof progress.current_file === 'string' ? progress.current_file : undefined,
        readinessStages: readinessStagesFromPayload(raw),
        canRenderFrontend: Boolean(progress.can_render_frontend),
      });
      captureRunMetadata(raw);
    };

    const applyTerminalStatus = (raw: Record<string, unknown>) => {
      const progress = (raw.progress && typeof raw.progress === 'object' ? raw.progress : {}) as Record<string, unknown>;
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
        const response = await fetch(`/api/analyze/${analysisJobId}/status`);
        const data = await response.json();
        if (data.status === 'completed' || data.status === 'failed') {
          applyTerminalStatus(data);
          if (pollInterval) clearInterval(pollInterval);
          pollInterval = null;
        } else {
          applyProgress(data);
        }
      } catch {
        // Keep websocket-first progress calm. The next poll or socket message may recover.
      }
    };

    const startPolling = () => {
      if (!pollInterval) pollInterval = setInterval(pollStatus, 2000);
    };

    const ws = new WebSocket(buildWebSocketUrl(`/api/ws/analyze/${analysisJobId}`));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.event === 'status_update' || message.event === 'progress') {
          const data = message.data || {};
          applyProgress(data);
          applyTerminalStatus(data);
        } else if (message.event === 'pipeline_complete') {
          applyTerminalStatus(message.data || { status: 'completed' });
        } else if (message.event === 'error') {
          const data = (message.data || {}) as Record<string, unknown>;
          const progress = (data.progress as Record<string, unknown> | undefined) || {};
          captureRunMetadata(data);
          setAnalysisError(String(progress.error || data.message || data.error || 'Analysis failed'));
          setAnalysisStatus('failed');
        }
      } catch {
        // Ignore malformed progress packets.
      }
    };
    ws.onerror = startPolling;
    ws.onclose = () => {
      if (useSyntaxTreeStore.getState().analysisStatus === 'running') {
        void pollStatus();
        startPolling();
      }
    };

    return () => {
      wsRef.current = null;
      ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [analysisJobId, analysisStatus, setAnalysisError, setAnalysisProgress, setAnalysisRunMetadata, setAnalysisStatus]);
}

function friendlyStage(stage?: string) {
  if (!stage) return 'Preparing the scan';
  return stageCopy[stage] ?? stage.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStartError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not start analysis';
  if (message.includes('502') || message.toLowerCase().includes('bad gateway')) {
    return 'The frontend is running, but the backend is not reachable on port 8000. Start the backend and try again.';
  }
  if (message.toLowerCase().includes('failed to fetch')) {
    return 'The backend could not be reached. Start the Syntax Tree API server and try again.';
  }
  return message;
}

function readRecentRepos() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_REPOS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function rememberRepo(path: string, current: string[]) {
  const next = [path, ...current.filter((item) => item !== path)].slice(0, 5);
  window.localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(next));
  return next;
}

function shortenPath(path: string) {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 2) return path;
  return `${parts.at(-2)}/${parts.at(-1)}`;
}
