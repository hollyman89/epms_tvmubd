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
exports.PurchaseOrderItem = void 0;
const typeorm_1 = require("typeorm");
const purchase_order_entity_1 = require("./purchase-order.entity");
let PurchaseOrderItem = class PurchaseOrderItem {
};
exports.PurchaseOrderItem = PurchaseOrderItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PurchaseOrderItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'purchase_order_id' }),
    __metadata("design:type", Number)
], PurchaseOrderItem.prototype, "purchaseOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_name' }),
    __metadata("design:type", String)
], PurchaseOrderItem.prototype, "itemName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], PurchaseOrderItem.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, name: 'received_quantity', default: 0 }),
    __metadata("design:type", Number)
], PurchaseOrderItem.prototype, "receivedQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, name: 'unit_price' }),
    __metadata("design:type", Number)
], PurchaseOrderItem.prototype, "unitPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, name: 'total_price', default: 0 }),
    __metadata("design:type", Number)
], PurchaseOrderItem.prototype, "totalPrice", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PurchaseOrderItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PurchaseOrderItem.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at' }),
    __metadata("design:type", Date)
], PurchaseOrderItem.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => purchase_order_entity_1.PurchaseOrder, po => po.items, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'purchase_order_id' }),
    __metadata("design:type", purchase_order_entity_1.PurchaseOrder)
], PurchaseOrderItem.prototype, "purchaseOrder", void 0);
exports.PurchaseOrderItem = PurchaseOrderItem = __decorate([
    (0, typeorm_1.Entity)('purchase_order_items')
], PurchaseOrderItem);
//# sourceMappingURL=purchase-order-item.entity.js.map