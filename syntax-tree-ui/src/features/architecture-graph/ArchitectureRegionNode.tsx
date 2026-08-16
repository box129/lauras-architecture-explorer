import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ArrowUpRight, ChevronDown, ChevronUp, CircleDashed, FileCode2, FolderTree, Waypoints } from 'lucide-react';
import type { ObservatoryNode } from '../observatory/types';

type RegionData = ObservatoryNode & {
  isContainer?: boolean;
  isExpanded?: boolean;
  internalRelationCount?: number;
  isSelected?: boolean;
  detailLevel?: 'far' | 'mid' | 'near';
  memberPreview?: string[];
  memberModuleCount?: number;
  onExpand?: (id: string) => void;
  onEnter?: (node: ObservatoryNode) => void;
};

/**
 * The three map visual languages (19_ARCHITECTURE_GRAPH_SPEC):
 * A — structural region: enclosing container with its own header band;
 * B — structural cluster: contained relation-derived card, waypoints icon;
 * C — module: compact monospace chip.
 * The residual bucket renders as a dashed, low-weight card so it can never
 * read as a sixth cluster. Containment is literal — children lay out
 * inside the parent rect via the existing C1 compound hierarchy.
 */
export default function ArchitectureRegionNode({ data }: NodeProps) {
  const node = data as unknown as RegionData;
  const graphKind = (node.sourceRefs?.graph_kind as string[] | undefined)?.[0] ?? 'structural_leaf';
  // A root group is a map region even when it has no visible children. This
  // prevents a small or flat repository from falling back to card-like leaves.
  const region = !node.parentGroupId;
  const cluster = graphKind === 'relation_cluster';
  const residual = graphKind === 'relation_residual';
  const moduleNode = graphKind === 'module';
  const section = !region && !cluster && !residual && !moduleNode;
  const detail = node.detailLevel ?? 'near';
  const members = node.memberPreview ?? [];
  const moreMembers = Math.max(0, (node.memberModuleCount ?? 0) - members.length);
  const relationCount = node.internalRelationCount ?? 0;

  if (moduleNode) {
    return (
      <section className={`argn argn--module ${node.isSelected ? 'argn--selected' : ''}`}>
        <Handle type="target" position={Position.Left} className="argn__handle" />
        <FileCode2 size={12} aria-hidden="true" />
        <code>{node.label}</code>
        <Handle type="source" position={Position.Right} className="argn__handle" />
      </section>
    );
  }

  return (
    <section
      className={[
        'argn',
        region ? 'argn--region' : '',
        section ? 'argn--section' : '',
        cluster ? 'argn--cluster' : '',
        residual ? 'argn--residual' : '',
        node.isSelected ? 'argn--selected' : '',
      ].filter(Boolean).join(' ')}
    >
      <Handle type="target" position={Position.Left} className="argn__handle" />
      <header className="argn__header">
        <span className="sr-only">{cluster ? 'Structural cluster' : residual ? 'Ungrouped modules' : region ? 'Structural region' : 'Repository section'}</span>
        <span className="argn__title">
          {cluster ? <Waypoints size={13} aria-hidden="true" /> : residual ? <CircleDashed size={13} aria-hidden="true" /> : <FolderTree size={13} aria-hidden="true" />}
          <strong>{node.label}</strong>
        </span>
        <span className="argn__counts">
          {cluster
            ? `${node.childrenCount} module${node.childrenCount === 1 ? '' : 's'}${relationCount ? ` · ${relationCount} relation${relationCount === 1 ? '' : 's'}` : ''}`
            : residual
              ? `${node.childrenCount} module${node.childrenCount === 1 ? '' : 's'}`
              : `${node.childrenCount} module${node.childrenCount === 1 ? '' : 's'}`}
        </span>
      </header>
      {region && detail !== 'far' && node.summary !== node.label && (
        <p className="argn__basis" title={node.summary}>{node.summary}</p>
      )}
      {/* Member chips summarize a COLLAPSED container; once expanded, the
          real nested module nodes render inside it and the chips would
          duplicate them. */}
      {(region || cluster || residual || section) && !node.isExpanded && detail === 'near' && members.length > 0 && (
        <div className="argn__members" aria-hidden="true">
          {members.map((label) => <code key={label}>{label}</code>)}
          {moreMembers > 0 && <span className="argn__more">+{moreMembers}</span>}
        </div>
      )}
      {residual && detail !== 'far' && (
        <p className="argn__residual-note">no relation to any cluster in this run</p>
      )}
      {(region || cluster || section) && detail !== 'far' && (node.isContainer || node.canDrilldown) && (
        <footer className="argn__actions">
          {node.isContainer && (
            <button type="button" onClick={(event) => { event.stopPropagation(); node.onExpand?.(node.id); }}>
              {node.isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {node.isExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          {node.canDrilldown && (
            <button type="button" onClick={(event) => { event.stopPropagation(); node.onEnter?.(node); }}>
              <ArrowUpRight size={13} /> Enter
            </button>
          )}
        </footer>
      )}
      <Handle type="source" position={Position.Right} className="argn__handle" />
    </section>
  );
}
