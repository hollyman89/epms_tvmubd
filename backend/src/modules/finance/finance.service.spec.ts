import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

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
        { provide: getRepositoryToken(PurchaseOrder), useValue: {} },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInvoice', () => {
    it('should throw error if PO not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
      await expect(service.createInvoice({ purchaseOrderId: 1, invoiceDate: '2026-07-20', items: [] }, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if PO status is not COMPLETED', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({ status: 'PENDING' });
      await expect(service.createInvoice({ purchaseOrderId: 1, invoiceDate: '2026-07-20', items: [] }, 1)).rejects.toThrow(BadRequestException);
    });

    it('should successfully create invoice for COMPLETED PO', async () => {
      const mockPo = { id: 1, status: 'COMPLETED', items: [{ id: 1, itemName: 'Test Item', quantity: 1, unitPrice: 100 }] };
      mockQueryRunner.manager.findOne.mockResolvedValue(mockPo);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0); // For invoice number gen
      mockQueryRunner.manager.save.mockImplementation(entity => {
          if (!entity.id) entity.id = 1;
          return entity;
      });

      const mockGr = { id: 1, status: 'DELIVERED', items: [] };
      mockQueryRunner.manager.find.mockResolvedValue([mockGr]); // For GR check

      const dto = { purchaseOrderId: 1, invoiceDate: '2026-07-20', items: [{ poItemId: 1, itemName: 'Test Item', quantity: 1, unitPrice: 100, totalPrice: 100 }] };
      const result = await service.createInvoice(dto, 1);
      
      expect(result).toHaveProperty('invoiceNumber');
      expect(result.totalAmount).toBe(100);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('createPayment', () => {
    it('should throw error if Invoice not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
      await expect(service.createPayment({ invoiceId: 1, paymentAmount: 100, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' }, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if Invoice is not MATCHED', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({ matchStatus: 'MISMATCH' });
      await expect(service.createPayment({ invoiceId: 1, paymentAmount: 100, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' }, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if Invoice is already PAID', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({ matchStatus: 'MATCHED', paymentStatus: 'PAID' });
      await expect(service.createPayment({ invoiceId: 1, paymentAmount: 100, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' }, 1)).rejects.toThrow(BadRequestException);
    });
    
    it('should throw error if amount exceeds total', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({ matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 100 });
      await expect(service.createPayment({ invoiceId: 1, paymentAmount: 200, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' }, 1)).rejects.toThrow(BadRequestException);
    });

    it('should create payment and update invoice successfully', async () => {
      const mockInvoice = { id: 1, poId: 1, matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 100, version: 1 };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockInvoice);
      mockQueryRunner.manager.count.mockResolvedValueOnce(0); // payment sequence
      mockQueryRunner.manager.save.mockResolvedValue({});

      const dto = { invoiceId: 1, paymentAmount: 100, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' };
      const result = await service.createPayment(dto, 1);
      
      expect(result).toHaveProperty('paymentNumber');
      expect(mockInvoice.paymentStatus).toBe('PAID');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle OptimisticLockVersionMismatchError gracefully', async () => {
        const mockInvoice = { id: 1, poId: 1, matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 100, version: 1 };
        mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockInvoice);
        mockQueryRunner.manager.count.mockResolvedValueOnce(0);
        
        const error = new Error('OptimisticLockVersionMismatchError');
        error.name = 'OptimisticLockVersionMismatchError';
        mockQueryRunner.manager.save.mockRejectedValueOnce(error);

        const dto = { invoiceId: 1, paymentAmount: 100, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' };
        await expect(service.createPayment(dto, 1)).rejects.toThrow('Data invoice telah berubah atau sedang diproses oleh pengguna lain. Silakan refresh halaman.');
    });

    it('should handle concurrency safely using Promise.all (Race condition simulation)', async () => {
      // Setup the same invoice
      const mockInvoice = { id: 1, poId: 1, matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 100, version: 1 };
      
      // We need to simulate that the first queryRunner saves successfully,
      // but the second one throws OptimisticLockVersionMismatchError because the version was incremented.
      
      // Mock findOne to return the invoice
      mockQueryRunner.manager.findOne.mockResolvedValue(mockInvoice);
      mockQueryRunner.manager.count.mockResolvedValue(0);

      // Mock save to succeed on first call, fail on second call
      const error = new Error('OptimisticLockVersionMismatchError');
      error.name = 'OptimisticLockVersionMismatchError';
      
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({}) // First call (payment save)
        .mockResolvedValueOnce({}) // First call (invoice save) -> SUCCEEDS
        .mockResolvedValueOnce({}) // Second call (payment save)
        .mockRejectedValueOnce(error); // Second call (invoice save) -> FAILS (version mismatch)

      const dto = { invoiceId: 1, paymentAmount: 100, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' };

      // Execute both concurrently
      const promises = [
        service.createPayment(dto, 1),
        service.createPayment(dto, 2)
      ];

      const results = await Promise.allSettled(promises);

      // One should be fulfilled, one should be rejected
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('telah berubah atau sedang diproses');
    });
  });
});
