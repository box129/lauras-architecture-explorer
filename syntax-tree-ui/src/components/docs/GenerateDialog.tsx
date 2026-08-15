import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { EditorContent, ReactRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import { X, Sparkles, Loader2, AlertTriangle, CheckCircle2, ListChecks } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { useDocOptions } from '../../api/hooks';
import type { DocMentionResponse, DocMentionTarget, DocPlanResponse, GenerateDocResponse } from '../../api/types';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorBanner from '../shared/ErrorBanner';

interface GenerateDialogProps {
  onClose: () => void;
  onGenerated: (qn: string) => void;
}

export default function GenerateDialog({ onClose, onGenerated }: GenerateDialogProps) {
  const { data: optionsData, loading: optionsLoading, error: optionsError, refetch } = useDocOptions();
  const [artifactType, setArtifactType] = useState('overview');
  const [scopeQN, setScopeQN] = useState('');
  const [maxWords, setMaxWords] = useState(6000);
  const [plan, setPlan] = useState<DocPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateDocResponse | null>(null);

  const promptEditor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Describe the artifact. Type [ to reference code or architecture nodes.' }),
      Mention.configure({
        HTMLAttributes: { class: 'doc-mention' },
        renderText({ node }) {
          return `[[${node.attrs.id}|${node.attrs.label}]]`;
        },
        suggestion: {
          char: '[',
          items: async ({ query }) => {
            const data = await fetchApi<DocMentionResponse>(`/docs/mentions?q=${encodeURIComponent(query)}`);
            return Object.values(data.groups).flat().slice(0, 12);
          },
          command: ({ editor, range, props }) => {
            editor
              .chain()
              .focus()
              .insertContentAt(range, [{ type: 'mention', attrs: props }, { type: 'text', text: ' ' }])
              .run();
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: HTMLDivElement | null = null;
            return {
              onStart: (props) => {
                component = new ReactRenderer(MentionList, { props, editor: props.editor });
                popup = document.createElement('div');
                popup.className = 'doc-mention-popup';
                popup.appendChild(component.element);
                document.body.appendChild(popup);
                positionPopup(popup, props.clientRect?.());
              },
              onUpdate(props) {
                component?.updateProps(props);
                if (popup) positionPopup(popup, props.clientRect?.());
              },
              onKeyDown(props) {
                return (component?.ref as { onKeyDown?: (props: { event: KeyboardEvent }) => boolean } | null)?.onKeyDown?.(props) || false;
              },
              onExit() {
                component?.destroy();
                popup?.remove();
              },
            };
          },
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'doc-prompt-editor min-h-32 outline-none',
      },
    },
  });

  const scopes = useMemo(() => {
    const groups = optionsData?.scopes || {};
    return Object.entries(groups).flatMap(([group, items]) =>
      items.map((item) => ({
        ...item,
        group,
        label: `${group.replace(/_/g, ' ')} / ${item.name}`,
      })),
    );
  }, [optionsData]);

  const promptText = () => serializePrompt(promptEditor?.getJSON()).trim();

  const handlePlan = async () => {
    if (!scopeQN || !promptText()) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    setResult(null);
    try {
      const response = await fetchApi<DocPlanResponse>('/docs/plan', {
        method: 'POST',
        body: JSON.stringify({
          scope_qn: scopeQN,
          artifact_type: artifactType,
          user_request: promptText(),
          references: [],
          max_words: maxWords,
        }),
      });
      setPlan(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Planning failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!plan) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetchApi<GenerateDocResponse>('/docs/generate', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: plan.plan_id,
          title: plan.title,
          outline: plan.outline,
          assumptions: plan.assumptions,
                  evidence_targets: plan.evidence_targets,
                  risks: plan.risks,
                }),
      });
      setResult(response);
      onGenerated(response.qualified_name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[920px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-hidden bg-surface border border-border rounded-lg shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 border-b border-border flex items-center px-4 gap-2 shrink-0">
          <Sparkles size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-primary">Documentation Agent</h3>
          <div className="flex-1" />
          <button onClick={onClose} className="text-secondary hover:text-primary" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {optionsLoading ? (
          <LoadingSpinner className="py-12" />
        ) : optionsError ? (
          <div className="p-4"><ErrorBanner message={optionsError} onRetry={refetch} /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-[minmax(0,1fr)_340px] gap-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Artifact type">
                  <select value={artifactType} onChange={(e) => setArtifactType(e.target.value)} className="doc-input">
                    {(optionsData?.artifact_types || []).map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Word budget">
                  <input
                    type="number"
                    min={500}
                    max={6000}
                    step={250}
                    value={maxWords}
                    onChange={(e) => setMaxWords(Number(e.target.value))}
                    className="doc-input"
                  />
                </Field>
              </div>

              <Field label="Scope">
                <select value={scopeQN} onChange={(e) => setScopeQN(e.target.value)} className="doc-input">
                  <option value="">Select architecture or code scope...</option>
                  {scopes.map((scope) => (
                    <option key={scope.qualified_name} value={scope.qualified_name}>{scope.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Prompt">
                <div className="bg-bg border border-border rounded p-3 text-sm text-primary">
                  <EditorContent editor={promptEditor} />
                </div>
              </Field>

              {error && (
                <div className="text-xs text-accent bg-accent/10 border border-accent/20 rounded px-3 py-2 wrap-break-word">{error}</div>
              )}

              {!plan && (
                <button
                  onClick={handlePlan}
                  disabled={!scopeQN || !promptText() || loading}
                  className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Planning...</> : <><ListChecks size={14} /> Create Plan</>}
                </button>
              )}

              {plan && (
                <PlanReview plan={plan} onChange={setPlan} onGenerate={handleGenerate} generating={generating} result={result} />
              )}
            </div>

            <div className="bg-bg border border-border rounded p-3 overflow-y-auto">
              <div className="text-xs text-primary font-medium mb-3">Planning Evidence</div>
              {plan ? (
                <div className="space-y-3 text-xs">
                  <div className={`rounded border px-2 py-2 ${plan.planning_fallback_used ? 'border-warning/30 bg-warning/10 text-warning' : 'border-success/30 bg-success/10 text-success'}`}>
                    {plan.planning_fallback_used ? 'Fallback scaffold plan' : `LLM-backed plan${plan.planning_model ? ` (${plan.planning_model})` : ''}`}
                  </div>
                  <EvidenceMetric label="Architecture entities" value={plan.evidence_summary.architecture_entities} />
                  <EvidenceMetric label="Code entities" value={plan.evidence_summary.code_entities} />
                  <EvidenceMetric label="Files" value={plan.evidence_summary.files} />
                  <EvidenceMetric label="Dependencies" value={plan.evidence_summary.dependencies} />
                  <ListBlock title="Resolved references" items={plan.resolved_references.map((ref) => `${ref.type}: ${ref.label}`)} />
                  <ListBlock title="Intended claims" items={plan.intended_claims || []} />
                  <ListBlock title="Clarifying questions" items={plan.questions || []} warning />
                  <ListBlock title="Risks" items={plan.risks} warning />
                  <ListBlock title="Planning errors" items={plan.planning_errors || []} warning />
                </div>
              ) : (
                <p className="text-xs text-secondary">
                  Create a plan first. References inserted with <span className="text-info font-mono">[[node|label]]</span> will be resolved before writing.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanReview({
  plan,
  onChange,
  onGenerate,
  generating,
  result,
}: {
  plan: DocPlanResponse;
  onChange: (plan: DocPlanResponse) => void;
  onGenerate: () => void;
  generating: boolean;
  result: GenerateDocResponse | null;
}) {
  return (
    <div className="border border-border rounded bg-bg p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs text-primary font-medium">
        <ListChecks size={14} className="text-info" />
        Review Plan
      </div>
      <Field label="Title">
        <input value={plan.title} onChange={(e) => onChange({ ...plan, title: e.target.value })} className="doc-input" />
      </Field>
      <EditableList title="Outline" items={plan.outline} onChange={(outline) => onChange({ ...plan, outline })} />
      <EditableList title="Assumptions" items={plan.assumptions} onChange={(assumptions) => onChange({ ...plan, assumptions })} />
      <EditableList title="Evidence targets" items={plan.evidence_targets} onChange={(evidence_targets) => onChange({ ...plan, evidence_targets })} />
      <EditableList title="Risks" items={plan.risks} onChange={(risks) => onChange({ ...plan, risks })} />
      <button
        onClick={onGenerate}
        disabled={generating}
        className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {generating ? <><Loader2 size={14} className="animate-spin" /> Generating sections...</> : <><Sparkles size={14} /> Approve And Generate</>}
      </button>
      {result && (
        <div className="flex items-center gap-2 text-xs text-success">
          <CheckCircle2 size={14} />
          <span>Artifact generated</span>
          {result.run_metadata?.fallback_used && (
            <span className="ml-auto text-warning flex items-center gap-1"><AlertTriangle size={12} /> fallback</span>
          )}
        </div>
      )}
    </div>
  );
}

function EditableList({ title, items, onChange }: { title: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <Field label={title}>
      <textarea
        value={items.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
        className="doc-input min-h-24 resize-y"
      />
    </Field>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-secondary mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b border-border pb-1">
      <span className="text-secondary">{label}</span>
      <span className="text-primary font-mono">{value}</span>
    </div>
  );
}

function ListBlock({ title, items, warning }: { title: string; items: string[]; warning?: boolean }) {
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wide font-semibold mb-1 ${warning ? 'text-warning' : 'text-secondary'}`}>{title}</div>
      {items.length ? (
        <div className="space-y-1">
          {items.map((item, index) => (
            <div key={`${title}-${index}`} className="text-[11px] text-secondary border border-border rounded px-2 py-1 wrap-break-word">
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-secondary/60">None</div>
      )}
    </div>
  );
}

function MentionList(props: {
  items: DocMentionTarget[];
  command: (item: { id: string; label: string }) => void;
}) {
  return (
    <div className="py-1">
      {props.items.length ? props.items.map((item) => (
        <button
          key={item.qualified_name}
          className="w-full text-left px-2 py-1.5 hover:bg-border/60"
          onClick={() => props.command({ id: item.qualified_name, label: item.label })}
        >
          <div className="text-xs text-primary">{item.label}</div>
          <div className="text-[10px] text-secondary font-mono truncate">{item.type} · {item.qualified_name}</div>
        </button>
      )) : (
        <div className="px-2 py-1.5 text-xs text-secondary">No matches</div>
      )}
    </div>
  );
}

function positionPopup(el: HTMLDivElement, rect: DOMRect | null | undefined) {
  if (!rect) return;
  el.style.position = 'fixed';
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.bottom + 6}px`;
  el.style.zIndex = '60';
}

function serializePrompt(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const current = node as {
    type?: string;
    text?: string;
    attrs?: { id?: string; label?: string };
    content?: unknown[];
  };
  if (current.type === 'text') return current.text || '';
  if (current.type === 'mention') {
    const id = current.attrs?.id || '';
    const label = current.attrs?.label || id;
    return id ? `[[${id}|${label}]]` : label;
  }
  const childText = (current.content || []).map(serializePrompt).join('');
  if (current.type === 'paragraph' || current.type === 'heading') return `${childText}\n`;
  if (current.type === 'listItem') return `- ${childText.trim()}\n`;
  return childText;
}
