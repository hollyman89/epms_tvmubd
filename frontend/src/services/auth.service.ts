import { STORAGE_KEYS } from '@/config';
import { apiClient } from '@/lib/axios';

export interface UserSessionData {
  id?: number;
  email?: string;
  fullName?: string;
  roles?: string[];
  permissions?: string[];
  [key: string]: any;
}

export class AuthService {
  /**
   * Performs login request via apiClient SSOT.
   */
  static async loginApi(credentials: { email?: string; password?: string }): Promise<any> {
    const res = await apiClient.post('/auth/login', credentials);
    return res.data?.data || res.data;
  }

  /**
   * Refreshes access token using HttpOnly cookie via apiClient SSOT.
   * Does NOT require or depend on refresh token in browser localStorage.
   */
  static async refreshSession(): Promise<{ accessToken: string; user?: any }> {
    const res = await apiClient.post('/auth/refresh', {}, { withCredentials: true });
    const payload = res.data?.data || res.data;
    const newAccessToken = payload?.accessToken || payload?.access_token;
    const user = payload?.user;

    if (newAccessToken) {
      this.setAccessToken(newAccessToken);
    }
    if (user) {
      this.setUser(user);
    }
    // Clean up any legacy refresh token in browser storage
    this.removeRefreshToken();

    return { accessToken: newAccessToken, user };
  }

  /**
   * Safe JWT expiration check without external dependencies.
   * Returns true if token is missing, malformed, or expired (within 10s buffer).
   */
  static isTokenExpired(token?: string | null): boolean {
    const t = token || this.getAccessToken();
    if (!t) return true;
    try {
      const parts = t.split('.');
      if (parts.length !== 3) return true;
      // Base64URL to Base64 decode
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const parsed = JSON.parse(jsonPayload);
      if (!parsed.exp) return false;
      return parsed.exp * 1000 <= Date.now() + 10000;
    } catch {
      return true;
    }
  }

  /**
   * Retrieves the active access token from storage.
   * Checks primary key ACCESS_TOKEN with fallback to LEGACY_ACCESS_TOKEN.
   */
  static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return (
      localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ||
      localStorage.getItem(STORAGE_KEYS.LEGACY_ACCESS_TOKEN)
    );
  }

  /**
   * Stores the access token in storage.
   */
  static setAccessToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  }

  /**
   * Removes the access token from storage.
   */
  static removeAccessToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_ACCESS_TOKEN);
  }

  /**
   * Retrieves the refresh token from storage.
   */
  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Stores the refresh token in storage.
   */
  static setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  }

  /**
   * Removes the refresh token from storage.
   */
  static removeRefreshToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Retrieves the user session data from storage.
   */
  static getUser(): UserSessionData | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Stores the user session data in storage.
   */
  static setUser(user: UserSessionData): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  /**
   * Removes the user session data from storage.
   */
  static removeUser(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  /**
   * Saves active session credentials (access token, user).
   * Explicitly purges any legacy refresh token from storage.
   */
  static setSession(token: string, user: UserSessionData): void {
    this.setAccessToken(token);
    this.setUser(user);
    this.removeRefreshToken();
  }

  /**
   * Clears full session credentials from storage.
   */
  static clearSession(): void {
    this.removeAccessToken();
    this.removeRefreshToken();
    this.removeUser();
  }

  /**
   * Checks if user has a valid access token in storage.
   */
  static isAuthenticated(): boolean {
    return Boolean(this.getAccessToken());
  }
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).AuthService = AuthService;
}

export default AuthService;
