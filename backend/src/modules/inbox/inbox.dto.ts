export class TodoReadModelDto {
  todoId: string;
  sourceType:
    | 'WORKFLOW_TASK'
    | 'DOMAIN_CONTRACT'
    | 'DOMAIN_TENDER'
    | 'DOMAIN_PAYMENT_REQUEST'
    | 'DOMAIN_PROGRESS_CLAIM'
    | 'DOMAIN_SERVICE_CLAIM'
    | 'DOMAIN_PROJECT_CLOSURE'
    | 'DOMAIN_PURCHASE_REQUEST'
    | 'DOMAIN_MARKETING_ACTION'
    | 'DOMAIN_INVOICE';
  sourceId: string;
  taskId?: number;
  assignedUserId?: number;
  assignedRole?: string;
  entityType: string;
  entityId: number;
  projectId?: number;
  actionType: string;
  actionTarget: string | null;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt?: string;
  projectName?: string;
  customerName?: string;
  submittedByName?: string;
  returnedByName?: string;
  returnReason?: string;
  ctaLabel?: string;
}

export class InboxSummaryDto {
  todoCount: number;
  unreadNotificationCount: number;
}

export class HistoryItemDto {
  historyId: string;
  taskId: number;
  workflowInstanceId: number;
  workflowKey?: string;
  taskKey: string;
  entityType: string;
  entityId: number;
  projectId?: number;
  projectName?: string;
  customerName?: string;
  contractNumber?: string;
  vendorName?: string;
  title: string;
  status: string;
  action?: string;
  decidedBy?: number;
  decidedByName?: string;
  decidedAt?: string;
  comments?: string;
  dueAt?: string;
  createdAt: string;
  completedAt?: string;
}
