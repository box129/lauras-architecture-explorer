const { test, expect, chromium, firefox, webkit } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const repositoryPath = process.env.SYNTAX_TREE_E2E_REPOSITORY
  || path.join(workspaceRoot, 'qa-audit', 'phase-2', 'fixtures', 'typescript-small');
const alternateRepositoryPath = path.join(workspaceRoot, 'qa-audit', 'phase-2', 'fixtures', 'python-nested');
const requestedBrowser = process.env.SYNTAX_TREE_E2E_BROWSER || 'chromium';
const executablePath = installedBrowserExecutable(requestedBrowser);

test.use({
  baseURL: process.env.SYNTAX_TREE_FRONTEND_URL || 'http://127.0.0.1:5173',
  launchOptions: executablePath ? { executablePath } : {},
  viewport: { width: 1440, height: 900 },
});

test('[real backend] analysis, graph, docs, query, switching, and recovery use repository data', async ({ page }) => {
  test.setTimeout(240_000);
  expect(fs.existsSync(repositoryPath), `Repository fixture does not exist: ${repositoryPath}`).toBeTruthy();

  const evidence = { apiResponses: [], consoleErrors: [], consoleMessages: [], failedRequests: [], pageErrors: [], websocketEvents: [] };
  // Chromium cancels in-flight subresource requests belonging to the outgoing document the
  // instant a navigation commits (net::ERR_ABORTED); this is unavoidable, benign browser
  // behavior, not an application defect. `navigating` is only ever true while THIS test itself
  // is awaiting a goto/reload it triggered (see navigate() below), so this narrowly excludes
  // exactly that proven cancellation condition -- an ERR_ABORTED coinciding with a navigation
  // this test caused -- while still recording every other failed/aborted request verbatim.
  let navigating = false;
  const navigate = async (action) => {
    navigating = true;
    try {
      await action();
    } finally {
      navigating = false;
    }
  };
  page.on('console', (message) => {
    const text = sanitizeText(message.text());
    evidence.consoleMessages.push({ type: message.type(), text });
    if (message.type() === 'error') evidence.consoleErrors.push(text);
  });
  page.on('pageerror', (error) => evidence.pageErrors.push(sanitizeText(String(error))));
  page.on('requestfailed', (request) => {
    if (navigating && request.failure()?.errorText === 'net::ERR_ABORTED') return;
    evidence.failedRequests.push(`${request.method()} ${safeRequestPath(request.url())}`);
  });
  page.on('response', (response) => {
    const request = response.request();
    if (response.url().includes('/api/')) {
      evidence.apiResponses.push({ method: request.method(), path: safeRequestPath(response.url()), status: response.status() });
    }
  });

  page.on('websocket', (socket) => {
    if (!socket.url().includes('/api/ws/analyze/')) return;
    socket.on('framereceived', (frame) => {
      try {
        const packet = JSON.parse(frame.payload);
        if (packet?.event) evidence.websocketEvents.push(packet.event);
      } catch {
        evidence.websocketEvents.push('malformed');
      }
    });
  });

  await navigate(() => page.goto('/'));
  await page.evaluate(() => window.localStorage.removeItem('syntax-tree.analysis-session.v1'));
  await navigate(() => page.reload());

  const startResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith('/api/analyze') && response.request().method() === 'POST',
  );
  await page.getByRole('textbox', { name: 'Repository path' }).fill(repositoryPath);
  await page.getByRole('button', { name: 'Build architecture map' }).click();
  const startResponse = await startResponsePromise;
  expect(startResponse.status(), 'POST /api/analyze must accept the repository before WebSocket checks begin.').toBe(200);
  const startedRun = await startResponse.json();
  expect(startedRun.job_id).toBeTruthy();
  expect(startedRun.run_id).toBeTruthy();

  const architectureResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/architecture-map') && response.request().method() === 'GET',
    { timeout: 180_000 },
  );

  await expect.poll(
    () => evidence.websocketEvents,
    { timeout: 180_000, message: 'The real analysis WebSocket should complete the pipeline.' },
  ).toContain('pipeline_complete');

  const architectureResponse = await architectureResponsePromise;
  expect(architectureResponse.status()).toBe(200);
  const architecture = await architectureResponse.json();
  expect(architecture.analysis_run_id).toBe(startedRun.run_id);
  expect(architecture.nodes.length).toBeGreaterThan(1);
  expect(architecture.edges.length).toBeGreaterThan(0);
  expect(
    architecture.nodes.some((node) => (node.primary_files || []).some((file) => /src\//.test(file.replaceAll('\\', '/')))),
  ).toBeTruthy();

  await expect(page.locator('.react-flow__node')).not.toHaveCount(0, { timeout: 30_000 });
  const visibleLabels = architecture.nodes.filter((node) => node.id !== architecture.root.id).map((node) => node.label);
  await expect(page.getByText(visibleLabels[0], { exact: true }).first()).toBeVisible();

  const viewportBeforeZoom = await viewportTransform(page);
  await page.locator('.react-flow__controls-zoomin').click();
  await expect.poll(() => viewportTransform(page), { timeout: 10_000 }).not.toBe(viewportBeforeZoom);
  const viewportBeforePan = await viewportTransform(page);
  const pane = page.locator('.react-flow__pane');
  const paneBox = await pane.boundingBox();
  expect(paneBox, 'The rendered graph must expose an interactive canvas pane.').not.toBeNull();
  await page.mouse.move(paneBox.x + 24, paneBox.y + 24);
  await page.mouse.down();
  await page.mouse.move(paneBox.x + 110, paneBox.y + 80, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => viewportTransform(page), { timeout: 10_000 }).not.toBe(viewportBeforePan);

  const drilldownNode = architecture.nodes.find((node) => node.id !== architecture.root.id && node.can_drilldown && node.children_count > 0);
  expect(drilldownNode, 'The source-derived graph must contain a navigable component.').toBeTruthy();

  // The frontend's lensCache.ts getArchitectureChildren() fetches exactly
  // `${API_BASE}/architecture-map/nodes/${encodeURIComponent(nodeId)}/children` (see
  // syntax-tree-ui/src/api/client.ts API_BASE and lensCache.ts encodeNodeId) and caches the
  // promise per run+node id. The Alt-click below hovers this same node on its way in, which
  // warms that cache (ObservatoryShell.tsx onHoverNode -> prefetchArchitectureChildren), so the
  // drilldown click can render from the warmed cache without issuing a second request. Both
  // clicks below target drilldownNode specifically -- not a separately chosen "any node" -- and
  // the listener is scoped to drilldownNode's own encoded endpoint so it cannot resolve on a
  // different node's response, and is registered before the Alt-click so it reliably observes
  // whichever single request actually happens for this node.
  const drilldownChildrenPath = `/api/architecture-map/nodes/${encodeURIComponent(drilldownNode.id)}/children`;
  const childrenResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith(drilldownChildrenPath) && response.request().method() === 'GET',
  );
  const drilldownNodeElement = page.locator('.react-flow__node').filter({ hasText: drilldownNode.label }).first();
  await drilldownNodeElement.click({ modifiers: ['Alt'] });
  await expect(page.locator('.obs-voice__header h2')).toHaveText(drilldownNode.label);

  await drilldownNodeElement.click();
  const childrenResponse = await childrenResponsePromise;
  expect(childrenResponse.status()).toBe(200);
  const children = await childrenResponse.json();
  expect(children.analysis_run_id).toBe(architecture.analysis_run_id);
  expect(children.node_id).toBe(drilldownNode.id);
  expect(children.children.length).toBeGreaterThan(0);
  await expect(page.locator('.obs-focal-header strong')).toHaveText(drilldownNode.label);
  const firstChildSymbol = children.children[0];
  await expect(page.locator('.react-flow__node').filter({ hasText: firstChildSymbol.label }).first()).toBeVisible();
  const breadcrumb = page.getByRole('navigation', { name: 'Architecture breadcrumb' });
  await expect(breadcrumb).toContainText(drilldownNode.label);
  await page.getByRole('button', { name: 'Back to previous architecture lens' }).click();
  await expect(page.locator('.obs-focal-header')).toHaveCount(0);
  // Regression for the stale apiPathNodes bug (useArchitectureLens.ts): the breadcrumb must
  // drop the drilled component together with the lens, not just the focal header/graph/URL.
  await expect(breadcrumb).not.toContainText(drilldownNode.label);
  await expect(breadcrumb).toHaveText(architecture.root.label);

  const hierarchyResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/docs/hierarchy') && response.request().method() === 'GET',
  );
  const detailResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/docs/components/') && response.request().method() === 'GET',
  );
  await navigate(() => page.goto('/docs'));
  const hierarchyResponse = await hierarchyResponsePromise;
  expect(hierarchyResponse.status()).toBe(200);
  const hierarchy = await hierarchyResponse.json();
  expect(hierarchy.analysis_run_id).toBe(architecture.analysis_run_id);
  expect(hierarchy.items.length).toBeGreaterThan(0);

  const detailResponse = await detailResponsePromise;
  expect(detailResponse.status()).toBe(200);
  const detail = await detailResponse.json();
  expect(detail.analysis_run_id).toBe(architecture.analysis_run_id);
  expect(detail.source.path).toBeTruthy();
  await expect(page.locator('.obs-docs-detail__header h2')).toHaveText(detail.name);
  await expect(page.locator('.obs-docs-source')).toContainText(detail.source.text.slice(0, 20));
  expect(new URL(page.url()).searchParams.get('component')).toBe(detail.id);
  await navigate(() => page.reload());
  await expect(page.locator('.obs-docs-detail__header h2')).toHaveText(detail.name, { timeout: 30_000 });
  await expect(page.locator('.obs-docs-source')).toContainText(detail.source.text.slice(0, 20));

  await page.getByRole('button', { name: /Back to Observatory/ }).click();
  await expect(page.getByRole('textbox', { name: 'Architecture question' })).toBeVisible();
  const queryResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/query') && response.request().method() === 'POST',
  );
  await page.getByRole('textbox', { name: 'Architecture question' }).fill('Where is documentation generated and which source files prove it?');
  await page.getByRole('button', { name: 'Submit question' }).click();
  const queryResponse = await queryResponsePromise;
  expect(queryResponse.status()).toBe(200);
  const query = await queryResponse.json();
  expect(query.analysis_run_id).toBe(architecture.analysis_run_id);
  expect(query.visual_lenses.length).toBeGreaterThan(0);
  await expect(page.locator('.obs-ranked-lenses__item')).toHaveCount(Math.min(10, query.visual_lenses.length));

  const documentationLens = query.visual_lenses.find((lens) => /generateDocumentation|src[\\/]docs\.ts/i.test(JSON.stringify(lens)));
  expect(documentationLens, 'The ranked answer must include the fixture documentation generator or src/docs.ts.').toBeTruthy();
  const documentationResult = page.locator('.obs-ranked-lenses__item').filter({ hasText: documentationLens.title }).first();
  await documentationResult.click();
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  const evidenceSection = page.locator('.obs-understanding-section');
  await expect(evidenceSection).toContainText(/generateDocumentation|src[\\/]docs\.ts/i);
  // The main canvas header (QuestionLensCanvas.tsx) also renders a "View answer proof"
  // shortcut for the same lens, alongside this Evidence-tab control (UnderstandingPane.tsx) --
  // both call the identical onOpenProof(questionLensProofSelection(lens)) handler, so this is
  // intentional split-pane redundancy, not a duplicate-effect defect. Scoping to the Evidence
  // section already asserted against above targets the control this workflow means to exercise.
  await evidenceSection.getByRole('button', { name: /View answer proof/ }).click();
  await expect(page.locator('[aria-label="Code Companion"]')).toContainText(/generateDocumentation|docs\.ts/i);

  const activeLensTitle = documentationLens.title;
  await navigate(() => page.reload());
  await expect(page.locator('.obs-understanding-pane__header h2')).toHaveText(activeLensTitle, { timeout: 30_000 });
  const persistedRun = await page.evaluate(() => {
    const raw = window.localStorage.getItem('syntax-tree.analysis-session.v1');
    return raw ? JSON.parse(raw).state.analysisRunId : null;
  });
  expect(persistedRun).toBe(architecture.analysis_run_id);

  await page.getByRole('button', { name: 'Close answer' }).click();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('menuitem', { name: /Analyze another repository/ }).click();
  await expect(page.getByRole('textbox', { name: 'Repository path' })).toBeVisible();

  const alternateEventsStart = evidence.websocketEvents.length;
  const alternateStartPromise = page.waitForResponse(
    (response) => response.url().endsWith('/api/analyze') && response.request().method() === 'POST',
  );
  await page.getByRole('textbox', { name: 'Repository path' }).fill(alternateRepositoryPath);
  await page.getByRole('button', { name: 'Build architecture map' }).click();
  const alternateStart = await alternateStartPromise;
  expect(alternateStart.status()).toBe(200);
  const alternateRun = await alternateStart.json();
  expect(alternateRun.run_id).not.toBe(startedRun.run_id);
  const alternateArchitecturePromise = page.waitForResponse(
    (response) => response.url().includes('/api/architecture-map') && response.request().method() === 'GET',
    { timeout: 180_000 },
  );
  await expect.poll(
    () => evidence.websocketEvents.slice(alternateEventsStart),
    { timeout: 180_000, message: 'The replacement repository should receive its own completed WebSocket pipeline.' },
  ).toContain('pipeline_complete');
  const alternateArchitectureResponse = await alternateArchitecturePromise;
  expect(alternateArchitectureResponse.status()).toBe(200);
  const alternateArchitecture = await alternateArchitectureResponse.json();
  expect(alternateArchitecture.analysis_run_id).toBe(alternateRun.run_id);
  expect(alternateArchitecture.nodes.some((node) => (node.primary_files || []).some((file) => file.endsWith('.py')))).toBeTruthy();
  await expect(page.locator('.react-flow__node').filter({ hasText: /docs\.ts/ })).toHaveCount(0);

  writeBrowserEvidence({
    alternateRunId: alternateRun.run_id,
    alternateGraph: { nodes: alternateArchitecture.nodes.length, edges: alternateArchitecture.edges.length },
    evidence,
    firstRunId: startedRun.run_id,
    firstGraph: { nodes: architecture.nodes.length, edges: architecture.edges.length },
  });
  await page.screenshot({ path: screenshotPath(), fullPage: true });

  expect(evidence.pageErrors).toEqual([]);
  expect(evidence.websocketEvents).toContain('status_update');
  expect(evidence.consoleErrors.filter((message) => /404|websocket.*failed/i.test(message))).toEqual([]);
  expect(evidence.failedRequests).toEqual([]);
});

