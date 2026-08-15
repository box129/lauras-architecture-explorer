import type { EvidenceStatus } from '../core/StatusBadge';

/**
 * One card on the architecture map.
 * @startingPoint section="Map" subtitle="Entity card and repository-section card" viewport="700x220"
 */
export interface LensNodeProps {
  label: string;
  /** Raw backend kind, e.g. "component", "module", "class", "method". Underscores render as spaces. */
  kind?: string;
  description?: string;
  status?: EvidenceStatus;
  /** Icon circle tint. */
  accent?: 'slate' | 'citrine' | 'sage' | 'clay' | 'stone';
  /** lucide icon name (upstream uses box, boxes, component, database, file-code-2, folder-tree, network, workflow, shield-check…). */
  icon?: string;
  evidenceCount?: number;
  childrenCount?: number;
  /** Representative member names — only rendered for group cards. */
  members?: string[];
  warning?: boolean;
  /** Larger deterministic "repository section" card. */
  group?: boolean;
  /** Group whose children expand in place rather than navigating. */
  collapsedContainer?: boolean;
  selected?: boolean;
  canDrilldown?: boolean;
  onClick?: () => void;
}
export function LensNode(props: LensNodeProps): JSX.Element;
