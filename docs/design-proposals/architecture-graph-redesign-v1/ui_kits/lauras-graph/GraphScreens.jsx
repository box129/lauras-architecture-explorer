const { Icon, ProvenanceChip, StatementCard, Button, AIInterpretationCard } = window.SyntaxTreeDesignSystem_b1a4e9;
const G = window.GraphData;

/* ── primary architecture map ──────────────────────────────────── */

function MapCanvas({ zoom, filter, selected, onSelect, onEnter, aiOn, foundModule, onOpenModule, mini, controls, scope }) {
  const scroller = React.useRef(null);
  const [viewport, setViewport] = React.useState(null);
  const lod = LOD_OF(zoom);

  const inScope = (n) => !scope || n.id === scope || G.ancestorsOf(n.id).includes(scope);
  const visibleAtLOD = (n) => {
    if (n.kind === 'region' || n.kind === 'area' || n.kind === 'loose') return true;
    if (n.kind === 'cluster') return lod !== 'regions' || selected === n.id;
    if (n.kind === 'residual') return lod === 'modules' || selected === n.id;
    return true;
  };

  const nodes = G.nodes.filter((n) => inScope(n) && visibleAtLOD(n));
  const ids = nodes.map((n) => n.id);
  const rects = {};
  nodes.forEach((n) => { rects[n.id] = n.rect; });

  const edges = React.useMemo(() => {
    if (filter === 'none') return [];
    return G.edges.filter((e) => {
      if (!ids.includes(e.from) || !ids.includes(e.to)) return false;
      const touchesSelection = selected && (e.from === selected || e.to === selected);
      if (touchesSelection) return true;
      if (filter === 'all') return true;
      if (filter === 'strong') return e.count >= 6;
      return e.kind === filter;
    });
  }, [filter, lod, selected, scope, aiOn]);

  const measure = React.useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setViewport({
      x: el.scrollLeft / zoom,
      y: el.scrollTop / zoom,
      w: el.clientWidth / zoom,
      h: el.clientHeight / zoom
    });
  }, [zoom]);
  React.useEffect(() => { measure(); }, [measure, lod]);

  const jump = (x, y) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: x * zoom - el.clientWidth / 2, top: y * zoom - el.clientHeight / 2, behavior: 'smooth' });
  };

  React.useEffect(() => {
    if (!foundModule) return;
    const owner = G.nodes.find((n) => (n.members || []).includes(foundModule));
    if (owner) jump(owner.rect.x + owner.rect.w / 2, owner.rect.y + owner.rect.h / 2);
  }, [foundModule]);

  const related = selected
    ? [selected].concat(edges.filter((e) => e.from === selected || e.to === selected).map((e) => (e.from === selected ? e.to : e.from)))
    : null;
  const keep = (n) => !related || related.includes(n.id) || G.ancestorsOf(selected).includes(n.id) || G.ancestorsOf(n.id).includes(selected);

  return (
    <div style={{ position: 'relative', minWidth: 0, minHeight: 0, background: 'var(--bg-canvas)' }}>
      <div ref={scroller} onScroll={measure} onClick={() => onSelect(null)}
        style={{ position: 'absolute', inset: 0, overflow: 'auto', backgroundImage: 'radial-gradient(var(--canvas-dot) 1px, transparent 1px), var(--canvas-wash, none)', backgroundSize: 22 * zoom + 'px ' + 22 * zoom + 'px, auto' }}>
        <div style={{ position: 'relative', width: G.CW * zoom, height: G.CH * zoom }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: G.CW, height: G.CH, transform: 'scale(' + zoom + ')', transformOrigin: '0 0' }}>
            <EdgeLayer edges={edges} rects={rects} w={G.CW} h={G.CH} zoom={zoom} activeIds={selected ? [selected] : null} dimmed={!!selected} showLabels={lod !== 'regions' || !!selected} />
            {nodes.map((n) => (
              <GraphNode key={n.id} node={n} lod={lod} zoom={zoom} selected={selected === n.id} dimmed={selected ? !keep(n) : false}
                aiOn={aiOn} foundModule={foundModule} onSelect={onSelect} onEnter={onEnter} onOpenModule={onOpenModule} />
            ))}
          </div>
        </div>
      </div>

      {mini && (
        <div style={{ position: 'absolute', left: 14, bottom: 14, zIndex: 80, padding: 5, background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 10, boxShadow: 'var(--shadow-chrome)' }}>
          <Minimap nodes={nodes} w={G.CW} h={G.CH} viewport={viewport} selected={selected} onJump={jump} />
        </div>
      )}
      <div style={{ position: 'absolute', right: 14, bottom: 14, zIndex: 80 }}>{controls}</div>
      <div style={{ position: 'absolute', left: 14, top: 12, zIndex: 80, display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', color: 'var(--text-secondary)', background: 'var(--bg-surface-alpha)', border: '1px solid var(--border-subtle)', borderRadius: 999, fontSize: 11.5, whiteSpace: 'nowrap', backdropFilter: 'blur(8px)' }}>
        <Icon name="network" size={12} />
        {lod === 'regions' ? 'Architecture areas' : lod === 'clusters' ? 'Areas + deterministic clusters' : 'Areas + clusters + modules'}
      </div>
    </div>
  );
}

