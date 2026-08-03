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
exports.Rfq = void 0;
const typeorm_1 = require("typeorm");
const purchase_request_entity_1 = require("./purchase-request.entity");
let Rfq = class Rfq {
};
exports.Rfq = Rfq;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Rfq.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pr_id' }),
    __metadata("design:type", Number)
], Rfq.prototype, "prId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rfq_number', unique: true }),
    __metadata("design:type", String)
], Rfq.prototype, "rfqNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'OPEN' }),
    __metadata("design:type", String)
], Rfq.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'closing_date', nullable: true }),
    __metadata("design:type", Date)
], Rfq.prototype, "closingDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Rfq.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Rfq.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at' }),
    __metadata("design:type", Date)
], Rfq.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => purchase_request_entity_1.PurchaseRequest, pr => pr.rfqs, { onDelete: 'RESTRICT' }),
    (0, typeorm_1.JoinColumn)({ name: 'pr_id' }),
    __metadata("design:type", purchase_request_entity_1.PurchaseRequest)
], Rfq.prototype, "purchaseRequest", void 0);
exports.Rfq = Rfq = __decorate([
    (0, typeorm_1.Entity)('rfqs')
], Rfq);
//# sourceMappingURL=rfq.entity.js.map