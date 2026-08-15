import type { ObservatoryNode } from '../observatory/types';

const NODE_WIDTH = 238;
const NODE_HEIGHT = 104;
const X_GAP = 82;
const Y_GAP = 72;
const START_X = 120;
const START_Y = 150;

// Phase B group cards use the Option B ("domain card") visual treatment --
// a deliberately larger footprint than a plain module/entity card, so a
// grouped Overview reads as "these are containers" at a glance, not just
// via icon/label. Only the Overview's own group cards use this size;
// area drill-down and Entity Focus keep the standard, smaller card.
export const GROUP_NODE_WIDTH = 288;
export const GROUP_NODE_HEIGHT = 148;

interface LayoutNodeSize {
  width?: number;
  height?: number;
}

export function layoutArchitectureNodes<T extends Pick<ObservatoryNode, 'id'>>(
  nodes: T[],
  size: LayoutNodeSize = {},
): Array<T & { position: { x: number; y: number } }> {
  const count = nodes.length;
  if (count === 0) return [];

  const width = size.width ?? NODE_WIDTH;
  const height = size.height ?? NODE_HEIGHT;
  const columns = count <= 3 ? count : count <= 9 ? 3 : 4;

  return nodes.map((node, index) => {
    const row = Math.floor(index / columns);
    const itemsInRow = Math.min(columns, count - row * columns);
    const rowOffset = ((columns - itemsInRow) * (width + X_GAP)) / 2;
    const column = index % columns;
    return {
      ...node,
      position: {
        x: START_X + rowOffset + column * (width + X_GAP),
        y: START_Y + row * (height + Y_GAP),
      },
    };
  });
}

const FOCUS_SIDE_GAP = NODE_WIDTH + X_GAP + 90;

function layoutFocusColumn<T>(nodes: T[], x: number, centerY: number): Array<T & { position: { x: number; y: number } }> {
  const totalHeight = nodes.length * NODE_HEIGHT + Math.max(0, nodes.length - 1) * Y_GAP;
  const top = centerY - totalHeight / 2;
  return nodes.map((node, index) => ({
    ...node,
    position: { x, y: top + index * (NODE_HEIGHT + Y_GAP) },
  }));
}

// Entity Focus layout: the selected entity is centered and visually
// dominant; dependents (things that call into it) sit to its left and
// dependencies (things it calls into) sit to its right, matching the real
// edge direction on each side rather than an arbitrary grid position.
export function layoutEntityFocusNodes<T extends Pick<ObservatoryNode, 'id'>>(
  selected: T,
  dependents: T[],
  dependencies: T[],
): Array<T & { position: { x: number; y: number } }> {
  const centerY = START_Y + Math.max(dependents.length, dependencies.length, 1) * (NODE_HEIGHT + Y_GAP) / 2;
  const centerX = START_X + FOCUS_SIDE_GAP;
  return [
    { ...selected, position: { x: centerX, y: centerY } },
    ...layoutFocusColumn(dependents, centerX - FOCUS_SIDE_GAP, centerY),
    ...layoutFocusColumn(dependencies, centerX + FOCUS_SIDE_GAP, centerY),
  ];
}

// ---------------------------------------------------------------------------
// Phase C1: nested deterministic containment layout.
//
// Positions every node RELATIVE TO ITS IMMEDIATE PARENT (never an
// absolute canvas coordinate) for any node with a real `parentGroupId`,
// so ReactFlow's own `parentId`/`extent: 'parent'` sub-flow support
// renders true nested enclosing containers -- see
// docs/design-proposals/semantic-architecture-overview/INFORMATION_MODEL.md
// for why this needed no new graphing library. A container that is not
// currently expanded (progressive disclosure -- see STATE_1_OVERVIEW.md)
// renders as a single, fixed-size collapsed card exactly like a leaf, and
// none of its descendants are included in the result at all until it is
// expanded -- keeping the initial render bounded regardless of how many
// modules exist deep in the tree (see IMPLEMENTATION_PLAN.md's
// performance/scale table).
// ---------------------------------------------------------------------------

const CONTAINER_HEADER_HEIGHT = 56;
const CONTAINER_PADDING = 20;
const CONTAINER_GAP = 24;
const COLLAPSED_CONTAINER_WIDTH = 260;
const COLLAPSED_CONTAINER_HEIGHT = 96;
const MIN_CONTAINER_WIDTH = 320;

export interface NestedLayoutNode {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  parentId?: string;
  extent?: 'parent';
  isContainer: boolean;
  isExpanded: boolean;
  directChildCount: number;
}

interface LaidOutSubtree {
  width: number;
  height: number;
  results: NestedLayoutNode[];
}

