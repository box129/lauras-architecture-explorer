const { chromium } = require('../../../syntax-tree-ui/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const out = path.join(root, 'qa-audit', 'phase-2');
const base = 'http://127.0.0.1:5473';
const executablePath = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe');
const fixture = name => path.join(root, 'qa-audit', 'phase-2', 'fixtures', name);

async function submit(page, fixturePath) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('#observatory-repo-path').fill(fixturePath);
  const responsePromise = page.waitForResponse(r => r.url().includes('/api/analyze') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Build architecture map' }).click();
  const response = await responsePromise;
  return { status: response.status(), body: await response.json() };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const evidence = { orientation_requests: [], simultaneous_duplicate: {}, persistence: {}, switching: {} };
  const page1 = await context.newPage();
  const first = await submit(page1, fixture('python-nested'));
  const runId = first.body.run_id;
  evidence.first = { status: first.status, run_id: runId };
  const orientationUrl = `${base}/api/runs/${encodeURIComponent(runId)}/orientation`;
  const concurrent = await Promise.all(Array.from({ length: 12 }, async (_, i) => {
    const started = Date.now();
    const response = await context.request.get(orientationUrl);
    return { index: i, status: response.status(), elapsed_ms: Date.now() - started };
  }));
  evidence.orientation_requests.push(...concurrent);

  const page2 = await context.newPage();
  const page3 = await context.newPage();
  const [dup1, dup2] = await Promise.all([
    submit(page2, fixture('typescript-small')),
    submit(page3, fixture('typescript-small')),
  ]);
  evidence.simultaneous_duplicate = {
    statuses: [dup1.status, dup2.status],
    run_ids: [dup1.body.run_id, dup2.body.run_id],
    same_run_id: dup1.body.run_id === dup2.body.run_id,
  };
  await page1.waitForTimeout(3000);
  await page1.reload({ waitUntil: 'networkidle' });
  evidence.persistence.refresh_landing = await page1.locator('#observatory-repo-path').isVisible().catch(() => false);
  evidence.persistence.refresh_text = (await page1.locator('body').innerText()).slice(0, 1200);
  await page1.close();
  const reopened = await context.newPage();
  await reopened.goto(base, { waitUntil: 'networkidle' });
  evidence.persistence.reopened_landing = await reopened.locator('#observatory-repo-path').isVisible().catch(() => false);

  const mixed = await submit(reopened, fixture('mixed-moderate'));
  await reopened.waitForTimeout(5000);
  const mixedText = await reopened.locator('body').innerText();
  evidence.switching = {
    new_run_id: mixed.body.run_id,
    shows_mixed: /mixed-moderate/i.test(mixedText),
    shows_python: /python-nested/i.test(mixedText),
    shows_typescript: /typescript-small/i.test(mixedText),
  };
  await reopened.screenshot({ path: path.join(out, 'screenshots', 'switching-stale-isolation.png'), fullPage: true });
  await context.tracing.stop({ path: path.join(out, 'traces', 'recovery-qa006.zip') });
  fs.writeFileSync(path.join(out, 'logs', 'recovery-qa006.json'), JSON.stringify(evidence, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
