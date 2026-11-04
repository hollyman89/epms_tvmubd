import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, OptimisticLockVersionMismatchError } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { MarketingService } from '../marketing.service';
import { Customer } from '../../../entities/customer.entity';
import { Tender, TenderStatus, TenderStage, GoNoGoStatus, RevisionStatus } from '../../../entities/tender.entity';
import { Proposal } from '../../../entities/proposal.entity';
import { Contract, LegalStatus } from '../../../entities/contract.entity';
import { TenderActivity } from '../../../entities/tender-activity.entity';
import { TenderPriceHistory } from '../../../entities/tender-price-history.entity';
import { User } from '../../../entities/user.entity';
import { Document } from '../../../entities/document.entity';
import { AuditLog } from '../../../entities/audit-log.entity';
import { OutboxEvent, OutboxStatus } from '../../../entities/outbox-event.entity';

describe('Phase 1.7-R3: SPK Upload Identity & Go/No-Go AuditLog Targeted Verification', () => {
  let service: MarketingService;
  let eventEmitterMock: any;
  let queryRunnerMock: any;
  let dataSourceMock: any;

  // In-memory data store for transactional mocks
  let inMemoryTender: Tender;
  let inMemoryContract: Contract;
  let inMemoryAuditLogs: AuditLog[];
  let inMemoryOutboxEvents: OutboxEvent[];
  let inMemoryDocuments: Document[];

  beforeEach(async () => {
    inMemoryAuditLogs = [];
    inMemoryOutboxEvents = [];
    inMemoryDocuments = [];

    inMemoryTender = {
      id: 501,
      version: 1,
      title: 'Tender Pengadaan Tower Transmisi',
      customer_id: 10,
      stage: TenderStage.LEAD,
      status: TenderStatus.NEW,
      go_nogo_status: GoNoGoStatus.PENDING,
      revision_status: RevisionStatus.NOT_REQUIRED,
      estimated_budget: 1500000000,
      negotiated_price: 1500000000,
      marketing_pic_id: 25,
      created_by: 25,
      updated_by: 25,
      customer: { id: 10, name: 'PT Telco Mandiri' } as Customer,
    } as any;

    inMemoryContract = {
      id: 701,
      version: 1,
      tender_id: 501,
      proposal_id: 301,
      customer_id: 10,
      contract_number: 'CONT-2026-0701',
      contract_value: 1500000000,
      status: 'PENDING_LEGAL_REVIEW',
      legal_status: LegalStatus.DRAFT,
      grace_extension_count: 0,
      spk_file_url: '/uploads/contracts/spk-initial.pdf',
    } as any;

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const mockManager: any = {
      findOne: jest.fn().mockImplementation(async (entity: any, options: any) => {
        if (entity === Tender) return inMemoryTender;
        if (entity === Contract) return inMemoryContract;
        if (entity === User) return { id: 25, fullName: 'Marketing User', roles: [{ name: 'MARKETING' }] };
        if (entity === AuditLog) {
          const act = options?.where?.action;
          const matches = inMemoryAuditLogs.filter((l) => !act || l.action === act);
          return matches.length > 0 ? matches[matches.length - 1] : null;
        }
        return null;
      }),
      find: jest.fn().mockImplementation(async (entity: any) => {
        if (entity === AuditLog) return inMemoryAuditLogs;
        if (entity === OutboxEvent) return inMemoryOutboxEvents;
        return [];
      }),
      count: jest.fn().mockImplementation(async (entity: any, options: any) => {
        if (entity === AuditLog) {
          const act = options?.where?.action;
          return inMemoryAuditLogs.filter((l) => !act || l.action === act).length;
        }
        if (entity === Document) {
          return inMemoryDocuments.length;
        }
        return 0;
      }),
      save: jest.fn().mockImplementation(async (entityOrClass: any, entity?: any) => {
        const target = entity || entityOrClass;
        if (target.table_name && target.action) {
          target.id = inMemoryAuditLogs.length + 1;
          inMemoryAuditLogs.push(target);
          return target;
        }
        if (target.event_name) {
          target.id = inMemoryOutboxEvents.length + 1;
          inMemoryOutboxEvents.push(target);
          return target;
        }
        if (target.entityType) {
          target.id = inMemoryDocuments.length + 1;
          inMemoryDocuments.push(target);
          return target;
        }
        if (target instanceof Tender || target.stage !== undefined) {
          Object.assign(inMemoryTender, target);
          return inMemoryTender;
        }
        if (target.contract_number !== undefined) {
          Object.assign(inMemoryContract, target);
          return inMemoryContract;
        }
        return target;
      }),
      create: jest.fn().mockImplementation((entity: any, data: any) => ({ ...data })),
      query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('SELECT customer_id')) {
          return [{
            customer_id: inMemoryTender.customer_id,
            estimated_budget: inMemoryTender.estimated_budget,
            go_nogo_status: inMemoryTender.go_nogo_status,
            marketing_pic_id: inMemoryTender.marketing_pic_id,
            created_by: inMemoryTender.created_by,
            revision_status: inMemoryTender.revision_status,
          }];
        }
        if (sql.includes('UPDATE contracts')) {
          inMemoryContract.spk_file_url = params[0];
          inMemoryContract.status = 'PENDING_LEGAL_REVIEW';
          inMemoryContract.legal_status = LegalStatus.DRAFT;
          return { affectedRows: 1 };
        }
        return [];
      }),
      createQueryBuilder: jest.fn().mockImplementation((entityClass: any, alias: string) => {
        return {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockImplementation((setData: any) => {
            Object.assign(inMemoryTender, setData);
            return {
              where: jest.fn().mockReturnThis(),
              execute: jest.fn().mockResolvedValue({ affected: 1 }),
            };
          }),
          getOne: jest.fn().mockImplementation(async () => inMemoryContract),
          getCount: jest.fn().mockImplementation(async () => {
            return inMemoryAuditLogs.filter((l) => l.action === 'REVISED_SPK_UPLOADED').length;
          }),
        };
      }),
    };

    queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
      manager: mockManager,
    };

    dataSourceMock = {
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity === User) {
          return {
            findOne: jest.fn().mockResolvedValue({ id: 25, fullName: 'Marketing User', roles: [{ name: 'MARKETING' }] }),
          };
        }
        if (entity === Tender) {
          return {
            findOne: jest.fn().mockResolvedValue(inMemoryTender),
          };
        }
        return { findOne: jest.fn(), save: jest.fn() };
      }),
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
      transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
        { provide: getRepositoryToken(Tender), useValue: {} },
        { provide: getRepositoryToken(Customer), useValue: {} },
        { provide: getRepositoryToken(Proposal), useValue: {} },
        { provide: getRepositoryToken(Contract), useValue: {} },
        { provide: getRepositoryToken(TenderActivity), useValue: {} },
        { provide: getRepositoryToken(TenderPriceHistory), useValue: {} },
      ],
    }).compile();

    service = module.get<MarketingService>(MarketingService);
  });

  // =========================================================================
  // 1. GAP-01: SPK UPLOAD REVISION COUNTER & UPLOAD IDENTITY TESTS
  // =========================================================================
  describe('1. GAP-01: SPK Upload Identity & Revision Counter Preservation', () => {
    it('Initial upload generates deterministic spk-up-{contractId} event ID and preserves grace_extension_count', async () => {
      inMemoryTender.stage = TenderStage.WON;
      inMemoryTender.status = TenderStatus.WON;
      inMemoryTender.go_nogo_status = GoNoGoStatus.GO;
      inMemoryContract.grace_extension_count = 0;

      const dummyFile: any = {
        filename: 'spk-v1.pdf',
        originalname: 'spk-v1.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      };

      const result = await service.saveSPKAndUpdateContract(501, dummyFile, '/uploads/contracts/spk-v1.pdf', 25);
      expect(result.success).toBe(true);

      const spkOutbox = inMemoryOutboxEvents.find((e) => e.event_name === 'marketing.spk.uploaded');
      expect(spkOutbox).toBeDefined();
      expect(spkOutbox.event_id).toBe('spk-up-701');
      expect(inMemoryContract.grace_extension_count).toBe(0);
    });

    it('Multiple uploads in initial cycle generate distinct upload sequence -u2 without collision', async () => {
      inMemoryTender.stage = TenderStage.WON;
      inMemoryTender.status = TenderStatus.WON;
      inMemoryTender.go_nogo_status = GoNoGoStatus.GO;

      // Seed 1st upload audit log
      inMemoryAuditLogs.push({
        id: 1,
        table_name: 'contracts',
        record_id: 701,
        action: 'SPK_UPLOADED',
      } as any);

      const dummyFile2: any = {
        filename: 'spk-v2-corrected.pdf',
        originalname: 'spk-v2-corrected.pdf',
        mimetype: 'application/pdf',
        size: 2048,
      };

      const result = await service.saveSPKAndUpdateContract(501, dummyFile2, '/uploads/contracts/spk-v2-corrected.pdf', 25);
      expect(result.success).toBe(true);

      const spkOutbox = inMemoryOutboxEvents.find((e) => e.event_name === 'marketing.spk.uploaded');
      expect(spkOutbox).toBeDefined();
      expect(spkOutbox.event_id).toBe('spk-up-701-u2');
    });

    it('Upload in Revision Cycle 1 uses spk-up-{contractId}-rev-1 without resetting grace count', async () => {
      inMemoryTender.stage = TenderStage.WON;
      inMemoryTender.status = TenderStatus.WON;
      inMemoryTender.go_nogo_status = GoNoGoStatus.GO;
      inMemoryTender.revision_status = RevisionStatus.REQUIRED;

      inMemoryContract.status = 'REVISION_NEEDED';
      inMemoryContract.legal_status = LegalStatus.REVISION_REQUESTED;
      inMemoryContract.grace_extension_count = 1;

      // Legal requested revision log
      inMemoryAuditLogs.push({
        id: 1,
        table_name: 'contracts',
        record_id: 701,
        action: 'LEGAL_REVIEW_REVISION_REQUESTED',
      } as any);

      const revFile1: any = {
        filename: 'spk-rev1.pdf',
        originalname: 'spk-rev1.pdf',
        mimetype: 'application/pdf',
        size: 3072,
      };

      const result = await service.saveSPKAndUpdateContract(501, revFile1, '/uploads/contracts/spk-rev1.pdf', 25);
      expect(result.success).toBe(true);

      const spkOutbox = inMemoryOutboxEvents.find((e) => e.event_name === 'marketing.spk.uploaded');
      expect(spkOutbox).toBeDefined();
      expect(spkOutbox.event_id).toBe('spk-up-701-rev-1');
      // Verify grace_extension_count was preserved (NOT reset to 0)
      expect(inMemoryContract.grace_extension_count).toBe(1);
    });

    it('Second upload in Revision Cycle 1 generates spk-up-{contractId}-rev-1-u2 avoiding collision', async () => {
      inMemoryTender.stage = TenderStage.WON;
      inMemoryTender.status = TenderStatus.WON;
      inMemoryTender.go_nogo_status = GoNoGoStatus.GO;
      inMemoryTender.revision_status = RevisionStatus.REQUIRED;

      inMemoryContract.status = 'REVISION_NEEDED';
      inMemoryContract.legal_status = LegalStatus.REVISION_REQUESTED;
      inMemoryContract.grace_extension_count = 1;

      // Legal requested revision log and 1st revised upload log
      inMemoryAuditLogs.push({
        id: 1,
        table_name: 'contracts',
        record_id: 701,
        action: 'LEGAL_REVIEW_REVISION_REQUESTED',
      } as any);
      inMemoryAuditLogs.push({
        id: 2,
        table_name: 'contracts',
        record_id: 701,
        action: 'REVISED_SPK_UPLOADED',
      } as any);

      const revFile2: any = {
        filename: 'spk-rev1-updated.pdf',
        originalname: 'spk-rev1-updated.pdf',
        mimetype: 'application/pdf',
        size: 4096,
      };

      const result = await service.saveSPKAndUpdateContract(501, revFile2, '/uploads/contracts/spk-rev1-updated.pdf', 25);
      expect(result.success).toBe(true);

      const spkOutbox = inMemoryOutboxEvents.find((e) => e.event_name === 'marketing.spk.uploaded');
      expect(spkOutbox).toBeDefined();
      expect(spkOutbox.event_id).toBe('spk-up-701-rev-1-u2');
    });

    it('Idempotent retry of identical upload returns success early with zero duplicate outbox events', async () => {
      inMemoryTender.stage = TenderStage.WON;
      inMemoryTender.status = TenderStatus.WON;
      inMemoryTender.go_nogo_status = GoNoGoStatus.GO;
      inMemoryContract.status = 'PENDING_LEGAL_REVIEW';
      inMemoryContract.spk_file_url = '/uploads/contracts/spk-initial.pdf';

      const dummyFile: any = {
        filename: 'spk-initial.pdf',
        originalname: 'spk-initial.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      };

      const result = await service.saveSPKAndUpdateContract(501, dummyFile, '/uploads/contracts/spk-initial.pdf', 25);
      expect(result.success).toBe(true);
      expect(result.message).toContain('idempotent retry');
      // No new outbox event generated on retry
      expect(inMemoryOutboxEvents).toHaveLength(0);
    });
  });

  // =========================================================================
  // 2. GAP-02: GO/NO-GO AUDITLOG & MULTI-CYCLE RESUBMISSION TESTS
  // =========================================================================
  describe('2. GAP-02: Go/No-Go Decision AuditLog Persistence & Cycle Identity', () => {
    it('Director NO_GO decision creates persistent AuditLog with GO_NOGO_REJECTED action', async () => {
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;

      const dto = { decision: 'NO_GO' as const, notes: 'Budget feasibility insufficient' };
      const res = await service.submitGoNoGo(501, dto, 5, ['DIRECTOR']);
      expect(res.status).toBe('success');
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

      // Verify AuditLog persistence
      const rejectionLog = inMemoryAuditLogs.find((l) => l.action === 'GO_NOGO_REJECTED');
      expect(rejectionLog).toBeDefined();
      expect(rejectionLog.table_name).toBe('tenders');
      expect(rejectionLog.record_id).toBe(501);
      expect(rejectionLog.created_by).toBe(5);
      expect(rejectionLog.new_value.decision).toBe('NO_GO');
    });

    it('Initial submit, 1st NO_GO, 1st Resubmit, 2nd NO_GO, 2nd Resubmit generate distinct deterministic Event IDs', async () => {
      // 1. Initial Submission
      inMemoryTender.stage = TenderStage.LEAD;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;
      inMemoryTender.revision_status = RevisionStatus.NOT_REQUIRED;

      await service.submitGoNoGoReview(501, 25, ['MARKETING']);
      expect(inMemoryOutboxEvents[0].event_id).toBe('tnd-gng-sub-501');

      // 2. First NO_GO Decision by Director
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;
      await service.submitGoNoGo(501, { decision: 'NO_GO', notes: 'Concern 1' }, 5, ['DIRECTOR']);
      expect(inMemoryAuditLogs.filter((l) => l.action === 'GO_NOGO_REJECTED')).toHaveLength(1);

      // 3. First Resubmission (after revision)
      inMemoryTender.stage = TenderStage.LEAD;
      inMemoryTender.go_nogo_status = GoNoGoStatus.NO_GO;
      inMemoryTender.revision_status = RevisionStatus.NOT_REQUIRED; // revised by marketing
      await service.submitGoNoGoReview(501, 25, ['MARKETING']);
      expect(inMemoryOutboxEvents[1].event_id).toBe('tnd-gng-sub-501-resub-1');

      // 4. Second NO_GO Decision by Director
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;
      await service.submitGoNoGo(501, { decision: 'NO_GO', notes: 'Concern 2' }, 5, ['DIRECTOR']);
      expect(inMemoryAuditLogs.filter((l) => l.action === 'GO_NOGO_REJECTED')).toHaveLength(2);

      // 5. Second Resubmission (after second revision)
      inMemoryTender.stage = TenderStage.LEAD;
      inMemoryTender.go_nogo_status = GoNoGoStatus.NO_GO;
      inMemoryTender.revision_status = RevisionStatus.NOT_REQUIRED;
      await service.submitGoNoGoReview(501, 25, ['MARKETING']);
      expect(inMemoryOutboxEvents[2].event_id).toBe('tnd-gng-sub-501-resub-2');

      // Verify 3 distinct Outbox events for the 3 distinct submission transitions
      expect(inMemoryOutboxEvents).toHaveLength(3);
      expect(inMemoryOutboxEvents[0].event_id).toBe('tnd-gng-sub-501');
      expect(inMemoryOutboxEvents[1].event_id).toBe('tnd-gng-sub-501-resub-1');
      expect(inMemoryOutboxEvents[2].event_id).toBe('tnd-gng-sub-501-resub-2');
    });

    it('Director NO_GO retry is idempotent and does not create duplicate AuditLog entries', async () => {
      inMemoryTender.stage = TenderStage.LEAD;
      inMemoryTender.go_nogo_status = GoNoGoStatus.NO_GO;
      inMemoryTender.revision_status = RevisionStatus.REQUIRED;

      // Seed already committed rejection log
      inMemoryAuditLogs.push({
        id: 1,
        table_name: 'tenders',
        record_id: 501,
        action: 'GO_NOGO_REJECTED',
      } as any);

      // Director retries NO_GO call (e.g. after network glitch)
      const res = await service.submitGoNoGo(501, { decision: 'NO_GO', notes: 'Same note' }, 5, ['DIRECTOR']);
      expect(res.status).toBe('success');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();

      // AuditLog count remains exactly 1 (no duplicate audit log on retry)
      expect(inMemoryAuditLogs.filter((l) => l.action === 'GO_NOGO_REJECTED')).toHaveLength(1);
    });

    it('Marketing resubmit retry is idempotent and does not emit duplicate Outbox events', async () => {
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;

      const res = await service.submitGoNoGoReview(501, 25, ['MARKETING']);
      expect(res.status).toBe('success');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();

      // No new outbox event created on resubmit retry
      expect(inMemoryOutboxEvents).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. CONCURRENCY & TRANSACTION ATOMICITY TESTS
  // =========================================================================
  describe('3. Concurrency Safety & Transaction Rollback Atomicity', () => {
    it('Concurrent NO_GO decision fails with OptimisticLockVersionMismatchError on version conflict', async () => {
      inMemoryTender.stage = TenderStage.WAITING_GO_NO_GO;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;

      // Simulate optimistic lock conflict in TypeORM
      queryRunnerMock.manager.save.mockImplementationOnce(async (entityOrClass: any, entity?: any) => {
        const target = entity || entityOrClass;
        if (target instanceof Tender || target.stage !== undefined) {
          throw new OptimisticLockVersionMismatchError('Tender', 1, 2);
        }
        return target;
      });

      await expect(
        service.submitGoNoGo(501, { decision: 'NO_GO', notes: 'Conflict' }, 5, ['DIRECTOR'])
      ).rejects.toThrow(OptimisticLockVersionMismatchError);

      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(inMemoryAuditLogs).toHaveLength(0);
    });

    it('Transaction failure during Outbox save rolls back Tender and AuditLog mutations atomically', async () => {
      inMemoryTender.stage = TenderStage.LEAD;
      inMemoryTender.go_nogo_status = GoNoGoStatus.PENDING;

      // Simulate database failure during OutboxEvent save
      queryRunnerMock.manager.save.mockImplementation(async (entityOrClass: any, entity?: any) => {
        const target = entity || entityOrClass;
        if (target.event_name) {
          throw new Error('Deadlock on outbox_events table');
        }
        return target;
      });

      await expect(service.submitGoNoGoReview(501, 25, ['MARKETING'])).rejects.toThrow('Deadlock on outbox_events table');
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
    });
  });
});

