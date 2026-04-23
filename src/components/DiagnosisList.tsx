import { useQuery } from '@tanstack/react-query';
import { getPatientDiagnoses } from '../api/patient';

interface DiagnosisListProps {
  patientId: string;
}

const VISIT_TYPE_MAP: Record<string, { label: string; color: string }> = {
  OUTPATIENT: { label: '門診', color: 'text-blue-700 bg-blue-100' },
  EMERGENCY: { label: '急診', color: 'text-red-700 bg-red-100' },
  INPATIENT: { label: '住院', color: 'text-purple-700 bg-purple-100' },
};

export default function DiagnosisList({ patientId }: DiagnosisListProps) {
  const { data: diagnoses, isLoading } = useQuery({
    queryKey: ['patient-diagnoses', patientId],
    queryFn: () => getPatientDiagnoses(patientId),
  });

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-4 text-center">載入中...</div>;
  }

  if (!diagnoses?.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">診斷紀錄（ICD-10）</h3>
        <p className="text-sm text-gray-400 text-center py-4">尚無診斷紀錄</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">診斷紀錄（ICD-10）</h3>
      <div className="space-y-2">
        {diagnoses.map((diag) => {
          const vt = VISIT_TYPE_MAP[diag.visitType] ?? { label: diag.visitType, color: 'text-gray-500 bg-gray-100' };
          return (
            <div
              key={diag.id}
              className="flex items-center gap-4 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-xs text-gray-400 shrink-0 w-[80px]">
                {new Date(diag.visitDate).toLocaleDateString('zh-TW')}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${vt.color}`}>
                {vt.label}
              </span>
              <span className="font-mono text-sm font-semibold text-primary-700 min-w-[70px]">
                {diag.icdCode}
              </span>
              <span className="text-sm text-gray-700 flex-1">{diag.icdDescription ?? '-'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
