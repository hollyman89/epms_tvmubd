import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository, LessThan } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';
import { Tender, TenderStatus, TenderStage } from '../../entities/tender.entity';
import { TenderScheduler } from '../marketing/tender.scheduler';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';

describe('Phase N8: System / SLA Canonical Notification & Scheduler Idempotency', () => {
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

  describe('1. system.sla.spk_grace_expired Canonical Event', () => {
    const canonicalSpkExpiredEvent: BusinessEvent<{
      tenderId: number;
      tenderTitle: string;
      marketingPicId: number;
      reason: string;
      previousStatus: string;
      currentStatus: string;
    }> = {
      eventId: 'evt-sla-spk-exp-001',
      eventName: 'system.sla.spk_grace_expired',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Tender',
      aggregateId: 101,
      routing: {
        userIds: [25, 10], // Marketing PIC (25) + Director (10)
      },
      payload: {
        tenderId: 101,
        tenderTitle: 'Pengadaan Server DC',
        marketingPicId: 25,
        reason: 'SPK_GRACE_PERIOD_EXPIRED',
        previousStatus: 'WON',
        currentStatus: 'NEGOTIATION',
      },
    };

    it('creates exactly 1 Bell for each resolved recipient with correct dedupeKey', async () => {
      const results = await consumer.handleSystemSlaSpkGraceExpired(canonicalSpkExpiredEvent);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[1].status).toBe('PERSISTED');

      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryNotifications[0].userId).toBe(25);
      expect(inMemoryNotifications[0].title).toBe('SPK Belum Diunggah');
      expect(inMemoryNotifications[0].notificationType).toBe('ALERT');
      expect(inMemoryNotifications[0].dedupeKey).toBe('evt-sla-spk-exp-001:25:SYSTEM_SLA_SPK_GRACE_EXPIRED');

      expect(inMemoryNotifications[1].userId).toBe(10);
      expect(inMemoryNotifications[1].dedupeKey).toBe('evt-sla-spk-exp-001:10:SYSTEM_SLA_SPK_GRACE_EXPIRED');

      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(2);
      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledWith(25, expect.any(Object));
      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledWith(10, expect.any(Object));
    });

    it('suppresses duplicate DB insert and WebSocket push on retried delivery', async () => {
      // First delivery
      await consumer.handleSystemSlaSpkGraceExpired(canonicalSpkExpiredEvent);
      expect(inMemoryNotifications).toHaveLength(2);
      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(2);

      // Retried delivery with same eventId
      const retriedResults = await consumer.handleSystemSlaSpkGraceExpired(canonicalSpkExpiredEvent);

      expect(retriedResults).toHaveLength(2);
      expect(retriedResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(retriedResults[1].status).toBe('DUPLICATE_SUPPRESSED');

      // Zero additional DB rows or socket pushes
      expect(inMemoryNotifications).toHaveLength(2);
      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(2);
    });

    it('unrelated user receives zero Bell', async () => {
      await consumer.handleSystemSlaSpkGraceExpired(canonicalSpkExpiredEvent);

      const unrelatedNotif = inMemoryNotifications.find((n) => n.userId === 999);
      expect(unrelatedNotif).toBeUndefined();
    });
  });

  describe('2. system.sla.revision_expired Canonical Event', () => {
    const canonicalRevisionExpiredEvent: BusinessEvent<{
      contractId: number;
      tenderId: number;
      tenderTitle: string;
      marketingPicId: number;
      reason: string;
      previousStage: string;
      currentStage: string;
    }> = {
      eventId: 'evt-sla-rev-exp-002',
      eventName: 'system.sla.revision_expired',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Contract',
      aggregateId: 50,
      routing: {
        userIds: [25, 10], // Marketing PIC + Director
      },
      payload: {
        contractId: 50,
        tenderId: 102,
        tenderTitle: 'Tender Renovasi Data Center',
        marketingPicId: 25,
        reason: 'LEGAL_REVISION_SLA_EXPIRED',
        previousStage: 'WON',
        currentStage: 'NEGOTIATION',
      },
    };

    it('creates exactly 1 Bell for each resolved recipient with actionTarget to tender', async () => {
      const results = await consumer.handleSystemSlaRevisionExpired(canonicalRevisionExpiredEvent);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[1].status).toBe('PERSISTED');

      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryNotifications[0].userId).toBe(25);
      expect(inMemoryNotifications[0].title).toBe('Tender Dikembalikan ke Negotiation');
      expect(inMemoryNotifications[0].message).toContain('Tender Renovasi Data Center');
      expect(inMemoryNotifications[0].actionLink).toBe('/sales/tenders/102');
      expect(inMemoryNotifications[0].dedupeKey).toBe('evt-sla-rev-exp-002:25:SYSTEM_SLA_REVISION_EXPIRED');

      expect(mockGateway.sendNotificationToUser).toHaveBeenCalledTimes(2);
    });

    it('suppresses duplicate DB insert on retried event', async () => {
      await consumer.handleSystemSlaRevisionExpired(canonicalRevisionExpiredEvent);
      expect(inMemoryNotifications).toHaveLength(2);

      const retryResults = await consumer.handleSystemSlaRevisionExpired(canonicalRevisionExpiredEvent);
      expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(retryResults[1].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(2);
    });
  });

  describe('3. system.sla.revision_reminder_h1 Canonical Event', () => {
    const canonicalH1ReminderEvent: BusinessEvent<{
      contractId: number;
      tenderId: number;
      tenderTitle: string;
      marketingPicId: number;
      hoursRemaining: number;
    }> = {
      eventId: 'evt-sla-rev-h1-003',
      eventName: 'system.sla.revision_reminder_h1',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Contract',
      aggregateId: 50,
      routing: {
        userIds: [25], // Marketing PIC
      },
      payload: {
        contractId: 50,
        tenderId: 102,
        tenderTitle: 'Tender Renovasi Data Center',
        marketingPicId: 25,
        hoursRemaining: 24,
      },
    };

    it('creates H-1 reminder Bell for Marketing PIC', async () => {
      const results = await consumer.handleSystemSlaRevisionReminderH1(canonicalH1ReminderEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(inMemoryNotifications[0].title).toBe('Pengingat: Batas Waktu Revisi SPK H-1');
      expect(inMemoryNotifications[0].message).toContain('kurang dari 24 jam');
      expect(inMemoryNotifications[0].dedupeKey).toBe('evt-sla-rev-h1-003:25:SYSTEM_SLA_REVISION_REMINDER_H1');
    });

    it('retry suppresses duplicate reminder Bell', async () => {
      await consumer.handleSystemSlaRevisionReminderH1(canonicalH1ReminderEvent);
      expect(inMemoryNotifications).toHaveLength(1);

      const retry = await consumer.handleSystemSlaRevisionReminderH1(canonicalH1ReminderEvent);
      expect(retry[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });
  });

  describe('4. system.sla.discount_timeout Canonical Event', () => {
    const canonicalDiscountTimeoutEvent: BusinessEvent<{
      tenderId: number;
      tenderTitle: string;
      discountPercentage: number;
      timeoutHours: number;
    }> = {
      eventId: 'evt-sla-disc-timeout-004',
      eventName: 'system.sla.discount_timeout',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Tender',
      aggregateId: 103,
      routing: {
        userIds: [1, 2, 10], // C-Suite: SuperAdmin (1), GM (2), Director (10)
      },
      payload: {
        tenderId: 103,
        tenderTitle: 'Tender Pengadaan Laptop',
        discountPercentage: 25,
        timeoutHours: 2,
      },
    };

    it('creates emergency alert Bell and enqueues BullMQ email job with deterministic jobId', async () => {
      const results = await consumer.handleSystemSlaDiscountTimeout(canonicalDiscountTimeoutEvent);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);

      expect(inMemoryNotifications).toHaveLength(3);
      expect(inMemoryNotifications[0].title).toBe('URGENT: Tender Approval Escalated');
      expect(inMemoryNotifications[0].message).toContain('memerlukan persetujuan diskon lebih dari 20%');

      // Email queue was called for each recipient with deterministic jobId
      expect(mockEmailQueue.add).toHaveBeenCalledTimes(3);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'user_1@company.com',
          subject: 'URGENT: Tender Approval Escalated',
        }),
        {
          jobId: 'email:evt-sla-disc-timeout-004:1:SYSTEM_SLA_DISCOUNT_TIMEOUT',
        },
      );
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'user_2@company.com',
        }),
        {
          jobId: 'email:evt-sla-disc-timeout-004:2:SYSTEM_SLA_DISCOUNT_TIMEOUT',
        },
      );
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'user_10@company.com',
        }),
        {
          jobId: 'email:evt-sla-disc-timeout-004:10:SYSTEM_SLA_DISCOUNT_TIMEOUT',
        },
      );
    });

    it('suppresses duplicate DB insert, WebSocket push, and email job on retried event', async () => {
      await consumer.handleSystemSlaDiscountTimeout(canonicalDiscountTimeoutEvent);
      expect(inMemoryNotifications).toHaveLength(3);
      expect(mockEmailQueue.add).toHaveBeenCalledTimes(3);

      const retryResults = await consumer.handleSystemSlaDiscountTimeout(canonicalDiscountTimeoutEvent);
      expect(retryResults.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);

      // Email queue not called again
      expect(mockEmailQueue.add).toHaveBeenCalledTimes(3);
      expect(inMemoryNotifications).toHaveLength(3);
    });
  });

  describe('5. system.sla.grace_extended Canonical Event', () => {
    const canonicalGraceExtendedEvent: BusinessEvent<{
      contractId: number;
      contractNumber: string;
      daysAdded: number;
      extensionCount: number;
      newDeadline: string;
      formattedDeadline: string;
      extendedBy: number;
    }> = {
      eventId: 'evt-sla-ext-005',
      eventName: 'system.sla.grace_extended',
      eventVersion: 1,
      occurredAt: '2026-09-26T00:00:00.000Z',
      aggregateType: 'Contract',
      aggregateId: 50,
      actor: { userId: 7 },
      routing: {
        userIds: [7], // The user who extended
      },
      payload: {
        contractId: 50,
        contractNumber: 'CONT-2026-0050',
        daysAdded: 3,
        extensionCount: 1,
        newDeadline: '2026-09-29T00:00:00.000Z',
        formattedDeadline: '29/09/2026',
        extendedBy: 7,
      },
    };

    it('creates confirmation Bell strictly for the user who extended the deadline', async () => {
      const results = await consumer.handleSystemSlaGraceExtended(canonicalGraceExtendedEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(inMemoryNotifications[0].userId).toBe(7);
      expect(inMemoryNotifications[0].title).toBe('Grace SLA Deadline Diperpanjang');
      expect(inMemoryNotifications[0].message).toContain('Perpanjangan ke-1/3');
      expect(inMemoryNotifications[0].actionLink).toBe('/legal/review?tab=REVISION');
      expect(inMemoryNotifications[0].dedupeKey).toBe('evt-sla-ext-005:7:SYSTEM_SLA_GRACE_EXTENDED');
    });

    it('suppresses duplicate confirmation Bell on retry', async () => {
      await consumer.handleSystemSlaGraceExtended(canonicalGraceExtendedEvent);
      expect(inMemoryNotifications).toHaveLength(1);

      const retry = await consumer.handleSystemSlaGraceExtended(canonicalGraceExtendedEvent);
      expect(retry[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });
  });

  describe('6. Scheduler Repeat Idempotency Simulation', () => {
    it('SPK grace demotion: first run mutates status and creates OutboxEvent, repeated runs find zero eligible tenders', async () => {
      // Simulate database state
      let tenderInDb: any = {
        id: 201,
        title: 'Tender Testing 1',
        status: TenderStatus.WON,
        stage: TenderStage.WON,
        grace_deadline: new Date(Date.now() - 3600000), // 1 hour ago (expired)
        spk_file_key: null,
        marketing_pic_id: 25,
      };

      const outboxSaves: OutboxEvent[] = [];

      const queryRunnerMock = {
        manager: {
          save: jest.fn().mockImplementation(async (cls: any, entity?: any) => {
            const actualEntity = entity !== undefined ? entity : cls;
            if (actualEntity instanceof OutboxEvent || actualEntity?.event_name) {
              outboxSaves.push(actualEntity);
            } else if (actualEntity?.id === 201) {
              tenderInDb = { ...actualEntity };
            }
            return actualEntity;
          }),
          create: jest.fn().mockImplementation((cls: any, data: any) => Object.assign(new cls(), data)),
          query: jest.fn().mockResolvedValue([]),
          getRepository: jest.fn().mockReturnValue({
            find: jest.fn().mockResolvedValue([]),
            softDelete: jest.fn().mockResolvedValue(undefined),
          }),
        },
      };

      const tenderRepoMock: any = {
        find: jest.fn().mockImplementation(async (options: any) => {
          // If status is WON and grace_deadline < now
          if (tenderInDb.status === TenderStatus.WON && tenderInDb.grace_deadline) {
            return [tenderInDb];
          }
          return [];
        }),
        manager: {
          query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes('MARKETING')) {
              return [{ id: 25 }];
            }
            if (sql.includes('DIRECTOR')) {
              return [{ id: 10 }];
            }
            return [];
          }),
          transaction: jest.fn().mockImplementation(async (cb: any) => cb(queryRunnerMock.manager)),
        },
      };

      const eventEmitterMock: any = {
        emit: jest.fn(),
      };

      const scheduler = new TenderScheduler(tenderRepoMock, eventEmitterMock);

      // FIRST CRON RUN:
      await scheduler.handleGracePeriodAndTimeouts();

      expect(outboxSaves).toHaveLength(1);
      expect(outboxSaves[0].event_name).toBe('system.sla.spk_grace_expired');
      expect(tenderInDb.status).toBe(TenderStatus.NEGOTIATION);
      expect(tenderInDb.grace_deadline).toBeNull();
      // Zero direct notification.send emissions
      expect(eventEmitterMock.emit).not.toHaveBeenCalledWith('notification.send', expect.anything());

      // SECOND CRON RUN (1 minute later, no business change):
      await scheduler.handleGracePeriodAndTimeouts();

      // Zero new outbox events saved
      expect(outboxSaves).toHaveLength(1);

      // THIRD CRON RUN:
      await scheduler.handleGracePeriodAndTimeouts();

      // Still exactly 1 outbox event across all runs
      expect(outboxSaves).toHaveLength(1);
    });

    it('Discount timeout auto-escalate: first run updates updated_at and creates OutboxEvent, repeated runs within 2h find zero eligible tenders', async () => {
      const now = Date.now();
      let tenderInDb: any = {
        id: 202,
        title: 'Tender Pending Approval',
        status: TenderStatus.PENDING_APPROVAL,
        updated_at: new Date(now - 3 * 3600000), // 3 hours ago (> 2h timeout)
        max_discount_rate: 25,
      };

      const outboxSaves: OutboxEvent[] = [];

      const queryRunnerMock = {
        manager: {
          save: jest.fn().mockImplementation(async (cls: any, entity?: any) => {
            const actualEntity = entity !== undefined ? entity : cls;
            if (actualEntity instanceof OutboxEvent || actualEntity?.event_name) {
              outboxSaves.push(actualEntity);
            } else if (actualEntity?.id === 202) {
              tenderInDb = { ...actualEntity };
            }
            return actualEntity;
          }),
          create: jest.fn().mockImplementation((cls: any, data: any) => Object.assign(new cls(), data)),
          getRepository: jest.fn().mockReturnValue({
            find: jest.fn().mockResolvedValue([]),
            softDelete: jest.fn().mockResolvedValue(undefined),
          }),
        },
      };

      const tenderRepoMock: any = {
        find: jest.fn().mockImplementation(async (options: any) => {
          if (options?.where?.status === TenderStatus.WON) {
            return [];
          }
          const twoHoursAgo = new Date(Date.now() - 2 * 3600000);
          if (
            options?.where?.status === TenderStatus.PENDING_APPROVAL &&
            tenderInDb.status === TenderStatus.PENDING_APPROVAL &&
            tenderInDb.updated_at < twoHoursAgo
          ) {
            return [tenderInDb];
          }
          return [];
        }),
        manager: {
          query: jest.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('REVISION_DEADLINE_APPROACHING')) return [];
            if (sql.includes('contracts')) return [];
            if (sql.includes('SUPER_ADMIN')) return [{ id: 1 }, { id: 2 }, { id: 10 }];
            return [];
          }),
          transaction: jest.fn().mockImplementation(async (cb: any) => cb(queryRunnerMock.manager)),
        },
      };

      const eventEmitterMock: any = {
        emit: jest.fn(),
      };

      const scheduler = new TenderScheduler(tenderRepoMock, eventEmitterMock);

      // FIRST CRON RUN:
      await scheduler.handleGracePeriodAndTimeouts();

      expect(outboxSaves).toHaveLength(1);
      expect(outboxSaves[0].event_name).toBe('system.sla.discount_timeout');
      expect(eventEmitterMock.emit).not.toHaveBeenCalledWith('notification.send', expect.anything());

      // SECOND CRON RUN (1 minute later):
      await scheduler.handleGracePeriodAndTimeouts();

      // Zero new outbox events saved because updated_at was refreshed to now
      expect(outboxSaves).toHaveLength(1);

      // THIRD CRON RUN (2 minutes later):
      await scheduler.handleGracePeriodAndTimeouts();

      expect(outboxSaves).toHaveLength(1);
    });
  });
});
