import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, In, IsNull } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { randomUUID } from "crypto";
import Decimal from "decimal.js";

import {
  ServiceClaim,
  ServiceClaimStatus,
  ServiceClaimAcceptanceType,
} from "../../entities/service-claim.entity";
import { ServiceClaimItem } from "../../entities/service-claim-item.entity";
import {
  PurchaseOrder,
  PurchaseOrderType,
} from "../../entities/purchase-order.entity";
import { PurchaseOrderItem } from "../../entities/purchase-order-item.entity";
import {
  ServiceOrder,
  ServiceOrderStatus,
} from "../../entities/service-order.entity";
import { Project } from "../../entities/project.entity";
import { Vendor } from "../../entities/vendor.entity";
import { Invoice } from "../../entities/invoice.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { OutboxEvent, OutboxStatus } from "../../entities/outbox-event.entity";
import { User } from "../../entities/user.entity";
import { CanonicalNotificationWriter } from "../notification/canonical-notification.writer";

import { CreateServiceClaimDto } from "./dto/create-service-claim.dto";
import { UpdateServiceClaimDto } from "./dto/update-service-claim.dto";
import {
  TechnicalVerificationDto,
  ClaimVerificationDecision,
} from "./dto/technical-verification.dto";
import { CommercialVerificationDto } from "./dto/commercial-verification.dto";
import { CancelServiceClaimDto } from "./dto/cancel-service-claim.dto";
import { QueryServiceClaimDto } from "./dto/query-service-claim.dto";

@Injectable()
export class ServiceClaimService {
  private readonly logger = new Logger(ServiceClaimService.name);

  constructor(
    @InjectRepository(ServiceClaim)
    private readonly claimRepo: Repository<ServiceClaim>,
    @InjectRepository(ServiceClaimItem)
    private readonly claimItemRepo: Repository<ServiceClaimItem>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly poItemRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(ServiceOrder)
    private readonly soRepo: Repository<ServiceOrder>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    private readonly dataSource: DataSource,
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional()
    private readonly notificationWriter?: CanonicalNotificationWriter,
  ) {}

  // -------------------------------------------------------------
  // HELPER: EXACT DECIMAL ARITHMETIC
  // -------------------------------------------------------------
  private toDec(val: any): Decimal {
    return new Decimal(
      val === null || val === undefined || isNaN(Number(val)) ? 0 : val,
    );
  }

