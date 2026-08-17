import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

export default function SemanticEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const kind = typeof data?.visualKind === 'string' ? data.visualKind : 'dependency';
  const edgeClass = typeof data?.edgeClass === 'string' ? data.edgeClass : '';
  const label = typeof data?.edgeLabel === 'string' ? data.edgeLabel : null;
  return <>
    <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} className={`obs-rf-edge obs-rf-edge--${kind} ${edgeClass}`} />
    {label && <EdgeLabelRenderer><span className="architecture-graph-edge-label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>{label}</span></EdgeLabelRenderer>}
  </>;
}
