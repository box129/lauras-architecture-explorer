import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Code2, FileText, Network, RefreshCw } from 'lucide-react';
import { ApiError, fetchApi } from '../../api/client';
import { useSyntaxTreeStore } from '../../store';
import type { DocsStudioDraft, LensTour, SavedLens } from '../lens-library/types';
import SourceCode from './SourceCode';

interface DocsStudioProps {
  source: 'api' | 'fixture';
  scopeKey: string;
  lenses: SavedLens[];
  tours: LensTour[];
  drafts: DocsStudioDraft[];
  onSaveDraft: (draft: DocsStudioDraft) => void;
  onBack: () => void;
  onOpenLens: (lens: SavedLens) => void;
}

interface DocumentationHierarchyItem {
  id: string;
  parent_id: string | null;
  kind: string;
  name: string;
  qualified_name: string;
  path: string;
  start_line: number;
  end_line: number;
  signature: string | null;
  children: DocumentationHierarchyItem[];
}

interface DocumentationHierarchyResponse {
  analysis_run_id: string;
  repository_name: string;
  items: DocumentationHierarchyItem[];
}

interface DocumentationDependency {
  id: string;
  kind: string;
  name: string;
  path: string;
}

interface DocumentationDetailResponse {
  analysis_run_id: string;
  id: string;
  kind: string;
  name: string;
  qualified_name: string;
  summary: string;
  documentation: string;
  source: {
    path: string;
    language: string;
    start_line: number;
    end_line: number;
    text: string;
  };
  dependencies: DocumentationDependency[];
}

export default function DocsStudio(props: DocsStudioProps) {
  if (props.source === 'fixture') return <FixtureDocsStudio {...props} />;
  return <RepositoryDocsPortal onBack={props.onBack} />;
}

