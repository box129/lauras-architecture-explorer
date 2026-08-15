const { Icon, Button, Chip, Callout, ThemeToggle, ProvenanceChip, SegmentedControl, TextInput, StatusBadge } = window.SyntaxTreeDesignSystem_b1a4e9;

function SurfaceRow({ on, title, detail, pending }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr)', gap: 11, padding: '11px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ display: 'inline-flex', paddingTop: 1, color: on ? 'var(--ai-accent)' : 'var(--text-muted)' }}>
        <Icon name={on ? 'sparkles' : 'circle-dot'} size={15} />
      </span>
      <span>
        <strong style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
          {title}{pending && <Chip tone="fact" style={{ height: 20, fontSize: 10.5 }}>not implemented yet</Chip>}
        </strong>
        <span style={{ display: 'block', marginTop: 3, color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.5 }}>{detail}</span>
      </span>
    </div>
  );
}

function SettingsView({ theme, onTheme }) {
  const [provider, setProvider] = React.useState('openai');
  const configured = provider !== 'none';
  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-app)' }}>
      <div style={{ width: 'min(860px, calc(100% - 48px))', margin: '0 auto', padding: '32px 0 64px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 26 }}>Settings</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>What AI touches, what it never touches, and how Laura&rsquo;s looks.</p>

        <section style={{ marginTop: 28, padding: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 12 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 4px', fontSize: 17 }}>Appearance</h2>
          <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>System follows your operating system and keeps following it. An explicit choice is remembered across sessions.</p>
          <ThemeToggle value={theme} onChange={onTheme} variant="full" />
        </section>

        <section style={{ marginTop: 20, padding: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 12 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 4px', fontSize: 17 }}>
            AI <ProvenanceChip kind="ai" />
          </h2>
          <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.55, maxWidth: 620 }}>
            Laura&rsquo;s analyses a repository completely without AI. Configuring a provider adds interpretation on the three surfaces listed below — nothing else changes.
          </p>

          <SegmentedControl label="Provider" value={provider} onChange={setProvider}
            options={[{ value: 'none', label: 'None' }, { value: 'openai', label: 'OpenAI' }, { value: 'openrouter', label: 'OpenRouter' }]} />
          <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.55, maxWidth: 620 }}>
            One provider, one key, one place. Every AI surface in Laura&rsquo;s &mdash; including Doc Studio &mdash; uses what is set here.
          </p>
          {configured && (
            <div style={{ display: 'grid', gap: 8, maxWidth: 420, marginTop: 14 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 680, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Model</span>
              <TextInput placeholder="leave empty to use the deployment default" />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginTop: 24 }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px', fontSize: 13, color: 'var(--ai-text)' }}>
                <Icon name="sparkles" size={14} />AI is used for
              </h3>
              <SurfaceRow on title="Architectural explanation" detail="Per entity, when you open one. The statements it proposes are still verified deterministically." />
              <SurfaceRow on title="Architecture group interpretation" detail="An optional name and description for a cluster whose membership is already fixed. Generated only when you click Generate." pending />
              <SurfaceRow on title="Doc Studio AI content" detail="Written passages in an exported document. Deterministic sections export with no provider configured." pending />
            </div>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px', fontSize: 13, color: 'var(--text-secondary)' }}>
                <Icon name="shield-check" size={14} />Always deterministic
              </h3>
              <SurfaceRow title="Source analysis and symbol extraction" detail="Parsing the repository into modules, classes and functions." />
              <SurfaceRow title="Relation extraction" detail="Imports, calls and inheritance, recovered from source." />
              <SurfaceRow title="Structural grouping and clustering" detail="Which modules belong together. A model never changes membership." />
              <SurfaceRow title="Evidence verification" detail="SUPPORTED / INSUFFICIENT EVIDENCE / CONTRADICTED are produced by the verifier, never by a model." />
            </div>
          </div>

          <Callout style={{ marginTop: 20 }} icon={<Icon name="info" size={15} />}>
            With no provider selected, Laura&rsquo;s still analyses, clusters and verifies in full. Only the three interpretive surfaces above are unavailable.
          </Callout>
        </section>

        <section style={{ marginTop: 20, padding: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 12 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 17 }}>Technical details</h2>
          <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: 13 }}>Run identifiers, projection versions and pipeline diagnostics. Hidden from the main product surfaces.</p>
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--action-primary)', fontSize: 13 }}>Show diagnostics for the current run</summary>
            <div style={{ display: 'grid', gap: 6, marginTop: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
              <span>run:1f7f34f034dc4674a8f395f29adb58ee</span>
              <span>projection: system-overview-architecture-map-v3</span>
              <span>overview_input_hash: 8c41…f0d2</span>
              <span>ai provider: openai · model: deployment default</span>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}

function DocStudioView() {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-app)' }}>
      <div style={{ width: 'min(860px, calc(100% - 48px))', margin: '0 auto', padding: '32px 0 64px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 26 }}>Doc Studio</h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: 14, maxWidth: 620, lineHeight: 1.6 }}>
          Assemble a document from what you have already explored. Each section keeps the provenance it had in the product — nothing is flattened into undifferentiated prose.
        </p>
        <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
          {[
            ['structure', 'Repository structure', 'Regions, sections and module counts. Deterministic.'],
            ['cluster', 'Structural clusters', 'Cluster membership and the relations that justify it. Deterministic.'],
            ['verified', 'Verified statements', 'Each statement exported with its own verdict and evidence links.'],
            ['ai', 'AI-interpreted architecture (unverified)', 'Only the interpretations you generated, under their own heading.'],
          ].map(([kind, title, detail]) => (
            <label key={title} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 10, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked={kind !== 'ai'} style={{ accentColor: 'var(--action-primary)' }} />
              <span>
                <strong style={{ display: 'block', fontSize: 14 }}>{title}</strong>
                <small style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{detail}</small>
              </span>
              <ProvenanceChip kind={kind} size="sm" />
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 20 }}>
          <Button variant="primary" icon={<Icon name="arrow-down-to-line" size={15} />}>Export document</Button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 12.5 }}>
            <span style={{ display: 'inline-flex', color: 'var(--ai-accent)' }}><Icon name="sparkles" size={13} /></span>
            AI sections use the provider set in Settings &rsaquo; AI. No separate configuration.
          </span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsView, DocStudioView, SurfaceRow });
