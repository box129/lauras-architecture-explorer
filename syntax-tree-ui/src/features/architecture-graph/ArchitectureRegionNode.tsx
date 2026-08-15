import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ArrowUpRight, ChevronDown, FolderTree, Network } from 'lucide-react';
import type { ObservatoryNode } from '../observatory/types';

type RegionData = ObservatoryNode & { isContainer?: boolean; internalRelationCount?: number; isSelected?: boolean; expandHint?: string; detailLevel?: 'far' | 'mid' | 'near' };

/** Root graph vocabulary: spatial regions first, structural paths second. */
export default function ArchitectureRegionNode({ data }: NodeProps) {
  const node = data as unknown as RegionData;
  // A root group is a map region even when it has no visible children. This
  // prevents a small or flat repository from falling back to card-like leaves.
  const region = !node.parentGroupId;
  const group = !region;
  const detail = node.detailLevel ?? 'near';
  return <section className={`architecture-region-node ${region ? 'architecture-region-node--region' : 'architecture-region-node--group'} ${node.isSelected ? 'architecture-region-node--selected' : ''}`}>
    <Handle type="target" position={Position.Left} className="architecture-region-node__handle" />
    <header className="architecture-region-node__header">
      <span className="architecture-region-node__eyebrow">{region ? 'Structural region' : 'Structural group'}</span>
      <strong>{node.label}</strong>
      {region && detail !== 'far' && <span className="architecture-region-node__basis" title={node.summary}>{node.summary}</span>}
    </header>
    <div className="architecture-region-node__metrics">
      <span>{node.childrenCount} module{node.childrenCount === 1 ? '' : 's'}</span>
      {detail === 'near' && !!node.internalRelationCount && <span><Network size={12} /> {node.internalRelationCount} internal</span>}
    </div>
    {region && detail !== 'far' && <footer className="architecture-region-node__actions"><span><ChevronDown size={14} /> Shift-click expand</span><span><ArrowUpRight size={14} /> Double-click enter</span></footer>}
    {group && <FolderTree className="architecture-region-node__mark" size={15} aria-hidden="true" />}
    <Handle type="source" position={Position.Right} className="architecture-region-node__handle" />
  </section>;
}