function layoutSubtree(
  node: ObservatoryNode,
  childrenByParent: Map<string, ObservatoryNode[]>,
  expandedIds: ReadonlySet<string>,
  depth: number,
): LaidOutSubtree {
  const children = childrenByParent.get(node.id) ?? [];
  const isContainer = children.length > 0;
  const isExpanded = isContainer && expandedIds.has(node.id);

  if (!isExpanded) {
    const width = isContainer ? COLLAPSED_CONTAINER_WIDTH : depth === 0 ? GROUP_NODE_WIDTH : NODE_WIDTH;
    const height = isContainer ? COLLAPSED_CONTAINER_HEIGHT : depth === 0 ? GROUP_NODE_HEIGHT : NODE_HEIGHT;
    return {
      width,
      height,
      results: [{ id: node.id, position: { x: 0, y: 0 }, width, height, isContainer, isExpanded: false, directChildCount: children.length }],
    };
  }

  const sorted = [...children].sort((a, b) => a.label.localeCompare(b.label));
  const childLayouts = sorted.map((child) => layoutSubtree(child, childrenByParent, expandedIds, depth + 1));
  const columns = sorted.length <= 3 ? sorted.length : sorted.length <= 9 ? 3 : 4;

  const placed: NestedLayoutNode[] = [];
  let cursorY = CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING;
  let contentWidth = 0;
  for (let rowStart = 0; rowStart < childLayouts.length; rowStart += columns) {
    const row = childLayouts.slice(rowStart, rowStart + columns);
    let cursorX = CONTAINER_PADDING;
    let rowHeight = 0;
    for (const child of row) {
      const [selfResult, ...descendantResults] = child.results;
      placed.push({ ...selfResult, position: { x: cursorX, y: cursorY }, parentId: node.id, extent: 'parent' });
      placed.push(...descendantResults);
      cursorX += child.width + CONTAINER_GAP;
      rowHeight = Math.max(rowHeight, child.height);
    }
    contentWidth = Math.max(contentWidth, cursorX - CONTAINER_GAP + CONTAINER_PADDING);
    cursorY += rowHeight + CONTAINER_GAP;
  }
  const width = Math.max(contentWidth, MIN_CONTAINER_WIDTH);
  const height = cursorY + CONTAINER_PADDING - CONTAINER_GAP;
  return {
    width,
    height,
    results: [
      { id: node.id, position: { x: 0, y: 0 }, width, height, isContainer: true, isExpanded: true, directChildCount: children.length },
      ...placed,
    ],
  };
}

/** Default expansion: every top-level container (no real parent) starts
 * expanded, revealing its direct children; anything deeper starts
 * collapsed. Matches STATE_1_OVERVIEW.md's progressive-disclosure rule. */
export function defaultExpandedContainerIds(nodes: ObservatoryNode[]): Set<string> {
  const hasChildren = new Set(nodes.map((node) => node.parentGroupId).filter((id): id is string => Boolean(id)));
  return new Set(nodes.filter((node) => !node.parentGroupId && hasChildren.has(node.id)).map((node) => node.id));
}

export function layoutContainmentNodes(
  nodes: ObservatoryNode[],
  expandedIds: ReadonlySet<string>,
): NestedLayoutNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, ObservatoryNode[]>();
  for (const node of nodes) {
    // Defensive: a parentGroupId that doesn't resolve to a node actually
    // present in this fixture is treated as top-level rather than dropped.
    const parentId = node.parentGroupId && byId.has(node.parentGroupId) ? node.parentGroupId : null;
    if (!parentId) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(node);
    childrenByParent.set(parentId, list);
  }
  const topLevel = nodes.filter((node) => !node.parentGroupId || !byId.has(node.parentGroupId));
  const sortedTopLevel = [...topLevel].sort((a, b) => a.label.localeCompare(b.label));
  const topLayouts = sortedTopLevel.map((node) => layoutSubtree(node, childrenByParent, expandedIds, 0));

  const columns = sortedTopLevel.length <= 3 ? sortedTopLevel.length : sortedTopLevel.length <= 6 ? 3 : 4;
  const results: NestedLayoutNode[] = [];
  let cursorX = START_X;
  let cursorY = START_Y;
  let rowMaxHeight = 0;
  let column = 0;
  for (const layout of topLayouts) {
    const [selfResult, ...descendantResults] = layout.results;
    results.push({ ...selfResult, position: { x: cursorX, y: cursorY } });
    results.push(...descendantResults);
    cursorX += layout.width + X_GAP;
    rowMaxHeight = Math.max(rowMaxHeight, layout.height);
    column += 1;
    if (column >= columns) {
      column = 0;
      cursorX = START_X;
      cursorY += rowMaxHeight + Y_GAP;
      rowMaxHeight = 0;
    }
  }
  return results;
}
