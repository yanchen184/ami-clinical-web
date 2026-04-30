import type { SoapSummary } from '../types';

interface SoapCardProps {
  summary: SoapSummary;
}

const SOAP_SECTIONS = [
  { key: 'subjective' as const, label: 'S - 主觀', color: 'border-blue-400', bg: 'bg-blue-50' },
  { key: 'objective' as const, label: 'O - 客觀', color: 'border-green-400', bg: 'bg-green-50' },
  { key: 'assessment' as const, label: 'A - 評估', color: 'border-yellow-400', bg: 'bg-yellow-50' },
  { key: 'plan' as const, label: 'P - 計畫', color: 'border-purple-400', bg: 'bg-purple-50' },
];

export default function SoapCard({ summary }: SoapCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Hermes SOAP 摘要</h3>
        <span className="text-xs text-gray-400">
          產生時間：{summary.generatedAt ? new Date(summary.generatedAt.endsWith('Z') ? summary.generatedAt : summary.generatedAt + 'Z').toLocaleString('zh-TW') : '—'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SOAP_SECTIONS.map((section) => (
          <div
            key={section.key}
            className={`border-l-4 ${section.color} ${section.bg} rounded-r-lg p-4`}
          >
            <h4 className="text-sm font-bold text-gray-700 mb-2">{section.label}</h4>
            <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
              {summary[section.key]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
