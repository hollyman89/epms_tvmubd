import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder, PurchaseOrderType } from '../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { PoPaymentTerm, PaymentTermStatus, PaymentTermType } from '../../entities/po-payment-term.entity';
import { ServiceClaim, ServiceClaimStatus } from '../../entities/service-claim.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { PaymentRequest, PaymentRequestStatus } from '../../entities/payment-request.entity';
import { DirectorDecisionAction } from './dto/decide-payment-request.dto';

describe('EPMS — Service Payment Term Downstream Lifecycle Regression Spec', () => {
  let service: FinanceService;
  let mockQueryRunner: any;
  let prqRepoMock: any;
  let latestSavedPrq: any = null;

  beforeEach(async () => {
    latestSavedPrq = null;

    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        save: jest.fn().mockImplementation((entityOrTarget: any, entity: any) => {
          const target = entity || entityOrTarget;
          if (!target.id) target.id = 501;
          if (target instanceof PaymentRequest || target.requestNumber || target.approvalSnapshot) {
            latestSavedPrq = target;
          }
          return target;
        }),
        create: jest.fn().mockImplementation((cls: any, data: any) => {
          if (data) return { ...data, id: data.id || 501 };
          return {};
        }),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(0),
        }),
      },
    };

    const mockPrqQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockImplementation(async () => latestSavedPrq),
    };

    prqRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockPrqQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
            getRepository: jest.fn().mockImplementation((entity: any) => {
              if (entity === PaymentRequest) return prqRepoMock;
              return {};
            }),
          },
        },
        { provide: getRepositoryToken(Invoice), useValue: { find: jest.fn(), manager: mockQueryRunner.manager } },
        { provide: getRepositoryToken(Payment), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(PurchaseOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  // Canonical SERVICE specimen generator
  const createServiceSpecimen = () => {
    const po: Partial<PurchaseOrder> = {
      id: 2,
      poNumber: 'PO-20261104-001',
      orderType: PurchaseOrderType.SERVICE,
      status: 'ISSUED',
      totalAmount: 4152000,
      vendorId: 1,
      vendor: { id: 1, name: 'PT Solusi Rekanan Layanan' } as any,
      items: [
        {
          id: 5,
          purchaseOrderId: 2,
          itemName: 'Jasa Implementasi IT',
          quantity: 1,
          receivedQuantity: 0, // Canonical: SERVICE PO has 0 physical GR
          unitPrice: 4152000,
          totalPrice: 4152000,
        } as any,
      ],
      paymentTerms: [],
      invoices: [],
      deletedAt: null,
    };

    const paymentTerm: Partial<PoPaymentTerm> = {
      id: 201,
      poId: 2,
      sequence: 1,
      termName: 'Pelunasan Penuh Jasa',
      termType: PaymentTermType.FINAL_DELIVERY,
      percentage: 100,
      amount: 4152000,
      status: PaymentTermStatus.VERIFIED, // Verified after upstream commercial review & invoice matching
      deletedAt: null,
    };

    const serviceClaim: Partial<ServiceClaim> = {
      id: 50,
      claimNumber: 'SCL-20261104-002',
      poId: 2,
      projectId: 10,
      vendorId: 1,
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
      totalClaimAmount: 4152000,
      approvedClaimAmount: 4152000,
      deletedAt: null,
    };

    const invoice: Partial<Invoice> = {
      id: 10,
      invoiceNumber: 'INV-20261104-001',
      poId: 2,
      paymentTermId: 201,
      serviceClaimId: 50,
      totalAmount: 4152000,
      matchStatus: 'VERIFIED',
      paymentStatus: 'UNPAID',
      status: 'UNPAID',
      purchaseOrder: po as PurchaseOrder,
      paymentTerm: paymentTerm as PoPaymentTerm,
      serviceClaim: serviceClaim as ServiceClaim,
      version: 1,
      deletedAt: null,
      createdBy: 37,
      updatedBy: 37,
    };

    const paymentRequest: Partial<PaymentRequest> = {
      id: 501,
      requestNumber: 'PRQ-20261104-001',
      invoiceId: 10,
      paymentTermId: 201,
      status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
      requestedAmount: 4152000,
      requestedBy: 5,
      version: 1,
      deletedAt: null,
      invoice: invoice as Invoice,
      paymentTerm: paymentTerm as PoPaymentTerm,
      approvalSnapshot: {
        invoiceId: 10,
        invoiceNumber: 'INV-20261104-001',
        invoiceAmount: 4152000,
        invoiceVersion: 1,
        paymentTermId: 201,
        paymentTermName: 'Pelunasan Penuh Jasa',
        requestedAmount: 4152000,
        vendorId: 1,
        vendorName: 'PT Solusi Rekanan Layanan',
        goodsReceiptId: null, // Service has null GR
        goodsReceiptNumber: null,
        poId: 2,
        poNumber: 'PO-20261104-001',
        timestamp: new Date().toISOString(),
      },
    };

    return { po, paymentTerm, serviceClaim, invoice, paymentRequest };
  };

  const makePaymentDto = (overrides: any = {}): any => ({
    invoiceId: 10,
    paymentRequestId: 501,
    paymentAmount: 4152000,
    paymentDate: '2026-11-05',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'REF-SRV-20261105-001',
    ...overrides,
  });

  // Helper for Payment execution mocks
  const setupPaymentExecutionMocks = (specimen: ReturnType<typeof createServiceSpecimen>, approvedAmount = 4152000) => {
    const prqApproved = {
      ...specimen.paymentRequest,
      status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
      approvedBy: 2,
      approvedAmount,
    };

    mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any, options: any) => {
      if (entityClass === Invoice) return specimen.invoice;
      if (entityClass === PaymentRequest) return prqApproved;
      if (entityClass === PoPaymentTerm) return specimen.paymentTerm;
      if (entityClass === PurchaseOrder) return specimen.po;
      if (entityClass === Payment) return null; // No candidate duplicate payment number
      if (entityClass === AuditLog) return null; // No duplicate closure audit
      return null;
    });

    mockQueryRunner.manager.find.mockImplementation(async (entityClass: any) => {
      if (entityClass === Payment) return []; // No prior payments
      if (entityClass === Invoice) return [specimen.invoice];
      if (entityClass === PoPaymentTerm) return [specimen.paymentTerm];
      return [];
    });

    return prqApproved;
  };

  // =========================================================================
  // 1. SERVICE Invoice submission can create a Payment Request
  // =========================================================================
  it('1. SERVICE Invoice with a valid Payment Term and approved Service Claim can submit a Payment Request', async () => {
    const { invoice, paymentTerm } = createServiceSpecimen();

    mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Invoice) return invoice;
      if (entityClass === PaymentRequest) return null; // No active payment request
      if (entityClass === PoPaymentTerm) return paymentTerm;
      if (entityClass === GoodsReceipt) return null; // Canonical: Service PO has no GR
      return null;
    });
    mockQueryRunner.manager.find.mockResolvedValue([]); // No prior payments

    const dto = {
      invoiceId: 10,
      requestedAmount: 4152000,
      notes: 'Pengajuan pembayaran termin jasa 100%',
    };

    const result = await service.submitPaymentRequest(dto, 5);

    expect(result).toBeDefined();
    expect(result.status).toBe(PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL);
    expect(result.invoiceId).toBe(10);
    expect(result.requestedAmount).toBe(4152000);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // =========================================================================
  // 2. The Payment Request preserves the authoritative Payment Term ID and amount
  // =========================================================================
  it('2. The Payment Request preserves the authoritative Payment Term ID and amount', async () => {
    const { invoice, paymentTerm } = createServiceSpecimen();

    mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Invoice) return invoice;
      if (entityClass === PaymentRequest) return null;
      if (entityClass === PoPaymentTerm) return paymentTerm;
      if (entityClass === GoodsReceipt) return null;
      return null;
    });
    mockQueryRunner.manager.find.mockResolvedValue([]);

    // A. Submitting exact authoritative term amount succeeds and preserves term ID
    const validResult = await service.submitPaymentRequest(
      { invoiceId: 10, requestedAmount: 4152000 },
      5
    );
    expect(validResult.paymentTermId).toBe(201);
    expect(validResult.requestedAmount).toBe(4152000);
    expect(validResult.approvalSnapshot.paymentTermId).toBe(201);
    expect(validResult.approvalSnapshot.requestedAmount).toBe(4152000);

    // B. Submitting different amount from authoritative term is rejected
    await expect(
      service.submitPaymentRequest({ invoiceId: 10, requestedAmount: 3000000 }, 5)
    ).rejects.toThrow(
      'Nominal pengajuan pembayaran (Rp 3.000.000) tidak sesuai dengan nilai termin pembayaran Procurement (Rp 4.152.000). Pengajuan sebagian di luar termin tidak diizinkan.'
    );
  });

  // =========================================================================
  // 3. Service-specific metadata: does not require Goods Receipt for SERVICE transactions
  // =========================================================================
  it('3. Service-specific metadata is handled correctly. Do not require Goods Receipt for SERVICE transactions', async () => {
    const { invoice, paymentTerm } = createServiceSpecimen();

    mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Invoice) return invoice;
      if (entityClass === PaymentRequest) return null;
      if (entityClass === PoPaymentTerm) return paymentTerm;
      if (entityClass === GoodsReceipt) return null; // No Goods Receipt for Service PO
      return null;
    });
    mockQueryRunner.manager.find.mockResolvedValue([]);

    const result = await service.submitPaymentRequest(
      { invoiceId: 10, requestedAmount: 4152000 },
      5
    );

    // Snapshot correctly stores null GR metadata without failure
    expect(result.approvalSnapshot).toBeDefined();
    expect(result.approvalSnapshot.goodsReceiptId).toBeNull();
    expect(result.approvalSnapshot.goodsReceiptNumber).toBeNull();
    expect(result.approvalSnapshot.poId).toBe(2);
    expect(result.approvalSnapshot.poNumber).toBe('PO-20261104-001');
    expect(result.approvalSnapshot.vendorName).toBe('PT Solusi Rekanan Layanan');
  });

  // =========================================================================
  // 4. Director reduced approval is rejected
  // =========================================================================
  it('4. Director reduced approval is rejected', async () => {
    const { paymentRequest } = createServiceSpecimen();

    mockQueryRunner.manager.findOne.mockResolvedValue(paymentRequest);

    await expect(
      service.decidePaymentRequest(
        501,
        { action: DirectorDecisionAction.APPROVE, approvedAmount: 3000000 },
        2
      )
    ).rejects.toThrow(
      'Persetujuan pembayaran dengan nominal (Rp 3.000.000) lebih kecil dari jumlah yang diajukan (Rp 4.152.000) tidak diizinkan. Direktur harus menggunakan aksi RETURN (Minta Revisi) jika nominal perlu disesuaikan melalui amandemen PO Procurement.'
    );
  });

  // =========================================================================
  // 5. Director approval matching the requested Payment Term amount succeeds
  // =========================================================================
  it('5. Director approval matching the requested Payment Term amount succeeds', async () => {
    const { paymentRequest } = createServiceSpecimen();

    mockQueryRunner.manager.findOne.mockResolvedValue(paymentRequest);
    jest.spyOn(service, 'getPaymentRequestById').mockImplementation(async (id: number) => {
      return {
        ...paymentRequest,
        status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
        approvedAmount: 4152000,
        approvedBy: 2,
      } as any;
    });

    const result = await service.decidePaymentRequest(
      501,
      { action: DirectorDecisionAction.APPROVE, approvedAmount: 4152000 },
      2
    );

    expect(result).toBeDefined();
    expect(result.status).toBe(PaymentRequestStatus.APPROVED_FOR_PAYMENT);
    expect(result.approvedAmount).toBe(4152000);
    expect(result.approvedBy).toBe(2);
  });

  // =========================================================================
  // 6. Finance payment matching the authoritative Service Payment Term succeeds
  // =========================================================================
  it('6. Finance payment matching the authoritative Service Payment Term succeeds', async () => {
    const specimen = createServiceSpecimen();
    setupPaymentExecutionMocks(specimen, 4152000);

    const dto = makePaymentDto({
      paymentAmount: 4152000,
    });

    const result = await service.createPayment(dto, 3);

    expect(result).toBeDefined();
    expect(result.paymentNumber).toMatch(/^PAY-/);
    expect(result.amount).toBe(4152000);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // =========================================================================
  // 7. Full settlement updates PaymentRequest, Invoice, and PoPaymentTerm to PAID
  // =========================================================================
  it('7. Successful full settlement updates PaymentRequest, Invoice, and PoPaymentTerm consistently to PAID', async () => {
    const specimen = createServiceSpecimen();
    const prqApproved = setupPaymentExecutionMocks(specimen, 4152000);

    const dto = makePaymentDto({
      paymentAmount: 4152000,
    });

    const result = await service.createPayment(dto, 3);

    expect(result).toBeDefined();
    expect(prqApproved.status).toBe(PaymentRequestStatus.PAID);
    expect(specimen.invoice.paymentStatus).toBe('PAID');
    expect(specimen.invoice.status).toBe('PAID');
    expect(specimen.paymentTerm.status).toBe(PaymentTermStatus.PAID);
    expect((result as any).isFullyPaid).toBe(true);
    expect((result as any).paymentStatus).toBe('PAID');
  });

  // =========================================================================
  // 8. Finance payment differing from the authoritative term amount is rejected
  // =========================================================================
  it('8. Finance payment differing from the authoritative term amount is rejected', async () => {
    const specimen = createServiceSpecimen();
    setupPaymentExecutionMocks(specimen, 4152000);

    // A. Underpayment attempt: 4,000,000 vs 4,152,000
    await expect(
      service.createPayment(
        makePaymentDto({
          paymentAmount: 4000000,
        }),
        3
      )
    ).rejects.toThrow(
      'Payment amount (4000000) harus sesuai dengan nilai termin pembayaran Procurement (4152000). Pembayaran dengan nominal berbeda dari jadwal termin Procurement tidak diizinkan.'
    );

    // B. Overpayment attempt: 5,000,000 vs 4,152,000
    await expect(
      service.createPayment(
        makePaymentDto({
          paymentAmount: 5000000,
        }),
        3
      )
    ).rejects.toThrow(
      'Payment amount (5000000) melebihi nominal yang disetujui Direktur (4152000)'
    );
  });

  // =========================================================================
  // 9. Payment Term belonging to another PO is rejected
  // =========================================================================
  it('9. Payment Term belonging to another PO is rejected', async () => {
    const specimen = createServiceSpecimen();

    // A. Rejection in submitPaymentRequest when term poId !== invoice poId
    const mismatchedTerm = { ...specimen.paymentTerm, poId: 999 };
    const invoiceWithMismatchedTerm = { ...specimen.invoice, paymentTerm: mismatchedTerm };

    mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Invoice) return invoiceWithMismatchedTerm;
      if (entityClass === PaymentRequest) return null;
      if (entityClass === PoPaymentTerm) return mismatchedTerm;
      return null;
    });
    mockQueryRunner.manager.find.mockResolvedValue([]);

    await expect(
      service.submitPaymentRequest(
        { invoiceId: 10, requestedAmount: 4152000 },
        5
      )
    ).rejects.toThrow('Payment term bukan milik Purchase Order dari invoice ini.');

    // B. Rejection in createPayment when term poId !== invoice poId
    setupPaymentExecutionMocks(specimen, 4152000);
    mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Invoice) return specimen.invoice;
      if (entityClass === PaymentRequest) return { ...specimen.paymentRequest, status: PaymentRequestStatus.APPROVED_FOR_PAYMENT, approvedAmount: 4152000 };
      if (entityClass === PoPaymentTerm) return mismatchedTerm;
      return null;
    });

    await expect(
      service.createPayment(
        makePaymentDto({
          paymentAmount: 4152000,
        }),
        3
      )
    ).rejects.toThrow('Payment term bukan milik Purchase Order dari invoice ini.');
  });

  // =========================================================================
  // 10. Duplicate execution and invalid term status are rejected
  // =========================================================================
  it('10. Duplicate execution and invalid term status are rejected', async () => {
    const specimen = createServiceSpecimen();

    // A. Term already PAID cannot be paid again
    const paidTerm = { ...specimen.paymentTerm, status: PaymentTermStatus.PAID };
    setupPaymentExecutionMocks(specimen, 4152000);
    mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Invoice) return specimen.invoice;
      if (entityClass === PaymentRequest) return { ...specimen.paymentRequest, status: PaymentRequestStatus.APPROVED_FOR_PAYMENT, approvedAmount: 4152000 };
      if (entityClass === PoPaymentTerm) return paidTerm;
      return null;
    });

    await expect(
      service.createPayment(
        makePaymentDto({
          paymentAmount: 4152000,
        }),
        3
      )
    ).rejects.toThrow('Payment term sudah lunas (PAID)');

    // B. Term not yet VERIFIED (e.g. still INVOICE_SUBMITTED) cannot be paid
    const unverifiedTerm = { ...specimen.paymentTerm, status: PaymentTermStatus.INVOICE_SUBMITTED };
    mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Invoice) return specimen.invoice;
      if (entityClass === PaymentRequest) return { ...specimen.paymentRequest, status: PaymentRequestStatus.APPROVED_FOR_PAYMENT, approvedAmount: 4152000 };
      if (entityClass === PoPaymentTerm) return unverifiedTerm;
      return null;
    });

    await expect(
      service.createPayment(
        makePaymentDto({
          paymentAmount: 4152000,
        }),
        3
      )
    ).rejects.toThrow('Pembayaran termin hanya dapat diproses untuk termin berstatus VERIFIED (status saat ini: INVOICE_SUBMITTED)');

    // C. Payment Request already PAID cannot be processed again
    const paidPrq = { ...specimen.paymentRequest, status: PaymentRequestStatus.PAID, approvedAmount: 4152000 };
    mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Invoice) return specimen.invoice;
      if (entityClass === PaymentRequest) return paidPrq;
      if (entityClass === PoPaymentTerm) return specimen.paymentTerm;
      return null;
    });

    await expect(
      service.createPayment(
        makePaymentDto({
          paymentAmount: 4152000,
        }),
        3
      )
    ).rejects.toThrow('Pembayaran ditolak: Payment Request sudah dibayar (PAID).');

    // D. Residual Payment Request on term invoice after prior payment is blocked
    const partiallyPaidInvoice = { ...specimen.invoice, paymentStatus: 'PARTIALLY_PAID' };
    mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Invoice) return partiallyPaidInvoice;
      if (entityClass === PaymentRequest) return null;
      if (entityClass === PoPaymentTerm) return specimen.paymentTerm;
      return null;
    });
    mockQueryRunner.manager.find.mockImplementation(async (entityClass: any) => {
      if (entityClass === Payment) return [{ id: 1, invoiceId: 10, amount: 2000000, deletedAt: null }];
      return [];
    });

    await expect(
      service.submitPaymentRequest(
        { invoiceId: 10, requestedAmount: 2152000 },
        5
      )
    ).rejects.toThrow(
      'Invoice termin ini telah memiliki pembayaran sebelumnya (Rp 2.000.000). Termin pembayaran Procurement tidak dapat dipecah menjadi cicilan tambahan tanpa amandemen PO Procurement.'
    );
  });
});
