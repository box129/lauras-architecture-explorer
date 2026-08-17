import React from 'react';
import { StatusBadge } from '../core/StatusBadge.jsx';

/** One source-backed evidence row: file span, why it counts, and a code preview. */
export function EvidenceRow({ filePath, startLine, endLine, reason, preview, status = 'verified', active = false, onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '14px minmax(0, 1fr)',
        gap: 'var(--space-4)',
        width: '100%',
        padding: '11px 12px',
        textAlign: 'left',
        background: active ? 'rgba(61, 90, 128, 0.055)' : 'rgba(252, 250, 247, 0.62)',
        border: `1px solid ${active ? 'color-mix(in srgb, var(--obs-slate-blue) 40%, var(--obs-border))' : 'var(--obs-border)'}`,
        borderRadius: 'var(--radius-lg)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <StatusBadge status={status} />
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', overflow: 'hidden', color: 'var(--obs-ink)', fontSize: 'var(--text-small)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filePath}{startLine != null ? `:${startLine}${endLine != null ? `-${endLine}` : ''}` : ''}
        </strong>
        {reason && <span style={{ display: 'block', marginTop: 'var(--space-1)', color: 'var(--text-body)', fontSize: 'var(--text-small)', lineHeight: 'var(--leading-normal)' }}>{reason}</span>}
        {preview && (
          <p style={{ display: '-webkit-box', margin: '7px 0 0', overflow: 'hidden', color: 'var(--obs-stone)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', lineHeight: 'var(--leading-normal)', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3 }}>{preview}</p>
        )}
      </span>
    </button>
  );
}
