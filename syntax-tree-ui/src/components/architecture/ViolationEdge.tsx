import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

const ViolationEdge = memo(({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const label = (data?.violation_type as string) || (data?.label as string) || 'violation';

  return (
    <>
      <defs>
        <filter id={`glow-${id}`}>
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#E94560" floodOpacity="0.6" />
        </filter>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#E94560',
          strokeWidth: 2,
          strokeDasharray: '6 4',
          animation: 'edge-flow 1.5s linear infinite reverse',
          filter: `url(#glow-${id})`,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="absolute text-[9px] text-accent bg-bg/90 px-1.5 py-0.5 rounded border border-accent/30 pointer-events-none"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

ViolationEdge.displayName = 'ViolationEdge';
export default ViolationEdge;
