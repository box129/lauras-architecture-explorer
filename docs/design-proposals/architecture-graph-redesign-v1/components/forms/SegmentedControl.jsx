import React from 'react';

/** Row of pill segments — the product's only mutually-exclusive selector. */
export function SegmentedControl({ options = [], value, onChange, label, style }) {
  return (
    <div style={style}>
      {label && (
        <span style={{ display: 'block', marginBottom: 'var(--space-3)', color: 'var(--obs-stone)', fontSize: 'var(--text-micro)', fontWeight: 'var(--weight-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase' }}>{label}</span>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              title={option.description}
              onClick={() => onChange?.(option.value)}
              style={{
                padding: '7px 10px',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                fontSize: 'var(--text-small)',
                color: active ? 'var(--obs-slate-blue)' : 'var(--obs-stone)',
                border: `1px solid ${active ? 'color-mix(in srgb, var(--obs-slate-blue) 38%, var(--obs-border))' : 'var(--obs-border)'}`,
                background: active ? 'color-mix(in srgb, var(--obs-slate-blue) 9%, transparent)' : 'transparent',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
