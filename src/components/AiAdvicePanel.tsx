import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { submitDoctorFeedback } from '../api/patient';
import type { CdssAdvice, DoctorFeedback, SoapSummary } from '../types';
import CdssAdviceCard from './CdssAdviceCard';

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
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">CDSS 調藥建議</h3>
        {cdssAdvice && cdssAdvice.length > 0 && cdssAdvice.every((a) => !a.priority) && (
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            ※ 本批建議來源 SKILL 規則尚未標註優先序，僅顯示類型徽章。
          </div>
        )}
        <div className="space-y-4">
          {cdssAdvice?.map((advice) => (
            <CdssAdviceCard key={advice.id} advice={advice} />
          ))}
          {(!cdssAdvice || cdssAdvice.length === 0) && (
            <p className="text-sm text-gray-400 py-4">目前無 CDSS 建議</p>
          )}
        </div>
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
