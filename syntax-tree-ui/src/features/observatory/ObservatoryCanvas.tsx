import type { ObservatoryEdge, ObservatoryLandscapeFixture, ObservatoryNode } from './types';
import LensNodeCard from './LensNodeCard';
import StatusBadge from './StatusBadge';

interface ObservatoryCanvasProps {
  fixture: ObservatoryLandscapeFixture;
  selectedNode: ObservatoryNode | null;
  onSelectNode: (node: ObservatoryNode) => void;
}

function edgePath(edge: ObservatoryEdge, fixture: ObservatoryLandscapeFixture) {
  const source = fixture.nodes.find((node) => node.id === edge.source);
  const target = fixture.nodes.find((node) => node.id === edge.target);
  if (!source || !target) return '';
  const x1 = source.position.x + 205;
  const y1 = source.position.y + 46;
  const x2 = target.position.x;
  const y2 = target.position.y + 46;
  const mid = Math.max(36, Math.abs(x2 - x1) * 0.42);
  return `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`;
}

export default function ObservatoryCanvas({
  fixture,
  selectedNode,
  onSelectNode,
}: ObservatoryCanvasProps) {
  return (
    <main className="obs-canvas" aria-label="Observatory architecture landscape">
      <section className="obs-canvas__summary">
        <p>{fixture.summary}</p>
      </section>

      <div className="obs-map" aria-label="Mock Open WebUI semantic architecture map">
        <svg className="obs-map__edges" viewBox="0 0 1040 650" aria-hidden="true">
          {fixture.edges.map((edge) => (
            <path
              className={`obs-edge obs-edge--${edge.kind}`}
              d={edgePath(edge, fixture)}
              key={edge.id}
            />
          ))}
        </svg>

        {fixture.nodes.map((node) => (
          <LensNodeCard
            dimmed={!!selectedNode && selectedNode.id !== node.id}
            key={node.id}
            node={node}
            onSelect={onSelectNode}
            selected={selectedNode?.id === node.id}
          />
        ))}

        <div className="obs-minimap" aria-hidden="true">
          <div className="obs-minimap__viewport" />
          {fixture.nodes.map((node) => (
            <span
              className="obs-minimap__node"
              key={node.id}
              style={{
                left: `${node.position.x / 10.8}%`,
                top: `${node.position.y / 7.2}%`,
              }}
            />
          ))}
        </div>

        <div className="obs-legend">
          {(['verified', 'partial', 'candidate', 'inferred'] as const).map((status) => (
            <span className="obs-legend__item" key={status}>
              <StatusBadge status={status} />
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
