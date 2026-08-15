import type { EvidenceStatus } from '../../design/status';
import type { ObservatoryColorName } from '../../design/tokens';
import type { ObservatoryEdge, ObservatoryLandscapeFixture, ObservatoryNode } from '../observatory/types';
import type {
  ArchitectureMapEdgeDTO,
  ArchitectureMapNeighborhoodResponse,
  ArchitectureMapNodeDTO,
  ArchitectureMapResponse,
} from './apiTypes';
import { GROUP_NODE_HEIGHT, GROUP_NODE_WIDTH, layoutArchitectureNodes, layoutEntityFocusNodes } from './mapLayout';

const kindIcons: Record<string, string> = {
  system: 'Network',
  product_area: 'Boxes',
  subsystem: 'Box',
  component: 'Component',
  code_group: 'FolderCode',
  concept: 'Lightbulb',
  flow: 'GitBranch',
  external_boundary: 'Unplug',
  cross_cutting: 'Workflow',
  diagnostic: 'CircleAlert',
  structural_package: 'Folder',
  structural_module: 'FileCode2',
  // Distinct from Folder (structural_package) specifically so a Phase B
  // group card is never visually confused with the empty-overview
  // fallback's package node -- they have different activation conditions
  // (see structural_fallback.py's module docstring).
  structural_group: 'FolderTree',
};

const kindAccents: Record<string, ObservatoryColorName> = {
  system: 'slateBlue',
  product_area: 'slateBlue',
  subsystem: 'sage',
  component: 'slateBlue',
  code_group: 'stone',
  concept: 'citrine',
  flow: 'slateBlue',
  external_boundary: 'clay',
  cross_cutting: 'stone',
  diagnostic: 'clay',
  structural_package: 'stone',
  structural_module: 'stone',
  // Same 'stone' family as the other two real/deterministic (non-LLM)
  // kinds above -- signals "this is a structural fact," not a new,
  // unrelated color meaning. Icon + always-on card size (see LensNode)
  // carry the rest of the distinction; color is never the only signal.
  structural_group: 'stone',
};

const libraryIconByLabel: Array<[RegExp, string]> = [
  [/public|api|request helper/i, 'Network'],
  [/client|session|sync|async/i, 'Boxes'],
  [/transport|adapter|boundary/i, 'Unplug'],
  [/model|request|response|url/i, 'Database'],
  [/auth|cookie/i, 'ShieldCheck'],
  [/config|timeout|limit|ssl|proxy/i, 'Component'],
  [/content|decoder|multipart/i, 'Workflow'],
  [/cli|package|export/i, 'FileCode2'],
  [/util|support/i, 'FolderCode'],
];

function normalizeStatus(status: ArchitectureMapNodeDTO['status']): EvidenceStatus {
  return status;
}

function nodeSummary(node: ArchitectureMapNodeDTO): string {
  if (node.description) return node.description;
  if (node.unsupported_reason) return node.unsupported_reason.replaceAll('_', ' ');
  return `${node.kind.replaceAll('_', ' ')} from the active architecture-map projection.`;
}

function relatedLensLabels(node: ArchitectureMapNodeDTO): string[] {
  const labels: string[] = [];
  if (node.related_concept_ids.length > 0) labels.push(`${node.related_concept_ids.length} related concepts`);
  if (node.related_flow_ids.length > 0) labels.push(`${node.related_flow_ids.length} related flows`);
  if (node.can_drilldown && node.children_count > 0) labels.push(`${node.children_count} child areas`);
  return labels;
}

function whatHappens(node: ArchitectureMapNodeDTO): string[] {
  const steps: string[] = [];
  if (node.evidence_count > 0) steps.push(`${node.evidence_count} source-backed evidence items support this node.`);
  if (node.children_count > 0) steps.push(`${node.children_count} lower-level areas are available for future drilldown.`);
  if (node.primary_files.length > 0) steps.push(`Primary source is concentrated in ${node.primary_files.length} file${node.primary_files.length === 1 ? '' : 's'}.`);
  if (node.warnings.length > 0) steps.push(...node.warnings.slice(0, 2));
  if (node.unsupported_reason) steps.push(node.unsupported_reason.replaceAll('_', ' '));
  return steps.length > 0 ? steps : ['The backend returned this node without enough detail for a richer explanation.'];
}

