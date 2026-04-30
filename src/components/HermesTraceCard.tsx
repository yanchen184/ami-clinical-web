import { useState } from 'react';
import type { HermesStep, HermesTrace } from '../api/aiService';

interface HermesTraceCardProps {
  trace: HermesTrace | null | undefined;
}

const STEP_ICONS: Record<string, string> = {
  ingest: '📥',
  skill_load: '🧠',
  rule_compute: '📐',
  rag_decide: '🎯',
  rag_search: '🔍',
  few_shot: '📚',
  llm: '✨',
  rule_validate: '🛡️',
  persist: '💾',
};

interface RagHit {
  title?: string;
  snippet?: string;
  source?: string;
}

function isRagSearchStep(step: HermesStep): step is HermesStep & {
  detail: { hits: RagHit[] };
} {
  if (step.name !== 'rag_search') return false;
  const hits = (step.detail as { hits?: unknown } | undefined)?.hits;
  return Array.isArray(hits);
}

function RagHitsList({ hits }: { hits: RagHit[] }) {
  if (hits.length === 0) {
    return <p className="mt-2 text-xs text-slate-500">本次未啟用 RAG 或無命中文獻</p>;
  }
  return (
    <ul className="mt-2 space-y-2">
      {hits.map((h, i) => (
        <li
          key={`${h.source ?? i}-${i}`}
          className="rounded border border-slate-200 bg-slate-50 p-2"
        >
          <div className="flex items-baseline gap-2">
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
              文獻 {i + 1}
            </span>
            <a
              href={h.source || '#'}
              onClick={(e) => {
                if (!h.source || h.source === '#') e.preventDefault();
              }}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-primary-800 hover:underline"
            >
              {h.title || h.source || '未命名來源'}
            </a>
          </div>
          {h.snippet && (
            <p className="mt-1 text-xs text-slate-700 line-clamp-3">{h.snippet}</p>
          )}
          {h.source && (
            <p className="mt-1 truncate text-[10px] font-mono text-slate-400">
              {h.source}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function StepRow({ step, isLast }: { step: HermesStep; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const icon = STEP_ICONS[step.name] ?? '⚙️';
  const isRag = isRagSearchStep(step);
  return (
    <li className="relative pl-10">
      {/* timeline dot */}
      <span className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-700 text-sm text-white shadow">
        {icon}
      </span>
      {!isLast && (
        <span
          className="absolute left-3.5 top-9 h-full w-px bg-primary-200"
          aria-hidden="true"
        />
      )}
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="text-sm font-semibold text-primary-900">
            <span className="mr-2 inline-block rounded bg-primary-100 px-1.5 py-0.5 text-xs font-bold text-primary-800">
              步驟 {step.step}
            </span>
            {step.title}
          </h4>
          <span className="shrink-0 text-xs font-mono text-slate-500">
            {step.duration_ms} ms
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-700">{step.summary}</p>

        {/* rag_search 特化：列出文獻引用 */}
        {isRag && <RagHitsList hits={step.detail.hits} />}

        {step.detail && Object.keys(step.detail).length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 text-xs text-primary-700 hover:underline"
          >
            {open ? '收合 raw detail ▴' : '展開 raw detail ▾'}
          </button>
        )}
        {open && (
          <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
            {JSON.stringify(step.detail, null, 2)}
          </pre>
        )}
      </div>
    </li>
  );
}

export default function HermesTraceCard({ trace }: HermesTraceCardProps) {
  if (!trace || trace.steps.length === 0) {
    return (
      <div
        data-testid="hermes-trace-empty"
        className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500"
      >
        尚無 Hermes 追蹤資料。觸發一次 AI 分析即可看到 9 步驟流程。
      </div>
    );
  }

  return (
    <section data-testid="hermes-trace-card" className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold text-primary-900">
          Hermes 9 步驟流程
        </h3>
        <span className="text-sm text-slate-600">
          總耗時 <strong className="font-mono">{trace.total_ms} ms</strong>
        </span>
      </header>
      <ol className="space-y-3">
        {trace.steps.map((s, i) => (
          <StepRow
            key={`${s.step}-${s.name}`}
            step={s}
            isLast={i === trace.steps.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}
