const { Panel, Button, IconButton, Icon, Chip, PathInput, TextInput, SegmentedControl, CheckField, PromiseCard, StageRow, ProgressMeter, Callout, StatusBadge } = window.SyntaxTreeDesignSystem_b1a4e9;

const label = { display: 'block', marginBottom: 8, color: 'var(--obs-stone)', fontSize: 11, fontWeight: 680, letterSpacing: '0.04em', textTransform: 'uppercase' };

function OrientationPanel({ orientation, compact }) {
  return (
    <section aria-label="Repository orientation" style={{ marginTop: compact ? 0 : 18, padding: 16, border: '1px solid var(--obs-border)', borderRadius: 8, background: 'rgba(255,255,255,0.86)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <Chip tone="fact" style={{ color: 'var(--orientation-ready)', borderColor: 'rgba(4,120,87,.24)' }} icon={<Icon name="compass" size={13} />}>Orientation ready</Chip>
          <h3 style={{ margin: '7px 0 0', fontSize: 17, lineHeight: 1.2 }}>{orientation.label}</h3>
        </div>
        <Chip tone="measure">86% map confidence</Chip>
      </div>
      <p style={{ margin: '12px 0 0', color: 'var(--obs-stone)', fontSize: 13, lineHeight: 1.55 }}>{orientation.summary}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
        {orientation.frameworks.map((name) => <Chip key={name} tone="signal">{name}</Chip>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: 14, marginTop: 16 }}>
        {[['Important areas', 'compass', orientation.areas], ['Start reading', 'book-open', orientation.reading]].map(([title, icon, items]) => (
          <div key={title}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, fontSize: 12, fontWeight: 700 }}><Icon name={icon} size={14} />{title}</div>
            {items.map((item) => (
              <article key={item.name} style={{ padding: '10px 0', borderTop: '1px solid var(--obs-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}><Icon name="file-text" size={13} /><strong style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{item.name}</strong></div>
                <p style={{ margin: '5px 0 0', color: 'var(--obs-stone)', fontSize: 12, lineHeight: 1.45 }}>{item.detail}</p>
                <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: 'var(--obs-stone)' }}>{item.meta}</span>
              </article>
            ))}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--obs-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, fontSize: 12, fontWeight: 700 }}><Icon name="circle-alert" size={14} />Still investigating</div>
        {orientation.unknowns.map((u) => <p key={u.subject} style={{ margin: '5px 0 0', color: 'var(--obs-stone)', fontSize: 12, lineHeight: 1.45 }}><strong>{u.subject}:</strong> {u.reason}</p>)}
      </div>
    </section>
  );
}

function EntryScreen({ onComplete }) {
  const data = window.STData;
  const [path, setPath] = React.useState(data.repoPath);
  const [scanning, setScanning] = React.useState(false);
  const [advanced, setAdvanced] = React.useState(false);
  const [mode, setMode] = React.useState('standard');
  const [budget, setBudget] = React.useState('strict');
  const [scope, setScope] = React.useState('backend');
  const [requireLlm, setRequireLlm] = React.useState(false);
  const [parsed, setParsed] = React.useState(0);

  React.useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => setParsed((n) => Math.min(1180, n + 96)), 260);
    return () => clearInterval(timer);
  }, [scanning]);

  return (
    <main style={{ minHeight: '100%', color: 'var(--obs-ink)', background: 'var(--obs-canvas)', fontFamily: 'var(--font-sans)' }}>
      <section style={{ position: 'sticky', top: 0, zIndex: 2, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid color-mix(in srgb, var(--obs-border) 84%, transparent)', background: 'color-mix(in srgb, var(--obs-canvas) 94%, transparent)', backdropFilter: 'blur(16px)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 650 }}>
          <span style={{ color: 'var(--obs-slate-blue)', display: 'inline-flex' }}><Icon name="git-branch" size={18} /></span>Syntax Tree
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button variant="pill" icon={<Icon name="settings" size={15} />}>Settings</Button>
          <Button variant="pill" iconAfter={<Icon name="external-link" size={13} />}>Open legacy workspace</Button>
        </div>
      </section>

      <section style={{ width: 'min(1180px, calc(100% - 48px))', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1.02fr) minmax(420px, 0.78fr)', alignItems: 'center', gap: 56, padding: '64px 0' }}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18, color: 'var(--obs-slate-blue)', fontSize: 13, fontWeight: 650 }}>
            <Icon name="sparkles" size={14} />Codebase observatory
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(44px, 5vw, 72px)', lineHeight: 0.96, fontWeight: 720 }}>What repo do you want to understand?</h1>
          <p style={{ maxWidth: 610, margin: '24px 0 0', color: 'var(--text-body)', fontSize: 17, lineHeight: 1.7 }}>
            Syntax Tree scans a repository and turns it into a calm, source-backed architecture map. You can zoom through concepts, inspect flows, ask questions, and open the exact code behind each answer.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginTop: 36 }}>
            <PromiseCard icon="shield-check" title="Source-backed" text="Architecture claims stay tied to files, spans, and evidence." />
            <PromiseCard icon="git-branch" title="Meaning first" text="The first screen explains the system shape, not the folder tree." />
            <PromiseCard icon="clock" title="Guided progress" text="Analysis stages use human copy instead of raw pipeline jargon." />
          </div>
        </div>

        <Panel aria-label="Start repository analysis">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Start a scan</h2>
              <p style={{ margin: '6px 0 0', color: 'var(--obs-stone)', fontSize: 13, lineHeight: 1.45 }}>Paste a local repository path. Orientation appears first, then the map opens when deeper analysis is ready.</p>
            </div>
            <Chip tone="slate" style={{ height: 'fit-content' }}>API mode</Chip>
          </div>
          <span style={label}>Repository path</span>
          <PathInput value={path} onChange={setPath} onBrowse={() => {}} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
            {['repos/flask', 'repos/tenacity', 'work/documenso'].map((p) => <Button key={p} variant="pill" onClick={() => setPath('C:\\' + p.replace('/', '\\'))}>{p}</Button>)}
          </div>
          <div style={{ marginTop: 16, border: '1px solid var(--obs-border)', borderRadius: 8, overflow: 'hidden' }}>
            <button type="button" onClick={() => setAdvanced((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 12px', color: 'var(--obs-stone)', fontSize: 13, background: 'transparent', border: 0, cursor: 'pointer' }}>
              <span style={{ display: 'inline-flex', transform: advanced ? 'none' : 'rotate(-90deg)' }}><Icon name="chevron-down" size={14} /></span>
              Advanced analysis settings
            </button>
            {advanced && (
              <div style={{ display: 'grid', gap: 15, padding: '14px 12px 16px', borderTop: '1px solid var(--obs-border)' }}>
                <SegmentedControl label="Analysis mode" value={mode} onChange={setMode} options={[{ value: 'standard', label: 'Standard', description: 'Falls back honestly when the LLM is unavailable.' }, { value: 'validation', label: 'Validation', description: 'Requires live LLM-backed reasoning.' }]} />
                <CheckField checked={mode === 'validation' ? true : requireLlm} disabled={mode === 'validation'} onChange={setRequireLlm}>Require live LLM explanations</CheckField>
                <SegmentedControl label="Budget" value={budget} onChange={setBudget} options={[{ value: 'strict', label: 'Strict' }, { value: 'balanced', label: 'Balanced' }, { value: 'max_quality', label: 'Max quality' }]} />
                <SegmentedControl label="Scope" value={scope} onChange={setScope} options={[{ value: 'backend', label: 'Backend' }, { value: 'full_repo', label: 'Full repo' }]} />
                <div>
                  <span style={label}>Model override</span>
                  <TextInput placeholder="leave empty to use configured default" />
                </div>
              </div>
            )}
          </div>
          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: 18 }} disabled={!path.trim() || scanning}
            icon={scanning ? <span style={{ display: 'inline-flex', animation: 'observatory-spin 900ms linear infinite' }}><Icon name="loader-circle" size={16} /></span> : null}
            iconAfter={scanning ? null : <Icon name="arrow-right" size={16} />}
            onClick={() => setScanning(true)}>
            {scanning ? 'Starting scan' : 'Build architecture map'}
          </Button>
          <p style={{ margin: '14px 0 0', color: 'var(--obs-stone)', fontSize: 12, lineHeight: 1.45, textAlign: 'center' }}>
            The first repo orientation appears before the full architecture map. If the backend is offline, this screen will say so directly.
          </p>
        </Panel>
      </section>

      {scanning && (
        <Panel padding={22} style={{ width: 'min(920px, calc(100% - 48px))', margin: '-34px auto 48px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--obs-slate-blue)', fontSize: 13, fontWeight: 650 }}>
                <span style={{ display: 'inline-flex', animation: 'observatory-spin 900ms linear infinite' }}><Icon name="loader-circle" size={14} /></span>
                Building the architecture map
              </div>
              <h2 style={{ margin: '6px 0 0', fontSize: 20 }}>Indexing source evidence</h2>
            </div>
            <Button variant="quiet" iconAfter={<Icon name="arrow-right" size={14} />} onClick={onComplete}>Open the map</Button>
          </div>
          <ProgressMeter style={{ marginTop: 18 }} value={parsed} total={1180} caption="src/flask/blueprints.py" />
          <OrientationPanel orientation={data.orientation} compact />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 9, marginTop: 18 }}>
            {data.stages.map((s) => <StageRow key={s.label} state={s.state} label={s.label} title={s.state === 'skipped' ? 'Skipped: no live LLM credential configured.' : undefined} />)}
          </div>
          <Callout tone="warning" style={{ marginTop: 18 }} icon={<StatusBadge status="insufficient" />}>
            Semantic index was skipped: no live LLM credential is configured, so concept naming falls back to deterministic grouping.
          </Callout>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--obs-border)' }}>
            {['Configured model', 'agentic mode', 'No live LLM'].map((t) => <Chip key={t} tone="fact">{t}</Chip>)}
          </div>
        </Panel>
      )}
    </main>
  );
}

Object.assign(window, { EntryScreen, OrientationPanel });
