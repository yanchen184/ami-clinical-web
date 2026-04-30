import { useNavigate } from 'react-router-dom';
import RiskBadge from './RiskBadge';
import type { Patient } from '../types';

interface PatientCardProps {
  patient: Patient;
  basePath: string;
  showReportDate?: boolean;
  onNotify?: (patient: Patient) => void;
}

export default function PatientCard({
  patient,
  basePath,
  showReportDate = false,
  onNotify,
}: PatientCardProps) {
  const navigate = useNavigate();

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
