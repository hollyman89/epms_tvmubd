import { apiClient } from '@/lib/axios';

export interface VapidPublicKeyResponse {
  publicKey: string;
  enabled: boolean;
}

export type WebPushStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED'
  | 'NOT_CONFIGURED'
  | 'IOS_PWA_REQUIRED';

export interface SanitizedPushSubscription {
  id: number;
  userId: number;
  endpointHash: string;
  endpointOrigin: string;
  userAgent: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Converts a URL-safe Base64 string to a Uint8Array suitable for PushManager applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Converts an ArrayBuffer to a base64url string.
 */
export function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Computes deterministic SHA-256 hex digest of an endpoint URL.
 * Matches backend PushSubscriptionService.computeEndpointHash.
 */
export async function computeEndpointHash(endpoint: string): Promise<string> {
  const normalized = (endpoint || '').trim();
  if (!normalized) return '';

  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to fallback
    }
  }

  // Node / test environment fallback
  try {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Detects whether the current device is running Apple iOS (iPhone/iPad/iPod).
 */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  return Boolean(isIos);
}

/**
 * Checks whether the web app is running in standalone PWA mode (e.g. Added to Home Screen).
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  return (
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    Boolean(nav?.standalone)
  );
}

/**
 * Returns simple device platform identifier for UX customization.
 */
export function getDevicePlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (isIosDevice()) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Checks whether the current browser runtime supports Web Push, Service Worker, and Notification API.
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Returns the current Notification permission state.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Registers the service worker located at /sw.js.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('[WebPushClient] Service worker registration failed:', err);
    return null;
  }
}

/**
 * Fetches the backend VAPID public key.
 */
export async function fetchVapidPublicKey(): Promise<VapidPublicKeyResponse> {
  const response = await apiClient.get('/notifications/push/vapid-public-key');
  const payload = response?.data;
  const inner = payload?.data?.data || payload?.data || payload;
  return {
    publicKey: inner?.publicKey || '',
    enabled: Boolean(inner?.enabled),
  };
}

/**
 * Fetches all active Web Push subscriptions belonging to the authenticated user from the backend.
 */
export async function fetchUserPushSubscriptions(): Promise<SanitizedPushSubscription[]> {
  try {
    const response = await apiClient.get('/notifications/push/subscriptions');
    const payload = response?.data;
    const items = payload?.data?.data || payload?.data || [];
    return Array.isArray(items) ? items : [];
  } catch (err) {
    console.warn('[WebPushClient] Failed to fetch user push subscriptions:', err);
    return [];
  }
}

/**
 * Revokes a specific Web Push subscription by its ID for the authenticated user.
 */
export async function deletePushSubscription(
  subscriptionId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.delete(`/notifications/push/subscriptions/${subscriptionId}`);
    return { success: true };
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || 'Gagal menghapus pendaftaran perangkat.';
    return { success: false, error: msg };
  }
}

/**
 * Checks if a PushSubscription already exists on the client.
 */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    let registration: ServiceWorkerRegistration | null | undefined = null;
    if (typeof navigator.serviceWorker.getRegistration === 'function') {
      registration = await navigator.serviceWorker.getRegistration();
    }
    if (!registration && navigator.serviceWorker.ready) {
      registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((res) => setTimeout(() => res(null), 300)),
      ]);
    }
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Inspects and returns the comprehensive Web Push status of this browser client.
 * If verifyWithBackend is true, confirms that the local subscription is active for the current user in backend.
 */
export async function getWebPushStatus(options?: { verifyWithBackend?: boolean }): Promise<WebPushStatus> {
  // On iOS Safari, Web Push is only supported if installed to Home Screen (standalone PWA)
  if (isIosDevice() && !isStandalonePwa()) {
    return 'IOS_PWA_REQUIRED';
  }

  if (!isPushSupported()) return 'UNSUPPORTED';

  if (Notification.permission === 'denied') {
    return 'PERMISSION_DENIED';
  }

  try {
    const sub = await getExistingSubscription();
    if (!sub) {
      return 'INACTIVE';
    }

    if (options?.verifyWithBackend) {
      try {
        const activeSubs = await fetchUserPushSubscriptions();
        if (!activeSubs || activeSubs.length === 0) {
          return 'INACTIVE';
        }
        const currentHash = await computeEndpointHash(sub.endpoint);
        const existsForUser = activeSubs.some((s) => s.endpointHash === currentHash && s.isActive);
        return existsForUser ? 'ACTIVE' : 'INACTIVE';
      } catch {
        // Network or auth error: preserve ACTIVE if subscription exists locally
        return 'ACTIVE';
      }
    }

    return 'ACTIVE';
  } catch {
    return 'INACTIVE';
  }
}

