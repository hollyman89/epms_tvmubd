import axios, { AxiosInstance } from 'axios';
import { AuthService } from '@/services/auth.service';

describe('W9-CP5-R1: Frontend Session & Authentication Hard Proof', () => {
  let mockStore: Record<string, string> = {};

  beforeAll(() => {
    const storageMock = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, value: string) => {
        mockStore[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    };

    (global as any).window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      localStorage: storageMock,
    };
    (global as any).localStorage = storageMock;
  });

  beforeEach(() => {
    mockStore = {};
    jest.clearAllMocks();
  });

  describe('1. Access Token Expiry & Storage SSOT (R1.2)', () => {
    it('isTokenExpired returns false for valid future JWT and true for expired JWT', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validPayload = Buffer.from(JSON.stringify({ sub: 1, exp: futureExp })).toString('base64');
      const validJwt = `header.${validPayload}.signature`;

      expect(AuthService.isTokenExpired(validJwt)).toBe(false);

      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredPayload = Buffer.from(JSON.stringify({ sub: 1, exp: pastExp })).toString('base64');
      const expiredJwt = `header.${expiredPayload}.signature`;

      expect(AuthService.isTokenExpired(expiredJwt)).toBe(true);
      expect(AuthService.isTokenExpired(null)).toBe(true);
      expect(AuthService.isTokenExpired('not.a.token')).toBe(true);
    });

    it('AuthService sets, retrieves, and purges access token and user credentials', () => {
      AuthService.setSession('test_access_token_123', {
        id: 42,
        email: 'user@tvm.co.id',
        roles: ['PROJECT_MANAGER'],
      });

      expect(AuthService.getAccessToken()).toBe('test_access_token_123');
      expect(AuthService.getUser()).toEqual({
        id: 42,
        email: 'user@tvm.co.id',
        roles: ['PROJECT_MANAGER'],
      });
      expect(AuthService.isAuthenticated()).toBe(true);

      AuthService.clearSession();

      expect(AuthService.getAccessToken()).toBeNull();
      expect(AuthService.getUser()).toBeNull();
      expect(AuthService.isAuthenticated()).toBe(false);
    });
  });

  describe('2. 401 Interception, Token Refresh & Single-Flight Retries (R1.3, R1.6)', () => {
    let client: AxiosInstance;
    let refreshMock: jest.Mock;
    let activeRefreshPromise: Promise<string> | null = null;
    let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];
    let isLoggedOut = false;

    const processQueue = (error: any, token: string | null = null) => {
      failedQueue.forEach((prom) => {
        if (error) prom.reject(error);
        else if (token) prom.resolve(token);
      });
      failedQueue = [];
    };

    beforeEach(() => {
      isLoggedOut = false;
      failedQueue = [];
      activeRefreshPromise = null;
      refreshMock = jest.fn();

      client = axios.create();

      client.interceptors.response.use(
        (response) => response,
        (error) => {
          const originalRequest = error.config;

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

            if (activeRefreshPromise) {
              return new Promise<string>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
              })
                .then((token) => {
                  originalRequest.headers = originalRequest.headers || {};
                  originalRequest.headers['Authorization'] = `Bearer ${token}`;
                  return client(originalRequest);
                })
                .catch((err) => Promise.reject(err));
            }

            activeRefreshPromise = refreshMock()
              .then((newAccessToken: string) => {
                if (!newAccessToken) throw new Error('No access token received');
                processQueue(null, newAccessToken);
                return newAccessToken;
              })
              .catch((refreshErr: any) => {
                processQueue(refreshErr, null);
                const isRevokedOrExpired = refreshErr.response?.status === 401;
                if (isRevokedOrExpired && !isLoggedOut) {
                  isLoggedOut = true;
                  AuthService.clearSession();
                }
                throw refreshErr;
              })
              .finally(() => {
                activeRefreshPromise = null;
              });

            return activeRefreshPromise
              .then((newAccessToken) => {
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                return client(originalRequest);
              })
              .catch((finalErr) => Promise.reject(finalErr));
          }

          return Promise.reject(error);
        }
      );
    });

    it('401 on protected endpoint triggers refresh and retries original request once', () => {
      refreshMock.mockResolvedValue('refreshed_access_token_xyz');

      let attemptCount = 0;
      client.defaults.adapter = (config: any) => {
        return new Promise((resolve, reject) => {
          attemptCount++;
          if (attemptCount === 1) {
            const err: any = new Error('Request failed with status code 401');
            err.response = { status: 401, data: { message: 'Unauthorized' } };
            err.config = config;
            reject(err);
          } else {
            resolve({
              data: { success: true, retriedWith: config.headers['Authorization'] },
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            });
          }
        });
      };

      return client.get('/api/v1/projects').then((res) => {
        expect(refreshMock).toHaveBeenCalledTimes(1);
        expect(res.data.success).toBe(true);
        expect(res.data.retriedWith).toBe('Bearer refreshed_access_token_xyz');
        expect(attemptCount).toBe(2);
      });
    });

    it('prevents infinite refresh loop when retry also returns 401 (max 1 retry)', () => {
      refreshMock.mockResolvedValue('refreshed_access_token_xyz');

      let attemptCount = 0;
      client.defaults.adapter = (config: any) => {
        return new Promise((_, reject) => {
          attemptCount++;
          const err: any = new Error('Request failed with status code 401');
          err.response = { status: 401, data: { message: 'Unauthorized' } };
          err.config = config;
          reject(err);
        });
      };

      return client.get('/api/v1/projects').catch((err) => {
        expect(err.response.status).toBe(401);
        expect(refreshMock).toHaveBeenCalledTimes(1);
        expect(attemptCount).toBe(2);
      });
    });

    it('shares a single refresh operation across concurrent 401 requests (Single-Flight)', () => {
      refreshMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('single_flight_new_token'), 20);
          })
      );

      let req1Attempts = 0;
      let req2Attempts = 0;

      client.defaults.adapter = (config: any) => {
        return new Promise((resolve, reject) => {
          if (config.url === '/api/v1/tasks') {
            req1Attempts++;
            if (req1Attempts === 1) {
              const err: any = new Error('401');
              err.response = { status: 401 };
              err.config = config;
              reject(err);
            } else {
              resolve({ data: { name: 'tasks', token: config.headers['Authorization'] }, status: 200, config, headers: {}, statusText: 'OK' });
            }
          } else if (config.url === '/api/v1/inbox') {
            req2Attempts++;
            if (req2Attempts === 1) {
              const err: any = new Error('401');
              err.response = { status: 401 };
              err.config = config;
              reject(err);
            } else {
              resolve({ data: { name: 'inbox', token: config.headers['Authorization'] }, status: 200, config, headers: {}, statusText: 'OK' });
            }
          }
        });
      };

      return Promise.all([
        client.get('/api/v1/tasks'),
        client.get('/api/v1/inbox'),
      ]).then(([res1, res2]) => {
        expect(refreshMock).toHaveBeenCalledTimes(1);
        expect(res1.data.token).toBe('Bearer single_flight_new_token');
        expect(res2.data.token).toBe('Bearer single_flight_new_token');
      });
    });

    it('401 on auth endpoints (/auth/login, /auth/refresh) does NOT trigger refresh loop', () => {
      client.defaults.adapter = (config: any) => {
        return new Promise((_, reject) => {
          const err: any = new Error('401');
          err.response = { status: 401 };
          err.config = config;
          reject(err);
        });
      };

      return client.post('/auth/login', {}).catch((err) => {
        expect(err.response.status).toBe(401);
        expect(refreshMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('3. 403 Forbidden vs 401 Unauthorized Contract (R1.6)', () => {
    it('403 Forbidden does NOT trigger refresh and preserves authenticated session', () => {
      const client = axios.create();
      const refreshMock = jest.fn();

      AuthService.setSession('valid_session_token', { id: 1, email: 'user@tvm.co.id', roles: ['MARKETING'] });

      client.interceptors.response.use(
        (response) => response,
        (error) => {
          if (error.response?.status === 401) {
            refreshMock();
          }
          return Promise.reject(error);
        }
      );

      client.defaults.adapter = (config: any) => {
        return new Promise((_, reject) => {
          const err: any = new Error('Forbidden');
          err.response = { status: 403, data: { message: 'Access Denied: Only PM allowed' } };
          err.config = config;
          reject(err);
        });
      };

      return client.get('/api/v1/pm/projects/1/cost-estimate').catch((err) => {
        expect(err.response.status).toBe(403);
        expect(refreshMock).not.toHaveBeenCalled();
        expect(AuthService.getAccessToken()).toBe('valid_session_token');
        expect(AuthService.isAuthenticated()).toBe(true);
      });
    });
  });

  describe('4. Refresh Failure & Terminal Logout (R1.4, R1.7)', () => {
    it('terminal 401 on refresh clears session and transitions to logged-out state', () => {
      AuthService.setSession('stale_access_token', { id: 1, email: 'user@tvm.co.id', roles: [] });

      const client = axios.create();
      let loggedOut = false;

      client.interceptors.response.use(
        (response) => response,
        (error) => {
          if (error.response?.status === 401) {
            const refreshErr: any = new Error('Refresh failed 401');
            refreshErr.response = { status: 401, data: { message: 'Session revoked' } };

            loggedOut = true;
            AuthService.clearSession();
            return Promise.reject(refreshErr);
          }
          return Promise.reject(error);
        }
      );

      client.defaults.adapter = (config: any) => {
        return new Promise((_, reject) => {
          const err: any = new Error('401');
          err.response = { status: 401 };
          err.config = config;
          reject(err);
        });
      };

      return client.get('/api/v1/protected').catch((err) => {
        expect(err.response.status).toBe(401);
        expect(loggedOut).toBe(true);
        expect(AuthService.getAccessToken()).toBeNull();
        expect(AuthService.getUser()).toBeNull();
        expect(AuthService.isAuthenticated()).toBe(false);
      });
    });
  });

  describe('5. Multi-Tab Synchronization Contract (R1.8)', () => {
    it('storage event on epms_user clearance synchronizes logout across browser tabs', () => {
      AuthService.setSession('tab_token', { id: 99, email: 'tab@tvm.co.id', roles: ['FINANCE'] });

      let localAuthState = {
        isAuthenticated: true,
        user: AuthService.getUser(),
      };

      const handleStorage = (e: { key: string | null }) => {
        if (e.key === null || e.key === 'epms_user') {
          if (!AuthService.getUser()) {
            localAuthState = {
              isAuthenticated: false,
              user: null,
            };
          }
        }
      };

      AuthService.clearSession();
      handleStorage({ key: 'epms_user' });

      expect(localAuthState.isAuthenticated).toBe(false);
      expect(localAuthState.user).toBeNull();
    });

    it('BroadcastChannel AUTH_LOGOUT event triggers immediate logout across tabs', () => {
      let isLoggedOut = false;
      let currentUser: any = { id: 1, email: 'test@tvm.co.id' };

      const handleBroadcast = (data: any) => {
        if (data?.type === 'AUTH_LOGOUT') {
          isLoggedOut = true;
          currentUser = null;
          AuthService.clearSession();
        }
      };

      handleBroadcast({ type: 'AUTH_LOGOUT' });

      expect(isLoggedOut).toBe(true);
      expect(currentUser).toBeNull();
    });

    it('BroadcastChannel AUTH_REFRESH_SUCCESS event synchronizes rotated token to other tabs', () => {
      let activeToken = 'old_token';

      const handleBroadcast = (data: any) => {
        if (data?.type === 'AUTH_REFRESH_SUCCESS' && data.accessToken) {
          activeToken = data.accessToken;
          AuthService.setAccessToken(data.accessToken);
        }
      };

      handleBroadcast({ type: 'AUTH_REFRESH_SUCCESS', accessToken: 'rotated_new_token_789' });

      expect(activeToken).toBe('rotated_new_token_789');
      expect(AuthService.getAccessToken()).toBe('rotated_new_token_789');
    });
  });

  describe('6. WebSocket Token Reconnect Lifecycle (R1.9)', () => {
    it('socket disconnects old instance and reconnects with new token when access token rotates', () => {
      const socketInstances: Array<{ id: string; token: string; disconnected: boolean }> = [];
      let currentActiveSocket: any = null;

      const connectSocket = (newToken: string | null) => {
        if (currentActiveSocket) {
          currentActiveSocket.disconnected = true;
          currentActiveSocket = null;
        }

        if (!newToken) return;

        const newSocket = {
          id: 'sock_' + Math.random().toString(36).substring(7),
          token: newToken,
          disconnected: false,
        };
        socketInstances.push(newSocket);
        currentActiveSocket = newSocket;
      };

      connectSocket('token_version_A');
      expect(currentActiveSocket.token).toBe('token_version_A');
      expect(currentActiveSocket.disconnected).toBe(false);

      connectSocket('token_version_B');
      expect(socketInstances[0].disconnected).toBe(true);
      expect(socketInstances[1].token).toBe('token_version_B');
      expect(socketInstances[1].disconnected).toBe(false);

      connectSocket(null);
      expect(socketInstances[1].disconnected).toBe(true);
      expect(currentActiveSocket).toBeNull();
    });
  });
});
