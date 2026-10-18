import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowVersion } from '../../entities/workflow-version.entity';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../entities/workflow-instance.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { Role } from '../../entities/role.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Tender, TenderStatus, RevisionStatus } from '../../entities/tender.entity';
import { Proposal } from '../../entities/proposal.entity';
import { AuditLog } from '../../entities/audit-log.entity';

describe('WorkflowEngineService - Legal RETURN -> Marketing Revision Regression (Phase 6)', () => {
  let service: WorkflowEngineService;
  let dataSourceMock: any;
  let eventEmitterMock: any;

  // In-memory entities
  let inMemoryContract: Contract;
  let inMemoryTender: Tender;
  let inMemoryInstance: WorkflowInstance;
  let inMemoryTasks: WorkflowTask[];
  let inMemoryTransitions: WorkflowTransition[];
  let inMemoryAuditLogs: AuditLog[];
  let inMemoryOutbox: OutboxEvent[];
  let nextTaskId = 100;

  const mockLegalReviewerId = 10;
  const mockMarketingPicId = 7; // Lukas Kurniawan
  const mockContractId = 4;
  const mockTenderId = 4;
  const mockReturnReason = 'salah upload SPK kamu ya ';

  const legalReviewBpmnJson = {
    nodes: [
      {
        id: 'node_start',
        data: { role: 'MARKETING', type: 'START', label: 'Mulai Legal Review' },
        type: 'customNode',
      },
      {
        id: 'node_legal_review',
        data: { role: 'LEGAL', type: 'TASK', label: 'Review Legal Kontrak', taskKey: 'LEGAL_REVIEW' },
        type: 'customNode',
      },
      {
        id: 'node_marketing_revision',
        data: {
          role: 'MARKETING',
          type: 'TASK',
          label: 'Revisi Dokumen SPK / Kontrak',
          taskKey: 'LEGAL_DOCUMENT_REVISION',
          assigneeContextKey: 'marketing_pic_id',
          assigneeFallbackContextKey: 'created_by',
        },
        type: 'customNode',
      },
      {
        id: 'node_end',
        data: { type: 'END', label: 'Legal Review Selesai' },
        type: 'customNode',
      },
    ],
    edges: [
      { id: 'e_start_to_legal', data: { action: 'SUBMIT' }, label: 'SUBMIT', source: 'node_start', target: 'node_legal_review' },
      { id: 'e_legal_to_end_approve', data: { action: 'APPROVE' }, label: 'APPROVE', source: 'node_legal_review', target: 'node_end' },
      { id: 'e_legal_to_end_reject', data: { action: 'REJECT' }, label: 'REJECT', source: 'node_legal_review', target: 'node_end' },
      { id: 'e_legal_to_marketing_return', data: { action: 'RETURN' }, label: 'RETURN', source: 'node_legal_review', target: 'node_marketing_revision' },
      { id: 'e_marketing_to_legal_resubmit', data: { action: 'RESUBMIT' }, label: 'RESUBMIT', source: 'node_marketing_revision', target: 'node_legal_review' },
    ],
  };

  const mockVersion = {
    id: 35,
    version: 1,
    bpmnJson: legalReviewBpmnJson,
    status: 'PUBLISHED',
  } as WorkflowVersion;

  beforeEach(async () => {
    nextTaskId = 100;
    inMemoryTasks = [];
    inMemoryTransitions = [];
    inMemoryAuditLogs = [];
    inMemoryOutbox = [];

    inMemoryContract = {
      id: mockContractId,
      contract_number: 'CONT-20261014-0004',
      tender_id: mockTenderId,
      status: 'PENDING_LEGAL_REVIEW',
      legal_status: LegalStatus.DRAFT,
      legal_notes: null as any,
      legal_reviewer_id: null as any,
      grace_deadline: null as any,
      grace_extension_count: 0,
      created_by: mockMarketingPicId,
      updated_by: null as any,
    } as Contract;

    inMemoryTender = {
      id: mockTenderId,
      title: 'Pengadaan Network Hardware J&T Express',
      marketing_pic_id: mockMarketingPicId,
      created_by: mockMarketingPicId,
      stage: 'WON',
      status: TenderStatus.WON,
      revision_status: RevisionStatus.NOT_REQUIRED,
      spk_verification_status: 'PENDING_REVIEW',
    } as Tender;

    inMemoryInstance = {
      id: 17,
      workflowDefinitionId: 1,
      workflowVersionId: 35,
      workflowVersion: mockVersion,
      entityType: 'CONTRACT',
      entityId: String(mockContractId),
      currentNodeId: 'node_legal_review',
      status: WorkflowInstanceStatus.IN_PROGRESS,
      context: {
        contractId: mockContractId,
        tenderId: mockTenderId,
        marketing_pic_id: mockMarketingPicId,
        created_by: mockMarketingPicId,
      },
    } as any;

    const initialTask = {
      id: 27,
      workflowInstanceId: 17,
      workflowInstance: inMemoryInstance,
      nodeId: 'node_legal_review',
      taskKey: 'LEGAL_REVIEW',
      assigneeRoleId: 2,
      assigneeRole: { id: 2, name: 'LEGAL' },
      assigneeUserId: null,
      status: WorkflowTaskStatus.PENDING,
      action: null,
    } as any;

    inMemoryTasks.push(initialTask);

    const managerMock = {
      createQueryBuilder: jest.fn().mockImplementation((entityClass: any) => {
        return {
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockImplementation((clause: string, params: any) => {
            return {
              getOne: jest.fn().mockImplementation(async () => {
                if (params.taskId) {
                  const found = inMemoryTasks.find((t) => t.id === Number(params.taskId));
                  if (found) {
                    found.workflowInstance = inMemoryInstance;
                    return found;
                  }
                  return null;
                }
                return null;
              }),
            };
          }),
        };
      }),
      findOne: jest.fn().mockImplementation(async (entityClass: any, options: any) => {
        if (entityClass === Contract) {
          return inMemoryContract.id === options?.where?.id ? inMemoryContract : null;
        }
        if (entityClass === Tender) {
          return inMemoryTender.id === options?.where?.id ? inMemoryTender : null;
        }
        if (entityClass === WorkflowVersion) {
          return mockVersion;
        }
        if (entityClass === Role) {
          if (options?.where?.name === 'LEGAL') return { id: 2, name: 'LEGAL' };
          return { id: 7, name: 'MARKETING' };
        }
        return null;
      }),
      save: jest.fn().mockImplementation(async (entityOrClass: any, entity?: any) => {
        const target = entity || entityOrClass;
        if (target instanceof Contract || target.legal_status !== undefined) {
          Object.assign(inMemoryContract, target);
          return inMemoryContract;
        }
        if (target instanceof Tender || target.revision_status !== undefined) {
          Object.assign(inMemoryTender, target);
          return inMemoryTender;
        }
        if (target instanceof WorkflowInstance || target.currentNodeId !== undefined) {
          Object.assign(inMemoryInstance, target);
          return inMemoryInstance;
        }
        if (target instanceof WorkflowTask || target.taskKey !== undefined) {
          const idx = inMemoryTasks.findIndex((t) => t.id === target.id);
          if (idx >= 0) {
            inMemoryTasks[idx] = target;
          } else {
            inMemoryTasks.push(target);
          }
          return target;
        }
        if (target instanceof AuditLog || target.table_name !== undefined) {
          inMemoryAuditLogs.push(target);
          return target;
        }
        if (target instanceof OutboxEvent || target.event_name !== undefined) {
          inMemoryOutbox.push(target);
          return target;
        }
        return target;
      }),
      create: jest.fn().mockImplementation((entityClass: any, data: any) => {
        if (entityClass === WorkflowTask) {
          return { ...data, id: ++nextTaskId };
        }
        return { ...data };
      }),
    };

    dataSourceMock = {
      transaction: jest.fn().mockImplementation(async (cb: (m: any) => Promise<any>) => cb(managerMock)),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: getRepositoryToken(WorkflowDefinition), useValue: {} },
        { provide: getRepositoryToken(WorkflowVersion), useValue: { findOne: jest.fn().mockResolvedValue(mockVersion) } },
        { provide: getRepositoryToken(WorkflowInstance), useValue: {} },
        { provide: getRepositoryToken(WorkflowTask), useValue: {} },
        { provide: getRepositoryToken(WorkflowTransition), useValue: {} },
        { provide: getRepositoryToken(Role), useValue: { findOne: jest.fn().mockResolvedValue({ id: 7, name: 'MARKETING' }) } },
        { provide: getRepositoryToken(OutboxEvent), useValue: {} },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
  });

  it('1-7. Legal RETURN transitions workflow node, creates revision task assigned to Tender PIC, syncs Contract & Tender, and satisfies Marketing UI predicate', async () => {
    // Execute Legal RETURN on Task 27
    const result = await service.completeTask(
      27,
      {
        action: 'RETURN',
        reason: mockReturnReason,
      },
      mockLegalReviewerId,
      ['LEGAL'],
    );

    // 1. Legal RETURN changes Workflow node
    expect(result.instance.currentNodeId).toBe('node_marketing_revision');
    expect(inMemoryInstance.currentNodeId).toBe('node_marketing_revision');

    // 2. LEGAL_DOCUMENT_REVISION task is created
    const pendingRevisionTask = inMemoryTasks.find(
      (t) => t.taskKey === 'LEGAL_DOCUMENT_REVISION' && t.status === WorkflowTaskStatus.PENDING,
    );
    expect(pendingRevisionTask).toBeDefined();
    expect(pendingRevisionTask?.nodeId).toBe('node_marketing_revision');

    // 3. Task assigned to actual Tender marketing PIC (User ID 7 - Lukas)
    expect(pendingRevisionTask?.assigneeUserId).toBe(mockMarketingPicId);
    expect(pendingRevisionTask?.assigneeUserId).not.toBe(9); // Not wrong user 9!

    // 4. Contract legal_status becomes REVISION_REQUESTED and status becomes REVISION_NEEDED
    expect(inMemoryContract.legal_status).toBe(LegalStatus.REVISION_REQUESTED);
    expect(inMemoryContract.status).toBe('REVISION_NEEDED');

    // 5. Legal return notes persist
    expect(inMemoryContract.legal_notes).toBe(mockReturnReason);
    expect(inMemoryContract.legal_reviewer_id).toBe(mockLegalReviewerId);

    // 6. Tender revision state is synchronized
    expect(inMemoryTender.revision_status).toBe(RevisionStatus.REQUIRED);

    // 7. Marketing revision UI predicate becomes true
    // Predicate from KanbanBoard.tsx lines 1788-1819:
    const isRevisionUiRendered =
      inMemoryContract.status !== 'PM_RETURNED' &&
      inMemoryContract.legal_status === 'REVISION_REQUESTED';
    expect(isRevisionUiRendered).toBe(true);

    // Verify Outbox Event created for Legal Revision
    const revisionOutbox = inMemoryOutbox.find((e) => e.event_name === 'legal.contract.revision_requested');
    expect(revisionOutbox).toBeDefined();
    expect(revisionOutbox?.payload?.businessPayload?.marketingPicId).toBe(mockMarketingPicId);
  });

  it('8. Repeated transition does not create duplicate task (Idempotency protection)', async () => {
    // Perform first RETURN
    await service.completeTask(
      27,
      { action: 'RETURN', reason: mockReturnReason },
      mockLegalReviewerId,
      ['LEGAL'],
    );

    const initialTaskCount = inMemoryTasks.length;

    // Attempt repeated completeTask on already returned Task 27
    await expect(
      service.completeTask(
        27,
        { action: 'RETURN', reason: 'Repeated attempt' },
        mockLegalReviewerId,
        ['LEGAL'],
      ),
    ).rejects.toThrow(ConflictException);

    // Task count remains unchanged; no duplicate task created
    expect(inMemoryTasks.length).toBe(initialTaskCount);
  });

  it('9-10. RESUBMIT returns workflow to LEGAL_REVIEW and creates new LEGAL_REVIEW task', async () => {
    // 1. Transition to revision first
    await service.completeTask(
      27,
      { action: 'RETURN', reason: mockReturnReason },
      mockLegalReviewerId,
      ['LEGAL'],
    );

    const revisionTask = inMemoryTasks.find(
      (t) => t.taskKey === 'LEGAL_DOCUMENT_REVISION' && t.status === WorkflowTaskStatus.PENDING,
    )!;
    expect(revisionTask).toBeDefined();

    // 2. Marketing user resubmits revised SPK
    const resubmitResult = await service.completeTask(
      revisionTask.id,
      {
        action: 'RESUBMIT',
        reason: 'Dokumen revisi SPK berhasil diunggah',
      },
      mockMarketingPicId,
      ['MARKETING'],
    );

    // 9. RESUBMIT returns workflow to node_legal_review
    expect(resubmitResult.instance.currentNodeId).toBe('node_legal_review');
    expect(inMemoryContract.status).toBe('PENDING_LEGAL_REVIEW');
    expect(inMemoryContract.legal_status).toBe(LegalStatus.DRAFT);
    expect(inMemoryTender.revision_status).toBe(RevisionStatus.NOT_REQUIRED);

    // 10. New LEGAL_REVIEW task is created correctly after RESUBMIT
    const newLegalTask = inMemoryTasks.find(
      (t) => t.id !== 27 && t.taskKey === 'LEGAL_REVIEW' && t.status === WorkflowTaskStatus.PENDING,
    );
    expect(newLegalTask).toBeDefined();
    expect(newLegalTask?.nodeId).toBe('node_legal_review');
  });
});
