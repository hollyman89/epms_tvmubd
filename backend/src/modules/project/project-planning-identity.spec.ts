import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';

describe('Project Planning Lifecycle Activation — Phase 1A Identity Tests', () => {
  let service: ProjectService;
  let projectRepo: jest.Mocked<Repository<Project>>;
  let contractRepo: jest.Mocked<Repository<Contract>>;
  let userRepo: jest.Mocked<Repository<User>>;

  const mockExistingProject1: any = {
    id: 1,
    code: 'CONT-20260722-1127',
    name: 'Project Yofc Sleman',
    status: 'IN_PROGRESS',
    managerId: 5,
    startDate: '2026-08-01',
    endDate: '2026-12-31',
    siteName: 'Site Sleman',
    address: 'Jl. Kaliurang',
    city: 'Sleman',
    province: 'DIY',
    postalCode: '55581',
    latitude: -7.7123,
    longitude: 110.3644,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockApprovedContract12: any = {
    id: 12,
    version: 1,
    proposal_id: 18,
    tender_id: 18,
    customer_id: 4,
    contract_number: 'CONT-20260819-0012',
    contract_value: 50000000,
    start_date: new Date('2026-09-01'),
    end_date: new Date('2026-11-30'),
    status: 'ACTIVE',
    legal_status: LegalStatus.APPROVED,
    legal_reviewer_id: 2,
    legal_notes: 'Approved legal SPK',
    spk_file_url: 'https://storage/spk-12.pdf',
    proposal: {
      id: 18,
      tender_id: 18,
      proposed_amount: 50000000,
      tender: {
        id: 18,
        title: 'Rumah Net FKI Karawang',
        estimated_budget: 50000000,
        project_location: 'Karawang',
      },
    },
    customer: {
      id: 4,
      name: 'PT. Fiber Kerumah Indonesia',
    },
    legal_reviewer: null,
    project_manager_id: 5,
    project_manager: null,
    ops_team_activated_at: new Date(),
    grace_deadline: null,
    grace_extension_count: 0,
    grace_extended_by: null,
    grace_extended_by_user: null,
    grace_extended_at: null,
    amendments: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        CostEstimateValidator,
        ScheduleValidator,
        InitialConditionValidator,
        ManagementReviewValidator,
        OperationalReadinessValidator,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Contract),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            manager: {
              transaction: jest.fn(),
            },
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([
              { id: 5, fullName: 'Project Manager Test' },
              { id: 2, fullName: 'Marketing PIC Test' },
            ]),
          },
        },
        {
          provide: getRepositoryToken(WorkBreakdownStructure),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Task),
          useValue: { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProjectCostEstimate),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(CostItem),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProjectInitialCondition),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProjectManagementReview),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(PurchaseRequest),
          useValue: { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    projectRepo = module.get(getRepositoryToken(Project));
    contractRepo = module.get(getRepositoryToken(Contract));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('1. Canonical Planning Project Initialization & Idempotency', () => {
    it('should lazily create a Project in status PLANNING for approved Contract #12', async () => {
      contractRepo.findOne.mockResolvedValue(mockApprovedContract12);
      projectRepo.findOne.mockResolvedValue(null);

      const createdProject: any = {
        id: 12,
        code: 'CONT-20260819-0012',
        name: 'Rumah Net FKI Karawang',
        status: 'PLANNING',
        managerId: 5,
        siteName: 'Site Rumah Net FKI Karawang',
        city: 'Karawang',
        address: null,
        province: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      projectRepo.create.mockReturnValue(createdProject);
      projectRepo.save.mockResolvedValue(createdProject);

      const result = await service.ensureProjectForContract(12);

      expect(result).toBeDefined();
      expect(result.id).toBe(12);
      expect(result.code).toBe('CONT-20260819-0012');
      expect(result.status).toBe('PLANNING');
      expect(projectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CONT-20260819-0012',
          status: 'PLANNING',
          name: 'Rumah Net FKI Karawang',
        })
      );
      expect(projectRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should be strictly idempotent: return existing project without creating duplicate', async () => {
      const existingPlanningProject: any = {
        id: 12,
        code: 'CONT-20260819-0012',
        name: 'Rumah Net FKI Karawang',
        status: 'PLANNING',
        managerId: 5,
        siteName: 'Site Rumah Net FKI Karawang',
        city: 'Karawang',
        address: null,
        province: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      contractRepo.findOne.mockResolvedValue(mockApprovedContract12);
      projectRepo.findOne.mockResolvedValue(existingPlanningProject);

      const result = await service.ensureProjectForContract(12);

      expect(result).toBe(existingPlanningProject);
      expect(projectRepo.create).not.toHaveBeenCalled();
      expect(projectRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('2. Operational Board Identity & Status Exposure', () => {
    it('should expose distinct contractId and canonical projectId in pendingKickoff while keeping status PLANNING', async () => {
      const existingPlanningProject: any = {
        id: 12,
        code: 'CONT-20260819-0012',
        name: 'Rumah Net FKI Karawang',
        status: 'PLANNING',
        managerId: 5,
        siteName: 'Site Rumah Net FKI Karawang',
        city: 'Karawang',
        address: null,
        province: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      projectRepo.find.mockResolvedValue([mockExistingProject1, existingPlanningProject]);
      contractRepo.find
        .mockResolvedValueOnce([mockApprovedContract12]) // approvedContracts
        .mockResolvedValueOnce([mockApprovedContract12]); // allContracts

      const board = await service.getOperationalBoard(1, ['PMO']);

      expect(board.statusCode).toBe(200);
      expect(board.data.pendingKickoff).toHaveLength(1);
      const pendingItem = board.data.pendingKickoff[0];

      // Verify explicit identity separation
      expect(pendingItem.id).toBe(12); // for backward UI compatibility
      expect(pendingItem.contractId).toBe(12); // explicit Contract ID
      expect(pendingItem.projectId).toBe(12); // explicit canonical Project ID
      expect(pendingItem.project_code).toBe('CONT-20260819-0012');
      expect(pendingItem.status).toBe('PENDING_KICKOFF');
      expect(pendingItem.projectStatus).toBe('PLANNING');

      // Verify active projects contains only non-planning active projects (Project #1)
      expect(board.data.activeProjects).toHaveLength(1);
      expect(board.data.activeProjects[0].id).toBe(1);
      expect(board.data.activeProjects[0].project_code).toBe('CONT-20260722-1127');
      expect(board.data.activeProjects[0].status).toBe('IN_PROGRESS');
    });

    it('should NOT trigger kickoff and should NOT mutate Project #1', async () => {
      projectRepo.find.mockResolvedValue([mockExistingProject1]);
      contractRepo.find
        .mockResolvedValueOnce([mockApprovedContract12])
        .mockResolvedValueOnce([mockApprovedContract12]);

      const createdProject: any = {
        id: 12,
        code: 'CONT-20260819-0012',
        name: 'Rumah Net FKI Karawang',
        status: 'PLANNING',
        managerId: 5,
        siteName: 'Site Rumah Net FKI Karawang',
        city: 'Karawang',
        address: null,
        province: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      projectRepo.create.mockReturnValue(createdProject);
      projectRepo.save.mockResolvedValue(createdProject);

      const board = await service.getOperationalBoard(1, ['PMO']);

      expect(board.data.pendingKickoff[0].projectStatus).toBe('PLANNING');
      expect(mockExistingProject1.status).toBe('IN_PROGRESS');
      expect(mockExistingProject1.id).toBe(1);
    });
  });
});
