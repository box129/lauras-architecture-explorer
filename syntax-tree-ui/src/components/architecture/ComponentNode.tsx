import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import clsx from 'clsx';
import { useSyntaxTreeStore } from '../../store';
import { computeHeatColor, cohesionToColor } from '../../utils/colors';

export interface ComponentNodeData {
  qn: string;
  name: string;
  domain: string;
  memberCount: number;
  cohesion: number;
  coupling: number;
  layer: string;
  degree: number;
  maxDegree: number;
  [key: string]: unknown;
}

const ComponentNode = memo(({ data }: { data: ComponentNodeData }) => {
  const selectedQN = useSyntaxTreeStore((s) => s.selectedQN);
  const heatmapMode = useSyntaxTreeStore((s) => s.heatmapMode);
  const heartbeatOn = useSyntaxTreeStore((s) => s.heartbeatOn);
  const selectNode = useSyntaxTreeStore((s) => s.selectNode);
  const setContextMenu = useSyntaxTreeStore((s) => s.setContextMenu);

  const isSelected = selectedQN === data.qn;
  const heatBg = heatmapMode !== 'none' ? computeHeatColor(heatmapMode, data as unknown as Record<string, unknown>) : undefined;

  const pulseScale = heartbeatOn ? 1 + (data.degree / (data.maxDegree || 1)) * 0.04 : 1;
  const pulseSpeed = heartbeatOn ? Math.max(1.5, 3 - (data.degree / (data.maxDegree || 1)) * 1.5) : 0;

  return (
    <div
      className={clsx(
        'rounded-lg border px-3 py-2 cursor-pointer w-[200px]',
        'bg-surface text-primary border-border',
        isSelected && 'ring-2 ring-accent',
        !heartbeatOn && 'transition-colors',
      )}
      style={{
        backgroundColor: heatBg,
        animation: pulseSpeed > 0
          ? `heartbeat ${pulseSpeed}s ease-in-out infinite`
          : 'none',
        '--pulse-scale': pulseScale,
      } as React.CSSProperties}
      onClick={() => selectNode(data.qn)}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, qn: data.qn });
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2 !border-0" />
      <div className="text-sm font-medium truncate">{data.name}</div>
      <div className="text-xs text-secondary mt-0.5">
        {data.domain} &middot; {data.memberCount} members
      </div>
      <div className="mt-1.5 h-[3px] rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${(data.cohesion ?? 0) * 100}%`,
            backgroundColor: cohesionToColor(data.cohesion ?? 0),
          }}
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2 !border-0" />
    </div>
  );
});

ComponentNode.displayName = 'ComponentNode';
export default ComponentNode;
