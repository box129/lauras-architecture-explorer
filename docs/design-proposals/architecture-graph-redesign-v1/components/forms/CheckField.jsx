import React from 'react';

/** Checkbox with inline sentence label. */
export function CheckField({ checked = false, disabled = false, onChange, children, style }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--obs-stone)', fontSize: 'var(--text-body)', opacity: disabled ? 0.6 : 1, ...style }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        style={{ accentColor: 'var(--obs-slate-blue)' }}
      />
      {children}
    </label>
  );
}
