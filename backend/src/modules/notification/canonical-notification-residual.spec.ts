import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { BusinessEvent, NotificationPolicy } from '../../shared/contracts/business-event.contract';

describe('Phase N8.1: Residual Legacy Producer Canonical Notification Specs', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let mockNotificationRepo: jest.Mocked<Partial<Repository<Notification>>>;
  let mockGateway: jest.Mocked<Partial<NotificationGateway>>;
  let mockEmailQueue: { add: jest.Mock };
  let inMemoryNotifications: Notification[];
  let socketPushes: Array<{ userId: number; notification: any }>;

  beforeEach(async () => {
    inMemoryNotifications = [];
    socketPushes = [];
    mockEmailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-email-1' }),
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

  describe('1. marketing.gonogo.submitted Canonical Event Projection', () => {
    const canonicalSubmittedEvent: BusinessEvent<{
      tenderId: number;
      tenderTitle: string;
      customerName: string;
      estimatedBudget: number;
      isResubmission: boolean;
      timestamp: string;
    }> = {
      eventId: 'evt-gonogo-sub-001',
      eventName: 'marketing.gonogo.submitted',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Tender',
      aggregateId: 101,
      actor: { userId: 25 },
      routing: {
        userIds: [25],
      },
      payload: {
        tenderId: 101,
        tenderTitle: 'Tender Pengadaan Tower TVM',
        customerName: 'PT Telco Mandiri',
        estimatedBudget: 500000000,
        isResubmission: false,
        timestamp: '2026-09-26T00:00:00.000Z',
      },
    };

    it('persists canonical Bell notification for submitter and emits WebSocket event', async () => {
      const results = await consumer.handleMarketingGoNoGoSubmitted(canonicalSubmittedEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(25);
      expect(results[0].purpose).toBe('MARKETING_GONOGO_SUBMITTED');

      const saved = inMemoryNotifications[0];
      expect(saved).toBeDefined();
      expect(saved.userId).toBe(25);
      expect(saved.title).toBe('GO/NO GO Berhasil Diajukan');
      expect(saved.message).toContain('Tender Pengadaan Tower TVM');
      expect(saved.notificationType).toBe('SYSTEM');
      expect(saved.actionLink).toBe('/sales/tenders/101');

      expect(socketPushes).toHaveLength(1);
      expect(socketPushes[0].userId).toBe(25);
    });

    it('suppresses duplicate projection idempotently on retry', async () => {
      await consumer.handleMarketingGoNoGoSubmitted(canonicalSubmittedEvent);
      const retryResults = await consumer.handleMarketingGoNoGoSubmitted(canonicalSubmittedEvent);

      expect(retryResults).toHaveLength(1);
      expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
      expect(socketPushes).toHaveLength(1);
    });
  });

  describe('2. marketing.gonogo.approved Canonical Event Projection', () => {
    const canonicalApprovedEvent: BusinessEvent<{
      tenderId: number;
      tenderTitle: string;
      customerName: string;
      estimatedBudget: number;
      stage: string;
      goNoGoStatus: string;
      decision: string;
      notes?: string;
      timestamp: string;
    }> = {
      eventId: 'evt-gonogo-app-002',
      eventName: 'marketing.gonogo.approved',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Tender',
      aggregateId: 101,
      actor: { userId: 5 },
      routing: {
        userIds: [25],
      },
      payload: {
        tenderId: 101,
        tenderTitle: 'Tender Pengadaan Tower TVM',
        customerName: 'PT Telco Mandiri',
        estimatedBudget: 500000000,
        stage: 'QUALIFICATION',
        goNoGoStatus: 'GO',
        decision: 'GO',
        notes: 'Approved by Director',
        timestamp: '2026-09-26T00:00:00.000Z',
      },
    };

    it('persists SUCCESS Bell notification for Marketing PIC on GO approval', async () => {
      const results = await consumer.handleMarketingGoNoGoApproved(canonicalApprovedEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(25);
      expect(results[0].purpose).toBe('MARKETING_GONOGO_APPROVED');

      const saved = inMemoryNotifications[0];
      expect(saved.userId).toBe(25);
      expect(saved.title).toBe('Tender Disetujui (GO)');
      expect(saved.notificationType).toBe('SYSTEM');
      expect(saved.actionLink).toBe('/sales/tenders/101');
    });

    it('suppresses duplicate projection idempotently on retry', async () => {
      await consumer.handleMarketingGoNoGoApproved(canonicalApprovedEvent);
      const retryResults = await consumer.handleMarketingGoNoGoApproved(canonicalApprovedEvent);

      expect(retryResults).toHaveLength(1);
      expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });
  });

  describe('3. marketing.discount.critical_warning Canonical Event Projection', () => {
    const canonicalWarningEvent: BusinessEvent<{
      tenderId: number;
      tenderTitle: string;
      discountPercentage: number;
      maxDiscount: number;
      newPrice: number;
      oldPrice: number;
      budget: number;
      timestamp: string;
    }> = {
      eventId: 'evt-disc-warn-003',
      eventName: 'marketing.discount.critical_warning',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Tender',
      aggregateId: 101,
      routing: {
        userIds: [5, 7],
      },
      payload: {
        tenderId: 101,
        tenderTitle: 'Tender Tol Japek',
        discountPercentage: 25.5,
        maxDiscount: 20,
        newPrice: 745000000,
        oldPrice: 1000000000,
        budget: 1000000000,
        timestamp: '2026-09-26T00:00:00.000Z',
      },
    };

    it('persists WARNING Bell notification to Directors / GMs', async () => {
      const results = await consumer.handleMarketingDiscountCriticalWarning(canonicalWarningEvent);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);
      expect(results.map((r) => r.recipientId).sort()).toEqual([5, 7]);

      const notifs = inMemoryNotifications;
      expect(notifs).toHaveLength(2);
      expect(notifs[0].title).toBe('Peringatan Diskon Kritis');
      expect(notifs[0].notificationType).toBe('ALERT');
      expect(notifs[0].actionLink).toBe('/sales?tab=1&tenderId=101&action=discount-approval');
    });

    it('suppresses duplicate projection idempotently on retry', async () => {
      await consumer.handleMarketingDiscountCriticalWarning(canonicalWarningEvent);
      const retryResults = await consumer.handleMarketingDiscountCriticalWarning(canonicalWarningEvent);

      expect(retryResults.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);
      expect(inMemoryNotifications).toHaveLength(2);
    });
  });

  describe('4. marketing.discount.rejected Canonical Event Projection', () => {
    const canonicalRejectedEvent: BusinessEvent<{
      tenderId: number;
      tenderTitle: string;
      notes: string;
      timestamp: string;
    }> = {
      eventId: 'evt-disc-rej-004',
      eventName: 'marketing.discount.rejected',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Tender',
      aggregateId: 101,
      routing: {
        userIds: [25],
      },
      payload: {
        tenderId: 101,
        tenderTitle: 'Tender Tol Japek',
        notes: 'Margin terlalu tipis, tidak disetujui',
        timestamp: '2026-09-26T00:00:00.000Z',
      },
    };

    it('persists WARNING Bell notification to Marketing PIC', async () => {
      const results = await consumer.handleMarketingDiscountRejected(canonicalRejectedEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(25);
      expect(results[0].purpose).toBe('MARKETING_DISCOUNT_REJECTED');

      const saved = inMemoryNotifications[0];
      expect(saved.title).toBe('Diskon Ditolak');
      expect(saved.message).toContain('Margin terlalu tipis');
      expect(saved.notificationType).toBe('ALERT');
      expect(saved.actionLink).toBe('/sales/tenders/101');
    });

    it('suppresses duplicate projection on retry', async () => {
      await consumer.handleMarketingDiscountRejected(canonicalRejectedEvent);
      const retryResults = await consumer.handleMarketingDiscountRejected(canonicalRejectedEvent);

      expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });
  });

  describe('5. marketing.discount.approved Canonical Event Projection', () => {
    const canonicalApprovedEvent: BusinessEvent<{
      tenderId: number;
      tenderTitle: string;
      notes: string;
      timestamp: string;
    }> = {
      eventId: 'evt-disc-app-005',
      eventName: 'marketing.discount.approved',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Tender',
      aggregateId: 101,
      routing: {
        userIds: [25],
      },
      payload: {
        tenderId: 101,
        tenderTitle: 'Tender Tol Japek',
        notes: 'Disetujui untuk closing kuartal ini',
        timestamp: '2026-09-26T00:00:00.000Z',
      },
    };

    it('persists SUCCESS Bell notification to Marketing PIC', async () => {
      const results = await consumer.handleMarketingDiscountApproved(canonicalApprovedEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(25);
      expect(results[0].purpose).toBe('MARKETING_DISCOUNT_APPROVED');

      const saved = inMemoryNotifications[0];
      expect(saved.title).toBe('Diskon Disetujui');
      expect(saved.message).toContain('Disetujui untuk closing kuartal ini');
      expect(saved.notificationType).toBe('SYSTEM');
      expect(saved.actionLink).toBe('/sales/tenders/101');
    });

    it('suppresses duplicate projection on retry', async () => {
      await consumer.handleMarketingDiscountApproved(canonicalApprovedEvent);
      const retryResults = await consumer.handleMarketingDiscountApproved(canonicalApprovedEvent);

      expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });
  });

  describe('6. project.started Canonical Event Projection', () => {
    const canonicalProjectStartedEvent: BusinessEvent<{
      projectId: number;
      contractId: number;
      contractNumber: string;
      tenderId: number;
      tenderTitle: string;
      projectCode: string;
      timestamp: string;
    }> = {
      eventId: 'evt-proj-start-006',
      eventName: 'project.started',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Project',
      aggregateId: 999,
      routing: {
        userIds: [30], // PMO user
      },
      payload: {
        projectId: 999,
        contractId: 501,
        contractNumber: 'CONT-2026-001',
        tenderId: 101,
        tenderTitle: 'Tender Jaringan Fiber Optik',
        projectCode: 'PRJ-2026-001',
        timestamp: '2026-09-26T00:00:00.000Z',
      },
    };

    it('persists INFO Bell notification to PMO', async () => {
      const results = await consumer.handleProjectStarted(canonicalProjectStartedEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(30);
      expect(results[0].purpose).toBe('PROJECT_OPERATIONAL_STARTED');

      const saved = inMemoryNotifications[0];
      expect(saved.title).toBe('Proyek Operasional Dimulai');
      expect(saved.message).toContain('Tender Jaringan Fiber Optik');
      expect(saved.notificationType).toBe('SYSTEM');
      expect(saved.actionLink).toBe('/project-delivery');
    });

    it('suppresses duplicate projection on retry', async () => {
      await consumer.handleProjectStarted(canonicalProjectStartedEvent);
      const retryResults = await consumer.handleProjectStarted(canonicalProjectStartedEvent);

      expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });
  });

  describe('7. Invariant Safety Guards', () => {
    it('skips non-canonical events missing eventId', async () => {
      const malformedEvent = {
        eventName: 'marketing.gonogo.submitted',
        payload: { tenderId: 101 },
      } as any;

      const results = await consumer.handleMarketingGoNoGoSubmitted(malformedEvent);
      expect(results).toEqual([]);
      expect(inMemoryNotifications).toHaveLength(0);
    });

    it('bypasses projection if notificationPolicy is SYNC_ONLY', async () => {
      const syncOnlyEvent: BusinessEvent<any> = {
        eventId: 'evt-sync-only-007',
        eventName: 'marketing.gonogo.submitted',
        eventVersion: 1,
        occurredAt: '2026-09-26T00:00:00.000Z',
        aggregateType: 'Tender',
        aggregateId: 101,
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        routing: { userIds: [25] },
        payload: { tenderId: 101, tenderTitle: 'Sync Only' },
      };

      const results = await consumer.handleMarketingGoNoGoSubmitted(syncOnlyEvent);
      expect(results).toEqual([]);
      expect(inMemoryNotifications).toHaveLength(0);
    });
  });
});
