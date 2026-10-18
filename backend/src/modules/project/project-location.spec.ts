import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ForbiddenException } from '@nestjs/common';
import { ClaimCharterDto } from './dto/claim-charter.dto';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';

describe('Project Location Schema & API Specification', () => {
  describe('ClaimCharterDto Validation', () => {
    it('should validate valid latitude and longitude coordinates', async () => {
      const dto = plainToInstance(ClaimCharterDto, {
        siteName: 'Site Rumah Net FKI Karawang',
        city: 'Karawang',
        province: 'Jawa Barat',
        address: 'Jl. Raya Klari No. 88',
        postalCode: '41371',
        latitude: -6.305421,
        longitude: 107.301452,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid latitude (> 90)', async () => {
      const dto = plainToInstance(ClaimCharterDto, {
        siteName: 'Site Invalid',
        latitude: 91.0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('latitude');
    });

    it('should reject invalid longitude (< -180)', async () => {
      const dto = plainToInstance(ClaimCharterDto, {
        siteName: 'Site Invalid',
        longitude: -181.0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('longitude');
    });
  });

  describe('Project Service Location Handling', () => {
    let service: ProjectService;
    let mockContractRepo: any;
    let mockProjectRepo: any;
    let mockUserRepo: any;
    let mockWbsRepo: any;
    let mockTaskRepo: any;
    let mockPurchaseRequestRepo: any;
    let mockEventEmitter: any;

    beforeEach(() => {
      mockContractRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        manager: {
          transaction: jest.fn((cb) =>
            cb({
              findOne: jest.fn().mockImplementation((entityClass, options) => {
                return Promise.resolve(null);
              }),
              find: jest.fn().mockResolvedValue([]),
              create: jest.fn((entity, data) => ({ ...data, id: 1 })),
              save: jest.fn((entity, data) => Promise.resolve(data)),
            }),
          ),
        },
      };

      mockProjectRepo = {
        find: jest.fn().mockResolvedValue([
          {
            id: 1,
            code: 'CONT-20260813-0003',
            name: 'Project Yofc Sleman',
            siteName: 'Site Project Yofc Sleman',
            city: 'Jawa Tengah',
            province: null,
            address: null,
            postalCode: null,
            latitude: null,
            longitude: null,
            status: 'IN_PROGRESS',
            createdAt: new Date(),
          },
        ]),
        findOne: jest.fn().mockImplementation((options: any) => {
          const where = options?.where;
          if (where?.id === 1) {
            return Promise.resolve({
              id: 1,
              code: 'CONT-20260813-0003',
              name: 'Project Yofc Sleman',
              siteName: 'Site Project Yofc Sleman',
              city: 'Jawa Tengah',
              province: null,
              address: null,
              postalCode: null,
              latitude: null,
              longitude: null,
              status: 'IN_PROGRESS',
              createdAt: new Date(),
            });
          }
          return Promise.resolve(null);
        }),
      };

      mockUserRepo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockImplementation(({ where }) => {
          if (where?.id === 5) {
            return Promise.resolve({
              id: 5,
              fullName: 'Project Manager 5',
              isActive: true,
              roles: [{ name: 'PROJECT_MANAGER' }],
            });
          }
          if (where?.id === 99) {
            return Promise.resolve({
              id: 99,
              fullName: 'PMO Officer',
              isActive: true,
              roles: [{ name: 'PMO' }],
            });
          }
          return Promise.resolve(null);
        }),
      };

      mockPurchaseRequestRepo = {
        find: jest.fn().mockResolvedValue([
          { id: 1, projectId: 2, status: 'APPROVED', prNumber: 'PR-202607-001' },
        ]),
      };

      mockWbsRepo = {};
      mockTaskRepo = { find: jest.fn().mockResolvedValue([]) };
      mockEventEmitter = { emit: jest.fn() };

      service = new ProjectService(
        mockWbsRepo,
        mockTaskRepo,
        mockProjectRepo,
        mockContractRepo,
        mockUserRepo,
        mockPurchaseRequestRepo,
        mockEventEmitter,
      );

      jest.spyOn(service, 'getOperationalReadiness').mockResolvedValue({
        overallStatus: 'READY',
        completenessCount: 4,
        gate: { status: 'READY_FOR_PROCUREMENT' },
      } as any);
    });

    it('should return operational board with structured location fields', async () => {
      mockContractRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          contract_number: 'CONT-20260813-0003',
          proposal: { tender: { title: 'Project Yofc Sleman', project_location: 'Jawa Tengah' } },
        },
      ]);

      const result = await service.getOperationalBoard(1, ['SUPER_ADMIN']);
      expect(result.statusCode).toBe(200);
      expect(result.data.activeProjects.length).toBe(1);
      const activeProject = result.data.activeProjects[0];
      expect(activeProject.siteName).toBe('Site Project Yofc Sleman');
      expect(activeProject.city).toBe('Jawa Tengah');
      expect(activeProject.province).toBeNull();
      expect(activeProject.address).toBeNull();
      expect(activeProject.latitude).toBeNull();
    });

    it('should inherit upstream tender location on PMO assignment', async () => {
      const mockContract = {
        id: 2,
        contract_number: 'CONT-20260724-0002',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
        proposal: {
          tender: {
            title: 'Project CSA-FKI Karawang Rumah Net',
            project_location: 'Karawang',
          },
        },
      };

      mockContractRepo.findOne.mockResolvedValue(mockContract);

      const res = await service.assignProjectManager(2, 5, 99, ['PMO']);
      expect(res.statusCode).toBe(200);
      expect(res.data.city).toBe('Karawang');
      expect(res.data.siteName).toBe('Site Project CSA-FKI Karawang Rumah Net');
      expect(res.data.province).toBeFalsy();
      expect(res.data.address).toBeFalsy();
    });

    it('should reject legacy self-claim with 403 Forbidden', async () => {
      const mockContract = {
        id: 2,
        contract_number: 'CONT-20260724-0002',
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_manager_id: null,
        proposal: {
          tender: {
            title: 'Project CSA-FKI Karawang Rumah Net',
            project_location: 'Karawang',
          },
        },
      };

      mockContractRepo.findOne.mockResolvedValue(mockContract);

      const claimDto: ClaimCharterDto = {
        siteName: 'Gudang Utama Klari',
        city: 'Kabupaten Karawang',
        province: 'Jawa Barat',
        address: 'Jl. Raya Klari No. 88',
        postalCode: '41371',
        latitude: -6.305421,
        longitude: 107.301452,
      };

      await expect(
        service.claimCharter(2, claimDto, 5, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
