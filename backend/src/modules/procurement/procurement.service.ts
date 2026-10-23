import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException, Logger, Inject, HttpException, HttpStatus, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, In, Not } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Rfq } from '../../entities/rfq.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { Vendor } from '../../entities/vendor.entity';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationItem } from '../../entities/quotation-item.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { PurchaseOrder, PurchaseOrderType } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { PoPaymentTerm, PaymentTermType, PaymentTermStatus } from '../../entities/po-payment-term.entity';
import { ServiceOrder, ServiceOrderDocumentType, ServiceOrderStatus } from '../../entities/service-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../../entities/goods-receipt-item.entity';
import { CreatePurchaseRequestDto } from './dto/create-pr.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { CreateGoodsReceiptDto } from './dto/create-gr.dto';
import { CreateVendorDto, UpdateVendorDto, VendorQueryDto } from './dto/vendor.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { CreateServiceOrderDto, UpdateServiceOrderDto, CancelServiceOrderDto, QueryServiceOrderDto } from './dto/service-order.dto';
import { ProcurementPackage, ProcurementPackageStatus } from '../../entities/procurement-package.entity';
import { ProcurementReconciliation, ProcurementReconciliationStatus } from '../../entities/procurement-reconciliation.entity';
import { randomUUID } from 'crypto';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';

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
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    @InjectRepository(ServiceOrder)
    private soRepo?: Repository<ServiceOrder>,
  ) {}

  async createAndSubmitPurchaseRequest(userId: number, dto: CreatePurchaseRequestDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate PR Number (Monotonic & Anti-Reuse: withDeleted + pessimistic lock)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const prPrefix = `PR-${dateStr}-`;
      const latestPr = await queryRunner.manager
        .createQueryBuilder(PurchaseRequest, 'pr')
        .withDeleted()
        .setLock('pessimistic_write')
        .where('pr.prNumber LIKE :prefix', { prefix: `${prPrefix}%` })
        .orderBy('LENGTH(pr.prNumber)', 'DESC')
        .addOrderBy('pr.prNumber', 'DESC')
        .getOne();

      let nextPrSeq = 1;
      if (latestPr && latestPr.prNumber) {
        const parts = latestPr.prNumber.split('-');
        if (parts.length >= 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed)) {
            nextPrSeq = parsed + 1;
          }
        }
      }
      const prNumber = `${prPrefix}${String(nextPrSeq).padStart(3, '0')}`;

      // WBS Budget Validation Check
      const wbsId = (dto as any).wbsId;
      if (wbsId) {
        const wbsRes = await queryRunner.manager.query(
          `SELECT budget_allocation, task_name FROM work_breakdown_structures WHERE id = $1 FOR UPDATE`,
          [wbsId]
        );
        if (wbsRes && wbsRes.length > 0) {
          const budgetAllocation = Number(wbsRes[0].budget_allocation || 0);
          const poSpentRes = await queryRunner.manager.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS spent 
             FROM purchase_orders 
             WHERE wbs_id = $1 AND status IN ('APPROVED', 'IN_PROGRESS')`,
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

      await queryRunner.commitTransaction();

      this.logger.log(`PR ${savedPr.id} (${prNumber}) created and submitted. Delegating to Workflow Engine.`);
      
      // 3. Emit event to RabbitMQ
      const payload = {
        entity_type: "PURCHASE_REQUEST",
        entity_id: savedPr.id,
        total_estimated_amount: savedPr.totalEstimatedAmount,
        initiator_user_id: userId
      };
      
      this.eventEmitter.emit('workflow.trigger', payload);
      this.logger.log(`Event Emitted: workflow.trigger for PR ${savedPr.id}`);
      
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
      `SELECT budget_allocation, task_name FROM work_breakdown_structures WHERE id = $1 FOR UPDATE`,
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
       WHERE wbs_id = $1 AND status IN ('APPROVED', 'IN_PROGRESS')`,
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

  async createRfq(dto: CreateRfqDto) {
    const pr = await this.prRepo.findOne({ where: { id: dto.purchaseRequestId } });
    if (!pr) {
      throw new BadRequestException('Purchase Request not found');
    }

    // Pre-check: PR must not already have an active (non-cancelled) RFQ
    const existingActiveRfq = await this.rfqRepo.findOne({
      where: {
        prId: dto.purchaseRequestId,
        status: Not('CANCELLED'),
      },
    });
    if (existingActiveRfq) {
      throw new BadRequestException(
        `Purchase Request already has active RFQ ${existingActiveRfq.rfqNumber || existingActiveRfq.id}.`,
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      // In-transaction guard against concurrent active RFQ creation
      const inTxActiveRfq = await manager.findOne(Rfq, {
        where: {
          prId: dto.purchaseRequestId,
          status: Not('CANCELLED'),
        },
      });
      if (inTxActiveRfq) {
        throw new BadRequestException(
          `Purchase Request already has active RFQ ${inTxActiveRfq.rfqNumber || inTxActiveRfq.id}.`,
        );
      }

      // Auto generate RFQ Number (Monotonic & Anti-Reuse: withDeleted + pessimistic lock)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rfqPrefix = `RFQ-${dateStr}-`;
      const latestRfq = await manager
        .createQueryBuilder(Rfq, 'rfq')
        .withDeleted()
        .setLock('pessimistic_write')
        .where('rfq.rfqNumber LIKE :prefix', { prefix: `${rfqPrefix}%` })
        .orderBy('LENGTH(rfq.rfqNumber)', 'DESC')
        .addOrderBy('rfq.rfqNumber', 'DESC')
        .getOne();

      let nextRfqSeq = 1;
      if (latestRfq && latestRfq.rfqNumber) {
        const parts = latestRfq.rfqNumber.split('-');
        if (parts.length >= 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed)) {
            nextRfqSeq = parsed + 1;
          }
        }
      }
      const rfqNumber = `${rfqPrefix}${String(nextRfqSeq).padStart(3, '0')}`;

      const rfq = manager.create(Rfq, {
        prId: dto.purchaseRequestId,
        rfqNumber,
        closingDate: dto.closingDate,
        status: 'OPEN'
      });
      
      const savedRfq = await manager.save(Rfq, rfq);

      return {
        success: true,
        message: 'RFQ created successfully',
        data: savedRfq
      };
    });
  }

  async cancelRfq(rfqId: number, userId: number, roles: string[] = [], reason: string) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Alasan pembatalan RFQ wajib diisi.');
    }

    const normalizedRoles = (Array.isArray(roles) ? roles : []).map((r) =>
      String(r).toUpperCase(),
    );

    // Explicit administrative & non-procurement role block (Multi-Role Deny Protection)
    const hasForbiddenRole = normalizedRoles.some((r) =>
      ['ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER', 'DIRECTOR', 'HEAD_OF_OPERATIONS'].includes(r),
    );
    if (hasForbiddenRole) {
      throw new ForbiddenException(
        'Peran administratif atau non-procurement dilarang melakukan pembatalan RFQ.',
      );
    }

    const isAuthorized = normalizedRoles.some((r) =>
      ['PROCUREMENT', 'PURCHASING'].includes(r),
    );
    if (!isAuthorized) {
      throw new ForbiddenException(
        'Hanya peran PROCUREMENT atau PURCHASING yang berhak membatalkan RFQ.',
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      const rfq = await manager.findOne(Rfq, {
        where: { id: rfqId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!rfq) {
        throw new NotFoundException(`RFQ #${rfqId} tidak ditemukan.`);
      }

      if (rfq.status === 'CANCELLED') {
        return { success: true, message: `RFQ #${rfq.rfqNumber} sudah dalam status CANCELLED.`, data: rfq };
      }

      if (rfq.status !== 'OPEN') {
        throw new BadRequestException(`Hanya RFQ berstatus OPEN yang dapat dibatalkan. Status saat ini: ${rfq.status}.`);
      }

      // Ensure no PO has been created from this RFQ
      const existingPo = await manager.findOne(PurchaseOrder, {
        where: { purchaseRequestId: rfq.prId, status: In(['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED']) },
      });
      if (existingPo) {
        throw new BadRequestException(`Tidak dapat membatalkan RFQ #${rfq.rfqNumber} karena telah diterbitkan Purchase Order #${existingPo.poNumber}.`);
      }

      const oldStatus = rfq.status;
      rfq.status = 'CANCELLED';
      rfq.updatedBy = userId;
      const savedRfq = await manager.save(Rfq, rfq);

      const audit = manager.create(AuditLog, {
        table_name: 'rfqs',
        record_id: savedRfq.id,
        action: 'CANCEL_RFQ',
        old_value: { status: oldStatus },
        new_value: { status: 'CANCELLED', reason: reason.trim() },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      this.logger.log(`RFQ #${savedRfq.id} (${savedRfq.rfqNumber}) cancelled by User #${userId}. Reason: ${reason}`);

      return {
        success: true,
        message: `RFQ #${savedRfq.rfqNumber} berhasil dibatalkan.`,
        data: savedRfq,
      };
    });
  }

  async cancelPurchaseRequest(prId: number, userId: number, roles: string[] = [], reason: string) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Alasan pembatalan PR wajib diisi.');
    }

    return await this.dataSource.transaction(async (manager) => {
      const pr = await manager.findOne(PurchaseRequest, {
        where: { id: prId },
        relations: ['rfqs'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!pr) {
        throw new NotFoundException(`Purchase Request #${prId} tidak ditemukan.`);
      }

      if (pr.status === 'CANCELLED') {
        return { success: true, message: `PR #${pr.prNumber} sudah dalam status CANCELLED.`, data: pr };
      }

      if (pr.status === 'PO_ISSUED') {
        throw new BadRequestException(`PR #${pr.prNumber} telah diterbitkan PO dan tidak dapat dibatalkan.`);
      }

      // Check linked active POs
      const activePo = await manager.findOne(PurchaseOrder, {
        where: { purchaseRequestId: pr.id, status: In(['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED']) },
      });
      if (activePo) {
        throw new BadRequestException(`PR #${pr.prNumber} memiliki PO aktif #${activePo.poNumber} dan tidak dapat dibatalkan.`);
      }

      // Automatically cancel any open linked RFQs in dependency order
      const openRfqs = (pr.rfqs || []).filter((r: Rfq) => r.status === 'OPEN');
      for (const rfq of openRfqs) {
        rfq.status = 'CANCELLED';
        rfq.updatedBy = userId;
        await manager.save(Rfq, rfq);

        const rfqAudit = manager.create(AuditLog, {
          table_name: 'rfqs',
          record_id: rfq.id,
          action: 'CANCEL_RFQ',
          old_value: { status: 'OPEN' },
          new_value: { status: 'CANCELLED', reason: `Dibatalkan mengikuti pembatalan PR #${pr.prNumber}: ${reason.trim()}` },
          created_by: userId,
        });
        await manager.save(AuditLog, rfqAudit);
      }

      const oldStatus = pr.status;
      pr.status = 'CANCELLED';
      pr.updatedBy = userId;
      const savedPr = await manager.save(PurchaseRequest, pr);

      const prAudit = manager.create(AuditLog, {
        table_name: 'purchase_requests',
        record_id: savedPr.id,
        action: 'CANCEL_PR',
        old_value: { status: oldStatus },
        new_value: { status: 'CANCELLED', reason: reason.trim() },
        created_by: userId,
      });
      await manager.save(AuditLog, prAudit);

      // Synchronize linked package if packageId exists
      let syncedPackage: ProcurementPackage | null = null;
      if (pr.packageId) {
        const pkg = await manager.findOne(ProcurementPackage, {
          where: { id: pr.packageId },
          lock: { mode: 'pessimistic_write' },
        });

        if (pkg && pkg.status !== ProcurementPackageStatus.CANCELLED) {
          const oldPkgStatus = pkg.status;
          pkg.status = ProcurementPackageStatus.CANCELLED;
          pkg.rejectionNotes = reason.trim();
          pkg.updatedBy = userId;
          syncedPackage = await manager.save(ProcurementPackage, pkg);

          const pkgAudit = manager.create(AuditLog, {
            table_name: 'procurement_packages',
            record_id: pkg.id,
            action: 'CANCEL_PACKAGE',
            old_value: { status: oldPkgStatus },
            new_value: { status: 'CANCELLED', reason: reason.trim(), prId: savedPr.id },
            created_by: userId,
          });
          await manager.save(AuditLog, pkgAudit);

          this.logger.log(`Package #${pkg.id} (${pkg.packageNumber}) synchronized to CANCELLED following cancellation of PR #${savedPr.id}. Quota released.`);
        }
      }

      return {
        success: true,
        message: `PR #${savedPr.prNumber} berhasil dibatalkan beserta RFQ dan paket terkait.`,
        data: {
          purchaseRequest: savedPr,
          package: syncedPackage,
        },
      };
    });
  }

  async submitVendorComparison(rfqId: number, vendorsData: any[]) {
    // 1. Get PR amount to apply business rule
    let totalEstimatedAmount = 0;
    const rfqRecords = await this.dataSource.query('SELECT pr_id FROM rfqs WHERE id = ?', [rfqId]);
    
    if (rfqRecords.length > 0) {
      const pr = await this.prRepo.findOne({ where: { id: rfqRecords[0].pr_id } });
      if (pr) totalEstimatedAmount = pr.totalEstimatedAmount;
    } else {
      // Fallback if rfqId is actually purchase_request_id
      const pr = await this.prRepo.findOne({ where: { id: rfqId } });
      if (pr) totalEstimatedAmount = pr.totalEstimatedAmount;
    }

    if (totalEstimatedAmount > 1000000 && vendorsData.length < 3) {
      throw new BadRequestException('Minimal 3 vendor diperlukan untuk perbandingan pengadaan di atas Rp 1.000.000');
    }
    
    const winners = vendorsData.filter(v => v.isWinner);
    if (winners.length !== 1) {
      throw new BadRequestException('Exactly 1 vendor must be selected as the winner.');
    }

    this.logger.log(`Vendor comparison submitted for RFQ ${rfqId}. Winner: ${winners[0].vendorId}`);
    
    // Save to DB
    const comparisons = vendorsData.map(v => this.vendorComparisonRepo.create({
      rfqId,
      vendorId: v.vendorId,
      offeredAmount: v.offeredAmount,
      isWinner: v.isWinner,
    }));
    await this.vendorComparisonRepo.save(comparisons);

    // Terminalize RFQ to EVALUATED upon winning vendor comparison
    if (this.rfqRepo && typeof this.rfqRepo.update === 'function') {
      await this.rfqRepo.update({ id: rfqId }, { status: 'EVALUATED' });
    }

    return {
      success: true,
      message: 'Vendor comparison submitted successfully',
      data: comparisons
    };
  }

  async resolvePurchaseRequestDomain(prId: number): Promise<'MATERIAL' | 'SERVICE'> {
    try {
      const rows = await this.dataSource.query(
        `SELECT COALESCE(
           MAX(CASE 
             WHEN ci_direct.resource_type = 'SERVICE' THEN 'SERVICE'
             WHEN ci_direct.resource_type = 'MATERIAL' THEN 'MATERIAL'
             WHEN ci_direct.category_key IN ('SUBCONTRACTOR', 'SERVICE') THEN 'SERVICE'
             WHEN ci_direct.category_key = 'MATERIAL' THEN 'MATERIAL'
             WHEN ci_direct.category_key IN ('EQUIPMENT', 'OPERATIONAL') AND ci_direct.resource_type = 'SERVICE' THEN 'SERVICE'
           END),
           MAX(CASE 
             WHEN ci_pkg.resource_type = 'SERVICE' THEN 'SERVICE'
             WHEN ci_pkg.resource_type = 'MATERIAL' THEN 'MATERIAL'
             WHEN ci_pkg.category_key IN ('SUBCONTRACTOR', 'SERVICE') THEN 'SERVICE'
             WHEN ci_pkg.category_key = 'MATERIAL' THEN 'MATERIAL'
             WHEN ci_pkg.category_key IN ('EQUIPMENT', 'OPERATIONAL') AND ci_pkg.resource_type = 'SERVICE' THEN 'SERVICE'
           END),
           'MATERIAL'
         ) AS domain
         FROM purchase_requests pr
         LEFT JOIN purchase_request_items pri ON pr.id = pri.pr_id
         LEFT JOIN cost_items ci_direct ON pri.cost_item_id = ci_direct.id
         LEFT JOIN procurement_package_items pki ON pri.package_item_id = pki.id
         LEFT JOIN cost_items ci_pkg ON pki.cost_item_id = ci_pkg.id
         WHERE pr.id = ? AND pr.deleted_at IS NULL`,
        [prId],
      );
      return rows?.[0]?.domain === 'SERVICE' ? 'SERVICE' : 'MATERIAL';
    } catch (err) {
      return 'MATERIAL';
    }
  }

  async createPurchaseOrder(userId: number, dto: CreatePurchaseOrderDto) {
    // 1. Fetch PR by purchase_request_id and validate status
    const pr = await this.prRepo.findOne({
      where: { id: dto.purchase_request_id },
      relations: ['items'],
    });
    if (!pr) throw new BadRequestException('Purchase Request not found');
    if (pr.status !== 'APPROVED') {
      throw new BadRequestException('Purchase Request is not APPROVED yet');
    }

    // 2. Authoritative Domain Resolution (MATERIAL vs SERVICE)
    const domain = await this.resolvePurchaseRequestDomain(pr.id);
    const isService = domain === 'SERVICE';

    // 3. Vendor Validation
    if (!dto.vendor_id) {
      throw new BadRequestException('Vendor wajib dipilih untuk penerbitan Purchase Order');
    }
    if (this.vendorRepo && typeof this.vendorRepo.findOne === 'function') {
      const vendor = await this.vendorRepo.findOne({ where: { id: dto.vendor_id } });
      if (!vendor) {
        throw new BadRequestException(`Vendor #${dto.vendor_id} tidak ditemukan.`);
      }
    }

    // 4. Sourcing & Winner Validation
    const rfqs = await this.rfqRepo.find({ where: { prId: pr.id } });
    const rfqIds = rfqs.map((r) => r.id);

    let isWinner: any = null;

    if (!isService) {
      // MATERIAL PO: Strictly requires evaluated RFQ and winning vendor comparison
      if (rfqIds.length === 0) {
        throw new BadRequestException('No RFQs found for this Purchase Request');
      }

      isWinner = await this.vendorComparisonRepo
        .createQueryBuilder('vc')
        .where('vc.rfqId IN (:...rfqIds)', { rfqIds })
        .andWhere('vc.vendorId = :vendorId', { vendorId: dto.vendor_id })
        .andWhere('vc.isWinner = :isWinner', { isWinner: true })
        .getOne();

      if (!isWinner) {
        throw new BadRequestException('The selected vendor is not the winner for this PR');
      }
    } else {
      // SERVICE PO:
      // Sourcing mode determination:
      // 1. Direct Service PO: allowed when NO active/evaluated RFQ exists (rfqs is empty OR all rfqs are CANCELLED).
      // 2. Competitive Service PO: when an RFQ is in progress (OPEN) or evaluated (EVALUATED),
      //    it strictly requires an evaluated winning vendor comparison.
      // An active RFQ cannot be left orphaned by creating a direct Service PO.
      const nonCancelledRfqs = rfqs.filter((r) => r.status !== 'CANCELLED');

      if (nonCancelledRfqs.length > 0) {
        const rfqIdsToMatch = nonCancelledRfqs.map((r) => r.id);
        isWinner = await this.vendorComparisonRepo
          .createQueryBuilder('vc')
          .where('vc.rfqId IN (:...rfqIdsToMatch)', { rfqIdsToMatch })
          .andWhere('vc.vendorId = :vendorId', { vendorId: dto.vendor_id })
          .andWhere('vc.isWinner = :isWinner', { isWinner: true })
          .getOne();

        if (!isWinner) {
          const openRfq = nonCancelledRfqs.find((r) => r.status === 'OPEN');
          if (openRfq) {
            throw new BadRequestException(
              `Purchase Request Jasa ini memiliki RFQ aktif (${openRfq.rfqNumber}). Batalkan (CANCEL) RFQ terlebih dahulu untuk beralih ke jalur Direct PO, atau selesaikan evaluasi pemenang RFQ untuk jalur kompetitif.`,
            );
          } else {
            throw new BadRequestException(
              'Vendor yang dipilih bukan pemenang evaluasi RFQ Jasa untuk Purchase Request ini.',
            );
          }
        }
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 5. Auto-generate PO Number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await queryRunner.manager.count(PurchaseOrder, {
        where: { poNumber: require('typeorm').Like(`PO-${dateStr}-%`) }
      });
      const seq = String(countToday + 1).padStart(3, '0');
      const poNumber = `PO-${dateStr}-${seq}`;

      let totalAmount = 0;
      if (dto.po_items && dto.po_items.length > 0) {
        for (const item of dto.po_items) {
          totalAmount += Number(item.total_price);
        }
      } else if (rfqIds.length > 0) {
        const quote = await queryRunner.manager.findOne(Quotation, {
          where: { rfqId: In(rfqIds), vendorId: dto.vendor_id },
          relations: ['items'],
        });
        if (quote && quote.items && quote.items.length > 0) {
          for (const qi of quote.items) {
            totalAmount += Number(qi.quantity || 0) * Number(qi.unitPrice || 0);
          }
        }
      } else if (pr.items && pr.items.length > 0) {
        // Direct Service PO: derive total amount from PR items
        for (const pi of pr.items) {
          totalAmount += Number(pi.quantity || 0) * Number(pi.estimatedUnitPrice || 0);
        }
      } else {
        totalAmount = Number(pr.totalEstimatedAmount || 0);
      }
      totalAmount = Math.round(totalAmount * 100) / 100;

      // Payment Terms Validation & SSOT Amount Calculation
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
      let allocatedAmount = 0;
      const calculatedTerms = sortedTerms.map((term, index) => {
        const isLast = index === sortedTerms.length - 1;
        const pct = Number(term.percentage);
        let termAmount: number;

        if (isLast) {
          termAmount = Math.round((totalAmount - allocatedAmount) * 100) / 100;
        } else {
          termAmount = Math.round(((totalAmount * pct) / 100) * 100) / 100;
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

      const po = queryRunner.manager.create(PurchaseOrder, {
        purchaseRequestId: pr.id,
        vendorId: dto.vendor_id,
        poNumber,
        orderType: isService ? PurchaseOrderType.SERVICE : PurchaseOrderType.MATERIAL,
        totalAmount,
        status: 'ISSUED',
        deliveryLocation: dto.delivery_location || (isService ? 'Lokasi Proyek / Lapangan' : undefined),
        deliveryDate: dto.delivery_date,
        notes: dto.notes ? dto.notes.trim() : (isService ? `[Pengadaan Jasa - ${isWinner ? 'Kompetitif RFQ' : 'Penunjukan Langsung'}]` : undefined),
        createdBy: userId,
      });

      const savedPo = await queryRunner.manager.save(po);

      let items: PurchaseOrderItem[] = [];
      if (dto.po_items && dto.po_items.length > 0) {
        items = dto.po_items.map((item, idx) => {
          const matchingPrItem = (pr.items || []).find(
            (pi) =>
              (item.pr_item_id && Number(pi.id) === Number(item.pr_item_id)) ||
              (pi.itemName && item.item_name && pi.itemName.trim() === item.item_name.trim()),
          ) || (pr.items || [])[idx];
          return queryRunner.manager.create(PurchaseOrderItem, {
            purchaseOrderId: savedPo.id,
            prItemId: matchingPrItem ? matchingPrItem.id : (item.pr_item_id || null),
            costItemId: matchingPrItem ? matchingPrItem.costItemId : (item.cost_item_id || null),
            itemName: item.item_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
            uom: (item as any).uom || matchingPrItem?.uom || 'Unit',
          });
        });
        await queryRunner.manager.save(items);
      } else if (pr.items && pr.items.length > 0) {
        // Direct Service PO: derive items from PR items
        items = pr.items.map((pi) => {
          const qty = Number(pi.quantity || 0);
          const price = Number(pi.estimatedUnitPrice || 0);
          return queryRunner.manager.create(PurchaseOrderItem, {
            purchaseOrderId: savedPo.id,
            prItemId: pi.id,
            costItemId: pi.costItemId || null,
            itemName: pi.itemName,
            quantity: qty,
            unitPrice: price,
            totalPrice: Math.round(qty * price * 100) / 100,
            uom: pi.uom || 'Unit',
          });
        });
        await queryRunner.manager.save(items);
      }

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

      const savedPaymentTerms = await queryRunner.manager.save(PoPaymentTerm, paymentTermsToSave);

      // 4. Update PR Status
      pr.status = 'PO_ISSUED';
      await queryRunner.manager.save(pr);

      // Terminalize ONLY the evaluated source RFQ associated with this winning comparison
      if (isWinner && isWinner.rfqId) {
        const targetRfqId = isWinner.rfqId;
        if (typeof queryRunner.manager.update === 'function') {
          await queryRunner.manager.update(Rfq, { id: targetRfqId, status: 'OPEN' }, { status: 'EVALUATED' });
        } else if (this.rfqRepo && typeof this.rfqRepo.update === 'function') {
          await this.rfqRepo.update({ id: targetRfqId, status: 'OPEN' }, { status: 'EVALUATED' });
        }
      }

      await queryRunner.commitTransaction();

      // 5. Emit canonical and domain events
      const poIssuedEvent: BusinessEvent = {
        eventId: randomUUID(),
        eventName: 'procurement.po.issued',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PurchaseOrder',
        aggregateId: savedPo.id,
        projectId: pr?.projectId ? Number(pr.projectId) : undefined,
        routing: {
          roles: ['PROCUREMENT', 'PURCHASING', 'FINANCE', 'SUPER_ADMIN'],
        },
        payload: {
          poId: savedPo.id,
          poNumber: savedPo.poNumber,
          vendorId: dto.vendor_id,
          status: savedPo.status,
          totalAmount: savedPo.totalAmount,
        },
      };
      this.eventEmitter.emit('procurement.po.issued', poIssuedEvent);
      this.eventEmitter.emit('po.created', {
        purchase_order_id: savedPo.id,
        vendor_id: dto.vendor_id
      });
      this.logger.log(`Canonical Business Event Emitted: procurement.po.issued for PO ${savedPo.id}`);

      return {
        success: true,
        message: 'Purchase Order created successfully',
        data: {
          ...savedPo,
          items,
          paymentTerms: savedPaymentTerms || paymentTermsToSave,
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
      relations: [
        'items',
        'paymentTerms',
        'vendor',
        'purchaseRequest',
        'purchaseRequest.project',
      ],
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
      // 1. Fetch PO with Items
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: dto.purchaseOrderId },
        relations: ['items']
      });

      if (!po) {
        throw new BadRequestException('Purchase Order not found');
      }

      if (po.orderType === PurchaseOrderType.SERVICE) {
        throw new BadRequestException('Purchase Order bertipe SERVICE tidak dapat diproses Penerimaan Barang (GR). Gunakan alur Klaim Jasa.');
      }

      if (po.status !== 'ISSUED' && po.status !== 'PARTIALLY_FULFILLED') {
        throw new BadRequestException(`Cannot receive goods for PO with status ${po.status}`);
      }

      // Guard: Items array must not be empty
      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Goods Receipt must contain at least one item');
      }

      // 2. Validate Items & Calculate totalReceivedAmount
      let totalReceivedAmount = 0;
      let atLeastOneItemReceived = false;

      for (const itemDto of dto.items) {
        const poItem = po.items.find(i => i.id === itemDto.poItemId);
        if (!poItem) {
          throw new BadRequestException(`PO Item ${itemDto.poItemId} does not belong to PO ${po.id}`);
        }

        const remainingQty = Number(poItem.quantity) - Number(poItem.receivedQuantity);
        if (Number(itemDto.receivedQuantity) > remainingQty) {
          throw new BadRequestException(`Cannot receive ${itemDto.receivedQuantity} for item ${poItem.id}. Remaining quantity is ${remainingQty}`);
        }

        if (Number(itemDto.receivedQuantity) > 0) {
          atLeastOneItemReceived = true;
          const unitPrice = Number(poItem.unitPrice || 0);
          const itemAmount = Number((Number(itemDto.receivedQuantity) * unitPrice).toFixed(2));
          totalReceivedAmount = Number((totalReceivedAmount + itemAmount).toFixed(2));
        }
      }

      if (!atLeastOneItemReceived) {
        throw new BadRequestException('At least one item must have receivedQuantity > 0');
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
        if (Number(itemDto.receivedQuantity) <= 0) continue;

        const poItem = po.items.find(i => i.id === itemDto.poItemId)!;

        // Create GR Item
        grItemsToSave.push(queryRunner.manager.create(GoodsReceiptItem, {
          grId: savedGr.id,
          poItemId: poItem.id,
          receivedQuantity: itemDto.receivedQuantity,
          remarks: itemDto.remarks,
          createdBy: userId
        }));

        // Update PO Item received quantity
        poItem.receivedQuantity = Number(poItem.receivedQuantity) + Number(itemDto.receivedQuantity);
        await queryRunner.manager.save(poItem);
      }

      await queryRunner.manager.save(grItemsToSave);

      // 6. Calculate new PO Status
      let allItemsCompleted = true;
      let anyItemReceived = false;
      for (const poItem of po.items) {
        if (Number(poItem.receivedQuantity) < Number(poItem.quantity)) {
          allItemsCompleted = false;
        }
        if (Number(poItem.receivedQuantity) > 0) {
          anyItemReceived = true;
        }
      }

      const originalStatus = po.status;
      if (allItemsCompleted) {
        po.status = 'COMPLETED';
      } else if (anyItemReceived) {
        po.status = 'PARTIALLY_FULFILLED';
      }

      if (po.status !== originalStatus) {
        await queryRunner.manager.save(po);
      }

      await queryRunner.commitTransaction();

      // 7. Emit events: legacy gr.created for existing ProcurementEventListener package closure, and canonical procurement.gr.received for BusinessSync
      this.eventEmitter.emit('gr.created', {
        gr_id: savedGr.id,
        po_id: po.id
      });
      const grReceivedEvent: BusinessEvent = {
        eventId: randomUUID(),
        eventName: 'procurement.gr.received',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'GoodsReceipt',
        aggregateId: savedGr.id,
        routing: {
          roles: ['PROCUREMENT', 'PURCHASING', 'FINANCE', 'SUPER_ADMIN'],
        },
        payload: {
          grId: savedGr.id,
          grNumber: savedGr.grNumber,
          poId: po.id,
          poNumber: po.poNumber,
          status: po.status,
        },
      };
      this.eventEmitter.emit('procurement.gr.received', grReceivedEvent);
      this.logger.log(`Canonical Business Event Emitted: procurement.gr.received for GR ${savedGr.id}`);

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
    return this.grRepo.find({
      relations: [
        'items',
        'items.purchaseOrderItem',
        'purchaseOrder',
        'purchaseOrder.vendor',
        'purchaseOrder.purchaseRequest',
        'purchaseOrder.purchaseRequest.project',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async getDashboardSummary() {
    const [prCount, poCount, grCount, packageQueueCount] = await Promise.all([
      this.prRepo.count(),
      this.poRepo.count(),
      this.grRepo.count(),
      this.dataSource.getRepository(ProcurementPackage).count({
        where: { status: ProcurementPackageStatus.SUBMITTED },
      }),
    ]);

    let reconciliationCount = 0;
    try {
      reconciliationCount = await this.dataSource
        .getRepository(PurchaseRequestItem)
        .createQueryBuilder('pri')
        .innerJoin('pri.purchaseRequest', 'pr')
        .leftJoin(
          ProcurementReconciliation,
          'rec',
          'rec.pr_item_id = pri.id',
        )
        .where('pr.origin IN (:...origins)', { origins: ['LEGACY', 'AD_HOC'] })
        .andWhere('pr.status != :rejectedStatus', { rejectedStatus: 'REJECTED' })
        .andWhere('pr.deletedAt IS NULL')
        .andWhere(
          '(pri.cost_item_id IS NULL OR rec.status IS NULL OR rec.status = :pendingStatus)',
          { pendingStatus: ProcurementReconciliationStatus.PENDING },
        )
        .andWhere(
          '(rec.status IS NULL OR rec.status NOT IN (:...terminalStatuses))',
          {
            terminalStatuses: [
              ProcurementReconciliationStatus.RECONCILED,
              ProcurementReconciliationStatus.EXCLUDED,
            ],
          },
        )
        .getCount();
    } catch (e: any) {
      this.logger.warn(`Failed to count reconciliations: ${e?.message || e}`);
      reconciliationCount = 0;
    }

    return {
      packageQueueCount,
      reconciliationCount,
      purchaseRequestCount: prCount,
      purchaseOrderCount: poCount,
      goodsReceiptCount: grCount,
    };
  }

  async getAllPurchaseOrders() {
    const pos = await this.poRepo.find({
      relations: [
        'items',
        'paymentTerms',
        'vendor',
        'purchaseRequest',
        'purchaseRequest.project',
      ],
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
    const prs = await this.prRepo.find({
      relations: ['items', 'project'],
      order: { createdAt: 'DESC' },
    });

    if (!prs || prs.length === 0) return [];

    try {
      const rows = await this.dataSource.query(
        `SELECT pr.id,
           COALESCE(
             MAX(CASE WHEN ci_direct.resource_type = 'SERVICE' OR (ci_direct.category_key = 'SUBCONTRACTOR' AND (ci_direct.resource_type IS NULL OR ci_direct.resource_type != 'MATERIAL')) THEN 'SERVICE' END),
             MAX(CASE WHEN ci_pkg.resource_type = 'SERVICE' OR (ci_pkg.category_key = 'SUBCONTRACTOR' AND (ci_pkg.resource_type IS NULL OR ci_pkg.resource_type != 'MATERIAL')) THEN 'SERVICE' END),
             'MATERIAL'
           ) AS domain
         FROM purchase_requests pr
         LEFT JOIN purchase_request_items pri ON pr.id = pri.pr_id
         LEFT JOIN cost_items ci_direct ON pri.cost_item_id = ci_direct.id
         LEFT JOIN procurement_package_items pki ON pri.package_item_id = pki.id
         LEFT JOIN cost_items ci_pkg ON pki.cost_item_id = ci_pkg.id
         WHERE pr.deleted_at IS NULL
         GROUP BY pr.id`,
      );
      const domainMap = new Map<number, 'MATERIAL' | 'SERVICE'>();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          domainMap.set(Number(row.id), row.domain === 'SERVICE' ? 'SERVICE' : 'MATERIAL');
        }
      }

      return prs.map((pr) => ({
        ...pr,
        domain: domainMap.get(Number(pr.id)) || 'MATERIAL',
      }));
    } catch (err) {
      return prs.map((pr) => ({
        ...pr,
        domain: 'MATERIAL',
      }));
    }
  }

  async getPurchaseRequestById(id: number) {
    const pr = await this.prRepo.findOne({
      where: { id },
      relations: ['items', 'project'],
    });
    if (!pr) {
      throw new NotFoundException(`Purchase Request #${id} tidak ditemukan`);
    }

    const domain = await this.resolvePurchaseRequestDomain(id);

    return {
      success: true,
      message: 'Purchase Request retrieved successfully',
      data: {
        ...pr,
        domain,
      },
    };
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

  async createQuotation(dto: CreateQuotationDto, userId?: number) {
    const maxRetries = 3;
    let savedQuotationId: number | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 1. Acquire row-level lock on the RFQ inside transaction
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

        // 2c. RFQ must be OPEN
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

        // 4. In-transaction duplicate active/submitted quotation check
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

        // 6. Authoritative server-side total calculation
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

    return await this.getQuotationById(savedQuotationId);
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
      // 1. Lock and find the current maximum numeric sequence for canonical VND-XXX codes
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

  // =============================================================
  // SERVICE ORDER (SPK / WORK ORDER) METHODS
  // =============================================================

  private getSoRepo(): Repository<ServiceOrder> {
    return this.soRepo || this.dataSource.getRepository(ServiceOrder);
  }

  async getServiceOrders(query?: QueryServiceOrderDto) {
    const qb = this.getSoRepo().createQueryBuilder('so')
      .leftJoinAndSelect('so.purchaseOrder', 'po')
      .leftJoinAndSelect('so.project', 'project')
      .leftJoinAndSelect('so.vendor', 'vendor')
      .orderBy('so.createdAt', 'DESC');

    if (query?.projectId) {
      qb.andWhere('so.projectId = :projectId', { projectId: query.projectId });
    }
    if (query?.purchaseOrderId) {
      qb.andWhere('so.purchaseOrderId = :purchaseOrderId', { purchaseOrderId: query.purchaseOrderId });
    }
    if (query?.vendorId) {
      qb.andWhere('so.vendorId = :vendorId', { vendorId: query.vendorId });
    }
    if (query?.status) {
      qb.andWhere('so.status = :status', { status: query.status });
    }
    if (query?.documentType) {
      qb.andWhere('so.documentType = :documentType', { documentType: query.documentType });
    }

    return await qb.getMany();
  }

  async getServiceOrdersByPo(poId: number) {
    return await this.getSoRepo().find({
      where: { purchaseOrderId: poId },
      relations: ['purchaseOrder', 'project', 'vendor'],
      order: { createdAt: 'DESC' },
    });
  }

  async getServiceOrderById(id: number) {
    const so = await this.getSoRepo().findOne({
      where: { id },
      relations: ['purchaseOrder', 'project', 'vendor'],
    });
    if (!so) {
      throw new NotFoundException(`Service Order #${id} tidak ditemukan.`);
    }
    return so;
  }

  async createServiceOrder(userId: number, dto: CreateServiceOrderDto) {
    const po = await this.poRepo.findOne({
      where: { id: dto.purchaseOrderId },
      relations: ['purchaseRequest'],
    });
    if (!po) {
      throw new NotFoundException(`Purchase Order #${dto.purchaseOrderId} tidak ditemukan.`);
    }
    if (po.orderType !== PurchaseOrderType.SERVICE) {
      throw new BadRequestException('Service Order (SPK) hanya dapat diterbitkan untuk Purchase Order bertipe SERVICE.');
    }
    if (!['ISSUED', 'PARTIALLY_FULFILLED', 'FULFILLED'].includes(po.status)) {
      throw new BadRequestException(`Purchase Order dengan status ${po.status} tidak dapat diterbitkan Service Order.`);
    }

    const projectId = po.purchaseRequest?.projectId;
    if (!projectId) {
      throw new BadRequestException('Project ID tidak terhubung pada Purchase Order ini.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = dto.documentType === ServiceOrderDocumentType.WORK_ORDER ? `WO-${dateStr}-` : `SPK-${dateStr}-`;

      const countToday = await queryRunner.manager.count(ServiceOrder, {
        where: { serviceOrderNumber: Like(`${prefix}%`) },
      });
      const seq = String(countToday + 1).padStart(3, '0');
      const serviceOrderNumber = `${prefix}${seq}`;

      const so = queryRunner.manager.create(ServiceOrder, {
        serviceOrderNumber,
        documentType: dto.documentType,
        purchaseOrderId: po.id,
        projectId,
        vendorId: po.vendorId,
        scopeOfWork: dto.scopeOfWork.trim(),
        workLocation: dto.workLocation?.trim() || null,
        startDate: dto.startDate || null,
        endDate: dto.endDate || null,
        notes: dto.notes?.trim() || null,
        status: ServiceOrderStatus.DRAFT,
        createdBy: userId,
      });

      const savedSo = await queryRunner.manager.save(ServiceOrder, so);
      await queryRunner.commitTransaction();

      this.eventEmitter.emit('audit.log', {
        action: 'CREATE',
        entityId: savedSo.id,
        entityName: 'service_orders',
        newValue: savedSo,
        userId,
      });

      return {
        success: true,
        message: `${dto.documentType} draft berhasil dibuat.`,
        data: savedSo,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateServiceOrder(id: number, userId: number, dto: UpdateServiceOrderDto) {
    const soRepo = this.getSoRepo();
    const so = await soRepo.findOne({ where: { id } });
    if (!so) {
      throw new NotFoundException(`Service Order #${id} tidak ditemukan.`);
    }
    if (so.status !== ServiceOrderStatus.DRAFT) {
      throw new BadRequestException(`Service Order berstatus ${so.status} tidak dapat diedit. Hanya status DRAFT yang dapat dimodifikasi.`);
    }

    if (dto.documentType) so.documentType = dto.documentType;
    if (dto.scopeOfWork) so.scopeOfWork = dto.scopeOfWork.trim();
    if (dto.workLocation !== undefined) so.workLocation = dto.workLocation?.trim() || null;
    if (dto.startDate !== undefined) so.startDate = dto.startDate || null;
    if (dto.endDate !== undefined) so.endDate = dto.endDate || null;
    if (dto.notes !== undefined) so.notes = dto.notes?.trim() || null;
    so.updatedBy = userId;

    const savedSo = await soRepo.save(so);

    this.eventEmitter.emit('audit.log', {
      action: 'UPDATE',
      entityId: savedSo.id,
      entityName: 'service_orders',
      newValue: savedSo,
      userId,
    });

    return {
      success: true,
      message: 'Service Order berhasil diperbarui.',
      data: savedSo,
    };
  }

  async issueServiceOrder(id: number, userId: number) {
    const soRepo = this.getSoRepo();
    const so = await soRepo.findOne({ where: { id } });
    if (!so) {
      throw new NotFoundException(`Service Order #${id} tidak ditemukan.`);
    }
    if (so.status !== ServiceOrderStatus.DRAFT) {
      throw new BadRequestException(`Service Order berstatus ${so.status} tidak dapat diterbitkan. Hanya status DRAFT yang dapat di-issue.`);
    }

    so.status = ServiceOrderStatus.ISSUED;
    so.issuedAt = new Date();
    so.issuedBy = userId;
    so.updatedBy = userId;

    const savedSo = await soRepo.save(so);

    this.eventEmitter.emit('audit.log', {
      action: 'ISSUE',
      entityId: savedSo.id,
      entityName: 'service_orders',
      newValue: savedSo,
      userId,
    });

    return {
      success: true,
      message: `Service Order ${savedSo.serviceOrderNumber} berhasil diterbitkan (ISSUED).`,
      data: savedSo,
    };
  }

  async cancelServiceOrder(id: number, userId: number, dto: CancelServiceOrderDto) {
    const soRepo = this.getSoRepo();
    const so = await soRepo.findOne({ where: { id } });
    if (!so) {
      throw new NotFoundException(`Service Order #${id} tidak ditemukan.`);
    }
    if (so.status === ServiceOrderStatus.CANCELLED) {
      throw new BadRequestException(`Service Order #${id} sudah dibatalkan sebelumnya.`);
    }

    so.status = ServiceOrderStatus.CANCELLED;
    so.notes = so.notes ? `${so.notes} | Dibatalkan: ${dto.reason}` : `Dibatalkan: ${dto.reason}`;
    so.updatedBy = userId;

    const savedSo = await soRepo.save(so);

    this.eventEmitter.emit('audit.log', {
      action: 'CANCEL',
      entityId: savedSo.id,
      entityName: 'service_orders',
      newValue: savedSo,
      userId,
    });

    return {
      success: true,
      message: `Service Order ${savedSo.serviceOrderNumber} berhasil dibatalkan.`,
      data: savedSo,
    };
  }
}
