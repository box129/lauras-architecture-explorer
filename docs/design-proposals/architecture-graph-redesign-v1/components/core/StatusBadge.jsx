import React from 'react';

export const evidenceStatusMeta = {
  verified: { label: 'Verified', description: 'Source-backed evidence is available.' },
  partial: { label: 'Partial', description: 'Some evidence is source-backed and some remains inferred or incomplete.' },
  insufficient: { label: 'Insufficient', description: 'The backend found this area, but source evidence is incomplete.' },
  candidate: { label: 'Candidate', description: 'This area is plausible but not promoted to verified evidence.' },
  inferred: { label: 'Inferred', description: 'This is inferred from structure rather than direct source spans.' },
  unsupported: { label: 'Unsupported', description: 'The available source evidence does not support this claim.' },
  stale: { label: 'Stale', description: 'This evidence may no longer match the current source snapshot.' },
  legacy: { label: 'Legacy', description: 'This area comes from a legacy projection or compatibility path.' },
};

const half = 'linear-gradient(90deg, var(--obs-clay) 0 50%, transparent 50% 100%)';

const dot = {
  verified: { background: 'var(--status-verified)' },
  partial: { background: half, border: '1px solid var(--obs-clay)' },
  insufficient: { background: half, border: '1px solid var(--obs-clay)' },
  candidate: { background: 'transparent', border: '1.4px solid var(--obs-stone)' },
  inferred: { background: 'transparent', border: '1.4px dashed var(--obs-stone)' },
  unsupported: { background: 'transparent', border: '1.3px solid var(--obs-muted-red)', position: 'relative' },
  stale: { background: 'transparent', border: '1.3px solid var(--obs-stone)', boxShadow: 'inset 3px 0 0 var(--obs-stone)' },
  legacy: { background: 'color-mix(in srgb, var(--obs-stone) 65%, transparent)', border: '1.3px solid var(--obs-stone)' },
};

/** The 9px evidence-status dot. Shape carries the meaning; color never carries it alone. */
export function StatusBadge({ status, showLabel = false, title }) {
  const meta = evidenceStatusMeta[status] ?? evidenceStatusMeta.candidate;
  const description = title ?? meta.description;
  return (
    <span
      title={description}
      aria-label={`${meta.label}: ${description}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0, whiteSpace: 'nowrap' }}
    >
      <span style={{ display: 'inline-block', width: 9, height: 9, flex: '0 0 9px', borderRadius: 'var(--radius-pill)', ...dot[status] }}>
        {status === 'unsupported' && (
          <span style={{ position: 'absolute', top: 3, left: 1, width: 7, height: 1.2, background: 'var(--obs-muted-red)', transform: 'rotate(-38deg)' }} />
        )}
      </span>
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}
