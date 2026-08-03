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
var SlaGraceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlaGraceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const contract_entity_1 = require("../../entities/contract.entity");
const event_emitter_1 = require("@nestjs/event-emitter");
let SlaGraceService = SlaGraceService_1 = class SlaGraceService {
    constructor(contractRepo, dataSource, eventEmitter) {
        this.contractRepo = contractRepo;
        this.dataSource = dataSource;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(SlaGraceService_1.name);
    }
    async onModuleInit() {
        try {
            this.logger.log('Initializing SLA Grace Deadline Migration Runner...');
            await this.dataSource.query(`
        ALTER TABLE contracts ADD COLUMN IF NOT EXISTS grace_deadline TIMESTAMP NULL;
        ALTER TABLE contracts ADD COLUMN IF NOT EXISTS grace_extended_by BIGINT NULL;
        ALTER TABLE contracts ADD COLUMN IF NOT EXISTS grace_extended_at TIMESTAMP NULL;
        ALTER TABLE contracts ADD COLUMN IF NOT EXISTS grace_extension_count INT DEFAULT 0;
      `);
            this.logger.log('✅ SLA Grace Extension columns verified on database startup.');
        }
        catch (err) {
            this.logger.warn(`SLA Grace Startup Migration Notice: ${err.message}`);
        }
    }
    async handleRevisionRequested(payload) {
        this.logger.log(`Handling contract.revision_requested for Contract #${payload.contractId}`);
        await this.requestGraceExtension(payload.contractId, 3, payload.userId, payload.reason || 'Revisi Dokumen dari Legal');
    }
    async requestGraceExtension(contractId, daysToAdd = 3, userId, reason) {
        const contract = await this.contractRepo.findOne({ where: { id: contractId } });
        if (!contract)
            throw new common_1.NotFoundException('Contract not found');
        const currentCount = Number(contract.grace_extension_count || 0);
        if (currentCount >= 3) {
            throw new common_1.BadRequestException(`Batas Maksimal Perpanjangan Grace SLA (3x) telah tercapai untuk Kontrak #${contractId}! Tidak dapat menambah grace period lagi.`);
        }
        const now = new Date();
        const currentDeadline = contract.grace_deadline ? new Date(contract.grace_deadline) : now;
        const newDeadline = new Date(currentDeadline.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        contract.grace_deadline = newDeadline;
        contract.grace_extended_by = userId;
        contract.grace_extended_at = now;
        contract.grace_extension_count = currentCount + 1;
        await this.contractRepo.save(contract);
        this.eventEmitter.emit('audit.log', {
            action: 'SLA_GRACE_EXTENDED',
            entityId: contractId,
            entityName: 'contracts',
            reason: `Grace deadline extended +${daysToAdd} days (Attempt ${contract.grace_extension_count}/3). Reason: ${reason || 'N/A'}`,
            userId,
        });
        this.eventEmitter.emit('notification.send', {
            recipientId: userId,
            title: 'Grace SLA Deadline Diperpanjang',
            message: `Batas waktu SLA Kontrak diperpanjang +${daysToAdd} hari hingga ${newDeadline.toLocaleDateString('id-ID')}. (Perpanjangan ke-${contract.grace_extension_count}/3).`,
            type: 'INFO',
        });
        return {
            statusCode: 200,
            contractId,
            extensionCount: contract.grace_extension_count,
            maxLimit: 3,
            graceDeadline: newDeadline.toISOString(),
            message: `Perpanjangan Grace SLA ke-${contract.grace_extension_count}/3 berhasil diterapkan (+${daysToAdd} hari).`,
        };
    }
    async getActiveGraceExtensions() {
        try {
            const activeContracts = await this.contractRepo.find({
                take: 10
            });
            return activeContracts.map((c) => ({
                contractId: c.id,
                contractNumber: c.contract_number,
                extensionCount: c.grace_extension_count || 0,
                maxLimit: 3,
                graceDeadline: c.grace_deadline || null,
                extendedAt: c.grace_extended_at || null,
                status: c.legal_status || c.status || 'ACTIVE',
            }));
        }
        catch (e) {
            return [];
        }
    }
};
exports.SlaGraceService = SlaGraceService;
__decorate([
    (0, event_emitter_1.OnEvent)('contract.revision_requested'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SlaGraceService.prototype, "handleRevisionRequested", null);
exports.SlaGraceService = SlaGraceService = SlaGraceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(contract_entity_1.Contract)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        event_emitter_1.EventEmitter2])
], SlaGraceService);
//# sourceMappingURL=sla-grace.service.js.map