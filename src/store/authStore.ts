import { create } from 'zustand';
import type { JwtPayload, Role } from '../types';

interface AuthState {
  token: string | null;
  username: string | null;
  roles: Role[];
  isAuthenticated: boolean;
  setAuth: (token: string, username: string, roles: Role[]) => void;
  logout: () => void;
}

const parseJwt = (token: string): JwtPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload) as JwtPayload;
  } catch {
    return null;
  }
};

const getInitialState = (): Pick<AuthState, 'token' | 'username' | 'roles' | 'isAuthenticated'> => {
  const token = localStorage.getItem('token');
  if (!token) {
    return { token: null, username: null, roles: [], isAuthenticated: false };
  }

  const payload = parseJwt(token);
  if (!payload || payload.exp * 1000 < Date.now()) {
    localStorage.removeItem('token');
    return { token: null, username: null, roles: [], isAuthenticated: false };
  }

  return {
    token,
    username: payload.sub,
    roles: payload.roles ?? [],
    isAuthenticated: true,
  };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),

  setAuth: (token, username, roles) => {
    localStorage.setItem('token', token);
    set({ token, username, roles, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, username: null, roles: [], isAuthenticated: false });
  },
}));
