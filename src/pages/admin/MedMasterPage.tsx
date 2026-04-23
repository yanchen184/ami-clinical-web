import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMedMasters,
  createMedMaster,
  updateMedMaster,
  deleteMedMaster,
} from '../../api/medMaster';
import PageHeader from '../../components/PageHeader';
import type { MedMaster, MedMasterRequest } from '../../types';

const EMPTY_FORM: MedMasterRequest = {
  hospitalCode: '',
  drugName: '',
  genericName: '',
  nhiCode: '',
  atcCode: '',
  dosageForm: '',
  specification: '',
};

export default function MedMasterPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<MedMaster | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MedMasterRequest>(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ['med-masters', page, keyword],
    queryFn: () => getMedMasters({ keyword, page }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['med-masters'] });

  const createMut = useMutation({ mutationFn: createMedMaster, onSuccess: () => { invalidate(); closeForm(); } });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MedMasterRequest }) => updateMedMaster(id, data),
    onSuccess: () => { invalidate(); closeForm(); },
  });
  const deleteMut = useMutation({ mutationFn: deleteMedMaster, onSuccess: invalidate });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(med: MedMaster) {
    setEditing(med);
    setForm({
      hospitalCode: med.hospitalCode,
      drugName: med.drugName,
      genericName: med.genericName ?? '',
      nhiCode: med.nhiCode ?? '',
      atcCode: med.atcCode ?? '',
      dosageForm: med.dosageForm ?? '',
      specification: med.specification ?? '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  function handleSubmit() {
    const payload: MedMasterRequest = {
      hospitalCode: form.hospitalCode,
      drugName: form.drugName,
      genericName: form.genericName || undefined,
      nhiCode: form.nhiCode || undefined,
      atcCode: form.atcCode || undefined,
      dosageForm: form.dosageForm || undefined,
      specification: form.specification || undefined,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  return (
    <div>
      <PageHeader
        title="藥品基本檔"
        subtitle="管理院內藥品與學名藥對照"
        actions={
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-primary-800 text-white text-sm rounded-lg hover:bg-primary-700"
          >
            + 新增藥品
          </button>
        }
      />

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
          placeholder="搜尋藥品名稱或代碼..."
          className="w-full md:w-80 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading && <div className="text-center py-12 text-gray-400">載入中...</div>}
        {data && (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-xs text-gray-500 text-left">
                  <th className="py-3 px-4 font-medium">院內代碼</th>
                  <th className="py-3 px-4 font-medium">藥品名稱</th>
                  <th className="py-3 px-4 font-medium">學名</th>
                  <th className="py-3 px-4 font-medium">健保碼</th>
                  <th className="py-3 px-4 font-medium">ATC</th>
                  <th className="py-3 px-4 font-medium">劑型</th>
                  <th className="py-3 px-4 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((med) => (
                  <tr key={med.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-xs text-gray-600">{med.hospitalCode}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">{med.drugName}</td>
                    <td className="py-3 px-4 text-gray-600">{med.genericName ?? '-'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{med.nhiCode ?? '-'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{med.atcCode ?? '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{med.dosageForm ?? '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(med)}
                          className="text-xs text-primary-700 hover:underline"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`確定要刪除「${med.drugName}」？`))
                              deleteMut.mutate(med.id);
                          }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.content.length === 0 && (
              <div className="text-center py-12 text-gray-400">無符合條件的藥品</div>
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
          </>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editing ? '編輯藥品' : '新增藥品'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'hospitalCode', label: '院內代碼 *', required: true },
                { key: 'drugName', label: '藥品名稱 *', required: true },
                { key: 'genericName', label: '學名' },
                { key: 'nhiCode', label: '健保碼' },
                { key: 'atcCode', label: 'ATC 碼' },
                { key: 'dosageForm', label: '劑型' },
                { key: 'specification', label: '規格', },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key as keyof MedMasterRequest] ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmit}
                disabled={!form.hospitalCode || !form.drugName || createMut.isPending || updateMut.isPending}
                className="px-5 py-2 bg-primary-800 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                儲存
              </button>
              <button onClick={closeForm} className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
