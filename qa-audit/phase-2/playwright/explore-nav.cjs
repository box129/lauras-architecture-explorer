const { chromium } = require('../../../syntax-tree-ui/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async()=>{
 const root=path.resolve(__dirname,'../../..');
 const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright');
 const rev=fs.readdirSync(cache).filter(n=>/^chromium-\d+$/.test(n)).sort().at(-1);
 const browser=await chromium.launch({headless:true,executablePath:path.join(cache,rev,'chrome-win64','chrome.exe')});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:5473',{waitUntil:'networkidle'});
 await page.locator('#observatory-repo-path').fill(path.join(root,'qa-audit','phase-2','fixtures','typescript-small'));
 await page.getByRole('button',{name:'Build architecture map'}).click();
 await page.waitForTimeout(5000);
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.waitForTimeout(500);
 const data={text:(await page.locator('body').innerText()).slice(0,30000),controls:await page.locator('button,a,input,[role=button],[role=tab]').evaluateAll(es=>es.map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('title')||e.getAttribute('placeholder')||'').trim(),href:e.getAttribute('href')})))};
 fs.writeFileSync(path.join(root,'qa-audit','phase-2','logs','explore-nav.json'),JSON.stringify(data,null,2));
 await page.screenshot({path:path.join(root,'qa-audit','phase-2','screenshots','explore-nav.png'),fullPage:true});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
