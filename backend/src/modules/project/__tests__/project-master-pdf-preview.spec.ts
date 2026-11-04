import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectService } from '../project.service';
import { ContractService } from '../../contract/contract.service';
import { Project } from '../../../entities/project.entity';
import { Contract } from '../../../entities/contract.entity';
import { ContractAmendment } from '../../../entities/contract-amendment.entity';
import { Tender } from '../../../entities/tender.entity';
import { User } from '../../../entities/user.entity';
import { WorkBreakdownStructure } from '../../../entities/wbs.entity';
import { Task } from '../../../entities/task.entity';
import { ProjectCostEstimate } from '../../../entities/project-cost-estimate.entity';
import { CostItem } from '../../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../../entities/project-management-review.entity';
import { PurchaseRequest } from '../../../entities/purchase-request.entity';
import { ProjectBaseline } from '../../../entities/project-baseline.entity';
import { ProjectBaselineWbsItem } from '../../../entities/project-baseline-wbs-item.entity';
import { ProjectProgressLog } from '../../../entities/project-progress-log.entity';
import { ProjectProgressEvidence } from '../../../entities/project-progress-evidence.entity';
import { AuditLog } from '../../../entities/audit-log.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('Project Master PDF Preview & Access Control Verification', () => {
  let projectService: ProjectService;
  let contractService: ContractService;
  let contractRepoMock: any;
  let projectRepoMock: any;

  // Temp file setup for real disk streaming
  const testUploadsDir = path.resolve(process.cwd(), 'uploads', 'contracts');
  const testSpkFileName = `test-pm-preview-${Date.now()}.pdf`;
  const testSpkFilePath = path.join(testUploadsDir, testSpkFileName);
  const mockPdfBytes = '%PDF-1.5 %Valid EPMS Contract SPK Preview Document Stream';
  const activeStreams: any[] = [];

  beforeAll(() => {
    if (!fs.existsSync(testUploadsDir)) {
      fs.mkdirSync(testUploadsDir, { recursive: true });
    }
    fs.writeFileSync(testSpkFilePath, mockPdfBytes, 'utf8');
  });

  afterEach(() => {
    while (activeStreams.length > 0) {
      const s = activeStreams.pop();
      try {
        if (s && typeof s.destroy === 'function') {
          s.destroy();
        }
      } catch {}
    }
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (fs.existsSync(testSpkFilePath)) {
      try {
        fs.unlinkSync(testSpkFilePath);
      } catch {}
    }
  });

  beforeEach(async () => {
    contractRepoMock = {
      findOne: jest.fn(),
      manager: {
        query: jest.fn(),
      },
    };

    projectRepoMock = {
      findOne: jest.fn(),
      manager: {
        query: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        ContractService,
        { provide: getRepositoryToken(Project), useValue: projectRepoMock },
        { provide: getRepositoryToken(Contract), useValue: contractRepoMock },
        { provide: getRepositoryToken(ContractAmendment), useValue: {} },
        { provide: getRepositoryToken(Tender), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(WorkBreakdownStructure), useValue: {} },
        { provide: getRepositoryToken(Task), useValue: {} },
        { provide: getRepositoryToken(ProjectCostEstimate), useValue: {} },
        { provide: getRepositoryToken(CostItem), useValue: {} },
        { provide: getRepositoryToken(ProjectInitialCondition), useValue: {} },
        { provide: getRepositoryToken(ProjectManagementReview), useValue: {} },
        { provide: getRepositoryToken(PurchaseRequest), useValue: {} },
        { provide: getRepositoryToken(ProjectBaseline), useValue: {} },
        { provide: getRepositoryToken(ProjectBaselineWbsItem), useValue: {} },
        { provide: getRepositoryToken(ProjectProgressLog), useValue: {} },
        { provide: getRepositoryToken(ProjectProgressEvidence), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: 'BullQueue_pdf-generation', useValue: { add: jest.fn(), getJob: jest.fn() } },
      ],
    }).compile();

    projectService = module.get<ProjectService>(ProjectService);
    contractService = module.get<ContractService>(ContractService);
  });

  describe('1. URL Sanitization: No Hardcoded localhost:4000 across ngrok/external environments', () => {
    it('should sanitize localhost:4000 URLs to clean relative paths', () => {
      const input = 'http://localhost:4000/uploads/contracts/spk-131-1793284866347-933210123.pdf';
      const sanitized = projectService.sanitizeSpkFileUrl(input);
      expect(sanitized).toBe('/uploads/contracts/spk-131-1793284866347-933210123.pdf');
    });

    it('should sanitize 127.0.0.1:4000 URLs to clean relative paths', () => {
      const input = 'http://127.0.0.1:4000/uploads/contracts/spk-demo.pdf';
      const sanitized = projectService.sanitizeSpkFileUrl(input);
      expect(sanitized).toBe('/uploads/contracts/spk-demo.pdf');
    });

    it('should preserve relative paths unchanged', () => {
      const input = '/uploads/contracts/spk-demo.pdf';
      const sanitized = projectService.sanitizeSpkFileUrl(input);
      expect(sanitized).toBe('/uploads/contracts/spk-demo.pdf');
    });

    it('should preserve S3 and external cloud URLs unchanged', () => {
      const s3Url = 'https://my-bucket.s3.ap-southeast-1.amazonaws.com/contracts/spk-remote.pdf';
      const sanitized = projectService.sanitizeSpkFileUrl(s3Url);
      expect(sanitized).toBe(s3Url);
    });

    it('should safely handle null, undefined, or empty string values', () => {
      expect(projectService.sanitizeSpkFileUrl(null)).toBeNull();
      expect(projectService.sanitizeSpkFileUrl(undefined as any)).toBeNull();
      expect(projectService.sanitizeSpkFileUrl('')).toBeNull();
      expect(projectService.sanitizeSpkFileUrl('   ')).toBeNull();
    });

    it('getProjectMaster should normalize legacy localhost:4000 URLs in projected items', async () => {
      projectRepoMock.manager.query
        .mockResolvedValueOnce([{ totalProjects: 1, planningCount: 1, inProgressCount: 0, completedCount: 0 }])
        .mockResolvedValueOnce([
          {
            id: 56,
            code: 'PRJ-56',
            name: 'Project Fiberization',
            status: 'PLANNING',
            contractId: 25,
            contractNumber: 'CONT-20261029-0025',
            contractValue: 150000000,
            spkFileUrl: 'http://localhost:4000/uploads/contracts/spk-131-1793284866347-933210123.pdf',
            managerId: 2,
          },
        ])
        .mockResolvedValueOnce([{ id: 1, name: 'Cust A', customer_id: 1, customer_name: 'Cust A', manager_id: 2, manager_name: 'PM Name' }]);

      const result = await projectService.getProjectMaster({}, 2, ['PROJECT_MANAGER']);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].spkFileUrl).toBe('/uploads/contracts/spk-131-1793284866347-933210123.pdf');
      expect(result.items[0].spkFileUrl).not.toContain('localhost:4000');
    });
  });

  describe('2. Authorization Boundaries & Access Control Enforcement', () => {
    const validContractRecord: Partial<Contract> = {
      id: 25,
      contract_number: 'CONT-20261029-0025',
      spk_file_url: `/uploads/contracts/${testSpkFileName}`,
      project_manager_id: 2,
      created_by: 9,
      proposal: {
        id: 10,
        tender: { id: 131, marketing_pic_id: 9 },
      } as any,
    };

    it('Assigned PM (project_manager_id = 2) should be ALLOWED to stream SPK', async () => {
      contractRepoMock.findOne.mockResolvedValue(validContractRecord);

      const result = await contractService.streamContractSpk(25, 2, ['PROJECT_MANAGER']);
      activeStreams.push(result.stream);
      expect(result).toBeDefined();
      expect(result.fileName).toBe(testSpkFileName);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('DIRECTOR should be ALLOWED to stream SPK across portfolio', async () => {
      contractRepoMock.findOne.mockResolvedValue(validContractRecord);

      const result = await contractService.streamContractSpk(25, 4, ['DIRECTOR']);
      activeStreams.push(result.stream);
      expect(result).toBeDefined();
      expect(result.mimeType).toBe('application/pdf');
    });

    it('PMO should be ALLOWED to stream SPK', async () => {
      contractRepoMock.findOne.mockResolvedValue(validContractRecord);

      const result = await contractService.streamContractSpk(25, 769, ['PMO']);
      activeStreams.push(result.stream);
      expect(result).toBeDefined();
      expect(result.mimeType).toBe('application/pdf');
    });

    it('HEAD_OF_OPERATIONS & GENERAL_MANAGER should be ALLOWED to stream SPK', async () => {
      contractRepoMock.findOne.mockResolvedValue(validContractRecord);

      const result = await contractService.streamContractSpk(25, 58, ['HEAD_OF_OPERATIONS']);
      activeStreams.push(result.stream);
      expect(result).toBeDefined();
    });

    it('LEGAL should be ALLOWED to stream SPK', async () => {
      contractRepoMock.findOne.mockResolvedValue(validContractRecord);

      const result = await contractService.streamContractSpk(25, 10, ['LEGAL']);
      activeStreams.push(result.stream);
      expect(result).toBeDefined();
    });

    it('Assigned PM through linked project (fallback when contracts.project_manager_id is null) should be ALLOWED', async () => {
      const contractWithoutPm: Partial<Contract> = {
        id: 30,
        contract_number: 'CONT-20261030-0030',
        spk_file_url: `/uploads/contracts/${testSpkFileName}`,
        project_manager_id: null as any,
        created_by: 99,
      };
      contractRepoMock.findOne.mockResolvedValue(contractWithoutPm);
      contractRepoMock.manager.query.mockResolvedValueOnce([{ manager_id: 2 }]);

      const result = await contractService.streamContractSpk(30, 2, ['PROJECT_MANAGER']);
      activeStreams.push(result.stream);
      expect(result).toBeDefined();
      expect(result.fileName).toBe(testSpkFileName);
    });

    it('Unassigned PM (e.g. userId = 879) should be REJECTED with ForbiddenException (403)', async () => {
      contractRepoMock.findOne.mockResolvedValue(validContractRecord);

      await expect(
        contractService.streamContractSpk(25, 879, ['PROJECT_MANAGER']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Arbitrary unauthorized role (e.g. FINANCE, GUEST) should be REJECTED with ForbiddenException (403)', async () => {
      contractRepoMock.findOne.mockResolvedValue(validContractRecord);

      await expect(
        contractService.streamContractSpk(25, 3, ['FINANCE']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Unauthenticated request (missing userId) should be REJECTED with UnauthorizedException (401)', async () => {
      await expect(
        contractService.streamContractSpk(25, null as any, ['PROJECT_MANAGER']),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('3. File Integrity, Missing Records & Path Traversal Security', () => {
    it('should throw NotFoundException (404) if contract does not exist', async () => {
      contractRepoMock.findOne.mockResolvedValue(null);

      await expect(
        contractService.streamContractSpk(99999, 2, ['PROJECT_MANAGER']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException (404) if contract has no spk_file_url', async () => {
      contractRepoMock.findOne.mockResolvedValue({
        id: 35,
        project_manager_id: 2,
        spk_file_url: null,
      });

      await expect(
        contractService.streamContractSpk(35, 2, ['PROJECT_MANAGER']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException (404) if physical file is missing from disk', async () => {
      contractRepoMock.findOne.mockResolvedValue({
        id: 36,
        project_manager_id: 2,
        spk_file_url: '/uploads/contracts/non-existent-spk-file-99999.pdf',
      });

      await expect(
        contractService.streamContractSpk(36, 2, ['PROJECT_MANAGER']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should strictly reject path traversal attempts (../../etc/passwd) with BadRequestException (400)', async () => {
      contractRepoMock.findOne.mockResolvedValue({
        id: 37,
        project_manager_id: 2,
        spk_file_url: '../../etc/passwd',
      });

      await expect(
        contractService.streamContractSpk(37, 2, ['PROJECT_MANAGER']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should strictly reject percent-encoded path traversal (%2e%2e) with BadRequestException (400)', async () => {
      contractRepoMock.findOne.mockResolvedValue({
        id: 38,
        project_manager_id: 2,
        spk_file_url: '%2e%2e/%2e%2e/secret.pdf',
      });

      await expect(
        contractService.streamContractSpk(38, 2, ['PROJECT_MANAGER']),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
