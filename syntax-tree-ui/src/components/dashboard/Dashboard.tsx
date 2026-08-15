import { Compass, AlertTriangle, Sparkles, Info, Activity, ListChecks, RefreshCw } from 'lucide-react';
import { useStats, useArchOverview, useViolations, useRunMetrics, useRunStages, useRunEnrichment } from '../../api/hooks';
import { useSyntaxTreeStore } from '../../store';
import ScoreCard from './ScoreCard';
import QuickStats from './QuickStats';
import KeyFindings from './KeyFindings';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorBanner from '../shared/ErrorBanner';
import { ReadinessStageList } from '../shared/ReadinessStages';

export default function Dashboard() {
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useStats();
  const { data: overview, loading: overviewLoading } = useArchOverview();
  const { data: violationsData } = useViolations();
  const startNarrator = useSyntaxTreeStore((s) => s.startNarrator);
  const runMetadata = useSyntaxTreeStore((s) => s.analysisRunMetadata);
  const analysisStatus = useSyntaxTreeStore((s) => s.analysisStatus);
  const analysisProgress = useSyntaxTreeStore((s) => s.analysisProgress);
  const analysisRunId = runMetadata?.analysis_run_id ?? null;
  const { data: runMetrics, loading: metricsLoading, error: metricsError } = useRunMetrics(analysisRunId);
  const {
    data: runStages,
    loading: stagesLoading,
    error: stagesError,
  } = useRunStages(analysisRunId, analysisStatus === 'running' ? 2000 : 0);
  const {
    data: runEnrichment,
    loading: enrichmentLoading,
    error: enrichmentError,
  } = useRunEnrichment(analysisRunId, 3000);

  if (statsLoading || overviewLoading) return <LoadingSpinner className="flex-1" size={32} />;
  if (statsError) return <div className="p-4"><ErrorBanner message={statsError} onRetry={refetchStats} /></div>;

  // Build score dimensions from REAL backend fields only.
  const healthScore = overview?.health_score ?? 0;
  const confidence = overview?.confidence ?? 0;
  const violationCount = violationsData?.summary?.total ?? overview?.total_violations ?? 0;

  const dimensions = [
    { name: 'Overall Health', score: healthScore * 100 },
    { name: 'Confidence', score: confidence * 100 },
    { name: 'Violations', score: Math.max(0, 100 - violationCount * 15) },
  ];

  // Quick stats
  const topStats = [
    { label: 'Files', value: stats?.total_nodes ? Math.round(stats.nodes_by_type['module'] || 0) : 0 },
    { label: 'Functions', value: (stats?.nodes_by_type['function'] || 0) + (stats?.nodes_by_type['method'] || 0) },
    { label: 'Classes', value: stats?.nodes_by_type['class'] || 0 },
    { label: 'Dependencies', value: stats?.edges_by_type['CALLS'] || 0 },
  ];

  const bottomStats = [
    { label: 'Components', value: overview?.total_components || 0 },
    { label: 'Subsystems', value: overview?.total_subsystems || 0 },
    { label: 'Layers', value: overview?.total_layers || 0 },
    { label: 'Violations', value: overview?.total_violations || 0 },
  ];

  const dash = (v: string | undefined | null) => (v && v.length > 0 ? v : '-');
  const fallbackUsed = runMetadata?.fallback_used ?? false;
  const readinessStages = runStages?.stages ?? analysisProgress?.readinessStages ?? [];
  const readinessStatusCounts = runStages?.status_counts ?? readinessStages.reduce<Record<string, number>>((counts, stage) => {
    counts[stage.status] = (counts[stage.status] ?? 0) + 1;
    return counts;
  }, {});
  const enrichmentStatusCounts = runEnrichment?.status_counts ?? {};
  const formatMs = (value?: number) => {
    const ms = Math.max(0, value ?? 0);
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  };
  const formatBytes = (value?: number) => {
    const bytes = Math.max(0, value ?? 0);
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1000px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-primary">Dashboard</h1>
            {overview?.system_summary && (
              <p className="text-sm text-secondary mt-1 max-w-[600px]">{overview.system_summary}</p>
            )}
          </div>
          <button
            onClick={startNarrator}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Compass size={16} />
            Take the Tour
          </button>
        </div>

        {/* Score Card */}
        <div>
          <h2 className="text-sm text-secondary font-medium mb-3">Architecture Scorecard</h2>
          <ScoreCard dimensions={dimensions} />
        </div>

        {/* AI Run Details */}
        <div>
          <h2 className="text-sm text-secondary font-medium mb-3 flex items-center gap-2">
            <Sparkles size={14} /> AI Run Details
          </h2>
          <div className="bg-surface border border-border rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-xs">
            <Field label="Model" value={dash(overview?.model)} mono />
            <Field label="Comprehension" value={dash(overview?.comprehension_mode)} />
            <Field label="Budget" value={dash(overview?.budget_profile)} />
            <Field label="Scope" value={dash(overview?.scope)} />
            <Field label="Repo type" value={dash(overview?.repo_type)} />
            <Field label="Architecture model" value={dash(overview?.architecture_model_version)} mono />
            <Field
              label="Tokens (in / out)"
              value={`${(overview?.tokens_in ?? 0).toLocaleString()} / ${(overview?.tokens_out ?? 0).toLocaleString()}`}
              mono
            />
            <Field label="Confidence" value={`${Math.round(confidence * 100)}%`} />
            <Field
              label="Status"
              value={fallbackUsed ? 'fallback used' : 'AI active'}
              badge={fallbackUsed ? 'warning' : 'success'}
            />
          </div>
          {fallbackUsed && (
            <div className="mt-2 flex items-start gap-2 text-[11px] text-warning bg-warning/10 border border-warning/20 rounded px-3 py-2">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>
                The architecture pipeline fell back from the AI-backed path. Some fields above may be deterministic estimates,
                not LLM output.
              </span>
            </div>
          )}
        </div>

        {/* Readiness Stages */}
        <div>
          <h2 className="text-sm text-secondary font-medium mb-3 flex items-center gap-2">
            <ListChecks size={14} /> Readiness Stages
          </h2>
          <div className="bg-surface border border-border rounded-xl p-4 text-xs">
            {!analysisRunId ? (
              <p className="text-secondary">Stage readiness appears after an analysis run is active.</p>
            ) : stagesLoading && readinessStages.length === 0 ? (
              <p className="text-secondary">Loading readiness stages...</p>
            ) : stagesError ? (
              <div className="flex items-start gap-2 text-warning">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>{stagesError}</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <MetricPill label="Pending" value={readinessStatusCounts.pending ?? 0} />
                  <MetricPill label="Running" value={readinessStatusCounts.running ?? 0} />
                  <MetricPill label="Ready" value={readinessStatusCounts.ready ?? 0} />
                  <MetricPill label="Failed" value={readinessStatusCounts.failed ?? 0} />
                  <MetricPill label="Skipped" value={readinessStatusCounts.skipped ?? 0} />
                </div>
                <ReadinessStageList stages={readinessStages} />
              </div>
            )}
          </div>
        </div>

        {/* Background Enrichment */}
        <div>
          <h2 className="text-sm text-secondary font-medium mb-3 flex items-center gap-2">
            <RefreshCw size={14} /> Background Enrichment
          </h2>
          <div className="bg-surface border border-border rounded-xl p-4 text-xs">
            {!analysisRunId ? (
              <p className="text-secondary">Enrichment jobs appear after an analysis run is active.</p>
            ) : enrichmentLoading && !runEnrichment ? (
              <p className="text-secondary">Loading enrichment jobs...</p>
            ) : enrichmentError ? (
              <div className="flex items-start gap-2 text-warning">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>{enrichmentError}</span>
              </div>
            ) : runEnrichment && runEnrichment.jobs.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <MetricPill label="Queued" value={enrichmentStatusCounts.queued ?? 0} />
                  <MetricPill label="Running" value={enrichmentStatusCounts.running ?? 0} />
                  <MetricPill label="Succeeded" value={enrichmentStatusCounts.succeeded ?? 0} />
                  <MetricPill label="Failed" value={enrichmentStatusCounts.failed ?? 0} />
                  <MetricPill label="Cancelled" value={enrichmentStatusCounts.cancelled ?? 0} />
                </div>
                <div className="space-y-1.5">
                  {runEnrichment.jobs.map((job) => (
                    <div key={job.id} className="border border-border rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-primary truncate">{job.job_type.replaceAll('_', ' ')}</span>
                        <span
                          className={`ml-auto text-[10px] shrink-0 ${
                            job.status === 'succeeded'
                              ? 'text-success'
                              : job.status === 'failed'
                                ? 'text-warning'
                                : job.status === 'running'
                                  ? 'text-accent'
                                  : 'text-secondary'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-secondary truncate">
                        {job.error || `${job.attempts} / ${job.max_attempts} attempt(s)`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-secondary">No background enrichment jobs have been queued for this run.</p>
            )}
          </div>
        </div>

        {/* Runtime Baseline */}
        <div>
          <h2 className="text-sm text-secondary font-medium mb-3 flex items-center gap-2">
            <Activity size={14} /> Runtime Baseline
          </h2>
          <div className="bg-surface border border-border rounded-xl p-4 text-xs">
            {!analysisRunId ? (
              <p className="text-secondary">Run metrics appear after an analysis run is active.</p>
            ) : metricsLoading ? (
              <p className="text-secondary">Loading runtime baseline...</p>
            ) : metricsError ? (
              <div className="flex items-start gap-2 text-warning">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>{metricsError}</span>
              </div>
            ) : runMetrics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                  <Field label="Run status" value={runMetrics.status} badge={runMetrics.failed_stage_count ? 'warning' : 'success'} />
                  <Field label="Duration" value={formatMs(runMetrics.duration_ms)} mono />
                  <Field label="Stages" value={`${runMetrics.stage_count}`} mono />
                  <Field label="Failed stages" value={`${runMetrics.failed_stage_count}`} mono />
                  <Field label="LLM stages" value={`${runMetrics.llm_stage_count}`} mono />
                  <Field label="Fallback stages" value={`${runMetrics.fallback_stage_count}`} mono />
                  <Field
                    label="Tokens (in / out)"
                    value={`${runMetrics.tokens_in.toLocaleString()} / ${runMetrics.tokens_out.toLocaleString()}`}
                    mono
                  />
                  <Field label="DB size" value={formatBytes(runMetrics.db_size_bytes)} mono />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <MetricPill label="Source files" value={runMetrics.artifacts.source_files ?? 0} />
                  <MetricPill label="Spans" value={runMetrics.artifacts.source_spans ?? 0} />
                  <MetricPill label="Chunks" value={runMetrics.artifacts.retrieval_chunks ?? 0} />
                  <MetricPill label="Claims" value={runMetrics.artifacts.claims ?? 0} />
                  <MetricPill label="Graph nodes" value={runMetrics.graph.nodes ?? 0} />
                </div>

                <div>
                  <div className="text-[10px] text-secondary uppercase tracking-wide mb-2">First artifact timings</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {runMetrics.first_artifact_timings.map((item) => (
                      <div key={item.name} className="border border-border rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-primary">{item.name.replaceAll('_', ' ')}</span>
                          <span className={item.available ? 'text-success' : 'text-warning'}>
                            {item.available ? formatMs(item.elapsed_ms) : 'pending'}
                          </span>
                        </div>
                        <div className="text-[10px] text-secondary truncate mt-1" title={item.reason || item.stage}>
                          {item.stage || item.reason || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {runMetrics.bottlenecks.length > 0 && (
                  <div>
                    <div className="text-[10px] text-secondary uppercase tracking-wide mb-2">Slowest stages</div>
                    <div className="space-y-1.5">
                      {runMetrics.bottlenecks.slice(0, 5).map((stage) => (
                        <div key={`${stage.stage}-${stage.duration_ms}`} className="flex items-center justify-between gap-3">
                          <span className="text-primary truncate">{stage.stage}</span>
                          <span className="font-mono text-secondary shrink-0">
                            {formatMs(stage.duration_ms)}
                            {stage.tokens_in + stage.tokens_out > 0
                              ? `, ${(stage.tokens_in + stage.tokens_out).toLocaleString()} tokens`
                              : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-secondary">No runtime baseline is available for this run.</p>
            )}
          </div>
        </div>

        {/* Uncertainties */}
        {overview?.uncertainties && overview.uncertainties.length > 0 && (
          <div>
            <h2 className="text-sm text-secondary font-medium mb-3 flex items-center gap-2">
              <Info size={14} /> Uncertainties
            </h2>
            <ul className="bg-surface border border-border rounded-xl p-4 space-y-1.5">
              {overview.uncertainties.map((u, i) => (
                <li key={i} className="text-xs text-primary/80 flex gap-2">
                  <span className="text-secondary/60 shrink-0">•</span>
                  <span>{u}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Stats */}
        <div>
          <h2 className="text-sm text-secondary font-medium mb-3">Codebase Overview</h2>
          <QuickStats stats={topStats} />
        </div>
        <QuickStats stats={bottomStats} />

        {/* Key Findings */}
        {overview?.key_findings && <KeyFindings findings={overview.key_findings} />}

        {/* Language breakdown */}
        {stats && Object.keys(stats.nodes_by_language).length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <span className="text-xs text-secondary font-medium mb-3 block">Languages</span>
            <div className="flex gap-4">
              {Object.entries(stats.nodes_by_language).map(([lang, count]) => (
                <div key={lang} className="text-center">
                  <div className="text-lg font-bold text-primary">{count}</div>
                  <div className="text-[10px] text-secondary capitalize">{lang}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: 'success' | 'warning';
}) {
  return (
    <div>
      <div className="text-[10px] text-secondary uppercase tracking-wide mb-0.5">{label}</div>
      {badge ? (
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded ${
            badge === 'warning' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'
          }`}
        >
          {value}
        </span>
      ) : (
        <div className={`text-primary truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
      )}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg px-3 py-2 min-w-0">
      <div className="text-[10px] text-secondary uppercase tracking-wide truncate">{label}</div>
      <div className="text-primary font-mono text-sm mt-0.5">{value.toLocaleString()}</div>
    </div>
  );
}
