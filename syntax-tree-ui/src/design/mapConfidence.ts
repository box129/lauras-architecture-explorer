/**
 * Shared copy/formatting for the architecture-map "confidence" numbers
 * (node/component/edge/orientation confidence -- see
 * `syntax_tree_refurbished/app/architecture_map/projection.py` and
 * `app/overview/system_overview_generator.py` on the backend, which is
 * where every one of these percentages actually originates).
 *
 * This is a deterministic, structural/classification score: how confident
 * Laura's static-analysis pipeline is that an area was correctly
 * identified, grouped, or resolved (e.g. a symbol whose source region
 * resolved gets 1.0, one that didn't gets 0.6; a repo-shape guess backed
 * by strong local signals scores higher than an "unknown repo shape"
 * fallback). It is produced entirely by local, deterministic heuristics --
 * never by the Architectural Explanation LLM, and never by the claim
 * verifier.
 *
 * It is a genuinely different concept from a claim's SUPPORTED /
 * INSUFFICIENT EVIDENCE / CONTRADICTED status (see
 * `features/architectural-explanation/claimStatus.ts`), which carries no
 * percentage at all. Every place this number is rendered in the UI must
 * say so explicitly, per the Claude Design UX audit finding F01
 * (`qa-audit/claude-design-ux-review/findings.json`) -- a bare "NN%
 * confidence" badge next to the same visual vocabulary used for claim
 * status invites a reader to assume it IS a claim-confidence or
 * AI-confidence score, which it never is.
 */
export const MAP_CONFIDENCE_EXPLANATION =
  "How confident Laura's structural analysis is that this area/relationship was correctly identified and classified. " +
  'This is a static-analysis classification score, not a claim verification status, and not the AI’s confidence in a generated explanation.';

export function formatMapConfidencePercent(value: number | null | undefined): number {
  return Math.round((value ?? 0) * 100);
}

/** Short label used inline next to the percentage, e.g. "72% map confidence". */
export const MAP_CONFIDENCE_LABEL = 'map confidence';
