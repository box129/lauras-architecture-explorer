import { evidenceStatusMeta, type EvidenceStatus } from '../../design/status';

interface StatusBadgeProps {
  status: EvidenceStatus;
  showLabel?: boolean;
  /** Overrides the shared, generic evidenceStatusMeta description for
   * this one usage -- e.g. claim cards need the exact SUPPORTED /
   * INSUFFICIENT EVIDENCE plain-language copy, which would be wrong if
   * applied to this badge's other, unrelated uses elsewhere. */
  title?: string;
}

export default function StatusBadge({ status, showLabel = false, title }: StatusBadgeProps) {
  const meta = evidenceStatusMeta[status];
  const description = title ?? meta.description;
  return (
    // aria-label carries the full description (not just the bare status
    // word) so a screen-reader user gets the same meaning a sighted user
    // would only get from hovering the (mouse-only, not keyboard-reachable)
    // native `title` tooltip -- see Claude Design UX audit finding F02.
    <span className="obs-status-wrap" title={description} aria-label={`${meta.label}: ${description}`}>
      <span className={meta.className} />
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}
