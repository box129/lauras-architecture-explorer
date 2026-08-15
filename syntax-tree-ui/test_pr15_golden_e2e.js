// PR15 Golden End-To-End QA
// Live Playwright run against the refurbished backend and current frontend.
//
// All product actions are driven through the frontend. The script also observes
// network responses and run metrics so the final grading can be source-backed.

import { chromium } from '@playwright/test';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SYNTAX_TREE_WORKSPACE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND_DIR = path.join(ROOT, 'syntax-tree-refurbished-backend');
const FRONTEND_DIR = path.join(ROOT, 'syntax-tree-ui');
const REPORT_DIR = path.join(BACKEND_DIR, 'docs', 'pr15_screenshots');
const ARTIFACT_DIR = path.join(BACKEND_DIR, 'docs', 'pr15_artifacts');
const SKETCHBOOK = path.join(BACKEND_DIR, 'docs', 'PR15_SKETCHBOOK.md');
const LOG_FILE = path.join(BACKEND_DIR, 'docs', 'PR15_TEST_LOG.txt');
const FRONTEND_PORT = 5173;
const BACKEND_PORT = 8000;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const TOKEN_BUDGET = 2_000_000;
const TOKEN_STOP_AT = 1_850_000;
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE;

const REPOS = [
  {
    name: 'axios',
    path: path.join(ROOT, 'bench-repos', 'axios'),
    groundTruth: {
      subsystems: [
        'Axios class',
        'InterceptorManager',
        'dispatchRequest',
        'Adapter layer',
        'Cancel mechanism',
        'Config merging',
        'AxiosHeaders',
        'Transform pipeline',
        'Helpers',
        'Defaults',
      ],
      files: [
        'lib/core/Axios.js',
        'lib/core/InterceptorManager.js',
        'lib/core/dispatchRequest.js',
        'lib/adapters/adapters.js',
        'lib/adapters/http.js',
        'lib/adapters/xhr.js',
        'lib/adapters/fetch.js',
        'lib/cancel/CancelToken.js',
        'lib/cancel/CanceledError.js',
        'lib/core/mergeConfig.js',
        'lib/core/AxiosHeaders.js',
        'lib/core/transformData.js',
        'lib/defaults/index.js',
      ],
      relationships: [
        'Axios.request merges config before dispatch',
        'Request interceptors run before dispatchRequest',
        'Response interceptors run after dispatchRequest',
        'dispatchRequest chooses an adapter',
        'Adapters implement http/xhr/fetch transport',
        'CancelToken or AbortSignal can stop requests',
      ],
      edgeCases: [
        'synchronous request interceptor fast path',
        'legacyInterceptorReqResOrdering transitional flag',
        'null-prototype config object',
        'adapter fallback rejection reasons',
        'formToJSON helper',
      ],
    },
    questions: [
      'What is the interceptor chain and how does it process requests?',
      'How does axios handle request cancellation?',
      'What adapters does axios support and how does it choose one?',
      'How does config merging work between instance defaults and per-request config?',
      'What is the purpose of AxiosHeaders and how does it differ from plain objects?',
    ],
    expectedAnswers: [
      ['InterceptorManager', 'request interceptors', 'response interceptors', 'dispatchRequest', 'synchronous'],
      ['CancelToken', 'AbortSignal', 'throwIfCancellationRequested', 'CanceledError'],
      ['http', 'xhr', 'fetch', 'getAdapter', 'adapter'],
      ['mergeConfig', 'defaults', 'request config', 'headers', 'null'],
      ['AxiosHeaders', 'case-insensitive', 'set', 'get', 'content-type'],
    ],
  },
  {
    name: 'full-stack-fastapi-template',
    path: path.join(ROOT, 'bench-repos', 'full-stack-fastapi-template'),
    groundTruth: {
      subsystems: [
        'FastAPI app entry',
        'API router and routes',
        'Core config',
        'Database layer',
        'Security',
        'SQLModel models',
        'CRUD operations',
        'Alembic migrations',
        'React SPA frontend',
        'Frontend API client',
        'Frontend auth hooks',
        'Docker Compose infra',
      ],
      files: [
        'backend/app/main.py',
        'backend/app/api/main.py',
        'backend/app/api/deps.py',
        'backend/app/api/routes/login.py',
        'backend/app/api/routes/users.py',
        'backend/app/api/routes/items.py',
        'backend/app/core/config.py',
        'backend/app/core/db.py',
        'backend/app/core/security.py',
        'backend/app/models.py',
        'backend/app/crud.py',
        'frontend/src/client',
        'frontend/src/hooks',
        'compose.yml',
        'compose.traefik.yml',
      ],
      relationships: [
        'Frontend calls /api/v1 endpoints',
        'FastAPI routes depend on get_db and get_current_user',
        'CRUD functions use SQLModel sessions',
        'Security creates and validates JWTs',
        'Docker Compose wires backend, frontend, postgres, pgadmin, traefik, mailcatcher',
      ],
      edgeCases: [
        'all_cors_origins computed from BACKEND_CORS_ORIGINS',
        'custom_generate_unique_id for OpenAPI',
        'UserRegister separate from UserCreate',
        'email utilities and background tasks',
        'TanStack Router routeTree.gen.ts',
      ],
    },
    questions: [
      'How is authentication implemented in the backend?',
      'What is the database architecture and how does the backend connect to it?',
      'How does the frontend communicate with the backend API?',
      'What infrastructure services are defined in Docker Compose?',
      'How does the project handle configuration across environments?',
    ],
    expectedAnswers: [
      ['JWT', 'password', 'get_current_user', 'Bearer', 'security.py'],
      ['PostgreSQL', 'SQLModel', 'session', 'get_db', 'Alembic'],
      ['frontend', 'client', '/api/v1', 'Bearer', 'TanStack'],
      ['backend', 'frontend', 'postgres', 'pgadmin', 'traefik', 'mail'],
      ['Settings', 'environment', 'SECRET_KEY', 'CORS', 'SENTRY'],
    ],
  },
];