  private roundMoney(dec: Decimal): number {
    return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  private roundQty(dec: Decimal): number {
    return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  // -------------------------------------------------------------
  // HELPER: NUMBER GENERATION (SCL-YYYYMMDD-XXX)
  // -------------------------------------------------------------
  private async generateClaimNumber(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let candidateNumber = "";
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      attempts++;
      const count = await this.claimRepo
        .createQueryBuilder("c")
        .where("c.claim_number LIKE :prefix", { prefix: `SCL-${dateStr}%` })
        .getCount();

      const seq = String(count + attempts).padStart(3, "0");
      candidateNumber = `SCL-${dateStr}-${seq}`;

      const existing = await this.claimRepo.findOne({
        where: { claimNumber: candidateNumber },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    if (!isUnique || !candidateNumber) {
      throw new ConflictException("Gagal menghasilkan nomor klaim unik.");
    }
    return candidateNumber;
  }

  // -------------------------------------------------------------
  // 1. GET PO BALANCE (REALTIME CUMULATIVE & REMAINING QUANTITY)
  // -------------------------------------------------------------
  async getPoBalance(poId: number) {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: [
        "items",
        "purchaseRequest",
        "purchaseRequest.project",
        "vendor",
      ],
    });

    if (!po || po.deletedAt) {
      throw new NotFoundException(`Purchase Order #${poId} tidak ditemukan.`);
    }

    if (po.orderType !== PurchaseOrderType.SERVICE) {
      throw new BadRequestException(
        `Purchase Order #${po.poNumber} bertipe ${po.orderType}. Hanya PO bertipe SERVICE yang mendukung kalkulasi saldo klaim jasa.`,
      );
    }

    // Query all APPROVED_FOR_INVOICE claims for this PO
    const approvedClaims = await this.claimRepo.find({
      where: { poId, status: ServiceClaimStatus.APPROVED_FOR_INVOICE },
      relations: ["items"],
    });

    const approvedQtyMap = new Map<number, Decimal>();
    const approvedAmountMap = new Map<number, Decimal>();

    for (const claim of approvedClaims) {
      for (const item of claim.items || []) {
        const currentQty = approvedQtyMap.get(item.poItemId) || new Decimal(0);
        approvedQtyMap.set(
          item.poItemId,
          currentQty.plus(this.toDec(item.currentClaimQuantity)),
        );

        const currentAmt =
          approvedAmountMap.get(item.poItemId) || new Decimal(0);
        approvedAmountMap.set(
          item.poItemId,
          currentAmt.plus(this.toDec(item.currentClaimAmount)),
        );
      }
    }

    let totalContractAmountDec = new Decimal(0);
    let totalApprovedAmountDec = new Decimal(0);

    const itemsSummary = (po.items || []).map((poi) => {
      const contractQtyDec = this.toDec(poi.quantity);
      const contractRateDec = this.toDec(poi.unitPrice);
      const contractValueDec = this.toDec(
        poi.totalPrice || contractQtyDec.times(contractRateDec),
      );

      const approvedQtyDec = approvedQtyMap.get(poi.id) || new Decimal(0);
      const remainingQtyDec = Decimal.max(
        0,
        contractQtyDec.minus(approvedQtyDec),
      );

      const approvedAmtDec = approvedAmountMap.get(poi.id) || new Decimal(0);
      const remainingAmtDec = Decimal.max(
        0,
        contractValueDec.minus(approvedAmtDec),
      );

      totalContractAmountDec = totalContractAmountDec.plus(contractValueDec);
      totalApprovedAmountDec = totalApprovedAmountDec.plus(approvedAmtDec);

      return {
        poItemId: poi.id,
        itemName: poi.itemName,
        uom: poi.uom || "Unit",
        contractQuantity: this.roundQty(contractQtyDec),
        contractUnitRate: this.roundMoney(contractRateDec),
        contractValue: this.roundMoney(contractValueDec),
        approvedQuantity: this.roundQty(approvedQtyDec),
        remainingQuantity: this.roundQty(remainingQtyDec),
        approvedAmount: this.roundMoney(approvedAmtDec),
        remainingAmount: this.roundMoney(remainingAmtDec),
      };
    });

    const totalRemainingAmountDec = Decimal.max(
      0,
      totalContractAmountDec.minus(totalApprovedAmountDec),
    );

    return {
      poId: po.id,
      poNumber: po.poNumber,
      orderType: po.orderType,
      status: po.status,
      projectId: po.purchaseRequest?.projectId,
      projectName: po.purchaseRequest?.project?.name,
      vendorId: po.vendorId,
      vendorName: po.vendor?.name,
      totalContractAmount: this.roundMoney(totalContractAmountDec),
      totalApprovedAmount: this.roundMoney(totalApprovedAmountDec),
      totalRemainingAmount: this.roundMoney(totalRemainingAmountDec),
      items: itemsSummary,
    };
  }

  // -------------------------------------------------------------
  // 2. CREATE DRAFT SERVICE CLAIM
  // -------------------------------------------------------------
  async createDraft(
    dto: CreateServiceClaimDto,
    userId: number,
  ): Promise<ServiceClaim> {
    const poId = Number(dto.purchaseOrderId || dto.poId);
    if (!poId) {
      throw new BadRequestException(
        "ID Purchase Order (purchaseOrderId / poId) wajib diisi.",
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: poId },
        relations: [
          "items",
          "purchaseRequest",
          "purchaseRequest.project",
          "vendor",
        ],
        lock: { mode: "pessimistic_write" },
      });

      if (!po || po.deletedAt) {
        throw new NotFoundException(`Purchase Order #${poId} tidak ditemukan.`);
      }

      // Eligibility Guard
      if (po.orderType === PurchaseOrderType.MATERIAL) {
        throw new BadRequestException(
          "Purchase Order bertipe MATERIAL tidak dapat diajukan klaim jasa. Gunakan alur Goods Receipt.",
        );
      }
      if (po.orderType === PurchaseOrderType.LEGACY_MIXED) {
        throw new BadRequestException(
          "Purchase Order LEGACY_MIXED bersifat historis dan tidak dapat diajukan klaim jasa baru (R1).",
        );
      }
      if (po.orderType !== PurchaseOrderType.SERVICE) {
        throw new BadRequestException(
          `Hanya Purchase Order bertipe SERVICE yang dapat diajukan klaim jasa (tipe saat ini: ${po.orderType}).`,
        );
      }

      // Reconciled Guard (Concurrency-safe under PO lock)
      if (po.serviceScopeReconciledAt) {
        throw new ConflictException(
          `Purchase Order #${po.poNumber} telah direkonsiliasi ruang lingkup jasanya pada ${po.serviceScopeReconciledAt}. Pengajuan klaim jasa baru ditolak.`,
        );
      }

      // Terminality Guard for CLOSED Project
      if (po.purchaseRequest?.project?.status === "CLOSED") {
        throw new ConflictException(
          `Proyek #${po.purchaseRequest.project.code || po.purchaseRequest.projectId} telah ditutup (CLOSED). Pengajuan klaim jasa baru ditolak.`,
        );
      }

      const eligiblePoStatuses = ["ISSUED", "PARTIALLY_FULFILLED", "COMPLETED"];
      if (!eligiblePoStatuses.includes(po.status)) {
        throw new BadRequestException(
          `Klaim jasa tidak dapat dibuat untuk PO berstatus ${po.status}. Status yang diizinkan: ${eligiblePoStatuses.join(", ")}.`,
        );
      }

      // Optional ServiceOrder Validation
      let validServiceOrderId: number | null = null;
      if (dto.serviceOrderId) {
        const so = await queryRunner.manager.findOne(ServiceOrder, {
          where: { id: dto.serviceOrderId },
        });
        if (!so || so.deletedAt) {
          throw new BadRequestException(
            `Service Order #${dto.serviceOrderId} tidak ditemukan.`,
          );
        }
        if (Number(so.purchaseOrderId) !== Number(po.id)) {
          throw new BadRequestException(
            `Service Order #${so.serviceOrderNumber} bukan milik Purchase Order #${po.poNumber}.`,
          );
        }
        if (Number(so.projectId) !== Number(po.purchaseRequest?.projectId)) {
          throw new BadRequestException(
            `Service Order #${so.serviceOrderNumber} memiliki relasi project yang berbeda dengan PO.`,
          );
        }
        if (Number(so.vendorId) !== Number(po.vendorId)) {
          throw new BadRequestException(
            `Service Order #${so.serviceOrderNumber} memiliki relasi vendor yang berbeda dengan PO.`,
          );
        }
        if (so.status !== ServiceOrderStatus.ISSUED) {
          throw new BadRequestException(
            `Service Order #${so.serviceOrderNumber} berstatus ${so.status}. Hanya Service Order berstatus ISSUED yang dapat direferensikan.`,
          );
        }
        validServiceOrderId = so.id;
      }

      if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
        throw new BadRequestException(
          "Klaim jasa wajib menyertakan minimal 1 item.",
        );
      }

      // Duplicate item check
      const seenPoItemIds = new Set<number>();
      for (const item of dto.items) {
        if (seenPoItemIds.has(Number(item.poItemId))) {
          throw new BadRequestException(
            `Duplikasi item PO #${item.poItemId} dalam satu pengajuan klaim tidak diizinkan.`,
          );
        }
        seenPoItemIds.add(Number(item.poItemId));
      }

      // Prior Approved Claims
      const approvedClaims = await queryRunner.manager.find(ServiceClaim, {
        where: { poId: po.id, status: ServiceClaimStatus.APPROVED_FOR_INVOICE },
        relations: ["items"],
      });

      const approvedQtyMap = new Map<number, Decimal>();
      const approvedAmountMap = new Map<number, Decimal>();
      for (const ac of approvedClaims) {
        for (const aci of ac.items || []) {
          const prevQ = approvedQtyMap.get(aci.poItemId) || new Decimal(0);
          approvedQtyMap.set(
            aci.poItemId,
            prevQ.plus(this.toDec(aci.currentClaimQuantity)),
          );

          const prevA = approvedAmountMap.get(aci.poItemId) || new Decimal(0);
          approvedAmountMap.set(
            aci.poItemId,
            prevA.plus(this.toDec(aci.currentClaimAmount)),
          );
        }
      }

      let totalClaimAmountDec = new Decimal(0);
      const claimItemsToSave: ServiceClaimItem[] = [];

      for (const itemDto of dto.items) {
        const poItem = (po.items || []).find(
          (i) => Number(i.id) === Number(itemDto.poItemId),
        );
        if (!poItem) {
          throw new BadRequestException(
            `Item PO #${itemDto.poItemId} bukan bagian dari Purchase Order #${po.poNumber}.`,
          );
        }

        const claimQtyDec = this.toDec(itemDto.currentClaimQuantity);
        if (claimQtyDec.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            `Kuantitas klaim untuk item '${poItem.itemName}' harus lebih besar dari 0.`,
          );
        }

        const contractQtyDec = this.toDec(poItem.quantity);
        const contractRateDec = this.toDec(poItem.unitPrice);
        const contractValueDec = this.toDec(
          poItem.totalPrice || contractQtyDec.times(contractRateDec),
        );

        const prevApprovedQtyDec =
          approvedQtyMap.get(poItem.id) || new Decimal(0);
        const cumulativeQtyDec = prevApprovedQtyDec.plus(claimQtyDec);
        const remainingQtyDec = contractQtyDec.minus(cumulativeQtyDec);

        // Overclaim Quantity Guard
        if (cumulativeQtyDec.greaterThan(contractQtyDec)) {
          throw new BadRequestException(
            `Kuantitas klaim (${this.roundQty(claimQtyDec)}) untuk item '${poItem.itemName}' melebihi sisa kontrak (${this.roundQty(
              contractQtyDec.minus(prevApprovedQtyDec),
            )}). Kontrak: ${this.roundQty(contractQtyDec)}, Telah disetujui: ${this.roundQty(prevApprovedQtyDec)}.`,
          );
        }

        const currentAmountDec = claimQtyDec.times(contractRateDec);
        const prevApprovedAmtDec =
          approvedAmountMap.get(poItem.id) || new Decimal(0);
        const cumulativeAmtDec = prevApprovedAmtDec.plus(currentAmountDec);
        const remainingContractValDec =
          contractValueDec.minus(cumulativeAmtDec);

        // Overclaim Value Guard
        if (cumulativeAmtDec.greaterThan(contractValueDec)) {
          throw new BadRequestException(
            `Nilai klaim kumulatif untuk item '${poItem.itemName}' melebihi nilai kontrak item.`,
          );
        }

        totalClaimAmountDec = totalClaimAmountDec.plus(currentAmountDec);

        const claimItem = new ServiceClaimItem();
        claimItem.poItemId = poItem.id;
        claimItem.itemNameSnapshot = poItem.itemName;
        claimItem.uomSnapshot = poItem.uom || "Unit";
        claimItem.contractQuantitySnapshot = this.roundQty(contractQtyDec);
        claimItem.contractUnitRateSnapshot = this.roundMoney(contractRateDec);
        claimItem.contractValueSnapshot = this.roundMoney(contractValueDec);
        claimItem.previousApprovedQuantity = this.roundQty(prevApprovedQtyDec);
        claimItem.currentClaimQuantity = this.roundQty(claimQtyDec);
        claimItem.cumulativeApprovedQuantity = this.roundQty(cumulativeQtyDec);
        claimItem.remainingQuantity = this.roundQty(remainingQtyDec);
        claimItem.previousApprovedAmount = this.roundMoney(prevApprovedAmtDec);
        claimItem.currentClaimAmount = this.roundMoney(currentAmountDec);
        claimItem.cumulativeApprovedAmount = this.roundMoney(cumulativeAmtDec);
        claimItem.remainingContractValue = this.roundMoney(
          remainingContractValDec,
        );
        claimItem.workLocation = itemDto.workLocation || (null as any);
        claimItem.notes = itemDto.notes || (null as any);

        claimItemsToSave.push(claimItem);
      }

