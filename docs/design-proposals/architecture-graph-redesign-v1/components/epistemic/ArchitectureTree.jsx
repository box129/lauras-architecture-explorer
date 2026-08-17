import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { ProvenanceChip } from './ProvenanceChip.jsx';

const kindIcon = { region: 'folder-tree', cluster: 'waypoints', residual: 'list', module: 'file-code-2', symbol: 'code' };

/**
 * The accessible equivalent of the canvas: a real keyboard tree with an
 * explicit Origin column, so the epistemic layers survive without pixels.
 */
export function ArchitectureTree({ items = [], expanded = {}, onToggle, onActivate, style }) {
  const rows = [];
  const walk = (nodes, level) => {
    nodes.forEach((node) => {
      const open = expanded[node.id] !== false;
      rows.push({ node, level, open });
      if (node.children && open) walk(node.children, level + 1);
    });
  };
  walk(items, 1);

  return (
    <div role="tree" aria-label="Repository architecture" style={{ border: '1px solid var(--border-default2)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', overflow: 'hidden', ...style }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 96px 150px', gap: 12, padding: '9px 14px', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border-default2)', color: 'var(--text-muted)', fontSize: 'var(--text-micro)', fontWeight: 'var(--weight-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase' }}>
        <span>Name</span><span>Modules</span><span>Origin</span>
      </div>
      {rows.map(({ node, level, open }) => (
        <div
          key={node.id}
          role="treeitem"
          aria-level={level}
          aria-expanded={node.children ? open : undefined}
          tabIndex={0}
          onClick={() => (node.children ? onToggle?.(node.id) : onActivate?.(node))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); node.children ? onToggle?.(node.id) : onActivate?.(node); }
          }}
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 96px 150px', gap: 12, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-primary)' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, paddingLeft: (level - 1) * 20 }}>
            {node.children
              ? <span style={{ display: 'inline-flex', color: 'var(--text-muted)', transform: open ? 'none' : 'rotate(-90deg)' }}><Icon name="chevron-down" size={13} /></span>
              : <span style={{ width: 13 }} />}
            <Icon name={kindIcon[node.kind] ?? 'file-code-2'} size={14} />
            <span style={{ overflow: 'hidden', fontFamily: node.kind === 'region' || node.kind === 'module' ? 'var(--font-mono)' : 'inherit', fontSize: 'var(--text-body)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.aiName ? <span style={{ color: 'var(--ai-text)' }}>AI interpretation: {node.aiName} — </span> : null}{node.label}
            </span>
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{node.moduleCount ?? '—'}</span>
          <ProvenanceChip kind={node.aiName ? 'ai' : node.kind === 'cluster' ? 'cluster' : 'structure'} size="sm"
            label={node.kind === 'residual' ? 'Ungrouped' : undefined} />
        </div>
      ))}
    </div>
  );
}
