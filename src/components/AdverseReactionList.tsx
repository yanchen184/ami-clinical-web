import { useQuery } from '@tanstack/react-query';
import { getPatientAdverseReactions } from '../api/patient';

interface AdverseReactionListProps {
  patientId: string;
}

export default function AdverseReactionList({ patientId }: AdverseReactionListProps) {
  const { data: reactions, isLoading } = useQuery({
    queryKey: ['patient-adverse-reactions', patientId],
    queryFn: () => getPatientAdverseReactions(patientId),
  });

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-4 text-center">載入中...</div>;
  }

  if (!reactions?.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">藥物不良反應紀錄</h3>
        <p className="text-sm text-gray-400 text-center py-4">無藥物不良反應紀錄</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">藥物不良反應紀錄</h3>
      <div className="space-y-2">
        {reactions.map((r) => (
          <div key={r.id} className="flex items-center gap-4 px-4 py-3 border border-red-100 bg-red-50 rounded-lg">
            <span className="text-red-500 text-lg shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{r.drugName}</p>
              {r.hospitalCode && (
                <p className="text-xs text-gray-500 font-mono">院內代碼：{r.hospitalCode}</p>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              更新：{new Date(r.updatedDate).toLocaleDateString('zh-TW')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
