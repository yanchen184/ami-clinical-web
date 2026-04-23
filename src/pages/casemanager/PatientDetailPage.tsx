import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPatient, getPatientMeasurements } from '../../api/patient';
import { getCaseNotes, createCaseNote } from '../../api/caseNote';
import PageHeader from '../../components/PageHeader';
import RiskBadge from '../../components/RiskBadge';
import MeasurementChart from '../../components/MeasurementChart';

export default function CMPatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const patientId = id ?? '';

  const [newNote, setNewNote] = useState('');

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient(patientId),
  });

  const { data: measurements } = useQuery({
    queryKey: ['patient-measurements', patientId],
    queryFn: () => getPatientMeasurements(patientId, 'BLOOD_PRESSURE'),
  });

  const { data: notes } = useQuery({
    queryKey: ['case-notes', patientId],
    queryFn: () => getCaseNotes(patientId),
  });

  const createNoteMutation = useMutation({
    mutationFn: (content: string) => createCaseNote(patientId, content),
    onSuccess: () => {
      setNewNote('');
      queryClient.invalidateQueries({ queryKey: ['case-notes', patientId] });
    },
  });

  const handleAddNote = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    createNoteMutation.mutate(trimmed);
  };

  if (isLoading) {
    return <div className="text-center py-12 text-gray-400">載入中...</div>;
  }

  if (!patient) {
    return <div className="text-center py-12 text-red-500">找不到個案資料</div>;
  }

  return (
    <div>
      <PageHeader
        title={patient.name}
        actions={
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            返回列表
          </button>
        }
      />

      {/* Patient Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center text-xl font-bold">
            {patient.name.charAt(0)}
          </div>
          <div className="flex-1 grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400">姓名</p>
              <p className="text-sm font-medium">{patient.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">年齡 / 性別</p>
              <p className="text-sm font-medium">
                {patient.age != null ? `${patient.age} 歲` : '-'} / {patient.gender === 'M' ? '男' : '女'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">AMI 發病日期</p>
              <p className="text-sm font-medium">
                {patient.amiOnsetDate
                  ? new Date(patient.amiOnsetDate).toLocaleDateString('zh-TW')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">風險等級</p>
              <RiskBadge level={patient.riskLevel} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Measurement Chart */}
        <div className="col-span-2">
          <MeasurementChart measurements={measurements ?? []} />
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">個案概況</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">最後回診</span>
              <span className="font-medium">
                {patient.lastVisitDate
                  ? new Date(patient.lastVisitDate).toLocaleDateString('zh-TW')
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">最後填報</span>
              <span className="font-medium">
                {patient.lastReportDate
                  ? new Date(patient.lastReportDate).toLocaleDateString('zh-TW')
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">個案紀錄</span>
              <span className="font-medium">{notes?.length ?? 0} 筆</span>
            </div>
          </div>
        </div>
      </div>

      {/* Case Notes */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">個案紀錄</h3>

        {/* Add Note */}
        <div className="flex gap-3 mb-6">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            placeholder="新增個案紀錄..."
          />
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim() || createNoteMutation.isPending}
            className="px-6 py-2 bg-primary-800 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 self-end"
          >
            {createNoteMutation.isPending ? '新增中...' : '新增'}
          </button>
        </div>

        {createNoteMutation.isError && (
          <p className="text-sm text-red-500 mb-4">新增失敗，請重試</p>
        )}

        {/* Notes List */}
        <div className="space-y-3">
          {notes?.map((note) => (
            <div key={note.id} className="border border-gray-100 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">{note.content}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{note.createdBy}</span>
                <span>{new Date(note.createdAt).toLocaleString('zh-TW')}</span>
              </div>
            </div>
          ))}
          {(!notes || notes.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-4">尚無紀錄</p>
          )}
        </div>
      </div>
    </div>
  );
}
