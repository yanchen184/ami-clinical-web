import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFollowUpEvents,
  createFollowUpEvent,
  updateFollowUpEvent,
  deleteFollowUpEvent,
} from '../../../api/followUp';
import type { FollowUpEvent, FollowUpType } from '../../../types';

const FOLLOW_UP_TYPES: { value: FollowUpType; label: string; color: string }[] = [
  { value: 'PHONE', label: '電話追蹤', color: 'bg-blue-100 text-blue-700' },
  { value: 'CLINIC', label: '門診回診', color: 'bg-green-100 text-green-700' },
  { value: 'EDUCATION', label: '衛教', color: 'bg-purple-100 text-purple-700' },
  { value: 'LAB', label: '抽血/檢查', color: 'bg-orange-100 text-orange-700' },
];

function getTypeConfig(type: FollowUpType) {
  return FOLLOW_UP_TYPES.find((t) => t.value === type) ?? FOLLOW_UP_TYPES[0];
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CalendarTab() {
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<FollowUpEvent | null>(null);
  const [form, setForm] = useState({
    patientId: '',
    type: 'PHONE' as FollowUpType,
    scheduledAt: '',
    note: '',
  });

  const weekDays = getWeekDays(currentWeek);
  const startDate = toLocalDateString(weekDays[0]);
  const endDate = toLocalDateString(weekDays[6]);

  const { data: events, isLoading } = useQuery({
    queryKey: ['follow-up-events', startDate, endDate],
    queryFn: () => getFollowUpEvents({ start: startDate, end: endDate }),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['follow-up-events'] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: createFollowUpEvent,
    onSuccess: () => { invalidate(); setShowForm(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof form> }) =>
      updateFollowUpEvent(id, data),
    onSuccess: () => { invalidate(); setEditEvent(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFollowUpEvent,
    onSuccess: invalidate,
  });

  function resetForm() {
    setForm({ patientId: '', type: 'PHONE', scheduledAt: '', note: '' });
  }

  function openCreate(dateStr?: string) {
    setEditEvent(null);
    setForm({ patientId: '', type: 'PHONE', scheduledAt: dateStr ? `${dateStr}T09:00` : '', note: '' });
    setShowForm(true);
  }

  function openEdit(ev: FollowUpEvent) {
    setShowForm(false);
    setEditEvent(ev);
    setForm({
      patientId: ev.patientId,
      type: ev.type,
      scheduledAt: ev.scheduledAt.slice(0, 16),
      note: ev.note ?? '',
    });
  }

  function handleSubmit() {
    if (!form.patientId || !form.scheduledAt) return;
    if (editEvent) {
      updateMutation.mutate({ id: editEvent.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const eventsForDay = (day: Date) => {
    const dayStr = toLocalDateString(day);
    return (events ?? []).filter((e) => e.scheduledAt.startsWith(dayStr));
  };

  return (
    <div>
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentWeek((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          ← 上週
        </button>
        <span className="text-sm font-medium text-gray-700">
          {startDate} ～ {endDate}
        </span>
        <button
          onClick={() => setCurrentWeek((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          下週 →
        </button>
      </div>

      {/* Week Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">載入中...</div>
      ) : (
        <div className="grid grid-cols-7 gap-2 mb-6">
          {weekDays.map((day) => {
            const dayStr = toLocalDateString(day);
            const dayEvents = eventsForDay(day);
            const isToday = dayStr === toLocalDateString(new Date());
            return (
              <div key={dayStr} className={`min-h-[120px] rounded-xl border p-2 ${isToday ? 'border-primary-400 bg-primary-50' : 'border-gray-100 bg-white'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${isToday ? 'text-primary-700' : 'text-gray-500'}`}>
                    {['一', '二', '三', '四', '五', '六', '日'][day.getDay() === 0 ? 6 : day.getDay() - 1]}
                    {' '}
                    {day.getDate()}
                  </span>
                  <button
                    onClick={() => openCreate(`${dayStr}`)}
                    className="text-gray-400 hover:text-primary-600 text-sm leading-none"
                    title="新增追蹤"
                  >
                    +
                  </button>
                </div>
                <div className="space-y-1">
                  {dayEvents.map((ev) => {
                    const cfg = getTypeConfig(ev.type);
                    return (
                      <button
                        key={ev.id}
                        onClick={() => openEdit(ev)}
                        className={`w-full text-left px-1.5 py-1 rounded text-xs ${cfg.color} truncate`}
                        title={`${ev.patientName} - ${cfg.label}`}
                      >
                        {ev.scheduledAt.slice(11, 16)} {ev.patientName}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Button */}
      <div className="mb-4">
        <button
          onClick={() => openCreate()}
          className="px-4 py-2 bg-primary-800 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
        >
          + 新增追蹤事件
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showForm || editEvent) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4">
            {editEvent ? '編輯追蹤事件' : '新增追蹤事件'}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">病患 ID</label>
              <input
                type="text"
                value={form.patientId}
                onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="請輸入病患 ID"
                readOnly={!!editEvent}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">追蹤類型</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FollowUpType }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {FOLLOW_UP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">時間</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">備註</label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="備註說明（選填）"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-5 py-2 bg-primary-800 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? '儲存中...' : '儲存'}
            </button>
            {editEvent && (
              <button
                onClick={() => {
                  if (window.confirm('確定要刪除此追蹤事件？')) {
                    deleteMutation.mutate(editEvent.id);
                    setEditEvent(null);
                  }
                }}
                className="px-5 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200"
              >
                刪除
              </button>
            )}
            <button
              onClick={() => { setShowForm(false); setEditEvent(null); }}
              className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
