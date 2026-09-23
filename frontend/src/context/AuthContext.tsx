"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { message } from 'antd';
import { AuthService } from '@/services/auth.service';
import { apiClient } from '@/lib/axios';
import { queryClient } from '../lib/queryClient';

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
  login: (token: string, userData: User) => void;
  logout: () => void;
  // Semantic Role Helpers
  isSuperAdmin: boolean;
  isProjectManager: boolean;
  isGeneralManager: boolean;
  isHeadOfOperations: boolean;
  isProcurement: boolean;
  isFinance: boolean;
  isDirector: boolean;
  canMakeManagementDecision: boolean;
  isPmOnly: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Multi-Tab Synchronization Channel
let authChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    authChannel = new BroadcastChannel('epms_auth_sync');
  } catch {
    // BroadcastChannel fallback
  }
}

// Global in-flight refresh promise & logout guard across components
let activeRefreshPromise: Promise<string> | null = null;
let isLoggedOut = false;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  // 1. Initial Session Verification & Recovery on Mount / Reload
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      isLoggedOut = false;
      const token = AuthService.getAccessToken();
      const storedUser = AuthService.getUser();

      // Case A: Valid unexpired token in storage
      if (token && storedUser && !AuthService.isTokenExpired(token)) {
        try {
          const parsedUser = storedUser as User;
          if (parsedUser.roles && parsedUser.roles.includes('MARKETING') && (!parsedUser.permissions || parsedUser.permissions.length === 0)) {
            parsedUser.permissions = ['customer.view', 'customer.create', 'customer.edit', 'tender.view', 'tender.create', 'tender.edit', 'tender.negotiate', 'proposal.view', 'proposal.download'];
          }
          if (!parsedUser.roles || !Array.isArray(parsedUser.roles)) {
            throw new Error('Invalid user structure');
          }
          if (isMounted) {
            setUser(parsedUser);
            setIsAuthenticated(true);
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            setIsLoading(false);
          }
          return;
        } catch {
          AuthService.clearSession();
        }
      }

      // Case B: Token expired or absent, attempt session recovery via HttpOnly Cookie
      try {
        const { accessToken, user: refreshedUser } = await AuthService.refreshSession();
        if (accessToken && isMounted && !isLoggedOut) {
          const effectiveUser = refreshedUser || storedUser;
          if (effectiveUser) {
            setUser(effectiveUser);
            setIsAuthenticated(true);
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
            authChannel?.postMessage({ type: 'AUTH_REFRESH_SUCCESS', accessToken, user: effectiveUser });
          }
        }
      } catch {
        // Refresh cookie missing, expired, or revoked
        AuthService.clearSession();
        if (isMounted) {
          setUser(null);
          setIsAuthenticated(false);
          delete apiClient.defaults.headers.common['Authorization'];
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Multi-Tab Auth Event Synchronization (BroadcastChannel + Storage Event Fallback)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBroadcast = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'AUTH_REFRESH_SUCCESS' && data.accessToken) {
        if (isLoggedOut) return;
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        AuthService.setAccessToken(data.accessToken);
        if (data.user) {
          setUser(data.user);
          AuthService.setUser(data.user);
        }
        setIsAuthenticated(true);
      } else if (data.type === 'AUTH_LOGOUT') {
        isLoggedOut = true;
        AuthService.clearSession();
        setUser(null);
        setIsAuthenticated(false);
        delete apiClient.defaults.headers.common['Authorization'];
        router.push('/login');
      }
    };

    authChannel?.addEventListener('message', handleBroadcast);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === 'epms_user') {
        if (!AuthService.getUser()) {
          isLoggedOut = true;
          setUser(null);
          setIsAuthenticated(false);
          delete apiClient.defaults.headers.common['Authorization'];
          router.push('/login');
        }
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      authChannel?.removeEventListener('message', handleBroadcast);
      window.removeEventListener('storage', handleStorage);
    };
  }, [router]);

  // 3. Silent Auto-Refresh Interval & User Activity Tracker
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
      if (isLoggedOut) return;
      const isIdle = Date.now() - lastActivity > 30 * 60 * 1000; // 30 mins idle
      if (isIdle) {
        console.log('User is idle for > 30 mins, pausing silent auto-refresh.');
        return;
      }

      try {
        const { accessToken } = await AuthService.refreshSession();
        if (accessToken && !isLoggedOut) {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          authChannel?.postMessage({ type: 'AUTH_REFRESH_SUCCESS', accessToken });
          console.log('Access Token refreshed silently in background via AuthService (Every 13m).');
        }
      } catch (err) {
        console.warn('Silent auto-refresh notice:', err);
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

  // 4. Global apiClient Interceptor for 401 Auto-Retry with Concurrency Protection
  useEffect(() => {
    let failedQueue: Array<{
      resolve: (token: string) => void;
      reject: (err: any) => void;
    }> = [];

    const processQueue = (error: any, token: string | null = null) => {
      failedQueue.forEach((prom) => {
        if (error) prom.reject(error);
        else if (token) prom.resolve(token);
      });
      failedQueue = [];
    };

    const interceptor = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Intercept 401 only on non-auth requests and prevent infinite retry loops
        if (
          error.response &&
          error.response.status === 401 &&
          originalRequest &&
          !originalRequest._retry
        ) {
          const isAuthEndpoint =
            originalRequest.url?.includes('/auth/login') ||
            originalRequest.url?.includes('/auth/refresh') ||
            originalRequest.url?.includes('/auth/logout');

          if (isAuthEndpoint || isLoggedOut) {
            return Promise.reject(error);
          }

          originalRequest._retry = true;

          // If a refresh is already in progress, join the pending queue
          if (activeRefreshPromise) {
            return new Promise<string>((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                if (originalRequest.headers) {
                  if (typeof originalRequest.headers.set === 'function') {
                    originalRequest.headers.set('Authorization', `Bearer ${token}`);
                  } else {
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                  }
                }
                return apiClient(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          // Initiate single-flight refresh operation
          activeRefreshPromise = (async () => {
            try {
              const { accessToken, user: refreshedUser } = await AuthService.refreshSession();
              if (!accessToken) {
                throw new Error('Refresh failed: No access token received');
              }

              if (isLoggedOut) {
                throw new Error('User logged out during refresh');
              }

              apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
              if (refreshedUser) {
                setUser(refreshedUser);
              }
              setIsAuthenticated(true);

              // Notify other tabs
              authChannel?.postMessage({
                type: 'AUTH_REFRESH_SUCCESS',
                accessToken,
                user: refreshedUser,
              });

              processQueue(null, accessToken);
              return accessToken;
            } catch (refreshErr: any) {
              processQueue(refreshErr, null);

              // Only logout on authentic 401 Unauthorized (revoked/expired session)
              // Never logout on 403, 5xx, timeout, or network connection drop
              const isRevokedOrExpired = refreshErr.response?.status === 401;
              if (isRevokedOrExpired && !isLoggedOut) {
                isLoggedOut = true;
                authChannel?.postMessage({ type: 'AUTH_LOGOUT' });
                message.error('Sesi Anda telah berakhir, silakan login kembali.');
                AuthService.clearSession();
                setUser(null);
                setIsAuthenticated(false);
                delete apiClient.defaults.headers.common['Authorization'];
                router.push('/login');
              }

              throw refreshErr;
            } finally {
              activeRefreshPromise = null;
            }
          })();

          try {
            const newAccessToken = await activeRefreshPromise;
            if (originalRequest.headers) {
              if (typeof originalRequest.headers.set === 'function') {
                originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
              } else {
                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
              }
            }
            return apiClient(originalRequest);
          } catch (finalErr) {
            return Promise.reject(finalErr);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      apiClient.interceptors.response.eject(interceptor);
    };
  }, [router]);

  const login = useCallback((token: string, userData: User) => {
    isLoggedOut = false;
    queryClient.clear();
    AuthService.setSession(token, userData);
    setUser(userData);
    setIsAuthenticated(true);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    authChannel?.postMessage({ type: 'AUTH_REFRESH_SUCCESS', accessToken: token, user: userData });
  }, []);

  const logout = useCallback(async () => {
    isLoggedOut = true;
    queryClient.clear();
    try {
      await apiClient.post('/auth/logout', {}, { withCredentials: true });
    } catch {
      // Ignore network errors on logout
    }
    AuthService.clearSession();
    setUser(null);
    setIsAuthenticated(false);
    delete apiClient.defaults.headers.common['Authorization'];
    authChannel?.postMessage({ type: 'AUTH_LOGOUT' });
    message.success('Berhasil logout');
    router.push('/login');
  }, [router]);

  const roles = useMemo(() => user?.roles || [], [user]);
  const isSuperAdmin = useMemo(() => roles.includes('SUPER_ADMIN'), [roles]);
  const isGeneralManager = useMemo(() => roles.includes('GENERAL_MANAGER') || isSuperAdmin, [roles, isSuperAdmin]);
  const isHeadOfOperations = useMemo(() => roles.includes('HEAD_OF_OPERATIONS') || roles.includes('GENERAL_MANAGER') || isSuperAdmin, [roles, isSuperAdmin]);
  const isDirector = useMemo(() => roles.includes('DIRECTOR') || isSuperAdmin, [roles, isSuperAdmin]);
  const isProjectManager = useMemo(() => roles.includes('PROJECT_MANAGER') || isSuperAdmin, [roles, isSuperAdmin]);
  const isProcurement = useMemo(() => roles.includes('PROCUREMENT') || roles.includes('PURCHASING') || isSuperAdmin, [roles, isSuperAdmin]);
  const isFinance = useMemo(() => roles.includes('FINANCE') || isSuperAdmin, [roles, isSuperAdmin]);
  const canMakeManagementDecision = useMemo(() => roles.includes('HEAD_OF_OPERATIONS') || roles.includes('GENERAL_MANAGER') || roles.includes('DIRECTOR') || isSuperAdmin, [roles, isSuperAdmin]);
  const isPmOnly = useMemo(() => roles.includes('PROJECT_MANAGER') && !canMakeManagementDecision, [roles, canMakeManagementDecision]);

  const authContextValue = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
      isSuperAdmin,
      isProjectManager,
      isGeneralManager,
      isHeadOfOperations,
      isProcurement,
      isFinance,
      isDirector,
      canMakeManagementDecision,
      isPmOnly,
    }),
    [
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
      isSuperAdmin,
      isProjectManager,
      isGeneralManager,
      isHeadOfOperations,
      isProcurement,
      isFinance,
      isDirector,
      canMakeManagementDecision,
      isPmOnly,
    ]
  );

  return (
    <AuthContext.Provider value={authContextValue}>
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
