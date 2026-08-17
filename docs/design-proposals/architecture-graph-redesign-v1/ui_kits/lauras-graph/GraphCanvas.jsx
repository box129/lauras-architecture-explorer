const { Icon, ProvenanceChip } = window.SyntaxTreeDesignSystem_b1a4e9;

/* ── geometry ──────────────────────────────────────────────────── */

const SIDE = (r, s) => ({
  top: { x: r.x + r.w / 2, y: r.y },
  bottom: { x: r.x + r.w / 2, y: r.y + r.h },
  left: { x: r.x, y: r.y + r.h / 2 },
  right: { x: r.x + r.w, y: r.y + r.h / 2 },
}[s]);

function routeVia(a, b, anchor, channel) {
  const s = SIDE(a, anchor.from), t = SIDE(b, anchor.to);
  if (channel && channel.x != null) {
    const cx = channel.x;
    return {
      d: `M${s.x},${s.y} L${cx},${s.y} L${cx},${t.y} L${t.x},${t.y}`,
      mid: { x: cx, y: (s.y + t.y) / 2 }
    };
  }
  const cy = channel && channel.y != null ? channel.y : (s.y + t.y) / 2;
  return {
    d: `M${s.x},${s.y} L${s.x},${cy} L${t.x},${cy} L${t.x},${t.y}`,
    mid: { x: (s.x + t.x) / 2, y: cy }
  };
}

function routeEdge(a, b) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x, dy = bc.y - ac.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    const sy = dy > 0 ? a.y + a.h : a.y;
    const ty = dy > 0 ? b.y : b.y + b.h;
    const my = sy + (ty - sy) / 2;
    return {
      d: `M${ac.x},${sy} L${ac.x},${my} L${bc.x},${my} L${bc.x},${ty}`,
      mid: { x: (ac.x + bc.x) / 2, y: my }
    };
  }
  const sx = dx > 0 ? a.x + a.w : a.x;
  const tx = dx > 0 ? b.x : b.x + b.w;
  const mx = sx + (tx - sx) / 2;
  return {
    d: `M${sx},${ac.y} L${mx},${ac.y} L${mx},${bc.y} L${tx},${bc.y}`,
    mid: { x: mx, y: (ac.y + bc.y) / 2 }
  };
}

const EDGE_COLOR = {
  imports: 'var(--arch-blue)',
  calls: 'var(--arch-teal)',
  inherits: 'var(--arch-violet)'
};

