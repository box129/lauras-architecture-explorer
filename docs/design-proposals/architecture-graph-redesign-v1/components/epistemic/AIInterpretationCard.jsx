import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { ProvenanceChip } from './ProvenanceChip.jsx';

/**
 * Layer 3. An AI-authored name and description sitting ON TOP of a group whose
 * membership was already fixed deterministically — the neutral identity line is
 * always visible underneath, never replaced.
 */
export function AIInterpretationCard({
  state = 'available',
  name,
  description,
  groundTruth,
  onGenerate,
  onRegenerate,
  generatedAt,
  style,
}) {
  const frame = {
    position: 'relative',
    padding: '12px 14px 13px',
    background: 'var(--ai-surface)',
    border: '1px solid var(--ai-border)',
    borderRadius: 'var(--radius-2xl)',
    ...style,
  };
  return (
    <div style={frame}>
      <span aria-hidden="true" style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, background: 'var(--ai-accent)', borderRadius: '0 3px 3px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <ProvenanceChip kind="ai" size="sm" />
        {generatedAt && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-caption)' }}>{generatedAt}</span>}
      </div>

      {state === 'generated' && (
        <>
          <strong style={{ display: 'block', margin: '9px 0 0', color: 'var(--text-primary)', fontSize: 'var(--text-node-title-group)', fontWeight: 'var(--weight-bold)' }}>{name}</strong>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 'var(--text-body)', lineHeight: 'var(--leading-normal)' }}>{description}</p>
          {onRegenerate && (
            <button type="button" onClick={onRegenerate} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: 0, color: 'var(--ai-text)', background: 'transparent', border: 0, cursor: 'pointer', fontSize: 'var(--text-small)' }}>
              <Icon name="refresh-cw" size={12} />Regenerate
            </button>
          )}
        </>
      )}

      {state === 'available' && (
        <button type="button" onClick={onGenerate} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 10, minHeight: 30, padding: '0 11px', color: 'var(--ai-text)', background: 'transparent', border: '1px solid var(--ai-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-small)' }}>
          <Icon name="sparkles" size={13} />Generate AI interpretation
        </button>
      )}

      {state === 'generating' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 10, color: 'var(--ai-text)', fontSize: 'var(--text-small)' }}>
          <span style={{ display: 'inline-flex', animation: 'observatory-spin 900ms linear infinite' }}><Icon name="loader-circle" size={13} /></span>
          Interpreting this cluster…
        </span>
      )}

      {state === 'unavailable' && (
        <p style={{ margin: '9px 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-small)', lineHeight: 'var(--leading-normal)' }}>
          No model is configured, so no interpretation can be generated. Everything else on this screen works without one.
        </p>
      )}

      {groundTruth && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '11px 0 0', paddingTop: 10, borderTop: '1px dashed var(--ai-border)', color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>
          <Icon name="waypoints" size={13} />{groundTruth}
        </p>
      )}
    </div>
  );
}
