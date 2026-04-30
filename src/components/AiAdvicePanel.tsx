import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { submitDoctorFeedback } from '../api/patient';
import type { AdvicePriority, CdssAdvice, DoctorFeedback, SoapSummary } from '../types';
import CdssAdviceCard from './CdssAdviceCard';

// CDSS items use these higher-level types from the Hermes pipeline; the legacy
// AdviceType (MEDICATION/LIFESTYLE/...) goes in `type` too, so we treat anything
// not WARNING/ALERT as a recommendation.
function isWarning(advice: CdssAdvice): boolean {
  const raw = (advice as { type?: string }).type;
  if (typeof raw !== 'string') return false;
  const t = raw.toUpperCase();
  return t === 'WARNING' || t === 'ALERT';
}

function getPriority(advice: CdssAdvice): AdvicePriority | 'NONE' {
  const p = advice.priority;
  if (p === 'HIGH' || p === 'MEDIUM' || p === 'LOW') return p;
  return 'NONE';
}

interface AiAdvicePanelProps {
  patientId: string;
  summary: SoapSummary | undefined;
  cdssAdvice: CdssAdvice[] | undefined;
}

const REASON_OPTIONS: { value: NonNullable<DoctorFeedback['reasonCategory']>; label: string }[] = [
  { value: 'dose_too_high', label: '劑量偏高' },
  { value: 'dose_too_low', label: '劑量不足' },
  { value: 'wrong_drug', label: '藥物選擇錯誤' },
  { value: 'contraindication', label: '違反禁忌症' },
  { value: 'other', label: '其他' },
];

