import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFeedbackReviewList,
  triggerFeedbackSync,
  getFeedbackStats,
  type FeedbackReviewItem,
} from '../../api/adminFeedback';
import PageHeader from '../../components/PageHeader';

function ratingBadge(rating: number) {
  if (rating <= 1) return { label: '👎 強烈反對', cls: 'bg-red-100 text-red-800 border-red-200' };
  if (rating === 2) return { label: '👎 不認同', cls: 'bg-orange-100 text-orange-800 border-orange-200' };
  return { label: `★ ${rating}`, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
}

function FeedbackRow({ item }: { item: FeedbackReviewItem }) {
  const badge = ratingBadge(item.rating);
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4">
        <p className="text-sm font-medium text-gray-900">{item.patientName}</p>
        <p className="text-xs text-gray-400 font-mono">{item.patientId.slice(0, 8)}…</p>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badge.cls}`}
        >
          {badge.label}
        </span>
      </td>
      <td className="py-3 px-4">
        <p className="text-sm text-gray-700 line-clamp-3 max-w-md">
          {item.comment || <span className="text-gray-400">（無修正內容）</span>}
        </p>
      </td>
      <td className="py-3 px-4 text-xs text-gray-500">
        {new Date(item.createdAt).toLocaleString('zh-TW')}
      </td>
      <td className="py-3 px-4">
        {item.aiSummaryId && (
          <span className="text-xs font-mono text-gray-400" title={item.aiSummaryId}>
            #{item.aiSummaryId.slice(0, 8)}
          </span>
        )}
      </td>
    </tr>
  );
}

export default function FeedbackReviewPage() {
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-feedback-review', page],
    queryFn: () => getFeedbackReviewList(page, 20),
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-feedback-stats'],
    queryFn: getFeedbackStats,
    refetchInterval: 30_000,
  });

  const syncMutation = useMutation({
    mutationFn: triggerFeedbackSync,
    onSuccess: (r) => {
      setSyncResult(
        `處理 ${r.processed} 筆 · 進化 SKILL ${r.evolve_skill} · 寫範例 ${r.write_example} · 待補種 ${r.needs_seed} · 略過 ${r.ignored}`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin-feedback-review'] });
      queryClient.invalidateQueries({ queryKey: ['admin-feedback-stats'] });
      setTimeout(() => setSyncResult(null), 8000);
    },
    onError: (err) => {
      setSyncResult(`❌ 同步失敗：${(err as Error).message}`);
    },
  });

  return (
    <div>
      <PageHeader
        title="醫師回饋審核"
        subtitle="集中檢視負面 / 修正類回饋，確認後送回 AI 服務驅動 SKILL 進化"
        actions={
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="rounded-lg bg-primary-800 px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary-700 disabled:opacity-50"
          >
            {syncMutation.isPending ? '同步中…' : '🔄 觸發 Skill 同步'}
          </button>
        }
      />

      {/* 統計卡 */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">待審核回饋</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {stats?.pendingCount ?? '—'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            rating ≤ {stats?.threshold ?? 2}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">本頁顯示</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data?.content.length ?? 0} / {data?.totalElements ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">同步狀態</p>
          <p className="mt-1 text-sm font-medium text-gray-700">
            {syncResult ?? '尚未本次同步'}
          </p>
        </div>
      </div>

      {/* 表格 */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 py-3 px-4">病患</th>
              <th className="text-left text-xs font-semibold text-gray-500 py-3 px-4">評等</th>
              <th className="text-left text-xs font-semibold text-gray-500 py-3 px-4">修正內容</th>
              <th className="text-left text-xs font-semibold text-gray-500 py-3 px-4">時間</th>
              <th className="text-left text-xs font-semibold text-gray-500 py-3 px-4">
                AI Summary
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                  載入中…
                </td>
              </tr>
            )}
            {!isLoading && (data?.content.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                  目前沒有需要審核的回饋
                </td>
              </tr>
            )}
            {data?.content.map((item) => (
              <FeedbackRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            ← 上一頁
          </button>
          <span className="text-sm text-gray-500">
            {page + 1} / {data.totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setPage((p) => Math.min((data.totalPages ?? 1) - 1, p + 1))
            }
            disabled={page >= data.totalPages - 1}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            下一頁 →
          </button>
        </div>
      )}
    </div>
  );
}
