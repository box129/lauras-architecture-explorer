import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge as RFEdge,
  type Node as RFNode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { evidenceStatusMeta } from '../../design/status';
import { MAP_CONFIDENCE_EXPLANATION, formatMapConfidencePercent } from '../../design/mapConfidence';
import type { ObservatoryLandscapeFixture, ObservatoryNode } from '../observatory/types';
import LensNode from './LensNode';
import SemanticEdge from './SemanticEdge';
import { ArchitectureMapEmptyState } from './ArchitectureMapStates';
import { defaultExpandedContainerIds, layoutContainmentNodes } from './mapLayout';

interface ArchitectureMapCanvasProps {
  fixture: ObservatoryLandscapeFixture;
  selectedNode: ObservatoryNode | null;
  focalNode: ObservatoryNode | null;
  onSelectNode: (node: ObservatoryNode | null) => void;
  onEnterNode: (node: ObservatoryNode, selectOnly?: boolean) => void;
  onHoverNode: (node: ObservatoryNode) => void;
  /** Entity Focus (06_ENTITY_FOCUS_SPEC): incoming ▸ entity ▸ outgoing,
   * left to right; the centred entity renders visually dominant and the
   * two side columns are named. */
  entityFocus?: boolean;
}

const nodeTypes = { lensNode: LensNode };
const edgeTypes = { semantic: SemanticEdge };

function minimapColor(node: RFNode) {
  const data = node.data as unknown as ObservatoryNode;
  return evidenceStatusMeta[data.status].color;
}

