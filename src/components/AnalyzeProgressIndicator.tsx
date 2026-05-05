import { useEffect, useRef, useState } from 'react';

const STEP_TITLES = [
  '病人狀態接收',
  'SOUL + SKILL 載入',
  'Rulebase baseline 推算',
  'RAG 決策',
  '向量檢索文獻',
  'Few-shot 範例',
  'Prompt 組裝 + Gemini 推論',
  '安全紅線檢查',
  '寫入 ai_summary + audit',
];

const TOTAL_STEPS = STEP_TITLES.length;
const SLA_SECONDS = 30;
const STEP_INTERVAL_MS = 2_500;

interface AnalyzeProgressIndicatorProps {
  active: boolean;
  ariaLabel?: string;
}

export default function AnalyzeProgressIndicator({
  active,
  ariaLabel = 'AI 分析進度',
}: AnalyzeProgressIndicatorProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      startedAt.current = null;
      setStepIndex(0);
      setElapsedMs(0);
      return;
    }

    startedAt.current = performance.now();

    const tick = setInterval(() => {
      if (startedAt.current == null) return;
      setElapsedMs(performance.now() - startedAt.current);
    }, 200);

    const advance = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
    }, STEP_INTERVAL_MS);

    return () => {
      clearInterval(tick);
      clearInterval(advance);
    };
  }, [active]);

  if (!active) return null;

  const elapsedSeconds = elapsedMs / 1_000;
  const progressPct = Math.min(100, ((stepIndex + 1) / TOTAL_STEPS) * 100);
  const overSla = elapsedSeconds > SLA_SECONDS;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      data-testid="analyze-progress"
      className="rounded-lg border border-primary-200 bg-primary-50/70 px-4 py-3"
    >
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="font-medium text-primary-900">
          正在分析（步驟 {stepIndex + 1} / {TOTAL_STEPS}）
        </span>
        <span
          className={`tabular-nums ${overSla ? 'text-red-600 font-medium' : 'text-gray-500'}`}
        >
          已等待 {elapsedSeconds.toFixed(1)}s
          {overSla && ' · 超出 SLA'}
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-primary-100"
        role="progressbar"
        aria-valuenow={Math.round(progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-primary-600 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-primary-700/80">
        {STEP_TITLES[stepIndex]}
        <span className="ml-2 text-primary-700/50">
          （步驟為估計值，實際 9-step trace 完成後會顯示）
        </span>
      </p>
    </div>
  );
}
