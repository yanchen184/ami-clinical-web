/**
 * AMI Part B — Hermes Agents Real-AI Manual Tour
 *
 * 不 mock /analyze、不 mock cdss-advice。整條鏈路：
 *   web :17000 → clinical-api :17081 → ai-service :17900
 *
 * 產生 Part B 手冊用的 14 張截圖，涵蓋：
 *   - 醫師 PatientDetail Hermes tab（觸發前 / 分析中 / 7 步驟流程 / 摘要）
 *   - 總覽 tab 的 SOAP card 與 CDSS 建議卡（含信心度）
 *   - 透過 /ai-demo 展示 evolve before/after 與 rule_sources 變化
 *
 * 執行：
 *   cd ami-clinical-web
 *   npx playwright test e2e/400-hermes-tour.spec.ts --project=chromium
 *
 * 輸出：e2e/artifacts/screenshots-hermes/*.png
 */
import { test, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:17000';
const API_BASE = 'http://localhost:17000';
const SHOT_DIR = path.resolve(__dirname, 'artifacts/screenshots-hermes');
const DOCTOR = { username: 'doctor01', password: 'Doctor@123456' };

let token = '';
let patientId = '';
const shotHashes = new Map<string, string>();

async function apiPost<T>(url: string, body: unknown, t?: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${url} [${res.status}]: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}
async function apiGet<T>(url: string, t: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${url} [${res.status}]: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  const filePath = path.join(SHOT_DIR, `${name}.png`);
  const buf = await page.screenshot({ path: filePath, fullPage });
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  const prev = [...shotHashes.entries()].pop();
  if (prev && prev[1] === md5) {
    console.warn(`  ⚠️  ${name}.png md5 matches ${prev[0]}.png — possibly same screen`);
  }
  if (buf.length < 8000) {
    console.warn(`  ⚠️  ${name}.png only ${buf.length} bytes — likely blank/loading`);
  }
  shotHashes.set(name, md5);
  console.log(`[shot] ${name}.png (${buf.length} bytes, md5=${md5.slice(0, 8)})`);
}

async function setToken(page: Page, t: string): Promise<void> {
  await page.addInitScript((tok) => {
    window.localStorage.setItem('token', tok);
  }, t);
}

async function gotoHermesTab(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/doctor/patients/${patientId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const hermesTab = page.locator('button, [role="tab"]').filter({ hasText: /Hermes/ }).first();
  if (await hermesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await hermesTab.click();
    await page.waitForTimeout(800);
  }
}

test.beforeAll(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const r = await apiPost<any>(`${API_BASE}/api/auth/login`, DOCTOR);
  token = r?.data?.accessToken ?? r?.accessToken ?? r?.token ?? '';
  if (!token) throw new Error('login failed: no token');
  const list = await apiGet<any>(`${API_BASE}/api/patients?page=0&size=10`, token);
  const content = list?.data?.content ?? list?.content ?? [];
  patientId = content[0]?.id ?? '';
  if (!patientId) throw new Error('no patient available');
  console.log(`[setup] doctor token ok, patientId=${patientId}`);
});

test.setTimeout(120000);

// ─────────── 1. Overview tab：SOAP + CDSS 建議卡 ───────────
test('B01_overview_soap_and_cdss', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/doctor/patients/${patientId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('h1, h2', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, 'B01_overview_soap_and_cdss', true);
  await ctx.close();
});

test('B02_overview_cdss_zoomed', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/doctor/patients/${patientId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Ensure AiSummary exists — click "立即觸發 AI 分析" to populate CDSS, then wait for it to render.
  const triggerBtn = page.locator('button').filter({ hasText: /立即觸發.*AI.*分析|重新分析/ }).first();
  if (await triggerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await triggerBtn.click();
    // Wait for analyze to complete and CDSS cards to render (cache invalidation refetches).
    await page.waitForFunction(() => {
      const empty = document.body.innerText.includes('目前無 CDSS 建議');
      return !empty;
    }, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const adviceHeader = page.locator('h3').filter({ hasText: /AI\s*建議|CDSS/ }).first();
  if (await adviceHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
    await adviceHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
  }
  await shot(page, 'B02_overview_cdss_zoomed');
  await ctx.close();
});

// ─────────── 2. Hermes tab：分析前 / 分析中 / 7 步驟 ───────────
test('B03_hermes_tab_before_analyze', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await gotoHermesTab(page);
  await shot(page, 'B03_hermes_tab_before_analyze');
  await ctx.close();
});

test('B04_hermes_analyze_running', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);

  const aiCalls: { url: string; status: number }[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('/analyze')) aiCalls.push({ url: r.url(), status: r.status() });
  });

  await gotoHermesTab(page);
  const btn = page.locator('button').filter({ hasText: /立即觸發.*AI.*分析|重新分析/ }).first();
  if (!(await btn.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log('[skip] analyze button not visible');
    await ctx.close();
    return;
  }
  const respPromise = page
    .waitForResponse(
      (r) => r.url().endsWith('/analyze') && r.request().method() === 'POST',
      { timeout: 60000 },
    )
    .catch(() => null);
  await btn.click();
  // analyzing 狀態（按鈕文字變「分析中…」、disabled）— 立即截
  await page.waitForTimeout(600);
  await shot(page, 'B04_hermes_analyze_running');
  const resp = await respPromise;
  if (resp) console.log(`[/analyze] status=${resp.status()}`);
  console.log(`[ai-calls] ${JSON.stringify(aiCalls)}`);
  if (aiCalls.length === 0) console.warn('  ⚠️  no /analyze call detected');
  await ctx.close();
});

