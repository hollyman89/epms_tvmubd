import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as request from 'supertest';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('SEC-OBS-01: Observability Endpoints Authentication Guard Gate', () => {
  let app: NestExpressApplication;
  let observabilityServiceMock: any;
  let currentAuthUser: any = null;

  beforeAll(async () => {
    observabilityServiceMock = {
      getDeepHealthCheck: jest.fn().mockResolvedValue({
        status: 'UP',
        probes: [{ component: 'Database (MySQL)', status: 'UP' }],
      }),
      getOperationalDashboard: jest.fn().mockResolvedValue({
        statusCode: 200,
        message: 'Operational Dashboard',
        data: {
          sliSloReport: [],
          errorBudget: {},
          outboxTelemetry: {},
          runbookIndex: [],
        },
      }),
      requeueOutboxEvent: jest.fn().mockResolvedValue({
        success: true,
        message: 'Outbox event #77 successfully requeued to PENDING.',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ObservabilityController],
      providers: [
        { provide: ObservabilityService, useValue: observabilityServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (!currentAuthUser) {
            throw new UnauthorizedException('Unauthorized');
          }
          const req = context.switchToHttp().getRequest();
          req.user = currentAuthUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    currentAuthUser = null;
    jest.clearAllMocks();
  });

  describe('1. Health Probe (Public Container / Infrastructure Gate)', () => {
    it('GET /api/v1/health without JWT MUST succeed (200 OK)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });
  });

  describe('2. Observability Dashboard (Authenticated Security Gate)', () => {
    it('GET /api/v1/observability/dashboard without JWT MUST return 401 Unauthorized', async () => {
      currentAuthUser = null;
      const res = await request(app.getHttpServer()).get('/api/v1/observability/dashboard');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/observability/dashboard with valid JWT MUST return 200 OK', async () => {
      currentAuthUser = { userId: 1, sub: 1, roles: ['SUPER_ADMIN'] };
      const res = await request(app.getHttpServer()).get('/api/v1/observability/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.message).toBe('Operational Dashboard');
    });
  });

  describe('3. Observability Readiness Report (Authenticated Security Gate)', () => {
    it('GET /api/v1/observability/readiness-report without JWT MUST return 401 Unauthorized', async () => {
      currentAuthUser = null;
      const res = await request(app.getHttpServer()).get('/api/v1/observability/readiness-report');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/observability/readiness-report with valid JWT MUST return 200 OK', async () => {
      currentAuthUser = { userId: 2, sub: 2, roles: ['ADMIN'] };
      const res = await request(app.getHttpServer()).get('/api/v1/observability/readiness-report');
      expect(res.status).toBe(200);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.message).toBe('EPMS Operational Readiness Report & Metrics Catalog');
    });
  });

  describe('4. Controlled Outbox Retry Gate (PARTIAL-REC-01 & SEC-AUTH-01)', () => {
    it('POST /api/v1/observability/outbox/:id/retry without JWT MUST return 401 Unauthorized', async () => {
      currentAuthUser = null;
      const res = await request(app.getHttpServer())
        .post('/api/v1/observability/outbox/77/retry')
        .send({ reason: 'Manual operator retry' });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/observability/outbox/:id/retry with SUPER_ADMIN MUST return 201 Created and invoke service', async () => {
      currentAuthUser = { userId: 1, sub: 1, roles: ['SUPER_ADMIN'] };
      const res = await request(app.getHttpServer())
        .post('/api/v1/observability/outbox/77/retry')
        .send({ reason: 'SuperAdmin approved retry' });
      expect(res.status).toBe(201);
      expect(observabilityServiceMock.requeueOutboxEvent).toHaveBeenCalledWith(
        77,
        1,
        'SuperAdmin approved retry',
      );
    });

    it('POST /api/v1/observability/outbox/:id/retry with ADMIN MUST return 201 Created and invoke service', async () => {
      currentAuthUser = { userId: 61, sub: 61, roles: ['ADMIN'] };
      const res = await request(app.getHttpServer())
        .post('/api/v1/observability/outbox/88/retry')
        .send({ reason: 'Admin approved retry' });
      expect(res.status).toBe(201);
      expect(observabilityServiceMock.requeueOutboxEvent).toHaveBeenCalledWith(
        88,
        61,
        'Admin approved retry',
      );
    });

    it('POST /api/v1/observability/outbox/:id/retry with fictitious SYSTEM_ADMIN MUST return 403 Forbidden', async () => {
      currentAuthUser = { userId: 999, sub: 999, roles: ['SYSTEM_ADMIN'] };
      const res = await request(app.getHttpServer())
        .post('/api/v1/observability/outbox/77/retry')
        .send({ reason: 'Fictitious role retry' });
      expect(res.status).toBe(403);
    });

    const OPERATIONAL_ROLES = [
      'PROJECT_MANAGER',
      'FINANCE',
      'DIRECTOR',
      'HEAD_OF_OPERATIONS',
      'PROCUREMENT',
      'PURCHASING',
      'MARKETING',
      'LEGAL',
      'PMO',
      'MANAGER',
      'GENERAL_MANAGER',
    ];

    test.each(OPERATIONAL_ROLES)(
      'POST /api/v1/observability/outbox/:id/retry with operational role %s MUST return 403 Forbidden',
      async (role) => {
        currentAuthUser = { userId: 200, sub: 200, roles: [role] };
        const res = await request(app.getHttpServer())
          .post('/api/v1/observability/outbox/77/retry')
          .send({ reason: `Attempted retry by ${role}` });
        expect(res.status).toBe(403);
      },
    );
  });
});
