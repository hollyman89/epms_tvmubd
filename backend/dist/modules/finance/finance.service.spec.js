"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const finance_service_1 = require("./finance.service");
const typeorm_1 = require("@nestjs/typeorm");
const invoice_entity_1 = require("../../entities/invoice.entity");
const payment_entity_1 = require("../../entities/payment.entity");
const purchase_order_entity_1 = require("../../entities/purchase-order.entity");
const goods_receipt_entity_1 = require("../../entities/goods-receipt.entity");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_2 = require("typeorm");
const common_1 = require("@nestjs/common");
describe('FinanceService', () => {
    let service;
    let mockQueryRunner;
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
        const module = await testing_1.Test.createTestingModule({
            providers: [
                finance_service_1.FinanceService,
                {
                    provide: typeorm_2.DataSource,
                    useValue: {
                        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
                    },
                },
                { provide: (0, typeorm_1.getRepositoryToken)(invoice_entity_1.Invoice), useValue: { find: jest.fn() } },
                { provide: (0, typeorm_1.getRepositoryToken)(payment_entity_1.Payment), useValue: { find: jest.fn() } },
                { provide: (0, typeorm_1.getRepositoryToken)(purchase_order_entity_1.PurchaseOrder), useValue: {} },
                { provide: (0, typeorm_1.getRepositoryToken)(goods_receipt_entity_1.GoodsReceipt), useValue: {} },
                { provide: event_emitter_1.EventEmitter2, useValue: { emit: jest.fn() } },
            ],
        }).compile();
        service = module.get(finance_service_1.FinanceService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('createInvoice', () => {
        it('should throw error if PO not found', async () => {
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
            await expect(service.createInvoice({ purchaseOrderId: 1, invoiceDate: '2026-07-20', items: [] }, 1)).rejects.toThrow(common_1.BadRequestException);
        });
        it('should throw error if PO status is not COMPLETED', async () => {
            mockQueryRunner.manager.findOne.mockResolvedValueOnce({ status: 'PENDING' });
            await expect(service.createInvoice({ purchaseOrderId: 1, invoiceDate: '2026-07-20', items: [] }, 1)).rejects.toThrow(common_1.BadRequestException);
        });
        it('should successfully create invoice for COMPLETED PO', async () => {
            const mockPo = { id: 1, status: 'COMPLETED', items: [{ id: 1, itemName: 'Test Item', quantity: 1, unitPrice: 100 }] };
            mockQueryRunner.manager.findOne.mockResolvedValue(mockPo);
            mockQueryRunner.manager.count.mockResolvedValueOnce(0);
            mockQueryRunner.manager.save.mockImplementation(entity => {
                if (!entity.id)
                    entity.id = 1;
                return entity;
            });
            const mockGr = { id: 1, status: 'DELIVERED', items: [] };
            mockQueryRunner.manager.find.mockResolvedValue([mockGr]);
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
            await expect(service.createPayment({ invoiceId: 1, paymentAmount: 100, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' }, 1)).rejects.toThrow(common_1.BadRequestException);
        });
        it('should throw error if Invoice is not MATCHED', async () => {
            mockQueryRunner.manager.findOne.mockResolvedValueOnce({ matchStatus: 'MISMATCH' });
            await expect(service.createPayment({ invoiceId: 1, paymentAmount: 100, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' }, 1)).rejects.toThrow(common_1.BadRequestException);
        });
        it('should throw error if Invoice is already PAID', async () => {
            mockQueryRunner.manager.findOne.mockResolvedValueOnce({ matchStatus: 'MATCHED', paymentStatus: 'PAID' });
            await expect(service.createPayment({ invoiceId: 1, paymentAmount: 100, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' }, 1)).rejects.toThrow(common_1.BadRequestException);
        });
        it('should throw error if amount exceeds total', async () => {
            mockQueryRunner.manager.findOne.mockResolvedValueOnce({ matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 100 });
            await expect(service.createPayment({ invoiceId: 1, paymentAmount: 200, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' }, 1)).rejects.toThrow(common_1.BadRequestException);
        });
        it('should create payment and update invoice successfully', async () => {
            const mockInvoice = { id: 1, poId: 1, matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 100, version: 1 };
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockInvoice);
            mockQueryRunner.manager.count.mockResolvedValueOnce(0);
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
            const mockInvoice = { id: 1, poId: 1, matchStatus: 'MATCHED', paymentStatus: 'UNPAID', totalAmount: 100, version: 1 };
            mockQueryRunner.manager.findOne.mockResolvedValue(mockInvoice);
            mockQueryRunner.manager.count.mockResolvedValue(0);
            const error = new Error('OptimisticLockVersionMismatchError');
            error.name = 'OptimisticLockVersionMismatchError';
            mockQueryRunner.manager.save
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(error);
            const dto = { invoiceId: 1, paymentAmount: 100, paymentDate: '2026-01-01', paymentMethod: 'TRANSFER', referenceNumber: 'REF123' };
            const promises = [
                service.createPayment(dto, 1),
                service.createPayment(dto, 2)
            ];
            const results = await Promise.allSettled(promises);
            const fulfilled = results.filter(r => r.status === 'fulfilled');
            const rejected = results.filter(r => r.status === 'rejected');
            expect(fulfilled.length).toBe(1);
            expect(rejected.length).toBe(1);
            expect(rejected[0].reason.message).toContain('telah berubah atau sedang diproses');
        });
    });
});
//# sourceMappingURL=finance.service.spec.js.map