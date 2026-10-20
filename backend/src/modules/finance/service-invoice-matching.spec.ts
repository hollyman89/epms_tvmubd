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
import { MismatchCode } from './finance.types';

describe('FinanceService - Service Invoice Reconciliation & Material Regression', () => {
  let service: FinanceService;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      },
      isTransactionActive: true,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
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

  const createServiceSpecimen = () => {
    const po = {
      id: 2,
      poNumber: 'PO-20261018-002',
      orderType: PurchaseOrderType.SERVICE,
      totalAmount: 4152000,
      status: 'ISSUED',
      vendorId: 1,
      items: [
        {
          id: 5,
          purchaseOrderId: 2,
          itemName: 'Jasa Tarik Kabel',
          quantity: 1038,
          receivedQuantity: 0, // Canonical: Service PO has 0 received quantity
          unitPrice: 4000,
          totalPrice: 4152000,
        },
      ],
      paymentTerms: [
        {
          id: 2,
          poId: 2,
          termName: 'Pelunasan Penuh',
          termType: PaymentTermType.FINAL_DELIVERY,
          percentage: 100,
          amount: 4152000,
          triggerCondition: 'Barang Diterima Lengkap & BAST Disetujui',
          status: PaymentTermStatus.INVOICE_SUBMITTED,
        },
      ],
      invoices: [],
    };

    const serviceClaim = {
      id: 1,
      claimNumber: 'SCL-20261018-001',
      poId: 2,
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
      totalClaimAmount: 4152000,
      approvedClaimAmount: 4152000,
      items: [
        {
          id: 1,
          serviceClaimId: 1,
          poItemId: 5,
          currentClaimQuantity: 1038,
          cumulativeApprovedQuantity: 1038,
          currentClaimAmount: 4152000,
          cumulativeApprovedAmount: 4152000,
        },
      ],
    };

    const invoice = {
      id: 2,
      invoiceNumber: 'INV-20261018-002',
      poId: 2,
      paymentTermId: 2,
      serviceClaimId: 1,
      totalAmount: 4152000,
      matchStatus: 'PENDING',
      paymentStatus: 'UNPAID',
      purchaseOrder: po,
      paymentTerm: po.paymentTerms[0],
      serviceClaim,
      items: [
        {
          id: 5,
          invoiceId: 2,
          poItemId: 5,
          quantity: 1038,
          unitPrice: 4000,
          totalPrice: 4152000,
        },
      ],
      payments: [],
    };

    return { po, serviceClaim, invoice };
  };

  describe('SERVICE PO Matching (Canonical)', () => {
    it('1. SERVICE specimen: reconciles against approved Service Claim with MATCHED result', async () => {
      const { invoice } = createServiceSpecimen();
      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MATCHED');
      expect(result.mismatches).toHaveLength(0);
      expect(result.mismatches.some(m => m.code === MismatchCode.QUANTITY_EXCEEDED)).toBe(false);
      expect(result.mismatches.some(m => m.code === MismatchCode.INSUFFICIENT_DELIVERY)).toBe(false);
    });

    it('2. SERVICE PO does not require Goods Receipt (GR)', async () => {
      const { invoice } = createServiceSpecimen();
      mockQueryRunner.manager.find.mockResolvedValue([]); // No GRs exist
      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MATCHED');
      expect(result.mismatches.some(m => m.code === MismatchCode.GR_NOT_FOUND)).toBe(false);
      expect(result.mismatches.some(m => m.code === MismatchCode.EVIDENCE_REQUIRED)).toBe(false);
    });

    it('3. SERVICE invoice requires linked Service Claim', async () => {
      const { invoice } = createServiceSpecimen();
      invoice.serviceClaimId = undefined as any;
      invoice.serviceClaim = undefined as any;

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.code === MismatchCode.EVIDENCE_REQUIRED)).toBe(true);
      expect(result.mismatches.some(m => m.message.includes('Service PO wajib menyertakan referensi Klaim Jasa'))).toBe(true);
    });

    it('4. Linked Service Claim must belong to the same PO', async () => {
      const { invoice, serviceClaim } = createServiceSpecimen();
      serviceClaim.poId = 999; // Different PO

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.message.includes('bukan milik Purchase Order'))).toBe(true);
    });

    it('5. Linked Service Claim must be APPROVED_FOR_INVOICE', async () => {
      const { invoice, serviceClaim } = createServiceSpecimen();
      serviceClaim.status = ServiceClaimStatus.SUBMITTED; // Not approved

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.message.includes('Hanya Service Claim berstatus APPROVED_FOR_INVOICE'))).toBe(true);
    });

    it('6. SERVICE invoice quantity equal to approved claim quantity: PASS', async () => {
      const { invoice } = createServiceSpecimen();
      invoice.items[0].quantity = 1038;

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MATCHED');
      expect(result.mismatches).toHaveLength(0);
    });

    it('7. SERVICE invoice quantity exceeding approved claim: QUANTITY_EXCEEDED', async () => {
      const { invoice } = createServiceSpecimen();
      invoice.items[0].quantity = 1200; // 1200 > 1038 approved

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.code === MismatchCode.QUANTITY_EXCEEDED)).toBe(true);
      expect(result.mismatches.some(m => m.message.includes('melebihi kuantitas klaim jasa yang disetujui'))).toBe(true);
    });

    it('8. SERVICE invoice amount exceeding approved claim: fails with amount mismatch', async () => {
      const { invoice } = createServiceSpecimen();
      invoice.totalAmount = 5000000; // 5M > 4.152M approved claim

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.message.includes('melebihi nilai klaim jasa yang disetujui'))).toBe(true);
    });

    it('9. SERVICE FINAL_DELIVERY does not require PO status COMPLETED or goods received', async () => {
      const { invoice, po } = createServiceSpecimen();
      po.status = 'ISSUED'; // Legitimately ISSUED
      po.items[0].receivedQuantity = 0; // 0 physical GR quantity

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MATCHED');
      expect(result.mismatches.some(m => m.code === MismatchCode.INSUFFICIENT_DELIVERY)).toBe(false);
    });

    it('10. Duplicate Service Claim billing remains blocked across active invoices', async () => {
      const { invoice, po } = createServiceSpecimen();
      const existingInvoice = {
        id: 99,
        invoiceNumber: 'INV-PREV-001',
        poId: 2,
        serviceClaimId: 1, // Same claim
        totalAmount: 4152000,
        status: 'UNPAID',
        matchStatus: 'VERIFIED',
        items: [{ poItemId: 5, quantity: 1038 }],
      };
      po.invoices = [existingInvoice as any, invoice as any];

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.message.includes('sudah ditagihkan pada invoice aktif lain'))).toBe(true);
    });

    it('11. Cumulative Service invoices cannot exceed PO ceiling', async () => {
      const { invoice, po } = createServiceSpecimen();
      const priorInvoice = {
        id: 98,
        invoiceNumber: 'INV-PRIOR-001',
        poId: 2,
        serviceClaimId: 99,
        paymentTermId: 99,
        totalAmount: 1000000,
        status: 'PAID',
        matchStatus: 'VERIFIED',
      };
      po.invoices = [priorInvoice as any, invoice as any];
      // 1M + 4.152M = 5.152M > po.totalAmount (4.152M)

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.code === MismatchCode.CUMULATIVE_AMOUNT_EXCEEDED_PO)).toBe(true);
    });
  });

  describe('MATERIAL PO Regression Lock (Unchanged)', () => {
    const createMaterialSpecimen = () => {
      const po = {
        id: 1,
        poNumber: 'PO-MATERIAL-001',
        orderType: PurchaseOrderType.MATERIAL,
        totalAmount: 1000000,
        status: 'ISSUED',
        vendorId: 1,
        items: [
          {
            id: 10,
            purchaseOrderId: 1,
            itemName: 'Material Cable',
            quantity: 10,
            receivedQuantity: 0,
            unitPrice: 100000,
            totalPrice: 1000000,
          },
        ],
        paymentTerms: [
          {
            id: 1,
            poId: 1,
            termName: 'Pelunasan Material',
            termType: PaymentTermType.FINAL_DELIVERY,
            percentage: 100,
            amount: 1000000,
            status: PaymentTermStatus.INVOICE_SUBMITTED,
          },
        ],
        invoices: [],
      };

      const invoice = {
        id: 1,
        invoiceNumber: 'INV-MATERIAL-001',
        poId: 1,
        paymentTermId: 1,
        totalAmount: 1000000,
        matchStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        purchaseOrder: po,
        paymentTerm: po.paymentTerms[0],
        items: [
          {
            id: 1,
            invoiceId: 1,
            poItemId: 10,
            quantity: 10,
            unitPrice: 100000,
            totalPrice: 1000000,
          },
        ],
        payments: [],
      };

      return { po, invoice };
    };

    it('1. MATERIAL PO still requires GR and full delivery for FINAL_DELIVERY', async () => {
      const { invoice } = createMaterialSpecimen();
      // po.status is ISSUED and receivedQuantity is 0

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.code === MismatchCode.INSUFFICIENT_DELIVERY)).toBe(true);
      expect(result.mismatches.some(m => m.code === MismatchCode.QUANTITY_EXCEEDED)).toBe(true);
    });

    it('2. MATERIAL invoice quantity exceeding received quantity fails with QUANTITY_EXCEEDED', async () => {
      const { invoice, po } = createMaterialSpecimen();
      po.status = 'COMPLETED';
      po.items[0].receivedQuantity = 5; // Received 5
      invoice.items[0].quantity = 10;   // Invoiced 10

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.code === MismatchCode.QUANTITY_EXCEEDED)).toBe(true);
      expect(result.mismatches.some(m => m.message.includes('Diterima: 5'))).toBe(true);
    });

    it('3. MATERIAL PO with serviceClaimId is NOT treated as Service PO', async () => {
      const { invoice, po } = createMaterialSpecimen();
      // Inconsistent data: Material PO with serviceClaimId attached
      (invoice as any).serviceClaimId = 1;
      po.status = 'ISSUED';
      po.items[0].receivedQuantity = 0;

      const result = await service.evaluateMatching(invoice as any, undefined, mockQueryRunner.manager);

      // Must still evaluate as MATERIAL and fail with INSUFFICIENT_DELIVERY
      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.code === MismatchCode.INSUFFICIENT_DELIVERY)).toBe(true);
    });
  });
});
