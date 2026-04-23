import type { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
}

const RISK_STYLES: Record<RiskLevel, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-green-100 text-green-700 border-green-200',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  HIGH: '高風險',
  MEDIUM: '中風險',
  LOW: '低風險',
};

export default function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${RISK_STYLES[level]}`}
    >
      {level === 'HIGH' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />}
      {RISK_LABELS[level]}
    </span>
  );
}
