import React from 'react';

const tones = {
  warning: { color: 'color-mix(in srgb, var(--obs-ink) 76%, var(--obs-clay))', background: 'color-mix(in srgb, var(--obs-clay) 7%, var(--obs-paper))', borderColor: 'color-mix(in srgb, var(--obs-clay) 18%, var(--obs-border))' },
  unsupported: { color: 'color-mix(in srgb, var(--obs-ink) 74%, var(--obs-muted-red))', background: 'color-mix(in srgb, var(--obs-muted-red) 7%, var(--obs-paper))', borderColor: 'color-mix(in srgb, var(--obs-muted-red) 18%, var(--obs-border))' },
  success: { color: 'color-mix(in srgb, var(--obs-ink) 76%, var(--obs-sage))', background: 'color-mix(in srgb, var(--obs-sage) 7%, var(--obs-paper))', borderColor: 'color-mix(in srgb, var(--obs-sage) 20%, var(--obs-border))' },
};

/** Inline honesty note: what the analysis could not establish, and why. */
export function Callout({ tone = 'warning', icon, children, style, ...rest }) {
  const t = tones[tone];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-4)',
        padding: '13px 14px',
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${t.borderColor}`,
        color: t.color,
        background: t.background,
        fontSize: 'var(--text-body-tight)',
        lineHeight: 'var(--leading-normal)',
        ...style,
      }}
      {...rest}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}
