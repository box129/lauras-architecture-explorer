import { ArrowUpRight, ChevronDown, Network } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchApi } from '../../api/client';
import type { ObservatoryNode } from '../observatory/types';
import type { ArchitectureGraphResponse } from './graphTypes';

export default function ArchitectureGraphInspector({ node, onEnter, onExpand }: { node: ObservatoryNode | null; onEnter: (node: ObservatoryNode) => void; onExpand: (node: ObservatoryNode) => void }) {
  const [graph, setGraph] = useState<ArchitectureGraphResponse | null>(null);
  useEffect(() => { void fetchApi<ArchitectureGraphResponse>('/architecture-graph').then(setGraph).catch(() => setGraph(null)); }, []);
  const selected = useMemo(() => graph?.groups.find((group) => group.id === node?.id) ?? null, [graph, node?.id]);
  const incoming = useMemo(() => selected ? (graph?.aggregate_edges.filter((edge) => edge.target_group_id === selected.id) ?? []) : [], [graph, selected]);
  const outgoing = useMemo(() => selected ? (graph?.aggregate_edges.filter((edge) => edge.source_group_id === selected.id) ?? []) : [], [graph, selected]);
  const internal = useMemo(() => selected ? (graph?.internal_relation_counts.filter((value) => value.group_id === selected.id) ?? []) : [], [graph, selected]);
  if (!graph) return <aside className="architecture-graph-inspector" aria-label="Architecture graph inspector" />;
  if (!selected || !node) return <aside className="architecture-graph-inspector" aria-label="Architecture graph inspector"><p className="architecture-graph-inspector__eyebrow">Architecture overview</p><h2>{graph.groups.reduce((count, group) => count + group.recursive_module_count, 0)} modules</h2><dl><div><dt>Regions</dt><dd>{graph.groups.filter((group) => !group.parent_group_id).length}</dd></div><div><dt>Aggregate relations</dt><dd>{graph.aggregate_edges.length}</dd></div></dl><p className="architecture-graph-inspector__copy"><Network size={15} /> Resolved calls, inheritance, and future imports are shown only when recovered deterministically.</p><p className="architecture-graph-inspector__hint">Select a structural region to inspect its relations.</p></aside>;
  const children = graph.groups.filter((group) => group.parent_group_id === selected.id).length;
  return <aside className="architecture-graph-inspector" aria-label="Selected architecture region"><p className="architecture-graph-inspector__eyebrow">Structural region</p><h2>{node.label}</h2><p className="architecture-graph-inspector__path">{selected.structural_path}</p><dl><div><dt>Modules</dt><dd>{selected.recursive_module_count}</dd></div><div><dt>Child groups</dt><dd>{children}</dd></div></dl>{internal.length > 0 && <section><h3>Internal relations</h3>{internal.map((value) => <p key={value.relation_kind}>{value.relation_kind} · {value.member_relation_count}</p>)}</section>}<section><h3>Boundary relations</h3><p>{outgoing.length} outgoing · {incoming.length} incoming</p>{[...outgoing, ...incoming].slice(0, 5).map((edge) => <p key={edge.id}>{edge.relation_kind} · {edge.member_relation_count}</p>)}</section><div className="architecture-graph-inspector__actions"><button type="button" onClick={() => onExpand(node)}><ChevronDown size={15} /> Expand</button><button type="button" onClick={() => onEnter(node)}><ArrowUpRight size={15} /> Enter</button></div></aside>;
}
