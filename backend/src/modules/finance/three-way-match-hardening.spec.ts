import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { PoPaymentTerm, PaymentTermStatus, PaymentTermType } from '../../entities/po-payment-term.entity';
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
  });
});