function EdgeLayer({ edges, rects, w, h, zoom, activeIds, dimmed, showLabels = true }) {
  const fs = Math.max(10.5, 11 / zoom);
  return (
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0, zIndex: 70, overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        {['imports', 'calls', 'inherits'].map((kind) => (
          <marker key={kind} id={'arrow-' + kind} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 z" fill={EDGE_COLOR[kind]} />
          </marker>
        ))}
      </defs>
      {edges.map((e) => {
        const a = rects[e.from], b = rects[e.to];
        if (!a || !b) return null;
        const on = activeIds && (activeIds.includes(e.from) || activeIds.includes(e.to));
        const off = dimmed && !on;
        const r = e.anchor ? routeVia(a, b, e.anchor, e.channel) : routeEdge(a, b);
        const stroke = EDGE_COLOR[e.kind] || 'var(--edge-stroke)';
        const label = e.count + ' ' + e.kind;
        const lw = label.length * fs * 0.54 + 14;
        return (
          <g key={e.id} opacity={off ? 0.12 : on ? 1 : 0.74}>
            <path
              d={r.d}
              fill="none"
              stroke={stroke}
              strokeWidth={on ? 2.6 : 1.65}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={e.kind === 'calls' ? '7 5' : undefined}
              markerEnd={'url(#arrow-' + (e.kind || 'imports') + ')'}
            />
            {showLabels && (
              <g transform={`translate(${r.mid.x - lw / 2}, ${r.mid.y - fs})`}>
                <rect width={lw} height={fs * 1.9} rx={fs} fill="var(--edge-label-bg)" stroke={stroke} strokeOpacity={on ? 0.9 : 0.45} strokeWidth="1" />
                <text x={lw / 2} y={fs * 1.3} textAnchor="middle" fontSize={fs} fontFamily="var(--font-sans)" fill={on ? 'var(--text-primary)' : 'var(--text-secondary)'} fontWeight={on ? 650 : 520}>
                  {label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── nodes ─────────────────────────────────────────────────────── */

const ACCENT = {
  blue: { fg: 'var(--arch-blue)', bg: 'var(--arch-blue-bg)' },
  cyan: { fg: 'var(--arch-cyan)', bg: 'var(--arch-cyan-bg)' },
  teal: { fg: 'var(--arch-teal)', bg: 'var(--arch-teal-bg)' },
  violet: { fg: 'var(--arch-violet)', bg: 'var(--arch-violet-bg)' },
  neutral: { fg: 'var(--arch-neutral)', bg: 'var(--arch-neutral-bg)' }
};

const KIND = {
  region: { icon: 'folder-tree', radius: 14, borderWidth: 2 },
  area: { icon: 'boxes', radius: 11, borderWidth: 1.5 },
  cluster: { icon: 'waypoints', radius: 10, borderWidth: 1.5 },
  residual: { icon: 'circle-dot', radius: 8, borderWidth: 1 },
  loose: { icon: 'file-code-2', radius: 10, borderWidth: 1.5 }
};

function ModuleChip({ name, found, onOpen }) {
  return (
    <button type="button" onClick={(ev) => { ev.stopPropagation(); onOpen && onOpen(name); }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', padding: '3px 7px', color: found ? 'var(--action-primary)' : 'var(--text-secondary)', background: found ? 'var(--action-ghost-hover)' : 'var(--bg-app)', border: '1px solid ' + (found ? 'var(--focus-ring)' : 'var(--border-subtle)'), borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {name}
    </button>
  );
}

function AIInlineLabel({ node, zoom, compact }) {
  if (!node.ai) return null;
  const lp = (base) => Math.round(Math.max(base, base / zoom));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, color: 'var(--ai-text)' }}>
      <span style={{ display: 'inline-flex', flex: 'none', color: 'var(--ai-accent)' }}><Icon name="sparkles" size={lp(compact ? 10 : 11)} /></span>
      <span style={{ overflow: 'hidden', fontSize: lp(compact ? 9 : 9.5), fontWeight: 700, letterSpacing: '0.055em', textOverflow: 'ellipsis', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>AI interpretation</span>
    </div>
  );
}

function GraphNode({ node, lod, zoom, selected, dimmed, aiOn, foundModule, onSelect, onEnter, onOpenModule }) {
  const k = KIND[node.kind] || KIND.area;
  const a = ACCENT[node.accent || (node.kind === 'cluster' ? 'teal' : 'neutral')];
  const lp = (base) => Math.round(Math.max(base, base / zoom));
  const showAI = aiOn && !!node.ai && (node.kind === 'area' || node.kind === 'cluster');
  const isRegion = node.kind === 'region';
  const isCluster = node.kind === 'cluster';
  const isResidual = node.kind === 'residual';
  const showMembers = lod === 'modules' && node.members && !isRegion && !isResidual;
  const semanticTitle = showAI ? node.ai.name : node.label;
  const deterministicBasis = node.path || node.full || node.label;

  if (isResidual && lod === 'regions') return null;

  return (
    <div onClick={(ev) => { ev.stopPropagation(); onSelect(node.id); }}
      style={{
        position: 'absolute', left: node.rect.x, top: node.rect.y, width: node.rect.w, height: node.rect.h,
        display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10 + node.depth * 10,
        background: isRegion ? 'color-mix(in srgb, ' + a.fg + ' 3%, var(--bg-canvas))' : isResidual ? 'var(--bg-sunken)' : a.bg,
        border: (selected ? 2.5 : k.borderWidth) + 'px solid ' + (selected ? 'var(--focus-ring)' : isResidual ? 'var(--border-default2)' : a.fg),
        borderStyle: isResidual ? 'dashed' : 'solid', borderRadius: k.radius,
        boxShadow: selected ? 'var(--shadow-selected)' : isRegion ? 'none' : 'var(--shadow-node)',
        opacity: dimmed ? 0.16 : 1, transition: 'opacity 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
        cursor: 'pointer'
      }}>

      {isRegion ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none', minHeight: 44, padding: '8px 13px', background: 'color-mix(in srgb, ' + a.fg + ' 8%, var(--bg-surface))', borderBottom: '1px solid color-mix(in srgb, ' + a.fg + ' 45%, var(--border-default2))' }}>
          <span style={{ display: 'inline-flex', color: a.fg }}><Icon name="folder-tree" size={lp(15)} /></span>
          <div style={{ display: 'grid', minWidth: 0 }}>
            <strong style={{ overflow: 'hidden', color: 'var(--text-primary)', fontSize: lp(node.depth === 0 ? 16 : 14), lineHeight: 1.15, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</strong>
            {node.path && <span style={{ overflow: 'hidden', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: lp(9.5), textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.path}</span>}
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: lp(10.5), whiteSpace: 'nowrap' }}>{node.summary || (node.count + ' modules')}</span>
          {selected && (
            <button type="button" aria-label={'Enter ' + node.label} onClick={(ev) => { ev.stopPropagation(); onEnter(node); }}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 25, height: 25, color: 'var(--action-primary)', background: 'var(--bg-surface)', border: '1px solid var(--focus-ring)', borderRadius: 6, cursor: 'pointer' }}>
              <Icon name="arrow-right" size={12} />
            </button>
          )}
        </div>
      ) : (
        <>
          {showAI && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none', padding: '5px 9px', background: 'var(--ai-surface)', borderBottom: '1px solid var(--ai-border)', boxShadow: 'inset 3px 0 0 var(--ai-accent)' }}>
              <AIInlineLabel node={node} zoom={zoom} compact={isCluster} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none', minHeight: isCluster ? 42 : 48, padding: isCluster ? '6px 9px' : '7px 10px' }}>
            <span style={{ display: 'inline-flex', flex: 'none', color: isResidual ? 'var(--text-muted)' : a.fg }}><Icon name={k.icon} size={lp(isCluster ? 13 : 14)} /></span>
            <div style={{ display: 'grid', minWidth: 0, gap: 1 }}>
              <strong style={{ overflow: 'hidden', color: isResidual ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: lp(isCluster ? 11.5 : 13), lineHeight: 1.18, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{semanticTitle}</strong>
              {!isResidual && (
                <span style={{ overflow: 'hidden', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: lp(isCluster ? 8.8 : 9.5), textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {showAI ? deterministicBasis : (node.path || node.full || '')}
                </span>
              )}
            </div>
            <span style={{ flex: 'none', marginLeft: 'auto', color: 'var(--text-muted)', fontSize: lp(9.5), whiteSpace: 'nowrap' }}>
              {node.count} modules{isCluster ? ' · ' + node.relations + ' rel.' : ''}
            </span>
            {selected && !isResidual && (
              <button type="button" aria-label={'Enter ' + node.label} onClick={(ev) => { ev.stopPropagation(); onEnter(node); }}
                style={{ display: 'inline-flex', flex: 'none', alignItems: 'center', justifyContent: 'center', width: 23, height: 23, color: 'var(--action-primary)', background: 'var(--bg-surface)', border: '1px solid var(--focus-ring)', borderRadius: 6, cursor: 'pointer' }}>
                <Icon name="arrow-right" size={11} />
              </button>
            )}
          </div>
        </>
      )}

      {showMembers && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 4, minHeight: 0, overflow: 'hidden', padding: '1px 9px 9px' }}>
          {node.members.slice(0, isCluster ? 3 : 4).map((m) => (
            <ModuleChip key={m} name={m} found={foundModule === m} onOpen={onOpenModule} />
          ))}
          {node.count > (node.members || []).length && <span style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: lp(9.5) }}>+{node.count - node.members.length} more</span>}
        </div>
      )}

      {!showMembers && lod === 'clusters' && node.members && !isRegion && !isResidual && (
        <p style={{ margin: 0, padding: '0 9px 8px', overflow: 'hidden', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: lp(9.5), textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.members.slice(0, 2).join('  ')}{node.count > 2 ? '  +' + (node.count - 2) : ''}
        </p>
      )}

      {isResidual && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', padding: '0 10px', color: 'var(--text-muted)', fontSize: lp(10) }}>
          <Icon name="circle-dot" size={11} />
          <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{node.label}</strong>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.summary}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>View set →</span>
        </div>
      )}
    </div>
  );
}

/* ── semantic zoom / controls ─────────────────────────────────── */

const LOD_OF = (z) => (z < 0.68 ? 'regions' : z < 0.96 ? 'clusters' : 'modules');

function Minimap({ nodes, w, h, viewport, onJump, selected }) {
  const s = Math.min(148 / w, 102 / h);
  return (
    <button type="button" aria-label="Minimap" onClick={(ev) => {
      const b = ev.currentTarget.getBoundingClientRect();
      onJump((ev.clientX - b.left) / s, (ev.clientY - b.top) / s);
    }} style={{ position: 'relative', width: w * s, height: h * s, padding: 0, background: 'var(--bg-sunken)', border: '1px solid var(--border-default2)', borderRadius: 8, cursor: 'crosshair', overflow: 'hidden' }}>
      {nodes.filter((n) => n.kind === 'region' || n.kind === 'area' || n.kind === 'cluster').map((n) => {
        const a = ACCENT[n.accent || (n.kind === 'cluster' ? 'teal' : 'neutral')];
        return <span key={n.id} style={{ position: 'absolute', left: n.rect.x * s, top: n.rect.y * s, width: n.rect.w * s, height: n.rect.h * s, background: selected === n.id ? 'var(--action-primary)' : a.bg, border: '1px solid ' + a.fg, borderRadius: 2 }} />;
      })}
      {viewport && <span style={{ position: 'absolute', left: viewport.x * s, top: viewport.y * s, width: viewport.w * s, height: viewport.h * s, border: '1.5px solid var(--action-primary)', background: 'var(--action-ghost-hover)', borderRadius: 2 }} />}
    </button>
  );
}

function GraphControls({ zoom, onZoom, onFit, filter, onFilter, view, onView, mini, onMini, aiOn, onAI }) {
  const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, color: 'var(--text-primary)', background: 'transparent', border: 0, borderRadius: 6, cursor: 'pointer' };
  const divider = <span style={{ width: 1, height: 18, background: 'var(--border-default2)' }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 10, boxShadow: 'var(--shadow-chrome)' }}>
      <button type="button" style={btn} aria-label="Zoom out" onClick={() => onZoom(-1)}><Icon name="minus" size={15} /></button>
      <span style={{ minWidth: 38, color: 'var(--text-muted)', fontSize: 11.5, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom * 100)}%</span>
      <button type="button" style={btn} aria-label="Zoom in" onClick={() => onZoom(1)}><Icon name="plus" size={15} /></button>
      <button type="button" style={btn} aria-label="Fit to view" onClick={onFit}><Icon name="maximize" size={15} /></button>
      {divider}
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, paddingLeft: 3, color: 'var(--text-muted)', fontSize: 11.5 }}>
        <Icon name="waypoints" size={13} />
        <select value={filter} onChange={(ev) => onFilter(ev.target.value)} aria-label="Relation filter" style={{ height: 26, padding: '0 4px', color: 'var(--text-primary)', background: 'var(--bg-app)', border: '1px solid var(--border-default2)', borderRadius: 6, fontSize: 11.5, fontFamily: 'var(--font-sans)' }}>
          <option value="strong">Strongest</option>
          <option value="all">All relations</option>
          <option value="imports">Imports</option>
          <option value="calls">Calls</option>
          <option value="inherits">Inheritance</option>
          <option value="none">None</option>
        </select>
      </label>
      {divider}
      <button type="button" onClick={onAI} aria-pressed={aiOn} style={{ ...btn, width: 'auto', gap: 5, padding: '0 8px', color: aiOn ? 'var(--ai-text)' : 'var(--text-muted)', background: aiOn ? 'var(--ai-surface)' : 'transparent', border: '1px solid ' + (aiOn ? 'var(--ai-border)' : 'transparent'), fontSize: 11.5, fontWeight: aiOn ? 650 : 500 }}>
        <Icon name="sparkles" size={13} />AI labels
      </button>
      {divider}
      <div role="radiogroup" aria-label="Architecture view" style={{ display: 'flex', gap: 2 }}>
        {[['map', 'network', 'Map'], ['outline', 'list-tree', 'Outline'], ['split', 'panel-right', 'Both']].map(([id, icon, label]) => {
          const on = view === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} onClick={() => onView(id)} style={{ ...btn, width: 'auto', gap: 5, padding: '0 8px', fontSize: 11.5, fontWeight: on ? 650 : 450, color: on ? 'var(--text-primary)' : 'var(--text-muted)', background: on ? 'var(--bg-sunken)' : 'transparent', border: '1px solid ' + (on ? 'var(--border-default2)' : 'transparent') }}>
              <Icon name={icon} size={13} />{label}
            </button>
          );
        })}
      </div>
      {divider}
      <button type="button" style={{ ...btn, color: mini ? 'var(--action-primary)' : 'var(--text-muted)' }} aria-label="Toggle minimap" aria-pressed={mini} onClick={onMini}><Icon name="workflow" size={15} /></button>
    </div>
  );
}

Object.assign(window, { routeEdge, routeVia, EdgeLayer, GraphNode, ModuleChip, Minimap, GraphControls, LOD_OF, KIND, ACCENT });
