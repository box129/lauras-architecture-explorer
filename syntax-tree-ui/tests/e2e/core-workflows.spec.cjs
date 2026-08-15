const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const RUN_ID = 'run-core-remediation';
const executablePath = installedChromiumExecutable();

test.use({
  baseURL: process.env.SYNTAX_TREE_FRONTEND_URL || 'http://127.0.0.1:5173',
  launchOptions: executablePath ? { executablePath } : {},
  viewport: { width: 1440, height: 900 },
});

function installedChromiumExecutable() {
  const declared = chromium.executablePath();
  if (fs.existsSync(declared)) return declared;
  const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(cacheRoot)) return undefined;
  const candidates = fs.readdirSync(cacheRoot).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse();
  for (const candidate of candidates) {
    for (const folder of ['chrome-win64', 'chrome-win']) {
      const executable = path.join(cacheRoot, candidate, folder, 'chrome.exe');
      if (fs.existsSync(executable)) return executable;
    }
  }
  return undefined;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ runId }) => {
    window.localStorage.setItem('syntax-tree.analysis-session.v1', JSON.stringify({
      state: {
        analysisStatus: 'completed',
        analysisJobId: 'job-core-remediation',
        analysisRunId: runId,
        analysisRepositoryPath: 'qa-audit/fixtures/demo-repo',
        analysisRunMetadata: null,
      },
      version: 0,
    }));
  }, { runId: RUN_ID });
});

test('[contract] repository docs preserve the run and expose hierarchy, dependencies, and source', async ({ page }) => {
  const requestHeaders = [];
  await installApiContract(page, requestHeaders);

  await page.goto('/docs?component=child');
  await expect(page.getByRole('heading', { name: 'Child component' })).toBeVisible();
  await expect(page.getByText('Source-backed documentation for Child component.')).toBeVisible();
  await expect(page.getByText('def child_component():')).toBeVisible();
  await expect(page.locator('.obs-docs-source .obs-code-token--keyword').filter({ hasText: 'def' })).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Repository components' })).toContainText('Root package');

  await page.getByRole('button', { name: /Root package/ }).last().click();
  await expect(page.getByRole('heading', { name: 'Root package' })).toBeVisible();
  await expect(page).toHaveURL(/component=root/);

  expect(requestHeaders.length).toBeGreaterThan(0);
  expect(requestHeaders.every((entry) => entry.runId === RUN_ID)).toBeTruthy();
});

test('[contract] query results are relevance-ranked, selectable, and retain evidence/source tabs', async ({ page }) => {
  const requestHeaders = [];
  await installApiContract(page, requestHeaders);

  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('menu', { name: 'Repository navigation' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Analyze another repository/ })).toBeVisible();
  await page.getByRole('menuitem', { name: /Repository documentation/ }).click();
  await expect(page).toHaveURL(/\/docs\?.*run=run-core-remediation/);
  await page.getByRole('button', { name: /Back to Observatory/ }).click();
  await expect(page.getByText('View architecture as accessible tables')).toBeVisible();
  await page.getByText('View architecture as accessible tables').click();
  await expect(page.locator('.obs-graph-alternative caption', { hasText: 'Architecture relationships' })).toBeVisible();
  await expect(page.getByText('dispatches')).toBeVisible();

  await page.getByRole('textbox', { name: 'Architecture question' }).fill('How does the request flow?');
  await page.getByRole('button', { name: 'Submit question' }).click();

  const ranked = page.locator('.obs-ranked-lenses__item');
  await expect(ranked).toHaveCount(5);
  await expect(ranked.first()).toContainText('Lens 5');
  await expect(ranked.first()).toHaveAttribute('aria-pressed', 'true');

  await ranked.filter({ hasText: 'Lens 2' }).click();
  await expect(page.locator('.obs-understanding-pane__header h2')).toHaveText('Lens 2');
  await expect(ranked.filter({ hasText: 'Lens 2' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Source tabs' })).toBeVisible();
  await expect(page.locator('.obs-understanding-source-tabs strong')).toHaveText('services/request.py');

  const queryRequest = requestHeaders.find((entry) => entry.path === '/api/query');
  expect(queryRequest.runId).toBe(RUN_ID);
  expect(queryRequest.body.question).toBe('How does the request flow?');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('menuitem', { name: /Analyze another repository/ }).click();
  await expect(page.getByRole('heading', { name: 'What repo do you want to understand?' })).toBeVisible();
  const persistedSession = await page.evaluate(() => JSON.parse(window.localStorage.getItem('syntax-tree.analysis-session.v1')).state);
  expect(persistedSession.analysisStatus).toBe('idle');
  expect(persistedSession.analysisRunId).toBeNull();
});

async function installApiContract(page, requestHeaders) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const entry = {
      path,
      runId: request.headers()['x-syntax-tree-run-id'],
      body: parseRequestBody(request.postData()),
    };
    requestHeaders.push(entry);

    if (path === '/api/architecture-map') return json(route, architectureMap());
    if (path === '/api/flows') return json(route, { analysis_run_id: RUN_ID, flows: [], total: 0, limit: 50, offset: 0 });
    if (path === '/api/docs/hierarchy') return json(route, docsHierarchy());
    if (path.startsWith('/api/docs/components/')) {
      return json(route, docsDetail(decodeURIComponent(path.split('/').at(-1))));
    }
    if (path === '/api/query') return json(route, queryResponse());
    return json(route, { detail: 'Not part of the focused frontend contract' }, 404);
  });
}

