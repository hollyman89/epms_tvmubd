import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';

describe('ProjectService - getOperationalBoard PMO Queue Visibility (Phase 2)', () => {
  let service: ProjectService;
  let mockProjectRepo: any;
  let mockContractRepo: any;
  let mockUserRepo: any;

  const PM_A_ID = 50;
  const PM_B_ID = 60;
  const ADMIN_ID = 1;
  const NON_PM_ID = 80;
  const ARBITRARY_PM_ID = 777;
  const PMO_ID = 90;

  const projectPmA: Partial<Project> = {
    id: 1,
    code: 'CONT-PMA-001',
    name: 'Project PM A',
    status: 'IN_PROGRESS',
    managerId: PM_A_ID,
  };

  const projectPmB: Partial<Project> = {
    id: 2,
    code: 'CONT-PMB-002',
    name: 'Project PM B',
    status: 'IN_PROGRESS',
    managerId: PM_B_ID,
  };

  const contractPmA: Partial<Contract> = {
    id: 101,
    contract_number: 'CONT-PMA-001',
    legal_status: LegalStatus.APPROVED,
    status: 'ACTIVE',
    project_manager_id: PM_A_ID,
    contract_value: 500000000,
    customer: { id: 1, name: 'Client A' } as any,
    proposal: {
      id: 10,
      tender: { title: 'Tender A', project_location: 'Jakarta' },
    } as any,
    ...({ pmo_queue: 'PENDING_KICKOFF' } as any),
  };

  const contractPmB: Partial<Contract> = {
    id: 102,
    contract_number: 'CONT-PMB-002',
    legal_status: LegalStatus.APPROVED,
    status: 'ACTIVE',
    project_manager_id: PM_B_ID,
    contract_value: 600000000,
    customer: { id: 2, name: 'Client B' } as any,
    proposal: {
      id: 20,
      tender: { title: 'Tender B', project_location: 'Surabaya' },
    } as any,
    ...({ pmo_queue: 'PENDING_KICKOFF' } as any),
  };

  const contractUnassigned: Partial<Contract> = {
    id: 103,
    contract_number: 'CONT-UNASSIGNED-003',
    legal_status: LegalStatus.APPROVED,
    status: 'ACTIVE',
    project_manager_id: null,
    contract_value: 700000000,
    customer: { id: 3, name: 'Client Unassigned' } as any,
    proposal: {
      id: 30,
      tender: { title: 'Tender Unassigned Queue', project_location: 'Bandung' },
    } as any,
    ...({ pmo_queue: 'PENDING_KICKOFF' } as any),
  };

  const contractUnreleased: Partial<Contract> = {
    id: 104,
    contract_number: 'CONT-UNRELEASED-004',
    legal_status: LegalStatus.DRAFT,
    status: 'PENDING_LEGAL_REVIEW',
    project_manager_id: null,
    contract_value: 400000000,
    customer: { id: 4, name: 'Client Draft' } as any,
  };

  const contractNotActive: Partial<Contract> = {
    id: 105,
    contract_number: 'CONT-CANCELLED-005',
    legal_status: LegalStatus.APPROVED,
    status: 'CANCELLED',
    project_manager_id: null,
    contract_value: 300000000,
    customer: { id: 5, name: 'Client Cancelled' } as any,
  };

  beforeEach(async () => {
    contractUnassigned.project_manager_id = null;
    (contractUnassigned as any).pmo_queue = 'PENDING_KICKOFF';
    contractPmA.project_manager_id = PM_A_ID;
    contractPmB.project_manager_id = PM_B_ID;

    mockProjectRepo = {
      find: jest.fn().mockImplementation((opts?: any) => {
        let projects = [{ ...projectPmA }, { ...projectPmB }];
        if (opts?.where?.managerId) {
          projects = projects.filter((p) => p.managerId === opts.where.managerId);
        }
        return Promise.resolve(projects);
      }),
      findOne: jest.fn().mockImplementation((opts?: any) => {
        const list = [{ ...projectPmA }, { ...projectPmB }];
        if (Array.isArray(opts?.where)) {
          for (const cond of opts.where) {
            const found = list.find(
              (p) =>
                (cond.code && p.code === cond.code) ||
                (cond.id && p.id === cond.id) ||
                (cond.contractId && p.contractId === cond.contractId),
            );
            if (found) return Promise.resolve(found);
          }
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation((dto) => ({ id: 999, ...dto })),
      save: jest.fn().mockImplementation((p) => Promise.resolve({ id: 999, ...p })),
    };

    const fakeManager = {
      save: jest.fn().mockImplementation((entityOrClass, entityData) => {
        const toSave = entityData || entityOrClass;
        return Promise.resolve(toSave);
      }),
      create: jest.fn().mockImplementation((entityClass, dto) => ({ id: 999, ...dto })),
      findOne: jest.fn().mockImplementation((entityClass, opts) => {
        return Promise.resolve(null);
      }),
    };

    mockContractRepo = {
      manager: {
        transaction: jest.fn((cb) => cb(fakeManager)),
      },
      find: jest.fn().mockImplementation((opts?: any) => {
        let allContracts = [
          { ...contractPmA },
          { ...contractPmB },
          { ...contractUnassigned },
          { ...contractUnreleased },
          { ...contractNotActive },
        ];

        // Filter based on legal_status and status
        if (Array.isArray(opts?.where)) {
          return Promise.resolve(
            allContracts.filter((c) =>
              opts.where.some((cond: any) => {
                const statusMatch =
                  (!cond.legal_status || c.legal_status === cond.legal_status) &&
                  (!cond.status || c.status === cond.status);
                if (!statusMatch) return false;

                if (
                  cond.project_manager_id &&
                  typeof cond.project_manager_id === 'object' &&
                  cond.project_manager_id?._type === 'isNull'
                ) {
                  return c.project_manager_id === null;
                }
                if (cond.project_manager_id === null) {
                  return c.project_manager_id === null;
                }
                if (cond.project_manager_id !== undefined) {
                  return c.project_manager_id === cond.project_manager_id;
                }
                return true;
              }),
            ),
          );
        }

        if (opts?.where) {
          let filtered = allContracts;
          if (opts.where.legal_status) {
            filtered = filtered.filter((c) => c.legal_status === opts.where.legal_status);
          }
          if (opts.where.status) {
            filtered = filtered.filter((c) => c.status === opts.where.status);
          }
          if (opts.where.project_manager_id !== undefined) {
            filtered = filtered.filter((c) => c.project_manager_id === opts.where.project_manager_id);
          }
          return Promise.resolve(filtered);
        }

        return Promise.resolve(allContracts);
      }),
      findOne: jest.fn().mockImplementation((opts?: any) => {
        const allContracts = [
          contractPmA,
          contractPmB,
          contractUnassigned,
          contractUnreleased,
          contractNotActive,
        ];
        if (Array.isArray(opts?.where)) {
          for (const cond of opts.where) {
            if (cond.id !== undefined && cond.id !== -1) {
              const found = allContracts.find((c) => c.id === cond.id);
              if (found) return Promise.resolve(found);
            }
            if (cond.contract_number) {
              const found = allContracts.find((c) => c.contract_number === cond.contract_number);
              if (found) return Promise.resolve(found);
            }
          }
        } else if (opts?.where) {
          if (opts.where.id !== undefined && opts.where.id !== -1) {
            const found = allContracts.find((c) => c.id === opts.where.id);
            if (found) return Promise.resolve(found);
          }
          if (opts.where.contract_number) {
            const found = allContracts.find((c) => c.contract_number === opts.where.contract_number);
            if (found) return Promise.resolve(found);
          }
        }
        return Promise.resolve(null);
      }),
    };

    mockUserRepo = {
      find: jest.fn().mockResolvedValue([
        { id: PM_A_ID, fullName: 'Project Manager A', isActive: true, roles: [{ id: 1, name: 'PROJECT_MANAGER' }] },
        { id: PM_B_ID, fullName: 'Project Manager B', isActive: true, roles: [{ id: 2, name: 'PROJECT_MANAGER' }] },
        { id: ADMIN_ID, fullName: 'Super Administrator', isActive: true, roles: [{ id: 3, name: 'SUPER_ADMIN' }] },
        { id: NON_PM_ID, fullName: 'Marketing Officer', isActive: true, roles: [{ id: 4, name: 'MARKETING' }] },
        { id: ARBITRARY_PM_ID, fullName: 'Arbitrary PM', isActive: true, roles: [{ id: 5, name: 'PROJECT_MANAGER' }] },
        { id: PMO_ID, fullName: 'PMO Officer', isActive: true, roles: [{ id: 6, name: 'PMO' }] },
      ]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where?.id === PM_A_ID) {
          return Promise.resolve({
            id: PM_A_ID,
            fullName: 'Project Manager A',
            isActive: true,
            roles: [{ id: 1, name: 'PROJECT_MANAGER' }],
          });
        }
        if (where?.id === PM_B_ID) {
          return Promise.resolve({
            id: PM_B_ID,
            fullName: 'Project Manager B',
            isActive: true,
            roles: [{ id: 2, name: 'PROJECT_MANAGER' }],
          });
        }
        if (where?.id === ADMIN_ID) {
          return Promise.resolve({
            id: ADMIN_ID,
            fullName: 'Super Administrator',
            isActive: true,
            roles: [{ id: 3, name: 'SUPER_ADMIN' }],
          });
        }
        if (where?.id === NON_PM_ID) {
          return Promise.resolve({
            id: NON_PM_ID,
            fullName: 'Marketing Officer',
            isActive: true,
            roles: [{ id: 4, name: 'MARKETING' }],
          });
        }
        if (where?.id === ARBITRARY_PM_ID) {
          return Promise.resolve({
            id: ARBITRARY_PM_ID,
            fullName: 'Arbitrary PM',
            isActive: true,
            roles: [{ id: 5, name: 'PROJECT_MANAGER' }],
          });
        }
        if (where?.id === PMO_ID) {
          return Promise.resolve({
            id: PMO_ID,
            fullName: 'PMO Officer',
            isActive: true,
            roles: [{ id: 6, name: 'PMO' }],
          });
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
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Task), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(CostItem), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(AuditLog), useValue: { save: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  describe('PMO Queue Visibility Rules (Phase 2)', () => {
    it('1 & 3. PM A CANNOT see unassigned Legal-released contract in PM workspace; PMO can see it in queue', async () => {
      const pmBoard = await service.getOperationalBoard(PM_A_ID, ['PROJECT_MANAGER']);

      // Unassigned contract is NOT visible to PM A
      const unassignedItemForPm = pmBoard.data.pendingKickoff.find(
        (item: any) => item.contractId === contractUnassigned.id,
      );
      expect(unassignedItemForPm).toBeUndefined();

      // PMO CAN see unassigned contract in pendingKickoff
      const pmoBoard = await service.getOperationalBoard(999, ['PMO']);
      const unassignedItemForPmo = pmoBoard.data.pendingKickoff.find(
        (item: any) => item.contractId === contractUnassigned.id,
      );
      expect(unassignedItemForPmo).toBeDefined();
      expect(unassignedItemForPmo.project_code).toBe(contractUnassigned.contract_number);
      expect(unassignedItemForPmo.status).toBe('PENDING_KICKOFF');
    });

    it('2. Queue item without PM keeps project_manager_id and managerId as NULL (no fake assignment or project creation)', async () => {
      const board = await service.getOperationalBoard(999, ['PMO']);

      const unassignedItem = board.data.pendingKickoff.find(
        (item: any) => item.contractId === contractUnassigned.id,
      );
      expect(unassignedItem).toBeDefined();
      expect(unassignedItem.managerId).toBeNull();
      expect(unassignedItem.pmName).toBeNull();
      expect(unassignedItem.projectId).toBeNull();

      // Ensure contract was NOT mutated
      expect(contractUnassigned.project_manager_id).toBeNull();

      // Ensure projectRepo.create was NOT called for unassigned contract
      expect(mockProjectRepo.create).not.toHaveBeenCalled();
    });

    it('4. PM A can see their own active project and assigned contract', async () => {
      const board = await service.getOperationalBoard(PM_A_ID, ['PROJECT_MANAGER']);

      // PM A active project is visible
      const pmAActive = board.data.activeProjects.find(
        (p: any) => p.id === projectPmA.id,
      );
      expect(pmAActive).toBeDefined();
      expect(pmAActive.project_code).toBe(projectPmA.code);
    });

    it('5. PM A CANNOT see projects or contracts belonging to PM B (Anti-IDOR / Ownership Scoping)', async () => {
      const board = await service.getOperationalBoard(PM_A_ID, ['PROJECT_MANAGER']);

      // PM B active project is NOT visible
      const pmBActive = board.data.activeProjects.some(
        (p: any) => p.id === projectPmB.id,
      );
      expect(pmBActive).toBe(false);

      // PM B assigned contract is NOT visible in pendingKickoff
      const pmBPending = board.data.pendingKickoff.some(
        (c: any) => c.contractId === contractPmB.id,
      );
      expect(pmBPending).toBe(false);

      // Unreleased/Draft contracts are NOT visible in pendingKickoff
      const unreleasedPending = board.data.pendingKickoff.some(
        (c: any) => c.contractId === contractUnreleased.id,
      );
      expect(unreleasedPending).toBe(false);
    });

    it('6. SUPER_ADMIN has administrative visibility across all items without taking ownership', async () => {
      const board = await service.getOperationalBoard(ADMIN_ID, ['SUPER_ADMIN']);

      // Admin sees active projects for both PM A and PM B
      expect(board.data.activeProjects).toHaveLength(2);
      expect(board.data.activeProjects.some((p: any) => p.id === projectPmA.id)).toBe(true);
      expect(board.data.activeProjects.some((p: any) => p.id === projectPmB.id)).toBe(true);

      // Admin sees both assigned and unassigned approved contracts
      const unassignedItem = board.data.pendingKickoff.find(
        (item: any) => item.contractId === contractUnassigned.id,
      );
      expect(unassignedItem).toBeDefined();
      // Visibility != ownership: Admin does NOT become PM
      expect(unassignedItem.managerId).toBeNull();
      expect(unassignedItem.managerId).not.toBe(ADMIN_ID);
      expect(mockProjectRepo.create).not.toHaveBeenCalled();
    });

    it('7. No hardcoded identity fallback (userId !== 1, managerId !== 1 for unassigned items in PMO queue)', async () => {
      const arbitraryPmId = 777;
      const pmBoard = await service.getOperationalBoard(arbitraryPmId, ['PROJECT_MANAGER']);
      const unassignedItemForPm = pmBoard.data.pendingKickoff.find(
        (item: any) => item.contractId === contractUnassigned.id,
      );
      expect(unassignedItemForPm).toBeUndefined();

      const arbitraryPmoId = 888;
      const pmoBoard = await service.getOperationalBoard(arbitraryPmoId, ['PMO']);
      const unassignedItem = pmoBoard.data.pendingKickoff.find(
        (item: any) => item.contractId === contractUnassigned.id,
      );
      expect(unassignedItem).toBeDefined();
      expect(unassignedItem.managerId).toBeNull();
      expect(unassignedItem.managerId).not.toBe(1);
      expect(unassignedItem.managerId).not.toBe(arbitraryPmoId);
    });
  });

  describe('Phase 3: PM Assignment & Ownership Rules', () => {
    it('A. PMO can assign an eligible PM to an unassigned charter -> success, contract.project_manager_id = PM ID, project.managerId = PM ID, project.status = PLANNING', async () => {
      expect(contractUnassigned.project_manager_id).toBeNull();

      const res = await service.assignProjectManager(contractUnassigned.id, PM_A_ID, PMO_ID, ['PMO']);

      expect(res.statusCode).toBe(200);
      expect(contractUnassigned.project_manager_id).toBe(PM_A_ID);
      expect(res.project.managerId).toBe(PM_A_ID);
      expect(res.project.status).toBe('PLANNING');
    });

    it('B. PMO assign PM -> project status remains PLANNING, not IN_PROGRESS', async () => {
      const unassignedForB: Partial<Contract> = {
        id: 106,
        contract_number: 'CONT-UNASSIGNED-006',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
        proposal: {
          tender: { title: 'Tender B Test', project_location: 'Jakarta' },
        } as any,
        ...({ pmo_queue: 'PENDING_KICKOFF' } as any),
      };
      mockContractRepo.findOne.mockResolvedValueOnce(unassignedForB);

      const res = await service.assignProjectManager(unassignedForB.id, PM_A_ID, PMO_ID, ['PMO']);

      expect(res.project.status).toBe('PLANNING');
      expect(res.project.status).not.toBe('IN_PROGRESS');
      expect(res.data.status).toBe('PLANNING');
      expect(res.data.status).not.toBe('IN_PROGRESS');
    });

    it('C. PM A mencoba claim item yang sudah dimiliki PM B -> reject legacy claim & PM B tetap owner', async () => {
      expect(contractPmB.project_manager_id).toBe(PM_B_ID);

      await expect(
        service.claimCharter(contractPmB.id, {}, PM_A_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      expect(contractPmB.project_manager_id).toBe(PM_B_ID);
      expect(contractPmB.project_manager_id).not.toBe(PM_A_ID);
    });

    it('D. SUPER_ADMIN mencoba claim sebagai PM -> reject & tidak boleh menjadikan Admin/Super Admin sebagai PM', async () => {
      const unassignedForD: Partial<Contract> = {
        id: 107,
        contract_number: 'CONT-UNASSIGNED-007',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
        ...({ pmo_queue: 'PENDING_KICKOFF' } as any),
      };
      mockContractRepo.findOne.mockResolvedValueOnce(unassignedForD);

      await expect(
        service.claimCharter(unassignedForD.id, {}, ADMIN_ID, ['SUPER_ADMIN']),
      ).rejects.toThrow(ForbiddenException);

      expect(unassignedForD.project_manager_id).toBeNull();
      expect(unassignedForD.project_manager_id).not.toBe(ADMIN_ID);
    });

    it('E. Non-PM mencoba claim -> reject legacy claim', async () => {
      await expect(
        service.claimCharter(contractUnassigned.id, {}, NON_PM_ID, ['MARKETING']),
      ).rejects.toThrow(ForbiddenException);

      expect(contractUnassigned.project_manager_id).toBeNull();
    });

    it('F. Contract belum Legal APPROVED -> PMO assign reject', async () => {
      await expect(
        service.assignProjectManager(contractUnreleased.id, PM_A_ID, PMO_ID, ['PMO']),
      ).rejects.toThrow(BadRequestException);
    });

    it('G. Contract APPROVED tetapi bukan PMO Queue (status bukan ACTIVE) -> PMO assign reject', async () => {
      await expect(
        service.assignProjectManager(contractNotActive.id, PM_A_ID, PMO_ID, ['PMO']),
      ).rejects.toThrow(BadRequestException);
    });

    it('H. Tidak ada hardcoded identity fallback (arbitrary PM ID is preserved without fallback to 1)', async () => {
      const unassignedForH: Partial<Contract> = {
        id: 108,
        contract_number: 'CONT-UNASSIGNED-008',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
        proposal: {
          tender: { title: 'Tender H Test', project_location: 'Medan' },
        } as any,
        ...({ pmo_queue: 'PENDING_KICKOFF' } as any),
      };
      mockContractRepo.findOne.mockResolvedValueOnce(unassignedForH);

      const res = await service.assignProjectManager(unassignedForH.id, ARBITRARY_PM_ID, PMO_ID, ['PMO']);

      expect(res.statusCode).toBe(200);
      expect(unassignedForH.project_manager_id).toBe(ARBITRARY_PM_ID);
      expect(res.project.managerId).toBe(ARBITRARY_PM_ID);
      expect(unassignedForH.project_manager_id).not.toBe(1);
      expect(res.project.managerId).not.toBe(1);
    });
  });

  describe('Phase 3 Final Correction: Canonical Current-State PMO Assignment & Legacy Claim Deprecation Rules', () => {
    it('A. APPROVED + ACTIVE + unassigned -> PMO assign ALLOW', async () => {
      const contractForA: Partial<Contract> = {
        id: 301,
        contract_number: 'CONT-CANONICAL-301',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
        proposal: {
          tender: { title: 'Tender Canonical 301', project_location: 'Jakarta' },
        } as any,
      };
      mockContractRepo.findOne.mockResolvedValueOnce(contractForA);

      const res = await service.assignProjectManager(contractForA.id, PM_A_ID, PMO_ID, ['PMO']);

      expect(res.statusCode).toBe(200);
      expect(contractForA.project_manager_id).toBe(PM_A_ID);
      expect(res.project.managerId).toBe(PM_A_ID);
      expect(res.project.status).toBe('PLANNING');
    });

    it('B. APPROVED + ACTIVE + unassigned + TIDAK ADA AuditLog release -> PMO assign TETAP ALLOW (AuditLog bukan requirement)', async () => {
      const contractForB: Partial<Contract> = {
        id: 302,
        contract_number: 'CONT-NOAUDIT-302',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
        proposal: {
          tender: { title: 'Tender No Audit 302', project_location: 'Surabaya' },
        } as any,
      };
      mockContractRepo.findOne.mockResolvedValueOnce(contractForB);

      const res = await service.assignProjectManager(contractForB.id, PM_A_ID, PMO_ID, ['PMO']);

      expect(res.statusCode).toBe(200);
      expect(contractForB.project_manager_id).toBe(PM_A_ID);
      expect(res.project.managerId).toBe(PM_A_ID);
      expect(res.project.status).toBe('PLANNING');
    });

    it('C. APPROVED + ACTIVE tetapi kondisi current state tidak memenuhi queue (project sudah IN_PROGRESS) -> PMO assign REJECT', async () => {
      const contractForC: Partial<Contract> = {
        id: 303,
        contract_number: 'CONT-INPROGRESS-303',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
      };
      mockContractRepo.findOne.mockResolvedValueOnce(contractForC);
      mockProjectRepo.findOne.mockResolvedValueOnce({
        id: 55,
        code: contractForC.contract_number,
        status: 'IN_PROGRESS',
        managerId: null,
      });

      await expect(
        service.assignProjectManager(contractForC.id, PM_A_ID, PMO_ID, ['PMO']),
      ).rejects.toThrow(BadRequestException);
    });

    it('D. Belum APPROVED -> PMO assign REJECT', async () => {
      const contractForD: Partial<Contract> = {
        id: 304,
        contract_number: 'CONT-DRAFT-304',
        legal_status: LegalStatus.DRAFT,
        status: 'ACTIVE',
        project_manager_id: null,
      };
      mockContractRepo.findOne.mockResolvedValueOnce(contractForD);

      await expect(
        service.assignProjectManager(contractForD.id, PM_A_ID, PMO_ID, ['PMO']),
      ).rejects.toThrow(BadRequestException);
    });

    it('E. Tidak ACTIVE -> PMO assign REJECT', async () => {
      const contractForE: Partial<Contract> = {
        id: 305,
        contract_number: 'CONT-PENDING-305',
        legal_status: LegalStatus.APPROVED,
        status: 'PENDING',
        project_manager_id: null,
      };
      mockContractRepo.findOne.mockResolvedValueOnce(contractForE);

      await expect(
        service.assignProjectManager(contractForE.id, PM_A_ID, PMO_ID, ['PMO']),
      ).rejects.toThrow(BadRequestException);
    });

    it('F. Dedicated regression: Legacy claimCharter is rejected fail-closed for all roles (PM, PMO, SUPER_ADMIN, and others)', async () => {
      const contractForF: Partial<Contract> = {
        id: 306,
        contract_number: 'CONT-FAILCLOSED-306',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
      };
      mockContractRepo.findOne.mockResolvedValue(contractForF);

      // 1. PROJECT_MANAGER -> 403 ForbiddenException
      await expect(
        service.claimCharter(contractForF.id, {}, PM_A_ID, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      // 2. PMO -> 403 ForbiddenException
      await expect(
        service.claimCharter(contractForF.id, {}, PMO_ID, ['PMO']),
      ).rejects.toThrow(ForbiddenException);

      // 3. SUPER_ADMIN -> 403 ForbiddenException
      await expect(
        service.claimCharter(contractForF.id, {}, ADMIN_ID, ['SUPER_ADMIN']),
      ).rejects.toThrow(ForbiddenException);

      // 4. Other roles (e.g. MARKETING) -> 403 ForbiddenException
      await expect(
        service.claimCharter(contractForF.id, {}, NON_PM_ID, ['MARKETING']),
      ).rejects.toThrow(ForbiddenException);

      // Assert no project creation or ownership mutation occurred
      expect(contractForF.project_manager_id).toBeNull();
    });

    it('G. PMO assignment actor cannot self-assign as Project Manager (SoD enforcement)', async () => {
      const contractForG: Partial<Contract> = {
        id: 307,
        contract_number: 'CONT-SOD-307',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
      };
      mockContractRepo.findOne.mockResolvedValueOnce(contractForG);

      // Self-assignment attempt where actor is assigned as PM
      await expect(
        service.assignProjectManager(contractForG.id, PMO_ID, PMO_ID, ['PMO']),
      ).rejects.toThrow(BadRequestException);

      expect(contractForG.project_manager_id).toBeNull();
    });

    it('H. Assignment berhasil -> status tetap PLANNING, bukan IN_PROGRESS', async () => {
      const contractForH: Partial<Contract> = {
        id: 308,
        contract_number: 'CONT-PLANNING-308',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
        proposal: {
          tender: { title: 'Tender Planning 308', project_location: 'Semarang' },
        } as any,
      };
      mockContractRepo.findOne.mockResolvedValueOnce(contractForH);

      const res = await service.assignProjectManager(contractForH.id, PM_A_ID, PMO_ID, ['PMO']);

      expect(res.project.status).toBe('PLANNING');
      expect(res.project.status).not.toBe('IN_PROGRESS');
      expect(res.data.status).toBe('PLANNING');
      expect(res.data.status).not.toBe('IN_PROGRESS');
    });

    it('I. Tidak ada fallback identity (userId !== 1, managerId !== 1 for arbitrary PM)', async () => {
      const contractForI: Partial<Contract> = {
        id: 309,
        contract_number: 'CONT-ARBITRARY-309',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
        proposal: {
          tender: { title: 'Tender Arbitrary 309', project_location: 'Bali' },
        } as any,
      };
      mockContractRepo.findOne.mockResolvedValueOnce(contractForI);

      const res = await service.assignProjectManager(contractForI.id, ARBITRARY_PM_ID, PMO_ID, ['PMO']);

      expect(res.statusCode).toBe(200);
      expect(contractForI.project_manager_id).toBe(ARBITRARY_PM_ID);
      expect(res.project.managerId).toBe(ARBITRARY_PM_ID);
      expect(contractForI.project_manager_id).not.toBe(1);
      expect(res.project.managerId).not.toBe(1);
    });
  });
});
