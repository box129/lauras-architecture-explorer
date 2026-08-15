import {
  Database,
  Globe2,
  LineChart,
  Puzzle,
  Radio,
  Share2,
  ShieldCheck,
  TimerReset,
  type LucideIcon,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import type { ObservatoryNode } from './types';

const icons: Record<string, LucideIcon> = {
  Database,
  Cylinder: Database,
  Globe2,
  LineChart,
  Puzzle,
  Radio,
  Share2,
  ShieldCheck,
  TimerReset,
};

interface LensNodeCardProps {
  node: ObservatoryNode;
  selected: boolean;
  dimmed: boolean;
  onSelect: (node: ObservatoryNode) => void;
}

export default function LensNodeCard({ node, selected, dimmed, onSelect }: LensNodeCardProps) {
  const Icon = icons[node.icon] ?? Database;
  return (
    <button
      className={`obs-node ${selected ? 'obs-node--selected' : ''} ${dimmed ? 'obs-node--dimmed' : ''}`}
      style={{ left: node.position.x, top: node.position.y }}
      type="button"
      onClick={() => onSelect(node)}
      aria-pressed={selected}
    >
      <span className="obs-node__icon" data-accent={node.accent}>
        <Icon size={28} strokeWidth={1.6} />
      </span>
      <span className="obs-node__body">
        <span className="obs-node__title">{node.label}</span>
        <span className="obs-node__description">{node.description}</span>
        <span className="obs-node__meta">
          <StatusBadge status={node.status} />
          <span>{node.evidenceCount} evidence</span>
          <span>{node.childrenCount} areas</span>
        </span>
      </span>
    </button>
  );
}
