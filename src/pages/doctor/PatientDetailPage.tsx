import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPatient,
  getPatientSummary,
  getPatientMeasurements,
  getPatientCdssAdvice,
} from '../../api/patient';
import { analyze, type AnalyzeResponse, type PatientFixture } from '../../api/aiService';
import PageHeader from '../../components/PageHeader';
import RiskBadge from '../../components/RiskBadge';
import SoapCard from '../../components/SoapCard';
import MeasurementChart from '../../components/MeasurementChart';
import TrendDashboard from '../../components/TrendDashboard';
import LdlTrendChart from '../../components/LdlTrendChart';
import MedicationHistoryList from '../../components/MedicationHistoryList';
import DiagnosisList from '../../components/DiagnosisList';
import AdverseReactionList from '../../components/AdverseReactionList';
import AiAdvicePanel from '../../components/AiAdvicePanel';
import HermesTraceCard from '../../components/HermesTraceCard';
import AnalyzeProgressIndicator from '../../components/AnalyzeProgressIndicator';

type TabKey = 'overview' | 'hermes' | 'trends' | 'medications' | 'diagnoses' | 'adverse';

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err ?? '未知錯誤');
}

const VALID_LAB_NAMES = new Set([
  'LDL_C', 'HBA1C', 'EGFR', 'SCR', 'SBP', 'DBP', 'AST', 'ALT', 'LVEF',
]);

type LabEntry = { name: string; value: number; unit?: string; measured_at?: string };

function buildLabsFromMeasurements(
  ms: Array<{ type: string; value: Record<string, number>; recordedAt?: string }>,
): LabEntry[] {
  const out: LabEntry[] = [];
  for (const m of ms.slice(0, 8)) {
    const ts = m.recordedAt ?? new Date().toISOString();
    if (m.type === 'BLOOD_PRESSURE') {
      const sbp = m.value?.systolic;
      const dbp = m.value?.diastolic;
      if (typeof sbp === 'number' && Number.isFinite(sbp)) {
        out.push({ name: 'SBP', value: sbp, unit: 'mmHg', measured_at: ts });
      }
      if (typeof dbp === 'number' && Number.isFinite(dbp)) {
        out.push({ name: 'DBP', value: dbp, unit: 'mmHg', measured_at: ts });
      }
      continue;
    }
    if (!VALID_LAB_NAMES.has(m.type)) continue;
    const firstNum = Object.values(m.value ?? {}).find(
      (v): v is number => typeof v === 'number' && Number.isFinite(v),
    );
    if (firstNum == null) continue;
    out.push({ name: m.type, value: firstNum, measured_at: ts });
  }
  return out;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '總覽' },
  { key: 'hermes', label: 'Hermes 流程' },
  { key: 'trends', label: '趨勢指標' },
  { key: 'medications', label: '用藥紀錄' },
  { key: 'diagnoses', label: '診斷紀錄' },
  { key: 'adverse', label: '不良反應' },
];

