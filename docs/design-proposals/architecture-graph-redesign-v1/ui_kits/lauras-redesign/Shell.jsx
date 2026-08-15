const { Icon, Button, IconButton, ThemeToggle, ProvenanceChip } = window.SyntaxTreeDesignSystem_b1a4e9;

const DESTINATIONS = [
  { id: 'projects', label: 'Projects', icon: 'folder-open' },
  { id: 'architecture', label: 'Architecture', icon: 'network' },
  { id: 'docs', label: 'Doc Studio', icon: 'book-open' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function Wordmark({ size = 15 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: size, fontWeight: 650, letterSpacing: '-0.005em', color: 'var(--text-primary)' }}>
      <span style={{ display: 'inline-flex', color: 'var(--action-primary)' }}><Icon name="git-branch" size={size + 3} /></span>
      Laura&rsquo;s
    </span>
  );
}

function TopNav({ destination, onNavigate, theme, onTheme, right, compact = false }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: compact ? 12 : 20, height: 52, padding: '0 18px', minWidth: 0, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default2)' }}>
      <Wordmark />
      <nav aria-label="Global" style={{ display: 'flex', flex: 'none', gap: 2 }}>
        {DESTINATIONS.map((d) => {
          const active = d.id === destination;
          return (
            <button key={d.id} type="button" onClick={() => onNavigate(d.id)} aria-current={active ? 'page' : undefined}
              aria-label={compact ? d.label : undefined} title={compact ? d.label : undefined}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 32, width: compact ? 34 : undefined, padding: compact ? 0 : '0 11px', color: active ? 'var(--text-primary)' : 'var(--text-muted)', background: active ? 'var(--bg-sunken)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-default2)' : 'transparent'), borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              <Icon name={d.icon} size={14} />{!compact && d.label}
            </button>
          );
        })}
      </nav>
      <div style={{ display: 'flex', flex: '0 1 auto', alignItems: 'center', gap: 12, minWidth: 0, marginLeft: 'auto' }}>
        {!compact && <div style={{ minWidth: 0, overflow: 'hidden' }}>{right}</div>}
        <div style={{ flex: 'none' }}><ThemeToggle value={theme} onChange={onTheme} /></div>
      </div>
    </header>
  );
}

/** One Back, one breadcrumb, one meaning: pop exactly one level. */
function NavBar({ crumbs, onCrumb, onBack, right, compact = false }) {
  const canBack = crumbs.length > 1;
  const offset = compact && crumbs.length > 2 ? crumbs.length - 2 : 0;
  const shown = crumbs.slice(offset);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 44, padding: '0 18px', background: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)' }}>
      <button type="button" onClick={onBack} disabled={!canBack} aria-label="Back one level"
        style={{ display: 'inline-flex', flex: 'none', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', color: canBack ? 'var(--text-primary)' : 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default2)', borderRadius: 'var(--radius-md)', cursor: canBack ? 'pointer' : 'not-allowed', opacity: canBack ? 1 : 0.45, fontSize: 13, whiteSpace: 'nowrap' }}>
        <Icon name="arrow-left" size={14} />Back
      </button>
      <nav aria-label="Architecture trail" style={{ display: 'flex', flex: '1 1 auto', alignItems: 'center', gap: 4, minWidth: 0, fontSize: 13 }}>
        {offset > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', color: 'var(--text-muted)' }}>
            <button type="button" onClick={() => onCrumb(0)} title="Overview" style={{ padding: 0, color: 'inherit', background: 'transparent', border: 0, cursor: 'pointer', fontSize: 13 }}>…</button>
            <Icon name="chevron-right" size={13} />
          </span>
        )}
        {shown.map((crumb, i) => {
          const index = i + offset;
          const last = index === crumbs.length - 1;
          return (
            <span key={crumb.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, flex: last ? '0 1 auto' : '0 0 auto' }}>
              {last
                ? <span aria-current="location" style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{crumb.label}</span>
                : <button type="button" onClick={() => onCrumb(index)} style={{ maxWidth: 200, overflow: 'hidden', padding: 0, color: 'var(--text-muted)', background: 'transparent', border: 0, cursor: 'pointer', fontSize: 13, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{crumb.label}</button>}
              {!last && <span style={{ color: 'var(--text-muted)', display: 'inline-flex' }}><Icon name="chevron-right" size={13} /></span>}
            </span>
          );
        })}
      </nav>
      <div style={{ display: 'flex', flex: 'none', alignItems: 'center', gap: 8, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{right}</div>
    </div>
  );
}

/** Compact, keyboard-reachable canvas controls. 36px tall, docked, not a bar across the bottom. */
function CanvasControls({ view, onView, onZoom, onFit }) {
  const button = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: 30, height: 30, color: 'var(--text-primary)', background: 'transparent', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer' };
  return (
    <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 5, display: 'flex', alignItems: 'center', gap: 2, padding: 3, background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-chrome)' }}>
      <button type="button" style={button} aria-label="Zoom out" onClick={() => onZoom(-1)}><Icon name="minus" size={15} /></button>
      <button type="button" style={button} aria-label="Zoom in" onClick={() => onZoom(1)}><Icon name="plus" size={15} /></button>
      <button type="button" style={button} aria-label="Fit to view" onClick={onFit}><Icon name="maximize" size={15} /></button>
      <span style={{ width: 1, height: 18, background: 'var(--border-default2)', margin: '0 3px' }} />
      <div role="radiogroup" aria-label="Architecture view" style={{ display: 'flex', gap: 2 }}>
        {[['map', 'network', 'Map'], ['outline', 'list-tree', 'Outline']].map(([id, icon, label]) => {
          const on = view === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} onClick={() => onView(id)}
              style={{ ...button, width: 'auto', padding: '0 10px', fontSize: 12.5, fontWeight: on ? 620 : 400, color: on ? 'var(--text-primary)' : 'var(--text-muted)', background: on ? 'var(--bg-sunken)' : 'transparent', border: '1px solid ' + (on ? 'var(--border-default2)' : 'transparent') }}>
              <Icon name={icon} size={15} />{label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** State-aware right panel frame. */
function ContextPanel({ eyebrow, title, chip, children, footer, width = 348 }) {
  return (
    <aside aria-label={title} style={{ display: 'flex', flexDirection: 'column', width, minWidth: 0, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default2)' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 680, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{eyebrow}</span>
          {chip}
        </div>
        <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{title}</h2>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 18 }}>{children}</div>
      {footer && <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)' }}>{footer}</div>}
    </aside>
  );
}

function PanelSection({ title, children, style }) {
  return (
    <section style={{ marginBottom: 22, ...style }}>
      {title && <h3 style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 680, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</h3>}
      {children}
    </section>
  );
}

function FactRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function ExampleNotice() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', color: 'var(--text-muted)', background: 'var(--bg-sunken)', border: '1px dashed var(--border-default2)', borderRadius: 999, fontSize: 11, lineHeight: 1.4, whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', flex: 'none' }}><Icon name="info" size={12} /></span>Design example
    </div>
  );
}

Object.assign(window, { Wordmark, TopNav, NavBar, CanvasControls, ContextPanel, PanelSection, FactRow, ExampleNotice, DESTINATIONS });