function nowStamp() {
  return new Date().toISOString();
}

function log(message) {
  const line = `[${nowStamp()}] ${message}`;
  console.log(line);
  appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
}

function sketch(message) {
  appendFileSync(SKETCHBOOK, `\n- ${nowStamp()} - ${message}\n`, 'utf8');
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    if (key) env[key] = value;
  }
  return env;
}

function makeEnv(extra = {}) {
  return {
    ...process.env,
    ...loadDotEnv(path.join(BACKEND_DIR, '.env')),
    ...extra,
  };
}

async function waitForJson(url, timeoutMs = 60_000) {
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      lastError = `${res.status} ${res.statusText}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

function spawnProcess(command, args, options) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...options,
  });
  child.stdout.on('data', (chunk) => log(`${options.name} stdout: ${String(chunk).trim()}`));
  child.stderr.on('data', (chunk) => log(`${options.name} stderr: ${String(chunk).trim()}`));
  child.on('exit', (code, signal) => log(`${options.name} exited code=${code} signal=${signal}`));
  return child;
}

async function startStack() {
  mkdirSync(REPORT_DIR, { recursive: true });
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const backendEnv = makeEnv({
    PYTHONPATH: path.join(BACKEND_DIR, 'src'),
  });
  const frontendEnv = makeEnv({
    VITE_API_TARGET: BACKEND_URL,
  });

  const backend = spawnProcess(
    'python',
    ['-m', 'uvicorn', 'syntax_tree_refurbished.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
    { cwd: BACKEND_DIR, env: backendEnv, name: 'backend' },
  );

  const health = await waitForJson(`${BACKEND_URL}/api/health`, 90_000);
  writeJson('health.json', sanitizeHealth(health));
  if (!health?.llm?.configured) {
    throw new Error('Refurbished backend health reports no live LLM configuration.');
  }
  log(`Backend healthy; LLM configured with providers=${JSON.stringify(health.llm.provider_keys_present)}`);
  sketch(`Backend health verified on ${BACKEND_URL}; live LLM configured.`);

  const frontend = process.platform === 'win32'
    ? spawnProcess(
      'cmd.exe',
      ['/d', '/s', '/c', `npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}`],
      { cwd: FRONTEND_DIR, env: frontendEnv, name: 'frontend' },
    )
    : spawnProcess(
      'npm',
      ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(FRONTEND_PORT)],
      { cwd: FRONTEND_DIR, env: frontendEnv, name: 'frontend' },
    );

  await waitForFrontend();
  sketch(`Frontend started at ${FRONTEND_URL} with VITE_API_TARGET=${BACKEND_URL}.`);
  return { backend, frontend };
}

async function waitForFrontend() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    try {
      const res = await fetch(FRONTEND_URL);
      if (res.ok) return;
    } catch {
      // keep polling
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for frontend ${FRONTEND_URL}`);
}

