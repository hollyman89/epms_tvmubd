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
import { BadRequestException } from '@nestjs/common';
import { MismatchCode } from './finance.types';

describe('FinanceService - 3-Way Match Hardening (P7.6 Part 3)', () => {
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
        count: jest.fn(),
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

  describe('Maker-Checker SoD', () => {
    it('MATCH-01: Should allow if creator is the same as verifier (Canonical EPMS Finance single-account rule)', async () => {
      const invoice = { 
        id: 1, 
        poId: 1,
        createdBy: 100, 
        matchStatus: 'PENDING',
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 1, status: 'COMPLETED', items: [{ id: 1, unitPrice: 1000, receivedQuantity: 1 }] },
        totalAmount: 1000
      };
      const gr = { id: 1, poId: 1, items: [{ poItemId: 1, receivedQuantity: 1 }] };
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        return [];
      });
      mockQueryRunner.manager.save.mockImplementation(async (entity: any, val: any) => val);

      const result = await service.verifyInvoice(1, { approved: true } as any, 100);
      expect(result.matchStatus).toBe('VERIFIED');
    });

    it('MATCH-02: Should allow if creator is different from verifier', async () => {
      const invoice = { 
        id: 1, 
        poId: 1,
        createdBy: 100, 
        matchStatus: 'PENDING',
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 1, status: 'COMPLETED', items: [{ id: 1, unitPrice: 1000, receivedQuantity: 1 }] },
        totalAmount: 1000
      };
      const gr = { id: 1, poId: 1, items: [{ poItemId: 1, receivedQuantity: 1 }] };
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        return [];
      });
      mockQueryRunner.manager.save.mockImplementation(async (entity: any, val: any) => val);

      const result = await service.verifyInvoice(1, { approved: true } as any, 101);
      expect(result.matchStatus).toBe('VERIFIED');
    });
  });

  describe('Vendor Authority', () => {
    it('MATCH-03: Should reject if claimed vendor ID differs from PO vendor ID', async () => {
      const invoice = { 
        id: 1, 
        poId: 1,
        createdBy: 100, 
        matchStatus: 'PENDING',
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'COMPLETED', items: [] },
        totalAmount: 1000
      };
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);

      await expect(service.verifyInvoice(1, { approved: true, vendorId: 99 } as any, 101))
        .rejects
        .toMatchObject({ response: expect.objectContaining({ message: 'Vendor invoice tidak sesuai dengan vendor Purchase Order.' }) });
    });
  });

  describe('Item-Level Matching', () => {
    it('MATCH-04: Should reject if invoice item does not belong to PO', async () => {
      const invoice = { 
        id: 1, 
        createdBy: 100, 
        matchStatus: 'PENDING',
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'COMPLETED', items: [] },
        items: [{ poItemId: 999, unitPrice: 100, quantity: 1 }],
        totalAmount: 1000
      };
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);

      await expect(service.verifyInvoice(1, { approved: true } as any, 101))
        .rejects
        .toMatchObject({ response: expect.objectContaining({ message: expect.stringContaining('bukan merupakan bagian dari Purchase Order ini') }) });
    });

    it('MATCH-05: Should reject if invoice item price differs from PO item price', async () => {
      const invoice = { 
        id: 1, 
        createdBy: 100, 
        matchStatus: 'PENDING',
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'COMPLETED', items: [{ id: 1, unitPrice: 500, receivedQuantity: 2 }] },
        items: [{ poItemId: 1, unitPrice: 600, quantity: 1 }],
        totalAmount: 1000
      };
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);

      await expect(service.verifyInvoice(1, { approved: true } as any, 101))
        .rejects
        .toMatchObject({ response: expect.objectContaining({ message: expect.stringContaining('Harga satuan item invoice (Rp600) tidak sesuai dengan harga PO (Rp500)') }) });
    });

    it('MATCH-06: Should reject if invoice quantity exceeds remaining billable quantity', async () => {
      const invoice = { 
        id: 1, 
        createdBy: 100, 
        matchStatus: 'PENDING',
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'COMPLETED', items: [{ id: 1, unitPrice: 500, receivedQuantity: 2 }] },
        items: [{ poItemId: 1, unitPrice: 500, quantity: 2 }],
        totalAmount: 1000
      };
      
      const otherInvoice = { id: 2, status: 'VERIFIED', items: [{ poItemId: 1, quantity: 1 }] };
      
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return [otherInvoice];
        return [];
      });

      await expect(service.verifyInvoice(1, { approved: true } as any, 101))
        .rejects
        .toMatchObject({ response: expect.objectContaining({ message: expect.stringContaining('melebihi sisa kapasitas tagih (Diterima: 2, Sudah ditagihkan: 1)') }) });
    });
  });

  describe('FINAL_DELIVERY Gating', () => {
    it('MATCH-07: Should reject if PO is not COMPLETED for FINAL_DELIVERY term', async () => {
      const invoice = { 
        id: 1, 
        poId: 1,
        createdBy: 100, 
        matchStatus: 'PENDING',
        paymentTermId: 1,
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'ISSUED', items: [] },
        totalAmount: 1000
      };
      const term = { id: 1, termType: PaymentTermType.FINAL_DELIVERY, poId: 1, status: PaymentTermStatus.INVOICE_SUBMITTED, amount: 1000, sequence: 1, percentage: 100 };
      
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        if (entity === PoPaymentTerm) return term;
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);

      await expect(service.verifyInvoice(1, { approved: true } as any, 101))
        .rejects
        .toMatchObject({ response: expect.objectContaining({ message: expect.stringContaining('setelah Purchase Order selesai (COMPLETED)') }) });
    });

    it('MATCH-08: Should reject if items not fully received for FINAL_DELIVERY term', async () => {
      const invoice = { 
        id: 1, 
        poId: 1,
        createdBy: 100, 
        matchStatus: 'PENDING',
        paymentTermId: 1,
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'COMPLETED', items: [{ id: 1, quantity: 10, receivedQuantity: 5 }] },
        totalAmount: 1000
      };
      const term = { id: 1, termType: PaymentTermType.FINAL_DELIVERY, poId: 1, status: PaymentTermStatus.INVOICE_SUBMITTED, amount: 1000, sequence: 1, percentage: 100 };
      
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        if (entity === PoPaymentTerm) return term;
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);

      await expect(service.verifyInvoice(1, { approved: true } as any, 101))
        .rejects
        .toMatchObject({ response: expect.objectContaining({ message: expect.stringContaining('masih ada barang yang belum diterima penuh') }) });
    });
  });

  describe('Legacy Total Match', () => {
    it('MATCH-09: Should verify legacy matching by received physical value', async () => {
      const invoice = { 
        id: 1, 
        createdBy: 100, 
        matchStatus: 'PENDING',
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'COMPLETED', items: [{ id: 1, unitPrice: 500, receivedQuantity: 2 }] },
        totalAmount: 1000
      };
      const gr = { id: 1, poId: 1, items: [{ poItemId: 1, receivedQuantity: 2 }] };
      
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        return [];
      });
      mockQueryRunner.manager.save.mockImplementation(async (entity: any, val: any) => val);

      const result = await service.verifyInvoice(1, { approved: true } as any, 101);
      expect(result.matchStatus).toBe('VERIFIED');
    });

    it('MATCH-10: Should reject legacy matching if total does not match physical value', async () => {
      const invoice = { 
        id: 1, 
        createdBy: 100, 
        matchStatus: 'PENDING',
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'COMPLETED', items: [{ id: 1, unitPrice: 500, receivedQuantity: 2 }] },
        totalAmount: 1000
      };
      const gr = { id: 1, poId: 1, items: [{ poItemId: 1, receivedQuantity: 1 }] }; // Only 1 received (value 500)
      
      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        return [];
      });

      await expect(service.verifyInvoice(1, { approved: true } as any, 101))
        .rejects
        .toMatchObject({ response: expect.objectContaining({ message: expect.stringContaining('Nilai tagihan (Rp1.000) tidak sesuai dengan nilai penerimaan barang (Rp500)') }) });
    });
  });

  describe('FINAL_DELIVERY Success & Progress Gating', () => {
    it('MATCH-11: Should verify FINAL_DELIVERY term when PO is COMPLETED and all items fully received', async () => {
      const invoice = { 
        id: 1, 
        poId: 1,
        createdBy: 100, 
        matchStatus: 'PENDING',
        paymentTermId: 1,
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'COMPLETED', items: [{ id: 1, quantity: 2, receivedQuantity: 2, unitPrice: 500 }] },
        totalAmount: 1000
      };
      const term = { id: 1, termType: PaymentTermType.FINAL_DELIVERY, poId: 1, status: PaymentTermStatus.INVOICE_SUBMITTED, amount: 1000, sequence: 1, percentage: 100 };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        if (entity === PoPaymentTerm) return term;
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.save.mockImplementation(async (entity: any, val: any) => val);

      const result = await service.verifyInvoice(1, { approved: true } as any, 101);
      expect(result.matchStatus).toBe('VERIFIED');
      expect(result.paymentTerm.status).toBe(PaymentTermStatus.VERIFIED);
      expect(result.updatedBy).toBe(101);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('MATCH-12: Should reject PROGRESS term if Goods Receipt belongs to a different PO', async () => {
      const invoice = { 
        id: 1, 
        poId: 1,
        createdBy: 100, 
        matchStatus: 'PENDING',
        paymentTermId: 1,
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'ISSUED', items: [{ id: 1, quantity: 2, receivedQuantity: 2, unitPrice: 500 }] },
        totalAmount: 1000
      };
      const term = { id: 1, termType: PaymentTermType.PROGRESS, poId: 1, status: PaymentTermStatus.INVOICE_SUBMITTED, amount: 1000, sequence: 1, percentage: 100 };
      const foreignGr = { id: 99, poId: 2, items: [{ poItemId: 1, receivedQuantity: 2 }] };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        if (entity === PoPaymentTerm) return term;
        if (entity === GoodsReceipt) return foreignGr;
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);

      await expect(service.verifyInvoice(1, { approved: true, goodsReceiptId: 99 } as any, 101))
        .rejects
        .toMatchObject({ response: expect.objectContaining({ message: expect.stringContaining('Goods Receipt bukan milik Purchase Order') }) });
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('MATCH-13: Should reject PROGRESS term if physical billed value exceeds received physical value', async () => {
      const invoice = { 
        id: 1, 
        poId: 1,
        createdBy: 100, 
        matchStatus: 'PENDING',
        paymentTermId: 1,
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'ISSUED', items: [{ id: 1, quantity: 2, receivedQuantity: 1, unitPrice: 500 }] },
        totalAmount: 1000
      };
      const term = { id: 1, termType: PaymentTermType.PROGRESS, poId: 1, status: PaymentTermStatus.INVOICE_SUBMITTED, amount: 1000, sequence: 1, percentage: 100 };
      const gr = { id: 1, poId: 1, items: [{ poItemId: 1, receivedQuantity: 1 }] }; // Received value is only 500

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === Invoice) return invoice;
        if (entity === PoPaymentTerm) return term;
        if (entity === GoodsReceipt) return gr;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        if (entity === Invoice) return [];
        return [];
      });

      await expect(service.verifyInvoice(1, { approved: true, goodsReceiptId: 1 } as any, 101))
        .rejects
        .toMatchObject({ response: expect.objectContaining({ message: expect.stringContaining('melebihi total nilai fisik barang yang telah diterima') }) });
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Transaction Atomicity & AuditLog State Inspection', () => {
    it('MATCH-14: Verification failure must trigger transaction rollback leaving financial state unchanged', async () => {
      const invoice = { 
        id: 1, 
        poId: 1,
        createdBy: 100, 
        matchStatus: 'PENDING',
        paymentTermId: 1,
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 10, status: 'COMPLETED', items: [{ id: 1, unitPrice: 500, receivedQuantity: 2 }] },
        items: [{ poItemId: 1, unitPrice: 999, quantity: 1 }], // Price mismatch
        totalAmount: 1000
      };
      const term = { id: 1, termType: PaymentTermType.FINAL_DELIVERY, poId: 1, status: PaymentTermStatus.INVOICE_SUBMITTED, amount: 1000, sequence: 1, percentage: 100 };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return invoice;
        if (entity === PoPaymentTerm) return term;
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);

      await expect(service.verifyInvoice(1, { approved: true } as any, 101)).rejects.toThrow();

      // State check: rollback called, commit never called, matchStatus remains PENDING
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(invoice.matchStatus).toBe('PENDING');
    });

    it('MATCH-15: Successful verification creates canonical AuditLog with VERIFY action and exact actor', async () => {
      const invoice = { 
        id: 1, 
        poId: 1,
        createdBy: 100, 
        matchStatus: 'PENDING',
        purchaseOrder: { id: 1, totalAmount: 1000, vendorId: 1, status: 'COMPLETED', items: [{ id: 1, unitPrice: 1000, receivedQuantity: 1 }] },
        totalAmount: 1000
      };
      const gr = { id: 1, poId: 1, items: [{ poItemId: 1, receivedQuantity: 1 }] };
      const savedAudits: any[] = [];

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return invoice;
        if (entity === ServiceClaim) return (invoice as any).serviceClaim;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        return [];
      });
      mockQueryRunner.manager.create.mockImplementation((entityClass: any, data: any) => data);
      mockQueryRunner.manager.save.mockImplementation(async (entityOrTarget: any, val?: any) => {
        const target = val !== undefined ? val : entityOrTarget;
        if (target.action === 'VERIFY') {
          savedAudits.push(target);
        }
        return target;
      });

      const result = await service.verifyInvoice(1, { approved: true } as any, 101);

      expect(result.matchStatus).toBe('VERIFIED');
      expect(savedAudits.length).toBe(1);
      expect(savedAudits[0]).toMatchObject({
        table_name: 'invoices',
        record_id: 1,
        action: 'VERIFY',
        created_by: 101,
        new_value: expect.objectContaining({
          matchStatus: 'VERIFIED',
          totalAmount: 1000
        })
      });
    });

    it('MATCH-16: CP1.2 DEF-CP1.2-03: Should verify 3-way match when multi-item invoice and GR have fractional prices that sum with per-item rounding', async () => {
      // 4 items with qty 1.25 and unitPrice 10.01 (product = 12.5125 per line -> rounded = 12.51)
      // Total invoice = 50.04 (4 * 12.51).
      // Previously, unrounded GR accumulation gave 50.05, causing spurious THREE_WAY_MISMATCH because |50.04 - 50.05| < 0.01 evaluated to false.
      const invoice = {
        id: 2,
        poId: 2,
        createdBy: 100,
        matchStatus: 'PENDING',
        purchaseOrder: {
          id: 2,
          totalAmount: 50.04,
          vendorId: 10,
          status: 'COMPLETED',
          items: [
            { id: 21, unitPrice: 10.01, receivedQuantity: 1.25 },
            { id: 22, unitPrice: 10.01, receivedQuantity: 1.25 },
            { id: 23, unitPrice: 10.01, receivedQuantity: 1.25 },
            { id: 24, unitPrice: 10.01, receivedQuantity: 1.25 },
          ],
        },
        totalAmount: 50.04,
      };
      const gr = {
        id: 2,
        poId: 2,
        items: [
          { poItemId: 21, receivedQuantity: 1.25 },
          { poItemId: 22, receivedQuantity: 1.25 },
          { poItemId: 23, receivedQuantity: 1.25 },
          { poItemId: 24, receivedQuantity: 1.25 },
        ],
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return invoice;
        if (entity === ServiceClaim) return (invoice as any).serviceClaim;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        return [];
      });
      mockQueryRunner.manager.save.mockImplementation(async (entity: any, val: any) => val);

      const result = await service.verifyInvoice(2, { approved: true } as any, 101);
      expect(result.matchStatus).toBe('VERIFIED');
    });

    it('MATCH-17: CP1.2-03: Material 3-way match discrepancy of exactly Rp0.01 must fail verification', async () => {
      // Transaction where invoicedAmount = 50.04 and GR items total 50.05 (diff = 0.01)
      const invoice = {
        id: 3,
        poId: 3,
        createdBy: 100,
        matchStatus: 'PENDING',
        purchaseOrder: {
          id: 3,
          totalAmount: 50.04,
          vendorId: 10,
          status: 'COMPLETED',
          items: [
            { id: 31, unitPrice: 50.05, receivedQuantity: 1 },
          ],
        },
        totalAmount: 50.04,
      };
      const gr = {
        id: 3,
        poId: 3,
        items: [
          { poItemId: 31, receivedQuantity: 1 }, // Total GR = 50.05, diff = 0.01
        ],
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return invoice;
        if (entity === ServiceClaim) return (invoice as any).serviceClaim;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        return [];
      });
      mockQueryRunner.manager.save.mockImplementation(async (entity: any, val: any) => val);

      try {
        await service.verifyInvoice(3, { approved: true } as any, 101);
        throw new Error('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = err.getResponse();
        expect(resp.mismatches.some((m: any) => m.code === MismatchCode.THREE_WAY_MISMATCH)).toBe(true);
        expect(resp.message).toContain('3-Way Matching gagal');
      }
      expect(invoice.matchStatus).toBe('MISMATCHED');
    });

    it('MATCH-18: CP1.2-03: Material 3-way match discrepancy greater than Rp0.01 must fail verification', async () => {
      const invoice = {
        id: 4,
        poId: 4,
        createdBy: 100,
        matchStatus: 'PENDING',
        purchaseOrder: {
          id: 4,
          totalAmount: 1000.00,
          vendorId: 10,
          status: 'COMPLETED',
          items: [
            { id: 41, unitPrice: 1050.00, receivedQuantity: 1 },
          ],
        },
        totalAmount: 1000.00,
      };
      const gr = {
        id: 4,
        poId: 4,
        items: [
          { poItemId: 41, receivedQuantity: 1 }, // Total GR = 1050.00, diff = 50.00
        ],
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return invoice;
        if (entity === ServiceClaim) return (invoice as any).serviceClaim;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        return [];
      });
      mockQueryRunner.manager.save.mockImplementation(async (entity: any, val: any) => val);

      try {
        await service.verifyInvoice(4, { approved: true } as any, 101);
        throw new Error('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = err.getResponse();
        expect(resp.mismatches.some((m: any) => m.code === MismatchCode.THREE_WAY_MISMATCH)).toBe(true);
      }
      expect(invoice.matchStatus).toBe('MISMATCHED');
    });

    it('MATCH-19: CP1.2-03: Service PO / Service Claim discrepancy of exactly Rp0.01 must fail verification', async () => {
      const invoice = {
        id: 5,
        poId: 5,
        serviceClaimId: 50,
        createdBy: 100,
        matchStatus: 'PENDING',
        purchaseOrder: {
          id: 5,
          orderType: PurchaseOrderType.SERVICE,
          totalAmount: 1000000.00,
          vendorId: 10,
          status: 'COMPLETED',
          items: [],
        },
        serviceClaim: {
          id: 50,
          poId: 5,
          status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
          approvedClaimAmount: 1000000.01, // Diff = 0.01
        },
        totalAmount: 1000000.00,
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return invoice;
        if (entity === ServiceClaim) return (invoice as any).serviceClaim;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        return [];
      });
      mockQueryRunner.manager.save.mockImplementation(async (entity: any, val: any) => val);

      try {
        await service.verifyInvoice(5, { approved: true } as any, 101);
        throw new Error('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = err.getResponse();
        expect(resp.mismatches.some((m: any) => m.code === MismatchCode.THREE_WAY_MISMATCH)).toBe(true);
        expect(resp.message).toContain('Rekonsiliasi Jasa gagal');
      }
      expect(invoice.matchStatus).toBe('MISMATCHED');
    });

    it('MATCH-20: CP1.2-03: Older-dated transaction with Rp0.01 discrepancy must follow strict reconciliation and must not be silently accepted', async () => {
      // Older-dated transaction (e.g. historical timestamps) with Rp0.01 difference must follow universal strict reconciliation rule without legacy bypass
      const invoice = {
        id: 6,
        poId: 6,
        createdBy: 100,
        matchStatus: 'PENDING',
        createdAt: new Date('2024-01-01'),
        purchaseOrder: {
          id: 6,
          totalAmount: 50000.00,
          vendorId: 10,
          status: 'COMPLETED',
          createdAt: new Date('2023-12-01'),
          items: [
            { id: 61, unitPrice: 50000.01, receivedQuantity: 1 },
          ],
        },
        totalAmount: 50000.00,
      };
      const gr = {
        id: 6,
        poId: 6,
        createdAt: new Date('2023-12-15'),
        items: [
          { poItemId: 61, receivedQuantity: 1 }, // Total GR = 50000.01, diff = 0.01
        ],
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return invoice;
        if (entity === ServiceClaim) return (invoice as any).serviceClaim;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [gr];
        return [];
      });
      mockQueryRunner.manager.save.mockImplementation(async (entity: any, val: any) => val);

      try {
        await service.verifyInvoice(6, { approved: true } as any, 101);
        throw new Error('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = err.getResponse();
        expect(resp.mismatches.some((m: any) => m.code === MismatchCode.THREE_WAY_MISMATCH)).toBe(true);
      }
      expect(invoice.matchStatus).toBe('MISMATCHED');
    });

    it('MATCH-21: CP1.2-03: Exact monetary match on Material PO and Service PO must verify successfully', async () => {
      // Material PO with exact matching amounts
      const matInvoice = {
        id: 7,
        poId: 7,
        createdBy: 100,
        matchStatus: 'PENDING',
        purchaseOrder: {
          id: 7,
          totalAmount: 50.04,
          vendorId: 10,
          status: 'COMPLETED',
          items: [
            { id: 71, unitPrice: 50.04, receivedQuantity: 1 },
          ],
        },
        totalAmount: 50.04,
      };
      const matGr = {
        id: 7,
        poId: 7,
        items: [
          { poItemId: 71, receivedQuantity: 1 },
        ],
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return matInvoice;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        if (entity === GoodsReceipt) return [matGr];
        return [];
      });
      mockQueryRunner.manager.save.mockImplementation(async (entity: any, val: any) => val);

      const matResult = await service.verifyInvoice(7, { approved: true } as any, 101);
      expect(matResult.matchStatus).toBe('VERIFIED');

      // Service PO with exact matching amounts
      const srvInvoice = {
        id: 8,
        poId: 8,
        serviceClaimId: 80,
        createdBy: 100,
        matchStatus: 'PENDING',
        purchaseOrder: {
          id: 8,
          orderType: PurchaseOrderType.SERVICE,
          totalAmount: 1000000.00,
          vendorId: 10,
          status: 'COMPLETED',
          items: [],
        },
        serviceClaim: {
          id: 80,
          poId: 8,
          status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
          approvedClaimAmount: 1000000.00,
        },
        totalAmount: 1000000.00,
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entity: any) => {
        if (entity === Invoice) return srvInvoice;
        if (entity === ServiceClaim) return srvInvoice.serviceClaim;
        return null;
      });
      mockQueryRunner.manager.find.mockImplementation(async (entity: any) => {
        return [];
      });

      const srvResult = await service.verifyInvoice(8, { approved: true } as any, 101);
      expect(srvResult.matchStatus).toBe('VERIFIED');
    });
  });
});
