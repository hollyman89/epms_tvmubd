"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const legal_controller_1 = require("./legal.controller");
const legal_service_1 = require("./legal.service");
const sla_grace_service_1 = require("./sla-grace.service");
const contract_entity_1 = require("../../entities/contract.entity");
const proposal_entity_1 = require("../../entities/proposal.entity");
const tender_entity_1 = require("../../entities/tender.entity");
const project_entity_1 = require("../../entities/project.entity");
const audit_log_entity_1 = require("../../entities/audit-log.entity");
const outbox_event_entity_1 = require("../../entities/outbox-event.entity");
let LegalModule = class LegalModule {
};
exports.LegalModule = LegalModule;
exports.LegalModule = LegalModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([contract_entity_1.Contract, proposal_entity_1.Proposal, tender_entity_1.Tender, project_entity_1.Project, audit_log_entity_1.AuditLog, outbox_event_entity_1.OutboxEvent])],
        controllers: [legal_controller_1.LegalController],
        providers: [legal_service_1.LegalService, sla_grace_service_1.SlaGraceService],
        exports: [legal_service_1.LegalService, sla_grace_service_1.SlaGraceService],
    })
], LegalModule);
//# sourceMappingURL=legal.module.js.map