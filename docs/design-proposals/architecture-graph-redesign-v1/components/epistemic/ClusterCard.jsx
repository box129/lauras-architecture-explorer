import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { ProvenanceChip } from './ProvenanceChip.jsx';

/**
 * Layer 2. A relation-derived cluster inside a Layer-1 region — or, with
 * `residual`, the honest "no relation found" bucket, which is deliberately
 * borderless so it can never read as a cluster.
 */
export function ClusterCard({ label, memberCount, members = [], relationCount, residual = false, selected = false, aiSlot, onOpenBasis, onEnter, style }) {
  const shown = members.slice(0, 5);
  const extra = Math.max(0, memberCount - shown.length);
  return (
    <article
      onClick={onEnter}
      style={{
        display: 'grid',
        gap: 10,
        padding: residual ? '11px 13px' : '12px 14px',
        background: residual ? 'transparent' : 'var(--structural-cluster-bg)',
        border: residual ? '1px dashed var(--structural-residual-border)' : `1px solid ${selected ? 'var(--focus-ring)' : 'var(--structural-cluster-border)'}`,
        borderRadius: residual ? 'var(--radius-lg)' : 'var(--radius-sm)',
        boxShadow: selected ? 'var(--shadow-selected)' : 'none',
        cursor: onEnter ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {!residual && <span style={{ color: 'var(--structural-cluster-accent)', display: 'inline-flex' }}><Icon name="waypoints" size={15} /></span>}
        <strong style={{ fontSize: 'var(--text-node-title)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>{label}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)', whiteSpace: 'nowrap' }}>
          {memberCount} modules{!residual && relationCount != null ? ` · ${relationCount} internal relations` : ''}
        </span>
        {!residual && <ProvenanceChip kind="cluster" size="sm" style={{ marginLeft: 'auto' }} />}
      </div>

      {aiSlot}

      <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', margin: 0, padding: 0, listStyle: 'none', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)' }}>
        {shown.map((m) => <li key={m}>{m}</li>)}
        {extra > 0 && <li style={{ color: 'var(--text-muted)' }}>+{extra} more</li>}
      </ul>

      {residual ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-small)', lineHeight: 'var(--leading-normal)' }}>
          No import or call relation connects these to their siblings, so nothing groups them further. They are listed, not clustered.
        </p>
      ) : onOpenBasis && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenBasis(); }} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, color: 'var(--action-primary)', background: 'transparent', border: 0, cursor: 'pointer', fontSize: 'var(--text-small)' }}>
          Why these modules are grouped<Icon name="chevron-right" size={13} />
        </button>
      )}
    </article>
  );
}
