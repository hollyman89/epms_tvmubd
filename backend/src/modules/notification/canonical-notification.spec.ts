import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { CanonicalNotificationError } from './canonical-notification.contract';
import { BusinessEvent, NotificationPolicy } from '../../shared/contracts/business-event.contract';
import { BusinessSyncConsumer } from './business-sync.consumer';

describe('CanonicalNotificationWriter & CanonicalNotificationConsumer (Phase N2.1 Hardening)', () => {
  let writer: CanonicalNotificationWriter;
  let consumer: CanonicalNotificationConsumer;
  let mockNotificationRepo: jest.Mocked<Partial<Repository<Notification>>>;
  let mockGateway: jest.Mocked<Partial<NotificationGateway>>;
  let mockEmailQueue: { add: jest.Mock };
  let inMemoryNotifications: Notification[];
  let socketPushes: Array<{ userId: number; notification: any }>;

  beforeEach(async () => {
    inMemoryNotifications = [];
    socketPushes = [];
    mockEmailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    mockNotificationRepo = {
      save: jest.fn().mockImplementation(async (entity: Notification) => {
        // Enforce the unique index constraint on (userId, dedupeKey)
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
      ],
    }).compile();

    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
  });

  // =========================================================================
  // GAP 1: TYPE BOUNDARY & TASK REJECTION TESTS (Phase N2.1)
  // =========================================================================

  describe('Gap 1: Type Boundary & Task System Protection', () => {
    it('1. Canonical notification with type INFO succeeds (mapped to SYSTEM)', async () => {
      const result = await writer.persistCanonicalNotification({
        eventId: 'evt-info-1',
        recipientId: 10,
        purpose: 'INFO_ALERT',
        title: 'Info Pembaruan',
        message: 'Informasi sistem terbaru',
        type: 'INFO',
      });

      expect(result.status).toBe('PERSISTED');
      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryNotifications[0].notificationType).toBe('SYSTEM');
    });

    it('2. Canonical notification with valid informational types (WARNING, SUCCESS, ERROR) succeed', async () => {
      await writer.persistCanonicalNotification({
        eventId: 'evt-type-warn',
        recipientId: 11,
        purpose: 'SLA_WARN',
        title: 'Peringatan SLA',
        message: 'Batas waktu mendekat',
        type: 'WARNING',
      });

      await writer.persistCanonicalNotification({
        eventId: 'evt-type-succ',
        recipientId: 12,
        purpose: 'TENDER_WON',
        title: 'Tender Berhasil',
        message: 'Tender telah dimenangkan',
        type: 'SUCCESS',
      });

      expect(inMemoryNotifications.length).toBe(2);
      expect(inMemoryNotifications[0].notificationType).toBe('ALERT'); // WARNING -> ALERT
      expect(inMemoryNotifications[1].notificationType).toBe('SYSTEM'); // SUCCESS -> SYSTEM
    });

    it('3. Canonical notification with type TASK is explicitly rejected with ACTIONABLE_TASK_NOT_ALLOWED', async () => {
      await expect(
        writer.persistCanonicalNotification({
          eventId: 'evt-task-1',
          recipientId: 15,
          purpose: 'TASK_ASSIGNED',
          title: 'Tugas Alur Kerja',
          message: 'Silakan kerjakan tugas ini',
          type: 'TASK',
        }),
      ).rejects.toThrow('ACTIONABLE_TASK_NOT_ALLOWED');
    });

    it('4. TASK rejection creates no DB row', async () => {
      try {
        await writer.persistCanonicalNotification({
          eventId: 'evt-task-2',
          recipientId: 15,
          purpose: 'TASK_ASSIGNED',
          title: 'Tugas Alur Kerja',
          message: 'Silakan kerjakan tugas ini',
          type: 'TASK',
        });
      } catch {
        // expected rejection
      }

      expect(inMemoryNotifications.length).toBe(0);
      expect(mockNotificationRepo.save).not.toHaveBeenCalled();
    });

    it('5. TASK rejection emits no new_notification socket', async () => {
      try {
        await writer.persistCanonicalNotification({
          eventId: 'evt-task-3',
          recipientId: 15,
          purpose: 'TASK_ASSIGNED',
          title: 'Tugas Alur Kerja',
          message: 'Silakan kerjakan tugas ini',
          type: 'TASK',
        });
      } catch {
        // expected rejection
      }

      expect(mockGateway.sendNotificationToUser).not.toHaveBeenCalled();
      expect(socketPushes.length).toBe(0);
    });

    it('6. TASK rejection enqueues no secondary delivery', async () => {
      try {
        await writer.persistCanonicalNotification({
          eventId: 'evt-task-4',
          recipientId: 15,
          purpose: 'TASK_ASSIGNED',
          title: 'Tugas Alur Kerja',
          message: 'Silakan kerjakan tugas ini',
          type: 'TASK',
          sendEmail: true,
        });
      } catch {
        // expected rejection
      }

      expect(mockEmailQueue.add).not.toHaveBeenCalled();
    });

    it('7. CanonicalNotificationConsumer explicitly rejects projection config with type TASK', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-consumer-task-1',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 900,
        routing: { userIds: [15] },
        payload: {},
      };

      await expect(
        consumer.projectEventToNotifications(event, {
          purpose: 'TASK_ASSIGNMENT',
          title: 'Tugas Alur Kerja',
          message: 'Silakan kerjakan tugas',
          type: 'TASK',
        }),
      ).rejects.toThrow('ACTIONABLE_TASK_NOT_ALLOWED');
    });

    it('8. Canonical writer rejects TASK notification (actionable tasks must route to WorkflowTask)', async () => {
      // Phase N9: Legacy NotificationEventListener and notification.send infrastructure retired
      const invalidTaskInput: any = {
        eventId: 'evt-legacy-task-001',
        recipientId: 99,
        purpose: 'LEGACY_TASK_CHECK',
        type: 'TASK',
        title: 'Legacy Task Notif',
        message: 'Legacy task message',
      };

      await expect(writer.persistCanonicalNotification(invalidTaskInput)).rejects.toThrow(
        'ACTIONABLE_TASK_NOT_ALLOWED',
      );
    });
  });

  // =========================================================================
  // GAP 2: SECONDARY DELIVERY IDEMPOTENCY TESTS (Phase N2.1)
  // =========================================================================

  describe('Gap 2: Secondary Delivery Idempotency & BullMQ Deduplication', () => {
    it('9. PERSISTED canonical projection triggers secondary delivery with deterministic jobId', async () => {
      const result = await writer.persistCanonicalNotification({
        eventId: 'evt-email-1',
        recipientId: 44,
        purpose: 'APPROVAL_MILESTONE',
        title: 'Email Persetujuan',
        message: 'Dokumen disetujui',
        sendEmail: true,
      });

      expect(result.status).toBe('PERSISTED');
      expect(mockEmailQueue.add).toHaveBeenCalledTimes(1);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'user_44@company.com',
          subject: 'Email Persetujuan',
        }),
        expect.objectContaining({
          jobId: 'email:evt-email-1:44:APPROVAL_MILESTONE',
        }),
      );
    });

    it('10. DUPLICATE_SUPPRESSED never triggers second socket emit', async () => {
      const payload = {
        eventId: 'evt-dup-socket',
        recipientId: 45,
        purpose: 'INFO',
        title: 'Judul',
        message: 'Pesan',
      };

      await writer.persistCanonicalNotification(payload);
      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(1);

      const dupResult = await writer.persistCanonicalNotification(payload);
      expect(dupResult.status).toBe('DUPLICATE_SUPPRESSED');
      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(1); // STILL 1
    });

    it('11. DUPLICATE_SUPPRESSED never triggers second email/BullMQ job', async () => {
      const payload = {
        eventId: 'evt-dup-email',
        recipientId: 46,
        purpose: 'CONTRACT_ALERT',
        title: 'Review Kontrak',
        message: 'Kontrak siap direview',
        sendEmail: true,
      };

      const res1 = await writer.persistCanonicalNotification(payload);
      expect(res1.status).toBe('PERSISTED');
      expect(mockEmailQueue.add).toHaveBeenCalledTimes(1);

      const res2 = await writer.persistCanonicalNotification(payload);
      expect(res2.status).toBe('DUPLICATE_SUPPRESSED');
      expect(mockEmailQueue.add).toHaveBeenCalledTimes(1); // STILL 1
    });

    it('12. Concurrent duplicate canonical delivery produces exactly 1 DB row, 1 socket, 1 email job', async () => {
      const payload = {
        eventId: 'evt-concurrent-email',
        recipientId: 47,
        purpose: 'CRITICAL_NOTICE',
        title: 'Pemberitahuan Kritis',
        message: 'Pemberitahuan sistem kritis',
        sendEmail: true,
      };

      const [res1, res2] = await Promise.all([
        writer.persistCanonicalNotification(payload),
        writer.persistCanonicalNotification(payload),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual(['DUPLICATE_SUPPRESSED', 'PERSISTED']);
      expect(inMemoryNotifications.length).toBe(1);
      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(1);
      expect(mockEmailQueue.add).toHaveBeenCalledTimes(1);
    });

    it('13. Different recipient yields independent valid secondary delivery', async () => {
      await writer.persistCanonicalNotification({
        eventId: 'evt-multicast-email',
        recipientId: 51,
        purpose: 'BROADCAST',
        title: 'Broadcast',
        message: 'Halo User 51',
        sendEmail: true,
      });

      await writer.persistCanonicalNotification({
        eventId: 'evt-multicast-email',
        recipientId: 52,
        purpose: 'BROADCAST',
        title: 'Broadcast',
        message: 'Halo User 52',
        sendEmail: true,
      });

      expect(inMemoryNotifications.length).toBe(2);
      expect(mockEmailQueue.add).toHaveBeenCalledTimes(2);
      expect(mockEmailQueue.add).toHaveBeenNthCalledWith(
        1,
        'send-email',
        expect.any(Object),
        { jobId: 'email:evt-multicast-email:51:BROADCAST' },
      );
      expect(mockEmailQueue.add).toHaveBeenNthCalledWith(
        2,
        'send-email',
        expect.any(Object),
        { jobId: 'email:evt-multicast-email:52:BROADCAST' },
      );
    });

    it('14. Different purpose yields independent valid secondary delivery', async () => {
      await writer.persistCanonicalNotification({
        eventId: 'evt-multipurpose-email',
        recipientId: 53,
        purpose: 'PURPOSE_A',
        title: 'Title A',
        message: 'Message A',
        sendEmail: true,
      });

      await writer.persistCanonicalNotification({
        eventId: 'evt-multipurpose-email',
        recipientId: 53,
        purpose: 'PURPOSE_B',
        title: 'Title B',
        message: 'Message B',
        sendEmail: true,
      });

      expect(inMemoryNotifications.length).toBe(2);
      expect(mockEmailQueue.add).toHaveBeenCalledTimes(2);
      expect(mockEmailQueue.add).toHaveBeenNthCalledWith(
        1,
        'send-email',
        expect.any(Object),
        { jobId: 'email:evt-multipurpose-email:53:PURPOSE_A' },
      );
      expect(mockEmailQueue.add).toHaveBeenNthCalledWith(
        2,
        'send-email',
        expect.any(Object),
        { jobId: 'email:evt-multipurpose-email:53:PURPOSE_B' },
      );
    });
  });

  // =========================================================================
  // FOUNDATION & RESPONSIBILITY BOUNDARY CONTRACT TESTS (Preserved from N2)
  // =========================================================================

  describe('Foundation & Responsibility Boundary Tests', () => {
    it('15. Canonical projection with valid eventId creates one Notification', async () => {
      const result = await writer.persistCanonicalNotification({
        eventId: 'evt-1001',
        recipientId: 42,
        purpose: 'ASSIGNMENT_INFO',
        title: 'Tugas Baru',
        message: 'Anda mendapatkan tugas baru',
        type: 'ALERT',
      });

      expect(result.status).toBe('PERSISTED');
      expect(result.notificationId).toBeDefined();
      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryNotifications[0].userId).toBe(42);
      expect(inMemoryNotifications[0].dedupeKey).toBe('evt-1001:42:ASSIGNMENT_INFO');
    });

    it('16. Generated dedupe identity is deterministic', () => {
      const key1 = writer.generateDedupeKey('evt-1002', 15, 'SLA_ALERT');
      const key2 = writer.generateDedupeKey('  evt-1002  ', 15, 'sla_alert');

      expect(key1).toBe('evt-1002:15:SLA_ALERT');
      expect(key2).toBe('evt-1002:15:SLA_ALERT');
      expect(key1).toBe(key2);
    });

    it('17. Missing eventId rejected safely with MISSING_EVENT_ID', async () => {
      await expect(
        writer.persistCanonicalNotification({
          eventId: '',
          recipientId: 1,
          purpose: 'TEST',
          title: 'Title',
          message: 'Message',
        }),
      ).rejects.toThrow('MISSING_EVENT_ID');
    });

    it('18. Missing recipient rejected safely with MISSING_RECIPIENT', async () => {
      await expect(
        writer.persistCanonicalNotification({
          eventId: 'evt-1010',
          recipientId: 0,
          purpose: 'TEST',
          title: 'Title',
          message: 'Message',
        }),
      ).rejects.toThrow('MISSING_RECIPIENT');
    });

    it('19. Missing purpose rejected safely with MISSING_PURPOSE', async () => {
      await expect(
        writer.persistCanonicalNotification({
          eventId: 'evt-1011',
          recipientId: 1,
          purpose: '',
          title: 'Title',
          message: 'Message',
        }),
      ).rejects.toThrow('MISSING_PURPOSE');
    });

    it('20. Canonical writer does NOT create WorkflowTask', () => {
      const dependencies = Reflect.getMetadata('design:paramtypes', CanonicalNotificationWriter);
      const hasWorkflowEngine = dependencies?.some((dep: any) => dep?.name?.includes('Workflow'));
      expect(hasWorkflowEngine).toBeFalsy();
    });

    it('21. Canonical writer does NOT write AuditLog', () => {
      const dependencies = Reflect.getMetadata('design:paramtypes', CanonicalNotificationWriter);
      const hasAuditLog = dependencies?.some((dep: any) => dep?.name?.includes('Audit'));
      expect(hasAuditLog).toBeFalsy();
    });

    it('22. Canonical writer does NOT emit business:sync', async () => {
      await writer.persistCanonicalNotification({
        eventId: 'evt-1014',
        recipientId: 12,
        purpose: 'INFO',
        title: 'Title',
        message: 'Message',
      });

      expect(mockGateway.sendSyncEventToRooms).not.toHaveBeenCalled();
      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(1);
    });

    it('23. BusinessSyncConsumer still does NOT write Notification DB rows', () => {
      const syncConsumerDependencies = Reflect.getMetadata('design:paramtypes', BusinessSyncConsumer);
      const hasNotificationRepo = syncConsumerDependencies?.some((dep: any) =>
        dep?.name?.includes('Repository') || dep?.name?.includes('NotificationService'),
      );
      expect(hasNotificationRepo).toBeFalsy();
    });

    it('24. Consumer skips projection when notificationPolicy is SYNC_ONLY', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-sync-only-1',
        eventName: 'procurement.rfq.created',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'RFQ',
        aggregateId: 999,
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        routing: { userIds: [1, 2, 3] },
        payload: {},
      };

      const results = await consumer.projectEventToNotifications(event, {
        purpose: 'RFQ_CREATED_ALERT',
        title: 'RFQ Baru',
        message: 'RFQ baru telah dibuat',
      });

      expect(results).toEqual([]);
      expect(inMemoryNotifications.length).toBe(0);
      expect(mockGateway.sendNotificationToUser).not.toHaveBeenCalled();
    });

    it('25. Consumer resolves explicit recipients strictly without semantic guessing', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-routing-1',
        eventName: 'project.pm.assigned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Project',
        aggregateId: 501,
        routing: { userIds: [88] },
        payload: { managerId: 88, guessedActor: 99 },
      };

      const results = await consumer.projectEventToNotifications(event, {
        purpose: 'PM_ASSIGNMENT_INFO',
        title: 'Penugasan PM',
        message: 'Anda ditugaskan sebagai PM',
      });

      expect(results.length).toBe(1);
      expect(results[0].recipientId).toBe(88);
      expect(inMemoryNotifications[0].userId).toBe(88);
      expect(inMemoryNotifications[0].dedupeKey).toBe('evt-routing-1:88:PM_ASSIGNMENT_INFO');
    });

    it('26. No new Bell is automatically created when zero explicit recipients are configured', async () => {
      const event: BusinessEvent = {
        eventId: 'evt-no-recipients',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 101,
        routing: {},
        payload: {},
      };

      const results = await consumer.projectEventToNotifications(event, {
        purpose: 'TASK_ASSIGNED_INFO',
        title: 'Tugas Alur Kerja',
        message: 'Tugas alur kerja baru',
      });

      expect(results).toEqual([]);
      expect(inMemoryNotifications.length).toBe(0);
    });

    it('27. Batch projection produces exactly one Bell per recipient with correct dedupeKeys', async () => {
      const results = await writer.persistBatch([
        {
          eventId: 'evt-batch-1',
          recipientId: 1,
          purpose: 'BATCH_ALERT',
          title: 'Batch Notice',
          message: 'Message 1',
        },
        {
          eventId: 'evt-batch-1',
          recipientId: 2,
          purpose: 'BATCH_ALERT',
          title: 'Batch Notice',
          message: 'Message 2',
        },
        {
          eventId: 'evt-batch-1',
          recipientId: 1,
          purpose: 'BATCH_ALERT',
          title: 'Batch Notice',
          message: 'Message 1 Duplicate',
        },
      ]);

      expect(results.length).toBe(3);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[1].status).toBe('PERSISTED');
      expect(results[2].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications.length).toBe(2);
    });

    it('28. Notification metadata preserves eventId and purpose for downstream auditability', async () => {
      await writer.persistCanonicalNotification({
        eventId: 'evt-meta-trace-1',
        recipientId: 33,
        purpose: 'LEGAL_MILESTONE',
        title: 'Kontrak Disetujui',
        message: 'Legal telah menyetujui kontrak',
        metaData: { contractId: 456, customFlag: true },
      });

      expect(inMemoryNotifications[0].metaData).toEqual({
        contractId: 456,
        customFlag: true,
        eventId: 'evt-meta-trace-1',
        purpose: 'LEGAL_MILESTONE',
      });
    });
  });
});
