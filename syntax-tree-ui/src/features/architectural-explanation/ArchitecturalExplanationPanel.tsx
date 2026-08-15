import { X } from 'lucide-react';
import { useSyntaxTreeStore } from '../../store';
import StatusBadge from '../observatory/StatusBadge';
import ClaimCard from './ClaimCard';
import { claimBadgeHelpCopy, claimBadgeLabel, claimBadgeShortCopy, claimBadgeStatus } from './claimStatus';
import { useArchitecturalExplanation } from './useArchitecturalExplanation';
import type { ArchitecturalClaimSupportStatus } from './apiTypes';

/**
 * Always-visible (never hover-only) explanation of how to read the claims
 * below. Addresses Claude Design UX audit findings F02 (the documented
 * SUPPORTED/INSUFFICIENT EVIDENCE tooltip wasn't visibly reachable) and F06
 * (the clearest "model proposes, Laura's verifies" copy in the product
 * lived only in Settings, which becomes unreachable once a user has
 * drilled into an entity). This block duplicates -- deliberately, not by
 * accident -- the same conceptual framing already present in
 * `features/settings/SettingsPanel.tsx`, condensed for this context, so a
 * user never has to leave the explanation they're reading to understand
 * where it came from.
 */
const LEGEND_STATUSES: ArchitecturalClaimSupportStatus[] = ['supported', 'insufficient_evidence'];

function ExplanationLegend() {
  return (
    <div className="la-arch-explanation__legend" aria-label="How to read these architectural statements">
      <p className="la-arch-explanation__legend-intro">
        <strong>The model proposes architectural statements.</strong> Laura&rsquo;s then independently
        checks each one against recovered source evidence &mdash; the model never decides what is
        true.
      </p>
      <dl className="la-arch-explanation__legend-terms">
        {LEGEND_STATUSES.map((status) => (
          <div className="la-arch-explanation__legend-term" key={status}>
            <dt>
              <StatusBadge status={claimBadgeStatus(status)} title={claimBadgeHelpCopy(status)} />
              {claimBadgeLabel(status)}
            </dt>
            <dd>{claimBadgeHelpCopy(status)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface ArchitecturalExplanationPanelProps {
  entityId: string;
  entityLabel?: string;
  runId?: string;
  onClose: () => void;
}

/**
 * Panel rendering an entity's architectural explanation: the narrative,
 * then claims as cards (statement, relation type, SUPPORTED /
 * INSUFFICIENT EVIDENCE badge). Clicking a claim expands its evidence
 * chain down to source location (see `ClaimCard`).
 */
export default function ArchitecturalExplanationPanel({
  entityId,
  entityLabel,
  runId,
  onClose,
}: ArchitecturalExplanationPanelProps) {
  const { explanation, isLoading, error, isProviderUnavailable, retry } = useArchitecturalExplanation(entityId, runId);
  const openSettings = useSyntaxTreeStore((s) => s.openSettings);

  return (
    <section aria-label="Architectural explanation" className="la-arch-explanation">
      <header className="la-arch-explanation__header">
        <h3>Architectural Explanation{entityLabel ? `: ${entityLabel}` : ''}</h3>
        <button aria-label="Close architectural explanation" onClick={onClose} type="button">
          <X size={15} strokeWidth={1.8} />
        </button>
      </header>

      <ExplanationLegend />

      {isLoading && (
        <div className="obs-warning" role="status">
          <StatusBadge status="candidate" />
          <span>Loading architectural explanation...</span>
        </div>
      )}

      {error && isProviderUnavailable && (
        <div className="obs-warning obs-warning--unsupported la-arch-explanation__unavailable" role="alert">
          <p>
            <strong>Architectural explanation unavailable</strong>
          </p>
          <p>AI features unavailable. Deterministic analysis and architecture exploration still work.</p>
          <p className="obs-settings__hint--small">
            Repository analysis and the architecture map are unaffected &mdash; only claim-level
            explanations for this entity are unavailable right now.
          </p>
          <div className="la-arch-explanation__unavailable-actions">
            <button type="button" onClick={retry}>Retry</button>
            <button type="button" onClick={openSettings}>Open Settings</button>
          </div>
        </div>
      )}

      {error && !isProviderUnavailable && (
        <div className="obs-warning obs-warning--unsupported" role="alert">
          <StatusBadge status="unsupported" />
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !error && explanation && (
        <>
          <p className="la-arch-explanation__narrative">{explanation.narrative}</p>
          <div className="la-arch-explanation__counts">
            <span className="obs-chip la-arch-explanation__count" title={claimBadgeShortCopy('supported')}>
              <StatusBadge status="verified" />
              {explanation.supported_count} supported
            </span>
            <span className="obs-chip la-arch-explanation__count" title={claimBadgeShortCopy('insufficient_evidence')}>
              <StatusBadge status="insufficient" />
              {explanation.insufficient_evidence_count} insufficient evidence
            </span>
          </div>
          {explanation.claims.length > 0 ? (
            <ul className="la-claim-list">
              {explanation.claims.map((claim) => (
                <ClaimCard claim={claim} key={claim.id} />
              ))}
            </ul>
          ) : (
            <p className="obs-related__empty">No architectural statements were returned for this entity.</p>
          )}
        </>
      )}
    </section>
  );
}
