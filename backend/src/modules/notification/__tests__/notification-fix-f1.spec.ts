import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Notification } from '../../../entities/notification.entity';
import { NotificationGateway } from '../notification.gateway';
import { CanonicalNotificationWriter } from '../canonical-notification.writer';
import { CanonicalNotificationConsumer } from '../canonical-notification.consumer';
import { BusinessEvent, NotificationPolicy } from '../../../shared/contracts/business-event.contract';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../../entities/workflow-instance.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../../entities/workflow-transition.entity';
import { WorkflowVersion } from '../../../entities/workflow-version.entity';
import { PurchaseRequest } from '../../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../../entities/purchase-request-item.entity';
import { AuditLog } from '../../../entities/audit-log.entity';
import { OutboxEvent } from '../../../entities/outbox-event.entity';
import { Role } from '../../../entities/role.entity';
import { ProcurementService } from '../../procurement/procurement.service';

describe('EPMS — Notification Fix F1: Project Closure, Purchase Request & Service Claim Specs', () => {
  let consumer: CanonicalNotificationConsumer;
  let writer: CanonicalNotificationWriter;
  let inMemoryNotifications: Notification[];
  let socketPushes: Array<{ userId: number; notification: any }>;
  let mockDataSource: any;

  beforeEach(async () => {
    inMemoryNotifications = [];
    socketPushes = [];

    const mockNotificationRepo = {
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

    const mockGateway = {
      sendNotificationToUser: jest.fn().mockImplementation((userId: number, notif: any) => {
        socketPushes.push({ userId, notification: notif });
      }),
      sendSyncEventToRooms: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
        // Resolve PM for project
        if (sql.includes('SELECT manager_id') && sql.includes('FROM projects')) {
          const projectId = params[0];
          if (projectId === 10) return [{ manager_id: 2 }]; // PM user ID 2
          return [];
        }
        // Resolve project name
        if (sql.includes('SELECT name FROM projects')) {
          return [{ name: 'Proyek Migrasi UBD' }];
        }
        // Resolve role users
        if (sql.includes('FROM users u') && sql.includes('JOIN user_roles ur')) {
          const roleParams = params && params[0] ? (Array.isArray(params[0]) ? params[0] : [params[0]]) : [];
          if (roleParams.includes('FINANCE') || sql.includes('FINANCE')) {
            return [{ id: 3 }]; // Finance user ID 3
          }
          if (roleParams.includes('PROCUREMENT') || roleParams.includes('PURCHASING')) {
            return [{ id: 41 }]; // Procurement user ID 41
          }
        }
        return [];
      }),
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
          useValue: { add: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);
    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
  });

  describe('1. Project Closure — Recipient Inversion Fix', () => {
    it('Project Closure Approved: PM is the recipient, NOT Director (actorId)', async () => {
      const directorUserId = 4;
      const pmUserId = 2;

      const event: BusinessEvent<any> = {
        eventId: 'evt-closure-app-001',
        eventName: 'project.closure.director.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectClosure',
        aggregateId: 100,
        actor: { userId: directorUserId },
        payload: {
          businessPayload: {
            projectId: 10,
            closureId: 100,
            actorId: directorUserId, // Actor who approved
            actorRole: 'DIRECTOR',
            projectManagerId: pmUserId, // Project Manager
          },
        },
      };

      const results = await consumer.handleProjectClosureApproved(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      // Verify recipient in saved notifications
      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(pmUserId); // PM received it
      expect(inMemoryNotifications[0].userId).not.toBe(directorUserId); // Director did NOT receive it
      expect(inMemoryNotifications[0].title).toBe('Penutupan Proyek Disetujui');
      expect(inMemoryNotifications[0].actionLink).toContain('/project-delivery');
    });

    it('Project Closure Approved: Fallback to database resolution if projectManagerId not in payload', async () => {
      const directorUserId = 4;
      const pmUserId = 2;

      const event: BusinessEvent<any> = {
        eventId: 'evt-closure-app-002',
        eventName: 'project.closure.director.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectClosure',
        aggregateId: 101,
        actor: { userId: directorUserId },
        payload: {
          businessPayload: {
            projectId: 10,
            closureId: 101,
            actorId: directorUserId, // Actor who approved
            // projectManagerId omitted to test DB query fallback
          },
        },
      };

      const results = await consumer.handleProjectClosureApproved(event);

      expect(results).toHaveLength(1);
      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(pmUserId); // Resolved from DB: projects.manager_id
      expect(inMemoryNotifications[0].userId).not.toBe(directorUserId);
    });

    it('Project Closure Returned: PM is the recipient, NOT Reviewer/Director (actorId)', async () => {
      const reviewerUserId = 7; // Head of Ops
      const pmUserId = 2;

      const event: BusinessEvent<any> = {
        eventId: 'evt-closure-ret-001',
        eventName: 'project.closure.hoo.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectClosure',
        aggregateId: 102,
        actor: { userId: reviewerUserId },
        payload: {
          businessPayload: {
            projectId: 10,
            closureId: 102,
            actorId: reviewerUserId,
            actorRole: 'HEAD_OF_OPERATIONS',
            projectManagerId: pmUserId,
            returnReason: 'Laporan keuangan akhir belum lengkap',
          },
        },
      };

      const results = await consumer.handleProjectClosureReturned(event);

      expect(results).toHaveLength(1);
      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(pmUserId);
      expect(inMemoryNotifications[0].userId).not.toBe(reviewerUserId);
      expect(inMemoryNotifications[0].title).toBe('Pengajuan Penutupan Proyek Dikembalikan');
    });

    it('Project Closure Returned: Idempotent deduplication on retry', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-closure-ret-dedupe',
        eventName: 'project.closure.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectClosure',
        aggregateId: 103,
        payload: {
          businessPayload: {
            projectId: 10,
            closureId: 103,
            actorId: 4,
            projectManagerId: 2,
          },
        },
      };

      const firstPass = await consumer.handleProjectClosureReturned(event);
      expect(firstPass).toHaveLength(1);
      expect(firstPass[0].status).toBe('PERSISTED');

      const retryPass = await consumer.handleProjectClosureReturned(event);
      expect(retryPass).toHaveLength(1);
      expect(retryPass[0].status).toBe('DUPLICATE_SUPPRESSED');
    });
  });

  describe('2. Purchase Request — Submission Notification Gap Fix', () => {
    it('PR Submitted: Finance role user receives notification with valid deep link', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-sub-001',
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: 50,
        projectId: 10,
        routing: { roles: ['FINANCE'] },
        payload: {
          businessPayload: {
            purchaseRequestId: 50,
            prNumber: 'PR-20261029-001',
            projectId: 10,
            submittedBy: 2,
            totalEstimatedAmount: 75000000,
          },
        },
      };

      const results = await consumer.handlePurchaseRequestSubmitted(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      // Verify recipient is Finance (user ID 3)
      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(3);
      expect(inMemoryNotifications[0].title).toBe('Purchase Request Menunggu Review Finance');
      expect(inMemoryNotifications[0].message).toContain('PR-20261029-001');
      expect(inMemoryNotifications[0].actionLink).toBe('/procurement?tab=pr&prId=50');
      expect(inMemoryNotifications[0].notificationType).toBe('ALERT');
    });

    it('PR Submitted: Idempotent deduplication on retry', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pr-sub-dedupe',
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: 51,
        payload: {
          purchaseRequestId: 51,
          prNumber: 'PR-20261029-002',
        },
      };

      const pass1 = await consumer.handlePurchaseRequestSubmitted(event);
      expect(pass1[0].status).toBe('PERSISTED');

      const pass2 = await consumer.handlePurchaseRequestSubmitted(event);
      expect(pass2[0].status).toBe('DUPLICATE_SUPPRESSED');
    });

    it('PR Submitted: Dual producer safety — WorkflowEngine and ProcurementService events for same PR produce exactly 1 notification', async () => {
      const prId = 60;
      const prNumber = 'PR-20261029-060';

      // 1. First event arrives from ProcurementService (with its own eventId)
      const eventFromProcurement: BusinessEvent<any> = {
        eventId: `pr-sub-${prId}`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: prId,
        projectId: 10,
        routing: { roles: ['FINANCE'] },
        payload: {
          purchaseRequestId: prId,
          prNumber,
          projectId: 10,
          submittedBy: 2,
        },
      };

      const result1 = await consumer.handlePurchaseRequestSubmitted(eventFromProcurement);
      expect(result1).toHaveLength(1);
      expect(result1[0].status).toBe('PERSISTED');

      // 2. Second event arrives from WorkflowEngineService (with different eventId and payload.workflowInstanceId)
      const eventFromWorkflow: BusinessEvent<any> = {
        eventId: `pr-wf-sub-${prId}`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: prId,
        projectId: 10,
        routing: { roles: ['FINANCE'] },
        payload: {
          purchaseRequestId: prId,
          prNumber,
          projectId: 10,
          workflowInstanceId: 44,
          submittedBy: 2,
        },
      };

      const result2 = await consumer.handlePurchaseRequestSubmitted(eventFromWorkflow);
      expect(result2).toHaveLength(1);
      // Validated: Must be suppressed as duplicate because stable identity 'pr-sub-60' was used!
      expect(result2[0].status).toBe('DUPLICATE_SUPPRESSED');

      // Exactly ONE notification exists in database for this PR
      const financeNotifs = inMemoryNotifications.filter(
        (n) => n.userId === 3 && n.dedupeKey?.includes(`pr-sub-${prId}`),
      );
      expect(financeNotifs).toHaveLength(1);
      expect(financeNotifs[0].title).toBe('Purchase Request Menunggu Review Finance');
    });

    it('PR Submitted: Different event IDs with same PR ID are safely deduplicated via stable business identity', async () => {
      const prId = 70;

      // Event with random UUID #1
      const event1: BusinessEvent<any> = {
        eventId: 'random-uuid-1111-aaaa',
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: prId,
        payload: {
          purchaseRequestId: prId,
          prNumber: `PR-${prId}`,
        },
      };

      const res1 = await consumer.handlePurchaseRequestSubmitted(event1);
      expect(res1[0].status).toBe('PERSISTED');

      // Event with random UUID #2 for same PR
      const event2: BusinessEvent<any> = {
        eventId: 'random-uuid-2222-bbbb',
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: prId,
        payload: {
          purchaseRequestId: prId,
          prNumber: `PR-${prId}`,
        },
      };

      const res2 = await consumer.handlePurchaseRequestSubmitted(event2);
      // Validated: Despite having completely different eventId UUIDs, stable business identity collapses into DUPLICATE_SUPPRESSED
      expect(res2[0].status).toBe('DUPLICATE_SUPPRESSED');

      const notifsForPr70 = inMemoryNotifications.filter(
        (n) => n.userId === 3 && n.dedupeKey?.includes(`pr-sub-${prId}`),
      );
      expect(notifsForPr70).toHaveLength(1);
    });

    it('PR Submitted: Resubmission after revision creates a distinct notification for Finance review', async () => {
      const prId = 80;

      // 1. Initial submission
      const initialEvent: BusinessEvent<any> = {
        eventId: 'pr-sub-80',
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: prId,
        payload: {
          purchaseRequestId: prId,
          prNumber: `PR-${prId}`,
        },
      };
      const initialRes = await consumer.handlePurchaseRequestSubmitted(initialEvent);
      expect(initialRes[0].status).toBe('PERSISTED');

      // 2. Resubmission after revision (isResubmission: true)
      const resubEvent: BusinessEvent<any> = {
        eventId: 'pr-sub-80-resub',
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: prId,
        payload: {
          purchaseRequestId: prId,
          prNumber: `PR-${prId}`,
          isResubmission: true,
        },
      };
      const resubRes = await consumer.handlePurchaseRequestSubmitted(resubEvent);
      expect(resubRes[0].status).toBe('PERSISTED');

      // Both notifications exist with distinct titles
      const pr80Notifs = inMemoryNotifications.filter(
        (n) => n.userId === 3 && n.dedupeKey?.includes(`pr-sub-${prId}`),
      );
      expect(pr80Notifs).toHaveLength(2);
      expect(pr80Notifs[0].title).toBe('Purchase Request Menunggu Review Finance');
      expect(pr80Notifs[1].title).toBe('Revisi Purchase Request Menunggu Review Finance');
    });
  });

  describe('3. Service Claim — Deep Link Fix', () => {
    it('Service Claim Submitted: Deep link points to /project-delivery, NOT /project', async () => {
      const pmUserId = 2;

      const event: BusinessEvent<any> = {
        eventId: 'evt-claim-sub-001',
        eventName: 'procurement.service_claim.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ServiceClaim',
        aggregateId: 88,
        projectId: 10,
        payload: {
          businessPayload: {
            claimId: 88,
            claimNumber: 'SC-20261029-001',
            projectId: 10,
            poId: 200,
            poNumber: 'PO-20261029-001',
            projectManagerId: pmUserId,
          },
        },
      };

      const results = await consumer.handleServiceClaimSubmitted(event);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PERSISTED');

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(pmUserId);
      // Validated: Must NOT be /project
      expect(inMemoryNotifications[0].actionLink).not.toContain('/project?');
      // Validated: Must be /project-delivery with serviceClaimId & claimId params
      expect(inMemoryNotifications[0].actionLink).toContain('/project-delivery?projectId=10');
      expect(inMemoryNotifications[0].actionLink).toContain('serviceClaimId=88');
      expect(inMemoryNotifications[0].actionLink).toContain('claimId=88');
    });
  });

  describe('4. Producer Actual Validation: PR Workflow Engine & ProcurementService (End-to-End)', () => {
    let wfEngineService: WorkflowEngineService;
    let wfEventEmitter: EventEmitter2;
    let emittedWfEvents: Array<{ event: string; payload: any }>;
    let inMemoryWfTasks: WorkflowTask[];
    let inMemoryWfTransitions: WorkflowTransition[];
    let inMemoryWfPr: PurchaseRequest;
    let inMemoryWfInstance: WorkflowInstance;
    let inMemoryWfOutbox: OutboxEvent[];
    let inMemoryWfAudit: AuditLog[];
    let nextTaskId = 600;

    const prWorkflowBpmnJson = {
      nodes: [
        {
          id: 'node_start',
          data: { role: 'PROCUREMENT', type: 'START', label: 'PR Submission' },
          type: 'customNode',
        },
        {
          id: 'node_finance_review',
          data: { role: 'FINANCE', type: 'TASK', label: 'Finance Review' },
          type: 'customNode',
        },
        {
          id: 'node_director_approval',
          data: { role: 'DIRECTOR', type: 'TASK', label: 'Director Approval' },
          type: 'customNode',
        },
        {
          id: 'node_procurement_revision',
          data: { role: 'PROCUREMENT', type: 'TASK', label: 'Procurement Revision' },
          type: 'customNode',
        },
        {
          id: 'node_end',
          data: { type: 'END', label: 'PR Approved' },
          type: 'customNode',
        },
      ],
      edges: [
        { id: 'e_start_to_fin', source: 'node_start', target: 'node_finance_review' },
        { id: 'e_fin_to_dir', label: 'APPROVE', source: 'node_finance_review', target: 'node_director_approval' },
        { id: 'e_fin_to_rev', label: 'RETURN', source: 'node_finance_review', target: 'node_procurement_revision' },
        { id: 'e_dir_to_end', label: 'APPROVE', source: 'node_director_approval', target: 'node_end' },
        { id: 'e_dir_to_rev', label: 'RETURN', source: 'node_director_approval', target: 'node_procurement_revision' },
        { id: 'e_rev_to_fin', label: 'RESUBMIT', source: 'node_procurement_revision', target: 'node_finance_review' },
      ],
    };

    const mockWfVersion = {
      id: 99,
      version: 1,
      bpmnJson: prWorkflowBpmnJson,
      status: 'PUBLISHED',
    } as WorkflowVersion;

    const createMockWfManager = () => {
      return {
        createQueryBuilder: jest.fn().mockImplementation((entityClass: any) => {
          return {
            setLock: jest.fn().mockReturnThis(),
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockImplementation((clause: string, params: any) => {
              return {
                getOne: jest.fn().mockImplementation(async () => {
                  if (params?.taskId) {
                    const task = inMemoryWfTasks.find((t) => t.id === Number(params.taskId));
                    if (task) {
                      task.workflowInstance = inMemoryWfInstance;
                      if (!task.assigneeRole && task.assigneeRoleId) {
                        if (task.assigneeRoleId === 3) task.assigneeRole = { id: 3, name: 'FINANCE' } as Role;
                        if (task.assigneeRoleId === 41) task.assigneeRole = { id: 41, name: 'PROCUREMENT' } as Role;
                        if (task.assigneeRoleId === 4) task.assigneeRole = { id: 4, name: 'DIRECTOR' } as Role;
                      }
                    }
                    return task || null;
                  }
                  return null;
                }),
              };
            }),
          };
        }),
        findOne: jest.fn().mockImplementation(async (entityClass: any, options: any) => {
          if (entityClass === WorkflowVersion) {
            return mockWfVersion;
          }
          if (entityClass === PurchaseRequest) {
            return inMemoryWfPr;
          }
          if (entityClass === Role) {
            const roleName = options?.where?.name;
            if (roleName === 'FINANCE') return { id: 3, name: 'FINANCE' };
            if (roleName === 'PROCUREMENT') return { id: 41, name: 'PROCUREMENT' };
            if (roleName === 'DIRECTOR') return { id: 4, name: 'DIRECTOR' };
            return { id: 99, name: roleName };
          }
          return null;
        }),
        count: jest.fn().mockImplementation(async (entityClass: any, options: any) => {
          if (entityClass === WorkflowTransition) {
            const instanceId = options?.where?.instanceId;
            const action = options?.where?.action;
            const toNodeId = options?.where?.toNodeId;
            return inMemoryWfTransitions.filter((t) => {
              if (instanceId && t.instanceId !== instanceId) return false;
              if (action && t.action !== action) return false;
              if (toNodeId && t.toNodeId !== toNodeId) return false;
              return true;
            }).length;
          }
          return 0;
        }),
        save: jest.fn().mockImplementation(async (entityOrClass: any, entity?: any) => {
          const target = entity || entityOrClass;
          if (target instanceof WorkflowTask || target?.nodeId !== undefined) {
            if (!target.id) target.id = ++nextTaskId;
            const idx = inMemoryWfTasks.findIndex((t) => t.id === target.id);
            if (idx >= 0) inMemoryWfTasks[idx] = target;
            else inMemoryWfTasks.push(target);
            return target;
          }
          if (target instanceof WorkflowInstance || target?.currentNodeId !== undefined) {
            Object.assign(inMemoryWfInstance, target);
            return inMemoryWfInstance;
          }
          if (target instanceof AuditLog || target?.table_name !== undefined) {
            inMemoryWfAudit.push(target);
            return target;
          }
          if (target instanceof OutboxEvent || target?.eventName !== undefined) {
            inMemoryWfOutbox.push(target);
            return target;
          }
          if (target instanceof WorkflowTransition || target?.fromNodeId !== undefined) {
            inMemoryWfTransitions.push(target);
            return target;
          }
          return target;
        }),
        update: jest.fn().mockImplementation(async (entityClass: any, criteria: any, partial: any) => {
          if (entityClass === PurchaseRequest) {
            Object.assign(inMemoryWfPr, partial);
          }
          if (entityClass === WorkflowInstance) {
            Object.assign(inMemoryWfInstance, partial);
          }
        }),
        create: jest.fn().mockImplementation((entityClass: any, plain: any) => {
          return Object.assign(new entityClass(), plain);
        }),
      } as unknown as EntityManager;
    };

    beforeEach(() => {
      emittedWfEvents = [];
      inMemoryWfTasks = [];
      inMemoryWfTransitions = [];
      inMemoryWfAudit = [];
      inMemoryWfOutbox = [];
      nextTaskId = 600;

      inMemoryWfPr = {
        id: 100,
        prNumber: 'PR-20261029-100',
        projectId: 10,
        requesterId: 2,
        totalEstimatedAmount: 85000000,
        status: 'SUBMITTED',
      } as PurchaseRequest;

      inMemoryWfInstance = {
        id: 50,
        workflowDefinitionId: 1,
        workflowVersionId: 99,
        workflowVersion: mockWfVersion,
        entityType: 'PURCHASE_REQUEST',
        entityId: 100,
        currentNodeId: 'node_finance_review',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        context: {
          purchaseRequestId: 100,
          totalEstimatedAmount: 85000000,
        },
      } as unknown as WorkflowInstance;

      const financeTask = {
        id: 501,
        workflowInstanceId: 50,
        workflowInstance: inMemoryWfInstance,
        nodeId: 'node_finance_review',
        taskKey: 'Finance Review',
        assigneeRoleId: 3,
        assigneeRole: { id: 3, name: 'FINANCE' },
        assigneeUserId: null,
        status: WorkflowTaskStatus.PENDING,
        action: null,
      } as unknown as WorkflowTask;
      inMemoryWfTasks.push(financeTask);

      wfEventEmitter = {
        emit: jest.fn().mockImplementation((event: string, payload: any) => {
          emittedWfEvents.push({ event, payload });
        }),
      } as unknown as EventEmitter2;

      const mockWfDataSource = {
        transaction: jest.fn().mockImplementation(async (cb: any) => {
          const mgr = createMockWfManager();
          return await cb(mgr);
        }),
      } as unknown as DataSource;

      wfEngineService = new WorkflowEngineService(
        {} as any,
        {} as any,
        {} as any,
        { findOne: jest.fn().mockResolvedValue(mockWfVersion) } as any,
        {} as any,
        {} as any,
        {} as any,
        mockWfDataSource,
        wfEventEmitter,
      );
    });

    it('WF Producer Lifecycle: Multi-round revision (Cycle 1, Cycle 2, Cycle 3) produces cycle-aware event IDs and distinct notifications', async () => {
      // --- CYCLE 1 ---
      // 1. Finance returns PR for revision (Cycle 1)
      await wfEngineService.completeTask(
        501,
        { action: 'RETURN', reason: 'Estimasi biaya melebihi plafon' },
        3,
        ['FINANCE'],
      );
      expect(inMemoryWfPr.status).toBe('REJECTED_TO_PROCUREMENT');

      const revTask1 = inMemoryWfTasks.find((t) => t.nodeId === 'node_procurement_revision' && t.status === WorkflowTaskStatus.PENDING);
      expect(revTask1).toBeDefined();

      emittedWfEvents.length = 0;
      // 2. Procurement resubmits (Cycle 1)
      await wfEngineService.completeTask(
        revTask1!.id,
        { action: 'RESUBMIT', reason: 'Revisi biaya putaran 1' },
        41,
        ['PROCUREMENT'],
      );
      expect(inMemoryWfPr.status).toBe('SUBMITTED');

      // Verify Cycle 1 event ID has -resub-1
      const resub1Emit = emittedWfEvents.find((e) => e.event === 'procurement.pr.submitted');
      expect(resub1Emit).toBeDefined();
      expect(resub1Emit?.payload.eventId).toBe('pr-wf-sub-100-resub-1');
      expect(resub1Emit?.payload.payload.resubmissionCount).toBe(1);

      // Feed Cycle 1 to Consumer
      const c1 = await consumer.handlePurchaseRequestSubmitted(resub1Emit?.payload);
      expect(c1[0].status).toBe('PERSISTED');

      // Retry Cycle 1 -> DUPLICATE_SUPPRESSED
      const c1Retry = await consumer.handlePurchaseRequestSubmitted(resub1Emit?.payload);
      expect(c1Retry[0].status).toBe('DUPLICATE_SUPPRESSED');

      // --- CYCLE 2 ---
      emittedWfEvents.length = 0;
      const finTask2 = inMemoryWfTasks.find((t) => t.nodeId === 'node_finance_review' && t.status === WorkflowTaskStatus.PENDING);
      expect(finTask2).toBeDefined();

      // Finance returns again (Cycle 2)
      await wfEngineService.completeTask(
        finTask2!.id,
        { action: 'RETURN', reason: 'Spesifikasi vendor masih belum sesuai' },
        3,
        ['FINANCE'],
      );

      const revTask2 = inMemoryWfTasks.find((t) => t.nodeId === 'node_procurement_revision' && t.status === WorkflowTaskStatus.PENDING);
      expect(revTask2).toBeDefined();

      // Procurement resubmits (Cycle 2)
      await wfEngineService.completeTask(
        revTask2!.id,
        { action: 'RESUBMIT', reason: 'Vendor diganti per feedback Finance' },
        41,
        ['PROCUREMENT'],
      );

      // Verify Cycle 2 event ID has -resub-2
      const resub2Emit = emittedWfEvents.find((e) => e.event === 'procurement.pr.submitted');
      expect(resub2Emit).toBeDefined();
      expect(resub2Emit?.payload.eventId).toBe('pr-wf-sub-100-resub-2');
      expect(resub2Emit?.payload.payload.resubmissionCount).toBe(2);

      // Feed Cycle 2 to Consumer -> PERSISTED (Cycle-aware deduplication succeeds!)
      const c2 = await consumer.handlePurchaseRequestSubmitted(resub2Emit?.payload);
      expect(c2[0].status).toBe('PERSISTED');

      // Retry Cycle 2 -> DUPLICATE_SUPPRESSED
      const c2Retry = await consumer.handlePurchaseRequestSubmitted(resub2Emit?.payload);
      expect(c2Retry[0].status).toBe('DUPLICATE_SUPPRESSED');

      // --- CYCLE 3 ---
      emittedWfEvents.length = 0;
      const finTask3 = inMemoryWfTasks.find((t) => t.nodeId === 'node_finance_review' && t.status === WorkflowTaskStatus.PENDING);
      expect(finTask3).toBeDefined();

      // Finance approves to Director
      await wfEngineService.completeTask(finTask3!.id, { action: 'APPROVE', reason: 'Finance setuju' }, 3, ['FINANCE']);
      const dirTask = inMemoryWfTasks.find((t) => t.nodeId === 'node_director_approval' && t.status === WorkflowTaskStatus.PENDING);
      expect(dirTask).toBeDefined();

      // Director returns to revision (Cycle 3)
      await wfEngineService.completeTask(dirTask!.id, { action: 'RETURN', reason: 'Negosiasi harga tempo pembayaran' }, 4, ['DIRECTOR']);
      const revTask3 = inMemoryWfTasks.find((t) => t.nodeId === 'node_procurement_revision' && t.status === WorkflowTaskStatus.PENDING);
      expect(revTask3).toBeDefined();

      // Procurement resubmits (Cycle 3)
      await wfEngineService.completeTask(
        revTask3!.id,
        { action: 'RESUBMIT', reason: 'Tempo pembayaran disepakati 60 hari' },
        41,
        ['PROCUREMENT'],
      );

      // Verify Cycle 3 event ID has -resub-3
      const resub3Emit = emittedWfEvents.find((e) => e.event === 'procurement.pr.submitted');
      expect(resub3Emit).toBeDefined();
      expect(resub3Emit?.payload.eventId).toBe('pr-wf-sub-100-resub-3');
      expect(resub3Emit?.payload.payload.resubmissionCount).toBe(3);

      // Feed Cycle 3 to Consumer -> PERSISTED!
      const c3 = await consumer.handlePurchaseRequestSubmitted(resub3Emit?.payload);
      expect(c3[0].status).toBe('PERSISTED');

      // Retry Cycle 3 -> DUPLICATE_SUPPRESSED
      const c3Retry = await consumer.handlePurchaseRequestSubmitted(resub3Emit?.payload);
      expect(c3Retry[0].status).toBe('DUPLICATE_SUPPRESSED');

      // --- AUDIT DATABASE ---
      // Exactly 3 revision notifications exist for PR 100 with distinct cycle titles
      const notifs = inMemoryNotifications.filter((n) => n.userId === 3 && n.dedupeKey?.includes('pr-sub-100-resub'));
      expect(notifs).toHaveLength(3);
      expect(notifs[0].title).toBe('Revisi Purchase Request Menunggu Review Finance');
      expect(notifs[1].title).toBe('Revisi ke-2 Purchase Request Menunggu Review Finance');
      expect(notifs[2].title).toBe('Revisi ke-3 Purchase Request Menunggu Review Finance');
    });

    it('WF Producer + Consumer Full Chain: Initial PR -> Resubmission 1 -> Resubmission 2 -> Retries produce exactly 3 distinct notifications with zero duplicates', async () => {
      const prId = 110;

      // --- STEP 1: INITIAL SUBMISSION FROM PRODUCER ---
      inMemoryWfPr.id = prId;
      inMemoryWfPr.status = 'SUBMITTED';
      inMemoryWfInstance.entityId = prId;

      const manager = createMockWfManager();
      const startNode = prWorkflowBpmnJson.nodes[0];
      const financeNode = prWorkflowBpmnJson.nodes[1];

      await (wfEngineService as any).progressToNode(
        manager,
        inMemoryWfInstance,
        (wfEngineService as any).parseGraph(prWorkflowBpmnJson),
        startNode,
        financeNode,
        mockWfVersion,
        'START',
        2,
      );

      const initialEmits = emittedWfEvents.filter((e) => e.event === 'procurement.pr.submitted');
      expect(initialEmits).toHaveLength(1);
      const initialEvent = initialEmits[0].payload;
      expect(initialEvent.eventId).toBe(`pr-wf-sub-${prId}`);
      expect(initialEvent.payload.isResubmission).toBe(false);

      const c0 = await consumer.handlePurchaseRequestSubmitted(initialEvent);
      expect(c0[0].status).toBe('PERSISTED');
      const c0Retry = await consumer.handlePurchaseRequestSubmitted(initialEvent);
      expect(c0Retry[0].status).toBe('DUPLICATE_SUPPRESSED');

      // --- STEP 2: RESUBMISSION 1 ---
      emittedWfEvents.length = 0;
      const fTask1 = inMemoryWfTasks.find((t) => t.nodeId === 'node_finance_review' && t.status === WorkflowTaskStatus.PENDING);
      await wfEngineService.completeTask(fTask1!.id, { action: 'RETURN', reason: 'Tolong revisi volume' }, 3, ['FINANCE']);

      const rTask1 = inMemoryWfTasks.find((t) => t.nodeId === 'node_procurement_revision' && t.status === WorkflowTaskStatus.PENDING);
      await wfEngineService.completeTask(rTask1!.id, { action: 'RESUBMIT', reason: 'Volume disesuaikan' }, 41, ['PROCUREMENT']);

      const resub1Event = emittedWfEvents.find((e) => e.event === 'procurement.pr.submitted')?.payload;
      expect(resub1Event.eventId).toBe(`pr-wf-sub-${prId}-resub-1`);

      const c1 = await consumer.handlePurchaseRequestSubmitted(resub1Event);
      expect(c1[0].status).toBe('PERSISTED');
      const c1Retry = await consumer.handlePurchaseRequestSubmitted(resub1Event);
      expect(c1Retry[0].status).toBe('DUPLICATE_SUPPRESSED');

      // --- STEP 3: RESUBMISSION 2 ---
      emittedWfEvents.length = 0;
      const fTask2 = inMemoryWfTasks.find((t) => t.nodeId === 'node_finance_review' && t.status === WorkflowTaskStatus.PENDING);
      await wfEngineService.completeTask(fTask2!.id, { action: 'RETURN', reason: 'Dokumen pendukung kurang' }, 3, ['FINANCE']);

      const rTask2 = inMemoryWfTasks.find((t) => t.nodeId === 'node_procurement_revision' && t.status === WorkflowTaskStatus.PENDING);
      await wfEngineService.completeTask(rTask2!.id, { action: 'RESUBMIT', reason: 'Dokumen pendukung dilengkapi' }, 41, ['PROCUREMENT']);

      const resub2Event = emittedWfEvents.find((e) => e.event === 'procurement.pr.submitted')?.payload;
      expect(resub2Event.eventId).toBe(`pr-wf-sub-${prId}-resub-2`);

      const c2 = await consumer.handlePurchaseRequestSubmitted(resub2Event);
      expect(c2[0].status).toBe('PERSISTED');
      const c2Retry = await consumer.handlePurchaseRequestSubmitted(resub2Event);
      expect(c2Retry[0].status).toBe('DUPLICATE_SUPPRESSED');

      // --- AUDIT DATABASE ---
      const allNotifs = inMemoryNotifications.filter(
        (n) => n.userId === 3 && n.dedupeKey?.includes(`pr-sub-${prId}`),
      );
      expect(allNotifs).toHaveLength(3);
      expect(allNotifs[0].title).toBe('Purchase Request Menunggu Review Finance');
      expect(allNotifs[1].title).toBe('Revisi Purchase Request Menunggu Review Finance');
      expect(allNotifs[2].title).toBe('Revisi ke-2 Purchase Request Menunggu Review Finance');
    });

    it('ProcurementService Producer: Untrusted DTO flag is rejected — createAndSubmitPurchaseRequest always emits initial submission', async () => {
      const prId = 200;
      const emittedProcurementEvents: Array<{ event: string; payload: any }> = [];

      const procEventEmitter = {
        emit: jest.fn().mockImplementation((event: string, payload: any) => {
          emittedProcurementEvents.push({ event, payload });
        }),
      } as unknown as EventEmitter2;

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          createQueryBuilder: jest.fn().mockReturnValue({
            withDeleted: jest.fn().mockReturnThis(),
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            addOrderBy: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue({ prNumber: 'PR-20261029-001' }),
          }),
          create: jest.fn().mockImplementation((cls: any, data: any) => {
            return Object.assign(new cls(), data, { id: prId, prNumber: `PR-20261029-${prId}` });
          }),
          save: jest.fn().mockImplementation(async (clsOrEntity: any, data?: any) => data || clsOrEntity),
        },
      };

      const mockProcDataSource = {
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      } as unknown as DataSource;

      const procurementService = new ProcurementService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { evaluateApprovalMatrix: jest.fn().mockResolvedValue([]) } as any,
        mockProcDataSource,
        procEventEmitter,
      );

      // 1. Initial direct PR creation (normal payload)
      await procurementService.createAndSubmitPurchaseRequest(2, {
        projectId: 10,
        totalEstimatedAmount: 30000000,
        items: [],
      });

      const initialEmit = emittedProcurementEvents.find((e) => e.event === 'procurement.pr.submitted');
      expect(initialEmit).toBeDefined();
      expect(initialEmit?.payload.eventId).toBe(`pr-sub-${prId}`);
      expect(initialEmit?.payload.payload.isResubmission).toBe(false);

      const c1 = await consumer.handlePurchaseRequestSubmitted(initialEmit?.payload);
      expect(c1[0].status).toBe('PERSISTED');
      expect(c1[0].notification?.title).toBe('Purchase Request Menunggu Review Finance');

      // 2. Untrusted HTTP client sends forged { isResubmission: true } on new PR
      emittedProcurementEvents.length = 0;
      await procurementService.createAndSubmitPurchaseRequest(2, {
        projectId: 10,
        totalEstimatedAmount: 30000000,
        items: [],
        ...({ isResubmission: true, resubmitted: true } as any),
      });

      const forgedEmit = emittedProcurementEvents.find((e) => e.event === 'procurement.pr.submitted');
      expect(forgedEmit).toBeDefined();
      // PROVEN: Untrusted client input is completely rejected!
      expect(forgedEmit?.payload.eventId).toBe(`pr-sub-${prId}`);
      expect(forgedEmit?.payload.payload.isResubmission).toBe(false);
      expect(forgedEmit?.payload.payload.resubmissionCount).toBe(0);

      // Consumer persists as initial submission, NOT as revision
      const cForged = await consumer.handlePurchaseRequestSubmitted(forgedEmit?.payload);
      expect(cForged[0].status).toBe('DUPLICATE_SUPPRESSED'); // deduplicates against same PR 200 initial
    });

    it('Dual Producer Safety: WorkflowEngine and ProcurementService for the same PR initial submission collapse into single notification', async () => {
      const prId = 300;

      // Event from ProcurementService
      const procEvent: BusinessEvent<any> = {
        eventId: `pr-sub-${prId}`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: prId,
        projectId: 10,
        routing: { roles: ['FINANCE'] },
        payload: {
          purchaseRequestId: prId,
          prNumber: `PR-${prId}`,
          projectId: 10,
          submittedBy: 2,
          isResubmission: false,
        },
      };

      const res1 = await consumer.handlePurchaseRequestSubmitted(procEvent);
      expect(res1[0].status).toBe('PERSISTED');

      // Event from WorkflowEngine
      const wfEvent: BusinessEvent<any> = {
        eventId: `pr-wf-sub-${prId}`,
        eventName: 'procurement.pr.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PURCHASE_REQUEST',
        aggregateId: prId,
        projectId: 10,
        routing: { roles: ['FINANCE'] },
        payload: {
          purchaseRequestId: prId,
          prNumber: `PR-${prId}`,
          projectId: 10,
          workflowInstanceId: 999,
          submittedBy: 2,
          isResubmission: false,
        },
      };

      const res2 = await consumer.handlePurchaseRequestSubmitted(wfEvent);
      expect(res2[0].status).toBe('DUPLICATE_SUPPRESSED');

      const notifsForPr300 = inMemoryNotifications.filter(
        (n) => n.userId === 3 && n.dedupeKey?.includes(`pr-sub-${prId}`),
      );
      expect(notifsForPr300).toHaveLength(1);
    });
  });
});
