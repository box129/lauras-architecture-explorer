import { BookmarkPlus, ChevronDown, ChevronUp, Code2, Maximize2, Minimize2, X } from 'lucide-react';
import { lazy, Suspense } from 'react';
import type {
  CodeCompanionSelection,
} from '../architecture-map/apiTypes';
import StatusBadge from '../observatory/StatusBadge';
import { useCodeCompanionData } from './useCodeCompanionData';

const ObservatoryMonaco = lazy(() => import('./ObservatoryMonaco'));

interface CodeCompanionProps {
  selection: CodeCompanionSelection | null;
  mode: 'closed' | 'collapsed' | 'open' | 'expanded';
  source: 'api' | 'fixture';
  previewState: string;
  onSelect: (selection: CodeCompanionSelection) => void;
  onModeChange: (mode: 'closed' | 'collapsed' | 'open' | 'expanded') => void;
  onSaveLens?: () => void;
}

export default function CodeCompanion({
  selection,
  mode,
  source,
  previewState,
  onSelect,
  onModeChange,
  onSaveLens,
}: CodeCompanionProps) {
  const enabled = Boolean(selection && mode !== 'closed');
  const { slice, fileContent, activeFilePath, activeSpanId, loading, fileLoading, error } = useCodeCompanionData(
    selection,
    enabled,
    source,
    previewState,
  );

  if (!selection || mode === 'closed') return null;

  if (mode === 'collapsed') {
    return (
      <section className="obs-code-companion obs-code-companion--collapsed" aria-label="Code Companion">
        <button type="button" onClick={() => onModeChange('open')}>
          <Code2 size={15} />
          <span>{selection.title || slice?.title || 'Source proof'}</span>
          <ChevronUp size={15} />
        </button>
      </section>
    );
  }

  const activeTab = slice?.tabs.find((tab) => tab.file_path === activeFilePath) ?? slice?.tabs[0] ?? null;
  const activeHighlight = activeTab?.highlights.find((highlight) => highlight.span_id === activeSpanId) ?? activeTab?.highlights[0] ?? null;
  const insufficient = slice && (!slice.tabs.length || slice.status === 'unsupported' || (slice.status === 'insufficient' && !slice.tabs.length));

  return (
    <section className={`obs-code-companion obs-code-companion--${mode}`} aria-label="Code Companion">
      <div className="obs-code-companion__bar">
        <div className="obs-code-companion__title">
          <Code2 size={16} strokeWidth={1.7} />
          <strong>{slice?.title || selection.title || 'Source proof'}</strong>
          {slice && (
            <span className="obs-chip">
              <StatusBadge status={slice.status} />
              {slice.status}
            </span>
          )}
          {activeHighlight && <span className="obs-code-range">{activeHighlight.start_line}-{activeHighlight.end_line}</span>}
        </div>
        <div className="obs-code-companion__controls">
          <button type="button" aria-label="Collapse proof" onClick={() => onModeChange('collapsed')}><ChevronDown size={15} /></button>
          {onSaveLens && <button type="button" aria-label="Save proof lens" onClick={onSaveLens}><BookmarkPlus size={15} /></button>}
          <button type="button" aria-label={mode === 'expanded' ? 'Restore proof size' : 'Expand proof'} onClick={() => onModeChange(mode === 'expanded' ? 'open' : 'expanded')}>
            {mode === 'expanded' ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button type="button" aria-label="Close proof" onClick={() => onModeChange('closed')}><X size={15} /></button>
        </div>
      </div>

      {slice?.tabs.length ? (
        <div className="obs-code-tabs" role="tablist" aria-label="Source files">
          {slice.tabs.map((tab) => (
            <button
              className={tab.file_path === activeFilePath ? 'obs-code-tabs__tab obs-code-tabs__tab--active' : 'obs-code-tabs__tab'}
              key={tab.file_path}
              onClick={() => onSelect({ ...selection, file_path: tab.file_path, span_id: tab.highlights[0]?.span_id, start_line: tab.highlights[0]?.start_line })}
              type="button"
            >
              <span>{fileName(tab.file_path)}</span>
              <small>{tab.role} - {tab.highlights.length}</small>
              {tab.is_stale && <StatusBadge status="stale" />}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="obs-code-state">Finding source proof...</div>
      ) : error ? (
        <div className="obs-code-state obs-code-state--error">{error}</div>
      ) : insufficient ? (
        <MissingProof sliceSummary={slice.summary} reason={slice.unsupported_reason || slice.gaps[0]} />
      ) : activeTab && fileContent ? (
        <div className="obs-code-companion__body">
          <div className="obs-code-sidebar">
            <p className="obs-code-sidebar__eyebrow">Evidence chain</p>
            <p>{activeTab.reason || activeTab.summary}</p>
            {/* The chain is ordered and numbered — it is a chain, not a
                list (07_EVIDENCE_SOURCE_SPEC). Each item names its exact
                source lines; the source pane renders the ACTIVE item. */}
            <ol className="obs-evidence-chain">
              {activeTab.highlights.map((highlight, index) => (
                <li key={highlight.span_id}>
                  <button
                    className={highlight.span_id === activeSpanId ? 'obs-evidence-chain__item obs-evidence-chain__item--active' : 'obs-evidence-chain__item'}
                    onClick={() => onSelect({ ...selection, file_path: activeTab.file_path, span_id: highlight.span_id, start_line: highlight.start_line })}
                    type="button"
                  >
                    <span className="obs-evidence-chain__number">{index + 1}</span>
                    <span className="obs-evidence-chain__locator">
                      <code>{fileName(activeTab.file_path)}:{highlight.start_line}{highlight.end_line !== highlight.start_line ? `–${highlight.end_line}` : ''}</code>
                      <small>{activeTab.role}</small>
                    </span>
                    <StatusBadge status={highlight.status} />
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="obs-code-editor">
            {fileLoading ? (
              <div className="obs-code-loading">Reading {activeTab.file_path}...</div>
            ) : (
              <Suspense
                fallback={(
                  <StaticCodePreview
                    activeEndLine={activeHighlight?.end_line}
                    activeStartLine={activeHighlight?.start_line}
                    content={fileContent.content}
                  />
                )}
              >
                <ObservatoryMonaco
                  activeSpanId={activeSpanId}
                  fileContent={fileContent}
                  highlights={activeTab.highlights}
                />
              </Suspense>
            )}
          </div>
        </div>
      ) : (
        <MissingProof sliceSummary="No source-backed implementation slice was returned for this item." reason="The backend has architecture metadata, but not enough source span evidence to open code." />
      )}
    </section>
  );
}

function MissingProof({ sliceSummary, reason }: { sliceSummary: string; reason?: string }) {
  return (
    <div className="obs-code-state">
      <strong>{sliceSummary}</strong>
      <span>{reason || 'The backend has architecture metadata, but not enough source span evidence to open code.'}</span>
    </div>
  );
}

function StaticCodePreview({
  content,
  activeStartLine,
  activeEndLine,
}: {
  content: string;
  activeStartLine?: number;
  activeEndLine?: number;
}) {
  const lines = content.split('\n');
  const start = Math.max((activeStartLine ?? 1) - 4, 1);
  const end = Math.min((activeEndLine ?? start + 18) + 4, lines.length);
  return (
    <pre className="obs-code-static-preview" aria-label="Source code preview">
      {lines.slice(start - 1, end).map((line, index) => {
        const number = start + index;
        const active = activeStartLine && activeEndLine && number >= activeStartLine && number <= activeEndLine;
        return (
          <span className={active ? 'obs-code-static-preview__line obs-code-static-preview__line--active' : 'obs-code-static-preview__line'} key={`${number}-${line}`}>
            <span className="obs-code-static-preview__number">{number}</span>
            <span>{line || ' '}</span>
          </span>
        );
      })}
    </pre>
  );
}

function fileName(path: string) {
  return path.split('/').pop() || path;
}
