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
});