function stopStack(stack) {
  for (const child of [stack?.frontend, stack?.backend]) {
    if (child && !child.killed) child.kill();
  }
}

function writeJson(name, value) {
  writeFileSync(path.join(ARTIFACT_DIR, name), JSON.stringify(value, null, 2), 'utf8');
}

function sanitizeHealth(health) {
  return {
    ...health,
    llm: {
      ...health.llm,
      provider_keys_present: health.llm.provider_keys_present,
    },
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function observedApiKey(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/api/')) return null;
    const tracked = [
      '/api/analyze',
      '/api/architecture-map',
      '/children',
      '/evidence',
      '/implementation',
      '/api/query',
      '/api/docs/plan',
      '/api/docs/generate',
      '/stages',
      '/metrics',
    ];
    return tracked.some((part) => parsed.pathname.includes(part)) ? parsed.pathname : null;
  } catch {
    return null;
  }
}

async function installNetworkRecorder(page, repoRun) {
  page.on('response', async (response) => {
    const key = observedApiKey(response.url());
    if (!key) return;
    let body = null;
    try {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('application/json')) body = await response.json();
      else body = await response.text();
    } catch (err) {
      body = { capture_error: err instanceof Error ? err.message : String(err) };
    }
    repoRun.network.push({
      at: nowStamp(),
      status: response.status(),
      method: response.request().method(),
      url: response.url().replace(FRONTEND_URL, ''),
      body,
    });
    accumulateTokens(repoRun, body);
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (/error|failed|warning/i.test(text)) repoRun.console.push({ at: nowStamp(), type: msg.type(), text });
  });
  page.on('pageerror', (err) => repoRun.console.push({ at: nowStamp(), type: 'pageerror', text: err.message }));
}

function accumulateTokens(repoRun, value) {
  if (!value || typeof value !== 'object') return;
  const tokensIn = value.tokens_in ?? value.tokensIn;
  const tokensOut = value.tokens_out ?? value.tokensOut;
  if (typeof tokensIn === 'number' && typeof tokensOut === 'number') {
    repoRun.tokenLedger.observed_tokens_in += tokensIn;
    repoRun.tokenLedger.observed_tokens_out += tokensOut;
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') accumulateTokens(repoRun, child);
  }
}

async function configureAdvancedSettings(page) {
  const details = page.locator('details.observatory-entry__advanced');
  if (await details.count()) {
    const open = await details.evaluate((node) => node.open);
    if (!open) await page.getByText('Advanced analysis settings').click();
  }
  await clickOption(page, 'Validation');
  await clickOption(page, 'Agentic');
  await clickOption(page, 'Strict');
  await clickOption(page, 'Full repo');
}

