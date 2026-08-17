/**
 * Evidence-status dot with its plain-language description attached.
 * @startingPoint section="Core" subtitle="All eight evidence statuses" viewport="700x150"
 */
export type EvidenceStatus =
  | 'verified' | 'partial' | 'insufficient' | 'candidate'
  | 'inferred' | 'unsupported' | 'stale' | 'legacy';

export interface StatusBadgeProps {
  status: EvidenceStatus;
  /** Render the word next to the dot. */
  showLabel?: boolean;
  /** Overrides the shared description for one usage (e.g. claim-level SUPPORTED copy). */
  title?: string;
}
export function StatusBadge(props: StatusBadgeProps): JSX.Element;
export const evidenceStatusMeta: Record<EvidenceStatus, { label: string; description: string }>;
