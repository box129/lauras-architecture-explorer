import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { ProvenanceChip } from './ProvenanceChip.jsx';

/** Layer 1. A real directory, drawn as an enclosing region that contains its children. */
export function StructuralRegion({ path, moduleCount, depth = 0, expanded = true, selected = false, onToggle, onEnter, children, style }) {
  return (
    <section
      style={{
        background: 'var(--structural-container-bg)',
        border: `1.5px solid ${selected ? 'var(--focus-ring)' : 'var(--structural-container-border)'}`,
        borderRadius: 'var(--radius-2xl)',
        boxShadow: selected ? 'var(--shadow-selected)' : 'none',
        overflow: 'hidden',
        ...style,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', padding: depth === 0 ? '12px 14px' : '10px 12px', background: 'var(--structural-container-header)', borderBottom: expanded ? '1px solid var(--structural-container-border)' : 'none' }}>
        <button type="button" aria-expanded={expanded} onClick={onToggle} style={{ display: 'flex', flex: '1 1 auto', alignItems: 'center', gap: 9, minWidth: 0, padding: 0, color: 'var(--text-primary)', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ display: 'inline-flex', color: 'var(--text-muted)', transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform var(--transition-micro)' }}><Icon name="chevron-down" size={15} /></span>
          <Icon name="folder-tree" size={15} />
          <strong style={{ overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: depth === 0 ? 'var(--text-node-title-group)' : 'var(--text-node-title)', fontWeight: 'var(--weight-semibold)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</strong>
        </button>
        <span style={{ flex: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-small)', whiteSpace: 'nowrap' }}>{moduleCount} modules</span>
        <ProvenanceChip kind="structure" size="sm" style={{ flex: 'none' }} />
        {onEnter && (
          <button type="button" onClick={onEnter} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', color: 'var(--action-primary)', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-micro)', whiteSpace: 'nowrap', flex: 'none' }}>
            Enter<Icon name="arrow-right" size={12} />
          </button>
        )}
      </header>
      {expanded && <div style={{ display: 'grid', gap: 'var(--space-5)', padding: depth === 0 ? 14 : 12 }}>{children}</div>}
    </section>
  );
}
