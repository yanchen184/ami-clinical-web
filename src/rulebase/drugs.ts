// 藥品基本檔（移植自 wetmu-legacy DSC_DRUGDIM / FormulaDrugs）
// 北醫 AMI rulebase：以 ATC code 為主鍵，配 LDL-C 降幅推估

export type DrugClass = 'STATIN_HIGH' | 'STATIN_MOD' | 'STATIN_LOW' | 'EZETIMIBE' | 'PCSK9I' | 'BEMPEDOIC' | 'OTHER';

export interface Drug {
  medCode: string;        // 院內代碼（對應 DSC_DRUGDIM.MED_CODE）
  insMedCode: string;     // 健保代碼
  atcCode: string;
  aliseDesc: string;      // 商品/別名
  medDesc: string;        // 學名
  drugClass: DrugClass;
  /** 該藥單獨使用 LDL-C 降幅（%）— 來自 ACC/AHA 2018 cholesterol guideline */
  ldlReductionPct: number;
  /** 是否自費（健保不給付則 true） */
  selfPay: boolean;
  /** 標準 DDD 劑量分子 */
  dddValue1: number;
  /** 標準 DDD 劑量分母（每日次數） */
  dddValue2: number;
  /** 適應症關鍵字（搜尋用） */
  indications: string[];
}

/** 北醫 AMI 後續照護常用藥品（精選 14 項，覆蓋舊系統 FORMULAS 主要配方） */
export const DRUGS: Drug[] = [
  // ── High-intensity statin（單獨可降 LDL ≥50%） ──
  {
    medCode: 'ATOR40', insMedCode: 'BC25974100', atcCode: 'C10AA05',
    aliseDesc: 'Lipitor 40mg', medDesc: 'Atorvastatin 40mg',
    drugClass: 'STATIN_HIGH', ldlReductionPct: 49, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia', 'AMI', 'CAD'],
  },
  {
    medCode: 'ATOR80', insMedCode: 'BC25974200', atcCode: 'C10AA05',
    aliseDesc: 'Lipitor 80mg', medDesc: 'Atorvastatin 80mg',
    drugClass: 'STATIN_HIGH', ldlReductionPct: 55, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia', 'AMI', 'CAD', 'ACS'],
  },
  {
    medCode: 'ROSU20', insMedCode: 'BC26104100', atcCode: 'C10AA07',
    aliseDesc: 'Crestor 20mg', medDesc: 'Rosuvastatin 20mg',
    drugClass: 'STATIN_HIGH', ldlReductionPct: 52, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia', 'AMI', 'CAD'],
  },
  {
    medCode: 'ROSU40', insMedCode: 'BC26104200', atcCode: 'C10AA07',
    aliseDesc: 'Crestor 40mg', medDesc: 'Rosuvastatin 40mg',
    drugClass: 'STATIN_HIGH', ldlReductionPct: 58, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia', 'AMI', 'CAD', 'ACS'],
  },
  // ── Moderate-intensity statin（30-49%） ──
  {
    medCode: 'ATOR20', insMedCode: 'BC25973100', atcCode: 'C10AA05',
    aliseDesc: 'Lipitor 20mg', medDesc: 'Atorvastatin 20mg',
    drugClass: 'STATIN_MOD', ldlReductionPct: 43, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia'],
  },
  {
    medCode: 'ROSU10', insMedCode: 'BC26103100', atcCode: 'C10AA07',
    aliseDesc: 'Crestor 10mg', medDesc: 'Rosuvastatin 10mg',
    drugClass: 'STATIN_MOD', ldlReductionPct: 45, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia'],
  },
  {
    medCode: 'PITA2', insMedCode: 'BC26521100', atcCode: 'C10AA08',
    aliseDesc: 'Livalo 2mg', medDesc: 'Pitavastatin 2mg',
    drugClass: 'STATIN_MOD', ldlReductionPct: 39, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia'],
  },
  {
    medCode: 'PRAV40', insMedCode: 'BC22021100', atcCode: 'C10AA03',
    aliseDesc: 'Mevalotin 40mg', medDesc: 'Pravastatin 40mg',
    drugClass: 'STATIN_MOD', ldlReductionPct: 34, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia'],
  },
  // ── Low-intensity statin（<30%） ──
  {
    medCode: 'SIMV20', insMedCode: 'BC18753100', atcCode: 'C10AA01',
    aliseDesc: 'Zocor 20mg', medDesc: 'Simvastatin 20mg',
    drugClass: 'STATIN_LOW', ldlReductionPct: 28, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia'],
  },
  // ── Ezetimibe（NPC1L1 抑制劑，單獨 ~18%，加上 statin +18-25%） ──
  {
    medCode: 'EZET10', insMedCode: 'BC24921100', atcCode: 'C10AX09',
    aliseDesc: 'Ezetrol 10mg', medDesc: 'Ezetimibe 10mg',
    drugClass: 'EZETIMIBE', ldlReductionPct: 18, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia', 'statin-intolerance'],
  },
  // ── Combination: Atorvastatin + Ezetimibe (ATOZET) ──
  {
    medCode: 'ATOZ40', insMedCode: 'BC27432100', atcCode: 'C10BA05',
    aliseDesc: 'Atozet 40/10mg', medDesc: 'Atorvastatin 40 + Ezetimibe 10',
    drugClass: 'EZETIMIBE', ldlReductionPct: 65, selfPay: false,
    dddValue1: 1, dddValue2: 1, indications: ['hyperlipidemia', 'AMI'],
  },
  // ── PCSK9 inhibitor（自費，~60% 降幅，極高風險才考慮） ──
  {
    medCode: 'EVOL140', insMedCode: 'KC01234100', atcCode: 'C10AX13',
    aliseDesc: 'Repatha 140mg', medDesc: 'Evolocumab 140mg SC q2w',
    drugClass: 'PCSK9I', ldlReductionPct: 60, selfPay: true,
    dddValue1: 1, dddValue2: 14, indications: ['AMI', 'FH', 'statin-intolerance'],
  },
  {
    medCode: 'ALIR75', insMedCode: 'KC02345100', atcCode: 'C10AX14',
    aliseDesc: 'Praluent 75mg', medDesc: 'Alirocumab 75mg SC q2w',
    drugClass: 'PCSK9I', ldlReductionPct: 50, selfPay: true,
    dddValue1: 1, dddValue2: 14, indications: ['AMI', 'FH'],
  },
  // ── Bempedoic acid（自費，2024 後被討論加入北醫 formulary） ──
  {
    medCode: 'BEMP180', insMedCode: 'KC03456100', atcCode: 'C10AX15',
    aliseDesc: 'Nilemdo 180mg', medDesc: 'Bempedoic acid 180mg',
    drugClass: 'BEMPEDOIC', ldlReductionPct: 17, selfPay: true,
    dddValue1: 1, dddValue2: 1, indications: ['statin-intolerance'],
  },
];

export function getDrug(medCode: string): Drug | undefined {
  return DRUGS.find((d) => d.medCode === medCode);
}
