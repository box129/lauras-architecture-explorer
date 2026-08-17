import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Repository-path field: leading folder glyph, free text entry, and a Browse escape hatch. */
export function PathInput({ value = '', placeholder = 'Enter an absolute local repository path', onChange, onBrowse, browseLabel = 'Browse\u2026', style, ...rest }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        minHeight: 'var(--control-height-lg)',
        padding: '0 14px',
        border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--obs-border)'}`,
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-input)',
        boxShadow: focused ? '0 0 0 3px color-mix(in srgb, var(--obs-slate-blue) 12%, transparent)' : 'none',
        transition: 'border-color var(--transition-micro), box-shadow var(--transition-micro)',
        ...style,
      }}
    >
      <span style={{ color: 'var(--obs-stone)', display: 'inline-flex' }}><Icon name="folder-open" size={16} /></span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ width: '100%', minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--obs-ink)', fontSize: 'var(--text-node-title)' }}
        {...rest}
      />
      {onBrowse && (
        <button
          type="button"
          onClick={onBrowse}
          style={{ flex: 'none', height: 32, padding: '0 12px', color: 'var(--obs-ink)', background: 'var(--obs-paper)', border: '1px solid var(--obs-border)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', cursor: 'pointer' }}
        >
          {browseLabel}
        </button>
      )}
    </div>
  );
}
