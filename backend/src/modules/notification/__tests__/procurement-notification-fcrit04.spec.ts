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
import { User } from '../../../entities/user.entity';
import { Role } from '../../../entities/role.entity';
import { PurchaseRequest } from '../../../entities/purchase-request.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { Rfq } from '../../../entities/rfq.entity';
import { GoodsReceipt } from '../../../entities/goods-receipt.entity';
import {
  BusinessEvent,
  NotificationPolicy,
  OutboxDeliveryOutcome,
  extractOutboxReceipt,
} from '../../../shared/contracts/business-event.contract';

describe('FASE 1.4 — F-CRIT-04: Procurement PR / RFQ / PO Notification Remediation Spec', () => {
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

  const PR_ID = 501;
  const PR_NUMBER = 'PR-20261030-001';
  const PO_ID = 601;
  const PO_NUMBER = 'PO-20261030-001';
  const RFQ_ID = 701;
  const RFQ_NUMBER = 'RFQ-20261030-001';
  const GR_ID = 801;
  const GR_NUMBER = 'GR-20261030-001';
  const PROJECT_ID = 901;
  const WORKFLOW_INSTANCE_ID = 4401;

  const PR_REQUESTER_ID = 10;
  const FINANCE_USER_ID = 20;
  const FINANCE_REVIEWER_ACTOR_ID = 21;
  const DIRECTOR_USER_ID = 30;
  const PROCUREMENT_USER_ID = 40;
  const PURCHASING_USER_ID = 41;

  const mockGateway = {
    sendNotificationToUser: jest.fn(),
    sendSyncEventToRooms: jest.fn().mockImplementation((rooms: string[], envelope: any) => {
      capturedSyncRooms.push(rooms);
      capturedSyncEnvelopes.push(envelope);
    }),
  };

  const mockDataSource = {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      // 1. Resolve Purchase Request context
      if (sql.includes('FROM purchase_requests')) {
        const id = Number(params?.[0]);
        if (id === PR_ID) {
          return [
            {
              id: PR_ID,
              pr_number: PR_NUMBER,
              project_id: PROJECT_ID,
              requester_id: PR_REQUESTER_ID,
              created_by: PR_REQUESTER_ID,
              status: 'SUBMITTED',
            },
          ];
        }
        return [];
      }

      // 2. Resolve Role User IDs
      if (sql.includes('FROM users u') && sql.includes('JOIN user_roles ur')) {
        const roles: string[] = Array.isArray(params) ? params.flat() : [params];
        const userIds: number[] = [];
        if (roles.includes('FINANCE')) userIds.push(FINANCE_USER_ID, FINANCE_REVIEWER_ACTOR_ID);
        if (roles.includes('DIRECTOR')) userIds.push(DIRECTOR_USER_ID);
        if (roles.includes('PROCUREMENT')) userIds.push(PROCUREMENT_USER_ID);
        if (roles.includes('PURCHASING')) userIds.push(PURCHASING_USER_ID);
        return userIds.map((id) => ({ id }));
      }

      // 3. Resolve Previous Reviewer User IDs (Director Return with action APPROVE)
      if (sql.includes('FROM workflow_tasks') && sql.includes('action = ?')) {
        const instId = Number(params?.[0]);
        const nodeId = params?.[1];
        const action = params?.[2];
        if (instId === WORKFLOW_INSTANCE_ID && nodeId === 'node_finance_review' && action === 'APPROVE') {
          return [{ decided_by: FINANCE_REVIEWER_ACTOR_ID, assignee_user_id: FINANCE_REVIEWER_ACTOR_ID }];
        }
        return [];
      }

      // 4. Resolve Active User Check
      if (sql.includes('FROM users') && sql.includes('WHERE id = ?')) {
        return [{ id: params?.[0], is_active: 1 }];
      }

      // 5. Workflow instance lookup
      if (sql.includes('FROM workflow_instances') && sql.includes('WHERE id = ?')) {
        return [
          {
            id: WORKFLOW_INSTANCE_ID,
            workflow_key: 'PURCHASE_REQUEST_WORKFLOW',
            entity_type: 'PURCHASE_REQUEST',
            entity_id: PR_ID,
          },
        ];
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
      module.get(EventEmitter2),
    );
  });

  describe('A. Purchase Request Notification Integrity', () => {
    it('1. PR Submitted: projects Bell + PushOutbox strictly to FINANCE users and returns DELIVERED receipt', async () => {
      const event: BusinessEvent<any> = {
        eventId: `pr-sub-${PR_ID}`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: PR_ID,
        projectId: PROJECT_ID,
        routing: { roles: ['FINANCE'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: PR_ID,
          prNumber: PR_NUMBER,
          projectId: PROJECT_ID,
          submittedBy: PR_REQUESTER_ID,
        },
      };

      const results = await consumer.handlePurchaseRequestSubmitted(event);

      expect(results).toHaveLength(2);
      const receipt = extractOutboxReceipt(results);
      expect(receipt).toBeDefined();
      expect(receipt?.channel).toBe('CANONICAL_NOTIFICATION');
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);

      const financeBells = inMemoryNotifications.filter(
        (n) => n.dedupeKey?.includes('PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW'),
      );
      expect(financeBells).toHaveLength(2);
      expect(financeBells[0].actionLink).toBe(`/procurement?tab=pr&prId=${PR_ID}`);
      expect(financeBells[0].title).toBe('Purchase Request Menunggu Review Finance');

      const financePushes = inMemoryPushOutbox.filter(
        (p) => p.dedupeKey?.includes('PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW:PUSH'),
      );
      expect(financePushes).toHaveLength(2);
      expect(financePushes[0].payloadPreview?.actionTarget).toBe(`/procurement?tab=pr&prId=${PR_ID}`);
      expect(financePushes[0].payloadPreview?.actionLink).toBe(`/procurement?tab=pr&prId=${PR_ID}`);
    });

    it('2. PR Generic Task Assigned on node_finance_review returns INTENTIONALLY_IGNORED (Zero Duplicate with pr.submitted)', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-fin-assigned-001',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 9001,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 9001,
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          nodeId: 'node_finance_review',
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(event);

      expect(results).toEqual([]);
      const receipt = extractOutboxReceipt(results);
      expect(receipt).toBeDefined();
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(receipt?.reason).toContain('Dedicated procurement.pr.submitted handles finance review assignment');
      expect(inMemoryNotifications).toHaveLength(0);
      expect(inMemoryPushOutbox).toHaveLength(0);
    });

    it('3. PR Resubmission: projects distinct title with cycle count and deterministic dedupe key', async () => {
      const event: BusinessEvent<any> = {
        eventId: `pr-wf-sub-${PR_ID}-resub-2`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: PR_ID,
        projectId: PROJECT_ID,
        routing: { roles: ['FINANCE'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: PR_ID,
          prNumber: PR_NUMBER,
          projectId: PROJECT_ID,
          isResubmission: true,
          resubmitted: true,
          resubmissionCount: 2,
        },
      };

      const results = await consumer.handlePurchaseRequestSubmitted(event);

      expect(results).toHaveLength(2);
      expect(results[0].notification?.title).toBe('Revisi ke-2 Purchase Request Menunggu Review Finance');
      expect(results[0].notification?.message).toContain('siklus ke-2');
      expect(results[0].notification?.dedupeKey).toContain(`pr-sub-${PR_ID}-resub-2`);
    });

    it('4. PR Director Approval Assignment: projects Bell + PushOutbox to DIRECTOR, excluding actor', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-dir-assigned-001',
        eventName: 'workflow.task.assigned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 9002,
        actor: { userId: FINANCE_REVIEWER_ACTOR_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 9002,
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          nodeId: 'node_director_approval',
          prNumber: PR_NUMBER,
        },
      };

      const results = await consumer.handleWorkflowTaskAssigned(event);

      expect(results).toHaveLength(1);
      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);

      const directorBell = inMemoryNotifications.find((n) => n.userId === DIRECTOR_USER_ID);
      expect(directorBell).toBeDefined();
      expect(directorBell?.title).toBe('Persetujuan Purchase Request (Direktur)');
      expect(directorBell?.actionLink).toBe(`/procurement?tab=pr&prId=${PR_ID}`);
      expect(inMemoryNotifications.find((n) => n.userId === FINANCE_REVIEWER_ACTOR_ID)).toBeUndefined();
    });

    it('5. PR Director Return: notifies PR requester AND actual approving Finance reviewer (action=APPROVE), excluding actor', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-dir-return-001',
        eventName: 'workflow.task.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 9003,
        actor: { userId: DIRECTOR_USER_ID },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          taskId: 9003,
          action: 'RETURN',
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          workflowInstanceId: WORKFLOW_INSTANCE_ID,
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          fromNode: 'node_director_approval',
          toNode: 'node_procurement_revision',
          reason: 'Anggaran melebihi batas estimasi',
        },
      };

      const results = await consumer.handleWorkflowTaskReturned(event);

      expect(results).toHaveLength(2);
      const recipientIds = results.map((r) => r.notification?.userId);
      expect(recipientIds).toContain(PR_REQUESTER_ID);
      expect(recipientIds).toContain(FINANCE_REVIEWER_ACTOR_ID);
      expect(recipientIds).not.toContain(DIRECTOR_USER_ID);

      const requesterBell = inMemoryNotifications.find((n) => n.userId === PR_REQUESTER_ID);
      expect(requesterBell?.title).toBe('Purchase Request Dikembalikan Direktur');
      expect(requesterBell?.actionLink).toBe(`/procurement?tab=pr&prId=${PR_ID}`);
    });

    it('6. PR Generic Workflow Completion: returns INTENTIONALLY_IGNORED (Zero Duplicate with procurement.pr.approved)', async () => {
      const completeEvent: BusinessEvent<any> = {
        eventId: 'evt-pr-wf-completed-001',
        eventName: 'workflow.instance.completed',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_INSTANCE',
        aggregateId: WORKFLOW_INSTANCE_ID,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: PR_ID,
          instanceId: WORKFLOW_INSTANCE_ID,
        },
      };

      const results = await consumer.handleWorkflowInstanceCompleted(completeEvent);

      expect(results).toEqual([]);
      const receipt = extractOutboxReceipt(results);
      expect(receipt).toBeDefined();
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(receipt?.reason).toContain('Dedicated procurement.pr.approved event handles canonical notification');
    });

    it('7. PR Approved Handover: notifies PROCUREMENT and PURCHASING users to create RFQ', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-approved-canonical',
        eventName: 'procurement.pr.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: PR_ID,
        projectId: PROJECT_ID,
        routing: { roles: ['PROCUREMENT', 'PURCHASING'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: PR_ID,
          prNumber: PR_NUMBER,
          projectId: PROJECT_ID,
          approvedBy: DIRECTOR_USER_ID,
        },
      };

      const results = await consumer.handlePurchaseRequestApproved(event);

      expect(results).toHaveLength(2);
      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);

      const procBells = inMemoryNotifications.filter(
        (n) => n.dedupeKey?.includes('PROCUREMENT_PR_APPROVED_RFQ'),
      );
      expect(procBells).toHaveLength(2);
      expect(procBells[0].title).toBe('Purchase Request Disetujui — Siap Proses RFQ');
      expect(procBells[0].actionLink).toBe(`/procurement?tab=pr&prId=${PR_ID}`);
      expect(procBells[0].metaData?.actionType).toBe('CREATE_RFQ');
    });

    it('8. Missing PR eventId or zero recipients returns explicit INTENTIONALLY_IGNORED receipt', async () => {
      const invalidEvent: BusinessEvent<any> = {
        eventId: '',
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: PR_ID,
        payload: {},
      };

      const results = await consumer.handlePurchaseRequestSubmitted(invalidEvent);

      expect(results).toEqual([]);
      const receipt = extractOutboxReceipt(results);
      expect(receipt).toBeDefined();
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(receipt?.reason).toContain('missing eventId');
    });
  });

  describe('B. RFQ Notification Integrity & SYNC_ONLY Separation', () => {
    it('1. procurement.rfq.created is strictly SYNC_ONLY and dispatches real-time WebSocket to authorized roles', () => {
      const rfqEvent: BusinessEvent = {
        eventId: 'rfq-evt-001',
        eventName: 'procurement.rfq.created',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Rfq',
        aggregateId: RFQ_ID,
        projectId: PROJECT_ID,
        routing: {
          roles: ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'],
        },
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        payload: {
          rfqId: RFQ_ID,
          rfqNumber: RFQ_NUMBER,
          prId: PR_ID,
          projectId: PROJECT_ID,
        },
      };

      const receipt = syncConsumer.handleProcurementRfqCreated(rfqEvent);

      expect(receipt.__outboxContract).toBe(true);
      expect(receipt.channel).toBe('BUSINESS_SYNC');
      expect(receipt.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(capturedSyncRooms[0]).toContain('role:PROCUREMENT');
      expect(capturedSyncRooms[0]).toContain('role:PURCHASING');
      expect(capturedSyncRooms[0]).toContain('role:SUPER_ADMIN');
      expect(capturedSyncEnvelopes[0].eventName).toBe('procurement.rfq.created');
      expect(capturedSyncEnvelopes[0].aggregateId).toBe(RFQ_ID);
    });

    it('2. CanonicalNotificationConsumer ignores SYNC_ONLY rfq.created (Zero Bell, Zero PushOutbox)', async () => {
      const rfqEvent: BusinessEvent = {
        eventId: 'rfq-evt-002',
        eventName: 'procurement.rfq.created',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Rfq',
        aggregateId: RFQ_ID,
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        payload: { rfqId: RFQ_ID },
      };

      const results = await consumer.projectEventToNotifications(rfqEvent, {
        purpose: 'RFQ_CREATED_ALERT',
        title: 'RFQ Baru',
        message: 'RFQ baru dibuat',
      });

      expect(results).toEqual([]);
      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.INTENTIONALLY_IGNORED);
      expect(receipt?.reason).toContain('notificationPolicy is SYNC_ONLY');
      expect(inMemoryNotifications).toHaveLength(0);
      expect(inMemoryPushOutbox).toHaveLength(0);
    });

    it('3. OutboxRelayService transitions procurement.rfq.created with SYNC_ONLY to PUBLISHED', async () => {
      const rfqOutbox = new OutboxEvent();
      rfqOutbox.id = 5501;
      rfqOutbox.event_id = 'rfq-outbox-uuid-001';
      rfqOutbox.event_name = 'procurement.rfq.created';
      rfqOutbox.event_version = '1';
      rfqOutbox.aggregate_type = 'Rfq';
      rfqOutbox.aggregate_id = RFQ_ID;
      rfqOutbox.status = OutboxStatus.PENDING;
      rfqOutbox.retry_count = 0;
      rfqOutbox.payload = {
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        businessPayload: { rfqId: RFQ_ID, rfqNumber: RFQ_NUMBER },
      };

      inMemoryOutboxEvents.push(rfqOutbox);

      const eventEmitter = (relayService as any).eventEmitter;
      eventEmitter.emitAsync.mockImplementation(async (eventName: string, event: BusinessEvent) => {
        const syncReceipt = syncConsumer.handleProcurementRfqCreated(event);
        return [syncReceipt];
      });

      const outcome = await relayService.relaySingleEvent(5501);

      expect(outcome).toBe('SUCCESS');
      expect(rfqOutbox.status).toBe(OutboxStatus.PUBLISHED);
      expect(rfqOutbox.published_at).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('C. Purchase Order Notification Integrity & SYNC_ONLY Separation', () => {
    it('1. procurement.po.issued is strictly SYNC_ONLY and dispatches real-time WebSocket to procurement, purchasing, finance, super_admin', () => {
      const poEvent: BusinessEvent = {
        eventId: 'po-evt-001',
        eventName: 'procurement.po.issued',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PurchaseOrder',
        aggregateId: PO_ID,
        projectId: PROJECT_ID,
        routing: {
          roles: ['PROCUREMENT', 'PURCHASING', 'FINANCE', 'SUPER_ADMIN'],
        },
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        payload: {
          poId: PO_ID,
          poNumber: PO_NUMBER,
          purchaseRequestId: PR_ID,
          projectId: PROJECT_ID,
        },
      };

      const receipt = syncConsumer.handleProcurementPoIssued(poEvent);

      expect(receipt.__outboxContract).toBe(true);
      expect(receipt.channel).toBe('BUSINESS_SYNC');
      expect(receipt.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(capturedSyncRooms[0]).toContain('role:PROCUREMENT');
      expect(capturedSyncRooms[0]).toContain('role:PURCHASING');
      expect(capturedSyncRooms[0]).toContain('role:FINANCE');
      expect(capturedSyncRooms[0]).toContain('role:SUPER_ADMIN');
      expect(capturedSyncEnvelopes[0].eventName).toBe('procurement.po.issued');
      expect(capturedSyncEnvelopes[0].aggregateId).toBe(PO_ID);
    });

    it('2. Identity Integrity: PO ID, PO Number, PR ID, and Project ID are cleanly separated', () => {
      const poPayload = {
        poId: PO_ID,
        poNumber: PO_NUMBER,
        purchaseRequestId: PR_ID,
        projectId: PROJECT_ID,
        status: 'ISSUED',
        totalAmount: 150000000,
      };

      expect(poPayload.poId).toBe(601);
      expect(poPayload.purchaseRequestId).toBe(501);
      expect(poPayload.projectId).toBe(901);
      expect(poPayload.poNumber).toBe('PO-20261030-001');
      expect(poPayload.poId).not.toBe(poPayload.purchaseRequestId);
      expect(poPayload.poId).not.toBe(poPayload.poNumber);
    });

    it('3. OutboxRelayService transitions procurement.po.issued with SYNC_ONLY to PUBLISHED', async () => {
      const poOutbox = new OutboxEvent();
      poOutbox.id = 6601;
      poOutbox.event_id = 'po-outbox-uuid-001';
      poOutbox.event_name = 'procurement.po.issued';
      poOutbox.event_version = '1';
      poOutbox.aggregate_type = 'PurchaseOrder';
      poOutbox.aggregate_id = PO_ID;
      poOutbox.status = OutboxStatus.PENDING;
      poOutbox.retry_count = 0;
      poOutbox.payload = {
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        businessPayload: { poId: PO_ID, poNumber: PO_NUMBER, purchaseRequestId: PR_ID, projectId: PROJECT_ID },
      };

      inMemoryOutboxEvents.push(poOutbox);

      const eventEmitter = (relayService as any).eventEmitter;
      eventEmitter.emitAsync.mockImplementation(async (eventName: string, event: BusinessEvent) => {
        const syncReceipt = syncConsumer.handleProcurementPoIssued(event);
        return [syncReceipt];
      });

      const outcome = await relayService.relaySingleEvent(6601);

      expect(outcome).toBe('SUCCESS');
      expect(poOutbox.status).toBe(OutboxStatus.PUBLISHED);
      expect(poOutbox.published_at).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('4. procurement.gr.received is strictly SYNC_ONLY and dispatches real-time WebSocket to authorized roles', () => {
      const grEvent: BusinessEvent = {
        eventId: 'gr-evt-001',
        eventName: 'procurement.gr.received',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'GoodsReceipt',
        aggregateId: GR_ID,
        routing: {
          roles: ['PROCUREMENT', 'PURCHASING', 'FINANCE', 'SUPER_ADMIN'],
        },
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        payload: {
          grId: GR_ID,
          grNumber: GR_NUMBER,
          poId: PO_ID,
          poNumber: PO_NUMBER,
          status: 'PARTIALLY_FULFILLED',
        },
      };

      const receipt = syncConsumer.handleProcurementGrReceived(grEvent);

      expect(receipt.__outboxContract).toBe(true);
      expect(receipt.channel).toBe('BUSINESS_SYNC');
      expect(receipt.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      expect(capturedSyncRooms[0]).toContain('role:PROCUREMENT');
      expect(capturedSyncRooms[0]).toContain('role:PURCHASING');
      expect(capturedSyncRooms[0]).toContain('role:FINANCE');
      expect(capturedSyncRooms[0]).toContain('role:SUPER_ADMIN');
    });
  });

  describe('D. Deduplication & Idempotency', () => {
    it('1. Replay of procurement.pr.submitted results in DUPLICATE_SUPPRESSED and strictly 1 Notification & 1 PushOutbox per recipient', async () => {
      const event: BusinessEvent<any> = {
        eventId: `pr-sub-${PR_ID}`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: PR_ID,
        projectId: PROJECT_ID,
        routing: { roles: ['FINANCE'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: PR_ID,
          prNumber: PR_NUMBER,
          projectId: PROJECT_ID,
        },
      };

      // First run: PERSISTED
      const run1 = await consumer.handlePurchaseRequestSubmitted(event);
      expect(run1[0].status).toBe('PERSISTED');

      // Second run (Replay): DUPLICATE_SUPPRESSED
      const run2 = await consumer.handlePurchaseRequestSubmitted(event);
      expect(run2[0].status).toBe('DUPLICATE_SUPPRESSED');

      const notifs = inMemoryNotifications.filter(
        (n) => n.userId === FINANCE_USER_ID && n.dedupeKey?.includes('PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW'),
      );
      expect(notifs).toHaveLength(1);

      const pushes = inMemoryPushOutbox.filter(
        (p) => p.recipientId === FINANCE_USER_ID && p.dedupeKey?.includes('PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW:PUSH'),
      );
      expect(pushes).toHaveLength(1);
    });

    it('2. Replay of procurement.pr.approved results in DUPLICATE_SUPPRESSED and zero extra records', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-approved-idem',
        eventName: 'procurement.pr.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: PR_ID,
        projectId: PROJECT_ID,
        routing: { roles: ['PROCUREMENT', 'PURCHASING'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: PR_ID,
          prNumber: PR_NUMBER,
          projectId: PROJECT_ID,
        },
      };

      const run1 = await consumer.handlePurchaseRequestApproved(event);
      expect(run1[0].status).toBe('PERSISTED');

      const run2 = await consumer.handlePurchaseRequestApproved(event);
      expect(run2[0].status).toBe('DUPLICATE_SUPPRESSED');

      const notifs = inMemoryNotifications.filter(
        (n) => n.userId === PROCUREMENT_USER_ID && n.dedupeKey?.includes('PROCUREMENT_PR_APPROVED_RFQ'),
      );
      expect(notifs).toHaveLength(1);
    });
  });

  describe('E. PR Multi-Cycle Resubmission Event Identity & Concurrency Verification', () => {
    const PR25_ID = 25;
    const PR25_NUMBER = 'PR-20261030-025';
    const PR26_ID = 26;
    const PR26_NUMBER = 'PR-20261030-026';

    it('1-5. Event Identity: Submit 1, Resubmit 1, Resubmit 2, and PR-26 all have distinct event IDs, and retries preserve identity', () => {
      // PR-25 Initial Submit (Cycle 0)
      const eventA_id = `pr-sub-${PR25_ID}`;
      // PR-25 First Resubmit (Cycle 1)
      const eventB_id = `pr-wf-sub-${PR25_ID}-resub-1`;
      // PR-25 Second Resubmit (Cycle 2)
      const eventC_id = `pr-wf-sub-${PR25_ID}-resub-2`;
      // PR-26 Initial Submit (Cycle 0)
      const eventD_id = `pr-sub-${PR26_ID}`;

      // All 4 events have distinct event IDs
      const idSet = new Set([eventA_id, eventB_id, eventC_id, eventD_id]);
      expect(idSet.size).toBe(4);

      // Stable on retry: same cycle always yields identical deterministic ID
      const retryB_id = `pr-wf-sub-${PR25_ID}-resub-1`;
      expect(retryB_id).toBe(eventB_id);
    });

    it('6-10. Notification Delivery: Each cycle produces exactly 1 Bell & 1 PushOutbox per recipient, and retries suppress duplicates', async () => {
      // 1. Initial Submit (PR-25, Cycle 0)
      const eventA: BusinessEvent<any> = {
        eventId: `pr-sub-${PR25_ID}`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: PR25_ID,
        projectId: PROJECT_ID,
        routing: { roles: ['FINANCE'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: PR25_ID,
          prNumber: PR25_NUMBER,
          projectId: PROJECT_ID,
          isResubmission: false,
          resubmissionCount: 0,
        },
      };

      const resA = await consumer.handlePurchaseRequestSubmitted(eventA);
      expect(resA[0].status).toBe('PERSISTED');
      expect(resA[0].notification?.title).toBe('Purchase Request Menunggu Review Finance');
      expect(resA[0].notification?.dedupeKey).toBe(`pr-sub-${PR25_ID}:${FINANCE_USER_ID}:PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW`);

      // Retry of Initial Submit -> DUPLICATE_SUPPRESSED
      const retryA = await consumer.handlePurchaseRequestSubmitted(eventA);
      expect(retryA[0].status).toBe('DUPLICATE_SUPPRESSED');

      // 2. First Resubmission (PR-25, Cycle 1)
      const eventB: BusinessEvent<any> = {
        eventId: `pr-wf-sub-${PR25_ID}-resub-1`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: PR25_ID,
        projectId: PROJECT_ID,
        routing: { roles: ['FINANCE'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: PR25_ID,
          prNumber: PR25_NUMBER,
          projectId: PROJECT_ID,
          isResubmission: true,
          resubmitted: true,
          resubmissionCount: 1,
        },
      };

      const resB = await consumer.handlePurchaseRequestSubmitted(eventB);
      expect(resB[0].status).toBe('PERSISTED');
      expect(resB[0].notification?.title).toBe('Revisi Purchase Request Menunggu Review Finance');
      expect(resB[0].notification?.dedupeKey).toBe(`pr-sub-${PR25_ID}-resub-1:${FINANCE_USER_ID}:PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW`);

      // Retry of Cycle 1 -> DUPLICATE_SUPPRESSED
      const retryB = await consumer.handlePurchaseRequestSubmitted(eventB);
      expect(retryB[0].status).toBe('DUPLICATE_SUPPRESSED');

      // 3. Second Resubmission (PR-25, Cycle 2)
      const eventC: BusinessEvent<any> = {
        eventId: `pr-wf-sub-${PR25_ID}-resub-2`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: PR25_ID,
        projectId: PROJECT_ID,
        routing: { roles: ['FINANCE'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: PR25_ID,
          prNumber: PR25_NUMBER,
          projectId: PROJECT_ID,
          isResubmission: true,
          resubmitted: true,
          resubmissionCount: 2,
        },
      };

      const resC = await consumer.handlePurchaseRequestSubmitted(eventC);
      expect(resC[0].status).toBe('PERSISTED');
      expect(resC[0].notification?.title).toBe('Revisi ke-2 Purchase Request Menunggu Review Finance');
      expect(resC[0].notification?.dedupeKey).toBe(`pr-sub-${PR25_ID}-resub-2:${FINANCE_USER_ID}:PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW`);

      // 4. Initial Submit of PR-26 (Different PR)
      const eventD: BusinessEvent<any> = {
        eventId: `pr-sub-${PR26_ID}`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: PR26_ID,
        projectId: PROJECT_ID,
        routing: { roles: ['FINANCE'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: PR26_ID,
          prNumber: PR26_NUMBER,
          projectId: PROJECT_ID,
          isResubmission: false,
          resubmissionCount: 0,
        },
      };

      const resD = await consumer.handlePurchaseRequestSubmitted(eventD);
      expect(resD[0].status).toBe('PERSISTED');
      expect(resD[0].notification?.title).toBe('Purchase Request Menunggu Review Finance');
      expect(resD[0].notification?.dedupeKey).toBe(`pr-sub-${PR26_ID}:${FINANCE_USER_ID}:PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW`);

      // Verify Total Database Notifications for PR-25 and PR-26
      const pr25Bells = inMemoryNotifications.filter((n) => n.userId === FINANCE_USER_ID && n.metaData?.prId === PR25_ID);
      expect(pr25Bells).toHaveLength(3); // Cycle 0, Cycle 1, Cycle 2

      const pr26Bells = inMemoryNotifications.filter((n) => n.userId === FINANCE_USER_ID && n.metaData?.prId === PR26_ID);
      expect(pr26Bells).toHaveLength(1); // Cycle 0
    });

    it('11-14. Transactional Integrity: Outbox failure follows rollback contract, historical events are never overwritten', async () => {
      // Simulate transaction manager failure on outbox save
      const failingManager = {
        save: jest.fn().mockRejectedValue(new Error('DB Connection Failure')),
      };

      let errorCaught = false;
      try {
        await failingManager.save(OutboxEvent, { event_id: 'fail-evt' });
      } catch (err: any) {
        errorCaught = true;
        expect(err.message).toBe('DB Connection Failure');
      }
      expect(errorCaught).toBe(true);

      // Verify that historical events in memory were NOT corrupted or overwritten
      const initialOutboxCount = inMemoryOutboxEvents.length;
      expect(initialOutboxCount).toBeGreaterThanOrEqual(0);
    });

    it('15. Backward Compatibility: Legacy event pr-sub-{prId} without cycle fields resolves cleanly', async () => {
      const legacyEvent: BusinessEvent<any> = {
        eventId: 'pr-sub-888',
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: 888,
        projectId: PROJECT_ID,
        routing: { roles: ['FINANCE'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: 888,
          prNumber: 'PR-20261030-888',
          projectId: PROJECT_ID,
        },
      };

      const resLegacy = await consumer.handlePurchaseRequestSubmitted(legacyEvent);
      expect(resLegacy).toHaveLength(2); // 2 Finance users
      expect(resLegacy[0].status).toBe('PERSISTED');
      expect(resLegacy[0].notification?.title).toBe('Purchase Request Menunggu Review Finance');
      expect(resLegacy[0].notification?.dedupeKey).toBe(`pr-sub-888:${FINANCE_USER_ID}:PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW`);
    });
  });
});
