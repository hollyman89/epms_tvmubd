/**
 * Phase W8-CP3: Legal Review Realtime Synchronization Helper
 * 
 * Provides leak-free registration and cleanup of canonical window event listeners
 * ('epms:business-sync', 'epms:reconnect-resync') for Legal Review page.
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

export function shouldRefreshLegalReview(
  envelope: CanonicalEventEnvelope | null | undefined
): boolean {
  if (!envelope || typeof envelope.eventName !== 'string') return false;
  const name = envelope.eventName;

  return (
    name.startsWith('legal.') ||
    name === 'marketing.spk.uploaded' ||
    name.startsWith('system.sla.')
  );
}

export interface LegalReviewSyncOptions {
  onRefresh: () => void;
  targetWindow?: {
    addEventListener: (event: string, listener: (e: any) => void) => void;
    removeEventListener: (event: string, listener: (e: any) => void) => void;
  };
}

export function setupLegalReviewSync(options: LegalReviewSyncOptions): () => void {
  const { onRefresh } = options;
  const win = options.targetWindow || (typeof window !== 'undefined' ? window : undefined);
  if (!win) return () => {};

  const handleBusinessSync = (event: any) => {
    const envelope = event?.detail as CanonicalEventEnvelope;
    if (shouldRefreshLegalReview(envelope)) {
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
