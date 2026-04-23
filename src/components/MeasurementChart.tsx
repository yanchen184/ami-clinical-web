import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Measurement } from '../types';

interface MeasurementChartProps {
  measurements: Measurement[];
  title?: string;
}

export default function MeasurementChart({
  measurements,
  title = '血壓趨勢',
}: MeasurementChartProps) {
  const chartData = measurements.map((m) => ({
    date: new Date(m.recordedAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
    收縮壓: m.value?.systolic,
    舒張壓: m.value?.diastolic,
  }));

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-sm text-gray-400 text-center py-8">尚無量測資料</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} domain={[60, 180]} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="收縮壓"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="舒張壓"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
