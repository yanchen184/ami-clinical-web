/**
 * AMI Clinical Web — Screenshot Tour
 *
 * Playwright 尚未安裝，請先執行：
 *   npm install -D @playwright/test
 *   npx playwright install chromium
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

// ── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:17000';
const API_BASE = 'http://localhost:15000';
const SCREENSHOT_DIR = path.resolve(__dirname, 'artifacts/screenshots');

const DOCTOR_CREDS = { username: 'doctor01', password: 'Doctor@123456' };
const CM_CREDS = { username: 'cm01', password: 'Manager@123456' };

// ── Shared State ─────────────────────────────────────────────────────────────

let doctorToken: string;
let cmToken: string;
let firstPatientId: string;
let createdNoteId: number | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiPost<T>(
  url: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${url} failed [${res.status}]: ${text}`);
  }
  return JSON.parse(text) as T;
}

async function apiGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${url} failed [${res.status}]: ${text}`);
  }
  return JSON.parse(text) as T;
}

async function screenshot(page: Page, name: string): Promise<void> {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[screenshot] ${name}.png`);
}

/** 將 token 寫入 localStorage，讓 authStore 的 getInitialState 能讀到 */
async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((t) => {
    window.localStorage.setItem('token', t);
  }, token);
}

/** 等待頁面主要內容載入（networkidle + 指定 selector 出現） */
async function waitForContent(
  page: Page,
  selector: string,
  timeout = 15000,
): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForSelector(selector, { timeout });
  // 讓動畫安定
  await page.waitForTimeout(800);
}

// ── beforeAll: 建立測試資料 ────────────────────────────────────────────────

test.beforeAll(async () => {
  // 確保截圖目錄存在
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // 1. 取得 doctorToken
  const doctorLogin = await apiPost<{ token?: string; accessToken?: string }>(
    `${API_BASE}/api/auth/login`,
    DOCTOR_CREDS,
  );
  doctorToken = (doctorLogin as any).data?.accessToken ?? doctorLogin.accessToken ?? doctorLogin.token ?? '';
  if (!doctorToken) throw new Error('Doctor login failed: no token returned');

  // 2. 取得 cmToken
  const cmLogin = await apiPost<{ token?: string; accessToken?: string; data?: { accessToken?: string } }>(
    `${API_BASE}/api/auth/login`,
    CM_CREDS,
  );
  cmToken = (cmLogin as any).data?.accessToken ?? cmLogin.accessToken ?? cmLogin.token ?? '';
  if (!cmToken) throw new Error('CM login failed: no token returned');

  // 3. 確認病患存在（至少 3 筆）
  const patientsRaw = await apiGet<{
    data?: { content?: Array<{ id: string; name: string }>; totalElements?: number };
    content?: Array<{ id: string; name: string }>;
    totalElements?: number;
  }>(`${API_BASE}/api/patients?page=0&size=10`, doctorToken);

  const patientsRes = {
    content: patientsRaw.data?.content ?? patientsRaw.content ?? [],
    totalElements: patientsRaw.data?.totalElements ?? patientsRaw.totalElements ?? 0,
  };

  if (patientsRes.totalElements < 3) {
    // 推送假病患 HIS 資料
    const fakePatients = [
      {
        type: 'BASIC',
        idNo: 'A123456789',
        name: '王大明',
        gender: 'M',
        birthdate: '1960-05-15',
        phone: '0912345678',
        amiOnsetDate: '2024-01-10',
        riskLevel: 'HIGH',
      },
      {
        type: 'BASIC',
        idNo: 'B234567890',
        name: '李小花',
        gender: 'F',
        birthdate: '1970-08-20',
        phone: '0923456789',
        amiOnsetDate: '2024-03-05',
        riskLevel: 'MEDIUM',
      },
      {
        type: 'BASIC',
        idNo: 'C345678901',
        name: '張三',
        gender: 'M',
        birthdate: '1955-12-01',
        phone: '0934567890',
        amiOnsetDate: '2023-11-20',
        riskLevel: 'LOW',
      },
    ];

    for (const p of fakePatients) {
      try {
        await apiPost(`${API_BASE}/api/internal/his-records`, p, doctorToken);
      } catch (err) {
        // 若已存在則忽略
        console.warn('[setup] his-record push warning:', err);
      }
    }

    // 重新取得
    const refreshedRaw = await apiGet<{
      data?: { content?: Array<{ id: string }> };
      content?: Array<{ id: string }>;
    }>(`${API_BASE}/api/patients?page=0&size=10`, doctorToken);
    const refreshed = refreshedRaw.data?.content ?? refreshedRaw.content ?? [];
    firstPatientId = refreshed[0]?.id ?? '';
  } else {
    firstPatientId = patientsRes.content[0]?.id ?? '';
  }

  if (!firstPatientId) throw new Error('No patient found after setup');

  // 4. 為第一筆高風險病患建立 ai_summary
  try {
    await apiPost(
      `${API_BASE}/api/internal/ai-summary`,
      {
        patientId: firstPatientId,
        subjective: '病患反映近期胸悶、輕微喘息，夜間偶有胸痛情形。',
        objective: '血壓 148/92 mmHg，心率 88 bpm，血氧 96%。',
        assessment: '血壓控制不佳，心臟功能需持續追蹤。',
        plan: '調整降壓藥物劑量，安排心臟超音波檢查，追蹤血壓 7 天趨勢。',
      },
      doctorToken,
    );
  } catch (err) {
    console.warn('[setup] ai-summary warning:', err);
  }

  // 5. 為第一筆病患建立 case note
  try {
    const noteRes = await apiPost<{ id?: number }>(
      `${API_BASE}/api/patients/${firstPatientId}/notes`,
      { content: '個案主訴近期服藥規律，但血壓仍偏高，已安排下週回診。' },
      cmToken,
    );
    createdNoteId = noteRes.id ?? null;
  } catch (err) {
    console.warn('[setup] case note warning:', err);
  }
});

