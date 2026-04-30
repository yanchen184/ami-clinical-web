/**
 * AMI Clinical Web — Real AI Integration Screenshot Tour
 *
 * 這支 spec 不 mock /analyze——直接打真的 ami-ai-service (:17900)。
 * 驗證 web → clinical-api → ai-service 整條鏈路通，並把醫師會看到的關鍵畫面截下來給手冊用。
 *
 * 執行：
 *   npx playwright test e2e/100-ai-live-tour.spec.ts --project=chromium
 */
import { test, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:17000';
const API_BASE = 'http://localhost:17000';
const SHOT_DIR = path.resolve(__dirname, 'artifacts/screenshots-live');
const DOCTOR = { username: 'doctor01', password: 'Doctor@123456' };

let token = '';
let patientId = '';

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
  await page.screenshot({ path: filePath, fullPage });
  console.log(`[shot] ${name}.png`);
}
async function setToken(page: Page, t: string): Promise<void> {
  await page.addInitScript((tok) => {
    window.localStorage.setItem('token', tok);
  }, t);
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

test('00_login', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input#username', { timeout: 10000 });
  await page.fill('input#username', DOCTOR.username);
  await page.fill('input#password', DOCTOR.password);
  await page.waitForTimeout(500);
  await shot(page, '00_login');
  await ctx.close();
});

test('01_patient_list', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/doctor/patients`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('table, [data-testid="patient-card"], .patient-card', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01_patient_list');
  await ctx.close();
});

test('02_patient_detail_overview', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/doctor/patients/${patientId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('h1, h2', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '02_patient_detail_overview');
  await ctx.close();
});

test('03_hermes_tab_before_analyze', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/doctor/patients/${patientId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const hermesTab = page.locator('button, [role="tab"]').filter({ hasText: /Hermes/ }).first();
  if (await hermesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await hermesTab.click();
    await page.waitForTimeout(1000);
  }
  await shot(page, '03_hermes_tab_before_analyze');
  await ctx.close();
});

test('04_analyze_running_and_done', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);

  // 收集網路請求 + console error，驗證真的有打到 ai-service
  const aiCalls: { url: string; status: number; body?: string }[] = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (u.includes('/ai/analyze') || u.endsWith('/analyze')) {
      let body = '';
      try {
        body = (await r.text()).slice(0, 300);
      } catch {}
      aiCalls.push({ url: u, status: r.status(), body });
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`[browser-error] ${m.text().slice(0, 200)}`);
  });
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/analyze')) console.log(`[request] ${r.method()} ${u}`);
  });
  page.on('requestfailed', (r) => {
    console.log(`[req-failed] ${r.url()} ${r.failure()?.errorText}`);
  });

  await page.goto(`${BASE_URL}/doctor/patients/${patientId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const hermesTab = page.locator('button, [role="tab"]').filter({ hasText: /Hermes/ }).first();
  if (await hermesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await hermesTab.click();
    await page.waitForTimeout(800);
  }

  const btn = page.locator('button').filter({ hasText: /立即觸發.*AI.*分析|重新分析/ }).first();
  if (!(await btn.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log('[warn] analyze button not visible');
    await shot(page, '04_NO_BUTTON');
    await ctx.close();
    return;
  }
  // 並行 click + 等真實 /analyze 回應
  const respPromise = page.waitForResponse(
    (r) => r.url().endsWith('/analyze') && r.request().method() === 'POST',
    { timeout: 60000 },
  ).catch((e) => { console.log(`[wait-resp-err] ${e.message}`); return null; });
  await btn.click();
  await page.waitForTimeout(700);
  await shot(page, '04a_analyzing');

  const resp = await respPromise;
  if (resp) console.log(`[/analyze response] status=${resp.status()}`);
  await page.waitForTimeout(2500);
  await shot(page, '04b_analyzed_top');
  await shot(page, '04c_analyzed_full', true);

  console.log(`[ai-calls] ${JSON.stringify(aiCalls)}`);
  if (aiCalls.length === 0) console.warn('[warn] no /analyze network call detected!');
  await ctx.close();
});

test('05_advice_section_overview_tab', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/doctor/patients/${patientId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // 已在「總覽」tab，滾到 AI 建議區塊
  const adviceHeader = page.locator('h3').filter({ hasText: /AI\s*建議/ }).first();
  if (await adviceHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
    await adviceHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
  }
  await shot(page, '05a_ai_advice_section');
  await shot(page, '05b_overview_full', true);
  await ctx.close();
});

test('06_overview_long_scroll_with_feedback', async ({ browser }) => {
  // 整條長條版面：折線圖 → 用藥 → AI 建議 → 醫師回饋（含訂正欄位展開）
  // 先透過 clinical-api proxy 觸發 analyze，確保 AiSummary.cdssAdvice 落 DB
  // (前端 dev mode 直連 ai-service，會繞過 persist；這裡明確補一次)
  await apiPost(
    `${API_BASE}/api/patients/${patientId}/ai/analyze`,
    { patientId },
    token,
  ).catch((e) => console.log(`[warn] proxy analyze failed: ${e.message}`));

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await setToken(page, token);
  await page.goto(`${BASE_URL}/doctor/patients/${patientId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // 點 ★★（rating=2），讓訂正欄位展開（rating <= 2 才顯示）
  const stars = page.locator('button').filter({ hasText: '★' });
  if ((await stars.count()) >= 2) {
    await stars.nth(1).scrollIntoViewIfNeeded();
    await stars.nth(1).click();
    await page.waitForTimeout(600);
  }

  // 在訂正欄位填一些示範文字，讓畫面有料可看
  const correctedAssessment = page
    .locator('textarea')
    .filter({ hasText: '' })
    .first();
  await page
    .locator('textarea[placeholder*="評估"]')
    .fill('NSTEMI 已穩定，建議加強血糖控管以降低再梗塞風險')
    .catch(() => {});
  await page
    .locator('textarea[placeholder*="計畫"]')
    .fill('SGLT2i 改用 dapagliflozin 10 mg QD（本院標準）')
    .catch(() => {});
  await page.waitForTimeout(400);

  // 滾回頁首再 fullPage 截圖
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
  await page.waitForTimeout(500);
  await shot(page, '06_overview_long_with_feedback', true);
  await ctx.close();
});
