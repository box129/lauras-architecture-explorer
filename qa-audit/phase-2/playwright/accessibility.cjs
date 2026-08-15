const { chromium } = require('../../../syntax-tree-ui/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const out = path.join(root, 'qa-audit', 'phase-2');
const browserPath = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const evidence = { keyboard: {}, invalid_path: {}, contrast: {} };
  const invalidResponses = [];
  page.on('response', response => {
    if (response.url().includes('/api/')) invalidResponses.push({ method: response.request().method(), status: response.status(), url: response.url() });
  });
  await page.goto('http://127.0.0.1:5473', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  evidence.keyboard.input_focused = await page.locator('#observatory-repo-path').evaluate(el => el === document.activeElement);
  evidence.keyboard.focus_style = await page.locator('#observatory-repo-path').evaluate(el => {
    const s = getComputedStyle(el); return { outline: s.outline, box_shadow: s.boxShadow, border_color: s.borderColor };
  });
  await page.keyboard.type(path.join(root, 'qa-audit', 'phase-2', 'fixtures', 'python-nested'));
  await page.screenshot({ path: path.join(out, 'screenshots', 'keyboard-focus-input.png'), fullPage: true });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  evidence.keyboard.enter_submitted = /Architecture map/i.test(await page.locator('body').innerText());

  await page.goto('http://127.0.0.1:5473', { waitUntil: 'networkidle' });
  await page.locator('#observatory-repo-path').fill(path.join(root, 'qa-audit', 'phase-2', 'fixtures', 'does-not-exist'));
  await page.getByRole('button', { name: 'Build architecture map' }).click();
  await page.waitForTimeout(800);
  evidence.invalid_path.body_text = (await page.locator('body').innerText()).slice(-2000);
  evidence.invalid_path.api_responses = invalidResponses;
  evidence.invalid_path.live_regions = await page.locator('[role="alert"],[aria-live]').evaluateAll(els => els.map(e => ({ role: e.getAttribute('role'), live: e.getAttribute('aria-live'), text: e.textContent.trim() })));

  evidence.contrast = await page.evaluate(() => {
    const parse = value => { const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? m.slice(1).map(Number) : null; };
    const lum = rgb => { const c = rgb.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
    const ratio = (a,b) => { const x=lum(a), y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
    const bg = el => { for(let n=el;n;n=n.parentElement){ const c=parse(getComputedStyle(n).backgroundColor); if(c && getComputedStyle(n).backgroundColor !== 'rgba(0, 0, 0, 0)') return c; } return [255,255,255]; };
    const samples=[];
    for(const el of document.querySelectorAll('body *')) {
      if(!(el.offsetWidth||el.offsetHeight) || el.children.length || !el.textContent.trim()) continue;
      const fg=parse(getComputedStyle(el).color); if(!fg) continue;
      const r=ratio(fg,bg(el)); const size=parseFloat(getComputedStyle(el).fontSize); const weight=parseInt(getComputedStyle(el).fontWeight)||400;
      const threshold=(size>=24 || (size>=18.66 && weight>=700)) ? 3 : 4.5;
      if(r < threshold) samples.push({ tag:el.tagName, text:el.textContent.trim().slice(0,100), ratio:Number(r.toFixed(2)), threshold });
    }
    return { tested_text_nodes: document.querySelectorAll('body *').length, failures: samples.slice(0,100), failure_count: samples.length };
  });
  fs.writeFileSync(path.join(out, 'logs', 'accessibility.json'), JSON.stringify(evidence, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
