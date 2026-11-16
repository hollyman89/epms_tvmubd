import { Injectable, BadRequestException, ConflictException, NotFoundException, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, In, IsNull, OptimisticLockVersionMismatchError, EntityManager } from 'typeorm';
import Decimal from 'decimal.js';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceItem } from '../../entities/invoice-item.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder, PurchaseOrderType } from '../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { PoPaymentTerm, PaymentTermStatus, PaymentTermType } from '../../entities/po-payment-term.entity';
import { ServiceClaim, ServiceClaimStatus } from '../../entities/service-claim.entity';
import { randomUUID } from 'crypto';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { BusinessEvent, NotificationPolicy } from '../../shared/contracts/business-event.contract';
import { CreateInvoiceDto, CreateInvoiceTaxDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyInvoiceDto } from './dto/verify-invoice.dto';
import { SubmitPaymentRequestDto } from './dto/submit-payment-request.dto';
import { DecidePaymentRequestDto, DirectorDecisionAction } from './dto/decide-payment-request.dto';
import { ResubmitPaymentRequestDto } from './dto/resubmit-payment-request.dto';
import { PaymentRequest, PaymentRequestStatus, ApprovalSnapshot } from '../../entities/payment-request.entity';
import { User } from '../../entities/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MismatchCode, MatchingMismatch, MatchingResult } from './finance.types';
import { InvoiceTaxDetail } from '../../entities/invoice-tax-detail.entity';
import { PpnMasukanRecord, CreditabilityStatus, SptMasaStatus, ValidationStatus } from '../../entities/ppn-masukan-record.entity';
import { PphWithholdingRecord, RecognitionStatus, StatutoryTriggerType } from '../../entities/pph-withholding-record.entity';
import { StatutoryTaxLiability, StatutoryLiabilityStatus } from '../../entities/statutory-tax-liability.entity';
import { TaxRegimeRule, TaxCategory, TaxRuleVerificationStatus } from '../../entities/tax-regime-rule.entity';
import { TaxSupportingDocument, TaxTargetType, TaxDocumentCategory } from '../../entities/tax-supporting-document.entity';
import {
  CompanyBankAccount,
  CompanyBankAccountType,
  CompanyBankAccountPurpose,
  CompanyBankAccountStatus,
} from '../../entities/company-bank-account.entity';
import {
  CreateCompanyBankAccountDto,
  UpdateCompanyBankAccountDto,
  ChangeCompanyBankAccountStatusDto,
  QueryCompanyBankAccountDto,
} from './dto/company-bank-account.dto';

