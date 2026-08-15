import type { EvidenceStatus } from '../../design/status';
import type { ArchitecturalClaimSupportStatus } from './apiTypes';

/**
 * Maps a claim's `support_status` onto this codebase's existing
 * verified/insufficient/unsupported badge vocabulary (`design/status.ts`,
 * used throughout the observatory/grounding/investigation features) rather
 * than inventing new colors for this feature.
 */
export function claimBadgeStatus(status: ArchitecturalClaimSupportStatus): EvidenceStatus {
  switch (status) {
    case 'supported':
      return 'verified';
    case 'insufficient_evidence':
      return 'insufficient';
    case 'contradicted':
      return 'unsupported';
    default:
      return 'candidate';
  }
}

/**
 * Explicit, unambiguous badge copy. Deliberately literal ("SUPPORTED" /
 * "INSUFFICIENT EVIDENCE") rather than derived from `evidenceStatusMeta`'s
 * softer labels ("Verified" / "Insufficient") -- the task brief requires
 * these exact two states to read as clearly distinct and never equally
 * confident.
 */
export function claimBadgeLabel(status: ArchitecturalClaimSupportStatus): string {
  switch (status) {
    case 'supported':
      return 'SUPPORTED';
    case 'insufficient_evidence':
      return 'INSUFFICIENT EVIDENCE';
    case 'contradicted':
      return 'CONTRADICTED';
    default:
      return String(status).toUpperCase().replaceAll('_', ' ');
  }
}

/**
 * Plain-language help copy for a claim's badge tooltip (product-hardening
 * round, PHASE 6): a first-time user should understand what SUPPORTED and
 * INSUFFICIENT EVIDENCE mean without reading the dissertation. Wording is
 * fixed by the task brief, in particular the explicit "does NOT
 * automatically mean the statement is false" clarification for
 * insufficient evidence.
 */
export function claimBadgeHelpCopy(status: ArchitecturalClaimSupportStatus): string {
  switch (status) {
    case 'supported':
      return "Laura's found deterministic source-derived evidence establishing this proposition.";
    case 'insufficient_evidence':
      return "Laura's does not currently have enough deterministic evidence to establish this proposition. It does NOT automatically mean the statement is false.";
    case 'contradicted':
      return 'Deterministic verification against the current run found evidence that contradicts this proposition.';
    default:
      return claimBadgeLabel(status);
  }
}

/**
 * Short, ALWAYS-VISIBLE caption shown directly under every individual badge
 * occurrence -- not gated behind hover, focus, or the shared legend.
 *
 * Participant 1 formative finding: a real first-time user read SUPPORTED as
 * "the system prefers those kind of modules" and INSUFFICIENT EVIDENCE as
 * "the system hasn't been fully built yet" -- despite the legend at the top
 * of the panel already stating the correct meaning in full. The legend
 * alone was not sufficient; meaning has to travel with the status wherever
 * it's read. Same semantics as `claimBadgeHelpCopy`, just short enough to
 * sit inline without a tooltip.
 */
export function claimBadgeShortCopy(status: ArchitecturalClaimSupportStatus): string {
  switch (status) {
    case 'supported':
      return 'Verified from available source evidence';
    case 'insufficient_evidence':
      return 'Not verified from the available source evidence — this does not mean the statement is false';
    case 'contradicted':
      return 'Contradicted by source evidence in the current run';
    default:
      return claimBadgeHelpCopy(status);
  }
}
