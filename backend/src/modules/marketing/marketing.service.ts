import { Injectable, NotFoundException, BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Optional, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Customer } from '../../entities/customer.entity';
import { Tender, TenderStatus, GoNoGoStatus, TenderStage, RevisionStatus } from '../../entities/tender.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { Document } from '../../entities/document.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { TenderActivity, ActivityType } from '../../entities/tender-activity.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateTenderDto, UpdateTenderStatusDto } from './dto/create-tender.dto';
import { TenderDetailResponseDto } from './dto/tender-detail-response.dto';
import { CreateTenderActivityDto } from './dto/tender-activity.dto';
import { TenderPriceHistory } from '../../entities/tender-price-history.entity';
import { emitLegalQueueUpdated } from '../../shared/helpers/legal-event.helper';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Tender) private tenderRepo: Repository<Tender>,
    @InjectRepository(Proposal) private proposalRepo: Repository<Proposal>,
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    @InjectRepository(TenderActivity) private activityRepo: Repository<TenderActivity>,
    @InjectRepository(TenderPriceHistory) private priceHistoryRepo: Repository<TenderPriceHistory>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) { }

  private calculateProbabilityPercentage(stage: string, status: string): number {
    if (status === TenderStatus.WON || stage?.toUpperCase() === TenderStage.WON) return 100;
    if (status === TenderStatus.LOST || stage?.toUpperCase() === TenderStage.LOST) return 0;

    switch (stage?.toUpperCase()) {
      case TenderStage.LEAD: return 10;
      case TenderStage.WAITING_GO_NO_GO: return 20;
      case TenderStage.QUALIFICATION: return 30;
      case TenderStage.PROPOSAL: return 60;
      case TenderStage.NEGOTIATION: return 80;
      default: return 0;
    }
  }

  private async validateTenderOwnership(
    tender: { marketing_pic_id?: number | string | null; created_by?: number | string | null } | null,
    userId: number
  ): Promise<void> {
    if (!userId || !tender) return;

    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
    const roles = user?.roles?.map(r => String(r.name).toUpperCase()) || [];

    const isManagement = roles.some(r =>
      ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER'].includes(r)
    );

    if (isManagement) {
      return;
    }

    const picId = tender.marketing_pic_id ? Number(tender.marketing_pic_id) : null;
    const creatorId = tender.created_by ? Number(tender.created_by) : null;
    const currentUserId = Number(userId);

    if (picId !== currentUserId && creatorId !== currentUserId) {
      throw new ForbiddenException('Anda tidak memiliki akses terhadap tender ini');
    }
  }

  private async validateTenderStateTransition(
    tender: Tender | { id: number; stage?: string; go_nogo_status?: string; negotiated_price?: number; grace_deadline?: Date; spk_file_key?: string },
    targetStageInput: string,
    isUploadingProposal = false,
    isActivatingGrace = false,
    isNegotiating = false
  ): Promise<void> {
    if (!targetStageInput || !tender) return;

    const target = targetStageInput.toUpperCase();
    const current = (tender.stage || '').toUpperCase();

    // 1. HARD GATE: GO/NO_GO Status Verification
    if (target !== TenderStage.LEAD && target !== TenderStage.WAITING_GO_NO_GO && target !== TenderStage.LOST && tender.go_nogo_status !== GoNoGoStatus.GO) {
      throw new BadRequestException('Tender belum disetujui (GO / NO GO Gate) oleh Manajemen untuk lanjut ke stage ini.');
    }

    // Re-setting the exact same stage or setting LOST is allowed after GoNoGo gate check
    if (target === current || target === TenderStage.LOST) {
      return;
    }

    // 2. LEAD -> WAITING_GO_NO_GO
    if (target === TenderStage.WAITING_GO_NO_GO) {
      if (current !== TenderStage.LEAD) {
        throw new BadRequestException('Review GO/NO_GO hanya dapat diajukan dari stage LEAD.');
      }
      return;
    }

    // 3. WAITING_GO_NO_GO -> QUALIFICATION
    if (target === TenderStage.QUALIFICATION) {
      if (current !== TenderStage.LEAD && current !== TenderStage.WAITING_GO_NO_GO && current !== TenderStage.QUALIFICATION) {
        throw new BadRequestException('Stage QUALIFICATION hanya dapat dicapai dari stage LEAD atau WAITING_GO_NO_GO.');
      }
      return;
    }

    // 4. QUALIFICATION -> PROPOSAL
    if (target === TenderStage.PROPOSAL) {
      if (current !== TenderStage.QUALIFICATION && current !== TenderStage.PROPOSAL) {
        throw new BadRequestException('Stage PROPOSAL hanya dapat dicapai dari stage QUALIFICATION.');
      }
      if (!isUploadingProposal) {
        const documentRepo = this.dataSource.getRepository(Document);
        const doc = await documentRepo.findOne({
          where: [
            { entityType: 'PROPOSAL', entityId: tender.id },
            { entityType: 'proposal', entityId: tender.id }
          ]
        });
        if (!doc && !(tender as any).proposal_file_key) {
          throw new BadRequestException('Stage PROPOSAL membutuhkan dokumen proposal yang terunggah.');
        }
      }
      return;
    }

    // 5. PROPOSAL -> NEGOTIATION
    if (target === TenderStage.NEGOTIATION) {
      if (current !== TenderStage.PROPOSAL && current !== TenderStage.NEGOTIATION) {
        throw new BadRequestException('Stage NEGOTIATION hanya dapat dicapai dari stage PROPOSAL.');
      }
      if (!isNegotiating) {
        const hasHistory = await this.priceHistoryRepo.count({ where: { tender_id: tender.id } });
        if (tender.negotiated_price == null && hasHistory === 0) {
          throw new BadRequestException('Stage NEGOTIATION membutuhkan data negosiasi harga.');
        }
      }
      return;
    }

    // 6. NEGOTIATION -> WON
    if (target === TenderStage.WON) {
      if (current !== TenderStage.NEGOTIATION && current !== TenderStage.WON) {
        throw new BadRequestException('Stage WON hanya dapat dicapai dari stage NEGOTIATION.');
      }
      if (!isActivatingGrace) {
        const isGraceActive = tender.grace_deadline ? new Date(tender.grace_deadline) > new Date() : false;
        if (!tender.spk_file_key && !isGraceActive) {
          throw new BadRequestException('Stage WON membutuhkan upload file SPK atau Grace Period aktif.');
        }
      }
      return;
    }
  }

  private async ensureContractForWonTender(
    tender: Tender,
    userId: number,
    spkFileUrl?: string,
    queryRunner?: any
  ): Promise<Contract | null> {
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna diperlukan untuk pembuatan kontrak');
    }

    tender.stage = TenderStage.WON;
    tender.status = TenderStatus.WON;
    tender.probability_percentage = 100;

    const manager = queryRunner ? queryRunner.manager : this.dataSource.manager;

    let contract = await manager.findOne(Contract, {
      where: { tender_id: tender.id }
    });

    if (!contract) {
      let proposal = await manager.findOne(Proposal, { where: { tender_id: tender.id } });
      if (!proposal) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        proposal = manager.create(Proposal, {
          tender_id: tender.id,
          proposal_number: `PROP-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`,
          proposed_amount: tender.negotiated_price || tender.estimated_budget || 0,
          status: 'ACCEPTED',
          created_by: Number(userId),
        });
        proposal = await manager.save(Proposal, proposal);
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const contractNumber = `CONT-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

      contract = manager.create(Contract, {
        tender_id: tender.id,
        proposal_id: proposal.id,
        customer_id: tender.customer_id,
        contract_number: contractNumber,
        contract_value: tender.negotiated_price || tender.estimated_budget || 0,
        status: spkFileUrl ? 'PENDING_LEGAL_REVIEW' : 'DRAFT',
        legal_status: LegalStatus.DRAFT,
        spk_file_url: spkFileUrl || null,
        start_date: new Date(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        created_by: Number(userId),
      });
      contract = await manager.save(Contract, contract);
      console.log(`[AUTO CONTRACT] Contract #${contract.id} (${contract.contract_number}) created for WON Tender #${tender.id}`);
    } else {
      let updated = false;
      const isReentryFromExpired = contract.status === 'REVISION_EXPIRED';
      const isNewSpkProvided = !!spkFileUrl;

      if (isReentryFromExpired || !contract.status || contract.status === 'DRAFT' || isNewSpkProvided) {
        contract.status = isNewSpkProvided ? 'PENDING_LEGAL_REVIEW' : 'DRAFT';
        contract.legal_status = LegalStatus.DRAFT;
        contract.legal_reviewer_id = null;
        contract.legal_notes = null;
        contract.grace_deadline = null;
        contract.grace_extension_count = 0;
        contract.grace_extended_by = null;
        contract.grace_extended_at = null;

        if (isNewSpkProvided) {
          contract.spk_file_url = spkFileUrl;
        } else if (isReentryFromExpired) {
          // Upload Nanti from expired cycle must reset physical SPK link for fresh cycle
          contract.spk_file_url = null;
        }
        updated = true;
      } else if (spkFileUrl && contract.spk_file_url !== spkFileUrl) {
        contract.spk_file_url = spkFileUrl;
        contract.status = 'PENDING_LEGAL_REVIEW';
        contract.legal_status = LegalStatus.DRAFT;
        contract.legal_reviewer_id = null;
        contract.legal_notes = null;
        contract.grace_deadline = null;
        contract.grace_extension_count = 0;
        contract.grace_extended_by = null;
        contract.grace_extended_at = null;
        updated = true;
      }

      if (updated) {
        contract = await manager.save(Contract, contract);
      }
    }

    emitLegalQueueUpdated(this.eventEmitter, {
      type: 'CONTRACT_CREATED',
      contractId: contract.id,
      tenderId: tender.id,
    });

    return contract;
  }

  async createCustomer(dto: CreateCustomerDto, userId: number) {
    try {
      // 1. Validasi String Length & Pola
      if (!dto.name || dto.name.length < 3 || dto.name.length > 100) {
        throw new BadRequestException({ status: 'error', message: 'Name must be between 3 and 100 characters' });
      }

      const companyName = dto.company || dto.name;
      const status = dto.status || 'PROSPECT';
      const uniqueSuffix = Date.now().toString().slice(-4) + Math.floor(Math.random() * 100);
      const code = (dto as any).code || `CUST-${uniqueSuffix}`;

      const customer = this.customerRepo.create({
        ...dto,
        code,
        company: companyName,
        status: status,
        created_by: Number(userId) || null
      });

      return await this.customerRepo.save(customer);
    } catch (e: any) {
      if (e instanceof BadRequestException || e instanceof ConflictException) throw e;
      console.error('Error in createCustomer:', e);
      throw new BadRequestException(e.message || 'Failed to create customer');
    }
  }

  async getCustomers() {
    return this.customerRepo.find();
  }

  async createTender(dto: CreateTenderDto, userId: number) {
    // 1. Validasi Wajib
    if (!dto.projectName || !dto.customerId || !dto.estimatedBudget || !dto.expectedClosingDate || !dto.bidSubmissionDeadline) {
      throw new BadRequestException({ status: 'error', message: 'Semua field wajib harus diisi' });
    }

    // 2. Validasi Logis Budget
    if (dto.estimatedBudget <= 0) {
      throw new BadRequestException({ status: 'error', message: 'Estimated Budget harus lebih besar dari 0' });
    }

    // 3. Validasi Tanggal
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const closingDate = new Date(dto.expectedClosingDate);
    closingDate.setHours(0, 0, 0, 0);

    const bidDeadline = new Date(dto.bidSubmissionDeadline);
    bidDeadline.setHours(0, 0, 0, 0);

    if (closingDate.getTime() < today.getTime() || bidDeadline.getTime() < today.getTime()) {
      throw new BadRequestException({ status: 'error', message: 'Tanggal tidak boleh kurang dari hari ini' });
    }

    if (bidDeadline.getTime() > closingDate.getTime()) {
      throw new BadRequestException({ status: 'error', message: 'Bid Submission Deadline cannot be after Expected Closing Date' });
    }

    // 4. Validasi Foreign Key Customer
    const customer = await this.customerRepo.findOne({ where: { id: dto.customerId } });
    if (!customer) {
      throw new BadRequestException({ status: 'error', message: 'Customer tidak ditemukan' });
    }

    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
    const userName = user ? user.fullName : 'System';
    const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Marketing'})` : 'System';

    // 5. Force stage to LEAD
    const finalStage = TenderStage.LEAD;

    const tender = this.tenderRepo.create({
      customer_id: dto.customerId,
      title: dto.projectName, // Map projectName to title
      marketing_pic_id: dto.marketingPicId || userId,
      pic_customer_name: dto.picCustomerName,
      pic_customer_phone: dto.picCustomerPhone,
      pic_customer_email: dto.picCustomerEmail,
      business_sector: dto.businessSector,
      stage: finalStage,
      probability_percentage: this.calculateProbabilityPercentage(finalStage, TenderStatus.NEW),
      priority: dto.priority || 'MEDIUM',
      source: dto.source,
      notes: dto.notes,
      estimated_budget: dto.estimatedBudget,
      expected_closing_date: dto.expectedClosingDate ? new Date(dto.expectedClosingDate) : null,
      procurement_type: dto.procurementType || 'TENDER',
      project_location: dto.projectLocation,
      bid_submission_deadline: dto.bidSubmissionDeadline ? new Date(dto.bidSubmissionDeadline) : null,
      status: TenderStatus.NEW,
      created_by: userId,
    });

    const savedTender = await this.tenderRepo.save(tender);

    this.eventEmitter.emit('marketing.tender.management_update', {
      tenderId: savedTender.id,
      title: savedTender.title,
      customerName: customer?.name || 'Unknown',
      customerId: savedTender.customer_id,
      estimatedBudget: savedTender.estimated_budget,
      stage: savedTender.stage,
      status: savedTender.status,
      priority: savedTender.priority,
      go_nogo_status: savedTender.go_nogo_status,
      marketingPicName: userName,
      bidSubmissionDeadline: savedTender.bid_submission_deadline,
      spkFileKey: savedTender.spk_file_key,
      graceDeadline: savedTender.grace_deadline,
      updatedBy: userStr,
      updaterId: userId,
      action: 'CREATED',
      timestamp: new Date().toISOString(),
    });

    return savedTender;
  }

  async getTenders(userId: number, roles: string[]) {
    try {
      let query = this.tenderRepo.createQueryBuilder('tender')
        .leftJoinAndSelect('tender.customer', 'customer')
        .orderBy('tender.id', 'DESC');

      const isManagement = roles.some(r => ['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER'].includes(r));
      
      if (!isManagement) {
        query = query.where('(tender.marketing_pic_id = :userId OR (tender.marketing_pic_id IS NULL AND tender.created_by = :userId))', { userId });
      }

      const tenders = await query.getMany();

      const rawUsers = await this.tenderRepo.query(`
        SELECT id, full_name, email FROM users
      `);
      const userMap = new Map<number, string>();
      for (const u of rawUsers) {
        userMap.set(Number(u.id), u.full_name || u.email);
      }

      const rawContracts = await this.contractRepo.query(`
        SELECT c.id, c.contract_number, c.legal_status, c.legal_notes, c.status, c.legal_reviewer_id, c.created_at, u.full_name AS legal_reviewer_name, u.email AS legal_reviewer_email, p.tender_id 
        FROM contracts c 
        LEFT JOIN proposals p ON c.proposal_id = p.id
        LEFT JOIN users u ON c.legal_reviewer_id = u.id
      `);

      const contractMapByTenderId = new Map<number, any>();
      for (const c of rawContracts) {
        if (c.tender_id) {
          contractMapByTenderId.set(Number(c.tender_id), c);
        }
      }

      return tenders.map((t: any) => {
        const matchedContract = contractMapByTenderId.get(Number(t.id));
        const rawStatus = matchedContract ? matchedContract.legal_status : 'UNVERIFIED';

        let formattedStatus = rawStatus;
        if (rawStatus === 'APPROVED') formattedStatus = 'VERIFIED';
        else if (rawStatus === 'ON_REVIEW' || rawStatus === 'DRAFT') formattedStatus = 'MENUNGGU_REVIEW';

        const reviewerName = matchedContract?.legal_reviewer_name || (matchedContract?.legal_reviewer_id ? 'Legal Officer' : null);
        const slaDeadline = matchedContract?.created_at ? new Date(new Date(matchedContract.created_at).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() : null;

        const resolvedPicName = t.marketing_pic_id ? (userMap.get(Number(t.marketing_pic_id)) || 'Lukas Kurniawan (MARKETING)') : (t.created_by ? (userMap.get(Number(t.created_by)) || 'Lukas Kurniawan (MARKETING)') : 'Lukas Kurniawan (MARKETING)');

        return {
          ...t,
          marketing_pic_name: resolvedPicName,
          marketingPicName: resolvedPicName,
          legal_status: formattedStatus,
          spk_verification_status: formattedStatus,
          contract_id: matchedContract?.id,
          contract_number: matchedContract?.contract_number,
          contract_status: matchedContract?.status || null,
          contractStatus: matchedContract?.status || null,
          legal_reviewer_name: reviewerName,
          reviewerName: reviewerName,
          legal_sla_deadline: slaDeadline,
          slaDeadline: slaDeadline,
          legal_notes: matchedContract?.legal_notes,
        };
      });
    } catch (e: any) {
      console.error('Error fetching tenders:', e);
      throw e;
    }
  }

  async getTenderById(id: number, userId?: number, roles?: string[]): Promise<TenderDetailResponseDto> {
    try {
      const entity = await this.tenderRepo.findOne({
        where: { id: Number(id) },
        relations: ['customer', 'proposals']
      });

      if (!entity) {
        throw new NotFoundException('Tender not found');
      }

      if (userId && roles) {
        const isManagement = roles.some(r => ['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER'].includes(r));
        if (!isManagement) {
          const normalizedUserId = Number(userId);
          const normalizedPicId = entity.marketing_pic_id ? Number(entity.marketing_pic_id) : null;
          const normalizedCreatedBy = entity.created_by ? Number(entity.created_by) : null;

          const isPicOrCreator =
            (normalizedPicId !== null && normalizedPicId === normalizedUserId) ||
            (!normalizedPicId && normalizedCreatedBy !== null && normalizedCreatedBy === normalizedUserId);

          if (!isPicOrCreator) {
            throw new NotFoundException('Tender not found or access denied');
          }
        }
      }

      const contract = await this.contractRepo.findOne({
        where: [
          { tender_id: entity.id },
          { proposal_id: entity.proposals?.[0]?.id || 0 }
        ],
        order: { id: 'DESC' }
      });

      return {
        id: entity.id,
        title: entity.title,
        customerId: entity.customer_id,
        customerName: entity.customer?.name || null,
        projectName: entity.title,
        procurementType: entity.procurement_type,
        source: entity.source,
        stage: entity.stage,
        priority: entity.priority,
        estimatedBudget: entity.estimated_budget ? entity.estimated_budget.toString() : null,
        probabilityPercentage: entity.probability_percentage,
        expectedClosingDate: entity.expected_closing_date,
        bidSubmissionDeadline: entity.bid_submission_deadline || entity.submission_deadline,
        marketingPicId: entity.marketing_pic_id,
        marketingPicName: '-',
        picCustomerName: entity.pic_customer_name,
        picCustomerPhone: entity.pic_customer_phone,
        projectLocation: entity.project_location,
        notes: entity.notes,
        status: entity.status,
        legalStatus: contract?.legal_status || null,
        legalNotes: contract?.legal_notes || null
      };
    } catch (e: any) {
      if (e instanceof NotFoundException) throw e;
      throw new NotFoundException('Tender not found');
    }
  }

  async getLegalReviews() {
    return this.contractRepo.find({ relations: ['proposal', 'proposal.tender', 'proposal.tender.customer', 'customer'] });
  }

  async getDashboardSummary(period?: string, userId?: number, roles?: string[]) {
    const query = this.tenderRepo.createQueryBuilder('tender');

    if (userId && roles) {
      const isManagement = roles.some(r => ['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER'].includes(r));
      if (!isManagement) {
        query.andWhere('(tender.marketing_pic_id = :userId OR (tender.marketing_pic_id IS NULL AND tender.created_by = :userId))', { userId });
      }
    }

    if (period) {
      const now = new Date();
      if (period === 'month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        query.andWhere('tender.created_at >= :date', { date: firstDay });
      } else if (period === 'quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const firstDay = new Date(now.getFullYear(), currentQuarter * 3, 1);
        query.andWhere('tender.created_at >= :date', { date: firstDay });
      } else if (period === 'year') {
        const firstDay = new Date(now.getFullYear(), 0, 1);
        query.andWhere('tender.created_at >= :date', { date: firstDay });
      }
    }

    const tenders = await query.getMany();

    let wonTenders = 0;
    let wonRevenue = 0;
    let totalPipeline = 0;
    let negotiationCount = 0;
    let leadCount = 0;
    let waitingGoNoGoCount = 0;
    let qualificationCount = 0;
    let proposalCount = 0;
    let lostCount = 0;

    for (const t of tenders) {
      const statusUpper = (t.status || '').toUpperCase();
      const stageUpper = (t.stage || '').toUpperCase();
      const budget = Number(t.estimated_budget) || 0;

      if (statusUpper === TenderStatus.WON || stageUpper === TenderStage.WON) {
        wonTenders++;
        wonRevenue += budget;
      } else if (statusUpper === TenderStatus.LOST || stageUpper === TenderStage.LOST) {
        lostCount++;
      } else {
        // Active Pipeline ONLY sums deals that are still active (Excludes WON and LOST)
        totalPipeline += budget;
      }

      if (stageUpper === TenderStage.LEAD) leadCount++;
      else if (stageUpper === TenderStage.WAITING_GO_NO_GO) waitingGoNoGoCount++;
      else if (stageUpper === TenderStage.QUALIFICATION) qualificationCount++;
      else if (stageUpper === TenderStage.PROPOSAL) proposalCount++;
      else if (stageUpper === TenderStage.NEGOTIATION) negotiationCount++;
    }

    const totalTenders = tenders.length;
    const winRate = totalTenders > 0 ? ((wonTenders / totalTenders) * 100).toFixed(2) : 0;

    return {
      totalTenders,
      wonTenders,
      wonRevenue,
      winRate: Number(winRate),
      totalPipeline,
      negotiationCount,
      waitingGoNoGoCount,
      stageBreakdown: {
        lead: leadCount,
        waiting_go_no_go: waitingGoNoGoCount,
        qualification: qualificationCount,
        proposal: proposalCount,
        negotiation: negotiationCount,
        won: wonTenders,
        lost: lostCount,
      }
    };
  }

  async getMarketingPics() {
    return this.customerRepo.query("SELECT u.id, u.full_name as full_name FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON r.id = ur.role_id WHERE r.name = 'MARKETING' AND u.deleted_at IS NULL");
  }

  async updateTender(id: number, dto: any, userId: number) {
    const tender = await this.tenderRepo.findOne({ where: { id }, relations: ['customer'] });
    if (!tender) throw new NotFoundException('Tender not found');
    await this.validateTenderOwnership(tender, userId);

    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
    const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Marketing'})` : 'System';

    if (dto.projectName !== undefined) tender.title = dto.projectName;
    if (dto.estimatedBudget !== undefined) tender.estimated_budget = dto.estimatedBudget;
    if (dto.priority !== undefined) tender.priority = dto.priority;
    if (dto.source !== undefined) tender.source = dto.source;
    if (dto.projectLocation !== undefined) tender.project_location = dto.projectLocation;
    if (dto.picCustomerName !== undefined) tender.pic_customer_name = dto.picCustomerName;
    if (dto.picCustomerPhone !== undefined) tender.pic_customer_phone = dto.picCustomerPhone;
    if (dto.stage !== undefined) {
      await this.validateTenderStateTransition(tender, dto.stage);
      tender.stage = dto.stage;
    }

    // [STAGE G4.5 - REVISION TRACKING INTEGRATION]
    // Mengedit tender dalam kondisi REQUIRED otomatis mengubah revision_status ke COMPLETED
    if (tender.revision_status === RevisionStatus.REQUIRED) {
      tender.revision_status = RevisionStatus.COMPLETED;
    }

    tender.updated_by = userId;

    await this.tenderRepo.save(tender);

    this.eventEmitter.emit('marketing.tender.management_update', {
      tenderId: tender.id,
      title: tender.title,
      customerName: tender.customer?.name || 'Unknown',
      estimatedBudget: tender.estimated_budget,
      stage: tender.stage,
      go_nogo_status: tender.go_nogo_status,
      updatedBy: userStr,
      updaterId: userId,
      action: 'UPDATED',
      timestamp: new Date().toISOString(),
    });

    return { message: 'Tender updated successfully', tender };
  }

  async updateTenderStatusTransactionally(id: number, dto: UpdateTenderStatusDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tender = await queryRunner.manager.findOne(Tender, { where: { id }, relations: ['customer'] });
      if (!tender) throw new NotFoundException('Tender not found');
      await this.validateTenderOwnership(tender, userId);

      const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
      const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Marketing'})` : 'System';

      const oldStage = tender.stage;
      const oldStatus = tender.status;

      const upperStage = dto.stage ? dto.stage.toUpperCase() : '';
      if (dto.stage) {
        await this.validateTenderStateTransition(tender, dto.stage);
      }

      if (upperStage === TenderStage.WON) {
        tender.stage = TenderStage.WON;
        tender.status = TenderStatus.WON;
        tender.probability_percentage = 100;
        tender.updated_by = userId;
        await queryRunner.manager.save(Tender, tender);

        const activity = queryRunner.manager.create(TenderActivity, {
          tender_id: tender.id,
          user_id: userId,
          type: ActivityType.SYSTEM,
          content: `Tender marked as WON`,
        });
        await queryRunner.manager.save(TenderActivity, activity);

        // Audit Log for MARKED_WON inside the SAME transaction
        const auditLog = queryRunner.manager.create(AuditLog, {
          table_name: 'tenders',
          record_id: tender.id,
          action: 'TENDER_MARKED_WON',
          old_value: {
            stage: oldStage,
            status: oldStatus,
          },
          new_value: {
            stage: TenderStage.WON,
            status: TenderStatus.WON,
          },
          created_by: userId,
        });
        await queryRunner.manager.save(AuditLog, auditLog);

        const dateString = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        let proposal = await queryRunner.manager.findOne(Proposal, { where: { tender_id: tender.id } });
        if (!proposal) {
          proposal = queryRunner.manager.create(Proposal, {
            tender_id: tender.id,
            proposal_number: `PROP-${dateString}-${Date.now().toString().slice(-4)}`,
            proposed_amount: tender.negotiated_price || tender.estimated_budget || 0,
            status: 'ACCEPTED',
            created_by: userId,
          });
          await queryRunner.manager.save(Proposal, proposal);
        }

        // AUTO CONTRACT CREATION ON WON STAGE TRANSITION
        await this.ensureContractForWonTender(tender, userId, undefined, queryRunner);

        await queryRunner.commitTransaction();

        try {
          this.eventEmitter.emit('marketing.tender.won', {
            tenderId: tender.id,
            customerId: tender.customer_id,
            title: tender.title,
            estimatedBudget: tender.estimated_budget
          });
        } catch (eventErr) {
          console.error(`[Event Error] Failed to emit marketing.tender.won for tender ${tender.id}:`, eventErr);
        }

        this.eventEmitter.emit('marketing.tender.management_update', {
          tenderId: tender.id,
          title: tender.title,
          customerName: tender.customer?.name || 'Unknown',
          estimatedBudget: tender.estimated_budget,
          stage: tender.stage,
          go_nogo_status: tender.go_nogo_status,
          updatedBy: userStr,
          updaterId: userId,
          action: 'MARKED_WON',
          timestamp: new Date().toISOString(),
        });

        return { message: 'Tender marked as WON successfully', tender, proposal };
      } else if (upperStage === TenderStage.LOST) {
        tender.stage = TenderStage.LOST;
        tender.status = TenderStatus.LOST;
        tender.probability_percentage = 0;
        tender.updated_by = userId;
        await queryRunner.manager.save(Tender, tender);

        const activity = queryRunner.manager.create(TenderActivity, {
          tender_id: tender.id,
          user_id: userId,
          type: ActivityType.SYSTEM,
          content: `Tender marked as LOST`,
        });
        await queryRunner.manager.save(TenderActivity, activity);

        // Audit Log for MARKED_LOST inside the SAME transaction
        const auditLog = queryRunner.manager.create(AuditLog, {
          table_name: 'tenders',
          record_id: tender.id,
          action: 'TENDER_MARKED_LOST',
          old_value: {
            stage: oldStage,
            status: oldStatus,
          },
          new_value: {
            stage: TenderStage.LOST,
            status: TenderStatus.LOST,
          },
          created_by: userId,
        });
        await queryRunner.manager.save(AuditLog, auditLog);

        await queryRunner.commitTransaction();

        this.eventEmitter.emit('marketing.tender.management_update', {
          tenderId: tender.id,
          title: tender.title,
          customerName: tender.customer?.name || 'Unknown',
          estimatedBudget: tender.estimated_budget,
          stage: tender.stage,
          go_nogo_status: tender.go_nogo_status,
          updatedBy: userStr,
          updaterId: userId,
          action: 'MARKED_LOST',
          timestamp: new Date().toISOString(),
        });

        return { message: 'Tender marked as LOST successfully', tender };
      } else {
        tender.stage = dto.stage;

        // If tender was WON, ONLY Admin or Director can move it out of WON stage
        if (tender.status === TenderStatus.WON) {
          if (!userId) {
            throw new UnauthorizedException('Identitas pengguna diperlukan untuk memverifikasi hak akses tender WON');
          }
          const dbUser = await queryRunner.manager.getRepository(User).findOne({ where: { id: Number(userId) }, relations: ['roles'] });
          const dbRoleNames = dbUser?.roles?.map(r => r.name) || [];
          const allRoleStrings = [...dbRoleNames].map(r => String(r).toUpperCase());
          const isAdminOrDirector = allRoleStrings.some(r => r.includes('ADMIN') || r.includes('SUPER') || r.includes('DIRECTOR'));

          if (!isAdminOrDirector) {
            throw new BadRequestException('HTTP 403 Forbidden: Staf Marketing tidak memiliki akses untuk mengembalikan tender yang sudah dimenangkan (WON). Hubungi Admin untuk bantuan.');
          }

          tender.status = TenderStatus.NEGOTIATION;
        }

        tender.probability_percentage = this.calculateProbabilityPercentage(dto.stage, tender.status);
        tender.updated_by = userId;
        await queryRunner.manager.save(Tender, tender);

        if (oldStage !== dto.stage || oldStatus !== tender.status) {
          const activity = queryRunner.manager.create(TenderActivity, {
            tender_id: tender.id,
            user_id: userId,
            type: ActivityType.SYSTEM,
            content: `Tender stage changed from ${oldStage} to ${dto.stage}`,
          });
          await queryRunner.manager.save(TenderActivity, activity);

          // Audit Log for TENDER_STAGE_CHANGED inside the SAME transaction
          const auditLog = queryRunner.manager.create(AuditLog, {
            table_name: 'tenders',
            record_id: tender.id,
            action: 'TENDER_STAGE_CHANGED',
            old_value: {
              stage: oldStage,
              status: oldStatus,
            },
            new_value: {
              stage: tender.stage,
              status: tender.status,
            },
            created_by: userId,
          });
          await queryRunner.manager.save(AuditLog, auditLog);
        }

        await queryRunner.commitTransaction();

        this.eventEmitter.emit('marketing.tender.management_update', {
          tenderId: tender.id,
          title: tender.title,
          customerName: tender.customer?.name || 'Unknown',
          estimatedBudget: tender.estimated_budget,
          stage: tender.stage,
          go_nogo_status: tender.go_nogo_status,
          updatedBy: userStr,
          updaterId: userId,
          action: 'STAGE_CHANGED',
          timestamp: new Date().toISOString(),
        });

        return { message: `Tender stage updated to ${dto.stage}`, tender };
      }
    } catch (err) {
      console.error('[EXACT UPDATE WON ERROR]:', err);
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
  async getTenderActivities(tenderId: number, userId?: number, roles?: string[]) {
    // Enforce data isolation first
    if (userId && roles) {
      await this.getTenderById(tenderId, userId, roles); // Will throw NotFoundException if access is denied
    }

    const activities = await this.activityRepo.createQueryBuilder('act')
      .leftJoin('act.user', 'user')
      .addSelect(['user.id', 'user.fullName'])
      .where('act.tender_id = :tenderId', { tenderId })
      .orderBy('act.created_at', 'ASC')
      .getMany();
    return activities;
  }

  async createTenderActivity(tenderId: number, dto: CreateTenderActivityDto, userId: number) {
    const activity = this.activityRepo.create({
      tender_id: tenderId,
      user_id: userId,
      type: ActivityType.COMMENT,
      content: dto.content,
    });
    await this.activityRepo.save(activity);

    const saved = await this.activityRepo.createQueryBuilder('act')
      .leftJoin('act.user', 'user')
      .addSelect(['user.id', 'user.fullName'])
      .where('act.id = :id', { id: activity.id })
      .getOne();

    // Trigger realtime socket broadcast
    this.eventEmitter.emit('marketing.tender.management_update', {
      tenderId: tenderId,
      updatedBy: saved?.user?.fullName || 'System',
      updaterId: userId,
      action: 'NEW_ACTIVITY',
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async submitGoNoGoReview(id: number, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tender = await queryRunner.manager.findOne(Tender, { where: { id: Number(id) }, relations: ['customer'] });
      if (!tender) {
        throw new NotFoundException(`Tender #${id} tidak ditemukan`);
      }
      await this.validateTenderOwnership(tender, userId);

      // 1. Hanya boleh dari stage LEAD
      if ((tender.stage || '').toUpperCase() !== TenderStage.LEAD) {
        throw new BadRequestException('Tender hanya dapat diajukan untuk GO / NO GO review jika berada pada stage LEAD');
      }

      // 2. Jika sudah APPROVED (GO), tidak boleh diajukan ulang
      if (tender.go_nogo_status === GoNoGoStatus.GO) {
        throw new BadRequestException('Tender yang sudah disetujui (GO) tidak dapat diajukan ulang untuk review');
      }

      // 3. REVISION TRACKING CHECK: Jika revision_status == REQUIRED, tolak submit review sebelum dilakukan revisi
      if (tender.revision_status === RevisionStatus.REQUIRED) {
        throw new BadRequestException('Tender harus direvisi terlebih dahulu sebelum diajukan kembali.');
      }

      const isResubmission = tender.go_nogo_status === GoNoGoStatus.NO_GO;

      // Reset state untuk siklus review baru
      tender.stage = TenderStage.WAITING_GO_NO_GO;
      tender.go_nogo_status = GoNoGoStatus.PENDING;
      tender.revision_status = RevisionStatus.NOT_REQUIRED;
      tender.go_nogo_notes = null;
      tender.go_nogo_by = null;
      tender.go_nogo_at = null;
      tender.probability_percentage = this.calculateProbabilityPercentage(TenderStage.WAITING_GO_NO_GO, tender.status);
      tender.updated_by = userId;

      await queryRunner.manager.save(Tender, tender);

      const activityContent = isResubmission
        ? 'Marketing resubmitted tender for GO / NO GO review.'
        : 'Marketing submitted tender for GO / NO GO review.';

      const activity = queryRunner.manager.create(TenderActivity, {
        tender_id: tender.id,
        user_id: userId,
        type: ActivityType.SYSTEM,
        content: activityContent,
      });
      await queryRunner.manager.save(TenderActivity, activity);

      await queryRunner.commitTransaction();

      const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
      const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Marketing'})` : 'Marketing';

      // Standardized WebSocket Payload
      this.eventEmitter.emit('marketing.tender.management_update', {
        tenderId: tender.id,
        title: tender.title,
        customerName: tender.customer?.name || 'Unknown',
        estimatedBudget: tender.estimated_budget,
        stage: tender.stage,
        go_nogo_status: tender.go_nogo_status,
        updatedBy: userStr,
        updaterId: userId,
        action: isResubmission ? 'GO_NOGO_RESUBMITTED' : 'GO_NOGO_SUBMITTED',
        timestamp: new Date().toISOString(),
      });

      // Notification A: Kirim ke Director
      this.eventEmitter.emit('notification.send', {
        title: 'Menunggu APPROVE Director',
        message: `Tender "${tender.title}" menunggu APPROVE Director untuk keputusan GO / NO GO.`,
        type: 'INFO',
        audience: 'DIRECTOR',
        tenderId: tender.id,
      });

      // Notification B: Kirim notifikasi tracking personal ke Marketing (userId)
      this.eventEmitter.emit('notification.send', {
        title: 'GO/NO GO Berhasil Diajukan',
        message: `Tender "${tender.title}" sedang menunggu APPROVE Director.`,
        type: 'INFO',
        recipientId: userId,
        tenderId: tender.id,
      });

      // Normalized Audit Log
      this.eventEmitter.emit('audit.log', {
        action: isResubmission ? 'GO_NOGO_RESUBMITTED' : 'GO_NOGO_SUBMITTED',
        entityId: tender.id,
        entityName: 'tenders',
        reason: activityContent,
        userId: userId,
      });

      return {
        status: 'success',
        message: 'Tender berhasil diajukan untuk GO / NO GO review',
        tender,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async submitGoNoGo(id: number, dto: { decision: 'GO' | 'NO_GO'; notes?: string }, userId: number) {
    if (dto.decision !== 'GO' && dto.decision !== 'NO_GO') {
      throw new BadRequestException('Decision harus berupa GO atau NO_GO');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tender = await queryRunner.manager.findOne(Tender, { where: { id: Number(id) }, relations: ['customer'] });
      if (!tender) {
        throw new NotFoundException(`Tender #${id} tidak ditemukan`);
      }

      // Rule 1: Hanya boleh dilakukan jika stage == WAITING_GO_NO_GO
      if ((tender.stage || '').toUpperCase() !== TenderStage.WAITING_GO_NO_GO) {
        throw new BadRequestException('Keputusan GO / NO GO hanya dapat dilakukan pada tender dengan status WAITING_GO_NO_GO');
      }

      // Rule 2: Jika go_nogo_status != PENDING maka tolak approval ulang
      if (tender.go_nogo_status && tender.go_nogo_status !== GoNoGoStatus.PENDING) {
        throw new BadRequestException('Keputusan GO / NO GO sudah pernah dilakukan untuk tender ini');
      }

      const now = new Date();
      tender.go_nogo_status = dto.decision === 'GO' ? GoNoGoStatus.GO : GoNoGoStatus.NO_GO;
      tender.go_nogo_notes = dto.notes || null;
      tender.go_nogo_by = userId;
      tender.go_nogo_at = now;

      let activityContent = '';
      let auditAction = '';
      if (dto.decision === 'GO') {
        tender.stage = TenderStage.QUALIFICATION;
        tender.probability_percentage = this.calculateProbabilityPercentage(TenderStage.QUALIFICATION, tender.status);
        tender.revision_status = RevisionStatus.NOT_REQUIRED;
        activityContent = 'Director approved GO. Tender moved to Qualification.';
        auditAction = 'GO_NOGO_APPROVED';
      } else {
        tender.stage = TenderStage.LEAD;
        tender.probability_percentage = this.calculateProbabilityPercentage(TenderStage.LEAD, tender.status);
        tender.revision_status = RevisionStatus.REQUIRED;
        activityContent = 'Director rejected (NO GO). Tender returned to Lead.';
        auditAction = 'GO_NOGO_REJECTED';
      }

      tender.updated_by = userId;
      await queryRunner.manager.save(Tender, tender);

      const activity = queryRunner.manager.create(TenderActivity, {
        tender_id: tender.id,
        user_id: userId,
        type: ActivityType.SYSTEM,
        content: activityContent,
      });
      await queryRunner.manager.save(TenderActivity, activity);

      await queryRunner.commitTransaction();

      const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
      const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Director'})` : 'Management';

      // Standardized WebSocket Payload
      this.eventEmitter.emit('marketing.tender.management_update', {
        tenderId: tender.id,
        title: tender.title,
        customerName: tender.customer?.name || 'Unknown',
        estimatedBudget: tender.estimated_budget,
        stage: tender.stage,
        go_nogo_status: tender.go_nogo_status,
        updatedBy: userStr,
        updaterId: userId,
        action: auditAction,
        timestamp: new Date().toISOString(),
      });

      // Notification B & C: Kirim ke Marketing PIC
      const picId = tender.marketing_pic_id || tender.created_by;
      if (picId) {
        if (dto.decision === 'GO') {
          this.eventEmitter.emit('notification.send', {
            title: 'Tender Disetujui (GO) ✅',
            message: `Tender "${tender.title}" telah disetujui. Status berubah menjadi Qualification.`,
            type: 'SUCCESS',
            recipientId: picId,
            tenderId: tender.id,
          });
        } else {
          this.eventEmitter.emit('notification.send', {
            title: 'Tender Ditolak (NO GO) ❌',
            message: `Tender "${tender.title}" ditolak. Silakan lakukan revisi sebelum submit kembali.`,
            type: 'WARNING',
            recipientId: picId,
            tenderId: tender.id,
          });
        }
      }

      // Normalized Audit Log
      this.eventEmitter.emit('audit.log', {
        action: auditAction,
        entityId: tender.id,
        entityName: 'tenders',
        reason: activityContent + (dto.notes ? ` Notes: ${dto.notes}` : ''),
        userId: userId,
      });

      return {
        status: 'success',
        message: `Keputusan GO / NO GO berhasil disimpan (${dto.decision})`,
        tender,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async uploadProposal(tenderId: number, file: Express.Multer.File, userId: number) {
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna diperlukan untuk mengunggah proposal');
    }

    const tender = await this.tenderRepo.findOne({
      where: { id: tenderId },
      relations: ['customer']
    });

    if (!tender) {
      throw new NotFoundException('Tender not found');
    }
    await this.validateTenderOwnership(tender, userId);

    await this.validateTenderStateTransition(tender, TenderStage.PROPOSAL, true);

    // Perbarui stage ke PROPOSAL
    tender.stage = TenderStage.PROPOSAL;
    await this.tenderRepo.save(tender);

    // Simpan record dokumen ke tabel 'documents' agar dapat dilihat oleh Admin di Repositori Dokumen
    const documentRepo = this.dataSource.getRepository(Document);
    const docRecord = documentRepo.create({
      entityType: 'PROPOSAL',
      entityId: tenderId,
      fileName: file.originalname || file.filename,
      filePath: file.filename,
      mimeType: file.mimetype || 'application/pdf',
      fileSize: file.size || 0,
      createdBy: Number(userId),
    });
    await documentRepo.save(docRecord);

    const activity = this.activityRepo.create({
      tender_id: tenderId,
      user_id: userId,
      type: ActivityType.SYSTEM,
      content: `Proposal document uploaded: ${file.filename}. Stage updated to PROPOSAL.`,
    });
    await this.activityRepo.save(activity);

    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
    const userStr = user ? user.fullName : 'System';

    this.eventEmitter.emit('marketing.tender.management_update', {
      tenderId: tender.id,
      title: tender.title,
      customerName: tender.customer?.name || 'Unknown',
      estimatedBudget: tender.estimated_budget,
      stage: tender.stage,
      go_nogo_status: tender.go_nogo_status,
      updatedBy: userStr,
      updaterId: userId,
      action: 'PROPOSAL_UPLOADED',
      timestamp: new Date().toISOString(),
    });

    return {
      message: 'Proposal uploaded successfully',
      filename: file.filename,
      stage: tender.stage
    };
  }

    async negotiatePrice(id: number, dto: { new_price: number, reason?: string }, userId: number, userRoles: string[] = []) {
    const tender = await this.tenderRepo.findOne({ where: { id } });
    if (!tender) throw new NotFoundException('Tender tidak ditemukan');
    await this.validateTenderOwnership(tender, userId);
    await this.validateTenderStateTransition(tender, TenderStage.NEGOTIATION, false, false, true);

    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna diperlukan untuk verifikasi hak akses negosiasi');
    }

    // Combine roles from JWT token and Database for strict privilege verification
    const dbUser = await this.dataSource.getRepository(User).findOne({ where: { id: Number(userId) }, relations: ['roles'] });
    const dbRoleNames = dbUser?.roles?.map(r => r.name) || [];
    const allRoleStrings = [...userRoles, ...dbRoleNames].map(r => String(r).toUpperCase());

    const isAdminOrDirector = allRoleStrings.some(r =>
      r.includes('ADMIN') || r.includes('SUPER') || r.includes('DIRECTOR')
    );

    // [Strict Governance Rule] - If tender is WON, regular MARKETING users are STRICTLY BLOCKED.
    // ONLY SUPER_ADMIN, ADMIN, or DIRECTOR can reopen negotiation on a WON tender.
    if (tender.status === TenderStatus.WON) {
      if (!isAdminOrDirector) {
        throw new BadRequestException('HTTP 403 Forbidden: Tidak dapat mengubah harga final setelah tender dimenangkan. Hubungi Admin untuk bantuan.');
      }
      tender.status = TenderStatus.NEGOTIATION;
      tender.stage = 'NEGOTIATION';
    }

    const oldPrice = tender.negotiated_price || tender.estimated_budget;
    const newPrice = dto.new_price;
    const budget = tender.estimated_budget;

    const discountPercentage = budget ? ((budget - newPrice) / budget) * 100 : 0;
    const maxDiscount = tender.max_discount_rate || 20;

    const isOverDiscount = discountPercentage > maxDiscount;
    if (isOverDiscount) {
      tender.status = TenderStatus.PENDING_APPROVAL as any;
      // Trigger Approval Workflow (Auto-Escalate mechanism handled by Scheduler)
      this.eventEmitter.emit('notification.send', {
        title: '⚠️ Peringatan Diskon Kritis',
        message: `Tender ${tender.title} mengajukan diskon ${discountPercentage.toFixed(2)}% (Batas: ${maxDiscount}%). Menunggu persetujuan Direktur.`,
        type: 'WARNING',
        audience: 'ALL', // Director
      });
    } else {
      tender.status = TenderStatus.NEGOTIATION;
    }

    tender.negotiated_price = newPrice;
    tender.stage = TenderStage.NEGOTIATION;
    tender.updated_at = new Date(); // Reset timestamp for scheduler 2 hours timeout

    await this.dataSource.transaction(async (manager) => {
      await manager.save(Tender, tender);

      const history = manager.create(TenderPriceHistory, {
        tender_id: tender.id,
        old_price: oldPrice,
        new_price: newPrice,
        changed_by: userId,
        reason: dto.reason || (isOverDiscount ? 'Diskon melebihi batas - Menunggu approval' : 'Negosiasi Harga'),
      });
      await manager.save(TenderPriceHistory, history);
    });

    return {
      status: 'success',
      message: 'Harga negosiasi berhasil diperbarui',
      discount_percentage: discountPercentage,
      data: {
        id: Number(tender.id),
        stage: tender.stage,
        status: tender.status,
        estimated_budget: Number(tender.estimated_budget),
        negotiated_price: Number(tender.negotiated_price),
        discount_percentage: discountPercentage,
      },
    };
  }

  async approveDiscount(id: number, dto: { is_approved: boolean, notes?: string }, userId: number) {
    const tender = await this.tenderRepo.findOne({ where: { id } });
    if (!tender) throw new NotFoundException('Tender tidak ditemukan');

    // [Amandemen 2: Hard Lock Harga]
    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
    const isAdmin = user?.roles?.some(r => r.name === 'SUPER_ADMIN' || r.name === 'ADMIN');

    if (tender.status === TenderStatus.WON && !isAdmin) {
      throw new BadRequestException('HTTP 403 Forbidden: Tidak dapat mengubah harga setelah tender dimenangkan.');
    }

    if (tender.status !== TenderStatus.PENDING_APPROVAL as any) {
      throw new BadRequestException('Tender tidak sedang menunggu persetujuan diskon');
    }

    tender.status = TenderStatus.NEGOTIATION;
    const oldPrice = tender.negotiated_price;

    if (!dto.is_approved) {
      // Revert price back to estimated_budget
      tender.negotiated_price = tender.estimated_budget;

      const history = this.priceHistoryRepo.create({
        tender_id: tender.id,
        old_price: oldPrice,
        new_price: tender.estimated_budget,
        changed_by: userId,
        reason: 'Diskon DITOLAK oleh Direktur. Harga dikembalikan ke estimasi.',
      });
      await this.priceHistoryRepo.save(history);

      this.eventEmitter.emit('notification.send', {
        title: '❌ Diskon Ditolak',
        message: `Pengajuan diskon untuk tender ${tender.title} DITOLAK. Harga dikembalikan ke awal. Notes: ${dto.notes || '-'}`,
        type: 'ERROR',
        recipientId: tender.marketing_pic_id || 'C-LEVEL',
        tenderId: tender.id
      });

      this.eventEmitter.emit('audit.log', {
        action: 'DISCOUNT_REJECTED',
        entityId: tender.id,
        entityName: 'tenders',
        reason: dto.notes || 'Ditolak oleh Direktur',
        userId: userId
      });
    } else {
      // Approved
      this.eventEmitter.emit('notification.send', {
        title: '✅ Diskon Disetujui',
        message: `Pengajuan diskon untuk tender ${tender.title} DISETUJUI oleh Direktur. Notes: ${dto.notes || '-'}`,
        type: 'SUCCESS',
        recipientId: tender.marketing_pic_id || 'C-LEVEL',
        tenderId: tender.id
      });

      this.eventEmitter.emit('audit.log', {
        action: 'DISCOUNT_APPROVED',
        entityId: tender.id,
        entityName: 'tenders',
        reason: dto.notes || 'Disetujui oleh Direktur',
        userId: userId
      });
    }

    await this.tenderRepo.save(tender);

    return {
      status: 'success',
      message: dto.is_approved ? 'Diskon disetujui.' : 'Diskon ditolak, harga dikembalikan.'
    };
  }

  async getPresignedUrl(id: number, filename: string, userId: number) {
    const tender = await this.tenderRepo.findOne({ where: { id } });
    if (!tender) throw new NotFoundException('Tender tidak ditemukan');

    const fileKey = `contracts/spk-${tender.id}-${Date.now()}-${filename}`;
    const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
    const localUrl = `${baseUrl}/uploads/contracts/${fileKey}`;

    tender.spk_file_key = fileKey;
    tender.spk_verification_status = 'PENDING_REVIEW';
    await this.tenderRepo.save(tender);

    return { 
      status: 'success', 
      message: 'Gunakan endpoint /upload-spk (POST multipart/form-data) untuk upload langsung ke disk storage',
      presigned_url: localUrl, 
      file_key: fileKey 
    };
  }

  async verifySpk(id: number, dto: { is_valid: boolean, notes?: string }, userId: number) {
    throw new HttpException(
      {
        statusCode: HttpStatus.GONE,
        error: 'Gone',
        message: 'Endpoint verify-spk telah deprecated. Gunakan modul Legal Review untuk memproses clearance SPK.',
      },
      HttpStatus.GONE,
    );
  }

  async setGracePeriod(id: number, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tender = await queryRunner.manager.findOne(Tender, { where: { id: Number(id) }, relations: ['customer'] });
      if (!tender) throw new NotFoundException('Tender tidak ditemukan');
      await this.validateTenderOwnership(tender, userId);

      await this.validateTenderStateTransition(tender, TenderStage.WON, false, true);

      const oldStage = tender.stage;
      const oldStatus = tender.status;
      const oldGraceDeadline = tender.grace_deadline;
      const oldSpkFileKey = tender.spk_file_key;

      tender.status = TenderStatus.WON;
      tender.stage = TenderStage.WON;
      tender.probability_percentage = 100;
      // Aturan 1: Backend mengatur grace_deadline mutlak NOW() + 48 jam
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 48);
      tender.grace_deadline = deadline;
      tender.spk_file_key = null;
      tender.spk_verification_status = 'UNVERIFIED';
      tender.updated_by = userId;

      await queryRunner.manager.save(Tender, tender);

      // Reset active contract state for Upload Nanti new WON cycle
      await this.ensureContractForWonTender(tender, userId, undefined, queryRunner);

      // Record TenderActivity (SYSTEM type per convention)
      const activity = queryRunner.manager.create(TenderActivity, {
        tender_id: tender.id,
        user_id: userId,
        type: ActivityType.SYSTEM,
        content: 'Grace Period SPK 2x24 jam diaktifkan (Upload Nanti).',
      });
      await queryRunner.manager.save(TenderActivity, activity);

      // Record AuditLog for SPK_GRACE_PERIOD_ACTIVATED inside transaction
      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'tenders',
        record_id: tender.id,
        action: 'SPK_GRACE_PERIOD_ACTIVATED',
        old_value: {
          stage: oldStage,
          status: oldStatus,
          grace_deadline: oldGraceDeadline,
          spk_file_key: oldSpkFileKey,
        },
        new_value: {
          stage: TenderStage.WON,
          status: TenderStatus.WON,
          grace_deadline: deadline,
          spk_file_key: null,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      await queryRunner.commitTransaction();

      // Emit realtime management update event strictly AFTER commit
      try {
        const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
        const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Marketing'})` : 'Marketing';

        this.eventEmitter.emit('marketing.tender.management_update', {
          tenderId: tender.id,
          title: tender.title,
          customerName: tender.customer?.name || 'Unknown',
          estimatedBudget: tender.estimated_budget,
          stage: tender.stage,
          go_nogo_status: tender.go_nogo_status,
          updatedBy: userStr,
          updaterId: userId,
          action: 'GRACE_PERIOD_ACTIVATED',
          timestamp: new Date().toISOString(),
        });
      } catch (eventErr) {
        console.error(`[Event Error] Failed to emit marketing.tender.management_update for tender ${tender.id}:`, eventErr);
      }

      return { status: 'success', message: 'Grace period SPK diaktifkan 2x24 jam', tender };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteTender(id: number, userId: number) {
    const tender = await this.tenderRepo.findOne({ where: { id } });
    if (!tender) {
      throw new NotFoundException(`Tender #${id} tidak ditemukan.`);
    }

    const deleteTimestamp = new Date();

    await this.dataSource.transaction(async (manager) => {
      // 1. Soft delete Tender
      await manager.softDelete(Tender, id);

      // 2. Soft delete Proposal associated with Tender
      await manager.softDelete(Proposal, { tender_id: id });

      // 3. Soft delete Contract associated with Tender directly OR via Proposal
      await manager
        .createQueryBuilder()
        .update(Contract)
        .set({ deleted_at: deleteTimestamp })
        .where('tender_id = :tenderId', { tenderId: id })
        .orWhere('proposal_id IN (SELECT id FROM proposals WHERE tender_id = :tenderId)', { tenderId: id })
        .execute();

      // 4. [PHASE R8.16] Soft delete Document associated with Tender
      await manager.softDelete(Document, { entityId: id });

      // 5. [PHASE R8.16] Record AuditLog for TENDER_SOFT_DELETED inside the SAME transaction
      const auditLog = manager.create(AuditLog, {
        table_name: 'tenders',
        record_id: tender.id,
        action: 'TENDER_SOFT_DELETED',
        old_value: {
          stage: tender.stage,
          status: tender.status,
          title: tender.title,
          customer_id: tender.customer_id,
        },
        new_value: {
          deleted_at: deleteTimestamp,
        },
        created_by: userId,
      });
      await manager.save(AuditLog, auditLog);
    });

    try {
      const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
      const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Admin'})` : 'Admin';

      this.eventEmitter.emit('marketing.tender.management_update', {
        tenderId: Number(id),
        title: tender.title,
        customerName: tender.customer?.name || 'Unknown',
        estimatedBudget: tender.estimated_budget,
        stage: tender.stage,
        go_nogo_status: tender.go_nogo_status,
        updatedBy: userStr,
        updaterId: userId,
        action: 'DELETED',
        timestamp: deleteTimestamp.toISOString(),
      });

      emitLegalQueueUpdated(this.eventEmitter, {
        type: 'TENDER_DELETED',
        tenderId: id,
      });
    } catch (eventErr) {
      console.error(`[Event Error] Failed to emit management_update/legal.queue.updated for tender ${id}:`, eventErr);
    }

    return {
      status: 'success',
      message: `Tender #${id} ("${tender.title}") berhasil dihapus beserta seluruh data terkait (Cascade Soft Delete).`
    };
  }

  /**
   * SAVE SPK FILE & UPDATE CONTRACT.SPK_FILE_URL
   * Dipanggil setelah file SPK berhasil disimpan ke disk storage.
   * Atomic database transaction covering contracts, tenders, activities, documents, and audit logs.
   */
  async saveSPKAndUpdateContract(tenderIdParam: any, file: Express.Multer.File, publicUrlParam: string, userId: number) {
    const uploadedFilePath = file?.path || (file?.filename ? path.resolve(process.cwd(), 'uploads', 'contracts', file.filename) : null);

    try {
      const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
      let publicUrl = publicUrlParam;
      if (file?.filename) {
        publicUrl = `${baseUrl}/uploads/contracts/${file.filename}`;
      } else if (publicUrlParam && !publicUrlParam.startsWith('http')) {
        publicUrl = `${baseUrl}${publicUrlParam.startsWith('/') ? '' : '/'}${publicUrlParam}`;
      }

      console.log('[UPLOAD] Menyimpan URL SPK:', publicUrl);
      console.log('[SPK Upload] Upload dimulai untuk tender ID:', tenderIdParam);
      console.log('[SPK Upload] URL Absolut SPK:', publicUrl);

      // 1. PASTIKAN ID ADALAH NUMBER (BigInt / Integer)
      const tenderId = typeof tenderIdParam === 'number' ? tenderIdParam : parseInt(String(tenderIdParam), 10);
      if (isNaN(tenderId) || tenderId <= 0) {
        throw new BadRequestException(`ID Tender tidak valid: ${tenderIdParam}`);
      }
      if (!userId) {
        throw new UnauthorizedException('Identitas pengguna diperlukan untuk mengunggah SPK');
      }
      console.log('[SPK Upload] ID Tender valid (Number):', tenderId);
      console.log('[SPK Upload] URL Absolut disimpan:', publicUrl);

      // ATOMIC TRANSACTION FOR ALL DATABASE MUTATIONS
      const txResult = await this.dataSource.transaction(async (manager) => {
        // 2. CEK APAKAH CONTRACT SUDAH ADA (MULTI-LEVEL SEARCH: tender_id ATAU proposal.tender_id)
        let proposal = await manager.findOne(Proposal, { where: { tender_id: tenderId } });

        let existingContract = await manager
          .createQueryBuilder(Contract, 'contract')
          .where('contract.tender_id = :tenderId', { tenderId })
          .orWhere('contract.proposal_id IN (SELECT id FROM proposals WHERE tender_id = :tenderId)', { tenderId })
          .getOne();

        console.log('[SPK Upload] Contract existing found?', !!existingContract);

        // 3. AMBIL ESTIMATED BUDGET, CUSTOMER ID, DAN GO_NOGO_STATUS DARI TENDERS
        const [tenderRow] = await manager.query(
          `SELECT customer_id, estimated_budget, go_nogo_status, marketing_pic_id, created_by, revision_status FROM tenders WHERE id = ? LIMIT 1`,
          [tenderId]
        );
        if (tenderRow) {
          await this.validateTenderOwnership(tenderRow, userId);
        }

        // [GO / NO GO HARD GATE VALIDATION] - SPK tidak dapat diupload jika Tender belum APPROVED GO
        if (tenderRow && tenderRow.go_nogo_status !== GoNoGoStatus.GO) {
          throw new BadRequestException('Tender belum disetujui (GO / NO GO Gate) oleh Manajemen untuk lanjut ke stage ini.');
        }

        const realCustomerId = tenderRow?.customer_id;
        const estBudget = tenderRow?.estimated_budget || 0;

        let contract: any;
        if (existingContract) {
          // Single canonical contract update via raw SQL inside transaction
          if (realCustomerId) {
            await manager.query(
              `UPDATE contracts 
               SET spk_file_url = ?, tender_id = ?, customer_id = ?, status = 'PENDING_LEGAL_REVIEW', legal_status = 'DRAFT',
                   legal_reviewer_id = NULL, legal_notes = NULL, grace_deadline = NULL, grace_extension_count = 0,
                   grace_extended_by = NULL, grace_extended_at = NULL,
                   contract_value = IF(contract_value = 0, ?, contract_value)
               WHERE tender_id = ? OR proposal_id IN (SELECT id FROM proposals WHERE tender_id = ?)`,
              [publicUrl, tenderId, realCustomerId, estBudget, tenderId, tenderId]
            );
          } else {
            await manager.query(
              `UPDATE contracts 
               SET spk_file_url = ?, tender_id = ?, status = 'PENDING_LEGAL_REVIEW', legal_status = 'DRAFT',
                   legal_reviewer_id = NULL, legal_notes = NULL, grace_deadline = NULL, grace_extension_count = 0,
                   grace_extended_by = NULL, grace_extended_at = NULL,
                   contract_value = IF(contract_value = 0, ?, contract_value)
               WHERE tender_id = ? OR proposal_id IN (SELECT id FROM proposals WHERE tender_id = ?)`,
              [publicUrl, tenderId, estBudget, tenderId, tenderId]
            );
          }
          contract = existingContract;
          console.log('[SPK Upload] Contract existing diupdate via raw SQL, tender_id, customer_id & spk_file_url terisi');
        } else {
          // BUAT BARU JIKA BENAR-BENAR BELUM ADA
          if (!proposal) {
            proposal = manager.create(Proposal, {
              tender_id: tenderId,
              proposal_number: `PROP-${Date.now()}`,
              proposed_amount: estBudget,
              status: 'ACCEPTED',
              created_by: userId,
            });
            await manager.save(Proposal, proposal);
          }

          if (!realCustomerId) {
            throw new Error(`Tender ID ${tenderId} tidak memiliki customer_id valid.`);
          }

          const insertResult = await manager.query(
            `INSERT INTO contracts 
               (proposal_id, tender_id, customer_id, contract_number, spk_file_url, status, legal_status, 
                contract_value, start_date, end_date, created_by, created_at, updated_at)
             VALUES 
               (?, ?, ?, 'DRAFT', ?, 'PENDING_LEGAL_REVIEW', 'DRAFT', 
                ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), ?, NOW(), NOW())`,
            [proposal.id, tenderId, realCustomerId, publicUrl, estBudget, userId]
          );

          const newId = insertResult.insertId;
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const paddedId = String(newId).padStart(4, '0');
          const finalContractNumber = `CONT-${dateStr}-${paddedId}`;

          await manager.query(
            `UPDATE contracts SET contract_number = ? WHERE id = ?`,
            [finalContractNumber, newId]
          );

          contract = { id: newId, contract_number: finalContractNumber };
          console.log(`[SPK Upload] Contract baru (ID #${newId}) dibuat dengan nomor: ${finalContractNumber}`);
        }

        // 4. UPDATE STATUS TENDER MENJADI WON (PAKAI QUERY BUILDER / MANAGER)
        await manager
          .createQueryBuilder()
          .update(Tender)
          .set({
            stage: TenderStage.WON,
            status: TenderStatus.WON,
            spk_file_key: `contracts/${file.filename}`,
            spk_verification_status: 'PENDING_REVIEW',
            grace_deadline: () => 'NULL'
          })
          .where('id = :tenderId', { tenderId })
          .execute();

        console.log('[SPK Upload] Status Tender berhasil diupdate ke WON');

        const updatedTender = await manager.findOne(Tender, { where: { id: tenderId }, relations: ['customer'] });

        // Record SPK Upload in tender_activities & audit_logs
        const isRevisionUpload =
          tenderRow?.revision_status === RevisionStatus.REQUIRED ||
          tenderRow?.revision_status === 'REVISION_REQUESTED' ||
          existingContract?.status === 'REVISION_NEEDED' ||
          existingContract?.status === 'REVISION_EXPIRED' ||
          existingContract?.status === 'REVISION_REQUESTED';

        const fileName = file?.originalname || file?.filename || 'dokumen.pdf';
        const diskFileName = file?.filename || fileName;
        const activityContent = isRevisionUpload
          ? `Dokumen revisi SPK (${diskFileName}) berhasil diunggah.`
          : `Dokumen SPK (${diskFileName}) berhasil diunggah.`;

        const activity = manager.create(TenderActivity, {
          tender_id: tenderId,
          user_id: userId,
          type: ActivityType.COMMENT,
          content: activityContent,
        });
        await manager.save(TenderActivity, activity);

        // Simpan record dokumen ke tabel 'documents'
        // 1. Link ke CONTRACT agar Legal Review dapat menemukan lampiran SPK via /documents/entity/CONTRACT/:id
        if (contract?.id) {
          const contractDocRecord = manager.create(Document, {
            entityType: 'CONTRACT',
            entityId: contract.id,
            fileName: fileName,
            filePath: `uploads/contracts/${file.filename}`,
            mimeType: file?.mimetype || 'application/pdf',
            fileSize: file?.size || 0,
            createdBy: Number(userId),
          });
          await manager.save(Document, contractDocRecord);
        }

        // 2. Link ke Tender/SPK untuk audit trail dan repository dokumen tender
        const docRecord = manager.create(Document, {
          entityType: 'SPK',
          entityId: tenderId,
          fileName: fileName,
          filePath: `uploads/contracts/${file.filename}`,
          mimeType: file?.mimetype || 'application/pdf',
          fileSize: file?.size || 0,
          createdBy: Number(userId),
        });
        await manager.save(Document, docRecord);

        const auditLog = manager.create(AuditLog, {
          table_name: 'contracts',
          record_id: contract?.id || tenderId,
          action: isRevisionUpload ? 'REVISED_SPK_UPLOADED' : 'SPK_UPLOADED',
          old_value: existingContract ? { status: existingContract.status, spk_file_url: existingContract.spk_file_url } : null,
          new_value: {
            tender_id: tenderId,
            contract_id: contract?.id,
            spk_file_url: publicUrl,
            file_name: fileName,
            is_revision: isRevisionUpload,
          },
          created_by: userId,
        });
        await manager.save(AuditLog, auditLog);

        return {
          contract,
          updatedTender,
          isRevisionUpload,
          fileName,
          diskFileName,
        };
      });

      // 5. EVENT EMISSION ONLY AFTER SUCCESSFUL DATABASE COMMIT
      const { contract, updatedTender, isRevisionUpload, fileName } = txResult;

      const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
      const userName = user ? user.fullName : 'System';
      const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Marketing'})` : 'System';

      try {
        if (isRevisionUpload) {
          // Dedicated notification for revised SPK upload
          const tenderTitle = updatedTender?.title || `Tender ID: ${tenderId}`;
          this.eventEmitter.emit('notification.send', {
            title: 'Dokumen Revisi SPK Diunggah',
            message: `Dokumen revisi SPK untuk tender "${tenderTitle}" telah diunggah dan siap direview kembali oleh tim Legal.`,
            type: 'TASK',
            audience: 'LEGAL',
            tenderId: tenderId,
            metaData: {
              category: 'LEGAL',
              priority: 'HIGH',
              reference_type: 'CONTRACT',
              reference_id: contract?.id,
              contractId: contract?.id,
              tender_id: tenderId,
              action_type: 'REVISED_SPK_UPLOADED',
              action_buttons: ['REVIEW_REVISION'],
              actionLink: '/legal/review?tab=REVISION'
            }
          });
        } else {
          this.eventEmitter.emit('marketing.tender.won', {
            tenderId: tenderId,
            contractId: contract?.id,
            title: updatedTender?.title || `Tender ID: ${tenderId}`,
            estimatedBudget: updatedTender?.estimated_budget,
          });
        }

        this.eventEmitter.emit('marketing.tender.management_update', {
          tenderId: updatedTender?.id || tenderId,
          title: updatedTender?.title,
          customerName: updatedTender?.customer?.name || 'Unknown',
          customerId: updatedTender?.customer_id,
          estimatedBudget: updatedTender?.estimated_budget,
          stage: updatedTender?.stage || TenderStage.WON,
          status: updatedTender?.status || TenderStatus.WON,
          priority: updatedTender?.priority || 'MEDIUM',
          go_nogo_status: updatedTender?.go_nogo_status || 'GO',
          marketingPicName: userName,
          bidSubmissionDeadline: updatedTender?.bid_submission_deadline,
          spkFileKey: `contracts/${file.filename}`,
          graceDeadline: updatedTender?.grace_deadline,
          updatedBy: userStr,
          updaterId: userId,
          action: 'SPK_UPLOADED',
          timestamp: new Date().toISOString(),
        });

        // Panggil helper sinkronisasi queue legal
        emitLegalQueueUpdated(this.eventEmitter, {
          tenderId,
          action: 'SPK_UPLOADED'
        });
      } catch (eventErr) {
        console.error(`[Event Error] Failed to emit events for tender ${tenderId}:`, eventErr);
      }

      return {
        success: true,
        message: 'SPK berhasil diupload dan tender difinalisasi',
        url: publicUrl,
        contractId: contract?.id
      };
    } catch (error: any) {
      console.error('========================================');
      console.error('[UPLOAD ERROR] Transaction failed:');
      console.error('Pesan:', error?.message);
      console.error('========================================');

      // Clean up newly uploaded physical file on transaction failure / rollback
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
          console.log(`[CLEANUP] Deleted uploaded file on error: ${uploadedFilePath}`);
        } catch (unlinkErr) {
          console.error(`Failed to delete file on rollback: ${uploadedFilePath}`, unlinkErr);
        }
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: error?.message || 'Terjadi kesalahan pada server saat memproses unggah SPK',
          detail: error?.stack || 'Tidak ada stack trace'
        },
        500
      );
    }
  }

  async getContractFilePath(filename: string, userId?: number, roles?: string[]): Promise<string> {
    const safeFilename = path.basename(filename);
    const contractsDir = path.join(process.cwd(), 'uploads', 'contracts');

    let resolvedDiskFilename: string | null = null;
    let resolvedTenderId: number | null = null;

    // 1. If safeFilename exists directly in uploads/contracts/
    const directPath = path.join(contractsDir, safeFilename);
    if (fs.existsSync(directPath)) {
      resolvedDiskFilename = safeFilename;
    }

    // 2. If not found directly, attempt to resolve through documents table (for historical activities with originalName)
    if (!resolvedDiskFilename) {
      try {
        const documentRepo = this.dataSource.getRepository(Document);
        const doc = await documentRepo
          .createQueryBuilder('doc')
          .where('doc.entity_type = :entityType', { entityType: 'SPK' })
          .andWhere('(doc.file_name = :filename OR doc.file_path LIKE :filenamePattern)', {
            filename: safeFilename,
            filenamePattern: `%${safeFilename}%`,
          })
          .orderBy('doc.id', 'DESC')
          .getOne();

        if (doc && doc.filePath) {
          const candidateDiskName = path.basename(doc.filePath);
          if (fs.existsSync(path.join(contractsDir, candidateDiskName))) {
            resolvedDiskFilename = candidateDiskName;
            resolvedTenderId = doc.entityId ? Number(doc.entityId) : null;
          }
        }
      } catch (docErr) {
        // Fallback continues
      }
    }

    // 3. Fallback to contracts table lookup
    if (!resolvedDiskFilename) {
      try {
        const contract = await this.contractRepo
          .createQueryBuilder('contract')
          .leftJoinAndSelect('contract.proposal', 'proposal')
          .where('contract.spk_file_url LIKE :filename', { filename: `%${safeFilename}%` })
          .getOne();

        if (contract && contract.spk_file_url) {
          const candidateDiskName = path.basename(contract.spk_file_url);
          if (fs.existsSync(path.join(contractsDir, candidateDiskName))) {
            resolvedDiskFilename = candidateDiskName;
            resolvedTenderId = Number(contract.tender_id || contract.proposal?.tender_id);
          }
        }
      } catch (contractErr) {
        // Fallback continues
      }
    }

    // 4. Fallback to tenders table lookup (spk_file_key)
    if (!resolvedDiskFilename) {
      try {
        const tender = await this.tenderRepo
          .createQueryBuilder('tender')
          .where('tender.spk_file_key LIKE :filename', { filename: `%${safeFilename}%` })
          .getOne();

        if (tender && tender.spk_file_key) {
          const candidateDiskName = path.basename(tender.spk_file_key);
          if (fs.existsSync(path.join(contractsDir, candidateDiskName))) {
            resolvedDiskFilename = candidateDiskName;
            resolvedTenderId = Number(tender.id);
          }
        }
      } catch (tenderErr) {
        // Fallback continues
      }
    }

    if (!resolvedDiskFilename) {
      throw new NotFoundException('SPK document not found');
    }

    const finalFilePath = path.join(contractsDir, resolvedDiskFilename);

    // 5. Management Bypass Check (R3.6.2 preserved)
    const isManagement = roles?.some(r => ['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER'].includes(r));
    if (isManagement) {
      return finalFilePath;
    }

    // 6. Resolve Tender for Resource Ownership Check (if not already resolved)
    let tender: Tender | null = null;
    if (resolvedTenderId) {
      tender = await this.tenderRepo.findOne({ where: { id: resolvedTenderId } });
    }

    if (!tender) {
      const contract = await this.contractRepo
        .createQueryBuilder('contract')
        .leftJoinAndSelect('contract.proposal', 'proposal')
        .where('contract.spk_file_url LIKE :filename', { filename: `%${resolvedDiskFilename}%` })
        .getOne();

      const tId = contract?.tender_id || contract?.proposal?.tender_id;
      if (tId) {
        tender = await this.tenderRepo.findOne({ where: { id: Number(tId) } });
      }
    }

    if (!tender) {
      tender = await this.tenderRepo
        .createQueryBuilder('tender')
        .where('tender.spk_file_key LIKE :filename', { filename: `%${resolvedDiskFilename}%` })
        .getOne();
    }

    if (!tender) {
      throw new NotFoundException('SPK document not found or access denied');
    }

    // 7. Ownership Validation (R3.6.2 preserved)
    const normalizedUserId = Number(userId);
    const normalizedPicId = tender.marketing_pic_id ? Number(tender.marketing_pic_id) : null;
    const normalizedCreatedBy = tender.created_by ? Number(tender.created_by) : null;

    const isPicOrCreator =
      (normalizedPicId !== null && normalizedPicId === normalizedUserId) ||
      (!normalizedPicId && normalizedCreatedBy !== null && normalizedCreatedBy === normalizedUserId);

    if (!isPicOrCreator) {
      throw new NotFoundException('SPK document not found or access denied');
    }

    return finalFilePath;
  }
}


