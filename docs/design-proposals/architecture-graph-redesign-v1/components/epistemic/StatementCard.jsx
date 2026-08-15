import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { StatusBadge } from '../core/StatusBadge.jsx';

const verdicts = {
  supported: { word: 'SUPPORTED', status: 'verified', caption: 'Checked against source evidence.', color: 'var(--verification-supported)', bg: 'var(--verification-supported-bg)', border: 'color-mix(in srgb, var(--verification-supported) 34%, var(--border-default2))', dashed: false },
  insufficient_evidence: { word: 'INSUFFICIENT EVIDENCE', status: 'insufficient', caption: 'No source evidence was found either way.', color: 'var(--verification-insufficient)', bg: 'var(--verification-insufficient-bg)', border: 'color-mix(in srgb, var(--verification-insufficient) 34%, var(--border-default2))', dashed: true },
  contradicted: { word: 'CONTRADICTED', status: 'unsupported', caption: 'Source evidence points the other way.', color: 'var(--verification-contradicted)', bg: 'var(--verification-contradicted-bg)', border: 'color-mix(in srgb, var(--verification-contradicted) 38%, var(--border-default2))', dashed: true },
};

/** Layer 4. One architectural statement and the verifier's verdict on it. */
export function StatementCard({ statement, status = 'supported', relation, evidenceCount = 0, selected = false, onOpenEvidence, style }) {
  const v = verdicts[status];
  return (
    <article
      style={{
        display: 'grid',
        gap: 10,
        padding: '13px 15px',
        background: v.bg,
        border: `1px ${v.dashed ? 'dashed' : 'solid'} ${selected ? 'var(--focus-ring)' : v.border}`,
        borderLeft: `3px solid ${v.color}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: selected ? 'var(--shadow-selected)' : 'none',
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: v.color, fontSize: 'var(--text-micro)', fontWeight: 'var(--weight-label)', letterSpacing: '0.05em' }}>
        <StatusBadge status={v.status} title={v.caption} />{v.word}
      </span>
      <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 'var(--text-node-title)', lineHeight: 'var(--leading-normal)' }}>{statement}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>
        {relation && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)' }}>{relation}</span>}
        <span>{evidenceCount === 0 ? 'no evidence found' : `${evidenceCount} evidence ${evidenceCount === 1 ? 'item' : 'items'}`}</span>
        {onOpenEvidence && evidenceCount > 0 && (
          <button type="button" onClick={onOpenEvidence} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 'auto', padding: 0, color: 'var(--action-primary)', background: 'transparent', border: 0, cursor: 'pointer', fontSize: 'var(--text-small)' }}>
            View evidence<Icon name="arrow-right" size={13} />
          </button>
        )}
      </div>
    </article>
  );
}
