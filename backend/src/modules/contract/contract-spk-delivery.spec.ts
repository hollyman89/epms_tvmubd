import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { ContractAmendment } from '../../entities/contract-amendment.entity';
import { Tender } from '../../entities/tender.entity';
import { User } from '../../entities/user.entity';

describe('SEC-09: Secure Contract SPK Delivery Boundary (P0-3C2A)', () => {
  let controller: ContractController;
  let service: ContractService;
  let contractRepoMock: any;
  let s3ClientMock: any;
  let pdfQueueMock: any;

  // Temp file for real filesystem streaming tests
  const testUploadsDir = path.resolve(process.cwd(), 'uploads', 'contracts');
  const testSpkFileName = `test-spk-delivery-${Date.now()}.pdf`;
  const testSpkFilePath = path.join(testUploadsDir, testSpkFileName);
  const activeStreams: any[] = [];

  const mockContractWithSpk: Partial<Contract> = {
    id: 101,
    contract_number: 'CONT-20260912-0101',
    contract_value: 150000000,
    legal_status: LegalStatus.DRAFT,
    status: 'PENDING_LEGAL_REVIEW',
    spk_file_url: `/uploads/contracts/${testSpkFileName}`,
    project_manager_id: 15,
    created_by: 20,
    proposal: {
      id: 50,
      tender: {
        id: 70,
        marketing_pic_id: 25,
      },
    } as any,
  };

  const mockContractWithoutSpk: Partial<Contract> = {
    id: 102,
    contract_number: 'CONT-20260912-0102',
    contract_value: 50000000,
    legal_status: LegalStatus.DRAFT,
    status: 'DRAFT',
    spk_file_url: null as any,
  };

  const mockContractWithMissingFile: Partial<Contract> = {
    id: 103,
    contract_number: 'CONT-20260912-0103',
    contract_value: 50000000,
    legal_status: LegalStatus.DRAFT,
    status: 'DRAFT',
    spk_file_url: '/uploads/contracts/non_existent_file_9999.pdf',
  };

  const mockContractWithTraversal: Partial<Contract> = {
    id: 104,
    contract_number: 'CONT-20260912-0104',
    contract_value: 50000000,
    legal_status: LegalStatus.DRAFT,
    status: 'DRAFT',
    spk_file_url: '../../etc/passwd',
  };

  const mockContractWithS3: Partial<Contract> = {
    id: 105,
    contract_number: 'CONT-20260912-0105',
    contract_value: 50000000,
    legal_status: LegalStatus.DRAFT,
    status: 'DRAFT',
    spk_file_url: 'https://my-bucket.s3.ap-southeast-1.amazonaws.com/spk/remote-contract.pdf',
  };

  const mockContractWithS3Uri: Partial<Contract> = {
    id: 106,
    contract_number: 'CONT-20260912-0106',
    contract_value: 50000000,
    legal_status: LegalStatus.DRAFT,
    status: 'DRAFT',
    spk_file_url: 's3://my-bucket/spk/remote-contract-uri.pdf',
  };

  const mockContractWithMissingS3: Partial<Contract> = {
    id: 107,
    contract_number: 'CONT-20260912-0107',
    contract_value: 50000000,
    legal_status: LegalStatus.DRAFT,
    status: 'DRAFT',
    spk_file_url: 'https://my-bucket.s3.amazonaws.com/spk/missing.pdf',
  };

  const mockContractWithS3Traversal: Partial<Contract> = {
    id: 108,
    contract_number: 'CONT-20260912-0108',
    contract_value: 50000000,
    legal_status: LegalStatus.DRAFT,
    status: 'DRAFT',
    spk_file_url: 'https://my-bucket.s3.amazonaws.com/../../secret.pdf',
  };

  beforeAll(() => {
    // Create temporary uploads/contracts directory and physical test file
    if (!fs.existsSync(testUploadsDir)) {
      fs.mkdirSync(testUploadsDir, { recursive: true });
    }
    fs.writeFileSync(testSpkFilePath, '%PDF-1.4 Mock Contract SPK Binary Content for P0-3C2A Verification');
  });

  afterEach(() => {
    while (activeStreams.length > 0) {
      const s = activeStreams.pop();
      try {
        if (s && typeof s.destroy === 'function') {
          s.destroy();
        }
      } catch {
        // ignore
      }
    }
  });

  afterAll(async () => {
    // Wait briefly to allow file descriptors to drain cleanly
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (fs.existsSync(testSpkFilePath)) {
      try {
        fs.unlinkSync(testSpkFilePath);
      } catch {
        // ignore
      }
    }
  });

  beforeEach(async () => {
    s3ClientMock = {
      send: jest.fn().mockImplementation((command) => {
        const key = command.input?.Key;
        if (key === 'spk/remote-contract.pdf' || key === 'spk/remote-contract-uri.pdf') {
          const readable = new Readable();
          readable.push('%PDF-1.4 Mock S3 SPK Stream Content');
          readable.push(null);
          activeStreams.push(readable);
          return Promise.resolve({
            Body: readable,
            ContentType: 'application/pdf',
            ContentLength: 1024,
          });
        }
        if (key === 'spk/missing.pdf') {
          const err = new Error('NoSuchKey');
          (err as any).name = 'NoSuchKey';
          return Promise.reject(err);
        }
        const genericErr = new Error('AccessDenied');
        return Promise.reject(genericErr);
      }),
    };

    contractRepoMock = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 101) return Promise.resolve({ ...mockContractWithSpk });
        if (where.id === 102) return Promise.resolve({ ...mockContractWithoutSpk });
        if (where.id === 103) return Promise.resolve({ ...mockContractWithMissingFile });
        if (where.id === 104) return Promise.resolve({ ...mockContractWithTraversal });
        if (where.id === 105) return Promise.resolve({ ...mockContractWithS3 });
        if (where.id === 106) return Promise.resolve({ ...mockContractWithS3Uri });
        if (where.id === 107) return Promise.resolve({ ...mockContractWithMissingS3 });
        if (where.id === 108) return Promise.resolve({ ...mockContractWithS3Traversal });
        return Promise.resolve(null);
      }),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    };

    pdfQueueMock = {
      add: jest.fn(),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractController],
      providers: [
        ContractService,
        { provide: getRepositoryToken(Contract), useValue: contractRepoMock },
        { provide: getRepositoryToken(ContractAmendment), useValue: {} },
        { provide: getRepositoryToken(Tender), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: 'BullQueue_pdf-generation', useValue: pdfQueueMock },
        { provide: S3Client, useValue: s3ClientMock },
      ],
    }).compile();

    controller = module.get<ContractController>(ContractController);
    service = module.get<ContractService>(ContractService);
  });

  // 1. AUTHENTICATION & CONTROLLER GUARD
  describe('1. Authentication & Actor Identity Enforcement', () => {
    it('streamSpk: should throw UnauthorizedException when request has no user identity', async () => {
      const mockReq = { user: null };
      const mockRes: any = { set: jest.fn() };

      await expect(controller.streamSpk(101, mockReq as any, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('downloadSpk: should throw UnauthorizedException when request has empty userId', async () => {
      const mockReq = { user: { roles: ['LEGAL'] } };
      const mockRes: any = { set: jest.fn() };

      await expect(controller.downloadSpk(101, mockReq as any, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('streamSpk: should set inline Content-Disposition and application/pdf headers for authorized user', async () => {
      const mockReq = { user: { userId: 9, roles: ['LEGAL'] } };
      const mockRes: any = { set: jest.fn() };

      const result = await controller.streamSpk(101, mockReq as any, mockRes);
      activeStreams.push(result.getStream());

      expect(result).toBeInstanceOf(StreamableFile);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': expect.stringContaining('inline; filename='),
        }),
      );
    });

    it('downloadSpk: should set attachment Content-Disposition header for authorized user', async () => {
      const mockReq = { user: { userId: 9, roles: ['SUPER_ADMIN'] } };
      const mockRes: any = { set: jest.fn() };

      const result = await controller.downloadSpk(101, mockReq as any, mockRes);
      activeStreams.push(result.getStream());

      expect(result).toBeInstanceOf(StreamableFile);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': expect.stringContaining('attachment; filename='),
        }),
      );
    });
  });

  // 2. CONTRACT LOOKUP & STATUS VERIFICATION
  describe('2. Contract Lookup & SPK State Verification', () => {
    it('should throw NotFoundException if contract does not exist', async () => {
      await expect(
        service.streamContractSpk(9999, 1, ['SUPER_ADMIN']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if contract has no spk_file_url uploaded', async () => {
      await expect(
        service.streamContractSpk(102, 1, ['SUPER_ADMIN']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // 3. ROLE-BASED ACCESS CONTROL (RBAC & ABAC)
  describe('3. Role Boundary & Relationship Access Control', () => {
    it('SUPER_ADMIN should be ALLOWED to stream SPK', async () => {
      const result = await service.streamContractSpk(101, 1, ['SUPER_ADMIN']);
      activeStreams.push(result.stream);
      expect(result.stream).toBeDefined();
      expect(result.fileName).toBe(testSpkFileName);
      expect(result.mimeType).toBe('application/pdf');
    });

    it('DIRECTOR should be ALLOWED to stream SPK', async () => {
      const result = await service.streamContractSpk(101, 2, ['DIRECTOR']);
      activeStreams.push(result.stream);
      expect(result.stream).toBeDefined();
      expect(result.fileName).toBe(testSpkFileName);
    });

    it('LEGAL should be ALLOWED to stream SPK', async () => {
      const result = await service.streamContractSpk(101, 3, ['LEGAL']);
      activeStreams.push(result.stream);
      expect(result.stream).toBeDefined();
      expect(result.fileName).toBe(testSpkFileName);
    });

    it('GENERAL_MANAGER & HEAD_OF_OPERATIONS should be ALLOWED to stream SPK', async () => {
      const resultGm = await service.streamContractSpk(101, 4, ['GENERAL_MANAGER']);
      activeStreams.push(resultGm.stream);
      expect(resultGm.stream).toBeDefined();

      const resultHoo = await service.streamContractSpk(101, 5, ['HEAD_OF_OPERATIONS']);
      activeStreams.push(resultHoo.stream);
      expect(resultHoo.stream).toBeDefined();
    });

    it('Assigned Project Manager (project_manager_id) should be ALLOWED to stream SPK', async () => {
      // Contract PM is user ID 15
      const result = await service.streamContractSpk(101, 15, ['PROJECT_MANAGER']);
      activeStreams.push(result.stream);
      expect(result.stream).toBeDefined();
      expect(result.fileName).toBe(testSpkFileName);
    });

    it('Contract Creator (created_by) should be ALLOWED to stream SPK', async () => {
      // Creator is user ID 20
      const result = await service.streamContractSpk(101, 20, ['MARKETING']);
      activeStreams.push(result.stream);
      expect(result.stream).toBeDefined();
      expect(result.fileName).toBe(testSpkFileName);
    });

    it('Tender Marketing PIC (tender.marketing_pic_id) should be ALLOWED to stream SPK', async () => {
      // Tender marketing PIC is user ID 25
      const result = await service.streamContractSpk(101, 25, ['MARKETING']);
      activeStreams.push(result.stream);
      expect(result.stream).toBeDefined();
      expect(result.fileName).toBe(testSpkFileName);
    });

    it('Unrelated user (e.g. unassigned PM, FINANCE, VENDOR) should be REJECTED with ForbiddenException', async () => {
      // User ID 88 has no relation to contract 101 and has no executive/legal role
      await expect(
        service.streamContractSpk(101, 88, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.streamContractSpk(101, 99, ['FINANCE']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.streamContractSpk(101, 111, ['VENDOR']),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // 4. PHYSICAL FILE INTEGRITY & PATH SECURITY
  describe('4. File Integrity & Path Traversal Security', () => {
    it('should throw NotFoundException if physical file is missing from disk', async () => {
      await expect(
        service.streamContractSpk(103, 1, ['SUPER_ADMIN']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should strictly reject path traversal attempts (e.g. ../../etc/passwd) with BadRequestException', async () => {
      await expect(
        service.streamContractSpk(104, 1, ['SUPER_ADMIN']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should stream S3-backed SPK file via GetObjectCommand for valid https S3 URL', async () => {
      const result = await service.streamContractSpk(105, 1, ['SUPER_ADMIN']);
      expect(result).toBeDefined();
      expect(result.fileName).toBe('SPK-CONT-20260912-0105.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.stream).toBeDefined();
    });

    it('should stream S3-backed SPK file via GetObjectCommand for valid s3:// URI', async () => {
      const result = await service.streamContractSpk(106, 1, ['SUPER_ADMIN']);
      expect(result).toBeDefined();
      expect(result.fileName).toBe('SPK-CONT-20260912-0106.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.stream).toBeDefined();
    });

    it('should throw safe NotFoundException if S3 object is missing or NoSuchKey', async () => {
      await expect(
        service.streamContractSpk(107, 1, ['SUPER_ADMIN']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject S3 path traversal attempt with BadRequestException', async () => {
      await expect(
        service.streamContractSpk(108, 1, ['SUPER_ADMIN']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unauthorized user from accessing S3 SPK with ForbiddenException', async () => {
      await expect(
        service.streamContractSpk(105, 999, ['VENDOR']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('controller streamSpk should return StreamableFile with application/pdf for S3 SPK', async () => {
      const mockReq = { user: { userId: 1, roles: ['SUPER_ADMIN'] } };
      const mockRes: any = { set: jest.fn() };
      const result = await controller.streamSpk(105, mockReq as any, mockRes);
      expect(result).toBeInstanceOf(StreamableFile);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': expect.stringContaining('inline; filename='),
        }),
      );
    });
  });

  // 5. STATIC SECURITY INTEGRITY
  describe('5. Delivery Boundary Verification', () => {
    it('service validateContractAccess should strictly reject arbitrary unauthorized roles', () => {
      const contract = { ...mockContractWithSpk } as Contract;
      expect(() => service.validateContractAccess(contract, 999, ['GUEST'])).toThrow(
        ForbiddenException,
      );
      expect(() => service.validateContractAccess(contract, 999, [])).toThrow(
        ForbiddenException,
      );
    });

    it('service validateContractAccess should grant access to executive and legal roles', () => {
      const contract = { ...mockContractWithSpk } as Contract;
      expect(() => service.validateContractAccess(contract, 999, ['LEGAL'])).not.toThrow();
      expect(() => service.validateContractAccess(contract, 999, ['DIRECTOR'])).not.toThrow();
      expect(() => service.validateContractAccess(contract, 999, ['SUPER_ADMIN'])).not.toThrow();
    });
  });

  // 6. P0-3E3: getPdfStatus & Storage Internals Protection (S3-05)
  describe('6. P0-3E3: getPdfStatus & Storage Internals Protection (S3-05)', () => {
    it('should return canonical contract stream endpoint and NO raw S3 or /uploads/ URL on completed job', async () => {
      pdfQueueMock.getJob.mockResolvedValueOnce({
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: {
          status: 'completed',
          contractId: 101,
        },
      });

      const res = await controller.getPdfStatus('job-123');
      expect(res.status).toBe('completed');
      expect(res.result).toBeDefined();
      expect(res.result.streamUrl).toBe('/api/v1/contracts/101/spk/stream');
      expect(res.result.downloadUrl).toBe('/api/v1/contracts/101/spk/download');
      expect(res.result.url).toBe('/api/v1/contracts/101/spk/stream');
      expect(JSON.stringify(res)).not.toContain('amazonaws.com');
      expect(JSON.stringify(res)).not.toContain('/uploads/');
    });

    it('should return safe pending status and NO /uploads/ proposals fallback if job is not found or fails', async () => {
      pdfQueueMock.getJob.mockResolvedValueOnce(null);

      const res = await controller.getPdfStatus('missing-job');
      expect(res.status).toBe('pending');
      expect(res.result).toBeNull();
      expect(JSON.stringify(res)).not.toContain('sample_contract.pdf');
      expect(JSON.stringify(res)).not.toContain('/uploads/');
    });

    it('should return job state with null result if job is still active or waiting', async () => {
      pdfQueueMock.getJob.mockResolvedValueOnce({
        getState: jest.fn().mockResolvedValue('active'),
        returnvalue: null,
      });

      const res = await controller.getPdfStatus('active-job');
      expect(res.status).toBe('active');
      expect(res.result).toBeNull();
      expect(JSON.stringify(res)).not.toContain('/uploads/');
    });
  });
});
