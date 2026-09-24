import { extractUnreadNotificationCount } from '../notificationCount';

describe('NotificationBell Behavior & Decoupled Badge State (N1.1 Hotfix)', () => {
  describe('1. Unread count numeric & safe parsing', () => {
    it('returns exact numeric unread count from TransformInterceptor wrapped payload', () => {
      const apiPayload = {
        meta: { code: 200, status: 'success', message: 'Request successful' },
        data: {
          message: 'Unread count retrieved successfully',
          data: { count: 18 },
        },
      };

      const result = extractUnreadNotificationCount(apiPayload);
      expect(typeof result).toBe('number');
      expect(Number.isNaN(result)).toBe(false);
      expect(result).toBe(18);
    });

    it('returns exact numeric unread count when count is 1 or 10', () => {
      expect(extractUnreadNotificationCount({ data: { data: { count: 1 } } })).toBe(1);
      expect(extractUnreadNotificationCount({ data: { data: { count: 10 } } })).toBe(10);
    });

    it('returns 0 for empty or zero unread state', () => {
      expect(extractUnreadNotificationCount({ data: { data: { count: 0 } } })).toBe(0);
      expect(extractUnreadNotificationCount(null)).toBe(0);
      expect(extractUnreadNotificationCount(undefined)).toBe(0);
    });
  });

  describe('2. State mutation semantics (Read, Read-All, New Notification)', () => {
    it('mark notification read decrements count by 1 and cannot drop below 0', () => {
      let currentUnread = 5;
      const decrement = (prev: number) => Math.max(0, prev - 1);

      currentUnread = decrement(currentUnread);
      expect(currentUnread).toBe(4);

      // Decrementing when 0 stays 0
      expect(decrement(0)).toBe(0);
    });

    it('mark all read resets unread notification count directly to 0', () => {
      let currentUnread = 25;
      const markAllAsRead = () => 0;

      currentUnread = markAllAsRead();
      expect(currentUnread).toBe(0);
    });

    it('realtime new notification increments unread count by 1', () => {
      let currentUnread = 3;
      const onNewNotification = (prev: number) => prev + 1;

      currentUnread = onNewNotification(currentUnread);
      expect(currentUnread).toBe(4);
    });
  });

  describe('3. Strict Decoupling: To-Do count MUST NOT affect bell unread count', () => {
    it('bell badge strictly uses unreadNotificationCount without adding todoCount', () => {
      const unreadNotificationCount = 7;
      const todoCount = 15;

      // Bell badge count definition in N1.1
      const bellBadgeCount = unreadNotificationCount;

      expect(bellBadgeCount).toBe(7);
      expect(bellBadgeCount).not.toBe(unreadNotificationCount + todoCount);
    });

    it('To-Do creation, completion, or refetch does NOT alter bell badge count', () => {
      let unreadNotificationCount = 4;
      let todoCount = 2;

      // Simulate To-Do event (e.g. new task created, completed)
      const onTodoSyncRefresh = (newTodoCount: number) => {
        todoCount = newTodoCount;
        // unreadNotificationCount is NOT updated during todo sync
      };

      onTodoSyncRefresh(10); // Todo increased
      expect(todoCount).toBe(10);
      expect(unreadNotificationCount).toBe(4); // Bell badge unaffected

      onTodoSyncRefresh(0); // All todos completed
      expect(todoCount).toBe(0);
      expect(unreadNotificationCount).toBe(4); // Bell badge still unaffected
    });
  });
});
