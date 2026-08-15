import { describe, expect, it } from 'vitest';
import { defaultExpandedContainerIds, layoutContainmentNodes } from './mapLayout';
import type { ObservatoryNode } from '../observatory/types';

/**
 * Phase C1: nested deterministic containment layout. These tests cover
 * the pure layout function directly (no React/ReactFlow rendering) --
 * ArchitectureMapCanvas.test.tsx covers how it wires into the canvas.
 */
function buildNode(overrides: Partial<ObservatoryNode>): ObservatoryNode {
  return {
    id: 'structural-group:a',
    label: 'backend',
    kind: 'structural_group',
    description: '',
    status: 'verified',
    confidence: null,
    evidenceCount: 0,
    childrenCount: 2,
    canDrilldown: true,
    primaryFiles: [],
    accent: 'stone',
    icon: 'FolderTree',
    position: { x: 0, y: 0 },
    summary: '',
    whatHappens: [],
    relatedLenses: [],
    parentGroupId: null,
    ...overrides,
  } as ObservatoryNode;
}

describe('defaultExpandedContainerIds', () => {
  it('expands every top-level container (something points at it as parent) by default', () => {
    const backend = buildNode({ id: 'backend', parentGroupId: null });
    const src = buildNode({ id: 'backend/src', parentGroupId: 'backend' });
    const controllers = buildNode({ id: 'backend/src/controllers', parentGroupId: 'backend/src', childrenCount: 0 });

    const expanded = defaultExpandedContainerIds([backend, src, controllers]);

    expect(expanded.has('backend')).toBe(true); // top-level, has a child -> expanded by default
    expect(expanded.has('backend/src')).toBe(false); // one level deeper -> collapsed by default
  });

  it('does not mark a true leaf (nothing points at it as parent) as expanded', () => {
    const leaf = buildNode({ id: 'frontend', parentGroupId: null, childrenCount: 3 });
    expect(defaultExpandedContainerIds([leaf]).has('frontend')).toBe(false);
  });
});

describe('layoutContainmentNodes', () => {
  it('renders a collapsed container as one fixed-size node, with none of its descendants included at all', () => {
    const backend = buildNode({ id: 'backend', parentGroupId: null });
    const src = buildNode({ id: 'backend/src', parentGroupId: 'backend' });
    const controllers = buildNode({ id: 'backend/src/controllers', parentGroupId: 'backend/src', childrenCount: 0 });

    const result = layoutContainmentNodes([backend, src, controllers], new Set());

    const ids = result.map((node) => node.id);
    expect(ids).toEqual(['backend']);
    const backendResult = result.find((node) => node.id === 'backend')!;
    expect(backendResult.isContainer).toBe(true);
    expect(backendResult.isExpanded).toBe(false);
    expect(backendResult.parentId).toBeUndefined();
  });

  it('expanding a container reveals its direct child as a real nested node with parentId/extent set, positioned relative to the parent', () => {
    const backend = buildNode({ id: 'backend', parentGroupId: null });
    const src = buildNode({ id: 'backend/src', parentGroupId: 'backend', childrenCount: 1 });

    const result = layoutContainmentNodes([backend, src], new Set(['backend']));

    const ids = result.map((node) => node.id);
    expect(ids).toEqual(expect.arrayContaining(['backend', 'backend/src']));
    const child = result.find((node) => node.id === 'backend/src')!;
    expect(child.parentId).toBe('backend');
    expect(child.extent).toBe('parent');
    // Relative to parent -- inside the parent's own padding/header area,
    // never a large absolute canvas coordinate.
    expect(child.position.x).toBeGreaterThanOrEqual(0);
    expect(child.position.y).toBeGreaterThan(0);
  });

  it('a leaf (no real children anywhere) is never treated as a container regardless of expand state', () => {
    const leaf = buildNode({ id: 'frontend', parentGroupId: null, childrenCount: 3 });
    const result = layoutContainmentNodes([leaf], new Set(['frontend']));
    expect(result[0].isContainer).toBe(false);
    expect(result[0].isExpanded).toBe(false);
  });

  it('collapsing a previously-expanded container removes its descendants from the result again', () => {
    const backend = buildNode({ id: 'backend', parentGroupId: null });
    const src = buildNode({ id: 'backend/src', parentGroupId: 'backend', childrenCount: 0 });

    const expanded = layoutContainmentNodes([backend, src], new Set(['backend']));
    const collapsed = layoutContainmentNodes([backend, src], new Set());

    expect(expanded.map((n) => n.id)).toContain('backend/src');
    expect(collapsed.map((n) => n.id)).not.toContain('backend/src');
  });

  it('a node whose parentGroupId does not resolve to any node present in this fixture is treated as top-level, not dropped', () => {
    const orphan = buildNode({ id: 'orphan', parentGroupId: 'does-not-exist', childrenCount: 0 });
    const result = layoutContainmentNodes([orphan], new Set());
    expect(result.map((n) => n.id)).toContain('orphan');
    expect(result[0].parentId).toBeUndefined();
  });
});