async function clickOption(page, label) {
  const candidate = page.getByRole('button', { name: new RegExp(`^${escapeRegex(label)}$`, 'i') }).first();
  if (await candidate.count()) {
    await candidate.click();
    return true;
  }
  const text = page.getByText(new RegExp(`^${escapeRegex(label)}$`, 'i')).first();
  if (await text.count()) {
    await text.click();
    return true;
  }
  return false;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function runRepo(browser, repo, globalLedger) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  page.setDefaultTimeout(300_000);

  const repoRun = {
    repo: repo.name,
    path: repo.path,
    started_at: nowStamp(),
    run_id: null,
    job_id: null,
    network: [],
    console: [],
    screenshots: [],
    questions: [],
    docs: [],
    metrics: null,
    stages: null,
    architectureMap: null,
    tokenLedger: {
      observed_tokens_in: 0,
      observed_tokens_out: 0,
      metrics_tokens_in: 0,
      metrics_tokens_out: 0,
    },
    grades: null,
  };
  await installNetworkRecorder(page, repoRun);

  log(`=== PR15 repo start: ${repo.name} ===`);
  sketch(`Started frontend-driven run for ${repo.name}.`);

  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  await page.locator('#observatory-repo-path').fill(repo.path);
  await configureAdvancedSettings(page);

  const analyzePromise = page.waitForResponse((res) => res.url().includes('/api/analyze') && res.request().method() === 'POST');
  await page.getByRole('button', { name: /Build architecture map/i }).click();
  const analyzeResponse = await analyzePromise;
  const analyzeBody = await analyzeResponse.json();
  repoRun.job_id = analyzeBody.job_id;
  repoRun.run_id = analyzeBody.run_id;
  log(`${repo.name}: analyze accepted run=${repoRun.run_id}`);

  const mapResponsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/architecture-map') && !res.url().includes('/nodes/'),
    { timeout: 480_000 },
  );
  await waitForAnalysisComplete(page, repoRun);
  await screenshot(page, repoRun, `${repo.name}_progress_complete.png`);
  await mapResponsePromise.catch(() => null);
  await page.locator('.obs-rf-node, .react-flow__node').first().waitFor({ state: 'visible', timeout: 240_000 });
  await screenshot(page, repoRun, `${repo.name}_architecture_map.png`);
  repoRun.architectureMap = lastNetworkBody(repoRun, '/api/architecture-map');

  const nodes = page.locator('.obs-rf-node, .react-flow__node');
  const nodeCount = await nodes.count();
  log(`${repo.name}: architecture map visible nodes=${nodeCount}`);
  for (let i = 0; i < Math.min(3, nodeCount); i += 1) {
    try {
      const currentNodes = page.locator('.obs-rf-node, .react-flow__node');
      await currentNodes.nth(i).click({ modifiers: ['Alt'], timeout: 20_000 });
      await page.waitForTimeout(2500);
      await screenshot(page, repoRun, `${repo.name}_node_${i + 1}.png`);
    } catch (err) {
      log(`${repo.name}: node ${i + 1} inspection failed: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }

  await saveCurrentLens(page, repoRun, 'architecture');

  for (let i = 0; i < repo.questions.length; i += 1) {
    if (globalLedger.tokens >= TOKEN_STOP_AT) {
      log(`Stopping questions before ${repo.name} Q${i + 1}; token ledger near budget.`);
      break;
    }
    if (page.isClosed()) {
      log(`${repo.name}: page was closed before Q${i + 1}; attempting recovery...`);
      throw new Error('Browser page closed mid-test; cannot recover automatically.');
    }
    const questionResult = await askQuestion(page, repoRun, repo, i);
    repoRun.questions.push(questionResult);
    globalLedger.tokens = currentTokenTotal(repoRun, globalLedger.priorTokens);
    writeJson(`${repo.name}_run.json`, repoRun);
    writeJson('summary.partial.json', summarizeRuns([repoRun], globalLedger));
    log(`${repo.name}: saved incremental artifact after Q${i + 1}`);
  }

  await generateDocs(page, repoRun);
  await collectRunMetrics(repoRun);
  repoRun.grades = gradeRepo(repo, repoRun);
  repoRun.finished_at = nowStamp();

  writeJson(`${repo.name}_run.json`, repoRun);
  appendSketchbookRepoSummary(repoRun);
  await context.close();
  return repoRun;
}

async function waitForAnalysisComplete(page, repoRun) {
  const statusUrl = `${FRONTEND_URL}/api/analyze/${encodeURIComponent(repoRun.job_id)}/status`;
  const started = Date.now();
  while (Date.now() - started < 600_000) {
    const status = await page.evaluate(async (url) => {
      const res = await fetch(url);
      return res.json();
    }, statusUrl);
    if (status.status === 'completed') {
      log(`${repoRun.repo}: analysis completed`);
      return;
    }
    if (status.status === 'failed') {
      throw new Error(`${repoRun.repo}: analysis failed: ${status.error}`);
    }
    await sleep(2500);
  }
  throw new Error(`${repoRun.repo}: analysis did not complete within 10 minutes.`);
}

async function askQuestion(page, repoRun, repo, index) {
  const question = repo.questions[index];
  log(`${repo.name} Q${index + 1}: ${question}`);
  const responsePromise = page.waitForResponse((res) => res.url().includes('/api/query') && res.request().method() === 'POST', { timeout: 240_000 });
  const input = page.locator('.obs-question-dock__input').first();
  await input.fill(question);
  await page.getByRole('button', { name: /Submit question/i }).click();
  const response = await responsePromise;
  const body = await responseBody(response);
  accumulateTokens(repoRun, body);
  await page.locator('.obs-understanding-pane, .obs-understanding-state').first().waitFor({ state: 'visible', timeout: 180_000 }).catch(() => null);
  await screenshot(page, repoRun, `${repo.name}_q${index + 1}.png`);
  await saveCurrentLens(page, repoRun, `question ${index + 1}`);
  const visibleText = await page.locator('body').innerText();
  const score = response.ok()
    ? scoreAnswer(repo.expectedAnswers[index], body, visibleText)
    : { score: 0, expected_keywords: repo.expectedAnswers[index], keyword_hits: [], evidence_signals: 0, confidence: 0, error: `HTTP ${response.status()}` };
  log(`${repo.name} Q${index + 1} reliability score=${score.score}/10`);
  return {
    question,
    response: body,
    visible_text_excerpt: visibleText.slice(0, 4000),
    score,
  };
}

async function responseBody(response) {
  try {
    const contentType = response.headers()['content-type'] || '';
    if (contentType.includes('application/json')) return await response.json();
    return { error_text: await response.text() };
  } catch (err) {
    return { capture_error: err instanceof Error ? err.message : String(err) };
  }
}

async function saveCurrentLens(page, repoRun, label) {
  try {
    const tab = page.getByRole('button', { name: /^Lenses$/i }).first();
    if (await tab.count()) await tab.click();
    const save = page.getByRole('button', { name: /Save Lens/i }).first();
    if (await save.count()) {
      await save.click();
      await page.waitForTimeout(500);
      log(`${repoRun.repo}: saved ${label} lens`);
      return true;
    }
  } catch (err) {
    log(`${repoRun.repo}: could not save ${label} lens: ${err instanceof Error ? err.message : String(err)}`);
  }
  return false;
}

async function generateDocs(page, repoRun) {
  log(`${repoRun.repo}: generating Docs Studio outline and markdown`);
  try {
    const docsButton = page.getByRole('button', { name: /Docs Studio/i }).first();
    if (await docsButton.count()) {
      await docsButton.click();
    } else {
      await page.goto(`${FRONTEND_URL}/docs`, { waitUntil: 'networkidle' });
    }

    await page.locator('main[aria-label="Observatory Docs Studio"]').waitFor({ state: 'visible', timeout: 90_000 });
    await screenshot(page, repoRun, `${repoRun.repo}_docs_open.png`);

    const outlinePromise = page.waitForResponse((res) => res.url().includes('/api/docs/plan') && res.request().method() === 'POST', { timeout: 180_000 });
    await page.getByRole('button', { name: /Generate Outline/i }).click();
    const outlineResponse = await outlinePromise;
    const outline = await outlineResponse.json();
    accumulateTokens(repoRun, outline);
    await page.waitForTimeout(1500);
    await screenshot(page, repoRun, `${repoRun.repo}_docs_outline.png`);

    const planPromise = page.waitForResponse((res) => res.url().includes('/api/docs/plan') && res.request().method() === 'POST', { timeout: 180_000 });
    const generatePromise = page.waitForResponse((res) => res.url().includes('/api/docs/generate') && res.request().method() === 'POST', { timeout: 240_000 });
    await page.getByRole('button', { name: /Generate Markdown/i }).click();
    const planResponse = await planPromise;
    const generatedResponse = await generatePromise;
    const plan = await planResponse.json();
    const generated = await generatedResponse.json();
    accumulateTokens(repoRun, plan);
    accumulateTokens(repoRun, generated);
    await page.waitForTimeout(2000);
    await screenshot(page, repoRun, `${repoRun.repo}_docs_generated.png`);
    const visibleText = await page.locator('body').innerText();
    repoRun.docs.push({
      outline,
      plan,
      generated,
      visible_text_excerpt: visibleText.slice(0, 5000),
      score: scoreDocs(repoRun.repo, generated, visibleText),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`${repoRun.repo}: docs generation failed: ${message}`);
    repoRun.docs.push({ error: message, score: { score: 0, notes: ['Docs generation failed.'] } });
    await screenshot(page, repoRun, `${repoRun.repo}_docs_error.png`).catch(() => null);
  }
}

async function collectRunMetrics(repoRun) {
  if (!repoRun.run_id) return;
  const stagesUrl = `${BACKEND_URL}/api/runs/${encodeURIComponent(repoRun.run_id)}/stages`;
  const metricsUrl = `${BACKEND_URL}/api/runs/${encodeURIComponent(repoRun.run_id)}/metrics`;
  try {
    repoRun.stages = await (await fetch(stagesUrl)).json();
    repoRun.metrics = await (await fetch(metricsUrl)).json();
    repoRun.tokenLedger.metrics_tokens_in = repoRun.metrics.tokens_in ?? 0;
    repoRun.tokenLedger.metrics_tokens_out = repoRun.metrics.tokens_out ?? 0;
    writeJson(`${repoRun.repo}_stages.json`, repoRun.stages);
    writeJson(`${repoRun.repo}_metrics.json`, repoRun.metrics);
    log(`${repoRun.repo}: metrics tokens=${(repoRun.metrics.tokens_in ?? 0) + (repoRun.metrics.tokens_out ?? 0)} stages=${repoRun.metrics.stage_count}`);
  } catch (err) {
    log(`${repoRun.repo}: metrics collection failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function screenshot(page, repoRun, name) {
  const file = path.join(REPORT_DIR, name);
  await page.screenshot({ path: file, fullPage: true });
  repoRun.screenshots.push(file);
  return file;
}

function lastNetworkBody(repoRun, pathPart) {
  const matches = repoRun.network.filter((item) => item.url.includes(pathPart));
  return matches.length ? matches[matches.length - 1].body : null;
}

function textBlob(...values) {
  return values.map((value) => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }).join('\n').toLowerCase();
}

function hitRatio(expected, ...values) {
  const haystack = textBlob(...values);
  const hits = expected.filter((item) => haystack.includes(item.toLowerCase()));
  return { hits, ratio: expected.length ? hits.length / expected.length : 0 };
}

function scoreAnswer(expected, body, visibleText) {
  const keyword = hitRatio(expected, body, visibleText);
  const evidence = textBlob(body).match(/"file_path"|"source_ref_id"|"start_line"|"citations"|evidence/g)?.length ?? 0;
  const confidence = typeof body?.confidence === 'number' ? body.confidence : 0;
  let score = 2 + keyword.ratio * 4 + Math.min(2, evidence * 0.25) + Math.min(2, confidence * 2);
  if (/no live llm|fallback_no_llm|failed|error/i.test(textBlob(body, visibleText))) score -= 2;
  score = Math.max(0, Math.min(10, Number(score.toFixed(1))));
  return {
    score,
    keyword_hits: keyword.hits,
    expected_keywords: expected,
    evidence_signals: evidence,
    confidence,
  };
}

function scoreDocs(repoName, generated, visibleText) {
  const expected = repoName === 'axios'
    ? ['lib/core', 'adapter', 'interceptor', 'dispatchRequest', 'mergeConfig']
    : ['FastAPI', 'backend/app', 'get_current_user', 'SQLModel', 'Docker'];
  const keyword = hitRatio(expected, generated, visibleText);
  const evidence = textBlob(generated, visibleText).match(/`[^`]+`|backend\/|frontend\/|lib\//g)?.length ?? 0;
  let score = 2 + keyword.ratio * 5 + Math.min(3, evidence * 0.2);
  if (/no live llm|failed|error/i.test(textBlob(generated, visibleText))) score -= 2;
  score = Math.max(0, Math.min(10, Number(score.toFixed(1))));
  return { score, keyword_hits: keyword.hits, expected_keywords: expected, evidence_signals: evidence };
}

function gradeRepo(repo, repoRun) {
  const architectureText = textBlob(repoRun.architectureMap, repoRun.network);
  const subsystemHits = hitRatio(repo.groundTruth.subsystems, architectureText);
  const fileHits = hitRatio(repo.groundTruth.files, architectureText);
  const relationshipHits = hitRatio(repo.groundTruth.relationships, architectureText);
  const hallucinationPenalty = /blockchain|kafka|redis|graphql|microservice/i.test(architectureText) ? 1 : 0;

  const metricsTokens = (repoRun.metrics?.tokens_in ?? 0) + (repoRun.metrics?.tokens_out ?? 0);
  const observedTokens = repoRun.tokenLedger.observed_tokens_in + repoRun.tokenLedger.observed_tokens_out;
  const totalTokens = Math.max(metricsTokens, observedTokens);
  const fallbackCount = repoRun.metrics?.fallback_stage_count ?? 0;
  const failedStages = repoRun.metrics?.failed_stage_count ?? 0;
  const llmStages = repoRun.metrics?.llm_stage_count ?? 0;
  const durationMs = repoRun.metrics?.duration_ms ?? 0;

  let efficiency = 10;
  efficiency -= Math.min(4, totalTokens / 100_000);
  efficiency -= Math.min(2, llmStages * 0.25);
  efficiency -= Math.min(2, fallbackCount * 0.5);
  efficiency -= Math.min(1, failedStages);
  efficiency -= Math.min(1, durationMs / 600_000);

  let intelligence = 10 * (
    subsystemHits.ratio * 0.4 +
    fileHits.ratio * 0.25 +
    relationshipHits.ratio * 0.25
  ) + 1;
  intelligence -= hallucinationPenalty;

  const qaScores = repoRun.questions.map((item) => item.score?.score ?? 0);
  const docScores = repoRun.docs.map((item) => item.score?.score ?? 0);
  const reliabilityInputs = [...qaScores, ...docScores];
  const reliability = reliabilityInputs.length
    ? reliabilityInputs.reduce((a, b) => a + b, 0) / reliabilityInputs.length
    : 0;

  return {
    efficiency: roundScore(efficiency),
    intelligence: roundScore(intelligence),
    reliability: roundScore(reliability),
    overall: roundScore((efficiency + intelligence + reliability) / 3),
    details: {
      tokens: totalTokens,
      llm_stages: llmStages,
      fallback_stages: fallbackCount,
      failed_stages: failedStages,
      duration_ms: durationMs,
      subsystem_hits: subsystemHits,
      file_hits: fileHits,
      relationship_hits: relationshipHits,
      qa_scores: qaScores,
      doc_scores: docScores,
      hallucination_penalty: hallucinationPenalty,
    },
  };
}

function roundScore(value) {
  return Math.max(0, Math.min(10, Number(value.toFixed(1))));
}

function appendSketchbookRepoSummary(repoRun) {
  const g = repoRun.grades;
  appendFileSync(SKETCHBOOK, [
    '',
    `## PR15 Live Run - ${repoRun.repo} - ${nowStamp()}`,
    '',
    `- Run ID: \`${repoRun.run_id}\``,
    `- Screenshots: ${repoRun.screenshots.length}`,
    `- Network artifacts: ${repoRun.network.length}`,
    `- Metrics tokens: ${(repoRun.tokenLedger.metrics_tokens_in + repoRun.tokenLedger.metrics_tokens_out).toLocaleString()}`,
    `- Observed response tokens: ${(repoRun.tokenLedger.observed_tokens_in + repoRun.tokenLedger.observed_tokens_out).toLocaleString()}`,
    `- Efficiency: ${g?.efficiency ?? 'n/a'}/10`,
    `- Intelligence: ${g?.intelligence ?? 'n/a'}/10`,
    `- Reliability: ${g?.reliability ?? 'n/a'}/10`,
    `- Overall: ${g?.overall ?? 'n/a'}/10`,
    repoRun.console.length ? `- Console/API quirks: ${repoRun.console.length} captured; see artifact JSON.` : '- Console/API quirks: none captured.',
    '',
  ].join('\n'), 'utf8');
}

