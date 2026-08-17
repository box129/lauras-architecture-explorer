import React from 'react';

/** Paper card: the one container shape in the product. */
export function Panel({ padding = 26, translucent = false, elevation = 'panel', children, style, ...rest }) {
  const shadows = { none: 'none', node: 'var(--shadow-node)', card: 'var(--shadow-card)', panel: 'var(--shadow-panel)' };
  return (
    <section
      style={{
        padding,
        color: 'var(--obs-ink)',
        background: translucent ? 'var(--surface-card-translucent)' : 'var(--obs-paper)',
        border: '1px solid var(--obs-border)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: shadows[elevation],
        ...style,
      }}
      {...rest}
    >
      {children}
    </section>
  );
}
