import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPatients, updatePatientAlertFlag } from '../../../api/patient';
import { useNavigate } from 'react-router-dom';
import RiskBadge from '../../../components/RiskBadge';

export default function RedAlertsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dismissReason, setDismissReason] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['red-alert-patients'],
    queryFn: () => getPatients({ alertStatus: 'RED', size: 50 }),
    refetchInterval: 30_000,
  });

  const dismissMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      updatePatientAlertFlag(id, false, reason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['red-alert-patients'] });
    },
  });

  const patients = data?.content ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
        <span className="text-red-500 text-lg">🚨</span>
        <p className="text-sm text-red-700">
          以下個案已被系統或醫師標記為紅燈警示，請儘快聯繫確認。
          {patients.length > 0 && ` 共 ${patients.length} 位。`}
        </p>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">載入中...</div>}

      {!isLoading && patients.length === 0 && (
        <div className="text-center py-12 text-gray-400">目前無紅燈警示個案</div>
      )}

      <div className="space-y-3">
        {patients.map((patient) => (
          <div
            key={patient.id}
            className="bg-white rounded-xl border-l-4 border-red-500 shadow-sm p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => navigate(`/casemanager/patients/${patient.id}`)}
                    className="text-base font-semibold text-gray-900 hover:text-primary-700 transition-colors"
                  >
                    {patient.name}
                  </button>
                  <RiskBadge level={patient.riskLevel} />
                </div>
                {patient.alertFlagReason && (
                  <p className="text-sm text-red-600 mb-2">
                    <span className="font-medium">警示原因：</span>
                    {patient.alertFlagReason}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  最後回報：{patient.lastReportDate
                    ? new Date(patient.lastReportDate).toLocaleDateString('zh-TW')
                    : '尚未回報'}
                </p>
              </div>

              {/* Dismiss section */}
              <div className="flex flex-col gap-2 shrink-0 w-56">
                <input
                  type="text"
                  placeholder="解除原因（選填）"
                  value={dismissReason[patient.id] ?? ''}
                  onChange={(e) =>
                    setDismissReason((prev) => ({ ...prev, [patient.id]: e.target.value }))
                  }
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
                <button
                  onClick={() =>
                    dismissMutation.mutate({
                      id: patient.id,
                      reason: dismissReason[patient.id] ?? '',
                    })
                  }
                  disabled={dismissMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  解除警示
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
