import { ForbiddenException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectClosureService } from './project-closure.service';
import { ProjectController } from './project.controller';
import { ProjectClosure, ProjectClosureStatus } from '../../entities/project-closure.entity';
import { Project } from '../../entities/project.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../entities/workflow-task.entity';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../entities/workflow-instance.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';

describe('EPMS — Project Closure Workflow, Authorization & Audit Spec', () => {
  let service: ProjectClosureService;
  let mockDataSource: any;
  let mockProjectService: any;
  let mockWorkflowEngine: any;
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (entityOrClass: any, entity: any) => {
        const item = entity || entityOrClass;
        if (!item.id) item.id = 100;
        return item;
      }),
      create: jest.fn().mockImplementation((cls: any, data: any) => ({ ...data, id: 200 })),
      createQueryBuilder: jest.fn(),
      query: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (mgr: any) => any) => cb(mockManager)),
      query: jest.fn(),
      getRepository: jest.fn(),
    };

    mockProjectService = {
      calculateProjectOverallProgress: jest.fn().mockResolvedValue(100.0),
    };

    mockWorkflowEngine = {
      startInstance: jest.fn().mockResolvedValue({ id: 10, current_node_id: 'node_hoo_review' }),
      completeTask: jest.fn().mockResolvedValue({ success: true }),
    };

    service = new ProjectClosureService(
      mockDataSource,
      mockProjectService,
      mockWorkflowEngine,
    );
  });

  // ==============================================================
  // PHASE 9 — AUTHORIZATION / NEGATIVE GATE
  // ==============================================================
  describe('Phase 9: Authorization & Negative Gate Matrix', () => {
    describe('Controller Route Level Decorators', () => {
      it('verifies submitClosure route decorator strictly requires PROJECT_MANAGER role', () => {
        const roles = Reflect.getMetadata('roles', ProjectController.prototype.submitClosure);
        expect(roles).toEqual(['PROJECT_MANAGER']);
      });

      it('verifies hooApprove route decorator strictly requires HEAD_OF_OPERATIONS role', () => {
        const roles = Reflect.getMetadata('roles', ProjectController.prototype.hooApprove);
        expect(roles).toEqual(['HEAD_OF_OPERATIONS']);
      });

      it('verifies hooReturn route decorator strictly requires HEAD_OF_OPERATIONS role', () => {
        const roles = Reflect.getMetadata('roles', ProjectController.prototype.hooReturn);
        expect(roles).toEqual(['HEAD_OF_OPERATIONS']);
      });

      it('verifies directorApprove route decorator strictly requires DIRECTOR role', () => {
        const roles = Reflect.getMetadata('roles', ProjectController.prototype.directorApprove);
        expect(roles).toEqual(['DIRECTOR']);
      });

      it('verifies directorReturn route decorator strictly requires DIRECTOR role', () => {
        const roles = Reflect.getMetadata('roles', ProjectController.prototype.directorReturn);
        expect(roles).toEqual(['DIRECTOR']);
      });
    });

    describe('Service Level Authority Matrix', () => {
      it('rejects PM submit if user has ADMIN or SUPER_ADMIN role (no business shortcut)', async () => {
        await expect(
          service.submitClosure(1, {}, 99, ['ADMIN', 'PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.submitClosure(1, {}, 99, ['SUPER_ADMIN']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('rejects PM submit if user is HEAD_OF_OPERATIONS or DIRECTOR', async () => {
        await expect(
          service.submitClosure(1, {}, 99, ['HEAD_OF_OPERATIONS']),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.submitClosure(1, {}, 99, ['DIRECTOR']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('rejects PM submit if user is unrelated PM (scoping check)', async () => {
        mockManager.findOne.mockImplementation(async (entity: any, opt: any) => {
          if (entity === Project) {
            return { id: 1, managerId: 2, status: 'IN_PROGRESS' };
          }
          return null;
        });

        await expect(
          service.submitClosure(1, {}, 5, ['PROJECT_MANAGER']), // user 5 is not manager 2
        ).rejects.toThrow(ForbiddenException);
      });

      it('rejects HOO approve if caller is ADMIN, SUPER_ADMIN or non-HOO', async () => {
        await expect(
          service.hooApprove(1, 10, {}, 1, ['SUPER_ADMIN']),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.hooApprove(1, 10, {}, 2, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.hooApprove(1, 10, {}, 3, ['DIRECTOR']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('rejects Director approve if caller is ADMIN, SUPER_ADMIN or non-Director', async () => {
        await expect(
          service.directorApprove(1, 10, {}, 1, ['SUPER_ADMIN']),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.directorApprove(1, 10, {}, 4, ['HEAD_OF_OPERATIONS']),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.directorApprove(1, 10, {}, 2, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  // ==============================================================
  // PHASE 10 — NOT-READY SUBMISSION PROTECTION
  // ==============================================================
  describe('Phase 10: Not-Ready Submission Protection', () => {
    it('rejects submission with 409 Conflict when project is not ready (state identical to Project 1)', async () => {
      mockManager.findOne.mockImplementation(async (entity: any, opt: any) => {
        if (entity === Project) {
          return { id: 1, code: 'CONT-1', managerId: 2, status: 'IN_PROGRESS' };
        }
        if (entity === ProjectClosure) {
          return null;
        }
        return null;
      });

      // Mock readiness returning ready: false with blockers (like Project 1: progress 20%, incomplete tasks, missing BAST, missing report)
      jest.spyOn(service, 'evaluateClosureReadiness').mockResolvedValueOnce({
        ready: false,
        summary: { blockerCount: 5, warningCount: 0 },
        blockers: [
          { domain: 'PHYSICAL_EXECUTION', code: 'PHYSICAL_PROGRESS_INCOMPLETE', message: 'Progress 20%' },
          { domain: 'TASKS', code: 'TASK_INCOMPLETE', message: 'Leaf tasks incomplete' },
          { domain: 'TASKS', code: 'TASK_ACTUAL_FINISH_MISSING', message: 'Missing actual finish' },
          { domain: 'ACCEPTANCE_DOCUMENTS', code: 'CUSTOMER_ACCEPTANCE_MISSING', message: 'Missing BAST' },
          { domain: 'ACCEPTANCE_DOCUMENTS', code: 'FINAL_REPORT_MISSING', message: 'Missing Final Report' },
        ],
        warnings: [],
      } as any);

      await expect(
        service.submitClosure(1, { submissionNotes: 'Closing project' }, 2, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ConflictException);

      // Verify no ProjectClosure was saved and no workflow instance started
      expect(mockWorkflowEngine.startInstance).not.toHaveBeenCalled();
    });
  });

  // ==============================================================
  // PHASE 13 — WORKFLOW / OUTBOX / AUDIT FLOW
  // ==============================================================
  describe('Phase 13: Workflow, Outbox & Audit End-to-End Cycle', () => {
    const readyProject = {
      id: 10,
      code: 'PRJ-READY-10',
      name: 'Project 10 Ready',
      status: 'IN_PROGRESS',
      managerId: 2,
    };

    beforeEach(() => {
      // Mock evaluateClosureReadiness to return ready: true
      jest.spyOn(service, 'evaluateClosureReadiness').mockResolvedValue({
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

    it('1. PM Submit -> creates Closure cycle 1, starts HOO workflow, emits project.closure.submitted and AuditLog', async () => {
      mockManager.findOne.mockImplementation(async (entity: any, opt: any) => {
        if (entity === Project) return { ...readyProject };
        if (entity === ProjectClosure) return null; // No previous cycle
        return null;
      });

      const closure = await service.submitClosure(10, { submissionNotes: 'Pekerjaan 100% selesai' }, 2, ['PROJECT_MANAGER']);

      expect(closure).toBeDefined();
      expect(closure.status).toBe(ProjectClosureStatus.PENDING_HOO_REVIEW);
      expect(closure.cycleNumber).toBe(1);

      // Verifies workflow instance started
      expect(mockWorkflowEngine.startInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowKey: 'PROJECT_CLOSURE',
          entityType: 'PROJECT_CLOSURE',
          entityId: closure.id,
        }),
        2,
        mockManager,
      );

      // Verifies AuditLog created
      const auditCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === AuditLog);
      expect(auditCalls.length).toBeGreaterThan(0);
      const submitAudit = auditCalls.find((c: any) => c[1].action === 'PROJECT_CLOSURE_SUBMITTED');
      expect(submitAudit).toBeDefined();
      expect(submitAudit[1].created_by).toBe(2);

      // Verifies OutboxEvent created with project.closure.submitted
      const outboxCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === OutboxEvent);
      expect(outboxCalls.length).toBeGreaterThan(0);
      const submitOutbox = outboxCalls.find((c: any) => c[1].event_name === 'project.closure.submitted');
      expect(submitOutbox).toBeDefined();
      expect(submitOutbox[1].payload.projectId).toBe(10);
    });

    it('2. HOO Approve -> advances workflow to Director, emits project.closure.hoo.approved and AuditLog', async () => {
      const activeClosure = {
        id: 100,
        projectId: 10,
        cycleNumber: 1,
        status: ProjectClosureStatus.PENDING_HOO_REVIEW,
      };

      mockManager.findOne.mockImplementation(async (entity: any, opt: any) => {
        if (entity === Project) return { ...readyProject };
        if (entity === ProjectClosure) return { ...activeClosure };
        return null;
      });

      mockManager.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 55, workflowInstanceId: 10, nodeId: 'node_hoo_review' }),
      });

      const approved = await service.hooApprove(10, 100, { notes: 'Disetujui HOO' }, 3, ['HEAD_OF_OPERATIONS']);

      expect(approved.status).toBe(ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL);
      expect(mockWorkflowEngine.completeTask).toHaveBeenCalledWith(
        55,
        expect.objectContaining({ action: 'APPROVE' }),
        3,
        ['HEAD_OF_OPERATIONS'],
        mockManager,
      );

      // Outbox and Audit
      const outboxCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === OutboxEvent);
      const hooOutbox = outboxCalls.find((c: any) => c[1].event_name === 'project.closure.hoo.approved');
      expect(hooOutbox).toBeDefined();

      const auditCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === AuditLog);
      const hooAudit = auditCalls.find((c: any) => c[1].action === 'PROJECT_CLOSURE_HOO_APPROVED');
      expect(hooAudit).toBeDefined();
    });

    it('3. HOO Return -> returns to PM revision, emits project.closure.hoo.returned and AuditLog', async () => {
      const activeClosure = {
        id: 100,
        projectId: 10,
        cycleNumber: 1,
        status: ProjectClosureStatus.PENDING_HOO_REVIEW,
      };

      mockManager.findOne.mockImplementation(async (entity: any, opt: any) => {
        if (entity === Project) return { ...readyProject };
        if (entity === ProjectClosure) return { ...activeClosure };
        return null;
      });

      mockManager.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 55, workflowInstanceId: 10, nodeId: 'node_hoo_review' }),
      });

      const returned = await service.hooReturn(10, 100, { reason: 'BAST kurang stempel' }, 3, ['HEAD_OF_OPERATIONS']);

      expect(returned.status).toBe(ProjectClosureStatus.RETURNED);
      expect(mockWorkflowEngine.completeTask).toHaveBeenCalledWith(
        55,
        expect.objectContaining({ action: 'RETURN', reason: 'BAST kurang stempel' }),
        3,
        ['HEAD_OF_OPERATIONS'],
        mockManager,
      );

      const outboxCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === OutboxEvent);
      const returnOutbox = outboxCalls.find((c: any) => c[1].event_name === 'project.closure.hoo.returned');
      expect(returnOutbox).toBeDefined();
    });

    it('4. Director Approve -> marks Project CLOSED atomically, emits director approved & project.closed events and AuditLog', async () => {
      const pendingDirectorClosure = {
        id: 100,
        projectId: 10,
        cycleNumber: 1,
        status: ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL,
        hooReviewerId: 3,
        hooReviewedAt: new Date(),
      };

      const projectEntity: any = { ...readyProject };

      mockManager.findOne.mockImplementation(async (entity: any, opt: any) => {
        if (entity === Project) return projectEntity;
        if (entity === ProjectClosure) return { ...pendingDirectorClosure };
        return null;
      });

      mockManager.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 66, workflowInstanceId: 10, nodeId: 'node_director_approval' }),
      });

      const closed = await service.directorApprove(10, 100, { notes: 'Penutupan disetujui Direktur' }, 4, ['DIRECTOR']);

      expect(closed.closure.status).toBe(ProjectClosureStatus.APPROVED);
      expect(projectEntity.status).toBe('CLOSED');
      expect(projectEntity.closedBy).toBe(4);
      expect(projectEntity.actualFinishAt).toEqual(new Date('2026-10-15T10:00:00.000Z'));

      expect(mockWorkflowEngine.completeTask).toHaveBeenCalledWith(
        66,
        expect.objectContaining({ action: 'APPROVE' }),
        4,
        ['DIRECTOR'],
        mockManager,
      );

      // Verifies director.approved outbox event
      const outboxCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === OutboxEvent);
      const dirOutbox = outboxCalls.find((c: any) => c[1].event_name === 'project.closure.director.approved');
      expect(dirOutbox).toBeDefined();
      expect(dirOutbox[1].payload.businessPayload.closedAt).toBeDefined();
      expect(dirOutbox[1].payload.businessPayload.closedBy).toBe(4);

      // Verifies AuditLog
      const auditCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === AuditLog);
      const dirAudit = auditCalls.find((c: any) => c[1].action === 'PROJECT_CLOSURE_DIRECTOR_APPROVED');
      expect(dirAudit).toBeDefined();
    });

    it('5. Director Return -> returns to PM revision, emits project.closure.director.returned and AuditLog', async () => {
      const pendingDirectorClosure = {
        id: 100,
        projectId: 10,
        cycleNumber: 1,
        status: ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL,
        hooReviewerId: 3,
        hooReviewedAt: new Date(),
      };

      mockManager.findOne.mockImplementation(async (entity: any, opt: any) => {
        if (entity === Project) return { ...readyProject };
        if (entity === ProjectClosure) return { ...pendingDirectorClosure };
        return null;
      });

      mockManager.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 66, workflowInstanceId: 10, nodeId: 'node_director_approval' }),
      });

      const returned = await service.directorReturn(10, 100, { reason: 'Perlu verifikasi ulang biaya' }, 4, ['DIRECTOR']);

      expect(returned.status).toBe(ProjectClosureStatus.RETURNED);
      expect(mockWorkflowEngine.completeTask).toHaveBeenCalledWith(
        66,
        expect.objectContaining({ action: 'RETURN', reason: 'Perlu verifikasi ulang biaya' }),
        4,
        ['DIRECTOR'],
        mockManager,
      );

      const outboxCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === OutboxEvent);
      const returnOutbox = outboxCalls.find((c: any) => c[1].event_name === 'project.closure.director.returned');
      expect(returnOutbox).toBeDefined();
    });
  });
});
