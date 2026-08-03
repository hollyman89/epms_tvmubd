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
var NotificationListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const notification_gateway_1 = require("./notification.gateway");
let NotificationListener = NotificationListener_1 = class NotificationListener {
    constructor(notificationGateway) {
        this.notificationGateway = notificationGateway;
        this.logger = new common_1.Logger(NotificationListener_1.name);
    }
    handleTenderWonEvent(payload) {
        this.logger.log(`🔥 Event diterima: Tender WON - Tender ID ${payload.tenderId}`);
        if (this.notificationGateway?.server && payload.contractId) {
            this.notificationGateway.server.emit('legal.queue.updated', {
                type: 'NEW_CONTRACT',
                contractId: payload.contractId,
                tenderId: payload.tenderId,
                title: payload.title,
                timestamp: new Date().toISOString()
            });
            this.logger.log(`⚡ Broadcast Socket.io 'legal.queue.updated' sent to all connected clients.`);
        }
    }
    handleContractApprovedEvent(payload) {
        this.logger.log(`🔥 Event diterima: Legal Contract Approved - Contract ID ${payload.contractId}`);
        if (this.notificationGateway?.server) {
            this.notificationGateway.server.emit('legal.queue.updated', {
                type: 'CONTRACT_APPROVED',
                contractId: payload.contractId,
                legalStatus: payload.legalStatus,
                timestamp: new Date().toISOString()
            });
            this.notificationGateway.server.emit('marketing.tender.management_update', {
                type: 'CONTRACT_APPROVED',
                contractId: payload.contractId,
                timestamp: new Date().toISOString()
            });
            this.logger.log(`⚡ Broadcast Socket.io 'legal.queue.updated' & 'marketing.tender.management_update' sent.`);
        }
    }
    handleQueueUpdatedEvent(payload) {
        if (this.notificationGateway?.server) {
            this.notificationGateway.server.emit('legal.queue.updated', payload);
        }
    }
};
exports.NotificationListener = NotificationListener;
__decorate([
    (0, event_emitter_1.OnEvent)('marketing.tender.won'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationListener.prototype, "handleTenderWonEvent", null);
__decorate([
    (0, event_emitter_1.OnEvent)('legal.contract.approved'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationListener.prototype, "handleContractApprovedEvent", null);
__decorate([
    (0, event_emitter_1.OnEvent)('legal.queue.updated'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationListener.prototype, "handleQueueUpdatedEvent", null);
exports.NotificationListener = NotificationListener = NotificationListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notification_gateway_1.NotificationGateway])
], NotificationListener);
//# sourceMappingURL=notification.listener.js.map