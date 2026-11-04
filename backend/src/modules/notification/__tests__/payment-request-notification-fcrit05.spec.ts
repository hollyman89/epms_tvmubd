import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { CanonicalNotificationConsumer } from '../canonical-notification.consumer';
import { CanonicalNotificationWriter } from '../canonical-notification.writer';
import { BusinessSyncConsumer } from '../business-sync.consumer';
import { NotificationGateway } from '../notification.gateway';
import { OutboxRelayService } from '../../system/outbox-relay.service';
import { Notification } from '../../../entities/notification.entity';
import { PushOutbox, PushOutboxStatus } from '../../../entities/push-outbox.entity';
import { OutboxEvent, OutboxStatus } from '../../../entities/outbox-event.entity';
import {
  BusinessEvent,
  NotificationPolicy,
  OutboxDeliveryOutcome,
  extractOutboxReceipt,
} from '../../../shared/contracts/business-event.contract';
import { PaymentRequestStatus } from '../../../entities/payment-request.entity';

describe('FASE 1.5 — F-CRIT-05: Payment Request Notification Remediation Spec', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let syncConsumer: BusinessSyncConsumer;
  let relayService: OutboxRelayService;

  // In-memory test state
  let inMemoryNotifications: Notification[] = [];
  let inMemoryPushOutbox: PushOutbox[] = [];
  let inMemoryOutboxEvents: OutboxEvent[] = [];
  let capturedSyncRooms: string[][] = [];
  let capturedSyncEnvelopes: any[] = [];

  const PRQ_ID = 301;
  const PRQ_NUMBER = 'PRQ-20261030-001';
  const INVOICE_ID = 201;
  const INVOICE_NUMBER = 'INV-202610-001';
  const REQUESTED_AMOUNT = 50000000;

  const FINANCE_REQUESTER_ID = 10;
  const FINANCE_USER_2_ID = 11;
  const DIRECTOR_USER_1_ID = 4; // Director 1
  const DIRECTOR_USER_2_ID = 5; // Director 2 (Proves dynamic multi-director resolution, no ID 4 hardcoding)

  const mockGateway = {
    sendNotificationToUser: jest.fn(),
    sendSyncEventToRooms: jest.fn().mockImplementation((rooms: string[], envelope: any) => {
      capturedSyncRooms.push(rooms);
      capturedSyncEnvelopes.push(envelope);
    }),
  };

  const mockDataSource = {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      // 1. Resolve Role User IDs (Dynamic Director and Finance resolution)
      if (sql.includes('FROM users u') && sql.includes('JOIN user_roles ur')) {
        const roles: string[] = Array.isArray(params) ? params.flat() : [params];
        const userIds: number[] = [];
        if (roles.includes('FINANCE')) userIds.push(FINANCE_REQUESTER_ID, FINANCE_USER_2_ID);
        if (roles.includes('DIRECTOR')) userIds.push(DIRECTOR_USER_1_ID, DIRECTOR_USER_2_ID);
        return userIds.map((id) => ({ id }));
      }

      // 2. Resolve Payment Request Requester fallback
      if (sql.includes('FROM payment_requests') && sql.includes('requested_by')) {
        const id = Number(params?.[0]);
        if (id === PRQ_ID) {
          return [{ requested_by: FINANCE_REQUESTER_ID }];
        }
        return [];
      }

      // 3. Resolve Active User Check
      if (sql.includes('FROM users') && sql.includes('WHERE id = ?')) {
        return [{ id: params?.[0], is_active: 1 }];
      }

      return [];
    }),
  };

  const mockNotifRepo = {
    findOne: jest.fn().mockImplementation(async ({ where }: any) => {
      if (where?.dedupeKey) {
        return inMemoryNotifications.find((n) => n.dedupeKey === where.dedupeKey) || null;
      }
      return null;
    }),
    create: jest.fn().mockImplementation((data: any) => ({
      id: inMemoryNotifications.length + 1,
      createdAt: new Date(),
      isRead: false,
      ...data,
    })),
    save: jest.fn().mockImplementation(async (entity: any) => {
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
  };

  const mockPushRepo = {
    findOne: jest.fn().mockImplementation(async ({ where }: any) => {
      if (where?.dedupeKey) {
        return inMemoryPushOutbox.find((p) => p.dedupeKey === where.dedupeKey) || null;
      }
      return null;
    }),
    create: jest.fn().mockImplementation((data: any) => ({
      id: inMemoryPushOutbox.length + 1,
      status: PushOutboxStatus.PENDING,
      retryCount: 0,
      createdAt: new Date(),
      ...data,
    })),
    save: jest.fn().mockImplementation(async (entity: any) => {
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
  };

  const mockOutboxRepo = {
    findOne: jest.fn().mockImplementation(async ({ where }: any) => {
      return inMemoryOutboxEvents.find((o) => o.id === where?.id) || null;
    }),
    save: jest.fn().mockImplementation(async (entity: any) => {
      const idx = inMemoryOutboxEvents.findIndex((o) => o.id === entity.id);
      if (idx >= 0) inMemoryOutboxEvents[idx] = entity;
      else inMemoryOutboxEvents.push(entity);
      return entity;
    }),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn().mockImplementation(async (cls: any, opts: any) => {
        if (cls === OutboxEvent) {
          return inMemoryOutboxEvents.find((o) => o.id === opts?.where?.id) || null;
        }
        return null;
      }),
      save: jest.fn().mockImplementation(async (clsOrEntity: any, maybeEntity?: any) => {
        const entity = maybeEntity !== undefined ? maybeEntity : clsOrEntity;
        if (clsOrEntity === OutboxEvent || entity instanceof OutboxEvent || entity.event_name) {
          const idx = inMemoryOutboxEvents.findIndex((o) => o.id === entity.id);
          if (idx >= 0) inMemoryOutboxEvents[idx] = entity;
          else inMemoryOutboxEvents.push(entity);
        }
        return entity;
      }),
    },
  };

  const mockRelayDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    inMemoryNotifications = [];
    inMemoryPushOutbox = [];
    inMemoryOutboxEvents = [];
    capturedSyncRooms = [];
    capturedSyncEnvelopes = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalNotificationConsumer,
        CanonicalNotificationWriter,
        BusinessSyncConsumer,
        OutboxRelayService,
        { provide: getRepositoryToken(Notification), useValue: mockNotifRepo },
        { provide: getRepositoryToken(PushOutbox), useValue: mockPushRepo },
        { provide: getRepositoryToken(OutboxEvent), useValue: mockOutboxRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NotificationGateway, useValue: mockGateway },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            emitAsync: jest.fn(),
            listeners: jest.fn().mockReturnValue([() => {}]),
          },
        },
      ],
    }).compile();

    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
    syncConsumer = module.get<BusinessSyncConsumer>(BusinessSyncConsumer);
    relayService = new OutboxRelayService(
      mockOutboxRepo as any,
      mockRelayDataSource as any,
      module.get<EventEmitter2>(EventEmitter2),
    );
  });

  describe('1. Finance Submit: finance.payment_request.submitted', () => {
    it('projects Bell and PushOutbox to all active DIRECTORS dynamically without hardcoding ID 4', async () => {
      const event: BusinessEvent<any> = {
        eventId: `prq-sub-${PRQ_ID}`,
        eventName: 'finance.payment_request.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        actor: { userId: FINANCE_REQUESTER_ID },
        routing: { roles: ['DIRECTOR'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          requestId: PRQ_ID,
          paymentRequestId: PRQ_ID,
          requestNumber: PRQ_NUMBER,
          invoiceId: INVOICE_ID,
          invoiceNumber: INVOICE_NUMBER,
          requestedAmount: REQUESTED_AMOUNT,
          submittedBy: FINANCE_REQUESTER_ID,
        },
      };

      const results = await consumer.handleFinancePaymentRequestSubmitted(event);
      const receipt = extractOutboxReceipt(results);

      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(results).toHaveLength(2); // Both DIRECTOR_USER_1_ID and DIRECTOR_USER_2_ID

      // Verify Bell notifications
      expect(inMemoryNotifications).toHaveLength(2);
      const notif1 = inMemoryNotifications.find((n) => n.userId === DIRECTOR_USER_1_ID);
      const notif2 = inMemoryNotifications.find((n) => n.userId === DIRECTOR_USER_2_ID);
      expect(notif1).toBeDefined();
      expect(notif2).toBeDefined();

      expect(notif1!.title).toBe('Persetujuan Pembayaran');
      expect(notif1!.message).toContain(PRQ_NUMBER);
      expect(notif1!.message).toContain(INVOICE_NUMBER);
      expect(notif1!.actionLink).toBe(`/finance/payments?tab=approvals&requestId=${PRQ_ID}`);
      expect(notif1!.dedupeKey).toBe(`prq-sub-${PRQ_ID}:${DIRECTOR_USER_1_ID}:FINANCE_PAYMENT_REQUEST_SUBMITTED`);

      // Verify PushOutbox parity
      expect(inMemoryPushOutbox).toHaveLength(2);
      const push1 = inMemoryPushOutbox.find((p) => p.recipientId === DIRECTOR_USER_1_ID);
      expect(push1).toBeDefined();
      expect(push1!.status).toBe(PushOutboxStatus.PENDING);
      expect(push1!.payloadPreview.actionTarget).toBe(`/finance/payments?tab=approvals&requestId=${PRQ_ID}`);
      expect(push1!.dedupeKey).toBe(`prq-sub-${PRQ_ID}:${DIRECTOR_USER_1_ID}:FINANCE_PAYMENT_REQUEST_SUBMITTED:PUSH`);
    });

    it('excludes submitter actor if submitter is a Director (actor self-exclusion)', async () => {
      const event: BusinessEvent<any> = {
        eventId: `prq-sub-${PRQ_ID}`,
        eventName: 'finance.payment_request.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        actor: { userId: DIRECTOR_USER_1_ID }, // Submitter is Director 1
        routing: { roles: ['DIRECTOR'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          requestId: PRQ_ID,
          paymentRequestId: PRQ_ID,
          requestNumber: PRQ_NUMBER,
          invoiceId: INVOICE_ID,
          invoiceNumber: INVOICE_NUMBER,
          requestedAmount: REQUESTED_AMOUNT,
          submittedBy: DIRECTOR_USER_1_ID,
        },
      };

      const results = await consumer.handleFinancePaymentRequestSubmitted(event);
      expect(results).toHaveLength(1); // Only DIRECTOR_USER_2_ID, DIRECTOR_USER_1_ID excluded
      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(DIRECTOR_USER_2_ID);
    });

    it('dispatches WebSocket envelope to DIRECTOR, FINANCE, and SUPER_ADMIN rooms', () => {
      const event: BusinessEvent<any> = {
        eventId: `prq-sub-${PRQ_ID}`,
        eventName: 'finance.payment_request.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        actor: { userId: FINANCE_REQUESTER_ID },
        routing: { roles: ['DIRECTOR'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          requestId: PRQ_ID,
          requestNumber: PRQ_NUMBER,
        },
      };

      const syncReceipt = syncConsumer.handleFinancePaymentRequestSync(event);
      expect(syncReceipt.deliveredCount).toBeGreaterThan(0);
      expect(capturedSyncRooms[0]).toEqual(
        expect.arrayContaining(['role:DIRECTOR', 'role:FINANCE', 'role:SUPER_ADMIN']),
      );
    });
  });

  describe('2. Director Return: finance.payment_request.returned', () => {
    it('notifies the Finance requester with revision notes and requests tab deep link', async () => {
      const event: BusinessEvent<any> = {
        eventId: `prq-ret-${PRQ_ID}-1`,
        eventName: 'finance.payment_request.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        actor: { userId: DIRECTOR_USER_1_ID }, // Director returns
        routing: { userIds: [FINANCE_REQUESTER_ID] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          requestId: PRQ_ID,
          paymentRequestId: PRQ_ID,
          requestNumber: PRQ_NUMBER,
          invoiceId: INVOICE_ID,
          revisionNotes: 'Perbaiki nomor rekening vendor',
          returnedBy: DIRECTOR_USER_1_ID,
          requestedBy: FINANCE_REQUESTER_ID,
          status: PaymentRequestStatus.NEEDS_REVISION,
        },
      };

      const results = await consumer.handleFinancePaymentRequestReturned(event);
      const receipt = extractOutboxReceipt(results);

      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(results).toHaveLength(1);

      expect(inMemoryNotifications).toHaveLength(1);
      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(FINANCE_REQUESTER_ID);
      expect(notif.title).toBe('Revisi Pengajuan Pembayaran');
      expect(notif.message).toContain('Perbaiki nomor rekening vendor');
      expect(notif.actionLink).toBe(`/finance/payments?tab=requests&requestId=${PRQ_ID}`);
      expect(notif.dedupeKey).toBe(`prq-ret-${PRQ_ID}-1:${FINANCE_REQUESTER_ID}:FINANCE_PAYMENT_REQUEST_RETURNED`);

      expect(inMemoryPushOutbox).toHaveLength(1);
      expect(inMemoryPushOutbox[0].payloadPreview.actionTarget).toBe(`/finance/payments?tab=requests&requestId=${PRQ_ID}`);
    });

    it('returns INTENTIONALLY_IGNORED if requester is the actor who returned', async () => {
      const event: BusinessEvent<any> = {
        eventId: `prq-ret-${PRQ_ID}-1`,
        eventName: 'finance.payment_request.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        actor: { userId: FINANCE_REQUESTER_ID },
        payload: {
          requestId: PRQ_ID,
          returnedBy: FINANCE_REQUESTER_ID,
          requestedBy: FINANCE_REQUESTER_ID,
        },
      };

      const results = await consumer.handleFinancePaymentRequestReturned(event);
      const receipt = extractOutboxReceipt(results);

      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(inMemoryNotifications).toHaveLength(0);
    });
  });

  describe('3. Finance Resubmit: finance.payment_request.resubmitted', () => {
    it('tracks cycle count accurately (resub-1) and targets Directors without collision with initial submit', async () => {
      const event: BusinessEvent<any> = {
        eventId: `prq-sub-${PRQ_ID}-resub-1`,
        eventName: 'finance.payment_request.resubmitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        actor: { userId: FINANCE_REQUESTER_ID },
        routing: { roles: ['DIRECTOR'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          requestId: PRQ_ID,
          paymentRequestId: PRQ_ID,
          requestNumber: PRQ_NUMBER,
          invoiceId: INVOICE_ID,
          requestedAmount: REQUESTED_AMOUNT,
          resubmittedBy: FINANCE_REQUESTER_ID,
          cycle: 1,
          isResubmission: true,
          status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
        },
      };

      const results = await consumer.handleFinancePaymentRequestResubmitted(event);
      const receipt = extractOutboxReceipt(results);

      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(results).toHaveLength(2);

      const notif1 = inMemoryNotifications.find((n) => n.userId === DIRECTOR_USER_1_ID);
      expect(notif1).toBeDefined();
      expect(notif1!.title).toBe('Revisi Pengajuan Pembayaran Menunggu Persetujuan');
      expect(notif1!.actionLink).toBe(`/finance/payments?tab=approvals&requestId=${PRQ_ID}`);
      expect(notif1!.dedupeKey).toBe(`prq-sub-${PRQ_ID}-resub-1:${DIRECTOR_USER_1_ID}:FINANCE_PAYMENT_REQUEST_RESUBMITTED`);
    });

    it('tracks subsequent cycle (resub-2) with distinct event ID and title "Revisi ke-2"', async () => {
      const eventCycle2: BusinessEvent<any> = {
        eventId: `prq-sub-${PRQ_ID}-resub-2`,
        eventName: 'finance.payment_request.resubmitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        actor: { userId: FINANCE_REQUESTER_ID },
        routing: { roles: ['DIRECTOR'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          requestId: PRQ_ID,
          paymentRequestId: PRQ_ID,
          requestNumber: PRQ_NUMBER,
          cycle: 2,
          isResubmission: true,
          status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
        },
      };

      const results = await consumer.handleFinancePaymentRequestResubmitted(eventCycle2);
      expect(results).toHaveLength(2);

      const notif1 = inMemoryNotifications.find((n) => n.userId === DIRECTOR_USER_1_ID);
      expect(notif1!.title).toBe('Revisi ke-2 Pengajuan Pembayaran Menunggu Persetujuan');
      expect(notif1!.dedupeKey).toBe(`prq-sub-${PRQ_ID}-resub-2:${DIRECTOR_USER_1_ID}:FINANCE_PAYMENT_REQUEST_RESUBMITTED`);
    });
  });

  describe('4. Director Approval: finance.payment_request.approved', () => {
    it('notifies Finance team and requester with ready_to_pay deep link and excludes approving Director', async () => {
      const event: BusinessEvent<any> = {
        eventId: `prq-app-${PRQ_ID}`,
        eventName: 'finance.payment_request.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        actor: { userId: DIRECTOR_USER_1_ID }, // Approver
        routing: { roles: ['FINANCE'], userIds: [FINANCE_REQUESTER_ID] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          requestId: PRQ_ID,
          paymentRequestId: PRQ_ID,
          requestNumber: PRQ_NUMBER,
          invoiceId: INVOICE_ID,
          approvedAmount: REQUESTED_AMOUNT,
          approvedBy: DIRECTOR_USER_1_ID,
          requestedBy: FINANCE_REQUESTER_ID,
          status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
        },
      };

      const results = await consumer.handleFinancePaymentRequestApproved(event);
      const receipt = extractOutboxReceipt(results);

      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      // Both FINANCE_REQUESTER_ID (10) and FINANCE_USER_2_ID (11) receive notifications
      expect(results).toHaveLength(2);

      const notifRequester = inMemoryNotifications.find((n) => n.userId === FINANCE_REQUESTER_ID);
      const notifFin2 = inMemoryNotifications.find((n) => n.userId === FINANCE_USER_2_ID);
      expect(notifRequester).toBeDefined();
      expect(notifFin2).toBeDefined();

      expect(notifRequester!.title).toBe('Pengajuan Pembayaran Disetujui');
      expect(notifRequester!.actionLink).toBe(`/finance/payments?tab=ready_to_pay&requestId=${PRQ_ID}`);
      expect(notifRequester!.dedupeKey).toBe(`prq-app-${PRQ_ID}:${FINANCE_REQUESTER_ID}:FINANCE_PAYMENT_REQUEST_APPROVED`);

      // Approving Director actor is excluded
      const notifDirector = inMemoryNotifications.find((n) => n.userId === DIRECTOR_USER_1_ID);
      expect(notifDirector).toBeUndefined();
    });
  });

  describe('5. Director Rejection: finance.payment_request.rejected', () => {
    it('notifies the Finance requester with rejection reason and requests tab deep link', async () => {
      const event: BusinessEvent<any> = {
        eventId: `prq-rej-${PRQ_ID}`,
        eventName: 'finance.payment_request.rejected',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        actor: { userId: DIRECTOR_USER_1_ID },
        routing: { userIds: [FINANCE_REQUESTER_ID] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          requestId: PRQ_ID,
          paymentRequestId: PRQ_ID,
          requestNumber: PRQ_NUMBER,
          invoiceId: INVOICE_ID,
          rejectionReason: 'Anggaran proyek tidak mencukupi untuk pembayaran ini',
          rejectedBy: DIRECTOR_USER_1_ID,
          requestedBy: FINANCE_REQUESTER_ID,
          status: PaymentRequestStatus.REJECTED,
        },
      };

      const results = await consumer.handleFinancePaymentRequestRejected(event);
      const receipt = extractOutboxReceipt(results);

      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(results).toHaveLength(1);

      const notif = inMemoryNotifications[0];
      expect(notif.userId).toBe(FINANCE_REQUESTER_ID);
      expect(notif.title).toBe('Pengajuan Pembayaran Ditolak');
      expect(notif.message).toContain('Anggaran proyek tidak mencukupi');
      expect(notif.actionLink).toBe(`/finance/payments?tab=requests&requestId=${PRQ_ID}`);
      expect(notif.dedupeKey).toBe(`prq-rej-${PRQ_ID}:${FINANCE_REQUESTER_ID}:FINANCE_PAYMENT_REQUEST_REJECTED`);
    });
  });

  describe('6. Idempotency & Replay Resistance', () => {
    it('suppresses duplicate Bell and PushOutbox on replay, returning DUPLICATE_SUPPRESSED with zero extra rows', async () => {
      const event: BusinessEvent<any> = {
        eventId: `prq-sub-${PRQ_ID}`,
        eventName: 'finance.payment_request.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        actor: { userId: FINANCE_REQUESTER_ID },
        routing: { roles: ['DIRECTOR'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          requestId: PRQ_ID,
          paymentRequestId: PRQ_ID,
          requestNumber: PRQ_NUMBER,
          invoiceId: INVOICE_ID,
          invoiceNumber: INVOICE_NUMBER,
          requestedAmount: REQUESTED_AMOUNT,
          submittedBy: FINANCE_REQUESTER_ID,
        },
      };

      // First run: 2 notifications delivered
      const run1 = await consumer.handleFinancePaymentRequestSubmitted(event);
      expect(run1).toHaveLength(2);
      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryPushOutbox).toHaveLength(2);

      // Second run (exact replay): dedupeKey suppresses duplicates
      const run2 = await consumer.handleFinancePaymentRequestSubmitted(event);
      const receipt2 = extractOutboxReceipt(run2);

      expect(receipt2?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(run2).toHaveLength(2);
      expect(run2[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(run2[1].status).toBe('DUPLICATE_SUPPRESSED');

      // State remains strictly 2 rows, no duplicates inserted
      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryPushOutbox).toHaveLength(2);
    });
  });

  describe('7. Receipt Hardening & SYNC_ONLY Policy', () => {
    it('returns INTENTIONALLY_IGNORED on missing eventId or malformed event', async () => {
      const malformedEvent: any = {
        eventName: 'finance.payment_request.submitted',
        payload: { requestId: PRQ_ID },
      };

      const results = await consumer.handleFinancePaymentRequestSubmitted(malformedEvent);
      const receipt = extractOutboxReceipt(results);

      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(results).toHaveLength(0);
      expect(inMemoryNotifications).toHaveLength(0);
    });

    it('returns INTENTIONALLY_IGNORED when notificationPolicy is SYNC_ONLY', async () => {
      const syncOnlyEvent: BusinessEvent<any> = {
        eventId: `prq-sub-${PRQ_ID}`,
        eventName: 'finance.payment_request.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: PRQ_ID,
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        payload: {
          requestId: PRQ_ID,
        },
      };

      const results = await consumer.handleFinancePaymentRequestSubmitted(syncOnlyEvent);
      const receipt = extractOutboxReceipt(results);

      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(inMemoryNotifications).toHaveLength(0);
    });

    it('hardens finance.payment.recorded to return INTENTIONALLY_IGNORED when missing eventId', async () => {
      const malformedPayment: any = {
        eventName: 'finance.payment.recorded',
        payload: { paymentId: 99 },
      };

      const results = await consumer.handleFinancePaymentRecorded(malformedPayment);
      const receipt = extractOutboxReceipt(results);

      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(results).toHaveLength(0);
    });
  });

  describe('8. Outbox Relay Integration', () => {
    it('relays pending Payment Request OutboxEvent and transitions status to PUBLISHED', async () => {
      const outbox = new OutboxEvent();
      outbox.id = 1001;
      outbox.event_id = `prq-sub-${PRQ_ID}`;
      outbox.event_name = 'finance.payment_request.submitted';
      outbox.event_version = '1';
      outbox.aggregate_type = 'PAYMENT_REQUEST';
      outbox.aggregate_id = PRQ_ID;
      outbox.status = OutboxStatus.PENDING;
      outbox.retry_count = 0;
      outbox.payload = {
        requestId: PRQ_ID,
        requestNumber: PRQ_NUMBER,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        routing: { roles: ['DIRECTOR'] },
        businessPayload: {
          requestId: PRQ_ID,
          requestNumber: PRQ_NUMBER,
        },
      };

      inMemoryOutboxEvents.push(outbox);

      // Mock event delivery evaluation to return DELIVERED
      jest.spyOn(relayService, 'evaluateEventDelivery').mockResolvedValue({
        outcome: OutboxDeliveryOutcome.DELIVERED,
      });

      const outcome = await relayService.relaySingleEvent(1001);
      expect(outcome).toBe('SUCCESS');
      expect(outbox.status).toBe(OutboxStatus.PUBLISHED);
      expect(outbox.published_at).toBeDefined();
    });
  });
});
