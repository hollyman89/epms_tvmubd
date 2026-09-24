import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from '../../entities/project.entity';
import { ProjectBaseline } from '../../entities/project-baseline.entity';
import { ProjectBaselineWbsItem } from '../../entities/project-baseline-wbs-item.entity';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { ModuleRef } from '@nestjs/core';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';

describe('Project Baseline Query (P6.6-3)', () => {
  let service: ProjectService;
  let inMemoryProjects: Project[] = [];
  let inMemoryBaselines: ProjectBaseline[] = [];

  beforeEach(async () => {
    inMemoryProjects = [
      {
        id: 10,
        managerId: 100,
      } as Project,
      {
        id: 20,
        managerId: 999, // Someone else
      } as Project
    ];

    inMemoryBaselines = [
      {
        id: 101,
        project_id: 10,
        version_number: 1,
        status: 'ACTIVE',
        total_weight_percentage: 100,
        activated_at: new Date('2026-03-01T08:00:00Z'),
        wbs_items: [{}, {}, {}, {}] // 4 items
      } as unknown as ProjectBaseline
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            findOne: jest.fn().mockImplementation(({ where }) => {
              const p = inMemoryProjects.find(pr => pr.id === where.id);
              return Promise.resolve(p || null);
            }),
            manager: {
              query: jest.fn().mockResolvedValue([]), // mock query for overall progress
            }
          },
        },
        {
          provide: getRepositoryToken(ProjectBaseline),
          useValue: {
            findOne: jest.fn().mockImplementation(({ where }) => {
              const b = inMemoryBaselines.find(bs => bs.project_id === where.project_id && bs.status === where.status);
              return Promise.resolve(b || null);
            }),
          },
        },
        { provide: getRepositoryToken(ProjectBaselineWbsItem), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(PurchaseRequest), useValue: {} },
        { provide: EventEmitter2, useValue: {} },
        { provide: WorkflowEngineService, useValue: {} },
        { provide: ModuleRef, useValue: {} },
        { provide: CostEstimateValidator, useValue: {} },
        { provide: ScheduleValidator, useValue: {} },
        { provide: OperationalReadinessValidator, useValue: {} },
        { provide: InitialConditionValidator, useValue: {} },
        { provide: ManagementReviewValidator, useValue: {} },
        { provide: 'ProjectCostEstimateRepository', useValue: {} },
        { provide: 'CostItemRepository', useValue: {} },
        { provide: 'ProjectInitialConditionRepository', useValue: {} },
        { provide: 'ProjectManagementReviewRepository', useValue: {} },
        { provide: 'AuditLogRepository', useValue: {} },
        { provide: 'ContractRepository', useValue: {} },
        { provide: 'WorkBreakdownStructureRepository', useValue: {} },
        { provide: 'TaskRepository', useValue: {} },
        { provide: 'ProjectProgressLogRepository', useValue: {} },
        { provide: 'ProjectProgressEvidenceRepository', useValue: {} },
        { provide: 'DocumentRepository', useValue: {} },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);

    // Mock calculateProjectOverallProgress to avoid complex SQL queries in unit test
    jest.spyOn(service, 'calculateProjectOverallProgress').mockResolvedValue(70.0);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. Returns baseline response shape and reuses existing calculation', async () => {
    const result = await service.getProjectActiveBaseline(10);
    expect(result.hasActiveBaseline).toBe(true);
    expect(result.overallProgress).toBe(70.0);
    expect(result.baseline).toBeDefined();
    expect(result.baseline?.versionNumber).toBe(1);
    expect(result.baseline?.status).toBe('ACTIVE');
    expect(result.baseline?.totalWeightPercentage).toBe(100);
    expect(result.baseline?.wbsItemCount).toBe(4);
    expect(service.calculateProjectOverallProgress).toHaveBeenCalledWith(10);
  });

  it('2. Handles project with no active baseline gracefully', async () => {
    const result = await service.getProjectActiveBaseline(20);
    expect(result.hasActiveBaseline).toBe(false);
    expect(result.overallProgress).toBe(70.0);
    expect(result.baseline).toBeNull();
  });

  it('3. Throws BadRequestException if projectId is invalid', async () => {
    await expect(service.getProjectActiveBaseline(NaN)).rejects.toThrow(BadRequestException);
    await expect(service.getProjectActiveBaseline(0)).rejects.toThrow(BadRequestException);
  });

  it('4. Throws NotFoundException if project does not exist', async () => {
    await expect(service.getProjectActiveBaseline(99)).rejects.toThrow(NotFoundException);
  });

  describe('Authorization Checks', () => {
    it('Allows SUPER_ADMIN', async () => {
      await expect(service.getProjectActiveBaseline(10, 999, ['SUPER_ADMIN'])).resolves.toBeDefined();
    });

    it('Allows PMO', async () => {
      await expect(service.getProjectActiveBaseline(10, 999, ['PMO'])).resolves.toBeDefined();
    });

    it('Allows HEAD_OF_OPERATIONS', async () => {
      await expect(service.getProjectActiveBaseline(10, 999, ['HEAD_OF_OPERATIONS'])).resolves.toBeDefined();
    });

    it('Allows DIRECTOR and GENERAL_MANAGER', async () => {
      await expect(service.getProjectActiveBaseline(10, 999, ['DIRECTOR'])).resolves.toBeDefined();
      await expect(service.getProjectActiveBaseline(10, 999, ['GENERAL_MANAGER'])).resolves.toBeDefined();
    });

    it('Allows assigned PROJECT_MANAGER', async () => {
      await expect(service.getProjectActiveBaseline(10, 100, ['PROJECT_MANAGER'])).resolves.toBeDefined();
    });

    it('Rejects unassigned PROJECT_MANAGER', async () => {
      await expect(service.getProjectActiveBaseline(10, 999, ['PROJECT_MANAGER'])).rejects.toThrow(ForbiddenException);
    });

    it('Rejects MARKETING, FINANCE, PROCUREMENT without other valid roles', async () => {
      await expect(service.getProjectActiveBaseline(10, 999, ['MARKETING'])).rejects.toThrow(ForbiddenException);
      await expect(service.getProjectActiveBaseline(10, 999, ['FINANCE'])).rejects.toThrow(ForbiddenException);
      await expect(service.getProjectActiveBaseline(10, 999, ['PROCUREMENT'])).rejects.toThrow(ForbiddenException);
    });
  });
});
