import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource, Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { PushOutbox, PushOutboxStatus } from '../../entities/push-outbox.entity';
import { NotificationGateway } from './notification.gateway';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { BusinessEvent, NotificationPolicy } from '../../shared/contracts/business-event.contract';

describe('Phase N5: Project / PMO / PM Canonical Notification & Decoupling Suite', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let mockNotificationRepo: jest.Mocked<Partial<Repository<Notification>>>;
  let mockPushOutboxRepo: jest.Mocked<Partial<Repository<PushOutbox>>>;
  let mockGateway: jest.Mocked<Partial<NotificationGateway>>;
  let mockEmailQueue: { add: jest.Mock };
  let mockDataSource: any;
  let inMemoryNotifications: Notification[];
  let inMemoryPushOutbox: PushOutbox[];
  let socketPushes: Array<{ userId: number; notification: any }>;

  const PM_A_ID = 401;
  const PM_B_ID = 402;
  const PMO_USER_ID = 301;
  const HOPS_USER_ID = 501;
  const PROCUREMENT_USER_ID = 502;
  const FINANCE_USER_ID = 503;
  const DIRECTOR_USER_ID = 504;
  const PROJECT_ID = 901;
  const CONTRACT_ID = 801;
  const PROJECT_CODE = 'PRJ-TVM-2026-001';
  const PROJECT_NAME = 'FTTH Rollout Backbone UBD';

  beforeEach(async () => {
    inMemoryNotifications = [];
    inMemoryPushOutbox = [];
    socketPushes = [];
    mockEmailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    mockNotificationRepo = {
      save: jest.fn().mockImplementation(async (entity: Notification) => {
        const duplicate = inMemoryNotifications.find(
          (n) => n.userId === entity.userId && n.dedupeKey && n.dedupeKey === entity.dedupeKey,
        );
        if (duplicate) {
          const err: any = new Error(
            `Duplicate entry '${entity.dedupeKey}' for key 'idx_notif_user_dedupe'`,
          );
          err.code = 'ER_DUP_ENTRY';
          err.errno = 1062;
          throw err;
        }

        const saved = Object.assign(new Notification(), entity, {
          id: inMemoryNotifications.length + 1,
        });
        inMemoryNotifications.push(saved);
        return saved;
      }),
      find: jest.fn().mockImplementation(async () => inMemoryNotifications),
      count: jest.fn().mockImplementation(async () => inMemoryNotifications.length),
    };

    mockPushOutboxRepo = {
      save: jest.fn().mockImplementation(async (entity: PushOutbox) => {
        const duplicate = inMemoryPushOutbox.find(
          (p) => p.dedupeKey && p.dedupeKey === entity.dedupeKey,
        );
        if (duplicate) {
          const err: any = new Error(
            `Duplicate entry '${entity.dedupeKey}' for key 'uk_push_outbox_dedupe'`,
          );
          err.code = 'ER_DUP_ENTRY';
          err.errno = 1062;
          throw err;
        }

        const saved = Object.assign(new PushOutbox(), entity, {
          id: inMemoryPushOutbox.length + 1,
        });
        inMemoryPushOutbox.push(saved);
        return saved;
      }),
      find: jest.fn().mockImplementation(async () => inMemoryPushOutbox),
      count: jest.fn().mockImplementation(async () => inMemoryPushOutbox.length),
    };

    mockGateway = {
      sendNotificationToUser: jest.fn().mockImplementation((userId: number, notif: any) => {
        socketPushes.push({ userId, notification: notif });
      }),
      sendSyncEventToRooms: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalNotificationWriter,
        CanonicalNotificationConsumer,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(PushOutbox),
          useValue: mockPushOutboxRepo,
        },
        {
          provide: NotificationGateway,
          useValue: mockGateway,
        },
        {
          provide: getQueueToken('email-send'),
          useValue: mockEmailQueue,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
  });

  describe('1. project.pm.assigned Canonical Event Projection', () => {
    it('projects informational Bell strictly to selected PM A and excludes PM B', async () => {
      const canonicalEvent: BusinessEvent<any> = {
        eventId: 'evt-pm-assign-001',
        eventName: 'project.pm.assigned',
        eventVersion: 1,
        occurredAt: '2026-09-26T04:00:00.000Z',
        aggregateType: 'Project',
        aggregateId: PROJECT_ID,
        projectId: PROJECT_ID,
        actor: { userId: PMO_USER_ID },
        routing: {
          userIds: [PM_A_ID],
          projectId: PROJECT_ID,
        },
        payload: {
          projectId: PROJECT_ID,
          projectCode: PROJECT_CODE,
          contractId: CONTRACT_ID,
          projectManagerId: PM_A_ID,
          assignedBy: PMO_USER_ID,
          status: 'PLANNING',
        },
      };

      const results = await consumer.handleProjectPmAssigned(canonicalEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(PM_A_ID);
      expect(results[0].dedupeKey).toBe('evt-pm-assign-001:401:PROJECT_PM_ASSIGNED');

      // Database assertion
      expect(inMemoryNotifications).toHaveLength(1);
      const saved = inMemoryNotifications[0];
      expect(saved.userId).toBe(PM_A_ID);
      expect(saved.title).toBe('Penugasan Project Manager Baru');
      expect(saved.message).toContain(PROJECT_CODE);
      expect(saved.message).toContain('Silakan mulai menyusun Operational Plan');
      expect(saved.notificationType).toBe('SYSTEM'); // Informational mapped to SYSTEM
      expect(saved.actionLink).toBe(
        `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=overview`,
      );
      expect(saved.metaData?.reference_type).toBe('PROJECT');
      expect(saved.metaData?.reference_id).toBe(PROJECT_ID);

      // Verify PM B receives zero Bell
      const pmBNotifs = inMemoryNotifications.filter((n) => n.userId === PM_B_ID);
      expect(pmBNotifs).toHaveLength(0);

      // WebSocket push assertion: strictly to PM A
      expect(socketPushes).toHaveLength(1);
      expect(socketPushes[0].userId).toBe(PM_A_ID);
      expect(socketPushes.some((s) => s.userId === PM_B_ID)).toBe(false);
    });

    it('suppresses duplicate DB write and WebSocket on retried project.pm.assigned event', async () => {
      const canonicalEvent: BusinessEvent<any> = {
        eventId: 'evt-pm-assign-retry-002',
        eventName: 'project.pm.assigned',
        eventVersion: 1,
        occurredAt: '2026-09-26T04:00:00.000Z',
        aggregateType: 'Project',
        aggregateId: PROJECT_ID,
        projectId: PROJECT_ID,
        actor: { userId: PMO_USER_ID },
        routing: {
          userIds: [PM_A_ID],
          projectId: PROJECT_ID,
        },
        payload: {
          projectId: PROJECT_ID,
          projectCode: PROJECT_CODE,
          contractId: CONTRACT_ID,
          projectManagerId: PM_A_ID,
          assignedBy: PMO_USER_ID,
          status: 'PLANNING',
        },
      };

      // First delivery
      const res1 = await consumer.handleProjectPmAssigned(canonicalEvent);
      expect(res1[0].status).toBe('PERSISTED');

      // Second delivery (simulating at-least-once outbox relay retry)
      const res2 = await consumer.handleProjectPmAssigned(canonicalEvent);
      expect(res2[0].status).toBe('DUPLICATE_SUPPRESSED');

      // Database contains strictly 1 row
      expect(inMemoryNotifications).toHaveLength(1);

      // Socket pushes strictly 1 emit
      expect(socketPushes).toHaveLength(1);

      // Email queue not triggered (informational notification does not enable email)
      expect(mockEmailQueue.add).not.toHaveBeenCalled();
    });

    it('concurrent duplicate project.pm.assigned delivery creates max 1 DB row and 1 socket push', async () => {
      const canonicalEvent: BusinessEvent<any> = {
        eventId: 'evt-pm-assign-concurrent-003',
        eventName: 'project.pm.assigned',
        eventVersion: 1,
        occurredAt: '2026-09-26T04:00:00.000Z',
        aggregateType: 'Project',
        aggregateId: PROJECT_ID,
        projectId: PROJECT_ID,
        routing: {
          userIds: [PM_A_ID],
          projectId: PROJECT_ID,
        },
        payload: {
          projectId: PROJECT_ID,
          projectCode: PROJECT_CODE,
          projectManagerId: PM_A_ID,
          assignedBy: PMO_USER_ID,
          status: 'PLANNING',
        },
      };

      const [res1, res2] = await Promise.all([
        consumer.handleProjectPmAssigned(canonicalEvent),
        consumer.handleProjectPmAssigned(canonicalEvent),
      ]);

      const statuses = [res1[0].status, res2[0].status];
      expect(statuses).toContain('PERSISTED');
      expect(statuses).toContain('DUPLICATE_SUPPRESSED');

      expect(inMemoryNotifications).toHaveLength(1);
      expect(socketPushes).toHaveLength(1);
    });

    it('safely skips non-canonical event missing eventId with 0 Bell created', async () => {
      const malformedEvent: any = {
        eventName: 'project.pm.assigned',
        aggregateId: PROJECT_ID,
        payload: {
          projectId: PROJECT_ID,
          projectManagerId: PM_A_ID,
        },
      };

      const results = await consumer.handleProjectPmAssigned(malformedEvent);
      expect(results).toHaveLength(0);
      expect(inMemoryNotifications).toHaveLength(0);
      expect(socketPushes).toHaveLength(0);
    });

    it('safely skips event missing projectManagerId with 0 Bell created', async () => {
      const missingPmEvent: BusinessEvent<any> = {
        eventId: 'evt-missing-pm-004',
        eventName: 'project.pm.assigned',
        eventVersion: 1,
        occurredAt: '2026-09-26T04:00:00.000Z',
        aggregateType: 'Project',
        aggregateId: PROJECT_ID,
        routing: { userIds: [] },
        payload: {
          projectId: PROJECT_ID,
          projectCode: PROJECT_CODE,
        },
      };

      const results = await consumer.handleProjectPmAssigned(missingPmEvent);
      expect(results).toHaveLength(0);
      expect(inMemoryNotifications).toHaveLength(0);
      expect(socketPushes).toHaveLength(0);
    });

    it('resolves projectManagerId from routing.userIds fallback when payload.projectManagerId is omitted', async () => {
      const routingOnlyEvent: BusinessEvent<any> = {
        eventId: 'evt-routing-pm-005',
        eventName: 'project.pm.assigned',
        eventVersion: 1,
        occurredAt: '2026-09-26T04:00:00.000Z',
        aggregateType: 'Project',
        aggregateId: PROJECT_ID,
        routing: { userIds: [PM_A_ID] },
        payload: {
          projectId: PROJECT_ID,
          projectCode: PROJECT_CODE,
        },
      };

      const results = await consumer.handleProjectPmAssigned(routingOnlyEvent);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(PM_A_ID);
      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(PM_A_ID);
    });
  });

  describe('2. Project Kickoff (project.kickoff.executed) Canonical Bell & Isolation', () => {
    it('canonical project.kickoff.executed projects Bell & PushOutbox to PMO and HOPS, strictly isolating Director and PM actor', async () => {
      mockDataSource.query.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM projects')) {
          return [
            {
              id: PROJECT_ID,
              name: PROJECT_NAME,
              code: PROJECT_CODE,
              manager_id: PM_A_ID,
              review_status: 'IN_PROGRESS',
            },
          ];
        }
        if (sql.includes('r.name IN')) {
          const matched: any[] = [];
          if (params.includes('PMO')) matched.push({ id: PMO_USER_ID });
          if (params.includes('HEAD_OF_OPERATIONS')) matched.push({ id: HOPS_USER_ID });
          if (params.includes('DIRECTOR')) matched.push({ id: DIRECTOR_USER_ID });
          return matched;
        }
        return [];
      });

      const kickoffEvent: BusinessEvent<any> = {
        eventId: `proj-kick-${PROJECT_ID}`,
        eventName: 'project.kickoff.executed',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Project',
        aggregateId: PROJECT_ID,
        projectId: PROJECT_ID,
        actor: { userId: PM_A_ID },
        routing: { roles: ['PMO', 'HEAD_OF_OPERATIONS'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          projectId: PROJECT_ID,
          projectCode: PROJECT_CODE,
          contractId: CONTRACT_ID,
          managerId: PM_A_ID,
          actualKickoffDate: '2026-11-01',
          status: 'IN_PROGRESS',
        },
      };

      const results = await consumer.handleProjectKickoffExecuted(kickoffEvent);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);

      const recipientIds = results.map((r) => r.recipientId);
      expect(recipientIds).toContain(PMO_USER_ID);
      expect(recipientIds).toContain(HOPS_USER_ID);
      expect(recipientIds).not.toContain(PM_A_ID);
      expect(recipientIds).not.toContain(DIRECTOR_USER_ID);

      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryPushOutbox).toHaveLength(2);

      const pmoNotif = inMemoryNotifications.find((n) => n.userId === PMO_USER_ID);
      expect(pmoNotif?.actionLink).toBe(`/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=overview`);
    });
  });

  describe('3. Management Review Canonical Bell & PushOutbox Suite (PM -> HOPS -> Procurement -> Finance -> Director)', () => {
    beforeEach(() => {
      mockDataSource.query.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM projects')) {
          const requestedProjectId = Number(params?.[0]);
          if (requestedProjectId === PROJECT_ID) {
            return [
              {
                id: PROJECT_ID,
                name: PROJECT_NAME,
                code: PROJECT_CODE,
                manager_id: PM_A_ID,
                user_id: PM_A_ID,
                is_active: 1,
                user_deleted_at: null,
                review_status: 'READY_FOR_KICKOFF',
              },
            ];
          }
          return [];
        }
        if (sql.includes('JOIN user_roles')) {
          const roles = params || [];
          const users: Array<{ id: number }> = [];
          if (roles.includes('HEAD_OF_OPERATIONS')) users.push({ id: HOPS_USER_ID });
          if (roles.includes('PROCUREMENT')) users.push({ id: PROCUREMENT_USER_ID });
          if (roles.includes('FINANCE')) users.push({ id: FINANCE_USER_ID });
          if (roles.includes('DIRECTOR')) users.push({ id: DIRECTOR_USER_ID });
          return users;
        }
        if (sql.includes('FROM users')) {
          const userId = Number(params?.[0]);
          return [{ id: userId, is_active: 1, deleted_at: null }];
        }
        return [];
      });
    });

    it('Scenario 1: PM submit Management Review -> HOPS receives Bell + PushOutbox', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-mr-submit-hops-001',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-29T10:00:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 701,
        projectId: PROJECT_ID,
        actor: { userId: PM_A_ID },
        routing: {
          userIds: [],
          roles: ['HEAD_OF_OPERATIONS'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 701,
          workflowInstanceId: 301,
          nodeId: 'node_hops_review',
          assignedRoleId: 4,
          assignedUserId: null,
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          fromNode: 'node_start',
          action: 'AUTO',
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(HOPS_USER_ID);
      expect(results[0].purpose).toBe('MANAGEMENT_REVIEW_HOPS_ASSIGNED');

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(HOPS_USER_ID);
      expect(inMemoryNotifications[0].title).toContain('Head of Operations (HOPS)');
      expect(inMemoryNotifications[0].message).toContain(PROJECT_NAME);
      expect(inMemoryNotifications[0].actionLink).toBe(`/governance/tasks?taskId=701&projectId=${PROJECT_ID}`);
      expect(inMemoryNotifications[0].metaData?.reference_type).toBe('WORKFLOW_TASK');
      expect(inMemoryNotifications[0].metaData?.reference_id).toBe(701);

      expect(inMemoryPushOutbox).toHaveLength(1);
      expect(inMemoryPushOutbox[0].recipientId).toBe(HOPS_USER_ID);
      expect(inMemoryPushOutbox[0].status).toBe(PushOutboxStatus.PENDING);
      expect(inMemoryPushOutbox[0].dedupeKey).toBe(
        `evt-mr-submit-hops-001:${HOPS_USER_ID}:MANAGEMENT_REVIEW_HOPS_ASSIGNED:PUSH`,
      );
      expect(inMemoryPushOutbox[0].payloadPreview?.actionTarget).toBe(
        `/governance/tasks?taskId=701&projectId=${PROJECT_ID}`,
      );
    });

    it('Scenario 2: HOPS Approve -> Procurement receives Bell + PushOutbox', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-mr-hops-approve-002',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-29T10:05:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 702,
        projectId: PROJECT_ID,
        actor: { userId: HOPS_USER_ID },
        routing: {
          userIds: [],
          roles: ['PROCUREMENT'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 702,
          workflowInstanceId: 301,
          nodeId: 'node_procurement_review',
          assignedRoleId: 5,
          assignedUserId: null,
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          fromNode: 'node_hops_review',
          action: 'APPROVE',
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(PROCUREMENT_USER_ID);
      expect(results[0].purpose).toBe('MANAGEMENT_REVIEW_PROCUREMENT_ASSIGNED');

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(PROCUREMENT_USER_ID);
      expect(inMemoryNotifications[0].actionLink).toBe(`/governance/tasks?taskId=702&projectId=${PROJECT_ID}`);

      expect(inMemoryPushOutbox).toHaveLength(1);
      expect(inMemoryPushOutbox[0].recipientId).toBe(PROCUREMENT_USER_ID);
      expect(inMemoryPushOutbox[0].status).toBe(PushOutboxStatus.PENDING);
    });

    it('Scenario 3: Procurement Approve -> Finance receives Bell + PushOutbox', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-mr-proc-approve-003',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-29T10:10:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 703,
        projectId: PROJECT_ID,
        actor: { userId: PROCUREMENT_USER_ID },
        routing: {
          userIds: [],
          roles: ['FINANCE'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 703,
          workflowInstanceId: 301,
          nodeId: 'node_finance_review',
          assignedRoleId: 6,
          assignedUserId: null,
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          fromNode: 'node_procurement_review',
          action: 'APPROVE',
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(FINANCE_USER_ID);
      expect(results[0].purpose).toBe('MANAGEMENT_REVIEW_FINANCE_ASSIGNED');

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(FINANCE_USER_ID);
      expect(inMemoryPushOutbox).toHaveLength(1);
      expect(inMemoryPushOutbox[0].recipientId).toBe(FINANCE_USER_ID);
    });

    it('Scenario 4: Finance Approve -> Director receives Bell + PushOutbox', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-mr-fin-approve-004',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-29T10:15:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 704,
        projectId: PROJECT_ID,
        actor: { userId: FINANCE_USER_ID },
        routing: {
          userIds: [],
          roles: ['DIRECTOR'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 704,
          workflowInstanceId: 301,
          nodeId: 'node_director_approval',
          assignedRoleId: 2,
          assignedUserId: null,
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          fromNode: 'node_finance_review',
          action: 'APPROVE',
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(DIRECTOR_USER_ID);
      expect(results[0].purpose).toBe('MANAGEMENT_REVIEW_DIRECTOR_ASSIGNED');

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(DIRECTOR_USER_ID);
      expect(inMemoryPushOutbox).toHaveLength(1);
      expect(inMemoryPushOutbox[0].recipientId).toBe(DIRECTOR_USER_ID);
    });

    it('Scenario 5: Director Approve -> Project PM receives Bell + PushOutbox that project is READY_FOR_KICKOFF', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-mr-dir-final-approve-005',
        eventName: 'workflow.instance.completed',
        eventVersion: 1,
        occurredAt: '2026-10-29T10:20:00.000Z',
        aggregateType: 'WORKFLOW_INSTANCE',
        aggregateId: 301,
        projectId: PROJECT_ID,
        actor: { userId: DIRECTOR_USER_ID },
        routing: {
          userIds: [PM_A_ID],
          roles: ['PROJECT_MANAGER'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          instanceId: 301,
          finalStatus: 'COMPLETED',
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_end',
          action: 'APPROVE',
          reviewStatus: 'READY_FOR_KICKOFF',
          projectManagerId: PM_A_ID,
        },
      };

      const results = await consumer.handleWorkflowInstanceCompleted(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(PM_A_ID);
      expect(results[0].purpose).toBe('MANAGEMENT_REVIEW_APPROVED_READY_FOR_KICKOFF');

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(PM_A_ID);
      expect(inMemoryNotifications[0].title).toContain('Siap Kick-Off');
      expect(inMemoryNotifications[0].message).toContain(PROJECT_NAME);
      expect(inMemoryNotifications[0].message).toContain('READY_FOR_KICKOFF');
      expect(inMemoryNotifications[0].actionLink).toBe(`/project-delivery?projectId=${PROJECT_ID}`);

      // PM B and Director receive 0 notifications
      expect(inMemoryNotifications.some((n) => n.userId === PM_B_ID)).toBe(false);
      expect(inMemoryNotifications.some((n) => n.userId === DIRECTOR_USER_ID)).toBe(false);

      expect(inMemoryPushOutbox).toHaveLength(1);
      expect(inMemoryPushOutbox[0].recipientId).toBe(PM_A_ID);
      expect(inMemoryPushOutbox[0].status).toBe(PushOutboxStatus.PENDING);
    });

    it('Scenario 6: HOPS / Procurement / Finance / Director Return -> strictly only Project PM (PM A) receives Bell + PushOutbox, never PM B, never all PMs, never reviewer', async () => {
      const returnStages = [
        { fromNode: 'node_hops_review', toNode: 'node_pm_revision_hops', reviewerId: HOPS_USER_ID, label: 'Head of Operations (HOPS)', taskId: 711 },
        { fromNode: 'node_procurement_review', toNode: 'node_pm_revision_procurement', reviewerId: PROCUREMENT_USER_ID, label: 'Procurement', taskId: 712 },
        { fromNode: 'node_finance_review', toNode: 'node_pm_revision_finance', reviewerId: FINANCE_USER_ID, label: 'Finance', taskId: 713 },
        { fromNode: 'node_director_approval', toNode: 'node_pm_revision_director', reviewerId: DIRECTOR_USER_ID, label: 'Director', taskId: 714 },
      ];

      for (const stage of returnStages) {
        inMemoryNotifications.length = 0;
        inMemoryPushOutbox.length = 0;
        socketPushes.length = 0;

        // Even if routing.userIds was empty or erroneously contained PM_B_ID, DB authority (PM_A_ID) wins
        const event: BusinessEvent<any> = {
          eventId: `evt-mr-return-${stage.toNode}`,
          eventName: 'workflow.task.returned',
          eventVersion: 1,
          occurredAt: '2026-10-29T10:30:00.000Z',
          aggregateType: 'WORKFLOW_TASK',
          aggregateId: stage.taskId,
          projectId: PROJECT_ID,
          actor: { userId: stage.reviewerId },
          routing: {
            userIds: [PM_B_ID],
            roles: ['PROJECT_MANAGER'],
          },
          notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
          payload: {
            taskId: stage.taskId,
            instanceId: 301,
            action: 'RETURN',
            decidedBy: stage.reviewerId,
            fromNode: stage.fromNode,
            toNode: stage.toNode,
            reason: `Revisi dokumen oleh ${stage.label}`,
            entityType: 'PROJECT',
            projectId: PROJECT_ID,
          },
        };

        const results = await consumer.handleWorkflowTaskReturned(event);

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('PERSISTED');
        expect(results[0].recipientId).toBe(PM_A_ID);
        expect(results[0].purpose).toBe('MANAGEMENT_REVIEW_RETURNED_TO_PM');

        expect(inMemoryNotifications).toHaveLength(1);
        expect(inMemoryNotifications[0].userId).toBe(PM_A_ID);
        expect(inMemoryNotifications[0].title).toContain(stage.label);
        expect(inMemoryNotifications[0].message).toContain(`Revisi dokumen oleh ${stage.label}`);
        expect(inMemoryNotifications[0].actionLink).toBe(
          `/project-delivery?projectId=${PROJECT_ID}&action=operational-plan`,
        );

        // Strictly never PM_B or Reviewer
        expect(inMemoryNotifications.some((n) => n.userId === PM_B_ID)).toBe(false);
        expect(inMemoryNotifications.some((n) => n.userId === stage.reviewerId)).toBe(false);

        expect(inMemoryPushOutbox).toHaveLength(1);
        expect(inMemoryPushOutbox[0].recipientId).toBe(PM_A_ID);
      }
    });

    it('Scenario 7: PM Resubmit from revision node -> relevant reviewer stage receives new Bell + PushOutbox', async () => {
      const resubmitAssignedEvent: BusinessEvent<any> = {
        eventId: 'evt-mr-resubmit-proc-007',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-29T11:00:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 750,
        projectId: PROJECT_ID,
        actor: { userId: PM_A_ID },
        routing: {
          userIds: [],
          roles: ['PROCUREMENT'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 750,
          workflowInstanceId: 301,
          nodeId: 'node_procurement_review',
          assignedRoleId: 5,
          assignedUserId: null,
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          fromNode: 'node_pm_revision_procurement',
          action: 'RESUBMIT',
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(resubmitAssignedEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(PROCUREMENT_USER_ID);
      expect(results[0].purpose).toBe('MANAGEMENT_REVIEW_PROCUREMENT_ASSIGNED');

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(PROCUREMENT_USER_ID);
      expect(inMemoryNotifications[0].title).toContain('Revisi Rencana Operasional Proyek');
      expect(inMemoryNotifications[0].metaData?.actionType).toBe('MANAGEMENT_REVIEW_RESUBMITTED');

      expect(inMemoryPushOutbox).toHaveLength(1);
      expect(inMemoryPushOutbox[0].recipientId).toBe(PROCUREMENT_USER_ID);
    });

    it('Scenario 8: Retry of the same Management Review event -> DUPLICATE_SUPPRESSED with strictly 1 Notification and 1 PushOutbox', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-mr-retry-idempotency-008',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-29T11:10:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 760,
        projectId: PROJECT_ID,
        actor: { userId: FINANCE_USER_ID },
        routing: {
          userIds: [PM_A_ID],
          roles: ['PROJECT_MANAGER'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 760,
          instanceId: 301,
          action: 'RETURN',
          decidedBy: FINANCE_USER_ID,
          fromNode: 'node_finance_review',
          toNode: 'node_pm_revision_finance',
          reason: 'Perbaiki rincian RAB',
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
        },
      };

      const first = await consumer.handleWorkflowTaskReturned(event);
      expect(first).toHaveLength(1);
      expect(first[0].status).toBe('PERSISTED');

      const second = await consumer.handleWorkflowTaskReturned(event);
      expect(second).toHaveLength(1);
      expect(second[0].status).toBe('DUPLICATE_SUPPRESSED');

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryPushOutbox).toHaveLength(1);
      expect(socketPushes).toHaveLength(1);
    });

    it('Scenario 9: SYNC_ONLY and non-PROJECT workflow events produce 0 Bell and 0 PushOutbox', async () => {
      const syncOnlyCompleted: BusinessEvent<any> = {
        eventId: 'evt-mr-synconly-009a',
        eventName: 'workflow.instance.completed',
        eventVersion: 1,
        occurredAt: '2026-10-29T11:15:00.000Z',
        aggregateType: 'WORKFLOW_INSTANCE',
        aggregateId: 999,
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        payload: {
          instanceId: 999,
          finalStatus: 'COMPLETED',
        },
      };

      const nonProjectAssigned: BusinessEvent<any> = {
        eventId: 'evt-mr-nonproject-009b',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-29T11:16:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 888,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 888,
          nodeId: 'node_finance_review',
          entityType: 'PURCHASE_REQUEST',
        },
      };

      const res1 = await consumer.handleWorkflowInstanceCompleted(syncOnlyCompleted);
      const res2 = await consumer.handleWorkflowTaskAssigned(nonProjectAssigned);

      expect(res1).toEqual([]);
      expect(res2).toEqual([]);
      expect(inMemoryNotifications).toHaveLength(0);
      expect(inMemoryPushOutbox).toHaveLength(0);
    });

    it('Scenario 10: Invalid event data or missing/inactive Project PM is safely skipped without throwing', async () => {
      // Mock project with inactive PM
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [
            {
              id: PROJECT_ID,
              name: PROJECT_NAME,
              code: PROJECT_CODE,
              manager_id: PM_A_ID,
              user_id: PM_A_ID,
              is_active: 0, // INACTIVE PM
              user_deleted_at: null,
            },
          ];
        }
        return [];
      });

      const returnToInactivePmEvent: BusinessEvent<any> = {
        eventId: 'evt-mr-inactive-pm-010',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-29T11:20:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 790,
        projectId: PROJECT_ID,
        actor: { userId: HOPS_USER_ID },
        routing: { userIds: [PM_A_ID] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 790,
          action: 'RETURN',
          fromNode: 'node_hops_review',
          toNode: 'node_pm_revision_hops',
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
        },
      };

      const resInactive = await consumer.handleWorkflowTaskReturned(returnToInactivePmEvent);
      expect(resInactive).toEqual([]);

      // Malformed / missing eventId
      const resMalformed = await consumer.handleWorkflowTaskAssigned({
        eventName: 'workflow.task.assigned',
      } as any);
      expect(resMalformed).toEqual([]);

      expect(inMemoryNotifications).toHaveLength(0);
      expect(inMemoryPushOutbox).toHaveLength(0);
    });

    it('Scenario 11 (Negative): PM not found on project (manager_id = null or project missing) -> 0 Bell and 0 PushOutbox (no fallback to submitter or routing)', async () => {
      const SUBMITTER_ID = 999;

      // Case 11A: Project exists in DB but manager_id is NULL
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [
            {
              id: PROJECT_ID,
              name: PROJECT_NAME,
              code: PROJECT_CODE,
              manager_id: null,
              user_id: null,
              is_active: null,
              user_deleted_at: null,
              review_status: 'READY_FOR_KICKOFF',
            },
          ];
        }
        return [];
      });

      const returnEventWithNullPm: BusinessEvent<any> = {
        eventId: 'evt-mr-null-pm-011a',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-29T11:25:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 791,
        projectId: PROJECT_ID,
        actor: { userId: HOPS_USER_ID },
        routing: { userIds: [SUBMITTER_ID] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 791,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          action: 'RETURN',
          fromNode: 'node_hops_review',
          toNode: 'node_pm_revision_hops',
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          submittedBy: SUBMITTER_ID,
          projectManagerId: SUBMITTER_ID,
        },
      };

      const resNullPm = await consumer.handleWorkflowTaskReturned(returnEventWithNullPm);
      expect(resNullPm).toEqual([]);

      // Case 11B: Project row not found in DB at all
      mockDataSource.query.mockImplementation(async () => []);

      const returnEventMissingProject: BusinessEvent<any> = {
        ...returnEventWithNullPm,
        eventId: 'evt-mr-missing-project-011b',
      };

      const resMissingProject = await consumer.handleWorkflowTaskReturned(returnEventMissingProject);
      expect(resMissingProject).toEqual([]);

      expect(inMemoryNotifications).toHaveLength(0);
      expect(inMemoryPushOutbox).toHaveLength(0);
    });

    it('Scenario 12 (Negative): Submitter is NOT the Project PM (e.g. SUPER_ADMIN submitter) -> never sends Return/Approve to non-PM submitter', async () => {
      const SUPER_ADMIN_SUBMITTER_ID = 999;

      // Subcase 12A: Project has PM_A_ID (401), but SUPER_ADMIN (999) submitted it and is in routing.userIds / payload.submittedBy
      const returnEvent: BusinessEvent<any> = {
        eventId: 'evt-mr-nonpm-submitter-012a',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-29T11:30:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 792,
        projectId: PROJECT_ID,
        actor: { userId: PROCUREMENT_USER_ID },
        routing: { userIds: [SUPER_ADMIN_SUBMITTER_ID] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 792,
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          action: 'RETURN',
          fromNode: 'node_procurement_review',
          toNode: 'node_pm_revision_procurement',
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          submittedBy: SUPER_ADMIN_SUBMITTER_ID,
        },
      };

      const resReturn = await consumer.handleWorkflowTaskReturned(returnEvent);
      expect(resReturn).toHaveLength(1);
      expect(resReturn[0].recipientId).toBe(PM_A_ID);
      expect(inMemoryNotifications.some((n) => n.userId === SUPER_ADMIN_SUBMITTER_ID)).toBe(false);
      expect(inMemoryPushOutbox.some((p) => p.recipientId === SUPER_ADMIN_SUBMITTER_ID)).toBe(false);
    });

    it('Scenario 13 (Negative): Another PROJECT workflow completing with action APPROVE produces 0 Bell and 0 PushOutbox', async () => {
      // Subcase 13A: Explicit different workflowKey on PROJECT entity
      const otherProjectWorkflowCompleted: BusinessEvent<any> = {
        eventId: 'evt-other-proj-wf-013a',
        eventName: 'workflow.instance.completed',
        eventVersion: 1,
        occurredAt: '2026-10-29T11:35:00.000Z',
        aggregateType: 'WORKFLOW_INSTANCE',
        aggregateId: 801,
        projectId: PROJECT_ID,
        actor: { userId: DIRECTOR_USER_ID },
        routing: { userIds: [PM_A_ID] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          instanceId: 801,
          workflowKey: 'PROJECT_CLOSURE_WORKFLOW',
          finalStatus: 'COMPLETED',
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_end',
          action: 'APPROVE',
          reviewStatus: 'READY_FOR_KICKOFF',
        },
      };

      const res13a = await consumer.handleWorkflowInstanceCompleted(otherProjectWorkflowCompleted);
      expect(res13a).toEqual([]);

      // Subcase 13B: Omitted workflowKey in payload, DB lookup resolves to another workflow_key
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM workflow_instances')) {
          return [{ workflow_key: 'PROJECT_CUSTOM_APPROVAL_WORKFLOW' }];
        }
        return [];
      });

      const omittedKeyOtherWorkflow: BusinessEvent<any> = {
        ...otherProjectWorkflowCompleted,
        eventId: 'evt-other-proj-wf-013b',
        payload: {
          instanceId: 802,
          finalStatus: 'COMPLETED',
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_end',
          action: 'APPROVE',
          reviewStatus: 'READY_FOR_KICKOFF',
        },
      };

      const res13b = await consumer.handleWorkflowInstanceCompleted(omittedKeyOtherWorkflow);
      expect(res13b).toEqual([]);

      // Subcase 13C: PROJECT workflow completing with APPROVE without Management Review terminal node/status
      const genericProjectCompleted: BusinessEvent<any> = {
        eventId: 'evt-other-proj-wf-013c',
        eventName: 'workflow.instance.completed',
        eventVersion: 1,
        occurredAt: '2026-10-29T11:36:00.000Z',
        aggregateType: 'WORKFLOW_INSTANCE',
        aggregateId: 803,
        projectId: PROJECT_ID,
        actor: { userId: DIRECTOR_USER_ID },
        routing: { userIds: [PM_A_ID] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          instanceId: 803,
          finalStatus: 'COMPLETED',
          entityType: 'PROJECT',
          projectId: PROJECT_ID,
          action: 'APPROVE',
        },
      };

      const res13c = await consumer.handleWorkflowInstanceCompleted(genericProjectCompleted);
      expect(res13c).toEqual([]);

      expect(inMemoryNotifications).toHaveLength(0);
      expect(inMemoryPushOutbox).toHaveLength(0);
    });
  });

  describe('F-CRIT-01: Project Issue & Project Risk Canonical Handlers', () => {
    it('1. project.issue.created (CRITICAL) notifies owner, Project PM, and HOPS/PMO while excluding actor, with Bell + PushOutbox idempotency', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-issue-crit-001',
        eventName: 'project.issue.created',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:00:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 901,
        projectId: 100,
        actor: { userId: 401 }, // PM A is actor
        payload: {
          issueId: 901,
          issueNumber: 'ISS-2026-0001',
          projectId: 100,
          severity: 'CRITICAL',
          ownerId: 402, // Assigned to user 402
          reportedById: 401,
          actorId: 401,
        },
      };

      const first = await consumer.handleProjectIssueCreated(event);
      // Recipients: 402 (owner) and 501 (HOPS from role resolution), excluding actor 401 (PM A)
      expect(first.length).toBeGreaterThanOrEqual(1);
      expect((first as any).__outboxReceipt?.outcome).toBe('DELIVERED');
      expect(inMemoryNotifications.some((n) => n.userId === 402)).toBe(true);
      expect(inMemoryNotifications.some((n) => n.userId === 401)).toBe(false); // Actor excluded
      expect(inMemoryPushOutbox.some((p) => p.recipientId === 402)).toBe(true);

      // Retry idempotency
      const countBeforeRetry = inMemoryNotifications.length;
      const second = await consumer.handleProjectIssueCreated(event);
      expect(second.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);
      expect(inMemoryNotifications.length).toBe(countBeforeRetry);
      expect(inMemoryPushOutbox.length).toBe(countBeforeRetry);
    });

    it('2. project.issue.assigned, resolved, closed, reopened, escalated project to distinct recipients and exclude actor', async () => {
      const assignEvt: BusinessEvent<any> = {
        eventId: 'evt-issue-assign-002',
        eventName: 'project.issue.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:05:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 902,
        projectId: 100,
        actor: { userId: 401 },
        payload: {
          issueId: 902,
          issueNumber: 'ISS-2026-0002',
          projectId: 100,
          previousOwnerId: 401,
          newOwnerId: 402,
          actorId: 401,
        },
      };
      const resAssign = await consumer.handleProjectIssueAssigned(assignEvt);
      expect(resAssign).toHaveLength(1);
      expect(resAssign[0].recipientId).toBe(402);

      const resolvedEvt: BusinessEvent<any> = {
        eventId: 'evt-issue-resolved-002',
        eventName: 'project.issue.resolved',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:06:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 902,
        projectId: 100,
        actor: { userId: 402 },
        payload: {
          issueId: 902,
          issueNumber: 'ISS-2026-0002',
          projectId: 100,
          resolvedBy: 402,
          reportedById: 401,
        },
      };
      const resResolved = await consumer.handleProjectIssueResolved(resolvedEvt);
      expect(resResolved.some((r) => r.recipientId === 401)).toBe(true);

      const closedEvt: BusinessEvent<any> = {
        eventId: 'evt-issue-closed-002',
        eventName: 'project.issue.closed',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:07:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 902,
        projectId: 100,
        actor: { userId: 401 },
        payload: {
          issueId: 902,
          issueNumber: 'ISS-2026-0002',
          projectId: 100,
          closedBy: 401,
          ownerId: 402,
          reportedById: 401,
        },
      };
      const resClosed = await consumer.handleProjectIssueClosed(closedEvt);
      expect(resClosed).toHaveLength(1);
      expect(resClosed[0].recipientId).toBe(402);

      const reopenedEvt: BusinessEvent<any> = {
        eventId: 'evt-issue-reopened-002',
        eventName: 'project.issue.reopened',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:08:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 902,
        projectId: 100,
        actor: { userId: 401 },
        payload: {
          issueId: 902,
          issueNumber: 'ISS-2026-0002',
          projectId: 100,
          reopenedBy: 401,
          ownerId: 402,
          reason: 'Temuan lapangan belum tuntas',
        },
      };
      const resReopened = await consumer.handleProjectIssueReopened(reopenedEvt);
      expect(resReopened).toHaveLength(1);
      expect(resReopened[0].recipientId).toBe(402);

      const escalatedEvt: BusinessEvent<any> = {
        eventId: 'evt-issue-escalated-002',
        eventName: 'project.issue.escalated',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:09:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 902,
        projectId: 100,
        actor: { userId: 401 },
        payload: {
          issueId: 902,
          issueNumber: 'ISS-2026-0002',
          projectId: 100,
          ownerId: 402,
          actorId: 401,
        },
      };
      const resEscalated = await consumer.handleProjectIssueEscalated(escalatedEvt);
      expect(resEscalated.some((r) => r.recipientId === 402)).toBe(true);
    });

    it('3. routine project.issue.* events (started, cancelled, updated, status_changed) return INTENTIONALLY_IGNORED receipt', async () => {
      for (const eventName of [
        'project.issue.started',
        'project.issue.cancelled',
        'project.issue.updated',
        'project.issue.status_changed',
      ]) {
        const res = await consumer.handleProjectIssueRoutineSyncOnly({
          eventId: `evt-${eventName}`,
          eventName,
          eventVersion: 1,
          occurredAt: '2026-10-30T10:10:00.000Z',
          aggregateType: 'PROJECT_ISSUE',
          aggregateId: 905,
          payload: { issueId: 905 },
        });
        expect(res).toEqual([]);
        expect((res as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');
      }
      expect(inMemoryNotifications).toHaveLength(0);
    });

    it('4. project.risk.critical_detected, escalated, assigned, and routine project.risk.* events follow canonical contract', async () => {
      const critRiskEvt: BusinessEvent<any> = {
        eventId: 'evt-risk-crit-001',
        eventName: 'project.risk.critical_detected',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:15:00.000Z',
        aggregateType: 'PROJECT_RISK',
        aggregateId: 950,
        projectId: 100,
        actor: { userId: 401 },
        payload: {
          riskId: 950,
          riskNumber: 'RSK-2026-0001',
          projectId: 100,
          riskScore: 20,
          riskLevel: 'CRITICAL',
          ownerId: 402,
          actorId: 401,
        },
      };

      const resCrit = await consumer.handleProjectRiskCriticalDetected(critRiskEvt);
      expect((resCrit as any).__outboxReceipt?.outcome).toBe('DELIVERED');
      expect(resCrit.some((r) => r.recipientId === 402)).toBe(true);
      expect(resCrit.some((r) => r.recipientId === 401)).toBe(false);

      // Critical project.risk.created in same transaction is INTENTIONALLY_IGNORED to prevent duplicate notification
      const createdCritEvt: BusinessEvent<any> = {
        ...critRiskEvt,
        eventId: 'evt-risk-created-crit-001',
        eventName: 'project.risk.created',
      };
      const resCreatedCrit = await consumer.handleProjectRiskCreated(createdCritEvt);
      expect(resCreatedCrit).toEqual([]);
      expect((resCreatedCrit as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');

      // project.risk.assigned to distinct owner
      const assignRiskEvt: BusinessEvent<any> = {
        eventId: 'evt-risk-assign-002',
        eventName: 'project.risk.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:16:00.000Z',
        aggregateType: 'PROJECT_RISK',
        aggregateId: 951,
        projectId: 100,
        actor: { userId: 401 },
        payload: {
          riskId: 951,
          riskNumber: 'RSK-2026-0002',
          projectId: 100,
          newOwnerId: 402,
          actorId: 401,
        },
      };
      const resAssignRisk = await consumer.handleProjectRiskAssigned(assignRiskEvt);
      expect(resAssignRisk).toHaveLength(1);
      expect(resAssignRisk[0].recipientId).toBe(402);

      // Routine project.risk.* events return INTENTIONALLY_IGNORED
      for (const eventName of [
        'project.risk.assessed',
        'project.risk.materialized',
        'project.risk.closed',
        'project.risk.cancelled',
        'project.risk.updated',
        'project.risk.mitigation_updated',
        'project.risk.status_changed',
        'project.risk.reopened',
      ]) {
        const res = await consumer.handleProjectRiskRoutineSyncOnly({
          eventId: `evt-${eventName}`,
          eventName,
          eventVersion: 1,
          occurredAt: '2026-10-30T10:17:00.000Z',
          aggregateType: 'PROJECT_RISK',
          aggregateId: 952,
          payload: { riskId: 952 },
        });
        expect(res).toEqual([]);
        expect((res as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');
      }
    });

    it('5. GAP-ISS-01 & GAP-DL-01: resolves context from database when payload context is missing and targets operational route', async () => {
      mockDataSource.query.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM project_issues') && params[0] === 902) {
          return [
            {
              id: 902,
              issue_number: 'ISS-DB-902',
              project_id: 100,
              owner_id: 402,
              reported_by_id: 403,
              severity: 'HIGH',
            },
          ];
        }
        return [];
      });

      // Payload only has issueId and resolvedBy (older payload before publisher enrichment)
      const sparseResolvedEvt: BusinessEvent<any> = {
        eventId: 'evt-sparse-resolved-001',
        eventName: 'project.issue.resolved',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:20:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 902,
        payload: {
          issueId: 902,
          resolvedBy: 402, // Resolver (actor)
        },
      };

      const res = await consumer.handleProjectIssueResolved(sparseResolvedEvt);
      expect((res as any).__outboxReceipt?.outcome).toBe('DELIVERED');
      // Submitter 403 resolved from database receives notification!
      expect(res.some((r) => r.recipientId === 403)).toBe(true);
      // Resolver 402 excluded!
      expect(res.some((r) => r.recipientId === 402)).toBe(false);

      const savedNotif = inMemoryNotifications.find(
        (n) => n.userId === 403 && n.dedupeKey?.includes('PROJECT_ISSUE_RESOLVED'),
      );
      expect(savedNotif).toBeDefined();
      expect(savedNotif?.actionLink).toBe(
        '/project-delivery?view=workspace&projectId=100&section=issue-risk&type=issue&id=902',
      );
    });

    it('6. Issue Recipient Matrix: verifies self-actor exclusion, INTENTIONALLY_IGNORED on sole candidate, and Bell + PushOutbox parity for resolved, closed, reopened', async () => {
      // 1. resolved where actor === reporter (self-resolved) -> INTENTIONALLY_IGNORED
      const selfResolvedEvt: BusinessEvent<any> = {
        eventId: 'evt-self-resolved-001',
        eventName: 'project.issue.resolved',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:30:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 903,
        projectId: 100,
        actor: { userId: 401 },
        payload: {
          issueId: 903,
          issueNumber: 'ISS-2026-0003',
          projectId: 100,
          resolvedBy: 401,
          reportedById: 401, // sole candidate is actor
        },
      };
      const resSelfResolved = await consumer.handleProjectIssueResolved(selfResolvedEvt);
      expect(resSelfResolved).toEqual([]);
      expect((resSelfResolved as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');

      // 2. closed where actor === owner === reporter (self-closed) -> INTENTIONALLY_IGNORED
      const selfClosedEvt: BusinessEvent<any> = {
        eventId: 'evt-self-closed-001',
        eventName: 'project.issue.closed',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:31:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 903,
        projectId: 100,
        actor: { userId: 401 },
        payload: {
          issueId: 903,
          issueNumber: 'ISS-2026-0003',
          projectId: 100,
          closedBy: 401,
          ownerId: 401,
          reportedById: 401,
        },
      };
      const resSelfClosed = await consumer.handleProjectIssueClosed(selfClosedEvt);
      expect(resSelfClosed).toEqual([]);
      expect((resSelfClosed as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');

      // 3. reopened where actor === owner === pm (self-reopened) -> INTENTIONALLY_IGNORED
      const selfReopenedEvt: BusinessEvent<any> = {
        eventId: 'evt-self-reopened-001',
        eventName: 'project.issue.reopened',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:32:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 903,
        projectId: 100,
        actor: { userId: 401 },
        payload: {
          issueId: 903,
          issueNumber: 'ISS-2026-0003',
          projectId: 100,
          reopenedBy: 401,
          ownerId: 401,
        },
      };
      const resSelfReopened = await consumer.handleProjectIssueReopened(selfReopenedEvt);
      expect(resSelfReopened).toEqual([]);
      expect((resSelfReopened as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');

      // 4. Parity verification: distinct recipient produces both Bell and PushOutbox with exact dedupeKey matching
      const validClosedEvt: BusinessEvent<any> = {
        eventId: 'evt-parity-closed-001',
        eventName: 'project.issue.closed',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:33:00.000Z',
        aggregateType: 'PROJECT_ISSUE',
        aggregateId: 904,
        projectId: 100,
        actor: { userId: 401 },
        payload: {
          issueId: 904,
          issueNumber: 'ISS-2026-0004',
          projectId: 100,
          closedBy: 401,
          ownerId: 402,
          reportedById: 401,
        },
      };
      const resValidClosed = await consumer.handleProjectIssueClosed(validClosedEvt);
      expect(resValidClosed).toHaveLength(1);
      expect(resValidClosed[0].recipientId).toBe(402);
      expect((resValidClosed as any).__outboxReceipt?.outcome).toBe('DELIVERED');

      // Verify Bell Notification created
      const bell = inMemoryNotifications.find((n) => n.userId === 402 && n.dedupeKey?.includes('PROJECT_ISSUE_CLOSED'));
      expect(bell).toBeDefined();

      // Verify PushOutbox created
      const push = inMemoryPushOutbox.find((p) => p.recipientId === 402 && p.dedupeKey?.includes('PROJECT_ISSUE_CLOSED:PUSH'));
      expect(push).toBeDefined();
      expect(push?.status).toBe('PENDING');
    });
  });

  describe('F-CRIT-02: Workflow Notification Consumer Remediation (PR & Workflow Decoupling)', () => {
    const PR_ID = 101;
    const PR_NUMBER = 'PR-2026-00101';
    const PR_REQUESTER_ID = 502; // PROCUREMENT_USER_ID
    const FINANCE_ACTOR_ID = 503; // FINANCE_USER_ID
    const FINANCE_USER_B_ID = 505; // Another active FINANCE user not involved in this PR
    const DIRECTOR_ACTOR_ID = 504; // DIRECTOR_USER_ID
    const WORKFLOW_INSTANCE_ID = 8801;

    beforeEach(() => {
      mockDataSource.query.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM purchase_requests')) {
          const prId = Number(params?.[0]);
          if (prId === PR_ID) {
            return [
              {
                id: PR_ID,
                pr_number: PR_NUMBER,
                project_id: PROJECT_ID,
                requester_id: PR_REQUESTER_ID,
                created_by: PR_REQUESTER_ID,
                status: 'IN_REVIEW',
              },
            ];
          }
          return [];
        }
        if (sql.includes('FROM workflow_tasks')) {
          const requestedAction = params?.[2] ? String(params[2]).toUpperCase() : '';
          if (requestedAction === 'APPROVE') {
            return [
              {
                decided_by: FINANCE_ACTOR_ID,
              },
            ];
          }
          return [];
        }
        if (sql.includes('FROM workflow_instances')) {
          return [
            {
              id: WORKFLOW_INSTANCE_ID,
              entity_type: 'PURCHASE_REQUEST',
              entity_id: PR_ID,
              current_node_id: 'node_director_approval',
              workflow_key: 'PURCHASE_REQUEST_WORKFLOW',
            },
          ];
        }
        if (sql.includes('JOIN user_roles')) {
          const roles = params || [];
          const users: Array<{ id: number }> = [];
          if (roles.includes('HEAD_OF_OPERATIONS')) users.push({ id: HOPS_USER_ID });
          if (roles.includes('PROCUREMENT')) users.push({ id: PROCUREMENT_USER_ID });
          if (roles.includes('FINANCE')) users.push({ id: FINANCE_USER_ID }, { id: FINANCE_USER_B_ID });
          if (roles.includes('DIRECTOR')) users.push({ id: DIRECTOR_USER_ID });
          return users;
        }
        if (sql.includes('FROM users')) {
          const userId = Number(params?.[0]);
          if ([PM_A_ID, PM_B_ID, PMO_USER_ID, HOPS_USER_ID, PROCUREMENT_USER_ID, FINANCE_USER_ID, FINANCE_USER_B_ID, DIRECTOR_USER_ID].includes(userId)) {
            return [{ id: userId, is_active: 1, deleted_at: null }];
          }
          return [];
        }
        return [];
      });
    });

    it('1. PR Workflow Task Assigned (Finance -> Director approval): projects Bell + PushOutbox to Director and excludes actor', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-assign-dir-001',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:00:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7001,
        actor: { userId: FINANCE_ACTOR_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7001,
          workflowInstanceId: WORKFLOW_INSTANCE_ID,
          nodeId: 'node_director_approval',
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          actorId: FINANCE_ACTOR_ID,
          fromNode: 'node_finance_review',
          action: 'APPROVE',
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(event);
      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(DIRECTOR_USER_ID);
      expect((results as any).__outboxReceipt?.outcome).toBe('DELIVERED');

      // Verify Bell Notification created
      const bell = inMemoryNotifications.find(
        (n) => n.userId === DIRECTOR_USER_ID && n.dedupeKey?.includes('PURCHASE_REQUEST_DIRECTOR_APPROVAL_ASSIGNED'),
      );
      expect(bell).toBeDefined();
      expect(bell?.title).toBe('Persetujuan Purchase Request (Direktur)');
      expect(bell?.actionLink).toBe(`/procurement?tab=pr&prId=${PR_ID}`);

      // Verify PushOutbox created
      const push = inMemoryPushOutbox.find(
        (p) => p.recipientId === DIRECTOR_USER_ID && p.dedupeKey?.includes('PURCHASE_REQUEST_DIRECTOR_APPROVAL_ASSIGNED:PUSH'),
      );
      expect(push).toBeDefined();

      // Retry idempotency
      const countBeforeRetry = inMemoryNotifications.length;
      const retryResults = await consumer.handleWorkflowTaskAssigned(event);
      expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications.length).toBe(countBeforeRetry);
    });

    it('2. PR Workflow Task Assigned to node_finance_review: returns INTENTIONALLY_IGNORED (handled by procurement.pr.submitted)', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-assign-fin-002',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:05:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7002,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7002,
          workflowInstanceId: WORKFLOW_INSTANCE_ID,
          nodeId: 'node_finance_review',
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(event);
      expect(results).toEqual([]);
      expect((results as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');
      expect((results as any).__outboxReceipt?.reason).toContain('procurement.pr.submitted');
    });

    it('3. PR Workflow Task Returned by Director: notifies PR requester AND actual Finance reviewer (503), strictly excludes uninvolved Finance user (505) and Director actor (504)', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-return-dir-003',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:10:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7003,
        actor: { userId: DIRECTOR_ACTOR_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7003,
          instanceId: WORKFLOW_INSTANCE_ID,
          workflowInstanceId: WORKFLOW_INSTANCE_ID,
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_procurement_revision',
          action: 'RETURN',
          decidedBy: DIRECTOR_ACTOR_ID,
          reason: 'Anggaran melebihi batas triwulan, harap perbaiki kuantitas barang.',
        },
      };

      const results = await consumer.handleWorkflowTaskReturned(event);
      // Both PR requester (502) and Finance reviewer (503) are notified
      expect(results).toHaveLength(2);
      expect((results as any).__outboxReceipt?.outcome).toBe('DELIVERED');

      const recipientIds = results.map((r) => r.recipientId);
      expect(recipientIds).toContain(PR_REQUESTER_ID);
      expect(recipientIds).toContain(FINANCE_ACTOR_ID);
      expect(recipientIds).not.toContain(FINANCE_USER_B_ID); // Uninvolved Finance user strictly excluded
      expect(recipientIds).not.toContain(DIRECTOR_ACTOR_ID); // Actor excluded

      // Verify Bell Notifications
      const requesterBell = inMemoryNotifications.find(
        (n) => n.userId === PR_REQUESTER_ID && n.dedupeKey?.includes('PURCHASE_REQUEST_DIRECTOR_RETURNED'),
      );
      expect(requesterBell).toBeDefined();
      expect(requesterBell?.title).toBe('Purchase Request Dikembalikan Direktur');
      expect(requesterBell?.message).toContain('Anggaran melebihi batas');
      expect(requesterBell?.actionLink).toBe(`/procurement?tab=pr&prId=${PR_ID}`);

      const financeBell = inMemoryNotifications.find(
        (n) => n.userId === FINANCE_ACTOR_ID && n.dedupeKey?.includes('PURCHASE_REQUEST_DIRECTOR_RETURNED'),
      );
      expect(financeBell).toBeDefined();

      const uninvolvedBell = inMemoryNotifications.find(
        (n) => n.userId === FINANCE_USER_B_ID && n.dedupeKey?.includes('PURCHASE_REQUEST_DIRECTOR_RETURNED'),
      );
      expect(uninvolvedBell).toBeUndefined();

      // Verify PushOutbox for both
      expect(inMemoryPushOutbox.some((p) => p.recipientId === PR_REQUESTER_ID)).toBe(true);
      expect(inMemoryPushOutbox.some((p) => p.recipientId === FINANCE_ACTOR_ID)).toBe(true);
      expect(inMemoryPushOutbox.some((p) => p.recipientId === FINANCE_USER_B_ID)).toBe(false);
      expect(inMemoryPushOutbox.some((p) => p.recipientId === DIRECTOR_ACTOR_ID)).toBe(false);
    });

    it('3b. PR Workflow Task Returned by Director: when actual reviewer is not found in task history, does NOT fallback to role FINANCE and only notifies requester', async () => {
      // Mock workflow_tasks to return empty array (no completed review task found)
      mockDataSource.query.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM workflow_tasks')) {
          return []; // Zero task history
        }
        if (sql.includes('FROM purchase_requests')) {
          return [
            {
              id: PR_ID,
              pr_number: PR_NUMBER,
              project_id: PROJECT_ID,
              requester_id: PR_REQUESTER_ID,
              created_by: PR_REQUESTER_ID,
              status: 'IN_REVIEW',
            },
          ];
        }
        if (sql.includes('JOIN user_roles')) {
          return [{ id: FINANCE_USER_ID }, { id: FINANCE_USER_B_ID }];
        }
        if (sql.includes('FROM users')) {
          const userId = Number(params?.[0]);
          return [{ id: userId, is_active: 1, deleted_at: null }];
        }
        return [];
      });

      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-return-nofin-003b',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:12:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7003,
        actor: { userId: DIRECTOR_ACTOR_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7003,
          instanceId: WORKFLOW_INSTANCE_ID,
          workflowInstanceId: WORKFLOW_INSTANCE_ID,
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_procurement_revision',
          action: 'RETURN',
          decidedBy: DIRECTOR_ACTOR_ID,
          reason: 'Perlu revisi anggaran.',
        },
      };

      const results = await consumer.handleWorkflowTaskReturned(event);
      // Strictly only requester (502) is notified, zero Finance fallback
      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(PR_REQUESTER_ID);
      expect((results as any).__outboxReceipt?.outcome).toBe('DELIVERED');

      // Verify no Finance user received Bell notification
      expect(inMemoryNotifications.some((n) => n.userId === FINANCE_USER_ID)).toBe(false);
      expect(inMemoryNotifications.some((n) => n.userId === FINANCE_USER_B_ID)).toBe(false);

      // Verify PushOutbox parity
      expect(inMemoryPushOutbox.some((p) => p.recipientId === PR_REQUESTER_ID)).toBe(true);
      expect(inMemoryPushOutbox.some((p) => p.recipientId === FINANCE_USER_ID)).toBe(false);
      expect(inMemoryPushOutbox.some((p) => p.recipientId === FINANCE_USER_B_ID)).toBe(false);
    });

    it('3c. PR Workflow Task Returned by Director: task history from a different workflow instance is strictly ignored', async () => {
      const OTHER_INSTANCE_ID = 9999;
      // Mock workflow_tasks to only return data for OTHER_INSTANCE_ID, not WORKFLOW_INSTANCE_ID
      mockDataSource.query.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM workflow_tasks')) {
          const requestedInstanceId = Number(params?.[0]);
          if (requestedInstanceId === OTHER_INSTANCE_ID) {
            return [{ decided_by: FINANCE_USER_B_ID, assignee_user_id: FINANCE_USER_B_ID }];
          }
          return []; // This instance has no task history
        }
        if (sql.includes('FROM purchase_requests')) {
          return [
            {
              id: PR_ID,
              pr_number: PR_NUMBER,
              project_id: PROJECT_ID,
              requester_id: PR_REQUESTER_ID,
              created_by: PR_REQUESTER_ID,
              status: 'IN_REVIEW',
            },
          ];
        }
        if (sql.includes('FROM users')) {
          const userId = Number(params?.[0]);
          return [{ id: userId, is_active: 1, deleted_at: null }];
        }
        return [];
      });

      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-return-diff-instance-003c',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:14:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7003,
        actor: { userId: DIRECTOR_ACTOR_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7003,
          instanceId: WORKFLOW_INSTANCE_ID,
          workflowInstanceId: WORKFLOW_INSTANCE_ID,
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_procurement_revision',
          action: 'RETURN',
          decidedBy: DIRECTOR_ACTOR_ID,
        },
      };

      const results = await consumer.handleWorkflowTaskReturned(event);
      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(PR_REQUESTER_ID);
      expect(inMemoryNotifications.some((n) => n.userId === FINANCE_USER_B_ID)).toBe(false);
    });

    it('3d. PR Workflow Task Returned by Director: task COMPLETED with action RETURN or REJECT is strictly excluded (filter action = APPROVE)', async () => {
      // Mock workflow_tasks: query filters action = 'APPROVE'. Even if task was completed, action is RETURN, so DB returns []
      mockDataSource.query.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM workflow_tasks')) {
          const requestedAction = String(params?.[2] || '').toUpperCase();
          if (requestedAction === 'APPROVE') {
            return []; // No APPROVE task found (previous task had action RETURN)
          }
          return [{ decided_by: FINANCE_ACTOR_ID }];
        }
        if (sql.includes('FROM purchase_requests')) {
          return [
            {
              id: PR_ID,
              pr_number: PR_NUMBER,
              project_id: PROJECT_ID,
              requester_id: PR_REQUESTER_ID,
              created_by: PR_REQUESTER_ID,
              status: 'IN_REVIEW',
            },
          ];
        }
        if (sql.includes('FROM users')) {
          const userId = Number(params?.[0]);
          return [{ id: userId, is_active: 1, deleted_at: null }];
        }
        return [];
      });

      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-return-non-approve-003d',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:15:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7003,
        actor: { userId: DIRECTOR_ACTOR_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7003,
          instanceId: WORKFLOW_INSTANCE_ID,
          workflowInstanceId: WORKFLOW_INSTANCE_ID,
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_procurement_revision',
          action: 'RETURN',
          decidedBy: DIRECTOR_ACTOR_ID,
        },
      };

      const results = await consumer.handleWorkflowTaskReturned(event);
      // Finance user is NOT included because action was not APPROVE
      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(PR_REQUESTER_ID);
      expect(inMemoryNotifications.some((n) => n.userId === FINANCE_ACTOR_ID)).toBe(false);
    });

    it('3e. PR Workflow Task Returned by Director: task with status PENDING is strictly excluded', async () => {
      mockDataSource.query.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM workflow_tasks')) {
          // SQL has status = 'COMPLETED'. If only PENDING exists, query returns empty
          return [];
        }
        if (sql.includes('FROM purchase_requests')) {
          return [
            {
              id: PR_ID,
              pr_number: PR_NUMBER,
              project_id: PROJECT_ID,
              requester_id: PR_REQUESTER_ID,
              created_by: PR_REQUESTER_ID,
              status: 'IN_REVIEW',
            },
          ];
        }
        if (sql.includes('FROM users')) {
          const userId = Number(params?.[0]);
          return [{ id: userId, is_active: 1, deleted_at: null }];
        }
        return [];
      });

      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-return-pending-003e',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:16:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7003,
        actor: { userId: DIRECTOR_ACTOR_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7003,
          instanceId: WORKFLOW_INSTANCE_ID,
          workflowInstanceId: WORKFLOW_INSTANCE_ID,
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_procurement_revision',
          action: 'RETURN',
          decidedBy: DIRECTOR_ACTOR_ID,
        },
      };

      const results = await consumer.handleWorkflowTaskReturned(event);
      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(PR_REQUESTER_ID);
      expect(inMemoryNotifications.some((n) => n.userId === FINANCE_ACTOR_ID)).toBe(false);
    });

    it('3f. PR Workflow Task Returned by Director: inactive reviewer (is_active = 0) is strictly unresolved and excluded', async () => {
      mockDataSource.query.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM workflow_tasks')) {
          return [{ decided_by: FINANCE_ACTOR_ID }];
        }
        if (sql.includes('FROM purchase_requests')) {
          return [
            {
              id: PR_ID,
              pr_number: PR_NUMBER,
              project_id: PROJECT_ID,
              requester_id: PR_REQUESTER_ID,
              created_by: PR_REQUESTER_ID,
              status: 'IN_REVIEW',
            },
          ];
        }
        if (sql.includes('FROM users')) {
          const userId = Number(params?.[0]);
          if (userId === FINANCE_ACTOR_ID) {
            return [{ id: FINANCE_ACTOR_ID, is_active: 0, deleted_at: null }]; // INACTIVE
          }
          return [{ id: userId, is_active: 1, deleted_at: null }];
        }
        return [];
      });

      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-return-inactive-rev-003f',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:17:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7003,
        actor: { userId: DIRECTOR_ACTOR_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7003,
          instanceId: WORKFLOW_INSTANCE_ID,
          workflowInstanceId: WORKFLOW_INSTANCE_ID,
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_procurement_revision',
          action: 'RETURN',
          decidedBy: DIRECTOR_ACTOR_ID,
        },
      };

      const results = await consumer.handleWorkflowTaskReturned(event);
      // Inactive Finance reviewer is excluded; only active Requester (502) is notified
      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(PR_REQUESTER_ID);
      expect(inMemoryNotifications.some((n) => n.userId === FINANCE_ACTOR_ID)).toBe(false);
    });

    it('4. PR Workflow Task Returned by Finance: notifies PR requester only, excluding Finance actor', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-return-fin-004',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:15:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7004,
        actor: { userId: FINANCE_ACTOR_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7004,
          instanceId: WORKFLOW_INSTANCE_ID,
          workflowInstanceId: WORKFLOW_INSTANCE_ID,
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          fromNode: 'node_finance_review',
          toNode: 'node_procurement_revision',
          action: 'RETURN',
          decidedBy: FINANCE_ACTOR_ID,
          reason: 'Lampiran spesifikasi teknis belum lengkap.',
        },
      };

      const results = await consumer.handleWorkflowTaskReturned(event);
      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(PR_REQUESTER_ID);
      expect((results as any).__outboxReceipt?.outcome).toBe('DELIVERED');

      const bell = inMemoryNotifications.find(
        (n) => n.userId === PR_REQUESTER_ID && n.dedupeKey?.includes('PURCHASE_REQUEST_RETURNED_TO_PROCUREMENT'),
      );
      expect(bell).toBeDefined();
      expect(bell?.title).toBe('Purchase Request Dikembalikan Finance');
      expect(bell?.actionLink).toBe(`/procurement?tab=pr&prId=${PR_ID}`);
    });

    it('5. PR Workflow Instance Completed: returns INTENTIONALLY_IGNORED (preventing duplicate with procurement.pr.approved)', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-completed-005',
        eventName: 'workflow.instance.completed',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:20:00.000Z',
        aggregateType: 'WORKFLOW_INSTANCE',
        aggregateId: WORKFLOW_INSTANCE_ID,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          instanceId: WORKFLOW_INSTANCE_ID,
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          finalStatus: 'COMPLETED',
          action: 'APPROVE',
        },
      };

      const results = await consumer.handleWorkflowInstanceCompleted(event);
      expect(results).toEqual([]);
      expect((results as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');
      expect((results as any).__outboxReceipt?.reason).toContain('procurement.pr.approved');
    });

    it('6. PROJECT_CLOSURE workflow events: returns INTENTIONALLY_IGNORED (preventing duplicate with dedicated project.closure.*)', async () => {
      const assignEvent: BusinessEvent<any> = {
        eventId: 'evt-closure-wf-assign-006',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:25:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7006,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7006,
          workflowKey: 'PROJECT_CLOSURE',
          entityType: 'PROJECT',
          entityId: PROJECT_ID,
          nodeId: 'node_hoo_review',
        },
      };

      const resAssign = await consumer.handleWorkflowTaskAssigned(assignEvent);
      expect(resAssign).toEqual([]);
      expect((resAssign as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');

      const returnEvent: BusinessEvent<any> = {
        eventId: 'evt-closure-wf-return-006',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:26:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7007,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7007,
          workflowKey: 'PROJECT_CLOSURE',
          entityType: 'PROJECT',
          entityId: PROJECT_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_end_returned',
          action: 'RETURN',
        },
      };

      const resReturn = await consumer.handleWorkflowTaskReturned(returnEvent);
      expect(resReturn).toEqual([]);
      expect((resReturn as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');

      const completeEvent: BusinessEvent<any> = {
        eventId: 'evt-closure-wf-complete-006',
        eventName: 'workflow.instance.completed',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:27:00.000Z',
        aggregateType: 'WORKFLOW_INSTANCE',
        aggregateId: 8802,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          instanceId: 8802,
          workflowKey: 'PROJECT_CLOSURE',
          entityType: 'PROJECT',
          entityId: PROJECT_ID,
          finalStatus: 'COMPLETED',
        },
      };

      const resComplete = await consumer.handleWorkflowInstanceCompleted(completeEvent);
      expect(resComplete).toEqual([]);
      expect((resComplete as any).__outboxReceipt?.outcome).toBe('INTENTIONALLY_IGNORED');
    });

    it('7. Unrecognized workflow: returns empty array without receipt (NO_SUBSCRIBER quarantine in OutboxRelay)', async () => {
      const unknownEvent: BusinessEvent<any> = {
        eventId: 'evt-unknown-wf-007',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:30:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7008,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7008,
          workflowKey: 'UNRECOGNIZED_LEGACY_WORKFLOW',
          entityType: 'CUSTOM_ENTITY',
          nodeId: 'node_custom_step',
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(unknownEvent);
      expect(results).toEqual([]);
      expect((results as any).__outboxReceipt).toBeUndefined();
    });

    it('8. Missing workflowKey in payload: successfully resolves workflowKey from database workflow_instances', async () => {
      const eventWithoutKey: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-sparse-008',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-30T14:35:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 7009,
        actor: { userId: FINANCE_ACTOR_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 7009,
          workflowInstanceId: WORKFLOW_INSTANCE_ID, // DB lookup resolves to PURCHASE_REQUEST_WORKFLOW
          nodeId: 'node_director_approval',
          actorId: FINANCE_ACTOR_ID,
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(eventWithoutKey);
      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(DIRECTOR_USER_ID);
      expect((results as any).__outboxReceipt?.outcome).toBe('DELIVERED');
    });
  });
});
