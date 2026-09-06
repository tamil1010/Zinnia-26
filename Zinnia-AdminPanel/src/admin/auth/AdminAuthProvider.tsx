import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser, AdminError } from '../types';
import { adminFetch, ADMIN_TOKEN_KEY } from './adminFetch';

interface AdminAuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AdminUser>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await adminFetch<{ success: boolean; user: AdminUser }>('/api/admin/me');
        if (res && res.user) {
          setUser(res.user);
        } else {
          sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        }
      } catch (err) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();

    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('zin26:admin-unauthorised', handleUnauthorized);
    return () => {
      window.removeEventListener('zin26:admin-unauthorised', handleUnauthorized);
    };
  }, []);

  const login = async (username: string, password: string): Promise<AdminUser> => {
    const res = await adminFetch<{ success: boolean; token: string; user: AdminUser }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (res.token && res.user) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, res.token);
      setUser(res.user);
      return res.user;
    }

    throw new AdminError('Authentication response was invalid.');
  };

  const logout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setUser(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    return {
      user: null,
      loading: true,
      login: async () => { throw new Error('Auth provider not initialized'); },
      logout: () => {},
      isAuthenticated: false,
    };
  }
  return context;
};
