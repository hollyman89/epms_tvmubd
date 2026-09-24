import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

    const normStatus = status ? status.toUpperCase() : 'PENDING';

    if (normStatus === 'PENDING') {
      // RULE 1: Initial SPK ready for review (Tender WON, SPK uploaded, Contract PENDING_LEGAL_REVIEW, DRAFT/ON_REVIEW)
      query.andWhere(`
        tender.stage = 'WON' AND
        tender.status = 'WON' AND
        contract.status = 'PENDING_LEGAL_REVIEW' AND
        contract.legal_status IN (:...pendingStatuses) AND
        contract.spk_file_url IS NOT NULL AND
        contract.spk_file_url != ''
      `, { pendingStatuses: [LegalStatus.DRAFT, LegalStatus.ON_REVIEW] });
    } else if (normStatus === 'REVISION' || normStatus === 'REVISION_REQUESTED') {
      // RULE 2: Active Revision (Tender WON, REVISION_NEEDED, REVISION_REQUESTED, grace_deadline > NOW())
      query.andWhere(`
        tender.stage = 'WON' AND
        tender.status = 'WON' AND
        contract.status = 'REVISION_NEEDED' AND
        contract.legal_status = :revStatus AND
        contract.grace_deadline IS NOT NULL AND
        contract.grace_deadline > NOW()
      `, { revStatus: LegalStatus.REVISION_REQUESTED });
    } else if (normStatus === 'APPROVED') {
      // RULE 5: Approved Contracts
      query.andWhere(`
        (contract.legal_status = :appStatus OR contract.status = 'ACTIVE')
      `, { appStatus: LegalStatus.APPROVED });
    } else if (normStatus === 'REJECTED') {
      query.andWhere('contract.legal_status = :rejStatus', { rejStatus: LegalStatus.REJECTED });
    } else if (normStatus === 'ALL') {
      // ALL ELIGIBLE CONTRACTS FOR LEGAL WORKSTATION (INITIAL SPK + ACTIVE REVISION + APPROVED)
      query.andWhere(`
        (
          (
            tender.stage = 'WON' AND
            tender.status = 'WON' AND
            contract.status = 'PENDING_LEGAL_REVIEW' AND
            contract.legal_status IN (:...allPendingStatuses) AND
            contract.spk_file_url IS NOT NULL AND
            contract.spk_file_url != ''
          )
          OR
          (
            tender.stage = 'WON' AND
            tender.status = 'WON' AND
            contract.status = 'REVISION_NEEDED' AND
            contract.legal_status = :allRevStatus AND
            contract.grace_deadline IS NOT NULL AND
            contract.grace_deadline > NOW()
          )
          OR
          (
            contract.legal_status = :allAppStatus OR contract.status = 'ACTIVE'
          )
        )
      `, {
        allPendingStatuses: [LegalStatus.DRAFT, LegalStatus.ON_REVIEW],
        allRevStatus: LegalStatus.REVISION_REQUESTED,
        allAppStatus: LegalStatus.APPROVED,
      });
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
    // 1. Fetch contract prior to any transaction/mutation
    let contract: Contract | null = null;

    if (dto.contractId) {
      if (!isNaN(Number(dto.contractId))) {
        contract = await this.contractRepo.findOne({
          where: [{ id: Number(dto.contractId) }, { contract_number: String(dto.contractId) }],
          relations: ['proposal', 'proposal.tender'],
        });
      } else {
        contract = await this.contractRepo.findOne({
          where: { contract_number: String(dto.contractId) },
          relations: ['proposal', 'proposal.tender'],
        });
      }
    } else if (dto.proposalId) {
      contract = await this.contractRepo.findOne({
        where: { proposal_id: dto.proposalId },
        relations: ['proposal', 'proposal.tender'],
      });
    }

    if (!contract) {
      throw new NotFoundException(`Contract not found for provided ID/Proposal ID`);
    }

    // 2. Validate requested decision state
    const validRequestedStatuses = [
      LegalStatus.APPROVED,
      LegalStatus.REJECTED,
      LegalStatus.REVISION_REQUESTED,
    ];
    if (!validRequestedStatuses.includes(dto.legalStatus as LegalStatus)) {
      throw new BadRequestException(`Status review legal tidak valid: ${dto.legalStatus}`);
    }

    // 3. Terminal State Protection: APPROVED and REJECTED cannot be reviewed again
    if (contract.legal_status === LegalStatus.APPROVED || contract.status === 'ACTIVE') {
      throw new BadRequestException('Kontrak sudah berstatus APPROVED dan tidak dapat ditinjau ulang');
    }

    if (contract.legal_status === LegalStatus.REJECTED || contract.status === 'REJECTED') {
      throw new BadRequestException('Kontrak sudah berstatus REJECTED dan tidak dapat ditinjau ulang');
    }

    // 4. Revision State Protection: cannot mutate review if awaiting marketing resubmission
    if (contract.legal_status === LegalStatus.REVISION_REQUESTED || contract.status === 'REVISION_NEEDED') {
      throw new BadRequestException('Dokumen revisi belum diperbarui oleh Marketing');
    }

    // 5. Valid entry state enforcement: must be DRAFT or ON_REVIEW with PENDING_LEGAL_REVIEW
    const isValidEntryLegalStatus =
      contract.legal_status === LegalStatus.DRAFT ||
      contract.legal_status === LegalStatus.ON_REVIEW;
    const isValidEntryContractStatus = contract.status === 'PENDING_LEGAL_REVIEW';

    if (!isValidEntryLegalStatus || !isValidEntryContractStatus) {
      throw new BadRequestException(
        `Kontrak dengan status '${contract.status}' dan status legal '${contract.legal_status}' tidak memenuhi syarat untuk Legal Review`,
      );
    }

    // 6. SoD (Segregation of Duties) Validation: Self-Approval / Self-Review Prevention
    let targetTender = contract.proposal?.tender;
    const tenderId = contract.tender_id || contract.proposal?.tender_id;
    if (!targetTender && tenderId) {
      targetTender = await this.dataSource.getRepository(Tender).findOne({ where: { id: tenderId } });
    }

    const reviewerId = Number(userId);
    const isContractCreator = contract.created_by != null && Number(contract.created_by) === reviewerId;
    const isProposalCreator = contract.proposal?.created_by != null && Number(contract.proposal.created_by) === reviewerId;
    const isTenderCreator = targetTender?.created_by != null && Number(targetTender.created_by) === reviewerId;
    const isMarketingPic = targetTender?.marketing_pic_id != null && Number(targetTender.marketing_pic_id) === reviewerId;

    if (isContractCreator || isProposalCreator || isTenderCreator || isMarketingPic) {
      throw new ForbiddenException('Anda tidak dapat melakukan review atas kontrak yang Anda buat atau tangani sendiri.');
    }

    // 7. SPK Prerequisite for approval: non-null, non-empty, non-whitespace
    if (dto.legalStatus === LegalStatus.APPROVED) {
      if (!contract.spk_file_url || typeof contract.spk_file_url !== 'string' || !contract.spk_file_url.trim()) {
        throw new BadRequestException('Dokumen SPK wajib diunggah sebelum kontrak dapat disetujui (APPROVED)');
      }
    }

    // 7. SLA Grace extension limit check (max 3 times)
    if (dto.legalStatus === LegalStatus.REVISION_REQUESTED) {
      const currentCount = Number(contract.grace_extension_count || 0);
      if (currentCount >= 3) {
        throw new BadRequestException(
          `Batas Maksimal Perpanjangan Grace SLA (3x) telah tercapai untuk Kontrak #${contract.id}! Tidak dapat meminta revisi lagi.`,
        );
      }
    }

    const oldLegalStatus = contract.legal_status;
    const oldContractStatus = contract.status;

    // 8. Open transaction only AFTER all validations pass
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      contract.legal_status = dto.legalStatus as LegalStatus;
      contract.legal_notes = dto.legalNotes;
      contract.legal_reviewer_id = userId;
      contract.updated_by = userId;
      
      if (dto.legalStatus === LegalStatus.APPROVED) {
        contract.status = 'ACTIVE';

        // 1. Marketing Domain Sync: Update Proposal & Tender stage to WON / APPROVED & spk_verification_status to VERIFIED
        let targetTender = contract.proposal?.tender;
        if (!targetTender && contract.tender_id) {
          targetTender = await queryRunner.manager.findOne(Tender, { where: { id: contract.tender_id } });
        }

        if (contract.proposal) {
          contract.proposal.status = 'APPROVED';
          await queryRunner.manager.save(Proposal, contract.proposal);
        }

        if (targetTender) {
          targetTender.stage = 'WON';
          targetTender.status = TenderStatus.WON;
          targetTender.spk_verification_status = 'VERIFIED';
          await queryRunner.manager.save(Tender, targetTender);
        }

        // 2. PMO Handover Sync: Contract is marked APPROVED so it enters PMO Antrean Inisiasi SPK queue
        // Project entity in 'projects' table will ONLY be created when PM clicks Kick-off in PMO Board
      } else if (dto.legalStatus === LegalStatus.REJECTED) {
        contract.status = 'REJECTED';
      } else if (dto.legalStatus === LegalStatus.REVISION_REQUESTED) {
        contract.status = 'REVISION_NEEDED';
        const now = new Date();
        const currentCount = Number(contract.grace_extension_count || 0);
        contract.grace_deadline = new Date(now.getTime() + 72 * 60 * 60 * 1000); // NOW + 72h
        contract.grace_extended_by = userId;
        contract.grace_extended_at = now;
        contract.grace_extension_count = currentCount + 1;
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
        event_name: dto.legalStatus === LegalStatus.APPROVED
          ? 'ContractApprovedEvent'
          : (dto.legalStatus === LegalStatus.REJECTED ? 'ContractRejectedEvent' : 'ContractRevisionRequestedEvent'),
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
        if (dto.legalStatus === LegalStatus.APPROVED || savedContract.legal_status === LegalStatus.APPROVED) {
          this.eventEmitter.emit('legal.contract.approved', {
            contractId: savedContract.id,
            contractNumber: savedContract.contract_number,
            legalStatus: savedContract.legal_status,
            status: savedContract.status,
            reviewerId: userId,
            timestamp: new Date().toISOString()
          });
        } else {
          const tenderId = savedContract.tender_id || savedContract.proposal?.tender_id || savedContract.proposal?.tender?.id;
          this.eventEmitter.emit('contract.revision_requested', {
            contractId: savedContract.id,
            tenderId: tenderId,
            userId: userId,
            reason: dto.legalNotes || 'Revisi Dokumen dari Legal',
            legalStatus: savedContract.legal_status,
            timestamp: new Date().toISOString()
          });
        }
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
      if (err instanceof BadRequestException || err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw err;
      }
      throw new BadRequestException(`Legal review failed: ${err?.message || 'Unknown error'}`);
    } finally {
      await queryRunner.release();
    }
  }

  async startProject(dto: { tenderId: number; managerId?: number }, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tender = await queryRunner.manager.findOne(Tender, {
        where: { id: dto.tenderId },
      });

      if (!tender) {
        throw new NotFoundException(`Tender #${dto.tenderId} tidak ditemukan.`);
      }

      // 1. Validate Tender is WON
      const isTenderWon = tender.stage === 'WON' || tender.status === TenderStatus.WON;
      if (!isTenderWon) {
        throw new BadRequestException(
          `Tender #${tender.id} belum berstatus WON (stage: ${tender.stage}, status: ${tender.status}). Proyek tidak dapat diinisiasi.`,
        );
      }

      // 2. Validate Contract exists for this tender
      let contract = await queryRunner.manager.findOne(Contract, {
        where: { tender_id: tender.id },
      });

      if (!contract) {
        const proposal = await queryRunner.manager.findOne(Proposal, {
          where: { tender_id: tender.id },
        });
        if (proposal) {
          contract = await queryRunner.manager.findOne(Contract, {
            where: { proposal_id: proposal.id },
          });
        }
      }

      if (!contract) {
        throw new BadRequestException(
          `Kontrak untuk Tender #${tender.id} tidak ditemukan. Proyek tidak dapat diinisiasi.`,
        );
      }

      // 3. Validate Contract is APPROVED and ACTIVE
      if (contract.legal_status !== LegalStatus.APPROVED || contract.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Kontrak terkait #${contract.id} belum berstatus APPROVED dan ACTIVE (legal_status: ${contract.legal_status}, status: ${contract.status}). Proyek tidak dapat diinisiasi.`,
        );
      }

      // 4. Canonical Project Identity & Resolution
      const projectCode = contract.contract_number || `PRJ-${tender.id}`;
      let project = await queryRunner.manager.findOne(Project, {
        where: [
          { code: projectCode },
          ...(contract.contract_number ? [{ code: `PRJ-${tender.id}` }] : []),
        ],
      });

      // Preserve existing legitimate PM assignment on contract if already present
      // Strictly IGNORE/REJECT dto.managerId and caller userId for unassigned contracts at Legal Release
      let designatedPmId: number | null = contract.project_manager_id
        ? Number(contract.project_manager_id)
        : null;

      if (project) {
        // Maintain canonical identity and link to contract
        if (!project.contractId && contract.id) {
          project.contractId = contract.id;
        }
        if (project.status === 'INITIATED') {
          project.status = 'PLANNING';
        }
        // Preserve existing authentic managerId if present, never overwrite with caller or dto
        project = await queryRunner.manager.save(Project, project);
      } else if (designatedPmId) {
        // Only link Project workspace before claim if an authentic legitimate PM assignment pre-existed on contract
        project = queryRunner.manager.create(Project, {
          code: projectCode,
          name: tender.title,
          status: 'PLANNING',
          managerId: designatedPmId,
          contractId: contract.id,
        });
        project = await queryRunner.manager.save(Project, project);
      }
      // If contract.project_manager_id is NULL, do NOT create Project or assign PM.
      // dto.managerId is strictly ignored. Caller Admin/Legal is NEVER assigned.
      // Contract enters PMO queue as PENDING_KICKOFF awaiting authentic PM Claim.

      // 5. Governance Audit Log Recording
      if (project) {
        const auditLog = queryRunner.manager.create(AuditLog, {
          table_name: 'projects',
          record_id: project.id,
          action: 'PROJECT_INITIATED',
          old_value: null,
          new_value: {
            project_id: project.id,
            project_code: project.code,
            tender_id: tender.id,
            contract_id: contract.id,
            manager_id: project.managerId,
            status: project.status,
          },
          created_by: userId,
        });
        await queryRunner.manager.save(AuditLog, auditLog);
      } else {
        const auditLog = queryRunner.manager.create(AuditLog, {
          table_name: 'contracts',
          record_id: contract.id,
          action: 'CONTRACT_RELEASED_TO_PMO_QUEUE',
          old_value: null,
          new_value: {
            contract_id: contract.id,
            contract_number: contract.contract_number,
            tender_id: tender.id,
            legal_status: contract.legal_status,
            status: contract.status,
            project_code: projectCode,
            pmo_queue: 'PENDING_KICKOFF',
          },
          created_by: userId,
        });
        await queryRunner.manager.save(AuditLog, auditLog);
      }

      await queryRunner.commitTransaction();

      try {
        this.eventEmitter.emit('project.started', {
          projectId: project ? project.id : null,
          contractId: contract.id,
          tenderId: tender.id,
          title: tender.title,
          userId,
          timestamp: new Date().toISOString(),
        });
      } catch (evtErr) {
        console.error('EventEmitter error on startProject:', evtErr);
      }

      return {
        message: 'Kontrak berhasil dirilis ke Antrean Kick-off Charter PMO!',
        project: project || null,
        contract,
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      if (err instanceof BadRequestException || err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw err;
      }
      throw new BadRequestException(`Gagal menginisiasi proyek: ${err?.message || err}`);
    } finally {
      await queryRunner.release();
    }
  }
}
