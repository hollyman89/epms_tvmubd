import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Tender, TenderStatus } from '../../entities/tender.entity';
import { Project } from '../../entities/project.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { LegalReviewDto } from './dto/legal-review.dto';
import { emitLegalQueueUpdated } from '../../shared/helpers/legal-event.helper';

@Injectable()
export class LegalService {
  constructor(
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Validasi Keamanan Komentar Legal: Tolak Tag <script> Terlarang (XSS Prevention)
   */
  validateCommentSanitization(content: string): void {
    if (!content) return;
    if (/<script/i.test(content)) {
      throw new BadRequestException('Komentar mengandung tag atau skrip terlarang (<script>)!');
    }
  }

  async getContractsByStatus(status?: string) {
    const query = this.contractRepo.createQueryBuilder('contract')
      .innerJoinAndSelect('contract.proposal', 'proposal', 'proposal.deleted_at IS NULL')
      .innerJoinAndSelect('proposal.tender', 'tender', 'tender.deleted_at IS NULL')
      .leftJoinAndSelect('contract.customer', 'customer')
      .leftJoinAndSelect('contract.legal_reviewer', 'legal_reviewer')
      .where('contract.deleted_at IS NULL');
      
    if (!status || status.toUpperCase() === 'PENDING') {
      query.andWhere('contract.legal_status IN (:...statuses)', { statuses: [LegalStatus.DRAFT, LegalStatus.ON_REVIEW] });
    } else if (status.toUpperCase() === 'APPROVED') {
      query.andWhere('contract.legal_status = :status', { status: LegalStatus.APPROVED });
    } else if (status.toUpperCase() === 'REJECTED' || status.toUpperCase() === 'REVISION') {
      query.andWhere('contract.legal_status = :status', { status: LegalStatus.REJECTED });
    }
    
    query.orderBy('contract.id', 'DESC');
    
    return query.getMany();
  }

  async getPendingContracts(status?: string) {
    return this.getContractsByStatus(status);
  }

  /**
   * Enterprise Atomic Transaction for Legal Review Approval & Release
   * Executes Contract, Proposal, Tender, Project Generation, and Audit Log in a single QueryRunner transaction
   */
  async reviewContract(dto: LegalReviewDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let contract: Contract | null = null;

      if (dto.contractId) {
        if (!isNaN(Number(dto.contractId))) {
          contract = await queryRunner.manager.findOne(Contract, {
            where: [{ id: Number(dto.contractId) }, { contract_number: String(dto.contractId) }],
            relations: ['proposal', 'proposal.tender'],
          });
        } else {
          contract = await queryRunner.manager.findOne(Contract, {
            where: { contract_number: String(dto.contractId) },
            relations: ['proposal', 'proposal.tender'],
          });
        }
      } else if (dto.proposalId) {
        contract = await queryRunner.manager.findOne(Contract, {
          where: { proposal_id: dto.proposalId },
          relations: ['proposal', 'proposal.tender'],
        });
      }

      if (!contract) {
        throw new NotFoundException(`Contract not found for provided ID/Proposal ID`);
      }

      const oldLegalStatus = contract.legal_status;
      const oldContractStatus = contract.status;

      contract.legal_status = dto.legalStatus as LegalStatus;
      contract.legal_notes = dto.legalNotes;
      contract.legal_reviewer_id = userId;
      contract.updated_by = userId;
      
      if (dto.legalStatus === LegalStatus.APPROVED) {
        contract.status = 'ACTIVE';

        // 1. Marketing Domain Sync: Update Proposal & Tender stage to WON / APPROVED
        if (contract.proposal) {
          contract.proposal.status = 'APPROVED';
          await queryRunner.manager.save(Proposal, contract.proposal);

          if (contract.proposal.tender) {
            contract.proposal.tender.stage = 'WON';
            contract.proposal.tender.status = TenderStatus.WON;
            await queryRunner.manager.save(Tender, contract.proposal.tender);
          }
        }

        // 2. PMO Handover Sync: Contract is marked APPROVED so it enters PMO Antrean Inisiasi SPK queue
        // Project entity in 'projects' table will ONLY be created when PM clicks Kick-off in PMO Board
      } else if (dto.legalStatus === LegalStatus.REJECTED) {
        contract.status = 'REJECTED';
      }

      const savedContract = await queryRunner.manager.save(Contract, contract);

      // 3. Governance Audit Log Recording
      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'contracts',
        record_id: contract.id,
        action: `LEGAL_REVIEW_${dto.legalStatus}`,
        old_value: { legal_status: oldLegalStatus, status: oldContractStatus },
        new_value: { legal_status: dto.legalStatus, status: contract.status, notes: dto.legalNotes },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      // 4. Transactional Outbox Pattern: Record OutboxEvent in the SAME atomic DB transaction
      const correlationId = `corr-legal-${contract.id}-${Date.now()}`;
      const outboxEvent = queryRunner.manager.create(OutboxEvent, {
        event_id: `evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        event_name: dto.legalStatus === LegalStatus.APPROVED ? 'ContractApprovedEvent' : 'ContractRevisionRequestedEvent',
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
        status: OutboxStatus.PENDING,
      });
      await queryRunner.manager.save(OutboxEvent, outboxEvent);

      // Commit entire transaction atomically
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
        emitLegalQueueUpdated(this.eventEmitter, {
          contractId: savedContract.id,
          action: 'REVIEWED'
        });
      } catch (evtErr) {
        console.error('EventEmitter error on legal review:', evtErr);
      }

      return savedContract;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      console.error('LEGAL REVIEW ERROR DETAIL:', err?.message || err);
      throw new BadRequestException(`Legal review failed: ${err?.message || 'Unknown error'}`);
    } finally {
      await queryRunner.release();
    }
  }
}
