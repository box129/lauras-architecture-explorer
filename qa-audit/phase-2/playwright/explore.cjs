const { chromium } = require('../../../syntax-tree-ui/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const root = path.resolve(__dirname, '../../..');
  const browserRoot = path.join(process.env.LOCALAPPDATA, 'ms-playwright');
  const installed = fs.readdirSync(browserRoot).filter(n => /^chromium-\d+$/.test(n)).sort().at(-1);
  const executablePath = path.join(browserRoot, installed, 'chrome-win64', 'chrome.exe');
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const evidence = { console: [], responses: [], snapshots: [] };
  page.on('console', m => evidence.console.push({ type: m.type(), text: m.text() }));
  page.on('response', r => { if (r.url().includes('/api/')) evidence.responses.push({ status:r.status(), url:r.url(), method:r.request().method() }); });
  await page.goto('http://127.0.0.1:5473', { waitUntil:'networkidle' });
  await page.locator('#observatory-repo-path').fill(path.join(root, 'qa-audit', 'phase-2', 'fixtures', 'python-nested'));
  await page.getByRole('button', { name:'Build architecture map' }).click();
  for (const seconds of [0, 2, 5, 10, 20, 40]) {
    if (seconds) await page.waitForTimeout((seconds - evidence.snapshots.at(-1).seconds) * 1000);
    evidence.snapshots.push({ seconds, url:page.url(), text:(await page.locator('body').innerText()).slice(0,30000) });
  }
  evidence.controls = await page.locator('button,a,input,[role=button],[role=tab]').evaluateAll(els => els.map(e => ({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('title')||e.getAttribute('placeholder')||'').trim(),role:e.getAttribute('role'),href:e.getAttribute('href'),disabled:e.disabled})));
  fs.writeFileSync(path.join(root,'qa-audit','phase-2','logs','explore.json'),JSON.stringify(evidence,null,2));
  await page.screenshot({path:path.join(root,'qa-audit','phase-2','screenshots','explore-40s.png'),fullPage:true});
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
