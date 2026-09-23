import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { Contract } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { SaveWbsTreeDto } from './dto/save-wbs-tree.dto';
import { SaveCostEstimateDto } from './dto/save-cost-estimate.dto';
import { SaveProjectScheduleDto } from './dto/save-project-schedule.dto';
import { SaveInitialConditionDto } from './dto/save-initial-condition.dto';

describe('SEC-02 & SEC-03: Project Planning PM Ownership Boundaries', () => {
  let service: ProjectService;
  let projectRepoMock: any;
  let userRepoMock: any;
  let wbsRepoMock: any;
  let taskRepoMock: any;
  let costEstimateRepoMock: any;
  let initialConditionRepoMock: any;
  let managementReviewRepoMock: any;

  const ASSIGNED_PM_ID = 101;
  const UNASSIGNED_PM_ID = 202;
  const SUPER_ADMIN_ID = 999;
  const PROJECT_ID = 10;

  const mockProject: Partial<Project> = {
    id: PROJECT_ID,
    code: 'PRJ-2026-FTTH-01',
    name: 'FTTH Jakarta Timur',
    managerId: ASSIGNED_PM_ID,
    status: 'PLANNING',
  };

  const validWbsDto: SaveWbsTreeDto = {
    nodes: [
      {
        code: '1.0',
        name: 'Persiapan Site',
        level: 1,
        weightPercentage: 100,
      },
    ],
  };

  const validCostDto: SaveCostEstimateDto = {
    categories: [
      {
        categoryKey: 'MATERIAL',
        mode: 'ITEMIZED',
        items: [
          { itemName: 'Kabel FO', quantity: 1, unitPrice: 10000000, assignmentScope: 'PROJECT' },
        ],
      },
    ],
  };

  const validScheduleDto: SaveProjectScheduleDto = {
    tasks: [
      {
        wbsId: 1,
        name: 'Survey Rute',
        startDate: '2026-09-01',
        endDate: '2026-09-10',
      },
    ],
  };

  const validInitialConditionDto: SaveInitialConditionDto = {
    conditionStatus: 'NORMAL',
    locationCondition: 'Site ready for installation',
    initialConstraints: 'Standard local permit required',
    initialRisks: 'Weather condition',
  };

  beforeEach(async () => {
    projectRepoMock = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === PROJECT_ID) return Promise.resolve({ ...mockProject });
        return Promise.resolve(null);
      }),
    };

    userRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === SUPER_ADMIN_ID) {
          return Promise.resolve({ id: SUPER_ADMIN_ID, roles: [{ name: 'SUPER_ADMIN' }] });
        }
        if (where.id === ASSIGNED_PM_ID) {
          return Promise.resolve({ id: ASSIGNED_PM_ID, roles: [{ name: 'PROJECT_MANAGER' }] });
        }
        if (where.id === UNASSIGNED_PM_ID) {
          return Promise.resolve({ id: UNASSIGNED_PM_ID, roles: [{ name: 'PROJECT_MANAGER' }] });
        }
        return Promise.resolve(null);
      }),
    };

    const fakeManager = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation((cls, opts) => {
        if (cls === Project) {
          return projectRepoMock.findOne(opts);
        }
        if (cls === ProjectManagementReview) {
          return managementReviewRepoMock.findOne(opts);
        }
        if (cls === WorkBreakdownStructure) {
          return wbsRepoMock.findOne ? wbsRepoMock.findOne(opts) : Promise.resolve(null);
        }
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((cls, data) => Promise.resolve({ ...data, id: data?.id || 1 })),
      create: jest.fn().mockImplementation((cls, data) => ({ ...data, id: 1 })),
    };

    wbsRepoMock = {
      find: jest.fn().mockResolvedValue([
        { id: 1, projectId: PROJECT_ID, code: '1.0', name: 'Persiapan Site', level: 1, weightPercentage: 100, parentWbsId: null, deletedAt: null },
      ]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => ({ ...dto, id: 1 })),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: 1 })),
      manager: {
        transaction: jest.fn((cb) => cb(fakeManager)),
      },
    };

    taskRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      manager: {
        transaction: jest.fn((cb) => cb(fakeManager)),
      },
    };

    costEstimateRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
      manager: {
        transaction: jest.fn((cb) => cb(fakeManager)),
      },
    };

    initialConditionRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => ({ ...dto, id: 1 })),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: 1 })),
    };

    managementReviewRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
      manager: {
        transaction: jest.fn((cb) => cb(fakeManager)),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        CostEstimateValidator,
        ScheduleValidator,
        InitialConditionValidator,
        ManagementReviewValidator,
        OperationalReadinessValidator,
        { provide: getRepositoryToken(Project), useValue: projectRepoMock },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: wbsRepoMock },
        { provide: getRepositoryToken(Task), useValue: taskRepoMock },
        { provide: getRepositoryToken(Contract), useValue: { findOne: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: costEstimateRepoMock },
        { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: initialConditionRepoMock },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: managementReviewRepoMock },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  describe('SEC-02: saveWbsTree PM Ownership', () => {
    it('Assigned PM dapat edit WBS tree', async () => {
      const res = await service.saveWbsTree(PROJECT_ID, validWbsDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
      expect(res).toBeDefined();
      expect(res.statusCode).toBe(200);
    });

    it('PM lain ditolak ForbiddenException', async () => {
      await expect(
        service.saveWbsTree(PROJECT_ID, validWbsDto, UNASSIGNED_PM_ID, ['PROJECT_MANAGER'])
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.saveWbsTree(PROJECT_ID, validWbsDto, UNASSIGNED_PM_ID, ['PROJECT_MANAGER'])
      ).rejects.toThrow(/Anda bukan Project Manager yang ditugaskan/);
    });

    it('SUPER_ADMIN tetap dapat edit WBS tree', async () => {
      const res = await service.saveWbsTree(PROJECT_ID, validWbsDto, SUPER_ADMIN_ID, ['SUPER_ADMIN']);
      expect(res).toBeDefined();
      expect(res.statusCode).toBe(200);
    });
  });

  describe('SEC-03: saveCostEstimate PM Ownership', () => {
    it('Assigned PM berhasil simpan Cost Estimate (RAB)', async () => {
      const res = await service.saveCostEstimate(PROJECT_ID, validCostDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
      expect(res).toBeDefined();
    });

    it('PM lain ditolak ForbiddenException saat simpan Cost Estimate', async () => {
      await expect(
        service.saveCostEstimate(PROJECT_ID, validCostDto, UNASSIGNED_PM_ID, ['PROJECT_MANAGER'])
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SEC-03: saveProjectSchedule PM Ownership', () => {
    it('Assigned PM berhasil simpan Project Schedule', async () => {
      const res = await service.saveProjectSchedule(PROJECT_ID, validScheduleDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
      expect(res).toBeDefined();
    });

    it('PM lain ditolak ForbiddenException saat simpan Project Schedule', async () => {
      await expect(
        service.saveProjectSchedule(PROJECT_ID, validScheduleDto, UNASSIGNED_PM_ID, ['PROJECT_MANAGER'])
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SEC-03: saveInitialCondition PM Ownership', () => {
    it('Assigned PM berhasil simpan Initial Condition', async () => {
      const res = await service.saveInitialCondition(PROJECT_ID, validInitialConditionDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
      expect(res).toBeDefined();
    });

    it('PM lain ditolak ForbiddenException saat simpan Initial Condition', async () => {
      await expect(
        service.saveInitialCondition(PROJECT_ID, validInitialConditionDto, UNASSIGNED_PM_ID, ['PROJECT_MANAGER'])
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SEC-03: submitManagementReview PM Ownership', () => {
    beforeEach(() => {
      // Mock getOperationalReadiness to return READY for submit test
      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        overallStatus: 'READY',
        completenessCount: 4,
      } as any);
    });

    it('Assigned PM dapat submit Management Review', async () => {
      const res = await service.submitManagementReview(PROJECT_ID, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
      expect(res).toBeDefined();
      expect(res.status).toBe('REVIEW_PENDING');
    });

    it('PM lain ditolak ForbiddenException saat submit Management Review', async () => {
      await expect(
        service.submitManagementReview(PROJECT_ID, UNASSIGNED_PM_ID, ['PROJECT_MANAGER'])
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('PHASE 4B: Unified Planning Freeze Matrix & Lifecycle Boundary', () => {
    // 1. Minimal Matrix for Cost/RAB
    describe('Cost/RAB Freeze Matrix', () => {
      it('NOT_SUBMITTED -> ALLOW', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'NOT_SUBMITTED' });
        const res = await service.saveCostEstimate(PROJECT_ID, validCostDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });

      it('REVIEW_PENDING -> DENY (ConflictException)', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'REVIEW_PENDING' });
        await expect(
          service.saveCostEstimate(PROJECT_ID, validCostDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('NEEDS_REVISION -> ALLOW', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'NEEDS_REVISION' });
        const res = await service.saveCostEstimate(PROJECT_ID, validCostDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });

      it('READY_FOR_KICKOFF -> DENY (ConflictException)', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'READY_FOR_KICKOFF' });
        await expect(
          service.saveCostEstimate(PROJECT_ID, validCostDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });
    });

    // 2. Minimal Matrix for WBS
    describe('WBS Freeze Matrix', () => {
      it('NOT_SUBMITTED -> ALLOW', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'NOT_SUBMITTED' });
        const res = await service.saveWbsTree(PROJECT_ID, validWbsDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });

      it('REVIEW_PENDING -> DENY (ConflictException)', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'REVIEW_PENDING' });
        await expect(
          service.saveWbsTree(PROJECT_ID, validWbsDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('NEEDS_REVISION -> ALLOW', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'NEEDS_REVISION' });
        const res = await service.saveWbsTree(PROJECT_ID, validWbsDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });

      it('READY_FOR_KICKOFF -> DENY (ConflictException)', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'READY_FOR_KICKOFF' });
        await expect(
          service.saveWbsTree(PROJECT_ID, validWbsDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });
    });

    // 3. Minimal Matrix for Schedule
    describe('Schedule Freeze Matrix', () => {
      it('NOT_SUBMITTED -> ALLOW', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'NOT_SUBMITTED' });
        const res = await service.saveProjectSchedule(PROJECT_ID, validScheduleDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });

      it('REVIEW_PENDING -> DENY (ConflictException)', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'REVIEW_PENDING' });
        await expect(
          service.saveProjectSchedule(PROJECT_ID, validScheduleDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('NEEDS_REVISION -> ALLOW', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'NEEDS_REVISION' });
        const res = await service.saveProjectSchedule(PROJECT_ID, validScheduleDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });

      it('READY_FOR_KICKOFF -> DENY (ConflictException)', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'READY_FOR_KICKOFF' });
        await expect(
          service.saveProjectSchedule(PROJECT_ID, validScheduleDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });
    });

    // 4. Minimal Matrix for Initial Condition
    describe('Initial Condition Freeze Matrix', () => {
      it('NOT_SUBMITTED -> ALLOW', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'NOT_SUBMITTED' });
        const res = await service.saveInitialCondition(PROJECT_ID, validInitialConditionDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });

      it('REVIEW_PENDING -> DENY (ConflictException)', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'REVIEW_PENDING' });
        await expect(
          service.saveInitialCondition(PROJECT_ID, validInitialConditionDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('NEEDS_REVISION -> ALLOW', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'NEEDS_REVISION' });
        const res = await service.saveInitialCondition(PROJECT_ID, validInitialConditionDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });

      it('READY_FOR_KICKOFF -> DENY (ConflictException)', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'READY_FOR_KICKOFF' });
        await expect(
          service.saveInitialCondition(PROJECT_ID, validInitialConditionDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });
    });

    // 5. Project IN_PROGRESS Mutation Denied on all 4 pillars
    describe('Project IN_PROGRESS Lock (All 4 Pillars)', () => {
      beforeEach(() => {
        projectRepoMock.findOne.mockResolvedValue({
          ...mockProject,
          status: 'IN_PROGRESS',
        });
        managementReviewRepoMock.findOne.mockResolvedValue(null);
      });

      it('Cost/RAB denied when project IN_PROGRESS', async () => {
        await expect(
          service.saveCostEstimate(PROJECT_ID, validCostDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('WBS denied when project IN_PROGRESS', async () => {
        await expect(
          service.saveWbsTree(PROJECT_ID, validWbsDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('Schedule denied when project IN_PROGRESS', async () => {
        await expect(
          service.saveProjectSchedule(PROJECT_ID, validScheduleDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('Initial Condition denied when project IN_PROGRESS', async () => {
        await expect(
          service.saveInitialCondition(PROJECT_ID, validInitialConditionDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });
    });

    // 6. Legacy Endpoints (createWbs & createTask) Hardening
    describe('Legacy Endpoints: createWbs & createTask Ownership & Freeze Matrix', () => {
      const legacyWbsDto = {
        projectId: PROJECT_ID,
        code: '1.1',
        name: 'Legacy Deliverable',
        level: 1,
        weightPercentage: 50,
      };

      const legacyTaskDto = {
        wbsId: 50,
        name: 'Legacy Task',
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      };

      beforeEach(() => {
        projectRepoMock.findOne.mockResolvedValue({
          ...mockProject,
          status: 'PLANNING',
        });
        wbsRepoMock.findOne.mockResolvedValue({
          id: 50,
          projectId: PROJECT_ID,
          code: '1.1',
          name: 'Parent WBS',
        });
        managementReviewRepoMock.findOne.mockResolvedValue({
          id: 1,
          projectId: PROJECT_ID,
          status: 'NOT_SUBMITTED',
        });
      });

      it('createWbs: denied for unassigned PM (ForbiddenException)', async () => {
        await expect(
          service.createWbs(legacyWbsDto as any, UNASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('createWbs: denied when project is IN_PROGRESS (ConflictException)', async () => {
        projectRepoMock.findOne.mockResolvedValue({
          ...mockProject,
          status: 'IN_PROGRESS',
        });
        await expect(
          service.createWbs(legacyWbsDto as any, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('createWbs: denied when review is REVIEW_PENDING or READY_FOR_KICKOFF (ConflictException)', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({
          id: 1,
          projectId: PROJECT_ID,
          status: 'READY_FOR_KICKOFF',
        });
        await expect(
          service.createWbs(legacyWbsDto as any, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('createWbs: allowed when review is NOT_SUBMITTED or NEEDS_REVISION for assigned PM', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({
          id: 1,
          projectId: PROJECT_ID,
          status: 'NEEDS_REVISION',
        });
        const res = await service.createWbs(legacyWbsDto as any, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });

      it('createTask: denied for unassigned PM (ForbiddenException)', async () => {
        await expect(
          service.createTask(legacyTaskDto as any, UNASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('createTask: denied when project is IN_PROGRESS (ConflictException)', async () => {
        projectRepoMock.findOne.mockResolvedValue({
          ...mockProject,
          status: 'IN_PROGRESS',
        });
        await expect(
          service.createTask(legacyTaskDto as any, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('createTask: denied when review is READY_FOR_KICKOFF (ConflictException)', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({
          id: 1,
          projectId: PROJECT_ID,
          status: 'READY_FOR_KICKOFF',
        });
        await expect(
          service.createTask(legacyTaskDto as any, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ConflictException);
      });

      it('createTask: allowed when review is NOT_SUBMITTED for assigned PM', async () => {
        managementReviewRepoMock.findOne.mockResolvedValue({
          id: 1,
          projectId: PROJECT_ID,
          status: 'NOT_SUBMITTED',
        });
        const res = await service.createTask(legacyTaskDto as any, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });
    });

    // 7. Critical Regression Simulation
    describe('Critical Regression Test: Planning Review Simulation Sequence', () => {
      it('Simulate review lifecycle freeze-unfreeze-freeze for all 4 pillars', async () => {
        // Step 1: Project PLANNING, Review = REVIEW_PENDING -> REJECT ALL 4
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'REVIEW_PENDING' });
        await expect(service.saveCostEstimate(PROJECT_ID, validCostDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);
        await expect(service.saveWbsTree(PROJECT_ID, validWbsDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);
        await expect(service.saveProjectSchedule(PROJECT_ID, validScheduleDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);
        await expect(service.saveInitialCondition(PROJECT_ID, validInitialConditionDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);

        // Step 2: Review = NEEDS_REVISION -> ALLOW ALL 4
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'NEEDS_REVISION' });
        expect(await service.saveCostEstimate(PROJECT_ID, validCostDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).toBeDefined();
        expect(await service.saveWbsTree(PROJECT_ID, validWbsDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).toBeDefined();
        expect(await service.saveProjectSchedule(PROJECT_ID, validScheduleDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).toBeDefined();
        expect(await service.saveInitialCondition(PROJECT_ID, validInitialConditionDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).toBeDefined();

        // Step 3: Review = READY_FOR_KICKOFF -> REJECT ALL 4
        managementReviewRepoMock.findOne.mockResolvedValue({ id: 1, projectId: PROJECT_ID, status: 'READY_FOR_KICKOFF' });
        await expect(service.saveCostEstimate(PROJECT_ID, validCostDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);
        await expect(service.saveWbsTree(PROJECT_ID, validWbsDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);
        await expect(service.saveProjectSchedule(PROJECT_ID, validScheduleDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);
        await expect(service.saveInitialCondition(PROJECT_ID, validInitialConditionDto, ASSIGNED_PM_ID, ['PROJECT_MANAGER'])).rejects.toThrow(ConflictException);
      });
    });
  });
});
