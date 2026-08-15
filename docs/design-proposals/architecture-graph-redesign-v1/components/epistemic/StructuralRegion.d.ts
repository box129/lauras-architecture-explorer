import type { ReactNode } from 'react';

/**
 * Layer-1 enclosing region for a real directory. Nests inside itself.
 * @startingPoint section="Epistemic" subtitle="Nested deterministic regions" viewport="700x320"
 */
export interface StructuralRegionProps {
  /** The real path fragment, e.g. "backend/src". Shown monospace; never Title-Cased into a fake domain name. */
  path: string;
  /** Recursive leaf count under this region. */
  moduleCount: number;
  /** 0 = top level; deeper levels get tighter padding and a smaller header. */
  depth?: number;
  expanded?: boolean;
  selected?: boolean;
  /** In-place expand/collapse. Ephemeral UI state — never a history entry. */
  onToggle?: () => void;
  /** Pushes a breadcrumb level. Omit for regions you cannot enter. */
  onEnter?: () => void;
  children?: ReactNode;
}
export function StructuralRegion(props: StructuralRegionProps): JSX.Element;
