import type { EvidenceStatus } from '../core/StatusBadge';

/** One evidence item; clicking opens the exact source span. */
export interface EvidenceRowProps {
  filePath: string;
  startLine?: number;
  endLine?: number;
  /** Why this span is evidence — include the extractor and version when known. */
  reason?: string;
  /** Verbatim source excerpt, clamped to 3 lines. */
  preview?: string;
  status?: EvidenceStatus;
  active?: boolean;
  /** Omit when the relation has no navigable source region; never fake a location. */
  onClick?: () => void;
}
export function EvidenceRow(props: EvidenceRowProps): JSX.Element;
