import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { CanonicalNotificationConsumer } from '../canonical-notification.consumer';
import { CanonicalNotificationWriter } from '../canonical-notification.writer';
import { BusinessSyncConsumer } from '../business-sync.consumer';
import { NotificationGateway } from '../notification.gateway';
import { Notification } from '../../../entities/notification.entity';
import { PushOutbox, PushOutboxStatus } from '../../../entities/push-outbox.entity';
import { OutboxEvent } from '../../../entities/outbox-event.entity';
import {
  BusinessEvent,
  NotificationPolicy,
  OutboxDeliveryOutcome,
  extractOutboxReceipt,
} from '../../../shared/contracts/business-event.contract';

describe('FASE 1.6 — F-HIGH-01: Missing Canonical Event Notification Coverage Spec', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let syncConsumer: BusinessSyncConsumer;

  let inMemoryNotifications: Notification[] = [];
  let inMemoryPushOutbox: PushOutbox[] = [];
  let capturedSyncRooms: string[][] = [];
  let capturedSyncEnvelopes: any[] = [];

  const PROJECT_ID = 101;
  const PROJECT_CODE = 'PRJ-TVM-2026-001';
  const PROJECT_NAME = 'Fiber Optic Backbone Rollout';
  const PM_ID = 201;
  const PMO_ID = 301;
  const HOPS_ID = 302;
  const DIRECTOR_ID = 401;

  const PROCUREMENT_USER_ID = 501;
  const PURCHASING_USER_ID = 502;

  const FINANCE_USER_1_ID = 601;
  const FINANCE_USER_2_ID = 602;

  const PACKAGE_ID = 701;
  const PACKAGE_NUMBER = 'PKG-2026-001';

  const PO_ID = 801;
  const PO_NUMBER = 'PO-2026-001';
  const PR_ID = 901;
  const PR_REQUESTER_ID = 205;

  const GR_ID = 1001;
  const GR_NUMBER = 'GR-2026-001';

  const CLAIM_ID = 1101;
  const CLAIM_NUMBER = 'CLM-2026-001';

  const INVOICE_ID = 1201;
  const INVOICE_NUMBER = 'INV-2026-001';

  const mockGateway = {
    sendNotificationToUser: jest.fn(),
    sendSyncEventToRooms: jest.fn().mockImplementation((rooms: string[], envelope: any) => {
      capturedSyncRooms.push(rooms);
      capturedSyncEnvelopes.push(envelope);
    }),
  };

  const mockDataSource = {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      // 1. Resolve Role User IDs
      if (sql.includes('FROM users u') && sql.includes('JOIN user_roles ur')) {
        const roles: string[] = Array.isArray(params) ? params.flat() : [params];
        const userIds: number[] = [];
        if (roles.includes('PMO')) userIds.push(PMO_ID);
        if (roles.includes('HEAD_OF_OPERATIONS')) userIds.push(HOPS_ID);
        if (roles.includes('DIRECTOR')) userIds.push(DIRECTOR_ID);
        if (roles.includes('PROCUREMENT')) userIds.push(PROCUREMENT_USER_ID);
        if (roles.includes('PURCHASING')) userIds.push(PURCHASING_USER_ID);
        if (roles.includes('FINANCE')) userIds.push(FINANCE_USER_1_ID, FINANCE_USER_2_ID);
        return userIds.map((id) => ({ id }));
      }

      // 2. Resolve Project Context
      if (sql.includes('FROM projects')) {
        const id = Number(params?.[0]);
        if (id === PROJECT_ID) {
          return [
            {
              id: PROJECT_ID,
              name: PROJECT_NAME,
              code: PROJECT_CODE,
              manager_id: PM_ID,
              is_active: 1,
            },
          ];
        }
        return [];
      }

      // 3. Resolve Purchase Order Context
      if (sql.includes('FROM purchase_orders') && sql.includes('po_number')) {
        const id = Number(params?.[0]);
        if (id === PO_ID) {
          return [
            {
              id: PO_ID,
              po_number: PO_NUMBER,
              pr_id: PR_ID,
              project_id: PROJECT_ID,
              requester_id: PR_REQUESTER_ID,
              manager_id: PM_ID,
            },
          ];
        }
        return [];
      }

      // 4. Resolve PM User ID from PO
      if (sql.includes('FROM purchase_orders po') && sql.includes('JOIN purchase_requests pr')) {
        const id = Number(params?.[0]);
        if (id === PO_ID) {
          return [{ manager_id: PM_ID }];
        }
        return [];
      }

      // 5. Resolve Purchase Request Context
      if (sql.includes('FROM purchase_requests')) {
        const id = Number(params?.[0]);
        if (id === PR_ID) {
          return [
            {
              id: PR_ID,
              pr_number: 'PR-2026-001',
              project_id: PROJECT_ID,
              requester_id: PR_REQUESTER_ID,
              created_by: PR_REQUESTER_ID,
              status: 'APPROVED',
            },
          ];
        }
        return [];
      }

      // 6. Resolve Claim Context
      if (sql.includes('FROM service_claims')) {
        const id = Number(params?.[0]);
        if (id === CLAIM_ID) {
          return [
            {
              po_id: PO_ID,
              project_id: PROJECT_ID,
              submitted_by: PM_ID,
            },
          ];
        }
        return [];
      }

      // 7. Resolve Invoice Creator
      if (sql.includes('FROM invoices')) {
        const id = Number(params?.[0]);
        if (id === INVOICE_ID) {
          return [{ created_by: FINANCE_USER_1_ID }];
        }
        return [];
      }

      return [];
    }),
  };

  const mockNotificationRepo = {
    save: jest.fn().mockImplementation(async (entity: Notification) => {
      const duplicate = inMemoryNotifications.find(
        (n) => n.userId === entity.userId && n.dedupeKey && n.dedupeKey === entity.dedupeKey,
      );
      if (duplicate) {
        const err: any = new Error(`Duplicate entry '${entity.dedupeKey}' for key 'idx_notif_user_dedupe'`);
        err.code = 'ER_DUP_ENTRY';
        err.errno = 1062;
        throw err;
      }
      const saved = Object.assign(new Notification(), entity, {
        id: inMemoryNotifications.length + 1,
        createdAt: new Date(),
      });
      inMemoryNotifications.push(saved);
      return saved;
    }),
    find: jest.fn().mockImplementation(async () => inMemoryNotifications),
  };

  const mockPushOutboxRepo = {
    save: jest.fn().mockImplementation(async (entity: PushOutbox) => {
      const duplicate = inMemoryPushOutbox.find(
        (p) => p.dedupeKey && p.dedupeKey === entity.dedupeKey,
      );
      if (duplicate) {
        const err: any = new Error(`Duplicate entry '${entity.dedupeKey}' for key 'uk_push_outbox_dedupe'`);
        err.code = 'ER_DUP_ENTRY';
        err.errno = 1062;
        throw err;
      }
      const saved = Object.assign(new PushOutbox(), entity, {
        id: inMemoryPushOutbox.length + 1,
        status: PushOutboxStatus.PENDING,
        createdAt: new Date(),
      });
      inMemoryPushOutbox.push(saved);
      return saved;
    }),
    find: jest.fn().mockImplementation(async () => inMemoryPushOutbox),
  };

  beforeEach(async () => {
    inMemoryNotifications = [];
    inMemoryPushOutbox = [];
    capturedSyncRooms = [];
    capturedSyncEnvelopes = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalNotificationConsumer,
        CanonicalNotificationWriter,
        BusinessSyncConsumer,
        EventEmitter2,
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
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: 'BullQueue_email',
          useValue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
        },
      ],
    }).compile();

    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
    syncConsumer = module.get<BusinessSyncConsumer>(BusinessSyncConsumer);
  });

  // =========================================================================
  // 1. EVENT 1: project.kickoff.executed
  // =========================================================================
  describe('1. project.kickoff.executed — Canonical Bell & PushOutbox Coverage', () => {
    const eventId = `proj-kick-${PROJECT_ID}`;
    const kickoffEvent: BusinessEvent = {
      eventId,
      eventName: 'project.kickoff.executed',
      eventVersion: 1,
      occurredAt: '2026-10-30T10:00:00.000Z',
      aggregateType: 'Project',
      aggregateId: PROJECT_ID,
      projectId: PROJECT_ID,
      actor: { userId: PM_ID },
      routing: { roles: ['PMO', 'HEAD_OF_OPERATIONS'] },
      notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
      payload: {
        projectId: PROJECT_ID,
        projectCode: PROJECT_CODE,
        contractId: 801,
        managerId: PM_ID,
        actualKickoffDate: '2026-11-01',
        status: 'IN_PROGRESS',
      },
    };

    it('projects Bell + PushOutbox to PMO and HOPS, strictly isolating Director and PM actor', async () => {
      const results = await consumer.handleProjectKickoffExecuted(kickoffEvent);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);

      const recipientIds = results.map((r) => r.recipientId);
      expect(recipientIds).toContain(PMO_ID);
      expect(recipientIds).toContain(HOPS_ID);
      expect(recipientIds).not.toContain(PM_ID); // PM actor strictly excluded
      expect(recipientIds).not.toContain(DIRECTOR_ID); // Director strictly excluded by policy

      // Dual projection verification
      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryPushOutbox).toHaveLength(2);

      // Deep link verification
      const expectedLink = `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=overview`;
      expect(inMemoryNotifications[0].actionLink).toBe(expectedLink);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionTarget).toBe(expectedLink);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionLink).toBe(expectedLink);

      // Delivery receipt verification
      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(receipt?.channel).toBe('CANONICAL_NOTIFICATION');
    });

    it('guarantees idempotency via deterministic deduplication key and suppresses duplicates on replay', async () => {
      const firstRun = await consumer.handleProjectKickoffExecuted(kickoffEvent);
      expect(firstRun.every((r) => r.status === 'PERSISTED')).toBe(true);

      const secondRun = await consumer.handleProjectKickoffExecuted(kickoffEvent);
      expect(secondRun).toHaveLength(2);
      expect(secondRun.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);

      // In-memory count remains exactly 2 (no duplicate rows created)
      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryPushOutbox).toHaveLength(2);
    });

    it('bypasses projection when notificationPolicy is SYNC_ONLY', async () => {
      const syncOnlyEvent: BusinessEvent = {
        ...kickoffEvent,
        eventId: `proj-kick-${PROJECT_ID}-sync`,
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
      };

      const results = await consumer.handleProjectKickoffExecuted(syncOnlyEvent);
      expect(results).toHaveLength(0);
      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(inMemoryNotifications).toHaveLength(0);
    });
  });

  // =========================================================================
  // 2. EVENT 2: procurement.package.submitted
  // =========================================================================
  describe('2. procurement.package.submitted — Canonical Bell & PushOutbox Coverage', () => {
    const eventId = `pkg-sub-${PACKAGE_ID}`;
    const packageEvent: BusinessEvent = {
      eventId,
      eventName: 'procurement.package.submitted',
      eventVersion: 1,
      occurredAt: '2026-10-30T10:15:00.000Z',
      aggregateType: 'ProcurementPackage',
      aggregateId: PACKAGE_ID,
      projectId: PROJECT_ID,
      actor: { userId: PM_ID },
      routing: { roles: ['PROCUREMENT', 'PURCHASING'] },
      notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
      payload: {
        packageId: PACKAGE_ID,
        packageNumber: PACKAGE_NUMBER,
        projectId: PROJECT_ID,
        totalEstimatedAmount: 250000000,
        submittedBy: PM_ID,
        submittedAt: '2026-10-30T10:15:00.000Z',
        status: 'SUBMITTED',
      },
    };

    it('projects Bell + PushOutbox to PROCUREMENT and PURCHASING, strictly excluding PM submitter actor', async () => {
      const results = await consumer.handleProcurementPackageSubmitted(packageEvent);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);

      const recipientIds = results.map((r) => r.recipientId);
      expect(recipientIds).toContain(PROCUREMENT_USER_ID);
      expect(recipientIds).toContain(PURCHASING_USER_ID);
      expect(recipientIds).not.toContain(PM_ID); // PM submitter actor excluded

      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryPushOutbox).toHaveLength(2);

      const expectedLink = `/procurement?tab=packages&packageId=${PACKAGE_ID}`;
      expect(inMemoryNotifications[0].actionLink).toBe(expectedLink);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionTarget).toBe(expectedLink);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionLink).toBe(expectedLink);

      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
    });

    it('guarantees idempotency via deduplication key pkg-sub-...:recipientId:PROCUREMENT_PACKAGE_SUBMITTED', async () => {
      await consumer.handleProcurementPackageSubmitted(packageEvent);
      const replay = await consumer.handleProcurementPackageSubmitted(packageEvent);

      expect(replay).toHaveLength(2);
      expect(replay.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);
      expect(inMemoryNotifications).toHaveLength(2);
    });
  });

  // =========================================================================
  // 3. EVENT 3: procurement.po.issued
  // =========================================================================
  describe('3. procurement.po.issued — Canonical Bell & PushOutbox Coverage', () => {
    const eventId = `po-iss-${PO_ID}`;
    const poEvent: BusinessEvent = {
      eventId,
      eventName: 'procurement.po.issued',
      eventVersion: 1,
      occurredAt: '2026-10-30T10:30:00.000Z',
      aggregateType: 'PurchaseOrder',
      aggregateId: PO_ID,
      projectId: PROJECT_ID,
      actor: { userId: PURCHASING_USER_ID },
      routing: { roles: ['PROCUREMENT', 'PURCHASING', 'FINANCE', 'SUPER_ADMIN'] },
      notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
      payload: {
        poId: PO_ID,
        poNumber: PO_NUMBER,
        vendorId: 55,
        status: 'ISSUED',
        totalAmount: 180000000,
        orderType: 'MATERIAL',
        projectId: PROJECT_ID,
        purchaseRequestId: PR_ID,
        issuedBy: PURCHASING_USER_ID,
      },
    };

    it('projects Bell + PushOutbox to PM and PR Requester, strictly excluding Purchasing issuing actor', async () => {
      const results = await consumer.handleProcurementPoIssued(poEvent);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);

      const recipientIds = results.map((r) => r.recipientId);
      expect(recipientIds).toContain(PM_ID); // Project Manager
      expect(recipientIds).toContain(PR_REQUESTER_ID); // PR Requester
      expect(recipientIds).not.toContain(PURCHASING_USER_ID); // Issuing actor strictly excluded

      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryPushOutbox).toHaveLength(2);

      const expectedLink = `/procurement?tab=po&poId=${PO_ID}`;
      expect(inMemoryNotifications[0].actionLink).toBe(expectedLink);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionTarget).toBe(expectedLink);

      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
    });

    it('bypasses projection and returns INTENTIONALLY_IGNORED receipt if notificationPolicy is SYNC_ONLY', async () => {
      const syncOnlyPoEvent: BusinessEvent = {
        ...poEvent,
        eventId: `po-iss-${PO_ID}-sync`,
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
      };

      const results = await consumer.handleProcurementPoIssued(syncOnlyPoEvent);
      expect(results).toHaveLength(0);
      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(inMemoryNotifications).toHaveLength(0);
    });

    it('guarantees idempotency via deduplication key po-iss-...:recipientId:PURCHASE_ORDER_ISSUED', async () => {
      await consumer.handleProcurementPoIssued(poEvent);
      const replay = await consumer.handleProcurementPoIssued(poEvent);

      expect(replay).toHaveLength(2);
      expect(replay.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);
      expect(inMemoryNotifications).toHaveLength(2);
    });
  });

  // =========================================================================
  // 4. EVENT 4: procurement.gr.received
  // =========================================================================
  describe('4. procurement.gr.received — Canonical Bell & PushOutbox Coverage', () => {
    const eventId = `gr-rec-${GR_ID}`;
    const grEvent: BusinessEvent = {
      eventId,
      eventName: 'procurement.gr.received',
      eventVersion: 1,
      occurredAt: '2026-10-30T11:00:00.000Z',
      aggregateType: 'GoodsReceipt',
      aggregateId: GR_ID,
      actor: { userId: FINANCE_USER_1_ID }, // Receiving user
      routing: { roles: ['PROCUREMENT', 'PURCHASING', 'FINANCE', 'SUPER_ADMIN'] },
      notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
      payload: {
        grId: GR_ID,
        grNumber: GR_NUMBER,
        poId: PO_ID,
        poNumber: PO_NUMBER,
        status: 'RECEIVED',
        receivedBy: FINANCE_USER_1_ID,
      },
    };

    it('projects Bell + PushOutbox to FINANCE and PM, strictly excluding receiving actor', async () => {
      const results = await consumer.handleProcurementGrReceived(grEvent);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);

      const recipientIds = results.map((r) => r.recipientId);
      expect(recipientIds).toContain(FINANCE_USER_2_ID); // Finance colleague
      expect(recipientIds).toContain(PM_ID); // Project Manager
      expect(recipientIds).not.toContain(FINANCE_USER_1_ID); // Receiving actor strictly excluded

      expect(inMemoryNotifications).toHaveLength(2);
      expect(inMemoryPushOutbox).toHaveLength(2);

      const expectedLink = `/procurement?tab=gr&poId=${PO_ID}`;
      expect(inMemoryNotifications[0].actionLink).toBe(expectedLink);
      expect(inMemoryNotifications[0].title).toBe(`Penerimaan Barang Dicatat (${GR_NUMBER})`);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionTarget).toBe(expectedLink);

      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
    });

    it('bypasses projection and returns INTENTIONALLY_IGNORED receipt if notificationPolicy is SYNC_ONLY', async () => {
      const syncOnlyGrEvent: BusinessEvent = {
        ...grEvent,
        eventId: `gr-rec-${GR_ID}-sync`,
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
      };

      const results = await consumer.handleProcurementGrReceived(syncOnlyGrEvent);
      expect(results).toHaveLength(0);
      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(inMemoryNotifications).toHaveLength(0);
    });

    it('guarantees idempotency via deduplication key gr-rec-...:recipientId:GOODS_RECEIPT_RECORDED', async () => {
      await consumer.handleProcurementGrReceived(grEvent);
      const replay = await consumer.handleProcurementGrReceived(grEvent);

      expect(replay).toHaveLength(2);
      expect(replay.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);
      expect(inMemoryNotifications).toHaveLength(2);
    });
  });

  // =========================================================================
  // 5. EVENT 5: procurement.service_claim.approved_for_invoice (Phase 1.3 Regression)
  // =========================================================================
  describe('5. procurement.service_claim.approved_for_invoice — Phase 1.3 Regression Verification', () => {
    const eventId = `claim-app-${CLAIM_ID}`;
    const claimEvent: BusinessEvent = {
      eventId,
      eventName: 'procurement.service_claim.approved_for_invoice',
      eventVersion: 1,
      occurredAt: '2026-10-30T11:30:00.000Z',
      aggregateType: 'ServiceClaim',
      aggregateId: CLAIM_ID,
      actor: { userId: PROCUREMENT_USER_ID }, // Commercial verifier
      routing: { roles: ['FINANCE', 'PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'] },
      notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
      payload: {
        claimId: CLAIM_ID,
        claimNumber: CLAIM_NUMBER,
        poId: PO_ID,
        projectId: PROJECT_ID,
        verifierId: PROCUREMENT_USER_ID,
      },
    };

    it('confirms existing Phase 1.3 handler projects Bell + PushOutbox targeting Finance with exact deep link', async () => {
      const results = await consumer.handleServiceClaimApprovedForInvoice(claimEvent);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'PERSISTED')).toBe(true);

      const recipientIds = results.map((r) => r.recipientId);
      expect(recipientIds).toContain(FINANCE_USER_1_ID);
      expect(recipientIds).toContain(FINANCE_USER_2_ID);

      const expectedLink = `/finance/invoices?tab=ready_pos&poId=${PO_ID}&serviceClaimId=${CLAIM_ID}`;
      expect(inMemoryNotifications[0].actionLink).toBe(expectedLink);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionTarget).toBe(expectedLink);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionLink).toBe(expectedLink);

      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
    });

    it('guarantees idempotency via deduplication key claim-app-...:recipientId:SERVICE_CLAIM_APPROVED_FOR_INVOICE', async () => {
      await consumer.handleServiceClaimApprovedForInvoice(claimEvent);
      const replay = await consumer.handleServiceClaimApprovedForInvoice(claimEvent);

      expect(replay).toHaveLength(2);
      expect(replay.every((r) => r.status === 'DUPLICATE_SUPPRESSED')).toBe(true);
      expect(inMemoryNotifications).toHaveLength(2);
    });
  });

  // =========================================================================
  // 6. EVENT 6: finance.invoice.created
  // =========================================================================
  describe('6. finance.invoice.created — Canonical Bell & PushOutbox Coverage', () => {
    const eventId = `inv-cre-${INVOICE_ID}`;
    const invoiceEvent: BusinessEvent = {
      eventId,
      eventName: 'finance.invoice.created',
      eventVersion: 1,
      occurredAt: '2026-10-30T12:00:00.000Z',
      aggregateType: 'Invoice',
      aggregateId: INVOICE_ID,
      actor: { userId: FINANCE_USER_1_ID }, // Invoice creator
      routing: { roles: ['FINANCE'] },
      notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
      payload: {
        invoiceId: INVOICE_ID,
        invoiceNumber: INVOICE_NUMBER,
        poId: PO_ID,
        totalAmount: 120000000,
        matchStatus: 'UNMATCHED',
        paymentStatus: 'UNPAID',
        isTermBased: false,
        createdBy: FINANCE_USER_1_ID,
      },
    };

    it('projects Bell + PushOutbox to Finance verifiers, strictly excluding invoice creator actor', async () => {
      const results = await consumer.handleFinanceInvoiceCreated(invoiceEvent);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      expect(results[0].recipientId).toBe(FINANCE_USER_2_ID);
      expect(results.map((r) => r.recipientId)).not.toContain(FINANCE_USER_1_ID); // Creator actor strictly excluded

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryPushOutbox).toHaveLength(1);

      const expectedLink = `/finance/invoices?tab=invoices_list&invoiceId=${INVOICE_ID}`;
      expect(inMemoryNotifications[0].actionLink).toBe(expectedLink);
      expect(inMemoryNotifications[0].title).toBe(`Faktur Tagihan Dibuat (${INVOICE_NUMBER})`);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionTarget).toBe(expectedLink);
      expect(inMemoryPushOutbox[0].payloadPreview?.actionLink).toBe(expectedLink);

      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
    });

    it('guarantees idempotency via deduplication key inv-cre-...:recipientId:FINANCE_INVOICE_CREATED', async () => {
      await consumer.handleFinanceInvoiceCreated(invoiceEvent);
      const replay = await consumer.handleFinanceInvoiceCreated(invoiceEvent);

      expect(replay).toHaveLength(1);
      expect(replay[0].status).toBe('DUPLICATE_SUPPRESSED');
      expect(inMemoryNotifications).toHaveLength(1);
    });

    it('resolves invoice creator from database fallback when actor is missing', async () => {
      const eventWithoutActor: BusinessEvent = {
        ...invoiceEvent,
        eventId: `inv-cre-${INVOICE_ID}-fallback`,
        actor: undefined,
        payload: {
          ...(invoiceEvent.payload as any),
          createdBy: undefined,
        },
      };

      const results = await consumer.handleFinanceInvoiceCreated(eventWithoutActor);
      expect(results).toHaveLength(1);
      expect(results[0].recipientId).toBe(FINANCE_USER_2_ID);
      expect(results.map((r) => r.recipientId)).not.toContain(FINANCE_USER_1_ID);
    });
  });

  // =========================================================================
  // 7. BusinessSyncConsumer Coexistence & Invariants
  // =========================================================================
  describe('7. BusinessSyncConsumer Coexistence & Invariants', () => {
    it('dispatches sync envelopes for all 6 events to approved audience rooms without error', () => {
      const events: Array<{ name: string; event: BusinessEvent; handler: (e: BusinessEvent) => any }> = [
        {
          name: 'project.kickoff.executed',
          event: {
            eventId: `proj-kick-${PROJECT_ID}`,
            eventName: 'project.kickoff.executed',
            eventVersion: 1,
            occurredAt: '2026-10-30T10:00:00.000Z',
            aggregateType: 'Project',
            aggregateId: PROJECT_ID,
            payload: { projectId: PROJECT_ID },
          },
          handler: (e) => syncConsumer.handleProjectKickoffExecuted(e),
        },
        {
          name: 'procurement.package.submitted',
          event: {
            eventId: `pkg-sub-${PACKAGE_ID}`,
            eventName: 'procurement.package.submitted',
            eventVersion: 1,
            occurredAt: '2026-10-30T10:15:00.000Z',
            aggregateType: 'ProcurementPackage',
            aggregateId: PACKAGE_ID,
            payload: { packageId: PACKAGE_ID },
          },
          handler: (e) => syncConsumer.handleProcurementPackageSubmitted(e),
        },
        {
          name: 'procurement.po.issued',
          event: {
            eventId: `po-iss-${PO_ID}`,
            eventName: 'procurement.po.issued',
            eventVersion: 1,
            occurredAt: '2026-10-30T10:30:00.000Z',
            aggregateType: 'PurchaseOrder',
            aggregateId: PO_ID,
            payload: { poId: PO_ID },
          },
          handler: (e) => syncConsumer.handleProcurementPoIssued(e),
        },
        {
          name: 'procurement.gr.received',
          event: {
            eventId: `gr-rec-${GR_ID}`,
            eventName: 'procurement.gr.received',
            eventVersion: 1,
            occurredAt: '2026-10-30T11:00:00.000Z',
            aggregateType: 'GoodsReceipt',
            aggregateId: GR_ID,
            payload: { grId: GR_ID },
          },
          handler: (e) => syncConsumer.handleProcurementGrReceived(e),
        },
        {
          name: 'procurement.service_claim.approved_for_invoice',
          event: {
            eventId: `claim-app-${CLAIM_ID}`,
            eventName: 'procurement.service_claim.approved_for_invoice',
            eventVersion: 1,
            occurredAt: '2026-10-30T11:30:00.000Z',
            aggregateType: 'ServiceClaim',
            aggregateId: CLAIM_ID,
            payload: { claimId: CLAIM_ID },
          },
          handler: (e) => syncConsumer.handleProcurementServiceClaimApprovedForInvoice(e),
        },
        {
          name: 'finance.invoice.created',
          event: {
            eventId: `inv-cre-${INVOICE_ID}`,
            eventName: 'finance.invoice.created',
            eventVersion: 1,
            occurredAt: '2026-10-30T12:00:00.000Z',
            aggregateType: 'Invoice',
            aggregateId: INVOICE_ID,
            payload: { invoiceId: INVOICE_ID },
          },
          handler: (e) => syncConsumer.handleFinanceInvoiceCreated(e),
        },
      ];

      for (const item of events) {
        const receipt = item.handler(item.event);
        expect(receipt.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
        expect(receipt.channel).toBe('BUSINESS_SYNC');
      }

      expect(capturedSyncRooms).toHaveLength(6);
      expect(capturedSyncEnvelopes).toHaveLength(6);
    });
  });
});
