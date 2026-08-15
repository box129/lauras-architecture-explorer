import React from 'react';

/** Simple / technical / evidence switch at the top of the voice rail. */
export function TabRail({ tabs = ['simple', 'technical', 'evidence'], value, onChange, style }) {
  return (
    <div
      role="tablist"
      aria-label="Explanation modes"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        gap: 'var(--space-1)',
        padding: 'var(--space-1)',
        background: 'rgba(255, 255, 255, 0.38)',
        border: '1px solid var(--obs-border)',
        borderRadius: 'var(--radius-xl)',
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const active = tab === value;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(tab)}
            style={{
              height: 32,
              border: 0,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--text-small)',
              textTransform: 'capitalize',
              color: active ? 'var(--obs-slate-blue)' : 'color-mix(in srgb, var(--obs-ink) 68%, var(--obs-stone))',
              background: active ? 'var(--obs-paper)' : 'transparent',
              boxShadow: active ? 'var(--shadow-tab-active)' : 'none',
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
