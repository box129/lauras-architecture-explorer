import { Heart, Thermometer } from 'lucide-react';
import { useSyntaxTreeStore } from '../../store';
import type { ViewType, HeatmapMode } from '../../store';
import SegmentedControl from '../shared/SegmentedControl';

const HEATMAP_OPTIONS: { value: HeatmapMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'coupling', label: 'Coupling' },
  { value: 'complexity', label: 'Complexity' },
  { value: 'impact', label: 'Impact' },
  { value: 'documentation', label: 'Docs' },
];

export default function ViewToolbar() {
  const viewType = useSyntaxTreeStore((s) => s.viewType);
  const setViewType = useSyntaxTreeStore((s) => s.setViewType);
  const scopeQN = useSyntaxTreeStore((s) => s.scopeQN);
  const heatmapMode = useSyntaxTreeStore((s) => s.heatmapMode);
  const setHeatmap = useSyntaxTreeStore((s) => s.setHeatmap);
  const heartbeatOn = useSyntaxTreeStore((s) => s.heartbeatOn);
  const setHeartbeat = useSyntaxTreeStore((s) => s.setHeartbeat);

  const viewOptions: { value: ViewType; label: string; disabled?: boolean; title?: string }[] = [
    { value: 'architecture', label: 'Architecture' },
    { value: 'layered', label: 'Layered' },
    { value: 'dependency', label: 'Dependency' },
    {
      value: 'call-flow',
      label: 'Call Flow',
      disabled: !scopeQN,
      title: scopeQN ? 'Show call flow from selected scope' : 'Select a function or method first',
    },
    { value: 'data-flow', label: 'Data Flow' },
    { value: 'hierarchy-v2', label: 'Hierarchy v2', title: 'Agentic v2 hierarchy (run analyze with engine=v2)' },
  ];

  return (
    <div className="h-10 bg-surface border-b border-border flex items-center px-3 gap-3 shrink-0">
      <SegmentedControl options={viewOptions} value={viewType} onChange={setViewType} size="sm" />

      <div className="w-px h-5 bg-border" />

      <div className="flex items-center gap-1.5">
        <Thermometer size={12} className="text-secondary" />
        <SegmentedControl options={HEATMAP_OPTIONS} value={heatmapMode} onChange={setHeatmap} size="sm" />
      </div>

      <div className="w-px h-5 bg-border" />

      <button
        onClick={() => setHeartbeat(!heartbeatOn)}
        className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
          heartbeatOn ? 'bg-accent/20 text-accent' : 'text-secondary hover:text-primary'
        }`}
        title="Toggle heartbeat animation"
      >
        <Heart size={12} className={heartbeatOn ? 'fill-accent' : ''} />
        <span>Pulse</span>
      </button>
    </div>
  );
}
