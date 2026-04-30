import { useState } from 'react';
import {
  analyze,
  submitFeedback,
  syncFeedback,
  type AnalyzeResponse,
  type PatientFixture,
} from '../api/aiService';
import { PATIENT_FIXTURES } from '../data/patientFixtures';

type Stage = 'idle' | 'analyzing' | 'analyzed' | 'feedback_sent' | 'syncing' | 'synced';

export default function AiDemoPage() {
  const [patientId, setPatientId] = useState<string>('p002');
  const [first, setFirst] = useState<AnalyzeResponse | null>(null);
  const [second, setSecond] = useState<AnalyzeResponse | null>(null);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [reasonCategory, setReasonCategory] = useState<string>('drug_choice');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const patient: PatientFixture | undefined = PATIENT_FIXTURES[patientId];

  async function handleFirstAnalyze() {
    if (!patient) return;
    setError(null);
    setFirst(null);
    setSecond(null);
    setStage('analyzing');
    try {
      const r = await analyze(patient);
      setFirst(r);
      setStage('analyzed');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('idle');
    }
  }

  async function handleSendFeedback() {
    if (!first) return;
    setError(null);
    try {
      await submitFeedback(patientId, {
        ai_summary_id: first.summary_id,
        feedback_type: 'correction',
        doctor_id: 'demo-doctor',
        reason_category: reasonCategory,
        reason_text: feedbackText,
      });
      // Trigger 3 identical feedbacks to cross the pattern threshold (PATTERN_THRESHOLD=3)
      // so the FeedbackSyncJob takes the evolve_skill path.
      await submitFeedback(patientId, {
        ai_summary_id: first.summary_id,
        feedback_type: 'correction',
        doctor_id: 'demo-doctor-2',
        reason_category: reasonCategory,
        reason_text: feedbackText,
      });
      await submitFeedback(patientId, {
        ai_summary_id: first.summary_id,
        feedback_type: 'correction',
        doctor_id: 'demo-doctor-3',
        reason_category: reasonCategory,
        reason_text: feedbackText,
      });
      setStage('feedback_sent');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSyncAndReanalyze() {
    if (!patient) return;
    setError(null);
    setStage('syncing');
    try {
      const sync = await syncFeedback(patientId);
      setSyncResult(JSON.stringify(sync));
      const r = await analyze(patient);
      setSecond(r);
      setStage('synced');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('analyzed');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">AMI 智慧照護 — Feedback Loop Demo</h1>
        <p className="mb-6 text-sm text-gray-600">
          1) 選病患 → 取得用藥建議 2) 醫師輸入訂正 feedback → 送出 3) 觸發 sync 並重跑 /analyze →
          比對前後建議差異
        </p>

        <section className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Step 1 — 選擇病患</h2>
          <div className="flex gap-3">
            {Object.keys(PATIENT_FIXTURES).map((pid) => (
              <button
                key={pid}
                data-testid={`patient-${pid}`}
                onClick={() => setPatientId(pid)}
                className={`rounded border px-4 py-2 text-sm ${
                  patientId === pid
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {pid}
              </button>
            ))}
          </div>
          {patient && (
            <pre className="mt-3 overflow-x-auto rounded bg-gray-100 p-3 text-xs text-gray-700">
              {JSON.stringify(
                {
                  age: patient.age,
                  sex: patient.sex,
                  comorbidities: Object.entries(patient)
                    .filter(([k, v]) => k.startsWith('has_') && v)
                    .map(([k]) => k.replace('has_', '')),
                  meds: patient.medications?.map((m) => m.name),
                  note: patient.note,
                },
                null,
                2,
              )}
            </pre>
          )}
          <button
            data-testid="btn-first-analyze"
            onClick={handleFirstAnalyze}
            disabled={stage === 'analyzing'}
            className="mt-4 rounded bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {stage === 'analyzing' ? '分析中…' : '第一次 /analyze'}
          </button>
        </section>

        {first && <AdviceCard title="第一次 AI 建議" data={first} testid="first-advice" />}

        {first && (
          <section className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Step 2 — 醫師訂正 Feedback</h2>
            <label className="mb-2 block text-sm font-medium text-gray-700">分類</label>
            <select
              data-testid="feedback-category"
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="drug_choice">drug_choice 用藥選擇</option>
              <option value="dose_adjustment">dose_adjustment 劑量調整</option>
              <option value="contraindication">contraindication 禁忌症</option>
              <option value="follow_up_timing">follow_up_timing 追蹤時機</option>
            </select>
            <label className="mb-2 block text-sm font-medium text-gray-700">訂正內容</label>
            <textarea
              data-testid="feedback-text"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="例：本院 SGLT2i 第一線改為 dapagliflozin（健保給付考量）"
            />
            <button
              data-testid="btn-send-feedback"
              onClick={handleSendFeedback}
              disabled={!feedbackText.trim()}
              className="mt-3 rounded bg-amber-600 px-5 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              送出 feedback (×3 觸發 evolve)
            </button>
            {stage === 'feedback_sent' && (
              <p data-testid="feedback-sent-msg" className="mt-2 text-sm text-green-700">
                ✓ 已送出，等候 sync。
              </p>
            )}
          </section>
        )}

        {stage === 'feedback_sent' && (
          <section className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Step 3 — 觸發 sync 並重跑</h2>
            <button
              data-testid="btn-sync"
              onClick={handleSyncAndReanalyze}
              className="rounded bg-green-600 px-5 py-2 text-white hover:bg-green-700"
            >
              觸發 sync + 第二次 /analyze
            </button>
          </section>
        )}

        {syncResult && (
          <p data-testid="sync-result" className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">
            sync 結果：{syncResult}
          </p>
        )}

        {second && <AdviceCard title="第二次 AI 建議（feedback 之後）" data={second} testid="second-advice" />}

        {error && (
          <pre data-testid="error-msg" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800">
            {error}
          </pre>
        )}
      </div>
    </div>
  );
}

interface AdviceCardProps {
  title: string;
  data: AnalyzeResponse;
  testid: string;
}

function AdviceCard({ title, data, testid }: AdviceCardProps) {
  return (
    <section data-testid={testid} className="mb-6 rounded-lg border-l-4 border-blue-500 bg-white p-6 shadow">
      <h2 className="mb-3 text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mb-3 text-xs text-gray-500">
        summary_id={data.summary_id} · triggers={data.triggers.join(',') || '(none)'} · latency=
        {data.latency_ms}ms · used_rag={String(data.used_rag)}
      </p>
      <details className="mb-3" open>
        <summary className="cursor-pointer font-medium text-gray-700">SOAP</summary>
        <div className="mt-2 space-y-2 text-sm">
          {(['S', 'O', 'A', 'P'] as const).map((k) => (
            <div key={k}>
              <span className="font-semibold">{k}：</span>
              <pre className="whitespace-pre-wrap text-gray-700">{data.soap[k]}</pre>
            </div>
          ))}
        </div>
      </details>
      <div className="mb-3">
        <h3 className="mb-1 font-medium text-gray-700">用藥／處置建議</h3>
        <ul data-testid={`${testid}-recommendations`} className="ml-5 list-disc space-y-1 text-sm">
          {data.cdss.recommendations.map((r, i) => (
            <li key={i}>
              {r.priority && (
                <span className="mr-1 text-xs font-medium text-gray-500">
                  [{r.priority}]
                </span>
              )}
              {r.content}
              {r.source && (
                <span className="ml-1 text-[11px] text-gray-400">({r.source})</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      {data.cdss.warnings.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-1 font-medium text-amber-700">警示</h3>
          <ul className="ml-5 list-disc space-y-1 text-sm text-amber-800">
            {data.cdss.warnings.map((w, i) => (
              <li key={i}>
                {w.priority && (
                  <span className="mr-1 text-xs font-medium text-amber-600">
                    [{w.priority}]
                  </span>
                )}
                {w.content}
                {w.source && (
                  <span className="ml-1 text-[11px] text-amber-500/70">({w.source})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-gray-500">rule_sources：{data.rule_sources.join(', ') || '(none)'}</p>
    </section>
  );
}
