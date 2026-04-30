import type { AdvicePriority, AdviceType, CdssAdvice } from '../types';

// API may return legacy format with {priority, advice} or hermes format with
// {type: RECOMMENDATION/WARNING/INFO, content, source, priority}.
interface LegacyCdssAdvice {
  id?: number;
  priority?: AdvicePriority;
  advice?: string;
  // Internal seed / Java backend uses `message`; Hermes uses `content`.
  message?: string;
  createdAt?: string;
}

interface HermesCdssAdvice {
  id?: number;
  type?: string;
  content?: string;
  confidence?: number;
  source?: string;
  rule_id?: string;
  disclaimer?: string;
  priority?: AdvicePriority | null;
  createdAt?: string;
}

type CdssAdviceInput = CdssAdvice | LegacyCdssAdvice | HermesCdssAdvice;

interface CdssAdviceCardProps {
  advice: CdssAdviceInput;
}

interface AdviceVisualConfig {
  icon: string;
  label: string;
  color: string;
}

const TYPE_CONFIG: Record<AdviceType, AdviceVisualConfig> = {
  MEDICATION: { icon: '💊', label: '用藥建議', color: 'text-blue-600' },
  LIFESTYLE: { icon: '🏃', label: '生活型態', color: 'text-green-600' },
  REFERRAL: { icon: '🏥', label: '轉介建議', color: 'text-purple-600' },
  MONITORING: { icon: '📋', label: '監測項目', color: 'text-orange-600' },
};

// Hermes / SKILL pipeline emits these higher-level categories.
const HERMES_TYPE_CONFIG: Record<string, AdviceVisualConfig> = {
  RECOMMENDATION: { icon: '💡', label: '臨床建議', color: 'text-blue-600' },
  WARNING: { icon: '⚠️', label: '警示', color: 'text-red-600' },
  INFO: { icon: 'ℹ️', label: '參考資訊', color: 'text-slate-600' },
  ALERT: { icon: '🚨', label: '警報', color: 'text-red-600' },
};

const PRIORITY_BADGE: Record<AdvicePriority, { dot: string; label: string; chip: string }> = {
  HIGH: { dot: '🔴', label: '高優先', chip: 'bg-red-50 text-red-700 border-red-200' },
  MEDIUM: { dot: '🟡', label: '中優先', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  LOW: { dot: '🟢', label: '低優先', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const FALLBACK_CONFIG: AdviceVisualConfig = {
  icon: '💡',
  label: '臨床建議',
  color: 'text-slate-600',
};

function resolveTypeConfig(rawType: string | undefined): AdviceVisualConfig | null {
  if (!rawType) return null;
  const upper = rawType.toUpperCase();
  if (upper in TYPE_CONFIG) return TYPE_CONFIG[upper as AdviceType];
  if (upper in HERMES_TYPE_CONFIG) return HERMES_TYPE_CONFIG[upper];
  return null;
}

function normalizePriority(value: unknown): AdvicePriority | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  return upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW'
    ? (upper as AdvicePriority)
    : null;
}

function normalizeAdvice(advice: CdssAdviceInput): {
  icon: string;
  label: string;
  color: string;
  content: string;
  confidence: number | null;
  disclaimer: string | null;
  source: string | null;
  priority: AdvicePriority | null;
} {
  const typed = advice as CdssAdvice & HermesCdssAdvice;
  const legacy = advice as LegacyCdssAdvice;
  const priority = normalizePriority(typed.priority ?? legacy.priority);

  // Prefer the modern {type, content, confidence} shape — accept any type string and
  // fall back to a neutral icon when the type is unknown.
  if (typed.content || typed.type) {
    const config = resolveTypeConfig(typed.type) ?? FALLBACK_CONFIG;
    const rawConf = typed.confidence;
    const confidence =
      typeof rawConf === 'number' && Number.isFinite(rawConf)
        ? rawConf <= 1
          ? Math.round(rawConf * 100)
          : Math.round(rawConf)
        : null;
    return {
      ...config,
      content: typed.content ?? legacy.advice ?? legacy.message ?? '',
      confidence,
      disclaimer: typed.disclaimer ?? null,
      source: typed.source ?? typed.rule_id ?? null,
      priority,
    };
  }

  // Pure legacy {priority, advice|message} envelope — used by /cdss-advice rows
  // persisted via the Internal AI summary seed path.
  return {
    ...FALLBACK_CONFIG,
    content: legacy.advice ?? legacy.message ?? '',
    confidence: null,
    disclaimer: null,
    source: null,
    priority,
  };
}

export default function CdssAdviceCard({ advice }: CdssAdviceCardProps) {
  const { icon, label, color, content, confidence, disclaimer, source, priority } =
    normalizeAdvice(advice);

  // Defensive: an advice with no content adds no value — skip rendering instead of
  // showing an empty card with only the badge.
  if (!content) return null;

  const confidenceColor =
    confidence === null
      ? ''
      : confidence >= 80
        ? 'bg-green-500'
        : confidence >= 50
          ? 'bg-yellow-500'
          : 'bg-red-500';

  const priorityBadge = priority ? PRIORITY_BADGE[priority] : null;

  return (
    <div
      data-testid="cdss-advice-card"
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${color}`}>{label}</span>
          {priorityBadge && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityBadge.chip}`}
            >
              <span aria-hidden>{priorityBadge.dot}</span>
              {priorityBadge.label}
            </span>
          )}
          {source && (
            <span className="text-[11px] text-gray-400 truncate">{source}</span>
          )}
        </div>
        {/* Confidence */}
        {confidence !== null && (
          <div className="flex items-center gap-2 shrink-0">
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
      <p className="text-sm text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap break-words">
        {content}
      </p>

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
