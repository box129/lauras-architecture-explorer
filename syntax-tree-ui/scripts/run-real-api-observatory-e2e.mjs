import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.resolve(uiRoot, '..');
const positionalArgs = process.argv.slice(2).filter((value) => !value.startsWith('--'));
const backendRoot = readArg('--backend-root') ?? path.join(workspaceRoot, 'syntax-tree');
const repoPath = readArg('--repo') ?? positionalArgs[0] ?? path.join(workspaceRoot, 'syntax-tree-e2e-fixtures', 'junior-dev-productivity-suite');
const scope = readArg('--scope') ?? 'backend';
const artifactRoot = readArg('--artifact-root') ?? positionalArgs[1] ?? path.join(workspaceRoot, 'syntax-tree-test-artifacts', `e2e-brutal-qa-${timestamp()}`);
const backendPort = Number(readArg('--backend-port') ?? 8000);
const frontendPort = Number(readArg('--frontend-port') ?? 5173);
const timeoutMs = Number(readArg('--timeout-ms') ?? positionalArgs[2] ?? 900_000);
const analysisMode = readFlag('--validation') ? 'validation' : 'standard';
const requireLlm = readFlag('--live-llm') || analysisMode === 'validation';
const model = readArg('--model') ?? '';
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE;
const baseUrl = `http://127.0.0.1:${frontendPort}`;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const runLabel = `${scope}-${analysisMode}`;
const artifactDir = path.join(artifactRoot, 'frontend-real-api-observatory', runLabel);
const screenshotDir = path.join(artifactDir, 'screenshots');
const videoDir = path.join(artifactDir, 'video');
const logDir = path.join(artifactDir, 'logs');

const consoleEvents = [];
const networkEvents = [];
const blockers = [];
const notes = [];

await mkdir(screenshotDir, { recursive: true });
await mkdir(videoDir, { recursive: true });
await mkdir(logDir, { recursive: true });

const backend = startBackend();
const frontend = startFrontend();
let browser;
let context;

