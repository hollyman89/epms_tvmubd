import { InboxService } from '../inbox.service';
import { apiClient } from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

describe('InboxService (Frontend API Client)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTodos', () => {
    const mockTodos = [
      {
        todoId: 'wf-1',
        sourceType: 'WORKFLOW_TASK' as const,
        sourceId: '1',
        entityType: 'PURCHASE_REQUEST',
        entityId: 10,
        actionType: 'PURCHASE_REQUEST_APPROVAL',
        actionTarget: '/procurement',
        title: 'Review PR #10',
        status: 'PENDING',
        createdAt: '2026-09-24T00:00:00Z',
      },
    ];

    it('1. Single-wrapped response: calls GET /inbox/todos and returns array of todos', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { data: mockTodos },
      });

      const result = await InboxService.getTodos();

      expect(apiClient.get).toHaveBeenCalledWith('/inbox/todos');
      expect(result).toEqual(mockTodos);
    });

    it('2. Double-wrapped response (TransformInterceptor): unwrap res.data.data.data correctly', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          meta: { code: 200, status: 'success', message: 'Request successful' },
          data: {
            statusCode: 200,
            message: 'Pending actionable tasks retrieved successfully',
            data: mockTodos,
          },
        },
      });

      const result = await InboxService.getTodos();

      expect(apiClient.get).toHaveBeenCalledWith('/inbox/todos');
      expect(result).toEqual(mockTodos);
    });

    it('3. Empty response: returns empty array when data is missing or not an array', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: null,
      });

      const result = await InboxService.getTodos();
      expect(result).toEqual([]);

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { data: null },
      });

      const result2 = await InboxService.getTodos();
      expect(result2).toEqual([]);
    });

    it('4. GO_NOGO_APPROVAL item: preserves todoId, sourceType, and actionTarget in double-wrapped response', async () => {
      const gonogoTodo = {
        todoId: 'wf-50',
        sourceType: 'WORKFLOW_TASK' as const,
        sourceId: '50',
        taskId: 50,
        assignedRole: 'DIRECTOR',
        entityType: 'TENDER',
        entityId: 33,
        actionType: 'GO_NOGO_APPROVAL',
        actionTarget: '/sales?tab=1&tenderId=33&action=go-nogo',
        title: 'Persetujuan GO / NO GO: Tender #33',
        status: 'PENDING',
        createdAt: '2026-09-25T14:00:30.000Z',
        updatedAt: '2026-09-25T14:00:30.000Z',
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          meta: { code: 200, status: 'success', message: 'Request successful' },
          data: {
            statusCode: 200,
            message: 'Pending actionable tasks retrieved successfully',
            data: [gonogoTodo],
          },
        },
      });

      const result = await InboxService.getTodos();

      expect(result).toHaveLength(1);
      expect(result[0].todoId).toBe('wf-50');
      expect(result[0].sourceType).toBe('WORKFLOW_TASK');
      expect(result[0].entityType).toBe('TENDER');
      expect(result[0].entityId).toBe(33);
      expect(result[0].actionType).toBe('GO_NOGO_APPROVAL');
      expect(result[0].actionTarget).toBe('/sales?tab=1&tenderId=33&action=go-nogo');
      expect(result[0].status).toBe('PENDING');
    });

    it('5. GO_NOGO_REVISION item: preserves returnedByName and returnReason', async () => {
      const revisionTodo = {
        todoId: 'wf-59',
        sourceType: 'WORKFLOW_TASK' as const,
        sourceId: '59',
        taskId: 59,
        assignedRole: 'MARKETING',
        entityType: 'TENDER',
        entityId: 34,
        actionType: 'GO_NOGO_REVISION',
        actionTarget: '/sales?tab=1&tenderId=34&action=go-nogo',
        title: 'Revisi GO / NO-GO',
        status: 'PENDING',
        createdAt: '2026-09-25T15:00:30.000Z',
        updatedAt: '2026-09-25T15:00:30.000Z',
        projectName: 'Renovasi Kantor HQ J&T Indonesia',
        customerName: 'J&T Express',
        returnedByName: 'Budi Director',
        returnReason: 'masih salah nominalnya',
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          data: [revisionTodo],
        },
      });

      const result = await InboxService.getTodos();

      expect(result).toHaveLength(1);
      expect(result[0].actionType).toBe('GO_NOGO_REVISION');
      expect(result[0].title).toBe('Revisi GO / NO-GO');
      expect(result[0].projectName).toBe('Renovasi Kantor HQ J&T Indonesia');
      expect(result[0].customerName).toBe('J&T Express');
      expect(result[0].returnedByName).toBe('Budi Director');
      expect(result[0].returnReason).toBe('masih salah nominalnya');
    });
  });

  describe('getSummary', () => {
    it('calls GET /inbox/summary and returns summary counts', async () => {
      const mockSummary = {
        todoCount: 3,
        unreadNotificationCount: 7,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { data: mockSummary },
      });

      const result = await InboxService.getSummary();

      expect(apiClient.get).toHaveBeenCalledWith('/inbox/summary');
      expect(result).toEqual(mockSummary);
    });

    it('correctly parses double-wrapped TransformInterceptor response', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          meta: { code: 200, status: 'success', message: 'Request successful' },
          data: {
            statusCode: 200,
            message: 'Inbox summary retrieved successfully',
            data: {
              todoCount: 5,
              unreadNotificationCount: 12,
            },
          },
        },
      });

      const result = await InboxService.getSummary();
      expect(result).toEqual({ todoCount: 5, unreadNotificationCount: 12 });
    });

    it('returns default fallback object when data is missing or invalid', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {},
      });

      const result = await InboxService.getSummary();
      expect(result).toEqual({ todoCount: 0, unreadNotificationCount: 0 });
    });

    it('returns zero for NaN or non-numeric counts', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          data: {
            todoCount: 'invalid',
            unreadNotificationCount: null,
          },
        },
      });

      const result = await InboxService.getSummary();
      expect(result).toEqual({ todoCount: 0, unreadNotificationCount: 0 });
    });
  });

  describe('getHistory', () => {
    const mockHistory = [
      {
        historyId: 'task-history-1',
        taskId: 1,
        workflowInstanceId: 100,
        taskKey: 'GO_NOGO_APPROVAL',
        entityType: 'TENDER',
        entityId: 10,
        title: 'Tender #10: Go/No-Go Approval',
        status: 'COMPLETED',
        action: 'APPROVE',
        decidedBy: 501,
        decidedByName: 'Director User',
        createdAt: '2026-09-30T00:00:00Z',
        completedAt: '2026-09-30T01:00:00Z',
      },
      {
        historyId: 'task-history-2',
        taskId: 2,
        workflowInstanceId: 101,
        taskKey: 'HOPS_REVIEW',
        entityType: 'PROJECT',
        entityId: 20,
        title: 'Project #20: HOPS Review',
        status: 'RETURNED',
        action: 'RETURN',
        comments: 'Perbaiki RAB',
        decidedBy: 601,
        decidedByName: 'HOPS User',
        createdAt: '2026-09-30T00:00:00Z',
        completedAt: '2026-09-30T01:30:00Z',
      },
    ];

    it('1. Calls GET /inbox/history and returns array of historical items', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { data: mockHistory },
      });

      const result = await InboxService.getHistory();

      expect(apiClient.get).toHaveBeenCalledWith('/inbox/history');
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('COMPLETED');
      expect(result[0].action).toBe('APPROVE');
      expect(result[1].status).toBe('RETURNED');
      expect((result[0] as any).actionTarget).toBeUndefined(); // Strictly read-only
    });

    it('2. Double-wrapped TransformInterceptor response correctly unwrapped', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          meta: { code: 200, status: 'success' },
          data: {
            statusCode: 200,
            message: 'Historical workflow tasks retrieved successfully',
            data: mockHistory,
          },
        },
      });

      const result = await InboxService.getHistory();
      expect(apiClient.get).toHaveBeenCalledWith('/inbox/history');
      expect(result).toHaveLength(2);
      expect(result[0].taskId).toBe(1);
    });

    it('3. Returns empty array when data is missing or not an array', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { data: null },
      });

      const result = await InboxService.getHistory();
      expect(result).toEqual([]);
    });
  });
});

