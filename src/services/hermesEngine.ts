// hermes engine — 把 rulebase 套到病人資料上，產出具體用藥建議
// 遵循 ami-hermes SOUL：不出方案只出選項、每條建議要有依據、不確定就說不確定

import { DRUGS, type Drug } from '../rulebase/drugs';
import { activeFormulas, formulasExcludingClass, type Formula } from '../rulebase/formulas';
import {
  computeLdlTarget,
  estimateBaselineLdl,
  rateAdherence,
  requiredReductionPct,
  type LdlTargetRule,
  type RiskInput,
} from '../rulebase/ldlTargets';
import { comorbidityNotes, deriveContraindications, type AdrFlags } from '../rulebase/contraindications';
import type { MockHisRecord } from '../rulebase/mockHis';
import type { CdssAdvice, AdviceType } from '../types';

export interface HermesInput {
  patient: MockHisRecord;
}

export interface FormulaCandidate {
  formula: Formula;
  drugs: Drug[];
  predictedLdl: number;
  meetsTarget: boolean;
  isMinimumEffective: boolean;
  selfPay: boolean;
  source: string;
}

export interface HermesAnalysis {
  /** SOAP 結構摘要（給 SoapCard 用） */
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  /** CDSS 建議（給 CdssAdviceCard 用，type=MEDICATION/MONITORING/REFERRAL/LIFESTYLE） */
  cdssAdvice: CdssAdvice[];
  /** 詳細推理：給 demo 頁顯示「為什麼會推這個」 */
  reasoning: {
    riskTier: LdlTargetRule;
    currentLdl: number | null;
    baselineLdl: number;
    requiredReductionPct: number;
    excludedDrugClasses: string[];
    candidates: FormulaCandidate[];
    adherenceRating: ReturnType<typeof rateAdherence>;
    comorbidityNotes: string[];
  };
  /** 標準免責聲明 */
  disclaimer: string;
}

const DISCLAIMER =
  '本建議由 AI 系統依據臨床指引與病人資料產生，僅供臨床決策參考。最終診斷與治療方案應由主治醫師依患者整體狀況決定。建議使用前請核實 LAB 數值與用藥史。';

function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function buildRiskInput(patient: MockHisRecord, today: Date): RiskInput {
  return {
    hasAmi: true,
    amiOnsetMonthsAgo: monthsBetween(patient.amiOnsetDate, today.toISOString()),
    recurrentEvent: patient.recurrentEvent,
    hasDiabetes: patient.hasDiabetes,
    hasFh: patient.hasFh,
    hasCkd: patient.hasCkd,
    hasPad: patient.hasPad,
  };
}

function currentReductionFromMeds(adr: AdrFlags, meds: MockHisRecord['medications']): number {
  if (meds.length === 0) return 0;
  // 取近 90 天內最長使用配方的理論降幅
  const drug = DRUGS.find((d) => d.medCode === meds[0].medCode);
  if (!drug) return 0;
  // 若 ADR 顯示對該藥不耐，視為 0（病人未真正服用）
  if (adr.allergicMedCodes.includes(drug.medCode)) return 0;
  return drug.ldlReductionPct / 100;
}

/**
 * 預估換成新配方的 LDL：
 *   - 若沒在吃藥（currentPct=0）：predict = current × (1 − newPct)
 *   - 若有在吃藥：以 baseline 為基準 — predict = baseline × (1 − newPct)
 *     但若 baseline 推估失真（>500 視為不合理），fallback 到「差額替換」方法
 */
function predictLdl(
  currentLdl: number,
  baselineLdl: number,
  currentReductionPct: number,
  newReductionPct: number
): number {
  // 沒在吃藥：直接用 current
  if (currentReductionPct <= 0) {
    return Math.round(currentLdl * (1 - newReductionPct));
  }
  // 有在吃藥但 baseline 推估在合理範圍：用 baseline
  if (baselineLdl > 0 && baselineLdl <= 500) {
    return Math.round(baselineLdl * (1 - newReductionPct));
  }
  // baseline 失真：差額替換 — 假設 current 對應 currentPct，換成 newPct
  // current = baseline × (1 - currentPct)  →  predict = current × (1 - newPct) / (1 - currentPct)
  return Math.round((currentLdl * (1 - newReductionPct)) / (1 - currentReductionPct));
}

