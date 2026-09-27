import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
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
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('GAP-PRJ-03: Operational Board Server-Side Role and Ownership Scoping', () => {
  let service: ProjectService;
  let controller: ProjectController;
  let mockProjectRepo: any;
  let mockContractRepo: any;
  let mockUserRepo: any;

  const PM1_ID = 101;
  const PM2_ID = 202;
  const PMO_USER_ID = 303;

  const projectPM1: Partial<Project> = {
    id: 1,
    code: 'CONT-PM1-001',
    name: 'Project Alpha (PM1)',
    status: 'IN_PROGRESS',
    managerId: PM1_ID,
  };

  const projectPM2: Partial<Project> = {
    id: 2,
    code: 'CONT-PM2-002',
    name: 'Project Beta (PM2)',
    status: 'IN_PROGRESS',
    managerId: PM2_ID,
  };

  const contractPM1: Partial<Contract> = {
    id: 11,
    contract_number: 'CONT-PM1-PLAN',
    legal_status: LegalStatus.APPROVED,
    status: 'ACTIVE',
    project_manager_id: PM1_ID,
    contract_value: 750000000,
    customer: { id: 1, name: 'Customer PM1' } as any,
    proposal: {
      id: 10,
      tender: { title: 'Tender PM1', project_location: 'Jakarta' },
    } as any,
  };

  const contractPM2: Partial<Contract> = {
    id: 22,
    contract_number: 'CONT-PM2-PLAN',
    legal_status: LegalStatus.APPROVED,
    status: 'ACTIVE',
    project_manager_id: PM2_ID,
    contract_value: 1250000000,
    customer: { id: 2, name: 'Customer PM2' } as any,
    proposal: {
      id: 20,
      tender: { title: 'Tender PM2', project_location: 'Surabaya' },
    } as any,
  };

  beforeEach(async () => {
    mockProjectRepo = {
      find: jest.fn().mockImplementation((opts?: any) => {
        let projects = [{ ...projectPM1 }, { ...projectPM2 }];
        if (opts?.where?.managerId) {
          projects = projects.filter((p) => p.managerId === opts.where.managerId);
        }
        return Promise.resolve(projects);
      }),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ id: 999, ...dto })),
      save: jest.fn().mockImplementation((p) => Promise.resolve({ id: 999, ...p })),
    };

    mockContractRepo = {
      find: jest.fn().mockImplementation((opts?: any) => {
        let contracts = [{ ...contractPM1 }, { ...contractPM2 }];
        if (Array.isArray(opts?.where)) {
          contracts = contracts.filter((c) =>
            opts.where.some((w: any) => {
              if (w.project_manager_id && typeof w.project_manager_id === 'object' && w.project_manager_id?._type === 'isNull') {
                return c.project_manager_id === null;
              }
              if (w.project_manager_id === null) {
                return c.project_manager_id === null;
              }
              if (w.project_manager_id !== undefined) {
                return c.project_manager_id === w.project_manager_id;
              }
              return true;
            }),
          );
        } else if (opts?.where?.project_manager_id) {
          contracts = contracts.filter((c) => c.project_manager_id === opts.where.project_manager_id);
        }
        return Promise.resolve(contracts);
      }),
      findOne: jest.fn(),
    };

    mockUserRepo = {
      find: jest.fn().mockResolvedValue([
        { id: PM1_ID, fullName: 'PM One' },
        { id: PM2_ID, fullName: 'PM Two' },
        { id: PMO_USER_ID, fullName: 'PMO Lead' },
      ]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where?.id === PM1_ID) {
          return Promise.resolve({
            id: PM1_ID,
            fullName: 'PM One',
            roles: [{ id: 1, name: 'PROJECT_MANAGER' }],
          });
        }
        if (where?.id === 888) {
          return Promise.resolve({
            id: 888,
            fullName: 'Finance User',
            roles: [{ id: 2, name: 'FINANCE' }],
          });
        }
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
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
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Task), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(AuditLog), useValue: { save: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    controller = module.get<ProjectController>(ProjectController);
  });

  describe('1. Controller Metadata & Guards', () => {
    it('should have JwtAuthGuard and RolesGuard applied to ProjectController', () => {
      const guards = Reflect.getMetadata('__guards__', ProjectController);
      expect(guards).toBeDefined();
      const guardNames = guards.map((g: any) => g.name || g);
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('RolesGuard');
    });

    it('should specify allowed roles in @Roles metadata', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>('roles', ProjectController.prototype.getOperationalBoard);
      expect(roles).toBeDefined();
      expect(roles).toEqual([
        'PROJECT_MANAGER',
        'PMO',
        'DIRECTOR',
        'GENERAL_MANAGER',
        'HEAD_OF_OPERATIONS',
        'SUPER_ADMIN',
        'PROCUREMENT',
        'PURCHASING',
      ]);
    });

    it('should extract req.user.id and req.user.roles and delegate to service', async () => {
      const req = {
        user: {
          id: PM1_ID,
          roles: ['PROJECT_MANAGER'],
        },
      };

      const serviceSpy = jest.spyOn(service, 'getOperationalBoard').mockResolvedValue({
        statusCode: 200,
        message: 'PMO Operational Board retrieved successfully',
        data: { activeProjects: [], pendingKickoff: [] },
      });

      const res = await controller.getOperationalBoard(req);

      expect(serviceSpy).toHaveBeenCalledWith(PM1_ID, ['PROJECT_MANAGER']);
      expect(res.statusCode).toBe(200);
    });

    it('should handle object roles (e.g. [{ name: "PROJECT_MANAGER" }]) from req.user', async () => {
      const req = {
        user: {
          id: PM1_ID,
          roles: [{ id: 1, name: 'PROJECT_MANAGER' }],
        },
      };

      const serviceSpy = jest.spyOn(service, 'getOperationalBoard').mockResolvedValue({
        statusCode: 200,
        message: 'PMO Operational Board retrieved successfully',
        data: { activeProjects: [], pendingKickoff: [] },
      });

      await controller.getOperationalBoard(req);

      expect(serviceSpy).toHaveBeenCalledWith(PM1_ID, ['PROJECT_MANAGER']);
    });
  });

  describe('2. Identity Authentication Enforcement (401 Unauthorized)', () => {
    it('should throw UnauthorizedException when userId is undefined', async () => {
      await expect(service.getOperationalBoard(undefined as any, ['PROJECT_MANAGER'])).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when userId is null', async () => {
      await expect(service.getOperationalBoard(null as any, ['PROJECT_MANAGER'])).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when userId is 0', async () => {
      await expect(service.getOperationalBoard(0, ['PROJECT_MANAGER'])).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when userId is NaN', async () => {
      await expect(service.getOperationalBoard(NaN, ['PROJECT_MANAGER'])).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('3. Role Authorization Enforcement (403 Forbidden)', () => {
    it('should throw ForbiddenException for unauthorized role (MARKETING)', async () => {
      await expect(service.getOperationalBoard(PM1_ID, ['MARKETING'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for unauthorized role (FINANCE)', async () => {
      await expect(service.getOperationalBoard(PM1_ID, ['FINANCE'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for unauthorized role (VENDOR)', async () => {
      await expect(service.getOperationalBoard(PM1_ID, ['VENDOR'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if DB user lookup reveals unauthorized role', async () => {
      // User 888 has role 'FINANCE' in DB lookup
      await expect(service.getOperationalBoard(888, [])).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Project Manager Ownership Scoping (GAP-PRJ-03 Anti-IDOR)', () => {
    it('should restrict PROJECT_MANAGER to their assigned projects and contracts at the database level', async () => {
      const board = await service.getOperationalBoard(PM1_ID, ['PROJECT_MANAGER']);

      // 1. Verify DB query was filtered by managerId
      expect(mockProjectRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { managerId: PM1_ID },
        }),
      );

      // 2. Verify approved contracts query was scoped for PM (assigned to PM or unassigned in queue)
      expect(mockContractRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ project_manager_id: PM1_ID }),
            expect.objectContaining({ project_manager_id: expect.anything() }),
          ]),
        }),
      );

      // 3. Verify returned activeProjects contain ONLY PM1's projects
      expect(board.data.activeProjects).toHaveLength(1);
      expect(board.data.activeProjects[0].id).toBe(projectPM1.id);
      expect(board.data.activeProjects[0].project_code).toBe(projectPM1.code);

      // 4. Verify returned pendingKickoff contain ONLY PM1's contracts
      expect(board.data.pendingKickoff).toHaveLength(1);
      expect(board.data.pendingKickoff[0].contractId).toBe(contractPM1.id);
      expect(board.data.pendingKickoff[0].project_code).toBe(contractPM1.contract_number);

      // 5. Verify PM2's projects/contracts are NOT exposed (Information Disclosure Prevention)
      const hasPm2Active = board.data.activeProjects.some((p: any) => p.id === projectPM2.id);
      const hasPm2Pending = board.data.pendingKickoff.some((c: any) => c.contractId === contractPM2.id);
      expect(hasPm2Active).toBe(false);
      expect(hasPm2Pending).toBe(false);
    });

    it('should return empty lists if PROJECT_MANAGER has no assigned projects or contracts', async () => {
      const board = await service.getOperationalBoard(999, ['PROJECT_MANAGER']);

      expect(board.data.activeProjects).toEqual([]);
      expect(board.data.pendingKickoff).toEqual([]);
    });
  });

  describe('5. Management-Wide Global Visibility', () => {
    const managementRoles = [
      'PMO',
      'DIRECTOR',
      'GENERAL_MANAGER',
      'HEAD_OF_OPERATIONS',
      'SUPER_ADMIN',
      'PROCUREMENT',
      'PURCHASING',
    ];

    managementRoles.forEach((role) => {
      it(`should allow ${role} to view all projects and contracts globally without managerId restriction`, async () => {
        const board = await service.getOperationalBoard(PMO_USER_ID, [role]);

        // DB query for projects should not have managerId restriction
        expect(mockProjectRepo.find).toHaveBeenCalledWith(
          expect.objectContaining({
            order: { id: 'DESC' },
          }),
        );
        const lastCall = mockProjectRepo.find.mock.calls[mockProjectRepo.find.mock.calls.length - 1][0];
        expect(lastCall?.where?.managerId).toBeUndefined();

        // Both PM1 and PM2 projects should be returned
        expect(board.data.activeProjects).toHaveLength(2);
        expect(board.data.pendingKickoff).toHaveLength(2);
      });
    });
  });
});
