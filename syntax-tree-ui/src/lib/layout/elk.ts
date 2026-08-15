/**
 * ELK-based hierarchical layered layout for v2 architecture diagrams.
 *
 * Renders nested compound nodes:
 *   root  →  macro_layer (group)  →  subsystem (group or leaf)  →  components (leaf)
 *
 * Falls back to a deterministic grid (with collision resolution) if elkjs fails.
 */
import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { V2HierarchyNode, V2HierarchyEdge, V2LayoutHints } from '../../api/types';

export interface ElkLayoutResult {
  nodes: RFNode[];
  edges: RFEdge[];
  width: number;
  height: number;
  fallback: boolean;
}

const DEFAULTS = {
  layerWidth: 260,
  layerHeight: 80,
  subsystemWidth: 220,
  subsystemHeight: 120,
  paddingTop: 28,
  paddingBetweenLayers: 70,
  paddingBetweenSubs: 30,
};

const elk = new ELK();

const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '90',
  'elk.layered.spacing.edgeNodeBetweenLayers': '40',
  'elk.spacing.nodeNode': '40',
  'elk.padding': '[top=24, left=24, bottom=24, right=24]',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.crossingMinimization.semiInteractive': 'true',
};

function flattenForElk(root: V2HierarchyNode): { elkRoot: ElkNode; ids: Set<string> } {
  const ids = new Set<string>();

  function build(n: V2HierarchyNode, depth: number): ElkNode {
    ids.add(n.id);
    const isLeaf = !n.children || n.children.length === 0;
    const elkNode: ElkNode = {
      id: n.id,
      width: isLeaf
        ? DEFAULTS.subsystemWidth
        : n.kind === 'macro_layer' ? DEFAULTS.layerWidth : DEFAULTS.subsystemWidth,
      height: isLeaf
        ? DEFAULTS.subsystemHeight
        : DEFAULTS.layerHeight,
      layoutOptions: {
        ...LAYOUT_OPTIONS,
      },
    };
    if (!isLeaf) {
      elkNode.children = (n.children || []).map((c) => build(c, depth + 1));
    }
    return elkNode;
  }

  return { elkRoot: build(root, 0), ids };
}

function buildElkEdges(edges: V2HierarchyEdge[], validIds: Set<string>): ElkExtendedEdge[] {
  return edges
    .filter((e) => validIds.has(e.src) && validIds.has(e.dst))
    .map((e, i) => ({
      id: `e_${i}_${e.src}_${e.dst}`,
      sources: [e.src],
      targets: [e.dst],
    }));
}

function applyLayoutHints(elkRoot: ElkNode, hints: V2LayoutHints | undefined): void {
  if (!hints) return;
  // Align-horizontal hints become layered semi-interactive same-layer hints (best-effort).
  for (const group of hints.align_horizontal || []) {
    if (group.length < 2) continue;
    walk(elkRoot, (n) => {
      if (group.includes(n.id) && n.layoutOptions) {
        n.layoutOptions['elk.position'] = `(0,0)`; // marker — bumped by Brandes-Koepf
      }
    });
  }
}

function walk(node: ElkNode, fn: (n: ElkNode) => void): void {
  fn(node);
  for (const c of node.children || []) walk(c, fn);
}

function elkToReactFlow(elkRoot: ElkNode, semantic: V2HierarchyNode): RFNode[] {
  const out: RFNode[] = [];
  const semanticById = new Map<string, V2HierarchyNode>();
  (function index(n: V2HierarchyNode) {
    semanticById.set(n.id, n);
    (n.children || []).forEach(index);
  })(semantic);

  function emit(n: ElkNode, parentId: string | undefined, depth: number): void {
    const sem = semanticById.get(n.id);
    if (!sem) return;
    const isGroup = (n.children?.length ?? 0) > 0;
    const confidence = sem.confidence ?? 0;
    const labelHtml = isGroup
      ? `${sem.label}  ·  ${(confidence * 100).toFixed(0)}%`
      : `${sem.label}\n${(confidence * 100).toFixed(0)}% · ${(sem.members ?? []).length} mem`;
    out.push({
      id: n.id,
      position: { x: n.x ?? 0, y: n.y ?? 0 },
      style: isGroup
        ? {
            width: n.width,
            height: n.height,
            backgroundColor:
              sem.kind === 'macro_layer' ? 'rgba(15, 23, 42, 0.55)' : 'rgba(30, 41, 59, 0.55)',
            border: sem.kind === 'macro_layer' ? '1px solid #64748b' : '1px solid #475569',
            borderRadius: 12,
            padding: 12,
            color: '#e2e8f0',
            fontSize: 12,
            fontWeight: 600,
          }
        : {
            width: n.width,
            height: n.height,
            backgroundColor: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #475569',
            borderRadius: 8,
            padding: 8,
            fontSize: 11,
            whiteSpace: 'pre-line',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          },
      data: {
        label: labelHtml,
        kind: sem.kind,
        confidence,
        rationale: sem.rationale ?? '',
        evidence: sem.evidence ?? [],
        members: sem.members ?? [],
        depth,
      },
      type: isGroup ? 'group' : 'default',
      ...(parentId ? { parentId, extent: 'parent' as const } : {}),
      draggable: !isGroup,
      selectable: true,
    });
    for (const child of n.children || []) emit(child, n.id, depth + 1);
  }
  for (const child of elkRoot.children || []) emit(child, undefined, 0);
  return out;
}

