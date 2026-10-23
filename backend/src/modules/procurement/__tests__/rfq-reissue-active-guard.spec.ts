import { BadRequestException } from '@nestjs/common';
import { ProcurementService } from '../procurement.service';
import { Rfq } from '../../../entities/rfq.entity';
import { PurchaseRequest } from '../../../entities/purchase-request.entity';

describe('ProcurementService - RFQ Reissue and Active Guard (Audit & Fix)', () => {
  let service: ProcurementService;
  let prRepoMock: any;
  let rfqRepoMock: any;
  let dataSourceMock: any;
  let managerMock: any;

  const mockApprovedPr: Partial<PurchaseRequest> = {
    id: 13,
    prNumber: 'PR-20261023-003',
    status: 'APPROVED',
  };

  const mockCancelledRfq: Partial<Rfq> = {
    id: 8,
    rfqNumber: 'RFQ-20261023-003',
    prId: 13,
    status: 'CANCELLED',
    createdAt: new Date('2026-10-23T10:00:00Z'),
  };

  beforeEach(() => {
    prRepoMock = {
      findOne: jest.fn().mockResolvedValue(mockApprovedPr),
    };

    rfqRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };

    let savedIdCounter = 100;
    managerMock = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          rfqNumber: 'RFQ-20261023-003',
        }),
      }),
      create: jest.fn().mockImplementation((entityClass, data) => ({
        ...data,
      })),
      save: jest.fn().mockImplementation((entityClass, data) => {
        savedIdCounter += 1;
        return Promise.resolve({
          id: savedIdCounter,
          ...data,
          createdAt: new Date(),
        });
      }),
    };

    dataSourceMock = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(managerMock)),
    };

    service = new ProcurementService(
      prRepoMock,
      rfqRepoMock,
      {} as any, // vendorRepo
      {} as any, // quotationRepo
      {} as any, // quotationItemRepo
      {} as any, // vendorComparisonRepo
      {} as any, // poRepo
      {} as any, // grRepo
      {} as any, // workflowService
      dataSourceMock,
      {} as any, // eventEmitter
    );
  });

  // 1. APPROVED PR + no RFQ → create RFQ succeeds
  it('1. APPROVED PR + no RFQ -> create RFQ succeeds', async () => {
    rfqRepoMock.findOne.mockResolvedValue(null);
    managerMock.findOne.mockResolvedValue(null);

    const result = await service.createRfq({
      purchaseRequestId: 13,
      closingDate: '2026-11-06T12:00:00.000Z',
    });

    expect(result.success).toBe(true);
    expect(result.data.prId).toBe(13);
    expect(result.data.status).toBe('OPEN');
    expect(result.data.rfqNumber).toBe('RFQ-20261023-004');
  });

  // 2. APPROVED PR + CANCELLED RFQ → create new RFQ succeeds
  it('2. APPROVED PR + CANCELLED RFQ -> create new RFQ succeeds', async () => {
    // When searching for active RFQ with status != 'CANCELLED', findOne returns null
    rfqRepoMock.findOne.mockResolvedValue(null);
    managerMock.findOne.mockResolvedValue(null);

    const result = await service.createRfq({
      purchaseRequestId: 13,
      closingDate: '2026-11-06T12:00:00.000Z',
    });

    expect(result.success).toBe(true);
    expect(result.data.prId).toBe(13);
    expect(result.data.status).toBe('OPEN');
  });

  // 3. old cancelled RFQ remains CANCELLED (not mutated)
  it('3. old cancelled RFQ remains CANCELLED and unmutated', async () => {
    const historicalCancelledRfq = { ...mockCancelledRfq };

    rfqRepoMock.findOne.mockResolvedValue(null);
    managerMock.findOne.mockResolvedValue(null);

    await service.createRfq({
      purchaseRequestId: 13,
    });

    expect(historicalCancelledRfq.status).toBe('CANCELLED');
    expect(historicalCancelledRfq.id).toBe(8);
    expect(managerMock.save).not.toHaveBeenCalledWith(
      Rfq,
      expect.objectContaining({ id: 8 }),
    );
  });

  // 4. new RFQ has new ID (not reusing cancelled RFQ ID)
  it('4. new RFQ has new ID distinct from old RFQ ID 8', async () => {
    rfqRepoMock.findOne.mockResolvedValue(null);
    managerMock.findOne.mockResolvedValue(null);

    const result = await service.createRfq({
      purchaseRequestId: 13,
    });

    expect(result.data.id).toBeDefined();
    expect(result.data.id).not.toBe(8);
  });

  // 5. new RFQ has new monotonic RFQ number
  it('5. new RFQ has new sequential RFQ number incremented past previous RFQ', async () => {
    managerMock.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        rfqNumber: 'RFQ-20261023-003',
      }),
    });

    const result = await service.createRfq({
      purchaseRequestId: 13,
    });

    expect(result.data.rfqNumber).toBe('RFQ-20261023-004');
  });

  // 6. APPROVED PR + OPEN RFQ → rejected
  it('6. APPROVED PR + OPEN RFQ -> rejected with BadRequestException', async () => {
    const activeOpenRfq: Partial<Rfq> = {
      id: 20,
      rfqNumber: 'RFQ-20261023-005',
      prId: 13,
      status: 'OPEN',
    };
    rfqRepoMock.findOne.mockResolvedValue(activeOpenRfq);

    await expect(
      service.createRfq({ purchaseRequestId: 13 }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createRfq({ purchaseRequestId: 13 }),
    ).rejects.toThrow(/already has active RFQ RFQ-20261023-005/);
  });

  // 7. APPROVED PR + EVALUATED RFQ → rejected
  it('7. APPROVED PR + EVALUATED RFQ -> rejected with BadRequestException', async () => {
    const activeEvaluatedRfq: Partial<Rfq> = {
      id: 21,
      rfqNumber: 'RFQ-20261023-006',
      prId: 13,
      status: 'EVALUATED',
    };
    rfqRepoMock.findOne.mockResolvedValue(activeEvaluatedRfq);

    await expect(
      service.createRfq({ purchaseRequestId: 13 }),
    ).rejects.toThrow(BadRequestException);
  });

  // 8. APPROVED PR + CLOSED RFQ → rejected
  it('8. APPROVED PR + CLOSED RFQ -> rejected with BadRequestException', async () => {
    const activeClosedRfq: Partial<Rfq> = {
      id: 22,
      rfqNumber: 'RFQ-20261023-007',
      prId: 13,
      status: 'CLOSED',
    };
    rfqRepoMock.findOne.mockResolvedValue(activeClosedRfq);

    await expect(
      service.createRfq({ purchaseRequestId: 13 }),
    ).rejects.toThrow(BadRequestException);
  });

  // 9. PR with one CANCELLED + one OPEN RFQ → rejected
  it('9. PR with one CANCELLED + one OPEN RFQ -> rejected because an active OPEN RFQ exists', async () => {
    const activeOpenRfq: Partial<Rfq> = {
      id: 25,
      rfqNumber: 'RFQ-20261023-008',
      prId: 13,
      status: 'OPEN',
    };
    // The query where: { prId: 13, status: Not('CANCELLED') } finds the active open RFQ
    rfqRepoMock.findOne.mockResolvedValue(activeOpenRfq);

    await expect(
      service.createRfq({ purchaseRequestId: 13 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createRfq({ purchaseRequestId: 13 }),
    ).rejects.toThrow(/already has active RFQ/);
  });

  // 10. In-transaction guard also catches concurrent duplicate active RFQ
  it('10. in-transaction guard catches concurrent active RFQ creation', async () => {
    rfqRepoMock.findOne.mockResolvedValue(null); // Pre-check passed
    managerMock.findOne.mockResolvedValue({
      id: 30,
      rfqNumber: 'RFQ-20261023-009',
      status: 'OPEN',
    }); // But inside tx, another process created an active RFQ

    await expect(
      service.createRfq({ purchaseRequestId: 13 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createRfq({ purchaseRequestId: 13 }),
    ).rejects.toThrow(/already has active RFQ/);
  });
});
