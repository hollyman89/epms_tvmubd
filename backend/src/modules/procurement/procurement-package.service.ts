import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import {
  ProcurementPackage,
  ProcurementPackageStatus,
} from '../../entities/procurement-package.entity';
import { ProcurementPackageItem } from '../../entities/procurement-package-item.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Project } from '../../entities/project.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowInstance } from '../../entities/workflow-instance.entity';
import { WorkflowTask } from '../../entities/workflow-task.entity';
import { randomUUID } from 'crypto';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import {
  CostCategoryKey,
  ALLOWED_CATEGORIES,
} from '../project/dto/save-cost-estimate.dto';
import {
  CreatePackageDraftDto,
  UpdatePackageDraftDto,
  ReturnPackageDto,
  CancelPackageDto,
  QueryPackageDto,
} from './dto/procurement-package.dto';

/**
 * Legitimate procurement categories eligible for vendor PRs.
 * Direct payroll (LABOR), government statutory fees (PERMIT), and unallocated risk (CONTINGENCY) are strictly excluded.
 */
export const PROCUREMENT_ELIGIBLE_CATEGORIES: CostCategoryKey[] = [
  'MATERIAL',
  'EQUIPMENT',
  'SUBCONTRACTOR',
  'OPERATIONAL',
];

@Injectable()
export class ProcurementPackageService {
  private readonly logger = new Logger(ProcurementPackageService.name);

