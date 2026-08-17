import React from 'react';
import { StatusBadge } from '../core/StatusBadge.jsx';
import { Chip } from '../core/Chip.jsx';

const badgeCopy = {
  supported: { label: 'SUPPORTED', caption: 'Backed by source evidence in this run.', status: 'verified' },
  insufficient_evidence: { label: 'INSUFFICIENT EVIDENCE', caption: 'No direct evidence found — treat as unproven.', status: 'insufficient' },
  contradicted: { label: 'CONTRADICTED', caption: 'Verification found evidence against this.', status: 'unsupported' },
};

const INSUFFICIENT_EVIDENCE_COPY = "Laura's deterministic analysis could not find direct evidence for this relationship in the current run.";

/** One architectural claim with its verification status and evidence chain. */
export function ClaimCard({ statement, supportStatus = 'supported', relation = '', children, defaultExpanded = false, style }) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const copy = badgeCopy[supportStatus] ?? badgeCopy.supported;
  const muted = supportStatus !== 'supported';
  return (
    <li
      style={{
        overflow: 'hidden',
        listStyle: 'none',
        background: supportStatus === 'contradicted'
          ? 'color-mix(in srgb, var(--obs-muted-red) 6%, var(--obs-paper))'
          : muted ? 'color-mix(in srgb, var(--obs-clay) 5%, var(--obs-paper))' : 'var(--obs-paper)',
        border: '1px solid',
        borderStyle: muted ? 'dashed' : 'solid',
        borderColor: supportStatus === 'contradicted'
          ? 'color-mix(in srgb, var(--obs-muted-red) 34%, var(--obs-border))'
          : muted ? 'color-mix(in srgb, var(--obs-clay) 32%, var(--obs-border))' : 'color-mix(in srgb, var(--obs-citrine) 30%, var(--obs-border))',
        borderRadius: 'var(--radius-lg)',
        opacity: muted ? 0.92 : 1,
        ...style,
      }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: '6px 10px', width: '100%', padding: '12px 14px', textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer' }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gridRow: 'span 2', gap: 'var(--space-1)' }}>
          <Chip tone="clay" style={muted ? { color: 'color-mix(in srgb, var(--obs-clay) 78%, var(--obs-ink))', background: 'color-mix(in srgb, var(--obs-clay) 12%, transparent)', fontWeight: 600, letterSpacing: '0.02em' } : { fontWeight: 600, letterSpacing: '0.02em' }}>
            <StatusBadge status={copy.status} title={copy.caption} />
            {copy.label}
          </Chip>
          <span style={{ maxWidth: 130, color: 'var(--obs-stone)', fontSize: 'var(--text-caption)', lineHeight: 1.3, whiteSpace: 'normal' }}>{copy.caption}</span>
        </span>
        <span style={{ color: 'var(--obs-ink)', fontSize: 'var(--text-body)', lineHeight: 'var(--leading-normal)' }}>{statement}</span>
        {relation && (
          <span style={{ gridColumn: 2, color: 'var(--obs-stone)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{relation}</span>
        )}
      </button>
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--obs-border)' }}>
          {supportStatus === 'insufficient_evidence' && (
            <p style={{ margin: '12px 0 0', padding: '10px 12px', color: 'color-mix(in srgb, var(--obs-ink) 76%, var(--obs-clay))', background: 'color-mix(in srgb, var(--obs-clay) 7%, var(--obs-paper))', border: '1px solid color-mix(in srgb, var(--obs-clay) 18%, var(--obs-border))', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-body-tight)', lineHeight: 'var(--leading-normal)' }}>
              {INSUFFICIENT_EVIDENCE_COPY}
            </p>
          )}
          {children}
        </div>
      )}
    </li>
  );
}
