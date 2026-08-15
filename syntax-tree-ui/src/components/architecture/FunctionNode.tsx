import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import clsx from 'clsx';
import { useSyntaxTreeStore } from '../../store';

export interface FunctionNodeData {
  qn: string;
  name: string;
  filePath: string;
  lineStart: number;
  depth?: number;
  [key: string]: unknown;
}

const FunctionNode = memo(({ data }: { data: FunctionNodeData }) => {
  const selectedQN = useSyntaxTreeStore((s) => s.selectedQN);
  const selectNode = useSyntaxTreeStore((s) => s.selectNode);
  const goToCode = useSyntaxTreeStore((s) => s.goToCode);
  const setContextMenu = useSyntaxTreeStore((s) => s.setContextMenu);

  const isSelected = selectedQN === data.qn;

  return (
    <div
      className={clsx(
        'rounded-md border px-2.5 py-1.5 cursor-pointer w-[160px]',
        'bg-surface text-primary border-border',
        isSelected && 'ring-2 ring-accent',
        'transition-colors hover:bg-bg',
      )}
      onClick={() => selectNode(data.qn)}
      onDoubleClick={() => goToCode(data.filePath, data.lineStart)}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, qn: data.qn });
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-1.5 !h-1.5 !border-0" />
      <div className="text-xs font-mono truncate">{data.name}</div>
      <div className="text-[10px] text-secondary mt-0.5 truncate">
        {data.filePath.split('/').pop()}:{data.lineStart}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-border !w-1.5 !h-1.5 !border-0" />
    </div>
  );
});

FunctionNode.displayName = 'FunctionNode';
export default FunctionNode;
