import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import LensNode from './LensNode';
import type { ObservatoryNode } from '../observatory/types';

/**
 * Participant 1 formative usability finding (non-scored dry run): a real
 * first-time user scrolled the architecture map but never attempted a
 * click, and described it as "a bunch of boxes with the same icons...
 * connected but not categorized." These tests cover the always-visible
 * (not hover-dependent) affordances added in response: a visible kind
 * label, a drill-down indicator for drillable nodes, and an accessible
 * name that states the node's kind and that it's selectable.
 */
function buildNode(overrides: Partial<ObservatoryNode>): ObservatoryNode {
  return {
    id: 'symbol:abc123',
    label: 'full_dispatch_request',
    kind: 'code_group',
    description: 'Handles request dispatch.',
    status: 'verified',
    confidence: 1,
    evidenceCount: 1,
    childrenCount: 0,
    canDrilldown: false,
    primaryFiles: [],
    accent: 'slateBlue',
    icon: 'FolderCode',
    position: { x: 0, y: 0 },
    summary: '',
    whatHappens: [],
    relatedLenses: [],
    ...overrides,
  } as ObservatoryNode;
}

function renderNode(node: ObservatoryNode) {
  return render(
    <ReactFlowProvider>
      <LensNode data={node as unknown as Record<string, unknown>} />
    </ReactFlowProvider>,
  );
}

describe('LensNode always-visible affordances', () => {
  it('shows a visible, always-on kind label distinguishing node categories', () => {
    renderNode(buildNode({ kind: 'component', label: 'app.py' }));
    expect(screen.getByText('component')).toBeInTheDocument();
  });

  it('shows a distinct kind label for a different node kind', () => {
    renderNode(buildNode({ kind: 'structural_module', label: 'cli.py' }));
    expect(screen.getByText('structural module')).toBeInTheDocument();
  });

  it('includes the kind and a selectable hint in the accessible name, not just label/status', () => {
    renderNode(buildNode({ kind: 'component', label: 'app.py', status: 'verified', canDrilldown: true }));
    const button = screen.getByRole('button', { name: /app\.py, component, verified, select to explore/i });
    expect(button).toBeInTheDocument();
  });

  it('uses "select" (not "select to explore") in the accessible name for a leaf node', () => {
    renderNode(buildNode({ label: 'full_dispatch_request', canDrilldown: false }));
    const button = screen.getByRole('button', { name: /full_dispatch_request, code group, verified, select$/i });
    expect(button).toBeInTheDocument();
  });

  it('is a real, keyboard-focusable button regardless of drilldown state', () => {
    renderNode(buildNode({ canDrilldown: false }));
    const button = screen.getByRole('button');
    expect(button.tagName).toBe('BUTTON');
    expect(button).not.toHaveAttribute('tabindex', '-1');
  });
});

/**
 * Phase B: a structural_group card (a deterministic repository section)
 * must be visually and semantically distinct from a plain module/entity
 * card -- larger footprint, real member count, representative members,
 * and an always-visible "Select to explore" hint -- never relying on
 * color alone, per section 6 of the Phase B remediation brief.
 */
