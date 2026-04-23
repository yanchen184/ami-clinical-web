import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { getPatientTrendIndicators } from '../api/patient';
import type { TrendIndicator } from '../types';

interface TrendDashboardProps {
  patientId: string;
}

type DayRange = 7 | 30 | 90;

const METRIC_COLORS: Record<string, string> = {
  BLOOD_PRESSURE: '#ef4444',
  LDL_C: '#f97316',
  BLOOD_GLUCOSE: '#8b5cf6',
  HBA1C: '#06b6d4',
  WEIGHT: '#10b981',
  HEART_RATE: '#3b82f6',
};

const STATUS_CONFIG = {
  RED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: '超標' },
  YELLOW: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500', label: '警戒' },
  GREEN: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: '正常' },
  UNKNOWN: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: '無資料' },
};

function StatusLight({ status }: { status: TrendIndicator['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function IndicatorCard({
  indicator,
  selected,
  onClick,
}: {
  indicator: TrendIndicator;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-500">{indicator.label}</span>
        <StatusLight status={indicator.status} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">
          {indicator.latestValue ?? '—'}
        </span>
        <span className="text-xs text-gray-400">{indicator.unit}</span>
      </div>
      {indicator.targetValue !== null && (
        <p className="text-xs text-gray-400 mt-1">目標 &lt; {indicator.targetValue} {indicator.unit}</p>
      )}
    </button>
  );
}

export default function TrendDashboard({ patientId }: TrendDashboardProps) {
  const [days, setDays] = useState<DayRange>(30);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const { data: indicators, isLoading } = useQuery({
    queryKey: ['patient-trend', patientId, days],
    queryFn: () => getPatientTrendIndicators(patientId, days),
  });

  const selected = indicators?.find((i) => i.metric === selectedMetric) ?? indicators?.[0];
  const chartColor = selected ? (METRIC_COLORS[selected.metric] ?? '#3b82f6') : '#3b82f6';
  const chartData = selected?.dataPoints.map((p) => ({
    date: new Date(p.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
    value: p.value,
  })) ?? [];

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">趨勢總覽</h3>
        <div className="flex gap-1">
          {([7, 30, 90] as DayRange[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                days === d
                  ? 'bg-primary-800 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {d} 天
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">載入中...</div>
      )}

      {!isLoading && indicators && (
        <>
          {/* Indicator cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {indicators.map((ind) => (
              <IndicatorCard
                key={ind.metric}
                indicator={ind}
                selected={selected?.metric === ind.metric}
                onClick={() => setSelectedMetric(ind.metric)}
              />
            ))}
          </div>

          {/* Chart */}
          {selected && chartData.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                {selected.label} 趨勢（近 {days} 天）
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [`${v} ${selected.unit}`, selected.label]}
                  />
                  {selected.targetValue !== null && (
                    <ReferenceLine
                      y={selected.targetValue}
                      stroke="#f97316"
                      strokeDasharray="4 4"
                      label={{ value: `目標 ${selected.targetValue}`, position: 'insideTopRight', fontSize: 11, fill: '#f97316' }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {selected && chartData.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">近 {days} 天無量測資料</p>
          )}
        </>
      )}

      {!isLoading && !indicators?.length && (
        <p className="text-sm text-gray-400 text-center py-12">尚無趨勢資料</p>
      )}
    </div>
  );
}
