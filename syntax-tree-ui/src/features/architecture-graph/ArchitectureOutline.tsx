import { ArrowUpRight, ChevronDown, ChevronRight, CircleDashed, FileCode2, FolderTree, Waypoints } from 'lucide-react';
import type { ObservatoryEdge, ObservatoryNode } from '../observatory/types';

/**
 * Outline — the compact, keyboard-first equivalent of the Map
 * (04_ARCHITECTURE_OVERVIEW_SPEC final revision). It renders the same
 * nodes, counts and hierarchy as the canvas, in the same order, with the
 * same selection and the same Expand / Enter actions — never a separately
 * computed second hierarchy. It is the accessible and compact-width path;
 * the canvas does not carry every accessibility requirement alone.
 */
export default function ArchitectureOutline({
  nodes,
  edges,
  visibleIds,
  expandedIds,
  selectedNodeId,
  onSelect,
  onToggleExpand,
  onEnter,
}: {
  nodes: ObservatoryNode[];
  edges: ObservatoryEdge[];
  visibleIds: ReadonlySet<string>;
  expandedIds: ReadonlySet<string>;
  selectedNodeId: string | null | undefined;
  onSelect: (node: ObservatoryNode) => void;
  onToggleExpand: (id: string) => void;
  onEnter: (node: ObservatoryNode) => void;
}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthOf = (node: ObservatoryNode): number => {
    let depth = 0;
    let parent = node.parentGroupId;
    while (parent && byId.has(parent)) {
      depth += 1;
      parent = byId.get(parent)?.parentGroupId;
    }
    return depth;
  };
  const childrenOf = (id: string | null) => nodes.filter((node) => (node.parentGroupId ?? null) === id);
  const ordered: ObservatoryNode[] = [];
  const walk = (parentId: string | null) => {
    for (const child of childrenOf(parentId)) {
      if (!visibleIds.has(child.id)) continue;
      ordered.push(child);
      walk(child.id);
    }
  };
  walk(null);
  const labelFor = (id: string) => byId.get(id)?.label ?? id;

  return (
    <div className="architecture-outline" aria-label="Architecture outline">
      <ul className="architecture-outline__tree">
        {ordered.map((node) => {
          const graphKind = (node.sourceRefs?.graph_kind as string[] | undefined)?.[0] ?? 'structural_leaf';
          const isContainer = nodes.some((candidate) => candidate.parentGroupId === node.id);
          const isExpanded = isContainer && expandedIds.has(node.id);
          const isSelected = selectedNodeId === node.id;
          const Icon = graphKind === 'relation_cluster' ? Waypoints : graphKind === 'relation_residual' ? CircleDashed : graphKind === 'module' ? FileCode2 : FolderTree;
          return (
            <li
              key={node.id}
              className={`architecture-outline__row${isSelected ? ' architecture-outline__row--selected' : ''}${graphKind === 'module' ? ' architecture-outline__row--module' : ''}`}
              style={{ ['--outline-depth' as string]: depthOf(node) }}
              aria-current={isSelected ? 'true' : undefined}
            >
              {isContainer ? (
                <button
                  type="button"
                  className="architecture-outline__twist"
                  aria-label={`${node.label} (${isExpanded ? 'collapse' : 'expand'})`}
                  onClick={() => onToggleExpand(node.id)}
                >
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span className="sr-only">{isExpanded ? 'Collapse' : 'Expand'}</span>
                </button>
              ) : (
                <span className="architecture-outline__twist architecture-outline__twist--leaf" aria-hidden="true" />
              )}
              <button type="button" className="architecture-outline__label obs-table-row-button" onClick={() => onSelect(node)}>
                <Icon size={13} aria-hidden="true" />
                <span>{node.label}</span>
              </button>
              <span className="architecture-outline__meta">
                {graphKind !== 'module' && `${node.childrenCount} module${node.childrenCount === 1 ? '' : 's'}`}
                {isSelected && <span className="architecture-outline__selected">Selected</span>}
              </span>
              <span className="architecture-outline__actions">
                {isContainer && (
                  <button type="button" onClick={() => onToggleExpand(node.id)}>{isExpanded ? 'Collapse' : 'Expand'}</button>
                )}
                {node.canDrilldown && (
                  <button type="button" onClick={() => onEnter(node)}><ArrowUpRight size={12} /> Enter</button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <section className="architecture-outline__relations" aria-label="Aggregate relations">
        <h3>Aggregate relations</h3>
        {edges.length === 0 ? (
          <p className="architecture-outline__empty">No relation passes the current filter.</p>
        ) : (
          <ul>
            {edges.map((edge) => (
              <li key={edge.id}>
                <span>{labelFor(edge.source)} → {labelFor(edge.target)}</span>
                <span className="architecture-outline__edge-kind">{edge.kind} · {Number((edge.sourceRefs?.member_relation_count as number[] | undefined)?.[0] ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