function pickCandidates(
  pool: Formula[],
  currentLdl: number,
  baselineLdl: number,
  currentReductionPct: number,
  target: number,
  excludedMedCodes: string[]
): FormulaCandidate[] {
  const byPotency = [...pool].sort((a, b) => a.ldlC - b.ldlC);
  const candidates: FormulaCandidate[] = [];

  byPotency.forEach((f) => {
    const drugs = f.drugs
      .map((fd) => DRUGS.find((d) => d.medCode === fd.medCode))
      .filter((d): d is Drug => Boolean(d));
    const hasExcluded = drugs.some((d) => excludedMedCodes.includes(d.medCode));
    if (hasExcluded) return;
    const predictedLdl = predictLdl(currentLdl, baselineLdl, currentReductionPct, f.ldlC / 100);
    const meetsTarget = predictedLdl <= target;
    candidates.push({
      formula: f,
      drugs,
      predictedLdl,
      meetsTarget,
      isMinimumEffective: false,
      selfPay: f.selfPay,
      source: `SKILL/AMI#formula-${f.formulaId}`,
    });
  });

  // 「最低劑量達標」原則 — 排序後第一個達標者
  const firstMeetsIdx = candidates.findIndex((c) => c.meetsTarget);
  if (firstMeetsIdx >= 0) {
    candidates[firstMeetsIdx].isMinimumEffective = true;
  }
  return candidates;
}

function buildPlanText(
  riskTier: LdlTargetRule,
  candidates: FormulaCandidate[],
  baselineLdl: number,
  currentLdl: number | null,
  adherenceRating: ReturnType<typeof rateAdherence>
): string {
  const lines: string[] = [];
  lines.push(`1. LDL-C 目標 < ${riskTier.target} mg/dL（${riskTier.description}，依據：${riskTier.source}）`);
  if (currentLdl !== null) {
    lines.push(`2. 目前 LDL-C ${currentLdl} mg/dL，推估未服藥前基準 ${baselineLdl} mg/dL`);
  }
  if (adherenceRating.rating === 'POOR' || adherenceRating.rating === 'NONE') {
    lines.push(
      `3. 用藥順從性 ${adherenceRating.rating === 'NONE' ? '無' : '差'}（${
        adherenceRating.ratio !== null ? Math.round(adherenceRating.ratio * 100) : '—'
      }%），優先排除順從性問題後再考慮加藥`
    );
  }
  const top3 = candidates.slice(0, 3);
  if (top3.length > 0) {
    lines.push('4. 可考慮配方選項（醫師擇一）：');
    top3.forEach((c, i) => {
      const flag = c.isMinimumEffective ? '【最低劑量達標】' : c.meetsTarget ? '【可達標】' : '【未達標】';
      const pay = c.selfPay ? '（自費）' : '';
      lines.push(
        `   ${i + 1}) ${c.formula.formulaName}${pay}${flag}：理論降幅 ${c.formula.ldlC}%，預估 LDL ${c.predictedLdl} mg/dL`
      );
    });
  }
  return lines.join('\n');
}

