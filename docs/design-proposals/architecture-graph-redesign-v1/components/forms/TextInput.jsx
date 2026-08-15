import React from 'react';

/** Compact monospace field for ids, models and other machine values. */
export function TextInput({ value = '', placeholder, onChange, mono = true, style, ...rest }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
      style={{
        width: '100%',
        minHeight: 38,
        padding: '0 10px',
        color: 'var(--obs-ink)',
        border: '1px solid var(--obs-border)',
        borderRadius: 'var(--radius-lg)',
        background: 'color-mix(in srgb, var(--obs-white) 55%, transparent)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: 'var(--text-small)',
        outline: 'none',
        ...style,
      }}
      {...rest}
    />
  );
}
