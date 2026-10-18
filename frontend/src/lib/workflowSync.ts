/**
 * Phase I-B: Workflow Realtime Synchronization Helpers
 * 
 * Provides leak-free, testable registration and specific cleanup
 * of canonical window event listeners ('epms:business-sync', 'epms:reconnect-resync')
 * for PmOperationalPlanModal, PmOperationalPlanReviewModal, and ProjectDeliveryRoute.
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
 * Predicate to decide if a canonical event requires an Operational Plan modal refresh.
 * 
 * Returns true if:
 * 1. eventName starts with 'workflow.'
 * 2. projectId matches canonicalProjectId, or projectId is null/undefined (bounded fallback).
 */
export function shouldRefreshOperationalPlan(
  envelope: CanonicalEventEnvelope | null | undefined,
  canonicalProjectId: number
): boolean {
  if (!envelope || typeof envelope.eventName !== 'string') return false;
  if (!envelope.eventName.startsWith('workflow.')) return false;

  if (envelope.projectId !== undefined && envelope.projectId !== null) {
    return Number(envelope.projectId) === canonicalProjectId;
  }
  return true;
}

/**
 * Predicate to decide if a canonical event requires a Project Delivery workspace refresh.
 * 
 * Returns true if eventName starts with 'workflow.', 'project.', or is 'legal.contract.approved'.
 */
export function shouldRefreshProjectDelivery(
  envelope: CanonicalEventEnvelope | null | undefined
): boolean {
  if (!envelope || typeof envelope.eventName !== 'string') return false;
  return (
    envelope.eventName.startsWith('workflow.') ||
    envelope.eventName.startsWith('project.') ||
    envelope.eventName === 'legal.contract.approved'
  );
}

export interface OperationalPlanSyncOptions {
  canonicalProjectId: number;
  onRefresh: () => void;
  targetWindow?: {
    addEventListener: (event: string, listener: (e: any) => void) => void;
    removeEventListener: (event: string, listener: (e: any) => void) => void;
  };
}

export function setupOperationalPlanSync(options: OperationalPlanSyncOptions): () => void {
  const { canonicalProjectId, onRefresh } = options;
  const win = options.targetWindow || (typeof window !== 'undefined' ? window : undefined);
  if (!win || canonicalProjectId <= 0) return () => {};

  const handleSync = (e: any) => {
    const detail = e?.detail as CanonicalEventEnvelope | undefined;
    if (shouldRefreshOperationalPlan(detail, canonicalProjectId)) {
      onRefresh();
    }
  };

  const handleReconnect = () => {
    onRefresh();
  };

  win.addEventListener('epms:business-sync', handleSync);
  win.addEventListener('epms:reconnect-resync', handleReconnect);

  return () => {
    win.removeEventListener('epms:business-sync', handleSync);
    win.removeEventListener('epms:reconnect-resync', handleReconnect);
  };
}

export interface ProjectDeliverySyncOptions {
  onRefresh: () => void;
  targetWindow?: {
    addEventListener: (event: string, listener: (e: any) => void) => void;
    removeEventListener: (event: string, listener: (e: any) => void) => void;
  };
}

export function setupProjectDeliverySync(options: ProjectDeliverySyncOptions): () => void {
  const { onRefresh } = options;
  const win = options.targetWindow || (typeof window !== 'undefined' ? window : undefined);
  if (!win) return () => {};

  const handleSync = (e: any) => {
    const detail = e?.detail as CanonicalEventEnvelope | undefined;
    if (shouldRefreshProjectDelivery(detail)) {
      onRefresh();
    }
  };

  const handleReconnect = () => {
    onRefresh();
  };

  win.addEventListener('epms:business-sync', handleSync);
  win.addEventListener('epms:reconnect-resync', handleReconnect);

  return () => {
    win.removeEventListener('epms:business-sync', handleSync);
    win.removeEventListener('epms:reconnect-resync', handleReconnect);
  };
}
