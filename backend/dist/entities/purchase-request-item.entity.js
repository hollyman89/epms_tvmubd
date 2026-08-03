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
exports.PurchaseRequestItem = void 0;
const typeorm_1 = require("typeorm");
const purchase_request_entity_1 = require("./purchase-request.entity");
let PurchaseRequestItem = class PurchaseRequestItem {
};
exports.PurchaseRequestItem = PurchaseRequestItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PurchaseRequestItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pr_id' }),
    __metadata("design:type", Number)
], PurchaseRequestItem.prototype, "prId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_name' }),
    __metadata("design:type", String)
], PurchaseRequestItem.prototype, "itemName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], PurchaseRequestItem.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'PCS' }),
    __metadata("design:type", String)
], PurchaseRequestItem.prototype, "uom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, name: 'estimated_unit_price' }),
    __metadata("design:type", Number)
], PurchaseRequestItem.prototype, "estimatedUnitPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, name: 'total_price', insert: false, update: false }),
    __metadata("design:type", Number)
], PurchaseRequestItem.prototype, "totalPrice", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => purchase_request_entity_1.PurchaseRequest, pr => pr.items, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'pr_id' }),
    __metadata("design:type", purchase_request_entity_1.PurchaseRequest)
], PurchaseRequestItem.prototype, "purchaseRequest", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PurchaseRequestItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PurchaseRequestItem.prototype, "updatedAt", void 0);
exports.PurchaseRequestItem = PurchaseRequestItem = __decorate([
    (0, typeorm_1.Entity)('purchase_request_items')
], PurchaseRequestItem);
//# sourceMappingURL=purchase-request-item.entity.js.map