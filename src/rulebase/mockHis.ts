// 假病人 / 假 HIS 資料（demo 用，不對應真實病人）
// 5 位代表性 AMI 後期照護病人，覆蓋 rulebase 主要分支

import type { AdrFlags } from './contraindications';
import { EMPTY_ADR } from './contraindications';

export interface MockMedicationRecord {
  visitDate: string;       // YYYY-MM-DD
  medCode: string;         // 對應 drugs.ts
  medDays: number;
}

export interface MockLabResult {
  reportDate: string;
  ldlC: number;            // mg/dL
  hba1c?: number;
  egfr?: number;
}

export interface MockHisRecord {
  /** 假病歷號 */
  chrNoNew: string;
  patName: string;
  age: number;
  gender: 'M' | 'F';

  amiOnsetDate: string;            // 確診日 / 出院日
  recurrentEvent: boolean;
  hasDiabetes: boolean;
  hasFh: boolean;
  hasCkd: boolean;
  hasPad: boolean;
  hasHtn: boolean;
  hasHfref: boolean;

  adr: AdrFlags;
  /** 近 12 個月 LDL-C 抽血史，最新在前 */
  labs: MockLabResult[];
  /** 近 365 天用藥史 */
  medications: MockMedicationRecord[];
  /** 用藥順從性原始輸入 */
  adherence: { hDays: number; gDays: number };
  /** demo 場景描述（給展示頁用） */
  scenario: string;
}

/** 5 位假病人 */
export const MOCK_PATIENTS: MockHisRecord[] = [
  // 1. 標準路徑：AMI 後 6 個月，LDL 偏高未達標，順從性好
  {
    chrNoNew: 'AMI-001',
    patName: '陳大明',
    age: 62, gender: 'M',
    amiOnsetDate: '2025-10-15',
    recurrentEvent: false,
    hasDiabetes: false, hasFh: false, hasCkd: false, hasPad: false,
    hasHtn: true, hasHfref: false,
    adr: EMPTY_ADR,
    labs: [
      { reportDate: '2026-04-10', ldlC: 92 },
      { reportDate: '2026-01-12', ldlC: 105 },
      { reportDate: '2025-10-20', ldlC: 168 },
    ],
    medications: [
      { visitDate: '2026-01-15', medCode: 'ATOR40', medDays: 90 },
      { visitDate: '2025-10-20', medCode: 'ATOR40', medDays: 90 },
    ],
    adherence: { hDays: 175, gDays: 198 },
    scenario: '中度高風險：標準 high-intensity statin 治療中，LDL 92 未達 <55 目標，需要強化',
  },

  // 2. 極極高風險：DM + 反覆 AMI，LDL 嚴重未達標
  {
    chrNoNew: 'AMI-002',
    patName: '林秀英',
    age: 71, gender: 'F',
    amiOnsetDate: '2025-12-03',
    recurrentEvent: true,
    hasDiabetes: true, hasFh: false, hasCkd: true, hasPad: true,
    hasHtn: true, hasHfref: false,
    adr: EMPTY_ADR,
    labs: [
      { reportDate: '2026-04-15', ldlC: 78, hba1c: 8.2, egfr: 48 },
      { reportDate: '2026-01-20', ldlC: 95, hba1c: 8.5, egfr: 52 },
    ],
    medications: [
      { visitDate: '2026-01-22', medCode: 'ATOR80', medDays: 90 },
      { visitDate: '2025-12-05', medCode: 'ATOR40', medDays: 45 },
    ],
    adherence: { hDays: 128, gDays: 148 },
    scenario: '極極高風險：1 年內反覆 AMI + DM + CKD，目標 <40，LDL 78，需要 PCSK9i 加強',
  },

  // 3. Statin 不耐受：須 fallback 到 ezetimibe 或 bempedoic
  {
    chrNoNew: 'AMI-003',
    patName: '王志強',
    age: 58, gender: 'M',
    amiOnsetDate: '2026-02-08',
    recurrentEvent: false,
    hasDiabetes: false, hasFh: false, hasCkd: false, hasPad: false,
    hasHtn: false, hasHfref: false,
    adr: { ...EMPTY_ADR, statinIntolerance: true, allergicMedCodes: ['ATOR80', 'ATOR40'] },
    labs: [
      { reportDate: '2026-04-22', ldlC: 142 },
      { reportDate: '2026-02-12', ldlC: 188 },
    ],
    medications: [
      { visitDate: '2026-03-01', medCode: 'EZET10', medDays: 60 },
    ],
    adherence: { hDays: 50, gDays: 81 },
    scenario: 'Statin 不耐受：myalgia 紀錄，須避開高強度 statin，目前單用 ezetimibe 不足',
  },

  // 4. 順從性差 — 主要問題不是配方，是用藥
  {
    chrNoNew: 'AMI-004',
    patName: '黃美玲',
    age: 68, gender: 'F',
    amiOnsetDate: '2025-08-25',
    recurrentEvent: false,
    hasDiabetes: true, hasFh: false, hasCkd: false, hasPad: false,
    hasHtn: true, hasHfref: false,
    adr: EMPTY_ADR,
    labs: [
      { reportDate: '2026-04-05', ldlC: 155, hba1c: 7.8 },
      { reportDate: '2025-09-15', ldlC: 162, hba1c: 8.0 },
    ],
    medications: [
      { visitDate: '2025-09-15', medCode: 'ROSU20', medDays: 30 },
    ],
    adherence: { hDays: 32, gDays: 248 },
    scenario: '順從性差（13%）：吃了 30 天就不吃，重點不是換藥而是衛教 + 個管追蹤',
  },

  // 5. 已達標：建議維持
  {
    chrNoNew: 'AMI-005',
    patName: '蔡建國',
    age: 55, gender: 'M',
    amiOnsetDate: '2025-06-10',
    recurrentEvent: false,
    hasDiabetes: false, hasFh: false, hasCkd: false, hasPad: false,
    hasHtn: false, hasHfref: false,
    adr: EMPTY_ADR,
    labs: [
      { reportDate: '2026-04-18', ldlC: 48 },
      { reportDate: '2026-01-15', ldlC: 52 },
      { reportDate: '2025-10-20', ldlC: 65 },
    ],
    medications: [
      { visitDate: '2026-01-15', medCode: 'ROSU20', medDays: 90 },
      { visitDate: '2025-10-15', medCode: 'ROSU20', medDays: 90 },
    ],
    adherence: { hDays: 285, gDays: 312 },
    scenario: '已達標：LDL 48 < 55 目標，維持原方即可',
  },
];

export function getMockPatient(chrNoNew: string): MockHisRecord | undefined {
  return MOCK_PATIENTS.find((p) => p.chrNoNew === chrNoNew);
}
