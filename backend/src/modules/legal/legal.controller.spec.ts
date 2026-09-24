import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';
import { SlaGraceService } from './sla-grace.service';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('LegalController - RBAC & SLA Grace Extension Authorization (P0-1 & P0-4E3 / SEC-11-04)', () => {
  let controller: LegalController;
  let reflector: Reflector;
  let rolesGuard: RolesGuard;
  let slaGraceServiceMock: any;
  let legalServiceMock: any;

  beforeEach(async () => {
    legalServiceMock = {
      reviewContract: jest.fn(),
      getPendingContracts: jest.fn(),
      getContractsByStatus: jest.fn(),
      startProject: jest.fn(),
    };

    slaGraceServiceMock = {
      requestGraceExtension: jest.fn().mockResolvedValue({
        message: 'Perpanjangan Grace SLA berhasil diterapkan (+3 hari).',
        extensionCount: 1,
        graceDeadline: new Date().toISOString(),
      }),
      getActiveGraceExtensions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LegalController],
      providers: [
        { provide: LegalService, useValue: legalServiceMock },
        { provide: SlaGraceService, useValue: slaGraceServiceMock },
        Reflector,
        RolesGuard,
      ],
    }).compile();

    controller = module.get<LegalController>(LegalController);
    reflector = module.get<Reflector>(Reflector);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Existing RBAC Role Metadata Tests (P0-1)', () => {
    it('reviewContract endpoint should require canonical LEGAL role and NO phantom LEGAL_REVIEWER', () => {
      const roles = reflector.get<string[]>('roles', controller.reviewContract);
      expect(roles).toBeDefined();
      expect(roles).toContain('LEGAL');
      expect(roles).toContain('SUPER_ADMIN');
      expect(roles).toContain('ADMIN');
      expect(roles).toContain('DIRECTOR');
      expect(roles).not.toContain('LEGAL_REVIEWER');
    });

    it('reviewContractAlias endpoint should require canonical LEGAL role and NO phantom LEGAL_REVIEWER', () => {
      const roles = reflector.get<string[]>('roles', controller.reviewContractAlias);
      expect(roles).toBeDefined();
      expect(roles).toContain('LEGAL');
      expect(roles).toContain('SUPER_ADMIN');
      expect(roles).toContain('ADMIN');
      expect(roles).toContain('DIRECTOR');
      expect(roles).not.toContain('LEGAL_REVIEWER');
    });

    it('getPendingContracts endpoint should require LEGAL, SUPER_ADMIN, ADMIN, DIRECTOR roles and exclude MARKETING', () => {
      const roles = reflector.get<string[]>('roles', controller.getPendingContracts);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['LEGAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR']);
      expect(roles).not.toContain('MARKETING');
    });

    it('getContracts endpoint should require LEGAL, SUPER_ADMIN, ADMIN, DIRECTOR roles and exclude MARKETING', () => {
      const roles = reflector.get<string[]>('roles', controller.getContracts);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['LEGAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR']);
      expect(roles).not.toContain('MARKETING');
    });
  });

  describe('SLA Grace Extension RBAC Tests (SEC-11-04)', () => {
    it('1. requestGraceExtension endpoint must have @Roles specifying MARKETING, SUPER_ADMIN, and ADMIN only', () => {
      const roles = reflector.get<string[]>('roles', controller.requestGraceExtension);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['MARKETING', 'SUPER_ADMIN', 'ADMIN']);
      expect(roles).not.toContain('PROJECT_MANAGER');
      expect(roles).not.toContain('LEGAL');
      expect(roles).not.toContain('DIRECTOR');
      expect(roles).not.toContain('PMO');
      expect(roles).not.toContain('PROCUREMENT');
      expect(roles).not.toContain('FINANCE');
    });

    const createMockExecutionContext = (user?: { userId?: number; sub?: number; roles?: string[] }): ExecutionContext =>
      ({
        getHandler: () => controller.requestGraceExtension,
        getClass: () => LegalController,
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as any);

    it('2. RolesGuard allows authorized roles: MARKETING, SUPER_ADMIN, ADMIN', () => {
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 1, roles: ['MARKETING'] }))).toBe(true);
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 2, roles: ['SUPER_ADMIN'] }))).toBe(true);
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 3, roles: ['ADMIN'] }))).toBe(true);
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 4, roles: ['marketing'] }))).toBe(true); // case-insensitive
    });

    it('3. RolesGuard denies unauthorized roles: PROJECT_MANAGER, LEGAL, DIRECTOR, PMO, PROCUREMENT, FINANCE', () => {
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 10, roles: ['PROJECT_MANAGER'] }))).toBe(false);
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 11, roles: ['LEGAL'] }))).toBe(false);
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 12, roles: ['DIRECTOR'] }))).toBe(false);
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 13, roles: ['PMO'] }))).toBe(false);
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 14, roles: ['PROCUREMENT'] }))).toBe(false);
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 15, roles: ['FINANCE'] }))).toBe(false);
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 16, roles: [] }))).toBe(false);
    });

    it('4. RolesGuard denies unauthenticated request (missing user or roles)', () => {
      expect(rolesGuard.canActivate(createMockExecutionContext(undefined))).toBe(false);
      expect(rolesGuard.canActivate(createMockExecutionContext({ userId: 20 }))).toBe(false);
    });

    it('5. Controller handler executes successfully for authenticated caller', async () => {
      const req = { user: { id: 45, roles: ['MARKETING'] } };
      const result = await controller.requestGraceExtension(101, 3, 'Menunggu revisi SPK dari vendor', req);

      expect(slaGraceServiceMock.requestGraceExtension).toHaveBeenCalledWith(
        101,
        3,
        45,
        'Menunggu revisi SPK dari vendor',
      );
      expect(result).toBeDefined();
      expect(result.extensionCount).toBe(1);
    });

    it('6. Controller handler throws UnauthorizedException (401) if userId is missing from token', async () => {
      const req = { user: {} };
      await expect(
        controller.requestGraceExtension(101, 3, 'Reason', req),
      ).rejects.toThrow(new UnauthorizedException('Identitas pengguna tidak ditemukan pada token'));
    });
  });

  describe('startProject Endpoint Authorization & Delegation (PMO Handover)', () => {
    it('1. startProject endpoint must have @Roles specifying PMO, PROJECT_MANAGER, SUPER_ADMIN, ADMIN, DIRECTOR', () => {
      const roles = reflector.get<string[]>('roles', controller.startProject);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['PMO', 'PROJECT_MANAGER', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR']);
      expect(roles).not.toContain('LEGAL');
      expect(roles).not.toContain('MARKETING');
      expect(roles).not.toContain('PROCUREMENT');
      expect(roles).not.toContain('FINANCE');
    });

    it('2. startProject delegates to legalService.startProject with dto and authenticated userId', async () => {
      const dto = { tenderId: 1001, managerId: 88 };
      const req = { user: { sub: 10, roles: ['PMO'] } };
      legalServiceMock.startProject.mockResolvedValue({
        message: 'Kontrak berhasil dirilis ke Antrean Kick-off Charter PMO!',
        project: null,
        contract: { id: 501 },
      });

      const result = await controller.startProject(dto, req);

      expect(legalServiceMock.startProject).toHaveBeenCalledWith(dto, 10);
      expect(result).toBeDefined();
      expect(result.message).toBe('Kontrak berhasil dirilis ke Antrean Kick-off Charter PMO!');
    });

    it('3. startProject throws UnauthorizedException (401) if userId is missing from token', async () => {
      const dto = { tenderId: 1001 };
      const req = { user: {} };
      await expect(controller.startProject(dto, req)).rejects.toThrow(
        new UnauthorizedException('Identitas pengguna tidak ditemukan pada token'),
      );
    });
  });
});

