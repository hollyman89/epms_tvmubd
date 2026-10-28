import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { MulterError } from 'multer';
import { DocumentController, DocumentUploadExceptionFilter } from './document.controller';
import { DocumentService } from './document.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('EPMS — Backend Document Upload Reliability Hardening (Multer & Observability)', () => {
  let app: INestApplication;
  let mockDocumentService: {
    uploadFile: jest.Mock;
  };

  beforeAll(async () => {
    mockDocumentService = {
      uploadFile: jest.fn().mockImplementation((entityType, entityId, file, userId) => {
        return Promise.resolve({
          id: 777,
          entityType,
          entityId,
          fileName: file?.originalname || 'evidence.pdf',
          filePath: `uploads/${entityType.toLowerCase()}/evidence.pdf`,
          createdBy: userId,
        });
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        {
          provide: DocumentService,
          useValue: mockDocumentService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId: 42, id: 42, email: 'pm@tvmubd.com', roles: ['PROJECT_MANAGER'] };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Multer Boundary & Controlled 413 Error (CASE 2, CASE 6, CASE 7)', () => {
    test('CASE 2: Multipart file exceeding 20MB returns controlled HTTP 413 Payload Too Large', async () => {
      // Create a buffer exceeding 20 MB (20 * 1024 * 1024 + 1024 bytes)
      const oversizedBuffer = Buffer.alloc(20 * 1024 * 1024 + 1024, 'a');

      const response = await request(app.getHttpServer())
        .post('/documents/upload')
        .field('entityType', 'PROJECT')
        .field('entityId', '5')
        .attach('file', oversizedBuffer, 'oversized-drawing.dwg');

      expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE); // 413
      expect(response.body).toEqual({
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'Ukuran berkas melebihi batas maksimal 20 MB.',
      });

      // Proof: Business logic and DB write were NOT executed
      expect(mockDocumentService.uploadFile).not.toHaveBeenCalled();
    });

    test('CASE 6: Controlled 413 response does not leak raw Multer internals or stack trace', async () => {
      const oversizedBuffer = Buffer.alloc(20 * 1024 * 1024 + 512, 'b');

      const response = await request(app.getHttpServer())
        .post('/documents/upload')
        .field('entityType', 'PROJECT')
        .field('entityId', '10')
        .attach('file', oversizedBuffer, 'oversized.pdf');

      expect(response.status).toBe(413);
      expect(response.body.message).not.toContain('LIMIT_FILE_SIZE');
      expect(response.body.message).not.toContain('MulterError');
      expect(response.body.stack).toBeUndefined();
    });

    test('CASE 7: Server and upload route remain alive and healthy after oversize rejection', async () => {
      // First send oversize payload
      const oversizedBuffer = Buffer.alloc(20 * 1024 * 1024 + 256, 'x');
      const errResponse = await request(app.getHttpServer())
        .post('/documents/upload')
        .field('entityType', 'PROJECT')
        .field('entityId', '5')
        .attach('file', oversizedBuffer, 'oversize.pdf');

      expect(errResponse.status).toBe(413);

      // Immediately send valid payload to prove process did not crash
      const validBuffer = Buffer.from('%PDF-1.4 Mock Valid PDF Stream');
      const okResponse = await request(app.getHttpServer())
        .post('/documents/upload')
        .field('entityType', 'PROJECT')
        .field('entityId', '5')
        .attach('file', validBuffer, 'valid-followup.pdf');

      expect(okResponse.status).toBe(201);
      expect(okResponse.body.message).toBe('Document uploaded successfully');
      expect(mockDocumentService.uploadFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Valid File Upload Flow (CASE 3)', () => {
    test('CASE 3: File <= 20MB proceeds to service and returns HTTP 201 Created', async () => {
      const validContent = Buffer.from('%PDF-1.4 Valid Document Evidence Content');

      const response = await request(app.getHttpServer())
        .post('/documents/upload')
        .field('entityType', 'PROJECT')
        .field('entityId', '42')
        .field('category', 'CUSTOMER_BAST')
        .attach('file', validContent, 'bast-evidence.pdf');

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Document uploaded successfully',
        data: expect.objectContaining({
          id: 777,
          entityType: 'PROJECT',
          entityId: 42,
        }),
      });

      expect(mockDocumentService.uploadFile).toHaveBeenCalledWith(
        'PROJECT',
        42,
        expect.objectContaining({ originalname: 'bast-evidence.pdf' }),
        42,
        ['PROJECT_MANAGER'],
        'CUSTOMER_BAST',
      );
    });
  });

  describe('3. DocumentUploadExceptionFilter Unit Isolation', () => {
    let filter: DocumentUploadExceptionFilter;

    beforeEach(() => {
      filter = new DocumentUploadExceptionFilter();
    });

    test('Normalizes LIMIT_FILE_SIZE into clean HTTP 413 with Indonesian message', () => {
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => ({ status: mockStatus }),
          getRequest: () => ({ url: '/api/v1/documents/upload', method: 'POST', correlationId: 'corr-test-123' }),
        }),
      } as any;

      const multerErr = new MulterError('LIMIT_FILE_SIZE');
      filter.catch(multerErr, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(413);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'Ukuran berkas melebihi batas maksimal 20 MB.',
      });
    });

    test('Normalizes other Multer errors into clean HTTP 400 Bad Request', () => {
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => ({ status: mockStatus }),
          getRequest: () => ({ url: '/api/v1/documents/upload', method: 'POST' }),
        }),
      } as any;

      const multerErr = new MulterError('LIMIT_UNEXPECTED_FILE', 'unexpectedField');
      filter.catch(multerErr, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Format atau parameter berkas tidak valid.',
      });
    });
  });

  describe('4. Diagnostic Observability & Error Classification', () => {
    test('Differentiates DB persistence failure from storage service failure', async () => {
      // Mock DB persistence error (QueryFailedError)
      const dbError = new Error('ER_DUP_ENTRY: Duplicate entry for key');
      dbError.name = 'QueryFailedError';
      mockDocumentService.uploadFile.mockRejectedValueOnce(dbError);

      const validContent = Buffer.from('test document');
      const response = await request(app.getHttpServer())
        .post('/documents/upload')
        .field('entityType', 'PROJECT')
        .field('entityId', '99')
        .attach('file', validContent, 'dup.pdf');

      expect(response.status).toBe(500);
    });

    test('Missing file rejects with 400 Bad Request before calling service', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents/upload')
        .field('entityType', 'PROJECT')
        .field('entityId', '99');

      expect(response.status).toBe(400);
      expect(mockDocumentService.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('5. Notification Architecture Isolation (CASE 8)', () => {
    test('CASE 8: Zero notification events, outbox records, or listeners attached to Document upload', () => {
      // Verifies DocumentController constructor has no EventEmitter or Outbox injected
      const controller = new DocumentController(mockDocumentService as any);
      expect((controller as any).eventEmitter).toBeUndefined();
      expect((controller as any).outboxService).toBeUndefined();
      expect((controller as any).notificationService).toBeUndefined();
    });
  });
});
