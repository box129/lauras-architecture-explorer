import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React, { type ReactNode } from 'react';
import type { ArchitectureGraphResponse } from './graphTypes';

const response: ArchitectureGraphResponse = {
  schema_version: 'architecture-graph/v2', analysis_run_id: 'run:test',
  groups: [
    { id: 'region', analysis_run_id: 'run:test', label: 'Repository root files', structural_path: 'Repository root files', parent_group_id: null, kind: 'structural_leaf', direct_member_module_ids: [], direct_child_group_ids: ['cluster'], recursive_module_count: 1, can_drilldown: true },
    { id: 'cluster', analysis_run_id: 'run:test', label: 'Structural cluster 1', structural_path: 'Repository root files', parent_group_id: 'region', kind: 'relation_cluster', direct_member_module_ids: ['module'], direct_child_group_ids: ['module'], recursive_module_count: 1, can_drilldown: false, cluster_id: 'cluster', internal_relation_count: 3, boundary_relation_count: 1, internal_relation_kind_counts: [['calls', 3]], boundary_relation_kind_counts: [['calls', 1]] },
    { id: 'module', analysis_run_id: 'run:test', label: 'app.py', structural_path: 'Repository root files', parent_group_id: 'cluster', kind: 'module', direct_member_module_ids: [], direct_child_group_ids: [], recursive_module_count: 1, can_drilldown: false },
  ], aggregate_edges: [], internal_relation_counts: [],
};

vi.mock('../../api/client', () => ({ fetchApi: vi.fn(async (path: string) => path.includes('/interpretation') ? { analysis_run_id: 'run:test', cluster_id: 'cluster', status: 'available', interpretation: { cluster_id: 'cluster', label: 'Request Context', description: 'This cluster appears centered on request context.', provider: 'openai', model: 'test-model' } } : response) }));
vi.mock('./elkCompoundProof', () => ({ layoutArchitectureGraphProof: vi.fn(async (groups: Array<{ id: string; parent_group_id: string | null }>) => ({ routedEdgeIds: [], nodes: groups.map((group) => ({ id: group.id, parentId: group.parent_group_id, position: { x: 0, y: 0 }, width: 240, height: 120 })) })) }));
vi.mock('@xyflow/react', () => ({
  Background: () => null, Controls: () => null, MiniMap: () => null, ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
  ReactFlow: ({ nodes, onNodeClick }: { nodes: Array<{ id: string; data: { label: string } }>; onNodeClick: (event: object, node: unknown) => void }) => <div>{nodes.map((node) => <button key={node.id} type="button" onClick={() => onNodeClick({}, node)}>{node.data.label}</button>)}</div>,
  useViewport: () => ({ zoom: 1 }),
  Handle: () => null, Position: { Left: 'left', Right: 'right' },
}));
vi.mock('../architecture-map/SemanticEdge', () => ({ default: () => null }));
vi.mock('./ArchitectureRegionNode', () => ({ default: () => null }));

import ArchitectureGraphOverview from './ArchitectureGraphOverview';
import ArchitectureGraphInspector from './ArchitectureGraphInspector';

function Harness() {
  const [selected, setSelected] = React.useState<import('../observatory/types').ObservatoryNode | null>(null);
  return <><ArchitectureGraphOverview runId="run:test" selectedNode={selected} onSelectNode={setSelected} onEnterNode={vi.fn()} onHoverNode={vi.fn()} /><ArchitectureGraphInspector node={selected} onEnter={vi.fn()} onExpand={vi.fn()} /></>;
}

describe('architecture graph selection synchronization', () => {
  it('uses one selected node for accessible selection, canvas selection, and inspector', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('Repository root files')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    const cluster = await screen.findAllByRole('button', { name: 'Structural cluster 1' });
    fireEvent.click(cluster[cluster.length - 1]);
    expect(screen.getAllByText('Selected').length).toBeGreaterThan(1);
    expect(await screen.findByRole('heading', { name: 'Structural cluster 1' })).toBeInTheDocument();
    expect(screen.getByText('Derived mechanically from resolved source relationships.')).toBeInTheDocument();
    // The canvas node and accessible row resolve to the same selected id.
    fireEvent.click(screen.getAllByRole('button', { name: 'Structural cluster 1' })[0]);
    expect(screen.getAllByText('Selected').length).toBeGreaterThan(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Repository root files' }).at(-1)!);
    expect(await screen.findByRole('heading', { name: 'Repository root files' })).toBeInTheDocument();
  });

  it('keeps Expand independent from selection', async () => {
    const onSelect = vi.fn();
    render(<ArchitectureGraphOverview runId="run:test" selectedNode={null} onSelectNode={onSelect} onEnterNode={vi.fn()} onHoverNode={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Repository root files')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(await screen.findByText('Structural cluster 1')).toBeInTheDocument();
  });

  it('generates a labelled interpretation while keeping deterministic facts visible', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('Repository root files')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Structural cluster 1' })).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Generate interpretation' }));
    expect(await screen.findByRole('heading', { name: 'Request Context' })).toBeInTheDocument();
    expect(screen.getByText('AI interpretation')).toBeInTheDocument();
    expect(screen.getByText('Deterministic identity · Structural cluster 1')).toBeInTheDocument();
    expect(screen.getByText('Internal relations')).toBeInTheDocument();
  });

  it('shows scope-aware copy when nothing is selected, instead of the same root-level text at every depth', async () => {
    const { rerender } = render(<ArchitectureGraphInspector node={null} onEnter={vi.fn()} onExpand={vi.fn()} scopeGroupId={null} />);
    expect(await screen.findByText('Select a structural region to inspect its recovered architecture.')).toBeInTheDocument();
    rerender(<ArchitectureGraphInspector node={null} onEnter={vi.fn()} onExpand={vi.fn()} scopeGroupId="region" />);
    expect(await screen.findByText('Select a region, cluster, or module in Repository root files to inspect it.')).toBeInTheDocument();
  });

  it('never renders a Verified badge for a selected structural region or relation cluster', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('Repository root files')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: 'Repository root files' }).at(-1)!);
    expect(await screen.findByRole('heading', { name: 'Repository root files' })).toBeInTheDocument();
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand' })[0]);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Structural cluster 1' })).at(-1)!);
    expect(await screen.findByRole('heading', { name: 'Structural cluster 1' })).toBeInTheDocument();
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });
});
