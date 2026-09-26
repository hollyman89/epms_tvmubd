import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LegalService } from './legal.service';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Tender, TenderStatus } from '../../entities/tender.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';

describe('Phase N4: Legal Canonical Transactional Outbox Tests', () => {
  let service: LegalService;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let queryRunnerMock: any;
  let dataSourceMock: any;
  let savedEntities: Array<{ entityClass: any; entity: any }>;

  beforeEach(async () => {
    savedEntities = [];

    queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        getRepository: jest.fn().mockImplementation(() => ({
          findOne: jest.fn(),
          save: jest.fn(),
        })),
        findOne: jest.fn(),
        save: jest.fn().mockImplementation(async (clsOrEntity: any, entity?: any) => {
          const actualEntity = entity !== undefined ? entity : clsOrEntity;
          const actualClass = entity !== undefined ? clsOrEntity : clsOrEntity.constructor;
          savedEntities.push({ entityClass: actualClass, entity: actualEntity });
          return actualEntity;
        }),
        create: jest.fn().mockImplementation((entityClass, data) => ({
          ...data,
          _class: entityClass,
        })),
      },
    };

    const mockContract = {
      id: 101,
      contract_number: 'CONT-2026-001',
      proposal_id: 201,
      tender_id: 301,
      customer_id: 401,
      contract_value: 150000000,
      legal_status: LegalStatus.DRAFT,
      status: 'PENDING_LEGAL_REVIEW',
      spk_file_url: 'https://bucket.s3.amazonaws.com/spk/valid.pdf',
      proposal: {
        id: 201,
        tender_id: 301,
        status: 'SUBMITTED',
        created_by: 2,
        tender: {
          id: 301,
          title: 'Pengadaan Server DC 2026',
          stage: 'WON',
          status: TenderStatus.WON,
          spk_verification_status: 'PENDING',
          created_by: 3,
          marketing_pic_id: 25,
        } as any,
      } as any,
    } as any;

    dataSourceMock = {
      getRepository: jest.fn().mockImplementation(() => ({
        findOne: jest.fn().mockResolvedValue(mockContract.proposal.tender),
      })),
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    eventEmitter = {
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalService,
        {
          provide: getRepositoryToken(Contract),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockContract),
          },
        },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<LegalService>(LegalService);
  });

  it('1. Legal APPROVE writes canonical OutboxEvent for legal.contract.approved in same transaction', async () => {
    const result = await service.reviewContract(
      { contractId: 101, legalStatus: LegalStatus.APPROVED, legalNotes: 'Dokumen lengkap dan sah' },
      99,
    );

    expect(result.legal_status).toBe(LegalStatus.APPROVED);
    expect(result.status).toBe('ACTIVE');
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

    // Verify OutboxEvent was saved in same transaction
    const outboxSaves = savedEntities.filter(
      (s) => s.entityClass === OutboxEvent || s.entity?.event_name,
    );
    expect(outboxSaves.length).toBeGreaterThanOrEqual(1);

    const approvedOutbox = outboxSaves.find(
      (s) => s.entity?.event_name === 'legal.contract.approved',
    );
    expect(approvedOutbox).toBeDefined();
    expect(approvedOutbox!.entity.event_name).toBe('legal.contract.approved');
    expect(approvedOutbox!.entity.aggregate_type).toBe('Contract');
    expect(approvedOutbox!.entity.aggregate_id).toBe(101);
    expect(approvedOutbox!.entity.status).toBe(OutboxStatus.PENDING);
    expect(approvedOutbox!.entity.event_id).toBeDefined();
    expect(typeof approvedOutbox!.entity.event_id).toBe('string');

    // Routing contains PMO role and Marketing PIC
    expect(approvedOutbox!.entity.payload.routing.roles).toContain('PMO');
    expect(approvedOutbox!.entity.payload.routing.userIds).toContain(25);

    // PascalCase obsolete event must NOT exist
    const pascalOutbox = outboxSaves.find(
      (s) => s.entity?.event_name === 'ContractApprovedEvent',
    );
    expect(pascalOutbox).toBeUndefined();

    // Direct in-memory emit of canonical event must NOT occur (0 non-outbox producers)
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('legal.contract.approved', expect.anything());
  });

  it('2. Legal REVISION_REQUESTED writes canonical OutboxEvent for legal.contract.revision_requested in same transaction', async () => {
    const result = await service.reviewContract(
      { contractId: 101, legalStatus: LegalStatus.REVISION_REQUESTED, legalNotes: 'Klausul garansi SLA tidak ada' },
      99,
    );

    expect(result.legal_status).toBe(LegalStatus.REVISION_REQUESTED);
    expect(result.status).toBe('REVISION_NEEDED');
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

    const outboxSaves = savedEntities.filter(
      (s) => s.entityClass === OutboxEvent || s.entity?.event_name,
    );
    const revisionOutbox = outboxSaves.find(
      (s) => s.entity?.event_name === 'legal.contract.revision_requested',
    );
    expect(revisionOutbox).toBeDefined();
    expect(revisionOutbox!.entity.event_name).toBe('legal.contract.revision_requested');
    expect(revisionOutbox!.entity.aggregate_type).toBe('Contract');
    expect(revisionOutbox!.entity.aggregate_id).toBe(101);
    expect(revisionOutbox!.entity.event_id).toBeDefined();
    expect(revisionOutbox!.entity.payload.routing.userIds).toContain(25);
    expect(revisionOutbox!.entity.payload.businessPayload.reason).toBe('Klausul garansi SLA tidak ada');

    // PascalCase obsolete event must NOT exist
    const pascalOutbox = outboxSaves.find(
      (s) => s.entity?.event_name === 'ContractRevisionRequestedEvent',
    );
    expect(pascalOutbox).toBeUndefined();

    // Direct in-memory emit must NOT occur
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('contract.revision_requested', expect.anything());
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('legal.contract.revision_requested', expect.anything());
  });

  it('3. Legal REJECTED writes canonical OutboxEvent for legal.contract.rejected in same transaction', async () => {
    const result = await service.reviewContract(
      { contractId: 101, legalStatus: LegalStatus.REJECTED, legalNotes: 'Tender melanggar regulasi' },
      99,
    );

    expect(result.legal_status).toBe(LegalStatus.REJECTED);
    expect(result.status).toBe('REJECTED');
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

    const outboxSaves = savedEntities.filter(
      (s) => s.entityClass === OutboxEvent || s.entity?.event_name,
    );
    const rejectedOutbox = outboxSaves.find(
      (s) => s.entity?.event_name === 'legal.contract.rejected',
    );
    expect(rejectedOutbox).toBeDefined();
    expect(rejectedOutbox!.entity.event_name).toBe('legal.contract.rejected');
    expect(rejectedOutbox!.entity.event_id).toBeDefined();

    // PascalCase obsolete event must NOT exist
    const pascalOutbox = outboxSaves.find(
      (s) => s.entity?.event_name === 'ContractRejectedEvent',
    );
    expect(pascalOutbox).toBeUndefined();
  });
});