export default function AiAdvicePanel({ patientId, summary, cdssAdvice }: AiAdvicePanelProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [correctedAssessment, setCorrectedAssessment] = useState('');
  const [correctedPlan, setCorrectedPlan] = useState('');
  const [reasonCategory, setReasonCategory] =
    useState<DoctorFeedback['reasonCategory']>('other');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const showCorrectionFields = rating > 0 && rating <= 2;

  const feedbackMutation = useMutation({
    mutationFn: submitDoctorFeedback,
    onSuccess: () => setFeedbackSent(true),
  });

  // Partition CDSS items: WARNING/ALERT 置頂、其餘按 priority 分桶
  const { warnings, high, medium, low, none } = useMemo(() => {
    const buckets: {
      warnings: CdssAdvice[];
      high: CdssAdvice[];
      medium: CdssAdvice[];
      low: CdssAdvice[];
      none: CdssAdvice[];
    } = { warnings: [], high: [], medium: [], low: [], none: [] };
    if (!cdssAdvice) return buckets;
    for (const item of cdssAdvice) {
      if (isWarning(item)) {
        buckets.warnings.push(item);
        continue;
      }
      const p = getPriority(item);
      if (p === 'HIGH') buckets.high.push(item);
      else if (p === 'MEDIUM') buckets.medium.push(item);
      else if (p === 'LOW') buckets.low.push(item);
      else buckets.none.push(item);
    }
    return buckets;
  }, [cdssAdvice]);

  const totalCount = (cdssAdvice ?? []).length;
  const recommendationCount = high.length + medium.length + low.length + none.length;
  const allUnprioritized =
    totalCount > 0 && warnings.length === 0 && high.length === 0 && medium.length === 0 && low.length === 0;

  const handleSubmit = () => {
    if (rating === 0) return;
    const correctedSoap =
      showCorrectionFields && (correctedAssessment || correctedPlan)
        ? {
            S: summary?.subjective ?? '',
            O: summary?.objective ?? '',
            A: correctedAssessment || summary?.assessment || '',
            P: correctedPlan || summary?.plan || '',
          }
        : undefined;

    feedbackMutation.mutate({
      patientId,
      rating,
      comment,
      ...(showCorrectionFields && {
        correctedAssessment: correctedAssessment || undefined,
        correctedPlan: correctedPlan || undefined,
        correctedSoap,
        reasonCategory,
      }),
    });
  };

  return (
    <div className="space-y-6">
      {/* CDSS Advice */}
      <div data-testid="cdss-advice-section">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">CDSS 調藥建議</h3>
          {totalCount > 0 && (
            <span className="text-xs text-gray-500">
              共 {totalCount} 項
              {warnings.length > 0 && `（含 ${warnings.length} 項警示）`}
            </span>
          )}
        </div>

        {allUnprioritized && (
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            ※ 本批建議來源 SKILL 規則尚未標註優先序，僅顯示類型徽章。
          </div>
        )}

        {/* B. WARNING 獨立置頂 — 紅色 alert 區塊，視覺上跟臨床建議分開 */}
        {warnings.length > 0 && (
          <section
            data-testid="cdss-warnings"
            className="mb-5 rounded-xl border-2 border-red-300 bg-red-50/60 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl" aria-hidden>⚠️</span>
              <h4 className="text-sm font-bold text-red-800">
                警示 / 禁忌（{warnings.length}）
              </h4>
            </div>
            <div className="space-y-3">
              {warnings.map((advice) => (
                <CdssAdviceCard key={advice.id} advice={advice} />
              ))}
            </div>
          </section>
        )}

        {/* A. 臨床建議按優先級分區：HIGH 紅框強調 / MEDIUM 中性 / LOW 折疊 */}
        {recommendationCount > 0 && (
          <div className="space-y-5" data-testid="cdss-recommendations">
            {high.length > 0 && (
              <section
                data-testid="cdss-priority-high"
                className="rounded-xl border-2 border-red-200 bg-white p-4"
              >
                <h4 className="text-base font-semibold text-red-700 mb-3 flex items-center gap-2">
                  <span aria-hidden>🔴</span>
                  高優先建議（{high.length}）
                </h4>
                <div className="space-y-3">
                  {high.map((advice) => (
                    <CdssAdviceCard key={advice.id} advice={advice} />
                  ))}
                </div>
              </section>
            )}

            {medium.length > 0 && (
              <section data-testid="cdss-priority-medium">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span aria-hidden>🟡</span>
                  中優先建議（{medium.length}）
                </h4>
                <div className="space-y-3">
                  {medium.map((advice) => (
                    <CdssAdviceCard key={advice.id} advice={advice} />
                  ))}
                </div>
              </section>
            )}

            {low.length > 0 && (
              <details
                data-testid="cdss-priority-low"
                className="rounded-lg border border-gray-200 bg-gray-50/40"
              >
                <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2">
                  <span aria-hidden>🟢</span>
                  低優先建議（{low.length}）
                  <span className="text-xs text-gray-400 ml-auto">點擊展開</span>
                </summary>
                <div className="space-y-3 px-3 pb-3 pt-1">
                  {low.map((advice) => (
                    <CdssAdviceCard key={advice.id} advice={advice} />
                  ))}
                </div>
              </details>
            )}

            {none.length > 0 && (
              <section data-testid="cdss-priority-none">
                {(high.length > 0 || medium.length > 0 || low.length > 0) && (
                  <h4 className="text-sm font-medium text-gray-500 mb-2">
                    其他建議（{none.length}）
                  </h4>
                )}
                <div className="space-y-3">
                  {none.map((advice) => (
                    <CdssAdviceCard key={advice.id} advice={advice} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {totalCount === 0 && (
          <p className="text-sm text-gray-400 py-4">目前無 CDSS 建議</p>
        )}
      </div>

      {/* Doctor Feedback */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">醫師回饋 (Hermes 訓練資料)</h3>

        {feedbackSent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-sm text-green-700">回饋已送出，感謝您的評價！</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Star Rating */}
            <div>
              <p className="text-sm text-gray-600 mb-2">對 SOAP 摘要的評分</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-2xl transition-colors ${
                      star <= rating ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {showCorrectionFields && (
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <span>⚠️</span>
                  評分較低，請填寫訂正內容（作為 AI 訓練資料）
                </p>
              )}
            </div>

            {/* Inline Correction — shown when rating ≤ 2 */}
            {showCorrectionFields && (
              <div className="space-y-3 border border-orange-200 bg-orange-50 rounded-lg p-4">
                <p className="text-sm font-medium text-orange-800">訂正 SOAP 評估與計畫</p>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    訂正分類（用於 Hermes 聚合 pattern）
                  </label>
                  <select
                    value={reasonCategory ?? 'other'}
                    onChange={(e) =>
                      setReasonCategory(
                        e.target.value as DoctorFeedback['reasonCategory'],
                      )
                    }
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                    data-testid="feedback-reason-category"
                  >
                    {REASON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    A - 評估（訂正版）
                    {summary?.assessment && (
                      <span className="ml-1 text-gray-400">
                        原文：{summary.assessment.slice(0, 40)}…
                      </span>
                    )}
                  </label>
                  <textarea
                    value={correctedAssessment}
                    onChange={(e) => setCorrectedAssessment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white"
                    placeholder="輸入正確的評估內容..."
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    P - 計畫（訂正版）
                    {summary?.plan && (
                      <span className="ml-1 text-gray-400">
                        原文：{summary.plan.slice(0, 40)}…
                      </span>
                    )}
                  </label>
                  <textarea
                    value={correctedPlan}
                    onChange={(e) => setCorrectedPlan(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white"
                    placeholder="輸入正確的計畫內容..."
                  />
                </div>
              </div>
            )}

            {/* Comment */}
            <div>
              <p className="text-sm text-gray-600 mb-2">文字回饋（選填）</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="對 CDSS 建議的補充意見..."
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={rating === 0 || feedbackMutation.isPending}
              className="px-6 py-2 bg-primary-800 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {feedbackMutation.isPending ? '送出中...' : '送出回饋'}
            </button>

            {feedbackMutation.isError && (
              <p className="text-sm text-red-500">送出失敗，請重試</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
