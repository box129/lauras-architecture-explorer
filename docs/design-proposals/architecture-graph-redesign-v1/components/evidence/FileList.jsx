import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Key-files list: path plus the reason it matters. */
export function FileList({ items = [], activeIndex = 0, onSelect, emptyLabel = 'No key files returned yet.', style }) {
  return (
    <div style={{ overflow: 'hidden', background: 'rgba(252, 250, 247, 0.72)', border: '1px solid var(--obs-border)', borderRadius: 'var(--radius-lg)', ...style }}>
      {items.length === 0 ? (
        <div style={{ padding: '12px 14px', color: 'var(--obs-stone)', fontSize: 'var(--text-small)', lineHeight: 'var(--leading-normal)' }}>{emptyLabel}</div>
      ) : items.map((item, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={item.filePath}
            type="button"
            onClick={() => onSelect?.(item, index)}
            style={{
              display: 'grid',
              gridTemplateColumns: '18px minmax(0, 1fr)',
              gap: 'var(--space-3)',
              width: '100%',
              padding: '12px 14px',
              textAlign: 'left',
              color: active ? 'var(--obs-slate-blue)' : 'color-mix(in srgb, var(--obs-ink) 78%, var(--obs-stone))',
              background: active ? 'rgba(61, 90, 128, 0.055)' : 'transparent',
              border: 0,
              borderTop: index === 0 ? 'none' : '1px solid var(--obs-border)',
              cursor: 'pointer',
              fontSize: 'var(--text-small)',
            }}
          >
            <Icon name="file-text" size={14} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.filePath}</span>
            <small style={{ gridColumn: 2, overflow: 'hidden', color: 'var(--obs-stone)', fontSize: 'var(--text-micro)', lineHeight: 'var(--leading-snug)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.reason}</small>
          </button>
        );
      })}
    </div>
  );
}
