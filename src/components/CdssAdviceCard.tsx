import type { AdviceType, CdssAdvice } from '../types';

// API may return legacy format with {priority, advice} instead of {type, content, confidence, disclaimer}
interface LegacyCdssAdvice {
  id?: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  advice?: string;
  createdAt?: string;
}

type CdssAdviceInput = CdssAdvice | LegacyCdssAdvice;

interface CdssAdviceCardProps {
  advice: CdssAdviceInput;
}

const TYPE_CONFIG: Record<AdviceType, { icon: string; label: string; color: string }> = {
  MEDICATION: { icon: '💊', label: '用藥建議', color: 'text-blue-600' },
  LIFESTYLE: { icon: '🏃', label: '生活型態', color: 'text-green-600' },
  REFERRAL: { icon: '🏥', label: '轉介建議', color: 'text-purple-600' },
  MONITORING: { icon: '📋', label: '監測項目', color: 'text-orange-600' },
};

const PRIORITY_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  HIGH: { icon: '🔴', label: '高優先', color: 'text-red-600' },
  MEDIUM: { icon: '🟡', label: '中優先', color: 'text-yellow-600' },
  LOW: { icon: '🟢', label: '低優先', color: 'text-green-600' },
};

function normalizeAdvice(advice: CdssAdviceInput): {
  icon: string;
  label: string;
  color: string;
  content: string;
  confidence: number | null;
  disclaimer: string | null;
} {
  const typed = advice as CdssAdvice;
  const legacy = advice as LegacyCdssAdvice;

  if (typed.type && TYPE_CONFIG[typed.type]) {
    const config = TYPE_CONFIG[typed.type];
    // confidence may be 0-1 float or 0-100 integer
    const rawConf = typed.confidence ?? 0;
    const confidence = rawConf <= 1 ? Math.round(rawConf * 100) : rawConf;
    return { ...config, content: typed.content, confidence, disclaimer: typed.disclaimer ?? null };
  }

  // Legacy format: {priority, advice}
  const priority = legacy.priority ?? 'MEDIUM';
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG['MEDIUM'];
  return { ...config, content: legacy.advice ?? '', confidence: null, disclaimer: null };
}

export default function CdssAdviceCard({ advice }: CdssAdviceCardProps) {
  const { icon, label, color, content, confidence, disclaimer } = normalizeAdvice(advice);

  const confidenceColor =
    confidence === null
      ? ''
      : confidence >= 80
        ? 'bg-green-500'
        : confidence >= 50
          ? 'bg-yellow-500'
          : 'bg-red-500';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <span className={`text-sm font-semibold ${color}`}>{label}</span>
        </div>
        {/* Confidence */}
        {confidence !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">信心度</span>
            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${confidenceColor} rounded-full transition-all`}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600">{confidence}%</span>
          </div>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-gray-700 leading-relaxed mb-3">{content}</p>

      {/* Disclaimer */}
      {disclaimer && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          <p className="text-xs text-yellow-700">
            <span className="font-semibold">免責聲明：</span>
            {disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
