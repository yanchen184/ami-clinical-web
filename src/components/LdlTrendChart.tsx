import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { getPatientMeasurements } from '../api/patient';
import { getAlertRules } from '../api/alertRule';

interface LdlTrendChartProps {
  patientId: string;
  days?: number;
}

export default function LdlTrendChart({ patientId, days = 90 }: LdlTrendChartProps) {
  const { data: measurements } = useQuery({
    queryKey: ['patient-ldl', patientId, days],
    queryFn: () => getPatientMeasurements(patientId, 'LDL_C', days),
  });

  const { data: alertRules } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: getAlertRules,
  });

  const ldlRule = alertRules?.find((r) => r.metric === 'LDL_C');
  const threshold = ldlRule?.redThreshold ?? 70;

  const chartData = (measurements ?? []).map((m) => ({
    date: new Date(m.recordedAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
    value: m.value?.ldl,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">LDL-C 趨勢</h3>
        <span className="text-xs text-gray-400">近 {days} 天 · 目標 &lt; {threshold} mg/dL</span>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
          尚無 LDL-C 量測資料
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit=" mg" />
            <Tooltip formatter={(v: number) => [`${v} mg/dL`, 'LDL-C']} />
            <ReferenceLine
              y={threshold}
              stroke="#f97316"
              strokeDasharray="4 4"
              label={{ value: `目標 ${threshold}`, position: 'insideTopRight', fontSize: 11, fill: '#f97316' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
