import { useState } from 'react';
import StatusBadge from '../observatory/StatusBadge';
import { claimBadgeHelpCopy, claimBadgeLabel, claimBadgeShortCopy, claimBadgeStatus } from './claimStatus';
import EvidenceChainView from './EvidenceChainView';
import type { ArchitecturalClaimDTO } from './apiTypes';

interface ClaimCardProps {
  claim: ArchitecturalClaimDTO;
}

const INSUFFICIENT_EVIDENCE_COPY =
  "Laura's deterministic analysis could not find direct evidence for this relationship in the current run.";

/**
 * One claim card. Clicking it expands the full evidence chain (each item's
 * description + relationship info + a way to open its exact source
 * location, per `EvidenceChainView`/`EvidenceItemRow`).
 *
 * Hard requirement (per task brief): an insufficient-evidence claim must
 * never read with the same visual weight/certainty as a supported one. This
 * is enforced two ways here, not just via the badge color:
 *   - `la-claim-card--<support_status>` on the wrapping <li> (see
 *     src/index.css) visibly mutes insufficient/contradicted cards
 *     (reduced-emphasis border/background) versus a normal-emphasis
 *     supported card.
 *   - insufficient-evidence claims always render the static, honest
 *     `INSUFFICIENT_EVIDENCE_COPY` disclaimer -- never fabricated, never
 *     omitted -- in addition to (not instead of) whatever evidence chain
 *     the backend did return.
 */
export default function ClaimCard({ claim }: ClaimCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isSupported = claim.support_status === 'supported';
  const isInsufficientEvidence = claim.support_status === 'insufficient_evidence';

  return (
    <li className={`la-claim-card la-claim-card--${claim.support_status}`}>
      <button
        aria-expanded={expanded}
        className="la-claim-card__header"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="la-claim-card__badge-column">
          <span
            className="obs-chip la-claim-card__badge"
            title={claimBadgeHelpCopy(claim.support_status)}
            aria-label={`${claimBadgeLabel(claim.support_status)}: ${claimBadgeHelpCopy(claim.support_status)}`}
          >
            <StatusBadge status={claimBadgeStatus(claim.support_status)} title={claimBadgeHelpCopy(claim.support_status)} />
            {claimBadgeLabel(claim.support_status)}
          </span>
          {/* Always visible -- not a tooltip, not gated behind hover/expand.
              See claimStatus.ts, claimBadgeShortCopy, for why. */}
          <span className="la-claim-card__badge-caption">{claimBadgeShortCopy(claim.support_status)}</span>
        </span>
        <span className="la-claim-card__statement">{claim.statement}</span>
        <span className="la-claim-card__relation">
          {claim.proposition.kind.replaceAll('_', ' ')}: {claim.proposition.relation_kind}
        </span>
      </button>

      {expanded && (
        <div className="la-claim-card__body">
          {isInsufficientEvidence && (
            <p className="la-claim-card__insufficient-copy">{INSUFFICIENT_EVIDENCE_COPY}</p>
          )}
          {!isSupported && !isInsufficientEvidence && (
            <p className="la-claim-card__insufficient-copy">
              This claim was contradicted by deterministic verification against the current run.
            </p>
          )}
          <EvidenceChainView chain={claim.evidence_chain} />
        </div>
      )}
    </li>
  );
}
