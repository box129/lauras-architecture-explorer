import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useSyntaxTreeStore } from '../../store';

export interface SubsystemNodeData {
  qn: string;
  name: string;
  description: string;
  componentCount: number;
  healthScore: number;
  [key: string]: unknown;
}

const SubsystemNode = memo(({ data }: { data: SubsystemNodeData }) => {
  const selectedQN = useSyntaxTreeStore((s) => s.selectedQN);
  const expandedSubsystems = useSyntaxTreeStore((s) => s.expandedSubsystems);
  const toggleSubsystem = useSyntaxTreeStore((s) => s.toggleSubsystem);
  const selectNode = useSyntaxTreeStore((s) => s.selectNode);

  const isSelected = selectedQN === data.qn;
  const isExpanded = expandedSubsystems.includes(data.qn);

  return (
    <div
      className={clsx(
        'rounded-xl border px-4 py-3 cursor-pointer min-w-[280px]',
        'bg-surface/80 border-border',
        isSelected && 'ring-2 ring-accent',
      )}
      onClick={() => selectNode(data.qn)}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleSubsystem(data.qn);
          }}
          className="text-secondary hover:text-primary shrink-0"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-primary truncate">{data.name}</div>
          <div className="text-xs text-secondary">
            {data.componentCount} components
          </div>
        </div>
      </div>
      {data.description && !isExpanded && (
        <div className="text-xs text-secondary/70 mt-1 line-clamp-2">{data.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2 !border-0" />
    </div>
  );
});

SubsystemNode.displayName = 'SubsystemNode';
export default SubsystemNode;
