import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFormulas,
  createFormula,
  updateFormula,
  deleteFormula,
  addFormulaItem,
  deleteFormulaItem,
} from '../../api/formula';
import { getMedMasters } from '../../api/medMaster';
import PageHeader from '../../components/PageHeader';
import type { Formula, FormulaCategory, FormulaInsuranceType, FormulaRequest } from '../../types';

const CATEGORIES: { value: FormulaCategory; label: string }[] = [
  { value: 'STATIN', label: 'Statin 類' },
  { value: 'COMBINATION', label: '複合製劑' },
  { value: 'OTHER', label: '其他' },
];

const INSURANCE_TYPES: { value: FormulaInsuranceType; label: string }[] = [
  { value: 'NHI', label: '健保' },
  { value: 'SELF_PAY', label: '自費' },
];

const EMPTY_FORM: FormulaRequest = {
  name: '',
  ldlReductionPct: 30,
  category: 'STATIN',
  insuranceType: 'NHI',
};

export default function FormulaMasterPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Formula | null>(null);
  const [form, setForm] = useState<FormulaRequest>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newItemMedId, setNewItemMedId] = useState('');
  const [newItemDdd, setNewItemDdd] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['formulas', page, keyword],
    queryFn: () => getFormulas({ keyword, page }),
  });

  const { data: medMasters } = useQuery({
    queryKey: ['med-masters-all'],
    queryFn: () => getMedMasters({ size: 200 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['formulas'] });

  const createMut = useMutation({ mutationFn: createFormula, onSuccess: () => { invalidate(); setShowForm(false); setForm(EMPTY_FORM); } });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormulaRequest }) => updateFormula(id, data),
    onSuccess: () => { invalidate(); setShowForm(false); setEditing(null); },
  });
  const deleteMut = useMutation({ mutationFn: deleteFormula, onSuccess: invalidate });
  const addItemMut = useMutation({
    mutationFn: ({ formulaId, medMasterId, dddValue }: { formulaId: number; medMasterId: number; dddValue: number }) =>
      addFormulaItem(formulaId, { medMasterId, dddValue, priority: 0 }),
    onSuccess: () => { invalidate(); setNewItemMedId(''); setNewItemDdd(''); },
  });
  const deleteItemMut = useMutation({
    mutationFn: ({ formulaId, itemId }: { formulaId: number; itemId: number }) =>
      deleteFormulaItem(formulaId, itemId),
    onSuccess: invalidate,
  });

  function openEdit(f: Formula) {
    setEditing(f);
    setForm({ name: f.name, ldlReductionPct: f.ldlReductionPct, category: f.category, insuranceType: f.insuranceType });
    setShowForm(true);
  }

  function handleSubmit() {
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  }

  return (
    <div>
      <PageHeader
        title="配方主檔"
        subtitle="管理 LDL-C 降低方案配方"
        actions={
          <button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }}
            className="px-4 py-2 bg-primary-800 text-white text-sm rounded-lg hover:bg-primary-700">
            + 新增配方
          </button>
        }
      />

      <div className="mb-4">
        <input type="text" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
          placeholder="搜尋配方名稱..." className="w-full md:w-80 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">載入中...</div>}

      {data && (
        <div className="space-y-3">
          {data.content.map((formula) => (
            <div key={formula.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Formula Header */}
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{formula.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {CATEGORIES.find(c => c.value === formula.category)?.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {INSURANCE_TYPES.find(t => t.value === formula.insuranceType)?.label}
                    </span>
                    <span className="text-xs text-orange-600 font-medium">
                      LDL ↓ {formula.ldlReductionPct}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formula.items.length} 個藥品組成</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setExpandedId(expandedId === formula.id ? null : formula.id)}
                    className="text-xs text-primary-700 hover:underline">
                    {expandedId === formula.id ? '收合' : '展開'}
                  </button>
                  <button onClick={() => openEdit(formula)} className="text-xs text-gray-600 hover:underline">編輯</button>
                  <button onClick={() => { if (window.confirm(`刪除配方「${formula.name}」？`)) deleteMut.mutate(formula.id); }}
                    className="text-xs text-red-500 hover:underline">刪除</button>
                </div>
              </div>

              {/* Expanded Items */}
              {expandedId === formula.id && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  <table className="w-full text-xs mt-3">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left pb-2 font-medium">藥品名稱</th>
                        <th className="text-center pb-2 font-medium">DDD 值</th>
                        <th className="text-center pb-2 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formula.items.map((item) => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="py-2">{item.drugName}</td>
                          <td className="py-2 text-center">{item.dddValue}</td>
                          <td className="py-2 text-center">
                            <button
                              onClick={() => deleteItemMut.mutate({ formulaId: formula.id, itemId: item.id })}
                              className="text-red-400 hover:text-red-600"
                            >
                              移除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Add Item */}
                  <div className="flex items-center gap-2 mt-3">
                    <select
                      value={newItemMedId}
                      onChange={(e) => setNewItemMedId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                    >
                      <option value="">選擇藥品...</option>
                      {medMasters?.content.map((m) => (
                        <option key={m.id} value={m.id}>{m.drugName}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={newItemDdd}
                      onChange={(e) => setNewItemDdd(e.target.value)}
                      placeholder="DDD"
                      className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (!newItemMedId || !newItemDdd) return;
                        addItemMut.mutate({ formulaId: formula.id, medMasterId: Number(newItemMedId), dddValue: Number(newItemDdd) });
                      }}
                      className="px-3 py-1.5 text-xs bg-primary-800 text-white rounded-lg hover:bg-primary-700"
                    >
                      加入
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {data.content.length === 0 && (
            <div className="text-center py-12 text-gray-400">無配方資料</div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editing ? '編輯配方' : '新增配方'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">配方名稱 *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">LDL 降低率 (%) *</label>
                <input type="number" value={form.ldlReductionPct} onChange={(e) => setForm((f) => ({ ...f, ldlReductionPct: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">分類</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as FormulaCategory }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">給付類型</label>
                <select value={form.insuranceType} onChange={(e) => setForm((f) => ({ ...f, insuranceType: e.target.value as FormulaInsuranceType }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {INSURANCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSubmit} disabled={!form.name || createMut.isPending || updateMut.isPending}
                className="px-5 py-2 bg-primary-800 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50">
                儲存
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