@Injectable()
export class FinanceService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(GoodsReceipt)
    private grRepository: Repository<GoodsReceipt>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PoPaymentTerm)
    private paymentTermRepository: Repository<PoPaymentTerm>,
    @Optional()
    @InjectRepository(CompanyBankAccount)
    private companyBankAccountRepository?: Repository<CompanyBankAccount>,
    private readonly eventEmitter?: EventEmitter2
  ) { }

  /**
   * Helper: Exact decimal conversion for monetary & calculation precision.
   * Standardizes values to scale 2 with half-up rounding (CP1.2-03 SSOT).
   */
  private toMoneyDec(val: any): Decimal {
    if (val === null || val === undefined || val === '') return new Decimal(0);
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return new Decimal(0);
    return new Decimal(String(val).trim()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  async createInvoice(dto: CreateInvoiceDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Find and lock Purchase Order with pessimistic_write
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: dto.purchaseOrderId },
        lock: { mode: 'pessimistic_write' },
        relations: ['items', 'paymentTerms', 'purchaseRequest'],
      });

      if (!po || po.deletedAt) {
        throw new BadRequestException('PO not found');
      }

      // Generate Concurrency-Safe Invoice Number
      let invoiceNumber = '';
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      while (!isUnique && attempts < maxAttempts) {
        attempts++;
        const count = await queryRunner.manager.count(Invoice, {
          where: { invoiceNumber: Like(`INV-${dateStr}%`) },
        });
        const seq = String(count + attempts).padStart(3, '0');
        const candidateNumber = `INV-${dateStr}-${seq}`;
        const existing = await queryRunner.manager.findOne(Invoice, {
          where: { invoiceNumber: candidateNumber },
        });
        if (!existing) {
          invoiceNumber = candidateNumber;
          isUnique = true;
        }
      }
      if (!invoiceNumber) {
        throw new Error('Gagal menghasilkan nomor invoice unik.');
      }

      // BRANCH A: TERM-BASED INVOICE
      if (dto.paymentTermId) {
        // A1. Validate PO status for Term Invoicing
        // Eligible PO statuses: ISSUED, PARTIALLY_FULFILLED, COMPLETED
        const eligiblePoStatuses = ['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED'];
        if (!eligiblePoStatuses.includes(po.status)) {
          throw new BadRequestException(
            `Invoice termin tidak dapat dibuat untuk Purchase Order dengan status ${po.status}. Status yang diizinkan: ${eligiblePoStatuses.join(', ')}.`
          );
        }

        // A2. Resolve and Lock Payment Term with pessimistic_write
        const paymentTerm = await queryRunner.manager.findOne(PoPaymentTerm, {
          where: { id: dto.paymentTermId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!paymentTerm || paymentTerm.deletedAt) {
          throw new BadRequestException('Payment term tidak ditemukan.');
        }

        // A3. Validate Payment Term Ownership
        if (Number(paymentTerm.poId) !== Number(po.id)) {
          throw new BadRequestException('Payment term bukan milik Purchase Order ini.');
        }

        // A4. Validate Payment Term Status
        if (paymentTerm.status !== PaymentTermStatus.PENDING) {
          throw new BadRequestException('Payment term belum dapat ditagihkan atau sudah memiliki proses tagihan.');
        }

        // A4.b Sequence Enforcement Gate
        if (Number(paymentTerm.sequence) > 1 && po.paymentTerms && po.paymentTerms.length > 0) {
          const currentSeq = Number(paymentTerm.sequence);
          for (const prevTerm of po.paymentTerms) {
            if (prevTerm.deletedAt || Number(prevTerm.id) === Number(paymentTerm.id)) continue;
            const prevSeq = Number(prevTerm.sequence);
            if (prevSeq < currentSeq) {
              if (prevTerm.termType === PaymentTermType.DOWN_PAYMENT) {
                if (prevTerm.status !== PaymentTermStatus.PAID) {
                  throw new BadRequestException(
                    `Termin urutan ${currentSeq} (${paymentTerm.termName}) tidak dapat ditagihkan karena Uang Muka / DP (${prevTerm.termName}) belum berstatus PAID (status saat ini: ${prevTerm.status}).`
                  );
                }
              } else {
                const allowedPredecessorStatuses = [PaymentTermStatus.VERIFIED, PaymentTermStatus.PAID];
                if (!allowedPredecessorStatuses.includes(prevTerm.status)) {
                  throw new BadRequestException(
                    `Termin urutan ${currentSeq} (${paymentTerm.termName}) tidak dapat ditagihkan karena termin sebelumnya (${prevTerm.termName}) belum mencapai status VERIFIED atau PAID (status saat ini: ${prevTerm.status}).`
                  );
                }
              }
            }
          }
        }

        // A5. Retention gate (if term is RETENTION, require COMPLETED PO)
        if (paymentTerm.termType === PaymentTermType.RETENTION && po.status !== 'COMPLETED') {
          throw new BadRequestException('Termin retensi hanya dapat ditagihkan setelah Purchase Order selesai (COMPLETED).');
        }

        // A5.b PROGRESS Term: Canonical Goods Receipt Validation
        let referencedGr: GoodsReceipt | null = null;
        if (po.orderType !== 'SERVICE' && paymentTerm.termType === PaymentTermType.PROGRESS) {
          const grRefId = dto.goodsReceiptId;
          const grRefStr = dto.evidenceRef?.trim();

          if (!grRefId && !grRefStr) {
            throw new BadRequestException('Invoice termin progress wajib menyertakan referensi Goods Receipt valid.');
          }

          if (grRefId) {
            referencedGr = await queryRunner.manager.findOne(GoodsReceipt, {
              where: { id: grRefId },
              relations: ['items'],
            });
          } else if (grRefStr) {
            referencedGr = await queryRunner.manager.findOne(GoodsReceipt, {
              where: { grNumber: grRefStr },
              relations: ['items'],
            });
            if (!referencedGr && !isNaN(Number(grRefStr))) {
              referencedGr = await queryRunner.manager.findOne(GoodsReceipt, {
                where: { id: Number(grRefStr) },
                relations: ['items'],
              });
            }
          }

          if (!referencedGr) {
            throw new BadRequestException(`Goods Receipt '${grRefStr || grRefId}' tidak ditemukan di sistem.`);
          }

          if (referencedGr.deletedAt) {
            throw new BadRequestException('Goods Receipt telah dihapus atau tidak valid.');
          }

          if (Number(referencedGr.poId) !== Number(po.id)) {
            throw new BadRequestException('Goods Receipt bukan milik Purchase Order ini.');
          }

          if (!referencedGr.items || referencedGr.items.length === 0) {
            throw new BadRequestException('Goods Receipt tidak memiliki item penerimaan barang.');
          }

          // Calculate total valid physical delivery value across all active GRs of this PO
          const allPoGrs = (await queryRunner.manager.find(GoodsReceipt, {
            where: { poId: po.id },
            relations: ['items'],
          })) || [];
          let totalReceivedPhysicalValue = 0;
          for (const g of allPoGrs) {
            if (g.deletedAt) continue;
            for (const gi of g.items || []) {
              const poi = po.items?.find(i => Number(i.id) === Number(gi.poItemId));
              if (poi) {
                totalReceivedPhysicalValue += Number(gi.receivedQuantity) * Number(poi.unitPrice || 0);
              }
            }
          }

          // A5.c Milestone Eligibility Gate
          const is100PercentMilestone =
            /100%|fisik\s*100%|lengkap/i.test(paymentTerm.triggerCondition || '') ||
            Number(paymentTerm.percentage) === 100;

          if (is100PercentMilestone) {
            const isAllItemsCompleted =
              po.status === 'COMPLETED' &&
              po.items &&
              po.items.length > 0 &&
              po.items.every(item => Number(item.receivedQuantity || 0) >= Number(item.quantity || 0));

            if (!isAllItemsCompleted) {
              const unfulfilledItems = (po.items || []).filter(
                item => Number(item.receivedQuantity || 0) < Number(item.quantity || 0)
              );
              const detailMsg = unfulfilledItems.length > 0
                ? ` (${unfulfilledItems.map(i => `${i.itemName || i.id}: ${i.receivedQuantity || 0}/${i.quantity}`).join(', ')})`
                : '';
              throw new BadRequestException(
                `Termin progress dengan syarat milestone '${paymentTerm.triggerCondition || 'Kemajuan Fisik 100%'}' belum dapat ditagihkan karena pengiriman fisik barang/jasa belum selesai 100% (status PO: ${po.status})${detailMsg}.`
              );
            }
          } else {
            const matchPercent = (paymentTerm.triggerCondition || '').match(/(\d+(?:\.\d+)?)\s*%/);
            if (matchPercent) {
              const targetPercent = parseFloat(matchPercent[1]);
              if (targetPercent < 100) {
                const poTotal = Number(po.totalAmount || 0);
                const physicalProgress = poTotal > 0 ? (totalReceivedPhysicalValue / poTotal) * 100 : 0;
                if (Math.round(physicalProgress * 100) / 100 + 0.5 < targetPercent) {
                  throw new BadRequestException(
                    `Termin progress dengan syarat milestone '${paymentTerm.triggerCondition}' belum dapat ditagihkan karena kemajuan fisik baru mencapai ${physicalProgress.toFixed(2)}% (target: ${targetPercent}%).`
                  );
                }
              }
            }
          }

          // Calculate previously billed progress amount (excluding DP and cancelled invoices)
          const allExistingInvoices = (await queryRunner.manager.find(Invoice, {
            where: { poId: po.id },
            relations: ['paymentTerm'],
          })) || [];
          let previousProgressBilled = 0;
          for (const inv of allExistingInvoices) {
            if (inv.deletedAt || inv.status === 'CANCELLED') continue;
            const term = inv.paymentTerm || (inv.paymentTermId ? await queryRunner.manager.findOne(PoPaymentTerm, { where: { id: inv.paymentTermId } }) : null);
            if (term && term.termType === PaymentTermType.PROGRESS) {
              previousProgressBilled += Number(inv.totalAmount || 0);
            }
          }

          const currentTermAmountDec = this.toMoneyDec(paymentTerm.amount);
          const previousProgressBilledDec = this.toMoneyDec(previousProgressBilled);
          const totalReceivedPhysicalValueDec = this.toMoneyDec(totalReceivedPhysicalValue);
          const totalProgressDec = previousProgressBilledDec.plus(currentTermAmountDec);
          if (totalProgressDec.greaterThan(totalReceivedPhysicalValueDec)) {
            throw new BadRequestException(
              `Akumulasi penagihan progress (Rp${totalProgressDec.toNumber().toLocaleString('id-ID')}) melebihi total nilai fisik barang yang telah diterima (Rp${totalReceivedPhysicalValueDec.toNumber().toLocaleString('id-ID')}).`
            );
          }
        }

        // A6. Check existing active invoice for this term (Single active invoice per term rule)
        const existingActiveInvoiceForTerm = await queryRunner.manager.findOne(Invoice, {
          where: { paymentTermId: paymentTerm.id },
        });
        if (
          existingActiveInvoiceForTerm &&
          !existingActiveInvoiceForTerm.deletedAt &&
          existingActiveInvoiceForTerm.status !== 'CANCELLED' &&
          existingActiveInvoiceForTerm.matchStatus !== 'REJECTED'
        ) {
          throw new BadRequestException('Payment term sudah memiliki invoice aktif.');
        }

        // A7. Authoritative Amount from paymentTerm.amount (Server SSOT)
        const totalInvoiceAmount = Number(paymentTerm.amount);

        // A7.b Canonical Service Claim Validation (for Service PO / Service Invoices)
        let referencedClaim: ServiceClaim | null = null;
        const isDp = paymentTerm.termType === PaymentTermType.DOWN_PAYMENT ||
          (paymentTerm.termName || '').toUpperCase().includes('DP') ||
          (paymentTerm.termName || '').toUpperCase().includes('UANG MUKA');
        const isRetention = paymentTerm.termType === PaymentTermType.RETENTION || Boolean(paymentTerm.isRetention);

        if (po.orderType === 'SERVICE' || dto.serviceClaimId) {
          if (po.orderType === 'SERVICE' && !isDp && !dto.serviceClaimId) {
            throw new BadRequestException(
              'Invoice penagihan Service PO wajib menyertakan referensi Klaim Jasa yang telah disetujui (APPROVED_FOR_INVOICE).'
            );
          }

          if (dto.serviceClaimId) {
            referencedClaim = await queryRunner.manager.findOne(ServiceClaim, {
              where: { id: dto.serviceClaimId },
            });

            if (!referencedClaim) {
              throw new BadRequestException(`Service Claim dengan ID ${dto.serviceClaimId} tidak ditemukan.`);
            }

            if (referencedClaim.deletedAt) {
              throw new BadRequestException('Service Claim telah dihapus atau tidak aktif.');
            }

            if (referencedClaim.status !== ServiceClaimStatus.APPROVED_FOR_INVOICE) {
              throw new BadRequestException(
                `Status Service Claim tidak valid (${referencedClaim.status}). Hanya Service Claim dengan status APPROVED_FOR_INVOICE yang dapat ditagihkan.`
              );
            }

            if (Number(referencedClaim.poId) !== Number(po.id)) {
              throw new BadRequestException('Service Claim bukan milik Purchase Order ini.');
            }

            const expectedProjectId = po.purchaseRequest?.projectId;
            if (expectedProjectId && Number(referencedClaim.projectId) !== Number(expectedProjectId)) {
              throw new BadRequestException('Service Claim tidak sesuai dengan project pada Purchase Order ini.');
            }

            if (Number(referencedClaim.vendorId) !== Number(po.vendorId)) {
              throw new BadRequestException('Service Claim bukan milik Vendor pada Purchase Order ini.');
            }

            // Calculate already invoiced amount for this claim across active invoices
            const activeInvoicesForClaim = await queryRunner.manager.find(Invoice, {
              where: { serviceClaimId: referencedClaim.id },
            });
            let alreadyInvoicedDec = new Decimal(0);
            for (const inv of activeInvoicesForClaim) {
              if (inv.deletedAt || inv.status === 'CANCELLED' || inv.matchStatus === 'REJECTED') {
                continue;
              }
              alreadyInvoicedDec = alreadyInvoicedDec.plus(this.toMoneyDec(inv.totalAmount));
            }

            const approvedClaimDec = this.toMoneyDec(referencedClaim.approvedClaimAmount);
            const remainingClaimCapacityDec = Decimal.max(0, approvedClaimDec.minus(alreadyInvoicedDec));
            const totalInvoiceDec = this.toMoneyDec(totalInvoiceAmount);

            if (totalInvoiceDec.greaterThan(remainingClaimCapacityDec)) {
              throw new BadRequestException(
                `Nilai invoice (Rp${totalInvoiceDec.toNumber().toLocaleString('id-ID')}) melebihi sisa kapasitas klaim jasa yang disetujui (Tersedia: Rp${remainingClaimCapacityDec.toNumber().toLocaleString('id-ID')}, Disetujui: Rp${approvedClaimDec.toNumber().toLocaleString('id-ID')}, Sudah ditagihkan: Rp${alreadyInvoicedDec.toNumber().toLocaleString('id-ID')}).`
              );
            }
          }
        }

        // A8. Cumulative Active Invoices Cap vs PO Total Amount
        const hasItemsToBill = paymentTerm.termType === PaymentTermType.PROGRESS || Boolean(dto.items && dto.items.length > 0);
        const activeInvoices = (await queryRunner.manager.find(
          Invoice,
          hasItemsToBill ? { where: { poId: po.id }, relations: ['items'] } : { where: { poId: po.id } }
        )) || [];
        let activeInvoicedSum = 0;
        const previouslyInvoicedQtyMap = new Map<number, number>();
        for (const inv of activeInvoices) {
          if (inv.deletedAt || inv.status === 'CANCELLED' || inv.matchStatus === 'REJECTED') {
            continue;
          }
          activeInvoicedSum += Number(inv.totalAmount || 0);
          for (const item of inv.items || []) {
            if (item.deletedAt || !item.poItemId) continue;
            const current = previouslyInvoicedQtyMap.get(Number(item.poItemId)) || 0;
            previouslyInvoicedQtyMap.set(Number(item.poItemId), current + Number(item.quantity || 0));
          }
        }
        const poTotalAmountDec = this.toMoneyDec(po.totalAmount);
        const activeInvoicedSumDec = this.toMoneyDec(activeInvoicedSum);
        const totalInvoiceDec = this.toMoneyDec(totalInvoiceAmount);
        if (activeInvoicedSumDec.plus(totalInvoiceDec).greaterThan(poTotalAmountDec)) {
          throw new BadRequestException('Akumulasi nilai invoice melebihi total Purchase Order.');
        }

        // A9. Invoice Items handling (CP1.2-04 Header-Detail Reconciliation)
        const invoiceItems: InvoiceItem[] = [];
        if (isDp || isRetention) {
          if (!dto.items || dto.items.length === 0) {
            // Standalone milestone invoice detail when PO item allocation is not applicable (CP1.2-04 Rule 4, 5, 6)
            const invItem = new InvoiceItem();
            invItem.poItemId = null as any;
            invItem.itemName = (paymentTerm.termName || '').trim() || (isDp ? 'Down Payment / Uang Muka' : 'Retensi');
            invItem.quantity = 1;
            invItem.unitPrice = totalInvoiceAmount;
            invItem.totalPrice = totalInvoiceAmount;
            invItem.createdBy = userId;
            invoiceItems.push(invItem);
          } else {
            for (const itemDto of dto.items) {
              if (itemDto.poItemId) {
                const poItem = po.items?.find(i => Number(i.id) === Number(itemDto.poItemId));
                if (!poItem) {
                  throw new BadRequestException(`PO Item ${itemDto.poItemId} not found in this PO`);
                }
                const authoritativeUnitPrice = Number(poItem.unitPrice || 0);
                const invItem = new InvoiceItem();
                invItem.poItemId = itemDto.poItemId;
                invItem.itemName = poItem.itemName;
                invItem.quantity = Number(itemDto.quantity);
                invItem.unitPrice = authoritativeUnitPrice;
                invItem.totalPrice = Math.round(Number(itemDto.quantity) * authoritativeUnitPrice * 100) / 100;
                invItem.createdBy = userId;
                invoiceItems.push(invItem);
              } else {
                const invItem = new InvoiceItem();
                invItem.poItemId = null as any;
                invItem.itemName = (itemDto as any).itemName || (paymentTerm.termName || '').trim() || (isDp ? 'Down Payment / Uang Muka' : 'Retensi');
                invItem.quantity = Number(itemDto.quantity || 1);
                invItem.unitPrice = Number(itemDto.unitPrice || totalInvoiceAmount);
                invItem.totalPrice = Math.round(invItem.quantity * invItem.unitPrice * 100) / 100;
                invItem.createdBy = userId;
                invoiceItems.push(invItem);
              }
            }
          }
        } else if (po.orderType === 'SERVICE') {
          // Service PO Progress & Final Delivery
          if (dto.items && dto.items.length > 0) {
            for (const itemDto of dto.items) {
              const poItem = po.items?.find(i => Number(i.id) === Number(itemDto.poItemId));
              if (!poItem) {
                throw new BadRequestException(`PO Item ${itemDto.poItemId} not found in this PO`);
              }
              const authoritativeUnitPrice = Number(poItem.unitPrice || 0);
              const invItem = new InvoiceItem();
              invItem.poItemId = itemDto.poItemId;
              invItem.itemName = poItem.itemName;
              invItem.quantity = Number(itemDto.quantity);
              invItem.unitPrice = authoritativeUnitPrice;
              invItem.totalPrice = Math.round(Number(itemDto.quantity) * authoritativeUnitPrice * 100) / 100;
              invItem.createdBy = userId;
              invoiceItems.push(invItem);
            }
          } else if (referencedClaim?.items && referencedClaim.items.length > 0) {
            for (const ci of referencedClaim.items) {
              const poItem = po.items?.find(i => Number(i.id) === Number(ci.poItemId));
              const authoritativeUnitPrice = Number(ci.contractUnitRateSnapshot || poItem?.unitPrice || 0);
              const invItem = new InvoiceItem();
              invItem.poItemId = ci.poItemId;
              invItem.itemName = ci.itemNameSnapshot || poItem?.itemName;
              invItem.quantity = Number(ci.currentClaimQuantity);
              invItem.unitPrice = authoritativeUnitPrice;
              invItem.totalPrice = Math.round(Number(ci.currentClaimQuantity) * authoritativeUnitPrice * 100) / 100;
              invItem.createdBy = userId;
              invoiceItems.push(invItem);
            }
          } else {
            // Standalone service progress/final claim detail referencing approved Service Claim
            const invItem = new InvoiceItem();
            invItem.poItemId = null as any;
            invItem.itemName = referencedClaim?.claimNumber
              ? `Klaim Jasa ${referencedClaim.claimNumber} - ${paymentTerm.termName}`
              : (paymentTerm.termName || 'Penagihan Jasa');
            invItem.quantity = 1;
            invItem.unitPrice = totalInvoiceAmount;
            invItem.totalPrice = totalInvoiceAmount;
            invItem.createdBy = userId;
            invoiceItems.push(invItem);
          }
        } else {
          // Material PO Progress & Final Delivery
          if (dto.items && dto.items.length > 0) {
            for (const itemDto of dto.items) {
              const poItem = po.items?.find(i => Number(i.id) === Number(itemDto.poItemId));
              if (!poItem) {
                throw new BadRequestException(`PO Item ${itemDto.poItemId} not found in this PO`);
              }
              const itemQty = Number(itemDto.quantity);
              if (isNaN(itemQty) || itemQty <= 0) {
                throw new BadRequestException(`Kuantitas item ${poItem.itemName || itemDto.poItemId} tidak valid.`);
              }
              const itemReceivedQty = poItem.receivedQuantity !== undefined && poItem.receivedQuantity !== null
                ? Number(poItem.receivedQuantity)
                : Number(poItem.quantity || 0);

              const previouslyInvoiced = previouslyInvoicedQtyMap.get(Number(poItem.id)) || 0;
              const remainingBillable = Math.max(0, Math.round((itemReceivedQty - previouslyInvoiced) * 100) / 100);

              if (itemQty > remainingBillable + 0.001) {
                if (previouslyInvoiced > 0) {
                  throw new BadRequestException(
                    `Kuantitas item invoice (${itemQty}) melebihi sisa kuantitas yang dapat ditagihkan (${remainingBillable}) untuk item '${poItem.itemName || poItem.id}' (Diterima: ${itemReceivedQty}, Sudah ditagihkan: ${previouslyInvoiced}).`
                  );
                } else {
                  throw new BadRequestException(
                    `Kuantitas item invoice (${itemQty}) melebihi kuantitas yang telah diterima (${itemReceivedQty}) untuk item ${poItem.itemName || poItem.id}`
                  );
                }
              }
              previouslyInvoicedQtyMap.set(Number(poItem.id), previouslyInvoiced + itemQty);

              const authoritativeUnitPrice = Number(poItem.unitPrice || 0);
              const authoritativeTotalPrice = Math.round(itemQty * authoritativeUnitPrice * 100) / 100;

              const invItem = new InvoiceItem();
              invItem.poItemId = poItem.id;
              invItem.itemName = poItem.itemName;
              invItem.quantity = itemQty;
              invItem.unitPrice = authoritativeUnitPrice;
              invItem.totalPrice = authoritativeTotalPrice;
              invItem.createdBy = userId;
              invoiceItems.push(invItem);
            }
          } else if (referencedGr && referencedGr.items) {
            for (const grItem of referencedGr.items) {
              const poItem = po.items?.find(i => Number(i.id) === Number(grItem.poItemId));
              if (poItem) {
                const grQty = Number(grItem.receivedQuantity || 0);
                if (grQty <= 0) continue;

                const itemReceivedQty = poItem.receivedQuantity !== undefined && poItem.receivedQuantity !== null
                  ? Number(poItem.receivedQuantity)
                  : Number(grItem.receivedQuantity || 0);

                const previouslyInvoiced = previouslyInvoicedQtyMap.get(Number(poItem.id)) || 0;
                const remainingBillable = Math.max(0, Math.round((itemReceivedQty - previouslyInvoiced) * 100) / 100);

                const billableQty = Math.min(grQty, remainingBillable);
                if (billableQty <= 0) continue;

                previouslyInvoicedQtyMap.set(Number(poItem.id), previouslyInvoiced + billableQty);

                const authoritativeUnitPrice = Number(poItem.unitPrice || 0);
                const authoritativeTotalPrice = this.toMoneyDec(billableQty)
                  .times(this.toMoneyDec(authoritativeUnitPrice))
                  .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                  .toNumber();

                const invItem = new InvoiceItem();
                invItem.poItemId = poItem.id;
                invItem.itemName = poItem.itemName;
                invItem.quantity = billableQty;
                invItem.unitPrice = authoritativeUnitPrice;
                invItem.totalPrice = authoritativeTotalPrice;
                invItem.createdBy = userId;
                invoiceItems.push(invItem);
              }
            }
          }
        }

        // Header-to-detail reconciliation guard
        if (isDp || isRetention || (dto.items && dto.items.length > 0)) {
          let detailSumDec = new Decimal(0);
          for (const it of invoiceItems) {
            detailSumDec = detailSumDec.plus(this.toMoneyDec(it.totalPrice));
          }
          const totalInvoiceDec = this.toMoneyDec(totalInvoiceAmount);
          if (!detailSumDec.equals(totalInvoiceDec)) {
            throw new BadRequestException(
              `Total rincian item invoice (Rp${detailSumDec.toNumber().toLocaleString('id-ID')}) tidak sesuai dengan nominal termin pembayaran (Rp${totalInvoiceDec.toNumber().toLocaleString('id-ID')}).`
            );
          }
        }

        // A10. Create and Save Invoice
        const invoice = new Invoice();
        invoice.poId = po.id;
        invoice.companyCode = po.companyCode || (po.purchaseRequest?.project as any)?.companyCode || 'UBD';
        invoice.paymentTermId = paymentTerm.id;
        if (referencedClaim) {
          invoice.serviceClaimId = referencedClaim.id;
        }
        invoice.invoiceNumber = invoiceNumber;
        invoice.invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
        invoice.totalAmount = totalInvoiceAmount;
        invoice.matchStatus = 'PENDING';
        invoice.paymentStatus = 'UNPAID';
        invoice.status = 'UNPAID';
        invoice.createdBy = userId;
        if (invoiceItems.length > 0) {
          invoice.items = invoiceItems;
        }

        const savedInvoice = await queryRunner.manager.save(Invoice, invoice);

        // Process optional tax administration (PPN / PPh)
        if (dto.tax) {
          await this.processAndPersistInvoiceTax(queryRunner.manager, savedInvoice, po, dto.tax, userId);
        }

        // A11. Update Payment Term status to INVOICE_SUBMITTED
        paymentTerm.status = PaymentTermStatus.INVOICE_SUBMITTED;
        paymentTerm.updatedBy = userId;
        await queryRunner.manager.save(PoPaymentTerm, paymentTerm);

        // Canonical AuditLog: Invoice CREATE (Term-Based)
        const invoiceAudit = queryRunner.manager.create(AuditLog, {
          table_name: 'invoices',
          record_id: savedInvoice.id,
          action: 'CREATE',
          old_value: null,
          new_value: {
            invoiceNumber: savedInvoice.invoiceNumber,
            poId: po.id,
            paymentTermId: paymentTerm.id,
            totalAmount: Number(savedInvoice.totalAmount),
            matchStatus: savedInvoice.matchStatus,
            paymentStatus: savedInvoice.paymentStatus,
            isTermBased: true,
            termStatusAfter: paymentTerm.status,
          },
          created_by: userId ? Number(userId) : null,
        });
        await queryRunner.manager.save(AuditLog, invoiceAudit);

        // Canonical Outbox: finance.invoice.created (Term-based)
        const invoiceEvent: BusinessEvent<{
          invoiceId: number;
          invoiceNumber: string;
          poId: number;
          totalAmount: number;
          matchStatus: string;
          paymentStatus: string;
          isTermBased: boolean;
          paymentTermId?: number | null;
          createdBy: number | null;
        }> = {
          eventId: `inv-cre-${savedInvoice.id}`,
          eventName: 'finance.invoice.created',
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          aggregateType: 'Invoice',
          aggregateId: savedInvoice.id,
          projectId: undefined,
          actor: userId ? { userId: Number(userId) } : undefined,
          routing: { roles: ['FINANCE'] },
          notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
          payload: {
            invoiceId: Number(savedInvoice.id),
            invoiceNumber: savedInvoice.invoiceNumber,
            poId: Number(po.id),
            totalAmount: Number(savedInvoice.totalAmount),
            matchStatus: savedInvoice.matchStatus,
            paymentStatus: savedInvoice.paymentStatus,
            isTermBased: true,
            paymentTermId: paymentTerm.id ? Number(paymentTerm.id) : null,
            createdBy: userId ? Number(userId) : null,
          },
        };

        const invoiceOutbox = queryRunner.manager.create(OutboxEvent, {
          event_id: invoiceEvent.eventId,
          event_name: invoiceEvent.eventName,
          event_version: String(invoiceEvent.eventVersion),
          aggregate_type: invoiceEvent.aggregateType,
          aggregate_id: Number(invoiceEvent.aggregateId),
          correlation_id: invoiceEvent.correlationId || null,
          payload: {
            occurredAt: invoiceEvent.occurredAt,
            projectId: invoiceEvent.projectId,
            actor: invoiceEvent.actor,
            routing: invoiceEvent.routing,
            notificationPolicy: invoiceEvent.notificationPolicy,
            businessPayload: invoiceEvent.payload,
          },
          status: OutboxStatus.PENDING,
          retry_count: 0,
        });
        await queryRunner.manager.save(OutboxEvent, invoiceOutbox);

        await queryRunner.commitTransaction();
        return savedInvoice;
      }

      // BRANCH B: LEGACY / FULL PO INVOICE
      if (po.orderType === 'SERVICE') {
        throw new BadRequestException(
          'Invoice penagihan Service PO wajib menggunakan Payment Term dan Service Claim yang valid.'
        );
      }
      if (po.status !== 'COMPLETED') {
        throw new BadRequestException('Invoice can only be created for COMPLETED Purchase Orders');
      }

      let totalInvoiceAmount = 0;
      const invoiceItems: InvoiceItem[] = [];

      // Query existing active invoices to build previouslyInvoicedQtyMap for Branch B
      const existingInvoicesBranchB = (await queryRunner.manager.find(Invoice, {
        where: { poId: po.id },
        relations: ['items'],
      })) || [];

      const previouslyInvoicedQtyMapBranchB = new Map<number, number>();
      for (const inv of existingInvoicesBranchB) {
        if (inv.deletedAt || inv.status === 'CANCELLED' || inv.matchStatus === 'REJECTED') {
          continue;
        }
        for (const item of inv.items || []) {
          if (item.deletedAt || !item.poItemId) continue;
          const current = previouslyInvoicedQtyMapBranchB.get(Number(item.poItemId)) || 0;
          previouslyInvoicedQtyMapBranchB.set(Number(item.poItemId), current + Number(item.quantity || 0));
        }
      }

      if (dto.items && dto.items.length > 0) {
        for (const itemDto of dto.items) {
          const poItem = po.items?.find(i => Number(i.id) === Number(itemDto.poItemId));
          if (!poItem) {
            throw new BadRequestException(`PO Item ${itemDto.poItemId} not found in this PO`);
          }

          const itemQty = Number(itemDto.quantity);
          if (isNaN(itemQty) || itemQty <= 0) {
            throw new BadRequestException(`Kuantitas item ${poItem.itemName || itemDto.poItemId} tidak valid.`);
          }

          const receivedQty = poItem.receivedQuantity !== undefined && poItem.receivedQuantity !== null
            ? Number(poItem.receivedQuantity)
            : Number(poItem.quantity || 0);

          const previouslyInvoiced = previouslyInvoicedQtyMapBranchB.get(Number(poItem.id)) || 0;
          const remainingBillable = Math.max(0, Math.round((receivedQty - previouslyInvoiced) * 100) / 100);

          if (itemQty > remainingBillable + 0.001) {
            throw new BadRequestException(
              `Kuantitas item invoice (${itemQty}) melebihi sisa kuantitas yang dapat ditagihkan (${remainingBillable}) untuk item '${poItem.itemName || poItem.id}' (Diterima: ${receivedQty}, Sudah ditagihkan: ${previouslyInvoiced}).`
            );
          }
          previouslyInvoicedQtyMapBranchB.set(Number(poItem.id), previouslyInvoiced + itemQty);

          // P0-3 & Part D: Authoritative Pricing (strictly ignore client unitPrice and totalPrice)
          const authoritativeUnitPrice = Number(poItem.unitPrice || 0);
          const authoritativeTotalPrice = this.toMoneyDec(itemQty)
            .times(this.toMoneyDec(authoritativeUnitPrice))
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            .toNumber();

          const invItem = new InvoiceItem();
          invItem.poItemId = poItem.id;
          invItem.itemName = poItem.itemName;
          invItem.quantity = itemQty;
          invItem.unitPrice = authoritativeUnitPrice;
          invItem.totalPrice = authoritativeTotalPrice;
          invItem.createdBy = userId;

          invoiceItems.push(invItem);
          totalInvoiceAmount += authoritativeTotalPrice;
        }
      }
      totalInvoiceAmount = this.toMoneyDec(totalInvoiceAmount).toNumber();

      // Calculate 3-Way Matching Data
      const totalPoAmountDec = this.toMoneyDec(po.totalAmount);
      const totalInvoiceDec = this.toMoneyDec(totalInvoiceAmount);
      const goodsReceipts = await queryRunner.manager.find(GoodsReceipt, {
        where: { poId: po.id },
        relations: ['items'],
      });

      let totalGrAmountDec = new Decimal(0);
      for (const gr of goodsReceipts) {
        for (const grItem of gr.items) {
          const matchedPoItem = po.items?.find(i => i.id === grItem.poItemId);
          if (matchedPoItem) {
            const grQty = this.toMoneyDec(grItem.receivedQuantity);
            const poPrice = this.toMoneyDec(matchedPoItem.unitPrice);
            const grLineTotal = grQty.times(poPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            totalGrAmountDec = totalGrAmountDec.plus(grLineTotal);
          }
        }
      }

      const isMatched = totalInvoiceDec.equals(totalPoAmountDec) && totalPoAmountDec.equals(totalGrAmountDec);
      const matchStatus = isMatched ? 'MATCHED' : 'MISMATCHED';

      const invoice = new Invoice();
      invoice.poId = po.id;
      invoice.companyCode = po.companyCode || (po.purchaseRequest?.project as any)?.companyCode || 'UBD';
      invoice.invoiceNumber = invoiceNumber;
      invoice.invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
      invoice.totalAmount = totalInvoiceAmount;
      invoice.matchStatus = matchStatus;
      invoice.paymentStatus = 'UNPAID';
      invoice.status = 'UNPAID';
      invoice.createdBy = userId;
      invoice.items = invoiceItems;

      const savedInvoice = await queryRunner.manager.save(Invoice, invoice);

      // Process optional tax administration (PPN / PPh)
      if (dto.tax) {
        await this.processAndPersistInvoiceTax(queryRunner.manager, savedInvoice, po, dto.tax, userId);
      }

      // Canonical AuditLog: Invoice CREATE (Legacy Full PO)
      const invoiceAudit = queryRunner.manager.create(AuditLog, {
        table_name: 'invoices',
        record_id: savedInvoice.id,
        action: 'CREATE',
        old_value: null,
        new_value: {
          invoiceNumber: savedInvoice.invoiceNumber,
          poId: po.id,
          totalAmount: Number(savedInvoice.totalAmount),
          matchStatus: savedInvoice.matchStatus,
          paymentStatus: savedInvoice.paymentStatus,
          isTermBased: false,
          itemsCount: invoiceItems.length,
        },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, invoiceAudit);

      // Canonical Outbox: finance.invoice.created (Full PO)
      const invoiceEvent: BusinessEvent<{
        invoiceId: number;
        invoiceNumber: string;
        poId: number;
        totalAmount: number;
        matchStatus: string;
        paymentStatus: string;
        isTermBased: boolean;
        paymentTermId?: number | null;
        createdBy: number | null;
      }> = {
        eventId: `inv-cre-${savedInvoice.id}`,
        eventName: 'finance.invoice.created',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Invoice',
        aggregateId: savedInvoice.id,
        projectId: undefined,
        actor: userId ? { userId: Number(userId) } : undefined,
        routing: { roles: ['FINANCE'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          invoiceId: Number(savedInvoice.id),
          invoiceNumber: savedInvoice.invoiceNumber,
          poId: Number(po.id),
          totalAmount: Number(savedInvoice.totalAmount),
          matchStatus: savedInvoice.matchStatus,
          paymentStatus: savedInvoice.paymentStatus,
          isTermBased: false,
          paymentTermId: null,
          createdBy: userId ? Number(userId) : null,
        },
      };

      const invoiceOutbox = queryRunner.manager.create(OutboxEvent, {
        event_id: invoiceEvent.eventId,
        event_name: invoiceEvent.eventName,
        event_version: String(invoiceEvent.eventVersion),
        aggregate_type: invoiceEvent.aggregateType,
        aggregate_id: Number(invoiceEvent.aggregateId),
        correlation_id: invoiceEvent.correlationId || null,
        payload: {
          occurredAt: invoiceEvent.occurredAt,
          projectId: invoiceEvent.projectId,
          actor: invoiceEvent.actor,
          routing: invoiceEvent.routing,
          notificationPolicy: invoiceEvent.notificationPolicy,
          businessPayload: invoiceEvent.payload,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, invoiceOutbox);

      await queryRunner.commitTransaction();

      // Emit event if mismatched
      if (!isMatched) {
        this.eventEmitter.emit('finance.mismatch', {
          invoiceId: savedInvoice.id,
          invoiceNumber: savedInvoice.invoiceNumber,
          poId: po.id,
          totalInvoice: totalInvoiceAmount,
          totalPO: totalPoAmountDec.toNumber(),
          totalGR: totalGrAmountDec.toNumber(),
          createdAt: new Date().toISOString(),
        });
      }

      return savedInvoice;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }


  async createPayment(dto: CreatePaymentDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock Invoice with pessimistic_write
      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: dto.invoiceId },
        lock: { mode: 'pessimistic_write' },
        relations: ['invoiceTaxDetail'],
      });

      if (!invoice || invoice.deletedAt) {
        throw new BadRequestException('Invoice not found');
      }

      // 1.b Segregation of Duties (SoD) & Payment Request Gating (Mandatory)
      if (!dto.paymentRequestId) {
        throw new BadRequestException('Payment Request ID wajib disertakan untuk eksekusi pembayaran.');
      }

      const prq = await queryRunner.manager.findOne(PaymentRequest, {
        where: { id: dto.paymentRequestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!prq || prq.deletedAt) {
        throw new BadRequestException('Payment Request tidak ditemukan.');
      }

      if (Number(prq.invoiceId) !== Number(invoice.id)) {
        throw new BadRequestException('Payment Request tidak sesuai dengan invoice yang dituju.');
      }

      if (prq.status === PaymentRequestStatus.PAID) {
        throw new BadRequestException('Pembayaran ditolak: Payment Request sudah dibayar (PAID).');
      }

      if (prq.status !== PaymentRequestStatus.APPROVED_FOR_PAYMENT) {
        throw new BadRequestException(
          'Pembayaran ditolak: Payment Request belum disetujui oleh Direktur (APPROVED_FOR_PAYMENT).'
        );
      }

      if (prq.approvedBy && Number(prq.approvedBy) === Number(userId)) {
        throw new BadRequestException(
          'Prinsip Segregation of Duties (SoD) melarang penyetuju Payment Request (Checker/Direktur) mengeksekusi pembayaran.'
        );
      }

      // 1.b Validate Payment Term Identity between PRQ and Invoice (Invariant 1)
      if (invoice.paymentTermId && prq.paymentTermId && Number(prq.paymentTermId) !== Number(invoice.paymentTermId)) {
        throw new BadRequestException(
          'Payment Request tidak sesuai dengan payment term pada invoice.'
        );
      }

      // 1.c Stale Approval Snapshot Integrity Guard
      if (
        prq.approvalSnapshot?.invoiceVersion &&
        invoice.version &&
        invoice.version > prq.approvalSnapshot.invoiceVersion
      ) {
        throw new BadRequestException(
          `Pembayaran ditolak: Terdeteksi perubahan data invoice (versi ${invoice.version}) setelah persetujuan Direktur diberikan (versi snapshot ${prq.approvalSnapshot.invoiceVersion}). Harap minta revisi Payment Request terlebih dahulu.`
        );
      }

      // 1.d Vendor Destination Account Guard
      if (
        prq.approvalSnapshot &&
        (!prq.approvalSnapshot.vendorBankAccount || String(prq.approvalSnapshot.vendorBankAccount).trim() === '')
      ) {
        throw new BadRequestException(
          'Rekening bank tujuan vendor tidak ditemukan atau belum terdaftar pada master data / snapshot persetujuan.'
        );
      }

      // 1.e Bank Transfer Reference Requirement
      if (dto.paymentMethod === 'BANK_TRANSFER' && (!dto.referenceNumber || dto.referenceNumber.trim().length === 0)) {
        throw new BadRequestException(
          'Nomor referensi transaksi / bukti transfer wajib diisi untuk metode transfer bank.'
        );
      }

      // 1.f Authoritative Legal Entity Resolution & Strict Cross-Entity Control
      let po: PurchaseOrder | null = null;
      if (invoice.poId) {
        po = await queryRunner.manager.findOne(PurchaseOrder, {
          where: { id: invoice.poId },
          relations: ['purchaseRequest', 'purchaseRequest.project'],
        });
      }

      const transactionCompanyCode = this.resolveTransactionCompanyCode(
        prq,
        invoice,
        po,
        (po as any)?.purchaseRequest?.project || (po as any)?.project
      );

      // 1.g Mandatory Authoritative Company Source Bank Account Selection & Eligibility Gate
      if (!dto.companyBankAccountId) {
        throw new BadRequestException(
          'Payment execution blocked: Company source bank account must be selected.'
        );
      }

      const sourceAccount = await queryRunner.manager.findOne(CompanyBankAccount, {
        where: { id: dto.companyBankAccountId },
      });

      if (!sourceAccount || sourceAccount.deletedAt) {
        throw new BadRequestException(
          'Payment execution blocked: Selected company bank account does not exist.'
        );
      }

      if (sourceAccount.companyCode !== transactionCompanyCode) {
        throw new BadRequestException(
          `Payment execution blocked: Selected company bank account belongs to ${sourceAccount.companyCode}, but payment transaction belongs to ${transactionCompanyCode}. Cross-entity account usage is strictly prohibited.`
        );
      }

      if (sourceAccount.status === CompanyBankAccountStatus.BLOCKED) {
        throw new BadRequestException(
          'Payment execution blocked: Selected company bank account is BLOCKED.'
        );
      }

      if (sourceAccount.status !== CompanyBankAccountStatus.ACTIVE) {
        throw new BadRequestException(
          `Payment execution blocked: Selected company bank account is ${sourceAccount.status}. Only ACTIVE accounts can be used for payment execution.`
        );
      }

      const paymentDateObj = new Date(dto.paymentDate || new Date());
      const effectiveDateObj = new Date(sourceAccount.effectiveDate);
      if (paymentDateObj < effectiveDateObj) {
        throw new BadRequestException(
          'Payment execution blocked: Selected company bank account is not yet effective for the payment date.'
        );
      }

      if (sourceAccount.expiryDate) {
        const expiryDateObj = new Date(sourceAccount.expiryDate);
        if (paymentDateObj > expiryDateObj) {
          throw new BadRequestException(
            'Payment execution blocked: Selected company bank account has expired.'
          );
        }
      }

      const maskedAccountNumber =
        sourceAccount.accountNumber.length > 4
          ? '••••••' + sourceAccount.accountNumber.slice(-4)
          : sourceAccount.accountNumber;

      const legalEntityName =
        sourceAccount.companyCode === 'TVM' ? 'PT TVM' : 'PT UBD';

      const sourceAccountSnapshot = {
        companyBankAccountId: Number(sourceAccount.id),
        companyCode: sourceAccount.companyCode,
        legalEntityName,
        bankName: sourceAccount.bankName,
        bankCode: sourceAccount.bankCode || null,
        accountNumber: sourceAccount.accountNumber,
        maskedAccountNumber,
        accountHolderName: sourceAccount.accountHolderName,
        accountType: sourceAccount.accountType,
        accountPurpose: sourceAccount.accountPurpose,
        currency: sourceAccount.currency || 'IDR',
        executionTimestamp: new Date().toISOString(),
        executedBy: userId ? Number(userId) : null,
      };

      // 2. Validate Invoice Match / Verification Status (MATCHED or VERIFIED)
      if (invoice.matchStatus !== 'MATCHED' && invoice.matchStatus !== 'VERIFIED') {
        throw new BadRequestException('Invoice belum disetujui untuk pembayaran');
      }

      // 3. Validate Invoice Payment Status
      if (invoice.paymentStatus === 'PAID') {
        throw new BadRequestException('Invoice is already PAID');
      }

      // 4. Validate Payment Amount
      const paymentAmount = Number(dto.paymentAmount ?? dto.amount);
      if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0 || !isFinite(paymentAmount)) {
        throw new BadRequestException('Payment amount harus lebih besar dari 0');
      }
      const paymentAmountDec = this.toMoneyDec(paymentAmount);

      // 4.b Validate Director Approved Amount Ceiling (CRIT-01 Enforcement)
      const approvedAmount = Number(prq.approvedAmount);
      if (
        prq.approvedAmount === null ||
        prq.approvedAmount === undefined ||
        isNaN(approvedAmount) ||
        approvedAmount <= 0 ||
        !isFinite(approvedAmount)
      ) {
        throw new BadRequestException(
          'Nominal persetujuan Direktur (approvedAmount) tidak valid pada Payment Request ini.'
        );
      }
      const approvedAmountDec = this.toMoneyDec(approvedAmount);

      // 5. Calculate Already Paid & Remaining on Invoice & Payment Request
      const existingPayments = (await queryRunner.manager.find(Payment, {
        where: { invoiceId: invoice.id },
      })) || [];
      let alreadyPaidDec = new Decimal(0);
      let alreadyPaidOnThisPrqDec = new Decimal(0);
      for (const p of existingPayments) {
        if (!p.deletedAt) {
          const pAmount = this.toMoneyDec(p.amount);
          alreadyPaidDec = alreadyPaidDec.plus(pAmount);
          if (p.paymentRequestId && Number(p.paymentRequestId) === Number(prq.id)) {
            alreadyPaidOnThisPrqDec = alreadyPaidOnThisPrqDec.plus(pAmount);
          }
        }
      }
      const alreadyPaid = alreadyPaidDec.toNumber();

      // Validate against remaining approved amount on this Payment Request
      const remainingApprovedOnPrqDec = Decimal.max(0, approvedAmountDec.minus(alreadyPaidOnThisPrqDec));
      if (paymentAmountDec.greaterThan(remainingApprovedOnPrqDec)) {
        throw new BadRequestException(
          `Payment amount (${paymentAmount}) melebihi nominal yang disetujui Direktur (${remainingApprovedOnPrqDec.toNumber()})`
        );
      }

      // Validate against remaining net vendor cash payable (if tax detail is recorded)
      if (invoice.invoiceTaxDetail?.netVendorCashPayable != null) {
        const netCashPayableDec = this.toMoneyDec(invoice.invoiceTaxDetail.netVendorCashPayable);
        const remainingNetCashDec = Decimal.max(0, netCashPayableDec.minus(alreadyPaidDec));
        if (paymentAmountDec.greaterThan(remainingNetCashDec)) {
          throw new BadRequestException(
            `Payment amount (${paymentAmount}) melebihi sisa kas bersih yang dapat dibayarkan ke vendor (${remainingNetCashDec.toNumber()})`
          );
        }
      }

      // Validate against remaining gross invoice liability
      const effectiveInvoiceGrossDec = invoice.invoiceTaxDetail?.grossCommercialLiability != null
        ? this.toMoneyDec(invoice.invoiceTaxDetail.grossCommercialLiability)
        : this.toMoneyDec(invoice.totalAmount);
      const remainingDec = Decimal.max(0, effectiveInvoiceGrossDec.minus(alreadyPaidDec));
      const remaining = remainingDec.toNumber();

      if (paymentAmountDec.greaterThan(remainingDec)) {
        throw new BadRequestException(
          `Payment amount (${paymentAmount}) melebihi sisa tagihan invoice (${remaining})`
        );
      }

      // 6. PO-Level Overpayment Guard
      if (invoice.poId) {
        if (!po) {
          po = await queryRunner.manager.findOne(PurchaseOrder, {
            where: { id: invoice.poId },
          });
        }
        if (po) {
          const poInvoices = (await queryRunner.manager.find(Invoice, {
            where: { poId: po.id },
            relations: ['invoiceTaxDetail'],
          })) || [];
          const poInvoiceIds = poInvoices.map((inv) => inv.id);

          let totalPoPaidBeforeDec = new Decimal(0);
          if (poInvoiceIds.length > 0) {
            const allPoPayments = (await queryRunner.manager.find(Payment, {
              where: { invoiceId: In(poInvoiceIds) },
            })) || [];
            for (const p of allPoPayments) {
              if (!p.deletedAt) {
                totalPoPaidBeforeDec = totalPoPaidBeforeDec.plus(this.toMoneyDec(p.amount));
              }
            }
          }
          const totalPoPaidBefore = totalPoPaidBeforeDec.toNumber();
          const poTotalDec = this.toMoneyDec(po.totalAmount);

          // Account for cumulative PPN billed across PO invoices under tax-exclusive pricing
          let totalPoPpnDec = new Decimal(0);
          for (const inv of poInvoices) {
            if (!inv.deletedAt && inv.status !== 'CANCELLED' && inv.invoiceTaxDetail?.ppnAmount) {
              totalPoPpnDec = totalPoPpnDec.plus(this.toMoneyDec(inv.invoiceTaxDetail.ppnAmount));
            }
          }
          const effectivePoTotalDec = poTotalDec.plus(totalPoPpnDec);
          const poTotal = effectivePoTotalDec.toNumber();
          const projectedTotalPaidDec = totalPoPaidBeforeDec.plus(paymentAmountDec);

          if (projectedTotalPaidDec.greaterThan(effectivePoTotalDec)) {
            throw new BadRequestException(
              `Akumulasi pembayaran PO (${projectedTotalPaidDec.toNumber()}) melebihi total Purchase Order (${poTotal})`
            );
          }
        }
      }

      // 7. Payment Term Validation & Lock (if term-based)
      let paymentTerm: PoPaymentTerm | null = null;
      if (invoice.paymentTermId) {
        paymentTerm = await queryRunner.manager.findOne(PoPaymentTerm, {
          where: { id: invoice.paymentTermId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!paymentTerm || paymentTerm.deletedAt) {
          throw new BadRequestException('Payment term tidak ditemukan');
        }

        if (paymentTerm.poId && invoice.poId && Number(paymentTerm.poId) !== Number(invoice.poId)) {
          throw new BadRequestException('Payment term bukan milik Purchase Order dari invoice ini.');
        }

        if (paymentTerm.status === PaymentTermStatus.PAID) {
          throw new BadRequestException('Payment term sudah lunas (PAID)');
        }

        if (paymentTerm.status !== PaymentTermStatus.VERIFIED) {
          throw new BadRequestException(
            `Pembayaran termin hanya dapat diproses untuk termin berstatus VERIFIED (status saat ini: ${paymentTerm.status})`
          );
        }

        // Invariant 2 & 4: Enforce authoritative Procurement Payment Term amount
        // DEC-TAX-08 Remediation: Dual-Entry Settlement Engine
        // Total Settlement Credit = D_cash + W_tax + W_wapu_ppn + P_ded == expectedTermTargetDec
        if (paymentTerm.amount !== undefined && paymentTerm.amount !== null) {
          const baseTermAmountDec = this.toMoneyDec(paymentTerm.amount);
          const expectedTermTargetDec = invoice.invoiceTaxDetail?.grossCommercialLiability != null
            ? this.toMoneyDec(invoice.invoiceTaxDetail.grossCommercialLiability)
            : baseTermAmountDec;

          const wTaxDec = this.toMoneyDec(invoice.invoiceTaxDetail?.pphWithholdingAmount || 0);
          const wWapuDec = this.toMoneyDec(invoice.invoiceTaxDetail?.wapuPpnWithheldAmount || 0);
          const pDedDec = this.toMoneyDec(invoice.invoiceTaxDetail?.priorDeductionsAmount || 0);
          const cumulativePaidCashDec = alreadyPaidDec.plus(paymentAmountDec);
          const totalSettlementCreditDec = cumulativePaidCashDec.plus(wTaxDec).plus(wWapuDec).plus(pDedDec);
          const singlePaymentCreditDec = paymentAmountDec.plus(wTaxDec).plus(wWapuDec).plus(pDedDec);

          const isExactGrossMatch =
            cumulativePaidCashDec.equals(expectedTermTargetDec) ||
            cumulativePaidCashDec.equals(baseTermAmountDec) ||
            paymentAmountDec.equals(expectedTermTargetDec) ||
            paymentAmountDec.equals(baseTermAmountDec);
          const isDualEntryMatch =
            totalSettlementCreditDec.equals(expectedTermTargetDec) ||
            totalSettlementCreditDec.equals(baseTermAmountDec) ||
            singlePaymentCreditDec.equals(expectedTermTargetDec) ||
            singlePaymentCreditDec.equals(baseTermAmountDec);

          if (!isExactGrossMatch && !isDualEntryMatch) {
            const hasTaxOrDeductions = wTaxDec.greaterThan(0) || wWapuDec.greaterThan(0) || pDedDec.greaterThan(0) || (invoice.invoiceTaxDetail?.ppnAmount ?? 0) > 0;
            const extraMsg = hasTaxOrDeductions
              ? ` atau net cash disbursement D_cash (${expectedTermTargetDec.minus(wTaxDec).minus(wWapuDec).minus(pDedDec).toNumber()}) dengan withholding tax diakui (${wTaxDec.plus(wWapuDec).toNumber()})`
              : '';
            throw new BadRequestException(
              `Payment amount (${paymentAmount}) harus sesuai dengan nilai termin pembayaran Procurement (${expectedTermTargetDec.toNumber()})${extraMsg}. Pembayaran dengan nominal berbeda dari jadwal termin Procurement tidak diizinkan.`
            );
          }
        }
      }

      // 8. Concurrency-Safe Unique Payment Number Generation
      let paymentNumber = '';
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      const dateStr = new Date(dto.paymentDate || new Date()).toISOString().slice(0, 10).replace(/-/g, '');

      while (!isUnique && attempts < maxAttempts) {
        attempts++;
        const count = await queryRunner.manager.count(Payment, {
          where: { paymentNumber: Like(`PAY-${dateStr}%`) },
        });
        const seq = String(count + attempts).padStart(3, '0');
        const candidateNumber = `PAY-${dateStr}-${seq}`;
        const existing = await queryRunner.manager.findOne(Payment, {
          where: { paymentNumber: candidateNumber },
        });
        if (!existing || existing.paymentNumber !== candidateNumber) {
          paymentNumber = candidateNumber;
          isUnique = true;
          break;
        }
      }

      if (!paymentNumber) {
        throw new ConflictException('Gagal menghasilkan nomor pembayaran unik setelah beberapa percobaan');
      }

      // 9. Create & Save Payment Entity
      const payment = new Payment();
      payment.invoiceId = invoice.id;
      payment.paymentRequestId = prq.id;
      payment.paymentNumber = paymentNumber;
      payment.paymentDate = new Date(dto.paymentDate);
      payment.amount = paymentAmount;
      payment.createdBy = userId;
      payment.companyCode = transactionCompanyCode;
      payment.companyBankAccountId = Number(sourceAccount.id);
      payment.paymentMethod = dto.paymentMethod || 'BANK_TRANSFER';
      payment.referenceNumber = dto.referenceNumber;
      payment.notes = dto.notes || null;
      payment.sourceAccountSnapshot = sourceAccountSnapshot;

      const saved = await queryRunner.manager.save(Payment, payment);
      const savedPayment = (saved && (saved.paymentNumber || saved.id)) ? { ...payment, ...saved } : payment;

      // Update Payment Request status to PAID
      prq.status = PaymentRequestStatus.PAID;
      await queryRunner.manager.save(PaymentRequest, prq);

      // 10. Update Invoice Payment Status
      // Finding 2 Remediation: Dual-Entry Settlement Status Recognition
      // Total recognized settlement credit towards the commercial invoice liability:
      // Total Settlement = Total Cash Paid + Legitimate Withholding Tax Credits (PPh + WAPU + Prior Deductions)
      const wTaxDec = this.toMoneyDec(invoice.invoiceTaxDetail?.pphWithholdingAmount || 0);
      const wWapuDec = this.toMoneyDec(invoice.invoiceTaxDetail?.wapuPpnWithheldAmount || 0);
      const pDedDec = this.toMoneyDec(invoice.invoiceTaxDetail?.priorDeductionsAmount || 0);
      const totalNonCashCreditsDec = wTaxDec.plus(wWapuDec).plus(pDedDec);

      const totalPaidCashDec = alreadyPaidDec.plus(paymentAmountDec);
      const totalSettlementRecognizedDec = totalPaidCashDec.plus(totalNonCashCreditsDec);

      const remainingCommercialDec = Decimal.max(
        0,
        effectiveInvoiceGrossDec.minus(Decimal.min(effectiveInvoiceGrossDec, totalSettlementRecognizedDec)),
      );
      const isFullyPaid = remainingCommercialDec.equals(0);
      const remainingAfter = remainingCommercialDec.toNumber();

      invoice.paymentStatus = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';
      invoice.status = invoice.paymentStatus;
      invoice.updatedBy = userId;
      await queryRunner.manager.save(Invoice, invoice);

      // 11. Settle Payment Term (if fully paid & term-based)
      if (isFullyPaid && paymentTerm) {
        paymentTerm.status = PaymentTermStatus.PAID;
        paymentTerm.updatedBy = userId;
        await queryRunner.manager.save(PoPaymentTerm, paymentTerm);
      }

      // Canonical AuditLog: Payment RECORD
      const paymentAudit = queryRunner.manager.create(AuditLog, {
        table_name: 'payments',
        record_id: savedPayment.id,
        action: 'RECORD',
        old_value: null,
        new_value: {
          paymentNumber: savedPayment.paymentNumber,
          invoiceId: invoice.id,
          poId: invoice.poId ?? undefined,
          amount: Number(savedPayment.amount),
          paymentDate: savedPayment.paymentDate,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes || null,
          companyCode: transactionCompanyCode,
          companyBankAccountId: Number(sourceAccount.id),
          bankName: sourceAccount.bankName,
          accountNumberMasked: sourceAccountSnapshot.maskedAccountNumber,
          sourceAccountSnapshot,
          invoicePaymentStatusAfter: invoice.paymentStatus,
          isFullyPaid,
          remainingAmount: remainingAfter > 0 ? remainingAfter : 0,
          paymentTermStatusAfter: paymentTerm ? paymentTerm.status : undefined,
        },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, paymentAudit);

      // 11.b Authoritative PO Financial Closure & PR Procurement Closure
      let isPoClosed = false;
      let isPrClosed = false;
      let closedPoId: number | null = null;
      let closedPrId: number | null = null;

      if (invoice.poId) {
        // Serialization Point 1: Lock PO FOR UPDATE before evaluating closure
        const lockedPo = await queryRunner.manager.findOne(PurchaseOrder, {
          where: { id: invoice.poId },
          lock: { mode: 'pessimistic_write' },
        });

        if (lockedPo && !lockedPo.deletedAt) {
          // Re-read authoritative payment terms for this PO
          const allPoTerms = (await queryRunner.manager.find(PoPaymentTerm, {
            where: { poId: lockedPo.id },
          })) || [];
          const activeTerms = allPoTerms.filter((t) => !t.deletedAt);

          // Re-read all invoices for this PO (exclude deleted, cancelled, rejected)
          const allPoInvoices = (await queryRunner.manager.find(Invoice, {
            where: { poId: lockedPo.id },
          })) || [];
          const activeInvoices = allPoInvoices.filter(
            (inv) => !inv.deletedAt && inv.status !== 'CANCELLED' && inv.matchStatus !== 'REJECTED'
          );

          // Re-read all active payments across active invoices of this PO
          const activeInvoiceIds = activeInvoices.map((i) => i.id);
          let cumulativePoPaymentsDec = new Decimal(0);
          if (activeInvoiceIds.length > 0) {
            const allPoPayments = (await queryRunner.manager.find(Payment, {
              where: { invoiceId: In(activeInvoiceIds) },
            })) || [];
            for (const p of allPoPayments) {
              if (!p.deletedAt) {
                cumulativePoPaymentsDec = cumulativePoPaymentsDec.plus(this.toMoneyDec(p.amount));
              }
            }
          }
          const cumulativePoPayments = cumulativePoPaymentsDec.toNumber();
          const poTotalDec = this.toMoneyDec(lockedPo.totalAmount);
          const poTotal = poTotalDec.toNumber();

          // Authoritative Financial Closure Condition:
          // a. All active payment terms are PAID (if terms exist)
          const allTermsPaid = activeTerms.length > 0 && activeTerms.every((t) => t.status === PaymentTermStatus.PAID);
          // b. Cumulative active payments >= PO total amount
          const isPoAmountSettled = cumulativePoPaymentsDec.greaterThanOrEqualTo(poTotalDec);
          // c. All active invoices are PAID
          const allInvoicesPaid = activeInvoices.length > 0 && activeInvoices.every((inv) => inv.paymentStatus === 'PAID');

          if (allTermsPaid && isPoAmountSettled && allInvoicesPaid) {
            // Idempotency check under PO lock
            const existingPoClosureAudit = await queryRunner.manager.findOne(AuditLog, {
              where: {
                table_name: 'purchase_orders',
                record_id: lockedPo.id,
                action: 'FINANCIAL_CLOSE',
              },
            });

            if (!existingPoClosureAudit) {
              const poCloseAudit = queryRunner.manager.create(AuditLog, {
                table_name: 'purchase_orders',
                record_id: lockedPo.id,
                action: 'FINANCIAL_CLOSE',
                old_value: {
                  status: lockedPo.status,
                  isFinanciallyClosed: false,
                },
                new_value: {
                  status: lockedPo.status, // Preserve physical status semantics (COMPLETED / etc.)
                  isFinanciallyClosed: true,
                  totalPo: poTotal,
                  totalPaid: cumulativePoPayments,
                  paymentTermsCount: activeTerms.length,
                  allTermsPaid: true,
                  invoicesCount: activeInvoices.length,
                },
                created_by: userId ? Number(userId) : null,
              });
              await queryRunner.manager.save(AuditLog, poCloseAudit);
              isPoClosed = true;
              closedPoId = lockedPo.id;
            }

            // PR PROCUREMENT CLOSURE EVALUATION
            if (lockedPo.purchaseRequestId) {
              // Serialization Point 2: Lock PR FOR UPDATE before evaluating closure
              const lockedPr = await queryRunner.manager.findOne(PurchaseRequest, {
                where: { id: lockedPo.purchaseRequestId },
                lock: { mode: 'pessimistic_write' },
              });

              if (lockedPr && !lockedPr.deletedAt) {
                // Load all active POs under this PR
                const allPrPos = (await queryRunner.manager.find(PurchaseOrder, {
                  where: { purchaseRequestId: lockedPr.id },
                })) || [];
                const activePrPos = allPrPos.filter((p) => !p.deletedAt);

                let allPosComplete = activePrPos.length > 0;
                for (const prPo of activePrPos) {
                  // 1) Physical completion requirement
                  if (prPo.status !== 'COMPLETED') {
                    allPosComplete = false;
                    break;
                  }

                  // 2) Independent financial check for this PO
                  const prPoTerms = (await queryRunner.manager.find(PoPaymentTerm, {
                    where: { poId: prPo.id },
                  })) || [];
                  const activePrPoTerms = prPoTerms.filter((t) => !t.deletedAt);
                  const prPoTermsPaid = activePrPoTerms.length > 0 && activePrPoTerms.every((t) => t.status === PaymentTermStatus.PAID);

                  const prPoInvs = (await queryRunner.manager.find(Invoice, {
                    where: { poId: prPo.id },
                  })) || [];
                  const activePrPoInvs = prPoInvs.filter(
                    (inv) => !inv.deletedAt && inv.status !== 'CANCELLED' && inv.matchStatus !== 'REJECTED'
                  );
                  const prPoInvsPaid = activePrPoInvs.length > 0 && activePrPoInvs.every((inv) => inv.paymentStatus === 'PAID');

                  const prPoInvIds = activePrPoInvs.map((i) => i.id);
                  let prPoPaymentsSumDec = new Decimal(0);
                  if (prPoInvIds.length > 0) {
                    const prPoPmts = (await queryRunner.manager.find(Payment, {
                      where: { invoiceId: In(prPoInvIds) },
                    })) || [];
                    for (const pm of prPoPmts) {
                      if (!pm.deletedAt) prPoPaymentsSumDec = prPoPaymentsSumDec.plus(this.toMoneyDec(pm.amount));
                    }
                  }
                  const prPoPaymentsSum = prPoPaymentsSumDec.toNumber();
                  const prPoTotalDec = this.toMoneyDec(prPo.totalAmount);

                  if (!prPoTermsPaid || !prPoInvsPaid || prPoPaymentsSumDec.lessThan(prPoTotalDec)) {
                    allPosComplete = false;
                    break;
                  }
                }

                if (allPosComplete) {
                  // Idempotency check for PR closure under PR lock
                  const existingPrClosureAudit = await queryRunner.manager.findOne(AuditLog, {
                    where: {
                      table_name: 'purchase_requests',
                      record_id: lockedPr.id,
                      action: 'PROCUREMENT_CLOSE',
                    },
                  });

                  if (!existingPrClosureAudit) {
                    const prCloseAudit = queryRunner.manager.create(AuditLog, {
                      table_name: 'purchase_requests',
                      record_id: lockedPr.id,
                      action: 'PROCUREMENT_CLOSE',
                      old_value: {
                        status: lockedPr.status,
                        isProcurementClosed: false,
                      },
                      new_value: {
                        status: lockedPr.status, // Preserve PO_ISSUED status
                        isProcurementClosed: true,
                        activePosCount: activePrPos.length,
                        allPosPhysicallyCompleted: true,
                        allPosFinanciallySettled: true,
                      },
                      created_by: userId ? Number(userId) : null,
                    });
                    await queryRunner.manager.save(AuditLog, prCloseAudit);
                    isPrClosed = true;
                    closedPrId = lockedPr.id;
                  }
                }
              }
            }
          }
        }
      }

      // Canonical Outbox: finance.payment.recorded
      const paymentEvent: BusinessEvent<{
        paymentId: number;
        paymentNumber: string;
        invoiceId: number;
        poId: number;
        amount: number;
        paymentDate: string;
        paymentStatus: string;
        isFullyPaid: boolean;
        recordedBy: number | null;
      }> = {
        eventId: randomUUID(),
        eventName: 'finance.payment.recorded',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Payment',
        aggregateId: savedPayment.id,
        projectId: undefined,
        actor: userId ? { userId: Number(userId) } : undefined,
        routing: undefined,
        notificationPolicy: undefined,
        payload: {
          paymentId: Number(savedPayment.id),
          paymentNumber: savedPayment.paymentNumber,
          invoiceId: Number(invoice.id),
          poId: Number(invoice.poId),
          amount: Number(savedPayment.amount),
          paymentDate: savedPayment.paymentDate instanceof Date ? savedPayment.paymentDate.toISOString() : new Date(savedPayment.paymentDate).toISOString(),
          paymentStatus: invoice.paymentStatus,
          isFullyPaid,
          recordedBy: userId ? Number(userId) : null,
        },
      };

      const paymentOutbox = queryRunner.manager.create(OutboxEvent, {
        event_id: paymentEvent.eventId,
        event_name: paymentEvent.eventName,
        event_version: String(paymentEvent.eventVersion),
        aggregate_type: paymentEvent.aggregateType,
        aggregate_id: Number(paymentEvent.aggregateId),
        correlation_id: paymentEvent.correlationId || null,
        payload: {
          occurredAt: paymentEvent.occurredAt,
          projectId: paymentEvent.projectId,
          actor: paymentEvent.actor,
          routing: paymentEvent.routing,
          notificationPolicy: paymentEvent.notificationPolicy,
          businessPayload: paymentEvent.payload,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, paymentOutbox);

      // 12. Commit Transaction
      await queryRunner.commitTransaction();

      // 13. Emit Event AFTER Commit
      this.eventEmitter.emit('finance.payment_processed', {
        paymentId: savedPayment.id,
        invoiceId: invoice.id,
        poId: invoice.poId,
        paymentNumber: savedPayment.paymentNumber,
        amount: savedPayment.amount,
        paymentAmount: savedPayment.amount,
        paymentStatus: invoice.paymentStatus,
        remainingAmount: remainingAfter > 0 ? remainingAfter : 0,
        isFullyPaid,
        message: `Pembayaran ${savedPayment.paymentNumber} untuk Invoice #${invoice.invoiceNumber} telah diproses (${invoice.paymentStatus})`,
        timestamp: new Date().toISOString(),
      });

      if (isPoClosed && closedPoId) {
        this.eventEmitter.emit('procurement.po_financially_completed', {
          poId: closedPoId,
          closedBy: userId,
          timestamp: new Date().toISOString(),
        });
      }

      if (isPrClosed && closedPrId) {
        this.eventEmitter.emit('procurement.pr_procurement_completed', {
          prId: closedPrId,
          closedBy: userId,
          timestamp: new Date().toISOString(),
        });
      }

      (savedPayment as any).paymentStatus = invoice.paymentStatus;
      (savedPayment as any).remainingAmount = remainingAfter > 0 ? remainingAfter : 0;
      (savedPayment as any).isFullyPaid = isFullyPaid;

      return savedPayment;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      if (
        err instanceof OptimisticLockVersionMismatchError ||
        err.name === 'OptimisticLockVersionMismatchError' ||
        err.message?.includes('OptimisticLockVersionMismatchError')
      ) {
        throw new ConflictException('Data invoice telah berubah atau sedang diproses oleh pengguna lain. Silakan refresh halaman.');
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async evaluateMatching(
    invoice: Invoice,
    dto?: VerifyInvoiceDto,
    runnerManager?: EntityManager,
  ): Promise<MatchingResult> {
    const em = runnerManager || this.invoiceRepository.manager;
    const mismatches: MatchingMismatch[] = [];

    // 1. Resolve PO (Guarantee po.items is loaded)
    let po = invoice.purchaseOrder;
    if ((!po || !po.items || !Array.isArray(po.items)) && (invoice.poId || po?.id) && em && typeof em.findOne === 'function') {
      po = await em.findOne(PurchaseOrder, {
        where: { id: invoice.poId || po?.id },
        relations: ['vendor', 'items', 'paymentTerms', 'invoices'],
      });
    }

    if (!po || po.deletedAt) {
      mismatches.push({
        code: MismatchCode.PO_NOT_FOUND,
        message: 'Purchase Order tidak ditemukan.',
      });
    }

    const isServicePo = Boolean(po && (po.orderType === PurchaseOrderType.SERVICE || (po.orderType as any) === 'SERVICE'));

    const poTotal = po ? Number(po.totalAmount || 0) : 0;
    const invoicedAmount = Number(invoice.totalAmount || 0);

    // 1.5 Service Claim Resolution and Validation (for SERVICE PO)
    let serviceClaim: ServiceClaim | null = invoice.serviceClaim || null;
    if (isServicePo) {
      if (!invoice.serviceClaimId) {
        mismatches.push({
          code: MismatchCode.EVIDENCE_REQUIRED,
          message: 'Invoice penagihan Service PO wajib menyertakan referensi Klaim Jasa yang telah disetujui (APPROVED_FOR_INVOICE).',
        });
      } else {
        if ((!serviceClaim || !serviceClaim.items || !Array.isArray(serviceClaim.items)) && em && typeof em.findOne === 'function') {
          serviceClaim = await em.findOne(ServiceClaim, {
            where: { id: invoice.serviceClaimId },
            relations: ['items'],
          });
        }

        if (!serviceClaim || serviceClaim.deletedAt) {
          mismatches.push({
            code: MismatchCode.EVIDENCE_REQUIRED,
            message: `Service Claim dengan ID ${invoice.serviceClaimId} tidak ditemukan atau telah dihapus.`,
          });
        } else if (Number(serviceClaim.poId) !== Number(po?.id || invoice.poId)) {
          mismatches.push({
            code: MismatchCode.OTHER,
            message: 'Service Claim bukan milik Purchase Order pada invoice ini.',
          });
        } else if (serviceClaim.status !== ServiceClaimStatus.APPROVED_FOR_INVOICE) {
          mismatches.push({
            code: MismatchCode.OTHER,
            message: `Status Service Claim tidak valid (${serviceClaim.status}). Hanya Service Claim berstatus APPROVED_FOR_INVOICE yang dapat ditagihkan.`,
          });
        }
      }
    }

    if (isServicePo && serviceClaim) {
      const approvedClaimDec = this.toMoneyDec(serviceClaim.approvedClaimAmount);
      const invoicedAmountDec = this.toMoneyDec(invoicedAmount);
      if (invoicedAmountDec.greaterThan(approvedClaimDec)) {
        mismatches.push({
          code: MismatchCode.AMOUNT_EXCEEDED_TERM,
          message: `Nilai invoice (Rp${invoicedAmountDec.toNumber().toLocaleString('id-ID')}) melebihi nilai klaim jasa yang disetujui (Rp${approvedClaimDec.toNumber().toLocaleString('id-ID')}).`,
        });
      }

      // Check duplicate active invoice for the same Service Claim
      let claimInvoices: Invoice[] = [];
      if (po?.invoices && Array.isArray(po.invoices)) {
        claimInvoices = po.invoices;
      } else if (em && typeof em.find === 'function') {
        claimInvoices = (await em.find(Invoice, { where: { serviceClaimId: serviceClaim.id } })) || [];
      }
      const otherInvoiceForClaim = claimInvoices.find(
        i => Number(i.id) !== Number(invoice.id) &&
          !i.deletedAt &&
          i.status !== 'CANCELLED' &&
          i.status !== 'REJECTED' &&
          i.matchStatus !== 'REJECTED'
      );
      if (otherInvoiceForClaim) {
        mismatches.push({
          code: MismatchCode.OTHER,
          message: `Service Claim '${serviceClaim.claimNumber || serviceClaim.id}' sudah ditagihkan pada invoice aktif lain (${otherInvoiceForClaim.invoiceNumber || otherInvoiceForClaim.id}).`,
        });
      }
    }

    // 2. Validate current invoice status
    if (invoice.matchStatus === 'VERIFIED') {
      mismatches.push({
        code: MismatchCode.INVOICE_ALREADY_VERIFIED,
        message: 'Invoice sudah berstatus VERIFIED.',
      });
    }

    if (invoice.paymentStatus === 'PAID') {
      mismatches.push({
        code: MismatchCode.INVOICE_ALREADY_PAID,
        message: 'Invoice yang sudah dibayar (PAID) tidak dapat diverifikasi ulang.',
      });
    }

    // 3. PO Status Validation
    if (po) {
      if (invoice.paymentTermId) {
        const eligiblePoStatuses = ['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED'];
        if (!eligiblePoStatuses.includes(po.status)) {
          mismatches.push({
            code: MismatchCode.PO_NOT_ACTIVE,
            message: `Purchase Order tidak aktif atau status tidak valid (${po.status}).`,
          });
        }
      } else {
        const eligibleStatuses = isServicePo ? ['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED'] : ['COMPLETED'];
        if (!eligibleStatuses.includes(po.status)) {
          mismatches.push({
            code: MismatchCode.PO_NOT_ACTIVE,
            message: isServicePo
              ? `Purchase Order tidak aktif atau status tidak valid (${po.status}).`
              : 'Purchase Order harus berstatus COMPLETED untuk verifikasi invoice penuh.',
          });
        }
      }
    }

    // 4. Authoritative Vendor Matching (PO is the absolute source of truth)
    if (po) {
      const invVendorId = (invoice as any)?.vendorId;
      if (invVendorId !== undefined && invVendorId !== null && Number(invVendorId) !== Number(po.vendorId)) {
        mismatches.push({
          code: MismatchCode.VENDOR_MISMATCH,
          message: 'Vendor invoice tidak sesuai dengan vendor Purchase Order.',
        });
      }
      const clientVendorId = (dto as any)?.vendorId;
      if (clientVendorId !== undefined && clientVendorId !== null && Number(clientVendorId) !== Number(po.vendorId)) {
        mismatches.push({
          code: MismatchCode.VENDOR_MISMATCH,
          message: 'Vendor invoice tidak sesuai dengan vendor Purchase Order.',
        });
      }
    }

    // 4.5. Item-Level Matching (Ownership, Price, Quantity)
    if (invoice.items && invoice.items.length > 0) {
      const poItems = po?.items || [];
      let otherInvoices: Invoice[] = [];
      if (po?.invoices && Array.isArray(po.invoices)) {
        otherInvoices = po.invoices.filter(i => !i.deletedAt && i.status !== 'CANCELLED' && i.status !== 'REJECTED' && i.matchStatus !== 'REJECTED' && Number(i.id) !== Number(invoice.id));
      } else if (po?.id && em && typeof em.find === 'function') {
        const found = (await em.find(Invoice, { where: { poId: po.id }, relations: ['items'] })) || [];
        otherInvoices = found.filter(i => !i.deletedAt && i.status !== 'CANCELLED' && i.status !== 'REJECTED' && i.matchStatus !== 'REJECTED' && Number(i.id) !== Number(invoice.id));
      }
      const activeInvoiceItems = otherInvoices.flatMap(i => i.items || []);

      for (const invItem of invoice.items) {
        if (invItem.deletedAt) continue;

        if (!invItem.poItemId) {
          // Standalone milestone detail (e.g. DOWN_PAYMENT or RETENTION without PO Item allocation)
          continue;
        }

        const authoritativePoItem = poItems.find(pi => Number(pi.id) === Number(invItem.poItemId));

        if (!authoritativePoItem || (authoritativePoItem.purchaseOrderId && po?.id && Number(authoritativePoItem.purchaseOrderId) !== Number(po.id))) {
          mismatches.push({
            code: MismatchCode.ITEM_NOT_FOUND,
            message: `Item invoice (PO Item ID: ${invItem.poItemId}) bukan merupakan bagian dari Purchase Order ini.`,
          });
          continue;
        }

        const invUnitPriceDec = this.toMoneyDec(invItem.unitPrice);
        const poUnitPriceDec = this.toMoneyDec(authoritativePoItem.unitPrice);
        if (!invUnitPriceDec.equals(poUnitPriceDec)) {
          mismatches.push({
            code: MismatchCode.PRICE_MISMATCH,
            message: `Harga satuan item invoice (Rp${invUnitPriceDec.toNumber().toLocaleString('id-ID')}) tidak sesuai dengan harga PO (Rp${poUnitPriceDec.toNumber().toLocaleString('id-ID')}).`,
          });
        }

        const currentQty = Number(invItem.quantity || 0);

        if (!isServicePo) {
          const previouslyInvoicedQty = activeInvoiceItems
            .filter(i => Number(i.poItemId) === Number(invItem.poItemId) && !i.deletedAt)
            .reduce((sum, i) => sum + Number(i.quantity || 0), 0);

          const receivedQty = Number(authoritativePoItem.receivedQuantity || 0);
          const remainingBillable = Math.max(0, receivedQty - previouslyInvoicedQty);

          if (currentQty > remainingBillable + 0.001) {
            mismatches.push({
              code: MismatchCode.QUANTITY_EXCEEDED,
              message: `Kuantitas item invoice (${currentQty}) melebihi sisa kapasitas tagih (Diterima: ${receivedQty}, Sudah ditagihkan: ${previouslyInvoicedQty}).`,
            });
          }
        } else {
          // Canonical Service Reconciliation: Quantity authority is derived from the linked approved Service Claim
          if (serviceClaim) {
            const claimItem = serviceClaim.items?.find(ci => Number(ci.poItemId) === Number(invItem.poItemId));
            if (!claimItem) {
              mismatches.push({
                code: MismatchCode.ITEM_NOT_FOUND,
                message: `Item invoice (PO Item ID: ${invItem.poItemId}) tidak tercantum dalam Service Claim yang disetujui.`,
              });
            } else {
              const approvedClaimQty = Number(claimItem.currentClaimQuantity || 0);
              const otherClaimInvoices = otherInvoices.filter(i => Number(i.serviceClaimId) === Number(serviceClaim.id));
              const previouslyInvoicedClaimQty = otherClaimInvoices
                .flatMap(i => i.items || [])
                .filter(i => Number(i.poItemId) === Number(invItem.poItemId) && !i.deletedAt)
                .reduce((sum, i) => sum + Number(i.quantity || 0), 0);
              const remainingClaimQty = Math.max(0, approvedClaimQty - previouslyInvoicedClaimQty);

              const totalPoItemQty = Number(authoritativePoItem.quantity || 0);
              const previouslyInvoicedTotalQty = activeInvoiceItems
                .filter(i => Number(i.poItemId) === Number(invItem.poItemId) && !i.deletedAt)
                .reduce((sum, i) => sum + Number(i.quantity || 0), 0);
              const remainingPoContractQty = Math.max(0, totalPoItemQty - previouslyInvoicedTotalQty);

              if (currentQty > remainingClaimQty + 0.001) {
                mismatches.push({
                  code: MismatchCode.QUANTITY_EXCEEDED,
                  message: `Kuantitas item invoice (${currentQty}) melebihi kuantitas klaim jasa yang disetujui (Disetujui: ${approvedClaimQty}, Sudah ditagihkan: ${previouslyInvoicedClaimQty}).`,
                });
              } else if (currentQty > remainingPoContractQty + 0.001) {
                mismatches.push({
                  code: MismatchCode.QUANTITY_EXCEEDED,
                  message: `Kuantitas item invoice (${currentQty}) melebihi sisa kuantitas kontrak PO (${remainingPoContractQty}).`,
                });
              }
            }
          }
        }
      }
    }

    // 5. Payment Term Matching (if term-based)
    let paymentTerm: PoPaymentTerm | null = null;
    let termPercentage: number | undefined;
    let termAmount: number | undefined;
    let remainingTermAmount: number | undefined;
    let grRefStr = dto?.evidenceRef?.trim();
    let grRefId = (dto as any)?.goodsReceiptId;

    if (invoice.paymentTermId) {
      paymentTerm = invoice.paymentTerm || await em.findOne(PoPaymentTerm, {
        where: { id: invoice.paymentTermId },
      });

      if (!paymentTerm || paymentTerm.deletedAt) {
        mismatches.push({
          code: MismatchCode.TERM_NOT_FOUND,
          message: 'Payment term tidak ditemukan.',
        });
      } else {
        termPercentage = Number(paymentTerm.percentage);
        termAmount = Number(paymentTerm.amount);

        // Ownership
        if (Number(paymentTerm.poId) !== Number(invoice.poId)) {
          mismatches.push({
            code: MismatchCode.TERM_NOT_FOUND,
            message: 'Payment term bukan milik Purchase Order pada invoice ini.',
          });
        }

        // Status
        if (paymentTerm.status === PaymentTermStatus.VERIFIED) {
          mismatches.push({
            code: MismatchCode.TERM_ALREADY_VERIFIED,
            message: 'Payment term sudah berstatus VERIFIED.',
          });
        } else if (paymentTerm.status !== PaymentTermStatus.INVOICE_SUBMITTED) {
          mismatches.push({
            code: MismatchCode.TERM_STATUS_INVALID,
            message: `Status payment term (${paymentTerm.status}) belum siap diverifikasi. Status harus INVOICE_SUBMITTED.`,
          });
        }

        // Percentage validity
        if (termPercentage <= 0 || termPercentage > 100 || isNaN(termPercentage)) {
          mismatches.push({
            code: MismatchCode.INVALID_TERM_PERCENTAGE,
            message: 'Persentase termin tidak valid.',
          });
        }

        // Prerequisites / Evidence
        if (paymentTerm.termType === PaymentTermType.PROGRESS) {
          if (!isServicePo) {
            // Preview-only resolution: If called from read-only matching preview and DTO has no explicit evidence,
            // resolve canonical active Goods Receipt from invoice.poId -> goods_receipts
            let previewResolvedGr: GoodsReceipt | null = null;
            if (!grRefStr && !grRefId && (dto as any)?.isPreview) {
              const targetPoId = invoice.poId || po?.id;
              if (targetPoId && em && typeof em.find === 'function') {
                const poGrs = await em.find(GoodsReceipt, {
                  where: { poId: targetPoId },
                  relations: ['items'],
                  order: { id: 'DESC' },
                });
                const validGrs = (poGrs || []).filter(g =>
                  !g.deletedAt &&
                  Number(g.poId) === Number(targetPoId) &&
                  Array.isArray(g.items) &&
                  g.items.length > 0 &&
                  g.items.some(gi => Number(gi.receivedQuantity) > 0)
                );
                if (validGrs.length > 0) {
                  previewResolvedGr = validGrs[0];
                  grRefId = previewResolvedGr.id;
                  grRefStr = previewResolvedGr.grNumber;
                }
              }
            }

            if (!grRefStr && !grRefId) {
              mismatches.push({
                code: MismatchCode.EVIDENCE_REQUIRED,
                message: 'Verifikasi termin progress wajib menyertakan referensi Goods Receipt valid.',
              });
            } else {
              let gr: GoodsReceipt | null = previewResolvedGr;
              if (!gr) {
                if (grRefId && em && typeof em.findOne === 'function') {
                  gr = await em.findOne(GoodsReceipt, {
                    where: { id: grRefId },
                    relations: ['items'],
                  });
                } else if (grRefStr && em && typeof em.findOne === 'function') {
                  gr = await em.findOne(GoodsReceipt, {
                    where: { grNumber: grRefStr },
                    relations: ['items'],
                  });
                  if (!gr && !isNaN(Number(grRefStr))) {
                    gr = await em.findOne(GoodsReceipt, {
                      where: { id: Number(grRefStr) },
                      relations: ['items'],
                    });
                  }
                }
              }

              if (!gr) {
                mismatches.push({
                  code: MismatchCode.GR_NOT_FOUND,
                  message: `Goods Receipt '${grRefStr || grRefId}' tidak ditemukan di sistem.`,
                });
              } else if (gr.deletedAt) {
                mismatches.push({
                  code: MismatchCode.GR_DELETED,
                  message: 'Goods Receipt telah dihapus atau dibatalkan.',
                });
              } else if (Number(gr.poId) !== Number(invoice.poId)) {
                mismatches.push({
                  code: MismatchCode.GR_PO_MISMATCH,
                  message: 'Goods Receipt bukan milik Purchase Order pada invoice ini.',
                });
              } else if (!gr.items || gr.items.length === 0 || !gr.items.some(gi => Number(gi.receivedQuantity) > 0)) {
                mismatches.push({
                  code: MismatchCode.GR_ITEM_INVALID,
                  message: 'Goods Receipt tidak memiliki rincian item barang valid.',
                });
              } else {
                // Validate physical delivery capacity
                const allPoGrs = (em && typeof em.find === 'function' ? await em.find(GoodsReceipt, {
                  where: { poId: invoice.poId },
                  relations: ['items'],
                }) : []) || [];
                let totalReceivedPhysicalValue = 0;
                for (const g of allPoGrs) {
                  if (g.deletedAt) continue;
                  for (const gi of g.items || []) {
                    const poi = po?.items?.find(i => Number(i.id) === Number(gi.poItemId));
                    if (poi) {
                      totalReceivedPhysicalValue += Number(gi.receivedQuantity) * Number(poi.unitPrice || 0);
                    }
                  }
                }

                let previousProgressBilled = 0;
                const allInvoices = (po?.invoices || (em && typeof em.find === 'function' ? await em.find(Invoice, { where: { poId: invoice.poId } }) : [])) || [];
                for (const inv of allInvoices) {
                  if (inv.deletedAt || inv.status === 'CANCELLED' || Number(inv.id) === Number(invoice.id)) continue;
                  const term = inv.paymentTerm || (inv.paymentTermId && em && typeof em.findOne === 'function' ? await em.findOne(PoPaymentTerm, { where: { id: inv.paymentTermId } }) : null);
                  if (term && term.termType === PaymentTermType.PROGRESS) {
                    previousProgressBilled += Number(inv.totalAmount || 0);
                  }
                }

                const currentInvoiceAmountDec = this.toMoneyDec(invoice.totalAmount);
                const previousProgressBilledDec = this.toMoneyDec(previousProgressBilled);
                const totalReceivedPhysicalValueDec = this.toMoneyDec(totalReceivedPhysicalValue);
                const totalProgressDec = previousProgressBilledDec.plus(currentInvoiceAmountDec);
                if (totalProgressDec.greaterThan(totalReceivedPhysicalValueDec)) {
                  mismatches.push({
                    code: MismatchCode.PROGRESS_BILLING_EXCEEDS_RECEIVED,
                    message: `Nilai akumulasi penagihan progress (Rp${totalProgressDec.toNumber().toLocaleString('id-ID')}) melebihi total nilai fisik barang yang telah diterima (Rp${totalReceivedPhysicalValueDec.toNumber().toLocaleString('id-ID')}).`,
                  });
                }

                // Milestone Eligibility Gate in evaluateMatching
                const is100PercentMilestone =
                  /100%|fisik\s*100%|lengkap/i.test(paymentTerm.triggerCondition || '') ||
                  Number(paymentTerm.percentage) === 100;

                if (is100PercentMilestone) {
                  const isAllItemsCompleted =
                    po?.status === 'COMPLETED' &&
                    po?.items &&
                    po.items.length > 0 &&
                    po.items.every(item => Number(item.receivedQuantity || 0) >= Number(item.quantity || 0));

                  if (!isAllItemsCompleted) {
                    mismatches.push({
                      code: MismatchCode.INSUFFICIENT_DELIVERY,
                      message: `Termin progress dengan syarat milestone '${paymentTerm.triggerCondition || 'Kemajuan Fisik 100%'}' tidak dapat diverifikasi karena pengiriman fisik barang/jasa belum selesai 100% (status PO: ${po?.status || 'UNKNOWN'}).`,
                    });
                  }
                } else {
                  const matchPercent = (paymentTerm.triggerCondition || '').match(/(\d+(?:\.\d+)?)\s*%/);
                  if (matchPercent) {
                    const targetPercent = parseFloat(matchPercent[1]);
                    if (targetPercent < 100) {
                      const poTotal = Number(po?.totalAmount || 0);
                      const physicalProgress = poTotal > 0 ? (totalReceivedPhysicalValue / poTotal) * 100 : 0;
                      if (Math.round(physicalProgress * 100) / 100 + 0.5 < targetPercent) {
                        mismatches.push({
                          code: MismatchCode.INSUFFICIENT_DELIVERY,
                          message: `Termin progress dengan syarat milestone '${paymentTerm.triggerCondition}' tidak dapat diverifikasi karena kemajuan fisik baru mencapai ${physicalProgress.toFixed(2)}% (target: ${targetPercent}%).`,
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        } else if (paymentTerm.termType === PaymentTermType.FINAL_DELIVERY) {
          if (!isServicePo) {
            if (!po || po.status !== 'COMPLETED') {
              mismatches.push({
                code: MismatchCode.INSUFFICIENT_DELIVERY,
                message: 'Termin final delivery hanya dapat diverifikasi setelah Purchase Order selesai (COMPLETED) dan seluruh barang diterima penuh.',
              });
            } else {
              const isAllItemsCompleted =
                po.items &&
                po.items.length > 0 &&
                po.items.every(item => Number(item.receivedQuantity || 0) >= Number(item.quantity || 0));

              if (!isAllItemsCompleted) {
                mismatches.push({
                  code: MismatchCode.INSUFFICIENT_DELIVERY,
                  message: 'Termin final delivery gagal diverifikasi karena masih ada barang yang belum diterima penuh.',
                });
              }
            }
          }
        } else if (paymentTerm.termType === PaymentTermType.RETENTION || paymentTerm.isRetention) {
          if (!po || po.status !== 'COMPLETED') {
            mismatches.push({
              code: MismatchCode.RETENTION_PO_NOT_COMPLETED,
              message: 'Termin retensi hanya dapat diverifikasi setelah Purchase Order selesai (COMPLETED).',
            });
          }
          if (!dto?.evidenceRef || dto.evidenceRef.trim() === '') {
            mismatches.push({
              code: MismatchCode.EVIDENCE_REQUIRED,
              message: 'Verifikasi termin retensi wajib menyertakan referensi bukti pemenuhan kondisi retensi.',
            });
          }
        }

        // Sequence Validation (Section H)
        if (po && Number(paymentTerm.sequence) > 1) {
          const allTerms = po.paymentTerms || (em && typeof em.find === 'function' ? await em.find(PoPaymentTerm, { where: { poId: po.id } }) : []) || [];
          const currentSeq = Number(paymentTerm.sequence);
          for (const t of allTerms) {
            if (t.deletedAt) continue;
            const s = Number(t.sequence);
            if (s < currentSeq) {
              const allowed = [PaymentTermStatus.INVOICE_SUBMITTED, PaymentTermStatus.VERIFIED, PaymentTermStatus.PAID];
              if (!allowed.includes(t.status)) {
                mismatches.push({
                  code: MismatchCode.INVALID_SEQUENCE,
                  message: `Termin urutan ${currentSeq} (${paymentTerm.termName}) tidak dapat diverifikasi karena Termin urutan ${s} (${t.termName}) belum mencapai status INVOICE_SUBMITTED.`,
                });
                break;
              }
            }
          }
        }
      }
    }

    // 6. Cumulative Calculations & Cap Checks
    let cumulativeInvoicedAmount = 0;
    let cumulativeTermInvoicedAmount = 0;
    let cumulativePaidAmount = 0;

    if (invoice.paymentTermId) {
      let activeInvoices: Invoice[] = [];
      if (po?.invoices && Array.isArray(po.invoices)) {
        activeInvoices = po.invoices;
      } else if (po?.id && em && typeof em.find === 'function') {
        activeInvoices = (await em.find(Invoice, { where: { poId: po.id }, relations: ['payments'] })) || [];
      }
      let foundCurrent = false;

      for (const inv of activeInvoices) {
        if (inv.deletedAt || inv.status === 'CANCELLED' || inv.status === 'REJECTED' || inv.matchStatus === 'REJECTED') continue;
        const amt = Number(inv.totalAmount || 0);
        cumulativeInvoicedAmount += amt;

        if (Number(inv.paymentTermId) === Number(invoice.paymentTermId)) {
          cumulativeTermInvoicedAmount += amt;
        }
        if (Number(inv.id) === Number(invoice.id)) {
          foundCurrent = true;
        }
        if (inv.payments && inv.payments.length > 0) {
          for (const p of inv.payments) {
            if (!p.deletedAt) cumulativePaidAmount += Number(p.amount || 0);
          }
        }
      }

      if (!foundCurrent && invoicedAmount > 0) {
        cumulativeInvoicedAmount += invoicedAmount;
        cumulativeTermInvoicedAmount += invoicedAmount;
      }

      if (invoice.payments && invoice.payments.length > 0) {
        for (const p of invoice.payments) {
          if (!p.deletedAt && !activeInvoices.some(inv => inv.payments?.some(ip => ip.id === p.id))) {
            cumulativePaidAmount += Number(p.amount || 0);
          }
        }
      }

      // Cap checks
      const cumulativeInvoicedDec = this.toMoneyDec(cumulativeInvoicedAmount);
      const poTotalDec = this.toMoneyDec(poTotal);
      if (po && cumulativeInvoicedDec.greaterThan(poTotalDec)) {
        mismatches.push({
          code: MismatchCode.CUMULATIVE_AMOUNT_EXCEEDED_PO,
          message: 'Akumulasi nilai invoice melebihi total Purchase Order.',
        });
      }

      if (paymentTerm && termAmount !== undefined) {
        const termAmountDec = this.toMoneyDec(termAmount);
        const invoicedAmountDec = this.toMoneyDec(invoicedAmount);
        const cumulativeTermInvoicedDec = this.toMoneyDec(cumulativeTermInvoicedAmount);

        if (invoicedAmountDec.greaterThan(termAmountDec)) {
          mismatches.push({
            code: MismatchCode.AMOUNT_EXCEEDED_TERM,
            message: `Nominal invoice (Rp${invoicedAmountDec.toNumber().toLocaleString('id-ID')}) tidak sesuai dengan nominal termin (Rp${termAmountDec.toNumber().toLocaleString('id-ID')}).`,
          });
        } else if (cumulativeTermInvoicedDec.greaterThan(termAmountDec)) {
          mismatches.push({
            code: MismatchCode.AMOUNT_EXCEEDED_TERM,
            message: `Akumulasi invoice termin (Rp${cumulativeTermInvoicedDec.toNumber().toLocaleString('id-ID')}) melebihi nominal termin (Rp${termAmountDec.toNumber().toLocaleString('id-ID')}).`,
          });
        }

        const priorTermInvoicedDec = cumulativeTermInvoicedDec.minus(invoicedAmountDec);
        if (priorTermInvoicedDec.greaterThanOrEqualTo(termAmountDec) && invoicedAmountDec.greaterThan(0)) {
          mismatches.push({
            code: MismatchCode.TERM_ALREADY_INVOICED,
            message: 'Payment term sudah selesai ditagihkan seluruhnya.',
          });
        }

        remainingTermAmount = Decimal.max(0, termAmountDec.minus(cumulativeTermInvoicedDec)).toNumber();
      }
    } else {
      // Legacy full PO
      cumulativeInvoicedAmount = invoicedAmount;
      if (invoice.payments && invoice.payments.length > 0) {
        for (const p of invoice.payments) {
          if (!p.deletedAt) cumulativePaidAmount += Number(p.amount || 0);
        }
      }

      if (po) {
        if (!isServicePo) {
          const goodsReceipts = (await em.find(GoodsReceipt, {
            where: { poId: po.id },
            relations: ['items'],
          })) || [];

          let totalGrAmountDec = new Decimal(0);
          for (const gr of goodsReceipts) {
            for (const grItem of gr.items || []) {
              const matchedPoItem = po.items?.find(i => i.id === grItem.poItemId);
              if (matchedPoItem) {
                const grQty = this.toMoneyDec(grItem.receivedQuantity);
                const poPrice = this.toMoneyDec(matchedPoItem.unitPrice);
                const grLineTotal = grQty.times(poPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                totalGrAmountDec = totalGrAmountDec.plus(grLineTotal);
              }
            }
          }

          const invoicedAmountDec = this.toMoneyDec(invoicedAmount);
          const isMatched = invoicedAmountDec.equals(totalGrAmountDec);

          if (!isMatched) {
            mismatches.push({
              code: MismatchCode.THREE_WAY_MISMATCH,
              message: `3-Way Matching gagal: Nilai tagihan (Rp${invoicedAmountDec.toNumber().toLocaleString('id-ID')}) tidak sesuai dengan nilai penerimaan barang (Rp${totalGrAmountDec.toNumber().toLocaleString('id-ID')}).`,
            });
          }
        } else {
          const approvedClaimDec = serviceClaim ? this.toMoneyDec(serviceClaim.approvedClaimAmount) : new Decimal(0);
          const invoicedAmountDec = this.toMoneyDec(invoicedAmount);
          const isMatched = invoicedAmountDec.equals(approvedClaimDec);
          if (!isMatched) {
            mismatches.push({
              code: MismatchCode.THREE_WAY_MISMATCH,
              message: `Rekonsiliasi Jasa gagal: Nilai tagihan (Rp${invoicedAmountDec.toNumber().toLocaleString('id-ID')}) tidak sesuai dengan nilai klaim jasa yang disetujui (Rp${approvedClaimDec.toNumber().toLocaleString('id-ID')}).`,
            });
          }
        }
      }
    }

    const remainingPoAmount = Decimal.max(0, this.toMoneyDec(poTotal).minus(this.toMoneyDec(cumulativeInvoicedAmount))).toNumber();

    // 7. Duplicate invoice number check (Section I)
    if (invoice.invoiceNumber && em && typeof em.findOne === 'function') {
      const dup = await em.findOne(Invoice, {
        where: { invoiceNumber: invoice.invoiceNumber },
      });
      if (dup && Number(dup.id) !== Number(invoice.id) && !dup.deletedAt && dup.status !== 'CANCELLED') {
        mismatches.push({
          code: MismatchCode.OTHER,
          message: 'Nomor invoice sudah digunakan oleh invoice lain.',
        });
      }
    }

    // 8. Cumulative payment guard (Section G)
    const cumulativePaidDec = this.toMoneyDec(cumulativePaidAmount);
    const invoicedAmountDec = this.toMoneyDec(invoicedAmount);
    if (cumulativePaidDec.greaterThan(invoicedAmountDec)) {
      mismatches.push({
        code: MismatchCode.OTHER,
        message: 'Akumulasi pembayaran melebihi nilai invoice.',
      });
    }

    // 9. Determine Status
    let status: 'MATCHED' | 'MISMATCH' | 'VERIFIED' | 'REJECTED';
    if (invoice.matchStatus === 'VERIFIED') {
      status = 'VERIFIED';
    } else if (invoice.matchStatus === 'REJECTED') {
      status = 'REJECTED';
    } else if (mismatches.length > 0) {
      status = 'MISMATCH';
    } else {
      status = 'MATCHED';
    }

    return {
      invoiceId: invoice.id,
      poId: po ? po.id : invoice.poId,
      termId: paymentTerm ? paymentTerm.id : invoice.paymentTermId,
      status,
      poTotal,
      termPercentage,
      termAmount,
      invoicedAmount,
      remainingTermAmount,
      cumulativeInvoicedAmount,
      remainingPoAmount,
      cumulativePaidAmount,
      goodsReceiptId: grRefId ? Number(grRefId) : undefined,
      goodsReceiptNumber: grRefStr || undefined,
      mismatches,
    };
  }

  async getInvoiceMatchingData(
    invoiceId: number,
    claimedVendorId?: number,
    goodsReceiptId?: number,
    evidenceRef?: string,
  ): Promise<MatchingResult> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['purchaseOrder', 'purchaseOrder.items', 'purchaseOrder.vendor', 'purchaseOrder.paymentTerms', 'purchaseOrder.invoices', 'paymentTerm', 'items', 'payments', 'serviceClaim', 'serviceClaim.items'],
    });

    if (!invoice || invoice.deletedAt) {
      throw new BadRequestException('Invoice tidak ditemukan.');
    }

    const dto = {
      approved: true,
      vendorId: claimedVendorId !== undefined ? Number(claimedVendorId) : undefined,
      goodsReceiptId: goodsReceiptId !== undefined ? Number(goodsReceiptId) : undefined,
      evidenceRef: evidenceRef !== undefined ? evidenceRef.trim() : undefined,
      isPreview: true,
    } as any;
    return this.evaluateMatching(invoice, dto, this.invoiceRepository.manager);
  }

  async verifyInvoice(invoiceId: number, dto: VerifyInvoiceDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock invoice with pessimistic_write to prevent concurrent double-verification
      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: invoiceId },
        lock: { mode: 'pessimistic_write' },
        relations: [
          'purchaseOrder',
          'purchaseOrder.items',
          'purchaseOrder.vendor',
          'paymentTerm',
          'items',
          'payments',
          'serviceClaim',
          'serviceClaim.items',
          'invoiceTaxDetail',
          'ppnMasukanRecords',
          'pphWithholdingRecords',
        ],
      });

      if (!invoice || invoice.deletedAt) {
        throw new BadRequestException('Invoice tidak ditemukan.');
      }

      // Canonical EPMS Finance: Single Finance account handles invoice creation and verification.
      // Separation of Duties is enforced at Director Payment Request Approval boundary.


      const oldMatchStatus = invoice.matchStatus;
      const oldTermStatus = invoice.paymentTerm?.status;

      // Rejection branch if explicitly requested via dto.approved === false
      if (!dto.approved) {
        invoice.matchStatus = 'REJECTED';
        invoice.updatedBy = userId;
        const savedInvoice = await queryRunner.manager.save(Invoice, invoice);

        // Canonical AuditLog: Invoice REJECT
        const rejectAudit = queryRunner.manager.create(AuditLog, {
          table_name: 'invoices',
          record_id: invoice.id,
          action: 'REJECT',
          old_value: {
            matchStatus: oldMatchStatus,
          },
          new_value: {
            matchStatus: 'REJECTED',
            notes: dto.notes ?? undefined,
          },
          created_by: userId ? Number(userId) : null,
        });
        await queryRunner.manager.save(AuditLog, rejectAudit);

        // Canonical Outbox: finance.invoice.rejected
        const rejectEvent: BusinessEvent<{
          invoiceId: number;
          invoiceNumber: string;
          poId: number;
          paymentTermId?: number | null;
          totalAmount: number;
          rejectedBy: number;
          notes?: string;
          status: string;
        }> = {
          eventId: randomUUID(),
          eventName: 'finance.invoice.rejected',
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          aggregateType: 'Invoice',
          aggregateId: invoice.id,
          projectId: undefined,
          actor: userId ? { userId: Number(userId) } : undefined,
          routing: invoice.createdBy ? { userIds: [Number(invoice.createdBy)] } : undefined,
          notificationPolicy: undefined,
          payload: {
            invoiceId: Number(invoice.id),
            invoiceNumber: invoice.invoiceNumber,
            poId: Number(invoice.poId),
            paymentTermId: invoice.paymentTermId ? Number(invoice.paymentTermId) : null,
            totalAmount: Number(invoice.totalAmount),
            rejectedBy: Number(userId),
            notes: dto.notes,
            status: 'REJECTED',
          },
        };

        const rejectOutbox = queryRunner.manager.create(OutboxEvent, {
          event_id: rejectEvent.eventId,
          event_name: rejectEvent.eventName,
          event_version: String(rejectEvent.eventVersion),
          aggregate_type: rejectEvent.aggregateType,
          aggregate_id: Number(rejectEvent.aggregateId),
          correlation_id: rejectEvent.correlationId || null,
          payload: {
            occurredAt: rejectEvent.occurredAt,
            projectId: rejectEvent.projectId,
            actor: rejectEvent.actor,
            routing: rejectEvent.routing,
            notificationPolicy: rejectEvent.notificationPolicy,
            businessPayload: rejectEvent.payload,
          },
          status: OutboxStatus.PENDING,
          retry_count: 0,
        });
        await queryRunner.manager.save(OutboxEvent, rejectOutbox);

        await queryRunner.commitTransaction();

        const matchingResult = await this.evaluateMatching(invoice, dto, queryRunner.manager);
        matchingResult.status = 'REJECTED';

        return {
          ...savedInvoice,
          matchingResult,
        };
      }

      // Lock payment term if present
      let lockedPaymentTerm: PoPaymentTerm | null = null;
      if (invoice.paymentTermId) {
        lockedPaymentTerm = await queryRunner.manager.findOne(PoPaymentTerm, {
          where: { id: invoice.paymentTermId },
          lock: { mode: 'pessimistic_write' },
        });
        if (lockedPaymentTerm) {
          invoice.paymentTerm = lockedPaymentTerm;
        }
      }

      // 1.b Authoritative Finance Verification Gate: Mandatory Tax Administration Field Completeness
      const taxValidationErrors: string[] = [];

      const itd = invoice.invoiceTaxDetail;
      const ppnRecords = invoice.ppnMasukanRecords;
      const pphRecords = invoice.pphWithholdingRecords;

      const snapshot = itd?.taxRuleSnapshot;
      const firstPpn = ppnRecords?.[0];
      const firstPph = pphRecords?.[0];

      // Determine whether PPN applies (recorded PPN amount > 0 or PPN rate > 0)
      const ppnAmountVal = Number(itd?.ppnAmount ?? snapshot?.ppn?.ppnAmount ?? firstPpn?.ppnAmount ?? 0);
      const ppnRateVal = Number(snapshot?.ppn?.ppnRate ?? (itd?.ppnRate != null ? Number(itd.ppnRate) * 100 : 0));
      const isPpnApplicable = ppnAmountVal > 0 || ppnRateVal > 0;

      // Determine whether PPh withholding applies (withholding amount > 0 or PPh rate > 0)
      const pphAmountVal = Number(itd?.pphWithholdingAmount ?? snapshot?.pph?.withheldAmount ?? firstPph?.withheldAmount ?? 0);
      const pphRateVal = Number(snapshot?.pph?.rate ?? (firstPph?.withholdingRate != null ? (Number(firstPph.withholdingRate) <= 1 ? Number(firstPph.withholdingRate) * 100 : Number(firstPph.withholdingRate)) : 0));
      const isPphApplicable = pphAmountVal > 0 || pphRateVal > 0;

      if (isPpnApplicable) {
        // NSFP validation: mandatory, exactly 16 numeric digits
        const rawNsfp = snapshot?.ppn?.fakturPajakNumber || snapshot?.fakturPajakNumber || firstPpn?.fakturPajakNumber || (itd as any)?.fakturPajakNumber;
        if (!rawNsfp || !String(rawNsfp).trim()) {
          taxValidationErrors.push('Nomor Faktur Pajak (NSFP) wajib diisi.');
        } else {
          const cleanNsfp = String(rawNsfp).trim().replace(/[\.\-]/g, '');
          if (!/^[0-9]{16}$/.test(cleanNsfp)) {
            taxValidationErrors.push('Nomor Faktur Pajak (NSFP) harus terdiri dari 16 digit angka.');
          }
        }

        // Tanggal Faktur Pajak validation: mandatory, valid date
        const rawFpDate = snapshot?.ppn?.fakturPajakDate || (!snapshot ? firstPpn?.fakturPajakDate : undefined) || (itd as any)?.fakturPajakDate;
        if (!rawFpDate || !String(rawFpDate).trim()) {
          taxValidationErrors.push('Tanggal Faktur Pajak wajib diisi.');
        } else {
          const parsedFpDate = new Date(rawFpDate);
          if (isNaN(parsedFpDate.getTime())) {
            taxValidationErrors.push('Tanggal Faktur Pajak tidak valid.');
          }
        }
      }

      if (isPphApplicable) {
        // Bukti Potong Number validation: mandatory, non-empty
        const rawBpNum = snapshot?.pph?.buktiPotongNumber || snapshot?.buktiPotongNumber || (!snapshot ? firstPph?.buktiPotongNumber : undefined) || (itd as any)?.buktiPotongNumber;
        if (!rawBpNum || !String(rawBpNum).trim()) {
          taxValidationErrors.push('Nomor Bukti Potong wajib diisi.');
        }

        // Tanggal Bukti Potong validation: mandatory, valid date
        const rawBpDate = snapshot?.pph?.buktiPotongDate || (!snapshot ? firstPph?.buktiPotongDate : undefined) || (itd as any)?.buktiPotongDate;
        if (!rawBpDate || !String(rawBpDate).trim()) {
          taxValidationErrors.push('Tanggal Bukti Potong wajib diisi.');
        } else {
          const parsedBpDate = new Date(rawBpDate);
          if (isNaN(parsedBpDate.getTime())) {
            taxValidationErrors.push('Tanggal Bukti Potong tidak valid.');
          }
        }
      }

      if (taxValidationErrors.length > 0) {
        const primaryMessage = `Lengkapi administrasi perpajakan sebelum melakukan Verifikasi Invoice: ${taxValidationErrors.join(' ')}`;
        throw new BadRequestException({
          message: primaryMessage,
          errors: taxValidationErrors,
          code: 'TAX_ADMIN_INCOMPLETE',
        });
      }

      // 2. Run authoritative matching engine
      const matchingResult = await this.evaluateMatching(invoice, dto, queryRunner.manager);

      // 3. If any mismatches found, reject and throw structured exception
      if (matchingResult.mismatches.length > 0) {
        // If legacy 3-way mismatch, update invoice to MISMATCHED and emit event before throwing
        if (matchingResult.mismatches.some(m => m.code === MismatchCode.THREE_WAY_MISMATCH)) {
          invoice.matchStatus = 'MISMATCHED';
          invoice.updatedBy = userId;
          await queryRunner.manager.save(Invoice, invoice);

          // Canonical AuditLog: Invoice MISMATCH
          const mismatchAudit = queryRunner.manager.create(AuditLog, {
            table_name: 'invoices',
            record_id: invoice.id,
            action: 'MISMATCH',
            old_value: {
              matchStatus: oldMatchStatus,
            },
            new_value: {
              matchStatus: 'MISMATCHED',
              mismatches: matchingResult.mismatches,
              totalInvoice: Number(invoice.totalAmount),
              totalPO: matchingResult.poTotal,
            },
            created_by: userId ? Number(userId) : null,
          });
          await queryRunner.manager.save(AuditLog, mismatchAudit);

          await queryRunner.commitTransaction();

          this.eventEmitter.emit('finance.mismatch', {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            poId: invoice.poId,
            totalInvoice: Number(invoice.totalAmount),
            totalPO: matchingResult.poTotal,
            totalGR: 0,
            createdAt: new Date().toISOString(),
          });
        }

        const primaryMessage = matchingResult.mismatches[0].message;
        throw new BadRequestException({
          message: primaryMessage,
          mismatches: matchingResult.mismatches,
          matchingResult,
        });
      }

      // 4. Verification succeeds: update invoice and term
      invoice.matchStatus = 'VERIFIED';
      invoice.updatedBy = userId;
      const savedInvoice = await queryRunner.manager.save(Invoice, invoice);

      if (lockedPaymentTerm) {
        lockedPaymentTerm.status = PaymentTermStatus.VERIFIED;
        lockedPaymentTerm.updatedBy = userId;
        await queryRunner.manager.save(PoPaymentTerm, lockedPaymentTerm);
      }

      // Canonical AuditLog: Invoice VERIFY (Approved)
      const verifyAudit = queryRunner.manager.create(AuditLog, {
        table_name: 'invoices',
        record_id: invoice.id,
        action: 'VERIFY',
        old_value: {
          matchStatus: oldMatchStatus,
          paymentTermId: lockedPaymentTerm?.id ?? invoice.paymentTermId ?? undefined,
          paymentTermStatus: oldTermStatus ?? undefined,
        },
        new_value: {
          matchStatus: 'VERIFIED',
          paymentTermId: lockedPaymentTerm?.id ?? invoice.paymentTermId ?? undefined,
          paymentTermStatus: lockedPaymentTerm ? lockedPaymentTerm.status : undefined,
          totalAmount: Number(invoice.totalAmount),
          evidenceRef: dto.evidenceRef ?? undefined,
          notes: dto.notes ?? undefined,
        },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, verifyAudit);

      // Canonical Outbox: finance.invoice.verified
      const verifiedEvent: BusinessEvent<{
        invoiceId: number;
        invoiceNumber: string;
        poId: number;
        paymentTermId?: number | null;
        termName?: string | null;
        termType?: string | null;
        totalAmount: number;
        verifiedBy: number;
        evidenceRef?: string | null;
        notes?: string | null;
        status: string;
        createdBy?: number | null;
      }> = {
        eventId: randomUUID(),
        eventName: 'finance.invoice.verified',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Invoice',
        aggregateId: invoice.id,
        projectId: undefined,
        actor: userId ? { userId: Number(userId) } : undefined,
        routing: invoice.createdBy ? { userIds: [Number(invoice.createdBy)] } : undefined,
        notificationPolicy: undefined,
        payload: {
          invoiceId: Number(invoice.id),
          invoiceNumber: invoice.invoiceNumber,
          poId: Number(invoice.poId),
          paymentTermId: lockedPaymentTerm?.id ? Number(lockedPaymentTerm.id) : (invoice.paymentTermId ? Number(invoice.paymentTermId) : null),
          termName: lockedPaymentTerm?.termName || null,
          termType: lockedPaymentTerm?.termType || null,
          totalAmount: Number(invoice.totalAmount),
          verifiedBy: Number(userId),
          evidenceRef: dto.evidenceRef || null,
          notes: dto.notes || null,
          status: 'VERIFIED',
          createdBy: invoice.createdBy ? Number(invoice.createdBy) : null,
        },
      };

      const verifiedOutbox = queryRunner.manager.create(OutboxEvent, {
        event_id: verifiedEvent.eventId,
        event_name: verifiedEvent.eventName,
        event_version: String(verifiedEvent.eventVersion),
        aggregate_type: verifiedEvent.aggregateType,
        aggregate_id: Number(verifiedEvent.aggregateId),
        correlation_id: verifiedEvent.correlationId || null,
        payload: {
          occurredAt: verifiedEvent.occurredAt,
          projectId: verifiedEvent.projectId,
          actor: verifiedEvent.actor,
          routing: verifiedEvent.routing,
          notificationPolicy: verifiedEvent.notificationPolicy,
          businessPayload: verifiedEvent.payload,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, verifiedOutbox);

      await queryRunner.commitTransaction();

      matchingResult.status = 'VERIFIED';

      return {
        ...savedInvoice,
        paymentTerm: lockedPaymentTerm || invoice.paymentTerm,
        matchingResult,
      };
    } catch (err: any) {
      try {
        if (queryRunner.isTransactionActive !== false) {
          await queryRunner.rollbackTransaction();
        }
      } catch (_) { }
      if (
        err instanceof OptimisticLockVersionMismatchError ||
        err.name === 'OptimisticLockVersionMismatchError' ||
        err.message?.includes('OptimisticLockVersionMismatchError')
      ) {
        throw new ConflictException('Data invoice telah berubah atau sedang diproses oleh pengguna lain. Silakan refresh halaman.');
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process and persist optional PPN Masukan and PPh Withholding administrative records.
   * Keeps invoice gross total and contract amounts 100% immutable while recording tax data.
   */
  private async processAndPersistInvoiceTax(
    manager: EntityManager,
    invoice: Invoice,
    po: PurchaseOrder,
    taxDto: CreateInvoiceTaxDto,
    userId: number,
  ) {
    const now = new Date();
    const companyCode = invoice.companyCode || po.companyCode || (po.purchaseRequest?.project as any)?.companyCode || 'UBD';
    let totalDpp = new Decimal(0);
    let totalPpn = new Decimal(0);
    let totalPph = new Decimal(0);
    let hasTaxData = false;

    // 1. Process PPN Masukan
    if (
      taxDto.ppn &&
      (taxDto.ppn.fakturPajakNumber || taxDto.ppn.ppnAmount !== undefined || taxDto.ppn.dppAmount !== undefined || taxDto.ppn.ppnRate !== undefined)
    ) {
      hasTaxData = true;
      const dppDec = this.toMoneyDec(taxDto.ppn.dppAmount ?? invoice.totalAmount);
      const ppnDec = this.toMoneyDec(taxDto.ppn.ppnAmount ?? 0);
      totalDpp = dppDec;
      totalPpn = ppnDec;

      // Tanggal Faktur Pajak: validate and preserve original submitted date (never substitute current date)
      let fpDate: Date | null = null;
      if (taxDto.ppn.fakturPajakDate) {
        fpDate = new Date(taxDto.ppn.fakturPajakDate);
        if (isNaN(fpDate.getTime())) {
          throw new BadRequestException('Tanggal Faktur Pajak tidak valid.');
        }
      }
      const recordFpDate = fpDate || (invoice.invoiceDate ? new Date(invoice.invoiceDate) : now);
      const periodMonth = recordFpDate.getMonth() + 1;
      const periodYear = recordFpDate.getFullYear();

      // Finding 1 Remediation: Strict NSFP Data Integrity (no silent padding or fabrication)
      const rawFp = taxDto.ppn.fakturPajakNumber ? String(taxDto.ppn.fakturPajakNumber).trim() : '';
      if (!rawFp && taxDto.ppn.fakturPajakNumber !== undefined) {
        throw new BadRequestException(
          'Nomor Faktur Pajak (NSFP) wajib diisi untuk pencatatan administrasi PPN.',
        );
      }
      // Remove only supported formatting separators (dots and hyphens)
      const nsfp = rawFp.replace(/[\.\-]/g, '');
      if (rawFp && !/^[0-9]{16}$/.test(nsfp)) {
        throw new BadRequestException(
          'Nomor Faktur Pajak (NSFP) tidak valid. NSFP harus terdiri dari tepat 16 digit angka (contoh: 010.000-26.12345678).',
        );
      }

      // Vendor NPWP 16 digits: do NOT substitute default fake NPWP (Correction Requirement 2)
      const vendorNpwpRaw = String((po.vendor as any)?.npwp || (po as any)?.vendor?.npwp || '').replace(/[^0-9]/g, '');
      const vendorTaxId = vendorNpwpRaw.length === 16 ? vendorNpwpRaw : 'UNVERIFIED';

      if (nsfp) {
        let existingPpn = await manager.findOne(PpnMasukanRecord, {
          where: { invoiceId: invoice.id },
        });
        if (!existingPpn) {
          existingPpn = manager.create(PpnMasukanRecord, {
            invoiceId: invoice.id,
            companyCode,
            vendorTaxId,
            fakturPajakNumber: nsfp,
            fakturPajakDate: recordFpDate,
            transactionCode: nsfp.length >= 2 ? nsfp.slice(0, 2) : '01',
            replacementCode: '0',
            dppAmount: dppDec.toNumber(),
            ppnAmount: ppnDec.toNumber(),
            creditabilityStatus: CreditabilityStatus.UNVERIFIED,
            reportingPeriodMonth: periodMonth,
            reportingPeriodYear: periodYear,
            sptMasaStatus: SptMasaStatus.UNREPORTED,
            validationStatus: vendorTaxId === 'UNVERIFIED' ? ValidationStatus.VENDOR_MISMATCH : ValidationStatus.VALID,
          });
        } else {
          existingPpn.companyCode = companyCode;
          existingPpn.vendorTaxId = vendorTaxId;
          existingPpn.fakturPajakNumber = nsfp;
          existingPpn.fakturPajakDate = recordFpDate;
          existingPpn.transactionCode = nsfp.length >= 2 ? nsfp.slice(0, 2) : '01';
          existingPpn.dppAmount = dppDec.toNumber();
          existingPpn.ppnAmount = ppnDec.toNumber();
          existingPpn.reportingPeriodMonth = periodMonth;
          existingPpn.reportingPeriodYear = periodYear;
          if (vendorTaxId === 'UNVERIFIED') {
            existingPpn.validationStatus = ValidationStatus.VENDOR_MISMATCH;
          }
        }
        await manager.save(PpnMasukanRecord, existingPpn);
      }
    }

    // 2. Process PPh Withholding (Administrative Recording)
    if (
      taxDto.pph &&
      (taxDto.pph.withheldAmount !== undefined || taxDto.pph.pphType || taxDto.pph.buktiPotongNumber)
    ) {
      hasTaxData = true;
      const pphBaseDec = this.toMoneyDec(
        taxDto.pph.taxableBase ?? (totalDpp.greaterThan(0) ? totalDpp.toNumber() : invoice.totalAmount),
      );
      const pphWithheldDec = this.toMoneyDec(taxDto.pph.withheldAmount ?? 0);
      const rateDec = new Decimal(taxDto.pph.rate ? taxDto.pph.rate / 100 : 0);
      totalPph = pphWithheldDec;

      // Tanggal Bukti Potong: validate and preserve original submitted date (never substitute current date)
      let bpDate: Date | null = null;
      if (taxDto.pph.buktiPotongDate) {
        bpDate = new Date(taxDto.pph.buktiPotongDate);
        if (isNaN(bpDate.getTime())) {
          throw new BadRequestException('Tanggal Bukti Potong tidak valid.');
        }
      }
      const recordBpDate = bpDate || (invoice.invoiceDate ? new Date(invoice.invoiceDate) : now);
      const rawBp = taxDto.pph.buktiPotongNumber ? String(taxDto.pph.buktiPotongNumber).trim() : '';

      const periodMonth = recordBpDate.getMonth() + 1;
      const periodYear = recordBpDate.getFullYear();
      const pphRegime = (taxDto.pph.pphType || 'PPH_23_SERVICE').toUpperCase().replace(/[^A-Z0-9_]/g, '_');

      // Check for existing reference rule and liability (Correction Requirement 1: DO NOT create or update them)
      const liability = await manager.findOne(StatutoryTaxLiability, {
        where: { companyCode, taxPeriodYear: periodYear, taxPeriodMonth: periodMonth, taxRegime: pphRegime },
      });

      const rule = await manager.findOne(TaxRegimeRule, {
        where: { regimeCode: pphRegime, taxCategory: TaxCategory.PPH },
      });

      if (liability && rule) {
        let existingPph = await manager.findOne(PphWithholdingRecord, {
          where: { invoiceId: invoice.id },
        });
        if (!existingPph) {
          existingPph = manager.create(PphWithholdingRecord, {
            invoiceId: invoice.id,
            taxRegimeRuleId: rule.id,
            pphTaxCategory: 'PPH',
            paymentTermId: invoice.paymentTermId ? Number(invoice.paymentTermId) : null,
            companyCode,
            vendorId: Number(po.vendorId || 1),
            pphRegime,
            taxPeriodMonth: periodMonth,
            taxPeriodYear: periodYear,
            statutoryTaxLiabilityId: liability.id,
            taxableBase: pphBaseDec.toNumber(),
            withholdingRate: rateDec.toNumber(),
            withheldAmount: pphWithheldDec.toNumber(),
            totalRemittedAmount: 0.0,
            outstandingWithheldAmount: pphWithheldDec.toNumber(),
            statutoryTriggerType: StatutoryTriggerType.DUE_DATE,
            statutoryTriggerDate: recordBpDate,
            recognitionStatus: RecognitionStatus.RECOGNIZED_UNREMITTED,
            buktiPotongNumber: rawBp || null,
            buktiPotongDate: recordBpDate,
          });
        } else {
          existingPph.taxRegimeRuleId = rule.id;
          existingPph.statutoryTaxLiabilityId = liability.id;
          existingPph.pphRegime = pphRegime;
          existingPph.taxableBase = pphBaseDec.toNumber();
          existingPph.withholdingRate = rateDec.toNumber();
          existingPph.withheldAmount = pphWithheldDec.toNumber();
          existingPph.outstandingWithheldAmount = pphWithheldDec.toNumber();
          existingPph.buktiPotongNumber = rawBp || existingPph.buktiPotongNumber;
          existingPph.buktiPotongDate = recordBpDate;
        }
        await manager.save(PphWithholdingRecord, existingPph);
      }
    }

    // 3. Persist InvoiceTaxDetail header snapshot
    if (hasTaxData) {
      if (totalDpp.equals(0)) {
        totalDpp = this.toMoneyDec(invoice.totalAmount);
      }
      const grossCommercialLiability = totalDpp.plus(totalPpn).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const netVendorCashPayable = grossCommercialLiability.minus(totalPph).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const ppnRateDec = taxDto.ppn?.ppnRate != null
        ? new Decimal(taxDto.ppn.ppnRate).dividedBy(100).toDecimalPlaces(4)
        : (totalDpp.greaterThan(0) ? totalPpn.dividedBy(totalDpp).toDecimalPlaces(4) : new Decimal(0));

      let invoiceTaxDetail = await manager.findOne(InvoiceTaxDetail, {
        where: { invoiceId: invoice.id },
      });
      if (!invoiceTaxDetail) {
        invoiceTaxDetail = manager.create(InvoiceTaxDetail, {
          invoiceId: invoice.id,
          companyCode,
          dppCommercial: totalDpp.toNumber(),
          ppnRate: ppnRateDec.toNumber(),
          ppnAmount: totalPpn.toNumber(),
          grossCommercialLiability: grossCommercialLiability.toNumber(),
          pphWithholdingAmount: totalPph.toNumber(),
          wapuPpnWithheldAmount: 0.0,
          priorDeductionsAmount: 0.0,
          netVendorCashPayable: netVendorCashPayable.toNumber(),
          statutoryTaxLiability: totalPph.toNumber(),
          calculationEngineVersion: 'EPMS-TAX-2B-ADMIN',
          taxRuleSnapshot: {
            recordedAt: now.toISOString(),
            recordedBy: userId,
            mode: 'ADMINISTRATIVE_RECORDING',
            fakturPajakNumber: taxDto.ppn?.fakturPajakNumber,
            buktiPotongNumber: taxDto.pph?.buktiPotongNumber,
            ppn: taxDto.ppn
              ? {
                fakturPajakNumber: taxDto.ppn.fakturPajakNumber,
                fakturPajakDate: taxDto.ppn.fakturPajakDate,
                dppAmount: taxDto.ppn.dppAmount,
                ppnRate: taxDto.ppn.ppnRate,
                ppnAmount: taxDto.ppn.ppnAmount,
              }
              : undefined,
            pph: taxDto.pph
              ? {
                pphType: taxDto.pph.pphType,
                rate: taxDto.pph.rate,
                taxableBase: taxDto.pph.taxableBase,
                withheldAmount: taxDto.pph.withheldAmount,
                buktiPotongNumber: taxDto.pph.buktiPotongNumber,
                buktiPotongDate: taxDto.pph.buktiPotongDate,
              }
              : undefined,
          },
        });
      } else {
        invoiceTaxDetail.companyCode = companyCode;
        invoiceTaxDetail.dppCommercial = totalDpp.toNumber();
        invoiceTaxDetail.ppnRate = ppnRateDec.toNumber();
        invoiceTaxDetail.ppnAmount = totalPpn.toNumber();
        invoiceTaxDetail.grossCommercialLiability = grossCommercialLiability.toNumber();
        invoiceTaxDetail.pphWithholdingAmount = totalPph.toNumber();
        invoiceTaxDetail.netVendorCashPayable = netVendorCashPayable.toNumber();
        invoiceTaxDetail.statutoryTaxLiability = totalPph.toNumber();
        invoiceTaxDetail.taxRuleSnapshot = {
          recordedAt: now.toISOString(),
          recordedBy: userId,
          mode: 'ADMINISTRATIVE_RECORDING',
          fakturPajakNumber: taxDto.ppn?.fakturPajakNumber,
          buktiPotongNumber: taxDto.pph?.buktiPotongNumber,
          ppn: taxDto.ppn
            ? {
              fakturPajakNumber: taxDto.ppn.fakturPajakNumber,
              fakturPajakDate: taxDto.ppn.fakturPajakDate,
              dppAmount: taxDto.ppn.dppAmount,
              ppnRate: taxDto.ppn.ppnRate,
              ppnAmount: taxDto.ppn.ppnAmount,
            }
            : undefined,
          pph: taxDto.pph
            ? {
              pphType: taxDto.pph.pphType,
              rate: taxDto.pph.rate,
              taxableBase: taxDto.pph.taxableBase,
              withheldAmount: taxDto.pph.withheldAmount,
              buktiPotongNumber: taxDto.pph.buktiPotongNumber,
              buktiPotongDate: taxDto.pph.buktiPotongDate,
            }
            : undefined,
        };
      }
      await manager.save(InvoiceTaxDetail, invoiceTaxDetail);
    }
  }

  /**
   * Update or complete tax administration records for an existing invoice.
   */
  async updateInvoiceTax(invoiceId: number, dto: CreateInvoiceTaxDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: invoiceId },
        relations: ['purchaseOrder', 'purchaseOrder.vendor', 'paymentTerm'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice #${invoiceId} tidak ditemukan`);
      }
      const po = invoice.purchaseOrder;
      if (!po) {
        throw new BadRequestException('PO terkait invoice tidak ditemukan');
      }

      // Mandatory Tax Administration Field Validation on Update
      if (dto.ppn && (dto.ppn.fakturPajakNumber !== undefined || dto.ppn.fakturPajakDate !== undefined || dto.ppn.ppnAmount !== undefined || dto.ppn.ppnRate !== undefined || dto.ppn.dppAmount !== undefined)) {
        const rawFp = dto.ppn.fakturPajakNumber ? String(dto.ppn.fakturPajakNumber).trim() : '';
        if (!rawFp) {
          throw new BadRequestException('Nomor Faktur Pajak (NSFP) wajib diisi.');
        }
        const cleanFp = rawFp.replace(/[\.\-]/g, '');
        if (!/^[0-9]{16}$/.test(cleanFp)) {
          throw new BadRequestException('Nomor Faktur Pajak (NSFP) harus terdiri dari 16 digit angka.');
        }
        if (!dto.ppn.fakturPajakDate || !String(dto.ppn.fakturPajakDate).trim()) {
          throw new BadRequestException('Tanggal Faktur Pajak wajib diisi.');
        }
        if (isNaN(new Date(dto.ppn.fakturPajakDate).getTime())) {
          throw new BadRequestException('Tanggal Faktur Pajak tidak valid.');
        }
      }

      if (dto.pph && (dto.pph.buktiPotongNumber !== undefined || dto.pph.buktiPotongDate !== undefined || dto.pph.withheldAmount !== undefined || dto.pph.rate !== undefined || dto.pph.pphType !== undefined || dto.pph.taxableBase !== undefined)) {
        const rawBp = dto.pph.buktiPotongNumber ? String(dto.pph.buktiPotongNumber).trim() : '';
        if (!rawBp) {
          throw new BadRequestException('Nomor Bukti Potong wajib diisi.');
        }
        if (!dto.pph.buktiPotongDate || !String(dto.pph.buktiPotongDate).trim()) {
          throw new BadRequestException('Tanggal Bukti Potong wajib diisi.');
        }
        if (isNaN(new Date(dto.pph.buktiPotongDate).getTime())) {
          throw new BadRequestException('Tanggal Bukti Potong tidak valid.');
        }
      }

      await this.processAndPersistInvoiceTax(queryRunner.manager, invoice, po, dto, userId);

      const audit = queryRunner.manager.create(AuditLog, {
        table_name: 'invoices',
        record_id: invoice.id,
        action: 'UPDATE_TAX',
        old_value: null,
        new_value: {
          taxUpdated: true,
          fakturPajakNumber: dto.ppn?.fakturPajakNumber,
          buktiPotongNumber: dto.pph?.buktiPotongNumber,
        },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, audit);

      await queryRunner.commitTransaction();
      return this.getInvoiceById(invoiceId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getInvoices() {
    return this.invoiceRepository.find({
      relations: [
        'items',
        'items.purchaseOrderItem',
        'items.purchaseOrderItem.costItem',
        'items.purchaseOrderItem.purchaseRequestItem',
        'purchaseOrder',
        'purchaseOrder.vendor',
        'purchaseOrder.purchaseRequest',
        'purchaseOrder.purchaseRequest.project',
        'paymentTerm',
        'invoiceTaxDetail',
      ],
    });
  }

  async getInvoiceById(id: number) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: [
        'items',
        'items.purchaseOrderItem',
        'items.purchaseOrderItem.costItem',
        'items.purchaseOrderItem.purchaseRequestItem',
        'purchaseOrder',
        'purchaseOrder.vendor',
        'purchaseOrder.purchaseRequest',
        'purchaseOrder.purchaseRequest.project',
        'paymentTerm',
        'payments',
        'invoiceTaxDetail',
      ],
    });
    if (!invoice) {
      throw new BadRequestException('Invoice tidak ditemukan');
    }
    return invoice;
  }

  async getInvoiceTaxDetails(invoiceId: number) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['invoiceTaxDetail', 'ppnMasukanRecords', 'pphWithholdingRecords'],
    });
    if (!invoice) {
      return null;
    }

    const itd = invoice.invoiceTaxDetail;
    const snapshotPpn = itd?.taxRuleSnapshot?.ppn;
    const snapshotPph = itd?.taxRuleSnapshot?.pph;
    const firstPpn = invoice.ppnMasukanRecords?.[0];
    const firstPph = invoice.pphWithholdingRecords?.[0];

    const dppAmount = Number(itd?.dppCommercial ?? firstPpn?.dppAmount ?? snapshotPpn?.dppAmount ?? invoice.totalAmount ?? 0);
    const ppnRate = Number(snapshotPpn?.ppnRate ?? (itd?.ppnRate != null ? Number(itd.ppnRate) * 100 : 0));
    const ppnAmount = Number(itd?.ppnAmount ?? firstPpn?.ppnAmount ?? snapshotPpn?.ppnAmount ?? 0);

    const pphType = snapshotPph?.pphType || firstPph?.pphRegime || null;
    const pphRate = Number(snapshotPph?.rate ?? (firstPph?.withholdingRate != null ? (Number(firstPph.withholdingRate) <= 1 ? Number(firstPph.withholdingRate) * 100 : Number(firstPph.withholdingRate)) : 0));
    const taxableBase = Number(snapshotPph?.taxableBase ?? firstPph?.taxableBase ?? itd?.dppCommercial ?? invoice.totalAmount ?? 0);
    const pphAmount = Number(itd?.pphWithholdingAmount ?? snapshotPph?.withheldAmount ?? firstPph?.withheldAmount ?? 0);

    const grossCommercialLiability = Number(itd?.grossCommercialLiability ?? (dppAmount + ppnAmount));
    const netVendorCashPayable = Number(itd?.netVendorCashPayable ?? Math.max(0, grossCommercialLiability - pphAmount));

    const fakturPajakNumber = firstPpn?.fakturPajakNumber || snapshotPpn?.fakturPajakNumber || itd?.taxRuleSnapshot?.fakturPajakNumber || '';
    const fakturPajakDate = firstPpn?.fakturPajakDate ? (typeof firstPpn.fakturPajakDate === 'string' ? firstPpn.fakturPajakDate.split('T')[0] : new Date(firstPpn.fakturPajakDate).toISOString().split('T')[0]) : (snapshotPpn?.fakturPajakDate || '');
    const buktiPotongNumber = firstPph?.buktiPotongNumber || snapshotPph?.buktiPotongNumber || itd?.taxRuleSnapshot?.buktiPotongNumber || '';
    const buktiPotongDate = firstPph?.buktiPotongDate ? (typeof firstPph.buktiPotongDate === 'string' ? firstPph.buktiPotongDate.split('T')[0] : new Date(firstPph.buktiPotongDate).toISOString().split('T')[0]) : (snapshotPph?.buktiPotongDate || '');

    const taxDetail = (itd || snapshotPpn || snapshotPph || firstPpn || firstPph) ? {
      id: itd?.id ? Number(itd.id) : 0,
      invoiceId: invoice.id,
      companyCode: itd?.companyCode || invoice.companyCode || 'UBD',
      taxBasis: dppAmount,
      dppCommercial: dppAmount,
      ppnRate,
      ppnAmount,
      pphRate,
      pphAmount,
      pphType: pphType || undefined,
      settlementNetExpected: netVendorCashPayable,
      grossCommercialLiability,
      netVendorCashPayable,
      fakturPajakNumber: fakturPajakNumber || undefined,
      fakturPajakDate: fakturPajakDate || undefined,
      buktiPotongNumber: buktiPotongNumber || undefined,
      buktiPotongDate: buktiPotongDate || undefined,
      taxRuleSnapshot: itd?.taxRuleSnapshot || undefined,
    } : null;

    const ppnRecords = (invoice.ppnMasukanRecords && invoice.ppnMasukanRecords.length > 0)
      ? invoice.ppnMasukanRecords.map(pmr => ({
        id: Number(pmr.id),
        invoiceId: Number(pmr.invoiceId),
        fakturPajakNumber: pmr.fakturPajakNumber,
        fakturPajakDate: pmr.fakturPajakDate ? String(pmr.fakturPajakDate).split('T')[0] : '',
        taxRate: ppnRate,
        dppAmount: Number(pmr.dppAmount),
        ppnAmount: Number(pmr.ppnAmount),
        creditableStatus: pmr.creditabilityStatus,
        creditabilityStatus: pmr.creditabilityStatus,
      }))
      : (snapshotPpn ? [{
        id: 0,
        invoiceId: invoice.id,
        fakturPajakNumber: snapshotPpn.fakturPajakNumber || '',
        fakturPajakDate: snapshotPpn.fakturPajakDate ? String(snapshotPpn.fakturPajakDate).split('T')[0] : '',
        taxRate: Number(snapshotPpn.ppnRate ?? ppnRate),
        dppAmount: Number(snapshotPpn.dppAmount ?? dppAmount),
        ppnAmount: Number(snapshotPpn.ppnAmount ?? ppnAmount),
        creditableStatus: 'TERCATAT',
        creditabilityStatus: 'TERCATAT',
      }] : []);

    const pphRecords = (invoice.pphWithholdingRecords && invoice.pphWithholdingRecords.length > 0)
      ? invoice.pphWithholdingRecords.map(pwr => ({
        id: Number(pwr.id),
        invoiceId: Number(pwr.invoiceId),
        buktiPotongNumber: pwr.buktiPotongNumber || '',
        buktiPotongDate: pwr.buktiPotongDate ? String(pwr.buktiPotongDate).split('T')[0] : '',
        pphRegime: pwr.pphRegime,
        withholdingRate: Number(pwr.withholdingRate) <= 1 ? Number(pwr.withholdingRate) * 100 : Number(pwr.withholdingRate),
        taxableBase: Number(pwr.taxableBase),
        withheldAmount: Number(pwr.withheldAmount),
        withholdingStatus: pwr.recognitionStatus || 'TERCATAT',
      }))
      : (snapshotPph ? [{
        id: 0,
        invoiceId: invoice.id,
        buktiPotongNumber: snapshotPph.buktiPotongNumber || '',
        buktiPotongDate: snapshotPph.buktiPotongDate ? String(snapshotPph.buktiPotongDate).split('T')[0] : '',
        pphRegime: snapshotPph.pphType || '',
        withholdingRate: Number(snapshotPph.rate ?? pphRate),
        taxableBase: Number(snapshotPph.taxableBase ?? taxableBase),
        withheldAmount: Number(snapshotPph.withheldAmount ?? pphAmount),
        withholdingStatus: 'TERCATAT',
      }] : []);

    return {
      ...invoice,
      taxDetail,
      ppnRecords,
      pphRecords,
    };
  }

  async getPayments() {
    return this.paymentRepository.find({
      relations: [
        'invoice',
        'invoice.purchaseOrder',
        'invoice.purchaseOrder.vendor',
        'invoice.purchaseOrder.purchaseRequest',
        'invoice.purchaseOrder.purchaseRequest.project',
        'companyBankAccount',
      ],
      order: { id: 'DESC' },
    });
  }

  /**
   * Get Authoritative Read-Only PO Payment Summary
   * Computes total PO amount, cumulative active payments across PO invoices, outstanding, and paid percentage.
   */
  async getPoPaymentSummary(poId: number): Promise<{
    poId: number;
    poTotal: number;
    totalPaid: number;
    outstanding: number;
    paidPercentage: number;
  }> {
    const po = await this.poRepository.findOne({
      where: { id: poId },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID ${poId} not found`);
    }

    const poTotal = Number(po.totalAmount || 0);

    const invoices = (await this.invoiceRepository.find({
      where: { poId: po.id },
    })) || [];

    const invoiceIds = invoices.map((i) => i.id);
    let totalPaid = 0;

    if (invoiceIds.length > 0) {
      const payments = (await this.paymentRepository.find({
        where: { invoiceId: In(invoiceIds) },
      })) || [];

      for (const p of payments) {
        if (!p.deletedAt) {
          totalPaid += Number(p.amount);
        }
      }
    }

    totalPaid = Math.round(totalPaid * 100) / 100;
    const outstanding = Math.round(Math.max(0, poTotal - totalPaid) * 100) / 100;
    const paidPercentage = poTotal > 0 ? Math.round((totalPaid / poTotal) * 10000) / 100 : 0;

    return {
      poId: po.id,
      poTotal,
      totalPaid,
      outstanding,
      paidPercentage,
    };
  }

  /**
   * Submit a new Payment Request for Director Approval (Finance only)
   */
  async submitPaymentRequest(dto: SubmitPaymentRequestDto, userId: number): Promise<PaymentRequest> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock invoice with pessimistic_write
      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: dto.invoiceId },
        relations: ['purchaseOrder', 'purchaseOrder.vendor', 'paymentTerm', 'invoiceTaxDetail'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice || invoice.deletedAt) {
        throw new NotFoundException(`Invoice #${dto.invoiceId} tidak ditemukan.`);
      }

      // 2. 3-Way Match & Verification Check (VERIFIED or MATCHED required)
      if (invoice.matchStatus !== 'VERIFIED' && invoice.matchStatus !== 'MATCHED') {
        throw new BadRequestException(
          `Invoice belum lolos verifikasi 3-Way Match (status: ${invoice.matchStatus || 'PENDING'}). Hanya invoice VERIFIED atau MATCHED yang dapat diajukan pembayarannya.`,
        );
      }

      // 3. Payment Status Check
      if (invoice.paymentStatus === 'PAID') {
        throw new BadRequestException('Invoice sudah lunas (PAID). Tidak dapat mengajukan pembayaran lagi.');
      }

      // 4. Duplicate Active Payment Request Protection
      const activeRequest = await queryRunner.manager.findOne(PaymentRequest, {
        where: {
          invoiceId: invoice.id,
          status: In([
            PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
            PaymentRequestStatus.NEEDS_REVISION,
            PaymentRequestStatus.APPROVED_FOR_PAYMENT,
          ]),
        },
      });

      if (activeRequest) {
        throw new BadRequestException(
          `Terdapat pengajuan pembayaran yang masih aktif (${activeRequest.requestNumber}, status: ${activeRequest.status}) untuk invoice ini.`,
        );
      }

      // 4.b Validate Payment Term Identity & PO Ownership (Invariant 1)
      const termId = invoice.paymentTermId
        ? Number(invoice.paymentTermId)
        : (dto.paymentTermId ? Number(dto.paymentTermId) : null);

      if (dto.paymentTermId && invoice.paymentTermId && Number(dto.paymentTermId) !== Number(invoice.paymentTermId)) {
        throw new BadRequestException('Payment term pengajuan pembayaran tidak sesuai dengan payment term pada invoice.');
      }

      let termEntity = invoice.paymentTerm;
      if (!termEntity && termId) {
        termEntity = await queryRunner.manager.findOne(PoPaymentTerm, { where: { id: termId } });
      }

      if (termId && !termEntity) {
        throw new BadRequestException('Payment term tidak ditemukan.');
      }

      if (termEntity && termEntity.poId && invoice.poId && Number(termEntity.poId) !== Number(invoice.poId)) {
        throw new BadRequestException('Payment term bukan milik Purchase Order dari invoice ini.');
      }

      // 5. Calculate authoritative tax and settlement liability
      let itd = invoice.invoiceTaxDetail;
      if (!itd) {
        try {
          itd = await queryRunner.manager.findOne(InvoiceTaxDetail, {
            where: { invoiceId: invoice.id },
          });
          if (itd) {
            invoice.invoiceTaxDetail = itd;
          }
        } catch (e) { }
      }

      const totalAmountDec = this.toMoneyDec(invoice.totalAmount);
      const dppCommercialDec = itd?.dppCommercial != null ? this.toMoneyDec(itd.dppCommercial) : totalAmountDec;
      const ppnAmountDec = this.toMoneyDec(itd?.ppnAmount || 0);

      // Gross commercial liability: L_comm = DPP + PPN
      const effectiveGrossLiabilityDec = itd?.grossCommercialLiability != null
        ? this.toMoneyDec(itd.grossCommercialLiability)
        : dppCommercialDec.plus(ppnAmountDec);

      // Statutory deductions and non-cash settlement credits: W_tax (PPh), W_wapu (WAPU), P_ded (Prior deductions)
      const wTaxDec = this.toMoneyDec(itd?.pphWithholdingAmount || 0);
      const wWapuDec = this.toMoneyDec(itd?.wapuPpnWithheldAmount || 0);
      const pDedDec = this.toMoneyDec(itd?.priorDeductionsAmount || 0);
      const totalNonCashCreditsDec = wTaxDec.plus(wWapuDec).plus(pDedDec);

      // Authoritative Net Vendor Cash Payable: D_cash = L_comm - W_tax - W_wapu - P_ded
      const authoritativeNetPayableDec = itd?.netVendorCashPayable != null
        ? this.toMoneyDec(itd.netVendorCashPayable)
        : Decimal.max(0, effectiveGrossLiabilityDec.minus(totalNonCashCreditsDec));

      // Calculate existing disbursed cash payments
      const existingPayments = await queryRunner.manager.find(Payment, {
        where: { invoiceId: invoice.id },
      });
      let alreadyPaidDec = new Decimal(0);
      for (const p of existingPayments) {
        if (!p.deletedAt) {
          alreadyPaidDec = alreadyPaidDec.plus(this.toMoneyDec(p.amount));
        }
      }

      // Remaining net vendor cash payable: D_cash_remaining = D_cash - cashAlreadyPaid
      const remainingNetPayableDec = Decimal.max(0, authoritativeNetPayableDec.minus(alreadyPaidDec));
      const remainingNetPayable = remainingNetPayableDec.toNumber();

      const effectiveGrossLiability = effectiveGrossLiabilityDec.toNumber();
      const authoritativeNetPayable = authoritativeNetPayableDec.toNumber();
      const alreadyPaid = alreadyPaidDec.toNumber();
      const totalAmount = totalAmountDec.toNumber();

      // 6. Validate requested amount
      const defaultPayableDec = remainingNetPayableDec;
      const requestedAmountDec =
        dto.requestedAmount !== undefined && dto.requestedAmount !== null
          ? this.toMoneyDec(dto.requestedAmount)
          : defaultPayableDec;
      const requestedAmount = requestedAmountDec.toNumber();

      if (requestedAmountDec.lessThanOrEqualTo(0)) {
        throw new BadRequestException('Jumlah yang diajukan harus lebih besar dari 0.');
      }

      // Backend independent validation: Request cannot exceed remaining net cash payable
      if (requestedAmountDec.greaterThan(remainingNetPayableDec)) {
        throw new BadRequestException(
          `Jumlah yang diajukan (Rp ${requestedAmount.toLocaleString('id-ID')}) melebihi sisa kas bersih yang dapat dibayarkan ke vendor (Rp ${remainingNetPayable.toLocaleString('id-ID')}).`,
        );
      }

      // Invariant 2 & Procurement Schedule Integrity:
      if (termEntity) {
        // A payment term cannot be split into unauthorized residual Payment Requests after an earlier underpayment
        if (alreadyPaidDec.greaterThan(0)) {
          throw new BadRequestException(
            `Invoice termin ini telah memiliki pembayaran sebelumnya (Rp ${alreadyPaid.toLocaleString('id-ID')}). Termin pembayaran Procurement tidak dapat dipecah menjadi cicilan tambahan tanpa amandemen PO Procurement.`,
          );
        }

        const authorizedTermAmountDec = this.toMoneyDec(termEntity.amount);
        const authorizedGrossAmountDec = effectiveGrossLiabilityDec;
        const expectedNetCashDec = authoritativeNetPayableDec;

        // When statutory withholding applies (PPh / WAPU / deductions > 0):
        // Cash request MUST match net vendor cash payable (D_cash), because withholding is remitted to state treasury
        if (totalNonCashCreditsDec.greaterThan(0)) {
          if (!requestedAmountDec.equals(expectedNetCashDec)) {
            throw new BadRequestException(
              `Nominal pengajuan pembayaran (Rp ${requestedAmount.toLocaleString('id-ID')}) tidak sesuai dengan estimasi kas bersih vendor (Rp ${expectedNetCashDec.toNumber().toLocaleString('id-ID')}) setelah pemotongan pajak (PPh/WAPU: Rp ${totalNonCashCreditsDec.toNumber().toLocaleString('id-ID')}). Pengajuan kas kotor tanpa pemotongan pajak tidak diizinkan.`,
            );
          }
        } else {
          // When no withholding applies (no tax, or PPN only where vendor receives full gross liability):
          // requested amount must match authorized commercial term amount or gross liability
          const isTermMatch = requestedAmountDec.equals(authorizedTermAmountDec);
          const isGrossMatch = requestedAmountDec.equals(authorizedGrossAmountDec);
          if (!isTermMatch && !isGrossMatch) {
            throw new BadRequestException(
              `Nominal pengajuan pembayaran (Rp ${requestedAmount.toLocaleString('id-ID')}) tidak sesuai dengan nilai termin pembayaran Procurement (Rp ${authorizedTermAmountDec.toNumber().toLocaleString('id-ID')}). Pengajuan sebagian di luar termin tidak diizinkan.`,
            );
          }
        }
      }

      // 7. Generate PRQ Number: PRQ-YYYYMMDD-XXX
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}${m}${d}`;

      const countToday = await queryRunner.manager
        .createQueryBuilder(PaymentRequest, 'prq')
        .where('prq.requestNumber LIKE :pattern', { pattern: `PRQ-${todayStr}-%` })
        .getCount();
      const seq = String(countToday + 1).padStart(3, '0');
      const requestNumber = `PRQ-${todayStr}-${seq}`;

      // 8. Snapshot with transparent tax breakdown
      const po = invoice.purchaseOrder;
      const vendor = po?.vendor;
      const paymentTerm = invoice.paymentTerm;

      let gr: GoodsReceipt | null = null;
      if (invoice.poId) {
        gr = await queryRunner.manager.findOne(GoodsReceipt, {
          where: { poId: invoice.poId },
          order: { id: 'DESC' },
        });
      }

      let sc: ServiceClaim | null = null;
      if (invoice.serviceClaimId) {
        try {
          sc = await queryRunner.manager.findOne(ServiceClaim, {
            where: { id: invoice.serviceClaimId },
          });
        } catch (e) { }
      }

      let verifierUser: User | null = null;
      if (invoice.updatedBy) {
        try {
          verifierUser = await queryRunner.manager.findOne(User, {
            where: { id: invoice.updatedBy },
          });
        } catch (e) { }
      }

      const snapTax = itd?.taxRuleSnapshot || {};
      const ppnRateNum = itd?.ppnRate
        ? (Number(itd.ppnRate) <= 1 ? Number(itd.ppnRate) * 100 : Number(itd.ppnRate))
        : (ppnAmountDec.greaterThan(0) ? 11 : null);
      const pphRateNum = (itd as any)?.pphRate
        ? Number((itd as any).pphRate)
        : (snapTax?.pph?.rate ? Number(snapTax.pph.rate) : null);
      const pphTypeStr = (itd as any)?.pphType || snapTax?.pph?.pphType || (wTaxDec.greaterThan(0) ? 'PPh' : null);
      const fakturPajakNumber = (itd as any)?.fakturPajakNumber || snapTax?.ppn?.fakturPajakNumber || snapTax?.fakturPajakNumber || null;
      const fakturPajakDate = (itd as any)?.fakturPajakDate || snapTax?.ppn?.fakturPajakDate || null;
      const buktiPotongNumber = (itd as any)?.buktiPotongNumber || snapTax?.pph?.buktiPotongNumber || snapTax?.buktiPotongNumber || null;
      const buktiPotongDate = (itd as any)?.buktiPotongDate || snapTax?.pph?.buktiPotongDate || null;
      const projectName = (po?.purchaseRequest as any)?.project?.name || null;

      const snapshot: ApprovalSnapshot = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceAmount: totalAmount,
        invoiceVersion: invoice.version || 1,
        invoiceUpdatedAt: invoice.updatedAt ? invoice.updatedAt.toISOString() : undefined,
        paymentTermId: termId,
        paymentTermName: termEntity?.termName || paymentTerm?.termName || null,
        requestedAmount: requestedAmount,
        dppAmount: dppCommercialDec.toNumber(),
        ppnAmount: ppnAmountDec.toNumber(),
        ppnRate: ppnRateNum,
        grossAmount: effectiveGrossLiabilityDec.toNumber(),
        pphAmount: wTaxDec.toNumber(),
        pphType: pphTypeStr,
        pphRate: pphRateNum,
        wapuAmount: wWapuDec.toNumber(),
        priorDeductionsAmount: pDedDec.toNumber(),
        netPayableAmount: authoritativeNetPayableDec.toNumber(),
        fakturPajakNumber,
        fakturPajakDate,
        buktiPotongNumber,
        buktiPotongDate,
        vendorId: vendor?.id ? Number(vendor.id) : null,
        vendorName: vendor?.name || null,
        vendorBankAccount: dto.bankAccountNumber || null,
        vendorBankName: dto.bankName || null,
        vendorBankAccountHolder: dto.bankAccountHolder || null,
        goodsReceiptId: gr?.id ? Number(gr.id) : null,
        goodsReceiptNumber: gr?.grNumber || null,
        serviceClaimId: sc?.id ? Number(sc.id) : null,
        serviceClaimNumber: sc?.claimNumber || null,
        poId: po?.id ? Number(po.id) : null,
        poNumber: po?.poNumber || null,
        projectName,
        matchStatus: invoice.matchStatus || null,
        verifiedBy: invoice.updatedBy || null,
        verifiedByName: verifierUser?.fullName || null,
        verifiedAt: invoice.updatedAt ? invoice.updatedAt.toISOString() : undefined,
        timestamp: new Date().toISOString(),
      };

      // 9. Save PaymentRequest
      const prq = queryRunner.manager.create(PaymentRequest, {
        requestNumber,
        invoiceId: invoice.id,
        paymentTermId: termId,
        requestedAmount,
        status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
        requestedBy: userId,
        submittedAt: new Date(),
        notes: dto.notes || null,
        approvalSnapshot: snapshot,
        version: 1,
      });

      const savedPrq = await queryRunner.manager.save(PaymentRequest, prq);

      // 10. Audit Log
      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'payment_requests',
        record_id: savedPrq.id,
        action: 'SUBMIT',
        old_value: null,
        new_value: JSON.stringify({
          requestNumber: savedPrq.requestNumber,
          invoiceId: savedPrq.invoiceId,
          requestedAmount: savedPrq.requestedAmount,
          status: savedPrq.status,
          requestedBy: savedPrq.requestedBy,
        }),
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      // 11. Transactional Outbox for finance.payment_request.submitted
      const submitEventId = `prq-sub-${savedPrq.id}`;
      const submitPayload = {
        paymentRequestId: savedPrq.id,
        requestId: savedPrq.id,
        requestNumber: savedPrq.requestNumber,
        invoiceId: savedPrq.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        requestedAmount: savedPrq.requestedAmount,
        submittedBy: userId,
        status: savedPrq.status,
      };

      const submitOutbox = queryRunner.manager.create(OutboxEvent, {
        event_id: submitEventId,
        event_name: 'finance.payment_request.submitted',
        event_version: '1',
        aggregate_type: 'PAYMENT_REQUEST',
        aggregate_id: savedPrq.id,
        correlation_id: submitEventId,
        payload: {
          ...submitPayload,
          businessPayload: submitPayload,
          notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
          routing: { roles: ['DIRECTOR'] },
        },
        status: OutboxStatus.PENDING,
      });
      await queryRunner.manager.save(OutboxEvent, submitOutbox);

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('finance.payment_request.submitted', {
        eventId: submitEventId,
        eventName: 'finance.payment_request.submitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: savedPrq.id,
        actor: { userId },
        routing: { roles: ['DIRECTOR'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: submitPayload,
      });

      return this.getPaymentRequestById(savedPrq.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Fetch all Payment Requests
   */
  async getPaymentRequests(status?: string): Promise<PaymentRequest[]> {
    const qb = this.dataSource
      .getRepository(PaymentRequest)
      .createQueryBuilder('prq')
      .leftJoinAndSelect('prq.invoice', 'invoice')
      .leftJoinAndSelect('invoice.invoiceTaxDetail', 'invoiceTaxDetail')
      .leftJoinAndSelect('invoice.purchaseOrder', 'po')
      .leftJoinAndSelect('po.vendor', 'vendor')
      .leftJoinAndSelect('po.purchaseRequest', 'purchaseRequest')
      .leftJoinAndSelect('purchaseRequest.project', 'project')
      .leftJoinAndSelect('prq.paymentTerm', 'paymentTerm')
      .leftJoinAndSelect('prq.requester', 'requester')
      .leftJoinAndSelect('prq.approver', 'approver')
      .orderBy('prq.id', 'DESC');

    if (status) {
      qb.andWhere('prq.status = :status', { status });
    }

    return qb.getMany();
  }

  /**
   * Fetch single Payment Request by ID
   */
  async getPaymentRequestById(id: number): Promise<PaymentRequest> {
    const prq = await this.dataSource
      .getRepository(PaymentRequest)
      .createQueryBuilder('prq')
      .leftJoinAndSelect('prq.invoice', 'invoice')
      .leftJoinAndSelect('invoice.invoiceTaxDetail', 'invoiceTaxDetail')
      .leftJoinAndSelect('invoice.purchaseOrder', 'po')
      .leftJoinAndSelect('po.vendor', 'vendor')
      .leftJoinAndSelect('po.purchaseRequest', 'purchaseRequest')
      .leftJoinAndSelect('purchaseRequest.project', 'project')
      .leftJoinAndSelect('prq.paymentTerm', 'paymentTerm')
      .leftJoinAndSelect('prq.requester', 'requester')
      .leftJoinAndSelect('prq.approver', 'approver')
      .where('prq.id = :id', { id })
      .getOne();

    if (!prq) {
      throw new NotFoundException(`Payment Request #${id} tidak ditemukan.`);
    }

    return prq;
  }

  /**
   * Director Decision on Payment Request (APPROVE, RETURN, REJECT)
   */
  async decidePaymentRequest(
    id: number,
    dto: DecidePaymentRequestDto,
    userId: number,
  ): Promise<PaymentRequest> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const prq = await queryRunner.manager.findOne(PaymentRequest, {
        where: { id },
        relations: ['invoice'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!prq || prq.deletedAt) {
        throw new NotFoundException(`Payment Request #${id} tidak ditemukan.`);
      }

      if (prq.status !== PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL) {
        throw new BadRequestException(
          `Payment Request tidak dapat diputuskan pada status "${prq.status}". Status harus PENDING_DIRECTOR_APPROVAL.`,
        );
      }

      const oldStatus = prq.status;

      if (dto.action === DirectorDecisionAction.APPROVE) {
        // Enforce snapshot version integrity: prevent approval if invoice data was updated after snapshot
        if (prq.approvalSnapshot?.invoiceVersion && prq.invoice?.version && prq.invoice.version > prq.approvalSnapshot.invoiceVersion) {
          throw new BadRequestException(
            `Terdeteksi perubahan data invoice (versi ${prq.invoice.version}) setelah pengajuan pembayaran dibuat (versi snapshot ${prq.approvalSnapshot.invoiceVersion}). Persetujuan tidak dapat diproses menggunakan data keuangan yang sudah usang (stale). Gunakan aksi RETURN (Minta Revisi) agar tim Finance mengajukan ulang sesuai data terbaru.`
          );
        }

        if (dto.approvedAmount !== undefined && dto.approvedAmount !== null) {
          const appAmt = Number(dto.approvedAmount);
          if (isNaN(appAmt) || appAmt <= 0) {
            throw new BadRequestException('Nominal persetujuan Direktur harus lebih besar dari 0.');
          }
          const reqAmt = Number(prq.requestedAmount);
          if (Math.round(appAmt * 100) / 100 < Math.round(reqAmt * 100) / 100 - 0.001) {
            throw new BadRequestException(
              `Persetujuan pembayaran dengan nominal (Rp ${appAmt.toLocaleString('id-ID')}) lebih kecil dari jumlah yang diajukan (Rp ${reqAmt.toLocaleString('id-ID')}) tidak diizinkan. Direktur harus menggunakan aksi RETURN (Minta Revisi) jika nominal perlu disesuaikan melalui amandemen PO Procurement.`,
            );
          }
          if (Math.round(appAmt * 100) / 100 > Math.round(reqAmt * 100) / 100 + 0.001) {
            throw new BadRequestException(
              `Nominal persetujuan Direktur (${appAmt}) melebihi jumlah yang diajukan (${reqAmt}).`,
            );
          }
        }
        prq.status = PaymentRequestStatus.APPROVED_FOR_PAYMENT;
        prq.approvedBy = userId;
        prq.approvedAt = new Date();
        prq.approvedAmount =
          dto.approvedAmount !== undefined && dto.approvedAmount !== null
            ? Number(dto.approvedAmount)
            : prq.requestedAmount;
      } else if (dto.action === DirectorDecisionAction.RETURN) {
        if (!dto.revisionNotes || !dto.revisionNotes.trim()) {
          throw new BadRequestException('Catatan revisi wajib diisi saat meminta revisi.');
        }
        prq.status = PaymentRequestStatus.NEEDS_REVISION;
        prq.returnedAt = new Date();
        prq.revisionNotes = dto.revisionNotes.trim();
      } else if (dto.action === DirectorDecisionAction.REJECT) {
        if (!dto.rejectionReason || !dto.rejectionReason.trim()) {
          throw new BadRequestException('Alasan penolakan wajib diisi saat menolak pembayaran.');
        }
        prq.status = PaymentRequestStatus.REJECTED;
        prq.rejectionReason = dto.rejectionReason.trim();
      } else {
        throw new BadRequestException(`Aksi keputusan tidak valid: ${dto.action}`);
      }

      const savedPrq = await queryRunner.manager.save(PaymentRequest, prq);

      // Audit Log
      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'payment_requests',
        record_id: savedPrq.id,
        action: dto.action,
        old_value: JSON.stringify({ status: oldStatus }),
        new_value: JSON.stringify({
          status: savedPrq.status,
          approvedBy: savedPrq.approvedBy,
          approvedAmount: savedPrq.approvedAmount,
          revisionNotes: savedPrq.revisionNotes,
          rejectionReason: savedPrq.rejectionReason,
        }),
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      // Transactional Outbox for decision action
      let eventId: string;
      let eventName: string;
      let routing: { roles?: string[]; userIds?: number[] };
      let decisionPayload: any;

      if (dto.action === DirectorDecisionAction.APPROVE) {
        eventId = `prq-app-${savedPrq.id}`;
        eventName = 'finance.payment_request.approved';
        routing = { roles: ['FINANCE'], userIds: savedPrq.requestedBy ? [savedPrq.requestedBy] : [] };
        decisionPayload = {
          paymentRequestId: savedPrq.id,
          requestId: savedPrq.id,
          requestNumber: savedPrq.requestNumber,
          invoiceId: savedPrq.invoiceId,
          approvedAmount: savedPrq.approvedAmount,
          approvedBy: userId,
          status: savedPrq.status,
          requestedBy: savedPrq.requestedBy,
        };
      } else if (dto.action === DirectorDecisionAction.RETURN) {
        eventId = `prq-ret-${savedPrq.id}-${savedPrq.version}`;
        eventName = 'finance.payment_request.returned';
        routing = { userIds: savedPrq.requestedBy ? [savedPrq.requestedBy] : [] };
        decisionPayload = {
          paymentRequestId: savedPrq.id,
          requestId: savedPrq.id,
          requestNumber: savedPrq.requestNumber,
          invoiceId: savedPrq.invoiceId,
          revisionNotes: savedPrq.revisionNotes,
          returnedBy: userId,
          status: savedPrq.status,
          requestedBy: savedPrq.requestedBy,
        };
      } else {
        eventId = `prq-rej-${savedPrq.id}`;
        eventName = 'finance.payment_request.rejected';
        routing = { userIds: savedPrq.requestedBy ? [savedPrq.requestedBy] : [] };
        decisionPayload = {
          paymentRequestId: savedPrq.id,
          requestId: savedPrq.id,
          requestNumber: savedPrq.requestNumber,
          invoiceId: savedPrq.invoiceId,
          rejectionReason: savedPrq.rejectionReason,
          rejectedBy: userId,
          status: savedPrq.status,
          requestedBy: savedPrq.requestedBy,
        };
      }

      const decisionOutbox = queryRunner.manager.create(OutboxEvent, {
        event_id: eventId,
        event_name: eventName,
        event_version: '1',
        aggregate_type: 'PAYMENT_REQUEST',
        aggregate_id: savedPrq.id,
        correlation_id: eventId,
        payload: {
          ...decisionPayload,
          businessPayload: decisionPayload,
          notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
          routing,
        },
        status: OutboxStatus.PENDING,
      });
      await queryRunner.manager.save(OutboxEvent, decisionOutbox);

      await queryRunner.commitTransaction();

      this.eventEmitter.emit(eventName, {
        eventId,
        eventName,
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: savedPrq.id,
        actor: { userId },
        routing,
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: {
          ...decisionPayload,
          decidedBy: userId,
        },
      });

      return this.getPaymentRequestById(savedPrq.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Finance Resubmit returned Payment Request
   */
  async resubmitPaymentRequest(
    id: number,
    dto: ResubmitPaymentRequestDto,
    userId: number,
  ): Promise<PaymentRequest> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const prq = await queryRunner.manager.findOne(PaymentRequest, {
        where: { id },
        relations: ['invoice'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!prq || prq.deletedAt) {
        throw new NotFoundException(`Payment Request #${id} tidak ditemukan.`);
      }

      if (prq.status !== PaymentRequestStatus.NEEDS_REVISION) {
        throw new BadRequestException(
          `Hanya pengajuan dengan status NEEDS_REVISION yang dapat diajukan ulang. Status saat ini: ${prq.status}.`,
        );
      }

      const oldStatus = prq.status;

      if (dto.requestedAmount !== undefined && dto.requestedAmount !== null) {
        const amtDec = this.toMoneyDec(dto.requestedAmount);
        if (amtDec.lessThanOrEqualTo(0)) {
          throw new BadRequestException('Jumlah pengajuan ulang harus lebih besar dari 0.');
        }

        let itd = prq.invoice?.invoiceTaxDetail;
        if (!itd) {
          try {
            itd = await queryRunner.manager.findOne(InvoiceTaxDetail, { where: { invoiceId: prq.invoiceId } });
          } catch (e) { }
        }

        const grossLiabilityDec = itd?.grossCommercialLiability != null
          ? this.toMoneyDec(itd.grossCommercialLiability)
          : this.toMoneyDec(prq.invoice?.totalAmount || 0);
        const wTaxDec = this.toMoneyDec(itd?.pphWithholdingAmount || 0);
        const wWapuDec = this.toMoneyDec(itd?.wapuPpnWithheldAmount || 0);
        const pDedDec = this.toMoneyDec(itd?.priorDeductionsAmount || 0);
        const totalNonCashCreditsDec = wTaxDec.plus(wWapuDec).plus(pDedDec);
        const netPayableDec = itd?.netVendorCashPayable != null
          ? this.toMoneyDec(itd.netVendorCashPayable)
          : Decimal.max(0, grossLiabilityDec.minus(totalNonCashCreditsDec));

        const existingPayments = await queryRunner.manager.find(Payment, { where: { invoiceId: prq.invoiceId } });
        let alreadyPaidDec = new Decimal(0);
        for (const p of existingPayments) {
          if (!p.deletedAt) alreadyPaidDec = alreadyPaidDec.plus(this.toMoneyDec(p.amount));
        }
        const remainingNetDec = Decimal.max(0, netPayableDec.minus(alreadyPaidDec));

        if (amtDec.greaterThan(remainingNetDec)) {
          throw new BadRequestException(
            `Jumlah pengajuan ulang (Rp ${amtDec.toNumber().toLocaleString('id-ID')}) melebihi sisa kas bersih yang dapat dibayarkan ke vendor (Rp ${remainingNetDec.toNumber().toLocaleString('id-ID')}).`,
          );
        }

        prq.requestedAmount = amtDec.toNumber();
      }

      if (dto.notes) {
        prq.notes = dto.notes;
      }

      if (prq.approvalSnapshot && (dto.bankName || dto.bankAccountNumber || dto.bankAccountHolder)) {
        prq.approvalSnapshot = {
          ...prq.approvalSnapshot,
          vendorBankName: dto.bankName || prq.approvalSnapshot.vendorBankName,
          vendorBankAccount: dto.bankAccountNumber || prq.approvalSnapshot.vendorBankAccount,
          timestamp: new Date().toISOString(),
        };
      }

      prq.status = PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL;
      prq.submittedAt = new Date();

      // Count previous resubmissions from AuditLog
      const prevResubmitCount = await queryRunner.manager
        .createQueryBuilder(AuditLog, 'al')
        .where('al.table_name = :table AND al.record_id = :id AND al.action = :action', {
          table: 'payment_requests',
          id: id,
          action: 'RESUBMIT',
        })
        .getCount();

      const cycle = prevResubmitCount + 1;

      const savedPrq = await queryRunner.manager.save(PaymentRequest, prq);

      // Audit Log
      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'payment_requests',
        record_id: savedPrq.id,
        action: 'RESUBMIT',
        old_value: JSON.stringify({ status: oldStatus }),
        new_value: JSON.stringify({
          status: savedPrq.status,
          requestedAmount: savedPrq.requestedAmount,
          revisionNotes: dto.revisionNotes,
        }),
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      // Transactional Outbox for finance.payment_request.resubmitted
      const resubmitEventId = `prq-sub-${savedPrq.id}-resub-${cycle}`;
      const resubmitPayload = {
        paymentRequestId: savedPrq.id,
        requestId: savedPrq.id,
        requestNumber: savedPrq.requestNumber,
        invoiceId: savedPrq.invoiceId,
        requestedAmount: savedPrq.requestedAmount,
        resubmittedBy: userId,
        revisionNotes: dto.revisionNotes,
        cycle,
        isResubmission: true,
        status: savedPrq.status,
      };

      const resubmitOutbox = queryRunner.manager.create(OutboxEvent, {
        event_id: resubmitEventId,
        event_name: 'finance.payment_request.resubmitted',
        event_version: '1',
        aggregate_type: 'PAYMENT_REQUEST',
        aggregate_id: savedPrq.id,
        correlation_id: resubmitEventId,
        payload: {
          ...resubmitPayload,
          businessPayload: resubmitPayload,
          notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
          routing: { roles: ['DIRECTOR'] },
        },
        status: OutboxStatus.PENDING,
      });
      await queryRunner.manager.save(OutboxEvent, resubmitOutbox);

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('finance.payment_request.resubmitted', {
        eventId: resubmitEventId,
        eventName: 'finance.payment_request.resubmitted',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'PAYMENT_REQUEST',
        aggregateId: savedPrq.id,
        actor: { userId },
        routing: { roles: ['DIRECTOR'] },
        notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
        payload: resubmitPayload,
      });

      return this.getPaymentRequestById(savedPrq.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Evaluates canonical Material Payment Term invoice eligibility SSOT.
   * Consumed by both createInvoice validation and InboxService CREATE_INVOICE projection.
   */
  isMaterialTermEligible(
    term: PoPaymentTerm,
    po: PurchaseOrder,
    allTerms: PoPaymentTerm[],
    allPoInvoices: Invoice[],
    allPoGrs: GoodsReceipt[],
  ): { isEligible: boolean; reason?: string } {
    if (!term || term.deletedAt) {
      return { isEligible: false, reason: 'Payment term tidak ditemukan atau telah dihapus.' };
    }

    if (term.status !== PaymentTermStatus.PENDING) {
      return { isEligible: false, reason: `Payment term status bukan PENDING (${term.status}).` };
    }

    const eligiblePoStatuses = ['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED'];
    if (!eligiblePoStatuses.includes(po.status)) {
      return { isEligible: false, reason: `Status PO ${po.status} tidak memenuhi syarat penagihan.` };
    }

    // 1. Single active invoice per term rule
    const existingActiveInvoice = allPoInvoices.find(
      (inv) =>
        Number(inv.paymentTermId) === Number(term.id) &&
        !inv.deletedAt &&
        inv.status !== 'CANCELLED' &&
        inv.matchStatus !== 'REJECTED',
    );
    if (existingActiveInvoice) {
      return { isEligible: false, reason: 'Payment term sudah memiliki invoice aktif.' };
    }

    // 2. Sequence Gate
    const currentSeq = Number(term.sequence || 1);
    if (currentSeq > 1 && allTerms && allTerms.length > 0) {
      const sortedTerms = [...allTerms].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
      for (const prevTerm of sortedTerms) {
        if (prevTerm.deletedAt || Number(prevTerm.id) === Number(term.id)) continue;
        const prevSeq = Number(prevTerm.sequence || 0);
        if (prevSeq < currentSeq) {
          const matchingInv = allPoInvoices.find(
            (inv) => Number(inv.paymentTermId) === Number(prevTerm.id) && !inv.deletedAt && inv.status !== 'CANCELLED',
          );
          const effectiveStatus = prevTerm.status || matchingInv?.paymentStatus || 'PENDING';
          if (prevTerm.termType === PaymentTermType.DOWN_PAYMENT) {
            if (effectiveStatus !== PaymentTermStatus.PAID && matchingInv?.paymentStatus !== 'PAID') {
              return { isEligible: false, reason: `Uang Muka (${prevTerm.termName}) belum berstatus PAID.` };
            }
          } else {
            const allowed = [PaymentTermStatus.VERIFIED, PaymentTermStatus.PAID];
            if (
              !allowed.includes(effectiveStatus as any) &&
              matchingInv?.matchStatus !== 'VERIFIED' &&
              matchingInv?.paymentStatus !== 'PAID'
            ) {
              return {
                isEligible: false,
                reason: `Termin sebelumnya (${prevTerm.termName}) belum mencapai status VERIFIED atau PAID.`,
              };
            }
          }
        }
      }
    }

    // 3. Physical GR & Fulfillment Gate
    const activeGrs = (allPoGrs || []).filter((g) => !g.deletedAt);
    if (activeGrs.length === 0) {
      return { isEligible: false, reason: 'Belum ada Goods Receipt (GR) aktif untuk PO ini.' };
    }

    let totalReceivedPhysicalValue = 0;
    for (const g of activeGrs) {
      for (const gi of g.items || []) {
        const poi = po.items?.find((i) => Number(i.id) === Number(gi.poItemId));
        if (poi) {
          totalReceivedPhysicalValue += Number(gi.receivedQuantity || 0) * Number(poi.unitPrice || 0);
        }
      }
    }

    if (totalReceivedPhysicalValue <= 0) {
      return { isEligible: false, reason: 'Total nilai penerimaan fisik barang masih 0.' };
    }

    if (term.termType === PaymentTermType.RETENTION) {
      if (po.status !== 'COMPLETED') {
        return { isEligible: false, reason: 'Termin retensi hanya dapat ditagihkan setelah PO berstatus COMPLETED.' };
      }
    } else {
      // PROGRESS or FINAL_DELIVERY
      const is100PercentMilestone =
        /100%|fisik\s*100%|lengkap/i.test(term.triggerCondition || '') ||
        Number(term.percentage) === 100 ||
        term.termType === PaymentTermType.FINAL_DELIVERY;

      if (is100PercentMilestone) {
        const isAllItemsCompleted =
          po.status === 'COMPLETED' &&
          po.items &&
          po.items.length > 0 &&
          po.items.every((item) => Number(item.receivedQuantity || 0) >= Number(item.quantity || 0));

        if (!isAllItemsCompleted) {
          return { isEligible: false, reason: 'Pengiriman fisik barang belum selesai 100%.' };
        }
      } else {
        const matchPercent = (term.triggerCondition || '').match(/(\d+(?:\.\d+)?)\s*%/);
        const targetPercent = matchPercent ? parseFloat(matchPercent[1]) : Number(term.percentage || 0);
        if (targetPercent > 0 && targetPercent < 100) {
          const poTotal = Number(po.totalAmount || 0);
          const physicalProgress = poTotal > 0 ? (totalReceivedPhysicalValue / poTotal) * 100 : 0;
          if (Math.round(physicalProgress * 100) / 100 + 0.5 < targetPercent) {
            return {
              isEligible: false,
              reason: `Kemajuan fisik baru mencapai ${physicalProgress.toFixed(2)}% (target: ${targetPercent}%).`,
            };
          }
        }
      }

      // Capacity check
      let previousProgressBilled = 0;
      for (const inv of allPoInvoices) {
        if (inv.deletedAt || inv.status === 'CANCELLED' || inv.matchStatus === 'REJECTED') continue;
        const matchingTerm = allTerms.find((t) => Number(t.id) === Number(inv.paymentTermId));
        if (matchingTerm && matchingTerm.termType === PaymentTermType.PROGRESS) {
          previousProgressBilled += Number(inv.totalAmount || 0);
        }
      }

      const currentTermAmountDec = this.toMoneyDec(term.amount);
      const previousProgressBilledDec = this.toMoneyDec(previousProgressBilled);
      const totalReceivedPhysicalValueDec = this.toMoneyDec(totalReceivedPhysicalValue);
      const totalProgressDec = previousProgressBilledDec.plus(currentTermAmountDec);
      if (totalProgressDec.greaterThan(totalReceivedPhysicalValueDec)) {
        return {
          isEligible: false,
          reason: 'Akumulasi penagihan progress melebihi total nilai fisik barang yang telah diterima.',
        };
      }
    }

    return { isEligible: true };
  }

  /**
   * Evaluates canonical Service Claim invoice eligibility SSOT.
   */
  isServiceClaimEligible(
    claim: ServiceClaim,
    po: PurchaseOrder,
    existingClaimInvoices: Invoice[],
  ): { isEligible: boolean; reason?: string } {
    if (!claim || claim.deletedAt) {
      return { isEligible: false, reason: 'Klaim Jasa tidak ditemukan atau telah dihapus.' };
    }

    if (claim.status !== ServiceClaimStatus.APPROVED_FOR_INVOICE) {
      return { isEligible: false, reason: `Status Klaim Jasa bukan APPROVED_FOR_INVOICE (${claim.status}).` };
    }

    if (!po || po.deletedAt) {
      return { isEligible: false, reason: 'Purchase Order terkait tidak ditemukan.' };
    }

    const eligiblePoStatuses = ['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED'];
    if (!eligiblePoStatuses.includes(po.status)) {
      return { isEligible: false, reason: `Status PO ${po.status} tidak memenuhi syarat penagihan.` };
    }

    const hasActiveInvoice = existingClaimInvoices.some(
      (inv) =>
        Number(inv.serviceClaimId) === Number(claim.id) &&
        !inv.deletedAt &&
        inv.status !== 'CANCELLED' &&
        inv.matchStatus !== 'REJECTED',
    );
    if (hasActiveInvoice) {
      return { isEligible: false, reason: 'Klaim Jasa sudah ditagihkan pada invoice aktif.' };
    }

    return { isEligible: true };
  }

  /**
   * Retrieves all currently actionable invoice obligations for Finance.
   * Material POs with fulfilled Goods Receipts and Service POs with APPROVED_FOR_INVOICE claims.
   * Provides authoritative SSOT for both Inbox projection and Finance workspace.
   */
  async getEligibleInvoiceObligations(): Promise<EligibleInvoiceObligation[]> {
    const obligations: EligibleInvoiceObligation[] = [];
    const seenObligationIds = new Set<string>();

    // 1. MATERIAL PO Obligations
    try {
      const materialPos = await this.poRepository.find({
        where: {
          orderType: In([PurchaseOrderType.MATERIAL, 'LEGACY_MIXED']),
          status: In(['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED']),
        },
        relations: [
          'items',
          'paymentTerms',
          'vendor',
          'purchaseRequest',
          'purchaseRequest.project',
          'goodsReceipts',
          'goodsReceipts.items',
        ],
        order: { id: 'DESC' },
      });

      for (const po of materialPos) {
        if (!po.goodsReceipts || po.goodsReceipts.length === 0) continue;

        const allPoInvoices = await this.invoiceRepository.find({
          where: { poId: po.id },
          relations: ['paymentTerm'],
        });

        const projectName = po.purchaseRequest?.project?.name || undefined;
        const projectId = po.purchaseRequest?.projectId || undefined;
        const vendorName = po.vendor?.name || undefined;

        if (po.paymentTerms && po.paymentTerms.length > 0) {
          const sortedTerms = [...po.paymentTerms].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));

          for (const term of sortedTerms) {
            const evalResult = this.isMaterialTermEligible(
              term,
              po,
              sortedTerms,
              allPoInvoices,
              po.goodsReceipts,
            );

            if (evalResult.isEligible) {
              const obligationId = `mat-po-${po.id}-term-${term.id}`;
              if (!seenObligationIds.has(obligationId)) {
                seenObligationIds.add(obligationId);
                const latestGr = [...po.goodsReceipts]
                  .filter((g) => !g.deletedAt)
                  .sort(
                    (a, b) =>
                      new Date(b.receiptDate || (b as any).createdAt).getTime() -
                      new Date(a.receiptDate || (a as any).createdAt).getTime(),
                  )[0];

                obligations.push({
                  obligationId,
                  orderType: 'MATERIAL',
                  poId: Number(po.id),
                  poNumber: po.poNumber,
                  vendorName,
                  projectName,
                  projectId,
                  paymentTermId: Number(term.id),
                  paymentTermName: term.termName,
                  paymentTermSequence: Number(term.sequence || 1),
                  amount: Number(term.amount || 0),
                  eligibleAt: latestGr?.receiptDate
                    ? new Date(latestGr.receiptDate)
                    : new Date(term.createdAt || new Date()),
                  triggerCondition: term.triggerCondition,
                  actionTarget: `/finance/invoices?tab=ready_pos&poId=${po.id}&paymentTermId=${term.id}`,
                });
              }
            }
          }
        } else {
          // Branch B (Legacy PO without terms): COMPLETED + 100% received + unbilled
          if (po.status === 'COMPLETED') {
            const totalOrdered = (po.items || []).reduce((sum, it) => sum + Number(it.quantity || 0), 0);
            const totalReceived = (po.items || []).reduce((sum, it) => sum + Number(it.receivedQuantity || 0), 0);
            const is100Percent = totalReceived >= totalOrdered && totalOrdered > 0;

            const hasActiveInvoice = allPoInvoices.some(
              (inv) => !inv.deletedAt && inv.status !== 'CANCELLED' && inv.matchStatus !== 'REJECTED',
            );

            if (is100Percent && !hasActiveInvoice) {
              const obligationId = `mat-po-${po.id}-full`;
              if (!seenObligationIds.has(obligationId)) {
                seenObligationIds.add(obligationId);
                obligations.push({
                  obligationId,
                  orderType: 'MATERIAL',
                  poId: Number(po.id),
                  poNumber: po.poNumber,
                  vendorName,
                  projectName,
                  projectId,
                  amount: Number(po.totalAmount || 0),
                  eligibleAt: new Date(po.updatedAt || (po as any).createdAt || new Date()),
                  actionTarget: `/finance/invoices?tab=ready_pos&poId=${po.id}`,
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to resolve Material invoice obligations:', err);
    }

    // 2. SERVICE PO Obligations
    try {
      const claimRepo = this.dataSource.getRepository(ServiceClaim);
      const approvedClaims = await claimRepo.find({
        where: {
          status: ServiceClaimStatus.APPROVED_FOR_INVOICE,
        },
        relations: ['purchaseOrder', 'purchaseOrder.vendor', 'project'],
        order: { id: 'DESC' },
      });

      for (const claim of approvedClaims) {
        if (claim.deletedAt) continue;
        const po = claim.purchaseOrder;
        if (!po || po.deletedAt) continue;

        const existingClaimInvoices = await this.invoiceRepository.find({
          where: { serviceClaimId: claim.id },
        });

        const evalResult = this.isServiceClaimEligible(claim, po, existingClaimInvoices);
        if (evalResult.isEligible) {
          const obligationId = `srv-claim-${claim.id}`;
          if (!seenObligationIds.has(obligationId)) {
            seenObligationIds.add(obligationId);
            obligations.push({
              obligationId,
              orderType: 'SERVICE',
              poId: Number(claim.poId),
              poNumber: po.poNumber || `PO #${claim.poId}`,
              vendorName: po.vendor?.name,
              projectName: claim.project?.name,
              projectId: claim.projectId ? Number(claim.projectId) : undefined,
              serviceClaimId: Number(claim.id),
              serviceClaimNumber: claim.claimNumber,
              amount: Number(claim.approvedClaimAmount || claim.totalClaimAmount || 0),
              eligibleAt: claim.commercialVerifiedAt
                ? new Date(claim.commercialVerifiedAt)
                : new Date(claim.updatedAt || new Date()),
              actionTarget: `/finance/invoices?tab=ready_pos&poId=${claim.poId}&serviceClaimId=${claim.id}`,
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to resolve Service invoice obligations:', err);
    }

    return obligations;
  }

  // =========================================================================
  // COMPANY BANK ACCOUNT MASTER DATA & LEGAL ENTITY CONTROL
  // =========================================================================

  /**
   * Helper: Resolves authoritative company code ('UBD' | 'TVM') across the transaction chain.
   * Strictly blocks if missing, unresolvable, or conflicting.
   */
  resolveTransactionCompanyCode(
    prq?: PaymentRequest | null,
    invoice?: Invoice | null,
    po?: PurchaseOrder | any | null,
    project?: any,
  ): string {
    const candidateEntities: { source: string; code: string }[] = [];

    const normalizeEntity = (val?: string | null): string | null => {
      if (!val) return null;
      const str = String(val).trim().toUpperCase();
      if (str === 'UBD' || str.includes('UBD') || str.includes('DANANJAYA')) return 'UBD';
      if (str === 'TVM' || str.includes('TVM') || str.includes('TRI VISI')) return 'TVM';
      return null;
    };

    const addEntity = (source: string, val?: string | null) => {
      const code = normalizeEntity(val);
      if (code) {
        candidateEntities.push({ source, code });
      }
    };

    if (prq) {
      addEntity('PaymentRequest', prq.companyCode);
    }
    if (invoice) {
      addEntity('Invoice', invoice.companyCode);
      if (invoice.invoiceTaxDetail) {
        addEntity('InvoiceTaxDetail', invoice.invoiceTaxDetail.companyCode);
      }
      if ((invoice as any).purchaseOrder) {
        const invPo = (invoice as any).purchaseOrder;
        addEntity('Invoice.PurchaseOrder', invPo.companyCode);
        if (invPo.purchaseRequest?.project) {
          addEntity('Invoice.PO.PurchaseRequest.Project.companyCode', invPo.purchaseRequest.project.companyCode);
          addEntity('Invoice.PO.PurchaseRequest.Project.company', invPo.purchaseRequest.project.company);
        }
        if (invPo.project) {
          addEntity('Invoice.PO.Project.companyCode', invPo.project.companyCode);
          addEntity('Invoice.PO.Project.company', invPo.project.company);
        }
      }
    }
    if (po) {
      addEntity('PurchaseOrder', po.companyCode);
      if (po.purchaseRequest?.project) {
        addEntity('PO.PurchaseRequest.Project.companyCode', po.purchaseRequest.project.companyCode);
        addEntity('PO.PurchaseRequest.Project.company', po.purchaseRequest.project.company);
      }
      if (po.project) {
        addEntity('PO.Project.companyCode', po.project.companyCode);
        addEntity('PO.Project.company', po.project.company);
      }
    }
    if (project) {
      addEntity('Project.companyCode', project.companyCode);
      addEntity('Project.company', project.company);
    }

    if (candidateEntities.length === 0) {
      throw new BadRequestException(
        'Payment execution blocked: Legal entity ownership is missing or cannot be reliably determined. Please complete authorized legacy data clarification before proceeding.'
      );
    }

    const distinctEntities = Array.from(new Set(candidateEntities.map((e) => e.code)));
    if (distinctEntities.length > 1) {
      const details = candidateEntities.map((e) => `${e.source}=${e.code}`).join(', ');
      throw new BadRequestException(
        `Payment execution blocked: Conflicting legal entity ownership detected (${details}). Please resolve the data conflict before proceeding.`
      );
    }

    const transactionCompanyCode = distinctEntities[0];
    if (transactionCompanyCode !== 'UBD' && transactionCompanyCode !== 'TVM') {
      throw new BadRequestException(
        `Payment execution blocked: Unrecognized legal entity ownership '${transactionCompanyCode}'. Only 'UBD' or 'TVM' are authorized.`
      );
    }

    return transactionCompanyCode;
  }

  async createCompanyBankAccount(dto: CreateCompanyBankAccountDto, userId: number) {
    const repo = this.companyBankAccountRepository || this.dataSource.getRepository(CompanyBankAccount);
    const companyCode = dto.companyCode.toUpperCase() as 'UBD' | 'TVM';
    const bankName = dto.bankName.trim();
    const accountNumber = dto.accountNumber.trim();

    if (!dto.changeReason || dto.changeReason.trim().length === 0) {
      throw new BadRequestException('Alasan perubahan (changeReason) wajib disertakan untuk pembuatan rekening bank.');
    }

    // Duplicate check
    const existing = await repo.findOne({
      where: {
        companyCode,
        bankName,
        accountNumber,
        deletedAt: IsNull(),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Rekening bank ${bankName} dengan nomor ${accountNumber} untuk entitas ${companyCode} sudah terdaftar.`
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (dto.isDefault) {
        // Demote existing default accounts for this legal entity
        await queryRunner.manager.update(
          CompanyBankAccount,
          { companyCode, isDefault: true, deletedAt: IsNull() },
          { isDefault: false, updatedBy: userId }
        );
      }

      const account = queryRunner.manager.create(CompanyBankAccount, {
        companyCode,
        bankName,
        bankCode: dto.bankCode ? dto.bankCode.trim() : null,
        accountNumber,
        accountHolderName: dto.accountHolderName.trim(),
        accountType: dto.accountType || CompanyBankAccountType.GIRO,
        accountPurpose: dto.accountPurpose || CompanyBankAccountPurpose.OPERATIONAL,
        currency: dto.currency ? dto.currency.trim().toUpperCase() : 'IDR',
        status: CompanyBankAccountStatus.ACTIVE,
        isDefault: Boolean(dto.isDefault),
        effectiveDate: dto.effectiveDate,
        expiryDate: dto.expiryDate || null,
        picName: dto.picName ? dto.picName.trim() : null,
        notes: dto.notes ? dto.notes.trim() : null,
        lastChangeReason: dto.changeReason.trim(),
        createdBy: userId,
        updatedBy: userId,
      });

      const savedAccount = await queryRunner.manager.save(CompanyBankAccount, account);

      // Audit Log
      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'company_bank_accounts',
        record_id: savedAccount.id,
        action: 'CREATE',
        old_value: null,
        new_value: {
          id: savedAccount.id,
          companyCode: savedAccount.companyCode,
          bankName: savedAccount.bankName,
          accountNumber: savedAccount.accountNumber,
          accountHolderName: savedAccount.accountHolderName,
          accountType: savedAccount.accountType,
          accountPurpose: savedAccount.accountPurpose,
          currency: savedAccount.currency,
          status: savedAccount.status,
          isDefault: savedAccount.isDefault,
          effectiveDate: savedAccount.effectiveDate,
          expiryDate: savedAccount.expiryDate,
          picName: savedAccount.picName,
          notes: savedAccount.notes,
          changeReason: dto.changeReason.trim(),
        },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      await queryRunner.commitTransaction();
      return savedAccount;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getCompanyBankAccounts(query: QueryCompanyBankAccountDto = {}) {
    const repo = this.companyBankAccountRepository || this.dataSource.getRepository(CompanyBankAccount);
    const qb = repo.createQueryBuilder('cba')
      .where('cba.deletedAt IS NULL');

    if (query.companyCode) {
      qb.andWhere('cba.companyCode = :companyCode', { companyCode: query.companyCode.toUpperCase() });
    }
    if (query.status) {
      qb.andWhere('cba.status = :status', { status: query.status });
    }
    if (query.purpose) {
      qb.andWhere('cba.accountPurpose = :purpose', { purpose: query.purpose });
    }
    if (query.search && query.search.trim().length > 0) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere('(cba.bankName LIKE :term OR cba.accountNumber LIKE :term OR cba.accountHolderName LIKE :term)', { term });
    }

    qb.orderBy('cba.isDefault', 'DESC')
      .addOrderBy('cba.status', 'ASC')
      .addOrderBy('cba.bankName', 'ASC');

    return qb.getMany();
  }

  async getEligibleCompanyBankAccounts(companyCode?: string) {
    const repo = this.companyBankAccountRepository || this.dataSource.getRepository(CompanyBankAccount);
    const today = new Date().toISOString().slice(0, 10);
    const qb = repo.createQueryBuilder('cba')
      .where('cba.deletedAt IS NULL')
      .andWhere('cba.status = :status', { status: CompanyBankAccountStatus.ACTIVE })
      .andWhere('cba.effectiveDate <= :today', { today })
      .andWhere('(cba.expiryDate IS NULL OR cba.expiryDate >= :today)', { today });

    if (companyCode) {
      const codeUpper = companyCode.trim().toUpperCase();
      if (codeUpper === 'UBD' || codeUpper === 'TVM') {
        qb.andWhere('cba.companyCode = :codeUpper', { codeUpper });
      }
    }

    qb.orderBy('cba.isDefault', 'DESC')
      .addOrderBy('cba.bankName', 'ASC');

    return qb.getMany();
  }

  async getCompanyBankAccountById(id: number) {
    const repo = this.companyBankAccountRepository || this.dataSource.getRepository(CompanyBankAccount);
    const account = await repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!account) {
      throw new NotFoundException(`Rekening bank perusahaan dengan ID ${id} tidak ditemukan.`);
    }
    return account;
  }

  async updateCompanyBankAccount(id: number, dto: UpdateCompanyBankAccountDto, userId: number) {
    const repo = this.companyBankAccountRepository || this.dataSource.getRepository(CompanyBankAccount);
    const account = await this.getCompanyBankAccountById(id);

    if (!dto.changeReason || dto.changeReason.trim().length === 0) {
      throw new BadRequestException('Alasan perubahan (changeReason) wajib diisi untuk setiap modifikasi master rekening bank.');
    }

    // Check duplicate if updating bankName or accountNumber
    const newBankName = dto.bankName ? dto.bankName.trim() : account.bankName;
    const newAccountNumber = dto.accountNumber ? dto.accountNumber.trim() : account.accountNumber;
    if (newBankName !== account.bankName || newAccountNumber !== account.accountNumber) {
      const duplicate = await repo.findOne({
        where: {
          companyCode: account.companyCode,
          bankName: newBankName,
          accountNumber: newAccountNumber,
          deletedAt: IsNull(),
        },
      });
      if (duplicate && Number(duplicate.id) !== Number(id)) {
        throw new ConflictException(
          `Rekening bank ${newBankName} dengan nomor ${newAccountNumber} untuk entitas ${account.companyCode} sudah terdaftar.`
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const oldValue = {
        bankName: account.bankName,
        bankCode: account.bankCode,
        accountNumber: account.accountNumber,
        accountHolderName: account.accountHolderName,
        accountType: account.accountType,
        accountPurpose: account.accountPurpose,
        currency: account.currency,
        status: account.status,
        isDefault: account.isDefault,
        effectiveDate: account.effectiveDate,
        expiryDate: account.expiryDate,
        picName: account.picName,
        notes: account.notes,
        lastChangeReason: account.lastChangeReason,
      };

      if (dto.isDefault) {
        // Demote existing default accounts for this legal entity
        await queryRunner.manager.update(
          CompanyBankAccount,
          { companyCode: account.companyCode, isDefault: true, deletedAt: IsNull() },
          { isDefault: false, updatedBy: userId }
        );
        account.isDefault = true;
      } else if (dto.isDefault === false) {
        account.isDefault = false;
      }

      if (dto.bankName !== undefined) account.bankName = dto.bankName.trim();
      if (dto.bankCode !== undefined) account.bankCode = dto.bankCode ? dto.bankCode.trim() : null;
      if (dto.accountNumber !== undefined) account.accountNumber = dto.accountNumber.trim();
      if (dto.accountHolderName !== undefined) account.accountHolderName = dto.accountHolderName.trim();
      if (dto.accountType !== undefined) account.accountType = dto.accountType;
      if (dto.accountPurpose !== undefined) account.accountPurpose = dto.accountPurpose;
      if (dto.currency !== undefined) account.currency = dto.currency ? dto.currency.trim().toUpperCase() : 'IDR';
      if (dto.status !== undefined) {
        account.status = dto.status;
        if (dto.status !== CompanyBankAccountStatus.ACTIVE) {
          account.isDefault = false;
        }
      }
      if (dto.effectiveDate !== undefined) account.effectiveDate = dto.effectiveDate;
      if (dto.expiryDate !== undefined) account.expiryDate = dto.expiryDate || null;
      if (dto.picName !== undefined) account.picName = dto.picName ? dto.picName.trim() : null;
      if (dto.notes !== undefined) account.notes = dto.notes ? dto.notes.trim() : null;

      account.lastChangeReason = dto.changeReason.trim();
      account.updatedBy = userId;

      const savedAccount = await queryRunner.manager.save(CompanyBankAccount, account);

      // Audit Log
      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'company_bank_accounts',
        record_id: savedAccount.id,
        action: 'UPDATE',
        old_value: oldValue,
        new_value: {
          ...account,
          changeReason: dto.changeReason.trim(),
        },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      await queryRunner.commitTransaction();
      return savedAccount;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async activateCompanyBankAccount(id: number, changeReason: string, userId: number) {
    if (!changeReason || changeReason.trim().length === 0) {
      throw new BadRequestException('Alasan aktivasi (changeReason) wajib disertakan.');
    }
    const account = await this.getCompanyBankAccountById(id);
    if (account.status === CompanyBankAccountStatus.ACTIVE) return account;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const oldValue = { status: account.status, lastChangeReason: account.lastChangeReason };
      account.status = CompanyBankAccountStatus.ACTIVE;
      account.lastChangeReason = changeReason.trim();
      account.updatedBy = userId;
      const savedAccount = await queryRunner.manager.save(CompanyBankAccount, account);

      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'company_bank_accounts',
        record_id: savedAccount.id,
        action: 'ACTIVATE',
        old_value: oldValue,
        new_value: { status: savedAccount.status, changeReason: changeReason.trim() },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      await queryRunner.commitTransaction();
      return savedAccount;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async deactivateCompanyBankAccount(id: number, changeReason: string, userId: number) {
    if (!changeReason || changeReason.trim().length === 0) {
      throw new BadRequestException('Alasan penonaktifan (changeReason) wajib disertakan.');
    }
    const account = await this.getCompanyBankAccountById(id);
    if (account.status === CompanyBankAccountStatus.INACTIVE) return account;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const oldValue = { status: account.status, isDefault: account.isDefault, lastChangeReason: account.lastChangeReason };
      account.status = CompanyBankAccountStatus.INACTIVE;
      account.isDefault = false;
      account.lastChangeReason = changeReason.trim();
      account.updatedBy = userId;
      const savedAccount = await queryRunner.manager.save(CompanyBankAccount, account);

      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'company_bank_accounts',
        record_id: savedAccount.id,
        action: 'DEACTIVATE',
        old_value: oldValue,
        new_value: { status: savedAccount.status, isDefault: savedAccount.isDefault, changeReason: changeReason.trim() },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      await queryRunner.commitTransaction();
      return savedAccount;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async blockCompanyBankAccount(id: number, changeReason: string, userId: number) {
    if (!changeReason || changeReason.trim().length === 0) {
      throw new BadRequestException('Alasan pemblokiran (changeReason) wajib disertakan.');
    }
    const account = await this.getCompanyBankAccountById(id);
    if (account.status === CompanyBankAccountStatus.BLOCKED) return account;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const oldValue = { status: account.status, isDefault: account.isDefault, lastChangeReason: account.lastChangeReason };
      account.status = CompanyBankAccountStatus.BLOCKED;
      account.isDefault = false;
      account.lastChangeReason = changeReason.trim();
      account.updatedBy = userId;
      const savedAccount = await queryRunner.manager.save(CompanyBankAccount, account);

      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'company_bank_accounts',
        record_id: savedAccount.id,
        action: 'BLOCK',
        old_value: oldValue,
        new_value: { status: savedAccount.status, isDefault: savedAccount.isDefault, changeReason: changeReason.trim() },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      await queryRunner.commitTransaction();
      return savedAccount;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async setDefaultCompanyBankAccount(id: number, changeReason: string, userId: number) {
    if (!changeReason || changeReason.trim().length === 0) {
      throw new BadRequestException('Alasan penentuan rekening default (changeReason) wajib disertakan.');
    }
    const account = await this.getCompanyBankAccountById(id);
    if (account.status !== CompanyBankAccountStatus.ACTIVE) {
      throw new BadRequestException('Hanya rekening berstatus ACTIVE yang dapat dijadikan rekening utama (default).');
    }

    const today = new Date().toISOString().slice(0, 10);
    const effStr = account.effectiveDate instanceof Date ? account.effectiveDate.toISOString().slice(0, 10) : String(account.effectiveDate).slice(0, 10);
    if (effStr > today) {
      throw new BadRequestException('Rekening yang belum berlaku efektif tidak dapat dijadikan rekening utama (default).');
    }
    if (account.expiryDate) {
      const expStr = account.expiryDate instanceof Date ? account.expiryDate.toISOString().slice(0, 10) : String(account.expiryDate).slice(0, 10);
      if (expStr < today) {
        throw new BadRequestException('Rekening yang telah kedaluwarsa tidak dapat dijadikan rekening utama (default).');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Demote all other accounts of the same legal entity
      await queryRunner.manager.update(
        CompanyBankAccount,
        { companyCode: account.companyCode, isDefault: true, deletedAt: IsNull() },
        { isDefault: false, updatedBy: userId }
      );

      account.isDefault = true;
      account.lastChangeReason = changeReason.trim();
      account.updatedBy = userId;
      const savedAccount = await queryRunner.manager.save(CompanyBankAccount, account);

      const auditLog = queryRunner.manager.create(AuditLog, {
        table_name: 'company_bank_accounts',
        record_id: savedAccount.id,
        action: 'SET_DEFAULT',
        old_value: { isDefault: false },
        new_value: { isDefault: true, changeReason: changeReason.trim() },
        created_by: userId ? Number(userId) : null,
      });
      await queryRunner.manager.save(AuditLog, auditLog);

      await queryRunner.commitTransaction();
      return savedAccount;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getCompanyBankAccountHistory(id: number) {
    await this.getCompanyBankAccountById(id);
    const auditRepo = this.dataSource.getRepository(AuditLog);
    return auditRepo.find({
      where: {
        table_name: 'company_bank_accounts',
        record_id: id,
      },
      order: { created_at: 'DESC' },
    });
  }
}

export interface EligibleInvoiceObligation {
  obligationId: string;
  orderType: 'MATERIAL' | 'SERVICE';
  poId: number;
  poNumber: string;
  vendorName?: string;
  projectName?: string;
  projectId?: number;
  paymentTermId?: number;
  paymentTermName?: string;
  paymentTermSequence?: number;
  serviceClaimId?: number;
  serviceClaimNumber?: string;
  amount: number;
  eligibleAt: Date;
  triggerCondition?: string;
  actionTarget: string;
}


