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
exports.OutboxEvent = exports.OutboxStatus = void 0;
const typeorm_1 = require("typeorm");
var OutboxStatus;
(function (OutboxStatus) {
    OutboxStatus["PENDING"] = "PENDING";
    OutboxStatus["PROCESSING"] = "PROCESSING";
    OutboxStatus["PUBLISHED"] = "PUBLISHED";
    OutboxStatus["FAILED"] = "FAILED";
})(OutboxStatus || (exports.OutboxStatus = OutboxStatus = {}));
let OutboxEvent = class OutboxEvent {
};
exports.OutboxEvent = OutboxEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint', unsigned: true }),
    __metadata("design:type", Number)
], OutboxEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], OutboxEvent.prototype, "event_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], OutboxEvent.prototype, "event_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: '1.0' }),
    __metadata("design:type", String)
], OutboxEvent.prototype, "event_version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], OutboxEvent.prototype, "aggregate_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', unsigned: true }),
    __metadata("design:type", Number)
], OutboxEvent.prototype, "aggregate_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], OutboxEvent.prototype, "correlation_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], OutboxEvent.prototype, "transaction_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json' }),
    __metadata("design:type", Object)
], OutboxEvent.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING }),
    __metadata("design:type", String)
], OutboxEvent.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], OutboxEvent.prototype, "retry_count", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OutboxEvent.prototype, "error_message", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], OutboxEvent.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], OutboxEvent.prototype, "published_at", void 0);
exports.OutboxEvent = OutboxEvent = __decorate([
    (0, typeorm_1.Entity)('outbox_events')
], OutboxEvent);
//# sourceMappingURL=outbox-event.entity.js.map