"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const invoice_entity_1 = require("../../entities/invoice.entity");
const invoice_item_entity_1 = require("../../entities/invoice-item.entity");
const payment_entity_1 = require("../../entities/payment.entity");
const purchase_order_entity_1 = require("../../entities/purchase-order.entity");
const goods_receipt_entity_1 = require("../../entities/goods-receipt.entity");
const event_emitter_1 = require("@nestjs/event-emitter");
let FinanceService = class FinanceService {
    constructor(dataSource, poRepository, grRepository, invoiceRepository, paymentRepository, eventEmitter) {
        this.dataSource = dataSource;
        this.poRepository = poRepository;
        this.grRepository = grRepository;
        this.invoiceRepository = invoiceRepository;
        this.paymentRepository = paymentRepository;
        this.eventEmitter = eventEmitter;
    }
    async createInvoice(dto, userId) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const po = await queryRunner.manager.findOne(purchase_order_entity_1.PurchaseOrder, {
                where: { id: dto.purchaseOrderId },
                relations: ['items']
            });
            if (!po) {
                throw new common_1.BadRequestException('PO not found');
            }
            if (po.status !== 'COMPLETED') {
                throw new common_1.BadRequestException('Invoice can only be created for COMPLETED Purchase Orders');
            }
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const count = await queryRunner.manager.count(invoice_entity_1.Invoice, {
                where: { invoiceNumber: (0, typeorm_2.Like)(`INV-${dateStr}%`) }
            });
            const seq = String(count + 1).padStart(3, '0');
            const invoiceNumber = `INV-${dateStr}-${seq}`;
            let totalInvoiceAmount = 0;
            const invoiceItems = [];
            for (const itemDto of dto.items) {
                const poItem = po.items.find(i => i.id === itemDto.poItemId);
                if (!poItem) {
                    throw new common_1.BadRequestException(`PO Item ${itemDto.poItemId} not found in this PO`);
                }
                const invItem = new invoice_item_entity_1.InvoiceItem();
                invItem.poItemId = itemDto.poItemId;
                invItem.quantity = itemDto.quantity;
                invItem.unitPrice = itemDto.unitPrice;
                invItem.totalPrice = itemDto.totalPrice;
                invItem.createdBy = userId;
                invoiceItems.push(invItem);
                totalInvoiceAmount += itemDto.totalPrice;
            }
            const totalPoAmount = Number(po.totalAmount);
            const goodsReceipts = await queryRunner.manager.find(goods_receipt_entity_1.GoodsReceipt, {
                where: { poId: po.id },
                relations: ['items']
            });
            let totalGrAmount = 0;
            for (const gr of goodsReceipts) {
                for (const grItem of gr.items) {
                    const matchedPoItem = po.items.find(i => i.id === grItem.poItemId);
                    if (matchedPoItem) {
                        totalGrAmount += Number(grItem.receivedQuantity) * Number(matchedPoItem.unitPrice);
                    }
                }
            }
            const isMatched = (Math.abs(totalInvoiceAmount - totalPoAmount) < 0.01 &&
                Math.abs(totalPoAmount - totalGrAmount) < 0.01);
            const matchStatus = isMatched ? 'MATCHED' : 'MISMATCHED';
            const invoice = new invoice_entity_1.Invoice();
            invoice.poId = po.id;
            invoice.invoiceNumber = invoiceNumber;
            invoice.invoiceDate = new Date(dto.invoiceDate);
            invoice.totalAmount = totalInvoiceAmount;
            invoice.matchStatus = matchStatus;
            invoice.createdBy = userId;
            invoice.items = invoiceItems;
            const savedInvoice = await queryRunner.manager.save(invoice);
            await queryRunner.commitTransaction();
            if (!isMatched) {
                this.eventEmitter.emit('finance.mismatch', {
                    invoiceId: savedInvoice.id,
                    invoiceNumber: savedInvoice.invoiceNumber,
                    poId: po.id,
                    totalInvoice: totalInvoiceAmount,
                    totalPO: totalPoAmount,
                    totalGR: totalGrAmount,
                    createdAt: new Date().toISOString()
                });
            }
            return savedInvoice;
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
    async createPayment(dto, userId) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const invoice = await queryRunner.manager.findOne(invoice_entity_1.Invoice, {
                where: { id: dto.invoiceId }
            });
            if (!invoice) {
                throw new common_1.BadRequestException('Invoice not found');
            }
            if (invoice.matchStatus !== 'MATCHED') {
                throw new common_1.BadRequestException('Invoice belum disetujui untuk pembayaran');
            }
            if (invoice.paymentStatus === 'PAID') {
                throw new common_1.BadRequestException('Invoice is already PAID');
            }
            if (dto.paymentAmount > Number(invoice.totalAmount)) {
                throw new common_1.BadRequestException('Payment amount cannot exceed invoice total amount');
            }
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const count = await queryRunner.manager.count(payment_entity_1.Payment, {
                where: { paymentNumber: (0, typeorm_2.Like)(`PAY-${dateStr}%`) }
            });
            const seq = String(count + 1).padStart(3, '0');
            const paymentNumber = `PAY-${dateStr}-${seq}`;
            const payment = new payment_entity_1.Payment();
            payment.invoiceId = invoice.id;
            payment.paymentNumber = paymentNumber;
            payment.paymentDate = new Date(dto.paymentDate);
            payment.amount = dto.paymentAmount;
            payment.createdBy = userId;
            await queryRunner.manager.save(payment);
            invoice.paymentStatus = 'PAID';
            invoice.updatedBy = userId;
            await queryRunner.manager.save(invoice);
            await queryRunner.commitTransaction();
            this.eventEmitter.emit('finance.payment_processed', {
                paymentId: payment.id,
                invoiceId: invoice.id,
                poId: invoice.poId,
                paymentNumber: payment.paymentNumber,
                amount: payment.amount,
                message: `Pembayaran untuk PO #${invoice.poId} telah diproses`,
                timestamp: new Date().toISOString()
            });
            return payment;
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            if (err instanceof typeorm_2.OptimisticLockVersionMismatchError ||
                err.name === 'OptimisticLockVersionMismatchError' ||
                err.message?.includes('OptimisticLockVersionMismatchError')) {
                throw new common_1.ConflictException('Data pembayaran telah berubah, silakan reload halaman');
            }
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getInvoices() {
        return this.invoiceRepository.find({
            relations: ['items', 'purchaseOrder']
        });
    }
    async getPayments() {
        return this.paymentRepository.find({
            relations: ['invoice']
        });
    }
};
exports.FinanceService = FinanceService;
exports.FinanceService = FinanceService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(purchase_order_entity_1.PurchaseOrder)),
    __param(2, (0, typeorm_1.InjectRepository)(goods_receipt_entity_1.GoodsReceipt)),
    __param(3, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __param(4, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], FinanceService);
//# sourceMappingURL=finance.service.js.map