/* ── scoped services / area view ───────────────────────────────── */

function AreaGraph({ area, aiOn, selected, onSelect, onEnter }) {
  const children = G.childrenOf(area.id).filter((n) => n.kind === 'cluster' || n.kind === 'residual');
  const clusters = children.filter((n) => n.kind === 'cluster');
  const residual = children.find((n) => n.kind === 'residual');
  const W = 980, H = 520;
  const rects = {};
  const cols = 3;
  clusters.forEach((n, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    rects[n.id] = { x: 42 + col * 304, y: 82 + row * 190, w: 260, h: 150 };
  });
  if (residual) rects[residual.id] = { x: 42, y: 430, w: 868, h: 48 };
  const localEdges = G.edges.filter((e) => rects[e.from] && rects[e.to]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '18px 20px 36px', background: 'var(--bg-canvas)', backgroundImage: 'radial-gradient(var(--canvas-dot) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <ProvenanceChip kind="structure" size="sm" label="Structural basis" />
        <strong style={{ fontSize: 14 }}>{aiOn && area.ai ? area.ai.name : area.label}</strong>
        {aiOn && area.ai && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ai-text)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}><Icon name="sparkles" size={11} />AI interpretation</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{area.path}</span>
      </div>
      <div style={{ position: 'relative', width: W, height: H, margin: '0 auto', background: 'color-mix(in srgb, var(--arch-teal) 3%, var(--bg-canvas))', border: '1.5px solid var(--arch-teal)', borderRadius: 14 }}>
        <EdgeLayer w={W} h={H} zoom={1} rects={rects} showLabels edges={localEdges} activeIds={selected ? [selected] : null} dimmed={!!selected} />
        {children.map((n) => {
          const r = rects[n.id];
          if (!r) return null;
          return (
            <div key={n.id} style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h }}>
              <GraphNode node={{ ...n, rect: { x: 0, y: 0, w: r.w, h: r.h }, depth: 0 }} lod="modules" zoom={1} selected={selected === n.id} dimmed={selected ? selected !== n.id && !localEdges.some((e) => (e.from === selected && e.to === n.id) || (e.to === selected && e.from === n.id)) : false} aiOn={aiOn} onSelect={onSelect} onEnter={onEnter} />
            </div>
          );
        })}
      </div>
      <p style={{ maxWidth: 800, margin: '12px auto 0', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.55, textAlign: 'center' }}>
        Cluster boundaries and relation counts are deterministic. Human-readable cluster names are optional AI interpretation and never change membership.
      </p>
    </div>
  );
}

/* ── cluster drill-down ────────────────────────────────────────── */

