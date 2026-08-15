const { chromium } = require('../../../syntax-tree-ui/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const out = path.join(root, 'qa-audit', 'phase-2');
const browserPath = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe');
const base = 'http://127.0.0.1:5473';
const cases = [
  ['python-nested','where is repository analysis started','main'],
  ['python-nested','what parses Python files','Parser'],
  ['python-nested','how are dependencies stored','Document'],
  ['python-nested','which component handles errors','Parser'],
  ['python-nested','where is documentation generated','service'],
  ['python-nested','where is the Parser class defined','Parser'],
  ['python-nested','what calls parse_document','AnalysisService'],
  ['typescript-small','where is repository analysis started','index'],
  ['typescript-small','what parses TypeScript files','Parser'],
  ['typescript-small','how are dependencies stored','types'],
  ['typescript-small','which component handles errors','analyzer'],
  ['typescript-small','where is documentation generated','docs'],
  ['typescript-small','where is Analyzer defined','Analyzer'],
  ['typescript-small','what imports parser','index'],
  ['mixed-moderate','where is repository analysis started','api'],
  ['mixed-moderate','what validates tasks','validator'],
  ['mixed-moderate','how are dependencies stored','repository'],
  ['mixed-moderate','which component handles errors','errors'],
  ['mixed-moderate','where is documentation generated','reporting'],
  ['mixed-moderate','find TaskService','TaskService'],
];

async function one(context, testCase, index) {
  const [fixture, query, expected] = testCase;
  const page = await context.newPage();
  const result = { index: index + 1, fixture, query, expected_top_five: expected };
  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    await page.locator('#observatory-repo-path').fill(path.join(root, 'qa-audit', 'phase-2', 'fixtures', fixture));
    const analyze = page.waitForResponse(r => r.url().includes('/api/analyze') && r.request().method() === 'POST', { timeout: 15000 });
    await page.getByRole('button', { name: 'Build architecture map' }).click();
    result.analysis_status = (await analyze).status();
    const input = page.getByRole('textbox', { name: 'Architecture question' });
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.fill(query);
    const started = Date.now();
    const queryResponse = page.waitForResponse(r => r.url().includes('/api/query') && r.request().method() === 'POST', { timeout: 5000 }).catch(() => null);
    await page.getByRole('button', { name: 'Submit question' }).click();
    const response = await queryResponse;
    result.response_ms = Date.now() - started;
    result.status = response?.status() ?? null;
    result.outcome = response ? 'response' : 'timeout-no-response';
    result.submit_disabled = await page.getByRole('button', { name: 'Submit question' }).isDisabled().catch(() => null);
    result.top_five = [];
    result.top_five_success = false;
  } catch (error) {
    result.outcome = 'harness-error';
    result.error = String(error).slice(0, 1000);
    result.top_five = [];
    result.top_five_success = false;
  } finally {
    await page.close();
  }
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const results = [];
  for (let start = 0; start < cases.length; start += 4) {
    results.push(...await Promise.all(cases.slice(start, start + 4).map((c, i) => one(context, c, start + i))));
  }
  const emptyPage = await context.newPage();
  await emptyPage.goto(base, { waitUntil: 'networkidle' });
  await emptyPage.locator('#observatory-repo-path').fill(path.join(root, 'qa-audit', 'phase-2', 'fixtures', 'python-nested'));
  const analysis = emptyPage.waitForResponse(r => r.url().includes('/api/analyze') && r.request().method() === 'POST');
  await emptyPage.getByRole('button', { name: 'Build architecture map' }).click();
  await analysis;
  const question = emptyPage.getByRole('textbox', { name: 'Architecture question' });
  await question.fill('   ');
  let emptyRequests = 0;
  emptyPage.on('request', r => { if (r.url().includes('/api/query')) emptyRequests += 1; });
  await emptyPage.getByRole('button', { name: 'Submit question' }).click();
  await emptyPage.waitForTimeout(300);
  await emptyPage.screenshot({ path: path.join(out, 'screenshots', 'semantic-search-stalled.png'), fullPage: true });
  await context.tracing.stop({ path: path.join(out, 'traces', 'semantic-20.zip') });
  fs.writeFileSync(path.join(out, 'logs', 'semantic-20.json'), JSON.stringify({
    cases: results,
    successful_top_five: results.filter(r => r.top_five_success).length,
    denominator: results.length,
    top_five_success_rate: `${results.filter(r => r.top_five_success).length}/${results.length}`,
    empty_or_whitespace_query_requests: emptyRequests,
  }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
