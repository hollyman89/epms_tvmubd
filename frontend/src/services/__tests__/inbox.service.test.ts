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
    it('calls GET /inbox/todos and returns array of todos', async () => {
      const mockTodos = [
        {
          todoId: 'wf-1',
          sourceType: 'WORKFLOW_TASK',
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

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { data: mockTodos },
      });

      const result = await InboxService.getTodos();

      expect(apiClient.get).toHaveBeenCalledWith('/inbox/todos');
      expect(result).toEqual(mockTodos);
    });

    it('returns empty array when data is not an array', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { data: null },
      });

      const result = await InboxService.getTodos();
      expect(result).toEqual([]);
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
});
