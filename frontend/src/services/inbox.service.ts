import { apiClient } from '@/lib/axios';

export interface TodoItem {
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
  actionTarget: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InboxSummary {
  todoCount: number;
  unreadNotificationCount: number;
}

export class InboxService {
  /**
   * Retrieves pending actionable To-Dos for current authenticated user.
   */
  static async getTodos(): Promise<TodoItem[]> {
    const res = await apiClient.get('/inbox/todos');
    const data = res.data?.data;
    return Array.isArray(data) ? data : [];
  }

  /**
   * Retrieves count summary: actionable To-Dos vs unread informational notifications.
   */
  static async getSummary(): Promise<InboxSummary> {
    const res = await apiClient.get('/inbox/summary');
    return res.data?.data || { todoCount: 0, unreadNotificationCount: 0 };
  }
}
