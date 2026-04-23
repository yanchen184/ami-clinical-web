import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getKpiSummary } from '../../api/kpi';
import PageHeader from '../../components/PageHeader';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  bgColor: string;
  sub?: string;
}

function KpiCard({ label, value, icon, color, bgColor, sub }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <span className={`w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center text-lg`}>
          {icon}
        </span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const RISK_COLORS = {
  high: '#ef4444',
  medium: '#f97316',
  low: '#22c55e',
};

export default function CMDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kpi-summary'],
    queryFn: getKpiSummary,
    refetchInterval: 60_000,
  });

  const pieData = data
    ? [
        { name: '高風險', value: data.highRiskCount, color: RISK_COLORS.high },
        { name: '中風險', value: data.mediumRiskCount, color: RISK_COLORS.medium },
        { name: '低風險', value: data.lowRiskCount, color: RISK_COLORS.low },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div>
      <PageHeader title="KPI 儀表板" subtitle="即時監控個案管理指標" />

      {isLoading && <div className="text-center py-12 text-gray-400">載入中...</div>}
      {isError && <div className="text-center py-12 text-red-500">載入失敗，請重新整理</div>}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KpiCard
              label="總在管人數"
              value={data.totalPatients}
              icon="👥"
              color="text-primary-800"
              bgColor="bg-primary-50"
              sub={`在案 ${data.activePatients} 人`}
            />
            <KpiCard
              label="高風險個案"
              value={data.highRiskCount}
              icon="⚠️"
              color="text-red-600"
              bgColor="bg-red-50"
              sub={`佔比 ${data.totalPatients > 0 ? ((data.highRiskCount / data.totalPatients) * 100).toFixed(1) : 0}%`}
            />
            <KpiCard
              label="填報率"
              value={`${(data.reportingRate * 100).toFixed(1)}%`}
              icon="📋"
              color="text-green-600"
              bgColor="bg-green-50"
            />
            <KpiCard
              label="異常值數"
              value={data.abnormalCount}
              icon="🔔"
              color="text-orange-600"
              bgColor="bg-orange-50"
            />
          </div>

          {/* Risk Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">風險分布</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} 人`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">
                  尚無資料
                </div>
              )}
            </div>

            {/* Risk Breakdown Table */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">風險等級統計</h3>
              <div className="space-y-4">
                {[
                  {
                    label: '高風險',
                    count: data.highRiskCount,
                    color: 'bg-red-500',
                    textColor: 'text-red-600',
                    bgLight: 'bg-red-50',
                  },
                  {
                    label: '中風險',
                    count: data.mediumRiskCount,
                    color: 'bg-orange-500',
                    textColor: 'text-orange-600',
                    bgLight: 'bg-orange-50',
                  },
                  {
                    label: '低風險',
                    count: data.lowRiskCount,
                    color: 'bg-green-500',
                    textColor: 'text-green-600',
                    bgLight: 'bg-green-50',
                  },
                ].map((item) => {
                  const pct =
                    data.totalPatients > 0
                      ? (item.count / data.totalPatients) * 100
                      : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`font-medium ${item.textColor}`}>{item.label}</span>
                        <span className="text-gray-500">
                          {item.count} 人（{pct.toFixed(1)}%）
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 text-sm text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>在案人數</span>
                  <span className="font-medium text-gray-700">{data.activePatients} 人</span>
                </div>
                <div className="flex justify-between">
                  <span>總在管人數</span>
                  <span className="font-medium text-gray-700">{data.totalPatients} 人</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
