import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('AuditController - Unit & RBAC Security Tests', () => {
  let controller: AuditController;
  let serviceMock: any;

  const mockResponse = {
    data: [
      {
        id: 1,
        table_name: 'vendors',
        record_id: 6,
        action: 'CREATE',
        old_value: null,
        new_value: { code: 'VND-006' },
        ip_address: null,
        user_agent: null,
        created_by: 37,
        created_at: new Date(),
        actor: { id: 37, full_name: 'Admin', email: 'admin@epms.com' },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  beforeEach(async () => {
    serviceMock = {
      getAuditLogs: jest.fn().mockResolvedValue(mockResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  it('1. GET /api/v1/audit-logs - delegates to AuditService.getAuditLogs with query parameters', async () => {
    const query = { page: 1, limit: 10, tableName: 'vendors' };
    const result = await controller.getAuditLogs(query);

    expect(serviceMock.getAuditLogs).toHaveBeenCalledWith(query);
    expect(result).toEqual(mockResponse);
  });

  it('2. RBAC & Guards - controller is guarded by JwtAuthGuard and RolesGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuditController);
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('3. SUPER_ADMIN enforcement - getAuditLogs handler strictly requires SUPER_ADMIN role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.getAuditLogs);
    expect(roles).toBeDefined();
    expect(roles).toEqual(['SUPER_ADMIN']);
    expect(roles).not.toContain('PROJECT_MANAGER');
    expect(roles).not.toContain('FINANCE');
    expect(roles).not.toContain('PROCUREMENT');
  });

  it('4. Read-Only API verification - GET endpoint exists and NO mutating methods (POST/PATCH/PUT/DELETE) exist', () => {
    const prototype = Object.getPrototypeOf(controller);
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (m) => m !== 'constructor',
    );

    // GET handler must exist
    expect(methodNames).toContain('getAuditLogs');

    // NO mutating endpoints allowed on AuditController
    expect(methodNames).not.toContain('createAuditLog');
    expect(methodNames).not.toContain('updateAuditLog');
    expect(methodNames).not.toContain('deleteAuditLog');
    expect(methodNames).not.toContain('patchAuditLog');

    // Exactly one route handler exists on the controller
    expect(methodNames.length).toBe(1);
  });
});
