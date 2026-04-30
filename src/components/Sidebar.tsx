import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { getNotifications } from '../api/notification';

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

const DOCTOR_NAV: NavItem[] = [
  { label: '病患列表', to: '/doctor/patients', icon: '👥' },
];

const CM_NAV: NavItem[] = [
  { label: '個案管理', to: '/casemanager/patients', icon: '👥' },
  { label: 'KPI 儀表板', to: '/casemanager/dashboard', icon: '📊' },
];

const ADMIN_NAV: NavItem[] = [
  { label: '個案管理', to: '/casemanager/patients', icon: '👥' },
  { label: 'KPI 儀表板', to: '/casemanager/dashboard', icon: '📊' },
  { label: '病患列表（醫師）', to: '/doctor/patients', icon: '🩺' },
  { label: '警示規則', to: '/admin/alert-rules', icon: '🚨' },
  { label: '藥品基本檔', to: '/admin/med-master', icon: '💊' },
  { label: '配方主檔', to: '/admin/formula-master', icon: '🧪' },
  { label: '配方組合', to: '/admin/formula-combos', icon: '🔗' },
  { label: '回饋審核', to: '/admin/feedback-review', icon: '🧠' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps = {}) {
  const { username, isDoctor, isCaseManager, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 60_000,
  });

  const unreadCount = notifications?.filter((n) => n.status !== 'READ').length ?? 0;

  const navItems = isAdmin ? ADMIN_NAV : isDoctor ? DOCTOR_NAV : isCaseManager ? CM_NAV : [];
  const roleLabel = isAdmin ? '管理員' : isDoctor ? '醫師' : isCaseManager ? '個管師' : '使用者';

  return (
    <>
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-screen w-60 bg-primary-800 text-white flex flex-col z-50 transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
      {/* Logo */}
      <div className="p-6 border-b border-primary-700">
        <h1 className="text-xl font-bold tracking-wide">AMI 照護平台</h1>
        <p className="text-primary-300 text-sm mt-1">臨床決策支援系統</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-primary-700 border-r-4 border-white font-semibold'
                  : 'hover:bg-primary-700/50'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Notification Bell */}
      <div className="px-4 pb-2">
        <button
          onClick={() => navigate('/notifications')}
          className="relative flex items-center gap-3 w-full px-2 py-2 text-sm rounded-lg hover:bg-primary-700/50 transition-colors"
          aria-label={`通知${unreadCount > 0 ? `，${unreadCount} 則未讀` : ''}`}
        >
          <span className="text-lg" role="img" aria-hidden="true">&#x1F514;</span>
          <span>通知</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 left-5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-primary-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold">
            {username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{username}</p>
            <p className="text-xs text-primary-300">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full text-sm text-primary-300 hover:text-white transition-colors text-left"
        >
          登出
        </button>
      </div>
      </aside>
    </>
  );
}
