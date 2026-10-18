import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { MarketingService } from './marketing.service';
import { Customer } from '../../entities/customer.entity';
import { Tender, TenderStatus, GoNoGoStatus, TenderStage } from '../../entities/tender.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { TenderActivity } from '../../entities/tender-activity.entity';
import { TenderPriceHistory } from '../../entities/tender-price-history.entity';
import { User } from '../../entities/user.entity';
import { Document } from '../../entities/document.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../entities/workflow-instance.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../entities/workflow-task.entity';

describe('MarketingService - SPK Upload & LEGAL_REVIEW_WORKFLOW Integration Safety (Phase 5)', () => {
  let service: MarketingService;
  let dataSourceMock: any;
  let queryRunnerManagerMock: any;
  let eventEmitterMock: any;
  let workflowEngineMock: any;

  const mockUserId = 9;
  const mockTenderId = 42;
  const mockContractId = 105;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'SPK_Test_2026.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    destination: './uploads',
    filename: 'mock-spk-test-file.pdf',
    path: path.join(__dirname, 'mock-spk-test-file.pdf'),
    buffer: Buffer.from('%PDF-1.4 test'),
    stream: null as any,
  };

  beforeEach(async () => {
    // Create physical dummy file so fs operations succeed
    try {
      fs.writeFileSync(mockFile.path, mockFile.buffer);
    } catch (_) {}

    queryRunnerManagerMock = {
      findOne: jest.fn().mockImplementation((entityClass: any, options: any) => {
        if (entityClass === Proposal) {
          return Promise.resolve({ id: 50, tender_id: mockTenderId });
        }
        if (entityClass === User) {
          return Promise.resolve({ id: mockUserId, fullName: 'Ragil Marketing', roles: [{ name: 'MARKETING' }] });
        }
        return Promise.resolve(null);
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
        getOne: jest.fn().mockResolvedValue(null), // simulate new contract creation
      }),
      query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('SELECT customer_id, estimated_budget')) {
          return [
            {
              customer_id: 1,
              estimated_budget: 500000000,
              go_nogo_status: GoNoGoStatus.GO,
              marketing_pic_id: mockUserId,
              created_by: mockUserId,
              revision_status: null,
            },
          ];
        }
        if (sql.includes('INSERT INTO contracts')) {
          return { insertId: mockContractId };
        }
        return [];
      }),
      create: jest.fn().mockImplementation((entityClass: any, data: any) => ({ ...data, id: mockContractId })),
      save: jest.fn().mockImplementation((entityClass: any, entity: any) => Promise.resolve(entity)),
    };

    dataSourceMock = {
      transaction: jest.fn().mockImplementation(async (cb: (manager: any) => Promise<any>) => {
        return await cb(queryRunnerManagerMock);
      }),
      getRepository: jest.fn().mockImplementation((entityClass: any) => {
        if (entityClass === User) {
          return {
            findOne: jest.fn().mockResolvedValue({
              id: mockUserId,
              fullName: 'Ragil Marketing',
              roles: [{ name: 'MARKETING' }],
            }),
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn().mockResolvedValue({}),
        };
      }),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    workflowEngineMock = {
      getInstanceByEntity: jest.fn().mockResolvedValue(null),
      startInstance: jest.fn().mockImplementation(async (dto: any, actorId: number, manager: any) => {
        return {
          id: 77,
          workflowKey: 'LEGAL_REVIEW_WORKFLOW',
          entityType: 'CONTRACT',
          entityId: dto.entityId,
          status: WorkflowInstanceStatus.IN_PROGRESS,
          tasks: [
            {
              id: 99,
              taskKey: 'LEGAL_REVIEW',
              status: WorkflowTaskStatus.PENDING,
              assigneeRoleId: 8, // LEGAL
            },
          ],
        };
      }),
      completeTask: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingService,
        { provide: getRepositoryToken(Customer), useValue: {} },
        { provide: getRepositoryToken(Tender), useValue: {} },
        { provide: getRepositoryToken(Proposal), useValue: {} },
        { provide: getRepositoryToken(Contract), useValue: {} },
        { provide: getRepositoryToken(TenderActivity), useValue: {} },
        { provide: getRepositoryToken(TenderPriceHistory), useValue: {} },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
        { provide: WorkflowEngineService, useValue: workflowEngineMock },
      ],
    }).compile();

    service = module.get<MarketingService>(MarketingService);
  });

  afterEach(() => {
    if (fs.existsSync(mockFile.path)) {
      try {
        fs.unlinkSync(mockFile.path);
      } catch (_) {}
    }
    jest.clearAllMocks();
  });

  it('1. Successful SPK upload causes Contract creation and initializes LEGAL_REVIEW_WORKFLOW atomically', async () => {
    const result = await service.saveSPKAndUpdateContract(mockTenderId, mockFile, 'http://localhost:4000/uploads/contracts/mock.pdf', mockUserId);

    expect(result.success).toBe(true);
    expect(result.contractId).toBe(mockContractId);

    // Verify WorkflowEngineService.startInstance was called with exact canonical arguments
    expect(workflowEngineMock.startInstance).toHaveBeenCalledTimes(1);
    const startArgs = workflowEngineMock.startInstance.mock.calls[0];

    const dto = startArgs[0];
    const actorId = startArgs[1];
    const passedManager = startArgs[2];

    expect(dto.workflowKey).toBe('LEGAL_REVIEW_WORKFLOW');
    expect(dto.entityType).toBe('CONTRACT');
    expect(dto.entityId).toBe(mockContractId);
    expect(dto.context.contractId).toBe(mockContractId);
    expect(dto.context.tenderId).toBe(mockTenderId);
    expect(actorId).toBe(mockUserId);

    // CRITICAL: Must use the same transaction EntityManager
    expect(passedManager).toBe(queryRunnerManagerMock);
  });

  it('2. Failure Injection: Workflow start failure aborts transaction, cleans file, and prevents orphaned contract', async () => {
    // Simulate failure during workflow initialization
    workflowEngineMock.startInstance.mockRejectedValueOnce(
      new Error('Simulated Workflow Engine Failure - DB deadlock or definition error'),
    );

    // Verify exception is thrown
    await expect(
      service.saveSPKAndUpdateContract(mockTenderId, mockFile, 'http://localhost:4000/uploads/contracts/mock.pdf', mockUserId),
    ).rejects.toThrow('Simulated Workflow Engine Failure');

    // Physical file must be cleaned up on rollback
    expect(fs.existsSync(mockFile.path)).toBe(false);
  });

  it('3. Idempotency: Does not re-initialize duplicate workflow if an active LEGAL_REVIEW task already exists', async () => {
    // Existing active instance with pending LEGAL_REVIEW task
    workflowEngineMock.getInstanceByEntity.mockResolvedValueOnce({
      id: 77,
      workflowKey: 'LEGAL_REVIEW_WORKFLOW',
      status: WorkflowInstanceStatus.IN_PROGRESS,
      tasks: [
        {
          id: 99,
          taskKey: 'LEGAL_REVIEW',
          status: WorkflowTaskStatus.PENDING,
        },
      ],
    });

    await service.saveSPKAndUpdateContract(mockTenderId, mockFile, 'http://localhost:4000/uploads/contracts/mock.pdf', mockUserId);

    // startInstance should NOT be called again
    expect(workflowEngineMock.startInstance).not.toHaveBeenCalled();
  });

  it('4. Revision Re-Upload: Auto-resubmits pending LEGAL_DOCUMENT_REVISION task upon re-upload', async () => {
    // Simulate revision scenario
    queryRunnerManagerMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT customer_id, estimated_budget')) {
        return [
          {
            customer_id: 1,
            estimated_budget: 500000000,
            go_nogo_status: GoNoGoStatus.GO,
            marketing_pic_id: mockUserId,
            created_by: mockUserId,
            revision_status: 'REVISION_REQUESTED', // Trigger isRevisionUpload
          },
        ];
      }
      if (sql.includes('INSERT INTO contracts')) {
        return { insertId: mockContractId };
      }
      return [];
    });

    // Existing active instance with pending revision task
    workflowEngineMock.getInstanceByEntity.mockResolvedValueOnce({
      id: 77,
      workflowKey: 'LEGAL_REVIEW_WORKFLOW',
      status: WorkflowInstanceStatus.IN_PROGRESS,
      tasks: [
        {
          id: 102,
          taskKey: 'LEGAL_DOCUMENT_REVISION',
          nodeId: 'node_marketing_revision',
          status: WorkflowTaskStatus.PENDING,
        },
      ],
    });

    await service.saveSPKAndUpdateContract(mockTenderId, mockFile, 'http://localhost:4000/uploads/contracts/mock.pdf', mockUserId);

    // completeTask should be called to resume the workflow
    expect(workflowEngineMock.completeTask).toHaveBeenCalledWith(
      102,
      {
        action: 'RESUBMIT',
        reason: 'Dokumen revisi SPK berhasil diunggah',
      },
      mockUserId,
      ['MARKETING', 'SUPER_ADMIN'],
      queryRunnerManagerMock,
    );
  });
});
