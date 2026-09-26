import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource, Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';

describe('Phase N5: Project / PMO / PM Canonical Notification & Decoupling Suite', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let mockNotificationRepo: jest.Mocked<Partial<Repository<Notification>>>;
  let mockGateway: jest.Mocked<Partial<NotificationGateway>>;
  let mockEmailQueue: { add: jest.Mock };
  let mockDataSource: any;
  let inMemoryNotifications: Notification[];
  let socketPushes: Array<{ userId: number; notification: any }>;

  const PM_A_ID = 401;
  const PM_B_ID = 402;
  const PMO_USER_ID = 301;
  const PROJECT_ID = 901;
  const CONTRACT_ID = 801;
  const PROJECT_CODE = 'PRJ-TVM-2026-001';

  beforeEach(async () => {
    inMemoryNotifications = [];
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
      expect(saved.actionLink).toBe('/project-delivery');
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

  describe('2. Project Kickoff (project.kickoff.executed) Bell Isolation', () => {
    it('canonical project.kickoff.executed produces zero Bell notifications in CanonicalNotificationConsumer', async () => {
      // CanonicalNotificationConsumer does not listen to or project Bells for project.kickoff.executed
      // It is exclusively handled by BusinessSyncConsumer for DATA CHANGED
      expect((consumer as any).handleProjectKickoffExecuted).toBeUndefined();
      expect(inMemoryNotifications).toHaveLength(0);
    });
  });
});
