/**
 * Single Source of Truth for Frontend Environment Configuration
 */
export const ENV = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
  SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || '',
} as const;
