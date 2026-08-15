import React from 'react';

/** Files-read meter with the current file underneath. */
export function ProgressMeter({ label = 'Reading files', value = 0, total = 0, caption, style }) {
  const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-5)', color: 'var(--obs-stone)', fontSize: 'var(--text-small)' }}>
        <span>{label}</span>
        <span>{value} / {total}</span>
      </div>
      <div style={{ height: 7, margin: '8px 0', overflow: 'hidden', borderRadius: 'var(--radius-pill)', background: 'color-mix(in srgb, var(--obs-border) 70%, transparent)' }}>
        <span style={{ display: 'block', height: '100%', width: `${percent}%`, borderRadius: 'inherit', background: 'var(--obs-citrine)', transition: 'width var(--transition-layout)' }} />
      </div>
      {caption && (
        <p style={{ margin: 0, overflow: 'hidden', color: 'var(--obs-stone)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{caption}</p>
      )}
    </div>
  );
}
