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
var TenderScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenderScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tender_entity_1 = require("../../entities/tender.entity");
const event_emitter_1 = require("@nestjs/event-emitter");
let TenderScheduler = TenderScheduler_1 = class TenderScheduler {
    constructor(tenderRepo, eventEmitter) {
        this.tenderRepo = tenderRepo;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(TenderScheduler_1.name);
    }
    async handleGracePeriodAndTimeouts() {
        this.logger.debug('Running TenderScheduler...');
        const now = new Date();
        const expiredTenders = await this.tenderRepo.find({
            where: {
                status: tender_entity_1.TenderStatus.WON,
                grace_deadline: (0, typeorm_2.LessThan)(now),
            }
        });
        for (const tender of expiredTenders) {
            if (tender.legal_status === 'APPROVED' || tender.legalStatus === 'APPROVED') {
                this.logger.log(`Skipping demotion for Tender ${tender.id}: Contract is already Legal APPROVED.`);
                continue;
            }
            if (!tender.spk_file_key) {
                this.logger.warn(`Demoting Tender ${tender.id} due to SPK Grace Period expiry.`);
                tender.status = tender_entity_1.TenderStatus.NEGOTIATION;
                tender.grace_deadline = null;
                await this.tenderRepo.save(tender);
                this.eventEmitter.emit('notification.send', {
                    recipientId: 1,
                    title: 'Laporan: SPK Upload Expired',
                    message: `Tender ${tender.title} diturunkan ke NEGOTIATION karena SPK tidak diupload dalam 2x24 jam.`,
                    type: 'ALERT'
                });
                if (tender.marketing_pic_id) {
                    this.eventEmitter.emit('notification.send', {
                        recipientId: tender.marketing_pic_id,
                        title: 'Peringatan: Tender Diturunkan',
                        message: `Tender ${tender.title} diturunkan karena SPK belum diupload. Segera upload ulang untuk mengembalikan ke WON.`,
                        type: 'EMAIL_AND_INAPP'
                    });
                    this.logger.log(`[EMAIL FALLBACK] Mengirim email peringatan ke PIC ID: ${tender.marketing_pic_id} untuk Tender ${tender.title}`);
                }
                this.eventEmitter.emit('audit.log', {
                    action: 'DEMOTION',
                    entityId: tender.id,
                    entityName: 'tenders',
                    reason: 'Auto-revert: Grace Period Expired. Notifikasi dikirim ke Direktur dan PIC.'
                });
            }
        }
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const pendingTenders = await this.tenderRepo.find({
            where: {
                status: tender_entity_1.TenderStatus.PENDING_APPROVAL,
                updated_at: (0, typeorm_2.LessThan)(twoHoursAgo)
            }
        });
        for (const tender of pendingTenders) {
            this.logger.warn(`Auto-Escalating Tender ${tender.id} due to 2 hours Approval Timeout.`);
            tender.updated_at = now;
            await this.tenderRepo.save(tender);
            this.eventEmitter.emit('notification.send', {
                recipientId: 'C-LEVEL',
                title: 'URGENT: Tender Approval Escalated',
                message: `Tender ${tender.title} memerlukan persetujuan diskon lebih dari 20%. Tidak ada respon dari Direktur dalam 2 jam terakhir.`,
                type: 'EMAIL_EMERGENCY'
            });
            this.eventEmitter.emit('audit.log', {
                action: 'AUTO_ESCALATE',
                entityId: tender.id,
                entityName: 'tenders',
                reason: 'Approval timeout (> 2 jam), diekskalasi ke C-Suite'
            });
        }
    }
};
exports.TenderScheduler = TenderScheduler;
__decorate([
    (0, schedule_1.Cron)('* * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TenderScheduler.prototype, "handleGracePeriodAndTimeouts", null);
exports.TenderScheduler = TenderScheduler = TenderScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(tender_entity_1.Tender)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], TenderScheduler);
//# sourceMappingURL=tender.scheduler.js.map