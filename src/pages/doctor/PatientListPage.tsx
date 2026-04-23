import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPatients } from '../../api/patient';
import PageHeader from '../../components/PageHeader';
import SearchFilter from '../../components/SearchFilter';
import PatientCard from '../../components/PatientCard';

export default function DoctorPatientListPage() {
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patients', page, search, riskLevel],
    queryFn: () => getPatients({ page, search, riskLevel }),
  });

  return (
    <div>
      <PageHeader title="病患列表" subtitle="查看您負責的 AMI 病患" />

      <SearchFilter
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(0);
        }}
        riskLevel={riskLevel}
        onRiskLevelChange={(v) => {
          setRiskLevel(v);
          setPage(0);
        }}
      />

      {isLoading && (
        <div className="text-center py-12 text-gray-400">載入中...</div>
      )}

      {isError && (
        <div className="text-center py-12 text-red-500">載入失敗，請重新整理</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.content.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                basePath="/doctor/patients"
              />
            ))}
          </div>

          {data.content.length === 0 && (
            <div className="text-center py-12 text-gray-400">無符合條件的病患</div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                上一頁
              </button>
              <span className="text-sm text-gray-500">
                {page + 1} / {data.totalPages}
              </span>
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
