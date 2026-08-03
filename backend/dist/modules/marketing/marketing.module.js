"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const marketing_controller_1 = require("./marketing.controller");
const marketing_service_1 = require("./marketing.service");
const tender_scheduler_1 = require("./tender.scheduler");
const customer_entity_1 = require("../../entities/customer.entity");
const tender_entity_1 = require("../../entities/tender.entity");
const proposal_entity_1 = require("../../entities/proposal.entity");
const contract_entity_1 = require("../../entities/contract.entity");
const tender_activity_entity_1 = require("../../entities/tender-activity.entity");
const tender_price_history_entity_1 = require("../../entities/tender-price-history.entity");
const user_entity_1 = require("../../entities/user.entity");
const notification_module_1 = require("../notification/notification.module");
const sales_gateway_1 = require("./sales.gateway");
let MarketingModule = class MarketingModule {
};
exports.MarketingModule = MarketingModule;
exports.MarketingModule = MarketingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([customer_entity_1.Customer, tender_entity_1.Tender, proposal_entity_1.Proposal, contract_entity_1.Contract, tender_activity_entity_1.TenderActivity, tender_price_history_entity_1.TenderPriceHistory, user_entity_1.User]),
            notification_module_1.NotificationModule,
        ],
        controllers: [marketing_controller_1.MarketingController],
        providers: [marketing_service_1.MarketingService, tender_scheduler_1.TenderScheduler, sales_gateway_1.SalesGateway],
        exports: [marketing_service_1.MarketingService, sales_gateway_1.SalesGateway],
    })
], MarketingModule);
//# sourceMappingURL=marketing.module.js.map