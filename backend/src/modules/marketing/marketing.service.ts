import { Injectable, NotFoundException, BadRequestException, ConflictException, HttpException, Inject, Optional, forwardRef, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Customer } from '../../entities/customer.entity';
import { Tender, TenderStatus } from '../../entities/tender.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { Document } from '../../entities/document.entity';
import { TenderActivity, ActivityType } from '../../entities/tender-activity.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateTenderDto, UpdateTenderStatusDto } from './dto/create-tender.dto';
import { TenderDetailResponseDto } from './dto/tender-detail-response.dto';
import { CreateTenderActivityDto } from './dto/tender-activity.dto';
import { TenderPriceHistory } from '../../entities/tender-price-history.entity';
import { emitLegalQueueUpdated } from '../../shared/helpers/legal-event.helper';

@Injectable()
export class MarketingService implements OnModuleInit {
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

  async onModuleInit() {
    await this.ensureContractTableSchema();
  }

  /**
   * HOTFIX: Pastikan semua kolom tabel contracts ada.
   * Menggunakan INFORMATION_SCHEMA agar kompatibel dengan semua versi MySQL/MariaDB.
   */
  private async ensureContractTableSchema() {
    const DB_NAME = process.env.DATABASE_NAME || 'epms_tvmubd_db';

    const requiredColumns: Array<{ name: string; definition: string }> = [
      { name: 'tender_id',       definition: 'BIGINT NULL' },
      { name: 'spk_file_url',    definition: 'VARCHAR(1000) NULL' },
      { name: 'status',          definition: "VARCHAR(50) NULL DEFAULT 'PENDING_LEGAL_REVIEW'" },
      { name: 'legal_status',    definition: 'VARCHAR(50) NULL' },
      { name: 'contract_number', definition: 'VARCHAR(100) NULL' },
      { name: 'proposal_id',     definition: 'BIGINT NULL' },
    ];

    console.log('🔧 [SCHEMA HOTFIX] Memastikan skema tabel contracts...');

    for (const col of requiredColumns) {
      try {
        const rows: any[] = await this.contractRepo.query(
          `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'contracts' AND COLUMN_NAME = ?`,
          [DB_NAME, col.name]
        );
        const exists = Number(rows?.[0]?.cnt) > 0;

        if (!exists) {
          await this.contractRepo.query(
            `ALTER TABLE contracts ADD COLUMN ${col.name} ${col.definition}`
          );
          console.log(`✅ [SCHEMA HOTFIX] Kolom contracts.${col.name} DITAMBAHKAN`);
        } else {
          console.log(`ℹ️  [SCHEMA HOTFIX] Kolom contracts.${col.name} sudah ada`);
        }
      } catch (e: any) {
        console.error(`❌ [SCHEMA HOTFIX] Gagal cek/tambah kolom contracts.${col.name}:`, e?.message);
      }
    }

    console.log('✅ [SCHEMA HOTFIX] Skema tabel contracts SELESAI diverifikasi!');
  }