describe('LensNode Phase B group card', () => {
  function buildGroupNode(overrides: Partial<ObservatoryNode> = {}): ObservatoryNode {
    return buildNode({
      id: 'structural-group:routes',
      label: 'routes',
      kind: 'structural_group',
      description: "Repository section 'routes', containing 2 module(s).",
      confidence: 0,
      childrenCount: 2,
      canDrilldown: true,
      primaryFiles: ['routes/api.py', 'routes/health.py'],
      icon: 'FolderTree',
      ...overrides,
    });
  }

  it('applies the distinct group card class, not the plain node class alone', () => {
    const { container } = renderNode(buildGroupNode());
    const button = container.querySelector('.obs-rf-node');
    expect(button?.className).toContain('obs-rf-node--group');
  });

  it('a plain module card never gets the group class', () => {
    const { container } = renderNode(buildNode({ kind: 'component', label: 'app.py' }));
    const button = container.querySelector('.obs-rf-node');
    expect(button?.className).not.toContain('obs-rf-node--group');
  });

  it('shows the real member count, not the generic "N areas" module wording', () => {
    renderNode(buildGroupNode({ childrenCount: 3 }));
    expect(screen.getByText('3 modules')).toBeInTheDocument();
  });

  it('uses singular wording for exactly one member', () => {
    renderNode(buildGroupNode({ childrenCount: 1, primaryFiles: ['routes/api.py'] }));
    expect(screen.getByText('1 module')).toBeInTheDocument();
  });

  it('shows real representative members, never a synthesized description', () => {
    renderNode(buildGroupNode());
    expect(screen.getByText(/Contains: routes\/api\.py, routes\/health\.py/)).toBeInTheDocument();
  });

  it('shows an always-visible "Select to explore" hint on a group card', () => {
    renderNode(buildGroupNode());
    expect(screen.getByText('Select to explore')).toBeInTheDocument();
  });

  it('labels the kind chip "repository section", a neutral structural term, not "structural group" raw or an invented domain word', () => {
    renderNode(buildGroupNode());
    expect(screen.getByText('repository section')).toBeInTheDocument();
  });

  it('still exposes the group in the accessible name with the real label and drilldown hint', () => {
    renderNode(buildGroupNode({ label: 'routes', status: 'verified' }));
    const button = screen.getByRole('button', { name: /routes, repository section, verified, select to explore/i });
    expect(button).toBeInTheDocument();
  });
});

/**
 * Phase C1: nested deterministic containment. A COLLAPSED container (real
 * sub-containers/leaf buckets exist) must read differently from a leaf
 * group -- "expand", not "explore" -- and an EXPANDED container renders as
 * a plain enclosing frame, never re-describing members its own now-visible
 * children already show. Never any AI-authored content anywhere in C1.
 */
describe('LensNode Phase C1 nested containment', () => {
  function renderNodeData(data: Record<string, unknown>) {
    return render(
      <ReactFlowProvider>
        <LensNode data={data} />
      </ReactFlowProvider>,
    );
  }

  it('a collapsed container says "expand", not "select to explore" / "drilldown"', () => {
    renderNodeData({
      ...buildNode({ id: 'structural-group:backend', label: 'backend', kind: 'structural_group', canDrilldown: true, childrenCount: 12 }),
      isContainer: true,
      isExpanded: false,
    });
    expect(screen.getByText('Select to expand')).toBeInTheDocument();
    expect(screen.queryByText('Select to explore')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: /backend, repository section, verified, expand/i });
    expect(button).toBeInTheDocument();
  });

  it('a leaf structural_group (no real sub-containers) keeps the original "select to explore" wording unchanged', () => {
    renderNodeData({
      ...buildNode({ id: 'structural-group:routes', label: 'routes', kind: 'structural_group', canDrilldown: true, childrenCount: 2 }),
      isContainer: false,
    });
    expect(screen.getByText('Select to explore')).toBeInTheDocument();
  });

  it('an expanded container renders as a plain frame -- header, count, collapse control -- with no member list or description duplicated', () => {
    renderNodeData({
      ...buildNode({ id: 'structural-group:backend', label: 'backend', kind: 'structural_group', childrenCount: 12, primaryFiles: ['a.py', 'b.py'] }),
      isContainer: true,
      isExpanded: true,
      directChildCount: 3,
    });
    expect(screen.getByText('backend')).toBeInTheDocument();
    expect(screen.getByText('12 modules')).toBeInTheDocument();
    expect(screen.queryByText(/Contains:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /backend, repository region, 3 sections, collapse/i })).toBeInTheDocument();
  });

  it('never renders any AI-authored label or "AI interpretation" content -- C1 is deterministic-only', () => {
    renderNodeData({
      ...buildNode({ id: 'structural-group:backend', label: 'backend', kind: 'structural_group', childrenCount: 5 }),
      isContainer: true,
      isExpanded: true,
    });
    expect(screen.queryByText(/AI interpretation/i)).not.toBeInTheDocument();
  });
});
