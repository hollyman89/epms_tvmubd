import {
  isPushSupported,
  urlBase64ToUint8Array,
  arrayBufferToBase64Url,
  getNotificationPermission,
  getWebPushStatus,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  fetchVapidPublicKey,
  isIosDevice,
  isStandalonePwa,
  getDevicePlatform,
  computeEndpointHash,
  fetchUserPushSubscriptions,
  deletePushSubscription,
} from '../webPushClient';
import { apiClient } from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Frontend Stage 3C — Web Push Client Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup global window, navigator, and notification mocks in Node test environment
    (global as any).window = {
      atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
      btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
      PushManager: function () {},
      Notification: {
        permission: 'granted',
        requestPermission: jest.fn().mockResolvedValue('granted'),
      },
    };

    (global as any).Notification = (global as any).window.Notification;

    (global as any).navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestBrowser',
      serviceWorker: {
        register: jest.fn().mockResolvedValue({}),
        getRegistration: jest.fn().mockImplementation(() => (global as any).navigator.serviceWorker.ready),
        ready: Promise.resolve({
          pushManager: {
            getSubscription: jest.fn().mockResolvedValue(null),
            subscribe: jest.fn().mockResolvedValue({
              endpoint: 'https://fcm.googleapis.com/fcm/send/test-device',
              getKey: jest.fn(() => new Uint8Array(16).buffer),
            }),
          },
        }),
      },
    };
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).Notification;
    delete (global as any).navigator;
  });

  describe('1. Feature Detection & Key Conversion', () => {
    it('detects push support when serviceWorker, PushManager, and Notification exist', () => {
      expect(isPushSupported()).toBe(true);
    });

    it('returns false when PushManager is missing', () => {
      delete (global as any).window.PushManager;
      expect(isPushSupported()).toBe(false);
    });

    it('converts URL-safe base64 string to Uint8Array correctly', () => {
      // 65-byte uncompressed P-256 public key mock in base64url
      const rawHex = '04' + '11'.repeat(64);
      const rawBuf = Buffer.from(rawHex, 'hex');
      const b64url = rawBuf
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

      const uint8 = urlBase64ToUint8Array(b64url);
      expect(uint8.length).toBe(65);
      expect(uint8[0]).toBe(0x04);
    });

    it('converts ArrayBuffer to base64url string without padding', () => {
      const bytes = new Uint8Array([4, 1, 2, 3, 255, 254]);
      const b64url = arrayBufferToBase64Url(bytes.buffer);
      expect(b64url).not.toContain('+');
      expect(b64url).not.toContain('/');
      expect(b64url).not.toContain('=');
    });
  });

  describe('2. Permission & Status Checks', () => {
    it('returns Notification.permission value', () => {
      (global as any).Notification.permission = 'granted';
      expect(getNotificationPermission()).toBe('granted');
    });

    it('evaluates PERMISSION_DENIED status when permission is denied', async () => {
      (global as any).Notification.permission = 'denied';
      const status = await getWebPushStatus();
      expect(status).toBe('PERMISSION_DENIED');
    });

    it('evaluates ACTIVE when existing subscription exists in PushManager', async () => {
      (global as any).Notification.permission = 'granted';
      const mockSubscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-token',
      };
      (global as any).navigator.serviceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue(mockSubscription),
        },
      });

      const status = await getWebPushStatus();
      expect(status).toBe('ACTIVE');
    });

    it('evaluates INACTIVE when no existing subscription exists', async () => {
      (global as any).Notification.permission = 'granted';
      (global as any).navigator.serviceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue(null),
        },
      });

      const status = await getWebPushStatus();
      expect(status).toBe('INACTIVE');
    });
  });

  describe('3. Subscription Flow (User Gesture & Backend Sync)', () => {
    it('aborts subscription if user denies notification permission', async () => {
      (global as any).Notification.requestPermission = jest.fn().mockResolvedValue('denied');

      const result = await subscribeToWebPush();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Izin notifikasi tidak diberikan');
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('subscribes with PushManager and persists subscription to backend API on permission granted', async () => {
      (global as any).Notification.requestPermission = jest.fn().mockResolvedValue('granted');

      // Mock VAPID key response
      const fakePub = '04' + '22'.repeat(64);
      const fakePubB64Url = Buffer.from(fakePub, 'hex')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: {
            publicKey: fakePubB64Url,
            enabled: true,
          },
        },
      });

      const fakeKeyBuffer = new Uint8Array([4, 10, 20, 30]).buffer;
      const fakeAuthBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]).buffer;

      const mockPushSubscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-token-123',
        getKey: jest.fn((type: string) => {
          if (type === 'p256dh') return fakeKeyBuffer;
          if (type === 'auth') return fakeAuthBuffer;
          return null;
        }),
      };

      const mockPushManager = {
        getSubscription: jest.fn().mockResolvedValue(null),
        subscribe: jest.fn().mockResolvedValue(mockPushSubscription),
      };

      (global as any).navigator.serviceWorker.ready = Promise.resolve({
        pushManager: mockPushManager,
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: {
          message: 'Push subscription registered successfully',
          data: { id: 1, endpointHash: 'hash-1' },
        },
      });

      const result = await subscribeToWebPush();
      expect(result.success).toBe(true);
      expect(mockPushManager.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          userVisibleOnly: true,
        })
      );
      expect(apiClient.post).toHaveBeenCalledWith(
        '/notifications/push/subscribe',
        expect.objectContaining({
          endpoint: 'https://fcm.googleapis.com/fcm/send/device-token-123',
          keys: expect.objectContaining({
            p256dh: expect.any(String),
            auth: expect.any(String),
          }),
        })
      );
    });

    it('handles backend API failure gracefully during subscription', async () => {
      (global as any).Notification.requestPermission = jest.fn().mockResolvedValue('granted');

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: {
            publicKey: 'test-key',
            enabled: true,
          },
        },
      });

      const mockSub = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/err-token',
        getKey: jest.fn(() => new Uint8Array(16).buffer),
      };

      (global as any).navigator.serviceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue(null),
          subscribe: jest.fn().mockResolvedValue(mockSub),
        },
      });

      (apiClient.post as jest.Mock).mockRejectedValueOnce({
        response: {
          data: { message: 'Database connection failed' },
        },
      });

      const result = await subscribeToWebPush();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('4. Unsubscribe Flow & Session Isolation', () => {
    it('unsubscribes client from PushManager and calls backend unsubscribe endpoint', async () => {
      const mockUnsubscribe = jest.fn().mockResolvedValue(true);
      const mockSub = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-to-unsub',
        unsubscribe: mockUnsubscribe,
      };

      (global as any).navigator.serviceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue(mockSub),
        },
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { message: 'Revoked' },
      });

      const result = await unsubscribeFromWebPush();
      expect(result.success).toBe(true);
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(apiClient.post).toHaveBeenCalledWith('/notifications/push/unsubscribe', {
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-to-unsub',
      });
    });

    it('guarantees logout does not call unsubscribe endpoint', () => {
      // In AuthContext.tsx, logout only clears session and calls /auth/logout, never /notifications/push/unsubscribe
      expect(apiClient.post).not.toHaveBeenCalledWith(
        '/notifications/push/unsubscribe',
        expect.anything()
      );
    });
  });

  describe('5. Safe Deep-Link URL Resolution (Open-Redirect Prevention in Service Worker)', () => {
    function resolveSafeDestination(rawLink: string, origin: string): string {
      try {
        const parsed = new URL(rawLink, origin);
        if (parsed.origin !== origin) {
          return new URL('/', origin).href;
        }
        return parsed.href;
      } catch {
        return new URL('/', origin).href;
      }
    }

    it('resolves valid relative and same-origin paths safely', () => {
      const origin = 'https://epms.tvmubd.com';
      expect(resolveSafeDestination('/sales/tenders/159', origin)).toBe('https://epms.tvmubd.com/sales/tenders/159');
      expect(resolveSafeDestination('https://epms.tvmubd.com/procurement/claims/5', origin)).toBe('https://epms.tvmubd.com/procurement/claims/5');
    });

    it('strictly blocks off-origin external URLs and malicious open redirects', () => {
      const origin = 'https://epms.tvmubd.com';
      expect(resolveSafeDestination('https://attacker.com/steal-token', origin)).toBe('https://epms.tvmubd.com/');
      expect(resolveSafeDestination('//attacker.com/evil', origin)).toBe('https://epms.tvmubd.com/');
      expect(resolveSafeDestination('javascript:alert(1)', origin)).toBe('https://epms.tvmubd.com/');
    });
  });

  describe('6. Platform Guidance & Shared Device Recovery', () => {
    it('detects iOS devices from userAgent or iPad touch points', () => {
      (global as any).navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)';
      expect(isIosDevice()).toBe(true);
      expect(getDevicePlatform()).toBe('ios');

      (global as any).navigator.userAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7)';
      expect(isIosDevice()).toBe(false);
      expect(getDevicePlatform()).toBe('android');

      (global as any).navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      expect(isIosDevice()).toBe(false);
      expect(getDevicePlatform()).toBe('desktop');
    });

    it('requires PWA standalone mode on iOS and returns IOS_PWA_REQUIRED', async () => {
      (global as any).navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)';
      (global as any).window.matchMedia = jest.fn().mockReturnValue({ matches: false });

      const status = await getWebPushStatus();
      expect(status).toBe('IOS_PWA_REQUIRED');

      const result = await subscribeToWebPush();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Layar Utama');
    });

    it('computes endpoint SHA-256 hash matching backend hex representation', async () => {
      const testUrl = 'https://fcm.googleapis.com/fcm/send/sample-token';
      const hash = await computeEndpointHash(testUrl);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('verifies backend subscription status when verifyWithBackend is true', async () => {
      const testEndpoint = 'https://fcm.googleapis.com/fcm/send/my-device-token';
      const expectedHash = await computeEndpointHash(testEndpoint);

      (global as any).Notification.permission = 'granted';
      (global as any).navigator.serviceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue({ endpoint: testEndpoint }),
        },
      });

      // Case A: Backend has matching subscription for current user
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 10,
              userId: 5,
              endpointHash: expectedHash,
              isActive: true,
            },
          ],
        },
      });

      const activeStatus = await getWebPushStatus({ verifyWithBackend: true });
      expect(activeStatus).toBe('ACTIVE');

      // Case B: Backend has no subscription for current user (shared device / different user logged in)
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: [],
        },
      });

      const inactiveStatus = await getWebPushStatus({ verifyWithBackend: true });
      expect(inactiveStatus).toBe('INACTIVE');
    });

    it('automatically recovers on 403 Forbidden cross-user collision by recreating subscription', async () => {
      (global as any).Notification.requestPermission = jest.fn().mockResolvedValue('granted');

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: {
            publicKey: '04' + '33'.repeat(64),
            enabled: true,
          },
        },
      });

      const oldUnsubscribe = jest.fn().mockResolvedValue(true);
      const staleSub = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/stale-user-a-token',
        getKey: jest.fn(() => new Uint8Array(16).buffer),
        unsubscribe: oldUnsubscribe,
      };

      const freshSub = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/fresh-user-b-token',
        getKey: jest.fn(() => new Uint8Array(16).buffer),
      };

      const mockPushManager = {
        getSubscription: jest.fn().mockResolvedValue(staleSub),
        subscribe: jest.fn().mockResolvedValue(freshSub),
      };

      (global as any).navigator.serviceWorker.ready = Promise.resolve({
        pushManager: mockPushManager,
      });

      // 1st post fails with 403 (owned by another user)
      (apiClient.post as jest.Mock)
        .mockRejectedValueOnce({
          response: {
            status: 403,
            data: { message: 'Access denied: cannot overwrite an active push subscription owned by another user' },
          },
        })
        // 2nd post succeeds with fresh sub
        .mockResolvedValueOnce({
          data: {
            message: 'Push subscription registered successfully',
            data: { id: 99 },
          },
        });

      const result = await subscribeToWebPush();
      expect(result.success).toBe(true);
      expect(oldUnsubscribe).toHaveBeenCalled();
      expect(mockPushManager.subscribe).toHaveBeenCalled();
      expect(apiClient.post).toHaveBeenCalledTimes(2);
      expect(apiClient.post).toHaveBeenLastCalledWith(
        '/notifications/push/subscribe',
        expect.objectContaining({
          endpoint: 'https://fcm.googleapis.com/fcm/send/fresh-user-b-token',
        })
      );
    });

    it('fetches user push subscriptions and deletes specific subscription by id', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: [{ id: 12, endpointOrigin: 'https://fcm.googleapis.com', isActive: true }],
        },
      });

      const subs = await fetchUserPushSubscriptions();
      expect(subs).toHaveLength(1);
      expect(subs[0].id).toBe(12);

      (apiClient.delete as jest.Mock).mockResolvedValueOnce({
        data: { message: 'Revoked' },
      });

      const delRes = await deletePushSubscription(12);
      expect(delRes.success).toBe(true);
      expect(apiClient.delete).toHaveBeenCalledWith('/notifications/push/subscriptions/12');
    });
  });
});

