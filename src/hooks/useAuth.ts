import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { login as loginApi } from '../api/auth';
import type { Role } from '../types';

const getHomeRoute = (roles: Role[]): string => {
  if (roles.includes('ROLE_DOCTOR')) return '/doctor/patients';
  if (roles.includes('ROLE_CASE_MANAGER')) return '/casemanager/patients';
  if (roles.includes('ROLE_ADMIN')) return '/casemanager/dashboard';
  return '/login';
};

export const useAuth = () => {
  const { isAuthenticated, username, roles, setAuth, logout: storeLogout } = useAuthStore();
  const navigate = useNavigate();

  const login = useCallback(
    async (usernameInput: string, password: string) => {
      const response = await loginApi({ username: usernameInput, password });
      setAuth(response.accessToken, response.username, response.roles);
      const home = getHomeRoute(response.roles);
      navigate(home, { replace: true });
    },
    [setAuth, navigate],
  );

  const logout = useCallback(() => {
    storeLogout();
    navigate('/login', { replace: true });
  }, [storeLogout, navigate]);

  const isDoctor = roles.includes('ROLE_DOCTOR');
  const isCaseManager = roles.includes('ROLE_CASE_MANAGER');
  const isAdmin = roles.includes('ROLE_ADMIN');

  return { isAuthenticated, username, roles, isDoctor, isCaseManager, isAdmin, login, logout };
};

export { getHomeRoute };
