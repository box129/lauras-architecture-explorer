import { useMemo, useState } from 'react';
import { ArrowLeft, BookmarkPlus, Code2, Copy, Expand, Minimize2, X } from 'lucide-react';
import { evidenceStatusMeta, type EvidenceStatus } from '../../design/status';
import type { CodeCompanionSelection, QueryResponseDTO, QuestionLensDTO, QuestionLensStepDTO } from '../architecture-map/apiTypes';
import StatusBadge from '../observatory/StatusBadge';
import { questionLensProofSelection, questionStepProofSelection, questionStepStatus } from './questionLensProof';

interface UnderstandingPaneProps {
  response: QueryResponseDTO | null;
  lens: QuestionLensDTO | null;
  lenses: QuestionLensDTO[];
  selectedStep: QuestionLensStepDTO | null;
  question: string;
  loading: boolean;
  error: string | null;
  onBackToArchitecture: () => void;
  onClose: () => void;
  onOpenProof: (selection: CodeCompanionSelection) => void;
  onSelectStep: (stepId: string | null) => void;
  onSelectLens: (lens: QuestionLensDTO) => void;
  onSaveLens?: () => void;
}

type PaneTab = 'simple' | 'technical' | 'evidence';

export default function UnderstandingPane({
  response,
  lens,
  lenses,
  selectedStep,
  question,
  loading,
  error,
  onBackToArchitecture,
  onClose,
  onOpenProof,
  onSelectStep,
  onSelectLens,
  onSaveLens,
}: UnderstandingPaneProps) {
  const [tab, setTab] = useState<PaneTab>(() => {
    if (typeof window === 'undefined') return 'simple';
    const value = new URLSearchParams(window.location.search).get('understandingTab');
    return value === 'technical' || value === 'evidence' ? value : 'simple';
  });
  const [expanded, setExpanded] = useState(false);
  const proved = lens?.evidence.length ?? 0;
  const gaps = lens?.gaps ?? [];
  const title = selectedStep?.label ?? lens?.title ?? 'Understanding Pane';
  const status = selectedStep ? questionStepStatus(selectedStep) : normalizeStatus(lens?.status);
  const whatThisMeans = useMemo(() => {
    const text = lens?.simple_explanation || response?.answer_text || '';
    return splitReadableBullets(text);
  }, [lens?.simple_explanation, response?.answer_text]);

  return (
    <aside className={expanded ? 'obs-understanding-pane obs-understanding-pane--expanded' : 'obs-understanding-pane'} aria-label="Understanding Pane">
      <header className="obs-understanding-pane__header">
        <div>
          <span>Answer</span>
          <h2>{title}</h2>
        </div>
        <div className="obs-understanding-pane__actions">
          <button type="button" aria-label="Back to architecture" onClick={onBackToArchitecture}><ArrowLeft size={15} /></button>
          {onSaveLens && <button type="button" aria-label="Save answer lens" onClick={onSaveLens}><BookmarkPlus size={15} /></button>}
          <button type="button" aria-label={expanded ? 'Compact reading pane' : 'Expand reading pane'} onClick={() => setExpanded((value) => !value)}>
            {expanded ? <Minimize2 size={15} /> : <Expand size={15} />}
          </button>
          <button type="button" aria-label="Close answer" onClick={onClose}><X size={15} /></button>
        </div>
      </header>

      {loading ? (
        <div className="obs-understanding-state">
          <strong>Building a source-backed lens...</strong>
          <span>Reading answer structure, evidence, and source proof before redrawing the canvas.</span>
        </div>
      ) : error ? (
        <div className="obs-understanding-state obs-understanding-state--error">
          <strong>Question request failed</strong>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <section className="obs-understanding-summary">
            <div className="obs-understanding-question">{question}</div>
            <div className="obs-understanding-chips">
              <span className="obs-chip"><StatusBadge status={status} />{status}</span>
              <span className="obs-chip">{Math.round(((selectedStep?.confidence ?? lens?.confidence ?? response?.confidence ?? 0) || 0) * 100)}% confidence</span>
              <span className="obs-chip">{proved} evidence</span>
              {gaps.length > 0 && <span className="obs-chip">{gaps.length} gaps</span>}
            </div>
            <p>{selectedStep ? stepExplanation(selectedStep) : lens?.simple_explanation || response?.answer_text}</p>
          </section>

          {lenses.length > 0 && (
            <section className="obs-ranked-lenses" aria-labelledby="ranked-lenses-title">
              <h3 id="ranked-lenses-title">Ranked answer lenses</h3>
              <ol>
                {lenses.slice(0, 10).map((candidate, index) => {
                  const relevance = candidate.metadata.relevance_score;
                  return (
                    <li key={candidate.id}>
                      <button
                        aria-pressed={candidate.id === lens?.id}
                        className={candidate.id === lens?.id ? 'obs-ranked-lenses__item obs-ranked-lenses__item--active' : 'obs-ranked-lenses__item'}
                        onClick={() => onSelectLens(candidate)}
                        type="button"
                      >
                        <span className="obs-ranked-lenses__rank">{index + 1}</span>
                        <span><strong>{candidate.title}</strong><small>{candidate.description || candidate.simple_explanation}</small></span>
                        {typeof relevance === 'number' && <span>{boundedPercent(relevance)}%</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <nav className="obs-rail-tabs" aria-label="Understanding detail mode">
            {(['simple', 'technical', 'evidence'] as const).map((item) => (
              <button className={tab === item ? 'obs-rail-tabs__tab obs-rail-tabs__tab--active' : 'obs-rail-tabs__tab'} key={item} onClick={() => setTab(item)} type="button">
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </nav>

          {tab === 'simple' && (
            <div className="obs-understanding-section">
              <h3>What this means</h3>
              <ul>
                {(whatThisMeans.length ? whatThisMeans : ['The answer is available, but the backend did not return enough explanation detail to summarize further.']).slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3>What the system proved</h3>
              <p>{proved ? `${proved} source-backed evidence items support this answer.` : 'No direct source evidence was returned for this answer.'}</p>
              {gaps.length > 0 && (
                <>
                  <h3>What is uncertain</h3>
                  <ul>{gaps.slice(0, 3).map((gap) => <li key={gap.reason}>{gap.reason.replaceAll('_', ' ')}</li>)}</ul>
                </>
              )}
              {response?.follow_ups.length ? (
                <>
                  <h3>Suggested next questions</h3>
                  <div className="obs-understanding-followups">
                    {response.follow_ups.slice(0, 4).map((followUp) => <button type="button" key={followUp}>{followUp}</button>)}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {tab === 'technical' && (
            <div className="obs-understanding-section">
              <h3>Technical explanation</h3>
              <p>{selectedStep ? stepTechnical(selectedStep) : lens?.technical_explanation || response?.answer_text}</p>
              {lens?.steps.length ? (
                <>
                  <h3>Lens steps</h3>
                  <div className="obs-understanding-step-list">
                    {lens.steps.map((step) => (
                      <button
                        className={selectedStep?.id === step.id ? 'obs-understanding-step-list__item obs-understanding-step-list__item--active' : 'obs-understanding-step-list__item'}
                        key={step.id}
                        onClick={() => onSelectStep(step.id)}
                        type="button"
                      >
                        <StatusBadge status={questionStepStatus(step)} />
                        <span>{step.label}</span>
                        {step.file_path && <small>{shortFile(step.file_path)}:{step.start_line}</small>}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              {lens?.searched_areas.length ? <p className="obs-muted">Searched: {lens.searched_areas.join(', ')}</p> : null}
            </div>
          )}

          {tab === 'evidence' && (
            <div className="obs-understanding-section">
              <div className="obs-understanding-proof-actions">
                {lens && (
                  <button type="button" onClick={() => onOpenProof(questionLensProofSelection(lens))}>
                    <Code2 size={15} /> View answer proof
                  </button>
                )}
                {lens && selectedStep && (
                  <button type="button" onClick={() => onOpenProof(questionStepProofSelection(lens, selectedStep))}>
                    <Code2 size={15} /> View step proof
                  </button>
                )}
                <button type="button" onClick={() => void navigator.clipboard?.writeText(window.location.href)}>
                  <Copy size={15} /> Copy link
                </button>
              </div>
              <h3>Evidence</h3>
              {lens?.evidence.length ? (
                <div className="obs-understanding-evidence-list">
                  {lens.evidence.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => onOpenProof({
                        subject_type: 'question_lens',
                        subject_id: lens.id,
                        title: lens.title,
                        evidence_id: item.id,
                        span_id: item.source_ref_id,
                        file_path: item.file_path,
                        start_line: item.start_line,
                        open: true,
                      })}
                    >
                      <StatusBadge status={item.status} />
                      <span>{item.reason || item.text_preview}</span>
                      <small>{shortFile(item.file_path)}:{item.start_line}-{item.end_line}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p>No evidence rows were returned for this answer.</p>
              )}
              {lens?.source_tabs.length ? (
                <>
                  <h3>Source tabs</h3>
                  <div className="obs-understanding-source-tabs">
                    {lens.source_tabs.map((sourceTab) => (
                      <button
                        key={`${sourceTab.file_path}:${sourceTab.role}`}
                        onClick={() => onOpenProof({
                          subject_type: 'question_lens',
                          subject_id: lens.id,
                          title: `${lens.title}: ${sourceTab.role}`,
                          span_id: sourceTab.source_span_ids[0] ?? sourceTab.highlights[0]?.span_id,
                          file_path: sourceTab.file_path,
                          start_line: sourceTab.highlights[0]?.start_line,
                          reason: sourceTab.reason || sourceTab.summary,
                          open: true,
                        })}
                        type="button"
                      >
                        <Code2 size={15} />
                        <span><strong>{shortFile(sourceTab.file_path)}</strong><small>{sourceTab.role}: {sourceTab.summary}</small></span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function splitReadableBullets(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stepExplanation(step: QuestionLensStepDTO) {
  if (step.gap_reason) return `This step is important, but the backend marked it as a gap: ${step.gap_reason.replaceAll('_', ' ')}.`;
  return step.label;
}

function stepTechnical(step: QuestionLensStepDTO) {
  const file = step.file_path ? `${step.file_path}:${step.start_line}-${step.end_line}` : 'No source file returned';
  return `${step.step_type.replaceAll('_', ' ')} backed by ${file}.`;
}

function shortFile(path: string) {
  return path.split('/').slice(-2).join('/');
}

function normalizeStatus(status?: string | null): EvidenceStatus {
  const raw = status as EvidenceStatus;
  return raw && raw in evidenceStatusMeta ? raw : 'candidate';
}

function boundedPercent(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}
