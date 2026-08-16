import { ArrowUpRight, ChevronDown, CircleDashed, FolderTree, Network, PanelRightClose, PanelRightOpen, RefreshCw, Sparkles, Waypoints } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BACKEND_UNREACHABLE_MESSAGE, fetchApi, isBackendUnreachable } from '../../api/client';
import type { ObservatoryNode } from '../observatory/types';
import type { ArchitectureGraphResponse, ClusterInterpretationResponse } from './graphTypes';
import { architectureGraphScope } from './graphAdapter';

/** Epistemic layer chip: the word + icon travel together, so the layer
 * survives greyscale, dark mode and screen readers (L1 structure / L2
 * structural cluster — never a verification verdict). */
function LayerChip({ layer }: { layer: 'structure' | 'cluster' | 'residual' }) {
  if (layer === 'cluster') return <span className="epistemic-chip epistemic-chip--cluster"><Waypoints size={11} /> Structural cluster</span>;
  if (layer === 'residual') return <span className="epistemic-chip epistemic-chip--structure"><CircleDashed size={11} /> Ungrouped</span>;
  return <span className="epistemic-chip epistemic-chip--structure"><FolderTree size={11} /> Structure</span>;
}

export default function ArchitectureGraphInspector({ node, onEnter, onExpand, onFocusEntity, scopeGroupId }: { node: ObservatoryNode | null; onEnter: (node: ObservatoryNode) => void; onExpand: (node: ObservatoryNode) => void; onFocusEntity?: (node: ObservatoryNode) => void; scopeGroupId?: string | null }) {
  const [graph, setGraph] = useState<ArchitectureGraphResponse | null>(null);
  const [interpretation, setInterpretation] = useState<ClusterInterpretationResponse | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  // Distinguishes WHY no interpretation exists (live-audit defect: a
  // proxy 502 while the backend was down previously rendered as "No model
  // configured", a false statement). 'unavailable' remains reserved for
  // the backend's own honest no-model answer.
  const [interpretationFailure, setInterpretationFailure] = useState<'backend_unreachable' | 'request_failed' | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { void fetchApi<ArchitectureGraphResponse>('/architecture-graph').then(setGraph).catch(() => setGraph(null)); }, []);
  const scoped = useMemo(() => graph ? architectureGraphScope(graph, scopeGroupId) : null, [graph, scopeGroupId]);
  // architectureGraphScope excludes the scope's own group from `scoped`
  // (it becomes the implicit root of that view), so the current scope's
  // own label has to come from the unscoped graph -- needed only to make
  // the no-selection copy below say where the user actually is.
  const scopeGroup = useMemo(() => scopeGroupId ? graph?.groups.find((group) => group.id === scopeGroupId) ?? null : null, [graph, scopeGroupId]);
  const selected = useMemo(() => scoped?.groups.find((group) => group.id === node?.id) ?? null, [scoped, node?.id]);
  const incoming = useMemo(() => selected ? (scoped?.aggregate_edges.filter((edge) => edge.target_group_id === selected.id) ?? []) : [], [scoped, selected]);
  const outgoing = useMemo(() => selected ? (scoped?.aggregate_edges.filter((edge) => edge.source_group_id === selected.id) ?? []) : [], [scoped, selected]);
  const internal = useMemo(() => selected ? (scoped?.internal_relation_counts.filter((value) => value.group_id === selected.id) ?? []) : [], [scoped, selected]);
  useEffect(() => { setInterpretation(null); setInterpreting(false); setInterpretationFailure(null); }, [selected?.id]);
  const generateInterpretation = async () => {
    if (!selected) return;
    setInterpreting(true);
    setInterpretationFailure(null);
    try {
      setInterpretation(await fetchApi<ClusterInterpretationResponse>(`/architecture-graph/clusters/${encodeURIComponent(selected.id)}/interpretation`, { method: 'POST' }));
    } catch (error) {
      setInterpretation(null);
      setInterpretationFailure(isBackendUnreachable(error) ? 'backend_unreachable' : 'request_failed');
    } finally {
      setInterpreting(false);
    }
  };

  const collapseButton = (
    <button
      type="button"
      className="architecture-graph-inspector__collapse obs-icon-button"
      aria-label={collapsed ? 'Show inspector' : 'Hide inspector'}
      onClick={() => setCollapsed((current) => !current)}
    >
      {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
    </button>
  );

  if (collapsed) {
    return <aside className="architecture-graph-inspector architecture-graph-inspector--collapsed" aria-label="Architecture graph inspector">{collapseButton}</aside>;
  }
  if (!scoped) return <aside className="architecture-graph-inspector" aria-label="Architecture graph inspector">{collapseButton}</aside>;

  if (!selected || !node) {
    // Inside an entered scope, the scope's OWN internal relation counts
    // are the real resolved relations among the members on screen — they
    // are part of the honest relation total, not zero.
    const scopeInternal = scopeGroupId
      ? scoped.internal_relation_counts.filter((value) => value.group_id === scopeGroupId)
      : [];
    const scopeInternalTotal = scopeInternal.reduce((count, value) => count + value.member_relation_count, 0);
    return (
      <aside className="architecture-graph-inspector" aria-label="Architecture graph inspector">
        {collapseButton}
        <p className="architecture-graph-inspector__eyebrow">Repository</p>
        <h2>Architecture Overview</h2>
        <p className="architecture-graph-inspector__copy">{scopeGroup ? `Select a region, cluster, or module in ${scopeGroup.label} to inspect it.` : 'Select a structural region to inspect its recovered architecture.'}</p>
        <dl>
          <div><dt>Modules</dt><dd>{scoped.groups.filter((group) => !group.parent_group_id).reduce((count, group) => count + group.recursive_module_count, 0)}</dd></div>
          <div><dt>Regions</dt><dd>{scoped.groups.filter((group) => !group.parent_group_id).length}</dd></div>
          <div><dt>Relations</dt><dd>{scoped.aggregate_edges.length + scopeInternalTotal}</dd></div>
        </dl>
        {scopeInternal.length > 0 && (
          <section>
            <h3>Internal relations in this scope</h3>
            {scopeInternal.map((value) => <p key={value.relation_kind}>{value.relation_kind} · {value.member_relation_count}</p>)}
          </section>
        )}
        <p className="architecture-graph-inspector__hint"><Network size={15} /> Nothing here is inferred — every edge is a sum of real imports, calls and inheritance.</p>
      </aside>
    );
  }

  const children = scoped.groups.filter((group) => group.parent_group_id === selected.id).length;
  const relationRows = (
    <section className="architecture-graph-inspector__relations">
      <h3>Relations</h3>
      {[...incoming.map((edge) => ({ edge, direction: 'from' as const, other: edge.source_group_id })), ...outgoing.map((edge) => ({ edge, direction: 'to' as const, other: edge.target_group_id }))].slice(0, 8).map(({ edge, direction, other }) => (
        <p className="architecture-graph-inspector__relation-row" key={`${edge.id}-${direction}`}>
          <span>{edge.member_relation_count} {edge.relation_kind}</span>
          <span className="architecture-graph-inspector__relation-target">{direction} <code>{scoped.groups.find((group) => group.id === other)?.label ?? other}</code></span>
        </p>
      ))}
      {incoming.length + outgoing.length === 0 && <p className="architecture-graph-inspector__copy architecture-graph-inspector__copy--muted">No aggregate relation crosses this boundary in this run.</p>}
    </section>
  );

  if (selected.kind === 'relation_cluster') {
    return (
      <aside className="architecture-graph-inspector" aria-label="Selected deterministic relation cluster">
        {collapseButton}
        <p className="architecture-graph-inspector__eyebrow">Structural cluster</p>
        <LayerChip layer="cluster" />
        <h2>{selected.label}</h2>
        {interpretation?.interpretation ? (
          <div className="ai-interpretation-card">
            <p className="ai-interpretation-card__label"><Sparkles size={12} /> <span>AI interpretation</span><small>cached from this run</small></p>
            <strong className="ai-interpretation-card__name">{interpretation.interpretation.label}</strong>
            <p className="ai-interpretation-card__body">{interpretation.interpretation.description}</p>
            <button type="button" className="ai-interpretation-card__regenerate" onClick={() => void generateInterpretation()} disabled={interpreting}>
              <RefreshCw size={12} /> {interpreting ? 'Generating...' : 'Regenerate'}
            </button>
            <p className="ai-interpretation-card__ground-truth">
              <Waypoints size={11} /> <span className="architecture-graph-inspector__technical-label">Deterministic identity · {selected.label}</span>
              <span>{selected.recursive_module_count} modules, grouped by {selected.internal_relation_count ?? 0} real relations</span>
            </p>
          </div>
        ) : (
          <>
            <p className="architecture-graph-inspector__copy">Derived mechanically from resolved source relationships.</p>
            <div className="ai-interpretation-card ai-interpretation-card--empty">
              <p className="ai-interpretation-card__label"><Sparkles size={12} /> <span>AI interpretation</span></p>
              <button type="button" onClick={() => void generateInterpretation()} disabled={interpreting}>
                {interpreting ? 'Generating...' : interpretationFailure ? 'Retry' : 'Generate interpretation'}
              </button>
              {interpretation?.status === 'unavailable' && <p className="architecture-graph-inspector__copy architecture-graph-inspector__copy--muted">No model configured. Analysis is unaffected.</p>}
              {interpretationFailure === 'backend_unreachable' && (
                <p className="architecture-graph-inspector__copy architecture-graph-inspector__copy--error" role="alert">{BACKEND_UNREACHABLE_MESSAGE}</p>
              )}
              {interpretationFailure === 'request_failed' && (
                <p className="architecture-graph-inspector__copy architecture-graph-inspector__copy--error" role="alert">The interpretation request failed. The deterministic cluster data above is unaffected — retry when ready.</p>
              )}
            </div>
          </>
        )}
        <dl>
          <div><dt>Modules</dt><dd>{selected.recursive_module_count}</dd></div>
          <div><dt>Internal relations</dt><dd>{selected.internal_relation_count ?? 0}</dd></div>
          <div><dt>Boundary relations</dt><dd>{selected.boundary_relation_count ?? 0}</dd></div>
          <div><dt>Origin</dt><dd className="architecture-graph-inspector__origin">Relation clustering</dd></div>
        </dl>
        <section>
          <h3>Relation kinds</h3>
          <p><span>Internal relations</span><span> · {selected.internal_relation_count ?? 0}</span></p>
          {(selected.internal_relation_kind_counts ?? []).map(([kind, count]) => <p key={kind}>Internal {kind} · {count}</p>)}
          {(selected.boundary_relation_kind_counts ?? []).map(([kind, count]) => <p key={kind}>Boundary {kind} · {count}</p>)}
        </section>
        {relationRows}
        <div className="architecture-graph-inspector__actions"><button type="button" onClick={() => onExpand(node)}><ChevronDown size={15} /> Expand cluster</button></div>
      </aside>
    );
  }

  if (selected.kind === 'module') {
    const parent = scoped.groups.find((group) => group.id === selected.parent_group_id) ?? null;
    return (
      <aside className="architecture-graph-inspector" aria-label="Selected module">
        {collapseButton}
        <p className="architecture-graph-inspector__eyebrow">Module</p>
        <LayerChip layer="structure" />
        <h2 className="architecture-graph-inspector__module-name">{selected.label}</h2>
        <p className="architecture-graph-inspector__path">{selected.structural_path}</p>
        <dl>
          {parent && <div><dt>{parent.kind === 'relation_cluster' ? 'Cluster' : parent.kind === 'relation_residual' ? 'Grouping' : 'Section'}</dt><dd className="architecture-graph-inspector__origin">{parent.kind === 'relation_residual' ? 'Ungrouped' : parent.label}</dd></div>}
          <div><dt>Origin</dt><dd className="architecture-graph-inspector__origin">Source file</dd></div>
        </dl>
        <p className="architecture-graph-inspector__copy">A single analyzed source module. Its relations are counted in the containing {parent?.kind === 'relation_cluster' ? 'cluster' : 'region'} aggregates above this level.</p>
        {onFocusEntity && (
          <div className="architecture-graph-inspector__actions">
            <button type="button" onClick={() => onFocusEntity(node)}>
              <ArrowUpRight size={15} /> Focus this module
            </button>
          </div>
        )}
        <p className="architecture-graph-inspector__hint">Focus shows what depends on this module and what it depends on, from real recovered relations, with its architectural statements underneath.</p>
      </aside>
    );
  }

  if (selected.kind === 'relation_residual') {
    return (
      <aside className="architecture-graph-inspector" aria-label="Selected residual group">
        {collapseButton}
        <p className="architecture-graph-inspector__eyebrow">Ungrouped modules</p>
        <LayerChip layer="residual" />
        <h2>Ungrouped</h2>
        <p className="architecture-graph-inspector__copy">No relation connects these modules to any cluster in this run. This is a result, not an error.</p>
        <dl><div><dt>Modules</dt><dd>{selected.recursive_module_count}</dd></div></dl>
      </aside>
    );
  }

  return (
    <aside className="architecture-graph-inspector" aria-label="Selected architecture region">
      {collapseButton}
      <p className="architecture-graph-inspector__eyebrow">Structural region</p>
      <LayerChip layer="structure" />
      <h2>{node.label}</h2>
      <p className="architecture-graph-inspector__path">{selected.structural_path}</p>
      <dl>
        <div><dt>Modules</dt><dd>{selected.recursive_module_count}</dd></div>
        <div><dt>Child groups</dt><dd>{children}</dd></div>
        <div><dt>Origin</dt><dd className="architecture-graph-inspector__origin">Directory</dd></div>
      </dl>
      {internal.length > 0 && (
        <section>
          <h3>Internal relations</h3>
          {internal.map((value) => <p key={value.relation_kind}>{value.relation_kind} · {value.member_relation_count}</p>)}
        </section>
      )}
      {relationRows}
      <div className="architecture-graph-inspector__actions">
        <button type="button" onClick={() => onExpand(node)}><ChevronDown size={15} /> Expand</button>
        {selected.can_drilldown && <button type="button" onClick={() => onEnter(node)}><ArrowUpRight size={15} /> Enter</button>}
      </div>
    </aside>
  );
}
