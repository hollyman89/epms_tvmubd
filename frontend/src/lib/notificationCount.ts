/**
 * Pure helper to safely extract numeric unread notification count from backend API responses.
 * Handles:
 * 1. Double-wrapped response from NestJS TransformInterceptor:
 *    { meta: { ... }, data: { message: "...", data: { count: X } } }
 * 2. Single-wrapped response from controller:
 *    { message: "...", data: { count: X } }
 * 3. Flat count object:
 *    { count: X }
 * 4. Missing/invalid values -> safely returns 0
 */
export function extractUnreadNotificationCount(response: any): number {
  if (!response) return 0;

  // Search through known nested structures
  const raw =
    response?.data?.data?.count ??
    response?.data?.count ??
    response?.count ??
    (typeof response === 'number' ? response : null);

  const count = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}
