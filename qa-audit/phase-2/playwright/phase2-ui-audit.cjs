const { chromium, firefox, webkit } = require('../../../syntax-tree-ui/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const outRoot = path.join(root, 'qa-audit', 'phase-2');
const baseURL = process.env.PHASE2_BASE_URL || 'http://127.0.0.1:5473';
const cache = path.join(process.env.LOCALAPPDATA, 'ms-playwright');
const requestedMode = process.argv[2] || 'primary';
const fixtures = {
  python: path.join(root, 'qa-audit', 'phase-2', 'fixtures', 'python-nested'),
  typescript: path.join(root, 'qa-audit', 'phase-2', 'fixtures', 'typescript-small'),
  mixed: path.join(root, 'qa-audit', 'phase-2', 'fixtures', 'mixed-moderate'),
};

const queries = [
  ['python', 'where is repository analysis started'],
  ['python', 'what parses Python files'],
  ['python', 'how are dependencies stored'],
  ['python', 'which component handles errors'],
  ['python', 'where is documentation generated'],
  ['python', 'where is the Parser class defined'],
  ['python', 'what calls parse_document'],
  ['typescript', 'where is repository analysis started'],
  ['typescript', 'what parses TypeScript files'],
  ['typescript', 'how are dependencies stored'],
  ['typescript', 'which component handles errors'],
  ['typescript', 'where is documentation generated'],
  ['typescript', 'where is Analyzer defined'],
  ['typescript', 'what imports parser'],
  ['mixed', 'where is repository analysis started'],
  ['mixed', 'what validates tasks'],
  ['mixed', 'how are dependencies stored'],
  ['mixed', 'which component handles errors'],
  ['mixed', 'where is documentation generated'],
  ['mixed', 'find TaskService'],
  ['mixed', 'unrelated quantum banana orchestra'],
  ['mixed', 'find TaskService'],
];

function executable(browserName) {
  if (browserName === 'chromium') return path.join(cache, 'chromium-1223', 'chrome-win64', 'chrome.exe');
  if (browserName === 'firefox') return path.join(cache, 'firefox-1495', 'firefox', 'firefox.exe');
  return path.join(cache, 'webkit-2215', 'Playwright.exe');
}

function redact(value) {
  const home = path.dirname(path.dirname(root));
  return JSON.parse(JSON.stringify(value).replaceAll(home.replaceAll('\\', '\\\\'), '<USER_HOME>').replace(/Bearer\s+[^"\s]+/gi, 'Bearer <REDACTED>'));
}

function nowMs() { return Number(process.hrtime.bigint() / 1000000n); }

async function launch(name) {
  const type = { chromium, firefox, webkit }[name];
  return type.launch({ headless: true, executablePath: executable(name) });
}

async function analyze(page, fixtureName, evidence) {
  const started = nowMs();
  const responsePromise = page.waitForResponse(r => r.url().includes('/api/analyze') && r.request().method() === 'POST', { timeout: 15000 });
  await page.locator('#observatory-repo-path').fill(fixtures[fixtureName]);
  await page.getByRole('button', { name: 'Build architecture map' }).click();
  const response = await responsePromise;
  let body = {};
  try { body = await response.json(); } catch {}
  const acknowledged = nowMs();
  await page.waitForTimeout(7000);
  const completed = nowMs();
  const text = await page.locator('body').innerText();
  const runId = body.run_id || body.job_id || null;
  evidence.analysis = {
    fixture: fixtureName,
    acknowledgement_ms: acknowledged - started,
    observed_for_ms: completed - acknowledged,
    status: response.status(),
    run_id: runId,
    active_run_loading_after_7s: /Active run loading/i.test(text),
    orientation_ready: /orientation ready/i.test(text),
    page_text_excerpt: text.slice(0, 5000),
  };
  return runId;
}

async function graphChecks(page, evidence, shotPrefix) {
  const nodes = page.locator('.react-flow__node');
  const edges = page.locator('.react-flow__edge');
  const result = {
    node_count: await nodes.count(),
    edge_count: await edges.count(),
    graph_api_requested: evidence.responses.some(r => /\/api\/architecture-map(?:\?|$)/.test(r.url)),
    meaningful_empty_state: /empty|no (architecture|components|nodes)|could not|unavailable/i.test(await page.locator('body').innerText()),
  };
  if (result.node_count) {
    const viewport = page.locator('.react-flow__viewport');
    result.transform_before = await viewport.getAttribute('style');
    await page.locator('.react-flow').hover();
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(300);
    result.transform_after_zoom = await viewport.getAttribute('style');
    const box = await page.locator('.react-flow').boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50);
      await page.mouse.up();
      result.transform_after_pan = await viewport.getAttribute('style');
    }
    await nodes.first().click();
    await page.waitForTimeout(500);
    result.selected_text = (await page.locator('body').innerText()).slice(-4000);
    await page.screenshot({ path: path.join(outRoot, 'screenshots', `${shotPrefix}-selected-node.png`), fullPage: true });
  }
  await page.screenshot({ path: path.join(outRoot, 'screenshots', `${shotPrefix}-graph.png`), fullPage: true });
  evidence.graph = result;
}

async function submitQuestion(page, question) {
  const input = page.getByRole('textbox', { name: 'Architecture question' });
  if (!await input.isVisible().catch(() => false)) return { question, outcome: 'input-not-visible' };
  await input.fill(question);
  const t0 = nowMs();
  const responsePromise = page.waitForResponse(r => r.url().includes('/api/query') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
  await page.getByRole('button', { name: 'Submit question' }).click();
  const response = await responsePromise;
  if (!response) return { question, outcome: 'no-response', response_ms: nowMs() - t0 };
  let body = null;
  try { body = await response.json(); } catch {}
  await page.waitForTimeout(200);
  const text = (await page.locator('body').innerText()).slice(-8000);
  const matches = body?.matches || body?.results || body?.visual_lenses || [];
  return {
    question,
    status: response.status(),
    response_ms: nowMs() - t0,
    result_count: Array.isArray(matches) ? matches.length : null,
    top_five_labels: Array.isArray(matches) ? matches.slice(0, 5).map(x => x.label || x.title || x.qualified_name || x.id) : [],
    displayed_error: /error|failed|could not|unsupported|insufficient/i.test(text),
    text_excerpt: text.slice(0, 2500),
    outcome: response.ok() ? 'response' : 'http-error',
  };
}

async function docsChecks(page, evidence, shotPrefix) {
  const result = { navigation: 'not-found' };
  const lenses = page.getByRole('button', { name: /^Lenses$/ });
  if (await lenses.isVisible().catch(() => false)) {
    await lenses.click();
    const docs = page.getByRole('button', { name: /Docs Studio/ });
    if (await docs.isVisible().catch(() => false)) {
      const t0 = nowMs();
      await docs.click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(500);
      result.navigation = 'visible-ui';
      result.open_ms = nowMs() - t0;
    }
  }
  result.url = page.url();
  result.text_before = (await page.locator('body').innerText()).slice(0, 8000);
  result.hierarchy_items = await page.locator('button').filter({ hasText: /module|class|function|method/i }).count();
  const outline = page.getByRole('button', { name: /Generate Outline/ });
  if (await outline.isVisible().catch(() => false)) {
    const responsePromise = page.waitForResponse(r => r.url().includes('/api/docs/plan'), { timeout: 20000 }).catch(() => null);
    await outline.click();
    const response = await responsePromise;
    result.outline_status = response?.status() ?? null;
    await page.waitForTimeout(300);
  }
  const markdown = page.getByRole('button', { name: /Generate Markdown/ });
  if (await markdown.isVisible().catch(() => false)) {
    const responses = [];
    const watcher = r => { if (r.url().includes('/api/docs/')) responses.push({ url: r.url(), status: r.status() }); };
    page.on('response', watcher);
    await markdown.click();
    await page.waitForTimeout(2500);
    page.off('response', watcher);
    result.markdown_responses = responses;
  }
  result.text_after = (await page.locator('body').innerText()).slice(0, 12000);
  result.generated_nonempty = /Stored artifact:|source-backed|## /.test(result.text_after);
  result.ai_identified = /AI|generated by|documentation agent/i.test(result.text_after);
  await page.screenshot({ path: path.join(outRoot, 'screenshots', `${shotPrefix}-docs.png`), fullPage: true });
  evidence.docs = result;
}

async function accessibilityChecks(page) {
  return page.evaluate(() => {
    const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const name = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
    const unlabeled = [...document.querySelectorAll('button,input,textarea,select,a[href]')]
      .filter(visible).filter(el => !name(el) && !(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)))
      .map(el => ({ tag: el.tagName, type: el.getAttribute('type'), class: el.className }));
    const landmarks = [...document.querySelectorAll('main,nav,header,footer,aside,[role="main"],[role="navigation"]')].map(el => el.tagName + (el.getAttribute('role') ? `:${el.getAttribute('role')}` : ''));
    const colorOnlyCandidates = [...document.querySelectorAll('svg path,svg line')].filter(visible).length;
    return { unlabeled, landmarks, h1_count: document.querySelectorAll('h1').length, images_missing_alt: [...document.images].filter(i => !i.hasAttribute('alt')).length, color_only_visual_candidates: colorOnlyCandidates };
  });
}

async function keyboardChecks(page) {
  const sequence = [];
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    sequence.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const s = getComputedStyle(el);
      return { tag: el.tagName, name: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 100), outline: s.outline, boxShadow: s.boxShadow };
    }));
  }
  return sequence;
}

