import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { Document } from '../../entities/document.entity';
import { Project } from '../../entities/project.entity';
import { Contract } from '../../entities/contract.entity';
import { Tender } from '../../entities/tender.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as fs from 'fs';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.local/presigned-url'),
}));

describe('SEC-06, SEC-07, SEC-08 & SEC-09: Document Access Boundary Hardening', () => {
  let controller: DocumentController;
  let service: DocumentService;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;
  let documentRepoMock: any;
  let s3ClientMock: any;

  const SUPER_ADMIN_ID = 999;
  const DIRECTOR_ID = 888;
  const LEGAL_ID = 777;
  const GM_ID = 666;
  const HOO_ID = 555;
  const ASSIGNED_PM_ID = 101;
  const OTHER_PM_ID = 102;
  const MARKETING_PIC_ID = 201;
  const OTHER_MARKETING_ID = 202;
  const STAFF_ID = 301;

  const mockProject: Partial<Project> = {
    id: 10,
    name: 'FTTH Project Alpha',
    managerId: ASSIGNED_PM_ID,
  };

  const mockContract: Partial<Contract> = {
    id: 20,
    contract_number: 'CONT-2026-0020',
    project_manager_id: ASSIGNED_PM_ID,
    created_by: MARKETING_PIC_ID,
    proposal: {
      id: 5,
      tender: {
        id: 30,
        marketing_pic_id: MARKETING_PIC_ID,
      },
    } as any,
  };

  const mockTender: Partial<Tender> = {
    id: 30,
    title: 'Pengadaan Infrastruktur FO 2026',
    marketing_pic_id: MARKETING_PIC_ID,
    created_by: MARKETING_PIC_ID,
  };

  const sampleDocumentList: Partial<Document>[] = [
    {
      id: 1,
      entityType: 'PROJECT',
      entityId: 10,
      fileName: 'Project_Charter_Signed.pdf',
      filePath: 'http://storage.local/projects/1.pdf',
      createdBy: ASSIGNED_PM_ID,
    },
  ];

  beforeEach(async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'statSync').mockReturnValue({ size: 2048, isFile: () => true } as any);
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
      const s = new Readable();
      s.push('test file content bytes');
      s.push(null);
      return s as any;
    });

    documentRepoMock = {
      find: jest.fn().mockResolvedValue(sampleDocumentList),
      findOne: jest.fn().mockImplementation((options) => {
        const id = options?.where?.id;
        if (id === 1) {
          return Promise.resolve({
            id: 1,
            entityType: 'PROJECT',
            entityId: 10,
            fileName: 'Project_Charter_Signed.pdf',
            filePath: 'uploads/contracts/project_10.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
            createdBy: ASSIGNED_PM_ID,
          });
        }
        if (id === 2) {
          return Promise.resolve({
            id: 2,
            entityType: 'CONTRACT',
            entityId: 20,
            fileName: 'Contract_20_Signed.pdf',
            filePath: 'uploads/contracts/contract_20.pdf',
            fileSize: 4096,
            mimeType: 'application/pdf',
            createdBy: MARKETING_PIC_ID,
          });
        }
        if (id === 3) {
          return Promise.resolve({
            id: 3,
            entityType: 'TENDER',
            entityId: 30,
            fileName: 'Tender_Proposal_30.pdf',
            filePath: 'uploads/proposals/tender_30.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            createdBy: MARKETING_PIC_ID,
          });
        }
        if (id === 4) {
          return Promise.resolve({
            id: 4,
            entityType: 'PROJECT',
            entityId: 10,
            fileName: 'Charter_S3.pdf',
            filePath: 'https://my-bucket.s3.ap-southeast-1.amazonaws.com/projects/Charter_S3.pdf',
            fileSize: 512,
            mimeType: 'application/pdf',
            createdBy: ASSIGNED_PM_ID,
          });
        }
        if (id === 5) {
          return Promise.resolve({
            id: 5,
            entityType: 'CONTRACT',
            entityId: 20,
            fileName: 'Contract_S3.pdf',
            filePath: 's3://my-bucket/contracts/Contract_S3.pdf',
            fileSize: 512,
            mimeType: 'application/pdf',
            createdBy: MARKETING_PIC_ID,
          });
        }
        if (id === 6) {
          return Promise.resolve({
            id: 6,
            entityType: 'PROJECT',
            entityId: 10,
            fileName: 'Missing_S3.pdf',
            filePath: 'https://my-bucket.s3.amazonaws.com/projects/Missing_S3.pdf',
            fileSize: 512,
            mimeType: 'application/pdf',
            createdBy: ASSIGNED_PM_ID,
          });
        }
        if (id === 7) {
          return Promise.resolve({
            id: 7,
            entityType: 'PROJECT',
            entityId: 10,
            fileName: 'Bad_S3.pdf',
            filePath: 'https://my-bucket.s3.amazonaws.com/../../etc/passwd',
            fileSize: 512,
            mimeType: 'application/pdf',
            createdBy: ASSIGNED_PM_ID,
          });
        }
        if (id === 8) {
          return Promise.resolve({
            id: 8,
            entityType: 'PROJECT',
            entityId: 10,
            fileName: 'Empty_S3.pdf',
            filePath: 's3:///',
            fileSize: 512,
            mimeType: 'application/pdf',
            createdBy: ASSIGNED_PM_ID,
          });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id || 1 })),
      manager: {
        findOne: jest.fn().mockImplementation((entityClass, options) => {
          const id = options?.where?.id;
          if (entityClass === Project) {
            if (id === 10) return Promise.resolve({ ...mockProject });
            return Promise.resolve(null);
          }
          if (entityClass === Contract) {
            if (id === 20) return Promise.resolve({ ...mockContract });
            return Promise.resolve(null);
          }
          if (entityClass === Tender) {
            if (id === 30) return Promise.resolve({ ...mockTender });
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        }),
      },
    };

    s3ClientMock = {
      send: jest.fn().mockImplementation((command) => {
        const key = command.input?.Key;
        if (key === 'projects/Charter_S3.pdf' || key === 'contracts/Contract_S3.pdf') {
          const s = new Readable();
          s.push('s3 document binary content');
          s.push(null);
          return Promise.resolve({
            Body: s,
            ContentType: 'application/pdf',
            ContentLength: 512,
          });
        }
        if (key === 'projects/Missing_S3.pdf') {
          const err = new Error('NoSuchKey');
          (err as any).name = 'NoSuchKey';
          return Promise.reject(err);
        }
        if (command.constructor?.name === 'GetObjectCommand') {
          const genericErr = new Error('AccessDenied');
          return Promise.reject(genericErr);
        }
        // Default success for other commands (e.g. PutObjectCommand in uploadToS3)
        return Promise.resolve({});
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        DocumentService,
        RolesGuard,
        Reflector,
        {
          provide: getRepositoryToken(Document),
          useValue: documentRepoMock,
        },
        {
          provide: S3Client,
          useValue: s3ClientMock,
        },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
    service = module.get<DocumentService>(DocumentService);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  // SEC-06: GLOBAL DOCUMENT LISTING TESTS
  describe('SEC-06: Global Document Listing Role Boundaries (GET /documents)', () => {
    const createMockExecutionContext = (user: any): ExecutionContext => {
      return {
        getHandler: () => DocumentController.prototype.getAllDocuments,
        getClass: () => DocumentController,
        switchToHttp: () => ({
          getRequest: () => ({ user }),
          getResponse: () => ({}),
          getNext: () => ({}),
        }),
      } as unknown as ExecutionContext;
    };

    it('getAllDocuments harus memiliki metadata @Roles eksplisit sesuai governance', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, DocumentController.prototype.getAllDocuments);
      expect(roles).toBeDefined();
      expect(roles).toEqual([
        'SUPER_ADMIN',
        'DIRECTOR',
        'LEGAL',
        'GENERAL_MANAGER',
        'HEAD_OF_OPERATIONS',
      ]);
    });

    it('SUPER_ADMIN dapat GET /documents', () => {
      const context = createMockExecutionContext({
        userId: SUPER_ADMIN_ID,
        roles: ['SUPER_ADMIN'],
      });
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('DIRECTOR dapat GET /documents', () => {
      const context = createMockExecutionContext({
        userId: DIRECTOR_ID,
        roles: ['DIRECTOR'],
      });
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('LEGAL dapat GET /documents', () => {
      const context = createMockExecutionContext({
        userId: LEGAL_ID,
        roles: ['LEGAL'],
      });
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('GENERAL_MANAGER dapat GET /documents', () => {
      const context = createMockExecutionContext({
        userId: GM_ID,
        roles: ['GENERAL_MANAGER'],
      });
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('HEAD_OF_OPERATIONS dapat GET /documents', () => {
      const context = createMockExecutionContext({
        userId: HOO_ID,
        roles: ['HEAD_OF_OPERATIONS'],
      });
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('STAFF tanpa privilege global ditolak', () => {
      const context = createMockExecutionContext({
        userId: STAFF_ID,
        roles: ['STAFF'],
      });
      expect(rolesGuard.canActivate(context)).toBe(false);
    });

    it('MARKETING tanpa privilege global ditolak', () => {
      const context = createMockExecutionContext({
        userId: MARKETING_PIC_ID,
        roles: ['MARKETING'],
      });
      expect(rolesGuard.canActivate(context)).toBe(false);
    });

    it('PROJECT_MANAGER tanpa privilege global ditolak', () => {
      const context = createMockExecutionContext({
        userId: ASSIGNED_PM_ID,
        roles: ['PROJECT_MANAGER'],
      });
      expect(rolesGuard.canActivate(context)).toBe(false);
    });
  });

  // SEC-07: CONTROLLER IDENTITY FORWARDING
  describe('SEC-07: Controller Identity Forwarding (GET /documents/entity/:type/:id)', () => {
    it('Mengambil actor identity dari req.user dan meneruskannya ke service', async () => {
      const spy = jest.spyOn(service, 'getFilesByEntity').mockResolvedValue([]);
      const mockReq = {
        user: { userId: ASSIGNED_PM_ID, roles: ['PROJECT_MANAGER'] },
      };

      const res = await controller.getEntityDocuments('PROJECT', 10, mockReq);
      expect(res.message).toBe('Documents retrieved successfully');
      expect(spy).toHaveBeenCalledWith('PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
    });

    it('Missing JWT identity → UnauthorizedException', async () => {
      const mockReq = { user: null };
      await expect(controller.getEntityDocuments('PROJECT', 10, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // SEC-07: SERVICE ENTITY ACCESS BOUNDARIES
  describe('SEC-07: Service Entity Document Access Boundaries', () => {
    // --- PROJECT TESTS ---
    describe('PROJECT Entity Boundaries', () => {
      it('Assigned PM dapat melihat document project sendiri', async () => {
        const res = await service.getFilesByEntity('PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
        expect(res.length).toBe(1);
        expect(res[0].fileName).toBe('Project_Charter_Signed.pdf');
      });

      it('PM project lain ditolak ForbiddenException', async () => {
        await expect(
          service.getFilesByEntity('PROJECT', 10, OTHER_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.getFilesByEntity('PROJECT', 10, OTHER_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(/Hanya Project Manager yang ditugaskan/);
      });

      it('SUPER_ADMIN dapat override melihat document project', async () => {
        const res = await service.getFilesByEntity('PROJECT', 10, SUPER_ADMIN_ID, ['SUPER_ADMIN']);
        expect(res).toBeDefined();
        expect(res.length).toBe(1);
      });
    });

    // --- CONTRACT TESTS ---
    describe('CONTRACT Entity Boundaries', () => {
      it('Role LEGAL sesuai existing rule dapat akses document contract', async () => {
        const res = await service.getFilesByEntity('CONTRACT', 20, LEGAL_ID, ['LEGAL']);
        expect(res).toBeDefined();
      });

      it('Role DIRECTOR sesuai existing rule dapat akses document contract', async () => {
        const res = await service.getFilesByEntity('CONTRACT', 20, DIRECTOR_ID, ['DIRECTOR']);
        expect(res).toBeDefined();
      });

      it('Assigned PM pada contract dapat akses document contract', async () => {
        const res = await service.getFilesByEntity('CONTRACT', 20, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(res).toBeDefined();
      });

      it('Marketing PIC pada tender contract dapat akses document contract', async () => {
        const res = await service.getFilesByEntity('CONTRACT', 20, MARKETING_PIC_ID, ['MARKETING']);
        expect(res).toBeDefined();
      });

      it('User tanpa relation ditolak ForbiddenException', async () => {
        await expect(
          service.getFilesByEntity('CONTRACT', 20, OTHER_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.getFilesByEntity('CONTRACT', 20, OTHER_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(/Anda tidak memiliki relasi atau izin/);
      });

      it('SUPER_ADMIN dapat override document contract', async () => {
        const res = await service.getFilesByEntity('CONTRACT', 20, SUPER_ADMIN_ID, ['SUPER_ADMIN']);
        expect(res).toBeDefined();
      });
    });

    // --- TENDER TESTS ---
    describe('TENDER Entity Boundaries', () => {
      it('Marketing PIC dapat akses document tender', async () => {
        const res = await service.getFilesByEntity('TENDER', 30, MARKETING_PIC_ID, ['MARKETING']);
        expect(res).toBeDefined();
      });

      it('Marketing user lain ditolak ForbiddenException', async () => {
        await expect(
          service.getFilesByEntity('TENDER', 30, OTHER_MARKETING_ID, ['MARKETING']),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.getFilesByEntity('TENDER', 30, OTHER_MARKETING_ID, ['MARKETING']),
        ).rejects.toThrow(/Hanya Marketing PIC atau manajemen/);
      });

      it('DIRECTOR dapat akses document tender', async () => {
        const res = await service.getFilesByEntity('TENDER', 30, DIRECTOR_ID, ['DIRECTOR']);
        expect(res).toBeDefined();
      });

      it('SUPER_ADMIN dapat override document tender', async () => {
        const res = await service.getFilesByEntity('TENDER', 30, SUPER_ADMIN_ID, ['SUPER_ADMIN']);
        expect(res).toBeDefined();
      });
    });

    // --- GENERAL TESTS ---
    describe('GENERAL & Edge Cases', () => {
      it('Missing JWT identity (userId 0) → UnauthorizedException', async () => {
        await expect(
          service.getFilesByEntity('PROJECT', 10, 0, ['PROJECT_MANAGER']),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('Tidak ada bypass berdasarkan entityId saja (tipe entitas tidak dikenal → BadRequestException)', async () => {
        await expect(
          service.getFilesByEntity('UNKNOWN_ENTITY', 99, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(BadRequestException);
      });

      it('Entity tidak ditemukan di database → NotFoundException', async () => {
        await expect(
          service.getFilesByEntity('PROJECT', 9999, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  // SEC-08: DOCUMENT MUTATION ACCESS BOUNDARY HARDENING
  describe('SEC-08: Document Mutation Access Boundary Hardening (uploadFile, getPresignedUrl, saveMetadata)', () => {
    const mockFile = {
      originalname: 'mutation_test.pdf',
      buffer: Buffer.from('test-content'),
      mimetype: 'application/pdf',
      size: 2048,
    } as Express.Multer.File;

    // --- IDENTITY ENFORCEMENT ---
    describe('IDENTITY Enforcement', () => {
      it('Missing JWT identity (userId falsy/0) on uploadFile → UnauthorizedException', async () => {
        await expect(
          service.uploadFile('PROJECT', 10, mockFile, 0, ['PROJECT_MANAGER']),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('Missing JWT identity (userId falsy/0) on generatePresignedUrl → UnauthorizedException', async () => {
        await expect(
          service.generatePresignedUrl('project', 'test.pdf', 'application/pdf', 'PROJECT', 10, 0, ['PROJECT_MANAGER']),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('Missing JWT identity (userId falsy/0) on saveMetadata → UnauthorizedException', async () => {
        await expect(
          service.saveMetadata({
            entityType: 'PROJECT',
            entityId: 10,
            fileName: 'test.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
            key: 'project/test.pdf',
            userId: 0,
            userRoles: ['PROJECT_MANAGER'],
          }),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    // --- ENTITY VALIDATION ---
    describe('ENTITY Validation', () => {
      it('Entity target tidak ada di database on uploadFile → NotFoundException', async () => {
        await expect(
          service.uploadFile('PROJECT', 9999, mockFile, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(NotFoundException);
      });

      it('Entity target tidak ada di database on generatePresignedUrl → NotFoundException', async () => {
        await expect(
          service.generatePresignedUrl('project', 'test.pdf', 'application/pdf', 'PROJECT', 9999, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(NotFoundException);
      });

      it('Entity target tidak ada di database on saveMetadata → NotFoundException', async () => {
        await expect(
          service.saveMetadata({
            entityType: 'PROJECT',
            entityId: 9999,
            fileName: 'test.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
            key: 'project/test.pdf',
            userId: ASSIGNED_PM_ID,
            userRoles: ['PROJECT_MANAGER'],
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('Unknown entity type on uploadFile → BadRequestException', async () => {
        await expect(
          service.uploadFile('UNKNOWN_TYPE', 10, mockFile, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(BadRequestException);
      });

      it('Unknown entity type on generatePresignedUrl → BadRequestException', async () => {
        await expect(
          service.generatePresignedUrl('unknown', 'test.pdf', 'application/pdf', 'UNKNOWN_TYPE', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(BadRequestException);
      });

      it('Unknown entity type on saveMetadata → BadRequestException', async () => {
        await expect(
          service.saveMetadata({
            entityType: 'UNKNOWN_TYPE',
            entityId: 10,
            fileName: 'test.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
            key: 'unknown/test.pdf',
            userId: ASSIGNED_PM_ID,
            userRoles: ['PROJECT_MANAGER'],
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    // --- PROJECT MUTATION BOUNDARIES ---
    describe('PROJECT Mutation Boundaries', () => {
      it('Assigned PM dapat upload document project sendiri', async () => {
        const result = await service.uploadFile('PROJECT', 10, mockFile, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(result).toBeDefined();
        expect(result.fileName).toBe('mutation_test.pdf');
        expect(result.createdBy).toBe(ASSIGNED_PM_ID);
      });

      it('Assigned PM dapat generate presigned URL untuk project sendiri', async () => {
        const result = await service.generatePresignedUrl('project', 'test.pdf', 'application/pdf', 'PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(result).toBeDefined();
        expect(result.uploadUrl).toBeDefined();
      });

      it('Assigned PM dapat saveMetadata untuk project sendiri', async () => {
        const result = await service.saveMetadata({
          entityType: 'PROJECT',
          entityId: 10,
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          key: 'project/test.pdf',
          userId: ASSIGNED_PM_ID,
          userRoles: ['PROJECT_MANAGER'],
        });
        expect(result).toBeDefined();
        expect(result.createdBy).toBe(ASSIGNED_PM_ID);
      });

      it('PM project lain ditolak ForbiddenException saat uploadFile', async () => {
        await expect(
          service.uploadFile('PROJECT', 10, mockFile, OTHER_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('PM project lain ditolak ForbiddenException saat generatePresignedUrl', async () => {
        await expect(
          service.generatePresignedUrl('project', 'test.pdf', 'application/pdf', 'PROJECT', 10, OTHER_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('PM project lain ditolak ForbiddenException saat saveMetadata', async () => {
        await expect(
          service.saveMetadata({
            entityType: 'PROJECT',
            entityId: 10,
            fileName: 'test.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
            key: 'project/test.pdf',
            userId: OTHER_PM_ID,
            userRoles: ['PROJECT_MANAGER'],
          }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('SUPER_ADMIN dapat override upload document project', async () => {
        const result = await service.uploadFile('PROJECT', 10, mockFile, SUPER_ADMIN_ID, ['SUPER_ADMIN']);
        expect(result).toBeDefined();
        expect(result.createdBy).toBe(SUPER_ADMIN_ID);
      });
    });

    // --- CONTRACT MUTATION BOUNDARIES ---
    describe('CONTRACT Mutation Boundaries', () => {
      it('User dengan relation valid (Assigned PM pada contract) dapat upload', async () => {
        const result = await service.uploadFile('CONTRACT', 20, mockFile, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(result).toBeDefined();
        expect(result.createdBy).toBe(ASSIGNED_PM_ID);
      });

      it('User dengan relation valid (Marketing PIC terkait) dapat upload', async () => {
        const result = await service.uploadFile('CONTRACT', 20, mockFile, MARKETING_PIC_ID, ['MARKETING']);
        expect(result).toBeDefined();
        expect(result.createdBy).toBe(MARKETING_PIC_ID);
      });

      it('User dengan role LEGAL dapat upload contract document', async () => {
        const result = await service.uploadFile('CONTRACT', 20, mockFile, LEGAL_ID, ['LEGAL']);
        expect(result).toBeDefined();
        expect(result.createdBy).toBe(LEGAL_ID);
      });

      it('User tanpa relation ditolak ForbiddenException', async () => {
        await expect(
          service.uploadFile('CONTRACT', 20, mockFile, OTHER_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('SUPER_ADMIN dapat override contract mutation', async () => {
        const result = await service.uploadFile('CONTRACT', 20, mockFile, SUPER_ADMIN_ID, ['SUPER_ADMIN']);
        expect(result).toBeDefined();
        expect(result.createdBy).toBe(SUPER_ADMIN_ID);
      });
    });

    // --- TENDER MUTATION BOUNDARIES ---
    describe('TENDER Mutation Boundaries', () => {
      it('Marketing PIC dapat upload document tender', async () => {
        const result = await service.uploadFile('TENDER', 30, mockFile, MARKETING_PIC_ID, ['MARKETING']);
        expect(result).toBeDefined();
        expect(result.createdBy).toBe(MARKETING_PIC_ID);
      });

      it('Marketing user lain ditolak ForbiddenException', async () => {
        await expect(
          service.uploadFile('TENDER', 30, mockFile, OTHER_MARKETING_ID, ['MARKETING']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('DIRECTOR dapat upload document tender', async () => {
        const result = await service.uploadFile('TENDER', 30, mockFile, DIRECTOR_ID, ['DIRECTOR']);
        expect(result).toBeDefined();
        expect(result.createdBy).toBe(DIRECTOR_ID);
      });

      it('SUPER_ADMIN dapat override tender mutation', async () => {
        const result = await service.uploadFile('TENDER', 30, mockFile, SUPER_ADMIN_ID, ['SUPER_ADMIN']);
        expect(result).toBeDefined();
        expect(result.createdBy).toBe(SUPER_ADMIN_ID);
      });
    });

    // --- MUTATION SPECIFIC BOUNDARY TESTS ---
    describe('MUTATION: saveMetadata & getPresignedUrl Hardening', () => {
      it('saveMetadata tidak dapat attach document ke entity yang bukan hak caller', async () => {
        await expect(
          service.saveMetadata({
            entityType: 'CONTRACT',
            entityId: 20,
            fileName: 'unauthorized_attach.pdf',
            mimeType: 'application/pdf',
            fileSize: 5000,
            key: 'contracts/unauthorized.pdf',
            userId: OTHER_PM_ID,
            userRoles: ['PROJECT_MANAGER'],
          }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('getPresignedUrl tidak membuat URL untuk entity yang tidak boleh diakses', async () => {
        await expect(
          service.generatePresignedUrl('tender', 'tamper.pdf', 'application/pdf', 'TENDER', 30, OTHER_MARKETING_ID, ['MARKETING']),
        ).rejects.toThrow(ForbiddenException);
      });

      // --- P0-3E2: S3-04 FileName Sanitization & Presigned Key Generation ---
      describe('S3-04: generatePresignedUrl() FileName Sanitization & Safe Key Generation', () => {
        it('Menghasilkan key dengan pola <entity-prefix>/<timestamp>-<safe-file-name>', async () => {
          const result = await service.generatePresignedUrl('project', 'proposal.pdf', 'application/pdf', 'PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
          expect(result.key).toMatch(/^project\/\d+-proposal\.pdf$/);
          expect(result.uploadUrl).toBeDefined();
          expect(result.finalUrl).toContain(`/${result.key}`);
        });

        it('Membersihkan spasi dan karakter tidak aman pada fileName', async () => {
          const result = await service.generatePresignedUrl('project', 'my proposal (final) #1.pdf', 'application/pdf', 'PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
          expect(result.key).toMatch(/^project\/\d+-my_proposal_final_1\.pdf$/);
        });

        it('Menghapus pemisah direktori (/ dan \\) dan mempertahankan nama berkas aman', async () => {
          const result = await service.generatePresignedUrl('project', 'nested/sub/document.pdf', 'application/pdf', 'PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
          expect(result.key).toMatch(/^project\/\d+-document\.pdf$/);
        });

        it('Menolak fileName dengan path traversal (..) dengan BadRequestException', async () => {
          await expect(
            service.generatePresignedUrl('project', '../../secret.pdf', 'application/pdf', 'PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
          ).rejects.toThrow(BadRequestException);
        });

        it('Menolak fileName dengan null byte (\\0) dengan BadRequestException', async () => {
          await expect(
            service.generatePresignedUrl('project', 'test\0file.pdf', 'application/pdf', 'PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
          ).rejects.toThrow(BadRequestException);
        });

        it('Server menentukan folder berdasarkan entityType bukan folder yang di-tamper client', async () => {
          const result = await service.generatePresignedUrl('arbitrary_bucket_leak', 'test.pdf', 'application/pdf', 'PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
          expect(result.key).toMatch(/^project\/\d+-test\.pdf$/);
          expect(result.key).not.toContain('arbitrary_bucket_leak');
        });
      });

      // --- P0-3E2: S3-03 Key Validation & Metadata Integrity ---
      describe('S3-03: saveMetadata() Server-Side S3 Key Integrity Validation', () => {
        it('Menerima key yang valid sesuai dengan entity prefix yang diizinkan', async () => {
          const result = await service.saveMetadata({
            entityType: 'PROJECT',
            entityId: 10,
            fileName: 'contract.pdf',
            mimeType: 'application/pdf',
            fileSize: 2048,
            key: 'project/1730000000000-contract.pdf',
            userId: ASSIGNED_PM_ID,
            userRoles: ['PROJECT_MANAGER'],
          });
          expect(result).toBeDefined();
          expect(result.filePath).toContain('/project/1730000000000-contract.pdf');
        });

        it('Menolak S3 key yang menunjuk ke folder/entity lain (Cross-Entity Tampering)', async () => {
          await expect(
            service.saveMetadata({
              entityType: 'PROJECT',
              entityId: 10,
              fileName: 'contract.pdf',
              mimeType: 'application/pdf',
              fileSize: 2048,
              key: 'contract/1730000000000-contract.pdf',
              userId: ASSIGNED_PM_ID,
              userRoles: ['PROJECT_MANAGER'],
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('Menolak S3 key kosong atau spasi dengan BadRequestException', async () => {
          await expect(
            service.saveMetadata({
              entityType: 'PROJECT',
              entityId: 10,
              fileName: 'contract.pdf',
              mimeType: 'application/pdf',
              fileSize: 2048,
              key: '   ',
              userId: ASSIGNED_PM_ID,
              userRoles: ['PROJECT_MANAGER'],
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('Menolak S3 key dengan path traversal (..) dengan BadRequestException', async () => {
          await expect(
            service.saveMetadata({
              entityType: 'PROJECT',
              entityId: 10,
              fileName: 'contract.pdf',
              mimeType: 'application/pdf',
              fileSize: 2048,
              key: 'project/../../etc/passwd',
              userId: ASSIGNED_PM_ID,
              userRoles: ['PROJECT_MANAGER'],
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('Menolak S3 key absolute (dimulai dengan / atau \\)', async () => {
          await expect(
            service.saveMetadata({
              entityType: 'PROJECT',
              entityId: 10,
              fileName: 'contract.pdf',
              mimeType: 'application/pdf',
              fileSize: 2048,
              key: '/project/1730000000000-contract.pdf',
              userId: ASSIGNED_PM_ID,
              userRoles: ['PROJECT_MANAGER'],
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('Menolak S3 key yang bernilai hanya folder/prefix tanpa file name', async () => {
          await expect(
            service.saveMetadata({
              entityType: 'PROJECT',
              entityId: 10,
              fileName: 'contract.pdf',
              mimeType: 'application/pdf',
              fileSize: 2048,
              key: 'project/',
              userId: ASSIGNED_PM_ID,
              userRoles: ['PROJECT_MANAGER'],
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('Menolak S3 key dengan subdirektori tidak diizinkan', async () => {
          await expect(
            service.saveMetadata({
              entityType: 'PROJECT',
              entityId: 10,
              fileName: 'contract.pdf',
              mimeType: 'application/pdf',
              fileSize: 2048,
              key: 'project/nested/sub/contract.pdf',
              userId: ASSIGNED_PM_ID,
              userRoles: ['PROJECT_MANAGER'],
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('Menolak S3 key dengan null byte (\\0)', async () => {
          await expect(
            service.saveMetadata({
              entityType: 'PROJECT',
              entityId: 10,
              fileName: 'contract.pdf',
              mimeType: 'application/pdf',
              fileSize: 2048,
              key: 'project/test\0file.pdf',
              userId: ASSIGNED_PM_ID,
              userRoles: ['PROJECT_MANAGER'],
            }),
          ).rejects.toThrow(BadRequestException);
        });
      });
    });
  });

  // SEC-09: SECURE FILE DELIVERY (STREAM / DOWNLOAD)
  describe('SEC-09: Secure File Delivery (streamDocument & downloadDocument)', () => {
    // --- AUTH ---
    describe('AUTH Enforcement', () => {
      it('Missing JWT identity (userId falsy/0) → UnauthorizedException on streamDocument', async () => {
        await expect(
          service.streamDocument(1, 0, ['PROJECT_MANAGER']),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('Missing JWT identity on controller downloadDocument → UnauthorizedException', async () => {
        const mockReq = { user: null };
        const mockRes = { set: jest.fn() } as any;

        await expect(
          controller.downloadDocument(1, mockReq, mockRes),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('Missing JWT identity on controller streamDocument → UnauthorizedException', async () => {
        const mockReq = { user: null };
        const mockRes = { set: jest.fn() } as any;

        await expect(
          controller.streamDocument(1, mockReq, mockRes),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('Valid JWT identity → progresses past auth check to validation', async () => {
        const result = await service.streamDocument(1, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(result).toBeDefined();
        expect(result.fileName).toBe('Project_Charter_Signed.pdf');
      });
    });

    // --- DOCUMENT EXISTENCE ---
    describe('DOCUMENT Existence', () => {
      it('Document tidak ditemukan di database → NotFoundException', async () => {
        await expect(
          service.streamDocument(9999, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.streamDocument(9999, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(/tidak ditemukan/);
      });
    });

    // --- ACCESS BOUNDARIES ---
    describe('ACCESS Boundaries', () => {
      describe('PROJECT Document Access', () => {
        it('Assigned PM dapat download document project sendiri', async () => {
          const result = await service.streamDocument(1, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
          expect(result.document.entityType).toBe('PROJECT');
          expect(result.document.entityId).toBe(10);
          expect(result.stream).toBeDefined();
        });

        it('PM lain ditolak ForbiddenException', async () => {
          await expect(
            service.streamDocument(1, OTHER_PM_ID, ['PROJECT_MANAGER']),
          ).rejects.toThrow(ForbiddenException);
        });

        it('SUPER_ADMIN dapat override download document project', async () => {
          const result = await service.streamDocument(1, SUPER_ADMIN_ID, ['SUPER_ADMIN']);
          expect(result).toBeDefined();
          expect(result.stream).toBeDefined();
        });
      });

      describe('CONTRACT Document Access', () => {
        it('Legal dapat download document contract sesuai rule', async () => {
          const result = await service.streamDocument(2, LEGAL_ID, ['LEGAL']);
          expect(result.document.entityType).toBe('CONTRACT');
          expect(result.document.entityId).toBe(20);
          expect(result.stream).toBeDefined();
        });

        it('Assigned PM pada contract dapat download', async () => {
          const result = await service.streamDocument(2, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
          expect(result).toBeDefined();
          expect(result.stream).toBeDefined();
        });

        it('Unauthorized user ditolak ForbiddenException', async () => {
          await expect(
            service.streamDocument(2, OTHER_PM_ID, ['PROJECT_MANAGER']),
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('TENDER Document Access', () => {
        it('Marketing PIC dapat download document tender', async () => {
          const result = await service.streamDocument(3, MARKETING_PIC_ID, ['MARKETING']);
          expect(result.document.entityType).toBe('TENDER');
          expect(result.document.entityId).toBe(30);
          expect(result.stream).toBeDefined();
        });

        it('Marketing lain ditolak ForbiddenException', async () => {
          await expect(
            service.streamDocument(3, OTHER_MARKETING_ID, ['MARKETING']),
          ).rejects.toThrow(ForbiddenException);
        });
      });
    });

    // --- FILE STREAM & BYTES PROTECTION ---
    describe('FILE Stream & Bytes Delivery Protection', () => {
      it('Authorized user mendapatkan stream/file response via controller downloadDocument', async () => {
        const mockReq = { user: { userId: ASSIGNED_PM_ID, roles: ['PROJECT_MANAGER'] } };
        const mockRes = { set: jest.fn() } as any;

        const fileResult = await controller.downloadDocument(1, mockReq, mockRes);
        expect(fileResult).toBeDefined();
        expect(mockRes.set).toHaveBeenCalledWith(
          expect.objectContaining({
            'Content-Type': 'application/pdf',
            'Content-Disposition': expect.stringContaining('attachment; filename='),
          }),
        );
      });

      it('Authorized user mendapatkan stream/file response via controller streamDocument (inline)', async () => {
        const mockReq = { user: { userId: ASSIGNED_PM_ID, roles: ['PROJECT_MANAGER'] } };
        const mockRes = { set: jest.fn() } as any;

        const fileResult = await controller.streamDocument(1, mockReq, mockRes);
        expect(fileResult).toBeDefined();
        expect(mockRes.set).toHaveBeenCalledWith(
          expect.objectContaining({
            'Content-Type': 'application/pdf',
            'Content-Disposition': expect.stringContaining('inline; filename='),
          }),
        );
      });

      it('Unauthorized user tidak pernah mendapatkan file stream bytes', async () => {
        const createReadStreamSpy = jest.spyOn(fs, 'createReadStream');
        createReadStreamSpy.mockClear();

        await expect(
          service.streamDocument(1, OTHER_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);

        expect(createReadStreamSpy).not.toHaveBeenCalled();
      });

      it('Berkas fisik tidak ada di filesystem → NotFoundException', async () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);

        await expect(
          service.streamDocument(1, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(NotFoundException);

        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      });
    });

    // --- S3 SECURE RETRIEVAL ---
    describe('S3 / Cloud Storage Secure Retrieval (P0-3E1)', () => {
      it('Authorized user dapat stream document yang disimpan di S3 (HTTPS URL)', async () => {
        const result = await service.streamDocument(4, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(result).toBeDefined();
        expect(result.fileName).toBe('Charter_S3.pdf');
        expect(result.mimeType).toBe('application/pdf');
        expect(result.stream).toBeDefined();
      });

      it('Authorized user dapat stream document yang disimpan di S3 (s3:// URI)', async () => {
        const result = await service.streamDocument(5, LEGAL_ID, ['LEGAL']);
        expect(result).toBeDefined();
        expect(result.fileName).toBe('Contract_S3.pdf');
        expect(result.mimeType).toBe('application/pdf');
        expect(result.stream).toBeDefined();
      });

      it('S3 object missing (NoSuchKey) → safe NotFoundException tanpa credential leak', async () => {
        await expect(
          service.streamDocument(6, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.streamDocument(6, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(/tidak ditemukan di cloud storage/);
      });

      it('S3 reference dengan path traversal ditolak dengan BadRequestException', async () => {
        await expect(
          service.streamDocument(7, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(BadRequestException);
      });

      it('S3 reference tanpa bucket/key valid ditolak dengan BadRequestException', async () => {
        await expect(
          service.streamDocument(8, ASSIGNED_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(BadRequestException);
      });

      it('Unauthorized user tetap ditolak ForbiddenException sebelum S3 GetObjectCommand', async () => {
        const s3SendSpy = jest.spyOn(s3ClientMock, 'send');
        s3SendSpy.mockClear();

        await expect(
          service.streamDocument(4, OTHER_PM_ID, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);

        expect(s3SendSpy).not.toHaveBeenCalled();
      });

      it('S3 downloadDocument via controller mengembalikan StreamableFile dan header yang sesuai', async () => {
        const mockReq = { user: { userId: ASSIGNED_PM_ID, roles: ['PROJECT_MANAGER'] } };
        const mockRes = { set: jest.fn() } as any;

        const fileResult = await controller.downloadDocument(4, mockReq, mockRes);
        expect(fileResult).toBeDefined();
        expect(mockRes.set).toHaveBeenCalledWith(
          expect.objectContaining({
            'Content-Type': 'application/pdf',
            'Content-Disposition': expect.stringContaining('attachment; filename='),
          }),
        );
      });
    });

    // P0-3E3: REMOVAL OF RAW STORAGE URLS (S3-02)
    describe('P0-3E3: Removal of Raw Storage URLs & Canonical Delivery References (S3-02)', () => {
      it('getFilesByEntity() tidak mengembalikan raw S3 URL (amazonaws.com)', async () => {
        const files = await service.getFilesByEntity('PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(files.length).toBeGreaterThan(0);
        files.forEach((f: any) => {
          expect(f.fileUrl).not.toContain('amazonaws.com');
          expect(f.filePath).not.toContain('amazonaws.com');
          expect(f.streamUrl).not.toContain('amazonaws.com');
          expect(f.downloadUrl).not.toContain('amazonaws.com');
        });
      });

      it('getFilesByEntity() tidak mengembalikan stale public /uploads/ URL', async () => {
        const files = await service.getFilesByEntity('PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        expect(files.length).toBeGreaterThan(0);
        files.forEach((f: any) => {
          expect(f.fileUrl).not.toContain('/uploads/');
          expect(f.filePath).not.toContain('/uploads/');
        });
      });

      it('getFilesByEntity() mengembalikan canonical EPMS endpoints streamUrl dan downloadUrl', async () => {
        const files = await service.getFilesByEntity('PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        const doc = files[0];
        expect(doc.streamUrl).toBe(`/api/v1/documents/${doc.id}/stream`);
        expect(doc.downloadUrl).toBe(`/api/v1/documents/${doc.id}/download`);
        expect(doc.fileUrl).toBe(`/api/v1/documents/${doc.id}/stream`);
      });

      it('getAllFiles() tidak mengembalikan raw S3 URL maupun /uploads/ URL', async () => {
        const files = await service.getAllFiles();
        expect(files.length).toBeGreaterThan(0);
        files.forEach((f: any) => {
          expect(f.fileUrl).not.toContain('amazonaws.com');
          expect(f.fileUrl).not.toContain('/uploads/');
          expect(f.filePath).not.toContain('amazonaws.com');
          expect(f.filePath).not.toContain('/uploads/');
          expect(f.streamUrl).toBe(`/api/v1/documents/${f.id}/stream`);
          expect(f.downloadUrl).toBe(`/api/v1/documents/${f.id}/download`);
        });
      });

      it('Metadata fields asli (id, fileName, mimeType, entityType, createdBy) tetap utuh', async () => {
        const files = await service.getFilesByEntity('PROJECT', 10, ASSIGNED_PM_ID, ['PROJECT_MANAGER']);
        const doc = files[0];
        expect(doc.id).toBeDefined();
        expect(doc.fileName).toBeDefined();
        expect(doc.entityType).toBe('PROJECT');
        expect(doc.entityId).toBe(10);
      });
    });
  });
});
