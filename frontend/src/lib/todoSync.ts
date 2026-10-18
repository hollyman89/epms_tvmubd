/**
 * Phase N1: To-Do Realtime Synchronization Utilities
 * 
 * Provides leak-free registration and specific cleanup of canonical
 * window event listeners ('epms:business-sync', 'epms:reconnect-resync')
 * for actionable To-Do tasks in Inbox and NotificationBell.
 */

export interface CanonicalEventEnvelope {
  eventId?: string;
  eventName?: string;
  eventVersion?: number;
  occurredAt?: string;
  aggregateType?: string;
  aggregateId?: number | string;
  projectId?: number | string | null;
  actor?: any;
  payload?: any;
}

/**
 * Predicate to decide if a canonical event invalidates/refetches actionable To-Dos.
 * Returns true if the event represents workflow task state changes or actionable domain queues.
 */
export function shouldRefreshTodos(
  envelope: CanonicalEventEnvelope | null | undefined
): boolean {
  if (!envelope || typeof envelope.eventName !== 'string') return false;
  const name = envelope.eventName;

  return (
    name.startsWith('workflow.') ||
    name.startsWith('procurement.package.') ||
    name === 'procurement.po.issued' ||
    name.startsWith('project.') ||
    name.startsWith('legal.') ||
    name.startsWith('marketing.tender.') ||
    name === 'marketing.spk.uploaded' ||
    name.startsWith('finance.payment')
  );
}

export interface TodoSyncOptions {
  onRefresh: () => void;
  targetWindow?: {
    addEventListener: (event: string, listener: (e: any) => void) => void;
    removeEventListener: (event: string, listener: (e: any) => void) => void;
  };
}

/**
 * Sets up business sync listener ('epms:business-sync') and reconnect listener
 * ('epms:reconnect-resync') for actionable To-Do synchronization.
 * 
 * Returns a dedicated unmount cleanup function.
 */
export function setupTodoSync(options: TodoSyncOptions): () => void {
  const { onRefresh } = options;
  const win = options.targetWindow || (typeof window !== 'undefined' ? window : undefined);
  if (!win) return () => {};

  const handleBusinessSync = (event: any) => {
    const envelope = event?.detail as CanonicalEventEnvelope;
    if (shouldRefreshTodos(envelope)) {
      onRefresh();
    }
  };

  const handleReconnectResync = () => {
    onRefresh();
  };

  win.addEventListener('epms:business-sync', handleBusinessSync);
  win.addEventListener('epms:reconnect-resync', handleReconnectResync);

  return () => {
    win.removeEventListener('epms:business-sync', handleBusinessSync);
    win.removeEventListener('epms:reconnect-resync', handleReconnectResync);
  };
}