export function runHermesEngine(input: HermesInput, today: Date = new Date()): HermesAnalysis {
  const { patient } = input;
  const latestLab = patient.labs[0] ?? null;
  const currentLdl = latestLab?.ldlC ?? null;

  // 1. 風險分層 → LDL 目標
  const riskInput = buildRiskInput(patient, today);
  const riskTier = computeLdlTarget(riskInput);

  // 2. 推估 baseline LDL（Y_VALUE）
  const currentReduction = currentReductionFromMeds(patient.adr, patient.medications);
  const baselineLdl = currentLdl !== null ? estimateBaselineLdl(currentLdl, currentReduction) : 0;
  const reqPct = baselineLdl > 0 ? requiredReductionPct(baselineLdl, riskTier.target) : 0;

  // 3. 禁忌 → 縮小配方池
  const contra = deriveContraindications(patient.adr);
  const pool = contra.excludedDrugClasses.length > 0
    ? formulasExcludingClass(contra.excludedDrugClasses)
    : activeFormulas();

  // 4. 算候選配方（按降幅由小到大，挑「最低劑量達標」）
  const candidates = currentLdl === null
    ? []
    : pickCandidates(pool, currentLdl, baselineLdl, currentReduction, riskTier.target, contra.excludedMedCodes);

  // 5. 順從性
  const adherenceRating = rateAdherence(patient.adherence.hDays, patient.adherence.gDays);

  // 6. 共病提示
  const comorbidity = comorbidityNotes({
    hasDiabetes: patient.hasDiabetes,
    hasCkd: patient.hasCkd,
    hasHtn: patient.hasHtn,
    hasHfref: patient.hasHfref,
  });

  // 7. SOAP
  const soap = {
    subjective: `病人 ${patient.patName}，${patient.age} 歲 ${patient.gender === 'M' ? '男' : '女'}，AMI 確診於 ${patient.amiOnsetDate}${patient.recurrentEvent ? '，且近期有反覆事件' : ''}。${patient.scenario}`,
    objective: currentLdl !== null
      ? `最新 LDL-C ${currentLdl} mg/dL（${latestLab!.reportDate}）；推估基準 LDL ${baselineLdl} mg/dL；用藥順從性 ${
          adherenceRating.ratio !== null ? Math.round(adherenceRating.ratio * 100) : '—'
        }%（${adherenceRating.rating}）。`
      : '無近期 LDL-C 抽血報告，建議補驗。',
    assessment: [
      `風險分層：${riskTier.tier}（目標 LDL <${riskTier.target}）`,
      currentLdl !== null && currentLdl > riskTier.target
        ? `LDL 未達標，需進一步降幅 ${Math.round(reqPct * 100)}%`
        : currentLdl !== null
          ? 'LDL 已達標'
          : '資料不足以評估',
      contra.excludedDrugClasses.length > 0 ? `已排除 drugClass：${contra.excludedDrugClasses.join(', ')}` : null,
    ].filter(Boolean).join('；'),
    plan: buildPlanText(riskTier, candidates, baselineLdl, currentLdl, adherenceRating),
  };

  // 8. CDSS 建議卡（前端 CdssAdviceCard 用）
  const cdssAdvice: CdssAdvice[] = [];
  let id = 1;
  const now = today.toISOString();

  // 主用藥建議
  if (candidates.length > 0) {
    const minEff = candidates.find((c) => c.isMinimumEffective) ?? candidates[0];
    const altText = candidates.slice(0, 3).filter((c) => c !== minEff).map((c) =>
      `${c.formula.formulaName}（降幅 ${c.formula.ldlC}%${c.selfPay ? '，自費' : ''}）`
    ).join('；');
    cdssAdvice.push({
      id: id++,
      type: 'MEDICATION' as AdviceType,
      content:
        `依 ${riskTier.source} 目標 LDL <${riskTier.target}，` +
        `建議可考慮 ${minEff.formula.formulaName}（理論降幅 ${minEff.formula.ldlC}%，預估降至 ${minEff.predictedLdl} mg/dL）。` +
        (altText ? `備選方案：${altText}。` : '') +
        `（最終由主治醫師決定）`,
      confidence: minEff.meetsTarget ? 85 : 60,
      evidenceLevel: minEff.source,
      disclaimer: DISCLAIMER,
      createdAt: now,
    });
  } else if (currentLdl === null) {
    cdssAdvice.push({
      id: id++,
      type: 'MONITORING' as AdviceType,
      content: '近 12 個月無 LDL-C 抽血報告，建議補驗 LDL-C / HDL-C / TG / Total Cholesterol，再決定是否強化用藥。',
      confidence: 95,
      evidenceLevel: '台灣血脂 2025 §2.1',
      disclaimer: DISCLAIMER,
      createdAt: now,
    });
  }

  // 順從性提醒
  if (adherenceRating.rating === 'POOR' || adherenceRating.rating === 'NONE') {
    cdssAdvice.push({
      id: id++,
      type: 'LIFESTYLE' as AdviceType,
      content: `用藥順從性 ${adherenceRating.rating === 'NONE' ? '無（<15%）' : '差（15-50%）'}。建議：1) 個管師電訪 2) 衛教用藥重要性 3) 排除費用/副作用障礙；先解決順從性，再評估是否需要加藥。`,
      confidence: 90,
      evidenceLevel: 'AHA 2018 §10.6',
      disclaimer: DISCLAIMER,
      createdAt: now,
    });
  }

  // 共病提示
  comorbidity.forEach((note) => {
    cdssAdvice.push({
      id: id++,
      type: 'MONITORING' as AdviceType,
      content: note,
      confidence: 80,
      evidenceLevel: note.match(/（([^）]+)）$/)?.[1] ?? 'guideline',
      disclaimer: DISCLAIMER,
      createdAt: now,
    });
  });

  // 極極高風險自費 PCSK9i 提示
  if (riskTier.tier === 'EXTREME_HIGH' && candidates.some((c) => c.formula.flag1 === 'D')) {
    cdssAdvice.push({
      id: id++,
      type: 'REFERRAL' as AdviceType,
      content: '極極高風險病人，若 high-intensity statin + ezetimibe 仍未達 LDL <40，可轉介心臟科評估 PCSK9i（Evolocumab/Alirocumab）。',
      confidence: 75,
      evidenceLevel: 'ESC 2019 §6.5',
      disclaimer: DISCLAIMER,
      createdAt: now,
    });
  }

  return {
    soap,
    cdssAdvice,
    reasoning: {
      riskTier,
      currentLdl,
      baselineLdl,
      requiredReductionPct: reqPct,
      excludedDrugClasses: contra.excludedDrugClasses,
      candidates,
      adherenceRating,
      comorbidityNotes: comorbidity,
    },
    disclaimer: DISCLAIMER,
  };
}
