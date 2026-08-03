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
exports.TenderPriceHistory = void 0;
const typeorm_1 = require("typeorm");
const tender_entity_1 = require("./tender.entity");
let TenderPriceHistory = class TenderPriceHistory {
};
exports.TenderPriceHistory = TenderPriceHistory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint', unsigned: true }),
    __metadata("design:type", Number)
], TenderPriceHistory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', unsigned: true }),
    __metadata("design:type", Number)
], TenderPriceHistory.prototype, "tender_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], TenderPriceHistory.prototype, "old_price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], TenderPriceHistory.prototype, "new_price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', unsigned: true }),
    __metadata("design:type", Number)
], TenderPriceHistory.prototype, "changed_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], TenderPriceHistory.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TenderPriceHistory.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tender_entity_1.Tender),
    (0, typeorm_1.JoinColumn)({ name: 'tender_id' }),
    __metadata("design:type", tender_entity_1.Tender)
], TenderPriceHistory.prototype, "tender", void 0);
exports.TenderPriceHistory = TenderPriceHistory = __decorate([
    (0, typeorm_1.Entity)('tender_price_history')
], TenderPriceHistory);
//# sourceMappingURL=tender-price-history.entity.js.map