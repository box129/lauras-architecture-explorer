const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function installedChromiumExecutable() {
  const declared = chromium.executablePath();
  if (fs.existsSync(declared)) return declared;
  const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(cacheRoot)) return undefined;
  const candidates = fs.readdirSync(cacheRoot)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort()
    .reverse();
  for (const candidate of candidates) {
    const executable = path.join(cacheRoot, candidate, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(executable)) return executable;
  }
  return undefined;
}

const executablePath = installedChromiumExecutable();
test.use({
  baseURL: process.env.SYNTAX_TREE_FRONTEND_URL || 'http://127.0.0.1:5173',
  launchOptions: executablePath ? { executablePath } : {},
  viewport: { width: 1440, height: 900 },
});

test('valid repository completes over the analysis WebSocket without a 404', async ({ page, context }) => {
  const repositoryPath = process.env.SYNTAX_TREE_E2E_REPOSITORY;
  expect(repositoryPath, 'SYNTAX_TREE_E2E_REPOSITORY must name a valid local repository').toBeTruthy();

  const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
  const screenshotDir = path.join(workspaceRoot, 'qa-audit', 'screenshots');
  const traceDir = path.join(workspaceRoot, 'qa-audit', 'traces');
  const logDir = path.join(workspaceRoot, 'qa-audit', 'logs');
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(traceDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  const evidence = {
    console: [],
    pageErrors: [],
    websocket: { created: 0, handshakeStatuses: [], events: [], closed: 0 },
  };
  page.on('console', (message) => evidence.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => evidence.pageErrors.push(String(error)));

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const analysisSockets = new Set();
  cdp.on('Network.webSocketCreated', ({ requestId, url }) => {
    if (url.includes('/api/ws/analyze/')) {
      analysisSockets.add(requestId);
      evidence.websocket.created += 1;
    }
  });
  cdp.on('Network.webSocketHandshakeResponseReceived', ({ requestId, response }) => {
    if (analysisSockets.has(requestId)) evidence.websocket.handshakeStatuses.push(response.status);
  });
  cdp.on('Network.webSocketFrameReceived', ({ requestId, response }) => {
    if (!analysisSockets.has(requestId)) return;
    try {
      const packet = JSON.parse(response.payloadData);
      if (typeof packet.event === 'string') evidence.websocket.events.push(packet.event);
    } catch {
      evidence.websocket.events.push('malformed');
    }
  });
  cdp.on('Network.webSocketClosed', ({ requestId }) => {
    if (analysisSockets.has(requestId)) evidence.websocket.closed += 1;
  });

  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('#observatory-repo-path').fill(repositoryPath);
  await page.getByRole('button', { name: 'Build architecture map' }).click();
  await expect(page.getByText('Orientation ready')).toBeVisible({ timeout: 120_000 });
  await expect.poll(
    () => evidence.websocket.events,
    { timeout: 120_000, message: 'analysis WebSocket should deliver its completion event' },
  ).toContain('pipeline_complete');

  await page.screenshot({
    path: path.join(screenshotDir, 'remediation-websocket-complete.png'),
    fullPage: true,
  });
  await context.tracing.stop({ path: path.join(traceDir, 'remediation-websocket-trace.zip') });
  fs.writeFileSync(
    path.join(logDir, 'remediation-websocket-playwright.json'),
    JSON.stringify(evidence, null, 2),
  );

  expect(evidence.pageErrors).toEqual([]);
  expect(evidence.websocket.created).toBeGreaterThan(0);
  expect(evidence.websocket.handshakeStatuses).toContain(101);
  expect(evidence.websocket.events).toContain('status_update');
  expect(evidence.websocket.events).toContain('pipeline_complete');
  expect(
    evidence.console.filter((entry) => /websocket.*(404|failed)|unexpected response code/i.test(entry.text)),
  ).toEqual([]);
});