function fallbackGridLayout(semantic: V2HierarchyNode, edges: V2HierarchyEdge[]): ElkLayoutResult {
  const nodes: RFNode[] = [];
  const layers = semantic.children || [];
  let y = 0;
  let maxWidth = 0;
  for (const layer of layers) {
    const subs = layer.children || [];
    const layerWidth = Math.max(layer.label.length * 10 + 80, subs.length * (DEFAULTS.subsystemWidth + 30));
    nodes.push({
      id: layer.id,
      position: { x: 0, y },
      style: {
        width: layerWidth,
        height: DEFAULTS.subsystemHeight + 2 * DEFAULTS.paddingBetweenSubs + 24,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        border: '1px solid #475569',
        borderRadius: 12,
        padding: 12,
      },
      data: { label: layer.label, kind: layer.kind, confidence: layer.confidence ?? 0, depth: 0 },
      type: 'group',
      draggable: false,
      selectable: true,
    });
    let x = 12;
    for (const sub of subs) {
      nodes.push({
        id: sub.id,
        parentId: layer.id,
        extent: 'parent',
        position: { x, y: 36 },
        style: { width: DEFAULTS.subsystemWidth, height: DEFAULTS.subsystemHeight },
        data: {
          label: sub.label, kind: sub.kind, confidence: sub.confidence ?? 0,
          rationale: sub.rationale ?? '', evidence: sub.evidence ?? [],
          members: sub.members ?? [], depth: 1,
        },
        draggable: true,
        selectable: true,
      });
      x += DEFAULTS.subsystemWidth + DEFAULTS.paddingBetweenSubs;
    }
    maxWidth = Math.max(maxWidth, layerWidth);
    y += DEFAULTS.subsystemHeight + DEFAULTS.paddingBetweenLayers + 36;
  }

  const validIds = new Set<string>(nodes.map((n) => n.id));
  const rfEdges: RFEdge[] = edges
    .filter((e) => validIds.has(e.src) && validIds.has(e.dst))
    .map((e, i) => ({
      id: `e_${i}_${e.src}_${e.dst}`,
      source: e.src,
      target: e.dst,
      type: 'smoothstep',
      data: { v2_type: e.type },
    }));
  return { nodes, edges: rfEdges, width: maxWidth + 24, height: y, fallback: true };
}

export async function layoutHierarchy(
  semantic: V2HierarchyNode | null,
  edges: V2HierarchyEdge[],
  hints?: V2LayoutHints,
): Promise<ElkLayoutResult> {
  if (!semantic) return { nodes: [], edges: [], width: 0, height: 0, fallback: true };
  try {
    const { elkRoot, ids } = flattenForElk(semantic);
    elkRoot.id = 'root';
    elkRoot.layoutOptions = LAYOUT_OPTIONS;
    elkRoot.edges = buildElkEdges(edges, ids);
    applyLayoutHints(elkRoot, hints);

    const laid = await elk.layout(elkRoot);
    const rfNodes = elkToReactFlow(laid, semantic);
    const validIds = new Set(rfNodes.map((n) => n.id));
    const rfEdges: RFEdge[] = edges
      .filter((e) => validIds.has(e.src) && validIds.has(e.dst))
      .map((e, i) => ({
        id: `e_${i}_${e.src}_${e.dst}`,
        source: e.src,
        target: e.dst,
        type: 'smoothstep',
        data: { v2_type: e.type },
        animated: e.type.includes('http') || e.type.includes('publish'),
      }));
    return {
      nodes: rfNodes, edges: rfEdges,
      width: laid.width ?? 0, height: laid.height ?? 0,
      fallback: false,
    };
  } catch (err) {
    console.warn('ELK layout failed, falling back to grid:', err);
    return fallbackGridLayout(semantic, edges);
  }
}
