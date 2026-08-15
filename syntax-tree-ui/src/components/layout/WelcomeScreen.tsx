import { useState } from 'react';
import { GitBranch, FolderOpen, Loader2, ChevronDown } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { useSyntaxTreeStore } from '../../store';

type AnalysisMode = 'standard' | 'validation';
type ComprehensionMode = 'classic' | 'agentic';
type BudgetProfile = 'strict' | 'balanced' | 'max_quality';
type Scope = 'backend' | 'full_repo';

interface AnalyzeResponse {
  job_id: string;
  status: string;
}

export default function WelcomeScreen() {
  const [repoPath, setRepoPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('standard');
  const [requireLlm, setRequireLlm] = useState(false);
  const [comprehensionMode, setComprehensionMode] = useState<ComprehensionMode>('agentic');
  const [budgetProfile, setBudgetProfile] = useState<BudgetProfile>('strict');
  const [scope, setScope] = useState<Scope>('backend');
  const [model, setModel] = useState('');

  const setAnalysisStatus = useSyntaxTreeStore((s) => s.setAnalysisStatus);
  const setAnalysisJobId = useSyntaxTreeStore((s) => s.setAnalysisJobId);

  const isValidationMode = analysisMode === 'validation';
  const effectiveRequireLlm = isValidationMode ? true : requireLlm;

  const handleAnalyze = async () => {
    if (!repoPath.trim()) return;
    setLoading(true);
    setError(null);
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
      setAnalysisJobId(result.job_id);
      setAnalysisStatus('running');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start analysis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-bg overflow-y-auto py-8">
      <div className="w-[520px] bg-surface border border-border rounded-xl p-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
            <GitBranch size={32} className="text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-primary">Syntax Tree</h1>
          <p className="text-sm text-secondary mt-1">Code intelligence and architecture analysis</p>
        </div>

        {/* Input */}
        <div className="space-y-4">
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Repository Path</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-bg border border-border rounded-lg px-3 gap-2">
                <FolderOpen size={14} className="text-secondary shrink-0" />
                <input
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="/path/to/repository"
                  className="flex-1 bg-transparent py-2 text-sm text-primary outline-none placeholder:text-secondary/50"
                />
              </div>
            </div>
          </div>

          {/* Advanced disclosure */}
          <details
            open={advancedOpen}
            onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
            className="bg-bg border border-border rounded-lg"
          >
            <summary className="flex items-center gap-1.5 px-3 py-2 text-xs text-secondary cursor-pointer select-none hover:text-primary list-none">
              <ChevronDown
                size={12}
                className={`transition-transform ${advancedOpen ? 'rotate-0' : '-rotate-90'}`}
              />
              Advanced
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/50">
              <RadioGroup
                label="Analysis mode"
                value={analysisMode}
                onChange={(v) => setAnalysisMode(v as AnalysisMode)}
                options={[
                  { value: 'standard', label: 'Standard', hint: 'AI is optional; falls back gracefully.' },
                  { value: 'validation', label: 'Validation', hint: 'Requires AI; fails on fallback.' },
                ]}
              />

              <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={effectiveRequireLlm}
                  disabled={isValidationMode}
                  onChange={(e) => setRequireLlm(e.target.checked)}
                  className="accent-accent"
                />
                <span className={isValidationMode ? 'opacity-60' : ''}>
                  Require LLM
                  {isValidationMode && <span className="text-secondary/60"> (forced on by validation)</span>}
                </span>
              </label>

              <RadioGroup
                label="Comprehension mode"
                value={comprehensionMode}
                onChange={(v) => setComprehensionMode(v as ComprehensionMode)}
                options={[
                  { value: 'agentic', label: 'Agentic', hint: 'Static evidence + verified claims.' },
                  { value: 'classic', label: 'Classic', hint: 'Deterministic only.' },
                ]}
              />

              <RadioGroup
                label="Budget profile"
                value={budgetProfile}
                onChange={(v) => setBudgetProfile(v as BudgetProfile)}
                options={[
                  { value: 'strict', label: 'Strict' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'max_quality', label: 'Max quality' },
                ]}
              />

              <RadioGroup
                label="Scope"
                value={scope}
                onChange={(v) => setScope(v as Scope)}
                options={[
                  { value: 'backend', label: 'Backend only' },
                  { value: 'full_repo', label: 'Full repo' },
                ]}
              />

              <div>
                <label className="text-[10px] text-secondary uppercase tracking-wide block mb-1">
                  Model override
                </label>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="leave empty to use env default"
                  className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-primary font-mono outline-none focus:border-accent placeholder:text-secondary/40"
                />
              </div>
            </div>
          </details>

          {error && (
            <div className="text-xs text-accent bg-accent/10 border border-accent/20 rounded px-3 py-2 wrap-break-word">
              {error}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!repoPath.trim() || loading}
            className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Starting Analysis...
              </>
            ) : (
              'Analyze Repository'
            )}
          </button>
        </div>

        <p className="text-[10px] text-secondary/60 text-center mt-6">
          The analysis will parse your codebase, build a knowledge graph, and run AI agents to discover architecture, generate documentation, and enable intelligent queries.
        </p>
      </div>
    </div>
  );
}

interface RadioOption {
  value: string;
  label: string;
  hint?: string;
}

function RadioGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: RadioOption[];
}) {
  return (
    <div>
      <span className="text-[10px] text-secondary uppercase tracking-wide block mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              title={opt.hint}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                active
                  ? 'bg-accent/15 text-accent border-accent/40'
                  : 'bg-surface text-secondary border-border hover:text-primary'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
