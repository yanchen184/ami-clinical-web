/**
 * Phase 1 verification — 驗證本輪 6 項改動的截圖
 *
 * 範圍：
 *   Lv.1-A 列表卡片 rulebase 待辦事項 chips
 *   Lv.1-B 列表卡片「上次分析」摘要 footer
 *   422 修復：點「立即觸發 AI 分析」不再 422
 *   Hermes 文案 7 → 9 步、rule_compute / rule_validate 圖示
 *   Lv.2-C Hermes rag_search 引用清單可點擊（不再 raw JSON）
 *   Lv.2-C 病患詳情：分析摘要旁 📚 規則來源 chips
 *   Lv.2-D admin 回饋審核頁
 *
 * 執行：
 *   npx playwright test e2e/500-phase1-verify.spec.ts --project=chromium
 *
 * 截圖輸出：e2e/artifacts/phase1/
 */

import { test, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:17000';
const API_BASE = 'http://localhost:17000';
const SHOT_DIR = path.resolve(__dirname, 'artifacts/phase1');

const DOCTOR_CREDS = { username: 'doctor01', password: 'Doctor@123456' };
const ADMIN_CREDS = { username: 'admin', password: 'Admin@123456' };

let doctorToken = '';
let adminToken = '';
let firstPatientId = '';

async function apiPost<T>(url: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${url} [${res.status}]: ${text}`);
  return JSON.parse(text) as T;
}

async function apiGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${url} [${res.status}]: ${text}`);
  return JSON.parse(text) as T;
}

async function shot(page: Page, name: string): Promise<void> {
  const filePath = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`[shot] ${name}.png`);
}

async function setToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((t) => {
    window.localStorage.setItem('token', t);
  }, token);
}

async function waitReady(page: Page, selector: string, timeout = 15000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForSelector(selector, { timeout }).catch(() => {});
  await page.waitForTimeout(800);
}

test.beforeAll(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const loginToken = async (creds: { username: string; password: string }) => {
    const res = await apiPost<any>(`${API_BASE}/api/auth/login`, creds);
    return res?.data?.accessToken ?? res?.accessToken ?? res?.token ?? '';
  };

  doctorToken = await loginToken(DOCTOR_CREDS).catch(() => '');
  adminToken = await loginToken(ADMIN_CREDS).catch(() => '');
  if (!adminToken) adminToken = doctorToken;

  if (doctorToken) {
    const raw = await apiGet<any>(
      `${API_BASE}/api/patients?page=0&size=10`,
      doctorToken,
    ).catch(() => null);
    const content = raw?.data?.content ?? raw?.content ?? [];
    firstPatientId = content[0]?.id ?? '';
    console.log(`[beforeAll] doctorToken=${!!doctorToken} adminToken=${!!adminToken} firstPatientId=${firstPatientId}`);
  }

  // 預先建一筆 AiSummary，列表才有「上次分析」可顯示
  if (firstPatientId && doctorToken) {
    await apiPost(
      `${API_BASE}/api/internal/ai-summary`,
      {
        patientId: firstPatientId,
        soap: {
          subjective: '病患主訴近兩週胸悶加重，夜間偶有喘息，輕度下肢水腫。',
          objective: '血壓 152/94，心率 82，體重較上次 +1.8kg。LDL 98，HbA1c 6.8%。',
          assessment: '心臟功能追蹤；血壓控制尚可但偏高；合併輕度體液滯留。',
          plan: 'Furosemide 40mg QD；低鹽飲食；2 週後心臟超音波追蹤。',
        },
        cdssAdvice: [
          { priority: 'HIGH', message: '建議追加利尿劑劑量並評估腎功能' },
          { priority: 'HIGH', message: 'LDL 已達標，維持現有 statin 處方' },
          { priority: 'MEDIUM', message: '安排心臟超音波追蹤 LVEF 變化' },
        ],
      },
      doctorToken,
    ).catch((e) => console.log(`[beforeAll] ai-summary seed skipped: ${e?.message}`));
  }
});

