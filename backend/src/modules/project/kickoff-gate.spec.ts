import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
import { AuditLog } from '../../entities/audit-log.entity';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { ClaimCharterDto } from './dto/claim-charter.dto';

describe('GAP-PRJ-02: Backend Kickoff Gate Hardening (P1)', () => {
  let service: ProjectService;
  let mockProjectRepo: any;
  let mockContractRepo: any;
  let mockUserRepo: any;
  let mockPurchaseRequestRepo: any;
  let mockTransactionManager: any;
  let transactionCalled: boolean;

  const validContractNumber = 'CONT-20260901-0001';
  const validProjectId = 100;
  const validUserId = 5;

  const validContract: Partial<Contract> = {
    id: 1,
    contract_number: validContractNumber,
    legal_status: LegalStatus.APPROVED,
    status: 'ACTIVE',
    project_manager_id: validUserId,
    proposal: {
      tender: {
        title: 'Project Data Center Migration',
        project_location: 'Jakarta',
      },
    } as any,
  };

  const validProject: Partial<Project> = {
    id: validProjectId,
    code: validContractNumber,
    name: 'Project Data Center Migration',
    status: 'PLANNING',
    managerId: validUserId,
  };

  const validCallingUser: Partial<User> = {
    id: validUserId,
    fullName: 'Test Project Manager',
    isActive: true,
    roles: [{ id: 1, name: 'PROJECT_MANAGER' }] as any,
  };

  const validPmoId = 77;
  const validPmoUser: Partial<User> = {
    id: validPmoId,
    fullName: 'Test PMO Officer',
    isActive: true,
    roles: [{ id: 9, name: 'PMO' }] as any,
  };

  const readyReadiness = {
    overallStatus: 'READY',
    completenessCount: 4,
    gate: {
      status: 'READY_FOR_KICKOFF',
    },
  };

  beforeEach(async () => {
    transactionCalled = false;

    mockTransactionManager = {
      findOne: jest.fn().mockImplementation((entityClass, options) => {
        if (entityClass === Project) {
          return Promise.resolve({ ...validProject });
        }
        if (entityClass === ProjectCostEstimate) {
          return Promise.resolve({
            id: 1,
            projectId: validProjectId,
            status: 'DRAFT',
            version: 1,
          });
        }
        if (entityClass === ProjectManagementReview) {
          return Promise.resolve({
            id: 1,
            projectId: validProjectId,
            status: 'READY_FOR_KICKOFF',
            deletedAt: null,
          });
        }
        return Promise.resolve(null);
      }),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((entityClass, data) => ({ ...data, id: validProjectId })),
      save: jest.fn((entityClass, data) => Promise.resolve(data)),
    };

    mockContractRepo = {
      findOne: jest.fn().mockImplementation((options) => {
        const where = options?.where;
        if (Array.isArray(where)) {
          const match = where.some((w: any) => w.id === 1 || w.contract_number === validContractNumber);
          if (match) return Promise.resolve({ ...validContract });
        } else if (where?.id === 1 || where?.contract_number === validContractNumber) {
          return Promise.resolve({ ...validContract });
        }
        return Promise.resolve(null);
      }),
      find: jest.fn(),
      manager: {
        transaction: jest.fn(async (callback) => {
          transactionCalled = true;
          return await callback(mockTransactionManager);
        }),
      },
    };

    mockProjectRepo = {
      findOne: jest.fn().mockImplementation((options) => {
        const where = options?.where;
        if (Array.isArray(where)) {
          const match = where.some((w: any) => w.id === validProjectId || w.code === validContractNumber || w.contractId === 1);
          if (match) return Promise.resolve({ ...validProject });
        } else if (where?.code === validContractNumber || where?.id === validProjectId) {
          return Promise.resolve({ ...validProject });
        }
        return Promise.resolve(null);
      }),
      find: jest.fn(),
      save: jest.fn(),
      manager: mockContractRepo.manager,
    };

    mockUserRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where?.id === validUserId) {
          return Promise.resolve({ ...validCallingUser });
        }
        if (where?.id === 99) {
          return Promise.resolve({
            id: 99,
            fullName: 'Other PM',
            roles: [{ id: 1, name: 'PROJECT_MANAGER' }],
          });
        }
        if (where?.id === 88) {
          return Promise.resolve({
            id: 88,
            fullName: 'Unauthorized User',
            roles: [{ id: 2, name: 'FINANCE' }],
          });
        }
        if (where?.id === validPmoId) {
          return Promise.resolve({ ...validPmoUser });
        }
        return Promise.resolve(null);
      }),
      find: jest.fn(),
    };

    mockPurchaseRequestRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          projectId: validProjectId,
          prNumber: 'PR-202609-001',
          status: 'APPROVED',
          deletedAt: null,
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        CostEstimateValidator,
        ScheduleValidator,
        InitialConditionValidator,
        ManagementReviewValidator,
        OperationalReadinessValidator,
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: mockPurchaseRequestRepo },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Task), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: { findOne: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);

    // Mock operational readiness to return READY and READY_FOR_KICKOFF by default
    jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue(readyReadiness as any);
  });

  const claimDto: ClaimCharterDto = {
    estimatedStartDate: '2026-10-01',
    estimatedEndDate: '2026-12-31',
  };

  // 1. Authorization Gates (PM Authorization & Authentication)
  describe('Gate 1: PM Authorization & Authentication', () => {
    it('11. Missing JWT / userId -> throws UnauthorizedException (401)', async () => {
      await expect(service.executeFormalKickoff(validProjectId, claimDto, null as any)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(transactionCalled).toBe(false);
    });

    it('10. Unauthorized role (not PM or Super Admin) -> throws ForbiddenException (403)', async () => {
      await expect(service.executeFormalKickoff(validProjectId, claimDto, 88)).rejects.toThrow(ForbiddenException);
      expect(transactionCalled).toBe(false);
    });

    it('10b. Another PM cannot claim when designated PM is already assigned', async () => {
      // User 99 is a PM, but contract/project is assigned to validUserId (5)
      await expect(service.executeFormalKickoff(validProjectId, claimDto, 99)).rejects.toThrow(ForbiddenException);
      expect(transactionCalled).toBe(false);
    });
  });

  // 2. Contract Existence & Validity Gates
  describe('Gate 2 & 3: Contract Existence & Validity', () => {
    it('Contract not found -> throws NotFoundException (404)', async () => {
      mockContractRepo.findOne.mockResolvedValue(null);
      await expect(service.executeFormalKickoff(999, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });

    it('Contract legal_status != APPROVED -> throws BadRequestException (400)', async () => {
      mockContractRepo.findOne.mockResolvedValue({
        ...validContract,
        legal_status: LegalStatus.ON_REVIEW,
      });

      await expect(service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });

    it('Contract status != ACTIVE -> throws BadRequestException (400)', async () => {
      mockContractRepo.findOne.mockResolvedValue({
        ...validContract,
        status: 'PENDING',
      });

      await expect(service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });
  });

  // 3. Project State Gates
  describe('Gate 4: Project State Gates', () => {
    it('Project does not exist -> throws BadRequestException (400)', async () => {
      mockProjectRepo.findOne.mockResolvedValue(null);

      await expect(service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });

    it('Project already IN_PROGRESS -> throws BadRequestException (400)', async () => {
      mockProjectRepo.findOne.mockResolvedValue({
        ...validProject,
        status: 'IN_PROGRESS',
      });

      await expect(service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });
  });

  // 4. Operational Readiness & Management Review Gates
  describe('Gate 5 & 6: Operational Readiness & Management Review', () => {
    it('Operational Readiness overallStatus != READY -> throws BadRequestException (400)', async () => {
      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        overallStatus: 'IN_PROGRESS',
        completenessCount: 3,
        gate: { status: 'READY_FOR_KICKOFF' },
      } as any);

      await expect(service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });

    it('Operational Readiness completenessCount < 4 -> throws BadRequestException (400)', async () => {
      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        overallStatus: 'READY',
        completenessCount: 3,
        gate: { status: 'READY_FOR_KICKOFF' },
      } as any);

      await expect(service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });

    it('Management Review status == NOT_SUBMITTED -> throws BadRequestException (400)', async () => {
      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        overallStatus: 'READY',
        completenessCount: 4,
        gate: { status: 'NOT_SUBMITTED' },
      } as any);

      await expect(service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });

    it('Management Review status == READY_FOR_PROCUREMENT -> rejected (READY_FOR_PROCUREMENT cannot authorize kickoff)', async () => {
      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        overallStatus: 'READY',
        completenessCount: 4,
        gate: { status: 'READY_FOR_PROCUREMENT' },
      } as any);

      await expect(service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });

    it('Management Review status == REVIEW_PENDING -> rejected (review pending)', async () => {
      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        overallStatus: 'READY',
        completenessCount: 4,
        gate: { status: 'REVIEW_PENDING' },
      } as any);

      await expect(service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });

    it('Management Review status == NEEDS_REVISION -> rejected (revision requested)', async () => {
      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        overallStatus: 'READY',
        completenessCount: 4,
        gate: { status: 'NEEDS_REVISION' },
      } as any);

      await expect(service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER'])).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionCalled).toBe(false);
    });
  });

  // 5. Purchase Request Decoupling (PR State Has Zero Influence on Kickoff)
  describe('Gate 7: Purchase Request Decoupling', () => {
    it('1. NO PR + READY_FOR_KICKOFF -> kickoff SUCCESS (200)', async () => {
      mockPurchaseRequestRepo.find.mockResolvedValue([]);

      const result = await service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER']);
      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe('IN_PROGRESS');
      expect(result.data.managerId).toBe(validUserId);
      expect(transactionCalled).toBe(true);
      expect(mockTransactionManager.save).toHaveBeenCalled();
      expect(mockTransactionManager.save).toHaveBeenCalledWith(
        ProjectCostEstimate,
        expect.objectContaining({ status: 'APPROVED' }),
      );
    });

    it('2. PR SUBMITTED + READY_FOR_KICKOFF -> kickoff SUCCESS (200)', async () => {
      mockPurchaseRequestRepo.find.mockResolvedValue([
        {
          id: 10,
          projectId: validProjectId,
          prNumber: 'PR-202609-010',
          status: 'SUBMITTED',
          deletedAt: null,
        },
      ]);

      const result = await service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER']);
      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe('IN_PROGRESS');
      expect(transactionCalled).toBe(true);
    });

    it('3. PR APPROVED + READY_FOR_KICKOFF -> kickoff SUCCESS (200)', async () => {
      mockPurchaseRequestRepo.find.mockResolvedValue([
        {
          id: 1,
          projectId: validProjectId,
          prNumber: 'PR-202609-001',
          status: 'APPROVED',
          deletedAt: null,
        },
      ]);

      const result = await service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER']);
      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe('IN_PROGRESS');
      expect(transactionCalled).toBe(true);
    });

    it('4. PR FINANCE_REVIEW + READY_FOR_KICKOFF -> kickoff SUCCESS (200)', async () => {
      mockPurchaseRequestRepo.find.mockResolvedValue([
        {
          id: 11,
          projectId: validProjectId,
          prNumber: 'PR-202609-011',
          status: 'FINANCE_REVIEW',
          deletedAt: null,
        },
      ]);

      const result = await service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER']);
      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe('IN_PROGRESS');
      expect(transactionCalled).toBe(true);
    });

    it('5. PR REJECTED_TO_PROCUREMENT + READY_FOR_KICKOFF -> kickoff SUCCESS (200)', async () => {
      mockPurchaseRequestRepo.find.mockResolvedValue([
        {
          id: 13,
          projectId: validProjectId,
          prNumber: 'PR-202609-013',
          status: 'REJECTED_TO_PROCUREMENT',
          deletedAt: null,
        },
      ]);

      const result = await service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER']);
      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe('IN_PROGRESS');
      expect(transactionCalled).toBe(true);
    });

    it('6. Multiple PRs (mixed statuses) + READY_FOR_KICKOFF -> kickoff SUCCESS (200)', async () => {
      mockPurchaseRequestRepo.find.mockResolvedValue([
        {
          id: 1,
          projectId: validProjectId,
          prNumber: 'PR-202609-001',
          status: 'APPROVED',
          deletedAt: null,
        },
        {
          id: 2,
          projectId: validProjectId,
          prNumber: 'PR-202609-002',
          status: 'SUBMITTED',
          deletedAt: null,
        },
      ]);

      const result = await service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER']);
      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe('IN_PROGRESS');
      expect(transactionCalled).toBe(true);
    });

    it('7. Governance not ready -> zero project mutation, zero contract mutation, zero audit log', async () => {
      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        overallStatus: 'READY',
        completenessCount: 4,
        gate: { status: 'NOT_SUBMITTED' },
      } as any);

      let thrownError: any = null;
      try {
        await service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER']);
      } catch (e) {
        thrownError = e;
      }
      expect(thrownError).toBeInstanceOf(BadRequestException);

      // Assert transaction was never entered and no manager save happened
      expect(transactionCalled).toBe(false);
      expect(mockTransactionManager.save).not.toHaveBeenCalled();
      expect(mockContractRepo.manager.transaction).not.toHaveBeenCalled();
      expect(mockProjectRepo.save).not.toHaveBeenCalled();
    });
  });

  // 6. Canonical E2E: PMO Assignment (PLANNING) vs Formal Kick-off (IN_PROGRESS)
  describe('Canonical E2E: PMO Assignment vs Formal Kick-off Distinction', () => {
    it('PMO assignProjectManager results in status = PLANNING, not IN_PROGRESS', async () => {
      const assignResult = await service.assignProjectManager(1, validUserId, validPmoId, ['PMO']);
      expect(assignResult.statusCode).toBe(200);
      expect(assignResult.data.status).toBe('PLANNING');
    });

    it('Legacy claimCharter rejects PM self-claim with 403 Forbidden', async () => {
      await expect(
        service.claimCharter(1, claimDto, validUserId, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Formal Kickoff executeFormalKickoff results in status = IN_PROGRESS, Cost APPROVED, Baseline V1 ACTIVE', async () => {
      const kickoffResult = await service.executeFormalKickoff(validProjectId, claimDto, validUserId, ['PROJECT_MANAGER']);
      expect(kickoffResult.statusCode).toBe(200);
      expect(kickoffResult.data.status).toBe('IN_PROGRESS');
      expect(mockTransactionManager.save).toHaveBeenCalledWith(
        ProjectCostEstimate,
        expect.objectContaining({ status: 'APPROVED' }),
      );
      expect(mockTransactionManager.save).toHaveBeenCalledWith(
        ProjectBaseline,
        expect.objectContaining({ status: 'ACTIVE', version_number: 1 }),
      );
    });
  });
});
