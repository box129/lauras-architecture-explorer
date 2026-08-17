import React from 'react';

const sizes = {
  sm: { minHeight: 28, padding: '0 10px', fontSize: 'var(--text-small)', borderRadius: 'var(--radius-md)' },
  md: { minHeight: 32, padding: '0 12px', fontSize: 'var(--text-body)', borderRadius: 'var(--radius-md)' },
  lg: { minHeight: 48, padding: '0 16px', fontSize: 'var(--text-node-title)', borderRadius: 'var(--radius-lg)', fontWeight: 'var(--weight-button)' },
};

const variants = {
  primary: { color: 'var(--action-primary-fg)', background: 'var(--action-primary-bg)', border: '1px solid var(--obs-slate-blue)' },
  quiet: { color: 'var(--obs-slate-blue)', background: 'var(--action-quiet-bg)', border: '1px solid color-mix(in srgb, var(--obs-slate-blue) 18%, var(--obs-border))' },
  secondary: { color: 'var(--obs-ink)', background: 'var(--obs-paper)', border: '1px solid var(--obs-border)' },
  pill: { color: 'var(--obs-stone)', background: 'transparent', border: '1px solid var(--obs-border)', borderRadius: 'var(--radius-pill)' },
};

/** Text button. `quiet` is the rail/action default; `primary` is the one call to action per screen. */
export function Button({ variant = 'secondary', size = 'md', icon, iconAfter, disabled, children, style, ...rest }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.48 : 1,
        transition: 'transform var(--transition-micro), background var(--transition-micro), border-color var(--transition-micro)',
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconAfter}
    </button>
  );
}