      const claimNumber = await this.generateClaimNumber();

      const claim = new ServiceClaim();
      claim.claimNumber = claimNumber;
      claim.poId = po.id;
      claim.serviceOrderId = validServiceOrderId as any;
      claim.projectId = Number(po.purchaseRequest?.projectId);
      claim.vendorId = Number(po.vendorId);
      claim.claimPeriodStart = dto.claimPeriodStart || (null as any);
      claim.claimPeriodEnd = dto.claimPeriodEnd || (null as any);
      claim.status = ServiceClaimStatus.DRAFT;
      claim.totalClaimAmount = this.roundMoney(totalClaimAmountDec);
      claim.approvedClaimAmount = 0;
      claim.acceptanceType = dto.acceptanceType || (null as any);
      claim.acceptanceReference = dto.acceptanceReference || (null as any);
      claim.acceptanceDate = dto.acceptanceDate || (null as any);
      claim.notes = dto.notes || (null as any);
      claim.createdBy = userId;
      claim.items = claimItemsToSave;

      const savedClaim = await queryRunner.manager.save(ServiceClaim, claim);

      // Audit Log
      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "service_claims",
        record_id: savedClaim.id,
        action: "SERVICE_CLAIM_CREATED",
        old_value: null,
        new_value: {
          claimNumber: savedClaim.claimNumber,
          poId: savedClaim.poId,
          serviceOrderId: savedClaim.serviceOrderId,
          status: savedClaim.status,
          totalClaimAmount: savedClaim.totalClaimAmount,
          itemCount: claimItemsToSave.length,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      await queryRunner.commitTransaction();

      return (await this.getClaim(savedClaim.id)) || savedClaim;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // -------------------------------------------------------------
  // 3. UPDATE DRAFT SERVICE CLAIM
  // -------------------------------------------------------------
  async updateDraft(
    id: number,
    dto: UpdateServiceClaimDto,
    userId: number,
  ): Promise<ServiceClaim> {
    const claim = await this.claimRepo.findOne({
      where: { id },
      relations: ["items", "purchaseOrder", "purchaseOrder.items"],
    });

    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Klaim Jasa #${id} tidak ditemukan.`);
    }

    if (
      claim.status !== ServiceClaimStatus.DRAFT &&
      claim.status !== ServiceClaimStatus.NEEDS_REVISION
    ) {
      throw new BadRequestException(
        `Klaim Jasa dengan status '${claim.status}' tidak dapat diedit. Hanya status DRAFT atau NEEDS_REVISION yang dapat diedit.`,
      );
    }

    if (claim.status === ServiceClaimStatus.NEEDS_REVISION) {
      claim.pmVerifierId = null as any;
      claim.pmVerifiedAt = null as any;
      claim.commercialVerifierId = null as any;
      claim.commercialVerifiedAt = null as any;
    }

    const po = claim.purchaseOrder;
    if (po?.serviceScopeReconciledAt) {
      throw new ConflictException(
        `Purchase Order #${po.poNumber} telah direkonsiliasi ruang lingkup jasanya pada ${po.serviceScopeReconciledAt}. Perubahan klaim ditolak.`,
      );
    }

    if (dto.serviceOrderId !== undefined) {
      if (dto.serviceOrderId === null) {
        claim.serviceOrderId = null as any;
      } else {
        const so = await this.soRepo.findOne({
          where: { id: dto.serviceOrderId },
        });
        if (
          !so ||
          so.deletedAt ||
          Number(so.purchaseOrderId) !== Number(po.id) ||
          so.status !== ServiceOrderStatus.ISSUED
        ) {
          throw new BadRequestException(
            "Service Order tidak valid atau belum berstatus ISSUED.",
          );
        }
        claim.serviceOrderId = so.id;
      }
    }

    if (dto.claimPeriodStart !== undefined)
      claim.claimPeriodStart = dto.claimPeriodStart || (null as any);
    if (dto.claimPeriodEnd !== undefined)
      claim.claimPeriodEnd = dto.claimPeriodEnd || (null as any);
    if (dto.acceptanceType !== undefined)
      claim.acceptanceType = dto.acceptanceType || (null as any);
    if (dto.acceptanceReference !== undefined)
      claim.acceptanceReference = dto.acceptanceReference || (null as any);
    if (dto.acceptanceDate !== undefined)
      claim.acceptanceDate = dto.acceptanceDate || (null as any);
    if (dto.notes !== undefined) claim.notes = dto.notes || (null as any);

    if (dto.items && Array.isArray(dto.items)) {
      if (dto.items.length === 0) {
        throw new BadRequestException(
          "Klaim jasa wajib menyertakan minimal 1 item.",
        );
      }

      // Check duplicates
      const seen = new Set<number>();
      for (const it of dto.items) {
        if (seen.has(Number(it.poItemId))) {
          throw new BadRequestException(
            `Duplikasi item PO #${it.poItemId} tidak diizinkan.`,
          );
        }
        seen.add(Number(it.poItemId));
      }

      // Prior Approved Claims (excluding current)
      const approvedClaims = await this.claimRepo.find({
        where: { poId: po.id, status: ServiceClaimStatus.APPROVED_FOR_INVOICE },
        relations: ["items"],
      });

      const approvedQtyMap = new Map<number, Decimal>();
      const approvedAmountMap = new Map<number, Decimal>();
      for (const ac of approvedClaims) {
        for (const aci of ac.items || []) {
          const prevQ = approvedQtyMap.get(aci.poItemId) || new Decimal(0);
          approvedQtyMap.set(
            aci.poItemId,
            prevQ.plus(this.toDec(aci.currentClaimQuantity)),
          );

          const prevA = approvedAmountMap.get(aci.poItemId) || new Decimal(0);
          approvedAmountMap.set(
            aci.poItemId,
            prevA.plus(this.toDec(aci.currentClaimAmount)),
          );
        }
      }

      // Remove existing items and rebuild
      await this.claimItemRepo.delete({ serviceClaimId: claim.id });

      let totalClaimAmountDec = new Decimal(0);
      const newClaimItems: ServiceClaimItem[] = [];

      for (const itDto of dto.items) {
        const poItem = (po.items || []).find(
          (i) => Number(i.id) === Number(itDto.poItemId),
        );
        if (!poItem) {
          throw new BadRequestException(
            `Item PO #${itDto.poItemId} bukan bagian dari PO.`,
          );
        }

        const claimQtyDec = this.toDec(itDto.currentClaimQuantity);
        if (claimQtyDec.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            `Kuantitas klaim item '${poItem.itemName}' harus lebih besar dari 0.`,
          );
        }

        const contractQtyDec = this.toDec(poItem.quantity);
        const contractRateDec = this.toDec(poItem.unitPrice);
        const contractValueDec = this.toDec(
          poItem.totalPrice || contractQtyDec.times(contractRateDec),
        );

        const prevApprovedQtyDec =
          approvedQtyMap.get(poItem.id) || new Decimal(0);
        const cumulativeQtyDec = prevApprovedQtyDec.plus(claimQtyDec);
        const remainingQtyDec = contractQtyDec.minus(cumulativeQtyDec);

        if (cumulativeQtyDec.greaterThan(contractQtyDec)) {
          throw new BadRequestException(
            `Kuantitas klaim (${this.roundQty(claimQtyDec)}) untuk item '${poItem.itemName}' melebihi sisa kontrak (${this.roundQty(
              contractQtyDec.minus(prevApprovedQtyDec),
            )}).`,
          );
        }

        const currentAmountDec = claimQtyDec.times(contractRateDec);
        const prevApprovedAmtDec =
          approvedAmountMap.get(poItem.id) || new Decimal(0);
        const cumulativeAmtDec = prevApprovedAmtDec.plus(currentAmountDec);
        const remainingContractValDec =
          contractValueDec.minus(cumulativeAmtDec);

        if (cumulativeAmtDec.greaterThan(contractValueDec)) {
          throw new BadRequestException(
            `Nilai klaim kumulatif untuk item '${poItem.itemName}' melebihi nilai kontrak item.`,
          );
        }

        totalClaimAmountDec = totalClaimAmountDec.plus(currentAmountDec);

        const ci = new ServiceClaimItem();
        ci.serviceClaimId = claim.id;
        ci.poItemId = poItem.id;
        ci.itemNameSnapshot = poItem.itemName;
        ci.uomSnapshot = poItem.uom || "Unit";
        ci.contractQuantitySnapshot = this.roundQty(contractQtyDec);
        ci.contractUnitRateSnapshot = this.roundMoney(contractRateDec);
        ci.contractValueSnapshot = this.roundMoney(contractValueDec);
        ci.previousApprovedQuantity = this.roundQty(prevApprovedQtyDec);
        ci.currentClaimQuantity = this.roundQty(claimQtyDec);
        ci.cumulativeApprovedQuantity = this.roundQty(cumulativeQtyDec);
        ci.remainingQuantity = this.roundQty(remainingQtyDec);
        ci.previousApprovedAmount = this.roundMoney(prevApprovedAmtDec);
        ci.currentClaimAmount = this.roundMoney(currentAmountDec);
        ci.cumulativeApprovedAmount = this.roundMoney(cumulativeAmtDec);
        ci.remainingContractValue = this.roundMoney(remainingContractValDec);
        ci.workLocation = itDto.workLocation || (null as any);
        ci.notes = itDto.notes || (null as any);

        newClaimItems.push(ci);
      }

      await this.claimItemRepo.save(newClaimItems);
      claim.totalClaimAmount = this.roundMoney(totalClaimAmountDec);
    }

