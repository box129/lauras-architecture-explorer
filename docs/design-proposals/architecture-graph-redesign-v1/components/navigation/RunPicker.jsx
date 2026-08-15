import React from 'react';
import { Icon } from '../core/Icon.jsx';

function abbreviateRunId(runId = '') {
  const hex = runId.startsWith('run:') ? runId.slice(4) : runId;
  return hex.length > 8 ? `${hex.slice(0, 8)}\u2026` : hex;
}

/** Provenance control: which run you are looking at, how fresh it is, and its id. */
export function RunPicker({ runId = '', lastScanned = 'active run', freshness = 'Live', onCopy, style }) {
  const [copied, setCopied] = React.useState(false);
  const button = { display: 'inline-flex', alignItems: 'center', gap: 7, height: 'var(--control-height)', padding: '0 10px', color: 'var(--obs-ink)', background: 'rgba(252, 250, 247, 0.72)', border: '1px solid var(--obs-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer' };
  return (
    <div aria-label="Current analysis run" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-small)', ...style }}>
      <button type="button" title={`Full run id: ${runId}`} style={button}>
        <span style={{ width: 7, height: 7, borderRadius: 'var(--radius-pill)', background: 'var(--obs-citrine)' }} />
        <span style={{ color: 'var(--obs-stone)' }}>{lastScanned}</span>
        <span style={{ color: 'var(--obs-stone)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-nano)', opacity: 0.75 }}>{abbreviateRunId(runId)}</span>
        <Icon name="chevron-down" size={13} />
      </button>
      <button type="button" style={{ ...button, color: 'var(--obs-stone)', background: 'transparent', borderColor: 'transparent' }}>
        {freshness}
        <Icon name="chevron-down" size={13} />
      </button>
      <button
        type="button"
        aria-label="Copy full run id"
        title={runId}
        onClick={() => { onCopy?.(runId); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, color: 'var(--obs-stone)', background: 'transparent', border: '1px solid transparent', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
      >
        <Icon name="copy" size={12} />
        {copied && (
          <span style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, padding: '2px 6px', color: 'var(--obs-white)', background: 'var(--obs-ink)', borderRadius: 'var(--radius-xs)', fontSize: 'var(--text-caption)', whiteSpace: 'nowrap' }}>Copied</span>
        )}
      </button>
    </div>
  );
}
