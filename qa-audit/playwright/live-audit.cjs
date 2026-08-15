const { chromium } = require('../../syntax-tree-ui/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const out = path.resolve(__dirname, '..');
  const evidence = { startedAt: new Date().toISOString(), console: [], pageErrors: [], failedRequests: [], responses: [], actions: [] };
  const browserRoot = path.join(process.env.LOCALAPPDATA, 'ms-playwright');
  const installed = fs.readdirSync(browserRoot).filter(n => /^chromium-\d+$/.test(n)).sort().at(-1);
  const executablePath = path.join(browserRoot, installed, 'chrome-win64', 'chrome.exe');
  const browser = await chromium.launch({ headless: false, executablePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: path.join(out, 'traces') } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const page = await context.newPage();
  page.on('console', m => evidence.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => evidence.pageErrors.push(String(e)));
  page.on('requestfailed', r => evidence.failedRequests.push({ url: r.url(), method: r.method(), failure: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400 || r.url().includes('/api/')) evidence.responses.push({ url: r.url(), status: r.status(), method: r.request().method() }); });
  const start = Date.now();
  await page.goto('http://127.0.0.1:5273', { waitUntil: 'networkidle', timeout: 30000 });
  evidence.loadMs = Date.now() - start;
  evidence.title = await page.title();
  evidence.url = page.url();
  evidence.bodyText = (await page.locator('body').innerText()).slice(0, 20000);
  evidence.controls = await page.locator('button,input,a,[role=button]').evaluateAll(els => els.map(e => ({ tag:e.tagName, text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').trim(), type:e.getAttribute('type'), href:e.getAttribute('href') })));
  await page.screenshot({ path: path.join(out, 'screenshots', '01-initial-load.png'), fullPage: true });

  const inputs = page.locator('input');
  evidence.inputCount = await inputs.count();
  for (let i=0;i<evidence.inputCount;i++) evidence.actions.push({ input:i, placeholder:await inputs.nth(i).getAttribute('placeholder'), aria:await inputs.nth(i).getAttribute('aria-label') });

  const candidates = ['Build architecture map','Analyze repository','Analyze Repository','Analyze','Open repository','Submit'];
  const repoPath = process.env.AUDIT_REPO_PATH || path.resolve(__dirname, '..', '..', 'syntax-tree-refurbished-backend');
  if (evidence.inputCount) {
    await inputs.first().fill(repoPath);
    evidence.actions.push({ filled: repoPath });
    for (const name of candidates) {
      const b = page.getByRole('button', { name, exact: false });
      if (await b.count()) {
        await b.first().click();
        evidence.actions.push({ clicked: name });
        await page.waitForTimeout(15000);
        break;
      }
    }
    evidence.afterSubmitText = (await page.locator('body').innerText()).slice(0, 20000);
    await page.screenshot({ path: path.join(out, 'screenshots', '02-after-submission.png'), fullPage: true });
  }
  await page.setViewportSize({ width: 800, height: 900 });
  await page.screenshot({ path: path.join(out, 'screenshots', '03-narrow.png'), fullPage: true });
  await context.tracing.stop({ path: path.join(out, 'traces', 'chromium-trace.zip') });
  fs.writeFileSync(path.join(out, 'logs', 'live-browser-evidence.json'), JSON.stringify(evidence, null, 2));
  await context.close();
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