  private calculateProbabilityPercentage(stage: string, status: string): number {
    if (status === TenderStatus.WON || stage?.toUpperCase() === 'WON') return 100;
    if (status === TenderStatus.LOST || stage?.toUpperCase() === 'LOST') return 0;

    switch (stage?.toUpperCase()) {
      case 'LEAD': return 10;
      case 'QUALIFICATION': return 30;
      case 'PROPOSAL': return 60;
      case 'NEGOTIATION': return 80;
      default: return 0;
    }
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
    const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Marketing'})` : 'System';

    // 5. Force stage to LEAD
    const finalStage = 'LEAD';

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
      estimatedBudget: savedTender.estimated_budget,
      stage: savedTender.stage,
      updatedBy: userStr,
      action: 'CREATED'
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
        query = query.where('tender.marketing_pic_id = :userId', { userId });
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
          legal_reviewer_name: reviewerName,
          reviewerName: reviewerName,
          legal_sla_deadline: slaDeadline,
          slaDeadline: slaDeadline,
          legal_notes: matchedContract?.legal_notes,
        };
      });
    } catch (e: any) {
      console.error('Error fetching tenders:', e);
      return [];
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
          if (entity.marketing_pic_id !== userId) {
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
        query.andWhere('tender.marketing_pic_id = :userId', { userId });
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
    let qualificationCount = 0;
    let proposalCount = 0;
    let lostCount = 0;

    for (const t of tenders) {
      const statusUpper = (t.status || '').toUpperCase();
      const stageUpper = (t.stage || '').toUpperCase();
      const budget = Number(t.estimated_budget) || 0;

      if (statusUpper === TenderStatus.WON || stageUpper === 'WON') {
        wonTenders++;
        wonRevenue += budget;
      } else if (statusUpper === TenderStatus.LOST || stageUpper === 'LOST') {
        lostCount++;
      } else {
        // Active Pipeline ONLY sums deals that are still active (Excludes WON and LOST)
        totalPipeline += budget;
      }

      if (stageUpper === 'LEAD') leadCount++;
      else if (stageUpper === 'QUALIFICATION') qualificationCount++;
      else if (stageUpper === 'PROPOSAL') proposalCount++;
      else if (stageUpper === 'NEGOTIATION') negotiationCount++;
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
      stageBreakdown: {
        lead: leadCount,
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

    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
    const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Marketing'})` : 'System';

    if (dto.projectName !== undefined) tender.title = dto.projectName;
    if (dto.estimatedBudget !== undefined) tender.estimated_budget = dto.estimatedBudget;
    if (dto.priority !== undefined) tender.priority = dto.priority;
    if (dto.source !== undefined) tender.source = dto.source;
    if (dto.projectLocation !== undefined) tender.project_location = dto.projectLocation;
    if (dto.picCustomerName !== undefined) tender.pic_customer_name = dto.picCustomerName;
    if (dto.picCustomerPhone !== undefined) tender.pic_customer_phone = dto.picCustomerPhone;
    if (dto.notes !== undefined) tender.notes = dto.notes;
    if (dto.bidSubmissionDeadline !== undefined) tender.bid_submission_deadline = dto.bidSubmissionDeadline;

    tender.updated_by = userId;

    await this.tenderRepo.save(tender);

    this.eventEmitter.emit('marketing.tender.management_update', {
      tenderId: tender.id,
      title: tender.title,
      customerName: tender.customer?.name || 'Unknown',
      estimatedBudget: tender.estimated_budget,
      stage: tender.stage,
      updatedBy: userStr,
      updaterId: userId,
      action: 'UPDATED',
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

      const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId }, relations: ['roles'] });
      const userStr = user ? `${user.fullName} (${user.roles[0]?.name || 'Marketing'})` : 'System';

      const upperStage = dto.stage ? dto.stage.toUpperCase() : '';

      if (upperStage === 'WON') {
        tender.stage = 'WON';
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

        const dateString = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const proposal = queryRunner.manager.create(Proposal, {
          tender_id: tender.id,
          proposal_number: `PROP-${dateString}-${Date.now().toString().slice(-4)}`,
          proposed_amount: tender.estimated_budget || 0,
          status: 'ACCEPTED', // or SUBMITTED depending on workflow
          created_by: userId,
        });
        await queryRunner.manager.save(Proposal, proposal);

        // [PHASE 3 - ALTERNATIF A (Strict PRD Flow)]
        // Contract creation is DEFERRED until the SPK file is explicitly uploaded via `saveSPKAndUpdateContract`.
        // This prevents the creation of "Placeholder Contracts" that clutter the system and legal review queues.
        // We only create the Proposal here.


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
          updatedBy: userStr,
          updaterId: userId,
          action: 'MARKED_WON'
        });

        return { message: 'Tender marked as WON successfully', tender, proposal };
      } else if (upperStage === 'LOST') {
        tender.stage = 'LOST';
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

        await queryRunner.commitTransaction();

        this.eventEmitter.emit('marketing.tender.management_update', {
          tenderId: tender.id,
          title: tender.title,
          customerName: tender.customer?.name || 'Unknown',
          estimatedBudget: tender.estimated_budget,
          stage: tender.stage,
          updatedBy: userStr,
          updaterId: userId,
          action: 'MARKED_LOST'
        });

        return { message: 'Tender marked as LOST successfully', tender };
      } else {
        const oldStage = tender.stage;
        tender.stage = dto.stage;

        // If tender was WON, ONLY Admin or Director can move it out of WON stage
        if (tender.status === TenderStatus.WON) {
          const effectiveUserId = userId || 1;
          const dbUser = await queryRunner.manager.getRepository(User).findOne({ where: { id: effectiveUserId }, relations: ['roles'] });
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

        if (oldStage !== dto.stage) {
          const activity = queryRunner.manager.create(TenderActivity, {
            tender_id: tender.id,
            user_id: userId,
            type: ActivityType.SYSTEM,
            content: `Tender stage changed from ${oldStage} to ${dto.stage}`,
          });
          await queryRunner.manager.save(TenderActivity, activity);
        }

        await queryRunner.commitTransaction();

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
      action: 'NEW_ACTIVITY'
    });

    return saved;
  }
  async uploadProposal(tenderId: number, file: Express.Multer.File, userId: number) {
    const tender = await this.tenderRepo.findOne({
      where: { id: tenderId },
      relations: ['customer']
    });

    if (!tender) {
      throw new NotFoundException('Tender not found');
    }

    // Perbarui stage ke PROPOSAL
    tender.stage = 'PROPOSAL';
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
      createdBy: userId || 1,
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
      updatedBy: userStr,
      action: 'PROPOSAL_UPLOADED'
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

    // Combine roles from JWT token and Database for strict privilege verification
    const effectiveUserId = userId || 1;
    const dbUser = await this.dataSource.getRepository(User).findOne({ where: { id: effectiveUserId }, relations: ['roles'] });
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

    if (discountPercentage > maxDiscount) {
      tender.status = TenderStatus.PENDING_APPROVAL as any;
      // Trigger Approval Workflow (Auto-Escalate mechanism handled by Scheduler)
      this.eventEmitter.emit('notification.send', {
        title: '⚠️ Peringatan Diskon Kritis',
        message: `Tender ${tender.title} mengajukan diskon ${discountPercentage.toFixed(2)}% (Batas: ${maxDiscount}%). Menunggu persetujuan Direktur.`,
        type: 'WARNING',
        audience: 'ALL', // Director
      });
    }

    tender.negotiated_price = newPrice;
    tender.updated_at = new Date(); // Reset timestamp for scheduler 2 hours timeout
    await this.tenderRepo.save(tender);

    const history = this.priceHistoryRepo.create({
      tender_id: tender.id,
      old_price: oldPrice,
      new_price: newPrice,
      changed_by: userId,
      reason: dto.reason || (discountPercentage > maxDiscount ? 'Diskon melebihi batas - Menunggu approval' : 'Negosiasi Harga'),
    });
    await this.priceHistoryRepo.save(history);

    return { status: 'success', message: 'Harga negosiasi berhasil diperbarui', discount_percentage: discountPercentage };
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
    const tender = await this.tenderRepo.findOne({ where: { id } });
    if (!tender) throw new NotFoundException('Tender tidak ditemukan');

    tender.spk_verification_status = dto.is_valid ? 'VERIFIED' : 'REJECTED';
    if (!dto.is_valid) {
      tender.status = TenderStatus.IN_PROGRESS; // Kembalikan ke IN_PROGRESS / REVISION
    }
    await this.tenderRepo.save(tender);

    if (dto.is_valid) {
      this.eventEmitter.emit('contract.generate', {
        tenderId: tender.id,
        userId: userId,
      });

      this.eventEmitter.emit('notification.send', {
        title: 'Clearance Legal Selesai ✅',
        message: `Kontrak Legal Selesai. Proyek ${tender.title} siap dikerjakan oleh Project Operational!`,
        type: 'SUCCESS',
        audience: 'ALL', // Ideally 'PROJECT_OPS'
      });
    } else {
      this.eventEmitter.emit('notification.send', {
        title: 'Revisi Legal SPK ❌',
        message: `SPK Tender ${tender.title} DITOLAK oleh Legal. Catatan: ${dto.notes}`,
        type: 'ERROR',
        audience: 'ALL', // Ideally 'MARKETING'
      });
    }

    return { status: 'success', message: 'Verifikasi SPK berhasil dicatat' };
  }

  async setGracePeriod(id: number, userId: number) {
    const tender = await this.tenderRepo.findOne({ where: { id } });
    if (!tender) throw new NotFoundException('Tender tidak ditemukan');

    tender.status = TenderStatus.WON;
    tender.stage = 'WON';
    // Aturan 1: Backend mengatur grace_deadline mutlak NOW() + 48 jam
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 48);
    tender.grace_deadline = deadline;
    tender.spk_file_key = null;

    await this.tenderRepo.save(tender);

    return { status: 'success', message: 'Grace period SPK diaktifkan 2x24 jam', tender };
  }

  async deleteTender(id: number, userId: number) {
    const tender = await this.tenderRepo.findOne({ where: { id } });
    if (!tender) {
      throw new NotFoundException(`Tender #${id} tidak ditemukan.`);
    }

    await this.dataSource.transaction(async (manager) => {
      // 1. Soft delete Tender
      await manager.softDelete(Tender, id);

      // 2. Soft delete Proposal associated with Tender
      await manager.softDelete(Proposal, { tender_id: id });

      // 3. Soft delete Contract associated with Tender directly OR via Proposal
      await manager
        .createQueryBuilder()
        .update(Contract)
        .set({ deleted_at: new Date() })
        .where('tender_id = :tenderId', { tenderId: id })
        .orWhere('proposal_id IN (SELECT id FROM proposals WHERE tender_id = :tenderId)', { tenderId: id })
        .execute();
    });

    try {
      emitLegalQueueUpdated(this.eventEmitter, {
        type: 'TENDER_DELETED',
        tenderId: id,
      });
    } catch (eventErr) {
      console.error(`[Event Error] Failed to emit legal.queue.updated for tender ${id}:`, eventErr);
    }

    return {
      status: 'success',
      message: `Tender #${id} ("${tender.title}") berhasil dihapus beserta seluruh data terkait (Cascade Soft Delete).`
    };
  }

  /**
   * SAVE SPK FILE & UPDATE CONTRACT.SPK_FILE_URL
   * Dipanggil setelah file SPK berhasil disimpan ke disk storage.
   * Mencari contract yang terkait dengan tender ini dan mengupdate spk_file_url.
   */
  /**
   * 🔥 [NUKLIR] SAVE SPK FILE & UPDATE CONTRACT VIA QUERY BUILDER
   */
  async saveSPKAndUpdateContract(tenderIdParam: any, file: Express.Multer.File, publicUrlParam: string, userId: number) {
    try {
      const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
      let publicUrl = publicUrlParam;
      if (file?.filename) {
        publicUrl = `${baseUrl}/uploads/contracts/${file.filename}`;
      } else if (publicUrlParam && !publicUrlParam.startsWith('http')) {
        publicUrl = `${baseUrl}${publicUrlParam.startsWith('/') ? '' : '/'}${publicUrlParam}`;
      }

      console.log('📄 [UPLOAD] Menyimpan URL SPK:', publicUrl);
      console.log('🔥 [NUKLIR] Upload dimulai untuk tender ID:', tenderIdParam);
      console.log('📌 [NUKLIR] URL Absolut SPK:', publicUrl);


      // Pastikan semua kolom ada (INFORMATION_SCHEMA-based, bullet-proof)
      await this.ensureContractTableSchema();

      // 1. PASTIKAN ID ADALAH NUMBER (BigInt / Integer)
      const tenderId = typeof tenderIdParam === 'number' ? tenderIdParam : parseInt(String(tenderIdParam), 10);
      if (isNaN(tenderId) || tenderId <= 0) {
        throw new Error(`ID Tender tidak valid: ${tenderIdParam}`);
      }
      console.log('✅ [NUKLIR] ID Tender valid (Number):', tenderId);
      console.log('✅ [NUKLIR] URL Absolut disimpan:', publicUrl);

      // 2. CEK APAKAH CONTRACT SUDAH ADA (MULTI-LEVEL SEARCH: tender_id ATAU proposal.tender_id)
      const proposalRepo = this.dataSource.getRepository(Proposal);
      let proposal = await proposalRepo.findOne({ where: { tender_id: tenderId } });

      let existingContract = await this.contractRepo
        .createQueryBuilder('contract')
        .where('contract.tender_id = :tenderId', { tenderId })
        .orWhere('contract.proposal_id IN (SELECT id FROM proposals WHERE tender_id = :tenderId)', { tenderId })
        .getOne();

      console.log('📦 [NUKLIR] Contract existing found?', !!existingContract);

      // 3. AMBIL ESTIMATED BUDGET DAN CUSTOMER ID DARI TENDERS
      const [tenderRow] = await this.contractRepo.query(
        `SELECT customer_id, estimated_budget FROM tenders WHERE id = ? LIMIT 1`,
        [tenderId]
      );
      const realCustomerId = tenderRow?.customer_id;
      const estBudget = tenderRow?.estimated_budget || 0;

      let contract: any;
      if (existingContract) {
        // UPDATE ALL MATCHING CONTRACTS via raw SQL (isi tender_id, customer_id dari tender, & update spk_file_url)
        if (realCustomerId) {
          await this.contractRepo.query(
            `UPDATE contracts 
             SET spk_file_url = ?, tender_id = ?, customer_id = ?, status = 'PENDING_LEGAL_REVIEW', legal_status = 'DRAFT',
                 contract_value = IF(contract_value = 0, ?, contract_value)
             WHERE tender_id = ? OR proposal_id IN (SELECT id FROM proposals WHERE tender_id = ?)`,
            [publicUrl, tenderId, realCustomerId, estBudget, tenderId, tenderId]
          );
        } else {
          await this.contractRepo.query(
            `UPDATE contracts 
             SET spk_file_url = ?, tender_id = ?, status = 'PENDING_LEGAL_REVIEW', legal_status = 'DRAFT',
                 contract_value = IF(contract_value = 0, ?, contract_value)
             WHERE tender_id = ? OR proposal_id IN (SELECT id FROM proposals WHERE tender_id = ?)`,
            [publicUrl, tenderId, estBudget, tenderId, tenderId]
          );
        }
        contract = existingContract;
        console.log('✅ [NUKLIR] Contract existing diupdate via raw SQL, tender_id, customer_id & spk_file_url terisi');
      } else {
        // BUAT BARU JIKA BENAR-BENAR BELUM ADA
        if (!proposal) {
          proposal = proposalRepo.create({
            tender_id: tenderId,
            proposal_number: `PROP-${Date.now()}`,
            proposed_amount: estBudget,
            status: 'ACCEPTED',
            created_by: userId,
          });
          await proposalRepo.save(proposal);
        }

        if (!realCustomerId) {
          throw new Error(`Tender ID ${tenderId} tidak memiliki customer_id valid.`);
        }

        const insertResult = await this.contractRepo.query(
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

        await this.contractRepo.query(
          `UPDATE contracts SET contract_number = ? WHERE id = ?`,
          [finalContractNumber, newId]
        );

        contract = { id: newId, contract_number: finalContractNumber };
        console.log(`✅ [NUKLIR] Contract baru (ID #${newId}) dibuat dengan nomor: ${finalContractNumber}`);
      }



      // 3. UPDATE STATUS TENDER MENJADI WON (PAKAI QUERY BUILDER)
      await this.tenderRepo
        .createQueryBuilder()
        .update(Tender)
        .set({
          stage: 'WON',
          spk_file_key: `contracts/${file.filename}`,
          spk_verification_status: 'PENDING_REVIEW'
        })
        .where('id = :tenderId', { tenderId })
        .execute();

      console.log('✅ [NUKLIR] Status Tender berhasil diupdate ke WON');

      try {
        this.eventEmitter.emit('marketing.tender.won', {
          tenderId: tenderId,
          contractId: contract?.id,
          title: `Tender ID: ${tenderId}`,
        });

        // Panggil helper sinkronisasi queue legal
        emitLegalQueueUpdated(this.eventEmitter, {
          tenderId,
          action: 'SPK_UPLOADED'
        });
      } catch (eventErr) {
        console.error(`[Event Error] Failed to emit marketing.tender.won for tender ${tenderId}:`, eventErr);
      }

      return {
        success: true,
        message: 'SPK berhasil diupload dan tender difinalisasi',
        url: publicUrl,
        contractId: contract?.id
      };
    } catch (error: any) {
      console.error('========================================');
      console.error('💀 [NUKLIR] ERROR TOTAL - CEK INI:');
      console.error('Pesan:', error?.message);
      console.error('Stack:', error?.stack);
      console.error('========================================');

      throw new HttpException(
        {
          status: 'error',
          message: error?.message || 'Terjadi kesalahan pada server',
          detail: error?.stack || 'Tidak ada stack trace'
        },
        500
      );
    }
  }
}

