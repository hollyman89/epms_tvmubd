"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const contract_service_1 = require("./contract.service");
const contract_controller_1 = require("./contract.controller");
const pdf_template_service_1 = require("./pdf-template.service");
const pdf_template_controller_1 = require("./pdf-template.controller");
const contract_entity_1 = require("../../entities/contract.entity");
const contract_amendment_entity_1 = require("../../entities/contract-amendment.entity");
const tender_entity_1 = require("../../entities/tender.entity");
const user_entity_1 = require("../../entities/user.entity");
const pdf_template_entity_1 = require("../../entities/pdf-template.entity");
const queue_module_1 = require("../queue/queue.module");
let ContractModule = class ContractModule {
};
exports.ContractModule = ContractModule;
exports.ContractModule = ContractModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([contract_entity_1.Contract, contract_amendment_entity_1.ContractAmendment, tender_entity_1.Tender, user_entity_1.User, pdf_template_entity_1.PdfTemplate]),
            queue_module_1.QueueModule,
        ],
        controllers: [contract_controller_1.ContractController, pdf_template_controller_1.PdfTemplateController],
        providers: [contract_service_1.ContractService, pdf_template_service_1.PdfTemplateService],
        exports: [contract_service_1.ContractService, pdf_template_service_1.PdfTemplateService],
    })
], ContractModule);
//# sourceMappingURL=contract.module.js.map