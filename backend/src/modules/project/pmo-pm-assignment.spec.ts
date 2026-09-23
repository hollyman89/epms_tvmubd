import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { SaveWbsTreeDto } from './dto/save-wbs-tree.dto';

describe('PMO -> Project Manager Assignment (Tests A - L)', () => {
  let service: ProjectService;
  let projectRepoMock: any;
  let contractRepoMock: any;
  let userRepoMock: any;
  let wbsRepoMock: any;
  let taskRepoMock: any;
  let eventEmitterMock: any;
  let savedEntitiesInTx: any[];
  let createdAuditLogs: any[];

  // Actors
  const PMO_USER_ID = 10;
  const TARGET_PM_ID = 20;
  const OTHER_PM_ID = 30;
  const FINANCE_USER_ID = 40;
  const INACTIVE_PM_ID = 50;
  const DUAL_ROLE_USER_ID = 60; // Has both PMO and PM roles

  // Identifiers
  const CONTRACT_ID = 100;
  const CONTRACT_NUMBER = 'CONT-2026-001';
  const PROJECT_ID = 200;
  const PROJECT_CODE = 'CONT-2026-001';

  // Users DB
  const mockUsers: Record<number, any> = {
    [PMO_USER_ID]: {
      id: PMO_USER_ID,
      fullName: 'PMO Officer',
      email: 'pmo@tvmubd.com',
      isActive: true,
      deletedAt: null,
      roles: [{ name: 'PMO' }],
    },
    [TARGET_PM_ID]: {
      id: TARGET_PM_ID,
      fullName: 'Budi Project Manager',
      email: 'budi.pm@tvmubd.com',
      isActive: true,
      deletedAt: null,
      roles: [{ name: 'PROJECT_MANAGER' }],
    },
    [OTHER_PM_ID]: {
      id: OTHER_PM_ID,
      fullName: 'Siti Project Manager',
      email: 'siti.pm@tvmubd.com',
      isActive: true,
      deletedAt: null,
      roles: [{ name: 'PROJECT_MANAGER' }],
    },
    [FINANCE_USER_ID]: {
      id: FINANCE_USER_ID,
      fullName: 'Finance Officer',
      email: 'finance@tvmubd.com',
      isActive: true,
      deletedAt: null,
      roles: [{ name: 'FINANCE' }],
    },
    [INACTIVE_PM_ID]: {
      id: INACTIVE_PM_ID,
      fullName: 'Inactive PM',
      email: 'inactive@tvmubd.com',
      isActive: false,
      deletedAt: null,
      roles: [{ name: 'PROJECT_MANAGER' }],
    },
    [DUAL_ROLE_USER_ID]: {
      id: DUAL_ROLE_USER_ID,
      fullName: 'Dual PMO and PM',
      email: 'dual@tvmubd.com',
      isActive: true,
      deletedAt: null,
      roles: [{ name: 'PMO' }, { name: 'PROJECT_MANAGER' }],
    },
  };

  let mockContract: Partial<Contract>;
  let mockProject: Partial<Project> | null;

  beforeEach(async () => {
    savedEntitiesInTx = [];
    createdAuditLogs = [];

    mockContract = {
      id: CONTRACT_ID,
      contract_number: CONTRACT_NUMBER,
      legal_status: LegalStatus.APPROVED,
      status: 'ACTIVE',
      project_manager_id: null as any,
      proposal: {
        id: 1,
        tender_id: 1,
        tender: {
          id: 1,
          title: 'Proyek Jaringan Fiber Optic',
          project_location: 'Jakarta',
        },
      } as any,
    };

    mockProject = {
      id: PROJECT_ID,
      code: PROJECT_CODE,
      name: 'Proyek Jaringan Fiber Optic',
      managerId: null as any,
      status: 'PLANNING',
      contractId: CONTRACT_ID,
    };

    const fakeManager = {
      save: jest.fn().mockImplementation(async (clsOrEntity: any, entity?: any) => {
        const target = entity !== undefined ? entity : clsOrEntity;
        const targetCls = entity !== undefined ? clsOrEntity : target?.constructor;

        if (targetCls === AuditLog || target?.action === 'PROJECT_PM_ASSIGNED') {
          createdAuditLogs.push(target);
        }
        savedEntitiesInTx.push({ cls: targetCls, entity: target });
        return { ...target, id: target.id || 999 };
      }),
      create: jest.fn().mockImplementation((cls: any, data: any) => {
        const instance = { ...data };
        if (cls === Project && !instance.id) {
          instance.id = PROJECT_ID;
        }
        return instance;
      }),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    contractRepoMock = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        const conditions = Array.isArray(where) ? where : [where];
        for (const cond of conditions) {
          if (cond.id === CONTRACT_ID || cond.contract_number === CONTRACT_NUMBER) {
            return Promise.resolve({ ...mockContract });
          }
        }
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((entity) => {
        mockContract = { ...mockContract, ...entity };
        return Promise.resolve(mockContract);
      }),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb) => {
          return await cb(fakeManager);
        }),
      },
    };

    projectRepoMock = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (!mockProject) return Promise.resolve(null);
        const conditions = Array.isArray(where) ? where : [where];
        for (const cond of conditions) {
          if (
            cond.id === mockProject.id ||
            cond.code === mockProject.code ||
            cond.contractId === mockProject.contractId
          ) {
            return Promise.resolve({ ...mockProject });
          }
        }
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((entity) => {
        mockProject = { ...(mockProject || {}), ...entity };
        return Promise.resolve(mockProject);
      }),
    };

    userRepoMock = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        const id = where.id;
        if (mockUsers[id]) {
          return Promise.resolve({ ...mockUsers[id] });
        }
        return Promise.resolve(null);
      }),
      find: jest.fn().mockImplementation(({ where }) => {
        let results = Object.values(mockUsers);
        if (where?.isActive !== undefined) {
          results = results.filter((u) => u.isActive === where.isActive);
        }
        return Promise.resolve(results);
      }),
    };

    wbsRepoMock = {
      find: jest.fn().mockResolvedValue([
        { id: 1, projectId: PROJECT_ID, code: '1.0', name: 'Site Preparation', level: 1, weightPercentage: 100, parentWbsId: null, deletedAt: null },
      ]),
      findOne: jest.fn().mockResolvedValue(null),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb) => cb(fakeManager)),
      },
    };

    taskRepoMock = {
      find: jest.fn().mockResolvedValue([]),
    };

    eventEmitterMock = {
      emit: jest.fn(),
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
        { provide: getRepositoryToken(Contract), useValue: contractRepoMock },
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: wbsRepoMock },
        { provide: getRepositoryToken(Task), useValue: taskRepoMock },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  describe('GET /project/eligible-pms', () => {
    it('returns only active, non-deleted users with PROJECT_MANAGER role and projected fields', async () => {
      const eligiblePms = await service.getEligibleProjectManagers();
      expect(Array.isArray(eligiblePms)).toBe(true);
      // TARGET_PM_ID, OTHER_PM_ID, DUAL_ROLE_USER_ID have PROJECT_MANAGER role and are active
      const pmIds = eligiblePms.map((p) => p.id);
      expect(pmIds).toContain(TARGET_PM_ID);
      expect(pmIds).toContain(OTHER_PM_ID);
      expect(pmIds).toContain(DUAL_ROLE_USER_ID);
      expect(pmIds).not.toContain(FINANCE_USER_ID);
      expect(pmIds).not.toContain(INACTIVE_PM_ID);
      expect(pmIds).not.toContain(PMO_USER_ID);

      // Verify projected fields only
      const sample = eligiblePms.find((p) => p.id === TARGET_PM_ID);
      expect(sample).toEqual({
        id: TARGET_PM_ID,
        fullName: 'Budi Project Manager',
        email: 'budi.pm@tvmubd.com',
      });
    });
  });

  describe('Test A — Successful PMO Assignment', () => {
    it('PMO assigns valid active PROJECT_MANAGER: sets project.managerId, contract.project_manager_id, and retains status PLANNING', async () => {
      const result = await service.assignProjectManager(
        PROJECT_ID,
        TARGET_PM_ID,
        PMO_USER_ID,
        ['PMO'],
      );

      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe('PLANNING');
      expect(result.data.managerId).toBe(TARGET_PM_ID);

      // Verify contract and project updated in transaction
      const contractUpdate = savedEntitiesInTx.find((e) => e.cls === Contract || e.entity?.contract_number);
      expect(contractUpdate).toBeDefined();
      expect(contractUpdate.entity.project_manager_id).toBe(TARGET_PM_ID);

      const projectUpdate = savedEntitiesInTx.find((e) => e.cls === Project || e.entity?.code);
      expect(projectUpdate).toBeDefined();
      expect(projectUpdate.entity.managerId).toBe(TARGET_PM_ID);
      expect(projectUpdate.entity.status).toBe('PLANNING');
    });
  });

  describe('Test B — Invalid target role', () => {
    it('PMO assigns a user with role FINANCE: rejects with BadRequestException', async () => {
      await expect(
        service.assignProjectManager(PROJECT_ID, FINANCE_USER_ID, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.assignProjectManager(PROJECT_ID, FINANCE_USER_ID, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow(/tidak memiliki peran PROJECT_MANAGER/);
    });
  });

  describe('Test C — Inactive target', () => {
    it('PMO assigns an inactive PM: rejects with BadRequestException', async () => {
      await expect(
        service.assignProjectManager(PROJECT_ID, INACTIVE_PM_ID, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.assignProjectManager(PROJECT_ID, INACTIVE_PM_ID, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow(/tidak ditemukan atau tidak aktif/);
    });
  });

  describe('Test D — Unauthorized actors', () => {
    it.each([
      ['PROJECT_MANAGER', TARGET_PM_ID, ['PROJECT_MANAGER']],
      ['ADMIN', 70, ['ADMIN']],
      ['LEGAL', 80, ['LEGAL']],
      ['DIRECTOR', 90, ['DIRECTOR']],
      ['HEAD_OF_OPERATIONS', 95, ['HEAD_OF_OPERATIONS']],
      ['SUPER_ADMIN', 99, ['SUPER_ADMIN']],
    ])('rejects non-PMO actor %s with ForbiddenException', async (roleName, actorId, roles) => {
      // Mock actor in userRepo without PMO role
      userRepoMock.findOne.mockImplementationOnce(({ where }: any) => {
        if (where.id === actorId) {
          return Promise.resolve({
            id: actorId,
            fullName: `${roleName} User`,
            email: `${roleName.toLowerCase()}@example.com`,
            isActive: true,
            roles: roles.map((r) => ({ name: r })),
          });
        }
        return Promise.resolve(mockUsers[where.id] || null);
      });

      await expect(
        service.assignProjectManager(PROJECT_ID, TARGET_PM_ID, actorId, roles),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.assignProjectManager(PROJECT_ID, TARGET_PM_ID, actorId, roles),
      ).rejects.toThrow(/Hanya pengguna dengan peran PMO yang berhak menugaskan Project Manager/);
    });
  });

  describe('Test E — PMO self assignment', () => {
    it('rejects self-assignment when actor is both PMO and PM', async () => {
      await expect(
        service.assignProjectManager(
          PROJECT_ID,
          DUAL_ROLE_USER_ID,
          DUAL_ROLE_USER_ID,
          ['PMO', 'PROJECT_MANAGER'],
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.assignProjectManager(
          PROJECT_ID,
          DUAL_ROLE_USER_ID,
          DUAL_ROLE_USER_ID,
          ['PMO', 'PROJECT_MANAGER'],
        ),
      ).rejects.toThrow(/PMO dilarang menugaskan diri sendiri sebagai Project Manager/);
    });
  });

  describe('Test F — Terminal / ineligible project', () => {
    it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'])(
      'rejects assignment when project is %s',
      async (terminalStatus) => {
        mockProject!.status = terminalStatus as any;

        await expect(
          service.assignProjectManager(PROJECT_ID, TARGET_PM_ID, PMO_USER_ID, ['PMO']),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.assignProjectManager(PROJECT_ID, TARGET_PM_ID, PMO_USER_ID, ['PMO']),
        ).rejects.toThrow(/hanya proyek berstatus PLANNING yang dapat ditugaskan/);
      },
    );

    it('rejects assignment when contract legal_status is not APPROVED', async () => {
      mockContract.legal_status = LegalStatus.ON_REVIEW;

      await expect(
        service.assignProjectManager(PROJECT_ID, TARGET_PM_ID, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.assignProjectManager(PROJECT_ID, TARGET_PM_ID, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow(/legal_status harus APPROVED/);
    });

    it('rejects assignment when contract status is not ACTIVE', async () => {
      mockContract.status = 'DRAFT';

      await expect(
        service.assignProjectManager(PROJECT_ID, TARGET_PM_ID, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.assignProjectManager(PROJECT_ID, TARGET_PM_ID, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow(/status harus ACTIVE/);
    });
  });

  describe('Test G — Lazy Project Creation', () => {
    it('creates Project record inside transaction when contract has no Project row yet', async () => {
      // Contract exists, but Project row does not yet exist
      mockProject = null;

      const result = await service.assignProjectManager(
        CONTRACT_ID,
        TARGET_PM_ID,
        PMO_USER_ID,
        ['PMO'],
      );

      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe('PLANNING');
      expect(result.data.managerId).toBe(TARGET_PM_ID);

      const createdProject = savedEntitiesInTx.find((e) => e.cls === Project);
      expect(createdProject).toBeDefined();
      expect(createdProject.entity.status).toBe('PLANNING');
      expect(createdProject.entity.managerId).toBe(TARGET_PM_ID);
      expect(createdProject.entity.contractId).toBe(CONTRACT_ID);
    });
  });

  describe('Test H — Existing Project', () => {
    it('updates managerId on existing Project without duplicating Project record', async () => {
      mockProject = {
        id: PROJECT_ID,
        code: PROJECT_CODE,
        name: 'Proyek Jaringan Fiber Optic',
        managerId: null as any,
        status: 'PLANNING',
        contractId: CONTRACT_ID,
      };

      const result = await service.assignProjectManager(
        PROJECT_ID,
        TARGET_PM_ID,
        PMO_USER_ID,
        ['PMO'],
      );

      expect(result.statusCode).toBe(200);
      expect(result.data.id).toBe(PROJECT_ID);
      expect(result.data.managerId).toBe(TARGET_PM_ID);
      expect(result.data.status).toBe('PLANNING');

      // Assert only one project was saved
      const savedProjects = savedEntitiesInTx.filter((e) => e.cls === Project || e.entity?.code === PROJECT_CODE);
      expect(savedProjects.length).toBe(1);
    });
  });

  describe('Test I — Atomicity', () => {
    it('rolls back completely if error occurs during transaction', async () => {
      contractRepoMock.manager.transaction.mockImplementationOnce(async () => {
        throw new Error('Database disk error during contract update');
      });

      await expect(
        service.assignProjectManager(PROJECT_ID, TARGET_PM_ID, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow('Database disk error during contract update');

      // No event should be emitted if transaction fails
      expect(eventEmitterMock.emit).not.toHaveBeenCalled();
    });
  });

  describe('Test J — Audit Log', () => {
    it('creates AuditLog with action PROJECT_PM_ASSIGNED and PMO as created_by', async () => {
      await service.assignProjectManager(PROJECT_ID, TARGET_PM_ID, PMO_USER_ID, ['PMO']);

      expect(createdAuditLogs.length).toBeGreaterThan(0);
      const auditLog = createdAuditLogs[0];
      expect(auditLog.action).toBe('PROJECT_PM_ASSIGNED');
      expect(auditLog.table_name).toBe('projects');
      expect(auditLog.created_by).toBe(PMO_USER_ID);
      expect(auditLog.new_value).toEqual({
        projectId: PROJECT_ID,
        contractId: CONTRACT_ID,
        assignedBy: PMO_USER_ID,
        projectManagerId: TARGET_PM_ID,
        status: 'PLANNING',
      });
    });
  });

  describe('Test K — Workflow untouched', () => {
    it('assignment does NOT create workflow instance, start management review, or change project status', async () => {
      const result = await service.assignProjectManager(
        PROJECT_ID,
        TARGET_PM_ID,
        PMO_USER_ID,
        ['PMO'],
      );

      expect(result.data.status).toBe('PLANNING');
      expect(result.data.status).not.toBe('IN_PROGRESS');

      // Verify assignment does not emit workflow events (canonical event is delivered via Outbox)
      expect(eventEmitterMock.emit).not.toHaveBeenCalledWith(
        'workflow.task.completed',
        expect.anything(),
      );
    });
  });

  describe('Test L — Ownership Access Boundary', () => {
    it('assigned PM can access planning operations (e.g. saveWbsTree)', async () => {
      // Set project managerId to TARGET_PM_ID
      mockProject!.managerId = TARGET_PM_ID;

      const validWbsDto: SaveWbsTreeDto = {
        nodes: [{ code: '1.0', name: 'Site Preparation', level: 1, weightPercentage: 100 }],
      };

      const res = await service.saveWbsTree(
        PROJECT_ID,
        validWbsDto,
        TARGET_PM_ID,
        ['PROJECT_MANAGER'],
      );
      expect(res).toBeDefined();
      expect(res.statusCode).toBe(200);
    });

    it('non-assigned PM is rejected by existing ownership boundary', async () => {
      // Project is assigned to TARGET_PM_ID
      mockProject!.managerId = TARGET_PM_ID;

      const validWbsDto: SaveWbsTreeDto = {
        nodes: [{ code: '1.0', name: 'Site Preparation', level: 1, weightPercentage: 100 }],
      };

      await expect(
        service.saveWbsTree(PROJECT_ID, validWbsDto, OTHER_PM_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.saveWbsTree(PROJECT_ID, validWbsDto, OTHER_PM_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(/Anda bukan Project Manager yang ditugaskan/);
    });
  });

  describe('Hardening: Legacy claimCharter Deprecation & Fail-Closed (Section 11 Tests A - I)', () => {
    it('Test A — PROJECT_MANAGER calls legacy claimCharter: rejected with 403', async () => {
      await expect(
        service.claimCharter(CONTRACT_ID, {}, TARGET_PM_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.claimCharter(CONTRACT_ID, {}, TARGET_PM_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(/Project Charter tidak dapat diklaim langsung oleh Project Manager. Penugasan Project Manager dilakukan oleh PMO./);
    });

    it('Test B — PMO calls legacy claimCharter: rejected with 403', async () => {
      await expect(
        service.claimCharter(CONTRACT_ID, {}, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.claimCharter(CONTRACT_ID, {}, PMO_USER_ID, ['PMO']),
      ).rejects.toThrow(/Penugasan Project Manager dilakukan melalui POST \/project\/:projectId\/assign-pm/);
    });

    it('Test C — Legacy claim does NOT create Project or assign managerId', async () => {
      mockProject = null;
      savedEntitiesInTx = [];

      try {
        await service.claimCharter(CONTRACT_ID, {}, TARGET_PM_ID, ['PROJECT_MANAGER']);
      } catch (err) {}

      // Assert no project was saved or created
      const createdProjects = savedEntitiesInTx.filter((e) => e.cls === Project || e.entity?.code === PROJECT_CODE);
      expect(createdProjects).toHaveLength(0);
      expect(mockProject).toBeNull();
    });

    it('Test D — Legacy claim does NOT change contract.project_manager_id', async () => {
      mockContract.project_manager_id = null as any;

      try {
        await service.claimCharter(CONTRACT_ID, {}, TARGET_PM_ID, ['PROJECT_MANAGER']);
      } catch (err) {}

      expect(mockContract.project_manager_id).toBeNull();
    });

    it('Test E — Existing PMO Assignment remains successful via assignProjectManager', async () => {
      const res = await service.assignProjectManager(
        CONTRACT_ID,
        TARGET_PM_ID,
        PMO_USER_ID,
        ['PMO'],
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('PLANNING');
      expect(res.data.managerId).toBe(TARGET_PM_ID);
    });

    it('Test F — Assignment performs initialization when project does not exist yet', async () => {
      mockProject = null;
      savedEntitiesInTx = [];

      const res = await service.assignProjectManager(
        CONTRACT_ID,
        TARGET_PM_ID,
        PMO_USER_ID,
        ['PMO'],
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('PLANNING');
      expect(res.data.managerId).toBe(TARGET_PM_ID);

      const createdProject = savedEntitiesInTx.find((e) => e.cls === Project);
      expect(createdProject).toBeDefined();
      expect(createdProject.entity.status).toBe('PLANNING');
      expect(createdProject.entity.managerId).toBe(TARGET_PM_ID);
      expect(createdProject.entity.contractId).toBe(CONTRACT_ID);
    });

    it('Test G — Existing project: updates managerId without creating duplicate project', async () => {
      mockProject = {
        id: PROJECT_ID,
        code: PROJECT_CODE,
        name: 'Proyek Jaringan Fiber Optic',
        managerId: null as any,
        status: 'PLANNING',
        contractId: CONTRACT_ID,
      };
      savedEntitiesInTx = [];

      const res = await service.assignProjectManager(
        PROJECT_ID,
        TARGET_PM_ID,
        PMO_USER_ID,
        ['PMO'],
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.id).toBe(PROJECT_ID);
      expect(res.data.managerId).toBe(TARGET_PM_ID);

      const savedProjects = savedEntitiesInTx.filter((e) => e.cls === Project || e.entity?.code === PROJECT_CODE);
      expect(savedProjects).toHaveLength(1);
    });

    it('Test H — Selected PM can access planning operations', async () => {
      mockProject!.managerId = TARGET_PM_ID;

      const validWbsDto: SaveWbsTreeDto = {
        nodes: [{ code: '1.0', name: 'Site Preparation', level: 1, weightPercentage: 100 }],
      };

      const res = await service.saveWbsTree(
        PROJECT_ID,
        validWbsDto,
        TARGET_PM_ID,
        ['PROJECT_MANAGER'],
      );
      expect(res).toBeDefined();
      expect(res.statusCode).toBe(200);
    });

    it('Test I — Other PM is Forbidden from modifying planning operations', async () => {
      mockProject!.managerId = TARGET_PM_ID;

      const validWbsDto: SaveWbsTreeDto = {
        nodes: [{ code: '1.0', name: 'Site Preparation', level: 1, weightPercentage: 100 }],
      };

      await expect(
        service.saveWbsTree(PROJECT_ID, validWbsDto, OTHER_PM_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