    delete (claim as any).items;
    delete (claim as any).purchaseOrder;
    delete (claim as any).serviceOrder;
    delete (claim as any).project;
    delete (claim as any).vendor;
    delete (claim as any).invoices;

    const saved = await this.claimRepo.save(claim);

    // Audit Log
    const audit = this.auditLogRepo.create({
      table_name: "service_claims",
      record_id: saved.id,
      action: "SERVICE_CLAIM_UPDATED",
      old_value: null,
      new_value: {
        totalClaimAmount: saved.totalClaimAmount,
        notes: saved.notes,
      },
      created_by: userId,
    });
    await this.auditLogRepo.save(audit);

    return (await this.getClaim(saved.id))!;
  }

  // -------------------------------------------------------------
  // 4. SUBMIT (OR RESUBMIT FROM NEEDS_REVISION)
  // -------------------------------------------------------------
  async submit(id: number, userId: number): Promise<ServiceClaim> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const claim = await queryRunner.manager.findOne(ServiceClaim, {
        where: { id },
        relations: ["items", "purchaseOrder", "purchaseOrder.items"],
        lock: { mode: "pessimistic_write" },
      });

      if (!claim || claim.deletedAt) {
        throw new NotFoundException(`Klaim Jasa #${id} tidak ditemukan.`);
      }

      // Concurrency lock on PurchaseOrder row
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: claim.poId },
        lock: { mode: "pessimistic_write" },
      });

      if (
        po?.serviceScopeReconciledAt ||
        claim.purchaseOrder?.serviceScopeReconciledAt
      ) {
        const recAt =
          po?.serviceScopeReconciledAt ||
          claim.purchaseOrder?.serviceScopeReconciledAt;
        const poNum = po?.poNumber || claim.purchaseOrder?.poNumber;
        throw new ConflictException(
          `Purchase Order #${poNum} telah direkonsiliasi ruang lingkup jasanya pada ${recAt}. Pengajuan klaim ditolak.`,
        );
      }

      if (
        claim.status !== ServiceClaimStatus.DRAFT &&
        claim.status !== ServiceClaimStatus.NEEDS_REVISION
      ) {
        throw new BadRequestException(
          `Hanya klaim berstatus DRAFT atau NEEDS_REVISION yang dapat disubmit (status saat ini: ${claim.status}).`,
        );
      }

      if (!claim.items || claim.items.length === 0) {
        throw new BadRequestException(
          "Klaim jasa wajib memiliki minimal 1 item sebelum disubmit.",
        );
      }

      const isResubmit = claim.status === ServiceClaimStatus.NEEDS_REVISION;

      // Re-read latest approved claims under transaction to re-validate overclaim
      const approvedClaims = await queryRunner.manager.find(ServiceClaim, {
        where: {
          poId: claim.poId,
          status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
        },
        relations: ["items"],
      });

      const approvedQtyMap = new Map<number, Decimal>();
      const approvedAmountMap = new Map<number, Decimal>();
      for (const ac of approvedClaims) {
        for (const aci of ac.items || []) {
          const prevQ = approvedQtyMap.get(aci.poItemId) || new Decimal(0);
          approvedQtyMap.set(
            aci.poItemId,
            prevQ.plus(this.toDec(aci.currentClaimQuantity)),
          );

          const prevA = approvedAmountMap.get(aci.poItemId) || new Decimal(0);
          approvedAmountMap.set(
            aci.poItemId,
            prevA.plus(this.toDec(aci.currentClaimAmount)),
          );
        }
      }

      // Re-validate and refresh snapshots on all claim items
      for (const item of claim.items) {
        const poItem = (claim.purchaseOrder.items || []).find(
          (i) => Number(i.id) === Number(item.poItemId),
        );
        if (!poItem) {
          throw new BadRequestException(
            `Item PO #${item.poItemId} tidak valid.`,
          );
        }

        const claimQtyDec = this.toDec(item.currentClaimQuantity);
        const contractQtyDec = this.toDec(poItem.quantity);
        const contractRateDec = this.toDec(poItem.unitPrice);
        const contractValueDec = this.toDec(
          poItem.totalPrice || contractQtyDec.times(contractRateDec),
        );

        const prevApprovedQtyDec =
          approvedQtyMap.get(poItem.id) || new Decimal(0);
        const cumulativeQtyDec = prevApprovedQtyDec.plus(claimQtyDec);

        if (cumulativeQtyDec.greaterThan(contractQtyDec)) {
          throw new BadRequestException(
            `Kuantitas klaim untuk item '${poItem.itemName}' melebihi sisa kontrak saat verifikasi submit.`,
          );
        }

        const currentAmountDec = claimQtyDec.times(contractRateDec);
        const prevApprovedAmtDec =
          approvedAmountMap.get(poItem.id) || new Decimal(0);
        const cumulativeAmtDec = prevApprovedAmtDec.plus(currentAmountDec);

        if (cumulativeAmtDec.greaterThan(contractValueDec)) {
          throw new BadRequestException(
            `Nilai klaim kumulatif untuk item '${poItem.itemName}' melebihi nilai kontrak.`,
          );
        }

        item.previousApprovedQuantity = this.roundQty(prevApprovedQtyDec);
        item.cumulativeApprovedQuantity = this.roundQty(cumulativeQtyDec);
        item.remainingQuantity = this.roundQty(
          contractQtyDec.minus(cumulativeQtyDec),
        );
        item.previousApprovedAmount = this.roundMoney(prevApprovedAmtDec);
        item.currentClaimAmount = this.roundMoney(currentAmountDec);
        item.cumulativeApprovedAmount = this.roundMoney(cumulativeAmtDec);
        item.remainingContractValue = this.roundMoney(
          contractValueDec.minus(cumulativeAmtDec),
        );

        await queryRunner.manager.save(ServiceClaimItem, item);
      }

      // State Transition
      claim.status = ServiceClaimStatus.SUBMITTED;
      claim.submittedBy = userId;
      claim.submittedAt = new Date();

      // Reset prior verification fields if resubmit
      if (isResubmit) {
        claim.pmVerifierId = null as any;
        claim.pmVerifiedAt = null as any;
        claim.commercialVerifierId = null as any;
        claim.commercialVerifiedAt = null as any;
      }

      const savedClaim = await queryRunner.manager.save(ServiceClaim, claim);

      // Audit Log Action
      const auditAction = isResubmit
        ? "SERVICE_CLAIM_RESUBMITTED"
        : "SERVICE_CLAIM_SUBMITTED";
      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "service_claims",
        record_id: savedClaim.id,
        action: auditAction,
        old_value: {
          status: isResubmit
            ? ServiceClaimStatus.NEEDS_REVISION
            : ServiceClaimStatus.DRAFT,
        },
        new_value: {
          status: ServiceClaimStatus.SUBMITTED,
          submittedBy: userId,
          submittedAt: savedClaim.submittedAt,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      // Outbox Event
      const eventId = randomUUID();
      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: eventId,
        event_name: "procurement.service_claim.submitted",
        event_version: "1",
        aggregate_type: "ServiceClaim",
        aggregate_id: Number(savedClaim.id),
        correlation_id: null,
        payload: {
          claimId: savedClaim.id,
          claimNumber: savedClaim.claimNumber,
          poId: savedClaim.poId,
          projectId: savedClaim.projectId,
          vendorId: savedClaim.vendorId,
          totalClaimAmount: savedClaim.totalClaimAmount,
          submittedBy: userId,
          isResubmit,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, outbox);

      await queryRunner.commitTransaction();

      // Canonical Notification to assigned Project Manager
      const project = await this.projectRepo.findOne({
        where: { id: savedClaim.projectId },
      });
      if (project && project.managerId && this.notificationWriter) {
        try {
          await this.notificationWriter.persistCanonicalNotification({
            eventId,
            recipientId: Number(project.managerId),
            purpose: "SERVICE_CLAIM_SUBMITTED",
            title: `Pengajuan Klaim Jasa Baru (${savedClaim.claimNumber})`,
            message: `Klaim jasa baru untuk PO #${savedClaim.purchaseOrder?.poNumber || savedClaim.poId} diajukan dan membutuhkan verifikasi teknis.`,
            type: "TASK",
            actionTarget: `/project?projectId=${savedClaim.projectId}&claimId=${savedClaim.id}`,
            metaData: {
              claimId: savedClaim.id,
              claimNumber: savedClaim.claimNumber,
              projectId: savedClaim.projectId,
            },
          });
        } catch (notifErr: any) {
          this.logger.warn(
            `Failed to project canonical notification for submitted claim: ${notifErr.message}`,
          );
        }
      }

      return (await this.getClaim(savedClaim.id))!;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // -------------------------------------------------------------
  // 5. PM TECHNICAL VERIFICATION
  // -------------------------------------------------------------
  async verifyTechnical(
    id: number,
    dto: TechnicalVerificationDto,
    userId: number,
    userRoles: string[] = [],
  ): Promise<ServiceClaim> {
    const claim = await this.claimRepo.findOne({
      where: { id },
      relations: ["project", "purchaseOrder"],
    });

    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Klaim Jasa #${id} tidak ditemukan.`);
    }

    if (claim.status !== ServiceClaimStatus.SUBMITTED) {
      throw new ConflictException(
        `Klaim tidak dapat diverifikasi teknis karena status saat ini adalah '${claim.status}' (wajib SUBMITTED).`,
      );
    }

    // Role & Assigned PM Check
    const project = claim.project;
    if (
      !project ||
      project.managerId === null ||
      project.managerId === undefined
    ) {
      throw new ForbiddenException(
        "Proyek terkait belum memiliki Project Manager yang ditugaskan.",
      );
    }

    const isAssignedPm = Number(project.managerId) === Number(userId);

    if (!isAssignedPm) {
      throw new ForbiddenException(
        "Hanya Project Manager yang ditugaskan pada proyek ini yang berhak melakukan verifikasi teknis klaim jasa.",
      );
    }

    // SoD Rule: Submitter cannot be technical verifier
    if (Number(claim.submittedBy) === Number(userId)) {
      throw new ForbiddenException(
        "Segregation of Duties: Submitter klaim dilarang memverifikasi teknis klaim miliknya sendiri.",
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockedClaim = await queryRunner.manager.findOne(ServiceClaim, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });

      if (!lockedClaim || lockedClaim.status !== ServiceClaimStatus.SUBMITTED) {
        throw new ConflictException(
          "Status klaim telah berubah saat proses verifikasi berlangsung.",
        );
      }

      let auditAction = "";
      let outboxEventName = "";

      if (dto.decision === ClaimVerificationDecision.APPROVE) {
        lockedClaim.status = ServiceClaimStatus.PM_VERIFIED;
        lockedClaim.pmVerifierId = userId;
        lockedClaim.pmVerifiedAt = new Date();
        auditAction = "SERVICE_CLAIM_TECHNICALLY_APPROVED";
        outboxEventName = "procurement.service_claim.pm_verified";
      } else if (dto.decision === ClaimVerificationDecision.RETURN) {
        if (
          !dto.revisionNotes ||
          typeof dto.revisionNotes !== "string" ||
          dto.revisionNotes.trim().length === 0
        ) {
          throw new BadRequestException(
            "Catatan revisi (revisionNotes) wajib diisi saat meminta revisi klaim.",
          );
        }
        lockedClaim.status = ServiceClaimStatus.NEEDS_REVISION;
        lockedClaim.revisionNotes = dto.revisionNotes.trim();
        lockedClaim.pmVerifierId = null as any;
        lockedClaim.pmVerifiedAt = null as any;
        auditAction = "SERVICE_CLAIM_TECHNICALLY_RETURNED";
        outboxEventName = "procurement.service_claim.returned";
      } else if (dto.decision === ClaimVerificationDecision.REJECT) {
        if (
          !dto.rejectionReason ||
          typeof dto.rejectionReason !== "string" ||
          dto.rejectionReason.trim().length === 0
        ) {
          throw new BadRequestException(
            "Alasan penolakan (rejectionReason) wajib diisi saat menolak klaim.",
          );
        }
        lockedClaim.status = ServiceClaimStatus.REJECTED;
        lockedClaim.rejectionReason = dto.rejectionReason.trim();
        auditAction = "SERVICE_CLAIM_TECHNICALLY_REJECTED";
        outboxEventName = "procurement.service_claim.rejected";
      } else {
        throw new BadRequestException(
          `Keputusan verifikasi '${dto.decision}' tidak valid.`,
        );
      }

      const saved = await queryRunner.manager.save(ServiceClaim, lockedClaim);

      // Audit Log
      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "service_claims",
        record_id: saved.id,
        action: auditAction,
        old_value: { status: ServiceClaimStatus.SUBMITTED },
        new_value: {
          status: saved.status,
          decision: dto.decision,
          pmVerifierId: saved.pmVerifierId,
          revisionNotes: saved.revisionNotes,
          rejectionReason: saved.rejectionReason,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      // Outbox Event
      const eventId = randomUUID();
      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: eventId,
        event_name: outboxEventName,
        event_version: "1",
        aggregate_type: "ServiceClaim",
        aggregate_id: Number(saved.id),
        correlation_id: null,
        payload: {
          claimId: saved.id,
          claimNumber: saved.claimNumber,
          decision: dto.decision,
          verifierId: userId,
          revisionNotes: saved.revisionNotes,
          rejectionReason: saved.rejectionReason,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, outbox);

      await queryRunner.commitTransaction();

      // Notifications projection
      if (this.notificationWriter) {
        try {
          if (
            dto.decision === ClaimVerificationDecision.RETURN ||
            dto.decision === ClaimVerificationDecision.REJECT
          ) {
            // Notify submitter
            if (claim.submittedBy) {
              await this.notificationWriter.persistCanonicalNotification({
                eventId,
                recipientId: Number(claim.submittedBy),
                purpose:
                  dto.decision === ClaimVerificationDecision.RETURN
                    ? "SERVICE_CLAIM_RETURNED"
                    : "SERVICE_CLAIM_REJECTED",
                title:
                  dto.decision === ClaimVerificationDecision.RETURN
                    ? `Klaim Jasa Membutuhkan Revisi (${claim.claimNumber})`
                    : `Klaim Jasa Ditolak (${claim.claimNumber})`,
                message:
                  dto.decision === ClaimVerificationDecision.RETURN
                    ? `Klaim dikembalikan oleh PM dengan catatan: ${dto.revisionNotes}`
                    : `Klaim ditolak oleh PM: ${dto.rejectionReason}`,
                type: "ALERT",
                actionTarget: `/procurement?claimId=${claim.id}`,
                metaData: { claimId: claim.id, claimNumber: claim.claimNumber },
              });
            }
          }
        } catch (e: any) {
          this.logger.warn(
            `Failed to project notification on technical verify: ${e.message}`,
          );
        }
      }

      return (await this.getClaim(saved.id))!;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // -------------------------------------------------------------
  // 6. PROCUREMENT COMMERCIAL VERIFICATION (FINAL CONSUMPTION GATE)
  // -------------------------------------------------------------
  async verifyCommercial(
    id: number,
    dto: CommercialVerificationDto,
    userId: number,
    userRoles: string[] = [],
  ): Promise<ServiceClaim> {
    const isAuthorized = userRoles.some((r) =>
      ["PROCUREMENT", "PURCHASING"].includes(
        String(r).toUpperCase(),
      ),
    );
    if (!isAuthorized) {
      throw new ForbiddenException(
        "Hanya peran PROCUREMENT / PURCHASING yang berhak melakukan verifikasi komersial klaim jasa.",
      );
    }

    const claim = await this.claimRepo.findOne({
      where: { id },
      relations: ["items", "purchaseOrder"],
    });

    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Klaim Jasa #${id} tidak ditemukan.`);
    }

    if (claim.status !== ServiceClaimStatus.PM_VERIFIED) {
      throw new ConflictException(
        `Klaim tidak dapat diverifikasi komersial karena status saat ini adalah '${claim.status}' (wajib PM_VERIFIED).`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // PESSIMISTIC WRITE LOCK on PO to prevent concurrent approval race
      const lockedPo = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: claim.poId },
        relations: ["items"],
        lock: { mode: "pessimistic_write" },
      });

      if (!lockedPo) {
        throw new NotFoundException(
          `Purchase Order #${claim.poId} tidak ditemukan.`,
        );
      }

      const lockedClaim = await queryRunner.manager.findOne(ServiceClaim, {
        where: { id },
        relations: ["items"],
        lock: { mode: "pessimistic_write" },
      });

      if (
        !lockedClaim ||
        lockedClaim.status !== ServiceClaimStatus.PM_VERIFIED
      ) {
        throw new ConflictException(
          "Status klaim telah berubah saat proses verifikasi komersial berlangsung.",
        );
      }

      let auditAction = "";
      let outboxEventName = "";
      let isSodException = false;

      if (dto.decision === ClaimVerificationDecision.APPROVE) {
        // Segregation of Duties Check
        // Count active procurement users in system
        const procurementUsersCount = await queryRunner.manager
          .createQueryBuilder("users", "u")
          .innerJoin("user_roles", "ur", "ur.user_id = u.id")
          .innerJoin("roles", "r", "r.id = ur.role_id")
          .where("r.name = :role AND u.is_active = 1", { role: "PROCUREMENT" })
          .getCount();

        if (
          procurementUsersCount > 1 &&
          Number(lockedClaim.submittedBy) === Number(userId)
        ) {
          throw new ForbiddenException(
            "Segregation of Duties: Submitter klaim dilarang melakukan persetujuan komersial miliknya sendiri ketika tersedia staf pengadaan lain.",
          );
        } else if (Number(lockedClaim.submittedBy) === Number(userId)) {
          isSodException = true;
          this.logger.warn(
            `[SoD Exception] User #${userId} approved own claim #${lockedClaim.id} (single active procurement officer).`,
          );
        }

        // Re-read ALL approved claims under pessimistic lock to calculate exact remaining balance
        const allApprovedClaims = await queryRunner.manager.find(ServiceClaim, {
          where: {
            poId: lockedPo.id,
            status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
          },
          relations: ["items"],
        });

        const approvedQtyMap = new Map<number, Decimal>();
        const approvedAmountMap = new Map<number, Decimal>();

        for (const ac of allApprovedClaims) {
          for (const aci of ac.items || []) {
            const curQ = approvedQtyMap.get(aci.poItemId) || new Decimal(0);
            approvedQtyMap.set(
              aci.poItemId,
              curQ.plus(this.toDec(aci.currentClaimQuantity)),
            );

            const curA = approvedAmountMap.get(aci.poItemId) || new Decimal(0);
            approvedAmountMap.set(
              aci.poItemId,
              curA.plus(this.toDec(aci.currentClaimAmount)),
            );
          }
        }

        // Recalculate and assert overclaim strictly
        let finalApprovedClaimAmountDec = new Decimal(0);

        for (const item of lockedClaim.items) {
          const poItem = (lockedPo.items || []).find(
            (p) => Number(p.id) === Number(item.poItemId),
          );
          if (!poItem) {
            throw new BadRequestException(
              `Item PO #${item.poItemId} tidak ditemukan.`,
            );
          }

          const claimQtyDec = this.toDec(item.currentClaimQuantity);
          const contractQtyDec = this.toDec(poItem.quantity);
          const contractRateDec = this.toDec(poItem.unitPrice);
          const contractValueDec = this.toDec(
            poItem.totalPrice || contractQtyDec.times(contractRateDec),
          );

          const prevApprovedQtyDec =
            approvedQtyMap.get(poItem.id) || new Decimal(0);
          const cumulativeQtyDec = prevApprovedQtyDec.plus(claimQtyDec);

          if (cumulativeQtyDec.greaterThan(contractQtyDec)) {
            throw new ConflictException(
              `Konflik konkurensi: Kuantitas klaim item '${poItem.itemName}' melebihi sisa kontrak akibat klaim lain yang disetujui bersamaan.`,
            );
          }

          const currentAmountDec = claimQtyDec.times(contractRateDec);
          const prevApprovedAmtDec =
            approvedAmountMap.get(poItem.id) || new Decimal(0);
          const cumulativeAmtDec = prevApprovedAmtDec.plus(currentAmountDec);

          if (cumulativeAmtDec.greaterThan(contractValueDec)) {
            throw new ConflictException(
              `Konflik konkurensi: Nilai klaim item '${poItem.itemName}' melebihi nilai kontrak akibat klaim lain yang disetujui bersamaan.`,
            );
          }

          finalApprovedClaimAmountDec =
            finalApprovedClaimAmountDec.plus(currentAmountDec);

          // Final snapshot update
          item.previousApprovedQuantity = this.roundQty(prevApprovedQtyDec);
          item.cumulativeApprovedQuantity = this.roundQty(cumulativeQtyDec);
          item.remainingQuantity = this.roundQty(
            contractQtyDec.minus(cumulativeQtyDec),
          );
          item.previousApprovedAmount = this.roundMoney(prevApprovedAmtDec);
          item.currentClaimAmount = this.roundMoney(currentAmountDec);
          item.cumulativeApprovedAmount = this.roundMoney(cumulativeAmtDec);
          item.remainingContractValue = this.roundMoney(
            contractValueDec.minus(cumulativeAmtDec),
          );

          await queryRunner.manager.save(ServiceClaimItem, item);
        }

        lockedClaim.status = ServiceClaimStatus.APPROVED_FOR_INVOICE;
        lockedClaim.commercialVerifierId = userId;
        lockedClaim.commercialVerifiedAt = new Date();
        lockedClaim.approvedClaimAmount = this.roundMoney(
          finalApprovedClaimAmountDec,
        );

        auditAction = "SERVICE_CLAIM_COMMERCIALLY_APPROVED";
        outboxEventName = "procurement.service_claim.approved_for_invoice";
      } else if (dto.decision === ClaimVerificationDecision.RETURN) {
        if (
          !dto.revisionNotes ||
          typeof dto.revisionNotes !== "string" ||
          dto.revisionNotes.trim().length === 0
        ) {
          throw new BadRequestException(
            "Catatan revisi (revisionNotes) wajib diisi saat mengembalikan klaim.",
          );
        }
        lockedClaim.status = ServiceClaimStatus.NEEDS_REVISION;
        lockedClaim.revisionNotes = dto.revisionNotes.trim();
        // Reset PM verification because items will change
        lockedClaim.pmVerifierId = null as any;
        lockedClaim.pmVerifiedAt = null as any;
        lockedClaim.commercialVerifierId = null as any;
        lockedClaim.commercialVerifiedAt = null as any;

        auditAction = "SERVICE_CLAIM_COMMERCIALLY_RETURNED";
        outboxEventName = "procurement.service_claim.returned";
      } else if (dto.decision === ClaimVerificationDecision.REJECT) {
        if (
          !dto.rejectionReason ||
          typeof dto.rejectionReason !== "string" ||
          dto.rejectionReason.trim().length === 0
        ) {
          throw new BadRequestException(
            "Alasan penolakan (rejectionReason) wajib diisi saat menolak klaim.",
          );
        }
        lockedClaim.status = ServiceClaimStatus.REJECTED;
        lockedClaim.rejectionReason = dto.rejectionReason.trim();

        auditAction = "SERVICE_CLAIM_COMMERCIALLY_REJECTED";
        outboxEventName = "procurement.service_claim.rejected";
      } else {
        throw new BadRequestException(
          `Keputusan verifikasi '${dto.decision}' tidak valid.`,
        );
      }

      const saved = await queryRunner.manager.save(ServiceClaim, lockedClaim);

      // Audit Log
      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "service_claims",
        record_id: saved.id,
        action: isSodException ? "SERVICE_CLAIM_SOD_EXCEPTION" : auditAction,
        old_value: { status: ServiceClaimStatus.PM_VERIFIED },
        new_value: {
          status: saved.status,
          decision: dto.decision,
          commercialVerifierId: saved.commercialVerifierId,
          approvedClaimAmount: saved.approvedClaimAmount,
          revisionNotes: saved.revisionNotes,
          rejectionReason: saved.rejectionReason,
          sodException: isSodException,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      // Outbox Event
      const eventId = randomUUID();
      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: eventId,
        event_name: outboxEventName,
        event_version: "1",
        aggregate_type: "ServiceClaim",
        aggregate_id: Number(saved.id),
        correlation_id: null,
        payload: {
          claimId: saved.id,
          claimNumber: saved.claimNumber,
          decision: dto.decision,
          verifierId: userId,
          approvedClaimAmount: saved.approvedClaimAmount,
          revisionNotes: saved.revisionNotes,
          rejectionReason: saved.rejectionReason,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, outbox);

      await queryRunner.commitTransaction();

      // Notifications projection
      if (this.notificationWriter) {
        try {
          if (dto.decision === ClaimVerificationDecision.APPROVE) {
            // Notify finance
            // Find finance users or project
            this.logger.log(
              `Service claim #${saved.claimNumber} approved for invoice. Outbox event written.`,
            );
          } else if (
            dto.decision === ClaimVerificationDecision.RETURN ||
            dto.decision === ClaimVerificationDecision.REJECT
          ) {
            if (claim.submittedBy) {
              await this.notificationWriter.persistCanonicalNotification({
                eventId,
                recipientId: Number(claim.submittedBy),
                purpose:
                  dto.decision === ClaimVerificationDecision.RETURN
                    ? "SERVICE_CLAIM_RETURNED"
                    : "SERVICE_CLAIM_REJECTED",
                title:
                  dto.decision === ClaimVerificationDecision.RETURN
                    ? `Klaim Jasa Dikembalikan (${claim.claimNumber})`
                    : `Klaim Jasa Ditolak (${claim.claimNumber})`,
                message:
                  dto.decision === ClaimVerificationDecision.RETURN
                    ? `Klaim dikembalikan oleh Pengadaan: ${dto.revisionNotes}`
                    : `Klaim ditolak oleh Pengadaan: ${dto.rejectionReason}`,
                type: "ALERT",
                actionTarget: `/procurement?claimId=${claim.id}`,
                metaData: { claimId: claim.id, claimNumber: claim.claimNumber },
              });
            }
          }
        } catch (e: any) {
          this.logger.warn(
            `Failed to project notification on commercial verify: ${e.message}`,
          );
        }
      }

      return (await this.getClaim(saved.id))!;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // -------------------------------------------------------------
  // 7. CANCEL CLAIM
  // -------------------------------------------------------------
  async cancel(
    id: number,
    dto: CancelServiceClaimDto,
    userId: number,
  ): Promise<ServiceClaim> {
    const claim = await this.claimRepo.findOne({ where: { id } });
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Klaim Jasa #${id} tidak ditemukan.`);
    }

    const cancellableStatuses = [
      ServiceClaimStatus.DRAFT,
      ServiceClaimStatus.SUBMITTED,
      ServiceClaimStatus.NEEDS_REVISION,
    ];
    if (!cancellableStatuses.includes(claim.status as ServiceClaimStatus)) {
      throw new BadRequestException(
        `Klaim Jasa dengan status '${claim.status}' tidak dapat dibatalkan. Pembatalan hanya diizinkan untuk status DRAFT, SUBMITTED, atau NEEDS_REVISION.`,
      );
    }

    claim.status = ServiceClaimStatus.CANCELLED;
    claim.cancelledBy = userId;
    claim.cancelledAt = new Date();
    if (dto.reason) {
      claim.notes = claim.notes
        ? `${claim.notes} | Batal: ${dto.reason}`
        : `Batal: ${dto.reason}`;
    }

    const saved = await this.claimRepo.save(claim);

    const audit = this.auditLogRepo.create({
      table_name: "service_claims",
      record_id: saved.id,
      action: "SERVICE_CLAIM_CANCELLED",
      old_value: { status: claim.status },
      new_value: { status: ServiceClaimStatus.CANCELLED, reason: dto.reason },
      created_by: userId,
    });
    await this.auditLogRepo.save(audit);

    return (await this.getClaim(saved.id))!;
  }

  // -------------------------------------------------------------
  // 8. GET CLAIM DETAIL (WITH ITEMS & FINANCE DERIVED STATUS)
  // -------------------------------------------------------------
  async getClaim(id: number): Promise<any> {
    const claim = await this.claimRepo.findOne({
      where: { id },
      relations: [
        "items",
        "purchaseOrder",
        "purchaseOrder.items",
        "serviceOrder",
        "project",
        "vendor",
      ],
    });

    if (!claim) return null;

    // Check linked invoice to derive Finance status
    const linkedInvoice = await this.invoiceRepo.findOne({
      where: { serviceClaimId: claim.id },
      relations: ["payments"],
    });

    let financeStatus = "NOT_INVOICED";
    let invoiceNumber: string | null = null;
    let paymentStatus: string | null = null;

    if (
      linkedInvoice &&
      !linkedInvoice.deletedAt &&
      linkedInvoice.status !== "CANCELLED"
    ) {
      invoiceNumber = linkedInvoice.invoiceNumber;
      paymentStatus = linkedInvoice.paymentStatus;
      financeStatus =
        linkedInvoice.paymentStatus === "PAID" ? "PAID" : "INVOICED";
    }

    return {
      ...claim,
      financeDerivedStatus: financeStatus,
      linkedInvoiceNumber: invoiceNumber,
      linkedPaymentStatus: paymentStatus,
    };
  }

  // -------------------------------------------------------------
  // 9. LIST CLAIMS WITH FILTER
  // -------------------------------------------------------------
  async listClaims(query: QueryServiceClaimDto): Promise<any[]> {
    const qb = this.claimRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.purchaseOrder", "po")
      .leftJoinAndSelect("c.serviceOrder", "so")
      .leftJoinAndSelect("c.project", "p")
      .leftJoinAndSelect("c.vendor", "v")
      .leftJoinAndSelect("c.items", "items")
      .orderBy("c.created_at", "DESC");

    if (query.poId) {
      qb.andWhere("c.po_id = :poId", { poId: query.poId });
    }
    if (query.projectId) {
      qb.andWhere("c.project_id = :projectId", { projectId: query.projectId });
    }
    if (query.vendorId) {
      qb.andWhere("c.vendor_id = :vendorId", { vendorId: query.vendorId });
    }
    if (query.status) {
      qb.andWhere("c.status = :status", { status: query.status });
    }

    const claims = await qb.getMany();

    // Attach finance derived status for each claim
    const claimIds = claims.map((c) => c.id);
    let invoices: Invoice[] = [];
    if (claimIds.length > 0) {
      invoices = await this.invoiceRepo.find({
        where: { serviceClaimId: In(claimIds) },
      });
    }

    const invoiceByClaimId = new Map<number, Invoice>();
    for (const inv of invoices) {
      if (!inv.deletedAt && inv.status !== "CANCELLED" && inv.serviceClaimId) {
        invoiceByClaimId.set(Number(inv.serviceClaimId), inv);
      }
    }

    return claims.map((c) => {
      const inv = invoiceByClaimId.get(c.id);
      let financeStatus = "NOT_INVOICED";
      let invNum: string | null = null;
      let payStatus: string | null = null;

      if (inv) {
        invNum = inv.invoiceNumber;
        payStatus = inv.paymentStatus;
        financeStatus = inv.paymentStatus === "PAID" ? "PAID" : "INVOICED";
      }

      return {
        ...c,
        financeDerivedStatus: financeStatus,
        linkedInvoiceNumber: invNum,
        linkedPaymentStatus: payStatus,
      };
    });
  }
}
