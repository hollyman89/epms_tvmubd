import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExecutionContext, UnauthorizedException, ForbiddenException, StreamableFile } from '@nestjs/common';
import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DocumentController } from '../document/document.controller';
import { DocumentService } from '../document/document.service';
import { ContractController } from '../contract/contract.controller';
import { ContractService } from '../contract/contract.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Document } from '../../entities/document.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { ContractAmendment } from '../../entities/contract-amendment.entity';
import { Tender } from '../../entities/tender.entity';
import { User } from '../../entities/user.entity';

describe('SEC-09: Public Static File Exposure Disabled (P0-3C3 Verification)', () => {
  let app: NestExpressApplication;
  let documentServiceMock: any;
  let contractServiceMock: any;
  let currentAuthUser: any = null;

  const mockPdfContent = '%PDF-1.4 Mock Valid PDF Stream for SEC-09 Boundary Verification';

  beforeAll(async () => {
    documentServiceMock = {
      streamDocument: jest.fn().mockImplementation((id: number, userId: number, roles: string[]) => {
        if (roles.includes('STAFF_UNAUTHORIZED')) {
          throw new ForbiddenException('Akses ditolak: Anda tidak memiliki izin mengakses dokumen ini');
        }
        const stream = Readable.from(Buffer.from(mockPdfContent));
        return Promise.resolve({
          stream,
          fileName: `secure-doc-${id}.pdf`,
          mimeType: 'application/pdf',
          fileSize: Buffer.byteLength(mockPdfContent),
        });
      }),
    };

    contractServiceMock = {
      streamContractSpk: jest.fn().mockImplementation((id: number, userId: number, roles: string[]) => {
        if (roles.includes('STAFF_UNAUTHORIZED')) {
          throw new ForbiddenException('Akses ditolak: Anda tidak memiliki hak akses ke dokumen SPK kontrak ini');
        }
        const stream = Readable.from(Buffer.from(mockPdfContent));
        return Promise.resolve({
          stream,
          fileName: `SPK-CTR-${id}.pdf`,
          mimeType: 'application/pdf',
          fileSize: Buffer.byteLength(mockPdfContent),
        });
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController, ContractController],
      providers: [
        { provide: DocumentService, useValue: documentServiceMock },
        { provide: ContractService, useValue: contractServiceMock },
        { provide: getRepositoryToken(Document), useValue: {} },
        { provide: getRepositoryToken(Contract), useValue: {} },
        { provide: getRepositoryToken(ContractAmendment), useValue: {} },
        { provide: getRepositoryToken(Tender), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: 'BullQueue_pdf-generation', useValue: { add: jest.fn(), getJob: jest.fn() } },
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
    // Configure global prefix exactly as in backend/src/main.ts
    app.setGlobalPrefix('api/v1');
    // Notice: app.useStaticAssets is NOT called (disabled in P0-3C3)
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    currentAuthUser = null;
    jest.clearAllMocks();
  });

  // 1. STATIC ROUTE MUST FAIL (404 NOT FOUND)
  describe('1. Static Route Exposure Verification (Must Fail)', () => {
    it('GET /uploads/contracts/... without JWT MUST return 404 (not 200, no file content)', async () => {
      const res = await request(app.getHttpServer())
        .get('/uploads/contracts/spk-18-1787119958064-373783759.pdf');

      expect(res.status).toBe(404);
      expect(res.text).not.toContain('%PDF');
    });

    it('GET /api/v1/uploads/contracts/... without JWT MUST return 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/uploads/contracts/spk-18-1787119958064-373783759.pdf');

      expect(res.status).toBe(404);
      expect(res.text).not.toContain('%PDF');
    });

    it('GET /uploads/proposals/... without JWT MUST return 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/uploads/proposals/proposal-1786534211118-458387533.pdf');

      expect(res.status).toBe(404);
      expect(res.text).not.toContain('%PDF');
    });

    it('GET /api/v1/uploads/proposals/... without JWT MUST return 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/uploads/proposals/proposal-1786534211118-458387533.pdf');

      expect(res.status).toBe(404);
      expect(res.text).not.toContain('%PDF');
    });
  });

  // 2. SECURE DOCUMENT ENDPOINTS
  describe('2. Secure Document Endpoints (/api/v1/documents/:id/*)', () => {
    it('GET /api/v1/documents/:id/stream without JWT MUST return 401 Unauthorized', async () => {
      currentAuthUser = null;
      const res = await request(app.getHttpServer()).get('/api/v1/documents/10/stream');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/documents/:id/download without JWT MUST return 401 Unauthorized', async () => {
      currentAuthUser = null;
      const res = await request(app.getHttpServer()).get('/api/v1/documents/10/download');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/documents/:id/stream with unauthorized user MUST return 403 Forbidden', async () => {
      currentAuthUser = { userId: 301, sub: 301, roles: ['STAFF_UNAUTHORIZED'] };
      const res = await request(app.getHttpServer()).get('/api/v1/documents/10/stream');
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/documents/:id/stream with authorized user MUST return 200 and stream bytes', async () => {
      currentAuthUser = { userId: 101, sub: 101, roles: ['PROJECT_MANAGER'] };
      const res = await request(app.getHttpServer()).get('/api/v1/documents/10/stream');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('inline');
      const textContent = res.body ? res.body.toString() : res.text;
      expect(textContent).toBe(mockPdfContent);
    });

    it('GET /api/v1/documents/:id/download with authorized user MUST return 200 and attachment bytes', async () => {
      currentAuthUser = { userId: 101, sub: 101, roles: ['PROJECT_MANAGER'] };
      const res = await request(app.getHttpServer()).get('/api/v1/documents/10/download');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      const textContent = res.body ? res.body.toString() : res.text;
      expect(textContent).toBe(mockPdfContent);
    });
  });

  // 3. CONTRACT SPK SECURE ENDPOINTS
  describe('3. Secure Contract SPK Endpoints (/api/v1/contracts/:id/spk/*)', () => {
    it('GET /api/v1/contracts/:id/spk/stream without JWT MUST return 401 Unauthorized', async () => {
      currentAuthUser = null;
      const res = await request(app.getHttpServer()).get('/api/v1/contracts/20/spk/stream');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/contracts/:id/spk/download without JWT MUST return 401 Unauthorized', async () => {
      currentAuthUser = null;
      const res = await request(app.getHttpServer()).get('/api/v1/contracts/20/spk/download');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/contracts/:id/spk/stream with unauthorized user MUST return 403 Forbidden', async () => {
      currentAuthUser = { userId: 301, sub: 301, roles: ['STAFF_UNAUTHORIZED'] };
      const res = await request(app.getHttpServer()).get('/api/v1/contracts/20/spk/stream');
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/contracts/:id/spk/stream with authorized user MUST return 200 and stream bytes', async () => {
      currentAuthUser = { userId: 777, sub: 777, roles: ['LEGAL'] };
      const res = await request(app.getHttpServer()).get('/api/v1/contracts/20/spk/stream');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('inline');
      const textContent = res.body ? res.body.toString() : res.text;
      expect(textContent).toBe(mockPdfContent);
    });

    it('GET /api/v1/contracts/:id/spk/download with authorized user MUST return 200 and download bytes', async () => {
      currentAuthUser = { userId: 777, sub: 777, roles: ['LEGAL'] };
      const res = await request(app.getHttpServer()).get('/api/v1/contracts/20/spk/download');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      const textContent = res.body ? res.body.toString() : res.text;
      expect(textContent).toBe(mockPdfContent);
    });
  });
});