export default function ArchitectureMapCanvas({
  fixture,
  selectedNode,
  focalNode,
  onSelectNode,
  onEnterNode,
  onHoverNode,
  entityFocus = false,
}: ArchitectureMapCanvasProps) {
  const graphAlternativeRef = useRef<HTMLDetailsElement>(null);

  // Phase C1: which structural regions are currently expanded in place --
  // purely local, ephemeral canvas UI state (NOT navigation state: it
  // never touches the breadcrumb/URL/lens stack, per STATE_1_OVERVIEW.md's
  // explicit expand-vs-navigate separation). Reset to the default
  // (top-level regions expanded, everything deeper collapsed) whenever the
  // user navigates to a different scope.
  const scopeKey = focalNode?.id ?? 'root';
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => defaultExpandedContainerIds(fixture.nodes));
  useEffect(() => {
    setExpandedIds(defaultExpandedContainerIds(fixture.nodes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const nodesById = useMemo(() => new Map(fixture.nodes.map((node) => [node.id, node])), [fixture.nodes]);

  const nodes = useMemo<RFNode[]>(() => {
    if (!fixture.hasContainment) {
      return fixture.nodes.map((node) => ({
        id: node.id,
        type: 'lensNode',
        position: node.position,
        data: {
          ...node,
          isSelected: selectedNode?.id === node.id,
          isFocal: entityFocus && focalNode?.id === node.id,
        } as unknown as Record<string, unknown>,
        draggable: false,
      }));
    }
    // Nested containment: real ReactFlow parent/child nodes via
    // parentId + extent:'parent' -- see mapLayout's layoutContainmentNodes
    // for why this needs no new graphing library. Only nodes that are
    // top-level or descend from a currently-expanded container are laid
    // out/rendered at all, so a large repository never pays the cost of
    // positioning content the user hasn't revealed yet.
    return layoutContainmentNodes(fixture.nodes, expandedIds).map((laid) => {
      const source = nodesById.get(laid.id);
      return {
        id: laid.id,
        type: 'lensNode',
        position: laid.position,
        parentId: laid.parentId,
        extent: laid.extent,
        style: { width: laid.width, height: laid.height },
        zIndex: laid.isExpanded ? 0 : 1,
        data: {
          ...source,
          isSelected: selectedNode?.id === laid.id,
          isContainer: laid.isContainer,
          isExpanded: laid.isExpanded,
          directChildCount: laid.directChildCount,
        } as unknown as Record<string, unknown>,
        draggable: false,
      };
    });
  }, [fixture.hasContainment, fixture.nodes, expandedIds, nodesById, selectedNode?.id, entityFocus, focalNode?.id]);

  const visibleIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const edges = useMemo<RFEdge[]>(() => (
    fixture.edges
      .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'semantic',
        // Every edge names its relation kind (06_ENTITY_FOCUS_SPEC): the
        // label is the real recovered kind, never colour alone.
        data: { ...edge, edgeLabel: edge.label || edge.kind.replaceAll('_', ' ') },
      }))
  ), [fixture.edges, visibleIds]);

  // Phase C1: expand/collapse toggling a structural region is a distinct
  // interaction from entering/selecting a node -- it never calls
  // onEnterNode (no breadcrumb/URL/lens-stack change), only flips local
  // canvas state. A collapsed container's card body triggers this; a leaf
  // (real module/symbol, or a leaf-shaped structural_group with no further
  // real sub-containers) keeps navigating exactly as it always has.
  const toggleExpand = (nodeId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleNodeClick = (event: ReactMouseEvent, node: RFNode) => {
    const data = node.data as unknown as ObservatoryNode & { isContainer?: boolean; isExpanded?: boolean };
    if (fixture.hasContainment && data.isExpanded) {
      toggleExpand(node.id); // click on an expanded frame's header collapses it
      return;
    }
    if (fixture.hasContainment && data.isContainer) {
      toggleExpand(node.id); // click on a collapsed container expands it in place
      return;
    }
    onEnterNode(data, event.altKey);
  };

  if (fixture.nodes.length === 0) {
    return (
      <ArchitectureMapEmptyState
        title={focalNode ? 'No child areas returned' : 'No architecture areas yet'}
        message={focalNode
          ? 'This area exists, but no child architecture areas were returned. The backend may still have implementation evidence without enough semantic structure for a deeper map yet.'
          : 'The backend returned an architecture map without visible top-level nodes. Run a fresh analysis or inspect diagnostics before trusting this repo shape.'}
      />
    );
  }

  return (
    <main className="obs-canvas obs-canvas--react-flow" aria-label="Semantic architecture map">
      {entityFocus && (
        <div className="obs-entity-columns" aria-hidden="true">
          <span>Depended on by</span>
          <span>Depends on</span>
        </div>
      )}
      <section className="obs-canvas__summary obs-canvas__summary--floating">
        {focalNode && (
          <div className="obs-focal-header">
            <span>{focalNode.kind.replaceAll('_', ' ')}</span>
            <strong>{focalNode.label}</strong>
            <small>{focalNode.childrenCount} module{focalNode.childrenCount === 1 ? '' : 's'}</small>
          </div>
        )}
        <p>{fixture.summary}</p>
        <p className="obs-canvas__hint">Select an area to explore it.</p>
        {fixture.hiddenNodeCount && fixture.hiddenNodeCount > 0 && (
          <div className="obs-map-diagnostic">
            {fixture.hiddenNodeCount} more areas are hidden for readability.
          </div>
        )}
      </section>
      <ReactFlowProvider>
        <ReactFlow
          key={focalNode?.id ?? 'root'}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.26, duration: 520 }}
          minZoom={0.36}
          maxZoom={1.7}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          proOptions={{ hideAttribution: true }}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={(_, node) => onHoverNode(node.data as unknown as ObservatoryNode)}
          onPaneClick={() => onSelectNode(null)}
          className="obs-rf"
        >
          <Controls showInteractive={false} className="obs-rf-controls" />
          <MiniMap
            className="obs-rf-minimap"
            nodeColor={minimapColor}
            maskColor="rgba(248, 245, 241, 0.72)"
            pannable
            zoomable
          />
        </ReactFlow>
      </ReactFlowProvider>
      <details
        ref={graphAlternativeRef}
        className="obs-graph-alternative"
        onClick={(event) => {
          // The panel is a `position: absolute` overlay that can sit on
          // top of canvas nodes underneath it (see ArchitectureMapCanvas
          // usability audit). A click that lands on the panel's own
          // background/whitespace -- rather than the summary toggle or a
          // row-navigation button -- almost always means the user meant
          // to interact with the canvas beneath it. Auto-collapse so that
          // click "gets through" on the next attempt instead of silently
          // doing nothing.
          const target = event.target as HTMLElement;
          if (target.closest('summary') || target.closest('button')) return;
          if (graphAlternativeRef.current) graphAlternativeRef.current.open = false;
        }}
      >
        <summary>View architecture as accessible tables</summary>
        <div className="obs-graph-alternative__content">
          <table>
            <caption>Architecture areas</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Kind</th>
                <th scope="col">Status</th>
                <th scope="col">Members</th>
                <th scope="col">Evidence</th>
                {fixture.hasContainment && <th scope="col">Parent section</th>}
              </tr>
            </thead>
            <tbody>
              {/* Phase C1: mirrors exactly the same visible-node set the
                  canvas currently renders (respecting expand/collapse
                  state) -- never a separately-computed flat list, per the
                  "canvas and accessible representation must represent the
                  SAME state" requirement. */}
              {fixture.nodes.filter((node) => !fixture.hasContainment || visibleIds.has(node.id)).map((node) => {
                const isContainer = fixture.hasContainment && fixture.nodes.some((candidate) => candidate.parentGroupId === node.id);
                const isExpanded = isContainer && expandedIds.has(node.id);
                const parentLabel = node.parentGroupId
                  ? fixture.nodes.find((candidate) => candidate.id === node.parentGroupId)?.label ?? '—'
                  : '—';
                return (
                  <tr key={node.id}>
                    <th scope="row">
                      <button
                        type="button"
                        className="obs-table-row-button"
                        /*
                         * Same navigation logic as a plain canvas click
                         * (ArchitectureMapCanvas's onNodeClick below passes
                         * event.altKey as selectOnly -- a normal click drills
                         * in when the node canDrilldown, Alt+click forces
                         * select-only). Reusing that exact semantic here
                         * means the table is not a second, duplicated
                         * traversal implementation: it calls the identical
                         * onEnterNode callback with the identical selectOnly
                         * rule, so module -> class -> method drilldown and
                         * "Architectural Explanation" from a table-selected
                         * entity behave exactly as they do from the canvas.
                         * A structural container is the one exception,
                         * exactly matching the canvas: activating it
                         * toggles expand/collapse in place instead (never
                         * navigation), keeping table and canvas identical.
                         */
                        onClick={(event) => (isContainer ? toggleExpand(node.id) : onEnterNode(node, event.altKey))}
                        aria-label={
                          isContainer
                            ? `${node.label} (${isExpanded ? 'collapse' : 'expand'})`
                            : node.canDrilldown
                              ? `${node.label} (Enter to open, Alt+click to select only)`
                              : `${node.label} (select)`
                        }
                      >
                        {node.label}
                      </button>
                    </th>
                    <td>{node.kind.replaceAll('_', ' ')}</td>
                    <td>{evidenceStatusMeta[node.status].label}</td>
                    <td>{node.childrenCount > 0 ? node.childrenCount : '—'}</td>
                    <td>{node.evidenceCount}</td>
                    {fixture.hasContainment && <td>{parentLabel}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <table>
            <caption>
              Architecture relationships
              <span className="obs-table-caption__hint"> &mdash; Map confidence is a structural classification score, not a claim verification status.</span>
            </caption>
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">Relationship</th>
                <th scope="col">To</th>
                <th scope="col" title={MAP_CONFIDENCE_EXPLANATION}>Map confidence</th>
              </tr>
            </thead>
            <tbody>
              {fixture.edges.map((edge) => (
                <tr key={edge.id}>
                  <td>{fixture.nodes.find((node) => node.id === edge.source)?.label ?? edge.source}</td>
                  <td>{edge.label || edge.kind.replaceAll('_', ' ')}</td>
                  <td>{fixture.nodes.find((node) => node.id === edge.target)?.label ?? edge.target}</td>
                  <td title={MAP_CONFIDENCE_EXPLANATION}>{edge.confidence == null ? 'Not supplied' : `${formatMapConfidencePercent(edge.confidence)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="obs-legend obs-legend--rf">
        {(['verified', 'insufficient', 'candidate', 'unsupported', 'stale', 'legacy'] as const).map((status) => (
          <span className="obs-legend__item" key={status} title={evidenceStatusMeta[status].description}>
            <span className={evidenceStatusMeta[status].className} />
            <span>{evidenceStatusMeta[status].label}</span>
          </span>
        ))}
      </div>
      <div className="obs-rf-watermark" aria-hidden="true">
        {/* Phase C1: a truthful, layered replacement for the old "N areas
            * M links" wording once real containment/grouping metadata is
            available -- see mapAdapter's containmentSummaryLine. Falls
            back to the original phrasing everywhere else (flat Overview,
            State 2 leaf drilldown, Entity Focus) since those fixtures
            never had a misleading "0 links" problem to begin with. */}
        {fixture.overviewSummaryLine ?? `${fixture.nodes.length} areas · ${fixture.edges.length} links`}
      </div>
    </main>
  );
}
