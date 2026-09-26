export interface TodoActionContext {
  actionTarget?: string | null;
  [key: string]: any;
}

/**
 * Validates and normalizes the backend-authoritative actionTarget.
 * Backend Inbox domain is the SSOT for todo.actionTarget.
 * Returns safe relative URL if valid, or null if unresolved / unavailable.
 * Strictly rejects artificial '/inbox' fallback or non-relative paths.
 */
export function resolveTodoActionTarget(item: TodoActionContext | null | undefined): string | null {
  if (!item) return null;
  const target = item.actionTarget;
  if (!target || typeof target !== 'string') {
    return null;
  }

  const trimmed = target.trim();
  // Valid relative path, rejecting artificial '/inbox' fallback
  if (trimmed.startsWith('/') && trimmed !== '/inbox') {
    return trimmed;
  }

  return null;
}

export {
  navigateTodoAction,
  parseSalesDrawerTarget,
  setPendingSalesDrawerRequest,
  consumePendingSalesDrawerRequest,
  clearPendingSalesDrawerRequest,
  type PendingSalesDrawerRequest,
} from './salesNavigation';
