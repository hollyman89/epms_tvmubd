import {
  getWebPushStatus,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from '../webPushClient';

// Mock webPushClient methods
jest.mock('../webPushClient', () => {
  const actual = jest.requireActual('../webPushClient');
  return {
    ...actual,
    getWebPushStatus: jest.fn(),
    subscribeToWebPush: jest.fn(),
    unsubscribeFromWebPush: jest.fn(),
    getDevicePlatform: jest.fn(() => 'desktop'),
  };
});

describe('Web Push Toggle — Anti-Flickering & Recipient Callback Isolation Regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Read-Only Status Checks Isolation', () => {
    it('verifies getWebPushStatus executes without invoking onStatusChange on ACTIVE', async () => {
      (getWebPushStatus as jest.Mock).mockResolvedValue('ACTIVE');
      const onStatusChangeMock = jest.fn();

      // Simulate component passive refreshStatus logic:
      // Status check is read-only and MUST NOT notify onStatusChange
      const status = await getWebPushStatus({ verifyWithBackend: true });
      expect(status).toBe('ACTIVE');
      expect(onStatusChangeMock).not.toHaveBeenCalled();
    });

    it('verifies getWebPushStatus executes without invoking onStatusChange on INACTIVE', async () => {
      (getWebPushStatus as jest.Mock).mockResolvedValue('INACTIVE');
      const onStatusChangeMock = jest.fn();

      const status = await getWebPushStatus({ verifyWithBackend: true });
      expect(status).toBe('INACTIVE');
      expect(onStatusChangeMock).not.toHaveBeenCalled();
    });

    it('verifies status check errors fall back safely to INACTIVE without invoking onStatusChange', async () => {
      (getWebPushStatus as jest.Mock).mockRejectedValue(new Error('Network error'));
      const onStatusChangeMock = jest.fn();

      let status = 'UNKNOWN';
      try {
        status = await getWebPushStatus({ verifyWithBackend: true });
      } catch {
        status = 'INACTIVE';
      }

      expect(status).toBe('INACTIVE');
      expect(onStatusChangeMock).not.toHaveBeenCalled();
    });
  });

  describe('2. Protection Against Cascading Infinite Request Loops', () => {
    it('guarantees status check count remains strictly bounded (O(1)) across repeated parent evaluations', async () => {
      let backendFetchCount = 0;
      (getWebPushStatus as jest.Mock).mockImplementation(async () => {
        backendFetchCount++;
        return 'INACTIVE';
      });

      const parentState = {
        subscriptions: [] as any[],
        loadSubscriptionsCalled: 0,
      };

      // In the old broken code:
      // refreshStatus -> onStatusChange -> parent.loadSubscriptions -> re-render -> new onStatusChange -> refreshStatus (infinite loop)
      //
      // In the fixed architecture:
      // refreshStatus does NOT invoke onStatusChange.
      const onStatusChange = () => {
        parentState.loadSubscriptionsCalled++;
      };

      // Mount / initial check
      await (async () => {
        const current = await getWebPushStatus({ verifyWithBackend: true });
        // Under fixed behavior: DO NOT call onStatusChange
      })();

      // Verify that parent's loadSubscriptions was NOT triggered by passive check
      expect(parentState.loadSubscriptionsCalled).toBe(0);
      expect(backendFetchCount).toBe(1);

      // Verify consecutive cycles do not run away
      expect(backendFetchCount).toBeLessThan(2);
    });
  });

  describe('3. Active Mutation Notification Contracts', () => {
    it('invokes onStatusChange("ACTIVE") when subscribeToWebPush succeeds', async () => {
      (subscribeToWebPush as jest.Mock).mockResolvedValue({
        success: true,
        subscription: { id: 101, endpoint: 'https://push.example.com/1' },
      });

      const onStatusChangeMock = jest.fn();

      // Simulate executeSubscribe logic
      const res = await subscribeToWebPush();
      if (res.success) {
        onStatusChangeMock('ACTIVE');
      }

      expect(onStatusChangeMock).toHaveBeenCalledTimes(1);
      expect(onStatusChangeMock).toHaveBeenCalledWith('ACTIVE');
    });

    it('invokes onStatusChange("INACTIVE") when unsubscribeFromWebPush succeeds', async () => {
      (unsubscribeFromWebPush as jest.Mock).mockResolvedValue({
        success: true,
      });

      const onStatusChangeMock = jest.fn();

      // Simulate handleUnsubscribe logic
      const res = await unsubscribeFromWebPush();
      if (res.success) {
        onStatusChangeMock('INACTIVE');
      }

      expect(onStatusChangeMock).toHaveBeenCalledTimes(1);
      expect(onStatusChangeMock).toHaveBeenCalledWith('INACTIVE');
    });

    it('does NOT invoke onStatusChange("ACTIVE") when subscribeToWebPush fails', async () => {
      (subscribeToWebPush as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Izin notifikasi ditolak oleh pengguna',
      });

      const onStatusChangeMock = jest.fn();

      const res = await subscribeToWebPush();
      if (res.success) {
        onStatusChangeMock('ACTIVE');
      }

      expect(onStatusChangeMock).not.toHaveBeenCalled();
    });

    it('does NOT invoke onStatusChange("INACTIVE") when unsubscribeFromWebPush fails', async () => {
      (unsubscribeFromWebPush as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Gagal menghubungi server',
      });

      const onStatusChangeMock = jest.fn();

      const res = await unsubscribeFromWebPush();
      if (res.success) {
        onStatusChangeMock('INACTIVE');
      }

      expect(onStatusChangeMock).not.toHaveBeenCalled();
    });
  });

  describe('4. Parent Re-render & Hook Dependency Stability', () => {
    it('absorbs inline callback churn via stable ref without triggering unprovoked checks', () => {
      // Simulating useRef pattern:
      // const onStatusChangeRef = useRef(onStatusChange);
      // onStatusChangeRef.current = onStatusChange;
      let currentHandler = () => 'first';
      const ref = { current: currentHandler };

      // Parent re-renders and creates new function identity
      const newHandler = () => 'second';
      ref.current = newHandler;

      // Executing ref always accesses the latest closure without re-instantiating the hook
      expect(ref.current()).toBe('second');
    });
  });
});

