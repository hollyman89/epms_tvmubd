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
var ProcurementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcurementService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const workflow_service_1 = require("../workflow-engine/workflow.service");
const purchase_request_entity_1 = require("../../entities/purchase-request.entity");
const purchase_request_item_entity_1 = require("../../entities/purchase-request-item.entity");
const rfq_entity_1 = require("../../entities/rfq.entity");
const vendor_comparison_entity_1 = require("../../entities/vendor-comparison.entity");
const purchase_order_entity_1 = require("../../entities/purchase-order.entity");
const purchase_order_item_entity_1 = require("../../entities/purchase-order-item.entity");
const goods_receipt_entity_1 = require("../../entities/goods-receipt.entity");
const goods_receipt_item_entity_1 = require("../../entities/goods-receipt-item.entity");
let ProcurementService = ProcurementService_1 = class ProcurementService {
    constructor(prRepo, rfqRepo, vendorComparisonRepo, poRepo, grRepo, workflowService, dataSource, eventEmitter) {
        this.prRepo = prRepo;
        this.rfqRepo = rfqRepo;
        this.vendorComparisonRepo = vendorComparisonRepo;
        this.poRepo = poRepo;
        this.grRepo = grRepo;
        this.workflowService = workflowService;
        this.dataSource = dataSource;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(ProcurementService_1.name);
    }
    async createAndSubmitPurchaseRequest(userId, dto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countToday = await queryRunner.manager.count(purchase_request_entity_1.PurchaseRequest, {
                where: { prNumber: require('typeorm').Like(`PR-${dateStr}-%`) }
            });
            const seq = String(countToday + 1).padStart(3, '0');
            const prNumber = `PR-${dateStr}-${seq}`;
            const wbsId = dto.wbsId;
            if (wbsId) {
                const wbsRes = await queryRunner.manager.query(`SELECT budget_allocation, task_name FROM project_wbs WHERE id = $1 FOR UPDATE`, [wbsId]);
                if (wbsRes && wbsRes.length > 0) {
                    const budgetAllocation = Number(wbsRes[0].budget_allocation || 0);
                    const poSpentRes = await queryRunner.manager.query(`SELECT COALESCE(SUM(total_amount), 0) AS spent 
             FROM purchase_orders 
             WHERE wbs_id = $1 AND status IN ('APPROVED', 'IN_PROGRESS')`, [wbsId]);
                    const spent = Number(poSpentRes[0].spent || 0);
                    const requested = Number(dto.totalEstimatedAmount || 0);
                    if (spent + requested > budgetAllocation && budgetAllocation > 0) {
                        const remaining = Math.max(0, budgetAllocation - spent);
                        throw new common_1.BadRequestException(`Alokasi Anggaran WBS '${wbsRes[0].task_name}' Terlampaui! Sisa anggaran: Rp ${remaining.toLocaleString('id-ID')}, Pengajuan: Rp ${requested.toLocaleString('id-ID')}`);
                    }
                }
            }
            const pr = queryRunner.manager.create(purchase_request_entity_1.PurchaseRequest, {
                projectId: dto.projectId,
                requesterId: userId,
                prNumber: prNumber,
                totalEstimatedAmount: dto.totalEstimatedAmount,
                status: 'SUBMITTED',
            });
            const savedPr = await queryRunner.manager.save(pr);
            const items = dto.items.map(itemDto => queryRunner.manager.create(purchase_request_item_entity_1.PurchaseRequestItem, {
                prId: savedPr.id,
                itemName: itemDto.itemName,
                quantity: itemDto.quantity,
                estimatedUnitPrice: itemDto.estimatedUnitPrice,
            }));
            await queryRunner.manager.save(items);
            await queryRunner.commitTransaction();
            this.logger.log(`PR ${savedPr.id} (${prNumber}) created and submitted. Delegating to Workflow Engine.`);
            const payload = {
                entity_type: "PURCHASE_REQUEST",
                entity_id: savedPr.id,
                total_estimated_amount: savedPr.totalEstimatedAmount,
                initiator_user_id: userId
            };
            this.eventEmitter.emit('workflow.trigger', payload);
            this.logger.log(`Event Emitted: workflow.trigger for PR ${savedPr.id}`);
            return {
                success: true,
                message: 'Purchase Request created and submitted successfully',
                data: savedPr
            };
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error creating PR: ${err.message}`, err.stack);
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
    async validateWbsBudget(wbsId, requestedAmount, manager) {
        if (!wbsId)
            return true;
        const queryManager = manager || this.dataSource.manager;
        const wbsRes = await queryManager.query(`SELECT budget_allocation, task_name FROM project_wbs WHERE id = $1 FOR UPDATE`, [wbsId]);
        if (!wbsRes || wbsRes.length === 0) {
            return true;
        }
        const budget = Number(wbsRes[0].budget_allocation || 0);
        const poSpentRes = await queryManager.query(`SELECT COALESCE(SUM(total_amount), 0) AS spent 
       FROM purchase_orders 
       WHERE wbs_id = $1 AND status IN ('APPROVED', 'IN_PROGRESS')`, [wbsId]);
        const spent = Number(poSpentRes[0]?.spent || 0);
        const sisaBudget = budget - spent;
        if (requestedAmount > sisaBudget && budget > 0) {
            throw new common_1.HttpException(`Sisa anggaran WBS tidak mencukupi (Tersedia: Rp ${Math.max(0, sisaBudget).toLocaleString('id-ID')}, Pengajuan: Rp ${requestedAmount.toLocaleString('id-ID')})`, common_1.HttpStatus.BAD_REQUEST);
        }
        return true;
    }
    async createRfq(dto) {
        const pr = await this.prRepo.findOne({ where: { id: dto.purchaseRequestId } });
        if (!pr) {
            throw new common_1.BadRequestException('Purchase Request not found');
        }
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const countToday = await this.rfqRepo.count({
            where: { rfqNumber: require('typeorm').Like(`RFQ-${dateStr}-%`) }
        });
        const seq = String(countToday + 1).padStart(3, '0');
        const rfqNumber = `RFQ-${dateStr}-${seq}`;
        const rfq = this.rfqRepo.create({
            prId: dto.purchaseRequestId,
            rfqNumber,
            closingDate: dto.closingDate,
            status: 'OPEN'
        });
        await this.rfqRepo.save(rfq);
        return {
            success: true,
            message: 'RFQ created successfully',
            data: rfq
        };
    }
    async submitVendorComparison(rfqId, vendorsData) {
        let totalEstimatedAmount = 0;
        const rfqRecords = await this.dataSource.query('SELECT pr_id FROM rfqs WHERE id = ?', [rfqId]);
        if (rfqRecords.length > 0) {
            const pr = await this.prRepo.findOne({ where: { id: rfqRecords[0].pr_id } });
            if (pr)
                totalEstimatedAmount = pr.totalEstimatedAmount;
        }
        else {
            const pr = await this.prRepo.findOne({ where: { id: rfqId } });
            if (pr)
                totalEstimatedAmount = pr.totalEstimatedAmount;
        }
        if (totalEstimatedAmount > 1000000 && vendorsData.length < 3) {
            throw new common_1.BadRequestException('Minimal 3 vendor diperlukan untuk perbandingan pengadaan di atas Rp 1.000.000');
        }
        const winners = vendorsData.filter(v => v.isWinner);
        if (winners.length !== 1) {
            throw new common_1.BadRequestException('Exactly 1 vendor must be selected as the winner.');
        }
        this.logger.log(`Vendor comparison submitted for RFQ ${rfqId}. Winner: ${winners[0].vendorId}`);
        const comparisons = vendorsData.map(v => this.vendorComparisonRepo.create({
            rfqId,
            vendorId: v.vendorId,
            offeredAmount: v.offeredAmount,
            isWinner: v.isWinner,
        }));
        await this.vendorComparisonRepo.save(comparisons);
        return {
            success: true,
            message: 'Vendor comparison submitted successfully',
            data: comparisons
        };
    }
    async createPurchaseOrder(userId, dto) {
        const pr = await this.prRepo.findOne({ where: { id: dto.purchase_request_id } });
        if (!pr)
            throw new common_1.BadRequestException('Purchase Request not found');
        if (pr.status !== 'APPROVED') {
            throw new common_1.BadRequestException('Purchase Request is not APPROVED yet');
        }
        const rfqs = await this.rfqRepo.find({ where: { prId: pr.id } });
        const rfqIds = rfqs.map(r => r.id);
        if (rfqIds.length === 0) {
            throw new common_1.BadRequestException('No RFQs found for this Purchase Request');
        }
        const winnerComparison = await this.vendorComparisonRepo.findOne({
            where: { vendorId: dto.vendor_id, isWinner: true }
        });
        const isWinner = await this.vendorComparisonRepo.createQueryBuilder('vc')
            .where('vc.rfqId IN (:...rfqIds)', { rfqIds })
            .andWhere('vc.vendorId = :vendorId', { vendorId: dto.vendor_id })
            .andWhere('vc.isWinner = :isWinner', { isWinner: true })
            .getOne();
        if (!isWinner) {
            throw new common_1.BadRequestException('The selected vendor is not the winner for this PR');
        }
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countToday = await queryRunner.manager.count(purchase_order_entity_1.PurchaseOrder, {
                where: { poNumber: require('typeorm').Like(`PO-${dateStr}-%`) }
            });
            const seq = String(countToday + 1).padStart(3, '0');
            const poNumber = `PO-${dateStr}-${seq}`;
            let totalAmount = 0;
            for (const item of dto.po_items) {
                totalAmount += Number(item.total_price);
            }
            const po = queryRunner.manager.create(purchase_order_entity_1.PurchaseOrder, {
                purchaseRequestId: pr.id,
                vendorId: dto.vendor_id,
                poNumber,
                totalAmount,
                status: 'ISSUED'
            });
            const savedPo = await queryRunner.manager.save(po);
            const items = dto.po_items.map(item => queryRunner.manager.create(purchase_order_item_entity_1.PurchaseOrderItem, {
                purchaseOrderId: savedPo.id,
                itemName: item.item_name,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                totalPrice: item.total_price
            }));
            await queryRunner.manager.save(items);
            pr.status = 'PO_ISSUED';
            await queryRunner.manager.save(pr);
            await queryRunner.commitTransaction();
            this.eventEmitter.emit('po.created', {
                purchase_order_id: savedPo.id,
                vendor_id: dto.vendor_id
            });
            this.logger.log(`RabbitMQ Event Emitted: po.created for PO ${savedPo.id}`);
            return {
                success: true,
                message: 'Purchase Order created successfully',
                data: savedPo
            };
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error creating PO: ${err.message}`, err.stack);
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getPurchaseOrderById(id) {
        const po = await this.poRepo.findOne({
            where: { id },
            relations: ['items', 'purchaseRequest']
        });
        if (!po) {
            throw new common_1.BadRequestException('Purchase Order not found');
        }
        return {
            success: true,
            message: 'Purchase Order retrieved successfully',
            data: po
        };
    }
    async createGoodsReceipt(dto, userId) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const po = await queryRunner.manager.findOne(purchase_order_entity_1.PurchaseOrder, {
                where: { id: dto.purchaseOrderId },
                relations: ['items']
            });
            if (!po) {
                throw new common_1.BadRequestException('Purchase Order not found');
            }
            if (po.status !== 'ISSUED' && po.status !== 'PARTIALLY_FULFILLED') {
                throw new common_1.BadRequestException(`Cannot receive goods for PO with status ${po.status}`);
            }
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const count = await queryRunner.manager.count(goods_receipt_entity_1.GoodsReceipt, {
                where: { grNumber: (0, typeorm_2.Like)(`GR-${dateStr}%`) }
            });
            const seq = String(count + 1).padStart(3, '0');
            const grNumber = `GR-${dateStr}-${seq}`;
            const gr = queryRunner.manager.create(goods_receipt_entity_1.GoodsReceipt, {
                poId: po.id,
                grNumber,
                receiptDate: new Date(dto.receiptDate),
                remarks: dto.remarks,
                createdBy: userId
            });
            const savedGr = await queryRunner.manager.save(gr);
            const grItemsToSave = [];
            let allItemsCompleted = true;
            let atLeastOneItemReceived = false;
            for (const itemDto of dto.items) {
                const poItem = po.items.find(i => i.id === itemDto.poItemId);
                if (!poItem) {
                    throw new common_1.BadRequestException(`PO Item ${itemDto.poItemId} does not belong to PO ${po.id}`);
                }
                const remainingQty = Number(poItem.quantity) - Number(poItem.receivedQuantity);
                if (itemDto.receivedQuantity > remainingQty) {
                    throw new common_1.BadRequestException(`Cannot receive ${itemDto.receivedQuantity} for item ${poItem.id}. Remaining quantity is ${remainingQty}`);
                }
                grItemsToSave.push(queryRunner.manager.create(goods_receipt_item_entity_1.GoodsReceiptItem, {
                    grId: savedGr.id,
                    poItemId: poItem.id,
                    receivedQuantity: itemDto.receivedQuantity,
                    remarks: itemDto.remarks,
                    createdBy: userId
                }));
                poItem.receivedQuantity = Number(poItem.receivedQuantity) + Number(itemDto.receivedQuantity);
                await queryRunner.manager.save(poItem);
            }
            await queryRunner.manager.save(grItemsToSave);
            for (const poItem of po.items) {
                if (Number(poItem.receivedQuantity) < Number(poItem.quantity)) {
                    allItemsCompleted = false;
                }
                if (Number(poItem.receivedQuantity) > 0) {
                    atLeastOneItemReceived = true;
                }
            }
            const originalStatus = po.status;
            if (allItemsCompleted) {
                po.status = 'COMPLETED';
            }
            else if (atLeastOneItemReceived) {
                po.status = 'PARTIALLY_FULFILLED';
            }
            if (po.status !== originalStatus) {
                await queryRunner.manager.save(po);
            }
            await queryRunner.commitTransaction();
            this.eventEmitter.emit('gr.created', {
                gr_id: savedGr.id,
                po_id: po.id
            });
            this.logger.log(`RabbitMQ Event Emitted: gr.created for GR ${savedGr.id}`);
            return {
                success: true,
                message: 'Goods Receipt created successfully',
                data: savedGr
            };
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error creating GR: ${err.message}`, err.stack);
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getGoodsReceiptById(grId) {
        const gr = await this.grRepo.findOne({
            where: { id: grId },
            relations: ['items'],
        });
        if (!gr) {
            throw new common_1.BadRequestException('Goods Receipt not found');
        }
        return gr;
    }
    async getAllPurchaseOrders() {
        return await this.poRepo.find({
            relations: ['items'],
            order: { createdAt: 'DESC' }
        });
    }
    async getAllPurchaseRequests() {
        return await this.prRepo.find({
            relations: ['items'],
            order: { createdAt: 'DESC' }
        });
    }
};
exports.ProcurementService = ProcurementService;
exports.ProcurementService = ProcurementService = ProcurementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(purchase_request_entity_1.PurchaseRequest)),
    __param(1, (0, typeorm_1.InjectRepository)(rfq_entity_1.Rfq)),
    __param(2, (0, typeorm_1.InjectRepository)(vendor_comparison_entity_1.VendorComparison)),
    __param(3, (0, typeorm_1.InjectRepository)(purchase_order_entity_1.PurchaseOrder)),
    __param(4, (0, typeorm_1.InjectRepository)(goods_receipt_entity_1.GoodsReceipt)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        workflow_service_1.WorkflowService,
        typeorm_2.DataSource,
        event_emitter_1.EventEmitter2])
], ProcurementService);
//# sourceMappingURL=procurement.service.js.map