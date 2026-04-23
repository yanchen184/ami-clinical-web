import type { RiskLevel } from '../types';

interface SearchFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  riskLevel: string;
  onRiskLevelChange: (value: string) => void;
}

const RISK_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部風險' },
  { value: 'HIGH' satisfies RiskLevel, label: '高風險' },
  { value: 'MEDIUM' satisfies RiskLevel, label: '中風險' },
  { value: 'LOW' satisfies RiskLevel, label: '低風險' },
];

export default function SearchFilter({
  search,
  onSearchChange,
  riskLevel,
  onRiskLevelChange,
}: SearchFilterProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="flex-1 relative">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜尋病患姓名或病歷號..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      </div>
      <select
        value={riskLevel}
        onChange={(e) => onRiskLevelChange(e.target.value)}
        className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        {RISK_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
