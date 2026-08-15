import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

export default function SemanticEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const kind = typeof data?.visualKind === 'string' ? data.visualKind : 'dependency';
  return <BaseEdge id={id} path={edgePath} className={`obs-rf-edge obs-rf-edge--${kind}`} />;
}
