import type { EvidenceStatus } from '../../design/status';
import type { ObservatoryColorName } from '../../design/tokens';

export type ObservatoryNodeKind =
  | 'system'
  | 'product_area'
  | 'subsystem'
  | 'component'
  | 'code_group'
  | 'concept'
  | 'flow'
  | 'external_boundary'
  | 'cross_cutting'
  | 'diagnostic'
  // Deterministic structural-navigation fallback: real directories/files,
  // never an LLM-inferred architectural classification.
  | 'structural_package'
  | 'structural_module'
  // Phase B: a deterministic directory-containment grouping of an
  // otherwise-flat, file-shaped Overview. Never an LLM-inferred domain.
  | 'structural_group';

export interface ObservatoryNode {
  id: string;
  label: string;
  kind: ObservatoryNodeKind;
  description: string;
  status: EvidenceStatus;
  // null means "no map-confidence metric exists for this node" (e.g. a
  // Phase B structural_group) -- must never be coerced to 0, which would
  // read as "0% confident" rather than "not applicable." See
  // design/mapConfidence.ts and VoiceRail's conditional rendering.
  confidence: number | null;
  evidenceCount: number;
  childrenCount: number;
  canDrilldown: boolean;
  primaryFiles: string[];
  accent: ObservatoryColorName;
  icon: string;
  position: { x: number; y: number };
  summary: string;
  warning?: string;
  warnings?: string[];
  unsupportedReason?: string | null;
  relatedConceptIds?: string[];
  relatedFlowIds?: string[];
  sourceRefs?: Record<string, unknown>;
  graphQn?: string | null;
  legacyType?: string | null;
  level?: number;
  whatHappens: string[];
  relatedLenses: string[];
  // Phase C1: id of this node's immediate structural-containment parent
  // within the same eagerly-returned node set, or null/undefined for a
  // top-level node. Real directory containment only. See
  // features/architecture-map/mapLayout.ts's nested containment layout.
  parentGroupId?: string | null;
}

export interface ObservatoryEdge {
  id: string;
  source: string;
  target: string;
  kind: string;
  visualKind?: 'dependency' | 'flow' | 'inferred' | 'boundary';
  label?: string | null;
  confidence?: number | null;
  sourceRefs?: Record<string, unknown[]>;
}

export interface ObservatoryLandscapeFixture {
  repoTitle: string;
  runId: string;
  lastScanned: string;
  freshness: string;
  breadcrumb: string[];
  summary: string;
  parentNode?: ObservatoryNode;
  hiddenNodeCount?: number;
  nodes: ObservatoryNode[];
  edges: ObservatoryEdge[];
  promptSuggestions: string[];
  // Phase C1: true when `nodes` represents a real (potentially multi-
  // level) deterministic containment tree -- i.e. at least one node has a
  // real `parentGroupId`, or is itself pointed at as a parent. When true,
  // `node.position` on each entry is a placeholder; the canvas computes
  // real nested positions itself via mapLayout's layoutContainmentNodes,
  // since expand/collapse is local, ephemeral canvas state, not something
  // baked into a one-shot adapter call. False (or absent) for every other
  // fixture (flat Overview, State 2 leaf drilldown, Entity Focus), which
  // keep their existing pre-positioned-by-the-adapter behavior unchanged.
  hasContainment?: boolean;
  // Phase C1: a truthful, layered replacement for the old "N areas * M
  // links" canvas watermark (e.g. "267 source modules · 2 top-level
  // regions · 18 repository sections"), present only when the backend's
  // real containment metadata supports it. Null/undefined everywhere else
  // -- callers fall back to the pre-C1 "N areas * M links" wording.
  overviewSummaryLine?: string | null;
}
