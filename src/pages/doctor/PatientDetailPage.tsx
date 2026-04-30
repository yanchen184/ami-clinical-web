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

type TabKey = 'overview' | 'hermes' | 'trends' | 'medications' | 'diagnoses' | 'adverse';

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
      const dx = (patient?.diagnosis ?? '') + ' ' + (patient?.dischargeDiagnosis ?? '');
      const firstValue = (m: { value: Record<string, unknown> }) => {
        for (const v of Object.values(m.value ?? {})) {
          if (typeof v === 'number' && Number.isFinite(v)) return v;
        }
        return 0;
      };
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
        labs:
          measurements?.slice(0, 8).map((m) => ({
            name: typeof m.type === 'string' ? m.type : 'BP',
            value: firstValue(m),
            unit: '',
            measured_at: m.recordedAt ?? new Date().toISOString(),
          })) ?? [],
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
                觸發失敗：{(analyzeMutation.error as Error)?.message}
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
                  按下「立即分析」會觸發 Hermes 7 步驟
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
                觸發失敗：{(analyzeMutation.error as Error)?.message}
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
