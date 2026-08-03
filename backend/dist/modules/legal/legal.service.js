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
exports.LegalService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const contract_entity_1 = require("../../entities/contract.entity");
const proposal_entity_1 = require("../../entities/proposal.entity");
const tender_entity_1 = require("../../entities/tender.entity");
const audit_log_entity_1 = require("../../entities/audit-log.entity");
const outbox_event_entity_1 = require("../../entities/outbox-event.entity");
const legal_event_helper_1 = require("../../shared/helpers/legal-event.helper");
let LegalService = class LegalService {
    constructor(contractRepo, dataSource, eventEmitter) {
        this.contractRepo = contractRepo;
        this.dataSource = dataSource;
        this.eventEmitter = eventEmitter;
    }
    validateCommentSanitization(content) {
        if (!content)
            return;
        if (/<script/i.test(content)) {
            throw new common_1.BadRequestException('Komentar mengandung tag atau skrip terlarang (<script>)!');
        }
    }
    async getContractsByStatus(status) {
        const query = this.contractRepo.createQueryBuilder('contract')
            .innerJoinAndSelect('contract.proposal', 'proposal', 'proposal.deleted_at IS NULL')
            .innerJoinAndSelect('proposal.tender', 'tender', 'tender.deleted_at IS NULL')
            .leftJoinAndSelect('contract.customer', 'customer')
            .leftJoinAndSelect('contract.legal_reviewer', 'legal_reviewer')
            .where('contract.deleted_at IS NULL');
        if (!status || status.toUpperCase() === 'PENDING') {
            query.andWhere('contract.legal_status IN (:...statuses)', { statuses: [contract_entity_1.LegalStatus.DRAFT, contract_entity_1.LegalStatus.ON_REVIEW] });
        }
        else if (status.toUpperCase() === 'APPROVED') {
            query.andWhere('contract.legal_status = :status', { status: contract_entity_1.LegalStatus.APPROVED });
        }
        else if (status.toUpperCase() === 'REJECTED' || status.toUpperCase() === 'REVISION') {
            query.andWhere('contract.legal_status = :status', { status: contract_entity_1.LegalStatus.REJECTED });
        }
        query.orderBy('contract.id', 'DESC');
        return query.getMany();
    }
    async getPendingContracts(status) {
        return this.getContractsByStatus(status);
    }
    async reviewContract(dto, userId) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let contract = null;
            if (dto.contractId) {
                if (!isNaN(Number(dto.contractId))) {
                    contract = await queryRunner.manager.findOne(contract_entity_1.Contract, {
                        where: [{ id: Number(dto.contractId) }, { contract_number: String(dto.contractId) }],
                        relations: ['proposal', 'proposal.tender'],
                    });
                }
                else {
                    contract = await queryRunner.manager.findOne(contract_entity_1.Contract, {
                        where: { contract_number: String(dto.contractId) },
                        relations: ['proposal', 'proposal.tender'],
                    });
                }
            }
            else if (dto.proposalId) {
                contract = await queryRunner.manager.findOne(contract_entity_1.Contract, {
                    where: { proposal_id: dto.proposalId },
                    relations: ['proposal', 'proposal.tender'],
                });
            }
            if (!contract) {
                throw new common_1.NotFoundException(`Contract not found for provided ID/Proposal ID`);
            }
            const oldLegalStatus = contract.legal_status;
            const oldContractStatus = contract.status;
            contract.legal_status = dto.legalStatus;
            contract.legal_notes = dto.legalNotes;
            contract.legal_reviewer_id = userId;
            contract.updated_by = userId;
            if (dto.legalStatus === contract_entity_1.LegalStatus.APPROVED) {
                contract.status = 'ACTIVE';
                if (contract.proposal) {
                    contract.proposal.status = 'APPROVED';
                    await queryRunner.manager.save(proposal_entity_1.Proposal, contract.proposal);
                    if (contract.proposal.tender) {
                        contract.proposal.tender.stage = 'WON';
                        contract.proposal.tender.status = tender_entity_1.TenderStatus.WON;
                        await queryRunner.manager.save(tender_entity_1.Tender, contract.proposal.tender);
                    }
                }
            }
            else if (dto.legalStatus === contract_entity_1.LegalStatus.REJECTED) {
                contract.status = 'REJECTED';
            }
            const savedContract = await queryRunner.manager.save(contract_entity_1.Contract, contract);
            const auditLog = queryRunner.manager.create(audit_log_entity_1.AuditLog, {
                table_name: 'contracts',
                record_id: contract.id,
                action: `LEGAL_REVIEW_${dto.legalStatus}`,
                old_value: { legal_status: oldLegalStatus, status: oldContractStatus },
                new_value: { legal_status: dto.legalStatus, status: contract.status, notes: dto.legalNotes },
                created_by: userId,
            });
            await queryRunner.manager.save(audit_log_entity_1.AuditLog, auditLog);
            const correlationId = `corr-legal-${contract.id}-${Date.now()}`;
            const outboxEvent = queryRunner.manager.create(outbox_event_entity_1.OutboxEvent, {
                event_id: `evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                event_name: dto.legalStatus === contract_entity_1.LegalStatus.APPROVED ? 'ContractApprovedEvent' : 'ContractRevisionRequestedEvent',
                event_version: '1.0',
                aggregate_type: 'Contract',
                aggregate_id: contract.id,
                correlation_id: correlationId,
                transaction_id: `tx-${Date.now()}`,
                payload: {
                    contractId: contract.id,
                    contractNumber: contract.contract_number,
                    legalStatus: dto.legalStatus,
                    reviewerId: userId,
                    timestamp: new Date().toISOString(),
                },
                status: outbox_event_entity_1.OutboxStatus.PENDING,
            });
            await queryRunner.manager.save(outbox_event_entity_1.OutboxEvent, outboxEvent);
            await queryRunner.commitTransaction();
            try {
                this.eventEmitter.emit('legal.contract.approved', {
                    contractId: savedContract.id,
                    contractNumber: savedContract.contract_number,
                    legalStatus: savedContract.legal_status,
                    status: savedContract.status,
                    reviewerId: userId,
                    timestamp: new Date().toISOString()
                });
                (0, legal_event_helper_1.emitLegalQueueUpdated)(this.eventEmitter, {
                    contractId: savedContract.id,
                    action: 'REVIEWED'
                });
            }
            catch (evtErr) {
                console.error('EventEmitter error on legal review:', evtErr);
            }
            return savedContract;
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            console.error('LEGAL REVIEW ERROR DETAIL:', err?.message || err);
            throw new common_1.BadRequestException(`Legal review failed: ${err?.message || 'Unknown error'}`);
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.LegalService = LegalService;
exports.LegalService = LegalService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(contract_entity_1.Contract)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        event_emitter_1.EventEmitter2])
], LegalService);
//# sourceMappingURL=legal.service.js.map