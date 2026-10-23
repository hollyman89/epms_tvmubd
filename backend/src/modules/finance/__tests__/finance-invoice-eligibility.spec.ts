import { FinanceService } from '../finance.service';
import { PurchaseOrder, PurchaseOrderType } from '../../../entities/purchase-order.entity';
import { PoPaymentTerm, PaymentTermStatus, PaymentTermType } from '../../../entities/po-payment-term.entity';
import { GoodsReceipt } from '../../../entities/goods-receipt.entity';
import { Invoice } from '../../../entities/invoice.entity';
import { ServiceClaim, ServiceClaimStatus } from '../../../entities/service-claim.entity';

describe('EPMS — Canonical Finance Invoice Eligibility SSOT Tests', () => {
  let financeService: FinanceService;

  beforeEach(() => {
    // Instantiate FinanceService directly for pure SSOT evaluation testing
    financeService = new FinanceService(
      {} as any, // dataSource
      {} as any, // poRepository
      {} as any, // grRepository
      {} as any, // invoiceRepository
      {} as any, // paymentRepository
      {} as any, // paymentTermRepository
      { emit: jest.fn() } as any, // eventEmitter
    );
  });

  describe('isMaterialTermEligible', () => {
    const basePo: Partial<PurchaseOrder> = {
      id: 11,
      poNumber: 'PO-20261023-002',
      status: 'COMPLETED',
      totalAmount: 225000000,
      orderType: PurchaseOrderType.MATERIAL,
      items: [
        {
          id: 101,
          poId: 11,
          itemName: 'Baja WF 200',
          quantity: 10,
          receivedQuantity: 10,
          unitPrice: 22500000,
          totalPrice: 225000000,
        } as any,
      ],
    };

    const baseTerm: Partial<PoPaymentTerm> = {
      id: 11,
      poId: 11,
      sequence: 1,
      termName: 'Pelunasan Penuh',
      termType: PaymentTermType.FINAL_DELIVERY,
      percentage: 100,
      amount: 225000000,
      triggerCondition: 'Kemajuan Fisik 100%',
      status: PaymentTermStatus.PENDING,
    };

    const baseGr: Partial<GoodsReceipt> = {
      id: 6,
      poId: 11,
      grNumber: 'GR-20261023-001',
      receiptDate: new Date('2026-10-23T10:55:50.000Z'),
      totalReceivedAmount: 225000000,
      deletedAt: null as any,
      items: [
        {
          id: 201,
          grId: 6,
          poItemId: 101,
          receivedQuantity: 10,
        } as any,
      ],
    };

    it('1. Returns false when no active Goods Receipt exists', () => {
      const result = financeService.isMaterialTermEligible(
        baseTerm as PoPaymentTerm,
        basePo as PurchaseOrder,
        [baseTerm as PoPaymentTerm],
        [],
        [], // no GRs
      );
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Belum ada Goods Receipt');
    });

    it('2. Returns false when GR received value is 0', () => {
      const emptyGr: Partial<GoodsReceipt> = {
        id: 7,
        poId: 11,
        deletedAt: null as any,
        items: [{ poItemId: 101, receivedQuantity: 0 } as any],
      };
      const result = financeService.isMaterialTermEligible(
        baseTerm as PoPaymentTerm,
        basePo as PurchaseOrder,
        [baseTerm as PoPaymentTerm],
        [],
        [emptyGr as GoodsReceipt],
      );
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Total nilai penerimaan fisik barang masih 0');
    });

    it('3. Returns false for 100% milestone when items are unfulfilled', () => {
      const partialPo: Partial<PurchaseOrder> = {
        ...basePo,
        status: 'PARTIALLY_FULFILLED',
        items: [{ id: 101, quantity: 10, receivedQuantity: 5, unitPrice: 22500000 } as any],
      };
      const result = financeService.isMaterialTermEligible(
        baseTerm as PoPaymentTerm,
        partialPo as PurchaseOrder,
        [baseTerm as PoPaymentTerm],
        [],
        [baseGr as GoodsReceipt],
      );
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Pengiriman fisik barang belum selesai 100%');
    });

    it('4. Returns true for 100% milestone when PO is COMPLETED and all items are received', () => {
      const result = financeService.isMaterialTermEligible(
        baseTerm as PoPaymentTerm,
        basePo as PurchaseOrder,
        [baseTerm as PoPaymentTerm],
        [],
        [baseGr as GoodsReceipt],
      );
      expect(result.isEligible).toBe(true);
    });

    it('5. Returns false when preceding DP term is not PAID', () => {
      const dpTerm: Partial<PoPaymentTerm> = {
        id: 10,
        poId: 11,
        sequence: 1,
        termName: 'Uang Muka',
        termType: PaymentTermType.DOWN_PAYMENT,
        status: PaymentTermStatus.PENDING, // Not PAID!
      };
      const term2: Partial<PoPaymentTerm> = {
        id: 11,
        poId: 11,
        sequence: 2,
        termName: 'Termin 2',
        termType: PaymentTermType.PROGRESS,
        percentage: 50,
        amount: 100000000,
        status: PaymentTermStatus.PENDING,
      };

      const result = financeService.isMaterialTermEligible(
        term2 as PoPaymentTerm,
        basePo as PurchaseOrder,
        [dpTerm as PoPaymentTerm, term2 as PoPaymentTerm],
        [],
        [baseGr as GoodsReceipt],
      );
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Uang Muka (Uang Muka) belum berstatus PAID');
    });

    it('6. Returns false when an active invoice already exists for the payment term', () => {
      const existingInvoice: Partial<Invoice> = {
        id: 50,
        paymentTermId: 11,
        status: 'UNPAID',
        matchStatus: 'PENDING',
        deletedAt: null as any,
      };

      const result = financeService.isMaterialTermEligible(
        baseTerm as PoPaymentTerm,
        basePo as PurchaseOrder,
        [baseTerm as PoPaymentTerm],
        [existingInvoice as Invoice],
        [baseGr as GoodsReceipt],
      );
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Payment term sudah memiliki invoice aktif');
    });
  });

  describe('isServiceClaimEligible', () => {
    const baseServicePo: Partial<PurchaseOrder> = {
      id: 10,
      poNumber: 'PO-20261023-001',
      orderType: PurchaseOrderType.SERVICE,
      status: 'ISSUED',
    };

    const baseClaim: Partial<ServiceClaim> = {
      id: 5,
      poId: 10,
      claimNumber: 'SCL-20261023-001',
      status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
      approvedClaimAmount: 17029000,
      deletedAt: null as any,
    };

    it('1. Returns false when ServiceClaim is not APPROVED_FOR_INVOICE', () => {
      const draftClaim: Partial<ServiceClaim> = {
        ...baseClaim,
        status: ServiceClaimStatus.PM_VERIFIED,
      };
      const result = financeService.isServiceClaimEligible(
        draftClaim as ServiceClaim,
        baseServicePo as PurchaseOrder,
        [],
      );
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Status Klaim Jasa bukan APPROVED_FOR_INVOICE');
    });

    it('2. Returns true when ServiceClaim is APPROVED_FOR_INVOICE with no active invoice', () => {
      const result = financeService.isServiceClaimEligible(
        baseClaim as ServiceClaim,
        baseServicePo as PurchaseOrder,
        [],
      );
      expect(result.isEligible).toBe(true);
    });

    it('3. Returns false when ServiceClaim already has an active invoice', () => {
      const existingClaimInvoice: Partial<Invoice> = {
        id: 70,
        serviceClaimId: 5,
        status: 'PAID',
        matchStatus: 'VERIFIED',
        deletedAt: null as any,
      };
      const result = financeService.isServiceClaimEligible(
        baseClaim as ServiceClaim,
        baseServicePo as PurchaseOrder,
        [existingClaimInvoice as Invoice],
      );
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Klaim Jasa sudah ditagihkan pada invoice aktif');
    });
  });
});
