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
exports.InvoiceItem = void 0;
const typeorm_1 = require("typeorm");
const invoice_entity_1 = require("./invoice.entity");
const purchase_order_item_entity_1 = require("./purchase-order-item.entity");
let InvoiceItem = class InvoiceItem {
};
exports.InvoiceItem = InvoiceItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], InvoiceItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_id' }),
    __metadata("design:type", Number)
], InvoiceItem.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'po_item_id' }),
    __metadata("design:type", Number)
], InvoiceItem.prototype, "poItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], InvoiceItem.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, name: 'unit_price' }),
    __metadata("design:type", Number)
], InvoiceItem.prototype, "unitPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, name: 'total_price' }),
    __metadata("design:type", Number)
], InvoiceItem.prototype, "totalPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', nullable: true }),
    __metadata("design:type", Number)
], InvoiceItem.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_by', nullable: true }),
    __metadata("design:type", Number)
], InvoiceItem.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_by', nullable: true }),
    __metadata("design:type", Number)
], InvoiceItem.prototype, "deletedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], InvoiceItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], InvoiceItem.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], InvoiceItem.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => invoice_entity_1.Invoice, inv => inv.items, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'invoice_id' }),
    __metadata("design:type", invoice_entity_1.Invoice)
], InvoiceItem.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => purchase_order_item_entity_1.PurchaseOrderItem, { onDelete: 'RESTRICT' }),
    (0, typeorm_1.JoinColumn)({ name: 'po_item_id' }),
    __metadata("design:type", purchase_order_item_entity_1.PurchaseOrderItem)
], InvoiceItem.prototype, "purchaseOrderItem", void 0);
exports.InvoiceItem = InvoiceItem = __decorate([
    (0, typeorm_1.Entity)('invoice_items')
], InvoiceItem);
//# sourceMappingURL=invoice-item.entity.js.map