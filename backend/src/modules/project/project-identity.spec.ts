import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { Project } from '../../entities/project.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { AuditLog } from '../../entities/audit-log.entity';

describe('ProjectService - Anti-Mock Identity & Project Manager Enforcement (P0-2)', () => {
  let service: ProjectService;
  let projectRepoMock: any;
  let contractRepoMock: any;
  let userRepoMock: any;
  let wbsRepoMock: any;
  let taskRepoMock: any;

  beforeEach(async () => {
    projectRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 99 })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: data.id || 99 })),
    };

    contractRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb) => {
          const fakeManager = {
            findOne: jest.fn(),
            save: jest.fn().mockImplementation((entity, data) => Promise.resolve(data || entity)),
            create: jest.fn().mockImplementation((entity, data) => data),
            getRepository: jest.fn().mockImplementation(() => ({
              findOne: jest.fn(),
              save: jest.fn(),
              create: jest.fn().mockImplementation((data) => data),
            })),
          };
          return cb(fakeManager);
        }),
      },
    };

    userRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    wbsRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      manager: contractRepoMock.manager,
    };

    taskRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: wbsRepoMock },
        { provide: getRepositoryToken(Task), useValue: taskRepoMock },
        { provide: getRepositoryToken(Project), useValue: projectRepoMock },
        { provide: getRepositoryToken(Contract), useValue: contractRepoMock },
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: getRepositoryToken(PurchaseRequest), useValue: { find: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  describe('saveWbsTree Identity Enforcement', () => {
    it('should throw UnauthorizedException when userId is missing or 0', async () => {
      await expect(
        service.saveWbsTree(1, { nodes: [] } as any, undefined as any)
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.saveWbsTree(1, { nodes: [] } as any, 0)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should record authentic actor userId in AuditLog without fallback to User 1', async () => {
      const mockProject = { id: 10, code: 'PRJ-10', name: 'Test Proj', managerId: 42 };
      projectRepoMock.findOne.mockResolvedValue(mockProject);

      let recordedAuditLog: any = null;
      wbsRepoMock.manager.transaction = jest.fn().mockImplementation(async (cb) => {
        const fakeManager = {
          find: jest.fn().mockResolvedValue([]),
          save: jest.fn().mockImplementation((entity, data) => {
            if (entity === AuditLog) {
              recordedAuditLog = data;
            }
            return Promise.resolve(data || entity);
          }),
          create: jest.fn().mockImplementation((entity, data) => {
            if (entity === AuditLog) {
              recordedAuditLog = data;
            }
            return data;
          }),
        };
        return cb(fakeManager);
      });

      const validDto: any = {
        nodes: [
          {
            code: '1.0',
            name: 'Root Phase',
            weightPercentage: 100,
            children: [],
          },
        ],
      };

      const result = await service.saveWbsTree(10, validDto, 42);

      expect(result.statusCode).toBe(200);
      expect(recordedAuditLog).toBeDefined();
      expect(recordedAuditLog.created_by).toBe(42);
      expect(recordedAuditLog.created_by).not.toBe(1);
    });
  });

  describe('rejectCharter Identity Enforcement', () => {
    it('should throw UnauthorizedException when userId is missing or 0', async () => {
      await expect(
        service.rejectCharter(5, { reason: 'Alasan penolakan charter minimal 15 karakter' }, undefined as any)
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.rejectCharter(5, { reason: 'Alasan penolakan charter minimal 15 karakter' }, 0)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should record authentic actor userId in AuditLog upon charter rejection', async () => {
      const mockContract: any = {
        id: 5,
        contract_number: 'CONT-20260901-0005',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: 33,
      };
      contractRepoMock.findOne.mockResolvedValue(mockContract);

      let recordedAuditLog: any = null;
      contractRepoMock.manager.transaction = jest.fn().mockImplementation(async (cb) => {
        const fakeManager = {
          findOne: jest.fn().mockResolvedValue(mockContract),
          save: jest.fn().mockImplementation((entity, data) => {
            if (entity === AuditLog) {
              recordedAuditLog = data;
            }
            return Promise.resolve(data || entity);
          }),
          create: jest.fn().mockImplementation((entity, data) => {
            if (entity === AuditLog) {
              recordedAuditLog = data;
            }
            return data;
          }),
        };
        return cb(fakeManager);
      });

      const result = await service.rejectCharter(5, { reason: 'Alasan pengembalian charter wajib diisi minimal 15 karakter' }, 33);

      expect(result.statusCode).toBe(200);
      expect(recordedAuditLog).toBeDefined();
      expect(recordedAuditLog.created_by).toBe(33);
      expect(recordedAuditLog.created_by).not.toBe(1);
    });
  });

  describe('ensureProjectForContract PM Assignment Enforcement', () => {
    it('should throw BadRequestException when contract has no project_manager_id instead of defaulting to Super Admin (User 1)', async () => {
      const mockContractWithoutPM: any = {
        id: 8,
        contract_number: 'CONT-20260910-0008',
        project_manager_id: null,
      };
      contractRepoMock.findOne.mockResolvedValue(mockContractWithoutPM);
      projectRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.ensureProjectForContract(8)
      ).rejects.toThrow(BadRequestException);
    });

    it('should assign explicit contract.project_manager_id when present', async () => {
      const mockContractWithPM: any = {
        id: 9,
        contract_number: 'CONT-20260910-0009',
        project_manager_id: 17,
        proposal: {
          tender: {
            title: 'Proyek Serat Optik',
            project_location: 'Surabaya',
          },
        },
      };
      contractRepoMock.findOne.mockResolvedValue(mockContractWithPM);
      projectRepoMock.findOne.mockResolvedValue(null);

      const project = await service.ensureProjectForContract(9);

      expect(projectRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CONT-20260910-0009',
          managerId: 17,
        })
      );
      expect(project.managerId).toBe(17);
      expect(project.managerId).not.toBe(1);
    });
  });

  describe('getOperationalBoard PM Assignment Enforcement', () => {
    it('should not assign Super Admin (1) to contracts without explicit project_manager_id', async () => {
      const mockApprovedContractsWithoutPM: any[] = [
        {
          id: 50,
          contract_number: 'CONT-20260911-0050',
          legal_status: LegalStatus.APPROVED,
          project_manager_id: null,
          proposal: {
            id: 20,
            tender_id: 20,
            tender: { title: 'Tender No PM' },
          },
        },
      ];

      contractRepoMock.find.mockImplementation((opts?: any) => {
        if (opts?.where?.legal_status === LegalStatus.APPROVED) {
          return Promise.resolve(mockApprovedContractsWithoutPM);
        }
        return Promise.resolve([]);
      });
      projectRepoMock.find.mockResolvedValue([]);

      const board = await service.getOperationalBoard(1, ['SUPER_ADMIN']);

      expect(board.data.pendingKickoff).toHaveLength(1);
      const item = board.data.pendingKickoff[0];
      expect(item.managerId).toBeNull();
      expect(item.managerId).not.toBe(1);
      // Ensure no automatic project creation with User 1 as PM occurred
      expect(projectRepoMock.create).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if identity is missing (0 or null)', async () => {
      await expect(service.getOperationalBoard(0, ['SUPER_ADMIN'])).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException if role is not authorized', async () => {
      await expect(service.getOperationalBoard(10, ['MARKETING'])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
