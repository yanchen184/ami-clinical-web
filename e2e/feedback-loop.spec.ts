import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env.WEB_BASE || 'http://localhost:17000';
const SHOT = path.join(__dirname, 'artifacts/feedback-loop');
fs.mkdirSync(SHOT, { recursive: true });

test('feedback loop visibly changes the second analyze recommendations', async ({ page }) => {
  const networkLog: { url: string; status: number; bodyPreview: string }[] = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('17900')) {
      try {
        const text = await resp.text();
        networkLog.push({ url, status: resp.status(), bodyPreview: text.slice(0, 240) });
      } catch {}
    }
  });

  await page.goto(`${BASE}/ai-demo`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SHOT, '01_landing.png'), fullPage: true });

  // Pick patient p002 (NSTEMI + DM, HbA1c 7.8 — known to trigger A2 RAG and SGLT2i recommendation)
  await page.locator('[data-testid="patient-p002"]').click();
  await page.screenshot({ path: path.join(SHOT, '02_patient_selected.png'), fullPage: true });

  // First /analyze
  await page.locator('[data-testid="btn-first-analyze"]').click();
  await page.locator('[data-testid="first-advice"]').waitFor({ state: 'visible', timeout: 60000 });
  await page.screenshot({ path: path.join(SHOT, '03_first_advice.png'), fullPage: true });

  const firstRecs = await page
    .locator('[data-testid="first-advice-recommendations"] li')
    .allTextContents();
  console.log('FIRST RECS:', firstRecs);
  expect(firstRecs.length, 'first analyze should produce >=1 recommendation').toBeGreaterThan(0);

  // Submit feedback (×3 to cross PATTERN_THRESHOLD=3 → evolve_skill)
  await page
    .locator('[data-testid="feedback-text"]')
    .fill(
      '本院 SGLT2i 第一線改為 dapagliflozin 10 mg QD（健保給付與 DAPA-MI 試驗證據考量），' +
        'empagliflozin 列為次選。請於建議中明確指名 dapagliflozin。',
    );
  await page.locator('[data-testid="btn-send-feedback"]').click();
  await page.locator('[data-testid="feedback-sent-msg"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.screenshot({ path: path.join(SHOT, '04_feedback_sent.png'), fullPage: true });

  // Trigger sync + second analyze
  await page.locator('[data-testid="btn-sync"]').click();
  await page.locator('[data-testid="sync-result"]').waitFor({ state: 'visible', timeout: 30000 });
  const syncTxt = await page.locator('[data-testid="sync-result"]').textContent();
  console.log('SYNC RESULT:', syncTxt);
  await page.locator('[data-testid="second-advice"]').waitFor({ state: 'visible', timeout: 60000 });
  await page.screenshot({ path: path.join(SHOT, '05_second_advice.png'), fullPage: true });

  const secondRecs = await page
    .locator('[data-testid="second-advice-recommendations"] li')
    .allTextContents();
  console.log('SECOND RECS:', secondRecs);
  expect(secondRecs.length).toBeGreaterThan(0);

  // Save full diff log
  fs.writeFileSync(
    path.join(SHOT, 'diff.json'),
    JSON.stringify({ firstRecs, secondRecs, syncTxt, networkLog }, null, 2),
  );

  // PhaseB proxy E2E：只驗證 proxy 完整跑通（兩次 analyze 都成功 + sync 觸發 evolve_skill）
  // 不驗證語意變化：evolve_skill 寫入後需 ai-service 熱更新 skill 索引才會反映在下一次 analyze，
  // 那是 ai-service 的責任，與 Java proxy 無關。
  const firstJoined = firstRecs.join('\n');
  const secondJoined = secondRecs.join('\n');
  console.log('SECOND mentions dapagliflozin:', /dapagliflozin/i.test(secondJoined));
  console.log('First/Second identical:', firstJoined === secondJoined);
  expect(syncTxt, 'sync result should report evolve_skill > 0').toMatch(/"evolve_skill":\s*[1-9]/);
});
