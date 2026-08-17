import type { ReactNode } from 'react';

/**
 * Layer-2 relation cluster, or the residual "ungrouped" bucket.
 * @startingPoint section="Epistemic" subtitle="Cluster, AI-labelled cluster, residual bucket" viewport="700x340"
 */
export interface ClusterCardProps {
  /** Neutral deterministic label, e.g. "Structural cluster 1". Never a guessed category word. */
  label: string;
  memberCount: number;
  /** Real member names; the first five render. */
  members?: string[];
  /** Internal relation count that justified the cluster. */
  relationCount?: number;
  /** Renders the honest no-relation bucket: borderless, no cluster chip, plain list. */
  residual?: boolean;
  selected?: boolean;
  /** Slot for an <AIInterpretationCard>. Sits between the neutral header and the member list. */
  aiSlot?: ReactNode;
  onOpenBasis?: () => void;
  onEnter?: () => void;
}
export function ClusterCard(props: ClusterCardProps): JSX.Element;
