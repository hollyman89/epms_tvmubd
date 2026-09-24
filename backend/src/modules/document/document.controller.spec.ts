import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

describe('DocumentController - Identity & Anti-Mock Tests (P0-2)', () => {
  let controller: DocumentController;
  let documentService: DocumentService;

  const mockDocumentService = {
    uploadFile: jest.fn().mockResolvedValue({ id: 101, fileName: 'test.pdf' }),
    generatePresignedUrl: jest.fn().mockResolvedValue({ uploadUrl: 'http://s3.local', key: 'spk/1.pdf' }),
    saveMetadata: jest.fn().mockResolvedValue({ id: 201, fileName: 'test.pdf' }),
    getAllFiles: jest.fn().mockResolvedValue([]),
    getFilesByEntity: jest.fn().mockResolvedValue([]),
    streamDocument: jest.fn().mockResolvedValue({
      stream: new (require('stream').Readable)({ read() { this.push(null); } }),
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        {
          provide: DocumentService,
          useValue: mockDocumentService,
        },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
    documentService = module.get<DocumentService>(DocumentService);
  });

  describe('1. uploadFile Identity Enforcement', () => {
    it('should propagate authenticated userId from JWT to documentService without hardcoding', async () => {
      const mockFile = { originalname: 'doc.pdf', buffer: Buffer.from('abc') } as Express.Multer.File;
      const mockReq = { user: { userId: 42, email: 'pm@tvmubd.com' } };

      const res = await controller.uploadFile(mockFile, 'SPK', 1, mockReq);
      expect(res.data).toBeDefined();
      expect(documentService.uploadFile).toHaveBeenCalledWith('SPK', 1, mockFile, 42, []);
      expect(documentService.uploadFile).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 1, expect.anything());
    });

    it('should throw UnauthorizedException when JWT identity is missing', async () => {
      const mockFile = { originalname: 'doc.pdf', buffer: Buffer.from('abc') } as Express.Multer.File;
      const mockReq = { user: null };

      await expect(controller.uploadFile(mockFile, 'SPK', 1, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(documentService.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('2. getPresignedUrl Identity Enforcement', () => {
    it('should extract authenticated userId from req.user.id and pass to service', async () => {
      const mockReq = { user: { id: 77, email: 'legal@epms.com' } };
      const body = { fileName: 'spk.pdf', mimeType: 'application/pdf', entityType: 'SPK', entityId: 10 };

      const res = await controller.getPresignedUrl(body, mockReq);
      expect(res.data).toBeDefined();
      expect(documentService.generatePresignedUrl).toHaveBeenCalledWith(
        'spk',
        'spk.pdf',
        'application/pdf',
        'SPK',
        10,
        77,
        [],
      );
      expect(documentService.generatePresignedUrl).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        1,
      );
    });

    it('should throw UnauthorizedException when req.user has no identity', async () => {
      const mockReq = { user: {} };
      const body = { fileName: 'spk.pdf', mimeType: 'application/pdf', entityType: 'SPK', entityId: 10 };

      await expect(controller.getPresignedUrl(body, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(documentService.generatePresignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('3. saveMetadata Identity Enforcement', () => {
    it('should pass authenticated userId from req.user.sub to saveMetadata', async () => {
      const mockReq = { user: { sub: 88, email: 'finance@epms.com' } };
      const body = {
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        entityType: 'INVOICE',
        entityId: 5,
        key: 'invoices/1.pdf',
      };

      const res = await controller.saveMetadata(body, mockReq);
      expect(res.data).toBeDefined();
      expect(documentService.saveMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 88,
        }),
      );
      expect(documentService.saveMetadata).not.toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
        }),
      );
    });

    it('should throw UnauthorizedException when saving metadata without authenticated user', async () => {
      const mockReq = {};
      const body = {
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        entityType: 'INVOICE',
        entityId: 5,
        key: 'invoices/1.pdf',
      };

      await expect(controller.saveMetadata(body, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(documentService.saveMetadata).not.toHaveBeenCalled();
    });
  });

  describe('4. downloadDocument & streamDocument Identity Enforcement', () => {
    it('should propagate authenticated userId to streamDocument on downloadDocument', async () => {
      const mockReq = { user: { userId: 55, roles: ['PROJECT_MANAGER'] } };
      const mockRes = { set: jest.fn() } as any;

      const res = await controller.downloadDocument(10, mockReq, mockRes);
      expect(res).toBeDefined();
      expect(documentService.streamDocument).toHaveBeenCalledWith(10, 55, ['PROJECT_MANAGER']);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': expect.stringContaining('attachment; filename='),
        }),
      );
    });

    it('should propagate authenticated userId to streamDocument on streamDocument (inline)', async () => {
      const mockReq = { user: { id: 77, role: 'LEGAL' } };
      const mockRes = { set: jest.fn() } as any;

      const res = await controller.streamDocument(20, mockReq, mockRes);
      expect(res).toBeDefined();
      expect(documentService.streamDocument).toHaveBeenCalledWith(20, 77, ['LEGAL']);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': expect.stringContaining('inline; filename='),
        }),
      );
    });

    it('should throw UnauthorizedException when downloading without authenticated user', async () => {
      const mockReq = { user: null };
      const mockRes = { set: jest.fn() } as any;

      await expect(controller.downloadDocument(10, mockReq, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when streaming without authenticated user', async () => {
      const mockReq = {};
      const mockRes = { set: jest.fn() } as any;

      await expect(controller.streamDocument(10, mockReq, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
