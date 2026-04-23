import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlertRules, updateAlertRule } from '../../api/alertRule';
import PageHeader from '../../components/PageHeader';
import type { AlertRule } from '../../types';

function AlertRuleRow({ rule }: { rule: AlertRule }) {
  const queryClient = useQueryClient();
  const [yellow, setYellow] = useState(rule.yellowThreshold);
  const [red, setRed] = useState(rule.redThreshold);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateAlertRule(rule.id, { yellowThreshold: yellow, redThreshold: red, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const dirty =
    yellow !== rule.yellowThreshold || red !== rule.redThreshold || enabled !== rule.enabled;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-4 px-4">
        <p className="text-sm font-medium text-gray-900">{rule.metricLabel}</p>
        <p className="text-xs text-gray-400 font-mono">{rule.metric}</p>
      </td>
      <td className="py-4 px-4 text-sm text-gray-500 text-center">{rule.unit}</td>
      <td className="py-4 px-4">
        <input
          type="number"
          value={yellow}
          onChange={(e) => setYellow(Number(e.target.value))}
          className="w-24 px-2 py-1.5 border border-yellow-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </td>
      <td className="py-4 px-4">
        <input
          type="number"
          value={red}
          onChange={(e) => setRed(Number(e.target.value))}
          className="w-24 px-2 py-1.5 border border-red-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </td>
      <td className="py-4 px-4 text-center">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => setEnabled(!enabled)}
            className={`w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </label>
      </td>
      <td className="py-4 px-4 text-center">
        {saved ? (
          <span className="text-xs text-green-600">✓ 已儲存</span>
        ) : (
          <button
            onClick={() => mutation.mutate()}
            disabled={!dirty || mutation.isPending}
            className="px-3 py-1 text-xs bg-primary-800 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
          >
            {mutation.isPending ? '儲存中' : '儲存'}
          </button>
        )}
      </td>
    </tr>
  );
}

export default function AlertRulePage() {
  const { data: rules, isLoading, isError } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: getAlertRules,
  });

  return (
    <div>
      <PageHeader
        title="警示規則設定"
        subtitle="設定各量測指標的黃燈（警戒）與紅燈（超標）閾值"
      />

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading && <div className="text-center py-12 text-gray-400">載入中...</div>}
        {isError && <div className="text-center py-12 text-red-500">載入失敗</div>}

        {rules && (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs text-gray-500">
                <th className="py-3 px-4 text-left font-medium">指標</th>
                <th className="py-3 px-4 text-center font-medium">單位</th>
                <th className="py-3 px-4 text-center font-medium">黃燈閾值</th>
                <th className="py-3 px-4 text-center font-medium">紅燈閾值</th>
                <th className="py-3 px-4 text-center font-medium">啟用</th>
                <th className="py-3 px-4 text-center font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <AlertRuleRow key={rule.id} rule={rule} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
