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

export interface NotificationTargetContext {
  actionLink?: string | null;
  metaData?: Record<string, any> | null;
  [key: string]: any;
}

/**
 * PRE-W10 NOTIF-DR1:
 * Resolves the canonical deep-link destination URL for notifications.
 * 
 * Rules:
 * 1. Prioritize canonical actionLink when present and valid.
 *    - Gracefully normalizes historical dead routes (/projects/pos/:id, /finance/payments/:id).
 * 2. If actionLink is absent/empty/dummy, derive route only from locked canonical metadata fields.
 * 3. Returns null if no valid target exists (caller can mark as read without navigating).
 * 4. Strictly avoids speculative heuristic routing or artificial fallbacks.
 */
export function resolveNotificationTarget(item: NotificationTargetContext | null | undefined): string | null {
  if (!item) return null;

  // 1. Explicit actionLink / actionTarget priority
  const actionLink = item.actionLink || (item as any).actionTarget;
  if (actionLink && typeof actionLink === 'string') {
    const trimmed = actionLink.trim();
    if (trimmed && trimmed !== '#' && trimmed !== 'undefined' && trimmed !== 'null') {
      // Historical dead route normalization:
      if (trimmed.startsWith('/projects/pos/')) {
        const poId = trimmed.replace('/projects/pos/', '').trim();
        return poId ? `/procurement?tab=po&poId=${poId}` : '/procurement?tab=po';
      }
      if (trimmed.startsWith('/finance/payments/')) {
        return '/finance/payments';
      }
      // Normalize historical C4 /workflow target for closure to /governance/tasks
      if (
        trimmed === '/workflow' &&
        (item.metaData?.category === 'PROJECT_CLOSURE' ||
          item.metaData?.reference_type === 'PROJECT_CLOSURE' ||
          item.metaData?.closureId ||
          item.metaData?.closure_id)
      ) {
        const pId = item.metaData?.projectId || item.metaData?.project_id;
        return pId ? `/governance/tasks?projectId=${pId}` : '/governance/tasks';
      }
      // Normalize historical /project? (service claim or project notification) to /project-delivery?
      if (trimmed.startsWith('/project?')) {
        return trimmed.replace('/project?', '/project-delivery?');
      }
      if (trimmed.startsWith('/')) {
        return trimmed;
      }
    }
  }

  // 2. Derive route strictly from locked canonical metadata
  const meta = item.metaData;
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  // Tender / Lead: /sales/tenders/:id
  const leadOrTenderId = meta.lead_id || meta.tenderId || meta.tender_id || (
    (meta.reference_type === 'LEAD' || meta.reference_type === 'TENDER') ? meta.reference_id : null
  );
  if (leadOrTenderId) {
    return `/sales/tenders/${leadOrTenderId}`;
  }

  // Contract: /legal/review?contractId=:id
  const contractId = meta.contractId || meta.contract_id || (
    meta.reference_type === 'CONTRACT' ? meta.reference_id : null
  );
  if (contractId) {
    return `/legal/review?contractId=${contractId}`;
  }

  // Project Closure:
  // Actionable notifications (PM submit -> HOO, HOO approve -> Director) route to /governance/tasks (Approval Center)
  // Informational / return notifications route to Project Workspace section=closure
  if (
    meta.category === 'PROJECT_CLOSURE' ||
    meta.reference_type === 'PROJECT_CLOSURE' ||
    meta.closureId ||
    meta.closure_id
  ) {
    const isActionable =
      meta.actionType === 'CLOSURE_SUBMITTED' ||
      meta.actionType === 'CLOSURE_HOO_APPROVED' ||
      meta.action_type === 'CLOSURE_SUBMITTED' ||
      meta.action_type === 'CLOSURE_HOO_APPROVED';

    const pId = meta.projectId || meta.project_id;

    if (isActionable) {
      return pId ? `/governance/tasks?projectId=${pId}` : '/governance/tasks';
    }

    if (pId) {
      return `/project-delivery?view=workspace&projectId=${pId}&section=closure`;
    }
    return '/governance/tasks';
  }

  // Project Progress Claim: /project-delivery?view=workspace&projectId=:id&section=tasks&progressClaimId=:id
  if (
    meta.category === 'PROJECT_PROGRESS_CLAIM' ||
    meta.reference_type === 'PROJECT_PROGRESS_CLAIM' ||
    meta.progressClaimId ||
    meta.progress_claim_id
  ) {
    const pcId =
      meta.progressClaimId ||
      meta.progress_claim_id ||
      (meta.reference_type === 'PROJECT_PROGRESS_CLAIM' ? meta.reference_id : null);
    const pId = meta.projectId || meta.project_id;
    if (pcId && pId) {
      return `/project-delivery?view=workspace&projectId=${pId}&section=tasks&progressClaimId=${pcId}`;
    }
  }

  // Service Claim: /project-delivery?projectId=:id&serviceClaimId=:serviceClaimId (or legacy claimId)
  if (
    meta.category === 'SERVICE_CLAIM' ||
    meta.reference_type === 'SERVICE_CLAIM' ||
    meta.serviceClaimId ||
    meta.service_claim_id ||
    meta.claimId ||
    meta.claim_id
  ) {
    const scId =
      meta.serviceClaimId ||
      meta.service_claim_id ||
      meta.claimId ||
      meta.claim_id ||
      (meta.reference_type === 'SERVICE_CLAIM' ? meta.reference_id : null);
    const pId = meta.projectId || meta.project_id;
    const paramKey = meta.serviceClaimId || meta.service_claim_id ? 'serviceClaimId' : 'claimId';
    if (scId && pId) {
      return `/project-delivery?projectId=${pId}&${paramKey}=${scId}`;
    }
    if (scId) {
      return `/project-delivery?${paramKey}=${scId}`;
    }
    if (pId) {
      return `/project-delivery?projectId=${pId}`;
    }
  }

  // Project: /project-delivery?projectId=:id
  const projectId = meta.projectId || meta.project_id || (
    meta.reference_type === 'PROJECT' ? meta.reference_id : null
  );
  if (projectId) {
    return `/project-delivery?projectId=${projectId}`;
  }

  // PO: /procurement?tab=po&poId=:id
  const poId = meta.poId || meta.po_id || (
    meta.reference_type === 'PO' ? meta.reference_id : null
  );
  if (poId) {
    return `/procurement?tab=po&poId=${poId}`;
  }

  // PR: /procurement?tab=pr&prId=:id
  const prId = meta.prId || meta.pr_id || (
    meta.reference_type === 'PR' ? meta.reference_id : null
  );
  if (prId) {
    return `/procurement?tab=pr&prId=${prId}`;
  }

  // Invoice: /finance/invoices
  if (meta.invoiceId || meta.invoice_id || meta.reference_type === 'INVOICE') {
    return '/finance/invoices';
  }

  // Payment: /finance/payments
  if (
    meta.paymentId ||
    meta.payment_id ||
    meta.reference_type === 'PAYMENT' ||
    meta.actionType === 'PAYMENT_RECORDED' ||
    meta.action_type === 'PAYMENT_RECORDED'
  ) {
    return '/finance/payments';
  }

  return null;
}

