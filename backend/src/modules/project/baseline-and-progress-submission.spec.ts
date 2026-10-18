import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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
import { AuditLog } from '../../entities/audit-log.entity';
import { ProjectBaseline } from '../../entities/project-baseline.entity';
import { ProjectBaselineWbsItem } from '../../entities/project-baseline-wbs-item.entity';
import { ProjectProgressLog } from '../../entities/project-progress-log.entity';
import { ProjectProgressEvidence } from '../../entities/project-progress-evidence.entity';
import { ScheduleValidator } from './schedule.validator';
import { CostEstimateValidator } from './cost-estimate.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { SaveProjectScheduleDto } from './dto/save-project-schedule.dto';

describe('P6.5-B1 — Baseline V1 & Routine Progress Submission Spec', () => {
  let service: ProjectService;

  // In-Memory Database State
  let inMemoryProjects: Project[];
  let inMemoryContracts: Contract[];
  let inMemoryWbs: WorkBreakdownStructure[];
  let inMemoryTasks: Task[];
  let inMemoryBaselines: ProjectBaseline[];
  let inMemoryBaselineWbsItems: ProjectBaselineWbsItem[];
  let inMemoryProgressLogs: ProjectProgressLog[];
  let inMemoryAuditLogs: AuditLog[];

  let nextBaselineId: number;
  let nextBaselineWbsItemId: number;
  let nextProgressLogId: number;
  let nextTaskId: number;

  const mockTransactionManager: any = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    nextBaselineId = 1;
    nextBaselineWbsItemId = 1;
    nextProgressLogId = 1;
    nextTaskId = 100;

    inMemoryProjects = [
      {
        id: 10,
        code: 'PRJ-2026-001',
        name: 'Fiber Optic Rollout',
        status: 'PLANNING',
        managerId: 1,
        startDate: '2026-03-01',
        endDate: '2026-06-30',
        siteName: 'Site Jakarta',
        city: 'Jakarta',
        address: 'Jl. Sudirman',
        province: 'DKI Jakarta',
        postalCode: '10220',
        latitude: -6.2,
        longitude: 106.8,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null as any,
        closures: [],
      },
    ];

    inMemoryContracts = [
      {
        id: 1,
        contract_number: 'PRJ-2026-001',
        contract_name: 'FO Rollout Contract',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: 1,
        proposal: {
          tender: {
            title: 'Fiber Optic Rollout',
            project_location: 'Jakarta',
          },
        } as any,
      } as unknown as Contract,
    ];

    inMemoryWbs = [
      {
        id: 101,
        projectId: 10,
        parentWbsId: null as any,
        code: '1.0',
        name: 'Civil Works Package',
        level: 1,
        weightPercentage: 50.0,
        description: 'Major package 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null as any,
      } as WorkBreakdownStructure,
      {
        id: 102,
        projectId: 10,
        parentWbsId: 101,
        code: '1.1',
        name: 'Trenching & Ducting',
        level: 2,
        weightPercentage: 50.0,
        description: 'Leaf deliverable 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null as any,
      } as WorkBreakdownStructure,
      {
        id: 201,
        projectId: 10,
        parentWbsId: null as any,
        code: '2.0',
        name: 'Cabling Package',
        level: 1,
        weightPercentage: 50.0,
        description: 'Major package 2',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null as any,
      } as WorkBreakdownStructure,
      {
        id: 202,
        projectId: 10,
        parentWbsId: 201,
        code: '2.1',
        name: 'Fiber Splicing & OTDR Test',
        level: 2,
        weightPercentage: 50.0,
        description: 'Leaf deliverable 2',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null as any,
      } as WorkBreakdownStructure,
    ];

    inMemoryTasks = [
      {
        id: 1,
        projectId: 10,
        wbsId: 102,
        name: 'Trenching Task',
        isMilestone: false,
        duration: 10,
        progress: 0.0,
        status: 'PLANNED',
        actualStartAt: null,
        actualFinishAt: null,
        startDate: '2026-03-01',
        endDate: '2026-03-10',
        assigneeId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null as any,
      } as Task,
      {
        id: 2,
        projectId: 10,
        wbsId: 202,
        name: 'Splicing Task',
        isMilestone: false,
        duration: 15,
        progress: 0.0,
        status: 'PLANNED',
        actualStartAt: null,
        actualFinishAt: null,
        startDate: '2026-03-11',
        endDate: '2026-03-25',
        assigneeId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null as any,
      } as Task,
    ];

    inMemoryBaselines = [];
    inMemoryBaselineWbsItems = [];
    inMemoryProgressLogs = [];
    inMemoryAuditLogs = [];

    // Mock Transaction Manager implementation simulating real transactional semantics
    mockTransactionManager.findOne = jest.fn().mockImplementation((entityClass, options) => {
      const id = options?.where?.id;
      const projId = options?.where?.projectId || options?.where?.project_id;
      const code = options?.where?.code;
      const status = options?.where?.status;

      if (entityClass === Project) {
        return inMemoryProjects.find((p) => (id ? p.id === id : p.code === code)) || null;
      }
      if (entityClass === ProjectBaseline) {
        return (
          inMemoryBaselines.find(
            (b) => b.project_id === projId && (status ? b.status === status : true),
          ) || null
        );
      }
      if (entityClass === Task) {
        return (
          inMemoryTasks.find(
            (t) => t.id === id && (projId ? t.projectId === projId : true) && !t.deletedAt,
          ) || null
        );
      }
      if (entityClass === ProjectBaselineWbsItem) {
        const where = options?.where || {};
        return (
          inMemoryBaselineWbsItems.find((item) => {
            if (where.id !== undefined && item.id !== where.id) return false;
            if (where.baseline_id !== undefined && item.baseline_id !== where.baseline_id) return false;
            if (where.task_id !== undefined && item.task_id !== where.task_id) return false;
            if (where.wbs_id !== undefined && item.wbs_id !== where.wbs_id) return false;
            if (where.is_leaf !== undefined && item.is_leaf !== where.is_leaf) return false;
            return true;
          }) || null
        );
      }
      return null;
    });

    mockTransactionManager.find = jest.fn().mockImplementation((entityClass, options) => {
      const projId = options?.where?.projectId || options?.where?.project_id;
      if (entityClass === WorkBreakdownStructure) {
        return inMemoryWbs.filter((w) => w.projectId === projId && !w.deletedAt);
      }
      if (entityClass === Task) {
        return inMemoryTasks.filter((t) => t.projectId === projId && !t.deletedAt);
      }
      if (entityClass === ProjectBaselineWbsItem) {
        const bId = options?.where?.baseline_id;
        return inMemoryBaselineWbsItems.filter((item) => item.baseline_id === bId);
      }
      return [];
    });

    mockTransactionManager.create = jest.fn().mockImplementation((entityClass, data) => {
      return { ...data };
    });

    mockTransactionManager.save = jest.fn().mockImplementation((entityClass, data) => {
      if (entityClass === Project) {
        const idx = inMemoryProjects.findIndex((p) => p.id === data.id);
        if (idx >= 0) inMemoryProjects[idx] = { ...data };
        else inMemoryProjects.push(data);
        return data;
      }
      if (entityClass === Contract) {
        const idx = inMemoryContracts.findIndex((c) => c.id === data.id);
        if (idx >= 0) inMemoryContracts[idx] = { ...data };
        return data;
      }
      if (entityClass === ProjectBaseline) {
        const saved = { ...data, id: nextBaselineId++ };
        inMemoryBaselines.push(saved);
        return saved;
      }
      if (entityClass === ProjectBaselineWbsItem) {
        const saved = { ...data, id: nextBaselineWbsItemId++ };
        inMemoryBaselineWbsItems.push(saved);
        return saved;
      }
      if (entityClass === ProjectProgressLog) {
        const saved = { ...data, id: nextProgressLogId++, created_at: new Date() };
        inMemoryProgressLogs.push(saved);
        return saved;
      }
      if (entityClass === Task) {
        if (data.id) {
          const idx = inMemoryTasks.findIndex((t) => t.id === data.id);
          if (idx >= 0) {
            inMemoryTasks[idx] = { ...data, updatedAt: new Date() };
            return inMemoryTasks[idx];
          }
        }
        const created = { ...data, id: nextTaskId++, createdAt: new Date(), updatedAt: new Date() };
        inMemoryTasks.push(created);
        return created;
      }
      if (entityClass === AuditLog) {
        const saved = { ...data, id: inMemoryAuditLogs.length + 1, created_at: new Date() };
        inMemoryAuditLogs.push(saved);
        return saved;
      }
      return data;
    });

    const mockContractRepo = {
      findOne: jest.fn().mockResolvedValue(inMemoryContracts[0]),
      find: jest.fn().mockResolvedValue(inMemoryContracts),
      manager: {
        transaction: jest.fn(async (cb) => cb(mockTransactionManager)),
      },
    };

    const mockProjectRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (Array.isArray(where)) {
          for (const cond of where) {
            if (cond?.id) {
              const found = inMemoryProjects.find((p) => p.id === cond.id);
              if (found) return Promise.resolve(found);
            }
            if (cond?.code) {
              const found = inMemoryProjects.find((p) => p.code === cond.code);
              if (found) return Promise.resolve(found);
            }
            if (cond?.contractId) {
              const found = inMemoryProjects.find((p) => p.contractId === cond.contractId);
              if (found) return Promise.resolve(found);
            }
          }
          return Promise.resolve(null);
        }
        if (where?.id) return Promise.resolve(inMemoryProjects.find((p) => p.id === where.id) || null);
        if (where?.code) return Promise.resolve(inMemoryProjects.find((p) => p.code === where.code) || null);
        return Promise.resolve(null);
      }),
      find: jest.fn().mockResolvedValue(inMemoryProjects),
      manager: mockContractRepo.manager,
    };

    const mockWbsRepo = {
      find: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(inMemoryWbs.filter((w) => w.projectId === where?.projectId && !w.deletedAt));
      }),
    };

    const mockTaskRepo = {
      find: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(inMemoryTasks.filter((t) => t.projectId === where?.projectId && !t.deletedAt));
      }),
      findOne: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(inMemoryTasks.find((t) => t.id === where?.id && !t.deletedAt) || null);
      }),
      manager: {
        transaction: jest.fn(async (cb) => cb(mockTransactionManager)),
      },
    };

    const mockUserRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where?.id === 1) {
          return Promise.resolve({
            id: 1,
            fullName: 'Budi PM',
            roles: [{ id: 1, name: 'PROJECT_MANAGER' }],
          });
        }
        if (where?.id === 99) {
          return Promise.resolve({
            id: 99,
            fullName: 'Other PM',
            roles: [{ id: 1, name: 'PROJECT_MANAGER' }],
          });
        }
        return Promise.resolve(null);
      }),
      find: jest.fn().mockResolvedValue([{ id: 1 }, { id: 99 }]),
    };

    const mockPurchaseRequestRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 1, projectId: 10, status: 'APPROVED', deletedAt: null },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        ScheduleValidator,
        CostEstimateValidator,
        InitialConditionValidator,
        ManagementReviewValidator,
        OperationalReadinessValidator,
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: mockWbsRepo },
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: mockPurchaseRequestRepo },
        { provide: getRepositoryToken(AuditLog), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ProjectBaseline), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ProjectBaselineWbsItem), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectProgressLog), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectProgressEvidence), useValue: { find: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);

    // Mock operational readiness to return READY
    jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
      overallStatus: 'READY',
      completenessCount: 4,
      gate: { status: 'READY_FOR_KICKOFF' },
    } as any);
  });

  describe('Part A — Kickoff Baseline V1 Snapshot Gate', () => {
    it('1. Kickoff creates exactly one ACTIVE Baseline V1 in the same transaction', async () => {
      expect(inMemoryBaselines.length).toBe(0);

      const res = await service.executeFormalKickoff(
        'PRJ-2026-001',
        { actualKickoffDate: '2026-03-01' },
        1,
        ['PROJECT_MANAGER'],
      );

      expect(res.statusCode).toBe(200);
      expect(inMemoryBaselines.length).toBe(1);

      const baseline = inMemoryBaselines[0];
      expect(baseline.project_id).toBe(10);
      expect(baseline.version_number).toBe(1);
      expect(baseline.status).toBe('ACTIVE');
      expect(baseline.description).toContain('Initial Contractual Baseline V1');
      expect(baseline.activated_at).toBeDefined();
    });

    it('2. Baseline contains expected WBS snapshot rows with leaf, task identity, and planned schedule dates', async () => {
      await service.executeFormalKickoff(
        'PRJ-2026-001',
        { actualKickoffDate: '2026-03-01' },
        1,
        ['PROJECT_MANAGER'],
      );

      expect(inMemoryBaselineWbsItems.length).toBe(4);

      // Package 1.0 (Parent, Non-Leaf)
      const wbs101 = inMemoryBaselineWbsItems.find((w) => w.wbs_id === 101);
      expect(wbs101).toBeDefined();
      expect(wbs101?.code).toBe('1.0');
      expect(wbs101?.is_leaf).toBe(false);
      expect(wbs101?.task_id).toBeNull();
      expect(wbs101?.planned_start_date).toBeNull();
      expect(wbs101?.planned_end_date).toBeNull();

      // Leaf 1.1 (Leaf, linked to Task #1)
      const wbs102 = inMemoryBaselineWbsItems.find((w) => w.wbs_id === 102);
      expect(wbs102).toBeDefined();
      expect(wbs102?.code).toBe('1.1');
      expect(wbs102?.is_leaf).toBe(true);
      expect(wbs102?.task_id).toBe(1);
      expect(wbs102?.task_name_snapshot).toBe('Trenching Task');
      expect(wbs102?.planned_start_date).toBe('2026-03-01');
      expect(wbs102?.planned_end_date).toBe('2026-03-10');
      expect(wbs102?.planned_duration).toBe(10);
      expect(wbs102?.is_milestone).toBe(false);

      // Leaf 2.1 (Leaf, linked to Task #2)
      const wbs202 = inMemoryBaselineWbsItems.find((w) => w.wbs_id === 202);
      expect(wbs202?.is_leaf).toBe(true);
      expect(wbs202?.task_id).toBe(2);
      expect(wbs202?.task_name_snapshot).toBe('Splicing Task');
      expect(wbs202?.planned_start_date).toBe('2026-03-11');
      expect(wbs202?.planned_end_date).toBe('2026-03-25');
      expect(wbs202?.planned_duration).toBe(15);
      expect(wbs202?.is_milestone).toBe(false);

      // Verify total leaf weight remains exactly 100%
      const leafItems = inMemoryBaselineWbsItems.filter((w) => w.is_leaf);
      const totalLeafWeight = leafItems.reduce((acc, curr) => acc + Number(curr.weight_percentage || 0), 0);
      expect(totalLeafWeight).toBe(100.0);
    });

    it('2b. Later task mutation cannot silently rewrite historical baseline snapshot dates', async () => {
      await service.executeFormalKickoff(
        'PRJ-2026-001',
        { actualKickoffDate: '2026-03-01' },
        1,
        ['PROJECT_MANAGER'],
      );

      const baselineItem1 = inMemoryBaselineWbsItems.find((w) => w.wbs_id === 102);
      expect(baselineItem1?.planned_start_date).toBe('2026-03-01');
      expect(baselineItem1?.planned_end_date).toBe('2026-03-10');
      expect(baselineItem1?.planned_duration).toBe(10);

      // Mutate task schedule dates and duration post-kickoff
      inMemoryTasks[0].startDate = '2026-04-01';
      inMemoryTasks[0].endDate = '2026-04-20';
      inMemoryTasks[0].duration = 20;

      // Assert historical baseline item remains completely unchanged (immutable SSOT)
      expect(baselineItem1?.planned_start_date).toBe('2026-03-01');
      expect(baselineItem1?.planned_end_date).toBe('2026-03-10');
      expect(baselineItem1?.planned_duration).toBe(10);
    });

    it('3. Kickoff is idempotent; does not create duplicate V1 on retry', async () => {
      await service.executeFormalKickoff('PRJ-2026-001', {}, 1, ['PROJECT_MANAGER']);
      expect(inMemoryBaselines.length).toBe(1);

      // Reset project status in memory to allow retry
      inMemoryProjects[0].status = 'PLANNING';

      await service.executeFormalKickoff('PRJ-2026-001', {}, 1, ['PROJECT_MANAGER']);
      expect(inMemoryBaselines.length).toBe(1);
      expect(inMemoryBaselines[0].version_number).toBe(1);
    });

    it('4. Audit entry BASELINE_ACTIVATED exists in audit_logs', async () => {
      await service.executeFormalKickoff('PRJ-2026-001', {}, 1, ['PROJECT_MANAGER']);

      const baselineAudit = inMemoryAuditLogs.find((a) => a.action === 'BASELINE_ACTIVATED');
      expect(baselineAudit).toBeDefined();
      expect(baselineAudit?.table_name).toBe('project_baselines');
      expect(baselineAudit?.new_value?.status).toBe('ACTIVE');
      expect(baselineAudit?.new_value?.versionNumber).toBe(1);
      expect(baselineAudit?.new_value?.wbsItemCount).toBe(4);
      expect(baselineAudit?.created_by).toBe(1);
    });
  });

  describe('Part B — Active Baseline Gate', () => {
    it('updates routine progress after kickoff without reverting the project to PLANNING', async () => {
      await service.executeFormalKickoff('PRJ-2026-001', {}, 1, ['PROJECT_MANAGER']);
      expect(inMemoryProjects[0].status).toBe('IN_PROGRESS');
      await (service as any).updateTaskProgress(10, 1, { progress: 35, expectedProgress: 0 }, 1, ['PROJECT_MANAGER']);
      expect(inMemoryTasks[0].progress).toBe(35);
      expect(inMemoryProjects[0].status).toBe('IN_PROGRESS');
    });

    it('8. No ACTIVE baseline: progress update rejected with 409 Conflict', async () => {
      expect(inMemoryBaselines.length).toBe(0);
      inMemoryProjects[0].status = 'IN_PROGRESS';

      await expect(
        service.updateTaskProgress(10, 1, { progress: 25.0, expectedProgress: 0 }, 1, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.updateTaskProgress(10, 1, { progress: 25.0, expectedProgress: 0 }, 1, ['PROJECT_MANAGER']),
      ).rejects.toThrow(/\[BASELINE_REQUIRED\] Proyek belum memiliki baseline aktif\./);

      // Verify zero progress mutation and zero ledger write
      expect(inMemoryTasks[0].progress).toBe(0.0);
      expect(inMemoryProgressLogs.length).toBe(0);
    });
  });

  describe('Part C & F — Routine Upward Progress & Atomic Transaction', () => {
    beforeEach(async () => {
      // Activate Baseline V1 first via Kickoff
      await service.executeFormalKickoff('PRJ-2026-001', {}, 1, ['PROJECT_MANAGER']);
    });

    it('5 & 6. Routine upward progress creates OFFICIAL ledger and updates tasks.progress atomically', async () => {
      const res = await service.updateTaskProgress(
        10,
        1,
        { progress: 35.0, expectedProgress: 0.0, reason: 'Week 1 Trenching Progress' },
        1,
        ['PROJECT_MANAGER'],
      );
      expect(res).toBeDefined();

      // 6. tasks.progress updated
      expect(inMemoryTasks[0].progress).toBe(35.0);

      // 5. OFFICIAL ledger record created
      expect(inMemoryProgressLogs.length).toBe(1);
      const log = inMemoryProgressLogs[0];
      expect(log.status).toBe('OFFICIAL');
      expect(log.event_type).toBe('ROUTINE_UPDATE');
    });

    it('7. Ledger contains correct previous_progress, reported_progress, delta, baseline_id, submitted_by, and status', async () => {
      await service.updateTaskProgress(
        10,
        1,
        { progress: 45.5, expectedProgress: 0.0, reason: 'Week 1 Trenching Progress' },
        1,
        ['PROJECT_MANAGER'],
      );

      const log = inMemoryProgressLogs[0];
      expect(log.project_id).toBe(10);
      expect(log.task_id).toBe(1);
      expect(log.wbs_id).toBe(102);
      expect(log.baseline_id).toBe(inMemoryBaselines[0].id);
      expect(log.previous_progress).toBe(0.0);
      expect(log.reported_progress).toBe(45.5);
      expect(log.progress_delta).toBe(45.5);
      expect(log.submitted_by).toBe(1);
      expect(log.verified_by).toBeNull();
      expect(log.status).toBe('OFFICIAL');
      expect(log.effective_date).toBeDefined();
    });

    it('7b. Incremental upward progress correctly captures previous progress and delta', async () => {
      // First update: 0% -> 30%
      await service.updateTaskProgress(
        10,
        1,
        { progress: 30.0, expectedProgress: 0.0 },
        1,
        ['PROJECT_MANAGER'],
      );
      expect(inMemoryTasks[0].progress).toBe(30.0);

      // Second update: 30% -> 75%
      await service.updateTaskProgress(
        10,
        1,
        { progress: 75.0, expectedProgress: 30.0 },
        1,
        ['PROJECT_MANAGER'],
      );
      expect(inMemoryTasks[0].progress).toBe(75.0);

      expect(inMemoryProgressLogs.length).toBe(2);
      const secondLog = inMemoryProgressLogs[1];
      expect(secondLog.previous_progress).toBe(30.0);
      expect(secondLog.reported_progress).toBe(75.0);
      expect(secondLog.progress_delta).toBe(45.0);
      expect(secondLog.status).toBe('OFFICIAL');
    });

    it('7c. Transition 0 -> >0 sets actualStartAt atomically; subsequent increments preserve original actualStartAt; reaching 100% sets actualFinishAt', async () => {
      expect(inMemoryTasks[0].actualStartAt).toBeNull();
      expect(inMemoryTasks[0].actualFinishAt).toBeNull();

      // Step 1: 0% -> 25% (First progress transition: sets actualStartAt)
      const res1 = await service.updateTaskProgress(
        10,
        1,
        { progress: 25.0, expectedProgress: 0.0 },
        1,
        ['PROJECT_MANAGER'],
      );
      expect(res1.actualStartAt).toBeDefined();
      expect(inMemoryTasks[0].actualStartAt).toBeInstanceOf(Date);
      expect(inMemoryTasks[0].actualFinishAt).toBeNull();
      const firstStartAt = inMemoryTasks[0].actualStartAt;

      // Step 2: 25% -> 60% (Subsequent progress increment: original actualStartAt MUST NOT change)
      const res2 = await service.updateTaskProgress(
        10,
        1,
        { progress: 60.0, expectedProgress: 25.0 },
        1,
        ['PROJECT_MANAGER'],
      );
      expect(res2.actualStartAt).toEqual(firstStartAt);
      expect(inMemoryTasks[0].actualStartAt).toEqual(firstStartAt);
      expect(inMemoryTasks[0].actualFinishAt).toBeNull();

      // Step 3: 60% -> 100% (Completion: sets actualFinishAt and status COMPLETED)
      const res3 = await service.updateTaskProgress(
        10,
        1,
        { progress: 100.0, expectedProgress: 60.0 },
        1,
        ['PROJECT_MANAGER'],
      );
      expect(res3.actualStartAt).toEqual(firstStartAt);
      expect(res3.actualFinishAt).toBeDefined();
      expect(inMemoryTasks[0].actualStartAt).toEqual(firstStartAt);
      expect(inMemoryTasks[0].actualFinishAt).toBeInstanceOf(Date);
      expect(inMemoryTasks[0].status).toBe('COMPLETED');
    });

    it('7d. Progress mutation remains authorized to assigned PM only (unauthorized PM rejected without mutating actualStartAt)', async () => {
      expect(inMemoryTasks[0].actualStartAt).toBeNull();

      // Unauthorized PM (id: 99) attempts progress mutation
      await expect(
        service.updateTaskProgress(
          10,
          1,
          { progress: 20.0, expectedProgress: 0.0 },
          99,
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(inMemoryTasks[0].progress).toBe(0.0);
      expect(inMemoryTasks[0].actualStartAt).toBeNull();
    });
  });

  describe('Part D — Downward Progress Guard (BD-03)', () => {
    beforeEach(async () => {
      // Activate Baseline V1 and establish initial progress at 60%
      await service.executeFormalKickoff('PRJ-2026-001', {}, 1, ['PROJECT_MANAGER']);
      await service.updateTaskProgress(
        10,
        1,
        { progress: 60.0, expectedProgress: 0.0 },
        1,
        ['PROJECT_MANAGER'],
      );
      expect(inMemoryTasks[0].progress).toBe(60.0);
      expect(inMemoryProgressLogs.length).toBe(1);
    });

    it('9. Downward progress: NOT written as OFFICIAL, rejected with [DOWNWARD_VERIFICATION_REQUIRED]', async () => {
      await expect(
        service.updateTaskProgress(
          10,
          1,
          { progress: 40.0, expectedProgress: 60.0 },
          1,
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateTaskProgress(
          10,
          1,
          { progress: 40.0, expectedProgress: 60.0 },
          1,
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow(/\[DOWNWARD_VERIFICATION_REQUIRED\]/);

      // Verify progress remains at official 60.0% and NO downward ledger entry was written
      expect(inMemoryTasks[0].progress).toBe(60.0);
      expect(inMemoryProgressLogs.length).toBe(1);
    });
  });

  describe('Part E — Authorization Boundary', () => {
    beforeEach(async () => {
      await service.executeFormalKickoff('PRJ-2026-001', {}, 1, ['PROJECT_MANAGER']);
    });

    it('10. Another PM (not assigned) cannot mutate schedule progress -> throws 403 Forbidden', async () => {
      // User #99 is a PM, but Project #10 managerId is 1
      await expect(
        service.updateTaskProgress(10, 1, { progress: 50.0, expectedProgress: 0.0 }, 99, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);
      expect(inMemoryTasks[0].progress).toBe(0.0);
    });

    it('10b. Super Admin has administrative bypass authority to update schedule', async () => {
      // User #99 is SUPER_ADMIN
      const res = await service.updateTaskProgress(
        10,
        1,
        { progress: 50.0, expectedProgress: 0.0 },
        99,
        ['SUPER_ADMIN'],
      );
      expect(res).toBeDefined();
      expect(inMemoryTasks[0].progress).toBe(50.0);
      expect(inMemoryProgressLogs[0].submitted_by).toBe(99);
    });
  });

  describe('Part F — Concurrency Simulation', () => {
    beforeEach(async () => {
      await service.executeFormalKickoff('PRJ-2026-001', {}, 1, ['PROJECT_MANAGER']);
    });

    it('11. Sequential submissions against task preserve consistent previous_progress chaining', async () => {
      // Step 1: 0% -> 20%
      await service.updateTaskProgress(10, 1, { progress: 20.0, expectedProgress: 0.0 }, 1, ['PROJECT_MANAGER']);
      // Step 2: 20% -> 50%
      await service.updateTaskProgress(10, 1, { progress: 50.0, expectedProgress: 20.0 }, 1, ['PROJECT_MANAGER']);
      // Step 3: 50% -> 80%
      await service.updateTaskProgress(10, 1, { progress: 80.0, expectedProgress: 50.0 }, 1, ['PROJECT_MANAGER']);

      expect(inMemoryProgressLogs.length).toBe(3);
      expect(inMemoryProgressLogs[0].previous_progress).toBe(0.0);
      expect(inMemoryProgressLogs[0].reported_progress).toBe(20.0);

      expect(inMemoryProgressLogs[1].previous_progress).toBe(20.0);
      expect(inMemoryProgressLogs[1].reported_progress).toBe(50.0);

      expect(inMemoryProgressLogs[2].previous_progress).toBe(50.0);
      expect(inMemoryProgressLogs[2].reported_progress).toBe(80.0);

      expect(inMemoryTasks[0].progress).toBe(80.0);
    });
  });
});
