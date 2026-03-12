'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '../api';

const AuthContext = createContext();

const PUBLIC_PATHS = ['/login', '/register'];

const ROLE_RESTRICTIONS = {
  '/check':   ['admin', 'investigator'],
  '/upload':  ['admin', 'investigator'],
  '/audit':   ['admin', 'monitor', 'regulator'],
  '/results': ['admin', 'investigator', 'monitor', 'regulator'],
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const router   = useRouter();
  const pathname = usePathname();

  // ── Logout ────────────────────────────────────────────────────
  const logout = useCallback((expired = false) => {
    sessionStorage.removeItem('clinicalguard_token');
    sessionStorage.removeItem('clinicalguard_user');
    if (expired) sessionStorage.setItem('clinicalguard_session_expired', 'true');
    setUser(null);
    window.location.href = '/login';
  }, []);

  // ── Restore session from sessionStorage (set by login page) ───
  useEffect(() => {
    const restore = async () => {
      const token    = sessionStorage.getItem('clinicalguard_token');
      const userJson = sessionStorage.getItem('clinicalguard_user');

      if (token && userJson) {
        try {
          const userData = JSON.parse(userJson);
          setUser(userData);
        } catch {
          sessionStorage.removeItem('clinicalguard_token');
          sessionStorage.removeItem('clinicalguard_user');
        }
      }
      setLoading(false);
    };
    restore();
  }, []);

  // ── 401 interceptor (mid-session only) ────────────────────────
  useEffect(() => {
    const id = api.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401) {
          const token = sessionStorage.getItem('clinicalguard_token');
          if (token) logout(true); // token exists but server rejected = expired
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [logout]);

  // ── Route guard ───────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

    if (!user && !isPublic) {
      router.push('/login');
      return;
    }
    if (user) {
      for (const [route, allowed] of Object.entries(ROLE_RESTRICTIONS)) {
        if (pathname.startsWith(route) && !allowed.includes(user.role)) {
          router.push('/dashboard');
          return;
        }
      }
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
