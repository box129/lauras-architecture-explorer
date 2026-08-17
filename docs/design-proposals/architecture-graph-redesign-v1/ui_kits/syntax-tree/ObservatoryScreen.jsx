const { Panel, Button, IconButton, Icon, Chip, StatusBadge, Callout, BreadcrumbTrail, RunPicker, TabRail, LensNode, MapLegend, ClaimCard, EvidenceRow, FileList } = window.SyntaxTreeDesignSystem_b1a4e9;

const NODE_W = 238, NODE_H = 104;
const edgeStroke = { flow: 'color-mix(in srgb, var(--obs-slate-blue) 56%, transparent)', inferred: 'color-mix(in srgb, var(--obs-clay) 48%, transparent)', boundary: 'color-mix(in srgb, var(--obs-stone) 62%, transparent)' };
const edgeDash = { flow: '', inferred: '5 6', boundary: '2 5' };

function MapCanvas({ nodes, edges, selectedId, onSelect }) {
  const pos = {};
  nodes.forEach((n) => { pos[n.id] = { x: n.x, y: n.y }; });
  return (
    <div style={{ position: 'relative', height: '100%', padding: '26px 34px 112px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 26, left: 34, zIndex: 4, maxWidth: 'min(840px, calc(100% - 72px))', padding: '10px 14px', background: 'rgba(252,250,247,0.88)', borderRadius: 12, pointerEvents: 'none' }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>Five source-backed areas carry this repository: the application object dispatches requests, blueprints defer registration, and the CLI boots the development server.</p>
        <p style={{ margin: '4px 0 0', color: 'var(--obs-stone)', fontSize: 12.5 }}>The map is interactive — select a card to read its explanation and evidence.</p>
      </div>

      <div style={{ position: 'absolute', top: 118, left: 'max(28px, calc(50% - 480px))', width: 880, height: 300 }}>
        <svg width="880" height="300" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {edges.map((e) => {
            const a = pos[e.from], b = pos[e.to];
            const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
            const mid = (x1 + x2) / 2;
            return <path key={e.from + e.to} d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} fill="none" stroke={edgeStroke[e.kind]} strokeWidth="1.25" strokeDasharray={edgeDash[e.kind]} />;
          })}
        </svg>
        {nodes.map((n) => (
          <div key={n.id} style={{ position: 'absolute', left: n.x, top: n.y }}>
            <LensNode {...n} selected={n.id === selectedId} onClick={() => onSelect(n.id)} />
          </div>
        ))}
      </div>

      <MapLegend style={{ position: 'absolute', left: 34, bottom: 104, zIndex: 3 }} />
      <span style={{ position: 'absolute', right: 24, bottom: 104, zIndex: 3, padding: '5px 10px', color: 'var(--obs-stone)', background: 'rgba(252,250,247,0.92)', border: '1px solid var(--obs-border)', borderRadius: 999, fontSize: 12 }}>5 areas · 54 evidence rows</span>
    </div>
  );
}

function QuestionDock({ contextLabel, suggestions, onAsk }) {
  const [draft, setDraft] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const submit = () => {
    if (!draft.trim()) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); onAsk(draft); setDraft(''); }, 900);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Ask architecture question"
      style={{ position: 'absolute', right: 28, bottom: 26, left: 28, zIndex: 8, display: 'grid', gridTemplateColumns: '28px minmax(170px,1fr) auto auto 42px', gap: 14, alignItems: 'center', maxWidth: 780, minHeight: 64, padding: '12px 14px 12px 18px', color: 'var(--obs-stone)', background: 'rgba(252,250,247,0.9)', border: `1px solid ${loading ? 'color-mix(in srgb, var(--obs-slate-blue) 26%, var(--obs-border))' : 'color-mix(in srgb, var(--obs-border) 80%, var(--obs-white))'}`, borderRadius: 16, boxShadow: 'var(--shadow-dock)', backdropFilter: 'blur(18px)' }}>
      <Icon name="sparkles" size={20} />
      <textarea rows={1} value={draft} placeholder={`Ask anything about ${contextLabel}...`} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        style={{ width: '100%', maxHeight: 76, resize: 'none', color: 'var(--obs-ink)', background: 'transparent', border: 0, outline: 'none', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.35 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => setDraft(s)} style={{ color: 'var(--obs-slate-blue)', background: 'transparent', border: 0, cursor: 'pointer', fontSize: 13, fontStyle: 'italic', whiteSpace: 'nowrap' }}>{s}</button>
        ))}
      </div>
      <kbd style={{ padding: '3px 7px', color: 'var(--obs-stone)', background: 'rgba(255,255,255,0.5)', border: '1px solid var(--obs-border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>Ctrl J</kbd>
      <button type="submit" aria-label="Submit question" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, color: 'var(--obs-white)', background: 'var(--obs-slate-blue)', border: 0, borderRadius: 999, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.72 : 1 }}>
        <Icon name="send" size={18} />
      </button>
      {loading && <span style={{ position: 'absolute', left: 58, bottom: -21, color: 'var(--obs-slate-blue)', fontSize: 12 }}>Building a source-backed lens…</span>}
    </form>
  );
}

