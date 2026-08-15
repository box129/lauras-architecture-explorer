/**
 * Provenance mark for the five kinds of fact Laura's holds.
 * @startingPoint section="Epistemic" subtitle="Structure · cluster · AI · verified · evidence" viewport="700x150"
 */
export interface ProvenanceChipProps {
  /** structure = L1 directory containment · cluster = L2 relation-derived group · ai = L3 model interpretation · verified = L4 checked statement · evidence = exact source span. */
  kind?: 'structure' | 'cluster' | 'ai' | 'verified' | 'evidence';
  /** Overrides the standard word. Do not use it to relabel a layer as another layer. */
  label?: string;
  size?: 'sm' | 'md';
}
export function ProvenanceChip(props: ProvenanceChipProps): JSX.Element;
export const provenanceMeta: Record<string, { label: string; icon: string; description: string }>;
