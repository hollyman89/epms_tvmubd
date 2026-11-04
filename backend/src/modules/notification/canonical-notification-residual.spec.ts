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

    it('projects actionable approval alert to Director and confirmation to Submitter when approvers exist', async () => {
      inMemoryNotifications.length = 0;
      socketPushes.length = 0;

      // Mock dataSource to resolve Director (user 4)
      (consumer as any).dataSource = {
        query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('FROM users')) {
            return [{ id: 4 }];
          }
          return [];
        }),
      };

      const eventWithApprovers = {
        ...canonicalSubmittedEvent,
        eventId: 'evt-gonogo-sub-dual-001',
      };

      const results = await consumer.handleMarketingGoNoGoSubmitted(eventWithApprovers);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);

      // Director Notification
      const directorResult = results.find((r) => r.recipientId === 4);
      expect(directorResult).toBeDefined();
      expect(directorResult?.purpose).toBe('MARKETING_GONOGO_APPROVAL_REQUIRED');

      const directorNotif = inMemoryNotifications.find((n) => n.userId === 4);
      expect(directorNotif).toBeDefined();
      expect(directorNotif?.title).toBe('Persetujuan GO / NO GO Diperlukan');
      expect(directorNotif?.message).toContain('membutuhkan persetujuan GO / NO GO dari Direktur');
      expect(directorNotif?.actionLink).toBe('/sales?tab=1&tenderId=101&action=go-nogo');
      expect(directorNotif?.notificationType).toBe('ALERT');

      // Submitter Notification
      const submitterResult = results.find((r) => r.recipientId === 25);
      expect(submitterResult).toBeDefined();
      expect(submitterResult?.purpose).toBe('MARKETING_GONOGO_SUBMITTED');

      const submitterNotif = inMemoryNotifications.find((n) => n.userId === 25);
      expect(submitterNotif).toBeDefined();
      expect(submitterNotif?.title).toBe('GO/NO GO Berhasil Diajukan');
      expect(submitterNotif?.actionLink).toBe('/sales/tenders/101');

      // Both users received WebSocket notifications
      expect(socketPushes.some((p) => p.userId === 4)).toBe(true);
      expect(socketPushes.some((p) => p.userId === 25)).toBe(true);
    });

    it('suppresses duplicate projection on retry for both Director and Submitter', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockResolvedValue([{ id: 4 }]),
      };

      const event = {
        ...canonicalSubmittedEvent,
        eventId: 'evt-gonogo-sub-dual-retry-001',
      };

      const firstPass = await consumer.handleMarketingGoNoGoSubmitted(event);
      expect(firstPass).toHaveLength(2);
      expect(firstPass.every((r) => r.status === 'PERSISTED')).toBe(true);

      const retryPass = await consumer.handleMarketingGoNoGoSubmitted(event);
      expect(retryPass).toHaveLength(2);
      expect(retryPass.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);
    });

    it('correctly handles resubmission title and message for both parties', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockResolvedValue([{ id: 4 }]),
      };

      const resubmissionEvent = {
        ...canonicalSubmittedEvent,
        eventId: 'evt-gonogo-resub-001',
        payload: {
          ...canonicalSubmittedEvent.payload,
          isResubmission: true,
        },
      };

      const results = await consumer.handleMarketingGoNoGoSubmitted(resubmissionEvent);
      expect(results).toHaveLength(2);

      const directorNotif = inMemoryNotifications.find(
        (n) => n.userId === 4 && n.dedupeKey?.includes('evt-gonogo-resub-001'),
      );
      expect(directorNotif?.title).toBe('Persetujuan Ulang GO / NO GO');
      expect(directorNotif?.message).toContain('telah direvisi dan diajukan kembali');

      const submitterNotif = inMemoryNotifications.find(
        (n) => n.userId === 25 && n.dedupeKey?.includes('evt-gonogo-resub-001'),
      );
      expect(submitterNotif?.title).toBe('GO/NO GO Berhasil Diajukan Ulang');
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

  describe('8. finance.invoice.rejected Canonical Event Projection', () => {
    const canonicalInvoiceRejectedEvent: BusinessEvent<{
      invoiceId: number;
      invoiceNumber: string;
      poId: number;
      paymentTermId?: number | null;
      totalAmount: number;
      rejectedBy: number;
      notes?: string;
      status: string;
      createdBy?: number;
    }> = {
      eventId: 'evt-inv-rej-001',
      eventName: 'finance.invoice.rejected',
      eventVersion: 1,
      occurredAt: '2026-10-29T10:00:00.000Z',
      aggregateType: 'Invoice',
      aggregateId: 701,
      routing: {
        userIds: [88],
      },
      payload: {
        invoiceId: 701,
        invoiceNumber: 'INV-20261029-001',
        poId: 201,
        paymentTermId: 10,
        totalAmount: 50000000,
        rejectedBy: 5,
        notes: 'Faktur pajak tidak valid dan lampiran BAST kurang',
        status: 'REJECTED',
        createdBy: 88,
      },
    };

    it('persists ALERT Bell notification for invoice creator with rejection context and deep link', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('FROM users') && params[0] === 88) {
            return [{ id: 88 }];
          }
          return [];
        }),
      };

      const results = await consumer.handleFinanceInvoiceRejected(canonicalInvoiceRejectedEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(88);
      expect(results[0].purpose).toBe('FINANCE_INVOICE_REJECTED');

      const saved = inMemoryNotifications[0];
      expect(saved).toBeDefined();
      expect(saved.userId).toBe(88);
      expect(saved.title).toBe('Invoice Ditolak (INV-20261029-001)');
      expect(saved.message).toContain('Faktur pajak tidak valid dan lampiran BAST kurang');
      expect(saved.notificationType).toBe('ALERT');
      expect(saved.actionLink).toBe('/finance/invoices?tab=invoices_list&invoiceId=701');

      expect(socketPushes).toHaveLength(1);
      expect(socketPushes[0].userId).toBe(88);
    });

    it('resolves creator from DB when createdBy and routing are missing from payload', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('FROM invoices')) {
            return [{ created_by: 88 }];
          }
          if (sql.includes('FROM users') && params[0] === 88) {
            return [{ id: 88 }];
          }
          return [];
        }),
      };

      const eventWithoutCreator: BusinessEvent<any> = {
        ...canonicalInvoiceRejectedEvent,
        eventId: 'evt-inv-rej-db-001',
        routing: undefined,
        payload: {
          invoiceId: 701,
          invoiceNumber: 'INV-20261029-001',
          poId: 201,
          notes: 'Ditolak via sistem',
          status: 'REJECTED',
        },
      };

      const results = await consumer.handleFinanceInvoiceRejected(eventWithoutCreator);

      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(88);
      expect(inMemoryNotifications[0].userId).toBe(88);
    });

    it('safely skips projection if creator cannot be determined authoritatively (no guessing)', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockResolvedValue([]),
      };

      const orphanEvent: BusinessEvent<any> = {
        ...canonicalInvoiceRejectedEvent,
        eventId: 'evt-inv-rej-orphan-001',
        routing: undefined,
        payload: {
          invoiceId: 99999,
          invoiceNumber: 'INV-ORPHAN',
          status: 'REJECTED',
        },
      };

      const results = await consumer.handleFinanceInvoiceRejected(orphanEvent);

      expect(results).toHaveLength(0);
      expect(inMemoryNotifications).toHaveLength(0);
      expect(socketPushes).toHaveLength(0);
    });

    it('safely skips projection if creator user is inactive or soft-deleted', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockImplementation(async () => {
          return [];
        }),
      };

      const results = await consumer.handleFinanceInvoiceRejected(canonicalInvoiceRejectedEvent);

      expect(results).toHaveLength(0);
      expect(inMemoryNotifications).toHaveLength(0);
    });

    it('suppresses duplicate projection on retry', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockResolvedValue([{ id: 88 }]),
      };

      await consumer.handleFinanceInvoiceRejected(canonicalInvoiceRejectedEvent);
      const retryResults = await consumer.handleFinanceInvoiceRejected(canonicalInvoiceRejectedEvent);

      expect(retryResults).toHaveLength(1);
      expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });
  });

  describe('9. finance.invoice.verified Canonical Event Projection', () => {
    const canonicalInvoiceVerifiedEvent: BusinessEvent<{
      invoiceId: number;
      invoiceNumber: string;
      poId: number;
      paymentTermId?: number | null;
      termName?: string | null;
      termType?: string | null;
      totalAmount: number;
      verifiedBy: number;
      status: string;
      createdBy?: number;
    }> = {
      eventId: 'evt-inv-ver-001',
      eventName: 'finance.invoice.verified',
      eventVersion: 1,
      occurredAt: '2026-10-29T10:00:00.000Z',
      aggregateType: 'Invoice',
      aggregateId: 702,
      routing: {
        userIds: [88],
      },
      payload: {
        invoiceId: 702,
        invoiceNumber: 'INV-20261029-002',
        poId: 201,
        paymentTermId: 11,
        totalAmount: 75000000,
        verifiedBy: 5,
        status: 'VERIFIED',
        createdBy: 88,
      },
    };

    it('persists informational SYSTEM Bell notification to invoice creator ONLY (no PM recipient added)', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('FROM users') && params[0] === 88) {
            return [{ id: 88 }];
          }
          return [];
        }),
      };

      const results = await consumer.handleFinanceInvoiceVerified(canonicalInvoiceVerifiedEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(88);
      expect(results[0].purpose).toBe('FINANCE_INVOICE_VERIFIED');

      const saved = inMemoryNotifications[0];
      expect(saved).toBeDefined();
      expect(saved.userId).toBe(88);
      expect(saved.title).toBe('Invoice Berhasil Diverifikasi (INV-20261029-002)');
      expect(saved.message).toContain('telah diverifikasi oleh Finance');
      expect(saved.notificationType).toBe('SYSTEM');
      expect(saved.actionLink).toBe('/finance/invoices?tab=invoices_list&invoiceId=702');

      expect(inMemoryNotifications).toHaveLength(1);
    });

    it('safely skips projection if creator user is inactive or missing', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockResolvedValue([]),
      };

      const results = await consumer.handleFinanceInvoiceVerified(canonicalInvoiceVerifiedEvent);

      expect(results).toHaveLength(0);
      expect(inMemoryNotifications).toHaveLength(0);
    });

    it('suppresses duplicate projection on retry', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockResolvedValue([{ id: 88 }]),
      };

      await consumer.handleFinanceInvoiceVerified(canonicalInvoiceVerifiedEvent);
      const retryResults = await consumer.handleFinanceInvoiceVerified(canonicalInvoiceVerifiedEvent);

      expect(retryResults).toHaveLength(1);
      expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });
  });

  describe('10. procurement.package.returned Canonical Event Projection', () => {
    const canonicalPackageReturnedEvent: BusinessEvent<{
      packageId: number;
      packageNumber: string;
      projectId: number;
      requestedBy?: number;
      reviewerId: number;
      reason: string;
      status: string;
    }> = {
      eventId: 'evt-pkg-ret-001',
      eventName: 'procurement.package.returned',
      eventVersion: 1,
      occurredAt: '2026-10-29T10:00:00.000Z',
      aggregateType: 'ProcurementPackage',
      aggregateId: 301,
      projectId: 10,
      routing: {
        userIds: [45],
      },
      payload: {
        packageId: 301,
        packageNumber: 'PKG-2026-001',
        projectId: 10,
        requestedBy: 45,
        reviewerId: 41,
        reason: 'Item kabel fiber optik melebihi sisa alokasi RAB',
        status: 'RETURNED',
      },
    };

    it('persists ALERT Bell notification for PM/requester with return reason and deep link', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('FROM users') && params[0] === 45) {
            return [{ id: 45 }];
          }
          return [];
        }),
      };

      const results = await consumer.handleProcurementPackageReturned(canonicalPackageReturnedEvent);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(results[0].recipientId).toBe(45);
      expect(results[0].purpose).toBe('PROCUREMENT_PACKAGE_RETURNED');

      const saved = inMemoryNotifications[0];
      expect(saved).toBeDefined();
      expect(saved.userId).toBe(45);
      expect(saved.title).toBe('Paket Pengadaan Dikembalikan (PKG-2026-001)');
      expect(saved.message).toContain('Item kabel fiber optik melebihi sisa alokasi RAB');
      expect(saved.notificationType).toBe('ALERT');
      expect(saved.actionLink).toBe('/procurement?tab=packages&packageId=301');

      expect(socketPushes).toHaveLength(1);
      expect(socketPushes[0].userId).toBe(45);
    });

    it('resolves PM/requester from data relations when payload does not specify requestedBy', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('FROM procurement_packages')) {
            return [{ requested_by: 45, project_id: 10, manager_id: 2 }];
          }
          if (sql.includes('FROM users') && params[0] === 45) {
            return [{ id: 45 }];
          }
          return [];
        }),
      };

      const eventWithoutRecipient: BusinessEvent<any> = {
        ...canonicalPackageReturnedEvent,
        eventId: 'evt-pkg-ret-db-001',
        routing: undefined,
        payload: {
          packageId: 301,
          packageNumber: 'PKG-2026-001',
          projectId: 10,
          reviewerId: 41,
          reason: 'Perlu spesifikasi merk',
          status: 'RETURNED',
        },
      };

      const results = await consumer.handleProcurementPackageReturned(eventWithoutRecipient);

      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(45);
    });

    it('falls back to project manager if requestedBy is inactive but PM is active', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('FROM procurement_packages')) {
            return [{ requested_by: 999, project_id: 10, manager_id: 2 }];
          }
          if (sql.includes('FROM users')) {
            if (params[0] === 999) return []; // Inactive requester
            if (params[0] === 2) return [{ id: 2 }]; // Active PM
          }
          return [];
        }),
      };

      const eventWithInactiveRequester: BusinessEvent<any> = {
        ...canonicalPackageReturnedEvent,
        eventId: 'evt-pkg-ret-fallback-pm-001',
        routing: undefined,
        payload: {
          packageId: 301,
          packageNumber: 'PKG-2026-001',
          projectId: 10,
          requestedBy: 999,
          reviewerId: 41,
          reason: 'Koreksi kuantitas',
          status: 'RETURNED',
        },
      };

      const results = await consumer.handleProcurementPackageReturned(eventWithInactiveRequester);

      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(2);
      expect(inMemoryNotifications[0].userId).toBe(2);
    });

    it('skips projection if neither requester nor PM can be determined or verified', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockResolvedValue([]),
      };

      const orphanEvent: BusinessEvent<any> = {
        ...canonicalPackageReturnedEvent,
        eventId: 'evt-pkg-ret-orphan-001',
        routing: undefined,
        payload: {
          packageId: 99999,
          packageNumber: 'PKG-UNKNOWN',
          reviewerId: 41,
          reason: 'Test',
          status: 'RETURNED',
        },
      };

      const results = await consumer.handleProcurementPackageReturned(orphanEvent);

      expect(results).toHaveLength(0);
      expect(inMemoryNotifications).toHaveLength(0);
    });

    it('suppresses duplicate projection on retry', async () => {
      (consumer as any).dataSource = {
        query: jest.fn().mockResolvedValue([{ id: 45 }]),
      };

      await consumer.handleProcurementPackageReturned(canonicalPackageReturnedEvent);
      const retryResults = await consumer.handleProcurementPackageReturned(canonicalPackageReturnedEvent);

      expect(retryResults).toHaveLength(1);
      expect(retryResults[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });
  });

  describe('11. Non-Bell Invariant Verification & Canonical Coverage', () => {
    it('finance.invoice.created has canonical Bell handler in CanonicalNotificationConsumer (Phase 1.6)', () => {
      expect(typeof (consumer as any).handleFinanceInvoiceCreated).toBe('function');
    });

    it('procurement.package.submitted has canonical Bell handler in CanonicalNotificationConsumer (Phase 1.6)', () => {
      expect(typeof (consumer as any).handleProcurementPackageSubmitted).toBe('function');
    });

    it('procurement.package.canceled has NO Bell handler in CanonicalNotificationConsumer', () => {
      expect((consumer as any).handleProcurementPackageCanceled).toBeUndefined();
    });
  });
});