function VoiceRail({ node, tab, onTab, onOpenProof, onClose, activeEvidence }) {
  const h3 = { margin: 0, fontSize: 13, fontWeight: 700 };
  const section = { marginTop: 28 };
  return (
    <aside aria-label={`${node.label} explanation`} style={{ height: '100%', padding: 24, overflow: 'auto', background: 'rgba(252,250,247,0.76)', backdropFilter: 'blur(18px)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{node.label}</h2>
            <Chip tone="clay"><StatusBadge status={node.status} />{node.status}</Chip>
          </div>
          <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 13, lineHeight: 1.55 }}>{node.summary}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <Chip tone="fact">{node.kind}</Chip>
            <Chip tone="measure" title="How confident Laura's structural analysis is that this area was correctly identified and classified.">{node.status === 'candidate' ? 'map confidence not available' : '84% map confidence'}</Chip>
            <Chip tone="fact">{node.evidenceCount} evidence</Chip>
            <Chip tone="fact">{node.childrenCount} child areas</Chip>
            <Chip tone="fact">cached explanation</Chip>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <Button variant="quiet" icon={<Icon name="arrow-up-right" size={14} />}>Zoom into this area</Button>
            <Button variant="quiet" icon={<Icon name="message-square-text" size={14} />}>Ask about this</Button>
            <Button variant="quiet" icon={<Icon name="copy" size={14} />}>Copy node link</Button>
            <Button variant="quiet" icon={<Icon name="sparkles" size={14} />}>Architectural Explanation</Button>
            <Button variant="quiet" icon={<Icon name="bookmark-plus" size={14} />}>Save Lens</Button>
          </div>
        </div>
        <IconButton label="Close explanation" icon={<Icon name="x" size={17} />} onClick={onClose} />
      </div>

      {node.status !== 'verified' && (
        <Callout style={{ margin: '24px 0 28px' }} icon={<StatusBadge status={node.status} />}>
          {node.status === 'inferred'
            ? 'Relations here are inferred from structure; the loader is chosen at render time, so no extractor observed a span.'
            : 'Some evidence for this area is source-backed and some remains inferred or incomplete.'}
        </Callout>
      )}

      <TabRail value={tab} onChange={onTab} style={{ marginTop: 24 }} />

      {tab === 'simple' && (
        <>
          <section style={section}><h3 style={h3}>Simple explanation</h3><p style={{ margin: '10px 0 0', color: 'var(--text-body)', fontSize: 13, lineHeight: 1.55 }}>{node.simple}</p></section>
          <section style={section}>
            <h3 style={h3}>Main responsibilities</h3>
            <ul style={{ display: 'grid', gap: 10, padding: 0, margin: '14px 0 0' }}>
              {node.claims.map((c) => <ClaimCard key={c.statement} statement={c.statement} supportStatus={c.supportStatus} relation={c.relation}>
                {c.evidence && <EvidenceRow {...c.evidence} status="verified" onClick={() => onOpenProof(c.evidence)} style={{ marginTop: 12 }} />}
              </ClaimCard>)}
            </ul>
          </section>
          <section style={section}>
            <h3 style={h3}>Useful questions</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              {['What calls this?', 'Where does a request enter?', 'What is not proven here?'].map((q) => <Button key={q} variant="secondary" style={{ minHeight: 32, padding: '7px 11px' }}>{q}</Button>)}
            </div>
          </section>
        </>
      )}

      {tab === 'technical' && (
        <>
          <section style={section}><h3 style={h3}>Technical explanation</h3><p style={{ margin: '10px 0 0', color: 'var(--text-body)', fontSize: 13, lineHeight: 1.55 }}>{node.technical}</p></section>
          <section style={section}>
            <h3 style={h3}>Gaps</h3>
            <ul style={{ display: 'grid', gap: 10, padding: 0, margin: '12px 0 0', listStyle: 'none' }}>
              {['Runtime-registered relations are not statically observable in this run.', 'No live LLM was used, so no narrative beyond deterministic structure.'].map((g) => (
                <li key={g} style={{ paddingLeft: 12, color: 'color-mix(in srgb, var(--obs-ink) 72%, var(--obs-clay))', borderLeft: '2px solid color-mix(in srgb, var(--obs-clay) 38%, transparent)', fontSize: 13, lineHeight: 1.45 }}>{g}</li>
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === 'evidence' && (
        <>
          <section style={section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h3 style={h3}>Key files ({node.files.length})</h3>
              <Button variant="secondary" style={{ minHeight: 28 }}>View all files</Button>
            </div>
            <FileList style={{ marginTop: 12 }} items={node.files} onSelect={(item) => onOpenProof({ filePath: item.filePath, reason: item.reason, startLine: 1, preview: '' })} />
          </section>
          <section style={section}>
            <h3 style={h3}>Evidence rows</h3>
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {node.evidence.map((e) => <EvidenceRow key={e.filePath + e.startLine} {...e} active={activeEvidence && activeEvidence.filePath === e.filePath && activeEvidence.startLine === e.startLine} onClick={e.status === 'verified' ? () => onOpenProof(e) : undefined} />)}
            </div>
          </section>
        </>
      )}
    </aside>
  );
}

function CodeCompanion({ selection, expanded, onToggle, onClose }) {
  const lines = (selection.preview || '# no navigable source region for this evidence').split('\n');
  return (
    <div style={{ position: 'absolute', right: 18, bottom: 16, left: 18, zIndex: 6, display: 'flex', flexDirection: 'column', height: expanded ? 'min(72vh, 720px)' : 'min(42vh, 430px)', overflow: 'hidden', background: 'rgba(252,250,247,0.96)', border: '1px solid color-mix(in srgb, var(--obs-border) 82%, var(--obs-white))', borderRadius: 14, boxShadow: 'var(--shadow-companion)', backdropFilter: 'blur(18px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, minHeight: 46, padding: '8px 10px 8px 14px', borderBottom: '1px solid var(--obs-border)' }}>
        <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10 }}>
          <Icon name="file-code-2" size={15} />
          <strong style={{ overflow: 'hidden', fontSize: 13, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selection.filePath}</strong>
          <Chip tone="fact" style={{ fontFamily: 'var(--font-mono)', height: 22 }}>{selection.startLine}-{selection.endLine ?? selection.startLine}</Chip>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconButton label={expanded ? 'Collapse' : 'Expand'} icon={<Icon name={expanded ? 'chevrons-down-up' : 'chevrons-up-down'} size={15} />} onClick={onToggle} />
          <IconButton label="Close source" icon={<Icon name="x" size={15} />} onClick={onClose} />
        </div>
      </div>
      <p style={{ margin: 0, padding: '10px 14px', color: 'var(--obs-stone)', fontSize: 12, borderBottom: '1px solid var(--obs-border)' }}>{selection.reason}</p>
      <div style={{ flex: 1, overflow: 'auto', padding: 18, color: '#ECEAF0', background: 'var(--surface-code)', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre' }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', background: i === 0 ? 'rgba(201,162,39,0.14)' : 'transparent' }}>
            <span style={{ color: '#AAA7B2' }}>{(selection.startLine ?? 1) + i}</span>
            <span>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ObservatoryScreen({ onRestart }) {
  const data = window.STData;
  const [selectedId, setSelectedId] = React.useState('app');
  const [tab, setTab] = React.useState('simple');
  const [proof, setProof] = React.useState(null);
  const [expanded, setExpanded] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const node = data.nodes.find((n) => n.id === selectedId);
  const crumbs = [{ id: null, label: 'Overview' }, { id: 'pkg', label: 'src/flask' }];
  if (node) crumbs.push({ id: node.id, label: node.label });

  return (
    <div style={{ position: 'relative', height: '100%', color: 'var(--obs-ink)', background: 'var(--canvas-wash), var(--obs-canvas)', fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>
      <header style={{ position: 'relative', zIndex: 40, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', height: 48, padding: '0 18px', background: 'rgba(252,250,247,0.86)', borderBottom: '1px solid var(--obs-border)', backdropFilter: 'blur(18px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <IconButton label="Open navigation" icon={<Icon name="menu" size={18} />} onClick={() => setMenuOpen((o) => !o)} />
            {menuOpen && (
              <div role="menu" style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 8px)', left: 0, display: 'grid', gap: 4, width: 260, padding: 6, background: 'var(--obs-white)', border: '1px solid var(--obs-border)', borderRadius: 8, boxShadow: 'var(--shadow-menu)' }}>
                {[['book-open', 'Repository documentation', 'Browse components and source', () => setMenuOpen(false)], ['folder-search', 'Analyze another repository', 'Clear this session and start again', onRestart], ['settings', 'Settings', 'Configure architectural explanations', () => setMenuOpen(false)]].map(([icon, title, sub, action]) => (
                  <button key={title} type="button" onClick={action} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 9, alignItems: 'start', padding: 9, color: 'var(--obs-ink)', textAlign: 'left', background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer' }}>
                    <Icon name={icon} size={15} />
                    <span style={{ display: 'grid', gap: 3 }}><strong style={{ fontSize: 13 }}>{title}</strong><small style={{ color: 'var(--obs-stone)', fontSize: 11 }}>{sub}</small></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <BreadcrumbTrail items={crumbs} onSelect={(i) => { if (i < 2) setSelectedId(null); }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 650 }}>{data.repoTitle}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <RunPicker runId={data.runId} lastScanned="scanned 4m ago" freshness="Live" />
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', height: 'calc(100% - 48px)', minHeight: 0 }}>
        <div style={{ position: 'relative', minWidth: 0, overflow: 'hidden', borderRight: '1px solid var(--obs-border)' }}>
          <MapCanvas nodes={data.nodes} edges={data.edges} selectedId={selectedId} onSelect={setSelectedId} />
          {proof
            ? <CodeCompanion selection={proof} expanded={expanded} onToggle={() => setExpanded((e) => !e)} onClose={() => { setProof(null); setExpanded(false); }} />
            : <QuestionDock contextLabel={node ? node.label : data.repoTitle} suggestions={data.suggestions} onAsk={() => { setSelectedId('app'); setTab('technical'); }} />}
        </div>
        {node
          ? <VoiceRail node={node} tab={tab} onTab={setTab} activeEvidence={proof} onOpenProof={(sel) => { setProof(sel); setExpanded(false); }} onClose={() => setSelectedId(null)} />
          : <aside style={{ height: '100%', padding: 24, overflow: 'auto', background: 'rgba(252,250,247,0.76)', backdropFilter: 'blur(18px)' }}>
              <p style={{ margin: 0, color: 'var(--obs-stone)', fontSize: 13, lineHeight: 1.5 }}>Select an architecture area to see the cached explanation, its source evidence, and what the backend still cannot prove.</p>
              <OrientationPanel orientation={data.orientation} compact />
            </aside>}
      </div>
    </div>
  );
}

Object.assign(window, { ObservatoryScreen });