function RepositoryDocsPortal({ onBack }: Pick<DocsStudioProps, 'onBack'>) {
  const analysisRunId = useSyntaxTreeStore((state) => state.analysisRunId);
  const repositoryPath = useSyntaxTreeStore((state) => state.analysisRepositoryPath);
  const [hierarchy, setHierarchy] = useState<DocumentationHierarchyResponse | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelectedComponent());
  const [detail, setDetail] = useState<DocumentationDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRequest = useRef(0);

  const loadHierarchy = useCallback(async () => {
    setHierarchyLoading(true);
    setHierarchyError(null);
    try {
      const response = await fetchApi<DocumentationHierarchyResponse>('/docs/hierarchy');
      assertActiveRun(response.analysis_run_id, analysisRunId);
      const normalized = { ...response, items: buildHierarchy(response.items) };
      setHierarchy(normalized);
      const ids = new Set(flattenHierarchy(normalized.items).map((item) => item.id));
      const nextSelection = selectedId && ids.has(selectedId)
        ? selectedId
        : normalized.items[0]?.id ?? null;
      setSelectedId(nextSelection);
      writeSelectedComponent(nextSelection, analysisRunId, repositoryPath);
    } catch (error) {
      setHierarchy(null);
      setHierarchyError(readApiError(error, 'Repository documentation could not be loaded.'));
    } finally {
      setHierarchyLoading(false);
    }
  }, [analysisRunId, repositoryPath, selectedId]);

  useEffect(() => {
    void loadHierarchy();
  // The selected component is reconciled inside the request and must not re-fetch the hierarchy.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisRunId]);

  const loadDetail = useCallback(async (componentId: string) => {
    const requestId = ++detailRequest.current;
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetchApi<DocumentationDetailResponse>(`/docs/components/${encodeURIComponent(componentId)}`);
      assertActiveRun(response.analysis_run_id, analysisRunId);
      if (response.id !== componentId) {
        throw new ApiError(409, 'The documentation response did not match the selected component.');
      }
      if (requestId === detailRequest.current) setDetail(response);
    } catch (error) {
      if (requestId === detailRequest.current) {
        setDetailError(readApiError(error, 'Component documentation could not be loaded.'));
      }
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  }, [analysisRunId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const selectComponent = useCallback((componentId: string) => {
    setSelectedId(componentId);
    writeSelectedComponent(componentId, analysisRunId, repositoryPath);
  }, [analysisRunId, repositoryPath]);

  return (
    <main className="obs-docs-studio obs-docs-portal" aria-label="Repository documentation">
      <header className="obs-docs-topbar">
        <button type="button" onClick={onBack}><ArrowLeft size={15} /> Back to Observatory</button>
        <div>
          <span>Repository documentation</span>
          <h1>{hierarchy?.repository_name || repositoryDisplayName(repositoryPath)}</h1>
        </div>
        <div className="obs-docs-actions">
          <button type="button" onClick={() => void loadHierarchy()} disabled={hierarchyLoading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      {/* Participant 1 formative finding: "I finally found a doc studio but
          i see is a bunch of technical words with code, this is definitely
          not user friendly." Unlike the Observatory entry screen, this page
          previously opened straight into a raw component tree with no
          framing sentence at all. */}
      <p className="obs-docs-intro">
        Pick a component on the left to read its plain-language documentation and dependencies; its exact source code is available underneath, collapsed by default.
      </p>

      <div className="obs-docs-portal__grid">
        <aside className="obs-docs-hierarchy" aria-label="Documentation hierarchy">
          <div className="obs-docs-panel__title"><h2>Components</h2></div>
          {hierarchyLoading ? (
            <DocsState title="Loading repository hierarchy..." />
          ) : hierarchyError ? (
            <DocsState title="Hierarchy unavailable" message={hierarchyError} retry={() => void loadHierarchy()} />
          ) : !hierarchy?.items.length ? (
            <DocsState title="No documented components" message="The active analysis did not return a documentation hierarchy." />
          ) : (
            <nav aria-label="Repository components">
              <HierarchyBranch items={hierarchy.items} selectedId={selectedId} onSelect={selectComponent} />
            </nav>
          )}
        </aside>

        <article className="obs-docs-detail" aria-live="polite">
          {detailLoading ? (
            <DocsState title="Loading component documentation..." />
          ) : detailError ? (
            <DocsState
              title="Component unavailable"
              message={detailError}
              retry={selectedId ? () => void loadDetail(selectedId) : undefined}
            />
          ) : detail ? (
            <DocumentationDetail detail={detail} onSelectDependency={selectComponent} />
          ) : (
            <DocsState title="Select a component" message="Choose a component in the hierarchy to inspect its documentation and source." />
          )}
        </article>
      </div>
    </main>
  );
}

function HierarchyBranch({
  items,
  selectedId,
  onSelect,
}: {
  items: DocumentationHierarchyItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="obs-docs-tree">
      {items.map((item) => (
        <li key={item.id}>
          <button
            aria-current={item.id === selectedId ? 'page' : undefined}
            className={item.id === selectedId ? 'obs-docs-tree__item obs-docs-tree__item--active' : 'obs-docs-tree__item'}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            {item.children.length > 0 ? <ChevronRight size={13} /> : <FileText size={13} />}
            <span><strong>{item.name}</strong><small>{item.kind.replaceAll('_', ' ')}</small></span>
          </button>
          {item.children.length > 0 && <HierarchyBranch items={item.children} selectedId={selectedId} onSelect={onSelect} />}
        </li>
      ))}
    </ul>
  );
}

function DocumentationDetail({
  detail,
  onSelectDependency,
}: {
  detail: DocumentationDetailResponse;
  onSelectDependency: (id: string) => void;
}) {
  return (
    <>
      <header className="obs-docs-detail__header">
        <span>{detail.kind.replaceAll('_', ' ')}</span>
        <h2>{detail.name}</h2>
        <code>{detail.qualified_name}</code>
        {detail.summary && <p>{detail.summary}</p>}
      </header>

      <section className="obs-docs-detail__section" aria-labelledby="documentation-heading">
        <h3 id="documentation-heading">Documentation</h3>
        {detail.documentation
          ? <div className="obs-docs-prose">{detail.documentation}</div>
          : <p className="obs-muted">No narrative documentation was returned for this component.</p>}
      </section>

      <section className="obs-docs-detail__section" aria-labelledby="dependencies-heading">
        <h3 id="dependencies-heading"><Network size={16} /> Dependencies</h3>
        {detail.dependencies.length ? (
          <ul className="obs-docs-dependencies">
            {detail.dependencies.map((dependency) => (
              <li key={dependency.id}>
                <button type="button" onClick={() => onSelectDependency(dependency.id)}>
                  <span><strong>{dependency.name}</strong><small>{dependency.kind.replaceAll('_', ' ')}</small></span>
                  <code>{dependency.path}</code>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="obs-muted">No dependencies were reported for this component.</p>}
      </section>

      {/* Collapsed by default (Participant 1 formative finding: raw code
          was the first thing seen and felt "not user friendly"). The
          plain-language Documentation/Dependencies sections above stay
          open; the exact cited source is one click away, not removed. */}
      <details className="obs-docs-detail__section obs-docs-source-section">
        <summary className="obs-docs-source-heading">
          <span><Code2 size={16} /> Source</span>
          <span>{detail.source.path}:{detail.source.start_line}-{detail.source.end_line}</span>
        </summary>
        {detail.source.text ? (
          <pre className="obs-docs-source" tabIndex={0}><SourceCode language={detail.source.language} source={detail.source.text} /></pre>
        ) : <p className="obs-muted">Source text was not available for this component.</p>}
      </details>
    </>
  );
}

function DocsState({ title, message, retry }: { title: string; message?: string; retry?: () => void }) {
  return (
    <div className="obs-docs-state" role={message ? 'status' : undefined}>
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {retry && <button type="button" onClick={retry}><RefreshCw size={14} /> Retry</button>}
    </div>
  );
}

function FixtureDocsStudio({ lenses, tours, drafts, onBack, onOpenLens }: DocsStudioProps) {
  return (
    <main className="obs-docs-studio obs-docs-fixture" aria-label="Documentation fixture preview">
      <header className="obs-docs-topbar">
        <button type="button" onClick={onBack}><ArrowLeft size={15} /> Back to Observatory</button>
        <div><span>Fixture preview</span><h1>Repository documentation</h1></div>
        <div className="obs-docs-actions"><span>{tours.length} tours {'\u00b7'} {drafts.length} drafts</span></div>
      </header>
      <article className="obs-docs-detail">
        <header className="obs-docs-detail__header"><span>Saved evidence</span><h2>Preview lenses</h2></header>
        {lenses.length ? (
          <ul className="obs-docs-dependencies">
            {lenses.map((lens) => <li key={lens.id}><button type="button" onClick={() => onOpenLens(lens)}><strong>{lens.title}</strong><span>{lens.summary}</span></button></li>)}
          </ul>
        ) : <DocsState title="No saved fixture lenses" message="Save a lens in the fixture Observatory to include it in this preview." />}
      </article>
    </main>
  );
}

function readSelectedComponent(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('component');
}

function writeSelectedComponent(componentId: string | null, runId: string | null, repositoryPath: string | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (componentId) url.searchParams.set('component', componentId);
  else url.searchParams.delete('component');
  if (runId) url.searchParams.set('run', runId);
  if (repositoryPath) url.searchParams.set('repo', repositoryPath);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function assertActiveRun(responseRunId: string, activeRunId: string | null) {
  if (activeRunId && responseRunId !== activeRunId) {
    throw new ApiError(409, 'Documentation belongs to a different analysis run. Return to the Observatory and retry.');
  }
}

function readApiError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function repositoryDisplayName(repositoryPath: string | null): string {
  if (!repositoryPath) return 'Active repository';
  return repositoryPath.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? 'Active repository';
}

function flattenHierarchy(items: DocumentationHierarchyItem[]): DocumentationHierarchyItem[] {
  return items.flatMap((item) => [item, ...flattenHierarchy(item.children)]);
}

function buildHierarchy(items: DocumentationHierarchyItem[]): DocumentationHierarchyItem[] {
  if (items.some((item) => item.children.length > 0)) return items;
  const clones = new Map(items.map((item) => [item.id, { ...item, children: [] as DocumentationHierarchyItem[] }]));
  const roots: DocumentationHierarchyItem[] = [];
  for (const item of clones.values()) {
    const parent = item.parent_id ? clones.get(item.parent_id) : undefined;
    if (parent) parent.children.push(item);
    else roots.push(item);
  }
  return roots;
}
