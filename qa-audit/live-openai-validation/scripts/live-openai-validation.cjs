/**
 * FIRST REAL EXTERNAL-LLM VERTICAL-SLICE VALIDATION.
 *
 * Validation only -- no product code is touched by this script. Drives
 * the ALREADY-RUNNING, ALREADY-CONFIGURED Laura's instance (real OpenAI
 * provider, configured by the owner directly in the browser; this
 * script never sees, requests, or transmits the API key) through the
 * exact same normal user flow a human would use: choose repository ->
 * analyze -> wait for real stages -> architecture map -> select
 * OrderService.create_order -> request Architectural Explanation.
 *
 * Fixture: research/provenance-evaluation/fixtures/python_app/ (the
 * existing, canonical Controller/Service/PaymentService/Repository/
 * Entity fixture -- see fixtures/ground_truth/claims.json).
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5175';
const REPO_PATH = process.env.TARGET_REPO;
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || 'C:/Users/LENOVO T14/Development/lauras-product-end-user-acceptance/qa-audit/live-openai-validation';
const SHOT_DIR = path.join(EVIDENCE_DIR, 'screenshots');
const VIDEO_DIR = path.join(EVIDENCE_DIR, 'recordings', 'raw');

function findChromium() {
  const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const candidates = fs.readdirSync(cacheRoot).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse();
  for (const c of candidates) {
    const p = path.join(cacheRoot, c, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  const executablePath = findChromium();
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/') && !r.url().includes('/ws/analyze/')) {
      failedRequests.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    }
  });

  const explanationResponses = [];
  page.on('response', (r) => {
    if (r.url().includes('/architectural-explanation') && r.request().method() === 'POST') {
      const startedAt = Date.now();
      r.json()
        .then((body) => explanationResponses.push({ status: r.status(), body, receivedAt: Date.now() }))
        .catch((err) => explanationResponses.push({ status: r.status(), error: String(err), receivedAt: Date.now() }));
    }
  });

  const shot = async (name) => {
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
    console.log('    [shot]', name);
  };

  async function nodeIdsMatching(prefix) {
    const locator = page.locator(`.react-flow__node[data-id^="${prefix}"]`);
    const count = await locator.count();
    const ids = [];
    for (let i = 0; i < count; i++) ids.push(await locator.nth(i).getAttribute('data-id'));
    return ids;
  }
  async function labelOf(id) {
    return page.locator(`.react-flow__node[data-id="${id}"]`).innerText();
  }
  async function clickNodeById(id) {
    await page.locator(`.react-flow__node[data-id="${id}"]`).click();
  }
  const backButton = page.getByRole('button', { name: 'Back to previous architecture lens' });
  async function goBackLens() {
    if (await backButton.count() > 0) {
      await backButton.click();
      await page.waitForTimeout(600);
    }
  }
  async function resetToRoot() {
    const rootCrumb = page.locator('nav[aria-label="Architecture breadcrumb"] button').first();
    if (await rootCrumb.count() > 0) {
      await rootCrumb.click();
      await page.waitForTimeout(600);
    }
  }
  const archButton = page.getByRole('button', { name: 'Architectural Explanation', exact: true });

  // ---------------------------------------------------------------------
  // 1. Confirm live runtime (already done via curl outside this script;
  //    re-confirm once more here immediately before use, still read-only).
  // ---------------------------------------------------------------------
  console.log('[1] confirm live runtime (read-only)');
  const preRunSettings = await page.request.get(`${FRONTEND_URL}/api/settings/architectural-explanation`).then((r) => r.json());
  console.log('    architectural-explanation settings:', JSON.stringify(preRunSettings));
  if (!preRunSettings.configured || preRunSettings.provider !== 'openai') {
    throw new Error('BLOCKER: live runtime is not configured for real OpenAI. Aborting without touching anything further.');
  }

  // Settings state lives entirely on the backend, shared across every
  // browser session -- opening it in THIS fresh tab shows the exact same
  // already-configured, already-saved state as the owner's own tab,
  // without touching or navigating away from their tab at all. Read-only:
  // never clicks Save, never types into the API Key field.
  console.log('    capturing Settings runtime-config screenshot (masked key, read-only)');
  await page.goto(FRONTEND_URL);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await shot('01-openai-runtime-config');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForTimeout(300);

  // ---------------------------------------------------------------------
  // 2/3. Analyze the controlled fixture through the normal UI flow.
  // ---------------------------------------------------------------------
  console.log('[2] open first-launch / current screen, analyze the controlled fixture:', REPO_PATH);
  await page.goto(FRONTEND_URL);
  await page.evaluate(() => window.localStorage.removeItem('syntax-tree.analysis-session.v1'));
  await page.reload();
  await page.getByRole('textbox', { name: 'Repository path' }).waitFor({ state: 'visible' });
  await shot('02-controlled-repository-loaded-before-analyze');
  await page.getByRole('textbox', { name: 'Repository path' }).fill(REPO_PATH);

  const [analyzeResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/analyze') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Build architecture map' }).click(),
  ]);
  console.log('    POST /api/analyze status:', analyzeResponse.status());
  const runId = (await analyzeResponse.json()).run_id;
  console.log('    run_id:', runId);

  await page.waitForFunction(
    () => {
      const raw = window.localStorage.getItem('syntax-tree.analysis-session.v1');
      if (!raw) return false;
      try { return JSON.parse(raw).state.analysisStatus === 'completed'; } catch { return false; }
    },
    undefined,
    { timeout: 60000, polling: 500 },
  );
  await page.waitForTimeout(1200);

  // ---------------------------------------------------------------------
  // Navigate: module (services/order_service) -> class (OrderService) ->
  // method (create_order).
  // ---------------------------------------------------------------------
  console.log('[3] navigate to OrderService.create_order via the canvas');
  await page.locator('.react-flow__node[data-id^="module:"]').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(600);
  await shot('02-controlled-repository-loaded');

  const moduleIds = await nodeIdsMatching('module:');
  const moduleLabels = {};
  for (const id of moduleIds) moduleLabels[id] = (await labelOf(id)).toLowerCase();
  console.log('    modules found:', JSON.stringify(moduleLabels));
  const orderServiceModuleId = moduleIds.find((id) => moduleLabels[id].includes('order_service'))
    || moduleIds.find((id) => moduleLabels[id].includes('service'));
  if (!orderServiceModuleId) throw new Error('Could not find an order_service module node on the map.');
  await clickNodeById(orderServiceModuleId);
  await page.waitForTimeout(900);

  const classIds = await nodeIdsMatching('symbol:');
  const classLabels = {};
  for (const id of classIds) classLabels[id] = (await labelOf(id)).toLowerCase();
  console.log('    symbols at module level:', JSON.stringify(classLabels));
  let workingId = classIds.find((id) => classLabels[id].includes('orderservice')) || classIds[0];
  if (!workingId) throw new Error('order_service module drilldown produced no symbols.');

  // Drill from whatever level we're at (class or already a method) down to
  // create_order specifically, preferring an exact label match at each
  // level rather than just the first candidate.
  for (let depth = 0; depth < 3; depth++) {
    const before = await nodeIdsMatching('symbol:');
    if (before.length === 0) break;
    const labels = {};
    for (const id of before) labels[id] = (await labelOf(id)).toLowerCase();
    const preferred = before.find((id) => labels[id].includes('create_order'));
    const target = preferred || before.find((id) => id === workingId) || before[0];
    await clickNodeById(target);
    await page.waitForTimeout(900);
    const after = await nodeIdsMatching('symbol:');
    const stillSameLevel = after.length > 0 && after.includes(target);
    workingId = target;
    if (preferred || stillSameLevel || after.length === 0) break;
    workingId = after[0];
  }
  console.log('    landed on entity id:', workingId, 'label:', await labelOf(workingId).catch(() => '(gone)'));
  await shot('03-target-entity-selected');

  // ---------------------------------------------------------------------
  // 4/5/6. Request the real architectural explanation and capture it.
  // ---------------------------------------------------------------------
  console.log('[4] request Architectural Explanation from the real OpenAI proposer');
  await archButton.waitFor({ state: 'visible', timeout: 15000 });
  const beforeCount = explanationResponses.length;
  const requestStartedAt = Date.now();
  const alreadyExpanded = (await archButton.getAttribute('aria-expanded')) === 'true';
  if (!alreadyExpanded) await archButton.click();

  const timeoutMs = 60000;
  const pollStarted = Date.now();
  while (explanationResponses.length <= beforeCount) {
    if (Date.now() - pollStarted > timeoutMs) throw new Error('No architectural-explanation response within 60s.');
    await page.waitForTimeout(250);
  }
  const result = explanationResponses[explanationResponses.length - 1];
  const generationLatencyMs = result.receivedAt - requestStartedAt;
  console.log('    response status:', result.status, 'harness-measured latency:', generationLatencyMs, 'ms');
  await page.waitForTimeout(500);
  await shot('03-real-openai-explanation');

  if (result.error || result.status !== 200) {
    throw new Error(`Explanation request did not succeed: status=${result.status} error=${result.error || ''}`);
  }
  const explanation = result.body;
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'logs', 'raw-architectural-explanation-response.json'),
    JSON.stringify(explanation, null, 2),
  );
  console.log('    claims:', explanation.claims.length, 'supported:', explanation.supported_count, 'insufficient:', explanation.insufficient_evidence_count);

  // Cross-check every referenced entity id against real, known symbols in
  // this run (safe proxy for "did the model stay within real entities" --
  // the raw bounded-evidence packet itself isn't exposed via the API).
  const symbolsResponse = await page.request.get(`${FRONTEND_URL}/api/runs/${runId}/symbols`);
  const symbolsBody = await symbolsResponse.json();
  const knownSymbolIds = new Set((symbolsBody.symbols || symbolsBody).map((s) => s.id));
  let boundedEvidenceViolations = 0;
  const violationDetails = [];
  for (const claim of explanation.claims) {
    const prop = claim.proposition;
    if (!prop) continue;
    const referenced = [prop.subject_entity_id, prop.object_entity_id, ...(prop.path_entity_ids || [])];
    for (const ref of referenced) {
      if (ref && !knownSymbolIds.has(ref)) {
        boundedEvidenceViolations++;
        violationDetails.push({ claim_id: claim.id, unknown_entity_id: ref });
      }
    }
  }
  console.log('    bounded-evidence check: unknown-entity references =', boundedEvidenceViolations);

  // ---------------------------------------------------------------------
  // 7/8. Claim -> evidence -> source UI proof for a real SUPPORTED claim.
  // ---------------------------------------------------------------------
  let supportedClaimCaptured = false;
  let insufficientClaimCaptured = false;
  let sourceNavigationVerified = false;
  let sourceNavigationDetail = null;

  const supportedCard = page.locator('.la-claim-card--supported').first();
  if ((await supportedCard.count()) > 0) {
    console.log('[5] a real SUPPORTED claim is present -- capturing claim -> evidence -> source');
    await supportedCard.locator('.la-claim-card__header').click();
    await page.waitForTimeout(500);
    await shot('04-supported-claim');
    supportedClaimCaptured = true;

    const evidenceText = await supportedCard.locator('.la-evidence-item').first().innerText().catch(() => '');
    console.log('    evidence item text:', evidenceText.replace(/\n/g, ' | ').slice(0, 300));
    await shot('05-evidence-chain');

    const openSourceButton = supportedCard.getByRole('button', { name: /^Open source$/i }).first();
    if (!(await openSourceButton.isDisabled())) {
      await openSourceButton.click();
      await page.waitForSelector('.obs-code-overlay', { timeout: 10000 });
      await page.waitForSelector('.obs-code-overlay .monaco-editor', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
      const overlayText = await page.locator('.obs-code-overlay').innerText();
      sourceNavigationDetail = overlayText.slice(0, 300).replace(/\n/g, ' | ');
      sourceNavigationVerified = overlayText.length > 0;
      await shot('06-source-navigation');
      await page.getByRole('button', { name: 'Close source code' }).click();
      await page.waitForTimeout(400);
    } else {
      console.log('    Open source disabled on this evidence item (no source_region_id) -- honest, not a bug.');
    }
  } else {
    console.log('[5] no SUPPORTED claim in this response -- see result.json for what was returned.');
  }

  const insufficientCard = page.locator('.la-claim-card--insufficient_evidence').first();
  if ((await insufficientCard.count()) > 0) {
    await insufficientCard.locator('.la-claim-card__header').click();
    await page.waitForTimeout(400);
    await shot('07-insufficient-evidence');
    insufficientClaimCaptured = true;
  } else {
    console.log('    Live insufficient-evidence path not naturally exercised in this run.');
  }

  console.log('---SUMMARY---');
  console.log(JSON.stringify({
    runId,
    targetEntityId: workingId,
    explanationStatus: result.status,
    generationLatencyMs,
    claimCount: explanation.claims.length,
    supportedCount: explanation.supported_count,
    insufficientCount: explanation.insufficient_evidence_count,
    boundedEvidenceViolations,
    violationDetails,
    supportedClaimCaptured,
    insufficientClaimCaptured,
    sourceNavigationVerified,
    sourceNavigationDetail,
    consoleErrors,
    failedRequests,
  }, null, 2));

  await context.close();
  await browser.close();

  const videoFiles = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'));
  if (videoFiles.length >= 1) {
    const newest = videoFiles
      .map((f) => ({ f, mtime: fs.statSync(path.join(VIDEO_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0].f;
    fs.copyFileSync(
      path.join(VIDEO_DIR, newest),
      path.join(EVIDENCE_DIR, 'recordings', 'recording-real-openai-provenance-flow.webm'),
    );
    console.log('    video saved.');
  }
}

main().catch((err) => {
  console.error('VALIDATION RUN FAILED:', err);
  process.exit(1);
});
