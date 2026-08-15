/**
 * Layer-3 AI interpretation overlay for a deterministically fixed group.
 * @startingPoint section="Epistemic" subtitle="AI interpretation in all four states" viewport="700x320"
 */
export interface AIInterpretationCardProps {
  /** available = provider configured, nothing generated yet · generating · generated · unavailable = no provider. */
  state?: 'available' | 'generating' | 'generated' | 'unavailable';
  /** Model-authored group name. Never rendered without the AI chip. */
  name?: string;
  /** 1–2 model-authored sentences. */
  description?: string;
  /** The deterministic identity that stays true regardless, e.g. "Structural cluster 1 · 5 modules". Always pass it. */
  groundTruth?: string;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  /** Cache line, e.g. "cached from this run". */
  generatedAt?: string;
}
export function AIInterpretationCard(props: AIInterpretationCardProps): JSX.Element;
