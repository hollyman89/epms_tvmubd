import { ExecutionContext, ForbiddenException, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProcurementController } from '../../procurement/procurement.controller';
import { ProcurementService } from '../../procurement/procurement.service';
import { ProcurementPackageService } from '../../procurement/procurement-package.service';
import { ServiceClaimService } from '../../procurement/service-claim.service';
import { FinanceController } from '../../finance/finance.controller';
import { FinanceService } from '../../finance/finance.service';
import { ContractController } from '../../contract/contract.controller';
import { ProjectController } from '../../project/project.controller';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { WorkflowTask } from '../../../entities/workflow-task.entity';
import { Role } from '../../../entities/role.entity';

describe('P0-RBAC-R1: Business Authorization Hardening & Segregation of Duties Regression', () => {
  let reflector: Reflector;
  let rolesGuard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  const createMockContext = (handler: Function, controllerClass: any, roles: string[]): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => controllerClass,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 1, roles },
        }),
      }),
    } as any);

  describe('1. Procurement Mutation Authorization', () => {
    it('Create RFQ: allows PROCUREMENT/PURCHASING, rejects ADMIN and SUPER_ADMIN', () => {
      const handler = ProcurementController.prototype.createRfq;
      const roles = reflector.get<string[]>('roles', handler);

      expect(roles).toEqual(['PROCUREMENT', 'PURCHASING']);
      expect(roles).not.toContain('SUPER_ADMIN');
      expect(roles).not.toContain('ADMIN');

      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['PROCUREMENT']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['PURCHASING']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['ADMIN']))).toBe(false);
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['SUPER_ADMIN']))).toBe(false);

      // Multi-role user with SUPER_ADMIN + PROCUREMENT must be allowed through operational role
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['SUPER_ADMIN', 'PROCUREMENT']))).toBe(true);
    });

    it('Create PO: allows PROCUREMENT/PURCHASING, rejects ADMIN and SUPER_ADMIN', () => {
      const handler = ProcurementController.prototype.createPurchaseOrder;
      const roles = reflector.get<string[]>('roles', handler);

      expect(roles).toEqual(['PROCUREMENT', 'PURCHASING']);
      expect(roles).not.toContain('SUPER_ADMIN');
      expect(roles).not.toContain('ADMIN');

      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['PROCUREMENT']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['PURCHASING']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['ADMIN']))).toBe(false);
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['SUPER_ADMIN']))).toBe(false);

      // Multi-role user
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['SUPER_ADMIN', 'PURCHASING']))).toBe(true);
    });

    it('Create PR: allows PROJECT_MANAGER/PMO/PROCUREMENT/PURCHASING/HEAD_OF_OPERATIONS, rejects ADMIN and SUPER_ADMIN', () => {
      const handler = ProcurementController.prototype.createAndSubmitPurchaseRequest;
      const roles = reflector.get<string[]>('roles', handler);

      expect(roles).not.toContain('SUPER_ADMIN');
      expect(roles).not.toContain('ADMIN');

      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['PROJECT_MANAGER']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['PMO']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['ADMIN']))).toBe(false);
      expect(rolesGuard.canActivate(createMockContext(handler, ProcurementController, ['SUPER_ADMIN']))).toBe(false);
    });
  });

  describe('2. Finance Mutation Authorization', () => {
    it('Create Vendor Invoice: allows FINANCE, rejects ADMIN and SUPER_ADMIN', () => {
      const handler = FinanceController.prototype.createInvoice;
      const roles = reflector.get<string[]>('roles', handler);

      expect(roles).toEqual(['FINANCE']);
      expect(roles).not.toContain('SUPER_ADMIN');
      expect(roles).not.toContain('ADMIN');

      expect(rolesGuard.canActivate(createMockContext(handler, FinanceController, ['FINANCE']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, FinanceController, ['ADMIN']))).toBe(false);
      expect(rolesGuard.canActivate(createMockContext(handler, FinanceController, ['SUPER_ADMIN']))).toBe(false);

      // Multi-role user with SUPER_ADMIN + FINANCE must be allowed through operational role
      expect(rolesGuard.canActivate(createMockContext(handler, FinanceController, ['SUPER_ADMIN', 'FINANCE']))).toBe(true);
    });

    it('Verify Vendor Invoice: allows FINANCE/DIRECTOR, rejects ADMIN and SUPER_ADMIN', () => {
      const handler = FinanceController.prototype.verifyInvoice;
      const roles = reflector.get<string[]>('roles', handler);

      expect(roles).toEqual(['FINANCE', 'DIRECTOR']);
      expect(roles).not.toContain('SUPER_ADMIN');
      expect(roles).not.toContain('ADMIN');

      expect(rolesGuard.canActivate(createMockContext(handler, FinanceController, ['FINANCE']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, FinanceController, ['DIRECTOR']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, FinanceController, ['ADMIN']))).toBe(false);
      expect(rolesGuard.canActivate(createMockContext(handler, FinanceController, ['SUPER_ADMIN']))).toBe(false);
    });
  });

  describe('3. Contract & Governance Mutation Authorization', () => {
    it('Contract Approve: allows LEGAL/DIRECTOR, rejects SUPER_ADMIN wildcard', () => {
      const handler = ContractController.prototype.approve;
      const roles = reflector.get<string[]>('roles', handler);

      expect(roles).toEqual(['LEGAL', 'DIRECTOR']);
      expect(roles).not.toContain('SUPER_ADMIN');

      expect(rolesGuard.canActivate(createMockContext(handler, ContractController, ['LEGAL']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, ContractController, ['DIRECTOR']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, ContractController, ['SUPER_ADMIN']))).toBe(false);

      // Multi-role
      expect(rolesGuard.canActivate(createMockContext(handler, ContractController, ['SUPER_ADMIN', 'LEGAL']))).toBe(true);
    });

    it('Project Management Review Decision: allows DIRECTOR/HEAD_OF_OPERATIONS, rejects SUPER_ADMIN wildcard', () => {
      const handler = ProjectController.prototype.decideManagementReview;
      const roles = reflector.get<string[]>('roles', handler);

      expect(roles).toEqual(['HEAD_OF_OPERATIONS', 'GENERAL_MANAGER', 'DIRECTOR']);
      expect(roles).not.toContain('SUPER_ADMIN');

      expect(rolesGuard.canActivate(createMockContext(handler, ProjectController, ['DIRECTOR']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, ProjectController, ['HEAD_OF_OPERATIONS']))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(handler, ProjectController, ['SUPER_ADMIN']))).toBe(false);
    });
  });

  describe('4. Workflow Engine Actor Authorization Hardening (CP4)', () => {
    let workflowEngineService: WorkflowEngineService;
    let mockTaskRepo: any;
    let mockInstanceRepo: any;
    let mockDefRepo: any;
    let mockVersionRepo: any;
    let mockTransitionRepo: any;
    let mockRoleRepo: any;
    let mockOutboxRepo: any;
    let mockDataSource: any;
    let mockEventEmitter: any;

    beforeEach(() => {
      mockTaskRepo = {
        createQueryBuilder: jest.fn(),
      };
      mockInstanceRepo = {};
      mockDefRepo = {};
      mockVersionRepo = {};
      mockTransitionRepo = {};
      mockRoleRepo = {};
      mockOutboxRepo = {};
      mockDataSource = {};
      mockEventEmitter = {};

      workflowEngineService = new WorkflowEngineService(
        mockDefRepo,
        mockVersionRepo,
        mockInstanceRepo,
        mockTaskRepo,
        mockTransitionRepo,
        mockRoleRepo,
        mockOutboxRepo,
        mockDataSource,
        mockEventEmitter,
      );
    });

    it('Workflow transition requiring FINANCE: SUPER_ADMIN alone is rejected; SUPER_ADMIN+FINANCE is allowed', () => {
      const task = new WorkflowTask();
      task.id = 101;
      task.assigneeRoleId = 3;
      task.assigneeRole = { id: 3, name: 'FINANCE' } as Role;

      // Access private validateActorAuthorization via any
      const service = workflowEngineService as any;

      // 1. SUPER_ADMIN alone -> must throw ForbiddenException
      expect(() => {
        service.validateActorAuthorization(task, 1, ['SUPER_ADMIN']);
      }).toThrow(ForbiddenException);

      // 2. FINANCE alone -> allowed
      expect(() => {
        service.validateActorAuthorization(task, 3, ['FINANCE']);
      }).not.toThrow();

      // 3. Multi-role SUPER_ADMIN + FINANCE -> allowed because user holds FINANCE
      expect(() => {
        service.validateActorAuthorization(task, 1, ['SUPER_ADMIN', 'FINANCE']);
      }).not.toThrow();
    });

    it('Workflow transition requiring DIRECTOR: SUPER_ADMIN alone is rejected; SUPER_ADMIN+DIRECTOR is allowed', () => {
      const task = new WorkflowTask();
      task.id = 102;
      task.assigneeRoleId = 4;
      task.assigneeRole = { id: 4, name: 'DIRECTOR' } as Role;

      const service = workflowEngineService as any;

      // 1. SUPER_ADMIN alone -> must throw ForbiddenException
      expect(() => {
        service.validateActorAuthorization(task, 1, ['SUPER_ADMIN']);
      }).toThrow(ForbiddenException);

      // 2. DIRECTOR alone -> allowed
      expect(() => {
        service.validateActorAuthorization(task, 4, ['DIRECTOR']);
      }).not.toThrow();

      // 3. Multi-role SUPER_ADMIN + DIRECTOR -> allowed
      expect(() => {
        service.validateActorAuthorization(task, 1, ['SUPER_ADMIN', 'DIRECTOR']);
      }).not.toThrow();
    });

    it('Workflow getMyTasks: applies role and userId filter unconditionally without SUPER_ADMIN wildcard leak', async () => {
      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Call getMyTasks for SUPER_ADMIN alone
      await workflowEngineService.getMyTasks(1, ['SUPER_ADMIN']);

      // Must have invoked andWhere with role/userId condition
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(task.assignee_user_id = :userId OR role.name IN (:...roles) OR (task.assignee_role_id IS NULL AND task.assignee_user_id IS NULL))',
        { userId: 1, roles: ['SUPER_ADMIN'] },
      );
    });
  });

  describe('5. HTTP Negative API Proof (SUPER_ADMIN only -> 403 Forbidden)', () => {
    let app: INestApplication;
    let authUser: any = null;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [ProcurementController, FinanceController],
        providers: [
          {
            provide: ProcurementService,
            useValue: {
              createRfq: jest.fn().mockResolvedValue({ id: 99 }),
              createPurchaseOrder: jest.fn().mockResolvedValue({ id: 100 }),
            },
          },
          {
            provide: ProcurementPackageService,
            useValue: {},
          },
          {
            provide: ServiceClaimService,
            useValue: {},
          },
          {
            provide: FinanceService,
            useValue: {
              createInvoice: jest.fn().mockResolvedValue({ id: 101 }),
              verifyInvoice: jest.fn().mockResolvedValue({ id: 101, status: 'VERIFIED' }),
            },
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (context: ExecutionContext) => {
            const req = context.switchToHttp().getRequest();
            req.user = authUser;
            return true;
          },
        })
        .compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('api/v1');
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('SUPER_ADMIN only -> POST /api/v1/finance/invoices returns 403 Forbidden', async () => {
      authUser = { id: 1, userId: 1, roles: ['SUPER_ADMIN'] };
      const res = await request(app.getHttpServer())
        .post('/api/v1/finance/invoices')
        .send({});

      expect(res.status).toBe(403);
    });

    it('SUPER_ADMIN only -> POST /api/v1/procurement/rfqs returns 403 Forbidden', async () => {
      authUser = { id: 1, userId: 1, roles: ['SUPER_ADMIN'] };
      const res = await request(app.getHttpServer())
        .post('/api/v1/procurement/rfqs')
        .send({});

      expect(res.status).toBe(403);
    });

    it('SUPER_ADMIN only -> POST /api/v1/procurement/purchase-orders returns 403 Forbidden', async () => {
      authUser = { id: 1, userId: 1, roles: ['SUPER_ADMIN'] };
      const res = await request(app.getHttpServer())
        .post('/api/v1/procurement/purchase-orders')
        .send({});

      expect(res.status).toBe(403);
    });

    it('FINANCE role -> POST /api/v1/finance/invoices returns 201 Created', async () => {
      authUser = { id: 3, userId: 3, roles: ['FINANCE'] };
      const res = await request(app.getHttpServer())
        .post('/api/v1/finance/invoices')
        .send({});

      expect(res.status).toBe(201);
    });

    it('PROCUREMENT role -> POST /api/v1/procurement/rfqs returns 201 Created', async () => {
      authUser = { id: 5, userId: 5, roles: ['PROCUREMENT'] };
      const res = await request(app.getHttpServer())
        .post('/api/v1/procurement/rfqs')
        .send({});

      expect(res.status).toBe(201);
    });

    it('PROCUREMENT role -> POST /api/v1/procurement/purchase-orders returns 201 Created', async () => {
      authUser = { id: 5, userId: 5, roles: ['PROCUREMENT'] };
      const res = await request(app.getHttpServer())
        .post('/api/v1/procurement/purchase-orders')
        .send({});

      expect(res.status).toBe(201);
    });
  });
});
