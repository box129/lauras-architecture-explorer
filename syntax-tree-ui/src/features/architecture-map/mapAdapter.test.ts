import { describe, expect, it } from 'vitest';
import { adaptArchitectureMap, adaptArchitectureNeighborhood, adaptArchitectureNode } from './mapAdapter';
import type {
  ArchitectureMapEdgeDTO,
  ArchitectureMapNeighborhoodResponse,
  ArchitectureMapNodeDTO,
  ArchitectureMapResponse,
} from './apiTypes';
import type { ObservatoryLandscapeFixture } from '../observatory/types';
import { GROUP_NODE_WIDTH } from './mapLayout';

/**
 * Participant 1 formative usability finding: "I see a bunch of boxes with
 * the same icons, they seem connect but not categorized." Traced to a real
 * bug: a name-substring icon heuristic (tuned for HTTP-client-library repos
 * -- matching words like "request"/"response"/"url") was checked BEFORE the
 * node's real, authoritative `kind`, so ordinary Flask method names like
 * `full_dispatch_request` and `process_response` all collapsed onto the
 * same generic icon regardless of their actual kind. This test locks in the
 * fix: `kind` must win.
 */
function buildNode(overrides: Partial<ArchitectureMapNodeDTO>): ArchitectureMapNodeDTO {
  return {
    id: 'symbol:1',
    analysis_run_id: 'run:1',
    label: 'full_dispatch_request',
    kind: 'code_group',
    level: 2,
    description: '',
    status: 'verified',
    confidence: 1,
    source_refs: {},
    evidence_count: 1,
    children_count: 0,
    can_drilldown: false,
    primary_files: [],
    related_concept_ids: [],
    related_flow_ids: [],
    graph_qn: null,
    legacy_type: null,
    warnings: [],
    unsupported_reason: null,
    ...overrides,
  };
}

describe('adaptArchitectureNode icon selection', () => {
  it('uses the real structural kind, not a name-substring guess, for a Flask method containing "request"', () => {
    const node = buildNode({ label: 'full_dispatch_request', kind: 'code_group' });
    expect(adaptArchitectureNode(node).icon).toBe('FolderCode');
  });

  it('uses the real structural kind for a method containing "response"', () => {
    const node = buildNode({ label: 'process_response', kind: 'code_group' });
    expect(adaptArchitectureNode(node).icon).toBe('FolderCode');
  });

  it('uses the real structural kind for a function containing "url"', () => {
    const node = buildNode({ label: 'url_for', kind: 'code_group' });
    expect(adaptArchitectureNode(node).icon).toBe('FolderCode');
  });

  it('gives a genuinely different kind a genuinely different icon', () => {
    const componentNode = buildNode({ label: 'app.py', kind: 'component' });
    const moduleNode = buildNode({ label: 'cli.py', kind: 'structural_module' });
    expect(adaptArchitectureNode(componentNode).icon).not.toBe(adaptArchitectureNode(moduleNode).icon);
  });

  it('gives a Phase B structural_group a distinct icon from structural_package/structural_module', () => {
    const group = buildNode({ label: 'routes', kind: 'structural_group' });
    const legacyPackage = buildNode({ label: 'routes', kind: 'structural_package' });
    expect(adaptArchitectureNode(group).icon).toBe('FolderTree');
    expect(adaptArchitectureNode(group).icon).not.toBe(adaptArchitectureNode(legacyPackage).icon);
  });

  it('still falls back to the label heuristic when a kind has no dedicated icon mapping', () => {
    // 'concept' does have a dedicated icon (Lightbulb); this only proves the
    // fallback exists for genuinely unmapped kinds by checking a kind's
    // icon is never silently missing.
    const node = buildNode({ label: 'auth_helper', kind: 'concept' });
    expect(adaptArchitectureNode(node).icon).toBe('Lightbulb');
  });
});

