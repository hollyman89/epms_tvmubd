import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource, Repository } from 'typeorm';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { NotificationEventListener } from '../notification/notification-event.listener';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from '../notification/notification.gateway';

describe('Handover Legal -> PMO -> Project Manager Governance Suite (Scenarios 1 - 9)', () => {
  let projectService: ProjectService;
  let notifListener: NotificationEventListener;

  // Dynamic Fixture IDs (No hardcoded 2 or 769)
  const PMO_USER_ID = Math.floor(Math.random() * 1000) + 100;
  const PM_A_ID = PMO_USER_ID + 1;
  const PM_B_ID = PMO_USER_ID + 2;
  const SUPER_ADMIN_ID = PMO_USER_ID + 3;

  const CONTRACT_ID = Math.floor(Math.random() * 10000) + 1000;
  const CONTRACT_NUMBER = `CONT-${CONTRACT_ID}`;
  const PROJECT_ID = CONTRACT_ID + 500;
  const PROJECT_CODE = CONTRACT_NUMBER;

  const mockUsers: Record<number, any> = {
    [PMO_USER_ID]: {
      id: PMO_USER_ID,
      fullName: 'PMO Specialist',
      email: 'pmo.spec@tvmubd.com',
      isActive: true,
      roles: [{ name: 'PMO' }],
    },
    [PM_A_ID]: {
      id: PM_A_ID,
      fullName: 'Project Manager Alpha',
      email: 'pm.alpha@tvmubd.com',
      isActive: true,
      roles: [{ name: 'PROJECT_MANAGER' }],
    },
    [PM_B_ID]: {
      id: PM_B_ID,
      fullName: 'Project Manager Beta',
      email: 'pm.beta@tvmubd.com',
      isActive: true,
      roles: [{ name: 'PROJECT_MANAGER' }],
    },
    [SUPER_ADMIN_ID]: {
      id: SUPER_ADMIN_ID,
      fullName: 'Super Administrator',
      email: 'admin@tvmubd.com',
      isActive: true,
      roles: [{ name: 'SUPER_ADMIN' }],
    },
  };

  let testContract: Partial<Contract>;
  let testProject: Partial<Project> | null = null;
  let savedNotifications: Notification[] = [];
  let emittedEvents: Array<{ event: string; payload: any }> = [];
  let savedEntitiesInTx: Array<{ cls: any; entity: any }> = [];

  beforeEach(async () => {
    savedNotifications = [];
    emittedEvents = [];
    savedEntitiesInTx = [];

    testContract = {
      id: CONTRACT_ID,
      contract_number: CONTRACT_NUMBER,
      legal_status: LegalStatus.APPROVED,
      status: 'ACTIVE',
      project_manager_id: null as any,
      proposal: {
        id: 1,
        tender_id: 1,
        tender: { id: 1, title: 'Network Upgrade 2026', project_location: 'Surabaya' },
      } as any,
    };

    testProject = null;

    const fakeManager = {
      save: jest.fn().mockImplementation(async (cls: any, entity?: any) => {
        const target = entity !== undefined ? entity : cls;
        const targetCls = entity !== undefined ? cls : (cls?.constructor || cls);
        savedEntitiesInTx.push({ cls: targetCls, entity: target });
        if (target.constructor === Project || target.code === PROJECT_CODE) {
          testProject = { ...target, id: target.id || PROJECT_ID };
          return testProject;
        }
        if (target.constructor === Contract || target.contract_number === CONTRACT_NUMBER) {
          testContract = { ...target, id: target.id || CONTRACT_ID };
          return testContract;
        }
        return { ...target, id: target.id || 999 };
      }),
      create: jest.fn().mockImplementation((cls: any, data: any) => ({ ...data })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    const contractRepoMock = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        const conditions = Array.isArray(where) ? where : [where];
        for (const cond of conditions) {
          if (cond.id === CONTRACT_ID || cond.contract_number === CONTRACT_NUMBER) {
            return Promise.resolve({ ...testContract });
          }
        }
        return Promise.resolve(null);
      }),
      find: jest.fn().mockImplementation(({ where }) => {
        if (!where) return Promise.resolve([{ ...testContract }]);
        const conditions = Array.isArray(where) ? where : [where];
        const matches = conditions.some((c: any) => {
          if (c.project_manager_id === null || c.project_manager_id === undefined) {
            return testContract.project_manager_id === null;
          }
          return testContract.project_manager_id === c.project_manager_id;
        });
        return Promise.resolve(matches ? [{ ...testContract }] : []);
      }),
      save: jest.fn().mockImplementation((entity) => {
        testContract = { ...testContract, ...entity };
        return Promise.resolve(testContract);
      }),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb) => cb(fakeManager)),
      },
    };

    const projectRepoMock = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (!testProject) return Promise.resolve(null);
        const conditions = Array.isArray(where) ? where : [where];
        for (const cond of conditions) {
          if (
            cond.id === testProject.id ||
            cond.code === testProject.code ||
            cond.contractId === testProject.contractId
          ) {
            return Promise.resolve({ ...testProject });
          }
        }
        return Promise.resolve(null);
      }),
      find: jest.fn().mockImplementation(({ where }) => {
        if (!testProject) return Promise.resolve([]);
        if (!where || where.managerId === undefined) return Promise.resolve([{ ...testProject }]);
        if (testProject.managerId === where.managerId) return Promise.resolve([{ ...testProject }]);
        return Promise.resolve([]);
      }),
      create: jest.fn().mockImplementation((data) => ({ ...data, id: PROJECT_ID })),
      save: jest.fn().mockImplementation((entity) => {
        testProject = { ...(testProject || {}), ...entity, id: testProject?.id || PROJECT_ID };
        return Promise.resolve(testProject);
      }),
    };

    const userRepoMock = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        const id = where.id;
        return Promise.resolve(mockUsers[id] ? { ...mockUsers[id] } : null);
      }),
      find: jest.fn().mockImplementation(() => Promise.resolve(Object.values(mockUsers))),
    };

    const notificationRepoMock = {
      save: jest.fn().mockImplementation(async (notifOrList: any) => {
        const list = Array.isArray(notifOrList) ? notifOrList : [notifOrList];
        const saved: Notification[] = [];
        for (const n of list) {
          // Check simulated dedupe constraint: (user_id, dedupe_key)
          if (n.dedupeKey) {
            const existing = savedNotifications.find(
              (s) => s.userId === n.userId && s.dedupeKey === n.dedupeKey,
            );
            if (existing) {
              const dupError: any = new Error(`Duplicate entry '${n.dedupeKey}' for key 'idx_notif_user_dedupe'`);
              dupError.code = 'ER_DUP_ENTRY';
              dupError.errno = 1062;
              throw dupError;
            }
          }
          const item = { ...n, id: savedNotifications.length + 1 };
          savedNotifications.push(item);
          saved.push(item);
        }
        return Array.isArray(notifOrList) ? saved : saved[0];
      }),
      find: jest.fn().mockImplementation(({ where }) => {
        let results = [...savedNotifications];
        if (where?.userId) results = results.filter((n) => n.userId === where.userId);
        return Promise.resolve(results);
      }),
    };

    const mockDataSource = {
      query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM users') && sql.includes('WHERE id IN')) {
          return params.filter((id) => mockUsers[id]).map((id) => ({ id }));
        }
        if (sql.includes('FROM users u') && sql.includes('WHERE r.name IN')) {
          const targetRoles: string[] = params;
          return Object.values(mockUsers)
            .filter((u: any) => u.roles.some((r: any) => targetRoles.includes(r.name)))
            .map((u: any) => ({ id: u.id }));
        }
        if (sql.includes('FROM contracts c')) {
          return [
            {
              tenderId: 1,
              tenderTitle: 'Network Upgrade 2026',
              marketingPicId: 99,
              createdBy: 99,
            },
          ];
        }
        return [];
      }),
    };

    const eventEmitterMock = {
      emit: jest.fn().mockImplementation((event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      }),
    };

    const notificationGatewayMock = {
      server: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
      sendNotificationToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        CostEstimateValidator,
        ScheduleValidator,
        InitialConditionValidator,
        ManagementReviewValidator,
        OperationalReadinessValidator,
        NotificationEventListener,
        { provide: getRepositoryToken(Project), useValue: projectRepoMock },
        { provide: getRepositoryToken(Contract), useValue: contractRepoMock },
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Task), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: getRepositoryToken(Notification), useValue: notificationRepoMock },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: eventEmitterMock },
        { provide: NotificationGateway, useValue: notificationGatewayMock },
        { provide: getQueueToken('email-send'), useValue: { add: jest.fn() } },
      ],
    }).compile();

    projectService = module.get<ProjectService>(ProjectService);
    notifListener = module.get<NotificationEventListener>(NotificationEventListener);
  });

  describe('Skenario 1 — Legal Approve: Contract ACTIVE, PMO Notified, PM Isolated', () => {
    it('sends legal.contract.approved to PMO & SUPER_ADMIN only, excluding PROJECT_MANAGER', async () => {
      // Trigger notification handler for Legal Contract Approved
      await notifListener.handleContractApprovedEvent({
        contractId: CONTRACT_ID,
        contractNumber: CONTRACT_NUMBER,
        legalStatus: 'APPROVED',
      });

      // Assert emitted notification.send targeted audience: PMO
      const notifSendEvent = emittedEvents.find((e) => e.event === 'notification.send' && e.payload.audience === 'PMO');
      expect(notifSendEvent).toBeDefined();
      expect(notifSendEvent?.payload.type).toBe('ALERT');

      // Now execute handleNotificationSend with this payload to test recipient resolution
      await notifListener.handleNotificationSend(notifSendEvent!.payload);

      // Verify notifications stored in DB
      const pmoNotif = savedNotifications.find((n) => n.userId === PMO_USER_ID);
      const adminNotif = savedNotifications.find((n) => n.userId === SUPER_ADMIN_ID);
      const pmANotif = savedNotifications.find((n) => n.userId === PM_A_ID);
      const pmBNotif = savedNotifications.find((n) => n.userId === PM_B_ID);

      expect(pmoNotif).toBeDefined();
      expect(adminNotif).toBeDefined();
      // PMs MUST NOT receive legal contract approved notification
      expect(pmANotif).toBeUndefined();
      expect(pmBNotif).toBeUndefined();

      // No active PM project or task
      expect(testContract.project_manager_id).toBeNull();
      expect(testProject).toBeNull();
    });
  });

  describe('Skenario 2 — PMO Queue Visibility', () => {
    it('PMO can view unassigned active approved contracts in operational board queue', async () => {
      const board = await projectService.getOperationalBoard(PMO_USER_ID, ['PMO']);
      const unassignedInQueue = board.data.pendingKickoff.find((c: any) => c.contractId === CONTRACT_ID);

      expect(unassignedInQueue).toBeDefined();
      expect(unassignedInQueue.status).toBe('PENDING_KICKOFF');
      expect(unassignedInQueue.managerId).toBeNull();
      expect(unassignedInQueue.pmName).toBeNull();
    });
  });

  describe('Skenario 3 — PM Workspace Visibility (Isolation)', () => {
    it('PM does NOT see unassigned contracts in personal operational board workspace', async () => {
      const board = await projectService.getOperationalBoard(PM_A_ID, ['PROJECT_MANAGER']);
      const unassignedInPmWorkspace = board.data.pendingKickoff.find((c: any) => c.contractId === CONTRACT_ID);

      expect(unassignedInPmWorkspace).toBeUndefined();
    });
  });

  describe('Skenario 4 — PM Assignment Canonical Contract (Transactional Outbox)', () => {
    it('PMO assigns PM A: updates contract, creates planning project, persists canonical outbox event, and does NOT emit internal event', async () => {
      const result = await projectService.assignProjectManager(
        CONTRACT_ID,
        PM_A_ID,
        PMO_USER_ID,
        ['PMO'],
      );

      expect(result.statusCode).toBe(200);
      expect(testContract.project_manager_id).toBe(PM_A_ID);
      expect(testProject?.managerId).toBe(PM_A_ID);
      expect(testProject?.status).toBe('PLANNING');

      // Verify canonical OutboxEvent was persisted in the same transaction
      const outboxEntry = savedEntitiesInTx.find(
        (e) => e.cls === OutboxEvent || e.entity?.event_name === 'project.pm.assigned',
      );
      expect(outboxEntry).toBeDefined();
      expect(outboxEntry?.entity.event_name).toBe('project.pm.assigned');
      expect(outboxEntry?.entity.aggregate_type).toBe('Project');
      expect(outboxEntry?.entity.aggregate_id).toBe(testProject?.id);

      const payload = outboxEntry?.entity.payload;
      expect(payload?.businessPayload?.projectId).toBe(testProject?.id);
      expect(payload?.businessPayload?.projectManagerId).toBe(PM_A_ID);
      expect(payload?.businessPayload?.contractId).toBe(CONTRACT_ID);
      expect(payload?.businessPayload?.assignedBy).toBe(PMO_USER_ID);
      expect(payload?.businessPayload?.status).toBe('PLANNING');

      // Verify internal event is NOT emitted (obsolete transport removed in Phase I-E)
      const internalAssignEvent = emittedEvents.find(
        (e) => e.event === 'internal.project.pm.assigned',
      );
      expect(internalAssignEvent).toBeUndefined();
    });
  });

  describe('Skenario 5 — Idempotency of internal.project.pm.assigned', () => {
    it('sending project.pm.assigned twice concurrently results in exactly 1 notification row', async () => {
      const payload = {
        projectId: PROJECT_ID,
        projectCode: PROJECT_CODE,
        contractId: CONTRACT_ID,
        projectManagerId: PM_A_ID,
        assignedBy: PMO_USER_ID,
        status: 'PLANNING',
        timestamp: new Date().toISOString(),
      };

      // Call concurrently
      await Promise.all([
        notifListener.handleProjectPmAssignedEvent(payload),
        notifListener.handleProjectPmAssignedEvent(payload),
      ]);

      const pmNotifs = savedNotifications.filter((n) => n.userId === PM_A_ID);
      expect(pmNotifs).toHaveLength(1);
    });
  });

  describe('Skenario 6 — IDOR Scoping (PM A cannot access PM B project)', () => {
    beforeEach(() => {
      testProject = {
        id: PROJECT_ID,
        code: PROJECT_CODE,
        name: 'Project Beta Only',
        managerId: PM_B_ID,
        status: 'PLANNING',
      };
    });

    it('PM A attempting to read PM B project WBS or Estimate receives 403 Forbidden', async () => {
      // PM A attempts to read PM B project
      await expect(
        projectService.getWbsByProject(PROJECT_ID, PM_A_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        projectService.getCostEstimate(PROJECT_ID, PM_A_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        projectService.getProjectSchedule(PROJECT_ID, PM_A_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        projectService.getOperationalReadiness(PROJECT_ID, PM_A_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('PM B (assigned owner) and SUPER_ADMIN can access project without 403', async () => {
      // Owner PM B can access
      await expect(
        projectService.getWbsByProject(PROJECT_ID, PM_B_ID, ['PROJECT_MANAGER']),
      ).resolves.toBeDefined();

      // Super admin can access
      await expect(
        projectService.getWbsByProject(PROJECT_ID, SUPER_ADMIN_ID, ['SUPER_ADMIN']),
      ).resolves.toBeDefined();
    });
  });

  describe('Skenario 7 — Mutation Rejected Before Assignment', () => {
    beforeEach(() => {
      testContract.project_manager_id = null;
      testProject = {
        id: PROJECT_ID,
        code: PROJECT_CODE,
        name: 'Unassigned Project',
        managerId: null as any,
        status: 'PLANNING',
      };
    });

    it('kickoff before PM assignment is rejected with BadRequestException', async () => {
      await expect(
        projectService.executeFormalKickoff(PROJECT_ID, {}, PM_A_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(BadRequestException);
    });

    it('reject charter before PM assignment is rejected with ForbiddenException', async () => {
      await expect(
        projectService.rejectCharter(CONTRACT_ID, { reason: 'Alasan pengembalian harus minimal 15 karakter' }, PM_A_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Skenario 8 — Re-Approval Protection', () => {
    it('re-approval events with identical dedupeKey do not create duplicate notifications', async () => {
      await notifListener.handleContractApprovedEvent({
        contractId: CONTRACT_ID,
        contractNumber: CONTRACT_NUMBER,
        legalStatus: 'APPROVED',
      });

      const firstSend = emittedEvents[0]?.payload;
      await notifListener.handleNotificationSend(firstSend);
      const initialCount = savedNotifications.length;

      // Second approval trigger
      await notifListener.handleNotificationSend(firstSend);
      expect(savedNotifications.length).toBe(initialCount);
    });
  });

  describe('Skenario 9 — Notification Types Mapping Verification', () => {
    it('verifies mapping: Legal approve -> PMO is ALERT, PMO assign PM is TASK', async () => {
      // 1. Legal approve
      await notifListener.handleContractApprovedEvent({
        contractId: 5555,
        legalStatus: 'APPROVED',
      });
      const legalEvt = emittedEvents.find((e) => e.payload.dedupeKey?.startsWith('LEGAL_CONTRACT_APPROVED:5555'));
      expect(legalEvt?.payload.type).toBe('ALERT');

      // 2. PM assign
      await notifListener.handleProjectPmAssignedEvent({
        projectId: 7777,
        projectCode: 'CONT-7777',
        contractId: 5555,
        projectManagerId: PM_A_ID,
        assignedBy: PMO_USER_ID,
        status: 'PLANNING',
        timestamp: new Date().toISOString(),
      });
      const lastSaved = savedNotifications[savedNotifications.length - 1];
      expect(lastSaved.notificationType).toBe('TASK');
    });
  });
});
