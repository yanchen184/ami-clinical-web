// 禁忌與不耐受規則（移植自 DSC_DRUGADR + 北醫處方參考集 + ACC/AHA statin myopathy guidance）

import type { DrugClass } from './drugs';

export interface AdrFlags {
  nsaids: boolean;
  penicillin: boolean;
  cephalosporin: boolean;
  tetracycline: boolean;
  sulfonamide: boolean;
  anticonvulsan: boolean;
  /** statin myalgia / rhabdomyolysis 病史 */
  statinIntolerance: boolean;
  /** 已記錄過敏的特定藥品代碼 */
  allergicMedCodes: string[];
}

export const EMPTY_ADR: AdrFlags = {
  nsaids: false,
  penicillin: false,
  cephalosporin: false,
  tetracycline: false,
  sulfonamide: false,
  anticonvulsan: false,
  statinIntolerance: false,
  allergicMedCodes: [],
};

export interface ContraindicationResult {
  excludedDrugClasses: DrugClass[];
  excludedMedCodes: string[];
  notes: string[];
}

/**
 * 從 ADR flag 推出需要排除的藥物 class / 個別藥品
 * 規則來源（皆有 source 標註）：
 *  - statin intolerance → 排除 STATIN_HIGH，建議改 STATIN_MOD + EZETIMIBE 或 BEMPEDOIC
 *  - allergicMedCodes → 直接排除該 medCode
 */
export function deriveContraindications(adr: AdrFlags): ContraindicationResult {
  const excludedDrugClasses: DrugClass[] = [];
  const notes: string[] = [];

  if (adr.statinIntolerance) {
    excludedDrugClasses.push('STATIN_HIGH');
    notes.push('SOURCE: ACC/AHA 2018 §10.5 — 病人有 statin myopathy/不耐受紀錄，避開高強度 statin');
  }

  return {
    excludedDrugClasses,
    excludedMedCodes: [...adr.allergicMedCodes],
    notes,
  };
}

/** 共病提示文（給醫師看到） */
export interface ComorbidityHints {
  hasDiabetes: boolean;
  hasCkd: boolean;
  hasHtn: boolean;
  hasHfref: boolean;
}

export function comorbidityNotes(c: ComorbidityHints): string[] {
  const out: string[] = [];
  if (c.hasDiabetes) {
    out.push('共病：糖尿病 — 建議 HbA1c < 7%（個人化），可考慮 SGLT2i / GLP-1 RA（ADA 2026 §10）');
  }
  if (c.hasCkd) {
    out.push('共病：CKD — 避免 NSAIDs，statin 劑量需依 eGFR 調整（KDIGO 2024 §3.2）');
  }
  if (c.hasHtn) {
    out.push('共病：高血壓 — 目標 BP <130/80（AHA 2017），AMI 後優先 β-blocker + ACEi/ARB');
  }
  if (c.hasHfref) {
    out.push('共病：HFrEF — 加 GDMT 四大支柱（ARNI/β-blocker/MRA/SGLT2i）（ESC 2023 HF）');
  }
  return out;
}
