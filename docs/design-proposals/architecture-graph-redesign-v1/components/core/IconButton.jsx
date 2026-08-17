import React from 'react';

/** 30×30 transparent icon button — top bar, panel headers, close affordances. */
export function IconButton({ icon, label, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'var(--control-height)',
        height: 'var(--control-height)',
        padding: 0,
        color: 'var(--obs-ink)',
        background: hover ? 'var(--action-tint)' : 'transparent',
        border: `1px solid ${hover ? 'rgba(61, 90, 128, 0.18)' : 'transparent'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'color var(--transition-micro), border-color var(--transition-micro), background var(--transition-micro)',
        ...style,
      }}
      {...rest}
    >
      {icon}
    </button>
  );
}
