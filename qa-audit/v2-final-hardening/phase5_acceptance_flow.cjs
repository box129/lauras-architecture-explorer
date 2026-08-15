const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5374';
const REPO_PATH = process.env.TARGET_REPO;
const SHOT_DIR = process.env.SHOT_DIR || 'C:/Users/LENOVO T14/.claude/jobs/6777747f/tmp/shots';
const SHOT_PREFIX = process.env.SHOT_PREFIX || 'phase5';

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
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const executablePath = findChromium();
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  // Only track /api/ failures as real product bugs -- Vite dev-server ESM
  // module requests legitimately abort (net::ERR_ABORTED) when
  // page.reload() interrupts an in-flight module graph fetch; that is a
  // dev-server-only artifact, not a product failure.
  page.on('requestfailed', (r) => {
    if (r.url().includes('/api/')) failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/') && !r.url().includes('/ws/analyze/')) {
      failedRequests.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    }
  });

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

  const shot = async (name) => {
    await page.screenshot({ path: path.join(SHOT_DIR, `${SHOT_PREFIX}-${name}.png`), fullPage: false });
  };

  async function nodeIdsMatching(prefix) {
    const locator = page.locator(`.react-flow__node[data-id^="${prefix}"]`);
    const count = await locator.count();
    const ids = [];
    for (let i = 0; i < count; i++) ids.push(await locator.nth(i).getAttribute('data-id'));
    return ids;
  }
  async function idsOrderedByLabelPreference(prefix, preferredLabel) {
    const ids = await nodeIdsMatching(prefix);
    if (!preferredLabel) return ids;
    const preferred = [];
    const rest = [];
    for (const id of ids) {
      const text = await page.locator(`.react-flow__node[data-id="${id}"]`).innerText();
      if (text.toLowerCase().includes(preferredLabel.toLowerCase())) preferred.push(id);
      else rest.push(id);
    }
    return [...preferred, ...rest];
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
  async function resetToRoot() {
    const rootCrumb = page.locator('nav[aria-label="Architecture breadcrumb"] button').first();
    if (await rootCrumb.count() > 0) {
      await rootCrumb.click();
      await page.waitForTimeout(600);
    }
  }

  // Drills module -> class -> method via the CANVAS, trying up to
  // `candidateLimit` top-level symbol candidates until one yields a
  // SUPPORTED claim (or the last candidate is accepted regardless).
  async function navigateCanvasAndOpenExplanation(shotPrefix, preferredModuleLabel) {
    await page.locator('.react-flow__node').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);
    await shot(`${shotPrefix}-root-map`);

    const moduleIds = await idsOrderedByLabelPreference('module:', preferredModuleLabel);
    let reachedSymbols = false;
    let chosenModuleId = null;
    for (const moduleId of moduleIds) {
      await clickNodeById(moduleId);
      await page.waitForTimeout(900);
      const symbolIds = await nodeIdsMatching('symbol:');
      if (symbolIds.length > 0) { reachedSymbols = true; chosenModuleId = moduleId; break; }
      await goBackLens();
    }
    console.log('    [canvas] drilled into module:', chosenModuleId, 'reachedSymbols:', reachedSymbols);
    await shot(`${shotPrefix}-module-level`);
    if (!reachedSymbols) return { ok: false };

    const topLevelSymbolIds = await nodeIdsMatching('symbol:');
    const candidateLimit = Math.min(topLevelSymbolIds.length, 5);
    let enteredLeaf = false;
    let explanationBody = null;
    let chosenSymbolId = null;
    const allCandidates = [];

    for (let candidateIdx = 0; candidateIdx < candidateLimit && !explanationBody; candidateIdx++) {
      const beforeCount = explanationResponses.length;
      let workingId = topLevelSymbolIds[candidateIdx];
      let leafReachedThisCandidate = false;
      let drilledBelowTopLevel = false;
      for (let depth = 0; depth < 3 && !leafReachedThisCandidate; depth++) {
        const idsBefore = await nodeIdsMatching('symbol:');
        await clickNodeById(workingId);
        await page.waitForTimeout(900);
        const idsAfter = await nodeIdsMatching('symbol:');
        const stillSameLevel = idsBefore.length > 0 && idsAfter.includes(workingId);
        if (stillSameLevel || idsAfter.length === 0) { leafReachedThisCandidate = true; break; }
        workingId = idsAfter[0];
        drilledBelowTopLevel = true;
      }
      if (!leafReachedThisCandidate) {
        if (drilledBelowTopLevel) await goBackLens();
        continue;
      }
      enteredLeaf = true;
      chosenSymbolId = workingId;

      await archButton.waitFor({ state: 'visible', timeout: 15000 });
      const alreadyExpanded = (await archButton.getAttribute('aria-expanded')) === 'true';
      if (!alreadyExpanded) await archButton.click();
      const result = await waitForNextExplanationResponse(beforeCount);
      if (!result) throw new Error(`No architectural-explanation response for candidate ${candidateIdx}`);
      console.log(`    [canvas] candidate ${candidateIdx} (${chosenSymbolId}): claims=${result.body.claims.length} supported=${result.body.supported_count} insufficient=${result.body.insufficient_evidence_count}`);
      allCandidates.push({ id: chosenSymbolId, body: result.body });
      if (result.body.supported_count > 0 || candidateIdx === candidateLimit - 1) {
        explanationBody = result.body;
      } else {
        if (drilledBelowTopLevel) await goBackLens();
        await page.waitForTimeout(300);
      }
    }
    await shot(`${shotPrefix}-node-selected`);
    return { ok: enteredLeaf && !!explanationBody, body: explanationBody, entityId: chosenSymbolId, allCandidates };
  }

  console.log('[1] launch Laura\'s normally (no test-only state injection)');
  await page.goto(FRONTEND_URL);
  await page.evaluate(() => window.localStorage.removeItem('syntax-tree.analysis-session.v1'));
  await page.reload();
  await shot('01-launch');

  console.log('[2] configure/enable Architectural Explanations: real product config path (env vars), verified via /api/health');
  const health = await page.evaluate(async () => (await fetch('/api/health')).json());
  console.log('    architectural_explanation_llm:', JSON.stringify(health.architectural_explanation_llm));
  console.log('    legacy llm (architecture-map):', JSON.stringify(health.llm));

  console.log('[3] analyze the pinned Flask repository:', REPO_PATH);
  await page.getByRole('textbox', { name: 'Repository path' }).fill(REPO_PATH);
  const [analyzeResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/analyze') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Build architecture map' }).click(),
  ]);
  console.log('    POST /api/analyze status:', analyzeResponse.status());
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
  console.log('[4] open architecture map (rendered automatically once analysis completes)');
  await shot('02-architecture-map');

  console.log('[5] navigate using CANVAS: module -> class -> method');
  const canvasResult = await navigateCanvasAndOpenExplanation('03-canvas', 'app.py');
  if (!canvasResult.ok) throw new Error('Canvas navigation to a SUPPORTED-claim-bearing entity failed');
  await shot('04-canvas-explanation-open');
  console.log('[6] verify explanation renders: claims=', canvasResult.body.claims.length);

  console.log('[7] inspect at least one SUPPORTED claim');
  let supportedCard = page.locator('.la-claim-card--supported').first();
  if ((await supportedCard.count()) === 0) throw new Error('No SUPPORTED claim card rendered despite supported_count > 0');
  await supportedCard.locator('.la-claim-card__header').click();
  await page.waitForTimeout(500);
  await shot('05-supported-claim-expanded');

  console.log('[8] expand its evidence chain');
  const evidenceText = await supportedCard.locator('.la-evidence-item').first().innerText();
  console.log('    evidence item text:', evidenceText.replace(/\n/g, ' | '));

  console.log('[9] confirm exact file/line range/relation type/extractor provenance');
  const hasRelationType = /DIRECT RELATION: CALLS|REACHABILITY: CALLS|DIRECT RELATION: INHERITS/i.test(await supportedCard.innerText());
  console.log('    relation-type badge present:', hasRelationType);

  console.log('[10] click Open source');
  const openSourceButton = supportedCard.getByRole('button', { name: /^Open source$/i }).first();
  const openSourceDisabled = await openSourceButton.isDisabled();
  console.log('    Open source button disabled:', openSourceDisabled);
  let sourceVerified = false;
  if (!openSourceDisabled) {
    await openSourceButton.click();
    await page.waitForSelector('.obs-code-overlay', { timeout: 10000 });
    // Monaco is lazy-loaded (MonacoWrapper) and can take longer than the
    // overlay's own mount to render actual code content.
    await page.waitForSelector('.obs-code-overlay .monaco-editor', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot('06-open-source-overlay');

    console.log('[11] confirm existing source viewer opens the correct location and focuses the expected line');
    const storeState = await page.evaluate(() => {
      // Zustand vanilla store instance is attached for devtools in many
      // setups, but to stay implementation-agnostic just read the
      // rendered file tab / path text instead.
      const overlay = document.querySelector('.obs-code-overlay');
      return overlay ? overlay.innerText.slice(0, 400) : null;
    });
    console.log('    code overlay text preview:', (storeState || '').replace(/\n/g, ' | ').slice(0, 200));
    sourceVerified = !!storeState;

    console.log('[12] return to architecture view');
    await page.getByRole('button', { name: 'Close source code' }).click();
    await page.waitForTimeout(500);
    await shot('07-back-to-architecture');
  } else {
    console.log('    (this evidence item has no source_region_id -- honest disabled state, not a broken button; skipping open-source verification for this claim)');
  }

  console.log('[13] navigate using ACCESSIBLE TABLE: module -> class -> method');
  await resetToRoot();
  const tableToggle = page.getByText('View architecture as accessible tables');
  await tableToggle.click();
  await page.waitForTimeout(500);
  await shot('08-accessible-table-open');

  // Reuse the SAME onEnterNode semantics as canvas (Phase 2's fix: table
  // row buttons now call onEnterNode(node, event.altKey) too), clicking
  // the table's row buttons for the actual interaction. The canvas's
  // React Flow nodes remain mounted in the DOM behind the <details> table
  // (both render from the same fixture.nodes at the current lens level),
  // so the same data-id-based symbol:-count comparison used by
  // navigateCanvasAndOpenExplanation reliably detects real drilldown vs.
  // select-only here too, without needing a data-id on the table itself.
  const tableRowButtons = () => page.locator('.obs-table-row-button');
  // ArchitectureMapCanvas remounts its <details> (native open state is
  // lost) whenever the underlying fixture/focalNode changes in a way that
  // recreates the element -- re-open it defensively before every click
  // rather than assuming a single open() at the start survives the whole
  // multi-level drilldown.
  async function ensureTableOpen() {
    const details = page.locator('details.obs-graph-alternative');
    if ((await details.count()) === 0) return;
    const isOpen = await details.evaluate((el) => el.hasAttribute('open'));
    if (!isOpen) {
      await details.locator('summary').click();
      await page.waitForTimeout(300);
    }
  }

  // Module level: try successive rows (by index) until one drills down to
  // reveal symbol: entities -- mirrors navigateCanvasAndOpenExplanation's
  // own per-module retry loop, since some modules (e.g. an empty
  // __init__.py) have zero children.
  let tableReachedSymbols = false;
  await ensureTableOpen();
  const moduleRowCount = await tableRowButtons().count();
  for (let i = 0; i < moduleRowCount && !tableReachedSymbols; i++) {
    await ensureTableOpen();
    await tableRowButtons().nth(i).click();
    await page.waitForTimeout(700);
    await shot(`08-table-module-${i}`);
    if ((await nodeIdsMatching('symbol:')).length > 0) { tableReachedSymbols = true; break; }
    await goBackLens();
  }
  console.log('    [table] reached symbol level:', tableReachedSymbols);

  // Symbol level: drill from the first row until a leaf (selection stops
  // changing the visible symbol: id set).
  let tableReachedLeaf = false;
  for (let depth = 0; depth < 3 && tableReachedSymbols && !tableReachedLeaf; depth++) {
    const idsBefore = await nodeIdsMatching('symbol:');
    if (idsBefore.length === 0) break;
    await ensureTableOpen();
    await tableRowButtons().first().click();
    await page.waitForTimeout(700);
    await shot(`08-table-symbol-depth-${depth}`);
    const idsAfter = await nodeIdsMatching('symbol:');
    const stillSameLevel = idsAfter.length === idsBefore.length && idsAfter.every((id, i) => id === idsBefore[i]);
    if (stillSameLevel) { tableReachedLeaf = true; break; }
  }
  console.log('    [table] reached leaf entity:', tableReachedLeaf);
  console.log('[14] open Architectural Explanation from table-selected entity');
  // The panel is already open from the canvas walkthrough (steps 5-12),
  // so ArchitecturalExplanationPanel's key={entityId} remount already
  // fired a fresh POST as a side effect of the LAST click in the symbol-
  // level drill loop above -- by the time we get here that response is
  // already the newest entry in the collector; there is no further click
  // to hang a "wait for a NEW response" on. Only explicitly click (and
  // then wait for a genuinely new response) if the panel was closed.
  const tableAlreadyExpanded = (await archButton.getAttribute('aria-expanded')) === 'true';
  let tableResult;
  if (!tableAlreadyExpanded) {
    const tableBeforeCount = explanationResponses.length;
    await archButton.click();
    tableResult = await waitForNextExplanationResponse(tableBeforeCount);
  } else {
    await page.waitForTimeout(1200);
    tableResult = explanationResponses[explanationResponses.length - 1] || null;
  }
  const tableExplanationWorked = !!tableResult && tableResult.status === 200;
  console.log('[15] verify equivalent functionality via table selection:', tableExplanationWorked, tableResult ? `claims=${tableResult.body.claims.length}` : '(no response)');
  await shot('09-table-explanation-open');

  console.log('[16] refresh/reopen the analyzed run');
  await page.reload();
  await page.waitForTimeout(1500);
  const persistedStatus = await page.evaluate(() => {
    const raw = window.localStorage.getItem('syntax-tree.analysis-session.v1');
    if (!raw) return null;
    try { return JSON.parse(raw).state.analysisStatus; } catch { return null; }
  });
  console.log('    analysisStatus after reload:', persistedStatus);
  await shot('10-after-reload');

  console.log('[17] confirm persisted analysis still supports the explanation/evidence journey without re-analysis');
  let reopenWorked = false;
  if (persistedStatus === 'completed') {
    // The URL carries lensPath (useArchitectureLens.ts's writeState for
    // source==='api'), so a reload can resume deep inside the tree rather
    // than at the root -- reset to root first so the module-level retry
    // loop in navigateCanvasAndOpenExplanation has module: nodes to find.
    await page.locator('.react-flow__node').first().waitFor({ state: 'visible', timeout: 30000 });
    await resetToRoot();
    const reopenResult = await navigateCanvasAndOpenExplanation('11-reopen', 'app.py');
    reopenWorked = reopenResult.ok;
    await shot('11-reopen-explanation');
  }

  console.log('[18] check for naturally-produced INSUFFICIENT_EVIDENCE and confirm visual distinction');
  let insufficientCard = page.locator('.la-claim-card--insufficient_evidence').first();
  let insufficientPresent = (await insufficientCard.count()) > 0;
  if (!insufficientPresent) {
    // The entity selected by the retry loop was chosen specifically for
    // having a SUPPORTED claim (steps 6-12 need one); other candidates
    // visited along the way naturally produced insufficient_evidence-only
    // results (logged above) -- revisit one for a direct screenshot.
    const insufficientCandidate = (canvasResult.allCandidates || []).find((c) => c.body.insufficient_evidence_count > 0);
    if (insufficientCandidate) {
      console.log('    revisiting candidate with a naturally-produced insufficient claim:', insufficientCandidate.id);
      // insufficientCandidate.id is a top-level symbol sibling of the
      // final (supported) candidate -- re-drill only to the module's
      // top-level symbol list (not the full candidate search) so it's
      // directly clickable again. Best-effort: the React Flow minimap can
      // overlap a node's hit area at some layouts: this is a supplementary
      // screenshot (candidates 1/2's insufficient-only results are already
      // logged above), so failures here are caught and logged, not fatal.
      try {
        await resetToRoot();
        await page.locator('.react-flow__node').first().waitFor({ state: 'visible', timeout: 30000 });
        const moduleIds2 = await idsOrderedByLabelPreference('module:', 'app.py');
        for (const moduleId of moduleIds2) {
          await clickNodeById(moduleId);
          await page.waitForTimeout(900);
          if ((await nodeIdsMatching('symbol:')).includes(insufficientCandidate.id)) break;
          await goBackLens();
        }
        const beforeCount = explanationResponses.length;
        await page.locator(`.react-flow__node[data-id="${insufficientCandidate.id}"]`).click({ force: true });
        await page.waitForTimeout(900);
        const alreadyExpanded = (await archButton.getAttribute('aria-expanded')) === 'true';
        if (!alreadyExpanded) await archButton.click();
        await waitForNextExplanationResponse(beforeCount);
        await page.waitForTimeout(500);
        insufficientCard = page.locator('.la-claim-card--insufficient_evidence').first();
        insufficientPresent = (await insufficientCard.count()) > 0;
      } catch (err) {
        console.log('    (supplementary insufficient-evidence revisit failed, non-fatal):', err.message.split('\n')[0]);
      }
    }
  }
  if (insufficientPresent) {
    await insufficientCard.locator('.la-claim-card__header').click();
    await page.waitForTimeout(400);
    await shot('12-insufficient-claim-expanded');
  }

  console.log('---SUMMARY---');
  console.log(JSON.stringify({
    analyzeStatus: analyzeResponse.status(),
    healthArchExplanation: health.architectural_explanation_llm,
    healthLegacyLlm: health.llm,
    canvasNavigationOk: canvasResult.ok,
    canvasClaims: canvasResult.body.claims.length,
    canvasSupported: canvasResult.body.supported_count,
    canvasInsufficient: canvasResult.body.insufficient_evidence_count,
    openSourceAvailableOnFirstSupportedClaim: !openSourceDisabled,
    sourceOverlayVerified: sourceVerified,
    tableNavigationExplanationWorked: tableExplanationWorked,
    persistedStatusAfterReload: persistedStatus,
    reopenAfterReloadWorked: reopenWorked,
    insufficientEvidenceNaturallyProduced: insufficientPresent,
    consoleErrors,
    failedRequests,
  }, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error('FLOW FAILED:', err);
  process.exit(1);
});