try {
  await waitForUrl(`${backendUrl}/docs`, 90_000, 'backend');
  await waitForUrl(baseUrl, 90_000, 'frontend');

  browser = await chromium.launch({
    executablePath: browserExecutable && existsSync(browserExecutable) ? browserExecutable : undefined,
    headless: true,
  });
  context = await browser.newContext({
    viewport: { width: 1536, height: 960 },
    recordVideo: { dir: videoDir, size: { width: 1536, height: 960 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  wireDiagnostics(page);

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await screenshot(page, '01-entry-1536x960.png');
  await page.locator('#observatory-repo-path').fill(repoPath);

  if (scope === 'full_repo' || analysisMode === 'validation' || requireLlm || model) {
    await page.getByText('Advanced analysis settings').click();
    if (scope === 'full_repo') {
      await page.getByRole('button', { name: /^Full repo$/ }).click();
    }
    if (analysisMode === 'validation') {
      await page.getByRole('button', { name: /^Validation$/ }).click();
    }
    if (requireLlm && analysisMode !== 'validation') {
      const checkbox = page.getByLabel('Require live LLM explanations');
      if (!(await checkbox.isChecked())) await checkbox.check();
    }
    if (model) await page.locator('#observatory-model').fill(model);
  }

  await page.getByRole('button', { name: /Build architecture map/i }).click();
  await maybeScreenshot(page, '.observatory-progress', '02-analysis-progress-1536x960.png', 8_000);
  await waitForOrientation(page);
  await waitForAnalysis(page);
  await page.locator('.observatory-shell').waitFor({ timeout: 60_000 });
  await assertOrientationVisible(page);
  await screenshot(page, '03-root-architecture-map-1536x960.png');
  await captureViewports(page, 'root-architecture-map');

  const rootAudit = await auditCurrentBackendState();
  await writeFile(path.join(logDir, 'backend-state.json'), JSON.stringify(rootAudit, null, 2));

  await inspectArchitectureNodes(page);
  await inspectFlow(page);
  await askQuestions(page);
  await inspectSavedLensesAndDocs(page);
  await screenshot(page, '99-final-state-1536x960.png');

  const video = page.video();
  await context.close();
  context = null;
  if (video) {
    await copyFile(await video.path(), path.join(videoDir, `real-api-observatory-${runLabel}.webm`));
  }
} catch (error) {
  blockers.push(`runner_error: ${error instanceof Error ? error.message : String(error)}`);
  if (context) {
    const pages = context.pages();
    if (pages[0]) await screenshot(pages[0], 'error-state-1536x960.png').catch(() => undefined);
    await context.close().catch(() => undefined);
    context = null;
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  stopProcessTree(frontend, frontendPort);
  stopProcessTree(backend, backendPort);
  await writeDiagnostics();
}

function startBackend() {
  const python = existsSync(path.join(backendRoot, '.venv', 'Scripts', 'python.exe'))
    ? path.join(backendRoot, '.venv', 'Scripts', 'python.exe')
    : 'python';
  const child = spawn(python, ['-m', 'uvicorn', 'syntax_tree.api.app:app', '--host', '127.0.0.1', '--port', String(backendPort)], {
    cwd: backendRoot,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: {
      ...process.env,
      ...(requireLlm ? {} : { SYNTAX_TREE_LLM_POLICY: 'off' }),
    },
  });
  collectProcessLog(child, 'backend');
  return child;
}

function startFrontend() {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
    cwd: uiRoot,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  collectProcessLog(child, 'frontend');
  return child;
}

function collectProcessLog(child, name) {
  const rows = [];
  child.stdout?.on('data', (chunk) => rows.push(mask(chunk.toString())));
  child.stderr?.on('data', (chunk) => rows.push(mask(chunk.toString())));
  child.on('close', (code) => rows.push(`\n[${name} exited ${code}]\n`));
  child._qaRows = rows;
}

async function waitForUrl(url, timeout, label) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

async function waitForAnalysis(page) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await page.locator('.observatory-shell').count()) return;
    const failed = await page.getByText(/Scan stopped|Analysis failed|Could not start analysis/i).count();
    if (failed) {
      await screenshot(page, 'analysis-failed-1536x960.png');
      throw new Error('Browser analysis failed before Observatory opened.');
    }
    await delay(1000);
  }
  await screenshot(page, 'analysis-timeout-1536x960.png');
  throw new Error(`Analysis did not complete within ${timeoutMs}ms.`);
}

async function waitForOrientation(page) {
  try {
    await page.locator('.repo-orientation').waitFor({ timeout: 30_000 });
    await screenshot(page, '02a-repo-orientation-1536x960.png');
  } catch {
    notes.push('orientation panel did not appear before final map; checking after Observatory opens');
  }
}

async function assertOrientationVisible(page) {
  try {
    await page.locator('.repo-orientation').waitFor({ timeout: 15_000 });
    const text = await page.locator('.repo-orientation').first().innerText();
    if (!/Orientation|repository|repo|application|tool|library/i.test(text)) {
      blockers.push('orientation panel rendered without recognizable orientation text');
    }
    await screenshot(page, '03a-orientation-after-map-1536x960.png');
  } catch (error) {
    blockers.push(`orientation panel was not visible in the real API journey: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function inspectArchitectureNodes(page) {
  const nodes = page.locator('.obs-rf-node');
  const count = await nodes.count();
  if (!count) {
    blockers.push('root map rendered without visible architecture nodes');
    return;
  }
  const limit = Math.min(count, 8);
  for (let index = 0; index < limit; index += 1) {
    const node = nodes.nth(index);
    const label = await node.innerText().catch(() => `node-${index + 1}`);
    await node.click({ modifiers: ['Alt'] }).catch((error) => {
      blockers.push(`could not select architecture node ${index + 1}: ${error.message}`);
    });
    await page.waitForTimeout(900);
    await screenshot(page, `04-node-${index + 1}-${slug(label)}.png`);
    await openProofIfAvailable(page, `05-proof-node-${index + 1}-${slug(label)}.png`);
  }

  const drillNode = page.locator('.obs-rf-node').first();
  await drillNode.click().catch(() => undefined);
  await page.waitForTimeout(1500);
  await screenshot(page, '06-child-lens-or-selected-node-1536x960.png');
}

async function openProofIfAvailable(page, name) {
  const proof = page.getByRole('button', { name: /View source proof|Open source proof for claim/i }).first();
  if (!(await proof.count())) {
    notes.push(`proof button not available for ${name}`);
    return false;
  }
  await proof.click().catch((error) => {
    blockers.push(`proof click failed for ${name}: ${error.message}`);
  });
  await page.waitForTimeout(1800);
  await screenshot(page, name);
  const codeVisible = await page.locator('.obs-code-companion').count();
  if (!codeVisible) blockers.push(`Code Companion did not open for ${name}`);
  return Boolean(codeVisible);
}

async function inspectFlow(page) {
  const related = page.locator('.obs-flow-chip-list button').first();
  if (!(await related.count())) {
    notes.push('no related flow chip was visible from selected architecture nodes');
    return;
  }
  await related.click();
  await page.waitForTimeout(1500);
  await screenshot(page, '07-flow-lens-1536x960.png');
  await openProofIfAvailable(page, '08-flow-proof-1536x960.png');
  const steps = page.locator('.obs-flow-step-node, .react-flow__node');
  const count = Math.min(await steps.count(), 6);
  for (let index = 0; index < count; index += 1) {
    await steps.nth(index).click().catch(() => undefined);
    await page.waitForTimeout(600);
    await screenshot(page, `09-flow-step-${index + 1}.png`);
    await openProofIfAvailable(page, `10-flow-step-proof-${index + 1}.png`);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
}

async function askQuestions(page) {
  await closeProofIfOpen(page);
  const questions = [
    'How does login work?',
    'How does a task get created from the UI?',
    'How does document upload reach the assistant answer?',
    'Does this app use Kafka or blockchain?',
    'Is the model trained on uploaded documents?',
  ];
  for (let index = 0; index < questions.length; index += 1) {
    const input = page.locator('textarea[aria-label="Architecture question"]');
    if (!(await input.count())) {
      notes.push(`question dock unavailable for question ${index + 1}`);
      return;
    }
    await input.fill(questions[index]);
    await input.press('Enter');
    await page.waitForTimeout(4000);
    await screenshot(page, `11-question-${index + 1}-${slug(questions[index])}.png`);
    await openProofIfAvailable(page, `12-question-proof-${index + 1}.png`);
    const save = page.getByRole('button', { name: /^Save Lens$/ }).first();
    if (await save.count()) await save.click().catch(() => undefined);
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(700);
  }
}

async function closeProofIfOpen(page) {
  const closeProof = page.getByRole('button', { name: /Close proof/i }).first();
  if (await closeProof.count()) {
    await closeProof.click().catch(() => undefined);
    await page.waitForTimeout(500);
  }
}

async function inspectSavedLensesAndDocs(page) {
  const drawerTab = page.locator('.obs-lens-drawer-tab');
  if (await drawerTab.count()) await drawerTab.click();
  await page.waitForTimeout(700);
  await screenshot(page, '13-saved-lenses-drawer-1536x960.png');

  const saveCurrent = page.getByRole('button', { name: /^Save Lens$/ }).first();
  if (await saveCurrent.count()) await saveCurrent.click().catch(() => undefined);
  const createTour = page.getByRole('button', { name: /^Create$/ }).first();
  if (await createTour.count()) await createTour.click().catch(() => undefined);
  const playTour = page.locator('.obs-tour-play').first();
  if (await playTour.count()) await playTour.click().catch(() => undefined);
  await page.waitForTimeout(900);
  await screenshot(page, '14-tour-playback-1536x960.png');

  const docs = page.getByRole('button', { name: /Docs Studio/i }).first();
  if (!(await docs.count())) {
    blockers.push('Docs Studio button was not available from saved lenses drawer');
    return;
  }
  await docs.click();
  await page.waitForTimeout(1600);
  await screenshot(page, '15-docs-studio-1536x960.png');
  const outline = page.getByRole('button', { name: /Generate Outline/i }).first();
  if (await outline.count()) await outline.click().catch((error) => blockers.push(`Generate Outline failed: ${error.message}`));
  await page.waitForTimeout(2500);
  await screenshot(page, '16-docs-outline-1536x960.png');
  const markdown = page.getByRole('button', { name: /Generate Markdown/i }).first();
  if (await markdown.count()) await markdown.click().catch((error) => blockers.push(`Generate Markdown failed: ${error.message}`));
  await page.waitForTimeout(3000);
  await screenshot(page, '17-docs-markdown-1536x960.png');
}

async function captureViewports(page, baseName) {
  for (const [width, height] of [[1366, 768], [1536, 960], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(800);
    await screenshot(page, `${baseName}-${width}x${height}.png`);
  }
  await page.setViewportSize({ width: 1536, height: 960 });
}

async function auditCurrentBackendState() {
  const payload = {};
  for (const endpoint of ['/api/architecture-map', '/api/flows?limit=50']) {
    try {
      const response = await fetch(`${backendUrl}${endpoint}`);
      payload[endpoint] = { status: response.status, body: await response.json().catch(() => null) };
    } catch (error) {
      payload[endpoint] = { error: error instanceof Error ? error.message : String(error) };
    }
  }
  return payload;
}

function wireDiagnostics(page) {
  page.on('console', (message) => {
    consoleEvents.push({ type: message.type(), text: mask(message.text()) });
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/')) {
      networkEvents.push({ method: response.request().method(), url: scrubUrl(url), status: response.status() });
    }
  });
  page.on('requestfailed', (request) => {
    networkEvents.push({ method: request.method(), url: scrubUrl(request.url()), failed: request.failure()?.errorText ?? 'request failed' });
  });
  page.on('pageerror', (error) => {
    blockers.push(`browser_page_error: ${mask(error.message)}`);
  });
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

async function maybeScreenshot(page, selector, name, timeout) {
  try {
    await page.locator(selector).waitFor({ timeout });
    await screenshot(page, name);
  } catch {
    notes.push(`screenshot skipped because ${selector} did not appear: ${name}`);
  }
}

async function writeDiagnostics() {
  await writeFile(path.join(logDir, 'browser-console.json'), JSON.stringify(consoleEvents, null, 2));
  await writeFile(path.join(logDir, 'network-summary.json'), JSON.stringify(networkEvents, null, 2));
  await writeFile(path.join(logDir, 'backend-server.log'), (backend._qaRows ?? []).join(''));
  await writeFile(path.join(logDir, 'frontend-server.log'), (frontend._qaRows ?? []).join(''));
  await writeFile(path.join(artifactDir, 'frontend-real-api-observatory.md'), qaMarkdown());
}

function qaMarkdown() {
  return [
    '# Real API Observatory E2E',
    '',
    `- Repo: \`${repoPath}\``,
    `- Scope: \`${scope}\``,
    `- Analysis mode: \`${analysisMode}\``,
    `- Require LLM: \`${requireLlm}\``,
    `- Frontend: \`${baseUrl}\``,
    `- Backend: \`${backendUrl}\``,
    '',
    '## Blockers',
    ...(blockers.length ? blockers.map((item) => `- ${item}`) : ['- None recorded by runner.']),
    '',
    '## Notes',
    ...(notes.length ? notes.map((item) => `- ${item}`) : ['- None.']),
    '',
    '## Artifacts',
    `- Screenshots: \`${screenshotDir}\``,
    `- Video: \`${videoDir}\``,
    `- Logs: \`${logDir}\``,
    '',
  ].join('\n');
}

function stopProcessTree(child, port) {
  if (!child) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    spawnSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$owners = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($owner in $owners) { Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue }`,
    ], { stdio: 'ignore', windowsHide: true });
  } else {
    child.kill('SIGTERM');
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function readFlag(name) {
  return process.argv.includes(name);
}

function timestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'item';
}

function scrubUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/key|token|secret|authorization/i.test(key)) url.searchParams.set(key, '***');
    }
    return url.toString();
  } catch {
    return mask(value);
  }
}

function mask(value) {
  return String(value)
    .replace(/(sk-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/g, '$1***')
    .replace(/(BLACKBOX_API_KEY|OPENROUTER_API_KEY|OPENROUTER_API_KEY_2)\s*=\s*[^\s]+/gi, '$1=***')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
