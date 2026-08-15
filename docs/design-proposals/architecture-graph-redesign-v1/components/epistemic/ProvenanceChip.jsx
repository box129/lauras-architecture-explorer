import React from 'react';
import { Icon } from '../core/Icon.jsx';

/**
 * The four-way provenance mark. This is the load-bearing epistemic control:
 * every layer gets its own icon, its own word, and its own shape — so the
 * distinction survives dark mode, greyscale and screen readers.
 */
export const provenanceMeta = {
  structure: { label: 'Structure', icon: 'folder-tree', description: 'Read directly from the repository. Deterministic.' },
  cluster: { label: 'Structural cluster', icon: 'waypoints', description: 'Derived from real import and call relations by a fixed rule. Deterministic and reproducible; another rule could split these differently.' },
  ai: { label: 'AI interpretation', icon: 'sparkles', description: 'A model\u2019s reading of a group that was already fixed by analysis. Not verified.' },
  verified: { label: 'Verified statement', icon: 'shield-check', description: 'A proposition checked against source evidence by the verifier.' },
  evidence: { label: 'Source evidence', icon: 'file-code-2', description: 'An exact file and line range in the repository.' },
};

const tones = {
  structure: { color: 'var(--text-muted)', border: 'var(--structural-container-border)', background: 'transparent', radius: 'var(--radius-xs)' },
  cluster: { color: 'var(--structural-cluster-accent)', border: 'var(--structural-cluster-border)', background: 'var(--structural-cluster-bg)', radius: 'var(--radius-xs)' },
  ai: { color: 'var(--ai-text)', border: 'var(--ai-border)', background: 'var(--ai-surface)', radius: 'var(--radius-pill)' },
  verified: { color: 'var(--text-secondary)', border: 'var(--border-default2)', background: 'transparent', radius: 'var(--radius-xs)' },
  evidence: { color: 'var(--text-muted)', border: 'var(--border-default2)', background: 'transparent', radius: 'var(--radius-xs)' },
};

export function ProvenanceChip({ kind = 'structure', label, size = 'md', style, ...rest }) {
  const meta = provenanceMeta[kind];
  const tone = tones[kind];
  const small = size === 'sm';
  return (
    <span
      title={meta.description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: small ? 5 : 6,
        minHeight: small ? 19 : 23,
        padding: small ? '0 6px' : '0 8px',
        color: tone.color,
        background: tone.background,
        border: `1px solid ${tone.border}`,
        borderRadius: tone.radius,
        fontSize: small ? 'var(--text-caption)' : 'var(--text-micro)',
        fontWeight: 'var(--weight-label)',
        letterSpacing: 'var(--tracking-label)',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      <Icon name={meta.icon} size={small ? 11 : 12} />
      {label ?? meta.label}
    </span>
  );
}
