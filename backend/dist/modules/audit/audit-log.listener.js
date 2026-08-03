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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuditLogListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_1 = require("../../entities/audit-log.entity");
let AuditLogListener = AuditLogListener_1 = class AuditLogListener {
    constructor(auditLogRepo) {
        this.auditLogRepo = auditLogRepo;
        this.logger = new common_1.Logger(AuditLogListener_1.name);
    }
    async handleAuditLog(payload) {
        this.logger.log(`[audit.log] Received event for ${payload.entityName} ID: ${payload.entityId} Action: ${payload.action}`);
        try {
            const log = new audit_log_entity_1.AuditLog();
            log.table_name = payload.entityName;
            log.record_id = payload.entityId;
            log.action = payload.action;
            const finalNewValue = payload.newValue || {};
            if (payload.reason) {
                finalNewValue.reason = payload.reason;
            }
            log.old_value = payload.oldValue || null;
            log.new_value = Object.keys(finalNewValue).length > 0 ? finalNewValue : null;
            log.created_by = payload.userId || 0;
            log.ip_address = payload.ipAddress || null;
            log.user_agent = payload.userAgent || null;
            await this.auditLogRepo.save(log);
        }
        catch (err) {
            this.logger.error(`[audit.log] Failed to save audit log: ${err.message}`, err.stack);
        }
    }
};
exports.AuditLogListener = AuditLogListener;
__decorate([
    (0, event_emitter_1.OnEvent)('audit.log'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuditLogListener.prototype, "handleAuditLog", null);
exports.AuditLogListener = AuditLogListener = AuditLogListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuditLogListener);
//# sourceMappingURL=audit-log.listener.js.map