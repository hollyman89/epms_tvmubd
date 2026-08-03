"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const schedule_1 = require("@nestjs/schedule");
const workflow_module_1 = require("./modules/workflow-engine/workflow.module");
const procurement_module_1 = require("./modules/procurement/procurement.module");
const auth_module_1 = require("./modules/auth/auth.module");
const project_module_1 = require("./modules/project/project.module");
const finance_module_1 = require("./modules/finance/finance.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const notification_module_1 = require("./modules/notification/notification.module");
const document_module_1 = require("./modules/document/document.module");
const admin_user_module_1 = require("./modules/admin-user/admin-user.module");
const marketing_module_1 = require("./modules/marketing/marketing.module");
const legal_module_1 = require("./modules/legal/legal.module");
const customers_module_1 = require("./modules/customers/customers.module");
const analytics_module_1 = require("./modules/analytics/analytics.module");
const audit_module_1 = require("./modules/audit/audit.module");
const contract_module_1 = require("./modules/contract/contract.module");
const queue_module_1 = require("./modules/queue/queue.module");
const system_module_1 = require("./modules/system/system.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mysql',
                host: process.env.DATABASE_HOST,
                port: parseInt(process.env.DATABASE_PORT || '3306'),
                username: process.env.DATABASE_USER,
                password: process.env.DATABASE_PASSWORD,
                database: process.env.DATABASE_NAME,
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: false,
                logging: true,
            }),
            event_emitter_1.EventEmitterModule.forRoot(),
            system_module_1.SystemModule,
            queue_module_1.QueueModule,
            workflow_module_1.WorkflowModule,
            procurement_module_1.ProcurementModule,
            finance_module_1.FinanceModule,
            dashboard_module_1.DashboardModule,
            notification_module_1.NotificationModule,
            document_module_1.DocumentModule,
            admin_user_module_1.AdminUserModule,
            auth_module_1.AuthModule,
            project_module_1.ProjectModule,
            marketing_module_1.MarketingModule,
            legal_module_1.LegalModule,
            customers_module_1.CustomersModule,
            analytics_module_1.AnalyticsModule,
            audit_module_1.AuditModule,
            contract_module_1.ContractModule,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map