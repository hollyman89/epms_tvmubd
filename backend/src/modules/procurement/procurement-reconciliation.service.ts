import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import {
  ProcurementReconciliation,
  ProcurementReconciliationStatus,
} from '../../entities/procurement-reconciliation.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { Project } from '../../entities/project.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import {
  ReconcileItemDto,
  ExcludeItemDto,
  QueryReconciliationDto,
} from './dto/procurement-reconciliation.dto';
import { PROCUREMENT_ELIGIBLE_CATEGORIES } from './procurement-package.service';

@Injectable()
export class ProcurementReconciliationService {
  private readonly logger = new Logger(ProcurementReconciliationService.name);

  constructor(
    @InjectRepository(ProcurementReconciliation)
    private readonly reconRepo: Repository<ProcurementReconciliation>,
    @InjectRepository(PurchaseRequest)
    private readonly prRepo: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseRequestItem)
    private readonly prItemRepo: Repository<PurchaseRequestItem>,
    @InjectRepository(CostItem)
    private readonly costItemRepo: Repository<CostItem>,
    @InjectRepository(ProjectCostEstimate)
    private readonly costEstimateRepo: Repository<ProjectCostEstimate>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // Role checks
  // ---------------------------------------------------------------------------

  private checkIsProcurementOrAdmin(userRoles: string[] = []): boolean {
    const allowed = ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN', 'ADMIN'];
    return userRoles.some((r) => allowed.includes(r));
  }

  private checkIsProjectManager(userRoles: string[] = []): boolean {
    return userRoles.includes('PROJECT_MANAGER');
  }

  // ---------------------------------------------------------------------------
  // 1. GET UNRESOLVED ITEMS
  // ---------------------------------------------------------------------------