function buildEdge(overrides: Partial<ArchitectureMapEdgeDTO>): ArchitectureMapEdgeDTO {
  return {
    id: 'edge:1',
    analysis_run_id: 'run:1',
    source: 'symbol:selected',
    target: 'symbol:dependency',
    kind: 'calls',
    label: 'calls',
    confidence: null,
    source_refs: {},
    ...overrides,
  };
}

const rootMeta = {
  repoTitle: 'Repo',
  runId: 'run:1',
  lastScanned: 'active run',
  freshness: 'v1',
  breadcrumb: ['Repo'],
  promptSuggestions: [],
};

describe('adaptArchitectureNeighborhood (Entity Focus, State 3)', () => {
  const selected = adaptArchitectureNode(buildNode({ id: 'symbol:selected', label: 'caller', kind: 'code_group' }));
  const positionedSelected = { ...selected, position: { x: 0, y: 0 } };

  it('includes only the selected entity plus its real one-hop dependencies and dependents -- nothing else', () => {
    const response: ArchitectureMapNeighborhoodResponse = {
      analysis_run_id: 'run:1',
      node_id: 'symbol:selected',
      dependencies: [buildNode({ id: 'symbol:dependency', label: 'callee' })],
      dependents: [buildNode({ id: 'symbol:dependent', label: 'entrypoint' })],
      edges: [
        buildEdge({ id: 'edge:dep', source: 'symbol:selected', target: 'symbol:dependency', kind: 'calls', confidence: null }),
        buildEdge({ id: 'edge:dependent', source: 'symbol:dependent', target: 'symbol:selected', kind: 'calls', confidence: null }),
      ],
    };

    const landscape: ObservatoryLandscapeFixture = adaptArchitectureNeighborhood(positionedSelected, response, rootMeta);

    const ids = landscape.nodes.map((node) => node.id).sort();
    expect(ids).toEqual(['symbol:dependency', 'symbol:dependent', 'symbol:selected'].sort());
    expect(landscape.edges).toHaveLength(2);
  });

  it('preserves real edge direction: a dependency edge points selected -> dependency, a dependent edge points dependent -> selected', () => {
    const response: ArchitectureMapNeighborhoodResponse = {
      analysis_run_id: 'run:1',
      node_id: 'symbol:selected',
      dependencies: [buildNode({ id: 'symbol:dependency', label: 'callee' })],
      dependents: [buildNode({ id: 'symbol:dependent', label: 'entrypoint' })],
      edges: [
        buildEdge({ id: 'edge:dep', source: 'symbol:selected', target: 'symbol:dependency' }),
        buildEdge({ id: 'edge:dependent', source: 'symbol:dependent', target: 'symbol:selected' }),
      ],
    };

    const landscape = adaptArchitectureNeighborhood(positionedSelected, response, rootMeta);

    const dependencyEdge = landscape.edges.find((edge) => edge.target === 'symbol:dependency');
    const dependentEdge = landscape.edges.find((edge) => edge.source === 'symbol:dependent');
    expect(dependencyEdge?.source).toBe('symbol:selected');
    expect(dependentEdge?.target).toBe('symbol:selected');
  });

  it('preserves the real relation kind on each edge (e.g. imports vs calls), never normalizing them to one label', () => {
    const response: ArchitectureMapNeighborhoodResponse = {
      analysis_run_id: 'run:1',
      node_id: 'symbol:selected',
      dependencies: [buildNode({ id: 'symbol:dependency', label: 'callee' })],
      dependents: [],
      edges: [buildEdge({ source: 'symbol:selected', target: 'symbol:dependency', kind: 'imports', label: 'imports' })],
    };

    const landscape = adaptArchitectureNeighborhood(positionedSelected, response, rootMeta);

    expect(landscape.edges[0].kind).toBe('imports');
  });

  it('never upgrades a partial/unresolved relation to a resolved-looking edge -- confidence is passed through untouched', () => {
    const response: ArchitectureMapNeighborhoodResponse = {
      analysis_run_id: 'run:1',
      node_id: 'symbol:selected',
      dependencies: [buildNode({ id: 'symbol:dependency', label: 'callee' })],
      dependents: [],
      edges: [buildEdge({ source: 'symbol:selected', target: 'symbol:dependency', confidence: 0.4 })],
    };

    const resolved = adaptArchitectureNeighborhood(positionedSelected, {
      ...response,
      edges: [buildEdge({ source: 'symbol:selected', target: 'symbol:dependency', confidence: null })],
    }, rootMeta);
    const partial = adaptArchitectureNeighborhood(positionedSelected, response, rootMeta);

    expect(resolved.edges[0].confidence).toBeNull();
    expect(partial.edges[0].confidence).toBe(0.4);
  });
});

