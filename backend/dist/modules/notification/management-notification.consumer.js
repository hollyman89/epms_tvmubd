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
var ManagementNotificationConsumer_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagementNotificationConsumer = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("../../entities/notification.entity");
const notification_gateway_1 = require("./notification.gateway");
let ManagementNotificationConsumer = ManagementNotificationConsumer_1 = class ManagementNotificationConsumer {
    constructor(notificationRepo, dataSource, notificationGateway) {
        this.notificationRepo = notificationRepo;
        this.dataSource = dataSource;
        this.notificationGateway = notificationGateway;
        this.logger = new common_1.Logger(ManagementNotificationConsumer_1.name);
    }
    async handleManagementUpdate(data) {
        this.logger.log(`Received marketing.tender.management_update event: ${JSON.stringify(data)}`);
        try {
            const { tenderId, title, customerName, estimatedBudget, updatedBy, action } = data;
            let query = `
        SELECT u.id, GROUP_CONCAT(r.name) as roles
        FROM users u 
        JOIN user_roles ur ON u.id = ur.user_id 
        JOIN roles r ON r.id = ur.role_id 
        WHERE r.name IN ('SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR') 
          AND u.deleted_at IS NULL
        GROUP BY u.id
      `;
            let queryParams = [];
            if (action === 'MARKED_WON' || action === 'UPDATED') {
                query = `
          SELECT u.id, GROUP_CONCAT(r.name) as roles
          FROM users u 
          JOIN user_roles ur ON u.id = ur.user_id 
          JOIN roles r ON r.id = ur.role_id 
          WHERE (r.name IN ('SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR') OR u.id = ?) 
            AND u.deleted_at IS NULL
          GROUP BY u.id
        `;
                queryParams.push(data.updaterId || 0);
            }
            const managers = await this.dataSource.query(query, queryParams);
            if (!managers || managers.length === 0) {
                this.logger.warn('No target users found to receive notification.');
                return;
            }
            const notifications = [];
            const budgetNum = Number(estimatedBudget) || 0;
            let tier = 'Small';
            if (budgetNum >= 1000000000) {
                tier = 'Large';
            }
            else if (budgetNum >= 100000000) {
                tier = 'Medium';
            }
            for (const manager of managers) {
                try {
                    const notif = new notification_entity_1.Notification();
                    notif.userId = manager.id;
                    let msg = '';
                    if (action === 'CREATED') {
                        msg = `<span style="font-weight: 600; color: #0f172a;">${updatedBy}</span> membuat tender <span style="font-weight: 600; color: #0f172a;">${title}</span> dari <span style="font-weight: 600; color: #0f172a;">${customerName}</span> (${tier}).`;
                    }
                    else if (action === 'MARKED_WON') {
                        if (manager.id === data.updaterId) {
                            msg = `🎉 Selamat! Anda telah memenangkan tender <span style="font-weight: 600; color: #0f172a;">${title}</span> dari <span style="font-weight: 600; color: #0f172a;">${customerName}</span> (${tier}).`;
                        }
                        else {
                            msg = `<span style="font-weight: 600; color: #0f172a;">${updatedBy}</span> memenangkan <span style="font-weight: 600; color: #0f172a;">${title}</span> dari <span style="font-weight: 600; color: #0f172a;">${customerName}</span> (${tier}).`;
                        }
                    }
                    else if (action === 'MARKED_LOST') {
                        msg = `<span style="font-weight: 600; color: #0f172a;">${updatedBy}</span> mengonfirmasi kekalahan tender <span style="font-weight: 600; color: #0f172a;">${title}</span> dari <span style="font-weight: 600; color: #0f172a;">${customerName}</span> (${tier}).`;
                    }
                    else if (action === 'UPDATED') {
                        msg = `<span style="font-weight: 600; color: #0f172a;">${updatedBy}</span> memperbarui tender <span style="font-weight: 600; color: #0f172a;">${title}</span> dari <span style="font-weight: 600; color: #0f172a;">${customerName}</span> (${tier}).`;
                    }
                    else {
                        msg = `<span style="font-weight: 600; color: #0f172a;">${updatedBy}</span> melakukan update pada tender <span style="font-weight: 600; color: #0f172a;">${title}</span>.`;
                    }
                    if (action === 'CREATED') {
                        notif.title = 'Tender Baru';
                    }
                    else if (action === 'MARKED_WON') {
                        notif.title = '🎉 Pemenang Tender';
                    }
                    else if (action === 'MARKED_LOST') {
                        notif.title = 'Kekalahan Tender';
                    }
                    else {
                        notif.title = 'ℹ️ Info Sistem';
                    }
                    notif.message = msg;
                    notif.notificationType = 'ALERT';
                    notif.actionLink = `/sales/tenders/${tenderId}`;
                    notif.isRead = false;
                    notif.createdBy = 0;
                    notif.createdAt = new Date();
                    let requiresApproval = false;
                    const userRoles = manager.roles ? manager.roles.split(',') : [];
                    if (userRoles.includes('DIRECTOR')) {
                        requiresApproval = true;
                    }
                    notif.metaData = {
                        lead_id: tenderId,
                        user_name: updatedBy,
                        project_name: title,
                        customer_name: customerName,
                        tier: tier,
                        won_at: action === 'MARKED_WON' ? new Date().toISOString() : null,
                        requires_approval: requiresApproval,
                        action_type: action
                    };
                    notifications.push(notif);
                }
                catch (innerErr) {
                    this.logger.error(`Failed to create notification object for user ${manager.id}: ${innerErr.message}`, innerErr.stack);
                }
            }
            if (notifications.length > 0) {
                const savedNotifs = await this.notificationRepo.save(notifications);
                this.logger.log(`Saved ${savedNotifs.length} management notifications`);
                for (const notif of savedNotifs) {
                    this.notificationGateway.sendNotificationToUser(notif.userId, notif);
                }
            }
        }
        catch (err) {
            this.logger.error(`[AUDIT_LOG_ERROR] Failed to process management notification: ${err.message}`, err.stack);
        }
    }
};
exports.ManagementNotificationConsumer = ManagementNotificationConsumer;
__decorate([
    (0, event_emitter_1.OnEvent)('marketing.tender.management_update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ManagementNotificationConsumer.prototype, "handleManagementUpdate", null);
exports.ManagementNotificationConsumer = ManagementNotificationConsumer = ManagementNotificationConsumer_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        notification_gateway_1.NotificationGateway])
], ManagementNotificationConsumer);
//# sourceMappingURL=management-notification.consumer.js.map