function GroupGraph({ group, aiOn, onOpenModule, foundModule }) {
  const members = group.members || [];
  const basis = group.basis || [];
  const W = 920, H = 430;
  const pos = {};

  /* Authored, readable small-graph layout for the design example. Production
     should use a deterministic small-graph layout. */
  const presets = [
    { x: 60, y: 180 }, { x: 340, y: 70 }, { x: 340, y: 270 }, { x: 630, y: 90 }, { x: 630, y: 250 }
  ];
  members.forEach((m, i) => { const p = presets[i] || { x: 80 + (i % 3) * 270, y: 80 + Math.floor(i / 3) * 110 }; pos[m] = { x: p.x, y: p.y, w: 220, h: 48 }; });

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'auto', padding: '18px 20px 34px', background: 'var(--bg-canvas)', backgroundImage: 'radial-gradient(var(--canvas-dot) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <ProvenanceChip kind="cluster" />
        <strong style={{ fontSize: 14 }}>{aiOn && group.ai ? group.ai.name : group.full || group.label}</strong>
        {aiOn && group.ai && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ai-text)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}><Icon name="sparkles" size={11} />AI interpretation</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12.5 }}>{group.count} modules · {group.relations || 0} deterministic relations</span>
      </div>
      <div style={{ position: 'relative', width: W, height: H, margin: '0 auto', background: 'var(--structural-cluster-bg)', border: '1.5px solid var(--arch-teal)', borderRadius: 14 }}>
        <EdgeLayer w={W} h={H} zoom={1} rects={pos} showLabels edges={basis.map((b, i) => ({ id: 'b' + i, from: b[0], to: b[2], kind: b[1], count: 1 }))} />
        {members.map((m) => (
          <div key={m} style={{ position: 'absolute', left: pos[m].x, top: pos[m].y, width: pos[m].w, height: pos[m].h, zIndex: 20 }}>
            <button type="button" onClick={() => onOpenModule(m)} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', height: '100%', padding: '0 10px', color: 'var(--text-primary)', background: foundModule === m ? 'var(--action-ghost-hover)' : 'var(--bg-surface)', border: '1px solid ' + (foundModule === m ? 'var(--focus-ring)' : 'var(--border-default2)'), borderRadius: 8, boxShadow: 'var(--shadow-node)', cursor: 'pointer' }}>
              <Icon name="file-code-2" size={13} />
              <span style={{ overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: 11.5, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m}</span>
            </button>
          </div>
        ))}
      </div>
      <p style={{ maxWidth: 700, margin: '12px auto 0', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.55, textAlign: 'center' }}>
        Every edge shown here is a concrete relation from the cluster basis. External relations appear when you focus a module.
      </p>
    </div>
  );
}

/* ── entity focus ──────────────────────────────────────────────── */

