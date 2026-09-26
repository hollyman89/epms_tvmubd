import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource, Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { BusinessSyncConsumer } from './business-sync.consumer';
import { BusinessEvent, NotificationPolicy } from '../../shared/contracts/business-event.contract';

describe('Phase N7: Finance Canonical Notification Migration & Decoupling Suite', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let notificationService: NotificationService;
  let businessSyncConsumer: BusinessSyncConsumer;
  let mockNotificationRepo: jest.Mocked<Partial<Repository<Notification>>>;
  let mockGateway: jest.Mocked<Partial<NotificationGateway>>;
  let mockEmailQueue: { add: jest.Mock };
  let mockDataSource: any;
  let inMemoryNotifications: Notification[];
  let socketPushes: Array<{ userId: number; notification: any }>;
  let syncRoomPushes: Array<{ room: string; event: string; payload: any }>;

  const PM_ID = 501;
  const OTHER_PM_ID = 502;
  const FINANCE_PAYER_ID = 601;
  const PO_ID = 101;
  const PAYMENT_ID = 201;
  const INVOICE_ID = 301;
  const AMOUNT = 75000000;
  const PAYMENT_NUMBER = 'PAY-20260926-001';

  beforeEach(async () => {
    inMemoryNotifications = [];
    socketPushes = [];
    syncRoomPushes = [];
    mockEmailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    mockNotificationRepo = {
      save: jest.fn().mockImplementation(async (entity: any) => {
        const entities = Array.isArray(entity) ? entity : [entity];
        const savedList: Notification[] = [];
        for (const item of entities) {
          const duplicate = inMemoryNotifications.find(
            (n) => n.userId === item.userId && n.dedupeKey && n.dedupeKey === item.dedupeKey,
          );
          if (duplicate) {
            const err: any = new Error(
              `Duplicate entry '${item.dedupeKey}' for key 'idx_notif_user_dedupe'`,
            );
            err.code = 'ER_DUP_ENTRY';
            err.errno = 1062;
            throw err;
          }

          const saved = Object.assign(new Notification(), item, {
            id: inMemoryNotifications.length + 1,
          });
          inMemoryNotifications.push(saved);
          savedList.push(saved);
        }
        return Array.isArray(entity) ? savedList : savedList[0];
      }),
      find: jest.fn().mockImplementation(async () => inMemoryNotifications),
      count: jest.fn().mockImplementation(async () => inMemoryNotifications.length),
    };

    mockGateway = {
      sendNotificationToUser: jest.fn().mockImplementation((userId: number, notif: any) => {
        socketPushes.push({ userId, notification: notif });
      }),
      sendSyncEventToRooms: jest.fn().mockImplementation((rooms: string[], event: string, payload: any) => {
        for (const room of rooms) {
          syncRoomPushes.push({ room, event, payload });
        }
      }),
    };

    mockDataSource = {
      query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM purchase_orders po')) {
          const targetPoId = params[0];
          if (targetPoId === PO_ID) {
            return [{ manager_id: PM_ID }];
          }
          return [];
        }
        return [];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalNotificationWriter,
        CanonicalNotificationConsumer,
        NotificationService,
        BusinessSyncConsumer,
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
    notificationService = module.get<NotificationService>(NotificationService);
    businessSyncConsumer = module.get<BusinessSyncConsumer>(BusinessSyncConsumer);
  });

  describe('1. Canonical Payment Event (finance.payment.recorded) Bell Projection', () => {
    it('projects informational Bell to both PM (ALERT) and Finance payer (SYSTEM)', async () => {
      const canonicalEvent: BusinessEvent<any> = {
        eventId: 'evt-fin-pay-001',
        eventName: 'finance.payment.recorded',
        eventVersion: 1,
        occurredAt: '2026-09-26T05:00:00.000Z',
        aggregateType: 'Payment',
        aggregateId: PAYMENT_ID,
        actor: { userId: FINANCE_PAYER_ID },
        payload: {
          paymentId: PAYMENT_ID,
          paymentNumber: PAYMENT_NUMBER,
          invoiceId: INVOICE_ID,
          poId: PO_ID,
          amount: AMOUNT,
          paymentDate: '2026-09-26T05:00:00.000Z',
          paymentStatus: 'PAID',
          isFullyPaid: true,
          recordedBy: FINANCE_PAYER_ID,
        },
      };

      const results = await consumer.handleFinancePaymentRecorded(canonicalEvent);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[1].status).toBe('PERSISTED');

      // Check DB records
      expect(inMemoryNotifications).toHaveLength(2);

      // PM Bell verification
      const pmNotif = inMemoryNotifications.find((n) => n.userId === PM_ID);
      expect(pmNotif).toBeDefined();
      expect(pmNotif!.title).toBe('Pembayaran Diterima');
      expect(pmNotif!.message).toContain(PAYMENT_NUMBER);
      expect(pmNotif!.message).toContain('PO #' + PO_ID);
      expect(pmNotif!.notificationType).toBe('ALERT');
      expect(pmNotif!.actionLink).toBe(`/projects/pos/${PO_ID}`);
      expect(pmNotif!.dedupeKey).toBe(`evt-fin-pay-001:${PM_ID}:FINANCE_PAYMENT_RECORDED_PM`);

      // Finance Payer Bell verification
      const payerNotif = inMemoryNotifications.find((n) => n.userId === FINANCE_PAYER_ID);
      expect(payerNotif).toBeDefined();
      expect(payerNotif!.title).toBe('Transaksi Berhasil');
      expect(payerNotif!.message).toContain('berhasil dicatat');
      expect(payerNotif!.notificationType).toBe('SYSTEM');
      expect(payerNotif!.actionLink).toBe(`/finance/payments/${PAYMENT_ID}`);
      expect(payerNotif!.dedupeKey).toBe(`evt-fin-pay-001:${FINANCE_PAYER_ID}:FINANCE_PAYMENT_RECORDED_PAYER`);

      // WebSocket verification: exactly 2 pushes to respective recipients
      expect(socketPushes).toHaveLength(2);
      expect(socketPushes.find((p) => p.userId === PM_ID)).toBeDefined();
      expect(socketPushes.find((p) => p.userId === FINANCE_PAYER_ID)).toBeDefined();
    });

    it('isolates PM recipient: unrelated PM receives zero notifications', async () => {
      const canonicalEvent: BusinessEvent<any> = {
        eventId: 'evt-fin-pay-002',
        eventName: 'finance.payment.recorded',
        eventVersion: 1,
        occurredAt: '2026-09-26T05:00:00.000Z',
        aggregateType: 'Payment',
        aggregateId: PAYMENT_ID,
        actor: { userId: FINANCE_PAYER_ID },
        payload: {
          paymentId: PAYMENT_ID,
          paymentNumber: PAYMENT_NUMBER,
          invoiceId: INVOICE_ID,
          poId: PO_ID,
          amount: AMOUNT,
          paymentDate: '2026-09-26T05:00:00.000Z',
          paymentStatus: 'PAID',
          isFullyPaid: true,
          recordedBy: FINANCE_PAYER_ID,
        },
      };

      await consumer.handleFinancePaymentRecorded(canonicalEvent);

      const unrelatedPmNotifs = inMemoryNotifications.filter((n) => n.userId === OTHER_PM_ID);
      expect(unrelatedPmNotifs).toHaveLength(0);

      const unrelatedWsPushes = socketPushes.filter((p) => p.userId === OTHER_PM_ID);
      expect(unrelatedWsPushes).toHaveLength(0);
    });

    it('enforces idempotency: retry with same eventId suppresses duplicate DB writes & WebSocket pushes', async () => {
      const canonicalEvent: BusinessEvent<any> = {
        eventId: 'evt-fin-pay-003',
        eventName: 'finance.payment.recorded',
        eventVersion: 1,
        occurredAt: '2026-09-26T05:00:00.000Z',
        aggregateType: 'Payment',
        aggregateId: PAYMENT_ID,
        actor: { userId: FINANCE_PAYER_ID },
        payload: {
          paymentId: PAYMENT_ID,
          paymentNumber: PAYMENT_NUMBER,
          invoiceId: INVOICE_ID,
          poId: PO_ID,
          amount: AMOUNT,
          paymentDate: '2026-09-26T05:00:00.000Z',
          paymentStatus: 'PAID',
          isFullyPaid: true,
          recordedBy: FINANCE_PAYER_ID,
        },
      };

      // First delivery
      const firstRun = await consumer.handleFinancePaymentRecorded(canonicalEvent);
      expect(firstRun.every((r) => r.status === 'PERSISTED')).toBe(true);
      expect(inMemoryNotifications).toHaveLength(2);
      expect(socketPushes).toHaveLength(2);

      // Retry delivery with identical eventId
      const retryRun = await consumer.handleFinancePaymentRecorded(canonicalEvent);
      expect(retryRun.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);

      // Must remain exactly 2 in DB and 2 WebSocket pushes (0 new)
      expect(inMemoryNotifications).toHaveLength(2);
      expect(socketPushes).toHaveLength(2);
    });

    it('avoids self-duplicate when payer is also the PM (single notification generated)', async () => {
      const canonicalEvent: BusinessEvent<any> = {
        eventId: 'evt-fin-pay-004',
        eventName: 'finance.payment.recorded',
        eventVersion: 1,
        occurredAt: '2026-09-26T05:00:00.000Z',
        aggregateType: 'Payment',
        aggregateId: PAYMENT_ID,
        actor: { userId: PM_ID }, // PM recorded their own payment
        payload: {
          paymentId: PAYMENT_ID,
          paymentNumber: PAYMENT_NUMBER,
          invoiceId: INVOICE_ID,
          poId: PO_ID,
          amount: AMOUNT,
          paymentDate: '2026-09-26T05:00:00.000Z',
          paymentStatus: 'PAID',
          isFullyPaid: true,
          recordedBy: PM_ID, // recordedBy === pmId
        },
      };

      const results = await consumer.handleFinancePaymentRecorded(canonicalEvent);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(PM_ID);
      expect(inMemoryNotifications[0].dedupeKey).toBe(`evt-fin-pay-004:${PM_ID}:FINANCE_PAYMENT_RECORDED_PM`);
    });

    it('bypasses projection if eventId is missing or empty', async () => {
      const malformedEvent: any = {
        eventName: 'finance.payment.recorded',
        aggregateId: PAYMENT_ID,
        payload: { paymentId: PAYMENT_ID, poId: PO_ID, recordedBy: FINANCE_PAYER_ID },
      };

      const results = await consumer.handleFinancePaymentRecorded(malformedEvent);
      expect(results).toHaveLength(0);
      expect(inMemoryNotifications).toHaveLength(0);
      expect(socketPushes).toHaveLength(0);
    });

    it('bypasses Bell projection when notificationPolicy is SYNC_ONLY', async () => {
      const syncOnlyEvent: BusinessEvent<any> = {
        eventId: 'evt-fin-pay-sync-only',
        eventName: 'finance.payment.recorded',
        eventVersion: 1,
        occurredAt: '2026-09-26T05:00:00.000Z',
        aggregateType: 'Payment',
        aggregateId: PAYMENT_ID,
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        payload: {
          paymentId: PAYMENT_ID,
          paymentNumber: PAYMENT_NUMBER,
          invoiceId: INVOICE_ID,
          poId: PO_ID,
          amount: AMOUNT,
          recordedBy: FINANCE_PAYER_ID,
        },
      };

      const results = await consumer.handleFinancePaymentRecorded(syncOnlyEvent);
      expect(results).toHaveLength(0);
      expect(inMemoryNotifications).toHaveLength(0);
      expect(socketPushes).toHaveLength(0);
    });

    it('handles unresolved PM gracefully: projects only to Finance payer', async () => {
      const orphanPoEvent: BusinessEvent<any> = {
        eventId: 'evt-fin-pay-orphan',
        eventName: 'finance.payment.recorded',
        eventVersion: 1,
        occurredAt: '2026-09-26T05:00:00.000Z',
        aggregateType: 'Payment',
        aggregateId: PAYMENT_ID,
        payload: {
          paymentId: PAYMENT_ID,
          paymentNumber: PAYMENT_NUMBER,
          invoiceId: INVOICE_ID,
          poId: 99999, // Unresolvable PO
          amount: AMOUNT,
          recordedBy: FINANCE_PAYER_ID,
        },
      };

      const results = await consumer.handleFinancePaymentRecorded(orphanPoEvent);
      expect(results).toHaveLength(1);
      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(FINANCE_PAYER_ID);
    });
  });

  describe('2. Legacy NotificationService Bell Writer Retirement', () => {
    it('NotificationService has 0 Bell writer methods (handlePaymentProcessed deleted)', async () => {
      expect((notificationService as any).handlePaymentProcessed).toBeUndefined();
      expect(inMemoryNotifications).toHaveLength(0);
    });
  });

  describe('3. BusinessSync Consumer Integration for Finance Events', () => {
    it('finance.payment.recorded emits business:sync to FINANCE, DIRECTOR, GENERAL_MANAGER, SUPER_ADMIN with 0 Bell rows', async () => {
      const canonicalEvent: BusinessEvent<any> = {
        eventId: 'evt-sync-pay-001',
        eventName: 'finance.payment.recorded',
        eventVersion: 1,
        occurredAt: '2026-09-26T05:00:00.000Z',
        aggregateType: 'Payment',
        aggregateId: PAYMENT_ID,
        payload: { paymentId: PAYMENT_ID },
      };

      await businessSyncConsumer.handleFinancePaymentRecorded(canonicalEvent);

      // BusinessSync must NOT write any notifications to DB
      expect(inMemoryNotifications).toHaveLength(0);

      // Realtime synchronization broadcast verified
      expect(mockGateway.sendSyncEventToRooms).toHaveBeenCalledWith(
        expect.arrayContaining(['role:FINANCE', 'role:DIRECTOR', 'role:GENERAL_MANAGER', 'role:SUPER_ADMIN']),
        expect.objectContaining({
          eventId: 'evt-sync-pay-001',
          eventName: 'finance.payment.recorded',
          aggregateType: 'Payment',
          aggregateId: PAYMENT_ID,
        }),
      );
    });

    it('finance.invoice.created, verified, rejected emit business:sync with 0 Bell rows', async () => {
      const invCreatedEvent: BusinessEvent<any> = {
        eventId: 'evt-sync-inv-001',
        eventName: 'finance.invoice.created',
        eventVersion: 1,
        occurredAt: '2026-09-26T05:00:00.000Z',
        aggregateType: 'Invoice',
        aggregateId: INVOICE_ID,
        payload: { invoiceId: INVOICE_ID },
      };
      const invVerifiedEvent: BusinessEvent<any> = {
        eventId: 'evt-sync-inv-002',
        eventName: 'finance.invoice.verified',
        eventVersion: 1,
        occurredAt: '2026-09-26T05:00:00.000Z',
        aggregateType: 'Invoice',
        aggregateId: INVOICE_ID,
        payload: { invoiceId: INVOICE_ID },
      };
      const invRejectedEvent: BusinessEvent<any> = {
        eventId: 'evt-sync-inv-003',
        eventName: 'finance.invoice.rejected',
        eventVersion: 1,
        occurredAt: '2026-09-26T05:00:00.000Z',
        aggregateType: 'Invoice',
        aggregateId: INVOICE_ID,
        routing: { userIds: [FINANCE_PAYER_ID] },
        payload: { invoiceId: INVOICE_ID },
      };

      await businessSyncConsumer.handleFinanceInvoiceCreated(invCreatedEvent);
      await businessSyncConsumer.handleFinanceInvoiceVerified(invVerifiedEvent);
      await businessSyncConsumer.handleFinanceInvoiceRejected(invRejectedEvent);

      // Zero notification rows created
      expect(inMemoryNotifications).toHaveLength(0);
      expect(mockGateway.sendSyncEventToRooms).toHaveBeenCalledTimes(3);
    });
  });
});