/**
 * Subscribes the current browser to Web Push using an explicit user gesture:
 * 1. Validates platform readiness (iOS PWA requirement).
 * 2. Requests Notification permission.
 * 3. Fetches VAPID public key.
 * 4. Calls PushManager.subscribe().
 * 5. Persists the subscription with authenticated user session on backend.
 * 6. Handles account switching / shared device re-subscribe automatically if 403 occurs.
 */
export async function subscribeToWebPush(options?: { forceNew?: boolean }): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (isIosDevice() && !isStandalonePwa()) {
    return {
      success: false,
      error:
        'Pada iPhone/iPad, silakan tambahkan EPMS ke Layar Utama (Add to Home Screen) melalui Safari terlebih dahulu untuk mengaktifkan notifikasi push.',
    };
  }

  if (!isPushSupported()) {
    return { success: false, error: 'Web Push tidak didukung pada browser ini.' };
  }

  // Step 1: Request permission via user gesture
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      success: false,
      error: 'Izin notifikasi tidak diberikan oleh pengguna.',
    };
  }

  // Step 2: Ensure Service Worker is active
  await registerServiceWorker();
  const registration = await navigator.serviceWorker.ready;

  // Step 3: Fetch VAPID public key from backend
  let vapidConfig: VapidPublicKeyResponse;
  try {
    vapidConfig = await fetchVapidPublicKey();
  } catch (err: any) {
    const errMsg = err?.response?.data?.message || err?.message || 'Gagal mengambil VAPID key dari server.';
    return { success: false, error: errMsg };
  }

  if (!vapidConfig.publicKey) {
    return { success: false, error: 'VAPID public key belum dikonfigurasi di server.' };
  }

  const appServerKey = urlBase64ToUint8Array(vapidConfig.publicKey);

  // Helper to persist subscription to backend
  const persistToBackend = async (sub: PushSubscription) => {
    const p256dhBuffer = sub.getKey ? sub.getKey('p256dh') : null;
    const authBuffer = sub.getKey ? sub.getKey('auth') : null;

    const p256dh = arrayBufferToBase64Url(p256dhBuffer);
    const auth = arrayBufferToBase64Url(authBuffer);

    return apiClient.post('/notifications/push/subscribe', {
      endpoint: sub.endpoint,
      keys: {
        p256dh,
        auth,
      },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  };

  // Step 4: Handle PushManager subscription
  let subscription: PushSubscription;
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing && !options?.forceNew) {
      subscription = existing;
    } else {
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch {
          // ignore unsubscribe failure
        }
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey as unknown as BufferSource,
      });
    }
  } catch (subErr: any) {
    return {
      success: false,
      error: `Browser gagal membuat subscription: ${subErr?.message || subErr}`,
    };
  }

  // Step 5: Persist to backend with automatic shared-device re-registration recovery
  try {
    await persistToBackend(subscription);
  } catch (apiErr: any) {
    const statusCode = apiErr?.response?.status;
    const errorMsg = apiErr?.response?.data?.message || '';

    // If 403 Forbidden due to ownership collision (another user previously registered this browser endpoint),
    // force unsubscribe on browser and recreate a fresh subscription for the newly authenticated user.
    if (
      statusCode === 403 &&
      (errorMsg.includes('another user') || errorMsg.includes('Access denied'))
    ) {
      try {
        await subscription.unsubscribe();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey as unknown as BufferSource,
        });
        await persistToBackend(subscription);
      } catch (retryErr: any) {
        const retryMsg =
          retryErr?.response?.data?.message ||
          retryErr?.message ||
          'Gagal memperbarui pendaftaran perangkat untuk akun baru.';
        return { success: false, error: retryMsg };
      }
    } else {
      const msg = errorMsg || apiErr?.message || 'Gagal menyimpan subscription ke server.';
      return { success: false, error: msg };
    }
  }

  return { success: true, subscription };
}

/**
 * Unsubscribes the current device:
 * 1. Unsubscribes from browser PushManager.
 * 2. Revokes subscription on backend.
 */
export async function unsubscribeFromWebPush(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isPushSupported()) {
    return { success: false, error: 'Web Push tidak didukung pada browser ini.' };
  }

  try {
    const sub = await getExistingSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      // Best effort notification to backend
      try {
        await apiClient.post('/notifications/push/unsubscribe', { endpoint });
      } catch (err) {
        console.warn('[WebPushClient] Backend unsubscribe sync notice:', err);
      }
    }
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Gagal menonaktifkan notifikasi.',
    };
  }
}
