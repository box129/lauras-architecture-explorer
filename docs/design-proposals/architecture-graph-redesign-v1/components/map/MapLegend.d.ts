import type { EvidenceStatus } from '../core/StatusBadge';

/** Legend chip row shown over the map canvas. */
export interface MapLegendProps {
  statuses?: EvidenceStatus[];
  /** flow = solid slate · inferred = dashed clay · boundary = dotted stone. */
  edges?: ('flow' | 'inferred' | 'boundary')[];
}
export function MapLegend(props: MapLegendProps): JSX.Element;