  constructor(
    @InjectRepository(ProcurementPackage)
    private readonly packageRepo: Repository<ProcurementPackage>,
    @InjectRepository(ProcurementPackageItem)
    private readonly packageItemRepo: Repository<ProcurementPackageItem>,
    @InjectRepository(PurchaseRequest)
    private readonly prRepo: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseRequestItem)
    private readonly prItemRepo: Repository<PurchaseRequestItem>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(CostItem)
    private readonly costItemRepo: Repository<CostItem>,
    @InjectRepository(ProjectCostEstimate)
    private readonly costEstimateRepo: Repository<ProjectCostEstimate>,
    @InjectRepository(WorkflowDefinition)
    private readonly workflowDefinitionRepo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowInstance)
    private readonly workflowInstanceRepo: Repository<WorkflowInstance>,
    private readonly workflowEngineService: WorkflowEngineService,
    private readonly dataSource: DataSource,
  ) {}

  private inTransaction<T>(work: (manager: EntityManager) => Promise<T>, manager?: EntityManager): Promise<T> {
    // Refresh consumption after waiting for the cost-item lock.
    return manager ? work(manager) : this.dataSource.transaction('READ COMMITTED', work);
  }

  private async lockDraftItems(items: { costItemId: number; requestedQty: number }[], manager: EntityManager) {
    if (!items.length || new Set(items.map(i => Number(i.costItemId))).size !== items.length) {
      throw new BadRequestException('Paket wajib memiliki item RAB yang unik dan tidak kosong.');
    }
    for (const item of items) {
      if (!Number.isFinite(Number(item.requestedQty)) || Number(item.requestedQty) < 0.0001) {
        throw new BadRequestException('Kuantitas item harus lebih besar dari nol.');
      }
    }
    const ids = items.map(i => Number(i.costItemId)).sort((a, b) => a - b);
    await manager.query('SELECT id FROM cost_items WHERE id IN (?) ORDER BY id FOR UPDATE', [ids]);
  }

  private async validateAvailableQuantity(costItem: CostItem, quantity: number, manager: EntityManager, packageId?: number) {
    const consumption = await this.computeCostItemConsumption(costItem, manager, packageId);
    if (quantity > consumption.availableQty) {
      throw new BadRequestException(
        `Alokasi kuota untuk item '${costItem.itemName}' terlampaui! Baseline: ${consumption.baselineQty} ${costItem.uom}, Terkomitmen: ${consumption.totalCommitted} ${costItem.uom}, Sisa Kuota: ${consumption.availableQty} ${costItem.uom}, Diajukan: ${quantity} ${costItem.uom}.`,
      );
    }
  }

  async getEligibleCostItems(projectId: number, userId: number, roles: string[]) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyek tidak ditemukan.');
    this.validateProjectManagerOwnership(project, userId, roles);
    const estimate = await this.costEstimateRepo.findOne({
      where: { projectId, status: 'APPROVED' }, order: { version: 'DESC' },
    });
    if (!estimate || project.status !== 'IN_PROGRESS') return [];
    const items = await this.costItemRepo.find({ where: { estimateId: estimate.id }, order: { id: 'ASC' } });
    return Promise.all(items.filter(item => item.entryMode === 'ITEMIZED' &&
      PROCUREMENT_ELIGIBLE_CATEGORIES.includes(item.categoryKey as CostCategoryKey)).map(async item => {
      const consumption = await this.computeCostItemConsumption(item, this.dataSource.manager);
      return {
        id: Number(item.id), itemName: item.itemName, categoryKey: item.categoryKey,
        quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), subtotal: Number(item.subtotal), uom: item.uom,
        assignmentScope: item.assignmentScope, wbsId: item.wbsId ? Number(item.wbsId) : null,
        ...consumption,
        availabilityStatus: consumption.availableQty > 0 ? 'AVAILABLE' : 'FULLY_ALLOCATED',
        unavailableReason: consumption.availableQty > 0 ? null : 'Sudah dialokasikan sepenuhnya',
      };
    }));
  }

  async saveAndSubmit(userId: number, roles: string[], dto: CreatePackageDraftDto | UpdatePackageDraftDto, packageId?: number) {
    return this.inTransaction(async manager => {
      const pkg = packageId
        ? await this.updateDraft(packageId, userId, roles, dto, manager)
        : await this.createDraft(userId, roles, dto as CreatePackageDraftDto, manager);
      return this.submitPackage(pkg.id, userId, roles, manager);
    });
  }

  // =========================================================================
  // 1. CREATE DRAFT
  // =========================================================================

  async createDraft(
    userId: number,
    userRoles: string[] = [],
    dto: CreatePackageDraftDto,
    transactionManager?: EntityManager,
  ): Promise<ProcurementPackage> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Paket pengadaan wajib memiliki minimal 1 item.');
    }

    return this.inTransaction(async (manager) => {
      // 1. Verify Project status and PM ownership
      const project = await manager.findOne(Project, {
        where: { id: dto.projectId },
      });
      if (!project) {
        throw new NotFoundException(`Project #${dto.projectId} tidak ditemukan.`);
      }

      this.validateProjectManagerOwnership(project, userId, userRoles);

      if (project.status !== 'IN_PROGRESS') {
        throw new BadRequestException(
          `Paket pengadaan hanya dapat dibuat untuk proyek berstatus IN_PROGRESS. Status saat ini: ${project.status}`,
        );
      }

      // 2. Resolve Current Authoritative Approved RAB
      const currentRab = await manager.findOne(ProjectCostEstimate, {
        where: { projectId: dto.projectId, status: 'APPROVED' },
        order: { version: 'DESC' },
      });
      if (!currentRab) {
        throw new BadRequestException(
          `Proyek #${dto.projectId} tidak memiliki estimasi biaya (RAB) yang berstatus APPROVED.`,
        );
      }

      // 3. Validate CostItems ownership, baseline eligibility, and categories
      await this.lockDraftItems(dto.items, manager);
      const costItemIds = dto.items.map((i) => Number(i.costItemId));
      const costItems = await manager.find(CostItem, {
        where: { id: In(costItemIds) },
        relations: ['estimate'],
      });

      if (costItems.length !== costItemIds.length) {
        throw new BadRequestException('Sebagian Cost Item yang diajukan tidak ditemukan di database.');
      }

      const costItemMap = new Map<number, CostItem>();
      for (const ci of costItems) {
        costItemMap.set(Number(ci.id), ci);
      }

      let totalEstimatedAmount = 0;
      const packageItemsData: Partial<ProcurementPackageItem>[] = [];

      for (const itemDto of dto.items) {
        const costItem = costItemMap.get(Number(itemDto.costItemId));
        if (!costItem) {
          throw new BadRequestException(`Cost Item #${itemDto.costItemId} tidak ditemukan.`);
        }

        // Project ownership guard: CostItem -> ProjectCostEstimate.projectId === Package.projectId
        if (costItem.estimate?.projectId !== project.id || costItem.estimateId !== currentRab.id) {
          throw new BadRequestException(
            `Cost Item #${costItem.id} ('${costItem.itemName}') bukan milik estimasi biaya (RAB) APPROVED aktif untuk proyek #${project.id}.`,
          );
        }

        // Entry Mode guard: must be ITEMIZED
        if (costItem.entryMode !== 'ITEMIZED') {
          throw new BadRequestException(
            `Cost Item #${costItem.id} ('${costItem.itemName}') memiliki mode '${costItem.entryMode}'. Hanya item ber-mode ITEMIZED yang dapat dimasukkan ke dalam paket pengadaan.`,
          );
        }

        // Category eligibility guard
        if (!PROCUREMENT_ELIGIBLE_CATEGORIES.includes(costItem.categoryKey as CostCategoryKey)) {
          throw new BadRequestException(
            `Kategori biaya '${costItem.categoryKey}' pada item #${costItem.id} tidak eligible untuk pengadaan vendor. Kategori yang diperbolehkan: ${PROCUREMENT_ELIGIBLE_CATEGORIES.join(', ')}.`,
          );
        }

        const requestedQty = Number(itemDto.requestedQty);
        await this.validateAvailableQuantity(costItem, requestedQty, manager);
        if (isNaN(requestedQty) || requestedQty <= 0) {
          throw new BadRequestException(`Jumlah requestedQty untuk item #${costItem.id} harus lebih besar dari 0.`);
        }

        const unitPrice = Number(costItem.unitPrice || 0);
        const subtotal = Math.round(requestedQty * unitPrice * 100) / 100;
        totalEstimatedAmount += subtotal;

        packageItemsData.push({
          costItemId: costItem.id,
          wbsId: costItem.wbsId || null, // Authoritative derivation: wbs_id strictly from cost_item.wbs_id
          itemName: costItem.itemName,
          uom: costItem.uom || 'Unit',
          baselineQty: Number(costItem.quantity || 0),
          requestedQty,
          estimatedUnitPrice: unitPrice,
          estimatedTotal: subtotal,
          requiredDate: itemDto.requiredDate || dto.requiredDate || undefined,
          status: 'PENDING',
        });
      }

      // 4. Generate concurrency-safe package number
      const packageNumber = await this.generatePackageNumber(manager);

      // 5. Create and save ProcurementPackage
      const pkg = manager.create(ProcurementPackage, {
        packageNumber,
        projectId: project.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        requiredDate: dto.requiredDate || null,
        totalEstimatedAmount: Math.round(totalEstimatedAmount * 100) / 100,
        status: ProcurementPackageStatus.DRAFT,
        requestedBy: userId,
        createdBy: userId,
      });
      const savedPkg = await manager.save(ProcurementPackage, pkg);

      // 6. Save package items linked to package_id
      const itemsToSave = packageItemsData.map((data) =>
        manager.create(ProcurementPackageItem, {
          ...data,
          packageId: savedPkg.id,
        }),
      );
      savedPkg.items = await manager.save(ProcurementPackageItem, itemsToSave);

      // 7. Record Audit Log
      const audit = manager.create(AuditLog, {
        table_name: 'procurement_packages',
        record_id: savedPkg.id,
        action: 'CREATE_DRAFT',
        old_value: null,
        new_value: {
          packageNumber: savedPkg.packageNumber,
          projectId: savedPkg.projectId,
          totalEstimatedAmount: savedPkg.totalEstimatedAmount,
          itemsCount: itemsToSave.length,
        },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      return savedPkg;
    }, transactionManager);
  }

  // =========================================================================
  // 2. FIND ALL & FIND ONE (PURE READ)
  // =========================================================================

  async findAll(
    userId: number,
    userRoles: string[] = [],
    query: QueryPackageDto = {},
  ): Promise<ProcurementPackage[]> {
    const qb = this.packageRepo
      .createQueryBuilder('pkg')
      .leftJoinAndSelect('pkg.project', 'project')
      .leftJoinAndSelect('pkg.requester', 'requester')
      .leftJoinAndSelect('pkg.reviewer', 'reviewer')
      .leftJoinAndSelect('pkg.purchaseRequest', 'pr')
      .leftJoinAndSelect('pkg.items', 'items')
      .leftJoinAndSelect('items.costItem', 'costItem')
      .leftJoinAndSelect('items.wbs', 'wbs')
      .where('pkg.deletedAt IS NULL');

    // Row-level authorization filter:
    const isSuperAdmin = this.checkIsSuperAdmin(userRoles);
    const isProcurement = this.checkIsProcurement(userRoles);

    if (!isSuperAdmin && !isProcurement) {
      // For PM, strictly restrict to packages of projects assigned to current user
      qb.andWhere('project.managerId = :userId', { userId });
    }

    if (query.projectId) {
      qb.andWhere('pkg.projectId = :projectId', { projectId: query.projectId });
    }

    if (query.status) {
      qb.andWhere('pkg.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('(pkg.title LIKE :search OR pkg.packageNumber LIKE :search)', {
        search: `%${query.search.trim()}%`,
      });
    }

    qb.orderBy('pkg.id', 'DESC');
    return qb.getMany();
  }

  async findOne(
    packageId: number,
    userId: number,
    userRoles: string[] = [],
  ): Promise<ProcurementPackage> {
    const pkg = await this.packageRepo.findOne({
      where: { id: packageId },
      relations: [
        'project',
        'requester',
        'reviewer',
        'purchaseRequest',
        'items',
        'items.costItem',
        'items.wbs',
      ],
    });

    if (!pkg) {
      throw new NotFoundException(`Paket pengadaan #${packageId} tidak ditemukan.`);
    }

    const isSuperAdmin = this.checkIsSuperAdmin(userRoles);
    const isProcurement = this.checkIsProcurement(userRoles);

    if (!isSuperAdmin && !isProcurement) {
      if (pkg.project?.managerId !== userId) {
        throw new ForbiddenException(
          'Akses ditolak: Anda bukan Project Manager yang ditugaskan untuk proyek paket ini.',
        );
      }
    }

    return pkg;
  }

  // =========================================================================
  // 3. UPDATE DRAFT & DELETE DRAFT
  // =========================================================================

  async updateDraft(
    packageId: number,
    userId: number,
    userRoles: string[] = [],
    dto: UpdatePackageDraftDto,
    transactionManager?: EntityManager,
  ): Promise<ProcurementPackage> {
    return this.inTransaction(async (manager) => {
      const pkg = await manager.findOne(ProcurementPackage, {
        where: { id: packageId },
        relations: ['project', 'items'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!pkg) {
        throw new NotFoundException(`Paket pengadaan #${packageId} tidak ditemukan.`);
      }

      this.validateProjectManagerOwnership(pkg.project, userId, userRoles);

      if (
        pkg.status !== ProcurementPackageStatus.DRAFT &&
        pkg.status !== ProcurementPackageStatus.RETURNED
      ) {
        throw new BadRequestException(
          `Hanya paket berstatus DRAFT atau RETURNED yang dapat diubah. Status saat ini: ${pkg.status}`,
        );
      }

      if (pkg.project.status !== 'IN_PROGRESS') {
        throw new BadRequestException(
          `Proyek harus berstatus IN_PROGRESS. Status saat ini: ${pkg.project.status}`,
        );
      }

      if (dto.title !== undefined) pkg.title = dto.title.trim();
      if (dto.description !== undefined) pkg.description = dto.description?.trim() || null;
      if (dto.requiredDate !== undefined) pkg.requiredDate = dto.requiredDate || null;

      const requestedItems = dto.items ?? pkg.items;
      await this.lockDraftItems(requestedItems, manager);
      if (dto.items) {
        // Resolve Current Authoritative Approved RAB
        const currentRab = await manager.findOne(ProjectCostEstimate, {
          where: { projectId: pkg.projectId, status: 'APPROVED' },
          order: { version: 'DESC' },
        });
        if (!currentRab) {
          throw new BadRequestException(
            `Proyek #${pkg.projectId} tidak memiliki estimasi biaya (RAB) APPROVED aktif.`,
          );
        }

        // Delete existing items
        await manager.delete(ProcurementPackageItem, { packageId: pkg.id });

        const costItemIds = dto.items.map((i) => Number(i.costItemId));
        const costItems = await manager.find(CostItem, {
          where: { id: In(costItemIds) },
          relations: ['estimate'],
        });

        const costItemMap = new Map<number, CostItem>();
        for (const ci of costItems) {
          costItemMap.set(Number(ci.id), ci);
        }

        let totalEstimatedAmount = 0;
        const newItems: ProcurementPackageItem[] = [];

        for (const itemDto of dto.items) {
          const costItem = costItemMap.get(Number(itemDto.costItemId));
          if (!costItem) {
            throw new BadRequestException(`Cost Item #${itemDto.costItemId} tidak ditemukan.`);
          }
          if (costItem.estimate?.projectId !== pkg.projectId || costItem.estimateId !== currentRab.id) {
            throw new BadRequestException(
              `Cost Item #${costItem.id} ('${costItem.itemName}') bukan milik RAB APPROVED aktif untuk proyek #${pkg.projectId}.`,
            );
          }
          if (costItem.entryMode !== 'ITEMIZED') {
            throw new BadRequestException(
              `Cost Item #${costItem.id} harus ber-mode ITEMIZED.`,
            );
          }
          if (!PROCUREMENT_ELIGIBLE_CATEGORIES.includes(costItem.categoryKey as CostCategoryKey)) {
            throw new BadRequestException(
              `Kategori '${costItem.categoryKey}' tidak eligible untuk pengadaan.`,
            );
          }

          const requestedQty = Number(itemDto.requestedQty);
          await this.validateAvailableQuantity(costItem, requestedQty, manager, pkg.id);
          const unitPrice = Number(costItem.unitPrice || 0);
          const subtotal = Math.round(requestedQty * unitPrice * 100) / 100;
          totalEstimatedAmount += subtotal;

          newItems.push(
            manager.create(ProcurementPackageItem, {
              packageId: pkg.id,
              costItemId: costItem.id,
              wbsId: costItem.wbsId || null,
              itemName: costItem.itemName,
              uom: costItem.uom || 'Unit',
              baselineQty: Number(costItem.quantity || 0),
              requestedQty,
              estimatedUnitPrice: unitPrice,
              estimatedTotal: subtotal,
              requiredDate: itemDto.requiredDate || pkg.requiredDate || undefined,
              status: 'PENDING',
            }),
          );
        }

        pkg.totalEstimatedAmount = Math.round(totalEstimatedAmount * 100) / 100;
        pkg.items = await manager.save(ProcurementPackageItem, newItems);
      } else {
        for (const item of pkg.items) {
          const costItem = await manager.findOne(CostItem, { where: { id: item.costItemId } });
          if (!costItem) throw new BadRequestException('Item RAB tidak ditemukan.');
          await this.validateAvailableQuantity(costItem, Number(item.requestedQty), manager, pkg.id);
        }
      }

      pkg.updatedBy = userId;
      return manager.save(ProcurementPackage, pkg);
    }, transactionManager);
  }

  async deleteDraft(
    packageId: number,
    userId: number,
    userRoles: string[] = [],
  ): Promise<{ success: boolean; message: string }> {
    return this.dataSource.transaction(async (manager) => {
      const pkg = await manager.findOne(ProcurementPackage, {
        where: { id: packageId },
        relations: ['project'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!pkg) {
        throw new NotFoundException(`Paket pengadaan #${packageId} tidak ditemukan.`);
      }

      this.validateProjectManagerOwnership(pkg.project, userId, userRoles);

      if (pkg.status !== ProcurementPackageStatus.DRAFT) {
        throw new BadRequestException(
          `Hanya paket berstatus DRAFT yang dapat dihapus. Status saat ini: ${pkg.status}`,
        );
      }

      pkg.deletedBy = userId;
      pkg.deletedAt = new Date();
      await manager.save(ProcurementPackage, pkg);

      await manager.update(
        ProcurementPackageItem,
        { packageId: pkg.id },
        { deletedAt: new Date() },
      );

      return { success: true, message: `Draf paket ${pkg.packageNumber} berhasil dihapus.` };
    });
  }

  // =========================================================================
  // 4. SUBMIT PACKAGE (RESERVATION, SAFETY GATE, CONCURRENCY LOCK)
  // =========================================================================

  async submitPackage(
    packageId: number,
    userId: number,
    userRoles: string[] = [],
    transactionManager?: EntityManager,
  ): Promise<ProcurementPackage> {
    return this.inTransaction(async (manager) => {
      const pkg = await manager.findOne(ProcurementPackage, {
        where: { id: packageId },
        relations: ['project', 'items'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!pkg) {
        throw new NotFoundException(`Paket pengadaan #${packageId} tidak ditemukan.`);
      }

      this.validateProjectManagerOwnership(pkg.project, userId, userRoles);

      if (
        pkg.status !== ProcurementPackageStatus.DRAFT &&
        pkg.status !== ProcurementPackageStatus.RETURNED
      ) {
        throw new BadRequestException(
          `Paket hanya dapat diajukan jika berstatus DRAFT atau RETURNED. Status saat ini: ${pkg.status}`,
        );
      }

      if (pkg.project.status !== 'IN_PROGRESS') {
        throw new BadRequestException(
          `Pengajuan paket memerlukan status proyek IN_PROGRESS. Status saat ini: ${pkg.project.status}`,
        );
      }

      // Mandatory required_date validation on submit
      if (!pkg.requiredDate) {
        throw new BadRequestException(
          'Tanggal kebutuhan (required_date) wajib diisi sebelum mengajukan paket pengadaan.',
        );
      }

      const reqDate = new Date(pkg.requiredDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (reqDate < today) {
        throw new BadRequestException(
          `Tanggal kebutuhan (${pkg.requiredDate}) tidak boleh berada di masa lampau.`,
        );
      }

      // 1. SAFETY GATE: Block submission if project has unreconciled legacy PRs
      await this.enforceLegacySafetyGate(pkg.projectId, manager);

      // 2. PRE-MUTATION RECONCILIATION: self-heal any orphaned packages before quota evaluation
      await this.reconcileProjectPackages(pkg.projectId, manager);

      // 3. PESSIMISTIC LOCK: Lock CostItems in ascending order to prevent deadlocks
      await this.lockDraftItems(pkg.items, manager);
      const costItemIds = pkg.items.map((i) => Number(i.costItemId)).sort((a, b) => a - b);
      const lockedCostItems = await manager
        .createQueryBuilder(CostItem, 'ci')
        .setLock('pessimistic_write')
        .where('ci.id IN (:...ids)', { ids: costItemIds })
        .getMany();

      const lockedCostItemMap = new Map<number, CostItem>();
      for (const ci of lockedCostItems) {
        lockedCostItemMap.set(Number(ci.id), ci);
      }

      // 4. QUOTA VALIDATION: Calculate committed quantity across other packages
      for (const item of pkg.items) {
        const costItem = lockedCostItemMap.get(Number(item.costItemId));
        if (!costItem) {
          throw new BadRequestException(`Cost Item #${item.costItemId} tidak ditemukan.`);
        }

        // Authoritative Phase 3 Quota Validation (Packages + PRs + POs + Reconciliations)
        const consumption = await this.computeCostItemConsumption(
          costItem,
          manager,
          pkg.id,
        );

        const requestedQty = Number(item.requestedQty);

        if (requestedQty > consumption.availableQty) {
          throw new BadRequestException(
            `Alokasi kuota untuk item '${costItem.itemName}' terlampaui! Baseline: ${consumption.baselineQty} ${costItem.uom}, Terkomitmen: ${consumption.totalCommitted} ${costItem.uom}, Sisa Kuota: ${consumption.availableQty} ${costItem.uom}, Diajukan: ${requestedQty} ${costItem.uom}.`,
          );
        }
      }

      // 5. Transition to SUBMITTED
      pkg.status = ProcurementPackageStatus.SUBMITTED;
      pkg.submittedAt = new Date();
      pkg.updatedBy = userId;
      const saved = await manager.save(ProcurementPackage, pkg);

      // Audit log
      const audit = manager.create(AuditLog, {
        table_name: 'procurement_packages',
        record_id: saved.id,
        action: 'SUBMIT_PACKAGE',
        old_value: { status: 'DRAFT' },
        new_value: { status: 'SUBMITTED', submittedAt: saved.submittedAt },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      // Canonical Outbox: procurement.package.submitted
      const submitEvent: BusinessEvent<{
        packageId: number;
        packageNumber: string;
        projectId: number;
        totalEstimatedAmount: number;
        submittedBy: number;
        submittedAt: string;
        status: string;
      }> = {
        eventId: randomUUID(),
        eventName: 'procurement.package.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProcurementPackage',
        aggregateId: saved.id,
        projectId: Number(saved.projectId),
        actor: userId ? { userId: Number(userId) } : undefined,
        routing: undefined,
        notificationPolicy: undefined,
        payload: {
          packageId: Number(saved.id),
          packageNumber: saved.packageNumber,
          projectId: Number(saved.projectId),
          totalEstimatedAmount: Number(saved.totalEstimatedAmount),
          submittedBy: Number(userId),
          submittedAt: saved.submittedAt ? saved.submittedAt.toISOString() : new Date().toISOString(),
          status: ProcurementPackageStatus.SUBMITTED,
        },
      };

      const submitOutbox = manager.create(OutboxEvent, {
        event_id: submitEvent.eventId,
        event_name: submitEvent.eventName,
        event_version: String(submitEvent.eventVersion),
        aggregate_type: submitEvent.aggregateType,
        aggregate_id: Number(submitEvent.aggregateId),
        correlation_id: submitEvent.correlationId || null,
        payload: {
          occurredAt: submitEvent.occurredAt,
          projectId: submitEvent.projectId,
          actor: submitEvent.actor,
          routing: submitEvent.routing,
          notificationPolicy: submitEvent.notificationPolicy,
          businessPayload: submitEvent.payload,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await manager.save(OutboxEvent, submitOutbox);

      return saved;
    }, transactionManager);
  }

  // =========================================================================
  // 5. RETURN, RESUBMIT & CANCEL PACKAGE
  // =========================================================================

  async returnPackage(
    packageId: number,
    reviewerId: number,
    userRoles: string[] = [],
    dto: ReturnPackageDto,
  ): Promise<ProcurementPackage> {
    if (!this.checkIsProcurement(userRoles) && !this.checkIsSuperAdmin(userRoles)) {
      throw new ForbiddenException(
        'Hanya tim Procurement / Purchasing yang berhak mengembalikan paket pengadaan.',
      );
    }

    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('Alasan pengembalian (reason) wajib diisi.');
    }

    return this.dataSource.transaction(async (manager) => {
      const pkg = await manager.findOne(ProcurementPackage, {
        where: { id: packageId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!pkg) {
        throw new NotFoundException(`Paket pengadaan #${packageId} tidak ditemukan.`);
      }

      if (pkg.status !== ProcurementPackageStatus.SUBMITTED) {
        throw new BadRequestException(
          `Hanya paket berstatus SUBMITTED yang dapat dikembalikan. Status saat ini: ${pkg.status}`,
        );
      }

      pkg.status = ProcurementPackageStatus.RETURNED;
      pkg.reviewedBy = reviewerId;
      pkg.reviewedAt = new Date();
      pkg.rejectionNotes = dto.reason.trim();
      pkg.updatedBy = reviewerId;

      const saved = await manager.save(ProcurementPackage, pkg);

      // Audit log
      const audit = manager.create(AuditLog, {
        table_name: 'procurement_packages',
        record_id: saved.id,
        action: 'RETURN_PACKAGE',
        old_value: { status: 'SUBMITTED' },
        new_value: { status: 'RETURNED', reason: saved.rejectionNotes },
        created_by: reviewerId,
      });
      await manager.save(AuditLog, audit);

      // Canonical Outbox: procurement.package.returned
      const returnEvent: BusinessEvent<{
        packageId: number;
        packageNumber: string;
        projectId: number;
        reviewerId: number;
        reason: string;
        status: string;
      }> = {
        eventId: randomUUID(),
        eventName: 'procurement.package.returned',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'ProcurementPackage',
        aggregateId: saved.id,
        projectId: Number(saved.projectId),
        actor: reviewerId ? { userId: Number(reviewerId) } : undefined,
        routing: undefined,
        notificationPolicy: undefined,
        payload: {
          packageId: Number(saved.id),
          packageNumber: saved.packageNumber,
          projectId: Number(saved.projectId),
          reviewerId: Number(reviewerId),
          reason: saved.rejectionNotes,
          status: ProcurementPackageStatus.RETURNED,
        },
      };

      const returnOutbox = manager.create(OutboxEvent, {
        event_id: returnEvent.eventId,
        event_name: returnEvent.eventName,
        event_version: String(returnEvent.eventVersion),
        aggregate_type: returnEvent.aggregateType,
        aggregate_id: Number(returnEvent.aggregateId),
        correlation_id: returnEvent.correlationId || null,
        payload: {
          occurredAt: returnEvent.occurredAt,
          projectId: returnEvent.projectId,
          actor: returnEvent.actor,
          routing: returnEvent.routing,
          notificationPolicy: returnEvent.notificationPolicy,
          businessPayload: returnEvent.payload,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await manager.save(OutboxEvent, returnOutbox);

      return saved;
    });
  }

  async resubmitPackage(
    packageId: number,
    userId: number,
    userRoles: string[] = [],
  ): Promise<ProcurementPackage> {
    // Re-submission delegates to submitPackage (includes safety gate, pre-mutation reconciliation, lock, and re-reservation)
    return this.submitPackage(packageId, userId, userRoles);
  }

  async cancelPackage(
    packageId: number,
    userId: number,
    userRoles: string[] = [],
    dto: CancelPackageDto = {},
  ): Promise<ProcurementPackage> {
    return this.dataSource.transaction(async (manager) => {
      const pkg = await manager.findOne(ProcurementPackage, {
        where: { id: packageId },
        relations: ['project'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!pkg) {
        throw new NotFoundException(`Paket pengadaan #${packageId} tidak ditemukan.`);
      }

      this.validateProjectManagerOwnership(pkg.project, userId, userRoles);

      if (
        pkg.status !== ProcurementPackageStatus.DRAFT &&
        pkg.status !== ProcurementPackageStatus.SUBMITTED &&
        pkg.status !== ProcurementPackageStatus.RETURNED
      ) {
        throw new BadRequestException(
          `Paket tidak dapat dibatalkan pada status saat ini: ${pkg.status}.`,
        );
      }

      const oldStatus = pkg.status;
      pkg.status = ProcurementPackageStatus.CANCELLED;
      pkg.rejectionNotes = dto.reason?.trim() || pkg.rejectionNotes || 'Dibatalkan oleh Project Manager';
      pkg.updatedBy = userId;

      const saved = await manager.save(ProcurementPackage, pkg);

      // Audit log
      const audit = manager.create(AuditLog, {
        table_name: 'procurement_packages',
        record_id: saved.id,
        action: 'CANCEL_PACKAGE',
        old_value: { status: oldStatus },
        new_value: { status: 'CANCELLED', reason: pkg.rejectionNotes },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      return saved;
    });
  }

  // =========================================================================
  // 6. CREATE PR FROM PACKAGE (ATOMIC & VERIFIED COMPENSATION)
  // =========================================================================

  async createPrFromPackage(
    packageId: number,
    userId: number,
    userRoles: string[] = [],
  ): Promise<{ success: boolean; message: string; purchaseRequest: PurchaseRequest }> {
    if (!this.checkIsProcurement(userRoles) && !this.checkIsSuperAdmin(userRoles)) {
      throw new ForbiddenException(
        'Hanya tim Procurement / Purchasing yang berhak menerbitkan Purchase Request dari paket.',
      );
    }

    // Pre-flight check: ensure workflow definition is active and published
    const workflowDef = await this.workflowDefinitionRepo.findOne({
      where: { workflowKey: 'PURCHASE_REQUEST_WORKFLOW' },
      relations: ['versions'],
    });
    if (!workflowDef || workflowDef.isActive === 0 || !workflowDef.activeVersion) {
      throw new BadRequestException(
        'Workflow persetujuan PR (PURCHASE_REQUEST_WORKFLOW) belum aktif atau belum dipublikasikan.',
      );
    }

    let savedPrId: number | null = null;
    let savedPrRecord: PurchaseRequest | null = null;

    // --- PHASE 1: DATABASE TRANSACTION (ATOMIC INSERT OF PR + ITEMS + UPDATE PACKAGE) ---
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pkg = await queryRunner.manager.findOne(ProcurementPackage, {
        where: { id: packageId },
        relations: ['project', 'items'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!pkg) {
        throw new NotFoundException(`Paket pengadaan #${packageId} tidak ditemukan.`);
      }

      if (pkg.status !== ProcurementPackageStatus.SUBMITTED) {
        throw new BadRequestException(
          `Purchase Request hanya dapat dibuat jika paket berstatus SUBMITTED. Status saat ini: ${pkg.status}`,
        );
      }

      // Safety Gate check: block if project has unreconciled legacy PRs
      await this.enforceLegacySafetyGate(pkg.projectId, queryRunner.manager);

      // Idempotency check: ensure 1 Package = 1 PR
      const existingPr = await queryRunner.manager.findOne(PurchaseRequest, {
        where: { packageId: pkg.id },
      });
      if (existingPr) {
        throw new ConflictException(
          `Purchase Request #${existingPr.prNumber} sudah pernah dibuat untuk paket ini. Aturan 1 Paket = 1 PR terpenuhi.`,
        );
      }

      // Generate PR Number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await queryRunner.manager.count(PurchaseRequest, {
        where: { prNumber: require('typeorm').Like(`PR-${dateStr}-%`) },
      });
      const seq = String(countToday + 1).padStart(3, '0');
      const prNumber = `PR-${dateStr}-${seq}`;

      // 1. Create PurchaseRequest with origin = 'PACKAGE' and package_id
      const pr = queryRunner.manager.create(PurchaseRequest, {
        projectId: pkg.projectId,
        packageId: pkg.id,
        requesterId: userId,
        prNumber,
        totalEstimatedAmount: Number(pkg.totalEstimatedAmount),
        status: 'SUBMITTED',
        origin: 'PACKAGE', // Explicit origin discriminator
        createdBy: userId,
      });
      const savedPr = await queryRunner.manager.save(PurchaseRequest, pr);
      savedPrId = savedPr.id;
      savedPrRecord = savedPr;

      // 2. Create PurchaseRequestItems copying traceability foreign keys
      const prItems = pkg.items.map((item) =>
        queryRunner.manager.create(PurchaseRequestItem, {
          prId: savedPr.id,
          packageItemId: item.id,
          costItemId: item.costItemId,
          wbsId: item.wbsId || undefined,
          itemName: item.itemName,
          quantity: item.requestedQty,
          uom: item.uom,
          estimatedUnitPrice: item.estimatedUnitPrice,
        }),
      );
      await queryRunner.manager.save(PurchaseRequestItem, prItems);

      // 3. Update ProcurementPackage status to PR_CREATED
      pkg.status = ProcurementPackageStatus.PR_CREATED;
      pkg.reviewedBy = userId;
      pkg.reviewedAt = new Date();
      pkg.updatedBy = userId;
      await queryRunner.manager.save(ProcurementPackage, pkg);

      // 4. Audit Log
      const prAudit = queryRunner.manager.create(AuditLog, {
        table_name: 'purchase_requests',
        record_id: savedPr.id,
        action: 'SUBMIT_FROM_PACKAGE',
        old_value: null,
        new_value: {
          prNumber: savedPr.prNumber,
          packageId: pkg.id,
          packageNumber: pkg.packageNumber,
          totalEstimatedAmount: savedPr.totalEstimatedAmount,
          origin: 'PACKAGE',
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, prAudit);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // --- PHASE 2: WORKFLOW START & VERIFIED COMPENSATION ---
    try {
      this.logger.log(`Starting Workflow for PR #${savedPrId} generated from Package #${packageId}...`);
      await this.workflowEngineService.startInstance(
        {
          workflowKey: 'PURCHASE_REQUEST_WORKFLOW',
          entityType: 'PURCHASE_REQUEST',
          entityId: savedPrId!,
          context: {
            totalEstimatedAmount: savedPrRecord?.totalEstimatedAmount,
            initiatorUserId: userId,
            packageId,
          },
        },
        userId,
      );
      this.logger.log(`✅ Workflow initiated successfully for PR #${savedPrId}.`);

      return {
        success: true,
        message: `Purchase Request #${savedPrRecord?.prNumber} berhasil diterbitkan dari paket ${packageId}.`,
        purchaseRequest: savedPrRecord!,
      };
    } catch (wfErr: any) {
      this.logger.error(
        `❌ Workflow initiation failed for PR #${savedPrId}. Executing verified compensation routine...`,
        wfErr?.stack,
      );

      // Verified compensation: check workflow artifacts and hard-delete uninitialized transient PR
      await this.compensateFailedPrCreation(packageId, savedPrId!, wfErr?.message);

      throw new InternalServerErrorException(
        `Gagal memulai workflow persetujuan PR: ${wfErr?.message || 'Error tidak terduga'}. Perubahan paket telah dibatalkan kembali ke SUBMITTED dan package_id dapat digunakan kembali.`,
      );
    }
  }

  // =========================================================================
  // 7. PR REJECTION & COMPENSATION HANDLERS
  // =========================================================================

  async handlePrRejection(prId: number, instanceId?: number): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const pr = await manager.findOne(PurchaseRequest, {
        where: { id: prId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!pr || !pr.packageId) {
        return; // Legacy PR or not linked to package, nothing to sync
      }

      const pkg = await manager.findOne(ProcurementPackage, {
        where: { id: pr.packageId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!pkg) {
        return;
      }

      // Idempotent guard: if already CANCELLED or not PR_CREATED, safe no-op
      if (pkg.status === ProcurementPackageStatus.CANCELLED) {
        this.logger.log(`Package #${pkg.id} is already CANCELLED. Idempotent skip.`);
        return;
      }

      if (pkg.status !== ProcurementPackageStatus.PR_CREATED) {
        this.logger.warn(`Package #${pkg.id} status is ${pkg.status}, expected PR_CREATED. Skipping.`);
        return;
      }

      // Fetch canonical rejection reason from WorkflowTask or AuditLog
      let rejectionReason = 'PR ditolak pada alur persetujuan (Workflow Terminal Rejection)';
      if (instanceId) {
        const task = await manager.findOne(WorkflowTask, {
          where: { workflowInstanceId: instanceId, action: 'REJECT' },
          order: { id: 'DESC' },
        });
        if (task?.comments) {
          rejectionReason = task.comments;
        }
      }

      pkg.status = ProcurementPackageStatus.CANCELLED;
      pkg.rejectionNotes = rejectionReason;
      pkg.reviewedAt = new Date();
      await manager.save(ProcurementPackage, pkg);

      // Recording Audit Log
      const audit = manager.create(AuditLog, {
        table_name: 'procurement_packages',
        record_id: pkg.id,
        action: 'SYNC_PR_REJECTED',
        old_value: { status: 'PR_CREATED' },
        new_value: { status: 'CANCELLED', reason: rejectionReason, prId },
      });
      await manager.save(AuditLog, audit);

      this.logger.log(
        `⚡ Package #${pkg.id} (${pkg.packageNumber}) synchronized to CANCELLED following rejection of PR #${prId}. Quota released.`,
      );
    });
  }

  private async compensateFailedPrCreation(
    packageId: number,
    prId: number,
    errorMessage: string,
  ): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Verify workflow tables: verify that startInstance internal transaction rolled back and left no artifacts
      const strayInstance = await manager.findOne(WorkflowInstance, {
        where: { entityType: 'PURCHASE_REQUEST', entityId: prId },
      });
      if (strayInstance) {
        this.logger.error(
          `🚨 [FAIL SAFE] WorkflowInstance #${strayInstance.id} unexpectedly exists for failed PR #${prId}! Manual intervention required; workflow artifacts cannot be deleted silently.`,
        );
        throw new InternalServerErrorException(
          `Terdeteksi artefak workflow parsial (Instance #${strayInstance.id}) untuk PR #${prId}. Kompensasi otomatis dihentikan untuk mencegah inkonsistensi Workflow Engine.`,
        );
      }

      // 2. Physical HARD DELETE of transient PR and items to genuinely release package_id from UNIQUE constraint
      await manager.delete(PurchaseRequestItem, { prId });
      await manager.delete(PurchaseRequest, { id: prId });

      // 3. Revert ProcurementPackage back to SUBMITTED
      await manager.update(
        ProcurementPackage,
        { id: packageId },
        {
          status: ProcurementPackageStatus.SUBMITTED,
          rejectionNotes: `Inisiasi workflow PR gagal: ${errorMessage}. Paket dikembalikan ke SUBMITTED.`,
          updatedAt: new Date(),
        },
      );

      // 4. Compensation Audit Log
      const audit = manager.create(AuditLog, {
        table_name: 'procurement_packages',
        record_id: packageId,
        action: 'COMPENSATE_WORKFLOW_FAILURE',
        old_value: { status: 'PR_CREATED', prId },
        new_value: { status: 'SUBMITTED', reason: errorMessage },
      });
      await manager.save(AuditLog, audit);

      this.logger.log(`✅ State compensated: Package #${packageId} restored to SUBMITTED, failed PR #${prId} deleted.`);
    });
  }

  // =========================================================================
  // 8. PRE-MUTATION RECONCILIATION & SAFETY GATE
  // =========================================================================

  async reconcileProjectPackages(projectId: number, manager: EntityManager): Promise<number> {
    // Find packages in PR_CREATED whose linked PR has become REJECTED
    const orphanedPackages = await manager
      .createQueryBuilder(ProcurementPackage, 'pkg')
      .innerJoin('pkg.purchaseRequest', 'pr')
      .where('pkg.projectId = :projectId', { projectId })
      .andWhere('pkg.status = :pkgStatus', { pkgStatus: ProcurementPackageStatus.PR_CREATED })
      .andWhere('pr.status = :prStatus', { prStatus: 'REJECTED' })
      .andWhere('pkg.deletedAt IS NULL')
      .getMany();

    if (orphanedPackages.length === 0) {
      return 0;
    }

    for (const pkg of orphanedPackages) {
      pkg.status = ProcurementPackageStatus.CANCELLED;
      pkg.rejectionNotes = 'Rekonsiliasi otomatis: PR terkait telah ditolak.';
      pkg.reviewedAt = new Date();
      await manager.save(ProcurementPackage, pkg);
      this.logger.log(`Reconciled orphaned Package #${pkg.id} to CANCELLED.`);
    }

    return orphanedPackages.length;
  }

  async enforceProcurementSafetyGate(projectId: number, manager: EntityManager): Promise<void> {
    const unreconciledRes = await manager.query(
      `SELECT COUNT(pri.id) as cnt
       FROM purchase_request_items pri
       JOIN purchase_requests pr ON pri.pr_id = pr.id
       LEFT JOIN procurement_reconciliations rec ON rec.pr_item_id = pri.id
       WHERE pr.project_id = ?
         AND pr.origin IN ('LEGACY', 'AD_HOC')
         AND pr.status NOT IN ('REJECTED')
         AND pr.deleted_at IS NULL
         AND (pri.cost_item_id IS NULL OR rec.status IS NULL OR rec.status = 'PENDING')
         AND (rec.status IS NULL OR rec.status NOT IN ('RECONCILED', 'EXCLUDED'))`,
      [projectId],
    );

    const unreconciledCount = Number(unreconciledRes[0]?.cnt || 0);
    if (unreconciledCount > 0) {
      throw new UnprocessableEntityException(
        `Proyek ini memiliki ${unreconciledCount} item Purchase Request legacy yang belum direkonsiliasi (LEGACY / AD_HOC). Operasi transaksi paket pengadaan ditangguhkan sampai seluruh rekonsiliasi berstatus RECONCILED atau EXCLUDED.`,
      );
    }
  }

  private async enforceLegacySafetyGate(projectId: number, manager: EntityManager): Promise<void> {
    return this.enforceProcurementSafetyGate(projectId, manager);
  }

  async computeCostItemConsumption(
    costItemOrId: number | CostItem,
    manager: EntityManager,
    excludePackageId?: number,
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
    totalCommitted: number;
    rawRemainingQty: number;
    availableQty: number;
    overrunQty: number;
    rawRemainingAmount: number;
    availableAmount: number;
    overrunAmount: number;
  }> {
    let costItem: CostItem | null = null;
    let costItemId: number;

    if (typeof costItemOrId === 'object' && costItemOrId !== null) {
      costItem = costItemOrId;
      costItemId = Number(costItem.id);
    } else {
      costItemId = Number(costItemOrId);
      costItem = await manager.findOne(CostItem, {
        where: { id: costItemId },
      });
    }

    if (!costItem) {
      throw new NotFoundException(`Cost Item #${costItemId} tidak ditemukan.`);
    }

    const baselineQty = Number(costItem.quantity || 0);
    const baselineAmount = Number(costItem.subtotal || 0);

    // 1. Reserved Qty: Package status = 'SUBMITTED' (excluding current pkg if provided)
    const reservedParams: any[] = [costItemId];
    let excludePkgClause = '';
    if (excludePackageId) {
      excludePkgClause = 'AND pkg.id != ?';
      reservedParams.push(excludePackageId);
    }

    const reservedRes = await manager.query(
      `SELECT 
         COALESCE(SUM(ppi.requested_qty), 0) AS reserved_qty,
         COALESCE(SUM(ppi.requested_qty * ppi.estimated_unit_price), 0) AS reserved_amount
       FROM procurement_package_items ppi
       JOIN procurement_packages pkg ON ppi.package_id = pkg.id
       WHERE ppi.cost_item_id = ?
         AND pkg.status = 'SUBMITTED'
         ${excludePkgClause}
         AND pkg.deleted_at IS NULL
         AND ppi.deleted_at IS NULL`,
      reservedParams,
    );
    const reservedQty = Number(reservedRes[0]?.reserved_qty || 0);
    const reservedAmount = Number(reservedRes[0]?.reserved_amount || 0);

    // 2. PR Committed Qty: PR status in ('SUBMITTED', 'DIRECTOR_APPROVAL', 'REJECTED_TO_PROCUREMENT', 'APPROVED')
    // PO_ISSUED is explicitly excluded as it transfers to ordered_qty
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
    // Matched by poi.cost_item_id or linked pri.cost_item_id. PO CANCELLED = 0.
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

    // Authoritative Calculations
    const totalCommitted = Math.round((reservedQty + prCommittedQty + orderedQty) * 10000) / 10000;
    const rawRemainingQty = Math.round((baselineQty - totalCommitted) * 10000) / 10000;
    const availableQty = Math.max(0, rawRemainingQty);
    const overrunQty = Math.max(0, -rawRemainingQty);

    const totalCommittedAmount = Math.round((reservedAmount + prCommittedAmount + orderedAmount) * 100) / 100;
    const rawRemainingAmount = Math.round((baselineAmount - totalCommittedAmount) * 100) / 100;
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
      totalCommitted,
      rawRemainingQty,
      availableQty,
      overrunQty,
      rawRemainingAmount,
      availableAmount,
      overrunAmount,
    };
  }

  // =========================================================================
  // 9. CONCURRENCY-SAFE PACKAGE NUMBER GENERATOR
  // =========================================================================

  async closeCompletedPackage(packageId: number, userId?: number): Promise<boolean> {
    return this.inTransaction(async manager => {
      const pkg = await manager.findOne(ProcurementPackage, {
        where: { id: packageId }, lock: { mode: 'pessimistic_write' },
      });
      if (!pkg || pkg.status !== ProcurementPackageStatus.PR_CREATED) return false;
      // Serialize against payment/GR transactions before reading financial totals.
      const orders = await manager.query(`SELECT po.id, po.status, po.total_amount
        FROM purchase_orders po JOIN purchase_requests pr ON pr.id = po.pr_id
        WHERE pr.package_id = ? AND pr.deleted_at IS NULL AND po.deleted_at IS NULL
        ORDER BY po.id FOR UPDATE`, [packageId]);
      if (!orders.length || orders.some(po => po.status !== 'COMPLETED')) return false;
      for (const po of orders) {
        const [totals] = await manager.query(`SELECT
          COUNT(*) invoice_count,
          COALESCE(SUM(i.payment_status <> 'PAID' OR i.match_status <> 'VERIFIED'), 0) unpaid_count,
          COALESCE(SUM(i.total_amount), 0) invoiced_amount,
          COALESCE(SUM((SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p
            WHERE p.invoice_id = i.id AND p.deleted_at IS NULL)), 0) paid_amount
          FROM invoices i WHERE i.po_id = ? AND i.deleted_at IS NULL
            AND i.status <> 'CANCELLED' AND i.match_status <> 'REJECTED'`, [po.id]);
        const [terms] = await manager.query(`SELECT COUNT(*) unpaid_terms FROM po_payment_terms
          WHERE po_id = ? AND deleted_at IS NULL AND status <> 'PAID'`, [po.id]);
        if (!Number(totals.invoice_count) || Number(totals.unpaid_count) || Number(terms.unpaid_terms) ||
            Math.abs(Number(totals.invoiced_amount) - Number(po.total_amount)) > 0.001 ||
            Number(totals.paid_amount) < Number(po.total_amount) - 0.001) return false;
      }
      pkg.status = ProcurementPackageStatus.CLOSED;
      if (userId) pkg.updatedBy = userId;
      await manager.save(ProcurementPackage, pkg);
      await manager.save(AuditLog, manager.create(AuditLog, {
        table_name: 'procurement_packages', record_id: pkg.id, action: 'CLOSE_PACKAGE',
        old_value: { status: ProcurementPackageStatus.PR_CREATED },
        new_value: { status: ProcurementPackageStatus.CLOSED, poIds: orders.map(po => Number(po.id)) },
        created_by: userId || null,
      }));
      return true;
    });
  }

  async closeCompletedPackageForPo(poId: number, userId?: number) {
    const rows = await this.dataSource.manager.query(`SELECT pr.package_id FROM purchase_orders po
      JOIN purchase_requests pr ON pr.id = po.pr_id
      WHERE po.id = ? AND pr.package_id IS NOT NULL AND pr.deleted_at IS NULL AND po.deleted_at IS NULL`, [poId]);
    for (const row of rows) await this.closeCompletedPackage(Number(row.package_id), userId);
  }

  // Recover missed events and close eligible historical packages; GET endpoints remain read-only.
  @Cron('0 * * * * *')
  async reconcileCompletedPackages(): Promise<void> {
    const packages = await this.packageRepo.find({
      where: { status: ProcurementPackageStatus.PR_CREATED }, select: ['id'],
    });
    for (const pkg of packages) {
      try { await this.closeCompletedPackage(Number(pkg.id)); }
      catch (error) { this.logger.error(`Gagal menutup paket #${pkg.id}: ${error.message}`); }
    }
  }

  private async generatePackageNumber(manager: EntityManager): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PKG-${dateStr}-`;

    const latest = await manager
      .createQueryBuilder(ProcurementPackage, 'pkg')
      .setLock('pessimistic_write')
      .where('pkg.packageNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('pkg.packageNumber', 'DESC')
      .getOne();

    let nextSeq = 1;
    if (latest && latest.packageNumber) {
      const parts = latest.packageNumber.split('-');
      if (parts.length >= 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  // =========================================================================
  // 10. ROLE & OWNERSHIP HELPERS
  // =========================================================================

  private validateProjectManagerOwnership(
    project: Project,
    userId: number,
    roles: string[] = [],
  ): void {
    if (this.checkIsSuperAdmin(roles)) {
      return;
    }

    const assignedPmId = project.managerId !== null && project.managerId !== undefined
      ? Number(project.managerId)
      : null;

    if (!assignedPmId || assignedPmId !== Number(userId)) {
      throw new ForbiddenException(
        'Akses ditolak: Anda bukan Project Manager yang ditugaskan untuk proyek ini.',
      );
    }
  }

  private checkIsSuperAdmin(roles: string[] = []): boolean {
    return Array.isArray(roles) && roles.some((r) => String(r).toUpperCase() === 'SUPER_ADMIN');
  }

  private checkIsProcurement(roles: string[] = []): boolean {
    return (
      Array.isArray(roles) &&
      roles.some((r) => {
        const role = String(r).toUpperCase();
        return role === 'PROCUREMENT' || role === 'PURCHASING';
      })
    );
  }
}
