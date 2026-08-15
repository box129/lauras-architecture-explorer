/**
 * Product-hardening round, PHASE 11, recording B ("provenance focus"):
 * Architectural Explanation -> SUPPORTED -> proposition -> evidence chain
 * -> exact source -> INSUFFICIENT EVIDENCE -> explanatory help/status
 * semantics. Real browser run, same Flask principal repository and fake
 * wiring-only LLM stand-in as product-acceptance-flow.cjs (see that
 * script's header for the honest live-vs-stand-in distinction).
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5491';
const REPO_PATH = process.env.TARGET_REPO;
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || 'C:/Users/LENOVO T14/Development/lauras-product-end-user-acceptance/qa-audit/final-end-user-acceptance';
const VIDEO_DIR = path.join(EVIDENCE_DIR, 'recordings', 'provenance-flow-raw');

function findChromium() {
  const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(cacheRoot)) return undefined;
  const candidates = fs.readdirSync(cacheRoot)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort()
    .reverse();
  for (const candidate of candidates) {
    for (const parts of [['chrome-win64', 'chrome.exe'], ['chrome-win', 'chrome.exe']]) {
      const executable = path.join(cacheRoot, candidate, ...parts);
      if (fs.existsSync(executable)) return executable;
    }
  }
  return undefined;
}

async function main() {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  const executablePath = findChromium();
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  const explanationResponses = [];
  page.on('response', (r) => {
    if (r.url().includes('/architectural-explanation') && r.request().method() === 'POST') {
      r.json().then((body) => explanationResponses.push({ status: r.status(), body })).catch(() => {});
    }
  });
  async function waitForNextExplanationResponse(sinceCount, timeoutMs = 15000) {
    const started = Date.now();
    while (explanationResponses.length <= sinceCount) {
      if (Date.now() - started > timeoutMs) return null;
      await page.waitForTimeout(200);
    }
    return explanationResponses[explanationResponses.length - 1];
  }

  async function nodeIdsMatching(prefix) {
    const locator = page.locator(`.react-flow__node[data-id^="${prefix}"]`);
    const count = await locator.count();
    const ids = [];
    for (let i = 0; i < count; i++) ids.push(await locator.nth(i).getAttribute('data-id'));
    return ids;
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
  const archButton = page.getByRole('button', { name: 'Architectural Explanation', exact: true });

  console.log('[1] launch + analyze Flask');
  await page.goto(FRONTEND_URL);
  await page.evaluate(() => window.localStorage.removeItem('syntax-tree.analysis-session.v1'));
  await page.reload();
  await page.getByRole('textbox', { name: 'Repository path' }).fill(REPO_PATH);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/analyze') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Build architecture map' }).click(),
  ]);
  await page.waitForFunction(
    () => {
      const raw = window.localStorage.getItem('syntax-tree.analysis-session.v1');
      if (!raw) return false;
      try { return JSON.parse(raw).state.analysisStatus === 'completed'; } catch { return false; }
    },
    undefined,
    { timeout: 180000, polling: 500 },
  );
  await page.waitForTimeout(1500);
  await page.locator('.react-flow__node').first().waitFor({ state: 'visible', timeout: 30000 });

  console.log('[2] drill to a leaf entity with a SUPPORTED claim');
  const allModuleIds = await nodeIdsMatching('module:');
  const preferred = [];
  const rest = [];
  for (const id of allModuleIds) {
    const text = await page.locator(`.react-flow__node[data-id="${id}"]`).innerText();
    (text.toLowerCase().includes('app.py') ? preferred : rest).push(id);
  }
  const moduleIds = [...preferred, ...rest];

  let explanationBody = null;
  let allCandidates = [];
  let chosenSymbolIds = [];
  for (const moduleId of moduleIds) {
    if (explanationBody) break;
    await clickNodeById(moduleId);
    await page.waitForTimeout(900);
    chosenSymbolIds = await nodeIdsMatching('symbol:');
    if (chosenSymbolIds.length === 0) { await goBackLens(); continue; }

  for (let i = 0; i < Math.min(chosenSymbolIds.length, 6) && !explanationBody; i++) {
    // Captured BEFORE any drilling clicks: once the panel is already
    // expanded from a prior candidate, selecting a new entity (the click
    // below) can itself trigger a fresh explanation fetch as a side
    // effect -- capturing this snapshot afterward would miss that
    // response entirely and hang waiting for one that already arrived.
    const beforeCount = explanationResponses.length;
    let workingId = chosenSymbolIds[i];
    let leaf = false;
    let drilled = false;
    for (let depth = 0; depth < 3 && !leaf; depth++) {
      const before = await nodeIdsMatching('symbol:');
      await clickNodeById(workingId);
      await page.waitForTimeout(900);
      const after = await nodeIdsMatching('symbol:');
      if ((before.length > 0 && after.includes(workingId)) || after.length === 0) { leaf = true; break; }
      workingId = after[0];
      drilled = true;
    }
    if (!leaf) { if (drilled) await goBackLens(); continue; }

    await archButton.waitFor({ state: 'visible', timeout: 15000 });
    const already = (await archButton.getAttribute('aria-expanded')) === 'true';
    if (!already) await archButton.click();
    const result = await waitForNextExplanationResponse(beforeCount);
    if (!result) throw new Error('No explanation response');
    allCandidates.push({ id: workingId, body: result.body });
    if (result.body.supported_count > 0) {
      explanationBody = result.body;
    } else {
      if (drilled) await goBackLens();
      await page.waitForTimeout(300);
    }
  }
    if (!explanationBody) await goBackLens();
  }
  if (!explanationBody) throw new Error('No SUPPORTED claim found across any module/candidate');

  console.log('[3] SUPPORTED -> proposition -> evidence chain -> exact source');
  const supportedCard = page.locator('.la-claim-card--supported').first();
  await supportedCard.locator('.la-claim-card__header').click();
  await page.waitForTimeout(600);
  await page.waitForTimeout(600); // let the reader linger on the evidence chain for the recording

  const openSourceButton = supportedCard.getByRole('button', { name: /^Open source$/i }).first();
  if (!(await openSourceButton.isDisabled())) {
    await openSourceButton.click();
    await page.waitForSelector('.obs-code-overlay', { timeout: 10000 });
    await page.waitForSelector('.obs-code-overlay .monaco-editor', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Close source code' }).click();
    await page.waitForTimeout(500);
  }

  console.log('[4] INSUFFICIENT EVIDENCE -> explanatory help/status semantics');
  let insufficientCard = page.locator('.la-claim-card--insufficient_evidence').first();
  if ((await insufficientCard.count()) === 0) {
    const candidate = allCandidates.find((c) => c.body.insufficient_evidence_count > 0 && c.id !== undefined);
    if (candidate) {
      // Re-drill to the sibling candidate directly (same module level).
      await clickNodeById(candidate.id).catch(() => {});
      await page.waitForTimeout(700);
    }
  }
  insufficientCard = page.locator('.la-claim-card--insufficient_evidence').first();
  if ((await insufficientCard.count()) > 0) {
    await insufficientCard.locator('.la-claim-card__header').click();
    await page.waitForTimeout(600);
    // Hover the badge to surface the plain-language SUPPORTED/INSUFFICIENT
    // EVIDENCE tooltip copy (Phase 6) for the recording.
    await insufficientCard.locator('.la-claim-card__badge').hover();
    await page.waitForTimeout(1200);
  } else {
    console.log('    No insufficient-evidence claim available among visited candidates in this run (honest, not forced).');
  }

  await page.waitForTimeout(800);
  await context.close();
  await browser.close();

  const videoFiles = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'));
  if (videoFiles.length >= 1) {
    const newest = videoFiles
      .map((f) => ({ f, mtime: fs.statSync(path.join(VIDEO_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0].f;
    const dest = path.join(EVIDENCE_DIR, 'recordings', 'recording-provenance-flow.webm');
    fs.copyFileSync(path.join(VIDEO_DIR, newest), dest);
    console.log('    video saved:', dest, videoFiles.length > 1 ? `(picked newest of ${videoFiles.length} stale files)` : '');
  } else {
    console.log('    WARNING: no video file found');
  }
}

main().catch((err) => {
  console.error('FLOW FAILED:', err);
  process.exit(1);
});
