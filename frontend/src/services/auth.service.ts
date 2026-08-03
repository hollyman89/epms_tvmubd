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
   * Refreshes access token using refresh token via apiClient SSOT.
   */
  static async refreshSession(): Promise<{ accessToken: string; refreshToken?: string }> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available');
    const res = await apiClient.post('/auth/refresh', { refreshToken }, { withCredentials: true });
    const newAccessToken = res.data?.accessToken || res.data?.data?.accessToken;
    const newRefreshToken = res.data?.refreshToken || res.data?.data?.refreshToken;
    if (newAccessToken) {
      this.setAccessToken(newAccessToken);
      if (newRefreshToken) this.setRefreshToken(newRefreshToken);
    }
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
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
   * Saves full session credentials (access token, refresh token, user).
   */
  static setSession(token: string, user: UserSessionData, refreshToken?: string): void {
    this.setAccessToken(token);
    this.setUser(user);
    if (refreshToken) {
      this.setRefreshToken(refreshToken);
    }
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

export default AuthService;
