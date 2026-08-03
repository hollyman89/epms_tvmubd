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
var NotificationEventListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationEventListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("../../entities/notification.entity");
const notification_gateway_1 = require("./notification.gateway");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
let NotificationEventListener = NotificationEventListener_1 = class NotificationEventListener {
    constructor(notificationRepo, dataSource, notificationGateway, emailQueue, eventEmitter) {
        this.notificationRepo = notificationRepo;
        this.dataSource = dataSource;
        this.notificationGateway = notificationGateway;
        this.emailQueue = emailQueue;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(NotificationEventListener_1.name);
    }
    async handleTenderWonEvent(payload) {
        this.logger.log(`🔥 [NotificationEventListener] Event diterima: Tender WON - Tender ID ${payload.tenderId}`);
        if (payload.contractId) {
            await this.handleNotificationSend({
                title: 'Tender WON - Draft Kontrak Baru',
                message: `Tender "${payload.title || 'Project'}" telah disetujui (WON). Draft Kontrak #${payload.contractId} siap direview.`,
                type: 'TASK',
                audience: 'LEGAL',
                tenderId: payload.tenderId,
                metaData: { contractId: payload.contractId, actionLink: '/legal/review?tab=WAITING' }
            });
        }
    }
    async handleContractApprovedEvent(payload) {
        if (payload.legalStatus !== 'APPROVED')
            return;
        this.logger.log(`🔥 [NotificationEventListener] Event diterima: Legal Contract Approved - Contract ID ${payload.contractId}`);
        let projectName = `Kontrak #${payload.contractNumber || payload.contractId}`;
        let tenderId = undefined;
        try {
            const contractData = await this.dataSource.query(`SELECT t.id as tenderId, t.title as tenderTitle 
         FROM contracts c
         LEFT JOIN proposals p ON c.proposal_id = p.id
         LEFT JOIN tenders t ON p.tender_id = t.id
         WHERE c.id = ?`, [payload.contractId]);
            if (contractData && contractData.length > 0) {
                if (contractData[0].tenderTitle)
                    projectName = contractData[0].tenderTitle;
                if (contractData[0].tenderId)
                    tenderId = contractData[0].tenderId;
            }
        }
        catch (e) {
            this.logger.warn(`Failed to fetch tender info for contract ${payload.contractId}`);
        }
        this.eventEmitter.emit('notification.send', {
            title: '🚀 Project Siap Kick Off',
            message: `Proyek **"${projectName}"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.`,
            type: 'TASK',
            audience: 'PMO',
            tenderId: tenderId,
            metaData: {
                contractId: payload.contractId,
                actionLink: '/project-delivery'
            }
        });
        this.eventEmitter.emit('notification.send', {
            title: '✅ SPK Disetujui Legal',
            message: `Proyek **"${projectName}"** telah **disetujui oleh tim Legal**. Proses Sales untuk proyek ini telah selesai.`,
            type: 'SUCCESS',
            audience: 'MARKETING',
            tenderId: tenderId,
            metaData: {
                contractId: payload.contractId,
                actionLink: tenderId ? `/sales/tenders/${tenderId}` : '/sales'
            }
        });
    }
    async handleNotificationSend(payload) {
        this.logger.log(`[notification.send] Received: ${payload.title}`);
        try {
            const targetUserIds = await this.resolveRecipients(payload);
            if (targetUserIds.length === 0) {
                this.logger.warn(`[notification.send] No target users found for: ${payload.title}`);
                return;
            }
            const notifications = [];
            for (const userId of targetUserIds) {
                const notif = new notification_entity_1.Notification();
                notif.userId = userId;
                notif.title = payload.title;
                notif.message = payload.message;
                notif.notificationType = this.mapNotificationType(payload.type);
                notif.actionLink = payload.metaData?.actionLink || (payload.tenderId ? `/sales/tenders/${payload.tenderId}` : '/legal/review?tab=WAITING');
                notif.isRead = false;
                notif.createdBy = 0;
                notif.createdAt = new Date();
                notif.metaData = payload.metaData || null;
                notifications.push(notif);
            }
            const savedNotifs = await this.notificationRepo.save(notifications);
            this.logger.log(`[notification.send] Saved ${savedNotifs.length} notifications for: ${payload.title}`);
            for (const notif of savedNotifs) {
                this.notificationGateway.sendNotificationToUser(notif.userId, notif);
            }
            if (payload.type === 'EMAIL_AND_INAPP' || payload.type === 'EMAIL_EMERGENCY') {
                for (const userId of targetUserIds) {
                    const userEmail = `user_${userId}@company.com`;
                    await this.emailQueue.add('send-email', {
                        to: userEmail,
                        subject: payload.title,
                        text: payload.message,
                        html: `<p>${payload.message}</p>`
                    });
                }
            }
        }
        catch (err) {
            this.logger.error(`[notification.send] Failed to process: ${err.message}`, err.stack);
        }
    }
    async resolveRecipients(payload) {
        let resolvedIds = new Set();
        let targetRoles = [];
        const processRecipient = (recId) => {
            if (typeof recId === 'number') {
                resolvedIds.add(recId);
            }
            else if (recId === 'C-LEVEL') {
                targetRoles.push('SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR');
            }
            else if (!isNaN(Number(recId))) {
                resolvedIds.add(Number(recId));
            }
        };
        if (payload.recipientId) {
            if (Array.isArray(payload.recipientId)) {
                payload.recipientId.forEach(processRecipient);
            }
            else {
                processRecipient(payload.recipientId);
            }
        }
        if (payload.audience === 'ALL' || payload.audience === 'DIRECTOR') {
            targetRoles.push('SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR');
        }
        else if (payload.audience === 'MARKETING') {
            targetRoles.push('MARKETING');
        }
        else if (payload.audience === 'LEGAL') {
            targetRoles.push('LEGAL', 'SUPER_ADMIN');
        }
        else if (payload.audience === 'PMO') {
            targetRoles.push('PMO', 'PROJECT_MANAGER', 'SUPER_ADMIN');
        }
        if (resolvedIds.size === 0 && targetRoles.length === 0) {
            targetRoles = ['SUPER_ADMIN', 'DIRECTOR'];
        }
        try {
            if (targetRoles.length > 0) {
                const users = await this.dataSource.query(`
          SELECT DISTINCT u.id
          FROM users u
          JOIN user_roles ur ON u.id = ur.user_id
          JOIN roles r ON r.id = ur.role_id
          WHERE r.name IN (${targetRoles.map(() => '?').join(',')})
            AND u.deleted_at IS NULL
        `, targetRoles);
                users.forEach((u) => resolvedIds.add(Number(u.id)));
            }
            return Array.from(resolvedIds);
        }
        catch (err) {
            this.logger.error(`[resolveRecipients] DB query failed: ${err.message}`);
            return [];
        }
    }
    mapNotificationType(type) {
        switch (type) {
            case 'WARNING':
            case 'ERROR':
            case 'EMAIL_EMERGENCY':
            case 'EMAIL_AND_INAPP':
                return 'ALERT';
            case 'SUCCESS':
            case 'INFO':
                return 'SYSTEM';
            default:
                return 'ALERT';
        }
    }
};
exports.NotificationEventListener = NotificationEventListener;
__decorate([
    (0, event_emitter_1.OnEvent)('marketing.tender.won'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationEventListener.prototype, "handleTenderWonEvent", null);
__decorate([
    (0, event_emitter_1.OnEvent)('legal.contract.approved'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationEventListener.prototype, "handleContractApprovedEvent", null);
__decorate([
    (0, event_emitter_1.OnEvent)('notification.send'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationEventListener.prototype, "handleNotificationSend", null);
exports.NotificationEventListener = NotificationEventListener = NotificationEventListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __param(3, (0, bullmq_1.InjectQueue)('email-send')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        notification_gateway_1.NotificationGateway,
        bullmq_2.Queue,
        event_emitter_1.EventEmitter2])
], NotificationEventListener);
//# sourceMappingURL=notification-event.listener.js.map