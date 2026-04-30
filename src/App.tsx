import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { getHomeRoute } from './hooks/useAuth';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DoctorPatientListPage from './pages/doctor/PatientListPage';
import DoctorPatientDetailPage from './pages/doctor/PatientDetailPage';
import CMPatientListPage from './pages/casemanager/PatientListPage';
import CMPatientDetailPage from './pages/casemanager/PatientDetailPage';
import CMDashboardPage from './pages/casemanager/DashboardPage';
import NotificationPage from './pages/NotificationPage';
import AlertRulePage from './pages/admin/AlertRulePage';
import MedMasterPage from './pages/admin/MedMasterPage';
import FormulaMasterPage from './pages/admin/FormulaMasterPage';
import FormulaComboPage from './pages/admin/FormulaComboPage';
import RulebaseDemoPage from './pages/RulebaseDemoPage';
import type { Role } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/** Route guard: redirects unauthenticated users to /login */
function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { isAuthenticated, roles } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.some((r) => roles.includes(r))) {
    const home = getHomeRoute(roles);
    return <Navigate to={home} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-60 p-8">
        <Outlet />
      </main>
    </div>
  );
}

/** Redirect authenticated users away from login */
function PublicRoute() {
  const { isAuthenticated, roles } = useAuthStore();

  if (isAuthenticated) {
    const home = getHomeRoute(roles);
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Common Authenticated Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/notifications" element={<NotificationPage />} />
            <Route path="/rulebase-demo" element={<RulebaseDemoPage />} />
          </Route>

          {/* Doctor Routes */}
          <Route element={<ProtectedRoute allowedRoles={['ROLE_DOCTOR', 'ROLE_ADMIN']} />}>
            <Route path="/doctor/patients" element={<DoctorPatientListPage />} />
            <Route path="/doctor/patients/:id" element={<DoctorPatientDetailPage />} />
          </Route>

          {/* Case Manager Routes */}
          <Route element={<ProtectedRoute allowedRoles={['ROLE_CASE_MANAGER', 'ROLE_ADMIN']} />}>
            <Route path="/casemanager/patients" element={<CMPatientListPage />} />
            <Route path="/casemanager/patients/:id" element={<CMPatientDetailPage />} />
            <Route path="/casemanager/dashboard" element={<CMDashboardPage />} />
          </Route>

          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['ROLE_ADMIN']} />}>
            <Route path="/admin/alert-rules" element={<AlertRulePage />} />
            <Route path="/admin/med-master" element={<MedMasterPage />} />
            <Route path="/admin/formula-master" element={<FormulaMasterPage />} />
            <Route path="/admin/formula-combos" element={<FormulaComboPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
