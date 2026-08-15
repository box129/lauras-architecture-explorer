import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Centered empty / error / loading state for a whole canvas. */
export function StateCard({ icon = 'search-code', title, message, tone = 'neutral', action, style }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: 'min(440px, 100%)',
        padding: 'var(--space-10)',
        color: 'var(--obs-ink)',
        background: 'rgba(252, 250, 247, 0.88)',
        border: '1px solid var(--obs-border)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-card)',
        ...style,
      }}
    >
      <span style={{ color: tone === 'error' ? 'var(--obs-clay)' : 'var(--obs-slate-blue)', display: 'inline-flex' }}><Icon name={icon} size={28} /></span>
      <h1 style={{ margin: '18px 0 8px', fontSize: 'var(--text-rail-title)' }}>{title}</h1>
      <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--text-body)', lineHeight: 'var(--leading-relaxed)' }}>{message}</p>
      {action}
    </div>
  );
}
