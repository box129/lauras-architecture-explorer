import { useReactFlow, useViewport } from '@xyflow/react';
import { List, Columns2, Map as MapIcon, Maximize, Minus, Plus, PictureInPicture2 } from 'lucide-react';
import type { RelationFilter } from './graphAdapter';

export type ArchitectureViewMode = 'map' | 'outline' | 'both';

const FILTER_OPTIONS: { value: RelationFilter; label: string }[] = [
  { value: 'strongest', label: 'Strongest' },
  { value: 'all', label: 'All' },
  { value: 'imports', label: 'Imports' },
  { value: 'calls', label: 'Calls' },
  { value: 'inherits', label: 'Inheritance' },
  { value: 'none', label: 'None' },
];

/**
 * The one compact canvas control cluster (19.6): zoom out / % / zoom in /
 * fit, relation filter, Map · Outline · Both, minimap toggle. Docked
 * bottom-right and floating — it reserves no layout strip.
 */
export default function MapControls({
  view,
  onViewChange,
  relationFilter,
  onRelationFilterChange,
  minimapVisible,
  onToggleMinimap,
}: {
  view: ArchitectureViewMode;
  onViewChange: (view: ArchitectureViewMode) => void;
  relationFilter: RelationFilter;
  onRelationFilterChange: (filter: RelationFilter) => void;
  minimapVisible: boolean;
  onToggleMinimap: () => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <div className="map-controls" role="group" aria-label="Map controls">
      <div className="map-controls__group" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom out" onClick={() => void zoomOut({ duration: 160 })}><Minus size={14} /></button>
        <span className="map-controls__zoom" aria-live="off">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => void zoomIn({ duration: 160 })}><Plus size={14} /></button>
        <button type="button" aria-label="Fit map to view" onClick={() => void fitView({ padding: 0.16, duration: 240 })}><Maximize size={14} /></button>
      </div>
      <label className="map-controls__filter">
        <span className="sr-only">Relation filter</span>
        <select value={relationFilter} onChange={(event) => onRelationFilterChange(event.target.value as RelationFilter)} aria-label="Relation filter">
          {FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <div className="map-controls__group" role="radiogroup" aria-label="Architecture view">
        {([
          { value: 'map', label: 'Map', icon: MapIcon },
          { value: 'outline', label: 'Outline', icon: List },
          { value: 'both', label: 'Both', icon: Columns2 },
        ] as const).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={view === value}
            className={view === value ? 'map-controls__view map-controls__view--active' : 'map-controls__view'}
            onClick={() => onViewChange(value)}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={minimapVisible}
        aria-label={minimapVisible ? 'Hide minimap' : 'Show minimap'}
        className={minimapVisible ? 'map-controls__minimap map-controls__minimap--active' : 'map-controls__minimap'}
        onClick={onToggleMinimap}
      >
        <PictureInPicture2 size={14} />
      </button>
    </div>
  );
}