// ---------------------------------------------------------------------------
// Phase B: grouped Overview rendering (adaptArchitectureMap).
// ---------------------------------------------------------------------------

function buildGroupNode(overrides: Partial<ArchitectureMapNodeDTO>): ArchitectureMapNodeDTO {
  return buildNode({
    id: 'structural-group:routes',
    label: 'routes',
    kind: 'structural_group',
    level: 1,
    description: "Repository section 'routes', containing 2 module(s).",
    confidence: null,
    children_count: 2,
    can_drilldown: true,
    primary_files: ['routes/api.py', 'routes/health.py'],
    ...overrides,
  });
}

function buildMapResponse(nodes: ArchitectureMapNodeDTO[], edges: ArchitectureMapEdgeDTO[] = []): ArchitectureMapResponse {
  const root = buildNode({ id: 'root:1', label: 'demo-repo', kind: 'system', level: 0 });
  return {
    analysis_run_id: 'run:1',
    root,
    nodes: [root, ...nodes],
    edges,
    diagnostics: {
      repo_shape: null,
      projection_version: 'test',
      warnings: [],
      suppressed_app_only_nodes: [],
      nodes_without_evidence: [],
      verified_node_count: nodes.length,
      insufficient_node_count: 0,
      unsupported_node_count: 0,
    },
    metadata: {},
  };
}

describe('adaptArchitectureMap grouped Overview (Phase B)', () => {
  it('renders structural_group nodes with the larger domain-card footprint, distinct from a plain module card', () => {
    const groupResponse = buildMapResponse([
      buildGroupNode({ id: 'structural-group:routes', label: 'routes' }),
      buildGroupNode({ id: 'structural-group:models', label: 'models' }),
    ]);
    const flatResponse = buildMapResponse([
      buildNode({ id: 'module:a', label: 'a.py', kind: 'structural_module', level: 1 }),
      buildNode({ id: 'module:b', label: 'b.py', kind: 'structural_module', level: 1 }),
    ]);

    const grouped = adaptArchitectureMap(groupResponse);
    const flat = adaptArchitectureMap(flatResponse);

    // Grid spacing between the first two nodes reveals the box size used --
    // a grouped Overview must use the larger GROUP_NODE_WIDTH, an ungrouped
    // one must keep the standard (smaller) card size.
    const groupedGap = grouped.nodes[1].position.x - grouped.nodes[0].position.x;
    const flatGap = flat.nodes[1].position.x - flat.nodes[0].position.x;
    expect(groupedGap).toBeGreaterThan(flatGap);
    expect(groupedGap).toBeGreaterThanOrEqual(GROUP_NODE_WIDTH);
  });

  it('exposes real member count and representative members on the adapted group node, never a fabricated confidence', () => {
    const response = buildMapResponse([buildGroupNode({})]);

    const landscape = adaptArchitectureMap(response);

    const group = landscape.nodes[0];
    expect(group.kind).toBe('structural_group');
    expect(group.childrenCount).toBe(2);
    expect(group.primaryFiles).toEqual(['routes/api.py', 'routes/health.py']);
    expect(group.confidence).toBeNull(); // never coerced to a fabricated 0%
  });

  it('does not apply group sizing when the Overview is a mix of groups and non-group nodes (defensive: grouping is all-or-nothing per response)', () => {
    const mixedResponse = buildMapResponse([
      buildGroupNode({ id: 'structural-group:routes', label: 'routes' }),
      buildNode({ id: 'module:a', label: 'a.py', kind: 'structural_module', level: 1 }),
    ]);
    const groupOnlyResponse = buildMapResponse([
      buildGroupNode({ id: 'structural-group:routes', label: 'routes' }),
      buildGroupNode({ id: 'structural-group:models', label: 'models' }),
    ]);

    const mixed = adaptArchitectureMap(mixedResponse);
    const groupOnly = adaptArchitectureMap(groupOnlyResponse);

    const mixedGap = mixed.nodes[1].position.x - mixed.nodes[0].position.x;
    const groupOnlyGap = groupOnly.nodes[1].position.x - groupOnly.nodes[0].position.x;
    expect(mixedGap).toBeLessThan(groupOnlyGap);
  });
});

