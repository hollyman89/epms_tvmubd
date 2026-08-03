/**
 * Single Source of Truth for Storage Keys
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  // Backward compatibility fallback keys
  LEGACY_ACCESS_TOKEN: 'accessToken',
} as const;
