"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const notification_controller_1 = require("./notification.controller");
const notification_service_1 = require("./notification.service");
const management_notification_consumer_1 = require("./management-notification.consumer");
const notification_event_listener_1 = require("./notification-event.listener");
const notification_entity_1 = require("../../entities/notification.entity");
const purchase_order_entity_1 = require("../../entities/purchase-order.entity");
const purchase_request_entity_1 = require("../../entities/purchase-request.entity");
const project_entity_1 = require("../../entities/project.entity");
const payment_entity_1 = require("../../entities/payment.entity");
const notification_gateway_1 = require("./notification.gateway");
const notification_listener_1 = require("./notification.listener");
const queue_module_1 = require("../queue/queue.module");
let NotificationModule = class NotificationModule {
};
exports.NotificationModule = NotificationModule;
exports.NotificationModule = NotificationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                notification_entity_1.Notification,
                purchase_order_entity_1.PurchaseOrder,
                purchase_request_entity_1.PurchaseRequest,
                project_entity_1.Project,
                payment_entity_1.Payment
            ]),
            queue_module_1.QueueModule
        ],
        controllers: [notification_controller_1.NotificationController],
        providers: [notification_service_1.NotificationService, notification_gateway_1.NotificationGateway, notification_event_listener_1.NotificationEventListener, management_notification_consumer_1.ManagementNotificationConsumer, notification_listener_1.NotificationListener],
        exports: [notification_service_1.NotificationService, notification_gateway_1.NotificationGateway, notification_listener_1.NotificationListener],
    })
], NotificationModule);
//# sourceMappingURL=notification.module.js.map