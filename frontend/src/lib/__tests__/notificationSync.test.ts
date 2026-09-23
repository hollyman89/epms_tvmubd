import { setupNotificationBellSync, setupInboxSync } from '../notificationSync';

describe('Phase H: Notification & Inbox Realtime Sync', () => {
  let mockSocket: {
    on: jest.Mock;
    off: jest.Mock;
  };
  let mockWindow: {
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
  };
  let socketListeners: Record<string, Function>;
  let windowListeners: Record<string, Function>;

  beforeEach(() => {
    socketListeners = {};
    windowListeners = {};

    mockSocket = {
      on: jest.fn((event: string, callback: Function) => {
        socketListeners[event] = callback;
      }),
      off: jest.fn((event: string, callback: Function) => {
        if (socketListeners[event] === callback) {
          delete socketListeners[event];
        }
      }),
    };

    mockWindow = {
      addEventListener: jest.fn((event: string, listener: Function) => {
        windowListeners[event] = listener;
      }),
      removeEventListener: jest.fn((event: string, listener: Function) => {
        if (windowListeners[event] === listener) {
          delete windowListeners[event];
        }
      }),
    };
  });

  describe('setupNotificationBellSync', () => {
    it('1. registers new_notification on socket and invokes onNewNotification', () => {
      const onNewNotification = jest.fn();
      const onReconnectResync = jest.fn();

      const unsubscribe = setupNotificationBellSync({
        socket: mockSocket,
        targetWindow: mockWindow,
        onNewNotification,
        onReconnectResync,
      });

      expect(mockSocket.on).toHaveBeenCalledWith('new_notification', expect.any(Function));

      // Trigger socket event
      const fakeNotif = { id: 101, title: 'New PO', message: 'PO #123 generated' };
      socketListeners['new_notification'](fakeNotif);

      expect(onNewNotification).toHaveBeenCalledTimes(1);
      expect(onNewNotification).toHaveBeenCalledWith(fakeNotif);

      unsubscribe();
    });

    it('2. listens to epms:reconnect-resync and triggers unread-count authoritative refresh', () => {
      const onNewNotification = jest.fn();
      const onReconnectResync = jest.fn();

      const unsubscribe = setupNotificationBellSync({
        socket: mockSocket,
        targetWindow: mockWindow,
        onNewNotification,
        onReconnectResync,
      });

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));

      // Dispatch browser reconnect-resync event via mock
      windowListeners['epms:reconnect-resync']();

      expect(onReconnectResync).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('3. listener cleanup removes socket and window handlers cleanly (no duplicates)', () => {
      const onNewNotification = jest.fn();
      const onReconnectResync = jest.fn();

      const unsubscribe = setupNotificationBellSync({
        socket: mockSocket,
        targetWindow: mockWindow,
        onNewNotification,
        onReconnectResync,
      });

      expect(mockSocket.on).toHaveBeenCalledTimes(1);
      expect(mockWindow.addEventListener).toHaveBeenCalledTimes(1);

      // Unmount / cleanup
      unsubscribe();

      expect(mockSocket.off).toHaveBeenCalledWith('new_notification', expect.any(Function));
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));
    });
  });

  describe('setupInboxSync', () => {
    it('4. Inbox new_notification triggers current-data refresh', () => {
      const onNewNotification = jest.fn();
      const onReconnectResync = jest.fn();

      const unsubscribe = setupInboxSync({
        socket: mockSocket,
        targetWindow: mockWindow,
        onNewNotification,
        onReconnectResync,
      });

      expect(mockSocket.on).toHaveBeenCalledWith('new_notification', expect.any(Function));

      socketListeners['new_notification']({ id: 202 });

      expect(onNewNotification).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('5. Inbox reconnect-resync triggers authoritative refresh and unsubscription cleans up', () => {
      const onNewNotification = jest.fn();
      const onReconnectResync = jest.fn();

      const unsubscribe = setupInboxSync({
        socket: mockSocket,
        targetWindow: mockWindow,
        onNewNotification,
        onReconnectResync,
      });

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));

      windowListeners['epms:reconnect-resync']();
      expect(onReconnectResync).toHaveBeenCalledTimes(1);

      unsubscribe();

      expect(mockSocket.off).toHaveBeenCalledWith('new_notification', expect.any(Function));
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));
    });
  });
});
