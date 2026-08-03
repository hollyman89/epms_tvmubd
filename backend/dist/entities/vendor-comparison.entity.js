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
exports.VendorComparison = void 0;
const typeorm_1 = require("typeorm");
let VendorComparison = class VendorComparison {
};
exports.VendorComparison = VendorComparison;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], VendorComparison.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rfq_id' }),
    __metadata("design:type", Number)
], VendorComparison.prototype, "rfqId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vendor_id' }),
    __metadata("design:type", Number)
], VendorComparison.prototype, "vendorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, name: 'offered_amount' }),
    __metadata("design:type", Number)
], VendorComparison.prototype, "offeredAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_winner', default: false }),
    __metadata("design:type", Boolean)
], VendorComparison.prototype, "isWinner", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], VendorComparison.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], VendorComparison.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], VendorComparison.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at' }),
    __metadata("design:type", Date)
], VendorComparison.prototype, "deletedAt", void 0);
exports.VendorComparison = VendorComparison = __decorate([
    (0, typeorm_1.Entity)('vendor_comparisons')
], VendorComparison);
//# sourceMappingURL=vendor-comparison.entity.js.map