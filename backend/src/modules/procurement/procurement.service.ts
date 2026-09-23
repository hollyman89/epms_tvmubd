import { Injectable, BadRequestException, Logger, Inject, HttpException, HttpStatus, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Rfq } from '../../entities/rfq.entity';
import { Vendor } from '../../entities/vendor.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { PoPaymentTerm, PaymentTermType, PaymentTermStatus } from '../../entities/po-payment-term.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../../entities/goods-receipt-item.entity';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationItem } from '../../entities/quotation-item.entity';
import { randomUUID } from 'crypto';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';
import { CreatePurchaseRequestDto } from './dto/create-pr.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { CreateGoodsReceiptDto } from './dto/create-gr.dto';
import { CreateVendorDto, UpdateVendorDto, VendorQueryDto } from './dto/vendor.dto';

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    @InjectRepository(PurchaseRequest)
    private prRepo: Repository<PurchaseRequest>,
    @InjectRepository(Rfq)
    private rfqRepo: Repository<Rfq>,
    @InjectRepository(Vendor)
    private vendorRepo: Repository<Vendor>,
    @InjectRepository(Quotation)
    private quotationRepo: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private quotationItemRepo: Repository<QuotationItem>,
    @InjectRepository(VendorComparison)
    private vendorComparisonRepo: Repository<VendorComparison>,
    @InjectRepository(PurchaseOrder)
    private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(GoodsReceipt)
    private grRepo: Repository<GoodsReceipt>,
    private readonly workflowService: WorkflowService,
    private readonly workflowEngineService: WorkflowEngineService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createAndSubmitPurchaseRequest(userId: number, dto: CreatePurchaseRequestDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate PR Number: PR-YYYYMMDD-SEQ
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await queryRunner.manager.count(PurchaseRequest, {
        where: { prNumber: require('typeorm').Like(`PR-${dateStr}-%`) }
      });
      const seq = String(countToday + 1).padStart(3, '0');
      const prNumber = `PR-${dateStr}-${seq}`;

      // Enforce Project IN_PROGRESS Guard & Block Direct PR
      const projectRes = await queryRunner.manager.query(
        `SELECT status FROM projects WHERE id = ? FOR SHARE`,
        [dto.projectId]
      );
      if (!projectRes || projectRes.length === 0) {
        throw new BadRequestException(`Project #${dto.projectId} tidak ditemukan`);
      }
      if (projectRes[0].status === 'IN_PROGRESS') {
        throw new BadRequestException(
          'Pembuatan Purchase Request langsung tidak diizinkan untuk proyek IN_PROGRESS. Seluruh pengadaan proyek wajib melalui Paket Pengadaan (Procurement Package).',
        );
      }
      if (projectRes[0].status !== 'IN_PROGRESS') {
        throw new BadRequestException(
          `Purchase Request hanya dapat dibuat untuk proyek yang berstatus IN_PROGRESS. Status saat ini: ${projectRes[0].status}`
        );
      }

      // WBS Budget Validation Check
      const wbsId = (dto as any).wbsId;
      if (wbsId) {
        const wbsRes = await queryRunner.manager.query(
          `SELECT budget_allocation, task_name FROM work_breakdown_structures WHERE id = ? FOR UPDATE`,
          [wbsId]
        );
        if (wbsRes && wbsRes.length > 0) {
          const budgetAllocation = Number(wbsRes[0].budget_allocation || 0);
          const poSpentRes = await queryRunner.manager.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS spent 
             FROM purchase_orders 
             WHERE wbs_id = ? AND status IN ('APPROVED', 'IN_PROGRESS')`,
            [wbsId]
          );
          const spent = Number(poSpentRes[0].spent || 0);
          const requested = Number(dto.totalEstimatedAmount || 0);

          if (spent + requested > budgetAllocation && budgetAllocation > 0) {
            const remaining = Math.max(0, budgetAllocation - spent);
            throw new BadRequestException(
              `Alokasi Anggaran WBS '${wbsRes[0].task_name}' Terlampaui! Sisa anggaran: Rp ${remaining.toLocaleString('id-ID')}, Pengajuan: Rp ${requested.toLocaleString('id-ID')}`
            );
          }
        }
      }

      // 1. Create PR
      const pr = queryRunner.manager.create(PurchaseRequest, {
        projectId: dto.projectId,
        requesterId: userId,
        prNumber: prNumber,
        totalEstimatedAmount: dto.totalEstimatedAmount,
        status: 'SUBMITTED', // Set status to SUBMITTED
        origin: 'AD_HOC', // Explicit origin discriminator for direct PR
      });
      const savedPr = await queryRunner.manager.save(pr);

      // 2. Save PR Items
      const items = dto.items.map(itemDto => queryRunner.manager.create(PurchaseRequestItem, {
        prId: savedPr.id,
        itemName: itemDto.itemName,
        quantity: itemDto.quantity,
        estimatedUnitPrice: itemDto.estimatedUnitPrice,
      }));
      await queryRunner.manager.save(items);

      // Canonical AuditLog: PR SUBMIT
      const prAudit = queryRunner.manager.create(AuditLog, {
        table_name: 'purchase_requests',
        record_id: savedPr.id,
        action: 'SUBMIT',
        old_value: null,
        new_value: {
          prNumber: savedPr.prNumber,
          projectId: savedPr.projectId,
          totalEstimatedAmount: Number(savedPr.totalEstimatedAmount),
          status: 'SUBMITTED',
          itemsCount: items.length,
        },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, prAudit);

      await queryRunner.commitTransaction();

      this.logger.log(`PR ${savedPr.id} (${prNumber}) created and submitted. Delegating to Workflow Engine.`);
      
      // 3. Start Canonical Workflow Instance
      await this.workflowEngineService.startInstance(
        {
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: savedPr.id,
          context: {
            totalEstimatedAmount: savedPr.totalEstimatedAmount,
            initiatorUserId: userId,
          },
        },
        userId,
      );
      this.logger.log(`Canonical PURCHASE_REQUEST_WORKFLOW started for PR ${savedPr.id}`);
      
      return {
        success: true,
        message: 'Purchase Request created and submitted successfully',
        data: savedPr
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating PR: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validasi Anggaran WBS & PO Spent
   * Ambil budget dari tabel work_breakdown_structures berdasarkan wbsId
   * Hitung sisa_budget = budget - spent
   * Jika requestedAmount > sisa_budget, lempar HttpException(400, 'Sisa anggaran WBS tidak mencukupi')
   */
  async validateWbsBudget(wbsId: number, requestedAmount: number, manager?: any): Promise<boolean> {
    if (!wbsId) return true;

    const queryManager = manager || this.dataSource.manager;

    // 1. Ambil budget dari tabel work_breakdown_structures berdasarkan wbsId
    const wbsRes = await queryManager.query(
      `SELECT budget_allocation, task_name FROM work_breakdown_structures WHERE id = ? FOR UPDATE`,
      [wbsId]
    );

    if (!wbsRes || wbsRes.length === 0) {
      // Tidak ada WBS
      return true;
    }

    const budget = Number(wbsRes[0].budget_allocation || 0);

    // 2. Hitung spent dari purchase_orders
    const poSpentRes = await queryManager.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS spent 
       FROM purchase_orders 
       WHERE wbs_id = ? AND status IN ('APPROVED', 'IN_PROGRESS')`,
      [wbsId]
    );

    const spent = Number(poSpentRes[0]?.spent || 0);

    // 3. Hitung sisa_budget = budget - spent
    const sisaBudget = budget - spent;

    // 4. Jika requestedAmount > sisaBudget, lempar HttpException 400
    if (requestedAmount > sisaBudget && budget > 0) {
      throw new HttpException(
        `Sisa anggaran WBS tidak mencukupi (Tersedia: Rp ${Math.max(0, sisaBudget).toLocaleString('id-ID')}, Pengajuan: Rp ${requestedAmount.toLocaleString('id-ID')})`,
        HttpStatus.BAD_REQUEST
      );
    }

    return true;
  }

  async createRfq(dto: CreateRfqDto, userId?: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Acquire row-level lock on the PR inside the transaction to prevent concurrent duplicate RFQs
      if (typeof queryRunner.manager.query === 'function') {
        await queryRunner.manager.query(
          `SELECT id FROM purchase_requests WHERE id = ? FOR UPDATE`,
          [dto.purchaseRequestId],
        );
      }

      // 2. Fetch PR with relations inside transaction
      let pr: PurchaseRequest | null = null;
      if (typeof queryRunner.manager.findOne === 'function') {
        pr = await queryRunner.manager.findOne(PurchaseRequest, {
          where: { id: dto.purchaseRequestId },
          relations: ['items', 'project'],
        });
      }
      if (!pr) {
        pr = await this.prRepo.findOne({
          where: { id: dto.purchaseRequestId },
          relations: ['items', 'project'],
        });
      }

      if (!pr) {
        throw new BadRequestException('Purchase Request tidak ditemukan');
      }

      // 3. Server-side PR APPROVED guard (Rule 1 & Rule 2)
      if (pr.status !== 'APPROVED') {
        throw new BadRequestException(
          `Hanya Purchase Request dengan status APPROVED yang dapat diterbitkan menjadi RFQ. Status saat ini: ${pr.status}`,
        );
      }

      // 4. Validate PR has a valid project relation (Requirement 1)
      const projectId = pr.projectId || pr.project?.id;
      if (!pr.project || !projectId) {
        throw new BadRequestException('Purchase Request tidak memiliki relasi project yang valid');
      }

      // 5. Atomic Duplicate Active RFQ Guard inside transaction (Requirement 2)
      let existingActiveRfq: Rfq | null = null;
      if (typeof queryRunner.manager.findOne === 'function') {
        existingActiveRfq = await queryRunner.manager.findOne(Rfq, {
          where: { prId: pr.id, status: 'OPEN' },
        });
      }
      if (!existingActiveRfq) {
        existingActiveRfq = await this.rfqRepo.findOne({
          where: { prId: pr.id, status: 'OPEN' },
        });
      }

      if (existingActiveRfq) {
        throw new BadRequestException(
          `Purchase Request #${pr.prNumber} sudah memiliki RFQ aktif (${existingActiveRfq.rfqNumber})`,
        );
      }

      // 6. Auto generate RFQ Number & Atomic Transaction Boundary (Rule 4)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await queryRunner.manager.count(Rfq, {
        where: { rfqNumber: Like(`RFQ-${dateStr}-%`) },
      });
      const seq = String(countToday + 1).padStart(3, '0');
      const rfqNumber = `RFQ-${dateStr}-${seq}`;

      const rfq = queryRunner.manager.create(Rfq, {
        prId: dto.purchaseRequestId,
        rfqNumber,
        status: 'OPEN',
        closingDate: dto.closingDate ? new Date(dto.closingDate) : null,
        createdBy: (userId || null) as any,
      });

      const savedRfq = await queryRunner.manager.save(Rfq, rfq);

      // 7. Canonical AuditLog: RFQ CREATE
      const rfqAudit = queryRunner.manager.create(AuditLog, {
        table_name: 'rfqs',
        record_id: savedRfq.id,
        action: 'CREATE',
        old_value: null,
        new_value: {
          rfqNumber: savedRfq.rfqNumber,
          prId: savedRfq.prId,
          status: 'OPEN',
          closingDate: savedRfq.closingDate ? savedRfq.closingDate.toISOString() : null,
        },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, rfqAudit);

      // Canonical Outbox: procurement.rfq.created
      const rfqEvent: BusinessEvent<{
        rfqId: number;
        rfqNumber: string;
        prId: number;
        projectId: number;
        status: string;
        closingDate: string | null;
        createdBy: number | null;
      }> = {
        eventId: randomUUID(),
        eventName: 'procurement.rfq.created',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Rfq',
        aggregateId: savedRfq.id,
        projectId: projectId ? Number(projectId) : undefined,
        actor: userId ? { userId: Number(userId) } : undefined,
        routing: undefined,
        notificationPolicy: undefined,
        payload: {
          rfqId: Number(savedRfq.id),
          rfqNumber: savedRfq.rfqNumber,
          prId: Number(savedRfq.prId),
          projectId: Number(projectId),
          status: savedRfq.status,
          closingDate: savedRfq.closingDate ? savedRfq.closingDate.toISOString() : null,
          createdBy: userId ? Number(userId) : null,
        },
      };

      const rfqOutbox = queryRunner.manager.create(OutboxEvent, {
        event_id: rfqEvent.eventId,
        event_name: rfqEvent.eventName,
        event_version: String(rfqEvent.eventVersion),
        aggregate_type: rfqEvent.aggregateType,
        aggregate_id: Number(rfqEvent.aggregateId),
        correlation_id: rfqEvent.correlationId || null,
        payload: {
          occurredAt: rfqEvent.occurredAt,
          projectId: rfqEvent.projectId,
          actor: rfqEvent.actor,
          routing: rfqEvent.routing,
          notificationPolicy: rfqEvent.notificationPolicy,
          businessPayload: rfqEvent.payload,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, rfqOutbox);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Request for Quotation berhasil diterbitkan',
        data: savedRfq,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating RFQ: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private formatRfqResponse(rfq: Rfq, comparisons?: VendorComparison[]) {
    let creatorObj: any = null;
    if (rfq.creator) {
      const primaryRole = rfq.creator.roles?.[0]?.name || (rfq.creator as any).role || 'PROCUREMENT';
      creatorObj = {
        id: rfq.creator.id,
        fullName: rfq.creator.fullName,
        email: rfq.creator.email,
        role: primaryRole,
      };
    }

    let comparisonObj: any = null;
    if (comparisons && comparisons.length > 0) {
      const winner = comparisons.find((c) => c.isWinner);
      if (winner) {
        const winnerQuote = rfq.quotations?.find((q: any) => Number(q.vendorId) === Number(winner.vendorId));
        comparisonObj = {
          comparisonId: String(winner.id),
          rfqId: rfq.id,
          rfqNumber: rfq.rfqNumber,
          prNumber: rfq.purchaseRequest?.prNumber,
          projectId: rfq.purchaseRequest?.projectId,
          projectName: rfq.purchaseRequest?.project?.name,
          budgetCeiling: Number(rfq.purchaseRequest?.totalEstimatedAmount || 0),
          selectedWinnerVendorId: winner.vendorId,
          selectedWinnerVendorCode: winner.vendor?.code || '',
          selectedWinnerVendorName: winner.vendor?.name || `Vendor #${winner.vendorId}`,
          winnerTotalOfferedAmount: Number(winner.offeredAmount),
          winnerLeadTimeDays: winnerQuote?.leadTimeDays != null ? Number(winnerQuote.leadTimeDays) : null,
          comparedAt: winner.createdAt ? new Date(winner.createdAt).toISOString() : new Date().toISOString(),
          status: 'EVALUATED' as const,
        };
      }
    }

    return {
      ...rfq,
      creator: creatorObj,
      comparison: comparisonObj,
    };
  }

  async getAllRfqs() {
    const rfqs = await this.rfqRepo.find({
      relations: [
        'purchaseRequest',
        'purchaseRequest.items',
        'purchaseRequest.project',
        'quotations',
        'quotations.vendor',
        'quotations.items',
        'creator',
        'creator.roles',
      ],
      order: { createdAt: 'DESC' },
    });

    const rfqIds = rfqs.map((r) => r.id);
    const comparisonsByRfqId: Record<number, VendorComparison[]> = {};
    if (rfqIds.length > 0) {
      const allComparisons = await this.vendorComparisonRepo.find({
        where: { rfqId: In(rfqIds) },
        relations: ['vendor'],
      });
      allComparisons.forEach((c) => {
        if (!comparisonsByRfqId[c.rfqId]) comparisonsByRfqId[c.rfqId] = [];
        comparisonsByRfqId[c.rfqId].push(c);
      });
    }

    return rfqs.map((r) => this.formatRfqResponse(r, comparisonsByRfqId[r.id]));
  }

  async getPurchaseRequestById(id: number) {
    const pr = await this.prRepo.findOne({
      where: { id },
      relations: ['items', 'project'],
    });
    if (!pr) {
      throw new NotFoundException(`Purchase Request #${id} tidak ditemukan`);
    }

    return {
      success: true,
      message: 'Purchase Request retrieved successfully',
      data: pr,
    };
  }

  async getRfqById(id: number) {
    const rfq = await this.rfqRepo.findOne({
      where: { id },
      relations: [
        'purchaseRequest',
        'purchaseRequest.items',
        'purchaseRequest.project',
        'quotations',
        'quotations.vendor',
        'quotations.items',
        'creator',
        'creator.roles',
      ],
    });
    if (!rfq) {
      throw new BadRequestException('RFQ tidak ditemukan');
    }

    const comparisons = await this.vendorComparisonRepo.find({
      where: { rfqId: id },
      relations: ['vendor'],
    });

    return {
      success: true,
      message: 'RFQ retrieved successfully',
      data: this.formatRfqResponse(rfq, comparisons),
    };
  }

  async createQuotation(dto: CreateQuotationDto, userId?: number) {
    const maxRetries = 3;
    let savedQuotationId: number | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 1. Acquire row-level lock on the RFQ inside transaction (Requirement 1)
        if (typeof queryRunner.manager?.query === 'function') {
          await queryRunner.manager.query(
            `SELECT id FROM rfqs WHERE id = ? FOR UPDATE`,
            [dto.rfqId],
          );
        }

        // 2. Load RFQ with PR, items, project inside transaction
        let rfq: Rfq | null = null;
        if (typeof queryRunner.manager?.findOne === 'function') {
          rfq = await queryRunner.manager.findOne(Rfq, {
            where: { id: dto.rfqId },
            relations: ['purchaseRequest', 'purchaseRequest.items', 'purchaseRequest.project'],
          });
        }
        if (!rfq) {
          rfq = await this.rfqRepo.findOne({
            where: { id: dto.rfqId },
            relations: ['purchaseRequest', 'purchaseRequest.items', 'purchaseRequest.project'],
          });
        }
        if (!rfq) {
          throw new BadRequestException(`RFQ #${dto.rfqId} tidak ditemukan`);
        }

        // 2b. Verify RFQ belongs to valid PR and Project (Project Isolation)
        if (!rfq.purchaseRequest || !rfq.purchaseRequest.projectId) {
          throw new BadRequestException('RFQ tidak terhubung ke Purchase Request atau Proyek yang valid');
        }

        // 2c. RFQ must be OPEN (Requirement 2)
        if (rfq.status !== 'OPEN') {
          throw new BadRequestException(
            `RFQ #${rfq.rfqNumber} tidak dalam status OPEN (status: ${rfq.status})`,
          );
        }

        // 2d. Validate RFQ closing date if applicable
        if (rfq.closingDate && new Date() > new Date(rfq.closingDate)) {
          throw new BadRequestException(
            `RFQ #${rfq.rfqNumber} telah melewati batas waktu pengajuan penawaran (closing date: ${new Date(rfq.closingDate).toISOString()})`,
          );
        }

        // 3. Load & validate Vendor inside transaction
        let vendor: Vendor | null = null;
        if (typeof queryRunner.manager?.findOne === 'function') {
          vendor = await queryRunner.manager.findOne(Vendor, {
            where: { id: dto.vendorId },
          });
        }
        if (!vendor) {
          vendor = await this.vendorRepo.findOne({
            where: { id: dto.vendorId },
          });
        }
        if (!vendor) {
          throw new BadRequestException(`Vendor #${dto.vendorId} tidak ditemukan`);
        }
        if (vendor.deletedAt) {
          throw new BadRequestException(`Vendor ${vendor.name} tidak aktif atau telah dinonaktifkan`);
        }

        // 4. In-transaction duplicate active/submitted quotation check (Requirement 1)
        let existingQuotation: Quotation | null = null;
        if (typeof queryRunner.manager?.findOne === 'function') {
          existingQuotation = await queryRunner.manager.findOne(Quotation, {
            where: {
              rfqId: dto.rfqId,
              vendorId: dto.vendorId,
              status: 'SUBMITTED',
            },
          });
        }
        if (!existingQuotation && attempt === 1) {
          existingQuotation = await this.quotationRepo.findOne({
            where: {
              rfqId: dto.rfqId,
              vendorId: dto.vendorId,
              status: 'SUBMITTED',
            },
          });
        }
        if (existingQuotation) {
          throw new BadRequestException(
            `Vendor ${vendor.name} sudah mengajukan penawaran (${existingQuotation.quotationNumber}) untuk RFQ #${rfq.rfqNumber}`,
          );
        }

        // 5. Validate quotation items
        if (!dto.items || dto.items.length === 0) {
          throw new BadRequestException('Item penawaran tidak boleh kosong');
        }

        // Requirement 3: Duplicate prItemId within quotation items payload protection
        const seenPrItemIds = new Set<number>();
        for (const item of dto.items) {
          const prItemId = Number(item.prItemId);
          if (seenPrItemIds.has(prItemId)) {
            throw new BadRequestException(
              `Item PR #${item.prItemId} duplikat dalam daftar penawaran`,
            );
          }
          seenPrItemIds.add(prItemId);
        }

        const validPrItemsMap = new Map<number, any>();
        for (const prItem of rfq.purchaseRequest?.items || []) {
          validPrItemsMap.set(Number(prItem.id), prItem);
        }

        for (const item of dto.items) {
          if (!item.prItemId) {
            throw new BadRequestException('Setiap item penawaran wajib terhubung ke item PR (prItemId required)');
          }
          if (!validPrItemsMap.has(Number(item.prItemId))) {
            throw new BadRequestException(
              `Item PR #${item.prItemId} tidak valid untuk RFQ ini atau berasal dari PR/proyek lain`,
            );
          }
          if (Number(item.quantity) <= 0) {
            throw new BadRequestException(`Kuantitas item "${item.itemName}" harus lebih besar dari 0`);
          }
          if (Number(item.unitPrice) < 0) {
            throw new BadRequestException(`Harga satuan item "${item.itemName}" tidak boleh negatif`);
          }
        }

        // 6. Authoritative server-side total calculation (Do NOT trust client total)
        let totalAmount = 0;
        const calculatedItems = dto.items.map((item) => {
          const qty = Number(item.quantity);
          const price = Number(item.unitPrice);
          const itemTotal = Math.round(qty * price * 100) / 100;
          totalAmount += itemTotal;
          return {
            ...item,
            quantity: qty,
            unitPrice: price,
            totalAmount: itemTotal,
          };
        });
        totalAmount = Math.round(totalAmount * 100) / 100;

        // 7. Concurrency-safe quotation number generation
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `QT-${dateStr}-`;

        const latestLocked = typeof queryRunner.query === 'function'
          ? await queryRunner.query(
              `SELECT quotation_number FROM quotations 
               WHERE quotation_number LIKE ? 
               ORDER BY id DESC LIMIT 1 FOR UPDATE`,
              [`${prefix}%`],
            )
          : [];

        let nextSeq = 1;
        if (latestLocked && latestLocked.length > 0) {
          const lastNumber = latestLocked[0].quotation_number;
          const parts = lastNumber.split('-');
          const parsedSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(parsedSeq)) {
            nextSeq = parsedSeq + 1;
          }
        }
        const quotationNumber = `${prefix}${String(nextSeq).padStart(3, '0')}`;

        // 8. CreatedBy = authenticated JWT userId & persist Quotation
        const quotationEntity = queryRunner.manager.create(Quotation, {
          rfqId: dto.rfqId,
          vendorId: dto.vendorId,
          quotationNumber,
          vendorRef: dto.vendorRef || null,
          quotationDate: dto.quotationDate ? new Date(dto.quotationDate) : new Date(),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          leadTimeDays: dto.leadTimeDays || 14,
          totalAmount,
          status: 'SUBMITTED',
          notes: dto.notes || null,
          createdBy: userId ? Number(userId) : null,
        });

        const savedQuotation = await queryRunner.manager.save(Quotation, quotationEntity);

        const quotationItems = calculatedItems.map((item) =>
          queryRunner.manager.create(QuotationItem, {
            quotationId: savedQuotation.id,
            prItemId: Number(item.prItemId),
            itemName: item.itemName,
            quantity: item.quantity,
            uom: item.uom || 'PCS',
            unitPrice: item.unitPrice,
            totalAmount: item.totalAmount,
            remarks: item.remarks || null,
          }),
        );

        await queryRunner.manager.save(QuotationItem, quotationItems);

        // Canonical AuditLog: Quotation SUBMIT
        const quotationAudit = queryRunner.manager.create(AuditLog, {
          table_name: 'quotations',
          record_id: savedQuotation.id,
          action: 'SUBMIT',
          old_value: null,
          new_value: {
            quotationNumber: savedQuotation.quotationNumber,
            rfqId: savedQuotation.rfqId,
            vendorId: savedQuotation.vendorId,
            totalAmount: Number(savedQuotation.totalAmount),
            leadTimeDays: Number(savedQuotation.leadTimeDays),
            status: 'SUBMITTED',
          },
          created_by: userId ? Number(userId) : null,
        });
        await queryRunner.manager.save(AuditLog, quotationAudit);

        await queryRunner.commitTransaction();
        savedQuotationId = savedQuotation.id;
        break; // Transaction successfully committed
      } catch (err: any) {
        await queryRunner.rollbackTransaction();

        const isDuplicateEntry =
          err?.code === 'ER_DUP_ENTRY' ||
          err?.errno === 1062 ||
          String(err?.message || '').includes('Duplicate entry') ||
          String(err?.message || '').includes('uq_quotations_quotation_number');

        if (isDuplicateEntry && attempt < maxRetries) {
          this.logger.warn(
            `Quotation number collision detected on attempt ${attempt}/${maxRetries}. Retrying with fresh sequence...`,
          );
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 20));
          continue;
        }

        this.logger.error(`Failed to create quotation: ${err.message}`, err.stack);
        throw err;
      } finally {
        await queryRunner.release();
      }
    }

    if (!savedQuotationId) {
      throw new BadRequestException('Gagal membuat penawaran setelah beberapa kali percobaan');
    }

    // Return authoritative persisted quotation
    return await this.getQuotationById(savedQuotationId);
  }

  async getQuotationsByRfq(rfqId: number) {
    const quotations = await this.quotationRepo.find({
      where: { rfqId },
      relations: ['vendor', 'items', 'items.purchaseRequestItem'],
      order: { createdAt: 'ASC' },
    });
    return {
      success: true,
      message: 'Quotations retrieved successfully',
      data: quotations,
    };
  }

  async getQuotationById(id: number) {
    const quotation = await this.quotationRepo.findOne({
      where: { id },
      relations: ['rfq', 'vendor', 'items', 'items.purchaseRequestItem'],
    });
    if (!quotation) {
      throw new BadRequestException('Quotation tidak ditemukan');
    }
    return {
      success: true,
      message: 'Quotation retrieved successfully',
      data: quotation,
    };
  }

  async getAllVendors(query?: VendorQueryDto) {
    const qb = this.vendorRepo.createQueryBuilder('vendor');

    if (query?.search) {
      const search = query.search.trim();
      qb.andWhere('(vendor.code LIKE :search OR vendor.name LIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (query?.vendorType) {
      qb.andWhere('vendor.vendor_type = :vendorType', {
        vendorType: query.vendorType.trim(),
      });
    }

    qb.orderBy('vendor.id', 'ASC');

    // Backward compatibility: If neither page nor limit is provided, return flat Vendor[] array
    if (!query?.page && !query?.limit) {
      return await qb.getMany();
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);

    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getVendorById(id: number): Promise<Vendor> {
    const vendor = await this.vendorRepo.findOne({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor dengan ID ${id} tidak ditemukan`);
    }

    return vendor;
  }

  async createVendor(dto: CreateVendorDto, userId: number): Promise<Vendor> {
    const trimmedName = dto.name.trim();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock and find the current maximum numeric sequence for canonical VND-XXX codes (including soft-deleted)
      const lastRows: Array<{ code: string }> = await queryRunner.manager.query(`
        SELECT code FROM vendors 
        WHERE code REGEXP '^VND-[0-9]+$' 
        ORDER BY CAST(SUBSTRING(code, 5) AS UNSIGNED) DESC 
        LIMIT 1 
        FOR UPDATE
      `);

      let nextSeq = 1;
      if (lastRows && lastRows.length > 0 && lastRows[0].code) {
        const match = lastRows[0].code.match(/^VND-(\d+)$/);
        if (match && match[1]) {
          nextSeq = parseInt(match[1], 10) + 1;
        }
      }

      // 2. Concurrency-safe candidate generator with retry loop
      let generatedCode = '';
      let isUnique = false;
      let currentSeq = nextSeq;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        attempts++;
        const candidateCode = `VND-${String(currentSeq).padStart(3, '0')}`;
        // Uniqueness check across ALL records (including soft-deleted)
        const existing = await queryRunner.manager.findOne(Vendor, {
          where: { code: candidateCode },
          withDeleted: true,
        });

        if (!existing) {
          generatedCode = candidateCode;
          isUnique = true;
        } else {
          currentSeq++;
        }
      }

      if (!generatedCode) {
        throw new ConflictException('Gagal menghasilkan kode vendor unik.');
      }

      // 3. Create and save entity using the server-generated code
      const vendor = queryRunner.manager.create(Vendor, {
        code: generatedCode,
        name: trimmedName,
        address: dto.address?.trim() || null,
        taxId: dto.taxId?.trim() || null,
        vendorType: dto.vendorType?.trim() || null,
        createdBy: userId,
      });

      const savedVendor = await queryRunner.manager.save(vendor);
      await queryRunner.commitTransaction();

      // 4. Emit canonical audit log
      this.eventEmitter.emit('audit.log', {
        action: 'CREATE',
        entityId: savedVendor.id,
        entityName: 'vendors',
        newValue: {
          code: savedVendor.code,
          name: savedVendor.name,
          address: savedVendor.address,
          taxId: savedVendor.taxId,
          vendorType: savedVendor.vendorType,
        },
        userId,
      });

      return savedVendor;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err?.code === 'ER_DUP_ENTRY' || err?.message?.includes('Duplicate entry')) {
        throw new ConflictException('Gagal mendaftarkan vendor karena duplikasi kode.');
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateVendor(id: number, dto: UpdateVendorDto, userId: number): Promise<Vendor> {
    const vendor = await this.vendorRepo.findOne({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor dengan ID ${id} tidak ditemukan`);
    }

    const oldValue = {
      name: vendor.name,
      address: vendor.address,
      taxId: vendor.taxId,
      vendorType: vendor.vendorType,
    };

    if (dto.name !== undefined) {
      vendor.name = dto.name.trim();
    }
    if (dto.address !== undefined) {
      vendor.address = dto.address?.trim() || null;
    }
    if (dto.taxId !== undefined) {
      vendor.taxId = dto.taxId?.trim() || null;
    }
    if (dto.vendorType !== undefined) {
      vendor.vendorType = dto.vendorType?.trim() || null;
    }

    vendor.updatedBy = userId;

    const updatedVendor = await this.vendorRepo.save(vendor);

    // Emit canonical audit log
    this.eventEmitter.emit('audit.log', {
      action: 'UPDATE',
      entityId: updatedVendor.id,
      entityName: 'vendors',
      oldValue,
      newValue: {
        name: updatedVendor.name,
        address: updatedVendor.address,
        taxId: updatedVendor.taxId,
        vendorType: updatedVendor.vendorType,
      },
      userId,
    });

    return updatedVendor;
  }

  async softDeleteVendor(id: number, userId: number) {
    const vendor = await this.vendorRepo.findOne({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor dengan ID ${id} tidak ditemukan`);
    }

    // Check historical transaction references (PO, Quotation, Vendor Comparison)
    const [poCount, quotationCount, comparisonCount] = await Promise.all([
      this.poRepo.count({ where: { vendorId: id } }),
      this.quotationRepo.count({ where: { vendorId: id } }),
      this.vendorComparisonRepo.count({ where: { vendorId: id } }),
    ]);

    const hasHistoricalTransactions = poCount > 0 || quotationCount > 0 || comparisonCount > 0;

    // Set deleted_by and soft-delete
    vendor.deletedBy = userId;
    await this.vendorRepo.save(vendor);
    await this.vendorRepo.softRemove(vendor);

    // Emit canonical audit log
    this.eventEmitter.emit('audit.log', {
      action: 'SOFT_DELETE',
      entityId: vendor.id,
      entityName: 'vendors',
      oldValue: {
        code: vendor.code,
        name: vendor.name,
        hasHistoricalTransactions,
        poCount,
        quotationCount,
        comparisonCount,
      },
      userId,
    });

    return {
      success: true,
      message: `Vendor ${vendor.name} (${vendor.code}) berhasil dinonaktifkan (soft delete). Data transaksi historis tetap aman.`,
      data: {
        id: vendor.id,
        code: vendor.code,
        name: vendor.name,
        hasHistoricalTransactions,
        historicalTransactions: {
          purchaseOrders: poCount,
          quotations: quotationCount,
          vendorComparisons: comparisonCount,
        },
      },
    };
  }

  async submitVendorComparison(
    rfqId: number,
    vendorsData: any[],
    userId?: number,
    remarks?: string,
  ) {
    // PART A: Authenticated User Validation
    if (!userId) {
      throw new UnauthorizedException('User ID diperlukan untuk evaluasi vendor');
    }

    // Pre-validation on incoming payload
    if (!Array.isArray(vendorsData) || vendorsData.length === 0) {
      throw new BadRequestException('Data vendor untuk perbandingan tidak boleh kosong');
    }

    // PART F: Reject duplicate vendor IDs in incoming payload
    const seenPayloadVendorIds = new Set<number>();
    for (const v of vendorsData) {
      const vId = Number(v.vendorId);
      if (seenPayloadVendorIds.has(vId)) {
        throw new BadRequestException(`Vendor #${vId} duplikat dalam perbandingan`);
      }
      seenPayloadVendorIds.add(vId);
    }

    // PART H: Exactly 1 winner validation
    const winners = vendorsData.filter((v) => v.isWinner);
    if (winners.length !== 1) {
      throw new BadRequestException('Exactly 1 vendor must be selected as the winner.');
    }
    const winningVendorId = Number(winners[0].vendorId);

    // PART B: Transaction and RFQ Pessimistic Write Lock
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Authoritative RFQ read with pessimistic write lock inside transaction
      const rfq = await queryRunner.manager.findOne(Rfq, {
        where: { id: rfqId },
        lock: { mode: 'pessimistic_write' },
        relations: ['purchaseRequest'],
      });

      if (!rfq) {
        throw new BadRequestException(`RFQ #${rfqId} tidak ditemukan`);
      }

      // RFQ status guards
      if (rfq.status === 'EVALUATED') {
        throw new BadRequestException('RFQ sudah selesai dievaluasi.');
      }

      if (rfq.status !== 'OPEN') {
        throw new BadRequestException(
          `RFQ #${rfq.rfqNumber || rfqId} tidak dalam status OPEN untuk evaluasi vendor (status: ${rfq.status})`,
        );
      }

      // PART C: Authoritative Quotations from DB (status = SUBMITTED for target RFQ)
      const dbQuotations = await queryRunner.manager.find(Quotation, {
        where: {
          rfqId,
          status: 'SUBMITTED',
        },
      });

      if (!dbQuotations || dbQuotations.length === 0) {
        throw new BadRequestException(
          'RFQ tidak memiliki penawaran vendor yang valid (SUBMITTED) untuk dievaluasi.',
        );
      }

      // Build authoritative quotation map by vendorId
      const quotationByVendorId = new Map<number, Quotation>();
      for (const q of dbQuotations) {
        quotationByVendorId.set(Number(q.vendorId), q);
      }

      const dbVendorIds = new Set(quotationByVendorId.keys());

      // PART D: Complete comparison set validation
      // Every vendor in payload must exist in dbVendorIds
      for (const vId of seenPayloadVendorIds) {
        if (!dbVendorIds.has(vId)) {
          throw new BadRequestException(
            `Vendor #${vId} tidak memiliki penawaran berstatus SUBMITTED pada RFQ #${rfqId}`,
          );
        }
      }

      // Payload must contain ALL valid submitted quotations for this RFQ (no selective omissions)
      if (seenPayloadVendorIds.size !== dbVendorIds.size) {
        throw new BadRequestException(
          `Perbandingan tidak lengkap: seluruh penawaran vendor yang valid (${dbVendorIds.size}) harus dievaluasi (diterima: ${seenPayloadVendorIds.size})`,
        );
      }

      // PART E: Distinct vendor minimum rule based on PR estimated amount
      let totalEstimatedAmount = 0;
      if (rfq.purchaseRequest) {
        totalEstimatedAmount = Number(rfq.purchaseRequest.totalEstimatedAmount || 0);
      }

      const distinctValidVendorCount = dbVendorIds.size;
      if (totalEstimatedAmount > 1000000 && distinctValidVendorCount < 3) {
        throw new BadRequestException(
          `Minimal 3 vendor diperlukan untuk perbandingan pengadaan di atas Rp 1.000.000 (ditemukan: ${distinctValidVendorCount} vendor valid)`,
        );
      }

      if (totalEstimatedAmount <= 1000000 && distinctValidVendorCount < 1) {
        throw new BadRequestException(
          `Minimal 1 vendor diperlukan untuk perbandingan pengadaan (ditemukan: ${distinctValidVendorCount} vendor valid)`,
        );
      }

      // PART H: Winner verification against DB quotation set
      if (!dbVendorIds.has(winningVendorId)) {
        throw new BadRequestException(
          `Vendor pemenang #${winningVendorId} tidak memiliki penawaran valid pada RFQ #${rfqId}`,
        );
      }
      const winningQuotation = quotationByVendorId.get(winningVendorId)!;

      this.logger.log(
        `Vendor comparison submitted for RFQ ${rfq.rfqNumber} (ID: ${rfqId}). Winner: Vendor #${winningVendorId}`,
      );

      // PART G & I & J: Persist comparison rows using authoritative DB quotation totalAmount
      const comparisons = vendorsData.map((v) => {
        const vId = Number(v.vendorId);
        const q = quotationByVendorId.get(vId)!;
        const isWinner = vId === winningVendorId;

        return queryRunner.manager.create(VendorComparison, {
          rfqId,
          vendorId: vId,
          offeredAmount: Number(q.totalAmount), // Authoritative from DB
          isWinner,
          remarks: remarks || null,
        });
      });

      const savedComparisons = await queryRunner.manager.save(VendorComparison, comparisons);

      // PART K: Update RFQ status to EVALUATED
      rfq.status = 'EVALUATED';
      await queryRunner.manager.save(Rfq, rfq);

      // Canonical AuditLog: RFQ EVALUATE (Vendor Comparison)
      const comparisonAudit = queryRunner.manager.create(AuditLog, {
        table_name: 'rfqs',
        record_id: rfq.id,
        action: 'EVALUATE',
        old_value: {
          status: 'OPEN',
        },
        new_value: {
          status: 'EVALUATED',
          winnerVendorId: winningVendorId,
          winnerAmount: Number(winningQuotation.totalAmount),
          vendorsCount: savedComparisons.length,
          ...(remarks ? { remarks } : {}),
        },
        created_by: Number(userId),
      });
      await queryRunner.manager.save(AuditLog, comparisonAudit);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Vendor comparison submitted successfully',
        data: savedComparisons,
        rfq: this.formatRfqResponse(rfq, savedComparisons),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to submit vendor comparison for RFQ ${rfqId}: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async createPurchaseOrder(userId: number, dto: CreatePurchaseOrderDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock Purchase Request with pessimistic_write and validate PR exists & APPROVED
      const pr = await queryRunner.manager.findOne(PurchaseRequest, {
        where: { id: dto.purchase_request_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!pr) {
        throw new BadRequestException(`Purchase Request #${dto.purchase_request_id} tidak ditemukan`);
      }

      if (pr.status !== 'APPROVED') {
        throw new BadRequestException(`Purchase Request #${pr.prNumber || pr.id} belum berstatus APPROVED (status: ${pr.status})`);
      }

      // 2. Idempotency Guard: Check if a Purchase Order already exists for this PR
      const existingPo = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { purchaseRequestId: pr.id },
      });
      if (existingPo) {
        throw new BadRequestException(
          `Purchase Order sudah pernah dibuat untuk Purchase Request ini (${existingPo.poNumber}).`,
        );
      }

      // 3. Deterministic RFQ Resolution (P7.4-B Hardened)
      const rfqs = await queryRunner.manager.find(Rfq, {
        where: { prId: pr.id },
        order: { id: 'DESC' },
      });

      if (!rfqs || rfqs.length === 0) {
        throw new BadRequestException('RFQ untuk Purchase Request ini tidak ditemukan');
      }

      const evaluatedRfqs = rfqs.filter((candidate) => candidate.status === 'EVALUATED');

      if (evaluatedRfqs.length === 0) {
        const statuses = rfqs.map((r) => r.status).join(', ');
        throw new BadRequestException(
          `RFQ untuk Purchase Request #${pr.prNumber || pr.id} belum berstatus EVALUATED (status saat ini: ${statuses})`,
        );
      }

      if (evaluatedRfqs.length > 1) {
        throw new BadRequestException(
          `Purchase Request #${pr.prNumber || pr.id} memiliki lebih dari 1 RFQ berstatus EVALUATED (${evaluatedRfqs.length} ditemukan). Tidak dapat menentukan RFQ pemenang secara aman.`,
        );
      }

      const rfq = evaluatedRfqs[0];

      // 4. Find vendor_comparisons for this RFQ and ensure exactly 1 winner
      const comparisons = await queryRunner.manager.find(VendorComparison, {
        where: { rfqId: rfq.id },
        relations: ['vendor'],
      });

      const winners = comparisons.filter((c) => c.isWinner);
      if (winners.length !== 1) {
        throw new BadRequestException(
          `RFQ #${rfq.rfqNumber} harus memiliki tepat 1 vendor pemenang (ditemukan: ${winners.length})`,
        );
      }

      const winnerComparison = winners[0];
      const winningVendorId = Number(winnerComparison.vendorId);

      // Verify dto.vendor_id matches winner vendor if provided
      if (dto.vendor_id && Number(dto.vendor_id) !== winningVendorId) {
        throw new BadRequestException('Vendor yang dipilih bukan merupakan vendor pemenang evaluasi RFQ ini');
      }

      // 5. Resolve winning quotation from database
      const winningQuotation = await queryRunner.manager.findOne(Quotation, {
        where: { rfqId: rfq.id, vendorId: winningVendorId },
        relations: ['items'],
      });

      if (!winningQuotation) {
        throw new BadRequestException('Quotation vendor pemenang tidak ditemukan di database');
      }

      if (winningQuotation.status !== 'SUBMITTED') {
        throw new BadRequestException(
          `Status quotation vendor pemenang tidak valid (status: ${winningQuotation.status})`,
        );
      }

      // 6. Lead Time Gate: Must be finite number > 0
      const leadTimeDays = Number(winningQuotation.leadTimeDays);
      if (!Number.isFinite(leadTimeDays) || leadTimeDays <= 0) {
        throw new BadRequestException(
          'Lead Time Vendor wajib tersedia dan lebih besar dari 0 hari sebelum Purchase Order diterbitkan.',
        );
      }

      // 7. Authoritative Server PO Items & Total Calculation from winning quotation_items
      const quoteItems = winningQuotation.items;
      if (!quoteItems || quoteItems.length === 0) {
        throw new BadRequestException('Item penawaran vendor pemenang tidak ditemukan di database');
      }

      // Authoritative PR Item and CostItem resolution (zero string matching)
      const prItems = await queryRunner.manager.find(PurchaseRequestItem, {
        where: { prId: pr.id },
      });
      const prItemMap = new Map<number, PurchaseRequestItem>();
      for (const pri of prItems) {
        prItemMap.set(Number(pri.id), pri);
      }

      let serverTotalAmount = 0;
      const poItemsToCreate = quoteItems.map((qi) => {
        const qty = Number(qi.quantity || 0);
        const unitPrice = Number(qi.unitPrice || 0);
        const totalPrice = Math.round(qty * unitPrice * 100) / 100;
        serverTotalAmount += totalPrice;

        const prItem = qi.prItemId ? prItemMap.get(Number(qi.prItemId)) : null;
        if (!prItem) {
          throw new BadRequestException(
            `Item penawaran "${qi.itemName}" tidak terhubung ke item Purchase Request yang valid (prItemId: ${qi.prItemId || 'null'})`,
          );
        }

        if (!prItem.costItemId) {
          throw new BadRequestException(
            `Item Purchase Request "${prItem.itemName}" (#${prItem.id}) belum memiliki authoritative cost_item_id. Rekonsiliasi pengadaan wajib diselesaikan sebelum Purchase Order dapat diterbitkan.`,
          );
        }

        return {
          prItemId: prItem.id,
          costItemId: Number(prItem.costItemId),
          itemName: qi.itemName,
          quantity: qty,
          unitPrice,
          totalPrice,
        };
      });

      serverTotalAmount = Math.round(serverTotalAmount * 100) / 100;

      // 8. Payment Terms Validation & SSOT Amount Calculation
      const paymentTermsDto = dto.payment_terms;
      if (!paymentTermsDto || !Array.isArray(paymentTermsDto) || paymentTermsDto.length === 0) {
        throw new BadRequestException('Payment terms wajib diisi minimal 1 termin');
      }

      // Check sequence uniqueness and contiguity starting from 1
      const sortedTerms = [...paymentTermsDto].sort((a, b) => Number(a.sequence) - Number(b.sequence));

      const sequences = sortedTerms.map((t) => Number(t.sequence));
      const sequenceSet = new Set(sequences);
      if (sequenceSet.size !== sequences.length) {
        throw new BadRequestException('Urutan (sequence) payment terms tidak boleh duplikat');
      }

      for (let i = 0; i < sortedTerms.length; i++) {
        const expectedSeq = i + 1;
        if (Number(sortedTerms[i].sequence) !== expectedSeq) {
          throw new BadRequestException(
            `Urutan (sequence) payment terms harus berurutan tanpa jeda dimulai dari 1 (ditemukan: ${sortedTerms[i].sequence}, diharapkan: ${expectedSeq})`,
          );
        }
      }

      // Validate each term percentage and semantics
      let totalBasisPoints = 0;
      for (const term of sortedTerms) {
        const pct = Number(term.percentage);
        if (!Number.isFinite(pct) || pct <= 0) {
          throw new BadRequestException(
            `Persentase termin "${term.term_name || term.sequence}" harus lebih besar dari 0%`,
          );
        }
        if (pct > 100) {
          throw new BadRequestException(
            `Persentase termin "${term.term_name || term.sequence}" tidak boleh melebihi 100%`,
          );
        }

        // Check decimal precision (at most 2 decimal places)
        const basisPoints = Math.round(pct * 100);
        if (Math.abs(pct * 100 - basisPoints) > 0.0001) {
          throw new BadRequestException(
            `Persentase termin "${term.term_name || term.sequence}" maksimal memiliki 2 angka di belakang koma`,
          );
        }
        totalBasisPoints += basisPoints;

        // Retention validation
        const isRetention = term.term_type === PaymentTermType.RETENTION || Boolean(term.is_retention);
        if (isRetention) {
          const retDays = Number(term.retention_days);
          if (!Number.isFinite(retDays) || retDays <= 0 || !Number.isInteger(retDays)) {
            throw new BadRequestException(
              `Termin retensi "${term.term_name || term.sequence}" wajib memiliki retention_days lebih besar dari 0 hari`,
            );
          }
        }
      }

      // Strict 100.00% validation (10000 basis points)
      if (totalBasisPoints !== 10000) {
        throw new BadRequestException('Total persentase payment terms harus tepat 100%.');
      }

      // Server-side authoritative amount calculation with deterministic rounding
      // SUM(payment_term.amount) strictly equals serverTotalAmount
      let allocatedAmount = 0;
      const calculatedTerms = sortedTerms.map((term, index) => {
        const isLast = index === sortedTerms.length - 1;
        const pct = Number(term.percentage);
        let termAmount: number;

        if (isLast) {
          termAmount = Math.round((serverTotalAmount - allocatedAmount) * 100) / 100;
        } else {
          termAmount = Math.round(((serverTotalAmount * pct) / 100) * 100) / 100;
          allocatedAmount = Math.round((allocatedAmount + termAmount) * 100) / 100;
        }

        const isRetention = term.term_type === PaymentTermType.RETENTION || Boolean(term.is_retention);

        return {
          sequence: Number(term.sequence),
          termName: (term.term_name || '').trim(),
          termType: term.term_type,
          percentage: pct,
          amount: termAmount,
          triggerCondition: term.trigger_condition || null,
          isRetention,
          retentionDays: isRetention ? Number(term.retention_days) : null,
        };
      });

      // 9. Concurrency-safe PO Number generation with retry loop
      let poNumber = '';
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      while (!isUnique && attempts < maxAttempts) {
        attempts++;
        const countToday = await queryRunner.manager.count(PurchaseOrder, {
          where: { poNumber: Like(`PO-${dateStr}-%`) },
        });
        const seq = String(countToday + attempts).padStart(3, '0');
        const candidatePoNumber = `PO-${dateStr}-${seq}`;

        const existingWithNum = await queryRunner.manager.findOne(PurchaseOrder, {
          where: { poNumber: candidatePoNumber },
        });
        if (!existingWithNum) {
          poNumber = candidatePoNumber;
          isUnique = true;
        }
      }

      if (!poNumber) {
        throw new Error('Gagal menghasilkan nomor PO unik setelah beberapa percobaan');
      }

      // 10. Save PurchaseOrder entity
      const po = queryRunner.manager.create(PurchaseOrder, {
        purchaseRequestId: pr.id,
        vendorId: winningVendorId,
        poNumber,
        totalAmount: serverTotalAmount,
        status: 'ISSUED',
        deliveryLocation: dto.delivery_location || null,
        deliveryDate: dto.delivery_date ? new Date(dto.delivery_date) : null,
        notes: dto.notes || null,
        createdBy: userId,
      });

      const savedPo = await queryRunner.manager.save(PurchaseOrder, po);

      // 11. Save PurchaseOrderItem entities
      const items = poItemsToCreate.map((item) =>
        queryRunner.manager.create(PurchaseOrderItem, {
          purchaseOrderId: savedPo.id,
          prItemId: item.prItemId,
          costItemId: item.costItemId,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }),
      );

      await queryRunner.manager.save(PurchaseOrderItem, items);

      // 12. Save PoPaymentTerm entities (within same transaction)
      const paymentTermsToSave = calculatedTerms.map((t) =>
        queryRunner.manager.create(PoPaymentTerm, {
          poId: savedPo.id,
          sequence: t.sequence,
          termName: t.termName,
          termType: t.termType,
          percentage: t.percentage,
          amount: t.amount,
          triggerCondition: t.triggerCondition,
          isRetention: t.isRetention,
          retentionDays: t.retentionDays,
          status: PaymentTermStatus.PENDING,
          createdBy: userId,
        }),
      );

      await queryRunner.manager.save(PoPaymentTerm, paymentTermsToSave);

      // 13. Update PR status to 'PO_ISSUED'
      pr.status = 'PO_ISSUED';
      await queryRunner.manager.save(PurchaseRequest, pr);

      // Canonical AuditLog: PO ISSUE
      const poAudit = queryRunner.manager.create(AuditLog, {
        table_name: 'purchase_orders',
        record_id: savedPo.id,
        action: 'ISSUE',
        old_value: null,
        new_value: {
          poNumber: savedPo.poNumber,
          prId: pr.id,
          vendorId: winningVendorId,
          totalAmount: Number(savedPo.totalAmount),
          status: 'ISSUED',
          paymentTermsCount: paymentTermsToSave.length,
        },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, poAudit);

      // Canonical Outbox: procurement.po.issued
      const poEvent: BusinessEvent<{
        purchaseOrderId: number;
        poNumber: string;
        purchaseRequestId: number;
        vendorId: number;
        totalAmount: number;
        status: string;
        paymentTermsCount: number;
      }> = {
        eventId: randomUUID(),
        eventName: 'procurement.po.issued',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PurchaseOrder',
        aggregateId: savedPo.id,
        projectId: pr.projectId ? Number(pr.projectId) : undefined,
        actor: userId ? { userId: Number(userId) } : undefined,
        routing: undefined,
        notificationPolicy: undefined,
        payload: {
          purchaseOrderId: Number(savedPo.id),
          poNumber: savedPo.poNumber,
          purchaseRequestId: Number(pr.id),
          vendorId: Number(winningVendorId),
          totalAmount: Number(savedPo.totalAmount),
          status: 'ISSUED',
          paymentTermsCount: paymentTermsToSave.length,
        },
      };

      const poOutbox = queryRunner.manager.create(OutboxEvent, {
        event_id: poEvent.eventId,
        event_name: poEvent.eventName,
        event_version: String(poEvent.eventVersion),
        aggregate_type: poEvent.aggregateType,
        aggregate_id: Number(poEvent.aggregateId),
        correlation_id: poEvent.correlationId || null,
        payload: {
          occurredAt: poEvent.occurredAt,
          projectId: poEvent.projectId,
          actor: poEvent.actor,
          routing: poEvent.routing,
          notificationPolicy: poEvent.notificationPolicy,
          businessPayload: poEvent.payload,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, poOutbox);

      // 14. Commit transaction
      await queryRunner.commitTransaction();

      this.logger.log(`Purchase Order ${savedPo.poNumber} (ID: ${savedPo.id}) created successfully with ${paymentTermsToSave.length} payment terms for Vendor #${winningVendorId}`);

      return {
        success: true,
        message: 'Purchase Order created successfully',
        data: {
          ...savedPo,
          items,
          paymentTerms: paymentTermsToSave,
        },
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating PO: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getPurchaseOrderById(id: number) {
    const po = await this.poRepo.findOne({
      where: { id },
      relations: ['items', 'paymentTerms', 'vendor', 'purchaseRequest', 'purchaseRequest.project'],
      order: {
        paymentTerms: {
          sequence: 'ASC',
        },
      },
    });

    if (!po) {
      throw new BadRequestException('Purchase Order not found');
    }

    if (po.paymentTerms && Array.isArray(po.paymentTerms)) {
      po.paymentTerms.sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
    }

    return {
      success: true,
      message: 'Purchase Order retrieved successfully',
      data: po
    };
  }

  async createGoodsReceipt(dto: CreateGoodsReceiptDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Fetch & Lock PO with Items using pessimistic_write
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: dto.purchaseOrderId },
        lock: { mode: 'pessimistic_write' },
        relations: ['items']
      });

      if (!po) {
        throw new BadRequestException('Purchase Order not found');
      }

      if (po.status !== 'ISSUED' && po.status !== 'PARTIALLY_FULFILLED') {
        throw new BadRequestException(`Cannot receive goods for PO with status ${po.status}`);
      }

      // 2. Validate Items & Calculate Total Amount
      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Goods Receipt must contain at least one item');
      }

      // 2b. Reject duplicate poItemId in payload to prevent bypass of over-receipt guards
      const seenPoItemIds = new Set<number>();
      for (const itemDto of dto.items) {
        const pId = Number(itemDto.poItemId);
        if (seenPoItemIds.has(pId)) {
          throw new BadRequestException(`Duplicate poItemId ${itemDto.poItemId} found in Goods Receipt items payload`);
        }
        seenPoItemIds.add(pId);
      }

      let totalReceivedAmount = 0;
      for (const itemDto of dto.items) {
        if (!itemDto.receivedQuantity || Number(itemDto.receivedQuantity) <= 0) {
          throw new BadRequestException(`Kuantitas penerimaan untuk item PO #${itemDto.poItemId} harus lebih besar dari 0`);
        }

        const poItem = po.items?.find(i => Number(i.id) === Number(itemDto.poItemId));
        if (!poItem) {
          throw new BadRequestException(`PO Item ${itemDto.poItemId} does not belong to PO ${po.id}`);
        }

        const remainingQty = Number(poItem.quantity) - Number(poItem.receivedQuantity);
        if (Number(itemDto.receivedQuantity) > remainingQty) {
          throw new BadRequestException(`Cannot receive ${itemDto.receivedQuantity} for item ${poItem.id}. Remaining quantity is ${remainingQty}`);
        }

        totalReceivedAmount += Number(itemDto.receivedQuantity) * Number(poItem.unitPrice || 0);
      }

      // 3. Generate GR Number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await queryRunner.manager.count(GoodsReceipt, {
        where: { grNumber: Like(`GR-${dateStr}%`) }
      });
      const seq = String(count + 1).padStart(3, '0');
      const grNumber = `GR-${dateStr}-${seq}`;

      // 4. Create GR Header
      const gr = queryRunner.manager.create(GoodsReceipt, {
        poId: po.id,
        grNumber,
        receiptDate: new Date(dto.receiptDate),
        totalReceivedAmount,
        remarks: dto.remarks,
        createdBy: userId
      });
      const savedGr = await queryRunner.manager.save(gr);

      // 5. Process Items
      const grItemsToSave: GoodsReceiptItem[] = [];

      for (const itemDto of dto.items) {
        const poItem = po.items.find(i => Number(i.id) === Number(itemDto.poItemId));

        // Create GR Item
        grItemsToSave.push(queryRunner.manager.create(GoodsReceiptItem, {
          grId: savedGr.id,
          poItemId: poItem.id,
          receivedQuantity: Number(itemDto.receivedQuantity),
          remarks: itemDto.remarks,
          createdBy: userId
        }));

        // Update PO Item received quantity
        poItem.receivedQuantity = Number(poItem.receivedQuantity) + Number(itemDto.receivedQuantity);
        await queryRunner.manager.save(poItem);
      }

      await queryRunner.manager.save(grItemsToSave);
      savedGr.items = grItemsToSave;

      // 6. Calculate new PO Status
      let allItemsCompleted = true;
      let atLeastOneItemReceived = false;

      for (const poItem of po.items) {
        if (Number(poItem.receivedQuantity) < Number(poItem.quantity)) {
          allItemsCompleted = false;
        }
        if (Number(poItem.receivedQuantity) > 0) {
          atLeastOneItemReceived = true;
        }
      }

      const originalStatus = po.status;
      if (allItemsCompleted) {
        po.status = 'COMPLETED';
      } else if (atLeastOneItemReceived) {
        po.status = 'PARTIALLY_FULFILLED';
      }

      if (po.status !== originalStatus) {
        await queryRunner.manager.save(po);
      }

      // Canonical AuditLog: GR RECEIVE
      const grAudit = queryRunner.manager.create(AuditLog, {
        table_name: 'goods_receipts',
        record_id: savedGr.id,
        action: 'RECEIVE',
        old_value: null,
        new_value: {
          grNumber: savedGr.grNumber,
          poId: po.id,
          totalReceivedAmount: Number(savedGr.totalReceivedAmount),
          poStatusAfter: po.status,
          itemsCount: grItemsToSave.length,
        },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, grAudit);

      // Canonical Outbox: procurement.gr.received
      const grEvent: BusinessEvent<{
        grId: number;
        grNumber: string;
        poId: number;
        totalReceivedAmount: number;
        receiptDate: string;
        poStatusAfter: string;
        itemsCount: number;
        receivedBy: number | null;
      }> = {
        eventId: randomUUID(),
        eventName: 'procurement.gr.received',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'GoodsReceipt',
        aggregateId: savedGr.id,
        projectId: undefined,
        actor: userId ? { userId: Number(userId) } : undefined,
        routing: undefined,
        notificationPolicy: undefined,
        payload: {
          grId: Number(savedGr.id),
          grNumber: savedGr.grNumber,
          poId: Number(po.id),
          totalReceivedAmount: Number(savedGr.totalReceivedAmount),
          receiptDate: savedGr.receiptDate ? savedGr.receiptDate.toISOString() : new Date().toISOString(),
          poStatusAfter: po.status,
          itemsCount: grItemsToSave.length,
          receivedBy: userId ? Number(userId) : null,
        },
      };

      const grOutbox = queryRunner.manager.create(OutboxEvent, {
        event_id: grEvent.eventId,
        event_name: grEvent.eventName,
        event_version: String(grEvent.eventVersion),
        aggregate_type: grEvent.aggregateType,
        aggregate_id: Number(grEvent.aggregateId),
        correlation_id: grEvent.correlationId || null,
        payload: {
          occurredAt: grEvent.occurredAt,
          projectId: grEvent.projectId,
          actor: grEvent.actor,
          routing: grEvent.routing,
          notificationPolicy: grEvent.notificationPolicy,
          businessPayload: grEvent.payload,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, grOutbox);

      await queryRunner.commitTransaction();

      // 7. Emit event
      this.eventEmitter.emit('gr.created', {
        gr_id: savedGr.id,
        po_id: po.id
      });
      this.logger.log(`RabbitMQ Event Emitted: gr.created for GR ${savedGr.id}`);

      return {
        success: true,
        message: 'Goods Receipt created successfully',
        data: savedGr
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating GR: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getGoodsReceiptById(grId: number) {
    const gr = await this.grRepo.findOne({
      where: { id: grId },
      relations: [
        'purchaseOrder',
        'purchaseOrder.vendor',
        'purchaseOrder.purchaseRequest',
        'purchaseOrder.purchaseRequest.project',
        'items',
        'items.purchaseOrderItem',
      ],
    });

    if (!gr) {
      throw new BadRequestException('Goods Receipt not found');
    }
    return gr;
  }

  async getAllGoodsReceipts() {
    return await this.grRepo.find({
      relations: [
        'purchaseOrder',
        'purchaseOrder.vendor',
        'purchaseOrder.purchaseRequest',
        'purchaseOrder.purchaseRequest.project',
        'items',
        'items.purchaseOrderItem',
      ],
      order: { createdAt: 'DESC' }
    });
  }

  async getAllPurchaseOrders() {
    const pos = await this.poRepo.find({
      relations: ['items', 'paymentTerms', 'vendor', 'purchaseRequest', 'purchaseRequest.project'],
      order: {
        createdAt: 'DESC',
        paymentTerms: {
          sequence: 'ASC',
        },
      },
    });

    pos.forEach((po) => {
      if (po.paymentTerms && Array.isArray(po.paymentTerms)) {
        po.paymentTerms.sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
      }
    });

    return pos;
  }

  async getAllPurchaseRequests() {
    return await this.prRepo.find({
      relations: ['items', 'project'],
      order: { createdAt: 'DESC' }
    });
  }
}