function EntityGraph({ entity, onOpenStatement }) {
  const W = 940, H = 310;
  const rects = { __self: { x: W / 2 - 118, y: H / 2 - 44, w: 236, h: 88 } };
  const col = (items, side) => items.forEach((it, i) => {
    const gap = H / (items.length + 1);
    rects[side + it.label] = { x: side === 'in' ? 20 : W - 220, y: gap * (i + 1) - 22, w: 200, h: 44 };
  });
  col(entity.incoming, 'in');
  col(entity.outgoing, 'out');
  const edges = entity.incoming.map((it, i) => ({ id: 'i' + i, from: 'in' + it.label, to: '__self', kind: it.relation, count: 1 }))
    .concat(entity.outgoing.map((it, i) => ({ id: 'o' + i, from: '__self', to: 'out' + it.label, kind: it.relation, count: 1 })));
  const node = (it, side) => (
    <div key={side + it.label} style={{ position: 'absolute', left: rects[side + it.label].x, top: rects[side + it.label].y, width: rects[side + it.label].w, height: rects[side + it.label].h, zIndex: 20, display: 'grid', alignContent: 'center', gap: 2, padding: '0 11px', background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 9, boxShadow: 'var(--shadow-node)' }}>
      <span style={{ overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: 12, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{it.group}</span>
    </div>
  );
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '14px 20px 40px', background: 'var(--bg-canvas)', backgroundImage: 'radial-gradient(var(--canvas-dot) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>Architecture context:</span>
        <span style={{ overflow: 'hidden', color: 'var(--text-secondary)', fontSize: 12.5, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entity.ancestry.join('  ›  ')}</span>
      </div>
      <div style={{ position: 'relative', width: W, height: H, margin: '0 auto' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 200, color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Depended on by</div>
        <div style={{ position: 'absolute', right: 0, top: 0, width: 200, color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'right' }}>Depends on</div>
        <EdgeLayer edges={edges} rects={rects} w={W} h={H} zoom={1} showLabels />
        {entity.incoming.map((it) => node(it, 'in'))}
        {entity.outgoing.map((it) => node(it, 'out'))}
        <div style={{ position: 'absolute', left: rects.__self.x, top: rects.__self.y, width: rects.__self.w, height: rects.__self.h, zIndex: 21, display: 'grid', alignContent: 'center', gap: 6, padding: '0 14px', background: 'var(--bg-surface)', border: '2.5px solid var(--focus-ring)', borderRadius: 12, boxShadow: 'var(--shadow-selected)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="file-code-2" size={16} /><strong style={{ overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: 14, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entity.label}</strong></span>
          <span style={{ display: 'flex', gap: 6 }}><ProvenanceChip kind="structure" size="sm" label="Module" /><ProvenanceChip kind="cluster" size="sm" label="Cluster 1" /></span>
        </div>
      </div>
      <section style={{ maxWidth: 940, margin: '18px auto 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, whiteSpace: 'nowrap' }}>Architectural statements</h3>
          <ProvenanceChip kind="verified" size="sm" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          {entity.statements.map((s) => (
            <StatementCard key={s.id} statement={entity.label + ' ' + s.statement} status={s.status} evidenceCount={s.evidence} onOpenEvidence={() => onOpenStatement && onOpenStatement(s)} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── large repo scale ──────────────────────────────────────────── */

function LargeRepoMap() {
  const L = G.large;
  const rects = {};
  L.nodes.forEach((n) => { rects[n.id] = n.rect; });
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 20, background: 'var(--bg-canvas)', backgroundImage: 'radial-gradient(var(--canvas-dot) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>{L.total.toLocaleString()} source modules</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>6 top-level regions · children load on demand · no 2,000-node hairball</span>
      </div>
      <div style={{ position: 'relative', width: L.canvas.w, height: L.canvas.h }}>
        <EdgeLayer edges={L.edges} rects={rects} w={L.canvas.w} h={L.canvas.h} zoom={1} showLabels />
        {L.nodes.map((n) => (
          <div key={n.id} style={{ position: 'absolute', left: n.rect.x, top: n.rect.y, width: n.rect.w, height: n.rect.h, zIndex: 20, display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 8, padding: 16, background: 'var(--arch-blue-bg)', border: '2px solid var(--arch-blue)', borderRadius: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Icon name="folder-tree" size={16} /><strong style={{ fontSize: 16 }}>{n.label}</strong><span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12.5 }}>{n.count} modules</span></span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{n.path}</span>
            <span style={{ alignSelf: 'end', color: 'var(--text-secondary)', fontSize: 12.5 }}>{n.nested} nested regions · {n.clusters} structural clusters</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── outline: secondary / accessible representation ───────────── */

function OutlinePane({ selected, onSelect, aiOn, compactHeader }) {
  const row = (n, depth) => {
    const semantic = aiOn && n.ai ? n.ai.name : n.label;
    return (
      <React.Fragment key={n.id}>
        <button type="button" onClick={() => onSelect(n.id)} aria-current={selected === n.id ? 'true' : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', paddingLeft: 10 + depth * 14, textAlign: 'left', color: 'var(--text-primary)', background: selected === n.id ? 'var(--action-ghost-hover)' : 'transparent', border: '1px solid ' + (selected === n.id ? 'var(--focus-ring)' : 'transparent'), borderRadius: 7, cursor: 'pointer' }}>
          <span style={{ display: 'inline-flex', flex: 'none', color: n.kind === 'cluster' ? 'var(--arch-teal)' : 'var(--text-muted)' }}><Icon name={n.kind === 'cluster' ? 'waypoints' : n.kind === 'residual' ? 'circle-dot' : 'folder-tree'} size={13} /></span>
          <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', fontSize: 12.5, fontWeight: n.kind === 'region' ? 650 : 500, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{semantic}</span>
          {aiOn && n.ai && <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--ai-text)', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase' }}><Icon name="sparkles" size={9} />AI</span>}
          <span style={{ flex: 'none', marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11.5 }}>{n.count}</span>
        </button>
        {(n.children || []).map((c) => row(c, depth + 1))}
      </React.Fragment>
    );
  };
  return (
    <div style={{ minWidth: 0, height: '100%', overflow: 'auto', padding: 10, background: 'var(--bg-app)' }}>
      {compactHeader && <p style={{ margin: '0 0 8px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 680, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Outline — same architecture scope</p>}
      {G.outline.map((n) => row(n, 0))}
    </div>
  );
}

Object.assign(window, { MapCanvas, AreaGraph, GroupGraph, EntityGraph, LargeRepoMap, OutlinePane });
