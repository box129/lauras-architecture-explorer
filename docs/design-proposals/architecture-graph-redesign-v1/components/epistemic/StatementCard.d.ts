/**
 * Layer-4 architectural statement with its verification verdict.
 * @startingPoint section="Epistemic" subtitle="Supported, insufficient and contradicted statements" viewport="700x300"
 */
export interface StatementCardProps {
  statement: string;
  /** The verifier's result. Never set from a model's opinion. */
  status?: 'supported' | 'insufficient_evidence' | 'contradicted';
  /** Machine relation line, e.g. "calls · direct_relation". */
  relation?: string;
  evidenceCount?: number;
  selected?: boolean;
  onOpenEvidence?: () => void;
}
export function StatementCard(props: StatementCardProps): JSX.Element;
