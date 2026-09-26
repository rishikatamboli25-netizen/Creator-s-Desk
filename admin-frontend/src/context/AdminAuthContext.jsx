import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AdminAuthContext = createContext(null);
const API_BASE = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5000/api/admin';

const readCookie = (name) => {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
};

const csrfHeader = () => {
  const token = readCookie('cd_admin_csrf');
  return token ? { 'X-CSRF-Token': token } : {};
};

const ensureCsrf = async () => {
  if (readCookie('cd_admin_csrf')) return;

  await fetch(`${API_BASE}/csrf`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider.');
  }
  return context;
};

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAdmin = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        setAdmin(null);
        return null;
      }

      const data = await response.json();
      setAdmin(data.admin || null);
      return data.admin || null;
    } catch (error) {
      console.error('[CD_ADMIN] Failed to load admin session:', error);
      setAdmin(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAdmin();
  }, [refreshAdmin]);

  const login = useCallback(async (email, password, otp = '') => {
    await ensureCsrf();

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...csrfHeader(),
      },
      body: JSON.stringify({ email, password, ...(otp ? { otp } : {}) }),
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      // Preserve the generic error when the backend is not JSON.
    }

    if (!response.ok) {
      const error = new Error(data.error || 'Unable to sign in.');
      error.status = response.status;
      error.mfaRequired = Boolean(data.mfaRequired);
      throw error;
    }

    setAdmin(data.admin || null);
    return data.admin || null;
  }, []);

  const logout = useCallback(async () => {
    try {
      await ensureCsrf();
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...csrfHeader(),
        },
      });
    } finally {
      setAdmin(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      admin,
      isLoading,
      isAuthenticated: Boolean(admin),
      login,
      logout,
      refreshAdmin,
    }),
    [admin, isLoading, login, logout, refreshAdmin]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
