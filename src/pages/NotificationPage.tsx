import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markAsRead } from '../api/notification';
import PageHeader from '../components/PageHeader';

export default function NotificationPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div>
      <PageHeader title="通知中心" subtitle="查看系統通知與提醒" />

      {isLoading && (
        <div className="text-center py-12 text-gray-400">載入中...</div>
      )}

      {isError && (
        <div className="text-center py-12 text-red-500">載入失敗，請重新整理</div>
      )}

      {notifications && notifications.length === 0 && (
        <div className="text-center py-12 text-gray-400">目前沒有通知</div>
      )}

      {notifications && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const isRead = notification.status === 'READ';
            return (
              <div
                key={notification.objid}
                className={`bg-white rounded-xl shadow-sm border p-5 transition-colors ${
                  isRead ? 'border-gray-100' : 'border-primary-200 bg-primary-50/30'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-sm font-semibold ${
                        isRead ? 'text-gray-700' : 'text-gray-900'
                      }`}
                    >
                      {notification.subject}
                    </h3>
                    {notification.content && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {notification.content}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(notification.createdDate).toLocaleString('zh-TW')}
                    </p>
                  </div>
                  {!isRead && (
                    <button
                      onClick={() => markReadMutation.mutate(notification.objid)}
                      disabled={markReadMutation.isPending}
                      className="shrink-0 px-3 py-1.5 text-xs text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-50"
                    >
                      標記已讀
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
