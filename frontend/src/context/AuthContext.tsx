"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { message } from 'antd';
import { ENV } from '@/config';
import { AuthService } from '@/services/auth.service';
import { apiClient } from '@/lib/axios';

export interface User {
  sub: number;
  email: string;
  fullName?: string;
  roles: string[];
  permissions?: string[];
  companyId?: number;
  branchId?: number;
  tenantId?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, userData: User, refreshTokenStr?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    // Check for token via AuthService SSOT on mount
    const checkAuth = () => {
      const token = AuthService.getAccessToken();
      const storedUser = AuthService.getUser();

      if (token && token !== 'undefined' && storedUser) {
        try {
          const parsedUser = storedUser as User;
          
          // Ensure default permissions exist for marketing role if missing from old cache
          if (parsedUser.roles && parsedUser.roles.includes('MARKETING') && (!parsedUser.permissions || parsedUser.permissions.length === 0)) {
            parsedUser.permissions = ['customer.view', 'customer.create', 'customer.edit', 'tender.view', 'tender.create', 'tender.edit', 'tender.negotiate', 'proposal.view', 'proposal.download'];
          }
          
          // Validate structure to prevent issues with old cached data
          if (!parsedUser.roles || !Array.isArray(parsedUser.roles)) {
            throw new Error('Invalid user structure, forcing re-login');
          }
          
          setUser(parsedUser);
          setIsAuthenticated(true);
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } catch (e) {
          AuthService.clearSession();
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // 1. Silent Auto-Refresh Interval & User Activity Tracker
  useEffect(() => {
    if (!isAuthenticated) return;

    let lastActivity = Date.now();
    const updateActivity = () => { lastActivity = Date.now(); };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    // Proactive Silent Refresh every 13 minutes (780,000 ms) via AuthService SSOT
    const refreshInterval = setInterval(async () => {
      const isIdle = Date.now() - lastActivity > 30 * 60 * 1000; // 30 mins idle
      if (isIdle) {
        console.log('🔒 User is idle for > 30 mins, pausing silent auto-refresh.');
        return;
      }

      try {
        const { accessToken } = await AuthService.refreshSession();
        if (accessToken) {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          console.log('⚡ Access Token refreshed silently in background via AuthService (Every 13m).');
        }
      } catch (err) {
        console.warn('Silent auto-refresh failed:', err);
      }
    }, 13 * 60 * 1000);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [isAuthenticated]);

  // 2. Global apiClient Interceptor for 401 Auto-Retry with Token Rotation
  useEffect(() => {
    let isRefreshing = false;
    let failedQueue: any[] = [];

    const processQueue = (error: any, token: string | null = null) => {
      failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token);
      });
      failedQueue = [];
    };

    const interceptor = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            }).then(token => {
              originalRequest.headers['Authorization'] = 'Bearer ' + token;
              return apiClient(originalRequest);
            }).catch(err => Promise.reject(err));
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            const { accessToken } = await AuthService.refreshSession();
            if (accessToken) {
              apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
              originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
              
              processQueue(null, accessToken);
              isRefreshing = false;
              return apiClient(originalRequest); // Retry original request seamlessly!
            }
          } catch (refreshErr) {
            processQueue(refreshErr, null);
            isRefreshing = false;
            
            if (isAuthenticated) {
              message.error('Sesi Anda telah berakhir, silakan login kembali.');
              AuthService.clearSession();
              setUser(null);
              setIsAuthenticated(false);
              delete apiClient.defaults.headers.common['Authorization'];
              router.push('/login');
            }
            return Promise.reject(refreshErr);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      apiClient.interceptors.response.eject(interceptor);
    };
  }, [router, isAuthenticated]);

  const login = (token: string, userData: User, refreshTokenStr?: string) => {
    AuthService.setSession(token, userData, refreshTokenStr);
    setUser(userData);
    setIsAuthenticated(true);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const logout = () => {
    AuthService.clearSession();
    setUser(null);
    setIsAuthenticated(false);
    delete apiClient.defaults.headers.common['Authorization'];
    message.success('Berhasil logout');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