export default function DoctorPatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const patientId = id ?? '';
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient(patientId),
  });

  const { data: summary } = useQuery({
    queryKey: ['patient-summary', patientId],
    queryFn: () => getPatientSummary(patientId),
  });

  const { data: measurements } = useQuery({
    queryKey: ['patient-measurements', patientId, 'BLOOD_PRESSURE'],
    queryFn: () => getPatientMeasurements(patientId, 'BLOOD_PRESSURE'),
  });

  const { data: cdssAdvice } = useQuery({
    queryKey: ['patient-cdss', patientId],
    queryFn: () => getPatientCdssAdvice(patientId),
  });

  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const analyzeMutation = useMutation({
    mutationFn: () => {
      // measurements 還沒載入就觸發 → 直接擋住，避免送空 labs 給 LLM
      // 造成 baseline 計算空缺、CDSS 退化成沒有檢驗依據的回應。
      if (!measurements) {
        throw new Error('檢驗數據尚未載入，請稍候再觸發分析');
      }
      const dx = (patient?.diagnosis ?? '') + ' ' + (patient?.dischargeDiagnosis ?? '');
      const fixture: PatientFixture = {
        patientId,
        age: patient?.age ?? undefined,
        sex: patient?.gender ?? undefined,
        has_ami: true,
        has_diabetes: /diabet|dm/i.test(dx),
        has_hypertension: /hypertens|htn/i.test(dx),
        has_hyperlipidemia: /lipid|hld/i.test(dx),
        has_hf: /heart\s*failure|\bhf\b/i.test(dx),
        has_ckd: /renal|ckd/i.test(dx),
        labs: buildLabsFromMeasurements(measurements),
        medications: [],
        note: 'Triggered from DoctorPatientDetailPage Hermes tab',
      };
      return analyze(fixture);
    },
    onSuccess: (res) => {
      setAnalyzeResult(res);
      // /analyze persists a new AiSummary; refresh the queries that read from it
      // so the Overview Tab's CDSS section and SOAP card show the latest output.
      queryClient.invalidateQueries({ queryKey: ['patient-summary', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-cdss', patientId] });
    },
  });

  if (loadingPatient) {
    return <div className="text-center py-12 text-gray-400">載入中...</div>;
  }

  if (!patient) {
    return <div className="text-center py-12 text-red-500">找不到病患資料</div>;
  }

  return (
    <div>
      <PageHeader
        title={patient.name}
        subtitle={patient.medicalRecordNo ? `病歷號：${patient.medicalRecordNo}` : undefined}
        actions={
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            返回列表
          </button>
        }
      />

      {/* Patient Info Card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center text-xl font-bold shrink-0">
            {patient.name.charAt(0)}
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400">年齡 / 性別</p>
              <p className="text-sm font-medium">
                {patient.age != null ? `${patient.age} 歲` : '-'} / {patient.gender === 'MALE' || patient.gender === 'M' ? '男' : patient.gender === 'FEMALE' || patient.gender === 'F' ? '女' : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">AMI 發病日期</p>
              <p className="text-sm font-medium">
                {patient.amiOnsetDate ? new Date(patient.amiOnsetDate).toLocaleDateString('zh-TW') : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">入院日期</p>
              <p className="text-sm font-medium">
                {patient.admissionDate ? new Date(patient.admissionDate).toLocaleDateString('zh-TW') : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">風險等級</p>
              <RiskBadge level={patient.riskLevel} />
            </div>
            {patient.dischargeDiagnosis && (
              <div className="col-span-2 md:col-span-4">
                <p className="text-xs text-gray-400">出院診斷</p>
                <p className="text-sm font-medium">{patient.dischargeDiagnosis}</p>
              </div>
            )}
          </div>
        </div>

        {/* Alert Flag Banner */}
        {patient.alertFlagged && (
          <div className="mt-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <span className="text-red-500">🚨</span>
            <p className="text-sm text-red-700">
              <span className="font-semibold">紅燈警示：</span>
              {patient.alertFlagReason ?? '已被標記為需關注'}
            </p>
          </div>
        )}
      </div>

      {/* SOAP Summary */}
      {summary && <div className="mb-6"><SoapCard summary={summary} /></div>}

      {/* AI 分析進度條：放在 Tab 之外，避免切 tab 時 unmount → 計時器歸零。 */}
      {analyzeMutation.isPending && (
        <div className="mb-4">
          <AnalyzeProgressIndicator active />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-primary-800 text-primary-800'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 長條 RWD：折線圖 → 用藥 → AI 建議+回饋 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">📈 血壓趨勢</h3>
            <MeasurementChart measurements={measurements ?? []} />
          </section>
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">💊 近期用藥</h3>
            <MedicationHistoryList patientId={patientId} />
          </section>
          <section>
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">🧠 AI 建議與回饋</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  按「立即分析」即時更新 SOAP 摘要與 CDSS 調藥建議。
                </p>
              </div>
              <button
                type="button"
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                className="shrink-0 rounded-lg bg-primary-800 px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary-700 disabled:opacity-50"
              >
                {analyzeMutation.isPending ? '分析中…' : '立即觸發 AI 分析'}
              </button>
            </div>
            {analyzeMutation.isError && (
              <p className="mb-3 text-sm text-red-600">
                觸發失敗：{errorMessage(analyzeMutation.error)}
              </p>
            )}
            {analyzeResult && (
              <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
                <span className="mr-3">✨ 最近分析：</span>
                <span className="mr-3">耗時 <strong>{analyzeResult.latency_ms} ms</strong></span>
                <span className="mr-3">RAG <strong>{analyzeResult.used_rag ? '是' : '否'}</strong></span>
                <span>SKILL <strong>{Object.keys(analyzeResult.skill_versions ?? {}).length}</strong> 個</span>
              </div>
            )}
            <AiAdvicePanel
              patientId={patientId}
              summary={summary}
              cdssAdvice={cdssAdvice}
            />
          </section>
        </div>
      )}

      {activeTab === 'hermes' && (
        <div className="space-y-6">
          <section className="rounded-lg border border-primary-200 bg-primary-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-primary-900">
                  Hermes Agents 流程追蹤
                </h3>
                <p className="mt-1 text-sm text-primary-800/80">
                  按下「立即分析」會觸發 Hermes 9 步驟
                  pipeline，並顯示每一步的耗時與輸入輸出。
                </p>
              </div>
              <button
                type="button"
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                className="shrink-0 rounded-lg bg-primary-800 px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary-700 disabled:opacity-50"
              >
                {analyzeMutation.isPending ? '分析中…' : '立即觸發 AI 分析'}
              </button>
            </div>
            {analyzeMutation.isError && (
              <p
                data-testid="hermes-trace-error"
                className="mt-3 text-sm text-red-600"
              >
                觸發失敗：{errorMessage(analyzeMutation.error)}
              </p>
            )}
          </section>

          {analyzeResult && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                ✨ 本次分析結果摘要
              </h3>
              <ul className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <li>
                  <span className="text-slate-500">summary_id：</span>
                  <strong>{analyzeResult.summary_id}</strong>
                </li>
                <li>
                  <span className="text-slate-500">總耗時：</span>
                  <strong>{analyzeResult.latency_ms} ms</strong>
                </li>
                <li>
                  <span className="text-slate-500">使用 RAG：</span>
                  <strong>{analyzeResult.used_rag ? '是' : '否'}</strong>
                </li>
                <li>
                  <span className="text-slate-500">SKILL 版本數：</span>
                  <strong>
                    {Object.keys(analyzeResult.skill_versions ?? {}).length}
                  </strong>
                </li>
              </ul>

              {analyzeResult.rule_sources && analyzeResult.rule_sources.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-xs font-semibold text-slate-500">
                    📚 引用規則來源（{analyzeResult.rule_sources.length}）
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {analyzeResult.rule_sources.map((src, i) => (
                      <span
                        key={`${src}-${i}`}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                        title={src}
                      >
                        <span aria-hidden>📄</span>
                        {src}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400">
                    詳細文獻內容請展開下方步驟 5「向量檢索文獻」查看
                  </p>
                </div>
              )}
            </section>
          )}

          <HermesTraceCard trace={analyzeResult?.trace} />
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-6">
          <TrendDashboard patientId={patientId} />
          <LdlTrendChart patientId={patientId} />
        </div>
      )}

      {activeTab === 'medications' && (
        <MedicationHistoryList patientId={patientId} />
      )}

      {activeTab === 'diagnoses' && (
        <DiagnosisList patientId={patientId} />
      )}

      {activeTab === 'adverse' && (
        <AdverseReactionList patientId={patientId} />
      )}
    </div>
  );
}
