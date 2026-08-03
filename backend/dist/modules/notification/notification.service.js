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
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("../../entities/notification.entity");
const purchase_order_entity_1 = require("../../entities/purchase-order.entity");
const purchase_request_entity_1 = require("../../entities/purchase-request.entity");
const project_entity_1 = require("../../entities/project.entity");
const payment_entity_1 = require("../../entities/payment.entity");
const event_emitter_1 = require("@nestjs/event-emitter");
let NotificationService = NotificationService_1 = class NotificationService {
    constructor(notificationRepo, poRepo, prRepo, projectRepo, paymentRepo, dataSource) {
        this.notificationRepo = notificationRepo;
        this.poRepo = poRepo;
        this.prRepo = prRepo;
        this.projectRepo = projectRepo;
        this.paymentRepo = paymentRepo;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(NotificationService_1.name);
    }
    async handlePaymentProcessed(data) {
        this.logger.log(`Received finance.payment_processed event: ${JSON.stringify(data)}`);
        try {
            const { paymentId, poId, amount, paymentNumber } = data;
            const po = await this.poRepo.findOne({ where: { id: poId } });
            let pmId = null;
            if (po && po.purchaseRequestId) {
                const pr = await this.prRepo.findOne({ where: { id: po.purchaseRequestId } });
                if (pr && pr.projectId) {
                    const project = await this.projectRepo.findOne({ where: { id: pr.projectId } });
                    if (project) {
                        pmId = project.managerId;
                    }
                }
            }
            const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
            let financeUserId = null;
            if (payment) {
                financeUserId = payment.createdBy;
            }
            const notifications = [];
            if (pmId) {
                const pmNotif = new notification_entity_1.Notification();
                pmNotif.userId = pmId;
                pmNotif.title = 'Pembayaran Diterima';
                pmNotif.message = `Pembayaran ${paymentNumber} senilai Rp ${Number(amount).toLocaleString('id-ID')} untuk PO #${poId} telah diproses`;
                pmNotif.notificationType = 'ALERT';
                pmNotif.actionLink = `/projects/pos/${poId}`;
                notifications.push(pmNotif);
            }
            if (financeUserId && financeUserId !== pmId) {
                const finNotif = new notification_entity_1.Notification();
                finNotif.userId = financeUserId;
                finNotif.title = 'Transaksi Berhasil';
                finNotif.message = `Pembayaran senilai Rp ${Number(amount).toLocaleString('id-ID')} berhasil dicatat`;
                finNotif.notificationType = 'SYSTEM';
                finNotif.actionLink = `/finance/payments/${paymentId}`;
                notifications.push(finNotif);
            }
            if (notifications.length > 0) {
                await this.notificationRepo.save(notifications);
                this.logger.log(`Saved ${notifications.length} notifications`);
            }
        }
        catch (err) {
            this.logger.error(`[AUDIT_LOG_ERROR] Failed to process finance.payment_processed event: ${err.message}`, err.stack);
        }
    }
    async getMyNotifications(userId, page, limit, isRead) {
        const where = { userId };
        if (isRead !== undefined) {
            where.isRead = isRead;
        }
        const [data, total] = await this.notificationRepo.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    async getUnreadCount(userId) {
        return this.notificationRepo.count({
            where: { userId, isRead: false }
        });
    }
    async markAsRead(userId, notifId) {
        const notif = await this.notificationRepo.findOne({ where: { id: notifId, userId } });
        if (!notif) {
            throw new common_1.NotFoundException('Notification not found');
        }
        notif.isRead = true;
        await this.notificationRepo.save(notif);
        return notif;
    }
    async markAllAsRead(userId) {
        await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
        return { success: true };
    }
    async deleteNotification(userId, notifId) {
        const notif = await this.notificationRepo.findOne({ where: { id: notifId, userId } });
        if (!notif) {
            throw new common_1.NotFoundException('Notification not found');
        }
        await this.notificationRepo.softDelete(notif.id);
        return { success: true };
    }
};
exports.NotificationService = NotificationService;
__decorate([
    (0, event_emitter_1.OnEvent)('finance.payment_processed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationService.prototype, "handlePaymentProcessed", null);
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __param(1, (0, typeorm_1.InjectRepository)(purchase_order_entity_1.PurchaseOrder)),
    __param(2, (0, typeorm_1.InjectRepository)(purchase_request_entity_1.PurchaseRequest)),
    __param(3, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __param(4, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], NotificationService);
//# sourceMappingURL=notification.service.js.map