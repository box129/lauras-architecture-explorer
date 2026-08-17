const { Icon, Button, IconButton, Chip, Callout, StatusBadge, ProvenanceChip, AIInterpretationCard, StatementCard, StructuralRegion, ClusterCard, ArchitectureTree } = window.SyntaxTreeDesignSystem_b1a4e9;

/* ── State 1 — Overview ────────────────────────────────────────── */

function Overview({ state, actions }) {
  const data = window.LaurasData;
  const { expanded, selected, ai } = state;
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '18px 22px 112px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{data.repo.modules} source modules</strong>
          <span style={{ color: 'var(--text-muted)' }}> · {data.repo.regions} top-level region · {data.repo.sections} repository sections · {data.repo.clusters} structural clusters</span>
        </p>
        <ExampleNotice />
      </div>

      <StructuralRegion path="backend" moduleCount={51} expanded={expanded.backend !== false} onToggle={() => actions.toggle('backend')} onEnter={() => actions.enterRegion({ id: 'backend', path: 'backend', modules: 51 })}>
        {data.regions.map((region) => (
          region.clustered ? (
            <StructuralRegion key={region.id} depth={1} path={region.path} moduleCount={region.modules}
              expanded={expanded[region.id] !== false} onToggle={() => actions.toggle(region.id)} onEnter={() => actions.enterRegion(region)}
              selected={selected && selected.id === region.id}>
              <p style={{ margin: '0 0 2px', color: 'var(--text-muted)', fontSize: 12.5 }}>50 modules · 5 structural clusters · 24 ungrouped</p>
              {data.clusters.slice(0, 2).map((cluster) => (
                <ClusterCard key={cluster.id} label={cluster.label} memberCount={cluster.modules} relationCount={cluster.relations} members={cluster.members}
                  selected={selected && selected.id === cluster.id}
                  onEnter={() => actions.enterCluster(cluster)}
                  onOpenBasis={() => actions.selectCluster(cluster, 'basis')}
                  aiSlot={<AIInterpretationCard
                    state={ai[cluster.id] || (cluster.ai ? 'available' : 'unavailable')}
                    name={cluster.ai && cluster.ai.name} description={cluster.ai && cluster.ai.description}
                    groundTruth={cluster.label + ' · ' + cluster.modules + ' modules, grouped by ' + cluster.relations + ' real relations'}
                    generatedAt={ai[cluster.id] === 'generated' ? 'cached from this run' : undefined}
                    onGenerate={() => actions.generate(cluster.id)}
                    onRegenerate={() => actions.generate(cluster.id, true)} />} />
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
                {data.clusters.slice(2).map((cluster) => (
                  <button key={cluster.id} type="button" onClick={() => actions.enterCluster(cluster)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', color: 'var(--text-primary)', textAlign: 'left', background: 'var(--structural-cluster-bg)', border: '1px solid var(--structural-cluster-border)', borderRadius: 6, cursor: 'pointer' }}>
                    <span style={{ color: 'var(--structural-cluster-accent)', display: 'inline-flex' }}><Icon name="waypoints" size={14} /></span>
                    <span style={{ fontSize: 13 }}>{cluster.label}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>{cluster.modules}</span>
                  </button>
                ))}
              </div>
              <UngroupedBucket count={data.residual.modules} members={data.residual.members} />
            </StructuralRegion>
          ) : (
            <CollapsedRegion key={region.id} region={region} expanded={expanded[region.id] === true}
              onToggle={() => actions.toggle(region.id, true)} onEnter={() => actions.enterRegion(region)} />
          )
        ))}
      </StructuralRegion>
    </div>
  );
}

/** Residual bucket. Collapsed by default, neutral weight — reported, not promoted to a cluster. */
function UngroupedBucket({ count, members }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ background: 'transparent', border: '1px dashed var(--border-default2)', borderRadius: 8 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 12px', color: 'var(--text-muted)', textAlign: 'left', background: 'transparent', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 12.5 }}>
        <span style={{ display: 'inline-flex', transform: open ? 'none' : 'rotate(-90deg)' }}><Icon name="chevron-down" size={13} /></span>
        <span style={{ color: 'var(--text-secondary)' }}>Ungrouped &middot; {count} modules</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>no relation to any cluster in this run</span>
        <span style={{ marginLeft: 'auto', flex: 'none', color: 'var(--action-primary)' }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px 34px' }}>
          <p style={{ margin: '0 0 8px', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5, maxWidth: 620 }}>
            These modules were analysed. Nothing was found connecting them to the modules in any cluster, so they are listed rather than grouped. This is a result, not an error.
          </p>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', margin: 0, padding: 0, listStyle: 'none', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
            {members.map((m) => <li key={m}>{m}</li>)}
            {count > members.length && <li style={{ color: 'var(--text-muted)' }}>+{count - members.length} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function CollapsedRegion({ region, expanded, onToggle, onEnter }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <button type="button" aria-expanded={expanded} onClick={onToggle} style={{ display: 'flex', flex: '1 1 auto', alignItems: 'center', gap: 9, minWidth: 0, padding: 0, color: 'var(--text-primary)', background: 'transparent', border: 0, cursor: 'pointer' }}>
          <span style={{ display: 'inline-flex', color: 'var(--text-muted)', transform: expanded ? 'none' : 'rotate(-90deg)' }}><Icon name="chevron-down" size={14} /></span>
          <Icon name="folder-tree" size={14} />
          <span style={{ overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: 13, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{region.path}</span>
        </button>
        <span style={{ flex: 'none', color: 'var(--text-muted)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{region.modules} modules</span>
        <ProvenanceChip kind="structure" size="sm" style={{ flex: 'none' }} />
        <button type="button" onClick={onEnter} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', color: 'var(--action-primary)', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, flex: 'none', whiteSpace: 'nowrap' }}>Enter<Icon name="arrow-right" size={12} /></button>
      </div>
      {expanded && (
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', margin: 0, padding: '0 12px 12px 45px', listStyle: 'none', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
          {(region.members || []).map((m) => <li key={m}>{m}</li>)}
          {region.modules > (region.members || []).length && <li style={{ color: 'var(--text-muted)' }}>+{region.modules - (region.members || []).length} more</li>}
        </ul>
      )}
    </div>
  );
}

/* ── State 2 — Group drill-down ────────────────────────────────── */

function GroupView({ group, onEnterEntity }) {
  const members = group.members || [];
  const basis = group.basis || [];
  const sections = group.sections || null;
  const clusters = group.clustered ? window.LaurasData.clusters : null;
  const residual = group.clustered ? window.LaurasData.residual : null;
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '18px 22px 112px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <ProvenanceChip kind={group.kind === 'cluster' ? 'cluster' : 'structure'} />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{group.modules} modules{group.relations != null ? ' · ' + group.relations + ' internal relations' : ''}</span>
        <ExampleNotice />
      </div>

      {clusters && (
        <div style={{ display: 'grid', gap: 12, padding: 20, background: 'var(--structural-container-bg)', border: '1.5px solid var(--structural-container-border)', borderRadius: 12 }}>
          {clusters.map((cluster) => (
            <ClusterCard key={cluster.id} label={cluster.label} memberCount={cluster.modules} relationCount={cluster.relations}
              members={cluster.members} onEnter={() => onEnterEntity({ ...cluster, kind: 'cluster', path: cluster.label })} />
          ))}
          <UngroupedBucket count={residual.modules} members={residual.members} />
        </div>
      )}
      {!clusters && (
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, padding: 20, background: 'var(--structural-container-bg)', border: '1.5px solid var(--structural-container-border)', borderRadius: 12 }}>
        {sections && sections.map((section) => (
          <button key={section.id} type="button" onClick={() => onEnterEntity(section)}
            style={{ display: 'grid', gap: 8, padding: 14, textAlign: 'left', color: 'var(--text-primary)', background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 10, boxShadow: 'var(--shadow-node)', cursor: 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Icon name="folder-tree" size={15} />
              <span style={{ overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: 12.5, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{section.path}</span>
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{section.modules} modules{section.clustered ? ' · 5 structural clusters' : ''}</span>
            <ProvenanceChip kind="structure" size="sm" style={{ justifySelf: 'start' }} />
          </button>
        ))}
        {!sections && members.map((member) => {
          const out = basis.filter((b) => b[0] === member);
          return (
            <button key={member} type="button" onClick={() => onEnterEntity(member)}
              style={{ display: 'grid', gap: 8, padding: 14, textAlign: 'left', color: 'var(--text-primary)', background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 10, boxShadow: 'var(--shadow-node)', cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="file-code-2" size={15} />
                <span style={{ overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: 12.5, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member}</span>
              </span>
              {out.length > 0 ? out.map((b) => (
                <span key={b[2]} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11.5 }}>
                  <Icon name="arrow-right" size={11} /><em style={{ fontStyle: 'normal', color: 'var(--structural-cluster-accent)' }}>{b[1]}</em>
                  <span style={{ overflow: 'hidden', fontFamily: 'var(--font-mono)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b[2]}</span>
                </span>
              )) : <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>no outgoing relation inside this group</span>}
            </button>
          );
        })}
      </div>
      )}

      <p style={{ margin: '14px 0 0', color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.5, maxWidth: 640 }}>
        {clusters
          ? 'These clusters come from real import and call relations between the modules in this section. Files nothing connects are listed, not clustered.'
          : sections
          ? 'This region contains sections rather than modules. Open one to see the modules inside it and how they relate.'
          : 'Only relations between modules that are visible here are drawn. Anything reaching outside this group is shown on the module itself, one level down.'}
      </p>
    </div>
  );
}

/* ── State 3 — Entity focus ────────────────────────────────────── */

/** INVARIANT: breadcrumb current entity === centred entity === contextual-panel entity.
    The caller passes one entity object; nothing here reaches for a different one. */
function EntityView({ entity, onOpenStatement, selectedStatement }) {
  const column = (title, items, direction) => (
    <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
      <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: 11, fontWeight: 680, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</h3>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'grid', gap: 5, padding: '11px 13px', background: 'var(--bg-surface)', border: '1px solid var(--border-default2)', borderRadius: 9 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <Icon name="file-code-2" size={13} />{item.label}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11.5 }}>
            <Icon name={direction === 'in' ? 'arrow-right' : 'arrow-right'} size={11} />{item.relation} · {item.group}
          </span>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '18px 22px 112px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>in {entity.ancestry.join('  ›  ')}</span>
        <ExampleNotice />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(240px, 1.2fr) minmax(180px, 1fr)', gap: 22, alignItems: 'start' }}>
        {column('Depended on by', entity.dependents, 'in')}
        <div style={{ display: 'grid', gap: 12, padding: 20, background: 'var(--bg-surface)', border: '1.5px solid var(--focus-ring)', borderRadius: 12, boxShadow: 'var(--shadow-selected)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name="file-code-2" size={18} />
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>{entity.label}</strong>
          </span>
          <span style={{ display: 'flex', gap: 8 }}><ProvenanceChip kind="structure" size="sm" label="Module" /><ProvenanceChip kind="cluster" size="sm" label="Cluster 1" /></span>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
            {entity.dependents.length === 1 ? '1 module depends on this' : entity.dependents.length + ' modules depend on this'}; it depends on {entity.dependencies.length}.
          </p>
        </div>
        {column('Depends on', entity.dependencies, 'out')}
      </div>

      <section style={{ marginTop: 30 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, whiteSpace: 'nowrap' }}>Architectural statements</h3>
          <ProvenanceChip kind="verified" />
          <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{entity.statements.length} statements from this run</span>
        </div>
        {entity.statements.length === 0 && (
          <Callout icon={<Icon name="info" size={14} />} style={{ maxWidth: 820 }}>
            No architectural statements were produced for this module in this run.
          </Callout>
        )}
        <div style={{ display: 'grid', gap: 10, maxWidth: 820 }}>
          {entity.statements.map((s) => (
            <StatementCard key={s.id} statement={s.statement} status={s.status} relation={s.relation} evidenceCount={s.evidenceCount}
              selected={selectedStatement && selectedStatement.id === s.id}
              onOpenEvidence={() => onOpenStatement(s)} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── State 4 — Evidence + source ───────────────────────────────── */

/** INVARIANT: displayed statement === selected evidence === highlighted source.
    The chain is looked up by statement id and the source pane renders the ACTIVE item. */
function EvidenceView({ statement, activeEvidence, onSelectEvidence }) {
  const chain = window.LaurasData.evidenceByStatement[statement.id] || [];
  const src = chain.find((c) => c.id === activeEvidence) || chain[0] || null;
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
        <StatementCard statement={statement.statement} status={statement.status} relation={statement.relation} evidenceCount={statement.evidenceCount} style={{ maxWidth: 860 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', minHeight: 0 }}>
        <div style={{ minHeight: 0, overflow: 'auto', padding: '16px 18px', borderRight: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 680, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Evidence chain</h3>
          <ol style={{ display: 'grid', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
            {chain.map((item, index) => {
              const active = activeEvidence === item.id;
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => onSelectEvidence(item.id)}
                    style={{ display: 'grid', gap: 6, width: '100%', padding: '11px 12px', textAlign: 'left', color: 'var(--text-primary)', background: active ? 'var(--action-ghost-hover)' : 'var(--bg-surface)', border: '1px solid ' + (active ? 'var(--focus-ring)' : 'var(--border-default2)'), borderRadius: 9, cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'inline-grid', placeItems: 'center', width: 18, height: 18, color: 'var(--text-muted)', border: '1px solid var(--border-default2)', borderRadius: 999, fontSize: 10.5 }}>{index + 1}</span>
                      <ProvenanceChip kind="evidence" size="sm" label={item.kind} />
                    </span>
                    <span style={{ overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: 11.5, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.filePath.split('/').pop()}:{item.highlightFrom}{item.highlightTo > item.highlightFrom ? '-' + item.highlightTo : ''}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.45 }}>{item.reason}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {statement.status === 'insufficient_evidence' && (
            <Callout style={{ marginTop: 14 }} icon={<StatusBadge status="insufficient" />}>
              Nothing in this run supports or contradicts this statement. It stays listed, unproven, rather than being dropped.
            </Callout>
          )}
        </div>
        {src ? <SourcePane src={src} /> : (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40, background: 'var(--bg-code)' }}>
            <p style={{ margin: 0, maxWidth: 340, color: 'var(--text-oncode-dim)', fontSize: 13, lineHeight: 1.6, textAlign: 'center' }}>No source is shown because no evidence was found for this statement.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SourcePane({ src }) {
  const counter = src.kind === 'counter-evidence';
  const edge = counter ? 'var(--evidence-counter-highlight-edge)' : 'var(--evidence-highlight-edge)';
  const band = counter ? 'var(--evidence-counter-highlight)' : 'var(--evidence-highlight)';
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr)', gridTemplateColumns: 'minmax(0,1fr)', minWidth: 0, minHeight: 0, background: 'var(--bg-code)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, padding: '10px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default2)' }}>
        <Icon name="file-code-2" size={15} />
        <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: 12.5, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.path || src.filePath}</span>
        <Chip tone="fact" style={{ flex: 'none', fontFamily: 'var(--font-mono)' }}>{src.highlightFrom === src.highlightTo ? 'line ' + src.highlightFrom : 'lines ' + src.highlightFrom + '–' + src.highlightTo}</Chip>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', flex: 'none' }}>
          <span style={{ flex: 'none', width: 12, height: 12, background: band, borderLeft: '2px solid ' + edge }} />{counter ? 'counter-evidence' : 'supporting lines'}
        </span>
      </div>
      <pre style={{ margin: 0, minWidth: 0, minHeight: 0, overflow: 'auto', padding: '14px 0', color: 'var(--text-oncode)', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.7 }}>
        {src.lines.map((line, index) => {
          const number = src.startLine + index;
          const hot = number >= src.highlightFrom && number <= src.highlightTo;
          return (
            <div key={number} style={{ display: 'grid', gridTemplateColumns: '58px minmax(0,1fr)', gap: 12, padding: '0 16px', background: hot ? band : 'transparent', boxShadow: hot ? 'inset 3px 0 0 ' + edge : 'none' }}>
              <span style={{ color: 'var(--text-oncode-dim)', textAlign: 'right' }}>{number}</span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{line || ' '}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

Object.assign(window, { UngroupedBucket, Overview, GroupView, EntityView, EvidenceView, SourcePane, CollapsedRegion });
