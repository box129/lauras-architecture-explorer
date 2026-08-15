import React from 'react';
import { Icon } from '../core/Icon.jsx';

const options = [
  { value: 'light', icon: 'sun', label: 'Light' },
  { value: 'dark', icon: 'moon', label: 'Dark' },
  { value: 'system', icon: 'monitor', label: 'System' },
];

/** Three-way theme control. Compact in the header, full-width in Settings. */
export function ThemeToggle({ value = 'system', onChange, variant = 'compact', style }) {
  return (
    <div role="radiogroup" aria-label="Color theme" style={{ display: 'inline-flex', gap: 'var(--space-1)', padding: 'var(--space-1)', background: 'var(--bg-sunken)', border: '1px solid var(--border-default2)', borderRadius: variant === 'compact' ? 'var(--radius-pill)' : 'var(--radius-lg)', ...style }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange?.(option.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              padding: variant === 'compact' ? '0 8px' : '0 12px',
              color: active ? 'var(--action-primary)' : 'var(--text-muted)',
              background: active ? 'var(--bg-surface)' : 'transparent',
              border: 0,
              borderRadius: variant === 'compact' ? 'var(--radius-pill)' : 'var(--radius-md)',
              boxShadow: active ? 'var(--shadow-tab-active)' : 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-small)',
            }}
          >
            <Icon name={option.icon} size={14} />
            {variant === 'full' && option.label}
          </button>
        );
      })}
    </div>
  );
}
