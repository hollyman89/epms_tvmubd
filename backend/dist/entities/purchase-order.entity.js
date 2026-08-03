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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrder = void 0;
const typeorm_1 = require("typeorm");
const purchase_request_entity_1 = require("./purchase-request.entity");
const purchase_order_item_entity_1 = require("./purchase-order-item.entity");
const goods_receipt_entity_1 = require("./goods-receipt.entity");
const invoice_entity_1 = require("./invoice.entity");
let PurchaseOrder = class PurchaseOrder {
};
exports.PurchaseOrder = PurchaseOrder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PurchaseOrder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], PurchaseOrder.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pr_id' }),
    __metadata("design:type", Number)
], PurchaseOrder.prototype, "purchaseRequestId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vendor_id' }),
    __metadata("design:type", Number)
], PurchaseOrder.prototype, "vendorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'po_number', unique: true }),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "poNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, name: 'total_amount', default: 0 }),
    __metadata("design:type", Number)
], PurchaseOrder.prototype, "totalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'DRAFT' }),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PurchaseOrder.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PurchaseOrder.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at' }),
    __metadata("design:type", Date)
], PurchaseOrder.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => purchase_request_entity_1.PurchaseRequest, { onDelete: 'RESTRICT' }),
    (0, typeorm_1.JoinColumn)({ name: 'pr_id' }),
    __metadata("design:type", purchase_request_entity_1.PurchaseRequest)
], PurchaseOrder.prototype, "purchaseRequest", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => purchase_order_item_entity_1.PurchaseOrderItem, item => item.purchaseOrder, { cascade: true }),
    __metadata("design:type", Array)
], PurchaseOrder.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => goods_receipt_entity_1.GoodsReceipt, gr => gr.purchaseOrder),
    __metadata("design:type", Array)
], PurchaseOrder.prototype, "goodsReceipts", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => invoice_entity_1.Invoice, inv => inv.purchaseOrder),
    __metadata("design:type", Array)
], PurchaseOrder.prototype, "invoices", void 0);
exports.PurchaseOrder = PurchaseOrder = __decorate([
    (0, typeorm_1.Entity)('purchase_orders')
], PurchaseOrder);
//# sourceMappingURL=purchase-order.entity.js.map