import { ArrowUpRight, ChevronDown, CircleDashed, FolderTree, Network, PanelRightClose, PanelRightOpen, RefreshCw, Sparkles, Waypoints } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchApi } from '../../api/client';
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

export default function ArchitectureGraphInspector({ node, onEnter, onExpand, scopeGroupId }: { node: ObservatoryNode | null; onEnter: (node: ObservatoryNode) => void; onExpand: (node: ObservatoryNode) => void; scopeGroupId?: string | null }) {
  const [graph, setGraph] = useState<ArchitectureGraphResponse | null>(null);
  const [interpretation, setInterpretation] = useState<ClusterInterpretationResponse | null>(null);
  const [interpreting, setInterpreting] = useState(false);
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
  useEffect(() => { setInterpretation(null); setInterpreting(false); }, [selected?.id]);
  const generateInterpretation = async () => { if (!selected) return; setInterpreting(true); try { setInterpretation(await fetchApi<ClusterInterpretationResponse>(`/architecture-graph/clusters/${encodeURIComponent(selected.id)}/interpretation`, { method: 'POST' })); } catch { setInterpretation({ analysis_run_id: selected.analysis_run_id, cluster_id: selected.id, status: 'unavailable' }); } finally { setInterpreting(false); } };

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
    return (
      <aside className="architecture-graph-inspector" aria-label="Architecture graph inspector">
        {collapseButton}
        <p className="architecture-graph-inspector__eyebrow">Repository</p>
        <h2>Architecture Overview</h2>
        <p className="architecture-graph-inspector__copy">{scopeGroup ? `Select a region, cluster, or module in ${scopeGroup.label} to inspect it.` : 'Select a structural region to inspect its recovered architecture.'}</p>
        <dl>
          <div><dt>Modules</dt><dd>{scoped.groups.filter((group) => !group.parent_group_id).reduce((count, group) => count + group.recursive_module_count, 0)}</dd></div>
          <div><dt>Regions</dt><dd>{scoped.groups.filter((group) => !group.parent_group_id).length}</dd></div>
          <div><dt>Relations</dt><dd>{scoped.aggregate_edges.length}</dd></div>
        </dl>
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
              <button type="button" onClick={() => void generateInterpretation()} disabled={interpreting}>{interpreting ? 'Generating...' : 'Generate interpretation'}</button>
              {interpretation?.status === 'unavailable' && <p className="architecture-graph-inspector__copy architecture-graph-inspector__copy--muted">No model configured. Analysis is unaffected.</p>}
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
