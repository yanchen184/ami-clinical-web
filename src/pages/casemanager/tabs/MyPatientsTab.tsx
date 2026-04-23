import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPatients } from '../../../api/patient';
import { sendNotification } from '../../../api/notification';
import SearchFilter from '../../../components/SearchFilter';
import PatientCard from '../../../components/PatientCard';
import type { Patient } from '../../../types';

export default function MyPatientsTab() {
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [page, setPage] = useState(0);
  const [notifyStatus, setNotifyStatus] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cm-patients', page, search, riskLevel],
    queryFn: () => getPatients({ page, search, riskLevel, assignedToMe: true }),
  });

  const handleNotify = async (patient: Patient) => {
    try {
      await sendNotification({
        patientId: patient.id,
        type: 'REMINDER',
        content: `提醒病患 ${patient.name} 填報今日健康數據。`,
      });
      setNotifyStatus(`已成功推播通知給 ${patient.name}`);
      setTimeout(() => setNotifyStatus(null), 3000);
    } catch {
      setNotifyStatus('推播失敗，請重試');
      setTimeout(() => setNotifyStatus(null), 3000);
    }
  };

  return (
    <div>
      {notifyStatus && (
        <div className="mb-4 px-4 py-3 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700">
          {notifyStatus}
        </div>
      )}

      <SearchFilter
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(0); }}
        riskLevel={riskLevel}
        onRiskLevelChange={(v) => { setRiskLevel(v); setPage(0); }}
      />

      {isLoading && <div className="text-center py-12 text-gray-400">載入中...</div>}
      {isError && <div className="text-center py-12 text-red-500">載入失敗，請重新整理</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.content.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                basePath="/casemanager/patients"
                showReportDate
                onNotify={handleNotify}
              />
            ))}
          </div>
          {data.content.length === 0 && (
            <div className="text-center py-12 text-gray-400">無符合條件的個案</div>
          )}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                上一頁
              </button>
              <span className="text-sm text-gray-500">{page + 1} / {data.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages - 1, p + 1))}
                disabled={page >= data.totalPages - 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                下一頁
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