export function adaptArchitectureNode(node: ArchitectureMapNodeDTO): Omit<ObservatoryNode, 'position'> {
  // `kindIcons[node.kind]` is the real, authoritative structural/architectural
  // category (Participant 1 formative finding: node types were indistinguishable
  // -- "a bunch of boxes with the same icons"). It must win over the
  // `libraryIconByLabel` heuristic below, which only guesses from substrings in
  // the node's *name* (tuned for HTTP-client-library repos, e.g. matching
  // "request"/"response"/"url") -- on a repo like Flask, that heuristic matched
  // ordinary method names like `full_dispatch_request`/`process_response`/
  // `url_for` and silently overrode their real, differentiated kind-based icon
  // with the same generic icon, which is exactly what the participant saw.
  // The label heuristic still applies, but only as a fallback for kinds with no
  // dedicated icon.
  const libraryIcon = libraryIconByLabel.find(([pattern]) => pattern.test(node.label))?.[1];
  return {
    id: node.id,
    label: node.label,
    kind: node.kind,
    description: node.description || node.kind.replaceAll('_', ' '),
    status: normalizeStatus(node.status),
    // Passed through as-is (never coerced to 0) -- null must stay null so
    // the UI can show "no map confidence" instead of a fabricated 0%; see
    // ObservatoryNode.confidence's own doc comment.
    confidence: node.confidence,
    evidenceCount: node.evidence_count,
    childrenCount: node.children_count,
    canDrilldown: node.can_drilldown,
    primaryFiles: node.primary_files,
    accent: kindAccents[node.kind] ?? 'stone',
    icon: kindIcons[node.kind] ?? libraryIcon ?? 'Box',
    summary: nodeSummary(node),
    warning: node.warnings[0] ?? node.unsupported_reason ?? undefined,
    warnings: node.warnings,
    unsupportedReason: node.unsupported_reason,
    relatedConceptIds: node.related_concept_ids,
    relatedFlowIds: node.related_flow_ids,
    sourceRefs: node.source_refs,
    graphQn: node.graph_qn,
    legacyType: node.legacy_type,
    level: node.level,
    whatHappens: whatHappens(node),
    relatedLenses: relatedLensLabels(node),
    parentGroupId: node.parent_group_id,
  };
}

function edgeVisualKind(edge: ArchitectureMapEdgeDTO): NonNullable<ObservatoryEdge['visualKind']> {
  if (edge.kind.includes('flow')) return 'flow';
  if (edge.kind.includes('boundary')) return 'boundary';
  if ((edge.confidence ?? 1) < 0.55) return 'inferred';
  return 'dependency';
}

