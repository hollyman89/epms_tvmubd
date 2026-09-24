export interface TodoActionContext {
  entityType?: string;
  entityId?: number | string;
  actionType?: string;
  projectId?: number | string;
  actionTarget?: string;
}

/**
 * Resolves the canonical route target for an actionable To-Do item.
 * Centralized mapping foundation for N1.
 */
export function resolveTodoActionTarget(item: TodoActionContext): string {
  // If backend provided an authoritative relative target, use it
  if (item.actionTarget && item.actionTarget.startsWith('/')) {
    return item.actionTarget;
  }

  const entityType = String(item.entityType || '').toUpperCase();
  const actionType = String(item.actionType || '').toUpperCase();

  if (entityType === 'CONTRACT' || actionType === 'LEGAL_REVIEW') {
    return item.entityId ? `/legal/review?contractId=${item.entityId}` : '/legal/review';
  }

  if (entityType === 'TENDER' || actionType === 'GO_NOGO_APPROVAL') {
    return item.entityId ? `/sales/tenders/${item.entityId}` : '/sales';
  }

  if (entityType === 'PROJECT' || actionType === 'MANAGEMENT_REVIEW') {
    return '/project-delivery';
  }

  if (entityType === 'PURCHASE_REQUEST' || actionType === 'PURCHASE_REQUEST_APPROVAL') {
    return '/procurement';
  }

  return '/inbox';
}
