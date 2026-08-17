/**
 * Keyboard-navigable tree equivalent of the architecture canvas.
 * @startingPoint section="Epistemic" subtitle="Accessible architecture tree with Origin column" viewport="700x340"
 */
export interface ArchitectureTreeNode {
  id: string;
  label: string;
  kind: 'region' | 'cluster' | 'residual' | 'module' | 'symbol';
  moduleCount?: number;
  /** When present, the row announces "AI interpretation: <name>" before the neutral label. */
  aiName?: string;
  children?: ArchitectureTreeNode[];
}
export interface ArchitectureTreeProps {
  items: ArchitectureTreeNode[];
  /** id → open. Missing means open. */
  expanded?: Record<string, boolean>;
  onToggle?: (id: string) => void;
  onActivate?: (node: ArchitectureTreeNode) => void;
}
export function ArchitectureTree(props: ArchitectureTreeProps): JSX.Element;
