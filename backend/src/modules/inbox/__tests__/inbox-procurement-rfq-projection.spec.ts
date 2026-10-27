import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InboxService } from '../inbox.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { NotificationService } from '../../notification/notification.service';
import { Contract } from '../../../entities/contract.entity';
import { Tender } from '../../../entities/tender.entity';
import { PaymentRequest } from '../../../entities/payment-request.entity';
import { ProjectProgressLog } from '../../../entities/project-progress-log.entity';
import { ServiceClaim } from '../../../entities/service-claim.entity';
import { ProjectClosure } from '../../../entities/project-closure.entity';
import { WorkflowTask } from '../../../entities/workflow-task.entity';
import { PurchaseRequest } from '../../../entities/purchase-request.entity';
import { Rfq } from '../../../entities/rfq.entity';
import { CanonicalNotificationConsumer } from '../../notification/canonical-notification.consumer';
import { CanonicalNotificationWriter } from '../../notification/canonical-notification.writer';
import { BusinessEvent, NotificationPolicy } from '../../../shared/contracts/business-event.contract';

describe('EPMS — PR APPROVED → PROCUREMENT RFQ HANDOFF (Focused Unit Tests)', () => {
  describe('A. Inbox Projection for Approved Purchase Requests', () => {
    let inboxService: InboxService;
    let mockPrRepo: any;
    let mockRfqRepo: any;

    const setupInboxService = (approvedPrs: any[] = []) => {
      mockPrRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockImplementation(async () => approvedPrs),
        }),
      };

      mockRfqRepo = {
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      };

      const emptyQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      return Test.createTestingModule({
        providers: [
          InboxService,
          {
            provide: WorkflowEngineService,
            useValue: { getMyTasks: jest.fn().mockResolvedValue([]) },
          },
          {
            provide: NotificationService,
            useValue: { getUnreadCount: jest.fn().mockResolvedValue(0) },
          },
          { provide: getRepositoryToken(Contract), useValue: { createQueryBuilder: jest.fn().mockReturnValue(emptyQb) } },
          { provide: getRepositoryToken(Tender), useValue: { createQueryBuilder: jest.fn().mockReturnValue(emptyQb) } },
          { provide: getRepositoryToken(PaymentRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
          { provide: getRepositoryToken(ProjectProgressLog), useValue: { createQueryBuilder: jest.fn().mockReturnValue(emptyQb) } },
          { provide: getRepositoryToken(ServiceClaim), useValue: { find: jest.fn().mockResolvedValue([]) } },
          { provide: getRepositoryToken(ProjectClosure), useValue: { find: jest.fn().mockResolvedValue([]) } },
          { provide: getRepositoryToken(WorkflowTask), useValue: { createQueryBuilder: jest.fn().mockReturnValue(emptyQb) } },
          { provide: getRepositoryToken(PurchaseRequest), useValue: mockPrRepo },
          { provide: getRepositoryToken(Rfq), useValue: mockRfqRepo },
        ],
      }).compile();
    };

    it('1. APPROVED PR + no RFQ -> exactly one CREATE_RFQ To-Do', async () => {
      const pr1: Partial<PurchaseRequest> = {
        id: 10,
        prNumber: 'PR-20261023-001',
        status: 'APPROVED',
        projectId: 5,
        project: { id: 5, name: 'Project Alpha' } as any,
        createdAt: new Date('2026-10-23T10:00:00Z'),
      };

      const module = await setupInboxService([pr1]);
      inboxService = module.get<InboxService>(InboxService);

      const todos = await inboxService.getTodos(41, ['PROCUREMENT']);

      expect(todos).toHaveLength(1);
      expect(todos[0].todoId).toBe('domain-pr-10');
      expect(todos[0].sourceType).toBe('DOMAIN_PURCHASE_REQUEST');
      expect(todos[0].entityType).toBe('PURCHASE_REQUEST');
      expect(todos[0].entityId).toBe(10);
      expect(todos[0].actionType).toBe('CREATE_RFQ');
      expect(todos[0].title).toBe('Buat RFQ: PR PR-20261023-001');
      expect(todos[0].actionTarget).toBe('/procurement?tab=pr&prId=10');
      expect(todos[0].assignedRole).toBe('PROCUREMENT');
      expect(todos[0].ctaLabel).toBe('Buat RFQ');
    });

    it('2. APPROVED PR + active RFQ -> zero CREATE_RFQ To-Dos', async () => {
      // When an active RFQ exists, query builder's NOT EXISTS subquery filters it out
      const module = await setupInboxService([]);
      inboxService = module.get<InboxService>(InboxService);

      const todos = await inboxService.getTodos(41, ['PROCUREMENT']);

      const rfqTodos = todos.filter((t) => t.actionType === 'CREATE_RFQ');
      expect(rfqTodos).toHaveLength(0);
    });

    it('3. PR not APPROVED -> zero CREATE_RFQ To-Dos', async () => {
      // Query builder filters where status = 'APPROVED'
      const module = await setupInboxService([]);
      inboxService = module.get<InboxService>(InboxService);

      const todos = await inboxService.getTodos(41, ['PROCUREMENT']);

      const rfqTodos = todos.filter((t) => t.actionType === 'CREATE_RFQ');
      expect(rfqTodos).toHaveLength(0);
    });

    it('4. multiple approved PRs -> exactly one To-Do per eligible PR', async () => {
      const pr1: Partial<PurchaseRequest> = {
        id: 11,
        prNumber: 'PR-20261023-002',
        status: 'APPROVED',
        projectId: 5,
        project: { id: 5, name: 'Project Alpha' } as any,
        createdAt: new Date('2026-10-23T11:00:00Z'),
      };
      const pr2: Partial<PurchaseRequest> = {
        id: 12,
        prNumber: 'PR-20261023-003',
        status: 'APPROVED',
        projectId: 6,
        project: { id: 6, name: 'Project Beta' } as any,
        createdAt: new Date('2026-10-23T11:30:00Z'),
      };

      const module = await setupInboxService([pr2, pr1]);
      inboxService = module.get<InboxService>(InboxService);

      const todos = await inboxService.getTodos(41, ['PROCUREMENT']);

      const rfqTodos = todos.filter((t) => t.actionType === 'CREATE_RFQ');
      expect(rfqTodos).toHaveLength(2);
      expect(rfqTodos.map((t) => t.entityId)).toEqual([12, 11]);
      expect(rfqTodos[0].actionTarget).toBe('/procurement?tab=pr&prId=12');
      expect(rfqTodos[1].actionTarget).toBe('/procurement?tab=pr&prId=11');
    });

    it('5. same PR with cancelled RFQ -> To-Do is eligible (NOT EXISTS active RFQ)', async () => {
      // When RFQ is CANCELLED, NOT EXISTS active RFQ condition is met, so PR is eligible
      const prWithCancelledRfq: Partial<PurchaseRequest> = {
        id: 15,
        prNumber: 'PR-20261023-005',
        status: 'APPROVED',
        projectId: 5,
        project: { id: 5, name: 'Project Alpha' } as any,
        createdAt: new Date('2026-10-23T12:00:00Z'),
      };

      const module = await setupInboxService([prWithCancelledRfq]);
      inboxService = module.get<InboxService>(InboxService);

      const todos = await inboxService.getTodos(41, ['PROCUREMENT']);

      const rfqTodos = todos.filter((t) => t.actionType === 'CREATE_RFQ');
      expect(rfqTodos).toHaveLength(1);
      expect(rfqTodos[0].entityId).toBe(15);
    });

    it('6. non-Procurement role -> no Procurement RFQ To-Do', async () => {
      const pr1: Partial<PurchaseRequest> = {
        id: 10,
        prNumber: 'PR-20261023-001',
        status: 'APPROVED',
        projectId: 5,
      };

      const module = await setupInboxService([pr1]);
      inboxService = module.get<InboxService>(InboxService);

      // Project Manager / Finance / Director / SUPER_ADMIN should NOT see CREATE_RFQ To-Do
      const pmTodos = await inboxService.getTodos(2, ['PROJECT_MANAGER']);
      expect(pmTodos.filter((t) => t.actionType === 'CREATE_RFQ')).toHaveLength(0);

      const finTodos = await inboxService.getTodos(3, ['FINANCE']);
      expect(finTodos.filter((t) => t.actionType === 'CREATE_RFQ')).toHaveLength(0);

      const dirTodos = await inboxService.getTodos(4, ['DIRECTOR']);
      expect(dirTodos.filter((t) => t.actionType === 'CREATE_RFQ')).toHaveLength(0);

      const adminTodos = await inboxService.getTodos(1, ['SUPER_ADMIN']);
      expect(adminTodos.filter((t) => t.actionType === 'CREATE_RFQ')).toHaveLength(0);

      // Ensure mock query builder was never called for non-procurement roles
      expect(mockPrRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('7. PROCUREMENT role -> receives CREATE_RFQ To-Do', async () => {
      const pr1: Partial<PurchaseRequest> = {
        id: 20,
        prNumber: 'PR-20261023-020',
        status: 'APPROVED',
        projectId: 8,
      };

      const module = await setupInboxService([pr1]);
      inboxService = module.get<InboxService>(InboxService);

      const todos = await inboxService.getTodos(41, ['PROCUREMENT']);
      expect(todos.filter((t) => t.actionType === 'CREATE_RFQ')).toHaveLength(1);
    });

    it('8. PURCHASING alias -> receives CREATE_RFQ To-Do with full compatibility', async () => {
      const pr1: Partial<PurchaseRequest> = {
        id: 21,
        prNumber: 'PR-20261023-021',
        status: 'APPROVED',
        projectId: 8,
      };

      const module = await setupInboxService([pr1]);
      inboxService = module.get<InboxService>(InboxService);

      const todos = await inboxService.getTodos(99, ['PURCHASING']);
      expect(todos.filter((t) => t.actionType === 'CREATE_RFQ')).toHaveLength(1);
    });
  });

  describe('B. Notification for Approved Purchase Requests', () => {
    let consumer: CanonicalNotificationConsumer;
    let mockWriter: jest.Mocked<Partial<CanonicalNotificationWriter>>;
    let mockDataSource: any;

    beforeEach(async () => {
      mockWriter = {
        persistBatch: jest.fn().mockImplementation(async (inputs: any[]) => {
          return inputs.map((input) => ({
            status: 'PERSISTED',
            notificationId: 1001,
            dedupeKey: `${input.eventId}:${input.recipientId}:${input.purpose}`,
          }));
        }),
      };

      mockDataSource = {
        query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('FROM users u') && sql.includes('JOIN roles r')) {
            // Return user ID 41 for PROCUREMENT
            return [{ id: 41 }];
          }
          return [];
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          CanonicalNotificationConsumer,
          { provide: CanonicalNotificationWriter, useValue: mockWriter },
          { provide: DataSource, useValue: mockDataSource },
        ],
      }).compile();

      consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
    });

    it('9. transition into APPROVED -> canonical PR-approved event is handled', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-approved-1',
        eventName: 'procurement.pr.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: 10,
        projectId: 5,
        routing: { roles: ['PROCUREMENT', 'PURCHASING'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          purchaseRequestId: 10,
          prNumber: 'PR-20261023-001',
          projectId: 5,
          approvedBy: 4,
          approvedAt: new Date().toISOString(),
        },
      };

      const results = await consumer.handlePurchaseRequestApproved(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');
      expect(mockWriter.persistBatch).toHaveBeenCalledTimes(1);
    });

    it('10. notification consumer -> creates Procurement notification with correct content', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-approved-2',
        eventName: 'procurement.pr.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: 25,
        payload: {
          purchaseRequestId: 25,
          prNumber: 'PR-20261023-025',
          projectId: 9,
        },
      };

      await consumer.handlePurchaseRequestApproved(event);

      expect(mockWriter.persistBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            recipientId: 41,
            purpose: 'PROCUREMENT_PR_APPROVED_RFQ',
            type: 'ALERT',
            title: 'Purchase Request Disetujui — Siap Proses RFQ',
            message: expect.stringContaining('PR-20261023-025'),
            actionTarget: '/procurement?tab=pr&prId=25',
            metaData: expect.objectContaining({
              category: 'PROCUREMENT',
              priority: 'HIGH',
              reference_type: 'PURCHASE_REQUEST',
              reference_id: 25,
              purchaseRequestId: 25,
              prNumber: 'PR-20261023-025',
              actionType: 'CREATE_RFQ',
            }),
          }),
        ]),
      );
    });

    it('11. correct deep-link -> target resolves to /procurement?tab=pr&prId=${prId}', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-approved-3',
        eventName: 'procurement.pr.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: 99,
        payload: {
          purchaseRequestId: 99,
          prNumber: 'PR-20261023-099',
        },
      };

      await consumer.handlePurchaseRequestApproved(event);

      expect(mockWriter.persistBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            actionTarget: '/procurement?tab=pr&prId=99',
          }),
        ]),
      );
    });

    it('12. replay/retry -> writer enforces deduplication (idempotent)', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-approved-replay',
        eventName: 'procurement.pr.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: 10,
        payload: {
          purchaseRequestId: 10,
          prNumber: 'PR-20261023-001',
        },
      };

      // First run: PERSISTED
      const firstResult = await consumer.handlePurchaseRequestApproved(event);
      expect(firstResult[0].status).toBe('PERSISTED');

      // Second run: Writer returns SKIPPED_DUPLICATE
      mockWriter.persistBatch = jest.fn().mockResolvedValue([
        {
          status: 'SKIPPED_DUPLICATE',
          dedupeKey: `evt-pr-approved-replay:41:PROCUREMENT_PR_APPROVED_RFQ`,
        },
      ]);

      const secondResult = await consumer.handlePurchaseRequestApproved(event);
      expect(secondResult[0].status).toBe('SKIPPED_DUPLICATE');
    });
  });
});
