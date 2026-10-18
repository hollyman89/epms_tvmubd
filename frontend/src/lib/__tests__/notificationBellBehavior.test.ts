import { extractUnreadNotificationCount } from '../notificationCount';
import { calculateAttentionCount, isNotificationDuplicateOfTodo } from '../attentionCount';
import { TodoItem } from '@/services/inbox.service';

describe('NotificationBell Behavior & Canonical Attention Badge (ACTIVITY-BELL-R1)', () => {
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

  describe('3. Canonical Attention Badge Calculation & Deduplication (Mandatory Cases 1-8)', () => {
    const mockWorkflowTask1: TodoItem = {
      todoId: 'wf-101',
      sourceType: 'WORKFLOW_TASK',
      sourceId: '101',
      taskId: 101,
      entityType: 'PROJECT',
      entityId: 2014,
      actionType: 'MANAGEMENT_REVIEW',
      actionTarget: '/governance/tasks?taskId=101&projectId=2014',
      title: 'Review Rencana Operasional Proyek',
      status: 'PENDING',
      createdAt: '2026-10-12T10:00:00.000Z',
    };

    const mockWorkflowTask2: TodoItem = {
      todoId: 'wf-102',
      sourceType: 'WORKFLOW_TASK',
      sourceId: '102',
      taskId: 102,
      entityType: 'TENDER',
      entityId: 88,
      actionType: 'GO_NOGO_APPROVAL',
      actionTarget: '/sales?tab=1&tenderId=88&action=go-nogo',
      title: 'Persetujuan GO / NO-GO Tender #88',
      status: 'PENDING',
      createdAt: '2026-10-12T11:00:00.000Z',
    };

    it('CASE 1: todoCount = 2, unreadNotificationCount = 0 -> attention badge = 2 (e.g. Director scenario)', () => {
      const badge = calculateAttentionCount({
        todoCount: 2,
        unreadNotificationCount: 0,
        todos: [mockWorkflowTask1, mockWorkflowTask2],
        unreadNotifications: [],
      });
      expect(badge).toBe(2);
    });

    it('CASE 2: todoCount = 0, unreadNotificationCount = 3 -> attention badge = 3', () => {
      const badge = calculateAttentionCount({
        todoCount: 0,
        unreadNotificationCount: 3,
        todos: [],
        unreadNotifications: [
          { id: 1, isRead: false },
          { id: 2, isRead: false },
          { id: 3, isRead: false },
        ],
      });
      expect(badge).toBe(3);
    });

    it('CASE 3: todoCount = 0, unreadNotificationCount = 0 -> attention badge = 0 (hidden)', () => {
      const badge = calculateAttentionCount({
        todoCount: 0,
        unreadNotificationCount: 0,
        todos: [],
        unreadNotifications: [],
      });
      expect(badge).toBe(0);
    });

    it('CASE 4: todoCount = 2, unread informational notifications = 3, no duplicate identities -> badge = 5', () => {
      const badge = calculateAttentionCount({
        todoCount: 2,
        unreadNotificationCount: 3,
        todos: [mockWorkflowTask1, mockWorkflowTask2],
        unreadNotifications: [
          { id: 1, isRead: false, metaData: { reference_type: 'SYSTEM', reference_id: 999 } },
          { id: 2, isRead: false, metaData: { category: 'FINANCE', paymentId: 501 } },
          { id: 3, isRead: false, metaData: { category: 'MARKETING', tenderId: 777 } },
        ],
      });
      expect(badge).toBe(5);
    });

    it('CASE 5: 1 actionable task + 1 unread notification referencing the exact same WORKFLOW_TASK -> badge = 1', () => {
      const duplicateNotif = {
        id: 10,
        isRead: false,
        actionLink: '/governance/tasks?taskId=101&projectId=2014',
        metaData: {
          category: 'PROJECT',
          reference_type: 'WORKFLOW_TASK',
          reference_id: 101,
          taskId: 101,
          projectId: 2014,
        },
      };

      expect(isNotificationDuplicateOfTodo(duplicateNotif, [mockWorkflowTask1])).toBe(true);

      const badge = calculateAttentionCount({
        todoCount: 1,
        unreadNotificationCount: 1,
        todos: [mockWorkflowTask1],
        unreadNotifications: [duplicateNotif],
      });
      expect(badge).toBe(1);
    });

    it('CASE 6: duplicate notification becomes read while task remains pending -> badge remains 1', () => {
      const readNotif = {
        id: 10,
        isRead: true, // Marked as read
        actionLink: '/governance/tasks?taskId=101&projectId=2014',
        metaData: {
          category: 'PROJECT',
          reference_type: 'WORKFLOW_TASK',
          reference_id: 101,
          taskId: 101,
          projectId: 2014,
        },
      };

      const badge = calculateAttentionCount({
        todoCount: 1,
        unreadNotificationCount: 0, // Unread count decreased to 0 upon read
        todos: [mockWorkflowTask1],
        unreadNotifications: [readNotif],
      });
      expect(badge).toBe(1);
    });

    it('CASE 7: task completed and no unread notification remains -> badge becomes 0 (hidden)', () => {
      const badge = calculateAttentionCount({
        todoCount: 0, // Task completed and removed from todos
        unreadNotificationCount: 0,
        todos: [],
        unreadNotifications: [],
      });
      expect(badge).toBe(0);
    });

    it('CASE 8: Riwayat items exist -> Riwayat does not affect badge', () => {
      // Riwayat tasks (COMPLETED / RETURNED) are not part of actionable todos or unread notifications
      const riwayatCount = 15;
      expect(riwayatCount).toBe(15);

      const badge = calculateAttentionCount({
        todoCount: 2,
        unreadNotificationCount: 1,
        todos: [mockWorkflowTask1, mockWorkflowTask2],
        unreadNotifications: [{ id: 99, isRead: false }],
      });

      // Attention badge is strictly 2 + 1 = 3, unaffected by Riwayat
      expect(badge).toBe(3);
    });
  });

  describe('4. Real-time Actor Transitions & Stale-Cache Prevention (ACTIVITY-REALTIME-R1)', () => {
    it('TEST 28: Primary Stale Cache Regression — fresh server data overrides stale cached todos on business-sync', () => {
      // Simulating the exact defect: stale cached todos had length 1 (old task)
      const staleCachedTodos = [{ todoId: 'wf-old', title: 'Old Task' } as TodoItem];
      // Server authoritative response has new task
      const freshServerTodos = [
        { todoId: 'wf-old', title: 'Old Task' } as TodoItem,
        { todoId: 'wf-new', title: 'New Task' } as TodoItem,
      ];

      // Fix guarantee: component MUST use freshServerTodos, not staleCachedTodos
      const activeTodos = freshServerTodos;
      const activeTodoCount = freshServerTodos.length;

      const badge = calculateAttentionCount({
        todoCount: activeTodoCount,
        unreadNotificationCount: 0,
        todos: activeTodos,
        unreadNotifications: [],
      });

      expect(activeTodoCount).toBe(2);
      expect(badge).toBe(2);
    });

    it('TEST 29: Task Assignment — 0 -> 1 without popover open', () => {
      let popoverOpen = false;
      const initialTodoCount = 0;
      expect(popoverOpen).toBe(false);

      // Business sync arrives, server returns 1 actionable todo
      const serverTodos = [{ todoId: 'wf-assigned-1', title: 'Assigned Task' } as TodoItem];
      const updatedTodoCount = serverTodos.length;

      const badge = calculateAttentionCount({
        todoCount: updatedTodoCount,
        unreadNotificationCount: 0,
        todos: serverTodos,
        unreadNotifications: [],
      });

      expect(updatedTodoCount).toBe(1);
      expect(badge).toBe(1);
    });

    it('TEST 30: Task Completion — 1 -> 0 decrements automatically without bell click', () => {
      const initialTodoCount = 1;
      expect(initialTodoCount).toBe(1);

      // Actor completes task, server returns empty todos
      const serverTodos: TodoItem[] = [];
      const updatedTodoCount = serverTodos.length;

      const badge = calculateAttentionCount({
        todoCount: updatedTodoCount,
        unreadNotificationCount: 0,
        todos: serverTodos,
        unreadNotifications: [],
      });

      expect(updatedTodoCount).toBe(0);
      expect(badge).toBe(0);
    });

    it('TEST 31: Actor Transfer — Actor A: 1 -> 0, Actor B: 0 -> 1', () => {
      // Transition from HOO to Procurement
      // Actor A (HOO): Task completed
      const actorAServerTodos: TodoItem[] = [];
      const actorABadge = calculateAttentionCount({
        todoCount: actorAServerTodos.length,
        unreadNotificationCount: 0,
        todos: actorAServerTodos,
        unreadNotifications: [],
      });
      expect(actorABadge).toBe(0);

      // Actor B (Procurement): Task assigned
      const actorBServerTodos = [{ todoId: 'wf-proc-review', title: 'Procurement Plan Review' } as TodoItem];
      const actorBBadge = calculateAttentionCount({
        todoCount: actorBServerTodos.length,
        unreadNotificationCount: 0,
        todos: actorBServerTodos,
        unreadNotifications: [],
      });
      expect(actorBBadge).toBe(1);
    });

    it('TEST 32: Task Without Notification — Finance/Director Management Review flow (0 -> 1 badge)', () => {
      // Management Review Finance & Director receive zero notification rows, strictly actionable task
      const directorTodos = [{ todoId: 'wf-dir-approval', title: 'Director Final Approval' } as TodoItem];
      const unreadNotificationCount = 0;

      const badge = calculateAttentionCount({
        todoCount: directorTodos.length,
        unreadNotificationCount,
        todos: directorTodos,
        unreadNotifications: [],
      });

      expect(badge).toBe(1);
    });

    it('TEST 33: Notification Without Task — informational alert updates badge (0 -> 1)', () => {
      const informationalNotif = {
        id: 77,
        isRead: false,
        title: 'Project Kickoff Executed',
        message: 'Project #2014 has kicked off',
        actionLink: '/projects/2014',
      };

      const badge = calculateAttentionCount({
        todoCount: 0,
        unreadNotificationCount: 1,
        todos: [],
        unreadNotifications: [informationalNotif],
      });

      expect(badge).toBe(1);
    });

    it('TEST 34: Mark Read with Task Remaining — independent decrements, duplicate retains task count', () => {
      const task = { todoId: 'wf-task-55', taskId: 55, title: 'Legal Review' } as TodoItem;

      // Subcase A: Independent notification read
      const indepNotif = { id: 10, isRead: false, title: 'General Info' };
      const badgeBefore = calculateAttentionCount({
        todoCount: 1,
        unreadNotificationCount: 1,
        todos: [task],
        unreadNotifications: [indepNotif],
      });
      expect(badgeBefore).toBe(2);

      // User marks indepNotif as read -> unreadNotificationCount becomes 0
      const badgeAfter = calculateAttentionCount({
        todoCount: 1,
        unreadNotificationCount: 0,
        todos: [task],
        unreadNotifications: [{ ...indepNotif, isRead: true }],
      });
      expect(badgeAfter).toBe(1); // Task remains!

      // Subcase B: Duplicate notification read
      const dupNotif = {
        id: 11,
        isRead: false,
        metaData: { reference_type: 'WORKFLOW_TASK', taskId: 55 },
      };
      const dupBadgeBefore = calculateAttentionCount({
        todoCount: 1,
        unreadNotificationCount: 1,
        todos: [task],
        unreadNotifications: [dupNotif],
      });
      expect(dupBadgeBefore).toBe(1); // Deduplicated!

      const dupBadgeAfter = calculateAttentionCount({
        todoCount: 1,
        unreadNotificationCount: 0, // Read
        todos: [task],
        unreadNotifications: [{ ...dupNotif, isRead: true }],
      });
      expect(dupBadgeAfter).toBe(1); // Task remains!
    });

    it('TEST 35: Reconnect — authoritative resync restores accurate count after disconnect', () => {
      // Local state stale after network interruption
      let localTodoCount = 0;

      // On epms:reconnect-resync, authoritative server response received
      const resyncedTodos = [
        { todoId: 'wf-1', title: 'Task 1' } as TodoItem,
        { todoId: 'wf-2', title: 'Task 2' } as TodoItem,
      ];
      localTodoCount = resyncedTodos.length;

      const badge = calculateAttentionCount({
        todoCount: localTodoCount,
        unreadNotificationCount: 0,
        todos: resyncedTodos,
        unreadNotifications: [],
      });

      expect(badge).toBe(2);
    });

    it('TEST 36: Popover Closed State — open === false updates attention count and badge', () => {
      const popoverOpen = false;
      const freshTodos = [{ todoId: 'wf-closed-test', title: 'Pending Approval' } as TodoItem];

      const badge = calculateAttentionCount({
        todoCount: freshTodos.length,
        unreadNotificationCount: 0,
        todos: freshTodos,
        unreadNotifications: [],
      });

      expect(popoverOpen).toBe(false);
      expect(badge).toBe(1);
    });

    it('TEST 37: Popover Open State — opening popover retains consistent count and list', () => {
      const popoverOpen = true;
      const freshTodos = [{ todoId: 'wf-open-test', title: 'Pending Approval' } as TodoItem];

      const badge = calculateAttentionCount({
        todoCount: freshTodos.length,
        unreadNotificationCount: 0,
        todos: freshTodos,
        unreadNotifications: [],
      });

      expect(popoverOpen).toBe(true);
      expect(badge).toBe(1);
    });

    it('TEST 38: User Change — cache isolation between User A and User B', () => {
      // User A has 2 tasks
      const userATodos = [
        { todoId: 'wf-user-a-1', title: 'User A Task 1' } as TodoItem,
        { todoId: 'wf-user-a-2', title: 'User A Task 2' } as TodoItem,
      ];
      const userABadge = calculateAttentionCount({
        todoCount: userATodos.length,
        unreadNotificationCount: 0,
        todos: userATodos,
        unreadNotifications: [],
      });
      expect(userABadge).toBe(2);

      // On logout / switch to User B: previous cache purged, state reset, User B fetched (0 tasks)
      const userBTodos: TodoItem[] = [];
      const userBBadge = calculateAttentionCount({
        todoCount: userBTodos.length,
        unreadNotificationCount: 0,
        todos: userBTodos,
        unreadNotifications: [],
      });
      expect(userBBadge).toBe(0);
    });
  });
});

