import React from 'react';
import { StatusBadge } from '../core/StatusBadge.jsx';

const edgeStyles = {
  flow: { stroke: 'color-mix(in srgb, var(--obs-slate-blue) 56%, transparent)', dash: '' },
  inferred: { stroke: 'color-mix(in srgb, var(--obs-clay) 48%, transparent)', dash: '5 6' },
  boundary: { stroke: 'color-mix(in srgb, var(--obs-stone) 62%, transparent)', dash: '2 5' },
};

/** Floating legend for status dots and edge kinds. */
export function MapLegend({ statuses = ['verified', 'partial', 'inferred'], edges = ['flow', 'inferred'], style }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-8)', color: 'var(--obs-ink)', fontSize: 'var(--text-small)', ...style }}>
      {statuses.map((status) => <StatusBadge key={status} status={status} showLabel />)}
      {edges.map((edge) => (
        <span key={edge} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <svg width="26" height="6" aria-hidden="true"><line x1="0" y1="3" x2="26" y2="3" stroke={edgeStyles[edge].stroke} strokeWidth="1.25" strokeDasharray={edgeStyles[edge].dash} /></svg>
          {edge === 'flow' ? 'Direct relation' : edge === 'inferred' ? 'Inferred' : 'Boundary'}
        </span>
      ))}
    </div>
  );
}