async function viewportTransform(page) {
  return page.locator('.react-flow__viewport').evaluate((element) => element.getAttribute('style') || '');
}

function safeRequestPath(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return sanitizeText(value);
  }
}

function sanitizeText(value) {
  const workspaceVariants = [workspaceRoot, workspaceRoot.replaceAll('\\', '/')];
  return workspaceVariants.reduce((text, workspace) => text.replaceAll(workspace, '<workspace>'), String(value));
}

function screenshotPath() {
  const directory = path.join(workspaceRoot, 'qa-audit', 'core-remediation', 'screenshots');
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, `principal-real-${requestedBrowser}.png`);
}

function writeBrowserEvidence(result) {
  const directory = path.join(workspaceRoot, 'qa-audit', 'core-remediation', 'logs');
  fs.mkdirSync(directory, { recursive: true });
  const compactEvidence = {
    ...result.evidence,
    apiResponses: result.evidence.apiResponses.slice(-80),
    consoleMessages: result.evidence.consoleMessages.slice(-80),
  };
  fs.writeFileSync(
    path.join(directory, `playwright-principal-real-${requestedBrowser}.json`),
    `${JSON.stringify({
      browser: requestedBrowser,
      fixtures: [path.relative(workspaceRoot, repositoryPath).replaceAll('\\', '/'), path.relative(workspaceRoot, alternateRepositoryPath).replaceAll('\\', '/')],
      firstRunId: result.firstRunId,
      firstGraph: result.firstGraph,
      alternateRunId: result.alternateRunId,
      alternateGraph: result.alternateGraph,
      evidence: compactEvidence,
    }, null, 2)}\n`,
  );
}

function installedBrowserExecutable(browserName) {
  const browserType = { chromium, firefox, webkit }[browserName];
  if (!browserType) return undefined;
  const declared = browserType.executablePath();
  if (fs.existsSync(declared)) return declared;

  const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(cacheRoot)) return undefined;
  const candidates = fs.readdirSync(cacheRoot)
    .filter((name) => new RegExp(`^${browserName}-\\d+$`).test(name))
    .sort()
    .reverse();
  const executableNames = browserName === 'chromium'
    ? [['chrome-win64', 'chrome.exe'], ['chrome-win', 'chrome.exe']]
    : browserName === 'firefox'
      ? [['firefox', 'firefox.exe']]
      : [['Playwright.exe'], ['pw_run.exe']];
  for (const candidate of candidates) {
    for (const parts of executableNames) {
      const executable = path.join(cacheRoot, candidate, ...parts);
      if (fs.existsSync(executable)) return executable;
    }
  }
  return undefined;
}
