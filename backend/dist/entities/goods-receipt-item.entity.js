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
exports.GoodsReceiptItem = void 0;
const typeorm_1 = require("typeorm");
const goods_receipt_entity_1 = require("./goods-receipt.entity");
const purchase_order_item_entity_1 = require("./purchase-order-item.entity");
let GoodsReceiptItem = class GoodsReceiptItem {
};
exports.GoodsReceiptItem = GoodsReceiptItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], GoodsReceiptItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gr_id' }),
    __metadata("design:type", Number)
], GoodsReceiptItem.prototype, "grId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'po_item_id' }),
    __metadata("design:type", Number)
], GoodsReceiptItem.prototype, "poItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, name: 'received_quantity', default: 0 }),
    __metadata("design:type", Number)
], GoodsReceiptItem.prototype, "receivedQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], GoodsReceiptItem.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', nullable: true }),
    __metadata("design:type", Number)
], GoodsReceiptItem.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_by', nullable: true }),
    __metadata("design:type", Number)
], GoodsReceiptItem.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_by', nullable: true }),
    __metadata("design:type", Number)
], GoodsReceiptItem.prototype, "deletedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], GoodsReceiptItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], GoodsReceiptItem.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], GoodsReceiptItem.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => goods_receipt_entity_1.GoodsReceipt, gr => gr.items, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'gr_id' }),
    __metadata("design:type", goods_receipt_entity_1.GoodsReceipt)
], GoodsReceiptItem.prototype, "goodsReceipt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => purchase_order_item_entity_1.PurchaseOrderItem, { onDelete: 'RESTRICT' }),
    (0, typeorm_1.JoinColumn)({ name: 'po_item_id' }),
    __metadata("design:type", purchase_order_item_entity_1.PurchaseOrderItem)
], GoodsReceiptItem.prototype, "purchaseOrderItem", void 0);
exports.GoodsReceiptItem = GoodsReceiptItem = __decorate([
    (0, typeorm_1.Entity)('goods_receipt_items')
], GoodsReceiptItem);
//# sourceMappingURL=goods-receipt-item.entity.js.map