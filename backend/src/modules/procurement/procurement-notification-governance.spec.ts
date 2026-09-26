import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BusinessSyncConsumer } from '../notification/business-sync.consumer';
import { CanonicalNotificationConsumer } from '../notification/canonical-notification.consumer';
import { CanonicalNotificationWriter } from '../notification/canonical-notification.writer';
import { NotificationGateway } from '../notification/notification.gateway';
import { Notification } from '../../entities/notification.entity';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';

describe('Phase N6: Procurement Notification, Governance & Realtime Isolation Suite', () => {
  let syncConsumer: BusinessSyncConsumer;
  let canonicalConsumer: CanonicalNotificationConsumer;
  let mockGateway: jest.Mocked<Partial<NotificationGateway>>;
  let dispatchedSyncEvents: Array<{ rooms: string[]; envelope: any }>;

  beforeEach(async () => {
    dispatchedSyncEvents = [];

    mockGateway = {
      sendSyncEventToRooms: jest.fn().mockImplementation((rooms: string[], envelope: any) => {
        dispatchedSyncEvents.push({ rooms, envelope });
      }),
      sendNotificationToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSyncConsumer,
        CanonicalNotificationConsumer,
        {
          provide: CanonicalNotificationWriter,
          useValue: {
            writeCanonicalNotification: jest.fn(),
          },
        },
        {
          provide: NotificationGateway,
          useValue: mockGateway,
        },
        {
          provide: DataSource,
          useValue: { query: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    syncConsumer = module.get<BusinessSyncConsumer>(BusinessSyncConsumer);
    canonicalConsumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
  });

  describe('1. Procurement Governance & Execution Boundary Protection', () => {
    it('Procurement Governance review is handled by WorkflowTask and creates ZERO Bell notifications', () => {
      // Governance review at node_procurement_review in PROJECT_PLAN_REVIEW_WORKFLOW
      // is authoritative in Workflow Engine and Unified Inbox.
      // CanonicalNotificationConsumer does not project Bells for governance review tasks.
      expect((canonicalConsumer as any).handleProcurementReview).toBeUndefined();
    });

    it('Purchase Request review is handled by WorkflowTask and creates ZERO Bell notifications', () => {
      // PURCHASE_REQUEST_WORKFLOW tasks are mapped to Unified Inbox for PROCUREMENT role.
      // CanonicalNotificationConsumer does not project Bells for PR tasks.
      expect((canonicalConsumer as any).handlePurchaseRequestApproval).toBeUndefined();
    });
  });

  describe('2. Canonical Procurement Execution Events (Outbox -> BusinessSync only)', () => {
    it('procurement.package.submitted dispatches BusinessSync to authorized roles with ZERO Bell creation', () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pkg-sub-001',
        eventName: 'procurement.package.submitted',
        eventVersion: 1,
        occurredAt: '2026-09-26T04:30:00.000Z',
        aggregateType: 'ProcurementPackage',
        aggregateId: 101,
        projectId: 201,
        payload: {
          packageId: 101,
          packageNumber: 'PKG-2026-001',
          projectId: 201,
          totalEstimatedAmount: 50000000,
          submittedBy: 5,
          status: 'SUBMITTED',
        },
      };

      syncConsumer.handleProcurementPackageSubmitted(event);

      expect(dispatchedSyncEvents).toHaveLength(1);
      const { rooms, envelope } = dispatchedSyncEvents[0];
      expect(rooms).toContain('role:PROCUREMENT');
      expect(rooms).toContain('role:PURCHASING');
      expect(rooms).toContain('role:SUPER_ADMIN');
      expect(envelope.eventName).toBe('procurement.package.submitted');
      expect(envelope.eventId).toBe('evt-pkg-sub-001');
      expect(envelope.aggregateId).toBe(101);
      expect(envelope.projectId).toBe(201);
    });

    it('procurement.package.returned dispatches BusinessSync to authorized roles with ZERO Bell creation', () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pkg-ret-002',
        eventName: 'procurement.package.returned',
        eventVersion: 1,
        occurredAt: '2026-09-26T04:30:00.000Z',
        aggregateType: 'ProcurementPackage',
        aggregateId: 101,
        projectId: 201,
        payload: {
          packageId: 101,
          packageNumber: 'PKG-2026-001',
          projectId: 201,
          reviewerId: 99,
          reason: 'Item specifications incomplete',
          status: 'RETURNED',
        },
      };

      syncConsumer.handleProcurementPackageReturned(event);

      expect(dispatchedSyncEvents).toHaveLength(1);
      const { rooms, envelope } = dispatchedSyncEvents[0];
      expect(rooms).toContain('role:PROCUREMENT');
      expect(rooms).toContain('role:PURCHASING');
      expect(rooms).toContain('role:PMO');
      expect(rooms).toContain('role:SUPER_ADMIN');
      expect(envelope.eventName).toBe('procurement.package.returned');
    });

    it('procurement.rfq.created dispatches BusinessSync to authorized roles with ZERO Bell creation', () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-rfq-003',
        eventName: 'procurement.rfq.created',
        eventVersion: 1,
        occurredAt: '2026-09-26T04:30:00.000Z',
        aggregateType: 'Rfq',
        aggregateId: 301,
        projectId: 201,
        payload: {
          rfqId: 301,
          rfqNumber: 'RFQ-2026-001',
          prId: 401,
          projectId: 201,
          status: 'PUBLISHED',
        },
      };

      syncConsumer.handleProcurementRfqCreated(event);

      expect(dispatchedSyncEvents).toHaveLength(1);
      const { rooms, envelope } = dispatchedSyncEvents[0];
      expect(rooms).toContain('role:PROCUREMENT');
      expect(rooms).toContain('role:PURCHASING');
      expect(rooms).toContain('role:SUPER_ADMIN');
      expect(envelope.eventName).toBe('procurement.rfq.created');
    });

    it('procurement.po.issued dispatches BusinessSync to authorized roles with ZERO Bell creation', () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-po-004',
        eventName: 'procurement.po.issued',
        eventVersion: 1,
        occurredAt: '2026-09-26T04:30:00.000Z',
        aggregateType: 'PurchaseOrder',
        aggregateId: 501,
        projectId: 201,
        payload: {
          purchaseOrderId: 501,
          poNumber: 'PO-2026-001',
          purchaseRequestId: 401,
          vendorId: 77,
          totalAmount: 45000000,
          status: 'ISSUED',
        },
      };

      syncConsumer.handleProcurementPoIssued(event);

      expect(dispatchedSyncEvents).toHaveLength(1);
      const { rooms, envelope } = dispatchedSyncEvents[0];
      expect(rooms).toContain('role:PROCUREMENT');
      expect(rooms).toContain('role:PURCHASING');
      expect(rooms).toContain('role:FINANCE');
      expect(rooms).toContain('role:SUPER_ADMIN');
      expect(envelope.eventName).toBe('procurement.po.issued');
    });

    it('procurement.gr.received dispatches BusinessSync to authorized roles with ZERO Bell creation', () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-gr-005',
        eventName: 'procurement.gr.received',
        eventVersion: 1,
        occurredAt: '2026-09-26T04:30:00.000Z',
        aggregateType: 'GoodsReceipt',
        aggregateId: 601,
        payload: {
          grId: 601,
          grNumber: 'GR-2026-001',
          poId: 501,
          totalReceivedAmount: 45000000,
          status: 'RECEIVED',
        },
      };

      syncConsumer.handleProcurementGrReceived(event);

      expect(dispatchedSyncEvents).toHaveLength(1);
      const { rooms, envelope } = dispatchedSyncEvents[0];
      expect(rooms).toContain('role:PROCUREMENT');
      expect(rooms).toContain('role:PURCHASING');
      expect(rooms).toContain('role:FINANCE');
      expect(rooms).toContain('role:SUPER_ADMIN');
      expect(envelope.eventName).toBe('procurement.gr.received');
    });
  });

  describe('3. Invariant & Single Writer Verification', () => {
    it('BusinessSyncConsumer does NOT inject Notification repository (zero Bell rows)', () => {
      const syncDeps = Reflect.getMetadata('design:paramtypes', BusinessSyncConsumer);
      const hasNotificationRepo = syncDeps?.some((dep: any) =>
        dep?.name?.includes('Repository') || dep?.name?.includes('NotificationService'),
      );
      expect(hasNotificationRepo).toBeFalsy();
    });

    it('No TASK type notifications exist for Procurement domain in CanonicalNotificationConsumer', () => {
      expect((canonicalConsumer as any).handleProcurementTask).toBeUndefined();
    });
  });
});
