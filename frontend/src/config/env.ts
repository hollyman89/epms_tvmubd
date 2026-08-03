/**
 * Single Source of Truth for Frontend Environment Configuration
 */
export const ENV = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000',
} as const;
