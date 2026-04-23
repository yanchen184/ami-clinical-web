import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFormulaCombos } from '../../api/formula';
import PageHeader from '../../components/PageHeader';

export default function FormulaComboPage() {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [minReduction, setMinReduction] = useState('');
  const [maxReduction, setMaxReduction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['formula-combos', page, keyword, minReduction, maxReduction],
    queryFn: () =>
      getFormulaCombos({
        keyword: keyword || undefined,
        page,
        minReduction: minReduction ? Number(minReduction) : undefined,
        maxReduction: maxReduction ? Number(maxReduction) : undefined,
      }),
  });

  return (
    <div>
      <PageHeader
        title="配方組合查詢"
        subtitle="查詢 2-3 個配方組合的 LDL-C 降低率"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
          placeholder="搜尋配方名稱..."
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-60"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={minReduction}
            onChange={(e) => { setMinReduction(e.target.value); setPage(0); }}
            placeholder="最小降幅 %"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-32"
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="number"
            value={maxReduction}
            onChange={(e) => { setMaxReduction(e.target.value); setPage(0); }}
            placeholder="最大降幅 %"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-32"
          />
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">載入中...</div>}

      {data && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs text-gray-500 text-left">
                <th className="py-3 px-4 font-medium">配方 A</th>
                <th className="py-3 px-4 font-medium">配方 B</th>
                <th className="py-3 px-4 font-medium">配方 C（選）</th>
                <th className="py-3 px-4 text-center font-medium">組合降幅</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((combo) => (
                <tr key={combo.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{combo.formulaAName}</td>
                  <td className="py-3 px-4 text-gray-900">{combo.formulaBName}</td>
                  <td className="py-3 px-4 text-gray-500">{combo.formulaCName ?? '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        combo.combinedLdlReductionPct >= 50
                          ? 'bg-green-100 text-green-700'
                          : combo.combinedLdlReductionPct >= 30
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      ↓ {combo.combinedLdlReductionPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.content.length === 0 && (
            <div className="text-center py-12 text-gray-400">無符合條件的配方組合</div>
          )}

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
              >
                上一頁
              </button>
              <span className="text-sm text-gray-500">{page + 1} / {data.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages - 1, p + 1))}
                disabled={page >= data.totalPages - 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
              >
                下一頁
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
