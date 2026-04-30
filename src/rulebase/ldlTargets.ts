// LDL-C 目標值規則（移植自台灣血脂 2025 / ESC 2019 dyslipidaemia / ACC-AHA 2018）
// 舊系統 CALC_AMI.T_VALUE 由 SP sp_calc_ami 計算；此處用純函數重現邏輯。

export type RiskTier = 'EXTREME_HIGH' | 'VERY_HIGH' | 'HIGH' | 'MOD';

export interface LdlTargetRule {
  tier: RiskTier;
  /** mg/dL */
  target: number;
  description: string;
  source: string;
}

export const LDL_TARGETS: Record<RiskTier, LdlTargetRule> = {
  EXTREME_HIGH: {
    tier: 'EXTREME_HIGH',
    target: 40,
    description: '極極高風險：AMI 後 1 年內 + 反覆事件 / FH / DM 共病',
    source: 'ESC 2019 §6.3 / 台灣血脂 2025 §3.2',
  },
  VERY_HIGH: {
    tier: 'VERY_HIGH',
    target: 55,
    description: '極高風險：AMI 後標準目標',
    source: 'ESC 2019 §6.3 / 台灣血脂 2025 §3.1',
  },
  HIGH: {
    tier: 'HIGH',
    target: 70,
    description: '高風險：DM 或多重危險因子',
    source: '台灣血脂 2025 §3.3',
  },
  MOD: {
    tier: 'MOD',
    target: 100,
    description: '中等風險：基本目標',
    source: 'ACC/AHA 2018',
  },
};

export interface RiskInput {
  hasAmi: boolean;
  amiOnsetMonthsAgo: number | null; // 距今 AMI 月數
  recurrentEvent: boolean;          // 1 年內反覆事件
  hasDiabetes: boolean;
  hasFh: boolean;                   // familial hypercholesterolemia
  hasCkd: boolean;                  // CKD stage ≥3
  hasPad: boolean;                  // peripheral artery disease
}

/** Decide LDL target by risk stratification — pure function */
export function computeLdlTarget(input: RiskInput): LdlTargetRule {
  // 極極高風險：AMI + 1 年內反覆事件 + (DM 或 FH)
  if (
    input.hasAmi &&
    input.amiOnsetMonthsAgo !== null &&
    input.amiOnsetMonthsAgo <= 12 &&
    input.recurrentEvent &&
    (input.hasDiabetes || input.hasFh)
  ) {
    return LDL_TARGETS.EXTREME_HIGH;
  }
  // 極高風險：所有 AMI 病人
  if (input.hasAmi) return LDL_TARGETS.VERY_HIGH;
  // 高風險：DM + 其他危險因子
  if (input.hasDiabetes && (input.hasCkd || input.hasPad)) {
    return LDL_TARGETS.HIGH;
  }
  return LDL_TARGETS.MOD;
}

/**
 * 推估未服藥前的 LDL-C（Y_VALUE）
 * 舊系統公式：Y = X / (1 - Z1)，Z1 = 在抽血 90 天內最長使用配方的理論降幅
 */
export function estimateBaselineLdl(currentLdl: number, currentReductionPct: number): number {
  if (currentReductionPct >= 1) return currentLdl;
  return Math.round(currentLdl / (1 - currentReductionPct));
}

/**
 * 計算需要的 LDL-C 降幅（Z2）
 * Z2 = 1 - target / Y_baseline；< 0 表示已達標
 */
export function requiredReductionPct(baselineLdl: number, target: number): number {
  return Math.max(0, 1 - target / baselineLdl);
}

/**
 * 用藥順從性評等（移植自 CALC_AMI_DRUG_ADHERENCE）
 * H = AMI 後使用 AMI 藥物總天數；G = AMI 後總天數
 */
export type AdherenceRating = 'GOOD' | 'POOR' | 'NONE' | 'UNKNOWN';

export function rateAdherence(hDays: number | null, gDays: number | null): { rating: AdherenceRating; ratio: number | null } {
  if (hDays === null || gDays === null || gDays === 0) {
    return { rating: 'UNKNOWN', ratio: null };
  }
  const ratio = hDays / gDays;
  if (ratio < 0.15) return { rating: 'NONE', ratio };
  if (ratio < 0.5) return { rating: 'POOR', ratio };
  return { rating: 'GOOD', ratio };
}