export function adaptArchitectureMap(response: ArchitectureMapResponse): ObservatoryLandscapeFixture {
  const rootId = response.root.id;
  const topLevelNodes = response.nodes.filter((node) => node.id !== rootId);
  const visibleSourceNodes = topLevelNodes.length > 0 ? topLevelNodes : [response.root];
  const isGroupedOverview = visibleSourceNodes.length > 0 && visibleSourceNodes.every((node) => node.kind === 'structural_group');
  // Phase C1: a grouped Overview now eagerly carries EVERY level of the
  // real containment tree (not just level-1), each node real-tagged with
  // `parent_group_id`. Whether any real nesting exists among them --
  // i.e. whether a node here is itself pointed at as another node's
  // parent -- decides whether this fixture needs the nested compound-node
  // layout (mapLayout's layoutContainmentNodes, computed reactively by the
  // canvas as containers expand/collapse) or can keep the pre-C1 flat
  // grid layout unchanged (e.g. Flask's shape today: every group is a
  // top-level leaf with no real sub-containers at all).
  const adaptedRaw = visibleSourceNodes.map(adaptArchitectureNode);
  const hasContainment = isGroupedOverview && adaptedRaw.some((node) => node.parentGroupId);
  const adaptedNodes = hasContainment
    ? adaptedRaw.map((node) => ({ ...node, position: { x: 0, y: 0 } }))
    : layoutArchitectureNodes(
      adaptedRaw.slice(0, 40),
      isGroupedOverview ? { width: GROUP_NODE_WIDTH, height: GROUP_NODE_HEIGHT } : {},
    );
  const visibleIds = new Set(adaptedNodes.map((node) => node.id));
  const adaptedEdges = response.edges
    .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      visualKind: edgeVisualKind(edge),
      label: edge.label,
      confidence: edge.confidence,
      sourceRefs: edge.source_refs,
    }));

  const repoShape = response.diagnostics.repo_shape
    ? ` Repository shape: ${response.diagnostics.repo_shape}.`
    : '';
  const warningSummary = response.diagnostics.warnings.length > 0
    ? ` ${response.diagnostics.warnings.length} projection warning${response.diagnostics.warnings.length === 1 ? '' : 's'} reported.`
    : '';
  const repository = response.metadata.repository as { name?: string; root_path?: string } | undefined;
  const repoTitle = displayRepoTitle(repository?.name || response.root.label, response.diagnostics.repo_shape);
  const summary = apiModeSummary(response, repoTitle, repoShape, warningSummary);

  return {
    repoTitle,
    // Raw id (e.g. "run:1f7f34..."), no literal "Run " prefix baked in --
    // RunPicker.tsx owns how/whether to label it (finding F05: the old
    // prefix baked in here plus RunPicker's own "Run {runId}" template
    // doubled up into a literal "Run Run" in the header).
    runId: response.analysis_run_id,
    lastScanned: 'active run',
    freshness: response.diagnostics.projection_version,
    breadcrumb: [response.root.label],
    summary,
    hiddenNodeCount: hasContainment ? 0 : Math.max(0, visibleSourceNodes.length - adaptedNodes.length),
    nodes: adaptedNodes,
    edges: adaptedEdges,
    hasContainment,
    overviewSummaryLine: containmentSummaryLine(response),
    promptSuggestions: [
      'What does this architecture area do?',
      'Which code proves this?',
      response.diagnostics.repo_shape?.includes('http_client')
        ? 'How does a request reach the transport layer?'
        : 'Where are the weak spots?',
    ],
  };
}

interface ContainmentMetadata {
  total_modules: number;
  top_level_regions: number;
  total_sections: number;
}

// Phase C1: a truthful, layered Overview summary -- never "N areas * M
// links" once real grouping is active (that phrasing reads as "the
// product tried and failed to find relationships"; see
// docs/design-proposals/semantic-architecture-overview/
// STATE_1_OVERVIEW.md). Every number here is a real, already-computed
// backend count (`ArchitectureMapProjector.project()`'s own `containment`
// metadata) -- never an invented or estimated figure.
export function containmentSummaryLine(response: ArchitectureMapResponse): string | null {
  const containment = response.metadata.containment as ContainmentMetadata | undefined;
  if (!containment || containment.total_sections === 0) return null;
  const moduleWord = containment.total_modules === 1 ? 'source module' : 'source modules';
  const regionWord = containment.top_level_regions === 1 ? 'top-level region' : 'top-level regions';
  const sectionWord = containment.total_sections === 1 ? 'repository section' : 'repository sections';
  return `${containment.total_modules} ${moduleWord} · ${containment.top_level_regions} ${regionWord} · ${containment.total_sections} ${sectionWord}`;
}

function displayRepoTitle(raw: string, repoShape: string | null): string {
  const value = (raw || '').trim();
  if (value && value !== 'System Overview') return value;
  if (repoShape?.includes('http_client')) return 'HTTPX';
  return value || 'Architecture Map';
}

