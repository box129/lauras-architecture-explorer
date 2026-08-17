import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { StatusBadge } from '../core/StatusBadge.jsx';

const accents = {
  slate: { color: 'var(--obs-slate-blue)', borderColor: 'color-mix(in srgb, var(--obs-slate-blue) 32%, transparent)' },
  citrine: { color: 'color-mix(in srgb, var(--obs-citrine) 72%, var(--obs-ink))', borderColor: 'color-mix(in srgb, var(--obs-citrine) 40%, transparent)' },
  sage: { color: 'var(--obs-sage)', borderColor: 'color-mix(in srgb, var(--obs-sage) 40%, transparent)' },
  clay: { color: 'var(--obs-clay)', borderColor: 'color-mix(in srgb, var(--obs-clay) 36%, transparent)' },
  stone: { color: 'var(--obs-stone)', borderColor: 'color-mix(in srgb, var(--obs-stone) 42%, transparent)' },
};

const clamp = (lines) => ({ display: '-webkit-box', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines });

/** A card on the architecture map: one analyzed area, or one repository region. */
export function LensNode({
  label,
  kind = 'component',
  description = '',
  status = 'candidate',
  accent = 'slate',
  icon = 'box',
  evidenceCount = 0,
  childrenCount = 0,
  members = [],
  warning = false,
  group = false,
  collapsedContainer = false,
  selected = false,
  canDrilldown = true,
  onClick,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const kindLabel = group ? 'repository section' : kind.replaceAll('_', ' ');
  const extraMembers = Math.max(0, childrenCount - members.slice(0, 5).length);
  const active = selected || hover;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`${label}, ${kindLabel}, ${status}, ${collapsedContainer ? 'expand' : canDrilldown ? 'select to explore' : 'select'}`}
      style={{
        display: 'grid',
        gridTemplateColumns: group ? '54px minmax(0, 1fr) 18px' : '46px minmax(0, 1fr) 16px',
        gap: 'var(--space-5)',
        alignItems: 'center',
        width: group ? '100%' : 'var(--node-width)',
        minHeight: group ? 'var(--group-node-min-height)' : 'var(--node-min-height)',
        padding: group ? '18px 20px' : '14px 15px',
        textAlign: 'left',
        color: 'var(--obs-ink)',
        background: group ? 'color-mix(in srgb, var(--obs-stone) 5%, rgba(252, 250, 247, 0.9))' : 'var(--surface-card-translucent)',
        border: group ? '1.5px solid color-mix(in srgb, var(--obs-stone) 46%, var(--obs-border))' : '1px solid color-mix(in srgb, var(--obs-border) 84%, var(--obs-white))',
        borderColor: active ? 'var(--border-strong)' : undefined,
        borderRadius: 'var(--radius-xl)',
        boxShadow: selected ? 'var(--shadow-selected)' : 'var(--shadow-node)',
        transform: hover ? 'var(--hover-lift)' : 'none',
        cursor: 'pointer',
        transition: 'transform var(--transition-micro), border-color var(--transition-micro), box-shadow var(--transition-micro), background var(--transition-micro)',
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'var(--node-icon-size)', height: 'var(--node-icon-size)', borderRadius: 'var(--radius-pill)', border: '1px solid', ...accents[accent] }}>
        <Icon name={icon} size={group ? 30 : 25} />
      </span>
      <span style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: 5 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', minWidth: 0 }}>
          <span style={{ overflow: 'hidden', color: 'var(--obs-stone)', fontSize: 'var(--text-caption)', fontWeight: 600, letterSpacing: 'var(--tracking-label)', textOverflow: 'ellipsis', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{kindLabel}</span>
          {warning && <span style={{ color: 'var(--obs-clay)', display: 'inline-flex' }}><Icon name="circle-alert" size={14} /></span>}
        </span>
        <span style={{ overflow: 'hidden', fontSize: group ? 'var(--text-node-title-group)' : 'var(--text-node-title)', fontWeight: 'var(--weight-bold)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {group ? (
          <>
            <span style={{ color: 'var(--obs-ink)', fontSize: 'var(--text-small)', fontWeight: 600 }}>{childrenCount} module{childrenCount === 1 ? '' : 's'}</span>
            {members.length > 0 && (
              <span style={{ color: 'var(--text-body)', fontSize: 'var(--text-meta)', lineHeight: 'var(--leading-snug)', ...clamp(2) }}>
                Contains: {members.slice(0, 5).join(', ')}{extraMembers > 0 ? `, +${extraMembers} more` : ''}
              </span>
            )}
            <span style={{ color: active ? 'var(--obs-slate-blue)' : 'var(--obs-stone)', fontSize: 'var(--text-nano)', fontStyle: 'italic' }}>
              {collapsedContainer ? 'Select to expand' : 'Select to explore'}
            </span>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--text-body)', fontSize: 'var(--text-small)', lineHeight: 'var(--leading-snug)', ...clamp(2) }}>{description}</span>
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, minWidth: 0, color: 'var(--obs-stone)', fontSize: 'var(--text-nano)' }}>
              <StatusBadge status={status} showLabel />
              {evidenceCount > 0 && <span>{evidenceCount} evidence</span>}
              {childrenCount > 0 && <span>{childrenCount} areas</span>}
            </span>
          </>
        )}
      </span>
      {canDrilldown && (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', color: active ? 'var(--obs-slate-blue)' : 'var(--obs-stone)', opacity: active ? 1 : 0.7 }}>
          <Icon name={collapsedContainer ? 'chevron-down' : 'chevron-right'} size={16} />
        </span>
      )}
    </button>
  );
}
