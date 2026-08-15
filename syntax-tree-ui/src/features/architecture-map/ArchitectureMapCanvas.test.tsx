import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ArchitectureMapCanvas from './ArchitectureMapCanvas';
import type { ObservatoryLandscapeFixture, ObservatoryNode } from '../observatory/types';

/**
 * Phase 2 ("final product hardening"): the accessible-table row buttons
 * used to always call onEnterNode(node, true) -- ALWAYS select-only,
 * regardless of which row -- so drilldown through the table was dead. The
 * fix makes the table call the exact same onEnterNode callback with the
 * exact same selectOnly rule the canvas's onNodeClick already uses
 * (event.altKey), rather than a second, duplicated traversal
 * implementation. These tests cover the table only -- React Flow canvas
 * interaction itself is exercised by the real-browser Playwright
 * acceptance flow, not here.
 */

function buildNode(overrides: Partial<ObservatoryNode>): ObservatoryNode {
  return {
    id: 'module:a',
    label: 'app/service.py',
    kind: 'file',
    description: '',
    status: 'verified',
    confidence: 1,
    evidenceCount: 1,
    childrenCount: 2,
    canDrilldown: true,
    primaryFiles: [],
    accent: 'blue',
    icon: 'FileCode2',
    position: { x: 0, y: 0 },
    summary: '',
    whatHappens: [],
    relatedLenses: [],
    ...overrides,
  } as ObservatoryNode;
}

function buildFixture(nodes: ObservatoryNode[]): ObservatoryLandscapeFixture {
  return {
    repoTitle: 'demo-repo',
    runId: 'run:1',
    lastScanned: '2026-01-01T00:00:00Z',
    freshness: 'fresh',
    breadcrumb: ['demo-repo'],
    summary: '',
    nodes,
    edges: [],
    promptSuggestions: [],
  };
}

describe('ArchitectureMapCanvas accessible table', () => {
  it('a plain click on a drillable node row calls onEnterNode with selectOnly=false (real drilldown)', async () => {
    const drillableNode = buildNode({ id: 'module:a', label: 'app/service.py', canDrilldown: true });
    const onEnterNode = vi.fn();
    const user = userEvent.setup();

    render(
      <ArchitectureMapCanvas
        fixture={buildFixture([drillableNode])}
        selectedNode={null}
        focalNode={null}
        onSelectNode={vi.fn()}
        onEnterNode={onEnterNode}
        onHoverNode={vi.fn()}
      />,
    );

    await user.click(screen.getByText('View architecture as accessible tables'));
    await user.click(screen.getByRole('button', { name: /app\/service\.py/i }));

    expect(onEnterNode).toHaveBeenCalledWith(drillableNode, false);
  });

  it('Alt+click on a row forces selectOnly=true, matching the canvas Alt+click convention', async () => {
    const drillableNode = buildNode({ id: 'module:a', label: 'app/service.py', canDrilldown: true });
    const onEnterNode = vi.fn();
    const user = userEvent.setup();

    render(
      <ArchitectureMapCanvas
        fixture={buildFixture([drillableNode])}
        selectedNode={null}
        focalNode={null}
        onSelectNode={vi.fn()}
        onEnterNode={onEnterNode}
        onHoverNode={vi.fn()}
      />,
    );

    await user.click(screen.getByText('View architecture as accessible tables'));
    await user.keyboard('{Alt>}');
    await user.click(screen.getByRole('button', { name: /app\/service\.py/i }));
    await user.keyboard('{/Alt}');

    expect(onEnterNode).toHaveBeenCalledWith(drillableNode, true);
  });

  it('a leaf (non-drillable) node row still calls onEnterNode, letting selection work through the table', async () => {
    const leafNode = buildNode({
      id: 'symbol:register',
      label: 'register',
      canDrilldown: false,
      childrenCount: 0,
    });
    const onEnterNode = vi.fn();
    const user = userEvent.setup();

    render(
      <ArchitectureMapCanvas
        fixture={buildFixture([leafNode])}
        selectedNode={null}
        focalNode={null}
        onSelectNode={vi.fn()}
        onEnterNode={onEnterNode}
        onHoverNode={vi.fn()}
      />,
    );

    await user.click(screen.getByText('View architecture as accessible tables'));
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(onEnterNode).toHaveBeenCalledWith(leafNode, false);
  });

  it('is keyboard-activatable: tabbing to a row button and pressing Enter invokes navigation', async () => {
    const drillableNode = buildNode({ id: 'module:a', label: 'app/service.py', canDrilldown: true });
    const onEnterNode = vi.fn();
    const user = userEvent.setup();

    render(
      <ArchitectureMapCanvas
        fixture={buildFixture([drillableNode])}
        selectedNode={null}
        focalNode={null}
        onSelectNode={vi.fn()}
        onEnterNode={onEnterNode}
        onHoverNode={vi.fn()}
      />,
    );

    await user.click(screen.getByText('View architecture as accessible tables'));
    const button = screen.getByRole('button', { name: /app\/service\.py/i });
    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(onEnterNode).toHaveBeenCalledWith(drillableNode, false);
  });

  it('opening Architectural Explanation from a table-selected entity uses the same selection state as canvas selection', async () => {
    // Selecting a leaf via the table calls onEnterNode(node, false), which
    // -- because canDrilldown is false -- takes enterNode's select-only
    // branch (writeState(lensPath, node.id)) in useArchitectureLens.ts,
    // exactly like a canvas click on the same leaf would. There is no
    // separate "table selection" state; this test documents that the
    // table's callback contract is identical to the canvas's, which is
    // what makes downstream behavior (VoiceRail's displayNode, the
    // Architectural Explanation button) automatically equivalent.
    const leafNode = buildNode({ id: 'symbol:register', label: 'register', canDrilldown: false });
    const onEnterNode = vi.fn();
    const user = userEvent.setup();

    render(
      <ArchitectureMapCanvas
        fixture={buildFixture([leafNode])}
        selectedNode={null}
        focalNode={null}
        onSelectNode={vi.fn()}
        onEnterNode={onEnterNode}
        onHoverNode={vi.fn()}
      />,
    );

    await user.click(screen.getByText('View architecture as accessible tables'));
    await user.click(screen.getByRole('button', { name: /register/i }));

    const [[selectedNode, selectOnly]] = onEnterNode.mock.calls;
    expect(selectedNode.id).toBe('symbol:register');
    expect(selectOnly).toBe(false);
  });

  it('auto-collapses when a click lands on the panel background (not a row button or the summary), so a stray click over the canvas underneath it recovers on the next attempt', async () => {
    const drillableNode = buildNode({ id: 'module:a', label: 'app/service.py', canDrilldown: true });
    const user = userEvent.setup();

    const { container } = render(
      <ArchitectureMapCanvas
        fixture={buildFixture([drillableNode])}
        selectedNode={null}
        focalNode={null}
        onSelectNode={vi.fn()}
        onEnterNode={vi.fn()}
        onHoverNode={vi.fn()}
      />,
    );

    await user.click(screen.getByText('View architecture as accessible tables'));
    const details = container.querySelector('details.obs-graph-alternative') as HTMLDetailsElement;
    expect(details.open).toBe(true);

    // "Architecture areas" is the table caption -- background/whitespace
    // within the panel, not a row-navigation button.
    await user.click(screen.getByText('Architecture areas'));
    expect(details.open).toBe(false);
  });

  it('does not auto-collapse when the click is on a row-navigation button', async () => {
    const drillableNode = buildNode({ id: 'module:a', label: 'app/service.py', canDrilldown: true });
    const user = userEvent.setup();

    const { container } = render(
      <ArchitectureMapCanvas
        fixture={buildFixture([drillableNode])}
        selectedNode={null}
        focalNode={null}
        onSelectNode={vi.fn()}
        onEnterNode={vi.fn()}
        onHoverNode={vi.fn()}
      />,
    );

    await user.click(screen.getByText('View architecture as accessible tables'));
    const details = container.querySelector('details.obs-graph-alternative') as HTMLDetailsElement;

    await user.click(screen.getByRole('button', { name: /app\/service\.py/i }));
    expect(details.open).toBe(true);
  });
});

