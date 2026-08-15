const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5374';
const REPO_PATH = process.env.TARGET_REPO;
const SHOT_DIR = process.env.SHOT_DIR || 'C:/Users/LENOVO T14/.claude/jobs/6777747f/tmp/shots';
const SHOT_PREFIX = process.env.SHOT_PREFIX || 'run';

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
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  // ArchitecturalExplanationPanel is keyed on entityId (VoiceRail.tsx), so
  // once the panel is open, selecting a DIFFERENT entity remounts it and
  // fires a fresh POST automatically -- there is no reliable single click
  // to hang a page.waitForResponse() off (it may fire mid-navigation,
  // before a listener set up afterward exists). Collect every matching
  // response globally instead, and poll this array's length after each
  // navigation step.
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

  console.log('[1] launch Laura\'s normally');
  await page.goto(FRONTEND_URL);
  await page.evaluate(() => window.localStorage.removeItem('syntax-tree.analysis-session.v1'));
  await page.reload();
  await shot('01-launch');

  console.log('[2] analyze a repository:', REPO_PATH);
  await page.getByRole('textbox', { name: 'Repository path' }).fill(REPO_PATH);
  const [analyzeResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/analyze') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Build architecture map' }).click(),
  ]);
  console.log('    POST /api/analyze status:', analyzeResponse.status());

  // Wait for analysis to complete (architecture map / observatory shell to render).
  // Zustand's persist middleware wraps stored state as {state: {...}, version}.
  await page.waitForFunction(
    () => {
      const raw = window.localStorage.getItem('syntax-tree.analysis-session.v1');
      if (!raw) return false;
      try { return JSON.parse(raw).state.analysisStatus === 'completed'; } catch { return false; }
    },
    undefined,
    { timeout: 120000, polling: 500 },
  );
  await page.waitForTimeout(1500);
  await shot('02-analyzed');

  console.log('[3] navigate to an entity/module');
  // useArchitectureLens.ts's enterNode(node, selectOnly=false): the
  // accessible-table row button always calls onEnterNode(node, true), i.e.
  // ALWAYS selectOnly -- it can never drill in, regardless of which row.
  // The plain CANVAS click handler
  // (onNodeClick={(event, node) => onEnterNode(node.data, event.altKey)})
  // passes event.altKey, which is false for a normal click -- THAT is the
  // real drilldown path. @xyflow/react renders each node's id as
  // data-id on the .react-flow__node wrapper div (ArchitectureMapCanvas.tsx
  // sets `id: node.id` directly on the RFNode), so we can target real
  // module:/symbol: entities directly instead of guessing screen position.
  const nodeCandidates = page.locator('.react-flow__node');
  await nodeCandidates.first().waitFor({ state: 'visible', timeout: 30000 });

  async function nodeIdsMatching(prefix) {
    const locator = page.locator(`.react-flow__node[data-id^="${prefix}"]`);
    const count = await locator.count();
    const ids = [];
    for (let i = 0; i < count; i++) ids.push(await locator.nth(i).getAttribute('data-id'));
    return ids;
  }

  // Optional hints so a specific known-good entity (e.g. one we know has a
  // real, in-evidence outgoing call in the target fixture) is tried first,
  // maximizing the chance of landing on a SUPPORTED claim -- falls back to
  // plain first-available order when unset or not found.
  const preferredModuleLabel = process.env.PREFERRED_MODULE_LABEL || null;
  const preferredSymbolLabel = process.env.PREFERRED_SYMBOL_LABEL || null;

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

  const archButtonProbe = page.getByRole('button', { name: /Architectural Explanation/i });

  await page.waitForTimeout(600);
  await shot('03a-root-map');

  // Level 0 -> 1: try each module: node in turn (some, like an empty
  // __init__.py, dead-end with zero children) until one drills down to
  // reveal real symbol: entities.
  const moduleIds = await idsOrderedByLabelPreference('module:', preferredModuleLabel);
  console.log('    module candidates:', moduleIds);
  let reachedSymbols = false;
  let chosenModuleId = null;
  for (const moduleId of moduleIds) {
    await clickNodeById(moduleId);
    await page.waitForTimeout(900);
    await shot(`03b-module-${moduleId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`);
    const symbolIds = await nodeIdsMatching('symbol:');
    if (symbolIds.length > 0) {
      reachedSymbols = true;
      chosenModuleId = moduleId;
      break;
    }
    console.log('    module', moduleId, 'has no symbol children, backing out');
    await goBackLens();
  }
  console.log('    drilled into module node:', chosenModuleId, 'reachedSymbols:', reachedSymbols);

  // Level 1 -> 2: click a symbol: node (real class/function entity). If it
  // still has children (e.g. a class with methods) this drills one level
  // further; if it's a leaf, enterNode's !canDrilldown branch selects it
  // directly, which is exactly what we want (opens the side panel with the
  // "Architectural Explanation" action for that entity). Re-clicking a
  // different symbol node while one is already selected just updates the
  // selection (enterNode's selectOnly branch), so trying several top-level
  // candidates in turn doesn't require backing out between attempts.
  const archButton = page.getByRole('button', { name: 'Architectural Explanation', exact: true });
  let enteredLeaf = false;
  let explanationResponse = null;
  let explanationBody = null;
  let chosenSymbolId = null;

  const topLevelSymbolIds = reachedSymbols
    ? await idsOrderedByLabelPreference('symbol:', preferredSymbolLabel)
    : [];
  const candidateLimit = Math.min(topLevelSymbolIds.length, 4);

  for (let candidateIdx = 0; candidateIdx < candidateLimit && !explanationBody; candidateIdx++) {
    // Captured BEFORE any navigation for this candidate: if the panel is
    // already open from a prior candidate, the remount (and its POST) can
    // fire mid-navigation, on whichever click actually reaches the leaf --
    // not necessarily after this loop finishes.
    const beforeCount = explanationResponses.length;
    let workingId = topLevelSymbolIds[candidateIdx];
    let leafReachedThisCandidate = false;
    let drilledBelowTopLevel = false;
    for (let depth = 0; depth < 3 && !leafReachedThisCandidate; depth++) {
      // enterNode's drill branch ALSO selects the node it drills into
      // (writeState([...lensPath, node.id], node.id)), so the
      // "Architectural Explanation" button appears on EVERY successful
      // click, whether or not real drilldown happened -- it cannot be used
      // to detect "reached a leaf". Instead compare the visible symbol:
      // node id set before/after the click: if workingId itself is no
      // longer present afterward, we drilled into its children (it was
      // replaced by them); if it's still present, canDrilldown was false
      // and this was select-only -- a genuine leaf.
      const idsBefore = await nodeIdsMatching('symbol:');
      await clickNodeById(workingId);
      console.log('    clicked symbol node (candidate', candidateIdx, 'depth', depth, '):', workingId);
      await page.waitForTimeout(900);
      await shot(`03c-symbol-c${candidateIdx}-d${depth}`);
      const idsAfter = await nodeIdsMatching('symbol:');
      const stillSameLevel = idsBefore.length > 0 && idsAfter.includes(workingId);
      if (stillSameLevel || idsAfter.length === 0) {
        leafReachedThisCandidate = true;
        break;
      }
      // Drilled into workingId's children -- continue one level deeper.
      workingId = idsAfter[0];
      drilledBelowTopLevel = true;
    }
    if (!leafReachedThisCandidate) {
      if (drilledBelowTopLevel) await goBackLens();
      continue;
    }
    enteredLeaf = true;
    chosenSymbolId = workingId;

    console.log('[4] open architectural explanation (candidate', candidateIdx, ')');
    await archButton.waitFor({ state: 'visible', timeout: 15000 });
    // ArchitecturalExplanationPanel is keyed on entityId (VoiceRail.tsx):
    // once the panel is already open from an earlier candidate, the LAST
    // navigation click above (selecting this candidate's leaf entity)
    // already remounted it and fired a fresh POST -- clicking the
    // (already aria-expanded=true) toggle again would just CLOSE it.
    // Only click when it's not already open; either way, read the latest
    // entry off the global response collector rather than racing a fresh
    // page.waitForResponse() against a request that may have already
    // fired mid-navigation.
    const alreadyExpanded = (await archButton.getAttribute('aria-expanded')) === 'true';
    if (!alreadyExpanded) await archButton.click();
    const result = await waitForNextExplanationResponse(beforeCount);
    if (!result) throw new Error(`No architectural-explanation response observed for candidate ${candidateIdx}`);
    console.log('    POST .../architectural-explanation status:', result.status);
    const body = result.body;
    console.log('    claims:', body.claims.length, 'supported:', body.supported_count, 'insufficient:', body.insufficient_evidence_count);
    if (body.supported_count > 0 || candidateIdx === candidateLimit - 1) {
      explanationResponse = { status: () => result.status };
      explanationBody = body;
    } else {
      console.log('    no supported claim yet, trying next candidate entity');
      if (drilledBelowTopLevel) await goBackLens();
      await page.waitForTimeout(300);
    }
  }

  await page.waitForTimeout(500);
  await shot('03-node-selected');

  if (!enteredLeaf || !explanationBody) {
    console.log('---SUMMARY---');
    console.log(JSON.stringify({ navigationFailed: !enteredLeaf, reachedSymbols, chosenModuleId }, null, 2));
    await browser.close();
    return;
  }

  fs.writeFileSync(path.join(SHOT_DIR, `${SHOT_PREFIX}-explanation-response.json`), JSON.stringify(explanationBody, null, 2));
  console.log('    final chosen entity:', chosenSymbolId);

  await page.waitForTimeout(1000);
  await shot('04-explanation-open');

  console.log('[5] observe generated claims (see screenshot 04)');

  let inspectedSupported = false;
  let inspectedInsufficient = false;

  const supportedCard = page.locator('.la-claim-card--supported').first();
  if (await supportedCard.count() > 0) {
    console.log('[6] inspect a SUPPORTED claim');
    await supportedCard.locator('.la-claim-card__header').click();
    await page.waitForTimeout(500);
    await shot('05-supported-claim-expanded');
    inspectedSupported = true;

    console.log('[7] follow its evidence to source');
    const sourceButton = supportedCard.getByRole('button', { name: /source|open|view/i }).first();
    if (await sourceButton.count() > 0) {
      await sourceButton.click();
      await page.waitForTimeout(800);
      await shot('06-evidence-source-opened');
    } else {
      console.log('    (no explicit "open source" button found on this card -- capturing expanded evidence chain view instead)');
    }
  } else {
    console.log('[6-7] NO SUPPORTED claim present in this response -- skipping (see explanation-response.json for the raw claim set)');
  }

  const insufficientCard = page.locator('.la-claim-card--insufficient_evidence').first();
  if (await insufficientCard.count() > 0) {
    console.log('[8] inspect an INSUFFICIENT_EVIDENCE claim');
    await insufficientCard.locator('.la-claim-card__header').click();
    await page.waitForTimeout(500);
    await shot('07-insufficient-claim-expanded');
    inspectedInsufficient = true;
  } else {
    console.log('[8] NO INSUFFICIENT_EVIDENCE claim present in this response -- skipping');
  }

  console.log('---SUMMARY---');
  console.log(JSON.stringify({
    analyzeStatus: analyzeResponse.status(),
    explanationStatus: explanationResponse.status(),
    claimCount: explanationBody.claims.length,
    supportedCount: explanationBody.supported_count,
    insufficientCount: explanationBody.insufficient_evidence_count,
    inspectedSupported,
    inspectedInsufficient,
    consoleErrors,
  }, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error('FLOW FAILED:', err);
  process.exit(1);
});