// 共用：觸發 analyze 並等到 trace 卡真的渲染（不只是 response 回來）
async function triggerAnalyzeAndWait(page: Page): Promise<void> {
  const btn = page.locator('button').filter({ hasText: /立即觸發.*AI.*分析|重新分析/ }).first();
  if (!(await btn.isVisible({ timeout: 5000 }).catch(() => false))) return;
  const respPromise = page
    .waitForResponse(
      (r) => r.url().endsWith('/analyze') && r.request().method() === 'POST',
      { timeout: 90000 },
    )
    .catch(() => null);
  await btn.click();
  const resp = await respPromise;
  if (resp) console.log(`[/analyze] status=${resp.status()}`);
  // 等到「本次分析結果摘要」section 出現（已有 analyzeResult）
  await page
    .locator('text=本次分析結果摘要')
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => {});
  // 再等 hermes-trace-card
  await page
    .locator('[data-testid="hermes-trace-card"]')
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(800);
}

test('B05_hermes_trace_summary', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await gotoHermesTab(page);
  await triggerAnalyzeAndWait(page);
  await shot(page, 'B05_hermes_trace_summary');
  await ctx.close();
});

test('B06_hermes_trace_full', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await gotoHermesTab(page);
  await triggerAnalyzeAndWait(page);
  await shot(page, 'B06_hermes_trace_full', true);
  await ctx.close();
});

test('B07_hermes_step_detail_expanded', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await gotoHermesTab(page);
  await triggerAnalyzeAndWait(page);
  // 找第一個「查看細節 / 展開」按鈕
  const detailToggle = page.locator('summary, button').filter({ hasText: /細節|查看|展開/ }).first();
  if (await detailToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
    await detailToggle.click();
    await page.waitForTimeout(600);
  }
  await shot(page, 'B07_hermes_step_detail_expanded', true);
  await ctx.close();
});

// ─────────── 3. AI Demo：evolve before/after + rule_sources ───────────
test('B08_aidemo_landing', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/ai-demo`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, 'B08_aidemo_landing', true);
  await ctx.close();
});

test('B09_aidemo_first_advice_p002', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/ai-demo`);
  await page.waitForLoadState('networkidle');
  await page.locator('[data-testid="patient-p002"]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="btn-first-analyze"]').click();
  await page
    .locator('[data-testid="first-advice"]')
    .waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(800);
  await shot(page, 'B09_aidemo_first_advice_p002', true);
  await ctx.close();
});

test('B10_aidemo_full_evolve_loop', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/ai-demo`);
  await page.waitForLoadState('networkidle');
  await page.locator('[data-testid="patient-p002"]').click();
  await page.waitForTimeout(500);

  // first analyze
  await page.locator('[data-testid="btn-first-analyze"]').click();
  await page
    .locator('[data-testid="first-advice"]')
    .waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(800);
  await shot(page, 'B10a_evolve_before_first_advice', true);

  // submit feedback
  await page
    .locator('[data-testid="feedback-text"]')
    .fill(
      '本院 SGLT2i 第一線改為 dapagliflozin 10 mg QD（健保給付與 DAPA-MI 試驗證據考量），' +
        'empagliflozin 列為次選。請於建議中明確指名 dapagliflozin。',
    );
  await page.locator('[data-testid="btn-send-feedback"]').click();
  await page
    .locator('[data-testid="feedback-sent-msg"]')
    .waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(500);
  await shot(page, 'B10b_evolve_feedback_sent');

  // sync
  await page.locator('[data-testid="btn-sync"]').click();
  await page
    .locator('[data-testid="sync-result"]')
    .waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(500);
  await shot(page, 'B10c_evolve_sync_result');

  // second advice
  await page
    .locator('[data-testid="second-advice"]')
    .waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(800);
  await shot(page, 'B10d_evolve_after_second_advice', true);

  await ctx.close();
});

test('B11_aidemo_recommendations_diff', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/ai-demo`);
  await page.waitForLoadState('networkidle');
  await page.locator('[data-testid="patient-p002"]').click();
  await page.locator('[data-testid="btn-first-analyze"]').click();
  await page
    .locator('[data-testid="first-advice"]')
    .waitFor({ state: 'visible', timeout: 90000 });
  // 把第二區塊 (second-advice) 區域對齊到 viewport 中央，方便對比
  await page
    .locator('[data-testid="first-advice-recommendations"]')
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, 'B11_aidemo_recommendations_diff_zoom');
  await ctx.close();
});

// ─────────── 4. Network spy：rule_sources / used_rag ───────────
test('B12_network_spy_analyze_payload', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);

  let analyzeBody = '';
  page.on('response', async (r) => {
    if (r.url().endsWith('/analyze') && r.request().method() === 'POST') {
      try {
        analyzeBody = (await r.text()).slice(0, 4000);
      } catch {}
    }
  });

  await gotoHermesTab(page);
  await triggerAnalyzeAndWait(page);

  // 把 analyze 回應 body 寫到 artefact 給 manual 引用
  fs.writeFileSync(path.join(SHOT_DIR, 'B12_analyze_payload.json'), analyzeBody);
  console.log(`[payload-bytes] ${analyzeBody.length}`);
  // 截最終呈現的 trace 卡（含 rule_sources 連結）
  await shot(page, 'B12_hermes_with_rule_sources', true);
  await ctx.close();
});
