'use client';

import type { AuthResponse, LoginRequest, Role, UserDto } from '@oj/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, UNAUTHORIZED_EVENT } from './api';

interface AuthContextValue {
  user: UserDto | null;
  loading: boolean;
  login: (body: LoginRequest) => Promise<UserDto>;
  /** Store the token from any endpoint that returns AuthResponse (verify, reset, accept invitation). */
  signIn: (res: AuthResponse) => UserDto;
  logout: () => void;
  isStaff: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function isStaffRole(role: Role | undefined | null) {
  return role === 'ADMIN' || role === 'TEACHER';
}

export const RoleLabels: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  TEACHER: 'Giáo viên',
  STUDENT: 'Học sinh',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        // Invalid/expired token (or backend down): treat as logged out.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (body: LoginRequest) => {
    const res = await api.login(body);
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const signIn = useCallback((res: AuthResponse) => {
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      signIn,
      logout,
      isStaff: isStaffRole(user?.role),
      isAdmin: user?.role === 'ADMIN',
    }),
    [user, loading, login, signIn, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