  async getUnresolvedItems(
    userId: number,
    userRoles: string[] = [],
    query: QueryReconciliationDto = {},
  ) {
    const qb = this.prItemRepo
      .createQueryBuilder('pri')
      .innerJoinAndSelect('pri.purchaseRequest', 'pr')
      .innerJoinAndSelect('pr.project', 'project')
      .leftJoinAndSelect(
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
      );

    if (
      !this.checkIsProcurementOrAdmin(userRoles) &&
      this.checkIsProjectManager(userRoles)
    ) {
      qb.andWhere('project.managerId = :userId', { userId });
    }

    if (query.projectId) {
      qb.andWhere('pr.projectId = :projectId', { projectId: query.projectId });
    }

    if (query.origin) {
      qb.andWhere('pr.origin = :origin', { origin: query.origin });
    }

    const items = await qb.orderBy('pri.id', 'ASC').getMany();

    return {
      success: true,
      count: items.length,
      data: items,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. GET ITEM RECONCILIATION DETAIL + CANDIDATES
  // ---------------------------------------------------------------------------

  async getItemReconciliationDetail(
    userId: number,
    userRoles: string[] = [],
    prItemId: number,
  ) {
    const prItem = await this.prItemRepo.findOne({
      where: { id: prItemId },
      relations: ['purchaseRequest', 'purchaseRequest.project'],
    });

    if (!prItem) {
      throw new NotFoundException(`Item PR #${prItemId} tidak ditemukan.`);
    }

    const pr = prItem.purchaseRequest;
    if (!['LEGACY', 'AD_HOC'].includes(pr.origin)) {
      throw new BadRequestException(
        `Item PR #${prItemId} memiliki origin '${pr.origin}'. Rekonsiliasi hanya berlaku untuk LEGACY dan AD_HOC.`,
      );
    }

    if (
      !this.checkIsProcurementOrAdmin(userRoles) &&
      this.checkIsProjectManager(userRoles)
    ) {
      if (pr.project?.managerId !== userId) {
        throw new ForbiddenException(
          'Anda tidak memiliki akses ke rekonsiliasi proyek ini.',
        );
      }
    }

    // Load active approved estimate
    const currentEstimate = await this.costEstimateRepo.findOne({
      where: { projectId: pr.projectId, status: 'APPROVED' },
      order: { version: 'DESC' },
    });

    let candidates: any[] = [];
    if (currentEstimate) {
      const allCostItems = await this.costItemRepo.find({
        where: { estimateId: currentEstimate.id },
        relations: ['wbs'],
      });

      const eligible = allCostItems.filter(
        (ci) =>
          !ci.deletedAt &&
          ci.entryMode === 'ITEMIZED' &&
          PROCUREMENT_ELIGIBLE_CATEGORIES.includes(ci.categoryKey as any),
      );

      // Compute remaining quota for each candidate
      for (const c of eligible) {
        const remaining = await this.computeCostItemRemaining(
          c.id,
          this.dataSource.manager,
        );
        candidates.push({
          costItem: c,
          rawRemainingQty: remaining.rawRemainingQty,
          availableQty: remaining.availableQty,
          rawRemainingAmount: remaining.rawRemainingAmount,
          availableAmount: remaining.availableAmount,
          reservedQty: remaining.reservedQty,
          prCommittedQty: remaining.prCommittedQty,
          orderedQty: remaining.orderedQty,
        });
      }
    }

    const existingRec = await this.reconRepo.findOne({
      where: { prItemId },
      relations: ['targetCostItem', 'targetWbs'],
    });

    return {
      success: true,
      prItem,
      currentEstimate,
      candidateCostItems: candidates,
      reconciliation: existingRec,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. RECONCILE ITEM (MUTATION)
  // ---------------------------------------------------------------------------

  async reconcileItem(
    userId: number,
    userRoles: string[] = [],
    prItemId: number,
    dto: ReconcileItemDto,
  ) {
    if (!this.checkIsProcurementOrAdmin(userRoles)) {
      throw new ForbiddenException(
        'Hanya tim Procurement / Purchasing atau Super Admin yang berhak melakukan rekonsiliasi pengadaan.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Lock PR Item and PurchaseRequest
      const prItem = await manager.findOne(PurchaseRequestItem, {
        where: { id: prItemId },
        relations: ['purchaseRequest', 'purchaseRequest.project'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!prItem) {
        throw new NotFoundException(`Item PR #${prItemId} tidak ditemukan.`);
      }

      const pr = prItem.purchaseRequest;
      if (pr.status === 'REJECTED') {
        throw new BadRequestException(
          'Purchase Request terkait telah ditolak (REJECTED). Rekonsiliasi tidak diperlukan.',
        );
      }

      if (!['LEGACY', 'AD_HOC'].includes(pr.origin)) {
        throw new BadRequestException(
          `Item PR #${prItemId} memiliki origin '${pr.origin}'. Hanya transaksi LEGACY dan AD_HOC yang dapat direkonsiliasi.`,
        );
      }

      // 2. Lock and Validate Target CostItem
      const costItem = await manager.findOne(CostItem, {
        where: { id: dto.targetCostItemId },
        relations: ['estimate'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!costItem) {
        throw new NotFoundException(
          `Cost Item #${dto.targetCostItemId} tidak ditemukan.`,
        );
      }

      // Cross-project check: CostItem must belong to the same project
      if (costItem.estimate?.projectId !== pr.projectId) {
        throw new BadRequestException(
          `Cost Item #${dto.targetCostItemId} bukan milik proyek #${pr.projectId}. Rekonsiliasi lintas proyek dilarang.`,
        );
      }

      // Estimate status check: Must be APPROVED
      if (costItem.estimate?.status !== 'APPROVED') {
        throw new BadRequestException(
          `Cost Item #${dto.targetCostItemId} berasal dari estimasi (RAB) dengan status '${costItem.estimate?.status}'. Rekonsiliasi hanya diizinkan ke RAB berstatus APPROVED.`,
        );
      }

      // Entry mode & Category eligibility check
      if (costItem.entryMode !== 'ITEMIZED') {
        throw new BadRequestException(
          `Cost Item #${dto.targetCostItemId} memiliki mode '${costItem.entryMode}'. Hanya item ITEMIZED yang dapat menerima alokasi rekonsiliasi.`,
        );
      }

      if (
        !PROCUREMENT_ELIGIBLE_CATEGORIES.includes(costItem.categoryKey as any)
      ) {
        throw new BadRequestException(
          `Kategori '${costItem.categoryKey}' pada Cost Item #${dto.targetCostItemId} tidak eligible untuk pengadaan vendor.`,
        );
      }

      const mappedQty =
        dto.mappedQuantity !== undefined && dto.mappedQuantity !== null
          ? Number(dto.mappedQuantity)
          : Number(prItem.quantity);

      const mappedAmount =
        dto.mappedAmount !== undefined && dto.mappedAmount !== null
          ? Number(dto.mappedAmount)
          : Number(prItem.totalPrice || prItem.quantity * (prItem.estimatedUnitPrice || 0));

      if (mappedQty <= 0) {
        throw new BadRequestException('Kuantitas pemetaan harus lebih besar dari 0.');
      }

      // 3. Authoritative Remaining Quota Check (Allows Overrun for Historical Reconciliation)
      const remaining = await this.computeCostItemRemaining(costItem.id, manager);
      if (mappedQty > remaining.availableQty) {
        this.logger.warn(
          `Historical reconciliation for PR Item #${prItemId} caused overrun on CostItem #${costItem.id}. Mapped: ${mappedQty}, Available: ${remaining.availableQty}, Raw Remaining: ${remaining.rawRemainingQty}.`,
        );
      }

      // 4. Resolve Linked PO and PO Item if present
      let linkedPo: PurchaseOrder | null = null;
      let linkedPoItem: PurchaseOrderItem | null = null;

      const existingPo = await manager.findOne(PurchaseOrder, {
        where: { purchaseRequestId: pr.id },
        relations: ['items'],
      });

      if (existingPo) {
        linkedPo = existingPo;
        // Check if there is an exact PO item
        if (existingPo.items && existingPo.items.length === 1) {
          linkedPoItem = existingPo.items[0];
        } else if (existingPo.items) {
          linkedPoItem =
            existingPo.items.find((poi) => poi.prItemId === prItem.id) ||
            existingPo.items.find(
              (poi) => poi.itemName.trim() === prItem.itemName.trim(),
            ) ||
            null;
        }
      }

      const targetWbsId = costItem.wbsId ? Number(costItem.wbsId) : null;

      // 5. Persist Reconciliation Ledger
      let rec = await manager.findOne(ProcurementReconciliation, {
        where: { prItemId },
      });

      if (!rec) {
        rec = manager.create(ProcurementReconciliation, {
          projectId: pr.projectId,
          prId: pr.id,
          prItemId: prItem.id,
          poId: linkedPo?.id || null,
          poItemId: linkedPoItem?.id || null,
          origin: pr.origin as 'LEGACY' | 'AD_HOC',
          targetCostItemId: costItem.id,
          targetWbsId,
          mappedQuantity: mappedQty,
          mappedAmount: Math.round(mappedAmount * 100) / 100,
          status: ProcurementReconciliationStatus.RECONCILED,
          matchType: dto.matchType || 'MANUAL_MAPPING',
          notes: dto.notes || null,
          reconciledBy: userId,
          reconciledAt: new Date(),
        });
      } else {
        rec.targetCostItemId = costItem.id;
        rec.targetWbsId = targetWbsId;
        rec.mappedQuantity = mappedQty;
        rec.mappedAmount = Math.round(mappedAmount * 100) / 100;
        rec.status = ProcurementReconciliationStatus.RECONCILED;
        rec.matchType = dto.matchType || 'MANUAL_MAPPING';
        rec.notes = dto.notes || null;
        rec.reconciledBy = userId;
        rec.reconciledAt = new Date();
      }

      const savedRec = await manager.save(ProcurementReconciliation, rec);

      // 6. Synchronize Projection Columns on PR Item (Preserving commercial historical values)
      prItem.costItemId = costItem.id;
      prItem.wbsId = targetWbsId || undefined;
      await manager.save(PurchaseRequestItem, prItem);

      // 7. Synchronize Projection Columns on PO Item if linked
      if (linkedPoItem) {
        linkedPoItem.prItemId = prItem.id;
        linkedPoItem.costItemId = costItem.id;
        await manager.save(PurchaseOrderItem, linkedPoItem);
      }

      // 8. Record Audit Log
      const audit = manager.create(AuditLog, {
        table_name: 'procurement_reconciliations',
        record_id: savedRec.id,
        action: 'RECONCILE_ITEM',
        old_value: null,
        new_value: {
          prItemId: prItem.id,
          prId: pr.id,
          targetCostItemId: costItem.id,
          targetWbsId,
          mappedQuantity: mappedQty,
          mappedAmount: savedRec.mappedAmount,
          status: 'RECONCILED',
          reconciledBy: userId,
        },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      this.logger.log(
        `✅ Reconciled PR Item #${prItemId} to CostItem #${costItem.id} (Project #${pr.projectId}).`,
      );

      return {
        success: true,
        message: `Item PR #${prItemId} berhasil direkonsiliasi ke CostItem #${costItem.id}.`,
        reconciliation: savedRec,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 4. EXCLUDE ITEM (MUTATION)
  // ---------------------------------------------------------------------------

  async excludeItem(
    userId: number,
    userRoles: string[] = [],
    prItemId: number,
    dto: ExcludeItemDto,
  ) {
    if (!this.checkIsProcurementOrAdmin(userRoles)) {
      throw new ForbiddenException(
        'Hanya tim Procurement / Purchasing atau Super Admin yang berhak melakukan rekonsiliasi pengadaan.',
      );
    }

    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('Alasan eksklusi (reason) wajib diisi.');
    }

    return this.dataSource.transaction(async (manager) => {
      const prItem = await manager.findOne(PurchaseRequestItem, {
        where: { id: prItemId },
        relations: ['purchaseRequest', 'purchaseRequest.project'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!prItem) {
        throw new NotFoundException(`Item PR #${prItemId} tidak ditemukan.`);
      }

      const pr = prItem.purchaseRequest;
      if (!['LEGACY', 'AD_HOC'].includes(pr.origin)) {
        throw new BadRequestException(
          `Item PR #${prItemId} memiliki origin '${pr.origin}'. Rekonsiliasi hanya berlaku untuk LEGACY dan AD_HOC.`,
        );
      }

      let rec = await manager.findOne(ProcurementReconciliation, {
        where: { prItemId },
      });

      const fullNotes = `Alasan eksklusi: ${dto.reason.trim()}${
        dto.notes ? ' | Catatan tambahan: ' + dto.notes.trim() : ''
      }`;

      if (!rec) {
        rec = manager.create(ProcurementReconciliation, {
          projectId: pr.projectId,
          prId: pr.id,
          prItemId: prItem.id,
          origin: pr.origin as 'LEGACY' | 'AD_HOC',
          targetCostItemId: undefined,
          targetWbsId: undefined,
          mappedQuantity: 0,
          mappedAmount: 0,
          status: ProcurementReconciliationStatus.EXCLUDED,
          matchType: 'NON_PROJECT_EXCLUSION',
          notes: fullNotes,
          reconciledBy: userId,
          reconciledAt: new Date(),
        });
      } else {
        rec.targetCostItemId = undefined;
        rec.targetWbsId = undefined;
        rec.mappedQuantity = 0;
        rec.mappedAmount = 0;
        rec.status = ProcurementReconciliationStatus.EXCLUDED;
        rec.matchType = 'NON_PROJECT_EXCLUSION';
        rec.notes = fullNotes;
        rec.reconciledBy = userId;
        rec.reconciledAt = new Date();
      }

      const savedRec = await manager.save(ProcurementReconciliation, rec);

      // Record Audit Log
      const audit = manager.create(AuditLog, {
        table_name: 'procurement_reconciliations',
        record_id: savedRec.id,
        action: 'EXCLUDE_ITEM',
        old_value: null,
        new_value: {
          prItemId: prItem.id,
          prId: pr.id,
          status: 'EXCLUDED',
          reason: dto.reason.trim(),
          reconciledBy: userId,
        },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      this.logger.log(
        `✅ Excluded PR Item #${prItemId} from RAB quota (Reason: ${dto.reason.trim()}).`,
      );

      return {
        success: true,
        message: `Item PR #${prItemId} berhasil dieksklusi dari kuota RAB.`,
        reconciliation: savedRec,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 5. AUTHORITATIVE COST ITEM REMAINING CALCULATOR
  // ---------------------------------------------------------------------------

  async computeCostItemRemaining(
    costItemId: number,
    manager: EntityManager,
  ): Promise<{
    baselineQty: number;
    baselineAmount: number;
    reservedQty: number;
    reservedAmount: number;
    prCommittedQty: number;
    prCommittedAmount: number;
    orderedQty: number;
    orderedAmount: number;
    receivedQty: number;
    rawRemainingQty: number;
    availableQty: number;
    overrunQty: number;
    rawRemainingAmount: number;
    availableAmount: number;
    overrunAmount: number;
  }> {
    const costItem = await manager.findOne(CostItem, {
      where: { id: costItemId },
    });

    if (!costItem) {
      throw new NotFoundException(`Cost Item #${costItemId} tidak ditemukan.`);
    }

    const baselineQty = Number(costItem.quantity || 0);
    const baselineAmount = Number(costItem.subtotal || 0);

    // 1. Reserved Qty: Package status = 'SUBMITTED'
    const reservedRes = await manager.query(
      `SELECT 
         COALESCE(SUM(ppi.requested_qty), 0) AS reserved_qty,
         COALESCE(SUM(ppi.requested_qty * ppi.estimated_unit_price), 0) AS reserved_amount
       FROM procurement_package_items ppi
       JOIN procurement_packages pkg ON ppi.package_id = pkg.id
       WHERE ppi.cost_item_id = ?
         AND pkg.status = 'SUBMITTED'
         AND pkg.deleted_at IS NULL
         AND ppi.deleted_at IS NULL`,
      [costItemId],
    );
    const reservedQty = Number(reservedRes[0]?.reserved_qty || 0);
    const reservedAmount = Number(reservedRes[0]?.reserved_amount || 0);

    // 2. PR Committed Qty: PR status in ('SUBMITTED', 'DIRECTOR_APPROVAL', 'REJECTED_TO_PROCUREMENT', 'APPROVED')
    // Crucial: PO_ISSUED is excluded because commitment transfers to PO!
    const committedRes = await manager.query(
      `SELECT 
         COALESCE(SUM(pri.quantity), 0) AS committed_qty,
         COALESCE(SUM(pri.quantity * pri.estimated_unit_price), 0) AS committed_amount
       FROM purchase_request_items pri
       JOIN purchase_requests pr ON pri.pr_id = pr.id
       WHERE pri.cost_item_id = ?
         AND pr.status IN ('SUBMITTED', 'DIRECTOR_APPROVAL', 'REJECTED_TO_PROCUREMENT', 'APPROVED')
         AND pr.deleted_at IS NULL`,
      [costItemId],
    );
    const prCommittedQty = Number(committedRes[0]?.committed_qty || 0);
    const prCommittedAmount = Number(committedRes[0]?.committed_amount || 0);

    // 3. Ordered Qty: PO status in ('ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED')
    // Matched by poi.cost_item_id or linked pri.cost_item_id
    const orderedRes = await manager.query(
      `SELECT 
         COALESCE(SUM(poi.quantity), 0) AS ordered_qty,
         COALESCE(SUM(poi.total_price), 0) AS ordered_amount
       FROM purchase_order_items poi
       JOIN purchase_orders po ON poi.purchase_order_id = po.id
       WHERE (poi.cost_item_id = ? OR poi.pr_item_id IN (
         SELECT id FROM purchase_request_items WHERE cost_item_id = ?
       ))
         AND po.status IN ('ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED')
         AND po.deleted_at IS NULL
         AND poi.deleted_at IS NULL`,
      [costItemId, costItemId],
    );
    const orderedQty = Number(orderedRes[0]?.ordered_qty || 0);
    const orderedAmount = Number(orderedRes[0]?.ordered_amount || 0);

    // 4. Received Qty: GoodsReceipt items (Informational only, zero double-deduction)
    const receivedRes = await manager.query(
      `SELECT 
         COALESCE(SUM(gri.received_quantity), 0) AS received_qty
       FROM goods_receipt_items gri
       JOIN purchase_order_items poi ON gri.po_item_id = poi.id
       JOIN purchase_orders po ON poi.purchase_order_id = po.id
       WHERE (poi.cost_item_id = ? OR poi.pr_item_id IN (
         SELECT id FROM purchase_request_items WHERE cost_item_id = ?
       ))
         AND po.deleted_at IS NULL
         AND poi.deleted_at IS NULL
         AND gri.deleted_at IS NULL`,
      [costItemId, costItemId],
    );
    const receivedQty = Number(receivedRes[0]?.received_qty || 0);

    // Authoritative Remaining Calculations
    const rawRemainingQty = Math.round((baselineQty - (reservedQty + prCommittedQty + orderedQty)) * 10000) / 10000;
    const availableQty = Math.max(0, rawRemainingQty);
    const overrunQty = Math.max(0, -rawRemainingQty);

    const rawRemainingAmount = Math.round(
      (baselineAmount - (reservedAmount + prCommittedAmount + orderedAmount)) * 100,
    ) / 100;
    const availableAmount = Math.max(0, rawRemainingAmount);
    const overrunAmount = Math.max(0, -rawRemainingAmount);

    return {
      baselineQty,
      baselineAmount,
      reservedQty,
      reservedAmount,
      prCommittedQty,
      prCommittedAmount,
      orderedQty,
      orderedAmount,
      receivedQty,
      rawRemainingQty,
      availableQty,
      overrunQty,
      rawRemainingAmount,
      availableAmount,
      overrunAmount,
    };
  }
}
