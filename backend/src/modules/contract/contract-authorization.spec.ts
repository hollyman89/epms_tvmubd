import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { LegalService } from '../legal/legal.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { ContractAmendment } from '../../entities/contract-amendment.entity';
import { Tender } from '../../entities/tender.entity';
import { User } from '../../entities/user.entity';

describe('SEC-01 & SEC-11: Contract Mutation Authorization & Canonical Governance Boundary', () => {
  let controller: ContractController;
  let service: ContractService;
  let contractRepoMock: any;
  let legalServiceMock: any;
  let eventEmitterMock: any;
  let amendmentRepoMock: any;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockDraftContract: Partial<Contract> = {
    id: 1,
    contract_number: 'CONT-20260901-0001',
    contract_value: 50000000,
    legal_status: LegalStatus.DRAFT,
    status: 'DRAFT',
    customer_id: 10,
    project_manager_id: 5,
    created_at: new Date('2026-09-01'),
  };

  const mockApprovedContract: Partial<Contract> = {
    id: 2,
    contract_number: 'CONT-20260901-0002',
    contract_value: 100000000,
    legal_status: LegalStatus.APPROVED,
    status: 'APPROVED',
    customer_id: 10,
    project_manager_id: 5,
    created_at: new Date('2026-09-01'),
  };

  beforeEach(async () => {
    contractRepoMock = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) return Promise.resolve({ ...mockDraftContract });
        if (where.id === 2) return Promise.resolve({ ...mockApprovedContract });
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    legalServiceMock = {
      reviewContract: jest.fn().mockImplementation((dto, userId) => {
        return Promise.resolve({
          id: Number(dto.contractId),
          contract_number: 'CONT-20260901-0001',
          legal_status: LegalStatus.APPROVED,
          status: 'ACTIVE',
          legal_reviewer_id: userId,
          proposal: { id: 1, status: 'APPROVED' },
          tender: { id: 10, stage: 'WON', status: 'WON', spk_verification_status: 'VERIFIED' },
        });
      }),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    amendmentRepoMock = {
      create: jest.fn().mockImplementation((data) => ({ id: 1, ...data })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractController],
      providers: [
        ContractService,
        Reflector,
        RolesGuard,
        { provide: getRepositoryToken(Contract), useValue: contractRepoMock },
        { provide: getRepositoryToken(ContractAmendment), useValue: amendmentRepoMock },
        { provide: getRepositoryToken(Tender), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: EventEmitter2, useValue: eventEmitterMock },
        { provide: 'BullQueue_pdf-generation', useValue: { add: jest.fn(), getJob: jest.fn() } },
        { provide: LegalService, useValue: legalServiceMock },
      ],
    }).compile();

    controller = module.get<ContractController>(ContractController);
    service = module.get<ContractService>(ContractService);
    reflector = module.get<Reflector>(Reflector);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
  });

  describe('1. Controller RBAC Guard Verification', () => {
    it('should have @Roles metadata specifying SUPER_ADMIN, LEGAL, and DIRECTOR only', () => {
      const roles = reflector.get<string[]>('roles', ContractController.prototype.update);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['SUPER_ADMIN', 'LEGAL', 'DIRECTOR']);
      expect(roles).not.toContain('PROJECT_MANAGER');
      expect(roles).not.toContain('FINANCE');
      expect(roles).not.toContain('MARKETING');
    });

    it('RolesGuard should REJECT user with unauthorized roles (e.g. PROJECT_MANAGER, FINANCE)', () => {
      const mockExecutionContext = (roles: string[]): ExecutionContext =>
        ({
          getHandler: () => ContractController.prototype.update,
          getClass: () => ContractController,
          switchToHttp: () => ({
            getRequest: () => ({
              user: { userId: 99, roles },
            }),
          }),
        } as any);

      expect(rolesGuard.canActivate(mockExecutionContext(['PROJECT_MANAGER']))).toBe(false);
      expect(rolesGuard.canActivate(mockExecutionContext(['FINANCE']))).toBe(false);
      expect(rolesGuard.canActivate(mockExecutionContext(['MARKETING']))).toBe(false);
      expect(rolesGuard.canActivate(mockExecutionContext([]))).toBe(false);
    });

    it('RolesGuard should ALLOW authorized roles (SUPER_ADMIN, LEGAL, DIRECTOR)', () => {
      const mockExecutionContext = (roles: string[]): ExecutionContext =>
        ({
          getHandler: () => ContractController.prototype.update,
          getClass: () => ContractController,
          switchToHttp: () => ({
            getRequest: () => ({
              user: { userId: 5, roles },
            }),
          }),
        } as any);

      expect(rolesGuard.canActivate(mockExecutionContext(['LEGAL']))).toBe(true);
      expect(rolesGuard.canActivate(mockExecutionContext(['SUPER_ADMIN']))).toBe(true);
      expect(rolesGuard.canActivate(mockExecutionContext(['DIRECTOR']))).toBe(true);
    });
  });

  describe('2. Authorized Update with Allowed Business Fields', () => {
    it('should allow updating whitelisted business fields on DRAFT contract', async () => {
      const updatePayload = {
        contract_value: 75000000,
        start_date: new Date('2026-10-01'),
        end_date: new Date('2026-12-31'),
        spk_file_url: 'https://storage.example.com/spk.pdf',
      };

      const result = await service.update(1, updatePayload, 42);

      expect(result.contract_value).toBe(75000000);
      expect(result.start_date).toEqual(new Date('2026-10-01'));
      expect(result.end_date).toEqual(new Date('2026-12-31'));
      expect(result.spk_file_url).toBe('https://storage.example.com/spk.pdf');
      expect(result.updated_by).toBe(42);
      expect(contractRepoMock.save).toHaveBeenCalled();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({
        action: 'CONTRACT_UPDATED',
        entityId: 1,
        entityName: 'contracts',
        oldValue: expect.objectContaining({ contract_value: 50000000 }),
        newValue: expect.objectContaining({ contract_value: 75000000 }),
        userId: 42,
      }));
    });

    it('should create amendment and record AuditLog on contract amend', async () => {
      const amendment = await service.amend(1, 42, 'Scope expansion', 80000000);

      expect(amendment).toBeDefined();
      expect(amendment.new_value).toBe(80000000);
      expect(amendment.reason).toBe('Scope expansion');
      expect(amendmentRepoMock.save).toHaveBeenCalled();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({
        action: 'CONTRACT_AMENDED',
        entityId: 1,
        entityName: 'contracts',
        oldValue: { contract_value: 50000000 },
        newValue: expect.objectContaining({
          contract_value: 80000000,
          reason: 'Scope expansion',
        }),
        userId: 42,
      }));
    });

    it('should throw NotFoundException if contract does not exist', async () => {
      await expect(service.update(999, { contract_value: 1000 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('3. APPROVED Contract Protection', () => {
    it('should strictly reject direct update when contract is APPROVED', async () => {
      await expect(
        service.update(2, { contract_value: 99000000 }, 42)
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.update(2, { contract_value: 99000000 }, 42)
      ).rejects.toThrow(/Cannot update an APPROVED contract directly/);
    });
  });

  describe('4. Governance & Workflow Field Protection', () => {
    it('should reject direct mutation of legal_status', async () => {
      await expect(
        service.update(1, { legal_status: LegalStatus.APPROVED }, 42)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(1, { legal_status: LegalStatus.APPROVED }, 42)
      ).rejects.toThrow(/governance or workflow field 'legal_status'/);
    });

    it('should reject direct mutation of contract status', async () => {
      await expect(
        service.update(1, { status: 'ACTIVE' }, 42)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(1, { status: 'ACTIVE' }, 42)
      ).rejects.toThrow(/governance or workflow field 'status'/);
    });

    it('should reject direct mutation of contract_number', async () => {
      await expect(
        service.update(1, { contract_number: 'CONT-HACKED-9999' }, 42)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject direct mutation of approval / legal review fields', async () => {
      await expect(
        service.update(1, { legal_reviewer_id: 10 }, 42)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(1, { legal_notes: 'Bypassed notes' }, 42)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject direct mutation of ops activation and grace period fields', async () => {
      await expect(
        service.update(1, { ops_team_activated_at: new Date() }, 42)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(1, { grace_deadline: new Date() }, 42)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(1, { grace_extension_count: 5 }, 42)
      ).rejects.toThrow(BadRequestException);
    });
  });

  // 5. P0-4E1: ELIMINATION OF SHADOW APPROVAL & CANONICAL DELEGATION (SEC-11-01)
  describe('5. P0-4E1: Elimination of Shadow Approval & Delegation to Canonical Legal Review (SEC-11-01)', () => {
    it('Controller approve endpoint requires SUPER_ADMIN, LEGAL, or DIRECTOR roles', () => {
      const roles = reflector.get<string[]>('roles', ContractController.prototype.approve);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['SUPER_ADMIN', 'LEGAL', 'DIRECTOR']);
      expect(roles).not.toContain('PROJECT_MANAGER');
      expect(roles).not.toContain('FINANCE');
      expect(roles).not.toContain('MARKETING');
    });

    it('RolesGuard rejects unauthorized roles (e.g. PROJECT_MANAGER, MARKETING) on approve endpoint', () => {
      const mockExecutionContext = (roles: string[]): ExecutionContext =>
        ({
          getHandler: () => ContractController.prototype.approve,
          getClass: () => ContractController,
          switchToHttp: () => ({
            getRequest: () => ({
              user: { userId: 88, roles },
            }),
          }),
        } as any);

      expect(rolesGuard.canActivate(mockExecutionContext(['PROJECT_MANAGER']))).toBe(false);
      expect(rolesGuard.canActivate(mockExecutionContext(['MARKETING']))).toBe(false);
      expect(rolesGuard.canActivate(mockExecutionContext(['FINANCE']))).toBe(false);
      expect(rolesGuard.canActivate(mockExecutionContext([]))).toBe(false);
    });

    it('RolesGuard allows authorized roles (SUPER_ADMIN, LEGAL, DIRECTOR) on approve endpoint', () => {
      const mockExecutionContext = (roles: string[]): ExecutionContext =>
        ({
          getHandler: () => ContractController.prototype.approve,
          getClass: () => ContractController,
          switchToHttp: () => ({
            getRequest: () => ({
              user: { userId: 77, roles },
            }),
          }),
        } as any);

      expect(rolesGuard.canActivate(mockExecutionContext(['LEGAL']))).toBe(true);
      expect(rolesGuard.canActivate(mockExecutionContext(['SUPER_ADMIN']))).toBe(true);
      expect(rolesGuard.canActivate(mockExecutionContext(['DIRECTOR']))).toBe(true);
    });

    it('Controller rejects request with missing actor identity (UnauthorizedException)', async () => {
      const mockReq = { user: null };
      await expect(controller.approve('1', mockReq as any)).rejects.toThrow(UnauthorizedException);
      await expect(controller.approve('1', mockReq as any)).rejects.toThrow(
        /Identitas pengguna tidak ditemukan pada token/,
      );
    });

    it('Controller extracts authentic userId from JWT req.user without mock fallback', async () => {
      const mockReq = { user: { userId: 55 } };
      const approveSpy = jest.spyOn(service, 'approveContract');

      await controller.approve('1', mockReq as any);

      expect(approveSpy).toHaveBeenCalledWith(1, 55);
    });

    it('Service approveContract delegates directly to canonical legalService.reviewContract', async () => {
      const result = await service.approveContract(1, 42);

      expect(legalServiceMock.reviewContract).toHaveBeenCalledTimes(1);
      expect(legalServiceMock.reviewContract).toHaveBeenCalledWith(
        {
          contractId: 1,
          legalStatus: LegalStatus.APPROVED,
          legalNotes: 'Approved via delegated contract approval endpoint',
        },
        42,
      );
      expect(result).toBeDefined();
      expect(result.legal_status).toBe(LegalStatus.APPROVED);
      expect(result.status).toBe('ACTIVE');
    });

    it('approveContract does NOT perform direct independent contractRepo.save() (Zero Shadow Mutation)', async () => {
      contractRepoMock.save.mockClear();

      await service.approveContract(1, 42);

      expect(contractRepoMock.save).not.toHaveBeenCalled();
    });

    it('Service approveContract validates contractId parameter', async () => {
      await expect(service.approveContract(0, 42)).rejects.toThrow(BadRequestException);
      await expect(service.approveContract(NaN, 42)).rejects.toThrow(BadRequestException);
      await expect(service.approveContract(-5, 42)).rejects.toThrow(BadRequestException);
    });

    it('Service approveContract validates userId parameter', async () => {
      await expect(service.approveContract(1, 0)).rejects.toThrow(UnauthorizedException);
      await expect(service.approveContract(1, null as any)).rejects.toThrow(UnauthorizedException);
    });
  });
});
