import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('SEC-04 & SEC-05: Project Charter Authorization Boundaries', () => {
  let service: ProjectService;
  let contractRepoMock: any;
  let projectRepoMock: any;
  let userRepoMock: any;
  let savedEntities: any[] = [];

  const ASSIGNED_PM_ID = 101;
  const OTHER_PM_ID = 102;
  const MARKETING_PIC_ID = 201;
  const OTHER_MARKETING_ID = 202;
  const SUPER_ADMIN_ID = 999;
  const CONTRACT_ID = 50;

  const validRejectReason = 'Alasan penolakan charter minimal 15 karakter untuk evaluasi PM';

  beforeEach(async () => {
    savedEntities = [];

    const fakeManager = {
      save: jest.fn().mockImplementation((entityOrClass, entityData) => {
        const toSave = entityData || entityOrClass;
        savedEntities.push(toSave);
        return Promise.resolve(toSave);
      }),
      create: jest.fn().mockImplementation((entityClass, dto) => dto),
      findOne: jest.fn().mockResolvedValue(null),
    };

    contractRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      manager: {
        transaction: jest.fn((cb) => cb(fakeManager)),
      },
    };

    projectRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn(),
    };

    userRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === SUPER_ADMIN_ID) {
          return Promise.resolve({ id: SUPER_ADMIN_ID, roles: [{ name: 'SUPER_ADMIN' }] });
        }
        if (where.id === ASSIGNED_PM_ID || where.id === OTHER_PM_ID) {
          return Promise.resolve({ id: where.id, roles: [{ name: 'PROJECT_MANAGER' }] });
        }
        if (where.id === MARKETING_PIC_ID || where.id === OTHER_MARKETING_ID) {
          return Promise.resolve({ id: where.id, roles: [{ name: 'MARKETING' }] });
        }
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        CostEstimateValidator,
        ScheduleValidator,
        InitialConditionValidator,
        ManagementReviewValidator,
        OperationalReadinessValidator,
        { provide: getRepositoryToken(Contract), useValue: contractRepoMock },
        { provide: getRepositoryToken(Project), useValue: projectRepoMock },
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Task), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  describe('SEC-04: Controller Role Protection for Reject Charter', () => {
    it('rejectCharterPatch harus memiliki role guard [PROJECT_MANAGER, SUPER_ADMIN]', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, ProjectController.prototype.rejectCharterPatch);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['PROJECT_MANAGER', 'SUPER_ADMIN']);
    });

    it('rejectCharterPost harus memiliki role guard [PROJECT_MANAGER, SUPER_ADMIN]', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, ProjectController.prototype.rejectCharterPost);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['PROJECT_MANAGER', 'SUPER_ADMIN']);
    });
  });

  describe('SEC-05: Controller Role Protection for Resubmit Charter', () => {
    it('resubmitCharterPatch harus memiliki role guard [MARKETING, SUPER_ADMIN]', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, ProjectController.prototype.resubmitCharterPatch);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['MARKETING', 'SUPER_ADMIN']);
    });

    it('resubmitCharterPost harus memiliki role guard [MARKETING, SUPER_ADMIN]', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, ProjectController.prototype.resubmitCharterPost);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['MARKETING', 'SUPER_ADMIN']);
    });
  });

  describe('SEC-04: Service Reject Charter Authorization', () => {
    const createMockActiveContract = () => ({
      id: CONTRACT_ID,
      contract_number: 'CONT-2026-FTTH-050',
      status: 'ACTIVE',
      legal_status: LegalStatus.APPROVED,
      project_manager_id: ASSIGNED_PM_ID,
      proposal: {
        tender: {
          marketing_pic_id: MARKETING_PIC_ID,
        },
      },
    });

    it('Assigned PROJECT_MANAGER dapat reject charter', async () => {
      const mockContract = createMockActiveContract();
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      const res = await service.rejectCharter(
        CONTRACT_ID,
        { reason: validRejectReason },
        ASSIGNED_PM_ID,
        ['PROJECT_MANAGER'],
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('PM_RETURNED');
      expect(res.data.legal_status).toBe(LegalStatus.APPROVED);
    });

    it('PROJECT_MANAGER lain ditolak ForbiddenException', async () => {
      const mockContract = createMockActiveContract();
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      await expect(
        service.rejectCharter(
          CONTRACT_ID,
          { reason: validRejectReason },
          OTHER_PM_ID,
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('MARKETING ditolak saat mencoba reject charter', async () => {
      const mockContract = createMockActiveContract();
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      await expect(
        service.rejectCharter(
          CONTRACT_ID,
          { reason: validRejectReason },
          MARKETING_PIC_ID,
          ['MARKETING'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN dapat override reject charter', async () => {
      const mockContract = createMockActiveContract();
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      const res = await service.rejectCharter(
        CONTRACT_ID,
        { reason: validRejectReason },
        SUPER_ADMIN_ID,
        ['SUPER_ADMIN'],
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('PM_RETURNED');
    });

    it('Reject TIDAK mengubah project_manager_id (ownership assignment strictly preserved)', async () => {
      const mockContract = createMockActiveContract();
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      await service.rejectCharter(
        CONTRACT_ID,
        { reason: validRejectReason },
        ASSIGNED_PM_ID,
        ['PROJECT_MANAGER'],
      );

      // Verify that the contract entity saved during transaction preserved original project_manager_id
      const savedContract = savedEntities.find((e) => e.contract_number === 'CONT-2026-FTTH-050');
      expect(savedContract).toBeDefined();
      expect(savedContract.project_manager_id).toBe(ASSIGNED_PM_ID);
    });

    it('Reject oleh SUPER_ADMIN juga TIDAK mengubah project_manager_id menjadi SUPER_ADMIN', async () => {
      const mockContract = createMockActiveContract();
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      await service.rejectCharter(
        CONTRACT_ID,
        { reason: validRejectReason },
        SUPER_ADMIN_ID,
        ['SUPER_ADMIN'],
      );

      const savedContract = savedEntities.find((e) => e.contract_number === 'CONT-2026-FTTH-050');
      expect(savedContract).toBeDefined();
      expect(savedContract.project_manager_id).toBe(ASSIGNED_PM_ID);
      expect(savedContract.project_manager_id).not.toBe(SUPER_ADMIN_ID);
    });
  });

  describe('SEC-05: Service Resubmit Charter Authorization', () => {
    const createMockReturnedContract = () => ({
      id: CONTRACT_ID,
      contract_number: 'CONT-2026-FTTH-050',
      status: 'PM_RETURNED',
      legal_status: LegalStatus.APPROVED,
      project_manager_id: ASSIGNED_PM_ID,
      proposal: {
        tender: {
          marketing_pic_id: MARKETING_PIC_ID,
        },
      },
    });

    it('Marketing PIC yang benar dapat resubmit charter', async () => {
      const mockContract = createMockReturnedContract();
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      const res = await service.resubmitCharter(
        CONTRACT_ID,
        MARKETING_PIC_ID,
        ['MARKETING'],
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('ACTIVE');
      expect(res.data.legal_status).toBe(LegalStatus.APPROVED);
    });

    it('Marketing user lain ditolak ForbiddenException', async () => {
      const mockContract = createMockReturnedContract();
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      await expect(
        service.resubmitCharter(
          CONTRACT_ID,
          OTHER_MARKETING_ID,
          ['MARKETING'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('PROJECT_MANAGER ditolak saat mencoba resubmit charter', async () => {
      const mockContract = createMockReturnedContract();
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      await expect(
        service.resubmitCharter(
          CONTRACT_ID,
          ASSIGNED_PM_ID,
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN dapat override resubmit charter', async () => {
      const mockContract = createMockReturnedContract();
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      const res = await service.resubmitCharter(
        CONTRACT_ID,
        SUPER_ADMIN_ID,
        ['SUPER_ADMIN'],
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('ACTIVE');
      expect(res.data.legal_status).toBe(LegalStatus.APPROVED);
    });

    it('Resubmit tetap mengikuti lifecycle existing (gagal jika status bukan PM_RETURNED)', async () => {
      const mockContract = createMockReturnedContract();
      mockContract.status = 'ACTIVE'; // Not PM_RETURNED
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      await expect(
        service.resubmitCharter(
          CONTRACT_ID,
          MARKETING_PIC_ID,
          ['MARKETING'],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Resubmit tetap mengikuti lifecycle existing (gagal jika legal_status bukan APPROVED)', async () => {
      const mockContract = createMockReturnedContract();
      mockContract.legal_status = LegalStatus.DRAFT; // Not APPROVED
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      await expect(
        service.resubmitCharter(
          CONTRACT_ID,
          MARKETING_PIC_ID,
          ['MARKETING'],
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
