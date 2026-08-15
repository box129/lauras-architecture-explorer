const { Icon, Button, ThemeToggle, ProvenanceChip, StageRow, ProgressMeter } = window.SyntaxTreeDesignSystem_b1a4e9;

function Landing({ theme, onTheme, onOpenSettings, onAnalyse, analysing, stages, progress }) {
  const data = window.LaurasData;
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg-app)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, height: 56, padding: '0 28px' }}>
        <Wordmark size={16} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <ThemeToggle value={theme} onChange={onTheme} />
          <Button variant="pill" icon={<Icon name="settings" size={14} />} onClick={onOpenSettings}>Settings</Button>
        </div>
      </header>

      <main style={{ width: 'min(1080px, calc(100% - 56px))', margin: '0 auto', padding: '56px 0 72px' }}>
        <h1 style={{ margin: 0, maxWidth: 760, fontSize: 'clamp(40px, 4.6vw, 60px)', lineHeight: 1.0, fontWeight: 720, letterSpacing: '-0.015em' }}>
          Understand an unfamiliar codebase.
        </h1>
        <p style={{ maxWidth: 620, margin: '20px 0 0', color: 'var(--text-secondary)', fontSize: 17, lineHeight: 1.65 }}>
          Laura&rsquo;s reads a repository on your machine, maps how it is put together, and keeps every architectural statement attached to the exact source that supports it.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 32 }}>
          <Button variant="primary" size="lg" icon={<Icon name="folder-open" size={17} />} onClick={onAnalyse} disabled={analysing}>
            {analysing ? 'Analysing…' : 'Browse repository'}
          </Button>
          <span style={{ maxWidth: 340, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
            Source analysis runs entirely without AI. A model is optional, and only ever adds interpretation on top.
          </span>
        </div>

        {!analysing && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginTop: 52 }}>
              {[
                ['network', 'Architecture', 'See the regions a repository is actually made of, and what contains what.'],
                ['waypoints', 'Explore', 'Drill from a region into a cluster, into a module, into a single function.'],
                ['shield-check', 'Verify', 'Follow any architectural statement to the file and lines behind it.'],
              ].map(([icon, title, text]) => (
                <div key={title} style={{ padding: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 12 }}>
                  <span style={{ display: 'inline-flex', color: 'var(--action-primary)' }}><Icon name={icon} size={18} /></span>
                  <strong style={{ display: 'block', margin: '12px 0 6px', fontSize: 15 }}>{title}</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>{text}</span>
                </div>
              ))}
            </section>

            <section style={{ marginTop: 44 }}>
              <h2 style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 680, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Recent projects</h2>
              <div style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
                {data.recent.map((r) => (
                  <button key={r.path} type="button" onClick={onAnalyse}
                    style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '12px 14px', color: 'var(--text-primary)', textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 10, cursor: 'pointer' }}>
                    <Icon name="folder-open" size={15} />
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: 14 }}>{r.name}</strong>
                      <small style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{r.path}</small>
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.meta}</span>
                  </button>
                ))}
              </div>
            </section>

            <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 44, paddingTop: 22, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ minWidth: 260, flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}><ProvenanceChip kind="structure" /><ProvenanceChip kind="cluster" /><ProvenanceChip kind="verified" /></div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.55 }}>Always available. Structure, clustering and evidence verification are deterministic and never call a model.</p>
              </div>
              <div style={{ minWidth: 260, flex: 1 }}>
                <div style={{ marginBottom: 10 }}><ProvenanceChip kind="ai" /></div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.55 }}>Optional, and always something you ask for. A model can name a group and explain an entity; it never changes what the analysis found.</p>
              </div>
            </section>
          </>
        )}

        {analysing && (
          <section style={{ maxWidth: 720, marginTop: 44, padding: 22, background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Analysing {data.repo.name}</h2>
                <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{data.repo.path}</p>
              </div>
              <ExampleNotice />
            </div>
            <ProgressMeter style={{ marginTop: 20 }} label="Files read" value={progress} total={51} caption="backend/src/services/notification.service.js" />
            <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
              {stages.map((s) => <StageRow key={s.label} state={s.state} label={s.label} />)}
            </div>
            <p style={{ margin: '18px 0 0', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
              The architecture opens as soon as structure is grouped. Verification continues in the background and statements appear as they are checked.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

Object.assign(window, { Landing });
