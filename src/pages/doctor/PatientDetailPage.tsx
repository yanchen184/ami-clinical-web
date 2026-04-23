import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getPatient,
  getPatientSummary,
  getPatientMeasurements,
  getPatientCdssAdvice,
} from '../../api/patient';
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

type TabKey = 'overview' | 'trends' | 'medications' | 'diagnoses' | 'adverse';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '總覽' },
  { key: 'trends', label: '趨勢指標' },
  { key: 'medications', label: '用藥紀錄' },
  { key: 'diagnoses', label: '診斷紀錄' },
  { key: 'adverse', label: '不良反應' },
];

export default function DoctorPatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
                {patient.age != null ? `${patient.age} 歲` : '-'} / {patient.gender === 'M' ? '男' : '女'}
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
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <AiAdvicePanel
              patientId={patientId}
              summary={summary}
              cdssAdvice={cdssAdvice}
            />
          </div>
          <div className="col-span-1">
            <MeasurementChart measurements={measurements ?? []} />
          </div>
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
