import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  FolderOpen,
  FolderTree,
  GitBranch,
  Loader2,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Waypoints,
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

interface AnalyzeResponse {
  job_id: string;
  run_id: string;
  status: string;
}

const LEGACY_RECENT_REPOS_KEY = 'syntax-tree.observatory.recentRepos.v1';
const RECENT_PROJECTS_KEY = 'syntax-tree.observatory.recentProjects.v2';

/** One real prior analysis. Only fields that were actually observed are
 * stored — a migrated legacy path row has no time or file count, and the
 * row simply omits that metadata rather than inventing it. */
interface RecentProject {
  path: string;
  name: string;
  analyzedAt?: string;
  fileCount?: number;
}

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

/**
 * The reviewed landing (03_LANDING_PAGE_SPEC): not marketing — step one of
 * the workflow. One primary icon-led action (Browse repository) with the
 * no-AI sentence beside it; Architecture / Explore / Verify cards; Recent
 * projects only when real history exists; the epistemic provenance strip;
 * and the analysis state replacing the lower half IN PLACE with real stage
 * copy and a real file counter. There is no visible environment form —
 * the existing folder picker lives behind the one CTA.
 */
export default function ObservatoryEntry() {
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(() => readRecentProjects());
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

  useObservatoryAnalysisProgress(() => setRecentProjects(readRecentProjects()));

  useEffect(() => {
    document.documentElement.classList.add('observatory-active');
    return () => document.documentElement.classList.remove('observatory-active');
  }, []);

  const busy = loading || analysisStatus === 'running';
  const analysing = busy || analysisStatus === 'failed';
  const normalizedError = startError || analysisError;

  const startAnalysis = async (repositoryPath: string) => {
    const path = repositoryPath.trim();
    if (!path || busy) return;
    setLoading(true);
    setStartError(null);
    setAnalysisError(null);
    try {
      const result = await fetchApi<AnalyzeResponse>('/analyze', {
        method: 'POST',
        body: JSON.stringify({
          repository_path: path,
          analysis_mode: 'standard',
          require_llm: false,
          comprehension_mode: 'agentic',
          budget_profile: 'strict',
          scope: 'backend',
        }),
      });
      if (!result.job_id || !result.run_id) {
        throw new ApiError(502, 'The analysis start response did not include both job_id and run_id.');
      }
      setAnalysisJobId(result.job_id);
      setAnalysisRunId(result.run_id);
      setAnalysisRepositoryPath(path);
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
      setRecentProjects(rememberProject(path));
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

      <section className="observatory-entry__hero observatory-entry__hero--single">
        <h1>Understand an unfamiliar codebase.</h1>
        <p className="observatory-entry__lede">
          Laura&rsquo;s reads a repository on your machine, maps how it is put together,
          and keeps every architectural statement attached to the exact source that
          supports it.
        </p>

        <div className="observatory-entry__cta-row">
          <button
            className="observatory-entry__start"
            type="button"
            disabled={busy}
            onClick={() => setBrowserOpen(true)}
          >
            {busy ? (
              <>
                <Loader2 size={17} className="observatory-spin" />
                Analysing&hellip;
              </>
            ) : (
              <>
                <FolderOpen size={17} strokeWidth={1.8} />
                Browse repository
              </>
            )}
          </button>
          <span className="observatory-entry__no-ai-note">
            Source analysis runs entirely without AI. A model is optional, and only ever
            adds interpretation on top.
          </span>
        </div>

        {normalizedError && (
          <div className="observatory-entry__error" role="alert">
            <AlertCircle size={16} />
            <span>{normalizedError}</span>
          </div>
        )}

        {!analysing && (
          <>
            <div className="observatory-entry__promise-grid">
              <PromiseItem icon={<GitBranch size={17} />} title="Architecture" text="See the regions a repository is actually made of, and what contains what." />
              <PromiseItem icon={<Waypoints size={17} />} title="Explore" text="Drill from a region into a cluster, into a module, into a single function." />
              <PromiseItem icon={<ShieldCheck size={17} />} title="Verify" text="Follow any architectural statement to the file and lines behind it." />
            </div>

            {recentProjects.length > 0 && (
              <section className="observatory-entry__recent-projects" aria-label="Recent projects">
                <h2>Recent projects</h2>
                <div className="observatory-entry__recent-list">
                  {recentProjects.slice(0, 4).map((project) => (
                    <button key={project.path} type="button" onClick={() => void startAnalysis(project.path)}>
                      <FolderOpen size={15} strokeWidth={1.7} />
                      <span className="observatory-entry__recent-main">
                        <strong>{project.name}</strong>
                        <small>{project.path}</small>
                      </span>
                      <span className="observatory-entry__recent-meta">{recentProjectMeta(project)}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="observatory-entry__provenance" aria-label="How Laura's separates fact from interpretation">
              <div>
                <div className="observatory-entry__provenance-chips">
                  <span className="epistemic-chip epistemic-chip--structure"><FolderTree size={11} /> Structure</span>
                  <span className="epistemic-chip epistemic-chip--cluster"><Waypoints size={11} /> Structural cluster</span>
                  <span className="epistemic-chip epistemic-chip--verified"><ShieldCheck size={11} /> Verified</span>
                </div>
                <p>Always available. Structure, clustering and evidence verification are deterministic and never call a model.</p>
              </div>
              <div>
                <div className="observatory-entry__provenance-chips">
                  <span className="epistemic-chip epistemic-chip--ai"><Sparkles size={11} /> AI interpretation</span>
                </div>
                <p>Optional, and always something you ask for. A model can name a group and explain an entity; it never changes what the analysis found.</p>
              </div>
            </section>
          </>
        )}

        {(analysisStatus === 'running' || analysisStatus === 'failed') && (
          <ObservatoryProgressPanel onReset={resetAnalysis} />
        )}
      </section>

      {browserOpen && (
        <FolderBrowserDialog
          onCancel={() => setBrowserOpen(false)}
          onSelect={(path) => {
            setBrowserOpen(false);
            void startAnalysis(path);
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
  const repositoryPath = useSyntaxTreeStore((s) => s.analysisRepositoryPath);
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

  const repoName = repositoryPath ? projectName(repositoryPath) : 'repository';

  return (
    <section className="observatory-progress" aria-live="polite">
      <div className="observatory-progress__header">
        <div>
          <h2>{status === 'failed' ? 'The analysis needs attention' : `Analysing ${repoName}`}</h2>
          {repositoryPath && <p className="observatory-progress__path">{repositoryPath}</p>}
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
            <span>Files read</span>
            <span>{progress.filesParsed} / {progress.filesTotal}</span>
          </div>
          <div className="observatory-progress__bar">
            <span style={{ width: `${Math.min(100, Math.round((progress.filesParsed / progress.filesTotal) * 100))}%` }} />
          </div>
          {progress.currentFile && <p>{progress.currentFile}</p>}
        </div>
      ) : (
        <p className="observatory-progress__quiet">{friendlyStage(progress?.stage)}</p>
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

      <p className="observatory-progress__next">
        The architecture opens as soon as structure is grouped. Every count and relation
        you will see comes from this deterministic pass.
      </p>

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
        <CircleDashed size={15} />
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

function useObservatoryAnalysisProgress(onCompleted?: () => void) {
  const analysisJobId = useSyntaxTreeStore((s) => s.analysisJobId);
  const analysisStatus = useSyntaxTreeStore((s) => s.analysisStatus);
  const setAnalysisStatus = useSyntaxTreeStore((s) => s.setAnalysisStatus);
  const setAnalysisProgress = useSyntaxTreeStore((s) => s.setAnalysisProgress);
  const setAnalysisError = useSyntaxTreeStore((s) => s.setAnalysisError);
  const setAnalysisRunMetadata = useSyntaxTreeStore((s) => s.setAnalysisRunMetadata);
  const wsRef = useRef<WebSocket | null>(null);
  const onCompletedRef = useRef(onCompleted);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

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
        // Record the real completion facts against the project's recent
        // row (time of analysis + observed file count) before leaving the
        // landing — nothing is fabricated, absent values simply stay off.
        const state = useSyntaxTreeStore.getState();
        if (state.analysisRepositoryPath) {
          recordProjectCompletion(state.analysisRepositoryPath, state.analysisProgress?.filesTotal ?? undefined);
          onCompletedRef.current?.();
        }
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

function projectName(path: string) {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.at(-1) ?? path;
}

function readRecentProjects(): RecentProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_PROJECTS_KEY) || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((item): item is RecentProject => Boolean(item && typeof item.path === 'string' && typeof item.name === 'string')).slice(0, 5);
    }
  } catch {
    // fall through to legacy migration
  }
  // Migrate the legacy plain-path list once: name is derived from the real
  // path; time/count stay absent because they were never recorded.
  try {
    const legacy = JSON.parse(window.localStorage.getItem(LEGACY_RECENT_REPOS_KEY) || '[]');
    if (Array.isArray(legacy)) {
      const seen = new Set<string>();
      const migrated: RecentProject[] = [];
      for (const item of legacy) {
        if (typeof item !== 'string') continue;
        const key = item.replace(/\\/g, '/').toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        migrated.push({ path: item, name: projectName(item) });
      }
      return migrated.slice(0, 5);
    }
  } catch {
    // no usable history
  }
  return [];
}

function writeRecentProjects(projects: RecentProject[]) {
  try {
    window.localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects.slice(0, 5)));
  } catch {
    // Storage unavailable: the section simply reflects this session only.
  }
}

function rememberProject(path: string): RecentProject[] {
  const key = path.replace(/\\/g, '/').toLowerCase();
  const current = readRecentProjects().filter((item) => item.path.replace(/\\/g, '/').toLowerCase() !== key);
  const next = [{ path, name: projectName(path), analyzedAt: new Date().toISOString() }, ...current].slice(0, 5);
  writeRecentProjects(next);
  return next;
}

function recordProjectCompletion(path: string, fileCount: number | undefined) {
  const key = path.replace(/\\/g, '/').toLowerCase();
  const next = readRecentProjects().map((item) =>
    item.path.replace(/\\/g, '/').toLowerCase() === key
      ? { ...item, analyzedAt: new Date().toISOString(), ...(fileCount ? { fileCount } : {}) }
      : item,
  );
  writeRecentProjects(next);
}

function recentProjectMeta(project: RecentProject): string {
  const parts: string[] = [];
  if (project.fileCount) parts.push(`${project.fileCount} file${project.fileCount === 1 ? '' : 's'}`);
  if (project.analyzedAt) {
    const relative = relativeTime(project.analyzedAt);
    if (relative) parts.push(relative);
  }
  return parts.join(' · ');
}

function relativeTime(iso: string): string | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  return new Date(then).toLocaleDateString();
}
