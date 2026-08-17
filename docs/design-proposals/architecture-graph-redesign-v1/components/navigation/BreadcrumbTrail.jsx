import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Overview → region → entity → evidence trail in the top bar. */
export function BreadcrumbTrail({ items = [], onSelect, style }) {
  return (
    <nav aria-label="Architecture breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0, fontSize: 'var(--text-body)', color: 'var(--obs-ink)', ...style }}>
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return (
          <span
            key={`${item.id ?? 'root'}-${item.label}-${index}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0, whiteSpace: 'nowrap', color: isCurrent ? 'var(--obs-ink)' : 'color-mix(in srgb, var(--obs-ink) 70%, var(--obs-stone))' }}
          >
            {isCurrent || !onSelect ? (
              <span title={item.title} aria-current={isCurrent ? 'location' : undefined}>{item.label}</span>
            ) : (
              <button type="button" title={item.title} onClick={() => onSelect(index)} style={{ padding: 0, color: 'inherit', background: 'transparent', border: 0, cursor: 'pointer' }}>{item.label}</button>
            )}
            {!isCurrent && <Icon name="chevron-right" size={13} />}
          </span>
        );
      })}
    </nav>
  );
}