function currentTokenTotal(repoRun, prior) {
  return prior + Math.max(
    repoRun.tokenLedger.metrics_tokens_in + repoRun.tokenLedger.metrics_tokens_out,
    repoRun.tokenLedger.observed_tokens_in + repoRun.tokenLedger.observed_tokens_out,
  );
}

async function main() {
  appendFileSync(LOG_FILE, `\n=== PR15 run ${nowStamp()} ===\n`, 'utf8');
  sketch('Implemented hardened PR15 Playwright runner and starting live QA.');
  const stack = await startStack();
  const browser = await chromium.launch({
    executablePath: browserExecutable && existsSync(browserExecutable) ? browserExecutable : undefined,
    headless: true,
  });
  const globalLedger = { priorTokens: 0, tokens: 0 };
  const runs = [];

  try {
    for (const repo of REPOS) {
      if (globalLedger.tokens >= TOKEN_STOP_AT) {
        log(`Skipping ${repo.name}; system token ledger near stop threshold ${TOKEN_STOP_AT}.`);
        break;
      }
      const run = await runRepo(browser, repo, globalLedger);
      runs.push(run);
      globalLedger.priorTokens = globalLedger.tokens;
      writeJson('summary.partial.json', summarizeRuns(runs, globalLedger));
    }
  } finally {
    await browser.close().catch(() => null);
    stopStack(stack);
  }

  const summary = summarizeRuns(runs, globalLedger);
  writeJson('summary.json', summary);
  appendFinalReport(summary);
  log('=== PR15 Golden E2E QA complete ===');
}

