/**
 * Internal Navigation Transport for Sales Drawer State
 * 
 * Architecture Principle:
 * "URL IS NOT DRAWER STATE"
 * 
 * Provides transient, one-time transport for deep-linked drawer requests
 * (e.g. from To-Do "Buka") without polluting the browser address bar
 * with query parameters (tenderId, action, tab).
 */

export interface PendingSalesDrawerRequest {
  tenderId: number;
  action?: string | null;
}

let _pendingSalesDrawerRequest: PendingSalesDrawerRequest | null = null;
const STORAGE_KEY = 'pendingSalesDrawerRequest';

/**
 * Parses a target URL to check if it represents an actionable Sales drawer target.
 * E.g.: '/sales?tab=1&tenderId=40&action=go-nogo' -> { tenderId: 40, action: 'go-nogo' }
 */
export function parseSalesDrawerTarget(targetUrl: string | null | undefined): PendingSalesDrawerRequest | null {
  if (!targetUrl || typeof targetUrl !== 'string') return null;

  try {
    const [pathname, queryString] = targetUrl.split('?');
    if (pathname !== '/sales' || !queryString) return null;

    const params = new URLSearchParams(queryString);
    const tenderIdStr = params.get('tenderId');
    if (!tenderIdStr) return null;

    const tenderId = Number(tenderIdStr);
    if (isNaN(tenderId) || tenderId <= 0) return null;

    const action = params.get('action') || null;
    return { tenderId, action };
  } catch {
    return null;
  }
}

/**
 * Sets a transient pending request in memory and sessionStorage.
 */
export function setPendingSalesDrawerRequest(req: PendingSalesDrawerRequest): void {
  _pendingSalesDrawerRequest = { ...req };
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(req));
    } catch {
      // Ignore storage errors in restricted environments
    }
  }
}

/**
 * Peeks at any pending Sales drawer request without clearing it.
 */
export function peekPendingSalesDrawerRequest(): PendingSalesDrawerRequest | null {
  if (_pendingSalesDrawerRequest) {
    return { ..._pendingSalesDrawerRequest };
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const item = window.sessionStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed.tenderId === 'number' && parsed.tenderId > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Consumes the pending Sales drawer request ONCE.
 * Immediately clears both in-memory and sessionStorage references.
 */
export function consumePendingSalesDrawerRequest(): PendingSalesDrawerRequest | null {
  let result: PendingSalesDrawerRequest | null = null;

  if (_pendingSalesDrawerRequest) {
    result = { ..._pendingSalesDrawerRequest };
    _pendingSalesDrawerRequest = null;
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (!result) {
        const item = window.sessionStorage.getItem(STORAGE_KEY);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed && typeof parsed.tenderId === 'number' && parsed.tenderId > 0) {
            result = parsed;
          }
        }
      }
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  _pendingSalesDrawerRequest = null;
  return result;
}

/**
 * Clears any active pending Sales drawer request.
 */
export function clearPendingSalesDrawerRequest(): void {
  _pendingSalesDrawerRequest = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

/**
 * Intercepts To-Do CTA navigation:
 * If the target URL targets Sales drawer (e.g. /sales?tab=1&tenderId=40&action=go-nogo),
 * transports the payload internally and navigates visibly to clean '/sales'.
 * Otherwise navigates directly to the original target URL.
 */
export function navigateTodoAction(
  targetUrl: string,
  router: { push: (url: string) => void }
): void {
  const salesReq = parseSalesDrawerTarget(targetUrl);
  if (salesReq) {
    setPendingSalesDrawerRequest(salesReq);

    // Dispatch real-time event for already-mounted Sales page
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('epms:open_sales_drawer', { detail: salesReq })
      );
    }

    // Clean visible navigation: address bar remains strictly at /sales
    router.push('/sales');
    return;
  }

  // Non-sales routes or standard relative targets
  router.push(targetUrl);
}
