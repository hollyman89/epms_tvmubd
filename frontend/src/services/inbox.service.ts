import { apiClient } from '@/lib/axios';

export interface TodoItem {
  todoId: string;
  sourceType:
    | 'WORKFLOW_TASK'
    | 'DOMAIN_CONTRACT'
    | 'DOMAIN_TENDER'
    | 'DOMAIN_PAYMENT_REQUEST'
    | 'DOMAIN_MARKETING_ACTION'
    | 'DOMAIN_PROGRESS_CLAIM'
    | 'DOMAIN_SERVICE_CLAIM'
    | 'DOMAIN_PROJECT_CLOSURE'
    | 'DOMAIN_PURCHASE_REQUEST'
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
  contractNumber?: string;
  vendorName?: string;
  submittedByName?: string;
  returnedByName?: string;
  returnReason?: string;
}

export interface InboxSummary {
  todoCount: number;
  unreadNotificationCount: number;
}

export interface HistoryItem {
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

export class InboxService {
  /**
   * Retrieves pending actionable To-Dos for current authenticated user.
   */
  static async getTodos(): Promise<TodoItem[]> {
    const res = await apiClient.get('/inbox/todos');
    const rawData = res.data?.data?.data || res.data?.data || [];
    return Array.isArray(rawData) ? rawData : [];
  }

  /**
   * Retrieves historical workflow tasks for current authenticated user. Strictly read-only.
   */
  static async getHistory(): Promise<HistoryItem[]> {
    const res = await apiClient.get('/inbox/history');
    const rawData = res.data?.data?.data || res.data?.data || [];
    return Array.isArray(rawData) ? rawData : [];
  }

  /**
   * Retrieves count summary: actionable To-Dos vs unread informational notifications.
   */
  static async getSummary(): Promise<InboxSummary> {
    const res = await apiClient.get('/inbox/summary');
    const raw = res.data?.data?.data || res.data?.data || {};
    const todoCount = Number(raw.todoCount);
    const unreadNotificationCount = Number(raw.unreadNotificationCount);
    return {
      todoCount: Number.isFinite(todoCount) && todoCount >= 0 ? todoCount : 0,
      unreadNotificationCount:
        Number.isFinite(unreadNotificationCount) && unreadNotificationCount >= 0
          ? unreadNotificationCount
          : 0,
    };
  }
}