test.describe('Phase 1 — Lv.1 / Lv.2 改動驗證', () => {
  test.setTimeout(180_000);

  test('A_doctor_patient_list_with_briefing_and_todos', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients`, { timeout: 60000 });
    await waitReady(page, '.grid, text=病患列表');
    await shot(page, 'A_patient_list');
    await page.close();
  });

  test('B_doctor_patient_detail_after_trigger_ai', async ({ browser }) => {
    if (!firstPatientId) {
      console.log('[skip] no firstPatientId');
      return;
    }
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[browser ${msg.type()}] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=病患資訊, text=SOAP');
    await shot(page, 'B1_detail_overview_with_rule_sources');

    // 嘗試找「立即觸發 AI 分析」按鈕（測 422 修復）
    // Watch the analyze response so we can detect failure
    let analyzeStatus = 0;
    let analyzeBody = '';
    page.on('response', async (resp) => {
      const url = resp.url();
      if (url.includes('/ai/analyze')) {
        analyzeStatus = resp.status();
        try {
          analyzeBody = (await resp.text()).slice(0, 400);
        } catch {
          /* noop */
        }
      }
    });
    const triggerBtn = page.getByRole('button', { name: /立即觸發 AI 分析|觸發.*AI/ });
    const triggerCount = await triggerBtn.count();
    console.log(`[B] trigger button count=${triggerCount}`);
    if (triggerCount > 0) {
      // Wait until it's visible & enabled, then click
      const firstBtn = triggerBtn.first();
      await firstBtn.scrollIntoViewIfNeeded().catch(() => {});
      await firstBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      const isDisabled = await firstBtn.isDisabled();
      console.log(`[B] trigger disabled=${isDisabled}`);
      const clickRes = await firstBtn.click({ timeout: 5000 }).then(() => 'ok').catch((e) => `err:${e.message}`);
      console.log(`[B] click result=${clickRes}`);
      // Wait for analyze response (up to 30s)
      await page.waitForResponse(
        (r) => r.url().includes('/ai/analyze') && r.request().method() === 'POST',
        { timeout: 30000 },
      ).catch((e) => console.log(`[B] analyze response wait error: ${e.message}`));
      await page.waitForTimeout(2000); // settle UI after response
      console.log(`[B] analyze response: status=${analyzeStatus} body=${analyzeBody}`);
      // 滾到 CDSS 區塊，把 CDSS 卡片入鏡
      await page.locator('h3:has-text("CDSS 調藥建議")').scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(800);
      await shot(page, 'B2_detail_after_trigger');

      // 硬性斷言：CDSS 區塊必須有 ≥1 條建議卡（確認 envelope unwrap 修復沒退化）
      const cdssCards = page.locator('[data-testid="cdss-advice-card"]');
      const cardCount = await cdssCards.count();
      const fallbackEmpty = await page.locator('text=目前無 CDSS 建議').count();
      // Find the AiAdvicePanel's CDSS h3 (lg semibold) — not the section description
      const cdssH3Count = await page.locator('h3:has-text("CDSS 調藥建議")').count();
      const adviceContainerHtml = await page
        .locator('h3:has-text("CDSS 調藥建議")')
        .locator('xpath=..')
        .innerHTML()
        .catch(() => '<not-found>');
      console.log(`[B] cards=${cardCount} emptyMsg=${fallbackEmpty} cdssH3=${cdssH3Count}`);
      console.log(`[B] AiAdvicePanel CDSS HTML (first 800): ${adviceContainerHtml.slice(0, 800)}`);

      // Probe what the client actually receives from /cdss-advice
      const fetched = await page.evaluate(async (pid) => {
        const t = localStorage.getItem('token');
        const r = await fetch(`/api/patients/${pid}/cdss-advice`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        const j = await r.json();
        return { ok: r.ok, status: r.status, sample: JSON.stringify(j).slice(0, 600) };
      }, firstPatientId);
      console.log(`[B] /cdss-advice probe: status=${fetched.status} ok=${fetched.ok}`);
      console.log(`[B] /cdss-advice payload (first 600): ${fetched.sample}`);
      if (cardCount === 0) {
        throw new Error(`CDSS list empty — cards=0 emptyMsg=${fallbackEmpty} h3=${cdssH3Count}`);
      }
    } else {
      console.log('[B] trigger button not found — 422 fix path skipped');
    }

    // 切到 Hermes tab — 用 Hermes 文字節點而非 role=tab（實際是 button）
    const hermesTab = page.locator('button:has-text("Hermes")').first();
    if (await hermesTab.count()) {
      await hermesTab.click().catch(() => {});
      await page.waitForTimeout(2000);
      await page.locator('text=Hermes Agents 流程追蹤').scrollIntoViewIfNeeded().catch(() => {});
      await shot(page, 'B3_hermes_tab_9_steps');

      // 嘗試展開 rag_search 步驟看引用（中文：「向量檢索文獻」或「rag_search」）
      const ragStep = page
        .locator('button, [role="button"]')
        .filter({ hasText: /rag_search|向量檢索|RAG.*文獻/i })
        .first();
      if (await ragStep.count()) {
        await ragStep.scrollIntoViewIfNeeded().catch(() => {});
        await ragStep.click().catch(() => {});
        await page.waitForTimeout(1000);
        await shot(page, 'B4_hermes_rag_search_citations');
      } else {
        console.log('[B] rag_search step not found; falling back to whole-page snapshot');
        await shot(page, 'B4_hermes_rag_search_citations');
      }
    }

    await page.close();
  });

  test('C_admin_feedback_review', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, adminToken);
    await page.goto(`${BASE_URL}/admin/feedback-review`, { timeout: 60000 });
    await waitReady(page, 'text=回饋審核');
    await shot(page, 'C_admin_feedback_review');
    await page.close();
  });
});
