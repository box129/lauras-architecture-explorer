import React from 'react';
import { Icon } from '../core/Icon.jsx';

const tones = {
  done: { color: 'var(--obs-stone)', border: 'var(--obs-border)', background: 'var(--surface-sunken)', icon: 'circle-check-big', iconColor: 'var(--stage-done)' },
  current: { color: 'var(--obs-ink)', border: 'color-mix(in srgb, var(--obs-slate-blue) 25%, var(--obs-border))', background: 'color-mix(in srgb, var(--obs-slate-blue) 7%, transparent)', icon: 'loader-circle', iconColor: 'var(--stage-current)' },
  waiting: { color: 'var(--obs-stone)', border: 'var(--obs-border)', background: 'var(--surface-sunken)', icon: null, iconColor: 'var(--obs-stone)' },
  failed: { color: 'var(--obs-ink)', border: 'color-mix(in srgb, #b91c1c 28%, var(--obs-border))', background: 'color-mix(in srgb, #b91c1c 7%, transparent)', icon: 'circle-x', iconColor: 'var(--stage-failed)' },
  skipped: { color: 'var(--obs-stone)', border: 'color-mix(in srgb, #b45309 28%, var(--obs-border))', background: 'color-mix(in srgb, #b45309 7%, transparent)', icon: 'circle-alert', iconColor: 'var(--stage-skipped)' },
};

/** One analysis stage, in human language. */
export function StageRow({ state = 'waiting', label, title, style }) {
  const tone = tones[state] ?? tones.waiting;
  return (
    <div
      title={title}
      style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, padding: 'var(--space-4)', border: `1px solid ${tone.border}`, borderRadius: 'var(--radius-lg)', color: tone.color, background: tone.background, ...style }}
    >
      {tone.icon
        ? <span style={{ color: tone.iconColor, display: 'inline-flex', flex: 'none', animation: state === 'current' ? 'observatory-spin 900ms linear infinite' : 'none' }}><Icon name={tone.icon} size={15} /></span>
        : <span style={{ flex: 'none', width: 15, height: 15, border: '1px solid var(--obs-border)', borderRadius: '50%' }} />}
      <p style={{ minWidth: 0, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-body)' }}>{label}</p>
    </div>
  );
}