function summarizeRuns(runs, globalLedger) {
  return {
    generated_at: nowStamp(),
    frontend_url: FRONTEND_URL,
    backend_url: BACKEND_URL,
    system_token_budget: TOKEN_BUDGET,
    estimated_system_tokens_observed: globalLedger.tokens,
    repos: runs.map((run) => ({
      repo: run.repo,
      run_id: run.run_id,
      grades: run.grades,
      screenshots: run.screenshots,
      metrics: run.metrics,
      question_scores: run.questions.map((q) => ({ question: q.question, score: q.score })),
      doc_scores: run.docs.map((d) => d.score),
      artifact_file: path.join(ARTIFACT_DIR, `${run.repo}_run.json`),
    })),
  };
}

function appendFinalReport(summary) {
  const lines = [
    '',
    `## PR15 Final Live QA Report - ${summary.generated_at}`,
    '',
    `- Frontend: ${summary.frontend_url}`,
    `- Backend: ${summary.backend_url}`,
    `- System token budget: ${summary.system_token_budget.toLocaleString()}`,
    `- Observed token ledger: ${summary.estimated_system_tokens_observed.toLocaleString()}`,
    '',
    '| Repo | Efficiency | Intelligence | Reliability | Overall | Tokens |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  for (const repo of summary.repos) {
    const g = repo.grades;
    lines.push(`| ${repo.repo} | ${g?.efficiency ?? 'n/a'} | ${g?.intelligence ?? 'n/a'} | ${g?.reliability ?? 'n/a'} | ${g?.overall ?? 'n/a'} | ${(g?.details?.tokens ?? 0).toLocaleString()} |`);
  }
  lines.push('');
  appendFileSync(SKETCHBOOK, `${lines.join('\n')}\n`, 'utf8');
}

main().catch((err) => {
  const message = err instanceof Error ? err.stack || err.message : String(err);
  log(`FATAL: ${message}`);
  sketch(`PR15 run failed: ${message.split('\n')[0]}`);
  process.exit(1);
});