function apiModeSummary(response: ArchitectureMapResponse, repoTitle: string, repoShape: string, warningSummary: string): string {
  if (response.diagnostics.repo_shape === 'python_http_client_library') {
    return `${repoTitle} is a Python HTTP client library for sync and async requests, transport abstraction, auth, cookies, configuration, and response models.${warningSummary}`;
  }
  if (response.diagnostics.repo_shape === 'full_stack_app') {
    return `${repoTitle} is a full-stack application with frontend views, backend API routes, authentication, persistence, generated API clients, and deployment configuration.${warningSummary}`;
  }
  if (response.diagnostics.repo_shape === 'web_app') {
    return `${repoTitle} is a web application with user-facing UI, API integration, runtime configuration, and deployable application surfaces.${warningSummary}`;
  }
  if (/health score|components across|subsystems?/i.test(response.root.description || '')) {
    return `${repoTitle} architecture map from the active backend projection.${repoShape}${warningSummary}`;
  }
  return response.root.description
    || `${response.root.label} architecture map from the active backend projection.${repoShape}${warningSummary}`;
}

export function adaptArchitectureScope(
  parent: ArchitectureMapNodeDTO,
  children: ArchitectureMapNodeDTO[],
  edges: ArchitectureMapEdgeDTO[],
  rootMeta: Pick<ObservatoryLandscapeFixture, 'repoTitle' | 'runId' | 'lastScanned' | 'freshness' | 'breadcrumb' | 'promptSuggestions'>,
): ObservatoryLandscapeFixture {
  const visibleChildren = children.slice(0, 40);
  const adaptedNodes = layoutArchitectureNodes(visibleChildren.map(adaptArchitectureNode));
  const visibleIds = new Set(adaptedNodes.map((node) => node.id));
  const adaptedEdges = edges
    .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      visualKind: edgeVisualKind(edge),
      label: edge.label,
      confidence: edge.confidence,
      sourceRefs: edge.source_refs,
    }));
  const adaptedParent = {
    ...adaptArchitectureNode(parent),
    position: { x: 0, y: 0 },
  };

  return {
    ...rootMeta,
    summary: parent.description || `${parent.label} child architecture areas from the active backend projection.`,
    parentNode: adaptedParent,
    hiddenNodeCount: Math.max(0, children.length - adaptedNodes.length),
    nodes: adaptedNodes,
    edges: adaptedEdges,
  };
}

const FOCUS_SIDE_CAP = 12;

// Entity Focus (State 3): the selected entity plus only its immediate,
// real one-hop dependencies/dependents -- deliberately excludes every
// other node in the current scope so the graph reads as "this entity and
// what truly touches it," not a re-rendering of the whole area. Relation
// direction/kind come straight from the backend's neighborhood response
// (see ArchitectureMapNeighborhoodResponse); nothing here upgrades an
// unresolved relation or invents a relationship.
export function adaptArchitectureNeighborhood(
  selected: ObservatoryNode,
  response: ArchitectureMapNeighborhoodResponse,
  rootMeta: Pick<ObservatoryLandscapeFixture, 'repoTitle' | 'runId' | 'lastScanned' | 'freshness' | 'breadcrumb' | 'promptSuggestions'>,
): ObservatoryLandscapeFixture {
  const dependents = response.dependents.slice(0, FOCUS_SIDE_CAP).map(adaptArchitectureNode);
  const dependencies = response.dependencies.slice(0, FOCUS_SIDE_CAP).map(adaptArchitectureNode);
  const hiddenCount = Math.max(0, response.dependents.length - dependents.length)
    + Math.max(0, response.dependencies.length - dependencies.length);

  const selectedBase: Omit<ObservatoryNode, 'position'> = selected;
  const positioned = layoutEntityFocusNodes(selectedBase, dependents, dependencies);
  const visibleIds = new Set(positioned.map((node) => node.id));
  const adaptedEdges = response.edges
    .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      visualKind: edgeVisualKind(edge),
      label: edge.label,
      confidence: edge.confidence,
      sourceRefs: edge.source_refs,
    }));

  return {
    ...rootMeta,
    summary: `${selected.label}'s immediate dependencies and dependents, from real recovered relations.`,
    parentNode: { ...selected, position: { x: 0, y: 0 } },
    hiddenNodeCount: hiddenCount,
    nodes: positioned,
    edges: adaptedEdges,
  };
}
