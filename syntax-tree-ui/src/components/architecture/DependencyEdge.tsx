import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useSyntaxTreeStore } from '../../store';

const DependencyEdge = memo(({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  data,
  style,
}: EdgeProps) => {
  const heartbeatOn = useSyntaxTreeStore((s) => s.heartbeatOn);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const weight = (data?.total_weight as number) ?? (data?.weight as number) ?? 1;
  const label = (data?.calls_count as number)
    ? `${data?.calls_count} calls`
    : (data?.label as string) ?? '';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#2A2A3E',
          strokeWidth: 1,
          ...(heartbeatOn && weight > 0
            ? {
                strokeDasharray: '4 4',
                animation: `edge-flow ${Math.max(0.5, 2 - weight * 0.2)}s linear infinite`,
              }
            : {}),
          ...style,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-[9px] text-secondary bg-bg/90 px-1 rounded pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

DependencyEdge.displayName = 'DependencyEdge';
export default DependencyEdge;
