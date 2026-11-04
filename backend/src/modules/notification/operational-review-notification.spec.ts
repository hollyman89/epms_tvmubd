import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { Notification } from '../../entities/notification.entity';
import { PushOutbox, PushOutboxStatus } from '../../entities/push-outbox.entity';
import { NotificationGateway } from './notification.gateway';
import {
  BusinessEvent,
  NotificationPolicy,
} from '../../shared/contracts/business-event.contract';

describe('Operational Review (HOPS) Notification & Workflow Recipient Verification Suite', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;

  const inMemoryNotifications: Notification[] = [];
  const inMemoryPushOutbox: PushOutbox[] = [];
  const socketPushes: Array<{ userId: number; notification: any }> = [];

  const PROJECT_1_ID = 1001;
  const PROJECT_2_ID = 1002;
  const PROJECT_1_NAME = 'Pembangunan Fasilitas Operasional TVM';
  const PROJECT_2_NAME = 'Pengembangan Sistem Transmisi UBD';

  const PM_A_ID = 401; // Assigned PM for Project 1
  const PM_B_ID = 402; // Assigned PM for Project 2
  const HOPS_USER_ID = 501; // Reviewer for Operational Review (Head of Operations)
  const PROCUREMENT_USER_ID = 502; // Reviewer for Procurement Review

  let mockNotificationRepo: any;
  let mockPushOutboxRepo: any;
  let mockGateway: any;
  let mockDataSource: any;
  const mockEmailQueue = { add: jest.fn().mockResolvedValue({}) };

  beforeEach(async () => {
    inMemoryNotifications.length = 0;
    inMemoryPushOutbox.length = 0;
    socketPushes.length = 0;

    mockNotificationRepo = {
      save: jest.fn().mockImplementation(async (entity: any) => {
        if (Array.isArray(entity)) {
          const savedArr = entity.map((e, idx) =>
            Object.assign(new Notification(), e, {
              id: inMemoryNotifications.length + idx + 1,
            }),
          );
          inMemoryNotifications.push(...savedArr);
          return savedArr;
        }
        const saved = Object.assign(new Notification(), entity, {
          id: inMemoryNotifications.length + 1,
        });
        inMemoryNotifications.push(saved);
        return saved;
      }),
      find: jest.fn().mockImplementation(async () => inMemoryNotifications),
    };

    mockPushOutboxRepo = {
      save: jest.fn().mockImplementation(async (entity: any) => {
        if (Array.isArray(entity)) {
          const savedArr = entity.map((e, idx) =>
            Object.assign(new PushOutbox(), e, {
              id: inMemoryPushOutbox.length + idx + 1,
            }),
          );
          inMemoryPushOutbox.push(...savedArr);
          return savedArr;
        }
        const saved = Object.assign(new PushOutbox(), entity, {
          id: inMemoryPushOutbox.length + 1,
        });
        inMemoryPushOutbox.push(saved);
        return saved;
      }),
      find: jest.fn().mockImplementation(async () => inMemoryPushOutbox),
    };

    mockGateway = {
      sendNotificationToUser: jest.fn().mockImplementation((userId: number, notif: any) => {
        socketPushes.push({ userId, notification: notif });
      }),
      sendSyncEventToRooms: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM projects')) {
          const requestedProjectId = Number(params?.[0]);
          if (requestedProjectId === PROJECT_1_ID) {
            return [
              {
                id: PROJECT_1_ID,
                name: PROJECT_1_NAME,
                code: 'PRJ-TVM-001',
                manager_id: PM_A_ID,
                user_id: PM_A_ID,
                is_active: 1,
                user_deleted_at: null,
                review_status: 'IN_REVIEW',
              },
            ];
          }
          if (requestedProjectId === PROJECT_2_ID) {
            return [
              {
                id: PROJECT_2_ID,
                name: PROJECT_2_NAME,
                code: 'PRJ-UBD-002',
                manager_id: PM_B_ID,
                user_id: PM_B_ID,
                is_active: 1,
                user_deleted_at: null,
                review_status: 'IN_REVIEW',
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
          return users;
        }
        if (sql.includes('FROM users')) {
          const userId = Number(params?.[0]);
          return [{ id: userId, is_active: 1, deleted_at: null }];
        }
        return [];
      }),
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

  describe('1. Operational Review Task Assigned (PM Submit -> HOPS Reviewer)', () => {
    it('notifies Head of Operations, excludes actor PM A, excludes unassigned PM B, and populates both actionTarget and actionLink', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-op-review-assign-001',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-30T09:00:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 801,
        projectId: PROJECT_1_ID,
        actor: { userId: PM_A_ID },
        routing: {
          userIds: [],
          roles: ['HEAD_OF_OPERATIONS'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 801,
          workflowInstanceId: 301,
          nodeId: 'node_hops_review',
          assignedRoleId: 4,
          assignedUserId: null,
          entityType: 'PROJECT',
          projectId: PROJECT_1_ID,
          fromNode: 'node_start',
          action: 'AUTO',
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(HOPS_USER_ID);
      expect(results[0].purpose).toBe('MANAGEMENT_REVIEW_HOPS_ASSIGNED');

      // Bell notification checks
      expect(inMemoryNotifications).toHaveLength(1);
      const bell = inMemoryNotifications[0];
      expect(bell.userId).toBe(HOPS_USER_ID);
      expect(bell.title).toContain('Head of Operations (HOPS)');
      expect(bell.message).toContain(PROJECT_1_NAME);
      expect(bell.actionLink).toBe(`/governance/tasks?taskId=801&projectId=${PROJECT_1_ID}`);
      expect(bell.dedupeKey).toBe(`evt-op-review-assign-001:${HOPS_USER_ID}:MANAGEMENT_REVIEW_HOPS_ASSIGNED`);

      // Actor exclusion & PM isolation
      expect(inMemoryNotifications.some((n) => n.userId === PM_A_ID)).toBe(false);
      expect(inMemoryNotifications.some((n) => n.userId === PM_B_ID)).toBe(false);

      // PushOutbox checks
      expect(inMemoryPushOutbox).toHaveLength(1);
      const push = inMemoryPushOutbox[0];
      expect(push.recipientId).toBe(HOPS_USER_ID);
      expect(push.status).toBe(PushOutboxStatus.PENDING);
      expect(push.dedupeKey).toBe(`evt-op-review-assign-001:${HOPS_USER_ID}:MANAGEMENT_REVIEW_HOPS_ASSIGNED:PUSH`);

      // Both actionTarget and actionLink present and identical
      expect(push.payloadPreview?.actionTarget).toBe(`/governance/tasks?taskId=801&projectId=${PROJECT_1_ID}`);
      expect(push.payloadPreview?.actionLink).toBe(`/governance/tasks?taskId=801&projectId=${PROJECT_1_ID}`);
    });
  });

  describe('2. Operational Review Task Returned (HOPS Reviewer -> PM Revision)', () => {
    it('notifies assigned PM A with action=operational-plan, strictly excludes HOPS actor and uninvolved PM B', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-op-review-return-002',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T09:30:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 811,
        projectId: PROJECT_1_ID,
        actor: { userId: HOPS_USER_ID },
        routing: {
          userIds: [PM_B_ID], // Erroneous routing should be overridden by authoritative DB project manager
          roles: ['PROJECT_MANAGER'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 811,
          instanceId: 301,
          action: 'RETURN',
          decidedBy: HOPS_USER_ID,
          fromNode: 'node_hops_review',
          toNode: 'node_pm_revision_hops',
          reason: 'WBS bobot dan rincian jadwal perlu disesuaikan dengan kapasitas alat',
          entityType: 'PROJECT',
          projectId: PROJECT_1_ID,
        },
      };

      const results = await consumer.handleWorkflowTaskReturned(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(PM_A_ID);
      expect(results[0].purpose).toBe('MANAGEMENT_REVIEW_RETURNED_TO_PM');

      // Bell notification checks
      expect(inMemoryNotifications).toHaveLength(1);
      const bell = inMemoryNotifications[0];
      expect(bell.userId).toBe(PM_A_ID);
      expect(bell.title).toContain('Head of Operations (HOPS)');
      expect(bell.message).toContain('WBS bobot dan rincian jadwal perlu disesuaikan');
      expect(bell.actionLink).toBe(`/project-delivery?projectId=${PROJECT_1_ID}&action=operational-plan`);

      // Actor exclusion: HOPS reviewer excluded
      expect(inMemoryNotifications.some((n) => n.userId === HOPS_USER_ID)).toBe(false);
      // Isolation: PM B excluded
      expect(inMemoryNotifications.some((n) => n.userId === PM_B_ID)).toBe(false);

      // PushOutbox checks
      expect(inMemoryPushOutbox).toHaveLength(1);
      const push = inMemoryPushOutbox[0];
      expect(push.recipientId).toBe(PM_A_ID);
      expect(push.payloadPreview?.actionTarget).toBe(
        `/project-delivery?projectId=${PROJECT_1_ID}&action=operational-plan`,
      );
      expect(push.payloadPreview?.actionLink).toBe(
        `/project-delivery?projectId=${PROJECT_1_ID}&action=operational-plan`,
      );
    });
  });

  describe('3. Operational Review Task Approved (HOPS -> Procurement Handover)', () => {
    it('notifies next stage Procurement reviewer and excludes HOPS actor', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-op-review-approve-003',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:00:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 802,
        projectId: PROJECT_1_ID,
        actor: { userId: HOPS_USER_ID },
        routing: {
          userIds: [],
          roles: ['PROCUREMENT'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 802,
          workflowInstanceId: 301,
          nodeId: 'node_procurement_review',
          assignedRoleId: 5,
          assignedUserId: null,
          entityType: 'PROJECT',
          projectId: PROJECT_1_ID,
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
      expect(inMemoryNotifications.some((n) => n.userId === HOPS_USER_ID)).toBe(false);

      expect(inMemoryPushOutbox).toHaveLength(1);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionTarget).toBe(
        `/governance/tasks?taskId=802&projectId=${PROJECT_1_ID}`,
      );
      expect(inMemoryPushOutbox[0].payloadPreview?.actionLink).toBe(
        `/governance/tasks?taskId=802&projectId=${PROJECT_1_ID}`,
      );
    });
  });

  describe('4. PM Operational Plan Resubmit (PM Revision -> HOPS Re-review)', () => {
    it('notifies HOPS upon PM resubmission with target /governance/tasks', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-op-review-resubmit-004',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: '2026-10-30T10:30:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 803,
        projectId: PROJECT_1_ID,
        actor: { userId: PM_A_ID },
        routing: {
          userIds: [],
          roles: ['HEAD_OF_OPERATIONS'],
        },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 803,
          workflowInstanceId: 301,
          nodeId: 'node_hops_review',
          assignedRoleId: 4,
          assignedUserId: null,
          entityType: 'PROJECT',
          projectId: PROJECT_1_ID,
          fromNode: 'node_pm_revision_hops',
          action: 'RESUBMIT',
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(HOPS_USER_ID);
      expect(results[0].purpose).toBe('MANAGEMENT_REVIEW_HOPS_ASSIGNED');

      expect(inMemoryNotifications[0].userId).toBe(HOPS_USER_ID);
      expect(inMemoryNotifications[0].actionLink).toBe(`/governance/tasks?taskId=803&projectId=${PROJECT_1_ID}`);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionLink).toBe(
        `/governance/tasks?taskId=803&projectId=${PROJECT_1_ID}`,
      );
    });
  });

  describe('5. Cross-Instance Recipient Isolation', () => {
    it('guarantees that return on Project 1 notifies only PM A, while return on Project 2 notifies only PM B', async () => {
      // Event for Project 1
      const eventP1: BusinessEvent<any> = {
        eventId: 'evt-isolation-p1',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T11:00:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 821,
        projectId: PROJECT_1_ID,
        actor: { userId: HOPS_USER_ID },
        routing: { roles: ['PROJECT_MANAGER'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 821,
          instanceId: 301,
          action: 'RETURN',
          decidedBy: HOPS_USER_ID,
          fromNode: 'node_hops_review',
          toNode: 'node_pm_revision_hops',
          reason: 'Catatan Project 1',
          entityType: 'PROJECT',
          projectId: PROJECT_1_ID,
        },
      };

      // Event for Project 2
      const eventP2: BusinessEvent<any> = {
        eventId: 'evt-isolation-p2',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: '2026-10-30T11:05:00.000Z',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 822,
        projectId: PROJECT_2_ID,
        actor: { userId: HOPS_USER_ID },
        routing: { roles: ['PROJECT_MANAGER'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 822,
          instanceId: 302,
          action: 'RETURN',
          decidedBy: HOPS_USER_ID,
          fromNode: 'node_hops_review',
          toNode: 'node_pm_revision_hops',
          reason: 'Catatan Project 2',
          entityType: 'PROJECT',
          projectId: PROJECT_2_ID,
        },
      };

      await consumer.handleWorkflowTaskReturned(eventP1);
      await consumer.handleWorkflowTaskReturned(eventP2);

      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryNotifications[0].userId).toBe(PM_A_ID);
      expect(inMemoryNotifications[0].actionLink).toBe(
        `/project-delivery?projectId=${PROJECT_1_ID}&action=operational-plan`,
      );

      expect(inMemoryNotifications[1].userId).toBe(PM_B_ID);
      expect(inMemoryNotifications[1].actionLink).toBe(
        `/project-delivery?projectId=${PROJECT_2_ID}&action=operational-plan`,
      );

      // Verify no cross contamination
      expect(inMemoryNotifications[0].message).toContain('Catatan Project 1');
      expect(inMemoryNotifications[1].message).toContain('Catatan Project 2');
    });
  });
});

