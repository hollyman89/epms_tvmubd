import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { ProjectBaseline } from '../../entities/project-baseline.entity';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { ProjectWorkflowProjectionService } from './project-workflow-projection.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

describe('Phase 2B — Backend Authority Direction & Conflict Tests', () => {
  let service: ProjectService;
  let projectionService: ProjectWorkflowProjectionService;

  let mockProjectRepo: any;
  let mockContractRepo: any;
  let mockUserRepo: any;
  let mockWbsRepo: any;
  let mockTaskRepo: any;
  let mockCostEstimateRepo: any;
  let mockCostItemRepo: any;
  let mockInitialConditionRepo: any;
  let mockManagementReviewRepo: any;
  let mockPurchaseRequestRepo: any;
  let mockWorkflowEngineService: any;
  let mockTransactionManager: any;

  const validProjectId = 20;
  const validUserId = 10;

  let inMemoryProject: any;
  let inMemoryContract: any;
  let inMemoryReview: any;
  let inMemoryWorkflowInstance: any;

  beforeEach(async () => {
    inMemoryProject = {
      id: validProjectId,
      code: 'PRJ-020',
      name: 'Project #20 Test',
      status: 'PLANNING',
      managerId: validUserId,
      contractId: 1,
    };

    inMemoryContract = {
      id: 1,
      contract_number: 'PRJ-020',
      legal_status: LegalStatus.APPROVED,
      status: 'ACTIVE',
      project_manager_id: validUserId,
    };

    inMemoryReview = {
      id: 50,
      projectId: validProjectId,
      status: 'REVIEW_PENDING',
      reviewerRole: null,
      submittedBy: validUserId,
      decidedBy: null,
    };

    inMemoryWorkflowInstance = null;

    mockTransactionManager = {
      findOne: jest.fn().mockImplementation((cls: any, opts: any) => {
        if (cls === Project) return inMemoryProject;
        if (cls === Contract) return inMemoryContract;
        if (cls === ProjectManagementReview) return inMemoryReview;
        if (cls === ProjectCostEstimate) return { id: 1, projectId: validProjectId, status: 'DRAFT', version: 1 };
        return null;
      }),
      find: jest.fn().mockImplementation((cls: any) => {
        if (cls === Task) return [];
        return [];
      }),
      save: jest.fn().mockImplementation((cls: any, entity: any) => entity),
      create: jest.fn().mockImplementation((cls: any, data: any) => data),
    };

    mockProjectRepo = {
      findOne: jest.fn().mockImplementation(() => inMemoryProject),
      save: jest.fn().mockImplementation((p: any) => {
        inMemoryProject = { ...inMemoryProject, ...p };
        return inMemoryProject;
      }),
    };

    mockContractRepo = {
      findOne: jest.fn().mockImplementation(() => inMemoryContract),
      save: jest.fn().mockImplementation((c: any) => {
        inMemoryContract = { ...inMemoryContract, ...c };
        return inMemoryContract;
      }),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTransactionManager)),
      },
    };

    mockUserRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: validUserId,
        fullName: 'Test PM',
        roles: [{ id: 1, name: 'PROJECT_MANAGER' }],
      }),
      find: jest.fn().mockResolvedValue([]),
    };

    mockWbsRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 1, projectId: validProjectId, code: '1.0', name: 'Root Deliverable', weightPercentage: 100, isLeaf: true },
      ]),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTransactionManager)),
      },
    };

    mockTaskRepo = {
      find: jest.fn().mockResolvedValue([]),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTransactionManager)),
      },
    };

    mockCostEstimateRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1, projectId: validProjectId, status: 'DRAFT', version: 1 }),
      find: jest.fn().mockResolvedValue([]),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTransactionManager)),
      },
    };

    mockCostItemRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockInitialConditionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1, projectId: validProjectId, conditionStatus: 'NORMAL' }),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTransactionManager)),
      },
    };

    mockManagementReviewRepo = {
      findOne: jest.fn().mockImplementation(() => inMemoryReview),
      save: jest.fn().mockImplementation((r: any) => {
        inMemoryReview = { ...inMemoryReview, ...r };
        return inMemoryReview;
      }),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTransactionManager)),
      },
    };

    mockPurchaseRequestRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockWorkflowEngineService = {
      getInstanceByEntity: jest.fn().mockImplementation(() => inMemoryWorkflowInstance),
    };

    projectionService = new ProjectWorkflowProjectionService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        CostEstimateValidator,
        ScheduleValidator,
        InitialConditionValidator,
        ManagementReviewValidator,
        OperationalReadinessValidator,
        { provide: ProjectWorkflowProjectionService, useValue: projectionService },
        { provide: WorkflowEngineService, useValue: mockWorkflowEngineService },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: mockPurchaseRequestRepo },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: mockWbsRepo },
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: mockCostEstimateRepo },
        { provide: getRepositoryToken(CostItem), useValue: mockCostItemRepo },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: mockInitialConditionRepo },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: mockManagementReviewRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);

    // Mock readiness to return 4 pillars ready
    jest.spyOn(service, 'getOperationalReadiness').mockImplementation(async (pid: any) => {
      const activeInstance = inMemoryWorkflowInstance;
      const proj = projectionService.buildProjection(activeInstance, inMemoryReview);
      return {
        overallStatus: 'READY',
        completenessCount: 4,
        gate: {
          status: proj.businessStatus,
          currentNodeId: proj.currentNodeId,
          activeRole: proj.current.ownerRole,
        },
      } as any;
    });
  });

  // =========================================================================
  // DIRECTION OF AUTHORITY TESTS (PHASE 2B.10)
  // =========================================================================
  describe('PHASE 2B.10 — Direction of Authority Tests', () => {
    it('CASE A: Runtime node_finance_review + Legacy DB REVIEW_PENDING -> Canonical REVIEW_FINANCE, Finance owner, Baseline LOCKED, Kickoff NOT ALLOWED', async () => {
      inMemoryWorkflowInstance = {
        id: 8,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_finance_review',
        status: 'IN_PROGRESS',
        tasks: [{ id: 15, nodeId: 'node_finance_review', status: 'PENDING' }],
        transitions: [],
      };
      inMemoryReview.status = 'REVIEW_PENDING'; // Legacy stale DB

      // 1. Canonical Projection check
      const reviewRes = await service.getManagementReview(validProjectId);
      expect(reviewRes.status).toBe('REVIEW_FINANCE');
      expect(reviewRes.currentOwner).toBe('Finance Team');
      expect(reviewRes.currentStep).toBe('FINANCE_REVIEW');

      // 2. Baseline locks check: LOCKED
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);

      // 3. Formal kickoff check: NOT ALLOWED
      await expect(
        service.executeFormalKickoff(validProjectId, {} as any, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow(BadRequestException);
    });

    it('CASE B: Runtime node_end / COMPLETED + Legacy DB REVIEW_PENDING -> Kickoff ALLOWED (Runtime completion wins)', async () => {
      inMemoryWorkflowInstance = {
        id: 8,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_end',
        status: 'COMPLETED',
        tasks: [],
        transitions: [],
      };
      inMemoryReview.status = 'REVIEW_PENDING'; // Legacy stale DB

      // Formal kickoff check: ALLOWED because workflow runtime is COMPLETED
      const kickoffRes = await service.executeFormalKickoff(
        validProjectId,
        { estimatedStartDate: '2026-10-01' } as any,
        validUserId,
        ['PROJECT_MANAGER'],
      );
      expect(kickoffRes.statusCode).toBe(200);
      expect(kickoffRes.data.status).toBe('IN_PROGRESS');
    });

    it('CASE C: Runtime node_hops_review + Legacy DB READY_FOR_KICKOFF -> Kickoff BLOCKED (Legacy status cannot bypass engine)', async () => {
      inMemoryWorkflowInstance = {
        id: 8,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_hops_review',
        status: 'IN_PROGRESS',
        tasks: [{ id: 10, nodeId: 'node_hops_review', status: 'PENDING' }],
        transitions: [],
      };
      inMemoryReview.status = 'READY_FOR_KICKOFF'; // Legacy DB attempted bypass

      // Formal kickoff check: BLOCKED because runtime is still node_hops_review
      await expect(
        service.executeFormalKickoff(validProjectId, {} as any, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow(BadRequestException);
    });

    it('CASE D: Runtime PM revision node + Legacy DB REVIEW_FINANCE -> Baseline EDITABLE (Revision runtime wins over legacy lock)', async () => {
      inMemoryWorkflowInstance = {
        id: 8,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_pm_revision_hops',
        status: 'IN_PROGRESS',
        tasks: [{ id: 11, nodeId: 'node_pm_revision_hops', status: 'PENDING' }],
        transitions: [],
      };
      inMemoryReview.status = 'REVIEW_FINANCE'; // Legacy DB says REVIEW_FINANCE

      // Baseline locks check: EDITABLE (assertBaselineEditable does not throw)
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).resolves.not.toThrow();
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'Cost')).resolves.not.toThrow();
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'Schedule')).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // KICKOFF TESTS (PHASE 2B.12)
  // =========================================================================
  describe('PHASE 2B.12 — Kickoff Authority Tests', () => {
    it('allows kickoff when workflow instance is COMPLETED even if legacy mirror is stale', async () => {
      inMemoryWorkflowInstance = {
        id: 5,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_end',
        status: 'COMPLETED',
      };
      inMemoryReview.status = 'NOT_SUBMITTED';

      const res = await service.executeFormalKickoff(validProjectId, {} as any, validUserId, ['PROJECT_MANAGER']);
      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('IN_PROGRESS');
    });

    it('blocks kickoff when workflow instance is active even if legacy mirror says READY_FOR_KICKOFF', async () => {
      inMemoryWorkflowInstance = {
        id: 5,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_director_approval',
        status: 'IN_PROGRESS',
      };
      inMemoryReview.status = 'READY_FOR_KICKOFF';

      await expect(
        service.executeFormalKickoff(validProjectId, {} as any, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow(BadRequestException);
    });

    it('preserves legacy fallback when NO workflow instance exists and legacy review is READY_FOR_KICKOFF', async () => {
      inMemoryWorkflowInstance = null; // Pure legacy pre-workflow project
      inMemoryReview.status = 'READY_FOR_KICKOFF';

      const res = await service.executeFormalKickoff(validProjectId, {} as any, validUserId, ['PROJECT_MANAGER']);
      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('IN_PROGRESS');
    });

    it('blocks kickoff when NO workflow instance exists and legacy review is NOT_SUBMITTED', async () => {
      inMemoryWorkflowInstance = null; // Pure legacy pre-workflow project
      inMemoryReview.status = 'NOT_SUBMITTED';

      await expect(
        service.executeFormalKickoff(validProjectId, {} as any, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // BASELINE LOCK TESTS (PHASE 2B.13 & PHASE 2B.1 ISSUE 2)
  // =========================================================================
  describe('PHASE 2B.13 & ISSUE 2 — Baseline Lock Authority & Fail-Safe Tests', () => {
    it('allows edits during explicit PM planning (node_start / node_pm_planning)', async () => {
      inMemoryWorkflowInstance = { currentNodeId: 'node_pm_planning', status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).resolves.not.toThrow();

      inMemoryWorkflowInstance = { currentNodeId: 'node_start', status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'Cost')).resolves.not.toThrow();
    });

    it('locks edits when currentNodeId is empty string, null, or undefined (ISSUE 2 FAIL-SAFE)', async () => {
      inMemoryWorkflowInstance = { currentNodeId: '', status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'Schedule')).rejects.toThrow(ConflictException);

      inMemoryWorkflowInstance = { currentNodeId: null, status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);

      inMemoryWorkflowInstance = { currentNodeId: undefined, status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'Cost')).rejects.toThrow(ConflictException);
    });

    it('allows edits during explicit PM revision (node_pm_revision_*)', async () => {
      inMemoryWorkflowInstance = { currentNodeId: 'node_pm_revision_procurement', status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).resolves.not.toThrow();

      inMemoryWorkflowInstance = { currentNodeId: 'node_pm_revision_hops', status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'Cost')).resolves.not.toThrow();
    });

    it('locks edits during HOPS review (node_hops_review)', async () => {
      inMemoryWorkflowInstance = { currentNodeId: 'node_hops_review', status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);
    });

    it('locks edits during Procurement review (node_procurement_review)', async () => {
      inMemoryWorkflowInstance = { currentNodeId: 'node_procurement_review', status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);
    });

    it('locks edits during Finance review (node_finance_review)', async () => {
      inMemoryWorkflowInstance = { currentNodeId: 'node_finance_review', status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);
    });

    it('locks edits during Director approval (node_director_approval)', async () => {
      inMemoryWorkflowInstance = { currentNodeId: 'node_director_approval', status: 'IN_PROGRESS' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);
    });

    it('locks edits when workflow is COMPLETED (node_end)', async () => {
      inMemoryWorkflowInstance = { currentNodeId: 'node_end', status: 'COMPLETED' };
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);
    });

    it('legacy status mismatch does not override runtime lock', async () => {
      // Runtime is active Finance review, but legacy DB is NOT_SUBMITTED
      inMemoryWorkflowInstance = { currentNodeId: 'node_finance_review', status: 'IN_PROGRESS' };
      inMemoryReview.status = 'NOT_SUBMITTED';

      // Must lock based on runtime authority
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);
    });

    it('preserves legacy fallback editability when workflow instance is absent', async () => {
      inMemoryWorkflowInstance = null; // Legacy pre-workflow project
      inMemoryReview.status = 'NOT_SUBMITTED';
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).resolves.not.toThrow();

      inMemoryReview.status = 'REVIEW_PENDING';
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // SUBMIT MANAGEMENT REVIEW AUTHORITY (PHASE 2B.1 ISSUE 3)
  // =========================================================================
  describe('PHASE 2B.1 ISSUE 3 — submitManagementReview Authority & Fallback', () => {
    it('Workflow service exists, activeInstance = null, legacy status READY_FOR_KICKOFF -> blocks resubmit (legacy path works)', async () => {
      inMemoryWorkflowInstance = null;
      inMemoryReview.status = 'READY_FOR_KICKOFF';

      await expect(
        service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ConflictException);
    });

    it('Workflow service exists, activeInstance = null, legacy status NOT_SUBMITTED -> allows submit and starts instance', async () => {
      inMemoryWorkflowInstance = null;
      inMemoryReview.status = 'NOT_SUBMITTED';
      mockWorkflowEngineService.startInstance = jest.fn().mockResolvedValue({ id: 99 });

      const res = await service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']);
      expect(res.status).toBe('REVIEW_PENDING');
      expect(mockWorkflowEngineService.startInstance).toHaveBeenCalledWith(
        expect.objectContaining({ workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW', entityId: validProjectId }),
        validUserId,
      );
    });

    it('Workflow service exists, activeInstance = node_finance_review, legacy status NOT_SUBMITTED -> blocks submit (runtime authority rules)', async () => {
      inMemoryWorkflowInstance = {
        id: 8,
        currentNodeId: 'node_finance_review',
        status: 'IN_PROGRESS',
        tasks: [{ id: 14, nodeId: 'node_finance_review', status: 'PENDING' }],
      };
      inMemoryReview.status = 'NOT_SUBMITTED'; // Stale/malicious legacy mirror

      await expect(
        service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ConflictException);
    });

    it('Workflow service exists, activeInstance = node_pm_revision_hops, legacy status READY_FOR_KICKOFF -> executes runtime RESUBMIT path', async () => {
      inMemoryWorkflowInstance = {
        id: 8,
        currentNodeId: 'node_pm_revision_hops',
        status: 'IN_PROGRESS',
        tasks: [{ id: 25, nodeId: 'node_pm_revision_hops', status: 'PENDING' }],
      };
      inMemoryReview.status = 'READY_FOR_KICKOFF'; // Stale legacy mirror
      mockWorkflowEngineService.completeTask = jest.fn().mockResolvedValue({ success: true });

      const res = await service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']);
      expect(res.status).toBe('REVIEW_PENDING');
      expect(mockWorkflowEngineService.completeTask).toHaveBeenCalledWith(
        25,
        expect.objectContaining({ action: 'RESUBMIT' }),
        validUserId,
        ['PROJECT_MANAGER'],
      );
    });
  });

  // =========================================================================
  // UNKNOWN NODE FAIL-SAFE TESTS (PHASE 2B.14)
  // =========================================================================
  describe('PHASE 2B.14 — Unknown Node Fail-Safe', () => {
    it('blocks baseline mutation fail-safe when currentNodeId is unknown', async () => {
      inMemoryWorkflowInstance = { currentNodeId: 'node_custom_experimental_gate', status: 'IN_PROGRESS' };
      inMemoryReview.status = 'NOT_SUBMITTED'; // Even if legacy DB says NOT_SUBMITTED

      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);
    });

    it('returns UNKNOWN_WORKFLOW_STATE in canonical projection for unknown node', () => {
      const projection = projectionService.buildProjection({
        id: 99,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_custom_experimental_gate',
        status: 'IN_PROGRESS',
      } as any);

      expect(projection.businessStatus).toBe('UNKNOWN_WORKFLOW_STATE');
      expect(projection.current.status).toBe('UNKNOWN');
    });
  });

  // =========================================================================
  // AUTHORITY INVARIANT TESTS
  // =========================================================================
  describe('AUTHORITY INVARIANT SUITE — WorkflowInstance ALWAYS beats Legacy Mirror', () => {
    it('Invariant 1: Runtime Finance + Legacy NOT_SUBMITTED -> baseline LOCKED', async () => {
      inMemoryWorkflowInstance = { currentNodeId: 'node_finance_review', status: 'IN_PROGRESS' };
      inMemoryReview.status = 'NOT_SUBMITTED';

      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);
    });

    it('Invariant 2: Runtime PM revision + Legacy REVIEW_FINANCE -> baseline EDITABLE', async () => {
      inMemoryWorkflowInstance = { currentNodeId: 'node_pm_revision_procurement', status: 'IN_PROGRESS' };
      inMemoryReview.status = 'REVIEW_FINANCE';

      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).resolves.not.toThrow();
    });

    it('Invariant 3: Runtime PM revision + REJECT event -> canonical projection remains NEEDS_REVISION (never REJECTED)', () => {
      const projection = projectionService.buildProjection({
        id: 1,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_pm_revision_hops',
        status: 'IN_PROGRESS',
      } as any);

      expect(projection.businessStatus).toBe('NEEDS_REVISION');
      expect(projection.businessStatus).not.toBe('REJECTED');
    });

    it('Invariant 4: Runtime Finance + REJECT event -> canonical projection strictly follows runtime REVIEW_FINANCE', () => {
      const projection = projectionService.buildProjection({
        id: 1,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_finance_review',
        status: 'IN_PROGRESS',
      } as any);

      expect(projection.businessStatus).toBe('REVIEW_FINANCE');
      expect(projection.businessStatus).not.toBe('REJECTED');
    });
  });

  // =========================================================================
  // PHASE 2B.2 — FAIL-CLOSED ON WORKFLOW RUNTIME LOOKUP ERROR (TESTS A-F)
  // =========================================================================
  describe('PHASE 2B.2 — Fail-Closed on Workflow Runtime Lookup Error', () => {
    it('TEST A — INSTANCE EXISTS: runtime authority used, legacy ignored', async () => {
      inMemoryWorkflowInstance = {
        id: 8,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_finance_review',
        status: 'IN_PROGRESS',
        tasks: [{ id: 14, nodeId: 'node_finance_review', status: 'PENDING' }],
      };
      inMemoryReview.status = 'NOT_SUBMITTED'; // Stale legacy mirror

      // Attempting to submit when in Finance review must be BLOCKED by runtime authority
      await expect(
        service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ConflictException);
    });

    it('TEST B — INSTANCE GENUINELY ABSENT: lookup completes with null, compatibility / start workflow path allowed', async () => {
      inMemoryWorkflowInstance = null; // Genuinely absent
      inMemoryReview.status = 'NOT_SUBMITTED';
      mockWorkflowEngineService.startInstance = jest.fn().mockResolvedValue({ id: 101 });

      const res = await service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']);
      expect(res.status).toBe('REVIEW_PENDING');
      expect(mockWorkflowEngineService.startInstance).toHaveBeenCalled();
    });

    it('TEST C — LOOKUP DATABASE ERROR: getInstanceByEntity throws -> submission FAILS CLOSED (no fallback, no startInstance, no status modification)', async () => {
      mockWorkflowEngineService.getInstanceByEntity = jest.fn().mockRejectedValue(new Error('DB connection failed'));
      inMemoryReview.status = 'NOT_SUBMITTED';
      mockWorkflowEngineService.startInstance = jest.fn().mockResolvedValue({ id: 102 });

      // Must fail closed with the underlying database error
      await expect(
        service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow('DB connection failed');

      // CRITICAL: startInstance must NOT have been called
      expect(mockWorkflowEngineService.startInstance).not.toHaveBeenCalled();

      // CRITICAL: Review status must NOT have been mutated
      expect(inMemoryReview.status).toBe('NOT_SUBMITTED');
    });

    it('TEST D — WORKFLOW SERVICE ERROR: getInstanceByEntity throws internal workflow error -> FAIL CLOSED', async () => {
      mockWorkflowEngineService.getInstanceByEntity = jest.fn().mockRejectedValue(new Error('Internal workflow error'));

      await expect(
        service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow('Internal workflow error');
    });

    it('TEST E — LEGACY SAYS NOT_SUBMITTED BUT LOOKUP FAILS: still FAIL CLOSED, legacy status cannot rescue lookup error', async () => {
      mockWorkflowEngineService.getInstanceByEntity = jest.fn().mockRejectedValue(new Error('DB connection timeout'));
      inMemoryReview.status = 'NOT_SUBMITTED';

      // Baseline lock must fail closed: cannot edit despite legacy NOT_SUBMITTED
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(
        'DB connection timeout',
      );

      // Submission must also fail closed
      await expect(
        service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow('DB connection timeout');
    });

    it('TEST F — LEGACY SAYS READY_FOR_KICKOFF BUT LOOKUP FAILS: still FAIL CLOSED, legacy kickoff cannot bypass error', async () => {
      mockWorkflowEngineService.getInstanceByEntity = jest.fn().mockRejectedValue(new Error('Database unavailable'));
      inMemoryReview.status = 'READY_FOR_KICKOFF';

      // Kickoff gate must fail closed: cannot kickoff despite legacy READY_FOR_KICKOFF
      await expect(
        service.executeFormalKickoff(validProjectId, {} as any, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow('Database unavailable');

      // Submission must also fail closed
      await expect(
        service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow('Database unavailable');
    });

    it('THREE-STATE DIRECTION OF AUTHORITY INVARIANT: STATE A (runtime wins), STATE B (fallback allowed), STATE C (fails closed)', async () => {
      // STATE A: Instance exists -> Runtime wins
      mockWorkflowEngineService.getInstanceByEntity = jest.fn().mockResolvedValue({
        id: 8,
        entityType: 'PROJECT',
        entityId: validProjectId,
        currentNodeId: 'node_finance_review',
        status: 'IN_PROGRESS',
      });
      inMemoryReview.status = 'NOT_SUBMITTED';
      await expect(
        service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ConflictException);

      // STATE B: Instance confirmed absent -> Compatibility path allowed
      mockWorkflowEngineService.getInstanceByEntity = jest.fn().mockResolvedValue(null);
      mockWorkflowEngineService.startInstance = jest.fn().mockResolvedValue({ id: 200 });
      inMemoryReview.status = 'NOT_SUBMITTED';
      const stateBRes = await service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']);
      expect(stateBRes.status).toBe('REVIEW_PENDING');

      // STATE C: Instance lookup failed -> Fails closed
      mockWorkflowEngineService.getInstanceByEntity = jest.fn().mockRejectedValue(new Error('Fatal query error'));
      await expect(
        service.submitManagementReview(validProjectId, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow('Fatal query error');
      await expect(
        service.executeFormalKickoff(validProjectId, {} as any, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow('Fatal query error');
      await expect(
        service.assertBaselineEditable(validProjectId, undefined, 'WBS'),
      ).rejects.toThrow('Fatal query error');
    });
  });

  // =========================================================================
  // TYPEORM REPOSITORY VS ENTITYMANAGER SIGNATURE REGRESSION TESTS
  // =========================================================================
  describe('TYPEORM SIGNATURE REGRESSION — assertBaselineEditable Fallback', () => {
    beforeEach(() => {
      // Ensure workflow instance is absent so code exercises legacy fallback
      inMemoryWorkflowInstance = null;
      mockWorkflowEngineService.getInstanceByEntity = jest.fn().mockResolvedValue(null);
    });

    it('Scenario A: Project in PLANNING with no workflow instance and no management review -> editable, does not throw', async () => {
      mockManagementReviewRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).resolves.not.toThrow();
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'Cost')).resolves.not.toThrow();
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'Schedule')).resolves.not.toThrow();
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'InitialCondition')).resolves.not.toThrow();
    });

    it('Scenario B: When manager is undefined -> Repository.findOne must be called with options object only (NEVER with EntityTarget)', async () => {
      const repoFindOneSpy = jest.fn().mockResolvedValue(null);
      (service as any).managementReviewRepo = { findOne: repoFindOneSpy };

      await service.assertBaselineEditable(validProjectId, undefined, 'WBS');

      expect(repoFindOneSpy).toHaveBeenCalledTimes(1);
      // The first and only argument must be the options object: { where: { projectId: validProjectId } }
      const passedArg = repoFindOneSpy.mock.calls[0][0];
      expect(passedArg).toEqual({ where: { projectId: validProjectId } });
      // Crucial: Must NOT have been called with ProjectManagementReview entity constructor as first argument
      expect(typeof passedArg).toBe('object');
      expect(passedArg).not.toBe(ProjectManagementReview);
    });

    it('Scenario C: When manager is supplied -> manager.findOne must be called with (ProjectManagementReview, options)', async () => {
      const managerFindOneSpy = jest.fn().mockResolvedValue(null);
      const customManager = { findOne: managerFindOneSpy };

      await service.assertBaselineEditable(validProjectId, customManager, 'Cost');

      expect(managerFindOneSpy).toHaveBeenCalledTimes(1);
      expect(managerFindOneSpy).toHaveBeenCalledWith(
        ProjectManagementReview,
        expect.objectContaining({
          where: { projectId: validProjectId },
          lock: { mode: 'pessimistic_write' },
        }),
      );
    });

    it('Scenario D: When legacy review is in locked state -> throws ConflictException', async () => {
      (service as any).managementReviewRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          projectId: validProjectId,
          status: 'REVIEW_PENDING',
          deletedAt: null,
        }),
      };

      await expect(service.assertBaselineEditable(validProjectId, undefined, 'WBS')).rejects.toThrow(ConflictException);
      await expect(service.assertBaselineEditable(validProjectId, undefined, 'Cost')).rejects.toThrow(ConflictException);
    });

    it('Save methods regression: saveCostEstimate, saveWbsTree, saveProjectSchedule, saveInitialCondition pass guard without TypeORM crash', async () => {
      // Re-link repo and unlock review
      inMemoryReview = {
        id: 1,
        projectId: validProjectId,
        status: 'NOT_SUBMITTED',
        deletedAt: null,
      } as any;
      (service as any).managementReviewRepo = mockManagementReviewRepo;
      mockManagementReviewRepo.findOne = jest.fn().mockResolvedValue(null);

      // 1. saveCostEstimate
      const costDto = {
        categories: [{
          categoryKey: 'MATERIAL',
          mode: 'DIRECT',
          directSubtotal: 10000000,
        }],
        pmNotes: 'Test direct cost',
      };
      const costRes = await service.saveCostEstimate(validProjectId, costDto as any, validUserId, ['PROJECT_MANAGER']);
      expect(costRes).toBeDefined();

      // 2. saveWbsTree
      const wbsDto = {
        nodes: [{
          code: '1.0',
          name: 'Root Work Package',
          level: 1,
          weightPercentage: 100,
        }],
      };
      const wbsRes = await service.saveWbsTree(validProjectId, wbsDto as any, validUserId, ['PROJECT_MANAGER']);
      expect(wbsRes.statusCode).toBe(200);

      // 3. saveProjectSchedule
      const scheduleDto = {
        tasks: [{
          wbsId: 1,
          name: 'Deliverable Task',
          startDate: '2026-10-01',
          endDate: '2026-10-15',
          progress: 0,
        }],
      };
      const schedRes = await service.saveProjectSchedule(validProjectId, scheduleDto as any, validUserId, ['PROJECT_MANAGER']);
      expect(schedRes).toBeDefined();

      // 4. saveInitialCondition
      const condDto = {
        conditionStatus: 'NORMAL',
        locationCondition: 'Site clear',
        initialConstraints: 'None',
        initialRisks: 'None',
      };
      const condRes = await service.saveInitialCondition(validProjectId, condDto as any, validUserId, ['PROJECT_MANAGER']);
      expect(condRes).toBeDefined();
    });
  });
});