async function runPrimary(browserName, viewport, fixtureName, withDetails) {
  const evidence = { browser: browserName, viewport, fixture: fixtureName, console: [], page_errors: [], failed_requests: [], responses: [], websockets: [] };
  let browser;
  try {
    browser = await launch(browserName);
    const context = await browser.newContext({ viewport });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    const page = await context.newPage();
    page.on('console', m => evidence.console.push({ type: m.type(), text: m.text().slice(0, 1000) }));
    page.on('pageerror', e => evidence.page_errors.push(e.message.slice(0, 1000)));
    page.on('requestfailed', r => evidence.failed_requests.push({ method: r.method(), url: r.url(), failure: r.failure()?.errorText }));
    page.on('response', r => { if (r.url().includes('/api/')) evidence.responses.push({ method: r.request().method(), status: r.status(), url: r.url() }); });
    page.on('websocket', ws => {
      const entry = { url: ws.url(), sent: [], received: [], closed: false, error: null };
      evidence.websockets.push(entry);
      ws.on('framesent', e => entry.sent.push(String(e.payload).slice(0, 1000)));
      ws.on('framereceived', e => entry.received.push(String(e.payload).slice(0, 1000)));
      ws.on('close', () => { entry.closed = true; });
      ws.on('socketerror', e => { entry.error = String(e).slice(0, 1000); });
    });
    const loadStart = nowMs();
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });
    evidence.initial_load_ms = nowMs() - loadStart;
    evidence.keyboard = await keyboardChecks(page);
    await analyze(page, fixtureName, evidence);
    await graphChecks(page, evidence, `${browserName}-${viewport.width}x${viewport.height}-${fixtureName}`);
    evidence.accessibility = await accessibilityChecks(page);
    if (withDetails === true) {
      const plannedQueries = queries.filter(q => q[0] === fixtureName).map(q => q[1]);
      evidence.queries = [];
      for (const q of plannedQueries) evidence.queries.push(await submitQuestion(page, q));
      evidence.empty_query = { before: await page.getByRole('textbox', { name: 'Architecture question' }).inputValue().catch(() => null) };
      const questionInput = page.getByRole('textbox', { name: 'Architecture question' });
      if (await questionInput.isVisible().catch(() => false)) {
        await questionInput.fill('   ');
        await page.getByRole('button', { name: 'Submit question' }).click();
        await page.waitForTimeout(300);
        evidence.empty_query.after = await questionInput.inputValue();
      }
      await docsChecks(page, evidence, `${browserName}-${fixtureName}`);
    } else if (withDetails === 'docs') {
      await docsChecks(page, evidence, `${browserName}-${fixtureName}`);
    }
    evidence.refresh = {};
    await page.reload({ waitUntil: 'networkidle' });
    evidence.refresh.url = page.url();
    evidence.refresh.text = (await page.locator('body').innerText()).slice(0, 5000);
    await context.tracing.stop({ path: path.join(outRoot, 'traces', `${browserName}-${viewport.width}x${viewport.height}-${fixtureName}.zip`) });
    await context.close();
    evidence.outcome = 'completed';
  } catch (error) {
    evidence.outcome = 'harness-or-browser-error';
    evidence.error = String(error && error.stack || error).slice(0, 5000);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  fs.writeFileSync(path.join(outRoot, 'logs', `${requestedMode}-${browserName}-${viewport.width}x${viewport.height}-${fixtureName}.json`), JSON.stringify(redact(evidence), null, 2));
  return evidence;
}

