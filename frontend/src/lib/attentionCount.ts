import { TodoItem } from '@/services/inbox.service';

export interface NotificationLike {
  id: number;
  isRead?: boolean;
  actionLink?: string | null;
  metaData?: any;
}

/**
 * Pure predicate to determine if an unread notification represents the exact
 * same actionable business event as an item in the user's To-Do list.
 *
 * Canonical deduplication identity rules (ACTIVITY-BELL-R1):
 * 1. notification.metaData.reference_type === 'WORKFLOW_TASK' and
 *    (notification.metaData.reference_id === task.taskId || notification.metaData.taskId === task.taskId)
 * 2. notification.metaData.taskId matches task.taskId
 * 3. Exact matching actionTarget / actionLink (e.g. /governance/tasks?taskId=...)
 * 4. Specific domain keys:
 *    - CONTRACT: notification.metaData.contractId === task.entityId
 *    - PAYMENT_REQUEST: notification.metaData.paymentRequestId === task.entityId
 *    - TENDER: notification.metaData.tenderId === task.entityId
 *
 * Strictly NEVER matches based on title, message, label, or timestamp coincidence.
 */
export function isNotificationDuplicateOfTodo(
  notif: NotificationLike,
  todos: TodoItem[]
): boolean {
  if (!notif || !Array.isArray(todos) || todos.length === 0) {
    return false;
  }

  const meta = notif.metaData;
  const notifActionLink = typeof notif.actionLink === 'string' ? notif.actionLink.trim() : null;

  for (const todo of todos) {
    const todoTaskId = todo.taskId !== undefined && todo.taskId !== null ? Number(todo.taskId) : null;
    const todoSourceId = Number(todo.sourceId);

    // Rule 1 & 2: Canonical WORKFLOW_TASK reference
    if (meta && typeof meta === 'object') {
      const refType = String(meta.reference_type || meta.referenceType || '').toUpperCase();
      const refId = meta.reference_id ?? meta.referenceId;
      const metaTaskId = meta.taskId ?? meta.task_id;

      if (refType === 'WORKFLOW_TASK') {
        if (
          refId !== undefined &&
          refId !== null &&
          ((todoTaskId !== null && Number(refId) === todoTaskId) ||
            (!Number.isNaN(todoSourceId) && Number(refId) === todoSourceId))
        ) {
          return true;
        }
        if (
          metaTaskId !== undefined &&
          metaTaskId !== null &&
          ((todoTaskId !== null && Number(metaTaskId) === todoTaskId) ||
            (!Number.isNaN(todoSourceId) && Number(metaTaskId) === todoSourceId))
        ) {
          return true;
        }
      }

      if (metaTaskId !== undefined && metaTaskId !== null && todoTaskId !== null) {
        if (Number(metaTaskId) === todoTaskId) {
          return true;
        }
      }

      // Rule 4: Domain specific matching
      if (
        meta.contractId !== undefined &&
        meta.contractId !== null &&
        todo.entityType === 'CONTRACT' &&
        Number(meta.contractId) === Number(todo.entityId)
      ) {
        return true;
      }

      if (
        meta.paymentRequestId !== undefined &&
        meta.paymentRequestId !== null &&
        todo.entityType === 'PAYMENT_REQUEST' &&
        Number(meta.paymentRequestId) === Number(todo.entityId)
      ) {
        return true;
      }

      if (
        meta.tenderId !== undefined &&
        meta.tenderId !== null &&
        todo.entityType === 'TENDER' &&
        Number(meta.tenderId) === Number(todo.entityId)
      ) {
        return true;
      }

      if (
        (meta.serviceClaimId !== undefined && meta.serviceClaimId !== null) ||
        (meta.claimId !== undefined && meta.claimId !== null)
      ) {
        const claimId = meta.serviceClaimId ?? meta.claimId;
        if (
          (todo.entityType === 'SERVICE_CLAIM' || todo.sourceType === 'DOMAIN_SERVICE_CLAIM') &&
          Number(claimId) === Number(todo.entityId)
        ) {
          return true;
        }
      }

      if (
        (meta.closureId !== undefined && meta.closureId !== null) ||
        (meta.projectClosureId !== undefined && meta.projectClosureId !== null)
      ) {
        const closureId = meta.closureId ?? meta.projectClosureId;
        if (
          (todo.entityType === 'PROJECT_CLOSURE' || todo.sourceType === 'DOMAIN_PROJECT_CLOSURE') &&
          Number(closureId) === Number(todo.entityId)
        ) {
          return true;
        }
      }
    }

    // Rule 3: Canonical actionLink deep-link identity
    const todoTarget = typeof todo.actionTarget === 'string' ? todo.actionTarget.trim() : null;
    if (notifActionLink && todoTarget && notifActionLink === todoTarget) {
      return true;
    }
  }

  return false;
}

export interface AttentionCountParams {
  todoCount: number;
  unreadNotificationCount: number;
  todos?: TodoItem[];
  unreadNotifications?: NotificationLike[];
}

/**
 * Calculates the overall Attention Badge count for the Header Bell.
 * Formula:
 *   ATTENTION BADGE = ACTIONABLE TUGAS + UNREAD INFORMATIONAL NOTIFICATIONS - DUPLICATE BUSINESS EVENTS
 *
 * Guarantees:
 * - Riwayat is strictly not passed and does not contribute.
 * - Negative values clamped to 0.
 * - Never double-counts duplicate workflow task notifications.
 */
export function calculateAttentionCount(params: AttentionCountParams): number {
  const safeTodoCount = Math.max(0, Number(params.todoCount) || 0);
  const safeUnreadNotifCount = Math.max(0, Number(params.unreadNotificationCount) || 0);

  if (safeTodoCount === 0 && safeUnreadNotifCount === 0) {
    return 0;
  }

  const todos = Array.isArray(params.todos) ? params.todos : [];
  const rawNotifications = Array.isArray(params.unreadNotifications) ? params.unreadNotifications : [];

  // Filter only unread items
  const unreadNotifications = rawNotifications.filter((n) => !n.isRead);

  let duplicateCount = 0;
  if (todos.length > 0 && unreadNotifications.length > 0) {
    for (const notif of unreadNotifications) {
      if (isNotificationDuplicateOfTodo(notif, todos)) {
        duplicateCount++;
      }
    }
  }

  // Deduplicate from unread notifications so actionable task remains SSOT
  const effectiveUnread = Math.max(0, safeUnreadNotifCount - duplicateCount);
  return safeTodoCount + effectiveUnread;
}
