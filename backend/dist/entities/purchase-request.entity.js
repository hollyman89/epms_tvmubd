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
exports.PurchaseRequest = void 0;
const typeorm_1 = require("typeorm");
const purchase_request_item_entity_1 = require("./purchase-request-item.entity");
const rfq_entity_1 = require("./rfq.entity");
let PurchaseRequest = class PurchaseRequest {
};
exports.PurchaseRequest = PurchaseRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PurchaseRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], PurchaseRequest.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'project_id' }),
    __metadata("design:type", Number)
], PurchaseRequest.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requester_id' }),
    __metadata("design:type", Number)
], PurchaseRequest.prototype, "requesterId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pr_number', unique: true }),
    __metadata("design:type", String)
], PurchaseRequest.prototype, "prNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, name: 'total_estimated_amount', default: 0 }),
    __metadata("design:type", Number)
], PurchaseRequest.prototype, "totalEstimatedAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'DRAFT' }),
    __metadata("design:type", String)
], PurchaseRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => purchase_request_item_entity_1.PurchaseRequestItem, item => item.purchaseRequest, { cascade: true }),
    __metadata("design:type", Array)
], PurchaseRequest.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => rfq_entity_1.Rfq, rfq => rfq.purchaseRequest, { cascade: true }),
    __metadata("design:type", Array)
], PurchaseRequest.prototype, "rfqs", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PurchaseRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PurchaseRequest.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at' }),
    __metadata("design:type", Date)
], PurchaseRequest.prototype, "deletedAt", void 0);
exports.PurchaseRequest = PurchaseRequest = __decorate([
    (0, typeorm_1.Entity)('purchase_requests')
], PurchaseRequest);
//# sourceMappingURL=purchase-request.entity.js.map