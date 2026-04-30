import { useNavigate } from 'react-router-dom';
import RiskBadge from './RiskBadge';
import type { Patient } from '../types';

interface PatientCardProps {
  patient: Patient;
  basePath: string;
  showReportDate?: boolean;
  onNotify?: (patient: Patient) => void;
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '從未分析';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '時間異常';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-TW');
}

export default function PatientCard({
  patient,
  basePath,
  showReportDate = false,
  onNotify,
}: PatientCardProps) {
  const navigate = useNavigate();
  const briefing = patient.aiBriefing;
  const todos = briefing?.pendingTodos ?? [];

  return (
    <div
      onClick={() => navigate(`${basePath}/${patient.id}`)}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{patient.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {patient.gender === 'MALE' || patient.gender === 'M' ? '男' : patient.gender === 'FEMALE' || patient.gender === 'F' ? '女' : '-'} / {patient.age != null ? `${patient.age} 歲` : '-'}
          </p>
        </div>
        <RiskBadge level={patient.riskLevel} />
      </div>

      {/* Lv.1-A: rulebase 衍生待辦事項 badge */}
      {todos.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {todos.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200"
              title={t}
            >
              <span aria-hidden>⚠️</span>
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-1 text-sm text-gray-500">
        <p>
          最後回診：
          {patient.lastVisitDate
            ? new Date(patient.lastVisitDate).toLocaleDateString('zh-TW')
            : '無紀錄'}
        </p>
        {showReportDate && (
          <p>
            最後填報：
            {patient.lastReportDate
              ? new Date(patient.lastReportDate).toLocaleDateString('zh-TW')
              : '無紀錄'}
          </p>
        )}
      </div>

      {/* Lv.1-B: 上次 AI 分析摘要 */}
      <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
        <div className="flex items-baseline gap-2">
          <span className="text-gray-400 shrink-0">🧠 上次分析：</span>
          <span className="text-gray-700 font-medium">
            {formatRelativeTime(briefing?.lastAnalyzedAt)}
          </span>
        </div>
        {briefing?.summaryShort && (
          <p className="mt-1 text-gray-600 line-clamp-2">{briefing.summaryShort}</p>
        )}
      </div>

      {onNotify && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNotify(patient);
          }}
          className="mt-3 text-xs text-primary-600 hover:text-primary-800 font-medium"
        >
          推播通知
        </button>
      )}
    </div>
  );
}
