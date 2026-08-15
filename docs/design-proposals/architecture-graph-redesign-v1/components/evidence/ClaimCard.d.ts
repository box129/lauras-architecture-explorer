import type { ReactNode } from 'react';

/**
 * A single verified/unverified architectural claim. Render inside a <ul>.
 * @startingPoint section="Evidence" subtitle="Supported vs insufficient claim cards" viewport="700x260"
 */
export interface ClaimCardProps {
  /** The claim sentence, exactly as generated. */
  statement: string;
  /** Deterministic verification result — never an LLM opinion. */
  supportStatus?: 'supported' | 'insufficient_evidence' | 'contradicted';
  /** Relation line, e.g. "direct relation: calls". */
  relation?: string;
  /** Evidence chain rows, revealed when expanded. */
  children?: ReactNode;
  defaultExpanded?: boolean;
}
export function ClaimCard(props: ClaimCardProps): JSX.Element;
