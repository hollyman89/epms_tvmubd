import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MarketingService } from './marketing.service';
import { Customer } from '../../entities/customer.entity';
import { Tender, TenderStatus, TenderStage } from '../../entities/tender.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Contract } from '../../entities/contract.entity';
import { TenderActivity } from '../../entities/tender-activity.entity';
import { TenderPriceHistory } from '../../entities/tender-price-history.entity';
import { User } from '../../entities/user.entity';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';

describe('MarketingService - Phase N3 Transactional Outbox Events', () => {
  let service: MarketingService;
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
        getRepository: jest.fn().mockImplementation((entity) => ({
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
        query: jest.fn().mockResolvedValue([]),
      },
    };

    dataSourceMock = {
      getRepository: jest.fn().mockImplementation((entity) => ({
        findOne: jest.fn().mockResolvedValue({ id: 10, fullName: 'Marketing User', roles: [{ name: 'MARKETING' }] }),
        save: jest.fn(),
      })),
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
      transaction: jest.fn().mockImplementation(async (cb) => cb(queryRunnerMock.manager)),
    };

    eventEmitter = {
      emit: jest.fn(),
    } as any;

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
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<MarketingService>(MarketingService);
  });

  it('1. MARKED_WON saves canonical OutboxEvent for marketing.tender.won in the same database transaction', async () => {
    const mockTender: any = {
      id: 55,
      title: 'Pengadaan Server DC',
      customer_id: 12,
      customer: { name: 'PT Telco' },
      stage: TenderStage.NEGOTIATION,
      status: TenderStatus.NEGOTIATION,
      estimated_budget: 1500000000,
      negotiated_price: 1400000000,
      marketing_pic_id: 25,
      go_nogo_status: 'GO',
      spk_file_key: 'contracts/spk-55.pdf',
    };

    queryRunnerMock.manager.findOne.mockImplementation(async (entity: any, options: any) => {
      if (entity === Tender) return mockTender;
      if (entity === Proposal) return { id: 88, tender_id: 55 };
      if (entity === Contract) return null;
      return null;
    });

    const result = await service.updateTenderStatusTransactionally(
      55,
      { stage: TenderStage.WON } as any,
      25,
    );

    expect(result.message).toContain('WON');
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

    // Verify OutboxEvent was saved inside queryRunner.manager
    const outboxSaves = savedEntities.filter(
      (s) => s.entityClass === OutboxEvent || s.entity?.event_name,
    );
    expect(outboxSaves.length).toBeGreaterThanOrEqual(1);

    const wonOutbox = outboxSaves.find((s) => s.entity?.event_name === 'marketing.tender.won');
    expect(wonOutbox).toBeDefined();
    expect(wonOutbox!.entity.event_id).toBeDefined();
    expect(typeof wonOutbox!.entity.event_id).toBe('string');
    expect(wonOutbox!.entity.event_name).toBe('marketing.tender.won');
    expect(wonOutbox!.entity.aggregate_type).toBe('Tender');
    expect(wonOutbox!.entity.aggregate_id).toBe(55);
    expect(wonOutbox!.entity.status).toBe(OutboxStatus.PENDING);
    expect(wonOutbox!.entity.payload.routing.userIds).toEqual([25]);
    expect(wonOutbox!.entity.payload.businessPayload.tenderId).toBe(55);

    // Direct in-memory emit must NOT occur for canonical won event
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('marketing.tender.won', expect.anything());
    // Only management_update (DATA CHANGED, 0 Bell) is emitted
    expect(eventEmitter.emit).toHaveBeenCalledWith('marketing.tender.management_update', expect.objectContaining({ action: 'MARKED_WON' }));
  });

  it('2. MARKED_LOST saves canonical OutboxEvent for marketing.tender.lost in the same database transaction', async () => {
    const mockTender: any = {
      id: 56,
      title: 'Pengadaan CCTV',
      customer_id: 14,
      customer: { name: 'PT Metro' },
      stage: TenderStage.NEGOTIATION,
      status: TenderStatus.NEGOTIATION,
      estimated_budget: 300000000,
      negotiated_price: 280000000,
      marketing_pic_id: 25,
      go_nogo_status: 'GO',
    };

    queryRunnerMock.manager.findOne.mockImplementation(async (entity: any, options: any) => {
      if (entity === Tender) return mockTender;
      return null;
    });

    const result = await service.updateTenderStatusTransactionally(
      56,
      { stage: TenderStage.LOST } as any,
      25,
    );

    expect(result.message).toContain('LOST');
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();

    // Verify OutboxEvent was saved inside queryRunner.manager
    const outboxSaves = savedEntities.filter(
      (s) => s.entityClass === OutboxEvent || s.entity?.event_name,
    );
    expect(outboxSaves.length).toBeGreaterThanOrEqual(1);

    const lostOutbox = outboxSaves.find((s) => s.entity?.event_name === 'marketing.tender.lost');
    expect(lostOutbox).toBeDefined();
    expect(lostOutbox!.entity.event_id).toBeDefined();
    expect(typeof lostOutbox!.entity.event_id).toBe('string');
    expect(lostOutbox!.entity.event_name).toBe('marketing.tender.lost');
    expect(lostOutbox!.entity.aggregate_type).toBe('Tender');
    expect(lostOutbox!.entity.aggregate_id).toBe(56);
    expect(lostOutbox!.entity.status).toBe(OutboxStatus.PENDING);
    expect(lostOutbox!.entity.payload.routing.userIds).toEqual([25]);
    expect(lostOutbox!.entity.payload.businessPayload.tenderId).toBe(56);

    // Direct in-memory emit must NOT occur for canonical lost event
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('marketing.tender.lost', expect.anything());
    // Only management_update (DATA CHANGED, 0 Bell) is emitted
    expect(eventEmitter.emit).toHaveBeenCalledWith('marketing.tender.management_update', expect.objectContaining({ action: 'MARKED_LOST' }));
  });

  it('3. saveSPKAndUpdateContract saves canonical OutboxEvent for marketing.spk.uploaded in same transaction and never emits marketing.tender.won', async () => {
    const mockTender: any = {
      id: 77,
      title: 'Tender Fiber 2026',
      customer_id: 15,
      customer: { name: 'PT Indonet' },
      stage: TenderStage.WON,
      status: TenderStatus.WON,
      estimated_budget: 800000000,
      marketing_pic_id: 25,
      go_nogo_status: 'GO',
    };

    const mockContract: any = {
      id: 201,
      contract_number: 'CONT-2026-077',
      tender_id: 77,
      status: 'PENDING_LEGAL_REVIEW',
      legal_status: 'DRAFT',
    };

    const qbMock: any = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
      getOne: jest.fn().mockResolvedValue(mockContract),
    };

    queryRunnerMock.manager.createQueryBuilder = jest.fn().mockReturnValue(qbMock);

    queryRunnerMock.manager.findOne.mockImplementation(async (entity: any) => {
      if (entity === Tender) return mockTender;
      if (entity === Proposal) return { id: 99, tender_id: 77 };
      if (entity === Contract) return mockContract;
      return null;
    });

    const mockFile: any = {
      filename: 'spk-indonet.pdf',
      originalname: 'spk-indonet.pdf',
      path: '/tmp/spk-indonet.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    };

    const result = await service.saveSPKAndUpdateContract(
      77,
      mockFile,
      'http://localhost:4000/uploads/contracts/spk-indonet.pdf',
      25,
    );

    expect(result.contractId).toBeDefined();

    // Verify OutboxEvent was saved inside the transaction
    const outboxSaves = savedEntities.filter(
      (s) => s.entityClass === OutboxEvent || s.entity?.event_name,
    );
    const spkOutbox = outboxSaves.find((s) => s.entity?.event_name === 'marketing.spk.uploaded');
    expect(spkOutbox).toBeDefined();
    expect(spkOutbox!.entity.event_name).toBe('marketing.spk.uploaded');
    expect(spkOutbox!.entity.aggregate_type).toBe('Contract');
    expect(spkOutbox!.entity.aggregate_id).toBe(201);
    expect(spkOutbox!.entity.event_id).toBeDefined();
    expect(typeof spkOutbox!.entity.event_id).toBe('string');
    expect(spkOutbox!.entity.payload.routing.roles).toContain('LEGAL');

    // Overloaded direct emit must NOT happen
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('marketing.tender.won', expect.anything());
    // Direct notification.send must NOT happen (migrated to Outbox)
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('notification.send', expect.anything());
  });
});