/**
 * Phase C1: nested deterministic containment. Expanding/collapsing a
 * structural region is a distinct interaction from entering/selecting a
 * node -- it must never call onEnterNode (no breadcrumb/navigation-stack
 * change), and the accessible table must mirror exactly the same
 * expand/collapse state the canvas itself is in.
 */
function buildContainmentFixture(): ObservatoryLandscapeFixture {
  const backend = buildNode({
    id: 'structural-group:backend', label: 'backend', kind: 'structural_group',
    childrenCount: 2, canDrilldown: true, parentGroupId: null,
  });
  const backendSrc = buildNode({
    id: 'structural-group:backend-src', label: 'backend/src', kind: 'structural_group',
    childrenCount: 2, canDrilldown: true, parentGroupId: 'structural-group:backend',
  });
  const fixture = buildFixture([backend, backendSrc]);
  fixture.hasContainment = true;
  return fixture;
}

// Real ReactFlow canvas node interaction (as opposed to the accessible
// table's own row buttons, exercised above and below) needs real DOM
// layout measurement that jsdom does not provide -- per this file's own
// long-standing convention (see the module docstring), that class of
// interaction is exercised by the real-browser Playwright/live-browser
// acceptance flow, not here. These tests cover the same expand-vs-
// navigate contract through the accessible table instead, which uses the
// identical `toggleExpand`/`onEnterNode` callbacks the canvas itself uses.
describe('ArchitectureMapCanvas Phase C1 expand/collapse vs navigation', () => {
  it('the accessible table only lists nodes currently visible on canvas, and gains a Parent section column', async () => {
    const user = userEvent.setup();
    render(
      <ArchitectureMapCanvas
        fixture={buildContainmentFixture()}
        selectedNode={null}
        focalNode={null}
        onSelectNode={vi.fn()}
        onEnterNode={vi.fn()}
        onHoverNode={vi.fn()}
      />,
    );

    await user.click(screen.getByText('View architecture as accessible tables'));

    expect(screen.getByText('Parent section')).toBeInTheDocument();
    // "backend" is a top-level container, expanded by default -> its
    // direct child "backend/src" should already be listed.
    expect(screen.getAllByText('backend/src').length).toBeGreaterThan(0);
  });

  it('activating a container row in the accessible table toggles expand, not navigation', async () => {
    const onEnterNode = vi.fn();
    const user = userEvent.setup();
    render(
      <ArchitectureMapCanvas
        fixture={buildContainmentFixture()}
        selectedNode={null}
        focalNode={null}
        onSelectNode={vi.fn()}
        onEnterNode={onEnterNode}
        onHoverNode={vi.fn()}
      />,
    );

    await user.click(screen.getByText('View architecture as accessible tables'));
    const rowButtons = screen.getAllByRole('button', { name: /backend \(collapse\)/i });
    await user.click(rowButtons[0]);

    expect(onEnterNode).not.toHaveBeenCalled();
  });
});