(async () => {
  const mode = requestedMode;
  const matrix = mode === 'matrix';
  const docsOnly = mode === 'docs';
  const runs = matrix ? [
    ['chromium', { width: 1280, height: 720 }, 'python', false],
    ['chromium', { width: 768, height: 1024 }, 'python', false],
    ['chromium', { width: 390, height: 844 }, 'python', false],
    ['firefox', { width: 1440, height: 900 }, 'typescript', false],
    ['webkit', { width: 1440, height: 900 }, 'mixed', false],
  ] : docsOnly ? [
    ['chromium', { width: 1440, height: 900 }, 'python', 'docs'],
    ['chromium', { width: 1440, height: 900 }, 'typescript', 'docs'],
    ['chromium', { width: 1440, height: 900 }, 'mixed', 'docs'],
  ] : [
    ['chromium', { width: 1440, height: 900 }, 'python', true],
    ['chromium', { width: 1440, height: 900 }, 'typescript', true],
    ['chromium', { width: 1440, height: 900 }, 'mixed', true],
  ];
  const summary = [];
  for (const args of runs) summary.push(await runPrimary(...args));
  const summaryName = matrix ? 'matrix-summary.json' : docsOnly ? 'docs-summary.json' : 'primary-summary.json';
  fs.writeFileSync(path.join(outRoot, 'logs', summaryName), JSON.stringify(redact(summary.map(x => ({ browser: x.browser, viewport: x.viewport, fixture: x.fixture, outcome: x.outcome, error: x.error, graph: x.graph, analysis: x.analysis, docs: x.docs }))), null, 2));
})().catch(error => { console.error(error); process.exit(1); });
