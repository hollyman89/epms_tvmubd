import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource, Repository } from 'typeorm';
import { Notification } from '../../../entities/notification.entity';
import { PushOutbox, PushOutboxStatus } from '../../../entities/push-outbox.entity';
import { OutboxEvent, OutboxStatus } from '../../../entities/outbox-event.entity';
import { ProjectClosure, ProjectClosureStatus } from '../../../entities/project-closure.entity';
import { Project } from '../../../entities/project.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../../entities/workflow-task.entity';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../../entities/workflow-instance.entity';
import { NotificationGateway } from '../../notification/notification.gateway';
import { CanonicalNotificationWriter } from '../../notification/canonical-notification.writer';
import { CanonicalNotificationConsumer } from '../../notification/canonical-notification.consumer';
import { BusinessSyncConsumer, BusinessSyncEnvelope } from '../../notification/business-sync.consumer';
import { NotificationService } from '../../notification/notification.service';
import { ProjectClosureService } from '../project-closure.service';
import { BusinessEvent, extractOutboxReceipt, OutboxDeliveryOutcome } from '../../../shared/contracts/business-event.contract';

describe('EPMS F-HIGH-06: Project Closure & Remaining Notification Reliability Spec', () => {
  let consumer: CanonicalNotificationConsumer;
  let syncConsumer: BusinessSyncConsumer;
  let writer: CanonicalNotificationWriter;
  let closureService: ProjectClosureService;

  let inMemoryNotifications: Notification[];
  let inMemoryPushOutbox: PushOutbox[];
  let socketPushes: Array<{ userId: number; notification: any }>;
  let capturedSyncRooms: string[][];
  let capturedSyncEnvelopes: BusinessSyncEnvelope[];

  let mockNotificationService: jest.Mocked<Partial<NotificationService>>;
  let mockManager: any;
  let mockDataSource: any;

  const PM_USER_ID = 2;
  const HOO_USER_ID = 7;
  const DIRECTOR_USER_ID = 4;
  const SUPERADMIN_USER_ID = 1;
  const PROJECT_ID = 10;
  const CLOSURE_ID = 100;
  const PROJECT_CODE = 'PRJ-2026-001';
  const PROJECT_NAME = 'Deployment Fiber Optic Network';

  beforeEach(async () => {
    inMemoryNotifications = [];
    inMemoryPushOutbox = [];
    socketPushes = [];
    capturedSyncRooms = [];
    capturedSyncEnvelopes = [];

    const mockEmailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'email-job-1' }),
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
        });
        inMemoryNotifications.push(saved);
        return saved;
      }),
      find: jest.fn().mockImplementation(async () => inMemoryNotifications),
      findOne: jest.fn().mockImplementation(async (opt: any) => {
        if (opt?.where?.dedupeKey) {
          return inMemoryNotifications.find((n) => n.dedupeKey === opt.where.dedupeKey) || null;
        }
        return null;
      }),
    };

    const mockPushOutboxRepo = {
      save: jest.fn().mockImplementation(async (entity: PushOutbox) => {
        const duplicate = inMemoryPushOutbox.find(
          (p) => p.recipientId === entity.recipientId && p.dedupeKey && p.dedupeKey === entity.dedupeKey,
        );
        if (duplicate) {
          const err: any = new Error(`Duplicate entry '${entity.dedupeKey}' for key 'uk_push_outbox_dedupe'`);
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

    const mockGateway: Partial<NotificationGateway> = {
      sendNotificationToUser: jest.fn((userId: number, notif: any) => {
        socketPushes.push({ userId, notification: notif });
      }),
      sendSyncEventToRooms: jest.fn((rooms: string[], envelope: BusinessSyncEnvelope) => {
        capturedSyncRooms.push(rooms);
        capturedSyncEnvelopes.push(envelope);
      }),
    };

    mockNotificationService = {
      markRelatedNotificationsRead: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    // Producer mocks for ProjectClosureService & CanonicalNotificationWriter
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (entityOrClass: any, entity: any) => {
        const target = entity ? entityOrClass : (entityOrClass?.constructor || entityOrClass);
        const obj = entity || entityOrClass;
        if (target === Notification || obj instanceof Notification || (obj?.title !== undefined && obj?.userId !== undefined)) {
          return mockNotificationRepo.save(obj);
        }
        if (target === PushOutbox || obj instanceof PushOutbox || (obj?.recipientId !== undefined && obj?.dedupeKey !== undefined)) {
          return mockPushOutboxRepo.save(obj);
        }
        const item = entity || entityOrClass;
        if (!item.id) item.id = CLOSURE_ID;
        return item;
      }),
      create: jest.fn().mockImplementation((cls: any, data: any) => ({ ...data, id: data?.id || CLOSURE_ID })),
      createQueryBuilder: jest.fn(),
      query: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
        const normalized = sql.replace(/\s+/g, ' ');
        if (normalized.includes('SELECT name FROM projects WHERE id = ?')) {
          return [{ name: PROJECT_NAME }];
        }
        if (normalized.includes('SELECT DISTINCT u.id FROM users u')) {
          const flatParams = Array.isArray(params) ? params.flat() : [];
          // If this is an exclusion query (e.g. excludeRoles=['PROJECT_MANAGER'])
          if (flatParams.length === 1 && flatParams[0] === 'PROJECT_MANAGER') {
            return [{ id: PM_USER_ID }];
          }
          const users: Array<{ id: number }> = [];
          if (flatParams.includes('HEAD_OF_OPERATIONS') || flatParams.includes('SUPER_ADMIN')) {
            users.push({ id: HOO_USER_ID }, { id: SUPERADMIN_USER_ID });
          }
          if (flatParams.includes('DIRECTOR')) {
            users.push({ id: DIRECTOR_USER_ID }, { id: SUPERADMIN_USER_ID });
          }
          if (flatParams.includes('PMO')) {
            users.push({ id: 301 }, { id: SUPERADMIN_USER_ID });
          }
          if (flatParams.includes('PROJECT_MANAGER')) {
            users.push({ id: PM_USER_ID });
          }
          if (users.length === 0) {
            users.push({ id: HOO_USER_ID }, { id: DIRECTOR_USER_ID }, { id: SUPERADMIN_USER_ID });
          }
          // Remove duplicates
          const seen = new Set<number>();
          return users.filter((u) => {
            if (seen.has(u.id)) return false;
            seen.add(u.id);
            return true;
          });
        }
        if (
          normalized.includes('SELECT manager_id') &&
          normalized.includes('FROM projects')
        ) {
          return [{ manager_id: PM_USER_ID, managerId: PM_USER_ID }];
        }
        return [];
      }),
      transaction: jest.fn().mockImplementation(async (cb: (mgr: any) => any) => cb(mockManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalNotificationWriter,
        CanonicalNotificationConsumer,
        BusinessSyncConsumer,
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(PushOutbox), useValue: mockPushOutboxRepo },
        { provide: getQueueToken('email'), useValue: mockEmailQueue },
        { provide: NotificationGateway, useValue: mockGateway },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    consumer = module.get<CanonicalNotificationConsumer>(CanonicalNotificationConsumer);
    syncConsumer = module.get<BusinessSyncConsumer>(BusinessSyncConsumer);
    writer = module.get<CanonicalNotificationWriter>(CanonicalNotificationWriter);

    const mockProjectService = {
      calculateProjectOverallProgress: jest.fn().mockResolvedValue(100.0),
    };

    const mockWorkflowEngine = {
      startInstance: jest.fn().mockResolvedValue({ id: 10, current_node_id: 'node_hoo_review' }),
      completeTask: jest.fn().mockResolvedValue({ success: true }),
    };

    closureService = new ProjectClosureService(
      mockDataSource as any,
      mockProjectService as any,
      mockWorkflowEngine as any,
    );
  });

  // =========================================================================
  // 1. CANONICAL PROJECTION: PROJECT CLOSURE SUBMITTED
  // =========================================================================
  describe('1. Project Closure Submitted (PM -> HOO Review)', () => {
    it('dispatches to HOO & SuperAdmin, excludes PM actor, generates Bell & Push atomically with receipt', async () => {
      const event: BusinessEvent<any> = {
        eventId: `proj-closure-sub-${CLOSURE_ID}-c1`,
        eventName: 'project.closure.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectClosure',
        aggregateId: CLOSURE_ID,
        actor: { userId: PM_USER_ID, roles: ['PROJECT_MANAGER'] },
        payload: {
          businessPayload: {
            projectId: PROJECT_ID,
            projectCode: PROJECT_CODE,
            closureId: CLOSURE_ID,
            cycleNumber: 1,
            actorId: PM_USER_ID,
            actorRole: 'PROJECT_MANAGER',
          },
        },
      };

      const results = await consumer.handleProjectClosureSubmitted(event);

      // Verify delivery receipt
      const receipt = extractOutboxReceipt(results);
      expect(receipt).toBeDefined();
      expect(receipt?.channel).toBe('CANONICAL_NOTIFICATION');
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);

      // Verify recipient isolation: PM actor is strictly excluded
      expect(inMemoryNotifications.length).toBeGreaterThan(0);
      const recipientIds = inMemoryNotifications.map((n) => n.userId);
      expect(recipientIds).toContain(HOO_USER_ID);
      expect(recipientIds).not.toContain(PM_USER_ID);

      // Verify atomic Bell + PushOutbox parity
      expect(inMemoryPushOutbox.length).toBe(inMemoryNotifications.length);
      for (const push of inMemoryPushOutbox) {
        expect(push.status).toBe(PushOutboxStatus.PENDING);
        expect(push.dedupeKey).toContain(`proj-closure-sub-${CLOSURE_ID}-c1`);
        expect(push.dedupeKey).toContain(':PUSH');
      }

      // Verify Deep Link
      expect(inMemoryNotifications[0].actionLink).toBe(`/governance/tasks?projectId=${PROJECT_ID}`);
      expect(inMemoryNotifications[0].title).toBe('Pengajuan Penutupan Proyek Baru');
    });

    it('marks previous closure notifications read for actor upon resubmission', async () => {
      const event: BusinessEvent<any> = {
        eventId: `proj-closure-sub-${CLOSURE_ID}-c2`,
        eventName: 'project.closure.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectClosure',
        aggregateId: CLOSURE_ID,
        actor: { userId: PM_USER_ID },
        payload: {
          businessPayload: {
            projectId: PROJECT_ID,
            closureId: CLOSURE_ID,
            cycleNumber: 2,
            actorId: PM_USER_ID,
          },
        },
      };

      await consumer.handleProjectClosureSubmitted(event);
      expect(mockNotificationService.markRelatedNotificationsRead).toHaveBeenCalledWith(
        PM_USER_ID,
        'PROJECT_CLOSURE',
        CLOSURE_ID,
      );
    });
  });

  // =========================================================================
  // 2. CANONICAL PROJECTION: PROJECT CLOSURE HOO REVIEWED / APPROVED
  // =========================================================================
  describe('2. Project Closure HOO Approved (HOO -> Director Decision)', () => {
    it('dispatches to Director & SuperAdmin, excludes HOO actor, generates valid deep link', async () => {
      const event: BusinessEvent<any> = {
        eventId: `proj-closure-hoo-app-${CLOSURE_ID}-c1`,
        eventName: 'project.closure.hoo.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectClosure',
        aggregateId: CLOSURE_ID,
        actor: { userId: HOO_USER_ID, roles: ['HEAD_OF_OPERATIONS'] },
        payload: {
          businessPayload: {
            projectId: PROJECT_ID,
            projectCode: PROJECT_CODE,
            closureId: CLOSURE_ID,
            cycleNumber: 1,
            actorId: HOO_USER_ID,
            actorRole: 'HEAD_OF_OPERATIONS',
          },
        },
      };

      const results = await consumer.handleProjectClosureHooReviewed(event);

      const receipt = extractOutboxReceipt(results);
      expect(receipt).toBeDefined();
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);

      const recipientIds = inMemoryNotifications.map((n) => n.userId);
      expect(recipientIds).toContain(DIRECTOR_USER_ID);
      expect(recipientIds).not.toContain(HOO_USER_ID); // HOO actor strictly excluded

      expect(inMemoryNotifications[0].actionLink).toBe(`/governance/tasks?projectId=${PROJECT_ID}`);
      expect(inMemoryNotifications[0].title).toBe('Penutupan Proyek Menunggu Keputusan Anda');
    });
  });

  // =========================================================================
  // 3. CANONICAL PROJECTION: PROJECT CLOSURE DIRECTOR APPROVED
  // =========================================================================
  describe('3. Project Closure Director Approved (Official Closure Milestone)', () => {
    it('dispatches SYSTEM notification to assigned PM with closure section deep link', async () => {
      const event: BusinessEvent<any> = {
        eventId: `proj-closure-dir-app-${CLOSURE_ID}-c1`,
        eventName: 'project.closure.director.approved',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectClosure',
        aggregateId: CLOSURE_ID,
        actor: { userId: DIRECTOR_USER_ID, roles: ['DIRECTOR'] },
        payload: {
          businessPayload: {
            projectId: PROJECT_ID,
            projectCode: PROJECT_CODE,
            closureId: CLOSURE_ID,
            cycleNumber: 1,
            actorId: DIRECTOR_USER_ID,
            projectManagerId: PM_USER_ID,
          },
        },
      };

      const results = await consumer.handleProjectClosureApproved(event);

      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(PM_USER_ID);
      expect(inMemoryNotifications[0].userId).not.toBe(DIRECTOR_USER_ID);
      expect(inMemoryNotifications[0].notificationType).toBe('SYSTEM');
      expect(inMemoryNotifications[0].actionLink).toBe(
        `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=closure`,
      );
      expect(inMemoryNotifications[0].title).toBe('Penutupan Proyek Disetujui');
    });
  });

  // =========================================================================
  // 4. CANONICAL PROJECTION: PROJECT CLOSURE RETURNED
  // =========================================================================
  describe('4. Project Closure Returned (Reviewer -> PM Revision)', () => {
    it('HOO Return: dispatches ALERT to PM with contextual return reason', async () => {
      const returnReason = 'Berita Acara Serah Terima (BAST) belum ditandatangani klien';
      const event: BusinessEvent<any> = {
        eventId: `proj-closure-hoo-ret-${CLOSURE_ID}-c1`,
        eventName: 'project.closure.hoo.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectClosure',
        aggregateId: CLOSURE_ID,
        actor: { userId: HOO_USER_ID, roles: ['HEAD_OF_OPERATIONS'] },
        payload: {
          businessPayload: {
            projectId: PROJECT_ID,
            projectCode: PROJECT_CODE,
            closureId: CLOSURE_ID,
            cycleNumber: 1,
            actorId: HOO_USER_ID,
            projectManagerId: PM_USER_ID,
            returnReason,
          },
        },
      };

      const results = await consumer.handleProjectClosureReturned(event);

      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(PM_USER_ID);
      expect(inMemoryNotifications[0].userId).not.toBe(HOO_USER_ID);
      expect(inMemoryNotifications[0].message).toContain(returnReason);
      expect(inMemoryNotifications[0].actionLink).toBe(
        `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=closure`,
      );
    });

    it('Director Return: dispatches ALERT to PM with director return reason', async () => {
      const returnReason = 'Audit finansial sisa material belum diselesaikan';
      const event: BusinessEvent<any> = {
        eventId: `proj-closure-dir-ret-${CLOSURE_ID}-c1`,
        eventName: 'project.closure.director.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProjectClosure',
        aggregateId: CLOSURE_ID,
        actor: { userId: DIRECTOR_USER_ID, roles: ['DIRECTOR'] },
        payload: {
          businessPayload: {
            projectId: PROJECT_ID,
            projectCode: PROJECT_CODE,
            closureId: CLOSURE_ID,
            cycleNumber: 1,
            actorId: DIRECTOR_USER_ID,
            projectManagerId: PM_USER_ID,
            returnReason,
          },
        },
      };

      const results = await consumer.handleProjectClosureReturned(event);

      const receipt = extractOutboxReceipt(results);
      expect(receipt?.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);

      expect(inMemoryNotifications).toHaveLength(1);
      expect(inMemoryNotifications[0].userId).toBe(PM_USER_ID);
      expect(inMemoryNotifications[0].userId).not.toBe(DIRECTOR_USER_ID);
      expect(inMemoryNotifications[0].message).toContain(returnReason);
    });
  });

  // =========================================================================
  // 5. BUSINESS SYNC CONSUMER: REAL-TIME WEBSOCKET COVERAGE
  // =========================================================================
  describe('5. BusinessSyncConsumer Project Closure Coverage', () => {
    const CLOSURE_EVENTS = [
      'project.closure.submitted',
      'project.closure.hoo.approved',
      'project.closure.hoo.returned',
      'project.closure.director.approved',
      'project.closure.director.returned',
    ];

    it('each of the 5 Project Closure events is handled and dispatches sync envelope to target role rooms', () => {
      for (const eventName of CLOSURE_EVENTS) {
        const canonicalEvent: BusinessEvent = {
          eventId: `evt-sync-${eventName}`,
          eventName,
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          aggregateType: 'ProjectClosure',
          aggregateId: CLOSURE_ID,
          projectId: PROJECT_ID,
          payload: { closureId: CLOSURE_ID, projectId: PROJECT_ID },
        };

        const receipt = syncConsumer.handleProjectClosureSync(canonicalEvent);

        expect(receipt).toBeDefined();
        expect(receipt.__outboxContract).toBe(true);
        expect(receipt.channel).toBe('BUSINESS_SYNC');
        expect(receipt.outcome).toBe(OutboxDeliveryOutcome.DELIVERED);
      }

      // Verify that all 5 dispatches reached gateway with role rooms
      expect(capturedSyncRooms).toHaveLength(5);
      for (const rooms of capturedSyncRooms) {
        expect(rooms).toContain('role:HEAD_OF_OPERATIONS');
        expect(rooms).toContain('role:DIRECTOR');
        expect(rooms).toContain('role:PROJECT_MANAGER');
      }
    });
  });

  // =========================================================================
  // 6. PRODUCER DETERMINISM IN PROJECT CLOSURE SERVICE
  // =========================================================================
  describe('6. Producer Determinism in ProjectClosureService', () => {
    const readyProject = {
      id: PROJECT_ID,
      code: PROJECT_CODE,
      name: PROJECT_NAME,
      managerId: PM_USER_ID,
      status: 'IN_PROGRESS',
    };

    beforeEach(() => {
      jest.spyOn(closureService, 'evaluateClosureReadiness').mockResolvedValue({
        ready: true,
        summary: { blockerCount: 0, warningCount: 0 },
        blockers: [],
        warnings: [],
        documents: {
          customerBastDocumentId: 501,
          finalReportDocumentId: 502,
        },
        physicalActualFinishCandidate: '2026-10-15T10:00:00.000Z',
      } as any);
    });

    it('submitClosure produces deterministic event_id: proj-closure-sub-{id}-c{cycle}', async () => {
      mockManager.findOne.mockImplementation(async (cls: any) => {
        if (cls === Project) return { ...readyProject };
        if (cls === ProjectClosure) return null; // No existing closure
        return null;
      });

      await closureService.submitClosure(
        PROJECT_ID,
        {
          submissionNotes: 'All project deliverables completed',
        },
        PM_USER_ID,
        ['PROJECT_MANAGER'],
      );

      const outboxCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === OutboxEvent);
      expect(outboxCalls.length).toBeGreaterThan(0);
      const submitOutbox = outboxCalls.find((c: any) => c[1].event_name === 'project.closure.submitted');
      expect(submitOutbox).toBeDefined();
      expect(submitOutbox[1].event_id).toBe(`proj-closure-sub-${CLOSURE_ID}-c1`);
      expect(submitOutbox[1].correlation_id).toBe(`closure-${CLOSURE_ID}-c1`);
    });

    it('hooApprove produces deterministic event_id: proj-closure-hoo-app-{id}-c{cycle}', async () => {
      const activeClosure = {
        id: CLOSURE_ID,
        projectId: PROJECT_ID,
        cycleNumber: 1,
        status: ProjectClosureStatus.PENDING_HOO_REVIEW,
      };

      mockManager.findOne.mockImplementation(async (cls: any) => {
        if (cls === ProjectClosure) return { ...activeClosure };
        if (cls === Project) return { ...readyProject };
        return null;
      });

      mockManager.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 50,
          workflowInstanceId: 10,
          nodeId: 'node_hoo_review',
          status: WorkflowTaskStatus.PENDING,
        }),
      });

      await closureService.hooApprove(PROJECT_ID, CLOSURE_ID, {
        notes: 'HOO verification passed',
      }, HOO_USER_ID, ['HEAD_OF_OPERATIONS']);

      const outboxCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === OutboxEvent);
      const hooOutbox = outboxCalls.find((c: any) => c[1].event_name === 'project.closure.hoo.approved');
      expect(hooOutbox).toBeDefined();
      expect(hooOutbox[1].event_id).toBe(`proj-closure-hoo-app-${CLOSURE_ID}-c1`);
    });

    it('directorApprove produces deterministic event_id: proj-closure-dir-app-{id}-c{cycle}', async () => {
      const activeClosure = {
        id: CLOSURE_ID,
        projectId: PROJECT_ID,
        cycleNumber: 1,
        status: ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL,
        hooReviewerId: HOO_USER_ID,
        hooReviewedAt: new Date(),
        directorNotes: 'Approved',
      };

      mockManager.findOne.mockImplementation(async (cls: any) => {
        if (cls === ProjectClosure) return { ...activeClosure };
        if (cls === Project) {
          return {
            ...readyProject,
            actualFinishAt: new Date(),
            closedAt: new Date(),
            closedBy: DIRECTOR_USER_ID,
          };
        }
        return null;
      });

      mockManager.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 51,
          workflowInstanceId: 10,
          nodeId: 'node_director_approval',
          status: WorkflowTaskStatus.PENDING,
        }),
      });

      await closureService.directorApprove(PROJECT_ID, CLOSURE_ID, {
        notes: 'Director final approval granted',
      }, DIRECTOR_USER_ID, ['DIRECTOR']);

      const outboxCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === OutboxEvent);
      const dirOutbox = outboxCalls.find((c: any) => c[1].event_name === 'project.closure.director.approved');
      expect(dirOutbox).toBeDefined();
      expect(dirOutbox[1].event_id).toBe(`proj-closure-dir-app-${CLOSURE_ID}-c1`);
    });

    it('hooReturn produces deterministic event_id: proj-closure-hoo-ret-{id}-c{cycle}', async () => {
      const activeClosure = {
        id: CLOSURE_ID,
        projectId: PROJECT_ID,
        cycleNumber: 1,
        status: ProjectClosureStatus.PENDING_HOO_REVIEW,
      };

      mockManager.findOne.mockImplementation(async (cls: any) => {
        if (cls === ProjectClosure) return { ...activeClosure };
        if (cls === Project) return { ...readyProject };
        return null;
      });

      mockManager.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 50,
          workflowInstanceId: 10,
          nodeId: 'node_hoo_review',
          status: WorkflowTaskStatus.PENDING,
        }),
      });

      await closureService.hooReturn(PROJECT_ID, CLOSURE_ID, {
        reason: 'Perbaiki lampiran BAST',
      }, HOO_USER_ID, ['HEAD_OF_OPERATIONS']);

      const outboxCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === OutboxEvent);
      const retOutbox = outboxCalls.find((c: any) => c[1].event_name === 'project.closure.hoo.returned');
      expect(retOutbox).toBeDefined();
      expect(retOutbox[1].event_id).toBe(`proj-closure-hoo-ret-${CLOSURE_ID}-c1`);
    });

    it('directorReturn produces deterministic event_id: proj-closure-dir-ret-{id}-c{cycle}', async () => {
      const activeClosure = {
        id: CLOSURE_ID,
        projectId: PROJECT_ID,
        cycleNumber: 1,
        status: ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL,
      };

      mockManager.findOne.mockImplementation(async (cls: any) => {
        if (cls === ProjectClosure) return { ...activeClosure };
        if (cls === Project) return { ...readyProject };
        return null;
      });

      mockManager.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 51,
          workflowInstanceId: 10,
          nodeId: 'node_director_approval',
          status: WorkflowTaskStatus.PENDING,
        }),
      });

      await closureService.directorReturn(PROJECT_ID, CLOSURE_ID, {
        reason: 'Dokumen belum lengkap',
      }, DIRECTOR_USER_ID, ['DIRECTOR']);

      const outboxCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === OutboxEvent);
      const retOutbox = outboxCalls.find((c: any) => c[1].event_name === 'project.closure.director.returned');
      expect(retOutbox).toBeDefined();
      expect(retOutbox[1].event_id).toBe(`proj-closure-dir-ret-${CLOSURE_ID}-c1`);
    });
  });

  // =========================================================================
  // 7. GLOBAL LINK CONTAMINATION REGRESSION FIX
  // =========================================================================
  describe('7. Global Link Contamination Fix', () => {
    it('PROJECT_PM_ASSIGNED includes projectId deep link when available', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-pm-assign-01',
        eventName: 'project.pm.assigned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Project',
        aggregateId: PROJECT_ID,
        payload: {
          projectId: PROJECT_ID,
          projectCode: PROJECT_CODE,
          projectManagerId: PM_USER_ID,
        },
      };

      await consumer.handleProjectPmAssigned(event);
      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryNotifications[0].actionLink).toBe(
        `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=overview`,
      );
    });

    it('PROJECT_OPERATIONAL_STARTED includes projectId deep link when available', async () => {
      const event: BusinessEvent<any> = {
        eventId: 'evt-op-started-01',
        eventName: 'project.started',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Project',
        aggregateId: PROJECT_ID,
        payload: {
          projectId: PROJECT_ID,
          tenderTitle: 'Proyek Serat Optik',
        },
      };

      await consumer.handleProjectStarted(event);
      expect(inMemoryNotifications.length).toBeGreaterThan(0);
      expect(inMemoryNotifications[0].actionLink).toBe(
        `/project-delivery?view=workspace&projectId=${PROJECT_ID}&section=overview`,
      );
    });
  });
});
