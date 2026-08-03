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
exports.Tender = exports.TenderStatus = void 0;
const typeorm_1 = require("typeorm");
const customer_entity_1 = require("./customer.entity");
const proposal_entity_1 = require("./proposal.entity");
var TenderStatus;
(function (TenderStatus) {
    TenderStatus["NEW"] = "NEW";
    TenderStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TenderStatus["NEGOTIATION"] = "NEGOTIATION";
    TenderStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    TenderStatus["WON"] = "WON";
    TenderStatus["LOST"] = "LOST";
})(TenderStatus || (exports.TenderStatus = TenderStatus = {}));
let Tender = class Tender {
};
exports.Tender = Tender;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint', unsigned: true }),
    __metadata("design:type", Number)
], Tender.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], Tender.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', unsigned: true }),
    __metadata("design:type", Number)
], Tender.prototype, "customer_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Tender.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Tender.prototype, "submission_deadline", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Tender.prototype, "estimated_budget", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 19, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Tender.prototype, "negotiated_price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 20 }),
    __metadata("design:type", Number)
], Tender.prototype, "max_discount_rate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Tender.prototype, "grace_deadline", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Tender.prototype, "spk_file_key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'], default: 'UNVERIFIED' }),
    __metadata("design:type", String)
], Tender.prototype, "spk_verification_status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', unsigned: true, nullable: true }),
    __metadata("design:type", Number)
], Tender.prototype, "marketing_pic_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], Tender.prototype, "pic_customer_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], Tender.prototype, "pic_customer_phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], Tender.prototype, "pic_customer_email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], Tender.prototype, "business_sector", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'LEAD' }),
    __metadata("design:type", String)
], Tender.prototype, "stage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Tender.prototype, "probability_percentage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' }),
    __metadata("design:type", String)
], Tender.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], Tender.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Tender.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], Tender.prototype, "expected_closing_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['TENDER', 'DIRECT_APPOINTMENT'], default: 'TENDER' }),
    __metadata("design:type", String)
], Tender.prototype, "procurement_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Tender.prototype, "project_location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], Tender.prototype, "bid_submission_deadline", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: TenderStatus, default: TenderStatus.NEW }),
    __metadata("design:type", String)
], Tender.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => customer_entity_1.Customer, (customer) => customer.tenders),
    (0, typeorm_1.JoinColumn)({ name: 'customer_id' }),
    __metadata("design:type", customer_entity_1.Customer)
], Tender.prototype, "customer", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => proposal_entity_1.Proposal, (proposal) => proposal.tender),
    __metadata("design:type", Array)
], Tender.prototype, "proposals", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', unsigned: true, nullable: true }),
    __metadata("design:type", Number)
], Tender.prototype, "created_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', unsigned: true, nullable: true }),
    __metadata("design:type", Number)
], Tender.prototype, "updated_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', unsigned: true, nullable: true }),
    __metadata("design:type", Number)
], Tender.prototype, "deleted_by", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Tender.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Tender.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)(),
    __metadata("design:type", Date)
], Tender.prototype, "deleted_at", void 0);
exports.Tender = Tender = __decorate([
    (0, typeorm_1.Entity)('tenders')
], Tender);
//# sourceMappingURL=tender.entity.js.map