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
exports.GoodsReceipt = void 0;
const typeorm_1 = require("typeorm");
const purchase_order_entity_1 = require("./purchase-order.entity");
const goods_receipt_item_entity_1 = require("./goods-receipt-item.entity");
let GoodsReceipt = class GoodsReceipt {
};
exports.GoodsReceipt = GoodsReceipt;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], GoodsReceipt.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], GoodsReceipt.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'po_id' }),
    __metadata("design:type", Number)
], GoodsReceipt.prototype, "poId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gr_number', unique: true }),
    __metadata("design:type", String)
], GoodsReceipt.prototype, "grNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'receipt_date', type: 'datetime' }),
    __metadata("design:type", Date)
], GoodsReceipt.prototype, "receiptDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], GoodsReceipt.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', nullable: true }),
    __metadata("design:type", Number)
], GoodsReceipt.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_by', nullable: true }),
    __metadata("design:type", Number)
], GoodsReceipt.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_by', nullable: true }),
    __metadata("design:type", Number)
], GoodsReceipt.prototype, "deletedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], GoodsReceipt.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], GoodsReceipt.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], GoodsReceipt.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => purchase_order_entity_1.PurchaseOrder, po => po.goodsReceipts, { onDelete: 'RESTRICT' }),
    (0, typeorm_1.JoinColumn)({ name: 'po_id' }),
    __metadata("design:type", purchase_order_entity_1.PurchaseOrder)
], GoodsReceipt.prototype, "purchaseOrder", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => goods_receipt_item_entity_1.GoodsReceiptItem, item => item.goodsReceipt, { cascade: true }),
    __metadata("design:type", Array)
], GoodsReceipt.prototype, "items", void 0);
exports.GoodsReceipt = GoodsReceipt = __decorate([
    (0, typeorm_1.Entity)('goods_receipts')
], GoodsReceipt);
//# sourceMappingURL=goods-receipt.entity.js.map