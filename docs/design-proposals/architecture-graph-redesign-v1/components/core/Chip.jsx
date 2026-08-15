import React from 'react';

const tones = {
  clay: { color: 'color-mix(in srgb, var(--obs-clay) 72%, var(--obs-ink))', background: 'color-mix(in srgb, var(--obs-clay) 10%, transparent)', border: '1px solid transparent' },
  fact: { color: 'var(--text-body)', background: 'rgba(255, 255, 255, 0.42)', border: '1px solid var(--obs-border)' },
  slate: { color: 'var(--obs-slate-blue)', background: 'color-mix(in srgb, var(--obs-slate-blue) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--obs-slate-blue) 24%, var(--obs-border))' },
  signal: { color: 'var(--chip-signal-fg)', background: 'var(--chip-signal-bg)', border: '1px solid transparent' },
  /** Dashed + unfilled on purpose: a classification score must never look like a verification status. */
  measure: { color: 'var(--text-body)', background: 'transparent', border: '1px dashed var(--obs-border)' },
};

/** Small pill for a status word, a fact, a framework signal, or a measurement. */
export function Chip({ tone = 'fact', icon, children, style, ...rest }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        minHeight: 24,
        padding: '0 9px',
        borderRadius: 'var(--radius-pill)',
        fontSize: 'var(--text-micro)',
        whiteSpace: 'nowrap',
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
