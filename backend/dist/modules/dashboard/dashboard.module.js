"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const cache_manager_1 = require("@nestjs/cache-manager");
const dashboard_controller_1 = require("./dashboard.controller");
const dashboard_service_1 = require("./dashboard.service");
const dashboard_kpi_entity_1 = require("../../entities/dashboard-kpi.entity");
const project_entity_1 = require("../../entities/project.entity");
const payment_entity_1 = require("../../entities/payment.entity");
const purchase_order_entity_1 = require("../../entities/purchase-order.entity");
const purchase_request_entity_1 = require("../../entities/purchase-request.entity");
let DashboardModule = class DashboardModule {
};
exports.DashboardModule = DashboardModule;
exports.DashboardModule = DashboardModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                dashboard_kpi_entity_1.DashboardKpi,
                project_entity_1.Project,
                payment_entity_1.Payment,
                purchase_order_entity_1.PurchaseOrder,
                purchase_request_entity_1.PurchaseRequest
            ]),
            cache_manager_1.CacheModule.register({
                ttl: 60000,
                max: 100,
            }),
        ],
        controllers: [dashboard_controller_1.DashboardController],
        providers: [dashboard_service_1.DashboardService],
    })
], DashboardModule);
//# sourceMappingURL=dashboard.module.js.map