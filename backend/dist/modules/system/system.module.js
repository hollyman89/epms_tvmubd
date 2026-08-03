"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@nestjs/core");
const observability_controller_1 = require("./observability.controller");
const observability_service_1 = require("./observability.service");
const tracing_interceptor_1 = require("./tracing.interceptor");
const outbox_event_entity_1 = require("../../entities/outbox-event.entity");
const contract_entity_1 = require("../../entities/contract.entity");
const tender_entity_1 = require("../../entities/tender.entity");
const project_entity_1 = require("../../entities/project.entity");
const audit_log_entity_1 = require("../../entities/audit-log.entity");
let SystemModule = class SystemModule {
};
exports.SystemModule = SystemModule;
exports.SystemModule = SystemModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([outbox_event_entity_1.OutboxEvent, contract_entity_1.Contract, tender_entity_1.Tender, project_entity_1.Project, audit_log_entity_1.AuditLog]),
        ],
        controllers: [observability_controller_1.ObservabilityController],
        providers: [
            observability_service_1.ObservabilityService,
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: tracing_interceptor_1.TracingInterceptor,
            },
        ],
        exports: [observability_service_1.ObservabilityService],
    })
], SystemModule);
//# sourceMappingURL=system.module.js.map