function parseRequestBody(body) {
  if (!body) return {};
  try { return JSON.parse(body); } catch { return {}; }
}

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function mapNode(id, label, kind, level) {
  return {
    id,
    analysis_run_id: RUN_ID,
    label,
    kind,
    level,
    description: `${label} source-backed description`,
    status: 'verified',
    confidence: 0.94,
    source_refs: { spans: [`span-${id}`] },
    evidence_count: 1,
    children_count: 0,
    can_drilldown: false,
    primary_files: [`${id}.py`],
    related_concept_ids: [],
    related_flow_ids: [],
    graph_qn: id,
    legacy_type: null,
    warnings: [],
    unsupported_reason: null,
  };
}

function architectureMap() {
  const root = mapNode('root', 'Demo repository', 'system', 0);
  const api = mapNode('api', 'API boundary', 'subsystem', 1);
  const worker = mapNode('worker', 'Request worker', 'component', 1);
  return {
    analysis_run_id: RUN_ID,
    root,
    nodes: [root, api, worker],
    edges: [{
      id: 'edge-dispatch',
      analysis_run_id: RUN_ID,
      source: 'api',
      target: 'worker',
      kind: 'calls_async',
      label: 'dispatches',
      confidence: 0.91,
      source_refs: { spans: ['span-edge'] },
    }],
    diagnostics: {
      repo_shape: 'web_app',
      projection_version: 'test-v1',
      warnings: [],
      suppressed_app_only_nodes: [],
      nodes_without_evidence: [],
      verified_node_count: 3,
      insufficient_node_count: 0,
      unsupported_node_count: 0,
    },
    metadata: { repository: { name: 'demo-repo' } },
  };
}

function docsHierarchy() {
  return {
    analysis_run_id: RUN_ID,
    repository_name: 'demo-repo',
    items: [{
      id: 'root', parent_id: null, kind: 'package', name: 'Root package', qualified_name: 'demo',
      path: 'demo/__init__.py', start_line: 1, end_line: 20, signature: null,
      children: [{
        id: 'child', parent_id: 'root', kind: 'function', name: 'Child component', qualified_name: 'demo.child_component',
        path: 'demo/child.py', start_line: 3, end_line: 8, signature: 'child_component()', children: [],
      }],
    }],
  };
}

function docsDetail(id) {
  const child = id === 'child';
  const name = child ? 'Child component' : 'Root package';
  return {
    analysis_run_id: RUN_ID,
    id,
    kind: child ? 'function' : 'package',
    name,
    qualified_name: child ? 'demo.child_component' : 'demo',
    summary: `Source-backed documentation for ${name}.`,
    documentation: `${name} is documented from the active analysis run.`,
    source: {
      path: child ? 'demo/child.py' : 'demo/__init__.py',
      language: 'python', start_line: 1, end_line: 3,
      text: child ? 'def child_component():\n    return True' : 'from .child import child_component',
    },
    dependencies: child ? [{ id: 'root', kind: 'package', name: 'Root package', path: 'demo/__init__.py' }] : [],
  };
}

function queryResponse() {
  const scores = [0.22, 0.61, 0.48, 0.73, 0.96];
  const lenses = scores.map((score, index) => questionLens(index + 1, score));
  return {
    analysis_run_id: RUN_ID,
    answer_text: 'The request crosses the API boundary and is dispatched to the worker.',
    intent: 'flow', citations: [], confidence: 0.91,
    follow_ups: ['Show the source proof.'], diagrams: [], visual_lenses: lenses,
    lens_count: lenses.length, unsupported_reasons: [], evidence_coverage: { evidence_count: lenses.length },
    conversation_id: 'conversation-core', turn_number: 1, run_metadata: { analysis_run_id: RUN_ID },
  };
}

function questionLens(number, relevance) {
  return {
    id: `lens-${number}`, analysis_run_id: RUN_ID, type: 'flow', title: `Lens ${number}`,
    status: 'verified', intent: 'flow', subject_type: 'architecture_node', subject_id: 'api',
    description: `Ranked candidate ${number}`, simple_explanation: `Simple explanation ${number}.`,
    technical_explanation: `Technical explanation ${number}.`, confidence: relevance,
    steps: [{
      id: `step-${number}`, label: 'Dispatch request', step_type: 'call', status: 'verified', confidence: relevance,
      source_span_id: 'span-request', file_path: 'services/request.py', start_line: 10, end_line: 14, gap_reason: '',
    }],
    evidence: [{
      id: `evidence-${number}`, analysis_run_id: RUN_ID, node_id: 'api', evidence_kind: 'source_span',
      source_ref_kind: 'span', source_ref_id: 'span-request', file_path: 'services/request.py', language: 'python',
      start_line: 10, end_line: 14, text_preview: 'dispatch(request)', status: 'verified', confidence: relevance,
      score: relevance, reason: 'The source calls the worker.', is_stale: false,
    }],
    source_tabs: [{
      file_path: 'services/request.py', language: 'python', role: 'request dispatch',
      summary: 'Dispatch implementation', reason: 'Direct source proof', source_span_ids: ['span-request'],
      highlights: [{ span_id: 'span-request', start_line: 10, end_line: 14, status: 'verified', confidence: relevance }],
      is_stale: false,
    }],
    related_architecture_node_ids: ['api'], related_concept_ids: [], related_flow_ids: [], gaps: [],
    searched_areas: ['services/request.py'], unsupported_reason: '', metadata: { relevance_score: relevance },
  };
}
