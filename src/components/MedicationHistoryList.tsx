import { useQuery } from '@tanstack/react-query';
import { getPatientMedications } from '../api/patient';

interface MedicationHistoryListProps {
  patientId: string;
}

export default function MedicationHistoryList({ patientId }: MedicationHistoryListProps) {
  const { data: medications, isLoading } = useQuery({
    queryKey: ['patient-medications', patientId],
    queryFn: () => getPatientMedications(patientId),
  });

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-4 text-center">載入中...</div>;
  }

  if (!medications?.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">近 90 日用藥紀錄</h3>
        <p className="text-sm text-gray-400 text-center py-4">尚無用藥紀錄</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">近 90 日用藥紀錄</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="pb-3 font-medium">就醫日期</th>
              <th className="pb-3 font-medium">藥品名稱</th>
              <th className="pb-3 font-medium">學名</th>
              <th className="pb-3 font-medium">院內代碼</th>
              <th className="pb-3 font-medium text-center">日次</th>
              <th className="pb-3 font-medium text-center">天數</th>
            </tr>
          </thead>
          <tbody>
            {medications.map((med) => (
              <tr key={med.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2.5 text-gray-500">
                  {new Date(med.visitDate).toLocaleDateString('zh-TW')}
                </td>
                <td className="py-2.5 font-medium text-gray-900">{med.drugName}</td>
                <td className="py-2.5 text-gray-600">{med.genericName ?? '-'}</td>
                <td className="py-2.5 font-mono text-xs text-gray-500">{med.hospitalCode ?? '-'}</td>
                <td className="py-2.5 text-center text-gray-600">{med.dailyFrequency ?? '-'}</td>
                <td className="py-2.5 text-center text-gray-600">{med.prescribedDays ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
