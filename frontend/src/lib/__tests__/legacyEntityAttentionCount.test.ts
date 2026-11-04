import { isNotificationDuplicateOfTodo, calculateAttentionCount } from '../attentionCount';
import { TodoItem } from '@/services/inbox.service';

describe('F-HIGH-04: Legacy Entity Reference & Attention Count Compatibility', () => {
  it('deduplicates unread notification with CONTRACT:1 prefix against To-Do item for contract 1', () => {
    const todos: TodoItem[] = [
      {
        id: 'todo-cont-1',
        title: 'Review SPK Kontrak #1',
        entityType: 'CONTRACT',
        entityId: 1,
        sourceType: 'DOMAIN_CONTRACT',
        sourceId: '1',
      } as any,
    ];

    const notif = {
      id: 32,
      isRead: false,
      title: 'Draft Kontrak Siap Ditinjau',
      actionLink: '/governance/contracts/1',
      metaData: {
        reference_id: 'CONTRACT:1',
        reference_type: 'CONTRACT',
      },
    };

    expect(isNotificationDuplicateOfTodo(notif, todos)).toBe(true);

    const attentionBadge = calculateAttentionCount({
      todoCount: 1,
      unreadNotificationCount: 1,
      todos,
      unreadNotifications: [notif],
    });

    // 1 To-Do + (1 unread - 1 duplicate) = 1
    expect(attentionBadge).toBe(1);
  });

  it('deduplicates unread notification with TENDER:163 prefix against To-Do item for tender 163', () => {
    const todos: TodoItem[] = [
      {
        id: 'todo-tnd-163',
        title: 'Persetujuan GO/NO GO Tender #163',
        entityType: 'TENDER',
        entityId: 163,
        sourceType: 'DOMAIN_TENDER',
        sourceId: '163',
      } as any,
    ];

    const notif = {
      id: 33,
      isRead: false,
      title: 'Persetujuan GO / NO GO Diperlukan',
      actionLink: '/sales?tab=1&tenderId=163&action=go-nogo',
      metaData: {
        reference_id: 'TENDER:163',
        reference_type: 'TENDER',
      },
    };

    expect(isNotificationDuplicateOfTodo(notif, todos)).toBe(true);

    const attentionBadge = calculateAttentionCount({
      todoCount: 1,
      unreadNotificationCount: 1,
      todos,
      unreadNotifications: [notif],
    });

    expect(attentionBadge).toBe(1);
  });

  it('does NOT deduplicate unrelated notifications', () => {
    const todos: TodoItem[] = [
      {
        id: 'todo-cont-2',
        title: 'Review SPK Kontrak #2',
        entityType: 'CONTRACT',
        entityId: 2,
      } as any,
    ];

    const notif = {
      id: 34,
      isRead: false,
      title: 'Draft Kontrak Siap Ditinjau',
      metaData: {
        reference_id: 'CONTRACT:1',
        reference_type: 'CONTRACT',
      },
    };

    expect(isNotificationDuplicateOfTodo(notif, todos)).toBe(false);

    const attentionBadge = calculateAttentionCount({
      todoCount: 1,
      unreadNotificationCount: 1,
      todos,
      unreadNotifications: [notif],
    });

    // 1 To-Do + 1 unread = 2
    expect(attentionBadge).toBe(2);
  });

  it('deduplicates unread notification for PROJECT_PROGRESS_CLAIM against active To-Do item', () => {
    const claimId = 84;
    const todos: TodoItem[] = [
      {
        id: `progress-claim-${claimId}`,
        title: 'Verifikasi Klaim Progres',
        entityType: 'PROJECT_PROGRESS_CLAIM',
        entityId: claimId,
        sourceType: 'DOMAIN_PROGRESS_CLAIM',
        sourceId: String(claimId),
        actionTarget: `/project-delivery?view=workspace&projectId=53&section=tasks&progressClaimId=${claimId}`,
      } as any,
    ];

    const notif = {
      id: 55,
      isRead: false,
      title: 'Klaim Progres Menunggu Verifikasi',
      actionLink: `/project-delivery?view=workspace&projectId=53&section=tasks&progressClaimId=${claimId}`,
      metaData: {
        reference_id: claimId,
        reference_type: 'PROJECT_PROGRESS_CLAIM',
        progressClaimId: claimId,
      },
    };

    expect(isNotificationDuplicateOfTodo(notif, todos)).toBe(true);

    const attentionBadge = calculateAttentionCount({
      todoCount: 1,
      unreadNotificationCount: 1,
      todos,
      unreadNotifications: [notif],
    });

    // 1 To-Do + (1 unread - 1 duplicate) = 1
    expect(attentionBadge).toBe(1);
  });
});