// ── afterAll: 清理測試資料 ────────────────────────────────────────────────

test.afterAll(async () => {
  // 刪除建立的 case note
  if (createdNoteId && firstPatientId) {
    try {
      await fetch(
        `${API_BASE}/api/patients/${firstPatientId}/notes/${createdNoteId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${cmToken}` },
        },
      );
    } catch (err) {
      console.warn('[cleanup] delete note warning:', err);
    }
  }
});

// ── Test Suite ────────────────────────────────────────────────────────────────

test.describe('AMI Clinical Web — Screenshot Tour', () => {
  test.setTimeout(300000);

  // ── 01: 登入頁 ────────────────────────────────────────────────────────────
  test('01_login', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(`${BASE_URL}/login`, { timeout: 60000 });
    await waitForContent(page, '#username');

    await screenshot(page, '01_login');
    await page.close();
  });

  // ── 02: Doctor 病患列表 ───────────────────────────────────────────────────
  test('02_doctor_patient_list', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, doctorToken);

    await page.goto(`${BASE_URL}/doctor/patients`, { timeout: 60000 });
    await waitForContent(page, 'input[placeholder*="搜尋"]');

    await screenshot(page, '02_doctor_patient_list');
    await page.close();
  });

  // ── 02b: 搜尋「王」 ───────────────────────────────────────────────────────
  test('02b_doctor_patient_list_search', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, doctorToken);

    await page.goto(`${BASE_URL}/doctor/patients`, { timeout: 60000 });
    await waitForContent(page, 'input[placeholder*="搜尋"]');

    await page.fill('input[placeholder*="搜尋"]', '王');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await screenshot(page, '02b_doctor_patient_list_search');
    await page.close();
  });

  // ── 02c: riskLevel=HIGH 篩選 ──────────────────────────────────────────────
  test('02c_doctor_patient_list_filter_high', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, doctorToken);

    await page.goto(`${BASE_URL}/doctor/patients`, { timeout: 60000 });
    await waitForContent(page, 'select');

    await page.selectOption('select', 'HIGH');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await screenshot(page, '02c_doctor_patient_list_filter_high');
    await page.close();
  });

  // ── 03: Doctor 病患詳細頁 ─────────────────────────────────────────────────
  test('03_doctor_patient_detail', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, doctorToken);

    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, {
      timeout: 60000,
    });
    await waitForContent(page, 'text=醫師回饋');

    await screenshot(page, '03_doctor_patient_detail');
    await page.close();
  });

  // ── 03b: Feedback 表單 ─────────────────────────────────────────────────────
  test('03b_doctor_feedback_form', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, doctorToken);

    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, {
      timeout: 60000,
    });
    await waitForContent(page, 'text=醫師回饋');

    // 點第 4 顆星
    const stars = page.locator('text=★');
    await stars.nth(3).click();
    await page.fill('textarea[placeholder*="回饋"]', '建議非常實用，調藥方向正確。');
    await page.waitForTimeout(500);

    await screenshot(page, '03b_doctor_feedback_form');
    await page.close();
  });

  // ── 03c: 送出 Feedback 後 ─────────────────────────────────────────────────
  test('03c_doctor_feedback_sent', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, doctorToken);

    await page.goto(`${BASE_URL}/doctor/patients/${firstPatientId}`, {
      timeout: 60000,
    });
    await waitForContent(page, 'text=醫師回饋');

    const stars = page.locator('text=★');
    await stars.nth(4).click();
    await page.fill('textarea[placeholder*="回饋"]', 'CDSS 建議與臨床判斷一致，非常有幫助。');
    await page.click('button:has-text("送出回饋")');
    await page.waitForSelector('text=回饋已送出', { timeout: 10000 });
    await page.waitForTimeout(800);

    await screenshot(page, '03c_doctor_feedback_sent');
    await page.close();
  });

  // ── 03d: Case Note 區塊（doctor 視角看 CM detail 頁） ──────────────────────
  // Doctor 沒有 case note，此截圖改用 CM token 進入 CM detail 頁
  test('03d_doctor_case_notes', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, cmToken);

    await page.goto(`${BASE_URL}/casemanager/patients/${firstPatientId}`, {
      timeout: 60000,
    });
    await waitForContent(page, 'text=個案紀錄');

    // 捲動到個案紀錄區（取 h3 heading，避免 strict mode）
    await page.locator('h3:has-text("個案紀錄")').scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(600);

    await screenshot(page, '03d_doctor_case_notes');
    await page.close();
  });

  // ── 04: Case Manager Dashboard ────────────────────────────────────────────
  test('04_casemanager_dashboard', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, cmToken);

    await page.goto(`${BASE_URL}/casemanager/dashboard`, { timeout: 60000 });
    await waitForContent(page, 'text=KPI 儀表板');

    await screenshot(page, '04_casemanager_dashboard');
    await page.close();
  });

  // ── 05: Case Manager 病患列表 ─────────────────────────────────────────────
  test('05_casemanager_patient_list', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, cmToken);

    await page.goto(`${BASE_URL}/casemanager/patients`, { timeout: 60000 });
    await waitForContent(page, 'text=個案列表');

    await screenshot(page, '05_casemanager_patient_list');
    await page.close();
  });

  // ── 05b: 我的病患篩選（搜尋 cm1）─────────────────────────────────────────
  test('05b_casemanager_my_patients', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, cmToken);

    await page.goto(`${BASE_URL}/casemanager/patients`, { timeout: 60000 });
    await waitForContent(page, 'input[placeholder*="搜尋"]');

    // 在搜尋欄輸入 cm1（個案管理師自己負責的病患）
    await page.fill('input[placeholder*="搜尋"]', 'cm');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await screenshot(page, '05b_casemanager_my_patients');
    await page.close();
  });

  // ── 05c: 紅色警示（HIGH risk）篩選 ───────────────────────────────────────
  test('05c_casemanager_red_alerts', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, cmToken);

    await page.goto(`${BASE_URL}/casemanager/patients`, { timeout: 60000 });
    await waitForContent(page, 'select');

    await page.selectOption('select', 'HIGH');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await screenshot(page, '05c_casemanager_red_alerts');
    await page.close();
  });

  // ── 06: Case Manager 病患詳細頁 ───────────────────────────────────────────
  test('06_casemanager_patient_detail', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, cmToken);

    await page.goto(
      `${BASE_URL}/casemanager/patients/${firstPatientId}`,
      { timeout: 60000 },
    );
    await waitForContent(page, 'text=個案概況');

    await screenshot(page, '06_casemanager_patient_detail');
    await page.close();
  });

  // ── 07: 通知頁 ────────────────────────────────────────────────────────────
  test('07_notifications', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, cmToken);

    await page.goto(`${BASE_URL}/notifications`, { timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(1000);

    await screenshot(page, '07_notifications');
    await page.close();
  });

  // ── 08: 空搜尋結果（搜尋 zzz）────────────────────────────────────────────
  test('08_patient_list_empty', async ({ browser }) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthToken(page, doctorToken);

    await page.goto(`${BASE_URL}/doctor/patients`, { timeout: 60000 });
    await waitForContent(page, 'input[placeholder*="搜尋"]');

    await page.fill('input[placeholder*="搜尋"]', 'zzz');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForSelector('text=無符合條件的病患', { timeout: 10000 });
    await page.waitForTimeout(800);

    await screenshot(page, '08_patient_list_empty');
    await page.close();
  });
});
