export class TodoReadModelDto {
  todoId: string;
  sourceType: 'WORKFLOW_TASK' | 'DOMAIN_CONTRACT' | 'DOMAIN_TENDER';
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
}

export class InboxSummaryDto {
  todoCount: number;
  unreadNotificationCount: number;
}
