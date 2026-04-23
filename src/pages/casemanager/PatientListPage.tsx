import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import MyPatientsTab from './tabs/MyPatientsTab';
import RedAlertsTab from './tabs/RedAlertsTab';
import CalendarTab from './tabs/CalendarTab';

type Tab = 'patients' | 'alerts' | 'calendar';

const TABS: { key: Tab; label: string }[] = [
  { key: 'patients', label: '我的個案' },
  { key: 'alerts', label: '🚨 紅燈警示' },
  { key: 'calendar', label: '追蹤行事曆' },
];

export default function CMPatientListPage() {
  const [tab, setTab] = useState<Tab>('patients');

  return (
    <div>
      <PageHeader title="個案管理" subtitle="管理您負責的 AMI 個案" />

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-primary-800 text-primary-800'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'patients' && <MyPatientsTab />}
      {tab === 'alerts' && <RedAlertsTab />}
      {tab === 'calendar' && <CalendarTab />}
    </div>
  );
}
