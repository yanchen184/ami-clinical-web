/**
 * AMI Clinical Web — 18 Feature Screenshot Tour (v2)
 *
 * 執行截圖：
 *   npx playwright test e2e/99-screenshot-tour.spec.ts --project=chromium
 *
 * 截圖輸出目錄：e2e/artifacts/screenshots/
 */

import { test, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:17000';
const API_BASE = 'http://localhost:17000'; // Vite dev server proxies /api → :17081
const SCREENSHOT_DIR = path.resolve(__dirname, 'artifacts/screenshots');

const DOCTOR_CREDS = { username: 'doctor01', password: 'Doctor@123456' };
const CM_CREDS = { username: 'cm01', password: 'Manager@123456' };
const ADMIN_CREDS = { username: 'admin', password: 'Admin@123456' };

// ── Shared State ──────────────────────────────────────────────────────────────

let doctorToken = '';
let cmToken = '';
let adminToken = '';
let firstPatientId = '';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
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

// ── beforeAll ─────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const loginToken = async (creds: { username: string; password: string }) => {
    const res = await apiPost<any>(`${API_BASE}/api/auth/login`, creds);
    return res?.data?.accessToken ?? res?.accessToken ?? res?.token ?? '';
  };

  doctorToken = await loginToken(DOCTOR_CREDS).catch(() => '');
  cmToken = await loginToken(CM_CREDS).catch(() => '');
  adminToken = await loginToken(ADMIN_CREDS).catch(() => '');

  // Fallback: use doctorToken if admin not configured
  if (!adminToken) adminToken = doctorToken;

  // Get first patient
  if (doctorToken) {
    const raw = await apiGet<any>(`${API_BASE}/api/patients?page=0&size=10`, doctorToken).catch(() => null);
    const content = raw?.data?.content ?? raw?.content ?? [];
    firstPatientId = content[0]?.id ?? '';
  }

  // Create AI summary for first patient if available
  if (firstPatientId && doctorToken) {
    await apiPost(
      `${API_BASE}/api/internal/ai-summary`,
      {
        patientId: firstPatientId,
        soap: {
          subjective: '病患主訴近二週胸悶加重，夜間偶有喘息，輕度下肢水腫，無胸痛。依從性良好，藥物均按時服用。',
          objective: '血壓 152/94 mmHg，心率 82 bpm，血氧 97%。體重較上次增加 1.8 kg。LDL 98 mg/dL，HbA1c 6.8%。心電圖：竇性心律，無新發 ST 變化。',
          assessment: 'AMI 後心臟功能追蹤。血壓控制尚可但仍偏高，合併輕度體液滯留，建議調整利尿劑。LDL 已達治療目標（<100 mg/dL）。',
          plan: '1. Furosemide 劑量調整至 40 mg QD。2. 持續低鹽飲食，每日鈉攝取 <2g。3. 安排 2 週後心臟超音波追蹤。4. 若喘息加重立即回診。',
        },
        cdssAdvice: [],
      },
      doctorToken,
    ).catch(() => {});
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('AMI Clinical Web — 18 Feature Screenshot Tour', () => {
  test.setTimeout(300_000);

  // ====================================================
  // 功能 1: 登入頁
  // ====================================================
  test('01_login_page', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/login`, { timeout: 60000 });
    await waitReady(page, 'input, form');
    await shot(page, '01_login_page');
    await page.close();
  });

  // ====================================================
  // 功能 2: Doctor 病患列表 (含搜尋/篩選)
  // ====================================================
  test('02a_doctor_patient_list', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients`, { timeout: 60000 });
    await waitReady(page, '.grid, [class*="card"], text=病患列表');
    await shot(page, '02a_doctor_patient_list');
    await page.close();
  });

  test('02b_doctor_patient_list_search', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients`, { timeout: 60000 });
    await waitReady(page, 'input[placeholder*="搜尋"]');
    await page.fill('input[placeholder*="搜尋"]', '王');
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, '02b_doctor_patient_list_search');
    await page.close();
  });

  test('02c_doctor_patient_list_filter', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients`, { timeout: 60000 });
    await waitReady(page, 'select');
    await page.selectOption('select', 'HIGH');
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, '02c_doctor_patient_list_filter');
    await page.close();
  });

  // ====================================================
  // 功能 3: Doctor 病患詳細頁 + SOAP + Tab 導覽
  // ====================================================
  test('03a_doctor_patient_detail_overview', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=總覽, text=CDSS, text=SOAP');
    await shot(page, '03a_doctor_patient_detail_overview');
    await page.close();
  });

  test('03b_doctor_patient_detail_soap', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=Hermes SOAP');
    // wait for SOAP content to load (all 4 boxes have text)
    await page.waitForFunction(() => {
      const ps = Array.from(document.querySelectorAll('p'));
      return ps.filter(p => p.textContent && p.textContent.length > 20).length >= 4;
    }, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    // scroll gently so SOAP 4-box is visible but patient header stays on screen
    await page.evaluate(() => window.scrollBy({ top: 80, behavior: 'instant' }));
    await page.waitForTimeout(500);
    await shot(page, '03b_doctor_patient_detail_soap');
    await page.close();
  });

  // ====================================================
  // 功能 3c: Hermes 7 步驟流程視覺化（Trace）
  // ====================================================
  test('03e_hermes_trace_pipeline', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 1200 });
    await setToken(page, doctorToken);
    // mock /analyze response so HermesTraceCard always renders 7 steps
    await page.route(url => {
      const u = url.toString();
      return u.includes('/ai/analyze') || u.endsWith('/analyze');
    }, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary_id: 99, soap: { S: '示範 S', O: '示範 O', A: '示範 A', P: '示範 P' },
          cdss: { recommendations: [], warnings: [], rule_sources: [] },
          rule_sources: [], used_rag: true, triggers: [],
          skill_versions: { ami: '2026-04-27', diabetes: '2026-04-27' },
          latency_ms: 7676,
          trace: {
            total_ms: 7676,
            steps: [
              { step: 1, name: 'ingest', title: '病患資料攝入', duration_ms: 12, summary: '收到病患 p002 — AMI + DM', detail: { patient_id: 'p002', icd10: ['I21.0'] } },
              { step: 2, name: 'skill_load', title: '技能包載入', duration_ms: 45, summary: '載入 SKILL/ami v2026-04-27, SKILL/diabetes v2026-04-27', detail: { skills: ['ami', 'diabetes'] } },
              { step: 3, name: 'rag_decide', title: 'RAG 決策', duration_ms: 8, summary: '判定需要 RAG（共病條件觸發）', detail: { use_rag: true, reason: 'comorbidity_match' } },
              { step: 4, name: 'rag_search', title: 'RAG 文獻檢索', duration_ms: 320, summary: '檢索到 5 篇相關文獻 + 3 個 few-shot 範例', detail: { hits: 5, examples: 3 } },
              { step: 5, name: 'few_shot', title: '範例組裝', duration_ms: 18, summary: '組合 3 個 example（含 NEGATIVE feedback 學習）', detail: { count: 3 } },
              { step: 6, name: 'llm', title: 'LLM 推理', duration_ms: 7180, summary: 'Gemini-2.5-flash-lite 產出 SOAP + CDSS 建議', detail: { model: 'gemini-2.5-flash-lite', input_tokens: 2150, output_tokens: 920 } },
              { step: 7, name: 'persist', title: '結果落庫', duration_ms: 93, summary: '寫入 ai_summary.id=99', detail: { ai_summary_id: 99 } },
            ],
          },
        }),
      });
    });
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=Hermes SOAP');
    // 1. switch to Hermes 流程 tab (analyze button lives inside it)
    const hermesTab = page.locator('button, [role="tab"]').filter({ hasText: /Hermes\s*流程/ }).first();
    if (await hermesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await hermesTab.click();
      await page.waitForTimeout(400);
    }
    // 2. click 立即觸發 AI 分析 button
    const analyzeBtn = page.locator('button').filter({ hasText: /立即觸發\s*AI\s*分析|重新分析|觸發.*分析/ }).first();
    if (await analyzeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analyzeBtn.click();
    }
    // 3. wait for trace card (mocked response renders 7 steps)
    await page.waitForSelector('[data-testid="hermes-trace-card"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    // scroll trace card into view
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="hermes-trace-card"]') as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03e_hermes_trace_pipeline.png'), fullPage: true });
    console.log('[shot] 03e_hermes_trace_pipeline.png (full page)');
    await page.close();
  });

  // ====================================================
  // 功能 4: AI 建議面板 + 醫師回饋（評分 ≤ 2 → 訂正）
  // ====================================================
  test('04a_ai_advice_panel', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    // mock CDSS advice so the cards are visible
    await page.route('**/api/patients/*/cdss-advice', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS', success: true, message: 'Success',
          data: [
            {
              id: 1, type: 'MEDICATION', content: '考慮增加 Amlodipine 劑量至 10mg/day',
              confidence: 78, evidenceLevel: 'B',
              disclaimer: '本建議僅供參考，最終由醫師判斷',
              createdAt: new Date().toISOString(),
            },
            {
              id: 2, type: 'LIFESTYLE', content: '建議減少鹽分攝取，每日 < 6g',
              confidence: 92, evidenceLevel: 'A',
              disclaimer: '本建議僅供參考，最終由醫師判斷',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=CDSS 調藥建議');
    // wait for advice cards to render
    await page.waitForSelector('text=Amlodipine', { timeout: 8000 }).catch(() => {});
    // scroll so CDSS advice cards fill the viewport
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h2,h3,h4')).find(e => e.textContent?.includes('CDSS'));
      if (el) (el as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(600);
    await shot(page, '04a_ai_advice_panel');
    await page.close();
  });

  test('04b_doctor_feedback_low_rating_correction', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=醫師回饋');
    // Click 2nd star (rating=2) to trigger inline correction
    const stars = page.locator('button:has-text("★")');
    await stars.nth(1).click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, '04b_doctor_feedback_low_rating_correction');
    await page.close();
  });

  // ====================================================
  // 功能 5: 趨勢指標儀表板 (TrendDashboard)
  // ====================================================
  test('05a_trend_dashboard', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=趨勢指標');
    // Click the 趨勢指標 tab
    await page.locator('button:has-text("趨勢指標")').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, '05a_trend_dashboard');
    await page.close();
  });

  test('05b_trend_dashboard_7days', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=趨勢指標');
    await page.locator('button:has-text("趨勢指標")').first().click().catch(() => {});
    await page.waitForTimeout(800);
    await page.locator('button:has-text("7 天")').first().click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, '05b_trend_dashboard_7days');
    await page.close();
  });

  // ====================================================
  // 功能 6: LDL-C 趨勢圖
  // ====================================================
  test('06_ldl_trend_chart', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=趨勢指標');
    await page.locator('button:has-text("趨勢指標")').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
    await page.waitForTimeout(600);
    await shot(page, '06_ldl_trend_chart');
    await page.close();
  });

  // ====================================================
  // 功能 11/12/13: 用藥紀錄 / 診斷 / 不良反應
  // ====================================================
  test('11_medication_history', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=用藥紀錄');
    await page.locator('button:has-text("用藥紀錄")').first().click().catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, '11_medication_history');
    await page.close();
  });

  test('12_diagnosis_list', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=診斷紀錄');
    await page.locator('button:has-text("診斷紀錄")').first().click().catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await shot(page, '12_diagnosis_list');
    await page.close();
  });

  test('13_adverse_reaction', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, doctorToken);
    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=不良反應');
    await page.locator('button:has-text("不良反應")').first().click().catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await shot(page, '13_adverse_reaction');
    await page.close();
  });

  // ====================================================
  // 功能 5 (CM): 個管師 病患列表 — 我的個案 Tab
  // ====================================================
  test('cm_01_my_patients_tab', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, cmToken);
    await page.goto(`${BASE_URL}/casemanager/patients`, { timeout: 60000 });
    await waitReady(page, 'text=個案管理');
    await shot(page, 'cm_01_my_patients_tab');
    await page.close();
  });

  // ====================================================
  // 功能 6 (CM): 紅燈警示 Tab
  // ====================================================
  test('cm_02_red_alerts_tab', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, cmToken);
    await page.goto(`${BASE_URL}/casemanager/patients`, { timeout: 60000 });
    await waitReady(page, 'text=紅燈警示');
    await page.locator('button:has-text("紅燈警示")').first().click().catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, 'cm_02_red_alerts_tab');
    await page.close();
  });

  // ====================================================
  // 功能 7: 追蹤行事曆 Tab
  // ====================================================
  test('cm_03_calendar_tab', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, cmToken);
    // 後端尚無 follow-ups API，mock 假資料：當前週 (週一-週日) 內 3 筆事件
    await page.route(/\/api\/follow-ups(\?.*)?$/, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return; }
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const day = (offset: number, hour: number, min: number) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + offset);
        d.setHours(hour, min, 0, 0);
        return d.toISOString();
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        code: 'SUCCESS', success: true,
        data: [
          { id: 1, patientId: '474c4369-dd68-4076-8513-7bc14a67ed7c', patientName: '陳志明', type: 'PHONE', scheduledAt: day(1, 10, 0), note: '電話追蹤血壓控制狀況', status: 'SCHEDULED' },
          { id: 2, patientId: '474c4369-dd68-4076-8513-7bc14a67ed7c', patientName: '陳志明', type: 'CLINIC', scheduledAt: day(2, 14, 30), note: '心臟內科回診', status: 'SCHEDULED' },
          { id: 3, patientId: '474c4369-dd68-4076-8513-7bc14a67ed7c', patientName: '陳志明', type: 'LAB', scheduledAt: day(4, 9, 0), note: 'LDL-C 抽血追蹤', status: 'SCHEDULED' },
        ],
      })});
    });
    await page.goto(`${BASE_URL}/casemanager/patients`, { timeout: 60000 });
    await waitReady(page, 'text=追蹤行事曆');
    await page.locator('button:has-text("追蹤行事曆")').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, 'cm_03_calendar_tab');
    await page.close();
  });

  test('cm_03b_calendar_create_form', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, cmToken);
    await page.goto(`${BASE_URL}/casemanager/patients`, { timeout: 60000 });
    await waitReady(page, 'text=追蹤行事曆');
    await page.locator('button:has-text("追蹤行事曆")').first().click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("新增追蹤事件")').first().click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, 'cm_03b_calendar_create_form');
    await page.close();
  });

  // ====================================================
  // 功能 8: KPI 儀表板
  // ====================================================
  test('cm_04_kpi_dashboard', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, cmToken);
    await page.goto(`${BASE_URL}/casemanager/dashboard`, { timeout: 60000 });
    await waitReady(page, 'text=KPI 儀表板');
    await shot(page, 'cm_04_kpi_dashboard');
    await page.close();
  });

  // ====================================================
  // 功能 9: CM 病患詳細頁
  // ====================================================
  test('cm_05_patient_detail', async ({ browser }) => {
    if (!firstPatientId) { console.log('[skip] no patient'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, cmToken);
    await page.goto(`${BASE_URL}/casemanager/patients/${firstPatientId}`, { timeout: 60000 });
    await waitReady(page, 'text=個案概況, text=個案詳情');
    await shot(page, 'cm_05_patient_detail');
    await page.close();
  });

  // ====================================================
  // 功能 10: 通知推播
  // ====================================================
  test('cm_06_notifications', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, cmToken);
    await page.goto(`${BASE_URL}/notifications`, { timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, 'cm_06_notifications');
    await page.close();
  });

  // ====================================================
  // 功能 17: 警示規則設定 (Admin)
  // ====================================================
  test('admin_01_alert_rules', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, adminToken);
    await page.goto(`${BASE_URL}/admin/alert-rules`, { timeout: 60000 });
    await waitReady(page, 'text=警示規則設定');
    await shot(page, 'admin_01_alert_rules');
    await page.close();
  });

  // ====================================================
  // 功能 10 (Admin): 藥品基本檔管理
  // ====================================================
  test('admin_02_med_master', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, adminToken);
    // 後端尚無 med-masters API，mock 假資料
    await page.route(/\/api\/med-masters(\?.*)?$/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        code: 'SUCCESS', success: true,
        data: { content: [
          { id: 1, hospitalCode: 'CGMH-0001', nhiCode: 'BC23351100', atcCode: 'C10AA01', drugName: 'Atorvastatin 10mg', genericName: 'Atorvastatin', dosageForm: '錠', specification: '10mg', enabled: true },
          { id: 2, hospitalCode: 'CGMH-0002', nhiCode: 'BC23351200', atcCode: 'C10AA05', drugName: 'Rosuvastatin 5mg', genericName: 'Rosuvastatin', dosageForm: '錠', specification: '5mg', enabled: true },
          { id: 3, hospitalCode: 'CGMH-0003', nhiCode: 'BC23351300', atcCode: 'C10AX09', drugName: 'Ezetimibe 10mg', genericName: 'Ezetimibe', dosageForm: '錠', specification: '10mg', enabled: true },
        ], totalElements: 3, totalPages: 1, number: 0, size: 20 },
      })});
    });
    await page.goto(`${BASE_URL}/admin/med-master`, { timeout: 60000 });
    await waitReady(page, 'text=藥品基本檔');
    await shot(page, 'admin_02_med_master');
    await page.close();
  });

  test('admin_02b_med_master_create', async ({ browser }) => {
    if (!adminToken || adminToken === doctorToken) { console.log('[skip] no admin token'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, adminToken);
    await page.goto(`${BASE_URL}/admin/med-master`, { timeout: 60000 });
    await waitReady(page, 'text=藥品基本檔');
    await page.locator('button:has-text("新增藥品")').first().click().catch(() => {});
    await page.waitForTimeout(600).catch(() => {});
    await shot(page, 'admin_02b_med_master_create');
    await page.close();
  });

  // ====================================================
  // 功能 18: 配方主檔管理 (Admin)
  // ====================================================
  test('admin_03_formula_master', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, adminToken);
    // 後端尚無 formulas API，mock 假資料
    await page.route(/\/api\/formulas(\?.*)?$/, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        code: 'SUCCESS', success: true,
        data: { content: [
          { id: 1, name: 'Rosuvastatin 低強度', ldlReductionPct: 30, category: 'STATIN', insuranceType: 'NHI', enabled: true, items: [
            { id: 101, drugId: 2, drugName: 'Rosuvastatin 5mg', dosage: '1 tab', frequency: 'QD', route: 'PO' },
          ] },
          { id: 2, name: 'Atorvastatin 中強度', ldlReductionPct: 45, category: 'STATIN', insuranceType: 'NHI', enabled: true, items: [
            { id: 201, drugId: 1, drugName: 'Atorvastatin 10mg', dosage: '2 tab', frequency: 'QD', route: 'PO' },
          ] },
          { id: 3, name: 'Ezetimibe 加成', ldlReductionPct: 18, category: 'COMBINATION', insuranceType: 'NHI', enabled: true, items: [
            { id: 301, drugId: 3, drugName: 'Ezetimibe 10mg', dosage: '1 tab', frequency: 'QD', route: 'PO' },
            { id: 302, drugId: 1, drugName: 'Atorvastatin 10mg', dosage: '1 tab', frequency: 'QD', route: 'PO' },
          ] },
        ], totalElements: 3, totalPages: 1, number: 0, size: 20 },
      })});
    });
    await page.goto(`${BASE_URL}/admin/formula-master`, { timeout: 60000 });
    await waitReady(page, 'text=配方主檔');
    await shot(page, 'admin_03_formula_master');
    await page.close();
  });

  test('admin_03b_formula_master_create', async ({ browser }) => {
    if (!adminToken || adminToken === doctorToken) { console.log('[skip] no admin token'); return; }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, adminToken);
    await page.goto(`${BASE_URL}/admin/formula-master`, { timeout: 60000 });
    await waitReady(page, 'text=配方主檔');
    await page.locator('button:has-text("新增配方")').first().click().catch(() => {});
    await page.waitForTimeout(600).catch(() => {});
    await shot(page, 'admin_03b_formula_master_create');
    await page.close();
  });

  // ====================================================
  // 功能 19: 配方組合查詢 (Admin)
  // ====================================================
  test('admin_04_formula_combo', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setToken(page, adminToken);
    // 後端尚無 formula-combos API，mock 假資料
    await page.route(/\/api\/formula-combos(\?.*)?$/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        code: 'SUCCESS', success: true,
        data: { content: [
          { id: 1, formulaAId: 1, formulaAName: 'Rosuvastatin 低強度', formulaBId: 3, formulaBName: 'Ezetimibe 加成', formulaCId: null, formulaCName: null, combinedLdlReductionPct: 44 },
          { id: 2, formulaAId: 2, formulaAName: 'Atorvastatin 中強度', formulaBId: 3, formulaBName: 'Ezetimibe 加成', formulaCId: null, formulaCName: null, combinedLdlReductionPct: 57 },
        ], totalElements: 2, totalPages: 1, number: 0, size: 20 },
      })});
    });
    await page.goto(`${BASE_URL}/admin/formula-combos`, { timeout: 60000 });
    await waitReady(page, 'text=配方組合查詢');
    await shot(page, 'admin_04_formula_combo');
    await page.close();
  });
});
