import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService, sanitizeSnapshot } from './audit.service';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';

describe('AuditService - Canonical Read Layer Unit Tests', () => {
  let service: AuditService;
  let auditRepoMock: any;
  let userRepoMock: any;
  let qbMock: any;

  const mockAuditLogs: AuditLog[] = [
    {
      id: 11,
      table_name: 'vendors',
      record_id: 9,
      action: 'SOFT_DELETE',
      old_value: { code: 'VND-006', name: 'CV KMP' },
      new_value: null,
      ip_address: null,
      user_agent: null,
      created_by: 37,
      created_at: new Date('2026-09-11T02:19:27.000Z'),
    },
    {
      id: 10,
      table_name: 'vendors',
      record_id: 9,
      action: 'CREATE',
      old_value: null,
      new_value: { code: 'VND-006', name: 'CV KMP', password: 'plain-secret-password' },
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0',
      created_by: 41,
      created_at: new Date('2026-09-11T02:18:25.000Z'),
    },
    {
      id: 9,
      table_name: 'contracts',
      record_id: 2,
      action: 'CONTRACT_APPROVED',
      old_value: { status: 'PENDING' },
      new_value: { status: 'APPROVED' },
      ip_address: null,
      user_agent: null,
      created_by: 0, // System actor
      created_at: new Date('2026-09-10T10:00:00.000Z'),
    },
  ];

  const mockUsers: Partial<User>[] = [
    { id: 37, fullName: 'Super Administrator', email: 'superadmin@epms.com' },
    { id: 41, fullName: 'Procurement Specialist', email: 'procurement@epms.com' },
  ];

  beforeEach(async () => {
    qbMock = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[...mockAuditLogs], mockAuditLogs.length]),
    };

    auditRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
    };

    userRepoMock = {
      find: jest.fn().mockResolvedValue([...mockUsers]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: auditRepoMock,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepoMock,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. pagination - computes correct skip, take, total, and totalPages', async () => {
    qbMock.getManyAndCount.mockResolvedValue([mockAuditLogs.slice(0, 2), 11]);

    const result = await service.getAuditLogs({ page: 2, limit: 2 });

    expect(qbMock.skip).toHaveBeenCalledWith(2); // (page - 1) * limit = 1 * 2 = 2
    expect(qbMock.take).toHaveBeenCalledWith(2);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(2);
    expect(result.total).toBe(11);
    expect(result.totalPages).toBe(6); // ceil(11 / 2) = 6
    expect(result.data.length).toBe(2);
  });

  it('2. tableName filter - applies parameterized andWhere', async () => {
    await service.getAuditLogs({ tableName: 'vendors' });

    expect(qbMock.andWhere).toHaveBeenCalledWith('audit.table_name = :tableName', { tableName: 'vendors' });
  });

  it('3. action filter - applies parameterized andWhere', async () => {
    await service.getAuditLogs({ action: 'SOFT_DELETE' });

    expect(qbMock.andWhere).toHaveBeenCalledWith('audit.action = :action', { action: 'SOFT_DELETE' });
  });

  it('4. actorId filter - applies parameterized andWhere including system actor 0', async () => {
    await service.getAuditLogs({ actorId: 0 });

    expect(qbMock.andWhere).toHaveBeenCalledWith('audit.created_by = :actorId', { actorId: 0 });
  });

  it('5. dateFrom - applies timestamp-safe boundary semantics (>= start of requested date)', async () => {
    await service.getAuditLogs({ dateFrom: '2026-09-01' });

    expect(qbMock.andWhere).toHaveBeenCalledWith(
      'audit.created_at >= :dateFrom',
      expect.objectContaining({ dateFrom: expect.any(Date) }),
    );
    const dateFromArg = qbMock.andWhere.mock.calls.find(
      (call: any[]) => call[0] === 'audit.created_at >= :dateFrom',
    )[1].dateFrom;
    expect(dateFromArg.toISOString()).toContain('2026-09-01T00:00:00.000Z');
  });

  it('6. dateTo - applies timestamp-safe boundary semantics (< start of following date for YYYY-MM-DD)', async () => {
    await service.getAuditLogs({ dateTo: '2026-09-11' });

    expect(qbMock.andWhere).toHaveBeenCalledWith(
      'audit.created_at < :dateTo',
      expect.objectContaining({ dateTo: expect.any(Date) }),
    );
    const dateToArg = qbMock.andWhere.mock.calls.find(
      (call: any[]) => call[0] === 'audit.created_at < :dateTo',
    )[1].dateTo;
    // For 2026-09-11, following date start is 2026-09-12T00:00:00.000Z so entire day is included
    expect(dateToArg.toISOString()).toContain('2026-09-12T00:00:00.000Z');
  });

  it('7. search - searches across table_name, action, and record_id with parameterized queries', async () => {
    // Numeric search term should query record_id as well
    await service.getAuditLogs({ search: '9' });

    expect(qbMock.andWhere).toHaveBeenCalledWith(
      '(audit.table_name LIKE :searchPattern OR audit.action LIKE :searchPattern OR audit.record_id = :numericRecordId)',
      { searchPattern: '%9%', numericRecordId: 9 },
    );

    // Non-numeric string search should query table_name and action
    await service.getAuditLogs({ search: 'vendor' });

    expect(qbMock.andWhere).toHaveBeenCalledWith(
      '(audit.table_name LIKE :searchPattern OR audit.action LIKE :searchPattern)',
      { searchPattern: '%vendor%' },
    );
  });

  it('8. deterministic sorting - enforces created_at DESC followed by id DESC', async () => {
    await service.getAuditLogs({});

    expect(qbMock.orderBy).toHaveBeenCalledWith('audit.created_at', 'DESC');
    expect(qbMock.addOrderBy).toHaveBeenCalledWith('audit.id', 'DESC');
  });

  it('9. actor lookup - safely joins user profile exposing ONLY id, full_name, email', async () => {
    const result = await service.getAuditLogs({});

    expect(userRepoMock.find).toHaveBeenCalledWith({
      where: { id: expect.anything() },
      select: ['id', 'fullName', 'email'],
    });

    const item37 = result.data.find((d) => d.id === 11);
    expect(item37?.actor).toEqual({
      id: 37,
      full_name: 'Super Administrator',
      email: 'superadmin@epms.com',
    });

    // Never expose password or tokens on actor
    expect((item37?.actor as any)?.password).toBeUndefined();
    expect((item37?.actor as any)?.password_hash).toBeUndefined();
    expect((item37?.actor as any)?.refreshToken).toBeUndefined();
  });

  it('10. system actor - maps created_by: 0 or null to System identity', async () => {
    const result = await service.getAuditLogs({});

    const systemItem = result.data.find((d) => d.id === 9);
    expect(systemItem?.actor).toEqual({
      id: 0,
      full_name: 'System',
      email: 'system@epms.internal',
    });
  });

  it('11. sensitive snapshot sanitization - redacts sensitive keys in old_value and new_value in-memory', async () => {
    const result = await service.getAuditLogs({});

    const item10 = result.data.find((d) => d.id === 10);
    // password in new_value should be redacted in API response
    expect(item10?.new_value.password).toBe('[REDACTED]');
    expect(item10?.new_value.code).toBe('VND-006');
    expect(item10?.new_value.name).toBe('CV KMP');

    // Test standalone sanitizeSnapshot helper with deep nested structures
    const rawSnapshot = {
      user: {
        id: 1,
        password_hash: '$2b$10$abcdef123456',
        refreshToken: 'jwt-refresh-token-xyz',
        profile: {
          secretKey: 'top-secret',
          realName: 'Jane Doe',
        },
      },
      tokens: ['token1', 'token2'],
    };

    const sanitized = sanitizeSnapshot(rawSnapshot);
    expect(sanitized.user.password_hash).toBe('[REDACTED]');
    expect(sanitized.user.refreshToken).toBe('[REDACTED]');
    expect(sanitized.user.profile.secretKey).toBe('[REDACTED]');
    expect(sanitized.user.profile.realName).toBe('Jane Doe');
  });

  it('12. AuditLog immutability - repository write methods (save, update, delete) are NEVER called', async () => {
    await service.getAuditLogs({ page: 1, limit: 10 });

    expect(auditRepoMock.save).not.toHaveBeenCalled();
    expect(auditRepoMock.update).not.toHaveBeenCalled();
    expect(auditRepoMock.delete).not.toHaveBeenCalled();
    expect(auditRepoMock.remove).not.toHaveBeenCalled();
  });
});
