import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Entry-screen product promise: icon, claim, one supporting line. */
export function PromiseCard({ icon = 'shield-check', title, text, style }) {
  return (
    <div style={{ minHeight: 118, padding: 'var(--space-7)', border: '1px solid var(--obs-border)', borderRadius: 'var(--radius-lg)', background: 'color-mix(in srgb, var(--obs-paper) 82%, transparent)', ...style }}>
      <span style={{ color: 'var(--obs-citrine)', display: 'inline-flex' }}><Icon name={icon} size={17} /></span>
      <strong style={{ display: 'block', margin: '12px 0 5px', fontSize: 'var(--text-body)', color: 'var(--obs-ink)' }}>{title}</strong>
      <span style={{ display: 'block', color: 'var(--obs-stone)', fontSize: 'var(--text-small)', lineHeight: 'var(--leading-normal)' }}>{text}</span>
    </div>
  );
}