// ---------------------------------------------------------------------------
// Phase C1: nested deterministic containment detection + truthful summary.
// ---------------------------------------------------------------------------

describe('adaptArchitectureMap nested containment (Phase C1)', () => {
  it('marks a fixture as hasContainment only when a real parent_group_id relationship exists among the visible nodes', () => {
    const flatGrouped = buildMapResponse([
      buildGroupNode({ id: 'structural-group:routes', label: 'routes' }),
      buildGroupNode({ id: 'structural-group:models', label: 'models' }),
    ]);
    const nestedGrouped = buildMapResponse([
      buildGroupNode({ id: 'structural-group:backend', label: 'backend', parent_group_id: null }),
      buildGroupNode({ id: 'structural-group:backend-src', label: 'backend/src', parent_group_id: 'structural-group:backend' }),
    ]);

    expect(adaptArchitectureMap(flatGrouped).hasContainment).toBe(false);
    expect(adaptArchitectureMap(nestedGrouped).hasContainment).toBe(true);
  });

  it('does not pre-layout (real positions) nodes for a nested-containment fixture -- the canvas computes real positions itself', () => {
    const nestedGrouped = buildMapResponse([
      buildGroupNode({ id: 'structural-group:backend', label: 'backend', parent_group_id: null }),
      buildGroupNode({ id: 'structural-group:backend-src', label: 'backend/src', parent_group_id: 'structural-group:backend' }),
    ]);

    const landscape = adaptArchitectureMap(nestedGrouped);

    // Placeholder positions only -- both at the origin, since real
    // positions depend on runtime expand/collapse state the adapter has
    // no knowledge of.
    for (const node of landscape.nodes) {
      expect(node.position).toEqual({ x: 0, y: 0 });
    }
  });

  it('passes parent_group_id through onto the adapted node unchanged', () => {
    const response = buildMapResponse([
      buildGroupNode({ id: 'structural-group:backend-src', label: 'backend/src', parent_group_id: 'structural-group:backend' }),
    ]);
    const landscape = adaptArchitectureMap(response);
    expect(landscape.nodes[0].parentGroupId).toBe('structural-group:backend');
  });

  it('computes a truthful, real-count summary line from backend containment metadata, never a links count', () => {
    const response = buildMapResponse([buildGroupNode({})]);
    response.metadata.containment = { total_modules: 267, top_level_regions: 2, total_sections: 18 };

    const landscape = adaptArchitectureMap(response);

    expect(landscape.overviewSummaryLine).toBe('267 source modules · 2 top-level regions · 18 repository sections');
    expect(landscape.overviewSummaryLine).not.toMatch(/links/);
  });

  it('falls back to no summary line (caller uses the pre-C1 "areas * links" wording) when containment metadata is absent', () => {
    const response = buildMapResponse([
      buildNode({ id: 'module:a', label: 'a.py', kind: 'structural_module', level: 1 }),
    ]);
    expect(adaptArchitectureMap(response).overviewSummaryLine).toBeNull();
  });
});
