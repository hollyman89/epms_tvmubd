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
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MismatchCode } from './finance.types';
import { AuditLog } from '../../entities/audit-log.entity';
import { PaymentRequest, PaymentRequestStatus } from '../../entities/payment-request.entity';

describe('FinanceService', () => {
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
        { provide: getRepositoryToken(Invoice), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Payment), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(PurchaseOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. LEGACY FULL PO INVOICE TESTS
  describe('createInvoice - Legacy / Full PO', () => {
    it('should throw error if PO not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
      await expect(
        service.createInvoice({ purchaseOrderId: 1, invoiceDate: '2026-07-20', items: [] }, 1)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if PO status is not COMPLETED for legacy invoice', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({ id: 1, status: 'PENDING' });
      mockQueryRunner.manager.count.mockResolvedValue(0);
      await expect(
        service.createInvoice({ purchaseOrderId: 1, invoiceDate: '2026-07-20', items: [] }, 1)
      ).rejects.toThrow('Invoice can only be created for COMPLETED Purchase Orders');
    });

    it('should successfully create legacy invoice for COMPLETED PO (100% matched)', async () => {
      const mockPo = {
        id: 1,
        status: 'COMPLETED',
        totalAmount: 100,
        items: [{ id: 1, itemName: 'Test Item', quantity: 1, unitPrice: 100 }],
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockPo) // PO lookup
        .mockResolvedValueOnce(null);  // invoice candidate check
      mockQueryRunner.manager.count.mockResolvedValueOnce(0); // count for invoice number
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => {
        const target = entity || entityOrTarget;
        if (!target.id) target.id = 1;
        return target;
      });

      const mockGr = {
        id: 1,
        status: 'DELIVERED',
        items: [{ poItemId: 1, receivedQuantity: 1 }],
      };
      mockQueryRunner.manager.find.mockResolvedValue([mockGr]); // For GR check

      const dto = {
        purchaseOrderId: 1,
        invoiceDate: '2026-07-20',
        items: [{ poItemId: 1, quantity: 1, unitPrice: 100, totalPrice: 100 }],
      };
      const result = await service.createInvoice(dto, 1);

      expect(result).toHaveProperty('invoiceNumber');
      expect(result.totalAmount).toBe(100);
      expect(result.matchStatus).toBe('MATCHED');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  // 2. TERM-BASED INVOICE ENGINE (PHASE 7E-D-2 MANDATORY TESTS A -> R)
  describe('createInvoice - Term-Based Engine (Phase 7E-D-2)', () => {
    const baselinePo = {
      id: 1,
      poNumber: 'PO-20260904-001',
      status: 'ISSUED',
      totalAmount: 100479990,
      items: [{ id: 10, itemName: 'Main Goods', quantity: 1, unitPrice: 100479990 }],
    };

    const term1Dp = {
      id: 101,
      poId: 1,
      sequence: 1,
      termName: 'Termin 1 — DP — 30%',
      termType: PaymentTermType.DOWN_PAYMENT,
      percentage: 30.00,
      amount: 30143997,
      status: PaymentTermStatus.PENDING,
      isRetention: false,
      deletedAt: null,
    };

    it('A. DP term invoice valid: PO ISSUED, Term DP 30% -> invoice created, amount = 30143997, term = INVOICE_SUBMITTED', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo, status: 'ISSUED' }) // PO find
        .mockResolvedValueOnce(null) // invoiceNumber candidate check
        .mockResolvedValueOnce({ ...term1Dp }) // paymentTerm find
        .mockResolvedValueOnce(null); // active invoice check for term
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]); // activeInvoices for PO
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => {
        const target = entity || entityOrTarget;
        if (!target.id) target.id = 1;
        return target;
      });

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      const result = await service.createInvoice(dto, 99);

      expect(result).toBeDefined();
      expect(result.poId).toBe(1);
      expect(result.paymentTermId).toBe(101);
      expect(result.totalAmount).toBe(30143997);
      expect(result.matchStatus).toBe('PENDING');
      expect(result.paymentStatus).toBe('UNPAID');
      expect(result.status).toBe('UNPAID');
      expect(result.createdBy).toBe(99);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('B. DP does not require GR 100%: succeeds even when GR is zero', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo, status: 'ISSUED' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]); // zero invoices
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      const result = await service.createInvoice(dto, 1);
      expect(result.totalAmount).toBe(30143997);
      // GoodsReceipt is never queried or required for DP
      expect(mockQueryRunner.manager.find).toHaveBeenCalledWith(Invoice, { where: { poId: 1 } });
    });

    it('C. PO not eligible for term invoice (e.g. DRAFT or CANCELLED) -> REJECT', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo, status: 'DRAFT' })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      await expect(service.createInvoice(dto, 1)).rejects.toThrow(
        /Invoice termin tidak dapat dibuat untuk Purchase Order dengan status DRAFT/
      );
    });

    it('D. Payment term not found -> REJECT', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo, status: 'ISSUED' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null); // Term not found
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 999,
        invoiceDate: '2026-09-04',
      };

      await expect(service.createInvoice(dto, 1)).rejects.toThrow('Payment term tidak ditemukan.');
    });

    it('E. Payment term belongs to another PO -> REJECT', async () => {
      const foreignTerm = { ...term1Dp, id: 101, poId: 999 }; // Belongs to PO 999
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo, id: 1 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(foreignTerm);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      await expect(service.createInvoice(dto, 1)).rejects.toThrow('Payment term bukan milik Purchase Order ini.');
    });

    it('F. Payment term soft deleted -> REJECT', async () => {
      const deletedTerm = { ...term1Dp, deletedAt: new Date() };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(deletedTerm);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      await expect(service.createInvoice(dto, 1)).rejects.toThrow('Payment term tidak ditemukan.');
    });

    it('G. Payment term already has an active invoice -> REJECT', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp })
        .mockResolvedValueOnce({ id: 50, invoiceNumber: 'INV-20260904-001', status: 'UNPAID', deletedAt: null }); // existing active invoice
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      await expect(service.createInvoice(dto, 1)).rejects.toThrow('Payment term sudah memiliki invoice aktif.');
    });

    it('H. Client sends fake amount -> server strictly uses paymentTerm.amount', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
        items: [{ poItemId: 10, quantity: 1, unitPrice: 99999999, totalPrice: 99999999 }],
      };

      const result = await service.createInvoice(dto, 1);
      // Even if item totalPrice was 99,999,999, invoice.totalAmount is authoritative from paymentTerm.amount
      expect(result.totalAmount).toBe(30143997);
    });

    it('I. Client sends smaller item amount -> invoice totalAmount remains paymentTerm.amount', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
        items: [{ poItemId: 10, quantity: 1, unitPrice: 15000000, totalPrice: 15000000 }],
      };

      const result = await service.createInvoice(dto, 1);
      expect(result.totalAmount).toBe(30143997);
    });

    it('J. Client sends larger item amount -> does not over-bill, strictly uses paymentTerm.amount', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
        items: [{ poItemId: 10, quantity: 1, unitPrice: 50000000, totalPrice: 50000000 }],
      };

      const result = await service.createInvoice(dto, 1);
      expect(result.totalAmount).toBe(30143997);
    });

    it('K. Legacy invoice without paymentTermId -> existing behavior passes', async () => {
      const mockPo = {
        id: 1,
        status: 'COMPLETED',
        totalAmount: 100479990,
        items: [{ id: 1, itemName: 'Test Item', quantity: 1, unitPrice: 100479990 }],
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockPo)
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const mockGr = {
        id: 1,
        status: 'DELIVERED',
        items: [{ poItemId: 1, receivedQuantity: 1 }],
      };
      mockQueryRunner.manager.find.mockResolvedValue([mockGr]);

      const dto = {
        purchaseOrderId: 1,
        invoiceDate: '2026-09-04',
        items: [{ poItemId: 1, quantity: 1, unitPrice: 100479990, totalPrice: 100479990 }],
      };
      const result = await service.createInvoice(dto, 1);

      expect(result.paymentTermId).toBeUndefined();
      expect(result.totalAmount).toBe(100479990);
      expect(result.matchStatus).toBe('MATCHED');
    });

    it('L. Sum of active term invoices + current term > PO total -> REJECT', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo, totalAmount: 100000000 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp, amount: 30000000 })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      // Existing active invoices sum to 80,000,000. 80M + 30M = 110M > 100M PO!
      const activeInvoices = [
        { id: 1, totalAmount: 50000000, status: 'UNPAID', deletedAt: null },
        { id: 2, totalAmount: 30000000, status: 'UNPAID', deletedAt: null },
      ];
      mockQueryRunner.manager.find.mockResolvedValueOnce(activeInvoices);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      await expect(service.createInvoice(dto, 1)).rejects.toThrow(
        'Akumulasi nilai invoice melebihi total Purchase Order.'
      );
    });

    it('M. Concurrent create for one term -> only one active invoice allowed', async () => {
      // First attempt succeeds
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      const result1 = await service.createInvoice(dto, 1);
      expect(result1).toBeDefined();

      // Second attempt finds active invoice
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp })
        .mockResolvedValueOnce({ id: 1, status: 'UNPAID', deletedAt: null }); // active invoice exists!
      mockQueryRunner.manager.count.mockResolvedValueOnce(1);

      await expect(service.createInvoice(dto, 2)).rejects.toThrow('Payment term sudah memiliki invoice aktif.');
    });

    it('N. Transaction rollback when error occurs during invoice creation', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockRejectedValueOnce(new Error('Database disk error'));

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      await expect(service.createInvoice(dto, 1)).rejects.toThrow('Database disk error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('O. Invoice creation does NOT change term status to VERIFIED or PAID (stays INVOICE_SUBMITTED)', async () => {
      let savedTermStatus = '';
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((target, entity) => {
        if (target === PoPaymentTerm || entity?.sequence) {
          savedTermStatus = (entity || target).status;
        }
        return entity || target;
      });

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      await service.createInvoice(dto, 1);
      expect(savedTermStatus).toBe(PaymentTermStatus.INVOICE_SUBMITTED);
      expect(savedTermStatus).not.toBe(PaymentTermStatus.VERIFIED);
      expect(savedTermStatus).not.toBe(PaymentTermStatus.PAID);
    });

    it('P. Invoice amount never takes from PR estimated amount (uses PO term amount)', async () => {
      // PO total is 100M, PR might be 170M. Invoice amount must be strictly 30143997 from paymentTerm.amount
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term1Dp })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 101,
        invoiceDate: '2026-09-04',
      };

      const result = await service.createInvoice(dto, 1);
      expect(result.totalAmount).toBe(30143997);
      expect(result.totalAmount).not.toBe(170000000);
    });

    it('Q. Retention term invoice: requires COMPLETED PO, amount = paymentTerm.amount', async () => {
      const retentionTerm = {
        id: 104,
        poId: 1,
        sequence: 4,
        termName: 'Termin 4 — Retensi — 10%',
        termType: PaymentTermType.RETENTION,
        percentage: 10.00,
        amount: 10047999,
        status: PaymentTermStatus.PENDING,
        isRetention: true,
        deletedAt: null,
      };

      // Case Q1: PO is ISSUED -> Retention is rejected
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo, status: 'ISSUED' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(retentionTerm);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 104,
        invoiceDate: '2026-09-04',
      };

      await expect(service.createInvoice(dto, 1)).rejects.toThrow(
        'Termin retensi hanya dapat ditagihkan setelah Purchase Order selesai (COMPLETED).'
      );

      // Case Q2: PO is COMPLETED -> Retention is accepted with exact amount
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo, status: 'COMPLETED' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(retentionTerm)
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.createInvoice(dto, 1);
      expect(result.totalAmount).toBe(10047999);
      expect(result.paymentTermId).toBe(104);
    });

    it('R. Progress term invoice: amount = paymentTerm.amount', async () => {
      const progressTerm = {
        id: 102,
        poId: 1,
        sequence: 2,
        termName: 'Termin 2 — Progress — 30%',
        termType: PaymentTermType.PROGRESS,
        percentage: 30.00,
        amount: 30143997,
        status: PaymentTermStatus.PENDING,
        isRetention: false,
        deletedAt: null,
      };

      const mockGr = {
        id: 1,
        grNumber: 'GR-20260908-001',
        poId: 1,
        deletedAt: null,
        items: [{ id: 1, grId: 1, poItemId: 10, receivedQuantity: 1 }],
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...baselinePo, status: 'PARTIALLY_FULFILLED' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(progressTerm)
        .mockResolvedValueOnce(mockGr)
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockGr])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 102,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-04',
      };

      const result = await service.createInvoice(dto, 1);
      expect(result.totalAmount).toBe(30143997);
      expect(result.paymentTermId).toBe(102);
    });
  });

  // 3. PAYMENT TESTS
  describe('createPayment & Payment Engine (Phase 7E-D-4)', () => {
    const defaultInvoice = {
      id: 1,
      invoiceNumber: 'INV-20260904-001',
      poId: 1,
      paymentTermId: null,
      matchStatus: 'MATCHED',
      paymentStatus: 'UNPAID',
      totalAmount: 100,
      version: 1,
      deletedAt: null,
      updatedBy: null,
    };

    const defaultPo = {
      id: 1,
      poNumber: 'PO-20260904-001',
      totalAmount: 100,
      deletedAt: null,
    };

    const setupPaymentMocks = ({
      invoice = defaultInvoice as any,
      po = null as any,
      existingPayments = [] as any[],
      paymentTerm = null as any,
      existingPoPayments = [] as any[],
      count = 0,
      existingPaymentNumber = null as string | null,
      verifyAuditLog = null as any,
      paymentRequest = null as any,
    } = {}) => {
      const resolvedPo = po !== null ? po : {
        id: invoice.poId || 1,
        poNumber: 'PO-20260904-001',
        totalAmount: Math.max(100479990, Number(invoice.totalAmount || 0)),
        deletedAt: null,
      };

      const resolvedPrq = paymentRequest !== null ? paymentRequest : {
        id: 100,
        invoiceId: invoice.id || 1,
        status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
        approvedBy: 999, // Checker is different from maker (10)
        requestedAmount: 50,
        deletedAt: null,
      };

      mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any, options: any) => {
        if (entityClass === Invoice) return invoice;
        if (entityClass === PaymentRequest) return resolvedPrq;
        if (entityClass === AuditLog) return verifyAuditLog;
        if (entityClass === PurchaseOrder) return resolvedPo;
        if (entityClass === PoPaymentTerm) return paymentTerm;
        if (entityClass === Payment) {
          if (existingPaymentNumber && options?.where?.paymentNumber === existingPaymentNumber) {
            return { id: 999, paymentNumber: existingPaymentNumber };
          }
          return null;
        }
        return null;
      });

      mockQueryRunner.manager.find.mockImplementation(async (entityClass: any, options: any) => {
        if (entityClass === Payment) {
          if (options?.where?.invoiceId && typeof options.where.invoiceId === 'number') {
            return existingPayments;
          }
          return existingPoPayments.length > 0 ? existingPoPayments : existingPayments;
        }
        if (entityClass === Invoice) {
          return [invoice];
        }
        return [];
      });

      mockQueryRunner.manager.count.mockResolvedValue(count);
      mockQueryRunner.manager.save.mockImplementation((entityOrClass: any, entity?: any) => {
        const obj = entity || entityOrClass;
        if (!obj.id) obj.id = 1;
        return obj;
      });
    };

    const makeDto = (overrides: any = {}): any => ({
      invoiceId: 1,
      paymentRequestId: 100,
      paymentAmount: 50,
      paymentDate: '2026-09-08',
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'REF-123456',
      ...overrides,
    });

    it('should throw error if Invoice not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
      await expect(service.createPayment(makeDto({ paymentAmount: 100 }), 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if Invoice is already PAID', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({ matchStatus: 'MATCHED', paymentStatus: 'PAID' });
      await expect(service.createPayment(makeDto({ paymentAmount: 100 }), 1)).rejects.toThrow(BadRequestException);
    });

    it('should create payment and update invoice successfully', async () => {
      const mockInvoice = { id: 1, poId: 1, matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 100, version: 1 };
      setupPaymentMocks({ invoice: mockInvoice });
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.save.mockResolvedValue({});

      const dto = makeDto({ paymentAmount: 100 });
      const result = await service.createPayment(dto, 1);

      expect(result).toHaveProperty('paymentNumber');
      expect(mockInvoice.paymentStatus).toBe('PAID');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle OptimisticLockVersionMismatchError gracefully', async () => {
      const mockInvoice = { id: 1, poId: 1, matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 100, version: 1 };
      setupPaymentMocks({ invoice: mockInvoice });
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const error = new Error('OptimisticLockVersionMismatchError');
      error.name = 'OptimisticLockVersionMismatchError';
      mockQueryRunner.manager.save.mockRejectedValueOnce(error);

      const dto = makeDto({ paymentAmount: 100 });
      await expect(service.createPayment(dto, 1)).rejects.toThrow(
        'Data invoice telah berubah atau sedang diproses oleh pengguna lain. Silakan refresh halaman.'
      );
    });

    describe('BYP-01 Finance Payment Approval Bypass Prevention', () => {
      it('should reject payment execution without PaymentRequest (missing paymentRequestId)', async () => {
        const inv = { ...defaultInvoice, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID' };
        setupPaymentMocks({ invoice: inv });
        const dto = makeDto();
        delete dto.paymentRequestId;
        await expect(service.createPayment(dto, 10)).rejects.toThrow(
          'Payment Request ID wajib disertakan untuk eksekusi pembayaran.'
        );
      });

      it('should reject payment if PaymentRequest does not exist', async () => {
        const inv = { ...defaultInvoice, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID' };
        setupPaymentMocks({ invoice: inv });
        mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
          if (entityClass === Invoice) return inv;
          if (entityClass === PaymentRequest) return null;
          return null;
        });
        await expect(service.createPayment(makeDto({ paymentRequestId: 999 }), 10)).rejects.toThrow(
          'Payment Request tidak ditemukan.'
        );
      });

      it('should reject payment if PaymentRequest belongs to different invoice', async () => {
        const inv = { ...defaultInvoice, id: 1, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID' };
        const prqMismatch = {
          id: 100,
          invoiceId: 999,
          status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
          approvedBy: 2,
        };
        setupPaymentMocks({ invoice: inv, paymentRequest: prqMismatch });
        await expect(service.createPayment(makeDto({ invoiceId: 1, paymentRequestId: 100 }), 10)).rejects.toThrow(
          'Payment Request tidak sesuai dengan invoice yang dituju.'
        );
      });

      it('should reject payment if PaymentRequest is DRAFT', async () => {
        const inv = { ...defaultInvoice, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID' };
        const prqDraft = {
          id: 100,
          invoiceId: inv.id,
          status: 'DRAFT' as any,
          approvedBy: null,
        };
        setupPaymentMocks({ invoice: inv, paymentRequest: prqDraft });
        await expect(service.createPayment(makeDto({ paymentRequestId: 100 }), 10)).rejects.toThrow(
          'Pembayaran ditolak: Payment Request belum disetujui oleh Direktur (APPROVED_FOR_PAYMENT).'
        );
      });

      it('should reject payment if PaymentRequest is REJECTED', async () => {
        const inv = { ...defaultInvoice, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID' };
        const prqRejected = {
          id: 100,
          invoiceId: inv.id,
          status: PaymentRequestStatus.REJECTED,
          approvedBy: null,
        };
        setupPaymentMocks({ invoice: inv, paymentRequest: prqRejected });
        await expect(service.createPayment(makeDto({ paymentRequestId: 100 }), 10)).rejects.toThrow(
          'Pembayaran ditolak: Payment Request belum disetujui oleh Direktur (APPROVED_FOR_PAYMENT).'
        );
      });

      it('should reject payment if PaymentRequest is PENDING_DIRECTOR_APPROVAL', async () => {
        const inv = { ...defaultInvoice, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID' };
        const prqPending = {
          id: 100,
          invoiceId: inv.id,
          status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
          approvedBy: null,
        };
        setupPaymentMocks({ invoice: inv, paymentRequest: prqPending });
        await expect(service.createPayment(makeDto({ paymentRequestId: 100 }), 10)).rejects.toThrow(
          'Pembayaran ditolak: Payment Request belum disetujui oleh Direktur (APPROVED_FOR_PAYMENT).'
        );
      });

      it('should reject payment if PaymentRequest is NEEDS_REVISION', async () => {
        const inv = { ...defaultInvoice, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID' };
        const prqRevision = {
          id: 100,
          invoiceId: inv.id,
          status: PaymentRequestStatus.NEEDS_REVISION,
          approvedBy: null,
        };
        setupPaymentMocks({ invoice: inv, paymentRequest: prqRevision });
        await expect(service.createPayment(makeDto({ paymentRequestId: 100 }), 10)).rejects.toThrow(
          'Pembayaran ditolak: Payment Request belum disetujui oleh Direktur (APPROVED_FOR_PAYMENT).'
        );
      });

      it('should reject payment if PaymentRequest is already PAID (duplicate payment protection)', async () => {
        const inv = { ...defaultInvoice, matchStatus: 'VERIFIED', paymentStatus: 'PARTIALLY_PAID', totalAmount: 100 };
        const prqPaid = {
          id: 100,
          invoiceId: inv.id,
          status: PaymentRequestStatus.PAID,
          approvedBy: 2,
        };
        setupPaymentMocks({ invoice: inv, paymentRequest: prqPaid });
        await expect(service.createPayment(makeDto({ paymentRequestId: 100 }), 10)).rejects.toThrow(
          'Pembayaran ditolak: Payment Request sudah dibayar (PAID).'
        );
      });

      it('should reject payment if executor is the same as the Director checker who approved (SoD)', async () => {
        const inv = { ...defaultInvoice, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID' };
        const prqApproved = {
          id: 100,
          invoiceId: inv.id,
          status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
          approvedBy: 2,
        };
        setupPaymentMocks({ invoice: inv, paymentRequest: prqApproved });
        await expect(service.createPayment(makeDto({ paymentRequestId: 100 }), 2)).rejects.toThrow(
          'Prinsip Segregation of Duties (SoD) melarang penyetuju Payment Request (Checker/Direktur) mengeksekusi pembayaran.'
        );
      });

      it('should allow payment execution when PaymentRequest is APPROVED_FOR_PAYMENT and executor is independent', async () => {
        const inv = { ...defaultInvoice, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID', totalAmount: 100 };
        const prqApproved = {
          id: 100,
          invoiceId: inv.id,
          status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
          approvedBy: 2,
        };
        setupPaymentMocks({ invoice: inv, paymentRequest: prqApproved });
        const result = await service.createPayment(makeDto({ paymentAmount: 100 }), 3);
        expect(result.paymentNumber).toBeDefined();
        expect(prqApproved.status).toBe(PaymentRequestStatus.PAID);
        expect(inv.paymentStatus).toBe('PAID');
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      });
    });

    // Test A: MATCHED invoice can pay
    it('Test A: MATCHED invoice can pay', async () => {
      const inv = { ...defaultInvoice, matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 100 };
      setupPaymentMocks({ invoice: inv });
      const result = await service.createPayment(makeDto({ paymentAmount: 50 }), 10);
      expect(result.paymentNumber).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    // Test B: VERIFIED invoice can pay
    it('Test B: VERIFIED invoice can pay', async () => {
      const inv = { ...defaultInvoice, matchStatus: 'VERIFIED', paymentStatus: 'UNPAID', totalAmount: 100 };
      setupPaymentMocks({ invoice: inv });
      const result = await service.createPayment(makeDto({ paymentAmount: 50 }), 10);
      expect(result.paymentNumber).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    // Test C: MISMATCH invoice rejected
    it('Test C: MISMATCH invoice rejected', async () => {
      const inv = { ...defaultInvoice, matchStatus: 'MISMATCH', paymentStatus: 'UNPAID' };
      setupPaymentMocks({ invoice: inv });
      await expect(service.createPayment(makeDto({ paymentAmount: 50 }), 10)).rejects.toThrow(
        'Invoice belum disetujui untuk pembayaran'
      );
    });

    // Test D: UNVERIFIED invoice rejected
    it('Test D: UNVERIFIED invoice rejected (PENDING matchStatus)', async () => {
      const inv = { ...defaultInvoice, matchStatus: 'PENDING', paymentStatus: 'UNPAID' };
      setupPaymentMocks({ invoice: inv });
      await expect(service.createPayment(makeDto({ paymentAmount: 50 }), 10)).rejects.toThrow(
        'Invoice belum disetujui untuk pembayaran'
      );
    });

    // Test E: First full payment -> PAID
    it('Test E: First full payment -> PAID', async () => {
      const inv = { ...defaultInvoice, totalAmount: 100000 };
      setupPaymentMocks({ invoice: inv });
      await service.createPayment(makeDto({ paymentAmount: 100000 }), 10);
      expect(inv.paymentStatus).toBe('PAID');
    });

    // Test F: First partial payment -> PARTIALLY_PAID
    it('Test F: First partial payment -> PARTIALLY_PAID', async () => {
      const inv = { ...defaultInvoice, totalAmount: 30143997 };
      setupPaymentMocks({ invoice: inv });
      await service.createPayment(makeDto({ paymentAmount: 10000000 }), 10);
      expect(inv.paymentStatus).toBe('PARTIALLY_PAID');
    });

    // Test G: second payment -> PAID
    it('Test G: second payment -> PAID', async () => {
      const inv = { ...defaultInvoice, totalAmount: 30143997, paymentStatus: 'PARTIALLY_PAID' };
      setupPaymentMocks({
        invoice: inv,
        existingPayments: [{ id: 1, amount: 10000000, deletedAt: null }],
      });
      await service.createPayment(makeDto({ paymentAmount: 20143997 }), 10);
      expect(inv.paymentStatus).toBe('PAID');
    });

    // Test H: second payment exceeding outstanding -> rejected
    it('Test H: second payment exceeding outstanding -> rejected', async () => {
      const inv = { ...defaultInvoice, totalAmount: 30143997, paymentStatus: 'PARTIALLY_PAID' };
      setupPaymentMocks({
        invoice: inv,
        existingPayments: [{ id: 1, amount: 10000000, deletedAt: null }],
      });
      await expect(service.createPayment(makeDto({ paymentAmount: 25000000 }), 10)).rejects.toThrow(
        'melebihi sisa tagihan invoice'
      );
    });

    // Test I: multiple partial payments cumulative correct
    it('Test I: multiple partial payments cumulative correct', async () => {
      const inv = { ...defaultInvoice, totalAmount: 50000000, paymentStatus: 'PARTIALLY_PAID' };
      setupPaymentMocks({
        invoice: inv,
        existingPayments: [
          { id: 1, amount: 10000000, deletedAt: null },
          { id: 2, amount: 15000000, deletedAt: null },
        ],
      });
      await service.createPayment(makeDto({ paymentAmount: 10000000 }), 10);
      expect(inv.paymentStatus).toBe('PARTIALLY_PAID');
    });

    // Test J: zero payment rejected
    it('Test J: zero payment rejected', async () => {
      setupPaymentMocks();
      await expect(service.createPayment(makeDto({ paymentAmount: 0 }), 10)).rejects.toThrow(
        'Payment amount harus lebih besar dari 0'
      );
    });

    // Test K: negative payment rejected
    it('Test K: negative payment rejected', async () => {
      setupPaymentMocks();
      await expect(service.createPayment(makeDto({ paymentAmount: -5000 }), 10)).rejects.toThrow(
        'Payment amount harus lebih besar dari 0'
      );
    });

    // Test L: exact remaining payment accepted
    it('Test L: exact remaining payment accepted', async () => {
      const inv = { ...defaultInvoice, totalAmount: 30143997, paymentStatus: 'PARTIALLY_PAID' };
      setupPaymentMocks({
        invoice: inv,
        existingPayments: [{ id: 1, amount: 10000000, deletedAt: null }],
      });
      const result = await service.createPayment(makeDto({ paymentAmount: 20143997 }), 10);
      expect(result).toBeDefined();
      expect(inv.paymentStatus).toBe('PAID');
    });

    // Test M: PaymentTerm VERIFIED -> PAID upon full payment
    it('Test M: PaymentTerm VERIFIED -> PAID', async () => {
      const inv = { ...defaultInvoice, totalAmount: 30143997, paymentTermId: 101, createdBy: 42 };
      const term = { id: 101, status: PaymentTermStatus.VERIFIED, updatedBy: null };
      const verifyAudit = {
        id: 1,
        table_name: 'invoices',
        record_id: 1,
        action: 'VERIFY',
        created_by: 99, // CHECKER_ID != MAKER_ID (42)
      };
      setupPaymentMocks({ invoice: inv, paymentTerm: term, verifyAuditLog: verifyAudit });
      await service.createPayment(makeDto({ paymentAmount: 30143997 }), 42);
      expect(term.status).toBe(PaymentTermStatus.PAID);
      expect(term.updatedBy).toBe(42);
    });

    // Test N: PaymentTerm PENDING rejected
    it('Test N: PaymentTerm PENDING rejected', async () => {
      const inv = { ...defaultInvoice, totalAmount: 30143997, paymentTermId: 101, createdBy: 10 };
      const term = { id: 101, status: PaymentTermStatus.PENDING };
      const verifyAudit = {
        id: 1,
        table_name: 'invoices',
        record_id: 1,
        action: 'VERIFY',
        created_by: 99, // CHECKER_ID != MAKER_ID (10)
      };
      setupPaymentMocks({ invoice: inv, paymentTerm: term, verifyAuditLog: verifyAudit });
      await expect(service.createPayment(makeDto({ paymentAmount: 30143997 }), 10)).rejects.toThrow(
        'Pembayaran termin hanya dapat diproses untuk termin berstatus VERIFIED'
      );
    });

    // Test O: PaymentTerm INVOICE_SUBMITTED rejected
    it('Test O: PaymentTerm INVOICE_SUBMITTED rejected', async () => {
      const inv = { ...defaultInvoice, totalAmount: 30143997, paymentTermId: 101, createdBy: 10 };
      const term = { id: 101, status: PaymentTermStatus.INVOICE_SUBMITTED };
      const verifyAudit = {
        id: 1,
        table_name: 'invoices',
        record_id: 1,
        action: 'VERIFY',
        created_by: 99, // CHECKER_ID != MAKER_ID (10)
      };
      setupPaymentMocks({ invoice: inv, paymentTerm: term, verifyAuditLog: verifyAudit });
      await expect(service.createPayment(makeDto({ paymentAmount: 30143997 }), 10)).rejects.toThrow(
        'Pembayaran termin hanya dapat diproses untuk termin berstatus VERIFIED'
      );
    });

    // Test P: legacy invoice without paymentTerm still works
    it('Test P: legacy invoice without paymentTerm still works', async () => {
      const inv = { ...defaultInvoice, paymentTermId: null, totalAmount: 50000 };
      setupPaymentMocks({ invoice: inv, paymentTerm: null });
      const result = await service.createPayment(makeDto({ paymentAmount: 50000 }), 10);
      expect(result).toBeDefined();
      expect(inv.paymentStatus).toBe('PAID');
    });

    // Test Q: PO-level overpayment rejected
    it('Test Q: PO-level overpayment rejected', async () => {
      const po = { id: 1, totalAmount: 100479990 };
      const inv = { ...defaultInvoice, poId: 1, totalAmount: 30143997 };
      setupPaymentMocks({
        invoice: inv,
        po,
        existingPayments: [],
        existingPoPayments: [{ id: 1, amount: 90000000, deletedAt: null }],
      });
      await expect(service.createPayment(makeDto({ paymentAmount: 11000000 }), 10)).rejects.toThrow(
        'Akumulasi pembayaran PO (101000000) melebihi total Purchase Order (100479990)'
      );
    });

    // Test R: PO-level cumulative payment calculated correctly
    it('Test R: PO-level cumulative payment calculated correctly', async () => {
      const po = { id: 1, totalAmount: 100479990 };
      const inv = { ...defaultInvoice, poId: 1, totalAmount: 30143997 };
      setupPaymentMocks({
        invoice: inv,
        po,
        existingPayments: [],
        existingPoPayments: [{ id: 1, amount: 90000000, deletedAt: null }],
      });
      const result = await service.createPayment(makeDto({ paymentAmount: 10000000 }), 10);
      expect(result).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    // Test S: concurrent payment uses pessimistic lock
    it('Test S: concurrent payment uses pessimistic lock', async () => {
      const inv = { ...defaultInvoice, paymentTermId: 101, createdBy: 10 };
      const term = { id: 101, status: PaymentTermStatus.VERIFIED };
      const verifyAudit = {
        id: 1,
        table_name: 'invoices',
        record_id: 1,
        action: 'VERIFY',
        created_by: 99, // CHECKER_ID != MAKER_ID (10)
      };
      setupPaymentMocks({ invoice: inv, paymentTerm: term, verifyAuditLog: verifyAudit });
      await service.createPayment(makeDto({ paymentAmount: 50 }), 10);

      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(
        Invoice,
        expect.objectContaining({
          lock: { mode: 'pessimistic_write' },
        })
      );
      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(
        PoPaymentTerm,
        expect.objectContaining({
          lock: { mode: 'pessimistic_write' },
        })
      );
    });

    // Test T: duplicate payment number retries
    it('Test T: duplicate payment number retries', async () => {
      let callCount = 0;
      mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any, options: any) => {
        if (entityClass === Invoice) return defaultInvoice;
        if (entityClass === PaymentRequest) {
          return {
            id: 100,
            invoiceId: defaultInvoice.id,
            status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
            approvedBy: 999,
            deletedAt: null,
          };
        }
        if (entityClass === PurchaseOrder) return defaultPo;
        if (entityClass === Payment) {
          callCount++;
          if (callCount === 1) {
            return { id: 88, paymentNumber: options?.where?.paymentNumber };
          }
          return null;
        }
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.count.mockResolvedValue(0);
      mockQueryRunner.manager.save.mockImplementation((entityOrClass: any, entity?: any) => entity || entityOrClass);

      const result = await service.createPayment(makeDto({ paymentAmount: 50 }), 10);
      expect(result.paymentNumber).toBe('PAY-20260908-002');
    });

    // Test U: createdBy from JWT
    it('Test U: createdBy from JWT', async () => {
      let savedPayment: any = null;
      setupPaymentMocks();
      mockQueryRunner.manager.save.mockImplementation(async (entityClass: any, entity: any) => {
        const target = entity || entityClass;
        if (entityClass === Payment || target instanceof Payment || target.paymentNumber) {
          savedPayment = target;
        }
        return target;
      });

      await service.createPayment(makeDto({ paymentAmount: 50 }), 77);
      expect(savedPayment.createdBy).toBe(77);
    });

    // Test V: invoice.updatedBy from JWT
    it('Test V: invoice.updatedBy from JWT', async () => {
      const inv = { ...defaultInvoice };
      setupPaymentMocks({ invoice: inv });
      await service.createPayment(makeDto({ paymentAmount: 50 }), 88);
      expect(inv.updatedBy).toBe(88);
    });

    // Test W: transaction rollback
    it('Test W: transaction rollback on error', async () => {
      setupPaymentMocks();
      mockQueryRunner.manager.save.mockRejectedValueOnce(new Error('Database write failure'));
      await expect(service.createPayment(makeDto({ paymentAmount: 50 }), 10)).rejects.toThrow(
        'Database write failure'
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    // Test X: getPoPaymentSummary()
    it('Test X: getPoPaymentSummary()', async () => {
      (service as any).poRepository.findOne = jest.fn().mockResolvedValue({
        id: 1,
        totalAmount: 100479990,
      });
      (service as any).invoiceRepository.find = jest.fn().mockResolvedValue([
        { id: 10, poId: 1 },
      ]);
      (service as any).paymentRepository.find = jest.fn().mockResolvedValue([
        { invoiceId: 10, amount: 60287994, deletedAt: null },
      ]);

      const summary = await service.getPoPaymentSummary(1);
      expect(summary).toEqual({
        poId: 1,
        poTotal: 100479990,
        totalPaid: 60287994,
        outstanding: 40191996,
        paidPercentage: 60,
      });
    });

    it('should throw NotFoundException if PO not found in getPoPaymentSummary', async () => {
      (service as any).poRepository.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.getPoPaymentSummary(999)).rejects.toThrow(NotFoundException);
    });

    // Test Y: paidPercentage correct
    it('Test Y: paidPercentage correct (including poTotal = 0 edge case)', async () => {
      (service as any).poRepository.findOne = jest.fn().mockResolvedValue({
        id: 2,
        totalAmount: 0,
      });
      (service as any).invoiceRepository.find = jest.fn().mockResolvedValue([]);
      (service as any).paymentRepository.find = jest.fn().mockResolvedValue([]);

      const summaryZero = await service.getPoPaymentSummary(2);
      expect(summaryZero.paidPercentage).toBe(0);
      expect(summaryZero.outstanding).toBe(0);

      (service as any).poRepository.findOne = jest.fn().mockResolvedValue({
        id: 3,
        totalAmount: 200,
      });
      (service as any).invoiceRepository.find = jest.fn().mockResolvedValue([{ id: 30, poId: 3 }]);
      (service as any).paymentRepository.find = jest.fn().mockResolvedValue([{ invoiceId: 30, amount: 50, deletedAt: null }]);

      const summary25 = await service.getPoPaymentSummary(3);
      expect(summary25.paidPercentage).toBe(25);
      expect(summary25.outstanding).toBe(150);
    });

    // Test Z: PO fully settled scenario
    it('Test Z: PO fully settled scenario', async () => {
      (service as any).poRepository.findOne = jest.fn().mockResolvedValue({
        id: 4,
        totalAmount: 100000,
      });
      (service as any).invoiceRepository.find = jest.fn().mockResolvedValue([{ id: 40, poId: 4 }]);
      (service as any).paymentRepository.find = jest.fn().mockResolvedValue([{ invoiceId: 40, amount: 100000, deletedAt: null }]);

      const summarySettled = await service.getPoPaymentSummary(4);
      expect(summarySettled.totalPaid).toBe(100000);
      expect(summarySettled.outstanding).toBe(0);
      expect(summarySettled.paidPercentage).toBe(100);
    });

    // Section T: Concurrency Simulation
    it('Section T: Concurrency Simulation (Rp30M invoice, concurrent 20M payments)', async () => {
      const mockInvoice = { id: 1, poId: 1, matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 30000000, version: 1 };
      mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any) => {
        if (entityClass === Invoice) return mockInvoice;
        if (entityClass === PaymentRequest) {
          return {
            id: 100,
            invoiceId: mockInvoice.id,
            status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
            approvedBy: 999,
            deletedAt: null,
          };
        }
        if (entityClass === PurchaseOrder) return { id: 1, totalAmount: 30000000 };
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.count.mockResolvedValue(0);

      const error = new Error('OptimisticLockVersionMismatchError');
      error.name = 'OptimisticLockVersionMismatchError';

      mockQueryRunner.manager.save
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(error);

      const dto = makeDto({ paymentAmount: 20000000 });
      const promises = [service.createPayment(dto, 1), service.createPayment(dto, 2)];
      const results = await Promise.allSettled(promises);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('telah berubah atau sedang diproses');
    });

    // Section U: Payment Number Race Test
    it('Section U: Payment Number Race Test (sequential unique numbers without duplicate)', async () => {
      let seq = 0;
      const numbers: string[] = [];
      mockQueryRunner.manager.findOne.mockImplementation(async (entityClass: any, options: any) => {
        if (entityClass === Invoice) return { ...defaultInvoice, totalAmount: 1000 };
        if (entityClass === PaymentRequest) {
          return {
            id: 100,
            invoiceId: defaultInvoice.id,
            status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
            approvedBy: 999,
            deletedAt: null,
          };
        }
        if (entityClass === PurchaseOrder) return { id: 1, totalAmount: 1000 };
        if (entityClass === Payment) {
          if (numbers.includes(options?.where?.paymentNumber)) {
            return { id: 99, paymentNumber: options.where.paymentNumber };
          }
          return null;
        }
        return null;
      });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.count.mockImplementation(async () => seq);
      mockQueryRunner.manager.save.mockImplementation(async (entityClass: any, entity: any) => {
        const target = entity || entityClass;
        if (target.paymentNumber) {
          numbers.push(target.paymentNumber);
          seq++;
        }
        return target;
      });

      const p1 = await service.createPayment(makeDto({ paymentAmount: 10 }), 1);
      const p2 = await service.createPayment(makeDto({ paymentAmount: 10 }), 1);
      const p3 = await service.createPayment(makeDto({ paymentAmount: 10 }), 1);

      expect(p1.paymentNumber).toBe('PAY-20260908-001');
      expect(p2.paymentNumber).toBe('PAY-20260908-002');
      expect(p3.paymentNumber).toBe('PAY-20260908-003');
      expect(new Set([p1.paymentNumber, p2.paymentNumber, p3.paymentNumber]).size).toBe(3);
    });

    // Section V: PO Settlement Test
    it('Section V: PO Settlement Test (Rp100.479.990 PO, two payments of Rp30.143.997)', async () => {
      (service as any).poRepository.findOne = jest.fn().mockResolvedValue({
        id: 1,
        totalAmount: 100479990,
      });
      (service as any).invoiceRepository.find = jest.fn().mockResolvedValue([
        { id: 10, poId: 1 },
        { id: 11, poId: 1 },
      ]);
      (service as any).paymentRepository.find = jest.fn().mockResolvedValue([
        { invoiceId: 10, amount: 30143997, deletedAt: null },
        { invoiceId: 11, amount: 30143997, deletedAt: null },
      ]);

      const summary = await service.getPoPaymentSummary(1);
      expect(summary.totalPaid).toBe(60287994);
      expect(summary.outstanding).toBe(40191996);
      expect(summary.paidPercentage).toBe(60);
    });
  });

  // 4. VERIFY INVOICE TESTS (PHASE 7E-D-3)
  describe('verifyInvoice (Phase 7E-D-3)', () => {
    const mockPo = {
      id: 1,
      poNumber: 'PO-20260904-001',
      status: 'ISSUED',
      totalAmount: 100479990,
      items: [{ id: 10, itemName: 'Server Item', quantity: 1, unitPrice: 100479990 }],
    };

    const mockTermDp = {
      id: 101,
      poId: 1,
      sequence: 1,
      termName: 'Termin 1 — DP — 30%',
      termType: PaymentTermType.DOWN_PAYMENT,
      percentage: 30.00,
      amount: 30143997,
      status: PaymentTermStatus.INVOICE_SUBMITTED,
      isRetention: false,
      deletedAt: null,
    };

    const mockInvoiceDp = {
      id: 501,
      poId: 1,
      paymentTermId: 101,
      invoiceNumber: 'INV-20260904-001',
      totalAmount: 30143997,
      matchStatus: 'PENDING',
      paymentStatus: 'UNPAID',
      status: 'UNPAID',
      purchaseOrder: mockPo,
      deletedAt: null,
    };

    it('1. DP invoice valid -> VERIFIED', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoiceDp }) // invoice find with lock
        .mockResolvedValueOnce({ ...mockTermDp });   // term find with lock
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(501, { approved: true }, 88);

      expect(result).toBeDefined();
      expect(result.matchStatus).toBe('VERIFIED');
      expect(result.paymentTerm?.status).toBe(PaymentTermStatus.VERIFIED);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('2. DP invoice with GR = 0 -> still VERIFIED without requiring Goods Receipt', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoiceDp })
        .mockResolvedValueOnce({ ...mockTermDp });
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      // GR find is not called for DP verification
      const result = await service.verifyInvoice(501, { approved: true }, 88);
      expect(result.matchStatus).toBe('VERIFIED');
      expect(mockQueryRunner.manager.find).not.toHaveBeenCalledWith(GoodsReceipt, expect.anything());
    });

    it('3. Invoice > term amount -> REJECT', async () => {
      const mismatchedInvoice = { ...mockInvoiceDp, totalAmount: 35000000 }; // 35M > 30,143,997
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mismatchedInvoice)
        .mockResolvedValueOnce({ ...mockTermDp });

      await expect(service.verifyInvoice(501, { approved: true }, 88)).rejects.toThrow(
        /tidak sesuai dengan nominal termin/
      );
    });

    it('4. Term belongs to another PO -> REJECT', async () => {
      const foreignTerm = { ...mockTermDp, poId: 999 }; // Belongs to PO 999
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoiceDp })
        .mockResolvedValueOnce(foreignTerm);

      await expect(service.verifyInvoice(501, { approved: true }, 88)).rejects.toThrow(
        'Payment term bukan milik Purchase Order pada invoice ini.'
      );
    });

    it('5. Term already VERIFIED -> duplicate verification REJECT', async () => {
      const verifiedTerm = { ...mockTermDp, status: PaymentTermStatus.VERIFIED };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoiceDp })
        .mockResolvedValueOnce(verifiedTerm);

      await expect(service.verifyInvoice(501, { approved: true }, 88)).rejects.toThrow(
        'Payment term sudah berstatus VERIFIED.'
      );
    });

    it('6. Term status is not INVOICE_SUBMITTED (e.g. PENDING) -> REJECT', async () => {
      const pendingTerm = { ...mockTermDp, status: PaymentTermStatus.PENDING };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoiceDp })
        .mockResolvedValueOnce(pendingTerm);

      await expect(service.verifyInvoice(501, { approved: true }, 88)).rejects.toThrow(
        /Status payment term.*belum siap diverifikasi/
      );
    });

    it('7. Invoice already VERIFIED -> duplicate verification REJECT', async () => {
      const alreadyVerifiedInvoice = { ...mockInvoiceDp, matchStatus: 'VERIFIED' };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(alreadyVerifiedInvoice);

      await expect(service.verifyInvoice(501, { approved: true }, 88)).rejects.toThrow(
        'Invoice sudah berstatus VERIFIED.'
      );
    });

    it('8. Full invoice matched: PO = GR = Invoice -> VERIFIED', async () => {
      const completedPo = {
        ...mockPo,
        status: 'COMPLETED',
        totalAmount: 1000000,
        items: [{ id: 10, itemName: 'Server Item', quantity: 1, unitPrice: 1000000 }],
      };
      const legacyInvoice = {
        id: 502,
        poId: 1,
        paymentTermId: null, // Legacy / non-term
        totalAmount: 1000000,
        matchStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        purchaseOrder: completedPo,
      };

      const mockGr = {
        id: 1,
        status: 'DELIVERED',
        items: [{ poItemId: 10, receivedQuantity: 1 }],
      };

      mockQueryRunner.manager.findOne.mockResolvedValueOnce(legacyInvoice);
      mockQueryRunner.manager.find.mockResolvedValueOnce([mockGr]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(502, { approved: true }, 88);
      expect(result.matchStatus).toBe('VERIFIED');
    });


    it('9. Full invoice mismatch: PO != GR / Invoice -> REJECT / MISMATCHED and emit finance.mismatch', async () => {
      const completedPo = { ...mockPo, status: 'COMPLETED', totalAmount: 1000000 };
      const legacyInvoice = {
        id: 503,
        poId: 1,
        paymentTermId: null,
        totalAmount: 1000000,
        matchStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        purchaseOrder: completedPo,
      };

      // GR is 0, so GR total 0 != PO 1,000,000
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(legacyInvoice);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]); // No GR
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      await expect(service.verifyInvoice(503, { approved: true }, 88)).rejects.toThrow(
        /3-Way Matching gagal/
      );
    });

    it('10. Retention term without prerequisite (PO not COMPLETED) -> REJECT', async () => {
      const retentionTerm = {
        ...mockTermDp,
        id: 104,
        termName: 'Termin 4 — Retensi — 10%',
        termType: PaymentTermType.RETENTION,
        amount: 10047999,
        isRetention: true,
      };
      const retentionInvoice = {
        ...mockInvoiceDp,
        id: 504,
        paymentTermId: 104,
        totalAmount: 10047999,
        purchaseOrder: { ...mockPo, status: 'ISSUED' }, // PO still ISSUED, not COMPLETED
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(retentionInvoice)
        .mockResolvedValueOnce(retentionTerm);

      await expect(service.verifyInvoice(504, { approved: true, evidenceRef: 'BAST-II-001' }, 88)).rejects.toThrow(
        'Termin retensi hanya dapat diverifikasi setelah Purchase Order selesai (COMPLETED).'
      );
    });

    it('11. Retention term without evidence reference -> REJECT', async () => {
      const retentionTerm = {
        ...mockTermDp,
        id: 104,
        termType: PaymentTermType.RETENTION,
        amount: 10047999,
        isRetention: true,
      };
      const retentionInvoice = {
        ...mockInvoiceDp,
        id: 504,
        paymentTermId: 104,
        totalAmount: 10047999,
        purchaseOrder: { ...mockPo, status: 'COMPLETED' },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(retentionInvoice)
        .mockResolvedValueOnce(retentionTerm);

      // Missing evidenceRef
      await expect(service.verifyInvoice(504, { approved: true, evidenceRef: '' }, 88)).rejects.toThrow(
        'Verifikasi termin retensi wajib menyertakan referensi bukti pemenuhan kondisi retensi.'
      );
    });

    it('12. Retention prerequisite fulfilled (PO COMPLETED + evidenceRef) -> VERIFIED', async () => {
      const retentionTerm = {
        ...mockTermDp,
        id: 104,
        termType: PaymentTermType.RETENTION,
        amount: 10047999,
        isRetention: true,
      };
      const retentionInvoice = {
        ...mockInvoiceDp,
        id: 504,
        paymentTermId: 104,
        totalAmount: 10047999,
        purchaseOrder: { ...mockPo, status: 'COMPLETED' },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(retentionInvoice)
        .mockResolvedValueOnce(retentionTerm);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(
        504,
        { approved: true, evidenceRef: 'BAST-II-FINAL-20260904-001', notes: 'Masa garansi dan retensi selesai' },
        88
      );

      expect(result.matchStatus).toBe('VERIFIED');
      expect(result.paymentTerm?.status).toBe(PaymentTermStatus.VERIFIED);
    });

    it('13. Progress term with valid evidence -> VERIFIED', async () => {
      const progressTerm = {
        ...mockTermDp,
        id: 102,
        sequence: 2,
        termType: PaymentTermType.PROGRESS,
        amount: 30143997,
      };
      const progressInvoice = {
        ...mockInvoiceDp,
        id: 502,
        paymentTermId: 102,
        totalAmount: 30143997,
        purchaseOrder: { ...mockPo, status: 'PARTIALLY_FULFILLED' },
      };
      const mockGr = {
        id: 1,
        grNumber: 'GR-20260908-001',
        poId: 1,
        deletedAt: null,
        items: [{ id: 1, grId: 1, poItemId: 10, receivedQuantity: 1 }],
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(progressInvoice)
        .mockResolvedValueOnce(progressTerm)
        .mockResolvedValueOnce(mockGr);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockGr])
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(
        502,
        { approved: true, evidenceRef: 'GR-20260908-001', notes: 'Pekerjaan mencapai 50%' },
        88
      );

      expect(result.matchStatus).toBe('VERIFIED');
      expect(result.paymentTerm?.status).toBe(PaymentTermStatus.VERIFIED);
    });

    it('14. Progress term without evidence -> REJECT (not auto-verified)', async () => {
      const progressTerm = {
        ...mockTermDp,
        id: 102,
        termType: PaymentTermType.PROGRESS,
        amount: 30143997,
      };
      const progressInvoice = {
        ...mockInvoiceDp,
        id: 502,
        paymentTermId: 102,
        totalAmount: 30143997,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(progressInvoice)
        .mockResolvedValueOnce(progressTerm);

      await expect(service.verifyInvoice(502, { approved: true, evidenceRef: '' }, 88)).rejects.toThrow(
        'Verifikasi termin progress wajib menyertakan referensi'
      );
    });

    it('15. Rejection: approved === false sets matchStatus to REJECTED and emits event', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({ ...mockInvoiceDp });
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(501, { approved: false, notes: 'Dokumen kelengkapan kurang' }, 88);

      expect(result.matchStatus).toBe('REJECTED');
      expect(result.updatedBy).toBe(88);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('16. Concurrency / double-verification handled gracefully', async () => {
      const error = new Error('OptimisticLockVersionMismatchError');
      error.name = 'OptimisticLockVersionMismatchError';

      mockQueryRunner.manager.findOne.mockRejectedValueOnce(error);

      await expect(service.verifyInvoice(501, { approved: true }, 88)).rejects.toThrow(
        'Data invoice telah berubah atau sedang diproses oleh pengguna lain. Silakan refresh halaman.'
      );
    });

    it('17. Verification actor and timestamp recorded on invoice and term', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoiceDp })
        .mockResolvedValueOnce({ ...mockTermDp });
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(501, { approved: true }, 77);

      expect(result.updatedBy).toBe(77);
      expect(result.paymentTerm?.updatedBy).toBe(77);
    });
    it('18. Vendor mismatch -> REJECT with VENDOR_MISMATCH', async () => {
      const mismatchedVendorInvoice = {
        ...mockInvoiceDp,
        purchaseOrder: { ...mockPo, vendorId: 4 },
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mismatchedVendorInvoice)
        .mockResolvedValueOnce({ ...mockTermDp });

      try {
        await service.verifyInvoice(501, { approved: true, vendorId: 999 } as any, 88);
        throw new Error('Should have failed');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toBe('Vendor invoice tidak sesuai dengan vendor Purchase Order.');
        const res = err.getResponse();
        expect(res.mismatches.some((m: any) => m.code === MismatchCode.VENDOR_MISMATCH)).toBe(true);
      }
    });

    it('19. Cumulative invoice > PO -> REJECT with CUMULATIVE_AMOUNT_EXCEEDED_PO', async () => {
      const existingInvoice = { id: 500, poId: 1, totalAmount: 80000000, deletedAt: null, status: 'UNPAID' };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoiceDp })
        .mockResolvedValueOnce({ ...mockTermDp });
      mockQueryRunner.manager.find.mockResolvedValueOnce([existingInvoice, { ...mockInvoiceDp }]);

      try {
        await service.verifyInvoice(501, { approved: true }, 88);
        throw new Error('Should have failed');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toBe('Akumulasi nilai invoice melebihi total Purchase Order.');
        const res = err.getResponse();
        expect(res.mismatches.some((m: any) => m.code === MismatchCode.CUMULATIVE_AMOUNT_EXCEEDED_PO)).toBe(true);
      }
    });

    it('20. Correct partial invoice -> MATCHED and VERIFIED', async () => {
      const partialInvoice1 = {
        ...mockInvoiceDp,
        id: 505,
        totalAmount: 10000000,
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(partialInvoice1)
        .mockResolvedValueOnce({ ...mockTermDp });
      mockQueryRunner.manager.find.mockResolvedValueOnce([partialInvoice1]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(505, { approved: true }, 88);
      expect(result.matchStatus).toBe('VERIFIED');
      expect(result.matchingResult).toBeDefined();
      expect(result.matchingResult.status).toBe('VERIFIED');
      expect(result.matchingResult.invoicedAmount).toBe(10000000);
      expect(result.matchingResult.remainingTermAmount).toBe(20143997);
      expect(result.matchingResult.remainingPoAmount).toBe(90479990);
    });

    it('21. Second partial within remaining -> MATCHED and VERIFIED', async () => {
      const inv1 = { ...mockInvoiceDp, id: 505, totalAmount: 10000000, paymentTermId: 101, deletedAt: null };
      const inv2 = { ...mockInvoiceDp, id: 506, totalAmount: 20143997, paymentTermId: 101, deletedAt: null };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(inv2)
        .mockResolvedValueOnce({ ...mockTermDp });
      mockQueryRunner.manager.find.mockResolvedValueOnce([inv1, inv2]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(506, { approved: true }, 88);
      expect(result.matchStatus).toBe('VERIFIED');
      expect(result.matchingResult.remainingTermAmount).toBe(0);
      expect(result.matchingResult.cumulativeInvoicedAmount).toBe(30143997);
    });

    it('22. Second partial exceeding remaining -> REJECT with AMOUNT_EXCEEDED_TERM', async () => {
      const inv1 = { ...mockInvoiceDp, id: 505, totalAmount: 10000000, paymentTermId: 101, deletedAt: null };
      const inv2 = { ...mockInvoiceDp, id: 506, totalAmount: 25000000, paymentTermId: 101, deletedAt: null };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(inv2)
        .mockResolvedValueOnce({ ...mockTermDp });
      mockQueryRunner.manager.find.mockResolvedValueOnce([inv1, inv2]);

      try {
        await service.verifyInvoice(506, { approved: true }, 88);
        throw new Error('Should have failed');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.mismatches.some((m: any) => m.code === MismatchCode.AMOUNT_EXCEEDED_TERM)).toBe(true);
      }
    });

    it('23. Duplicate invoice number -> REJECT with OTHER', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockInvoiceDp, invoiceNumber: 'INV-DUP-001' })
        .mockResolvedValueOnce({ ...mockTermDp })
        .mockResolvedValueOnce({ id: 999, invoiceNumber: 'INV-DUP-001', deletedAt: null, status: 'UNPAID' });

      try {
        await service.verifyInvoice(501, { approved: true }, 88);
        throw new Error('Should have failed');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toBe('Nomor invoice sudah digunakan oleh invoice lain.');
      }
    });

    it('24. Invalid term sequence -> REJECT with INVALID_SEQUENCE', async () => {
      const term1Pending = {
        id: 101,
        sequence: 1,
        termName: 'Termin 1 — DP',
        status: PaymentTermStatus.PENDING,
        deletedAt: null,
      };
      const term2Progress = {
        id: 102,
        sequence: 2,
        termName: 'Termin 2 — Progress',
        status: PaymentTermStatus.INVOICE_SUBMITTED,
        termType: PaymentTermType.PROGRESS,
        amount: 30143997,
        percentage: 30,
        poId: 1,
        deletedAt: null,
      };
      const progressInvoice = {
        ...mockInvoiceDp,
        id: 502,
        paymentTermId: 102,
        totalAmount: 30143997,
        purchaseOrder: {
          ...mockPo,
          status: 'PARTIALLY_FULFILLED',
          paymentTerms: [term1Pending, term2Progress],
        },
      };

      const mockGr = {
        id: 1,
        grNumber: 'GR-20260908-001',
        poId: 1,
        deletedAt: null,
        items: [{ id: 1, grId: 1, poItemId: 10, receivedQuantity: 1 }],
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(progressInvoice)
        .mockResolvedValueOnce(term2Progress)
        .mockResolvedValueOnce(mockGr);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockGr])
        .mockResolvedValueOnce([]);

      try {
        await service.verifyInvoice(502, { approved: true, evidenceRef: 'GR-20260908-001' }, 88);
        throw new Error('Should have failed');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain('Termin urutan 2 (Termin 2 — Progress) tidak dapat diverifikasi karena Termin urutan 1 (Termin 1 — DP) belum mencapai status INVOICE_SUBMITTED.');
        const res = err.getResponse();
        expect(res.mismatches.some((m: any) => m.code === MismatchCode.INVALID_SEQUENCE)).toBe(true);
      }
    });

    it('25. Payment cumulative guard -> flags when payments exceed invoice amount', async () => {
      const overpaidInvoice = {
        ...mockInvoiceDp,
        totalAmount: 10000000,
        payments: [{ id: 1, amount: 15000000, deletedAt: null }],
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(overpaidInvoice)
        .mockResolvedValueOnce({ ...mockTermDp, amount: 10000000 });

      try {
        await service.verifyInvoice(501, { approved: true }, 88);
        throw new Error('Should have failed');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toBe('Akumulasi pembayaran melebihi nilai invoice.');
      }
    });

    it('26. Custom payment terms (e.g. 40%) -> MATCHED and VERIFIED', async () => {
      const customTerm = {
        id: 103,
        poId: 1,
        sequence: 1,
        termName: 'Termin Khusus 40%',
        termType: PaymentTermType.DOWN_PAYMENT,
        percentage: 40.0,
        amount: 40191996,
        status: PaymentTermStatus.INVOICE_SUBMITTED,
        isRetention: false,
        deletedAt: null,
      };
      const customInvoice = {
        ...mockInvoiceDp,
        id: 508,
        paymentTermId: 103,
        totalAmount: 40191996,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(customInvoice)
        .mockResolvedValueOnce(customTerm);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(508, { approved: true }, 88);
      expect(result.matchStatus).toBe('VERIFIED');
      expect(result.matchingResult.termPercentage).toBe(40.0);
      expect(result.matchingResult.invoicedAmount).toBe(40191996);
      expect(result.matchingResult.status).toBe('VERIFIED');
    });
  });

  // 5. GET INVOICES & GET INVOICE BY ID (PHASE 7E-D-3)
  describe('getInvoices and getInvoiceById', () => {
    it('should get all invoices with paymentTerm relation', async () => {
      const mockList = [{ id: 1, invoiceNumber: 'INV-1', paymentTerm: { id: 10, termName: 'Termin 1' } }];
      (service as any).invoiceRepository.find = jest.fn().mockResolvedValue(mockList);

      const result = await service.getInvoices();
      expect(result).toHaveLength(1);
      expect(result[0].paymentTerm).toBeDefined();
      expect((service as any).invoiceRepository.find).toHaveBeenCalledWith({
        relations: [
          'items',
          'purchaseOrder',
          'purchaseOrder.vendor',
          'purchaseOrder.purchaseRequest',
          'purchaseOrder.purchaseRequest.project',
          'paymentTerm',
        ],
      });
    });

    it('should get invoice by id with full relations', async () => {
      const mockInv = { id: 1, invoiceNumber: 'INV-1', paymentTerm: { id: 10 } };
      (service as any).invoiceRepository.findOne = jest.fn().mockResolvedValue(mockInv);

      const result = await service.getInvoiceById(1);
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect((service as any).invoiceRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: [
          'items',
          'purchaseOrder',
          'purchaseOrder.vendor',
          'purchaseOrder.purchaseRequest',
          'purchaseOrder.purchaseRequest.project',
          'paymentTerm',
          'payments',
        ],
      });
    });

    it('should throw 400 if invoice by id not found', async () => {
      (service as any).invoiceRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(service.getInvoiceById(999)).rejects.toThrow('Invoice tidak ditemukan');
    });
  });

  // 5B. GET PAYMENTS READ MODEL (PHASE FIN-UI-3)
  describe('getPayments (Phase FIN-UI-3)', () => {
    it('should query paymentRepository with full canonical relations', async () => {
      const mockPayments = [
        {
          id: 3,
          paymentNumber: 'PAY-20260908-001',
          amount: 30143997,
          invoice: {
            id: 2,
            invoiceNumber: 'INV-20260908-001',
            purchaseOrder: {
              id: 1,
              poNumber: 'PO-20260907-001',
              vendor: { id: '4', code: 'VND-004', name: 'PT Suplai Makmur' },
              purchaseRequest: {
                id: 1,
                projectId: 2,
                project: { id: 2, name: 'Rumah Net FKI Karawang' },
              },
            },
          },
        },
      ];
      (service as any).paymentRepository.find = jest.fn().mockResolvedValue(mockPayments);

      const result = await service.getPayments();

      expect(result).toHaveLength(1);
      expect((service as any).paymentRepository.find).toHaveBeenCalledWith({
        relations: [
          'invoice',
          'invoice.purchaseOrder',
          'invoice.purchaseOrder.vendor',
          'invoice.purchaseOrder.purchaseRequest',
          'invoice.purchaseOrder.purchaseRequest.project',
        ],
      });

      // 1. getPayments loads: invoice.purchaseOrder
      expect(result[0].invoice.purchaseOrder).toBeDefined();
      expect(result[0].invoice.purchaseOrder.poNumber).toBe('PO-20260907-001');

      // 2. getPayments loads: invoice.purchaseOrder.vendor
      expect(result[0].invoice.purchaseOrder.vendor).toBeDefined();
      expect(result[0].invoice.purchaseOrder.vendor.name).toBe('PT Suplai Makmur');
      expect(result[0].invoice.purchaseOrder.vendor.code).toBe('VND-004');

      // 3. getPayments loads: invoice.purchaseOrder.purchaseRequest
      expect(result[0].invoice.purchaseOrder.purchaseRequest).toBeDefined();

      // 4. getPayments loads: invoice.purchaseOrder.purchaseRequest.project
      expect(result[0].invoice.purchaseOrder.purchaseRequest.project).toBeDefined();
      expect(result[0].invoice.purchaseOrder.purchaseRequest.project.name).toBe('Rumah Net FKI Karawang');
      expect(result[0].invoice.purchaseOrder.purchaseRequest.project.id).toBe(2);
    });

    it('should preserve data for existing 3 payment records without data loss', async () => {
      const mockExistingPayments = [
        {
          id: 1,
          paymentNumber: 'PAY-20260907-001',
          amount: 10000000,
          invoice: {
            id: 1,
            invoiceNumber: 'INV-20260907-001',
            purchaseOrder: {
              poNumber: 'PO-20260907-001',
              vendor: { name: 'PT Suplai Makmur', code: 'VND-004' },
              purchaseRequest: { project: { id: 2, name: 'Rumah Net FKI Karawang' } },
            },
          },
        },
        {
          id: 2,
          paymentNumber: 'PAY-20260907-002',
          amount: 20143997,
          invoice: {
            id: 1,
            invoiceNumber: 'INV-20260907-001',
            purchaseOrder: {
              poNumber: 'PO-20260907-001',
              vendor: { name: 'PT Suplai Makmur', code: 'VND-004' },
              purchaseRequest: { project: { id: 2, name: 'Rumah Net FKI Karawang' } },
            },
          },
        },
        {
          id: 3,
          paymentNumber: 'PAY-20260908-001',
          amount: 30143997,
          invoice: {
            id: 2,
            invoiceNumber: 'INV-20260908-001',
            purchaseOrder: {
              poNumber: 'PO-20260907-001',
              vendor: { name: 'PT Suplai Makmur', code: 'VND-004' },
              purchaseRequest: { project: { id: 2, name: 'Rumah Net FKI Karawang' } },
            },
          },
        },
      ];
      (service as any).paymentRepository.find = jest.fn().mockResolvedValue(mockExistingPayments);

      const result = await service.getPayments();
      expect(result).toHaveLength(3);
      expect(result.map((p) => p.paymentNumber)).toEqual([
        'PAY-20260907-001',
        'PAY-20260907-002',
        'PAY-20260908-001',
      ]);
      result.forEach((p) => {
        expect(p.invoice.purchaseOrder.poNumber).toBe('PO-20260907-001');
        expect(p.invoice.purchaseOrder.vendor.name).toBe('PT Suplai Makmur');
        expect(p.invoice.purchaseOrder.purchaseRequest.project.name).toBe('Rumah Net FKI Karawang');
      });
    });
  });

  // 6. GET INVOICE MATCHING DATA (PHASE 7E-D-3)
  describe('getInvoiceMatchingData (Phase 7E-D-3)', () => {
    it('should calculate correct cumulative values and remaining amounts without mutating DB', async () => {
      const mockPoWithData = {
        id: 1,
        poNumber: 'PO-20260904-001',
        totalAmount: 100479990,
        status: 'ISSUED',
        vendorId: 4,
        paymentTerms: [],
        invoices: [
          { id: 501, paymentTermId: 101, totalAmount: 30143997, deletedAt: null, payments: [{ amount: 10000000, deletedAt: null }] },
        ],
      };
      const mockInvoice = {
        id: 501,
        poId: 1,
        paymentTermId: 101,
        totalAmount: 30143997,
        matchStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        purchaseOrder: mockPoWithData,
        paymentTerm: {
          id: 101,
          poId: 1,
          sequence: 1,
          termName: 'Termin 1 — DP — 30%',
          percentage: 30,
          amount: 30143997,
          status: PaymentTermStatus.INVOICE_SUBMITTED,
        },
      };

      (service as any).invoiceRepository.findOne = jest.fn().mockResolvedValue(mockInvoice);

      const result = await service.getInvoiceMatchingData(501);

      expect(result.invoiceId).toBe(501);
      expect(result.poId).toBe(1);
      expect(result.poTotal).toBe(100479990);
      expect(result.termPercentage).toBe(30);
      expect(result.termAmount).toBe(30143997);
      expect(result.invoicedAmount).toBe(30143997);
      expect(result.cumulativeInvoicedAmount).toBe(30143997);
      expect(result.remainingPoAmount).toBe(70335993);
      expect(result.remainingTermAmount).toBe(0);
      expect(result.cumulativePaidAmount).toBe(10000000);
      expect(result.status).toBe('MATCHED');
      expect(result.mismatches).toHaveLength(0);
    });

    it('should detect vendor mismatch when claimed vendor does not match PO vendor', async () => {
      const mockInvoice = {
        id: 501,
        poId: 1,
        paymentTermId: 101,
        totalAmount: 30143997,
        matchStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        purchaseOrder: { id: 1, totalAmount: 100479990, status: 'ISSUED', vendorId: 4, paymentTerms: [], invoices: [] },
        paymentTerm: { id: 101, poId: 1, sequence: 1, percentage: 30, amount: 30143997, status: PaymentTermStatus.INVOICE_SUBMITTED },
      };
      (service as any).invoiceRepository.findOne = jest.fn().mockResolvedValue(mockInvoice);

      const result = await service.getInvoiceMatchingData(501, 999);

      expect(result.status).toBe('MISMATCH');
      expect(result.mismatches.some(m => m.code === MismatchCode.VENDOR_MISMATCH)).toBe(true);
    });

    it('should throw 400 if invoice not found', async () => {
      (service as any).invoiceRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(service.getInvoiceMatchingData(999)).rejects.toThrow('Invoice tidak ditemukan.');
    });
  });

  // 7. PHASE GR-5: CANONICAL GOODS RECEIPT -> PROGRESS INVOICE ENGINE TESTS
  describe('Phase GR-5: Canonical Goods Receipt -> Progress Invoice Engine', () => {
    const livePo = {
      id: 1,
      poNumber: 'PO-20260907-001',
      status: 'PARTIALLY_FULFILLED',
      totalAmount: 100479990,
      items: [
        { id: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, receivedQuantity: 0, unitPrice: 24000, totalPrice: 480000 },
        { id: 2, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, receivedQuantity: 5, unitPrice: 9999999, totalPrice: 99999990 },
      ],
    };

    const term2Progress = {
      id: 2,
      poId: 1,
      sequence: 2,
      termName: 'Progress 1',
      termType: PaymentTermType.PROGRESS,
      percentage: 30.00,
      amount: 30143997,
      status: PaymentTermStatus.PENDING,
      isRetention: false,
      deletedAt: null,
    };

    const liveGr1 = {
      id: 1,
      grNumber: 'GR-20260908-001',
      poId: 1,
      receiptDate: new Date('2026-09-08T15:57:04.000Z'),
      totalReceivedAmount: 49999995,
      deletedAt: null,
      items: [
        { id: 1, grId: 1, poItemId: 2, receivedQuantity: 5, remarks: '5 Hasel Roll' },
      ],
    };

    // 1. valid GR + PROGRESS => PASS
    it('1. valid GR + PROGRESS => PASS (invoice created with authoritative term amount and correct items)', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Progress })
        .mockResolvedValueOnce({ ...liveGr1 })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ ...liveGr1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-08',
      };

      const result = await service.createInvoice(dto, 37);
      expect(result.totalAmount).toBe(30143997);
      expect(result.paymentTermId).toBe(2);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].poItemId).toBe(2);
      expect(Number(result.items[0].quantity)).toBe(5);
    });

    // 2. no GR => REJECT
    it('2. no GR => REJECT (missing goodsReceiptId and evidenceRef)', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Progress });
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        invoiceDate: '2026-09-08',
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        'Invoice termin progress wajib menyertakan referensi Goods Receipt valid.'
      );
    });

    // 3. nonexistent GR => REJECT
    it('3. nonexistent GR => REJECT', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Progress })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        goodsReceiptId: 999,
        invoiceDate: '2026-09-08',
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        "Goods Receipt '999' tidak ditemukan di sistem."
      );
    });

    // 4. GR belongs to different PO => REJECT
    it('4. GR belongs to different PO => REJECT', async () => {
      const foreignGr = {
        ...liveGr1,
        poId: 99,
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Progress })
        .mockResolvedValueOnce(foreignGr);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-08',
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        'Goods Receipt bukan milik Purchase Order ini.'
      );
    });

    // 5. deleted GR => REJECT
    it('5. deleted GR => REJECT', async () => {
      const deletedGr = {
        ...liveGr1,
        deletedAt: new Date(),
      };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Progress })
        .mockResolvedValueOnce(deletedGr);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-08',
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        'Goods Receipt telah dihapus atau tidak valid.'
      );
    });

    // 6. invoice qty > received qty => REJECT
    it('6. invoice qty > received qty => REJECT', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Progress })
        .mockResolvedValueOnce({ ...liveGr1 })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ ...liveGr1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-08',
        items: [
          { poItemId: 2, quantity: 6, unitPrice: 9999999, totalPrice: 59999994 },
        ],
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        'Kuantitas item invoice (6) melebihi kuantitas yang telah diterima (5)'
      );
    });

    // 7. cumulative billing > received => REJECT
    it('7. cumulative billing > received => REJECT (insufficient physical delivery capacity)', async () => {
      const previousProgressInvoice = {
        id: 99,
        poId: 1,
        paymentTermId: 2,
        totalAmount: 30000000,
        paymentTerm: { termType: PaymentTermType.PROGRESS },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Progress })
        .mockResolvedValueOnce({ ...liveGr1 })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ ...liveGr1 }])
        .mockResolvedValueOnce([previousProgressInvoice]);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-08',
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        'melebihi total nilai fisik barang yang telah diterima'
      );
    });

    // 8. partial GR 5/10 => only max 5 supported
    it('8. partial GR 5/10 => only max 5 supported (accepts up to 5)', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Progress })
        .mockResolvedValueOnce({ ...liveGr1 })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ ...liveGr1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-08',
        items: [{ poItemId: 2, quantity: 5, unitPrice: 9999999, totalPrice: 49999995 }],
      };

      const result = await service.createInvoice(dto, 37);
      expect(result.items[0].quantity).toBe(5);
    });

    // 9. DP still works without GR
    it('9. DP still works without GR (zero GR requirement)', async () => {
      const term1Dp = {
        id: 1,
        poId: 1,
        sequence: 1,
        termName: 'DP',
        termType: PaymentTermType.DOWN_PAYMENT,
        percentage: 30.00,
        amount: 30143997,
        status: PaymentTermStatus.PENDING,
        deletedAt: null,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo, status: 'ISSUED' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(term1Dp)
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 1,
        invoiceDate: '2026-09-08',
      };

      const result = await service.createInvoice(dto, 37);
      expect(result.totalAmount).toBe(30143997);
    });

    // 10. Retention behavior unchanged
    it('10. Retention behavior unchanged (requires COMPLETED PO)', async () => {
      const term4Retention = {
        id: 4,
        poId: 1,
        sequence: 4,
        termName: 'Retention',
        termType: PaymentTermType.RETENTION,
        percentage: 10.00,
        amount: 10047999,
        status: PaymentTermStatus.PENDING,
        isRetention: true,
        deletedAt: null,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo, status: 'PARTIALLY_FULFILLED' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(term4Retention);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 4,
        invoiceDate: '2026-09-08',
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        'Termin retensi hanya dapat ditagihkan setelah Purchase Order selesai (COMPLETED).'
      );
    });

    // 11. concurrent duplicate progress attempt cannot double-bill
    it('11. concurrent duplicate progress attempt cannot double-bill (second attempt rejected when active invoice exists)', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...livePo })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Progress })
        .mockResolvedValueOnce({ ...liveGr1 })
        .mockResolvedValueOnce({ id: 201, paymentTermId: 2, status: 'UNPAID', deletedAt: null });
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ ...liveGr1 }])
        .mockResolvedValueOnce([]);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-08',
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        'Payment term sudah memiliki invoice aktif.'
      );
    });

    // 12. Live PO #1 Semantics Assertion
    it('12. Live semantics: GR #1 physical value Rp49.999.995 supports Term #2 Rp30.143.997 on PO #1', async () => {
      const grValue = 5 * 9999999;
      const termAmount = 30143997;
      expect(grValue).toBe(49999995);
      expect(grValue).toBeGreaterThan(termAmount);
      expect(Number(liveGr1.poId)).toBe(livePo.id);
      expect(liveGr1.items[0].poItemId).toBe(livePo.items[1].id);
      expect(liveGr1.items[0].receivedQuantity).toBe(5);
    });
  });

  // 8. PHASE GR-7B-FIX: RELATION LOADING & PHYSICAL CAPACITY REGRESSION TESTS
  describe('Phase GR-7B-FIX: Finance Matching Relation Load & Physical Capacity', () => {
    const livePoItems = [
      { id: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, receivedQuantity: 0, unitPrice: 24000, totalPrice: 480000 },
      { id: 2, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, receivedQuantity: 5, unitPrice: 9999999, totalPrice: 99999990 },
    ];

    const livePoWithItems = {
      id: 1,
      poNumber: 'PO-20260907-001',
      status: 'PARTIALLY_FULFILLED',
      totalAmount: 100479990,
      vendorId: 4,
      items: livePoItems,
      paymentTerms: [
        { id: 1, sequence: 1, termName: 'DP', status: PaymentTermStatus.PAID, percentage: 30, amount: 30143997 },
        { id: 2, sequence: 2, termName: 'Progress 1', status: PaymentTermStatus.INVOICE_SUBMITTED, percentage: 30, amount: 30143997 },
      ],
      invoices: [],
    };

    const shallowPoWithoutItems = {
      id: 1,
      poNumber: 'PO-20260907-001',
      status: 'PARTIALLY_FULFILLED',
      totalAmount: 100479990,
      vendorId: 4,
      items: undefined,
    };

    const liveTerm2 = {
      id: 2,
      poId: 1,
      sequence: 2,
      termName: 'Progress 1',
      termType: PaymentTermType.PROGRESS,
      percentage: 30.00,
      amount: 30143997,
      status: PaymentTermStatus.INVOICE_SUBMITTED,
      isRetention: false,
      deletedAt: null,
    };

    const liveGr1 = {
      id: 1,
      grNumber: 'GR-20260908-001',
      poId: 1,
      deletedAt: null,
      items: [
        { id: 1, grId: 1, poItemId: 2, receivedQuantity: 5, remarks: '5 Hasel Roll' },
      ],
    };

    const liveInvoice2 = {
      id: 2,
      invoiceNumber: 'INV-20260908-001',
      poId: 1,
      paymentTermId: 2,
      totalAmount: 30143997,
      matchStatus: 'PENDING',
      paymentStatus: 'UNPAID',
      items: [
        { id: 10, invoiceId: 2, poItemId: 2, quantity: 5, unitPrice: 9999999, totalPrice: 49999995 },
      ],
      payments: [],
      deletedAt: null,
    };

    it('A. Bug Reproduction & Resolution: evaluateMatching recovers po.items when invoice.purchaseOrder has undefined items', async () => {
      const invoiceWithShallowPo = {
        ...liveInvoice2,
        purchaseOrder: { ...shallowPoWithoutItems },
        paymentTerm: { ...liveTerm2 },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(livePoWithItems) // PO reload with items
        .mockResolvedValueOnce(liveGr1);        // GR lookup
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([liveGr1])       // allPoGrs
        .mockResolvedValueOnce([]);             // allInvoices

      const result = await service.evaluateMatching(
        invoiceWithShallowPo as any,
        { approved: true, goodsReceiptId: 1 },
        mockQueryRunner.manager,
      );

      expect(result.mismatches.some(m => m.code === MismatchCode.PROGRESS_BILLING_EXCEEDS_RECEIVED)).toBe(false);
      expect(result.status).toBe('MATCHED');
    });

    it('B. Live Semantics: GR #1 physical value Rp49.999.995 >= Term #2 Rp30.143.997 -> verifyInvoice succeeds', async () => {
      const mockTerm = { ...liveTerm2, status: PaymentTermStatus.INVOICE_SUBMITTED };
      const invoiceWithLoadedRelations = {
        ...liveInvoice2,
        purchaseOrder: { ...livePoWithItems },
        paymentTerm: mockTerm,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(invoiceWithLoadedRelations) // findOne Invoice with lock and relations
        .mockResolvedValueOnce(mockTerm)                   // findOne PoPaymentTerm lock
        .mockResolvedValueOnce(liveGr1);                   // findOne GR by id
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([liveGr1]);                 // allPoGrs
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(2, { approved: true, goodsReceiptId: 1 }, 1);

      expect(result.matchStatus).toBe('VERIFIED');
      expect(result.paymentTerm?.status).toBe(PaymentTermStatus.VERIFIED);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('C. verifyInvoice relations verification: invoice findOne includes purchaseOrder.items and purchaseOrder.vendor', async () => {
      const mockTerm = { ...liveTerm2, status: PaymentTermStatus.INVOICE_SUBMITTED };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({
          ...liveInvoice2,
          purchaseOrder: { ...livePoWithItems },
          paymentTerm: mockTerm,
        })
        .mockResolvedValueOnce(mockTerm)
        .mockResolvedValueOnce(liveGr1);
      mockQueryRunner.manager.find.mockResolvedValueOnce([liveGr1]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      await service.verifyInvoice(2, { approved: true, goodsReceiptId: 1 }, 1);

      const firstFindOneCallArgs = mockQueryRunner.manager.findOne.mock.calls[0];
      expect(firstFindOneCallArgs[0]).toBe(Invoice);
      expect(firstFindOneCallArgs[1].relations).toContain('purchaseOrder.items');
      expect(firstFindOneCallArgs[1].relations).toContain('purchaseOrder.vendor');
    });
  });

  // Phase GR-8B: Milestone Eligibility & Sequence Gate Engine
  describe('Phase GR-8B: Milestone Eligibility & Sequence Gate Engine', () => {
    const term1Paid = {
      id: 1,
      poId: 1,
      sequence: 1,
      termName: 'DP',
      termType: PaymentTermType.DOWN_PAYMENT,
      percentage: 30.00,
      amount: 30143997,
      triggerCondition: 'Setelah PO Diterbitkan',
      status: PaymentTermStatus.PAID,
      deletedAt: null,
    };

    const term2Pending = {
      id: 2,
      poId: 1,
      sequence: 2,
      termName: 'Progress 1',
      termType: PaymentTermType.PROGRESS,
      percentage: 30.00,
      amount: 30143997,
      triggerCondition: 'Kemajuan Fisik 50%',
      status: PaymentTermStatus.PENDING,
      deletedAt: null,
    };

    const term2Paid = {
      ...term2Pending,
      status: PaymentTermStatus.PAID,
    };

    const term3Pending = {
      id: 3,
      poId: 1,
      sequence: 3,
      termName: 'Progress 2',
      termType: PaymentTermType.PROGRESS,
      percentage: 30.00,
      amount: 30143997,
      triggerCondition: 'Kemajuan Fisik 100%',
      status: PaymentTermStatus.PENDING,
      deletedAt: null,
    };

    const term4Pending = {
      id: 4,
      poId: 1,
      sequence: 4,
      termName: 'Retention',
      termType: PaymentTermType.RETENTION,
      percentage: 10.00,
      amount: 10047999,
      triggerCondition: 'Masa Pemeliharaan 90 Hari Selesai',
      status: PaymentTermStatus.PENDING,
      isRetention: true,
      deletedAt: null,
    };

    const poWithTermsPaidUpTo2 = {
      id: 1,
      poNumber: 'PO-20260907-001',
      status: 'PARTIALLY_FULFILLED',
      totalAmount: 100479990,
      items: [
        { id: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, receivedQuantity: 0, unitPrice: 24000, totalPrice: 480000 },
        { id: 2, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, receivedQuantity: 5, unitPrice: 9999999, totalPrice: 99999990 },
      ],
      paymentTerms: [term1Paid, term2Paid, term3Pending, term4Pending],
    };

    const liveGr1 = {
      id: 1,
      grNumber: 'GR-20260908-001',
      poId: 1,
      receiptDate: new Date('2026-09-08T15:57:04.000Z'),
      totalReceivedAmount: 49999995,
      deletedAt: null,
      items: [
        { id: 1, grId: 1, poItemId: 2, receivedQuantity: 5, remarks: '5 Hasel Roll' },
      ],
    };

    // 1. Term #3 with PO 5/10: MUST BLOCK milestone
    it('1. Term #3 with PO 5/10 (partial physical completion) -> MUST BLOCK milestone', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...poWithTermsPaidUpTo2 }) // PO find
        .mockResolvedValueOnce(null) // invoiceNumber uniqueness check
        .mockResolvedValueOnce({ ...term3Pending }) // Term #3 find
        .mockResolvedValueOnce({ ...liveGr1 }); // GR find
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ ...liveGr1 }]); // allPoGrs

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 3,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-09',
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        /pengiriman fisik barang\/jasa belum selesai 100% \(status PO: PARTIALLY_FULFILLED\)/
      );
    });

    // 2. Term #3 when all PO items are 100%: milestone gate PASS
    it('2. Term #3 when all PO items are 100% -> milestone gate PASS and invoice created', async () => {
      const poCompleted = {
        ...poWithTermsPaidUpTo2,
        status: 'COMPLETED',
        items: [
          { id: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, receivedQuantity: 20, unitPrice: 24000, totalPrice: 480000 },
          { id: 2, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, receivedQuantity: 10, unitPrice: 9999999, totalPrice: 99999990 },
        ],
      };

      const fullGr = {
        id: 2,
        grNumber: 'GR-20260909-002',
        poId: 1,
        receiptDate: new Date('2026-09-09T10:00:00.000Z'),
        totalReceivedAmount: 100479990,
        deletedAt: null,
        items: [
          { id: 1, grId: 2, poItemId: 1, receivedQuantity: 20 },
          { id: 2, grId: 2, poItemId: 2, receivedQuantity: 10 },
        ],
      };

      const existingInvoice2 = {
        id: 2,
        poId: 1,
        paymentTermId: 2,
        totalAmount: 30143997,
        status: 'PAID',
        deletedAt: null,
        paymentTerm: { ...term2Paid },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(poCompleted) // PO
        .mockResolvedValueOnce(null) // invoice uniqueness
        .mockResolvedValueOnce({ ...term3Pending }) // Term 3
        .mockResolvedValueOnce(fullGr) // GR
        .mockResolvedValueOnce(null); // active invoice check for term 3
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([fullGr]) // allPoGrs
        .mockResolvedValueOnce([existingInvoice2]) // allExistingInvoices
        .mockResolvedValueOnce([existingInvoice2]); // activeInvoices
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 3,
        goodsReceiptId: 2,
        invoiceDate: '2026-09-09',
      };

      const result = await service.createInvoice(dto, 37);
      expect(result.totalAmount).toBe(30143997);
      expect(result.paymentTermId).toBe(3);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    // 3. Monetary GR value >= Term amount but physical item completion < 100%: MUST BLOCK Term #3
    it('3. Monetary GR value >= Term amount but physical item completion < 100% -> MUST BLOCK Term #3', async () => {
      const poPartialHighValue = {
        ...poWithTermsPaidUpTo2,
        status: 'PARTIALLY_FULFILLED',
        items: [
          { id: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, receivedQuantity: 0, unitPrice: 24000, totalPrice: 480000 },
          { id: 2, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, receivedQuantity: 10, unitPrice: 9999999, totalPrice: 99999990 },
        ],
      };

      const grCableFull = {
        id: 1,
        grNumber: 'GR-20260908-001',
        poId: 1,
        receiptDate: new Date(),
        totalReceivedAmount: 99999990,
        deletedAt: null,
        items: [
          { id: 1, grId: 1, poItemId: 2, receivedQuantity: 10 },
        ],
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(poPartialHighValue)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term3Pending })
        .mockResolvedValueOnce(grCableFull);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([grCableFull]);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 3,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-09',
      };

      // Financial capacity would pass (99.99M >= 60.28M), but milestone MUST block!
      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        /pengiriman fisik barang\/jasa belum selesai 100% \(status PO: PARTIALLY_FULFILLED\) \(Tim Penarikan & Splicing FO: 0\/20\)/
      );
    });

    // 4. Multiple GRs: 20/20 and 10/10 accumulated across several GRs -> final milestone PASS
    it('4. Multiple GRs accumulating to 100% -> final milestone PASS', async () => {
      const poCompletedMulti = {
        ...poWithTermsPaidUpTo2,
        status: 'COMPLETED',
        items: [
          { id: 1, itemName: 'Tim Penarikan & Splicing FO', quantity: 20, receivedQuantity: 20, unitPrice: 24000, totalPrice: 480000 },
          { id: 2, itemName: 'Kabel Fiber Optic 24 Core ADSS', quantity: 10, receivedQuantity: 10, unitPrice: 9999999, totalPrice: 99999990 },
        ],
      };

      const gr1 = {
        id: 1,
        grNumber: 'GR-20260908-001',
        poId: 1,
        totalReceivedAmount: 49999995,
        deletedAt: null,
        items: [{ id: 1, grId: 1, poItemId: 2, receivedQuantity: 5 }],
      };
      const gr2 = {
        id: 2,
        grNumber: 'GR-20260909-002',
        poId: 1,
        totalReceivedAmount: 49999995,
        deletedAt: null,
        items: [{ id: 2, grId: 2, poItemId: 2, receivedQuantity: 5 }],
      };
      const gr3 = {
        id: 3,
        grNumber: 'GR-20260909-003',
        poId: 1,
        totalReceivedAmount: 480000,
        deletedAt: null,
        items: [{ id: 3, grId: 3, poItemId: 1, receivedQuantity: 20 }],
      };

      const existingInvoice2 = {
        id: 2,
        poId: 1,
        paymentTermId: 2,
        totalAmount: 30143997,
        status: 'PAID',
        deletedAt: null,
        paymentTerm: { ...term2Paid },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(poCompletedMulti)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term3Pending })
        .mockResolvedValueOnce(gr3)
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([gr1, gr2, gr3]) // all 3 GRs
        .mockResolvedValueOnce([existingInvoice2]) // allExistingInvoices
        .mockResolvedValueOnce([existingInvoice2]); // activeInvoices
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 3,
        goodsReceiptId: 3,
        invoiceDate: '2026-09-09',
      };

      const result = await service.createInvoice(dto, 37);
      expect(result.totalAmount).toBe(30143997);
      expect(result.paymentTermId).toBe(3);
    });

    // 5. Term #2 intermediate progress: existing 50% behavior remains valid
    it('5. Term #2 intermediate progress: 50% milestone passes with ~49.76% delivery', async () => {
      const poForTerm2 = {
        ...poWithTermsPaidUpTo2,
        paymentTerms: [term1Paid, term2Pending, term3Pending, term4Pending],
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(poForTerm2)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Pending })
        .mockResolvedValueOnce({ ...liveGr1 })
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ ...liveGr1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        goodsReceiptId: 1,
        invoiceDate: '2026-09-08',
      };

      const result = await service.createInvoice(dto, 37);
      expect(result.totalAmount).toBe(30143997);
      expect(result.paymentTermId).toBe(2);
    });

    // 6. Sequence: Term #3 before Term #2 completion -> MUST BLOCK
    it('6. Sequence: Term #3 attempted when Term #2 is PENDING -> MUST BLOCK with sequence error', async () => {
      const poWithPending2 = {
        ...poWithTermsPaidUpTo2,
        paymentTerms: [term1Paid, term2Pending, term3Pending, term4Pending],
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(poWithPending2)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term3Pending });

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 3,
        invoiceDate: '2026-09-09',
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        /Termin urutan 3 \(Progress 2\) tidak dapat ditagihkan karena termin sebelumnya \(Progress 1\) belum mencapai status VERIFIED atau PAID/
      );
    });

    // 7. Sequence: Term #2 before Term #1 DP is PAID -> MUST BLOCK
    it('7. Sequence: Term #2 attempted when Term #1 DP is PENDING -> MUST BLOCK with sequence error', async () => {
      const term1Pending = { ...term1Paid, status: PaymentTermStatus.PENDING };
      const poWithPendingDp = {
        ...poWithTermsPaidUpTo2,
        paymentTerms: [term1Pending, term2Pending, term3Pending, term4Pending],
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(poWithPendingDp)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...term2Pending });

      const dto = {
        purchaseOrderId: 1,
        paymentTermId: 2,
        invoiceDate: '2026-09-09',
      };

      await expect(service.createInvoice(dto, 37)).rejects.toThrow(
        /Termin urutan 2 \(Progress 1\) tidak dapat ditagihkan karena Uang Muka \/ DP \(DP\) belum berstatus PAID/
      );
    });

    // 8. Verification consistency: evaluateMatching detects INSUFFICIENT_DELIVERY on Term #3 when PO incomplete
    it('8. Verification consistency: evaluateMatching rejects Term #3 with INSUFFICIENT_DELIVERY when PO incomplete', async () => {
      const invoiceTerm3 = {
        id: 3,
        invoiceNumber: 'INV-20260909-003',
        poId: 1,
        paymentTermId: 3,
        totalAmount: 30143997,
        matchStatus: 'PENDING',
        purchaseOrder: { ...poWithTermsPaidUpTo2 },
        paymentTerm: { ...term3Pending, status: PaymentTermStatus.INVOICE_SUBMITTED },
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(invoiceTerm3)
        .mockResolvedValueOnce({ ...term3Pending, status: PaymentTermStatus.INVOICE_SUBMITTED })
        .mockResolvedValueOnce(liveGr1);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([liveGr1]); // allPoGrs

      try {
        await service.verifyInvoice(3, { approved: true, goodsReceiptId: 1 }, 1);
        throw new Error('Should have failed');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.mismatches.some((m: any) => m.code === MismatchCode.INSUFFICIENT_DELIVERY)).toBe(true);
      }
    });
  });

  // 10. PHASE FIN-EVIDENCE-DEADLOCK: Preview Canonical GR Resolution & Strict POST
  describe('Phase FIN-EVIDENCE-DEADLOCK: Preview Canonical GR Resolution & Strict POST', () => {
    const completedPoWithItems = {
      id: 1,
      poNumber: 'PO-20260907-001',
      status: 'COMPLETED',
      totalAmount: 100479990,
      vendorId: 4,
      items: [
        { id: 1, itemName: 'Item 1', quantity: 20, receivedQuantity: 20, unitPrice: 24000, totalPrice: 480000 },
        { id: 2, itemName: 'Item 2', quantity: 10, receivedQuantity: 10, unitPrice: 9999999, totalPrice: 99999990 },
      ],
      paymentTerms: [
        { id: 1, sequence: 1, termType: PaymentTermType.DOWN_PAYMENT, status: PaymentTermStatus.PAID, percentage: 30, amount: 30143997 },
        { id: 2, sequence: 2, termType: PaymentTermType.PROGRESS, status: PaymentTermStatus.PAID, percentage: 30, amount: 30143997 },
        { id: 3, sequence: 3, termType: PaymentTermType.PROGRESS, status: PaymentTermStatus.INVOICE_SUBMITTED, percentage: 30, amount: 30143997, triggerCondition: 'Kemajuan Fisik 100%' },
      ],
      invoices: [],
    };

    const term3Progress = {
      id: 3,
      poId: 1,
      sequence: 3,
      termName: 'Progress 2',
      termType: PaymentTermType.PROGRESS,
      percentage: 30.00,
      amount: 30143997,
      status: PaymentTermStatus.INVOICE_SUBMITTED,
      triggerCondition: 'Kemajuan Fisik 100%',
      deletedAt: null,
    };

    const activeGrCanonical = {
      id: 4,
      grNumber: 'GR-20260909-003',
      poId: 1,
      totalReceivedAmount: 49999995,
      deletedAt: null,
      items: [
        { id: 4, grId: 4, poItemId: 2, receivedQuantity: 5 },
      ],
    };

    const allGrsForPo = [
      activeGrCanonical,
      {
        id: 1,
        grNumber: 'GR-20260908-001',
        poId: 1,
        totalReceivedAmount: 49999995,
        deletedAt: null,
        items: [{ id: 1, grId: 1, poItemId: 2, receivedQuantity: 5 }],
      },
      {
        id: 3,
        grNumber: 'GR-20260909-002',
        poId: 1,
        totalReceivedAmount: 360000,
        deletedAt: null,
        items: [{ id: 3, grId: 3, poItemId: 1, receivedQuantity: 15 }],
      },
      {
        id: 2,
        grNumber: 'GR-20260909-001',
        poId: 1,
        totalReceivedAmount: 120000,
        deletedAt: null,
        items: [{ id: 2, grId: 2, poItemId: 1, receivedQuantity: 5 }],
      },
    ];

    const invoiceProgress = {
      id: 3,
      invoiceNumber: 'INV-20260909-001',
      poId: 1,
      paymentTermId: 3,
      totalAmount: 30143997,
      matchStatus: 'PENDING',
      paymentStatus: 'UNPAID',
      purchaseOrder: completedPoWithItems,
      paymentTerm: term3Progress,
      items: [],
      payments: [],
      deletedAt: null,
    };

    it('1. GET preview on PROGRESS invoice without DTO evidence auto-resolves canonical active GR and returns MATCHED', async () => {
      (service as any).invoiceRepository.findOne = jest.fn().mockResolvedValue(invoiceProgress);
      (service as any).invoiceRepository.manager = mockQueryRunner.manager;
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(allGrsForPo)     // poGrs resolution in evaluateMatching
        .mockResolvedValueOnce(allGrsForPo)     // allPoGrs for capacity check
        .mockResolvedValueOnce([]);             // allInvoices

      const preview = await service.getInvoiceMatchingData(3);

      expect(preview.status).toBe('MATCHED');
      expect(preview.mismatches).toHaveLength(0);
      expect(preview.goodsReceiptId).toBe(4);
      expect(preview.goodsReceiptNumber).toBe('GR-20260909-003');
      expect(preview.poTotal).toBe(100479990);
    });

    it('2. GET preview on PROGRESS invoice returns MISMATCH (EVIDENCE_REQUIRED) when no active GR exists for PO', async () => {
      (service as any).invoiceRepository.findOne = jest.fn().mockResolvedValue(invoiceProgress);
      (service as any).invoiceRepository.manager = mockQueryRunner.manager;
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([]); // no GRs found

      const preview = await service.getInvoiceMatchingData(3);

      expect(preview.status).toBe('MISMATCH');
      expect(preview.mismatches.some(m => m.code === MismatchCode.EVIDENCE_REQUIRED)).toBe(true);
    });

    it('3. POST verifyInvoice on PROGRESS invoice strictly fails with EVIDENCE_REQUIRED when evidence is omitted', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(invoiceProgress)
        .mockResolvedValueOnce(term3Progress);

      await expect(
        service.verifyInvoice(3, { approved: true }, 1)
      ).rejects.toThrow(
        'Verifikasi termin progress wajib menyertakan referensi Goods Receipt valid.'
      );
    });

    it('4. POST verifyInvoice on PROGRESS invoice succeeds when valid goodsReceiptId is provided', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(invoiceProgress)
        .mockResolvedValueOnce(term3Progress)
        .mockResolvedValueOnce(activeGrCanonical);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(allGrsForPo)
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.save.mockImplementation((entityOrTarget, entity) => entity || entityOrTarget);

      const result = await service.verifyInvoice(3, { approved: true, goodsReceiptId: 4 }, 1);

      expect(result.matchStatus).toBe('VERIFIED');
      expect(result.matchingResult.status).toBe('VERIFIED');
      expect(result.matchingResult.mismatches).toHaveLength(0);
    });
  });
});


