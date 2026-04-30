// 配方 rulebase（移植自 wetmu-legacy FORMULAS / FORMULA_DRUGS / SUG_AMI_FORMULAS）
// 配方 = 一組藥品組合，按 LDL-C 降幅排序，供 hermes 推薦

import { DRUGS, type DrugClass } from './drugs';

export interface Formula {
  formulaId: number;
  formulaName: string;
  /** 配方分類（對應舊系統 FLAG1） */
  flag1: 'A' | 'B' | 'C' | 'D'; // A=high-intensity statin, B=mod-intensity, C=combo, D=PCSK9i
  /** LDL-C 降幅 % */
  ldlC: number;
  selfPay: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  dscKind: 'AMI'; // 適用疾病
  /** 推薦藥品（按 priority 排序，第一順位優先給藥） */
  drugs: Array<{ medCode: string; priority: number }>;
}

/** 北醫 AMI 後續照護核心 8 配方 — 從 SUG_AMI_FORMULAS 規則抽出 */
export const FORMULAS: Formula[] = [
  // A 類：高強度單方
  {
    formulaId: 1, formulaName: 'A1-Atorvastatin 80', flag1: 'A',
    ldlC: 55, selfPay: false, status: 'ACTIVE', dscKind: 'AMI',
    drugs: [{ medCode: 'ATOR80', priority: 1 }],
  },
  {
    formulaId: 2, formulaName: 'A2-Rosuvastatin 40', flag1: 'A',
    ldlC: 58, selfPay: false, status: 'ACTIVE', dscKind: 'AMI',
    drugs: [{ medCode: 'ROSU40', priority: 1 }],
  },
  {
    formulaId: 3, formulaName: 'A3-Atorvastatin 40', flag1: 'A',
    ldlC: 49, selfPay: false, status: 'ACTIVE', dscKind: 'AMI',
    drugs: [{ medCode: 'ATOR40', priority: 1 }],
  },
  {
    formulaId: 4, formulaName: 'A4-Rosuvastatin 20', flag1: 'A',
    ldlC: 52, selfPay: false, status: 'ACTIVE', dscKind: 'AMI',
    drugs: [{ medCode: 'ROSU20', priority: 1 }],
  },
  // B 類：中強度單方（給對 high-intensity 不耐者）
  {
    formulaId: 5, formulaName: 'B1-Pitavastatin 2', flag1: 'B',
    ldlC: 39, selfPay: false, status: 'ACTIVE', dscKind: 'AMI',
    drugs: [{ medCode: 'PITA2', priority: 1 }],
  },
  // C 類：複合配方（statin + ezetimibe）
  {
    formulaId: 6, formulaName: 'C1-Atozet 40/10', flag1: 'C',
    ldlC: 65, selfPay: false, status: 'ACTIVE', dscKind: 'AMI',
    drugs: [{ medCode: 'ATOZ40', priority: 1 }],
  },
  {
    formulaId: 7, formulaName: 'C2-Atorvastatin 40 + Ezetimibe', flag1: 'C',
    ldlC: 63, selfPay: false, status: 'ACTIVE', dscKind: 'AMI',
    drugs: [
      { medCode: 'ATOR40', priority: 1 },
      { medCode: 'EZET10', priority: 2 },
    ],
  },
  // D 類：PCSK9i 加強（自費，降幅最大）
  {
    formulaId: 8, formulaName: 'D1-Atorvastatin 80 + Evolocumab', flag1: 'D',
    ldlC: 78, selfPay: true, status: 'ACTIVE', dscKind: 'AMI',
    drugs: [
      { medCode: 'ATOR80', priority: 1 },
      { medCode: 'EVOL140', priority: 2 },
    ],
  },
];

export function activeFormulas(): Formula[] {
  return FORMULAS.filter((f) => f.status === 'ACTIVE');
}

export function getFormula(id: number): Formula | undefined {
  return FORMULAS.find((f) => f.formulaId === id);
}

/** 按降幅由小到大排序（舊系統採「最低劑量達標」原則） */
export function formulasSortedByPotency(): Formula[] {
  return [...activeFormulas()].sort((a, b) => a.ldlC - b.ldlC);
}

/** 篩出排除特定 drugClass 的配方（給 ADR/不耐受 fallback 用） */
export function formulasExcludingClass(excluded: DrugClass[]): Formula[] {
  return activeFormulas().filter((f) =>
    f.drugs.every((fd) => {
      const drug = DRUGS.find((d) => d.medCode === fd.medCode);
      return drug ? !excluded.includes(drug.drugClass) : true;
    })
  );
}
