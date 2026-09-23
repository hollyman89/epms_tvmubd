/**
 * Phase H: Notification & Inbox Realtime Synchronization Utilities
 * 
 * Provides leak-free registration and specific cleanup of socket and window
 * event listeners for NotificationBell and Inbox components.
 */

export interface NotificationSyncOptions {
  socket: {
    on: (event: string, callback: (...args: any[]) => void) => void;
    off: (event: string, callback: (...args: any[]) => void) => void;
  } | null | undefined;
  targetWindow?: {
    addEventListener: (event: string, listener: (...args: any[]) => void) => void;
    removeEventListener: (event: string, listener: (...args: any[]) => void) => void;
  };
  onNewNotification?: (payload?: any) => void;
  onReconnectResync?: () => void;
}

/**
 * Sets up online socket listener ('new_notification') and reconnect-resync listener
 * ('epms:reconnect-resync') for the NotificationBell component.
 * 
 * Returns a dedicated unmount cleanup function.
 */
export function setupNotificationBellSync(options: NotificationSyncOptions): () => void {
  const { socket, onNewNotification, onReconnectResync } = options;
  const win = options.targetWindow || (typeof window !== 'undefined' ? window : undefined);

  const handleNewNotification = (payload: any) => {
    if (onNewNotification) {
      onNewNotification(payload);
    }
  };

  const handleReconnectResync = () => {
    if (onReconnectResync) {
      onReconnectResync();
    }
  };

  if (socket && onNewNotification) {
    socket.on('new_notification', handleNewNotification);
  }

  if (win && onReconnectResync) {
    win.addEventListener('epms:reconnect-resync', handleReconnectResync);
  }

  return () => {
    if (socket && onNewNotification) {
      socket.off('new_notification', handleNewNotification);
    }
    if (win && onReconnectResync) {
      win.removeEventListener('epms:reconnect-resync', handleReconnectResync);
    }
  };
}

/**
 * Sets up online socket listener ('new_notification') and reconnect-resync listener
 * ('epms:reconnect-resync') for the Inbox component.
 * 
 * Triggers authoritative refreshes while avoiding duplicate listeners.
 * Returns a dedicated unmount cleanup function.
 */
export function setupInboxSync(options: NotificationSyncOptions): () => void {
  const { socket, onNewNotification, onReconnectResync } = options;
  const win = options.targetWindow || (typeof window !== 'undefined' ? window : undefined);

  const handleNewNotification = (payload: any) => {
    if (onNewNotification) {
      onNewNotification(payload);
    }
  };

  const handleReconnectResync = () => {
    if (onReconnectResync) {
      onReconnectResync();
    }
  };

  if (socket && onNewNotification) {
    socket.on('new_notification', handleNewNotification);
  }

  if (win && onReconnectResync) {
    win.addEventListener('epms:reconnect-resync', handleReconnectResync);
  }

  return () => {
    if (socket && onNewNotification) {
      socket.off('new_notification', handleNewNotification);
    }
    if (win && onReconnectResync) {
      win.removeEventListener('epms:reconnect-resync', handleReconnectResync);
    }
  };
}
