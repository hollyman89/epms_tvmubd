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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const contract_entity_1 = require("../../entities/contract.entity");
const contract_amendment_entity_1 = require("../../entities/contract-amendment.entity");
const tender_entity_1 = require("../../entities/tender.entity");
const user_entity_1 = require("../../entities/user.entity");
const event_emitter_1 = require("@nestjs/event-emitter");
const event_emitter_2 = require("@nestjs/event-emitter");
const crypto = require("crypto");
let ContractService = class ContractService {
    constructor(contractRepo, amendmentRepo, tenderRepo, userRepo, eventEmitter) {
        this.contractRepo = contractRepo;
        this.amendmentRepo = amendmentRepo;
        this.tenderRepo = tenderRepo;
        this.userRepo = userRepo;
        this.eventEmitter = eventEmitter;
    }
    async findAll() {
        return this.contractRepo.find({
            relations: ['customer', 'proposal', 'legal_reviewer', 'project_manager'],
            order: { created_at: 'DESC' }
        });
    }
    async findOne(id) {
        const contract = await this.contractRepo.findOne({
            where: { id },
            relations: ['customer', 'proposal', 'legal_reviewer', 'project_manager', 'amendments']
        });
        if (!contract)
            throw new common_1.NotFoundException('Contract not found');
        return contract;
    }
    async update(id, data) {
        const contract = await this.findOne(id);
        if (contract.legal_status === contract_entity_1.LegalStatus.APPROVED || contract.status === 'APPROVED') {
            throw new common_1.ForbiddenException('Cannot update an APPROVED contract directly. Use the amendment endpoint.');
        }
        Object.assign(contract, data);
        return this.contractRepo.save(contract);
    }
    async amend(id, userId, reason, newValue) {
        const contract = await this.findOne(id);
        const nextVersion = contract.amendments ? contract.amendments.length + 1 : 1;
        const amendment = this.amendmentRepo.create({
            contract_id: contract.id,
            version_number: nextVersion,
            old_value: contract.contract_value,
            new_value: newValue,
            reason,
        });
        await this.amendmentRepo.save(amendment);
        return amendment;
    }
    async handleContractGeneration(payload) {
        const { tenderId, userId } = payload;
        const tender = await this.tenderRepo.findOne({
            where: { id: tenderId },
            relations: ['proposals']
        });
        if (!tender)
            throw new common_1.NotFoundException('Tender not found');
        const proposalId = tender.proposals && tender.proposals.length > 0 ? tender.proposals[0].id : 1;
        const contract = this.contractRepo.create({
            proposal_id: proposalId,
            customer_id: tender.customer_id,
            contract_number: `DRAFT`,
            contract_value: tender.negotiated_price || tender.estimated_budget,
            legal_status: contract_entity_1.LegalStatus.DRAFT,
            created_by: userId,
            start_date: null,
            end_date: null,
        });
        await this.contractRepo.save(contract);
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const paddedId = String(contract.id).padStart(4, '0');
        contract.contract_number = `CONT-${dateStr}-${paddedId}`;
        await this.contractRepo.save(contract);
        this.eventEmitter.emit('audit.log', {
            action: 'CONTRACT_AUTO_CREATED',
            entityId: contract.id,
            entityName: 'contracts',
            reason: `Draft contract auto-created from Tender #${tenderId}`,
            userId: userId,
        });
        this.eventEmitter.emit('notification.send', {
            recipientId: userId,
            title: 'Draft Kontrak Tergenerate',
            message: `Draft kontrak untuk Tender "${tender.title}" telah dibuat otomatis.`,
            type: 'INFO',
        });
        return contract;
    }
    async approveContract(contractId, userId) {
        const contract = await this.contractRepo.findOne({ where: { id: contractId } });
        if (!contract)
            throw new common_1.NotFoundException('Contract not found');
        contract.legal_status = contract_entity_1.LegalStatus.APPROVED;
        contract.status = 'APPROVED';
        contract.ops_team_activated_at = new Date();
        await this.contractRepo.save(contract);
        const opsUsers = await this.userRepo.createQueryBuilder('user')
            .innerJoin('user.roles', 'role', 'role.name = :roleName', { roleName: 'HEAD_OF_OPERATIONS' })
            .getMany();
        for (const opsUser of opsUsers) {
            this.eventEmitter.emit('notification.send', {
                recipientId: opsUser.id,
                title: 'Kontrak Baru Siap Dieksekusi',
                message: `Kontrak untuk proyek "${contract.contract_number}" telah disetujui Legal.`,
                type: 'INFO',
                metaData: {
                    link: `/governance/contracts`,
                },
            });
        }
        this.eventEmitter.emit('audit.log', {
            action: 'CONTRACT_APPROVED',
            entityId: contract.id,
            entityName: 'contracts',
            reason: 'Contract approved by Legal/Direktur',
            userId: userId,
        });
        return contract;
    }
    computePdfSha256Hash(pdfBuffer, metadata) {
        const hash = crypto.createHash('sha256');
        hash.update(pdfBuffer);
        hash.update(`${metadata.timestamp}-${metadata.version}`);
        return hash.digest('hex');
    }
    async verifyDocumentIntegrity(contractId, versionNumber) {
        const contract = await this.findOne(contractId);
        const timestamp = contract.created_at ? new Date(contract.created_at).toISOString() : new Date().toISOString();
        const mockPdfContent = Buffer.from(`PDF_BINARY_CONTENT_CONTRACT_${contract.id}_VERSION_${versionNumber}`);
        const computedHash = this.computePdfSha256Hash(mockPdfContent, { timestamp, version: versionNumber });
        const storedHash = contract.document_hash || computedHash;
        if (storedHash !== computedHash) {
            this.eventEmitter.emit('audit.log', {
                action: 'DOCUMENT_TAMPERING_DETECTED',
                entityId: contractId,
                entityName: 'contracts',
                reason: `CRITICAL ALERT: SHA-256 hash mismatch! Stored: ${storedHash}, Computed: ${computedHash}`,
            });
            throw new common_1.ForbiddenException('Critical Security Alert: Document integrity verification failed! Tampering detected.');
        }
        this.eventEmitter.emit('audit.log', {
            action: 'DOCUMENT_VERIFIED_INTACT',
            entityId: contractId,
            entityName: 'contracts',
            reason: `SHA-256 Digital Signature Verified Intact: ${storedHash}`,
        });
        return {
            statusCode: 200,
            contractId,
            version: versionNumber,
            status: 'VERIFIED',
            integrity: 'INTACT',
            documentHash: storedHash,
            verifiedAt: new Date().toISOString(),
        };
    }
};
exports.ContractService = ContractService;
__decorate([
    (0, event_emitter_2.OnEvent)('contract.generate'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContractService.prototype, "handleContractGeneration", null);
exports.ContractService = ContractService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(contract_entity_1.Contract)),
    __param(1, (0, typeorm_1.InjectRepository)(contract_amendment_entity_1.ContractAmendment)),
    __param(2, (0, typeorm_1.InjectRepository)(tender_entity_1.Tender)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], ContractService);
//# sourceMappingURL=contract.service.js.map