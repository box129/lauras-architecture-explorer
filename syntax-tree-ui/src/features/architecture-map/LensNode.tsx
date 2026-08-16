import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Box,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Component,
  Database,
  FileCode2,
  Folder,
  FolderCode,
  FolderTree,
  GitBranch,
  Lightbulb,
  Network,
  SearchCode,
  ShieldCheck,
  Unplug,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import StatusBadge from '../observatory/StatusBadge';
import type { ObservatoryNode } from '../observatory/types';

const icons: Record<string, LucideIcon> = {
  Box,
  Boxes,
  CircleAlert,
  Component,
  Database,
  FileCode2,
  Folder,
  FolderCode,
  FolderTree,
  GitBranch,
  Lightbulb,
  Network,
  SearchCode,
  ShieldCheck,
  Unplug,
  Workflow,
};

interface LensNodeData extends Record<string, unknown> {
  // Phase C1: present only for a node rendered inside a nested
  // containment tree (see mapLayout's layoutContainmentNodes). `isExpanded
  // === true` means this instance IS the big enclosing frame for an
  // expanded container -- its own real children render as separate,
  // nested ReactFlow nodes on top of it, so the frame itself renders only
  // a header, never re-describing its members (that would duplicate what
  // its now-visible children already show).
  isContainer?: boolean;
  isExpanded?: boolean;
  directChildCount?: number;
  /** Entity Focus: this node is the centred entity — visually dominant. */
  isFocal?: boolean;
}

interface LensNodeProps {
  data: LensNodeData;
  selected?: boolean;
}

const LensNode = memo(({ data, selected = false }: LensNodeProps) => {
  const node = data as unknown as ObservatoryNode;
  const isSelected = selected || data.isSelected === true;
  const Icon = icons[node.icon] ?? Box;

  if (data.isExpanded) {
    // Phase C1: the enclosing frame for an expanded container -- a plain
    // header, no member list/description (its real children are the
    // separately-rendered nested nodes visible inside it). Clicking the
    // header collapses it back; this never pushes navigation/breadcrumb
    // state (see ArchitectureMapCanvas's onNodeClick).
    return (
      <div className="obs-rf-container-frame" data-accent={node.accent}>
        <button type="button" className="obs-rf-container-frame__header" aria-label={`${node.label}, repository region, ${data.directChildCount ?? 0} sections, collapse`}>
          <FolderTree size={20} strokeWidth={1.6} />
          <span className="obs-rf-container-frame__title">{node.label}</span>
          <span className="obs-rf-container-frame__count">{node.childrenCount} module{node.childrenCount === 1 ? '' : 's'}</span>
          <ChevronDown size={16} strokeWidth={2} className="obs-rf-container-frame__collapse" aria-hidden="true" />
        </button>
      </div>
    );
  }
  // Phase B: a structural_group is a deterministic repository section
  // (real directory containment), not a single analyzed file/symbol --
  // it gets a visually distinct, larger "domain card" treatment (see
  // mapLayout's GROUP_NODE_WIDTH/HEIGHT for the matching canvas footprint)
  // so it reads as "a container of things" rather than another leaf card,
  // per the Participant #1 remediation's "this is a category, and it's
  // selectable" requirement -- never relying on color alone. "repository
  // section" is a neutral, non-overclaiming term (never "architectural
  // domain") shown identically in both the visible chip and the
  // accessible name, so screen-reader and sighted users get the same fact.
  const isGroup = node.kind === 'structural_group';
  const kindLabel = isGroup ? 'repository section' : node.kind.replaceAll('_', ' ');
  // Phase C1: a COLLAPSED container (real sub-containers/leaf buckets
  // exist but aren't shown yet) is interacted with differently from a
  // leaf group -- clicking it expands in place rather than navigating
  // (see ArchitectureMapCanvas's onNodeClick), so its hint/affordance must
  // say so honestly rather than reusing the leaf's "select to explore"
  // drill-down language.
  const isCollapsedContainer = isGroup && data.isContainer === true;
  // Participant 1 formative finding: a real user scrolled the map but never
  // attempted a click -- despite every card already being a real, focusable
  // <button> with hover/cursor affordance -- because that affordance is only
  // discoverable by hovering, and nothing on the card itself signals
  // "this is a category, and it's selectable" at rest. The visible kind chip
  // and drill-down chevron below are always-on, not hover-dependent.
  const accessibleAction = isCollapsedContainer ? 'expand' : node.canDrilldown ? 'select to explore' : 'select';
  const representativeMembers = node.primaryFiles.slice(0, 5);
  const additionalMemberCount = Math.max(0, node.childrenCount - representativeMembers.length);
  return (
    <button
      className={`obs-rf-node ${isGroup ? 'obs-rf-node--group' : ''} ${isSelected ? 'obs-rf-node--selected' : ''} ${data.isFocal === true ? 'obs-rf-node--focal' : ''}`}
      type="button"
      aria-label={`${node.label}, ${kindLabel}, ${node.status}, ${accessibleAction}`}
    >
      <Handle type="target" position={Position.Left} className="obs-rf-handle" />
      <span className="obs-rf-node__icon" data-accent={node.accent}>
        <Icon size={isGroup ? 30 : 25} strokeWidth={1.6} />
      </span>
      <span className="obs-rf-node__body">
        <span className="obs-rf-node__title-row">
          <span className="obs-rf-node__kind">{kindLabel}</span>
          {node.warnings && node.warnings.length > 0 && (
            <CircleAlert className="obs-rf-node__warning" size={14} strokeWidth={1.8} />
          )}
        </span>
        <span className="obs-rf-node__title">{node.label}</span>
        {isGroup ? (
          <>
            <span className="obs-rf-node__group-count">
              {node.childrenCount} module{node.childrenCount === 1 ? '' : 's'}
            </span>
            {representativeMembers.length > 0 && (
              <span className="obs-rf-node__group-members">
                Contains: {representativeMembers.join(', ')}
                {additionalMemberCount > 0 ? `, +${additionalMemberCount} more` : ''}
              </span>
            )}
            <span className="obs-rf-node__group-hint">{isCollapsedContainer ? 'Select to expand' : 'Select to explore'}</span>
          </>
        ) : (
          <>
            <span className="obs-rf-node__description">{node.description}</span>
            <span className="obs-rf-node__meta">
              <StatusBadge status={node.status} showLabel />
              {node.evidenceCount > 0 && <span>{node.evidenceCount} evidence</span>}
              {node.childrenCount > 0 && <span>{node.childrenCount} areas</span>}
            </span>
          </>
        )}
      </span>
      {node.canDrilldown && (
        <span className="obs-rf-node__drilldown" aria-hidden="true">
          {isCollapsedContainer ? <ChevronDown size={16} strokeWidth={2} /> : <ChevronRight size={16} strokeWidth={2} />}
        </span>
      )}
      <Handle type="source" position={Position.Right} className="obs-rf-handle" />
    </button>
  );
});

LensNode.displayName = 'LensNode';
export default LensNode;
