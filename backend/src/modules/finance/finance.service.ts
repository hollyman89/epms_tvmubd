import { Injectable, BadRequestException, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, In, OptimisticLockVersionMismatchError, EntityManager } from 'typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceItem } from '../../entities/invoice-item.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { PoPaymentTerm, PaymentTermStatus, PaymentTermType } from '../../entities/po-payment-term.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyInvoiceDto } from './dto/verify-invoice.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MismatchCode, MatchingMismatch, MatchingResult } from './finance.types';

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
    private readonly eventEmitter: EventEmitter2
  ) {}

  async createInvoice(dto: CreateInvoiceDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Find and lock Purchase Order with pessimistic_write
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: dto.purchaseOrderId },
        lock: { mode: 'pessimistic_write' },
        relations: ['items', 'paymentTerms'],
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

      // ==========================================
      // BRANCH A: TERM-BASED INVOICE
      // ==========================================
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
        if (paymentTerm.termType === PaymentTermType.PROGRESS) {
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

          const currentTermAmount = Number(paymentTerm.amount);
          if (Math.round((previousProgressBilled + currentTermAmount) * 100) / 100 > Math.round(totalReceivedPhysicalValue * 100) / 100 + 0.01) {
            throw new BadRequestException(
              `Akumulasi penagihan progress (Rp${(previousProgressBilled + currentTermAmount).toLocaleString('id-ID')}) melebihi total nilai fisik barang yang telah diterima (Rp${totalReceivedPhysicalValue.toLocaleString('id-ID')}).`
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
        const poTotalAmount = Number(po.totalAmount || 0);
        if (Math.round((activeInvoicedSum + totalInvoiceAmount) * 100) / 100 > poTotalAmount + 0.01) {
          throw new BadRequestException('Akumulasi nilai invoice melebihi total Purchase Order.');
        }

        // A9. Invoice Items handling
        const invoiceItems: InvoiceItem[] = [];
        if (paymentTerm.termType === PaymentTermType.PROGRESS) {
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
                const authoritativeTotalPrice = Math.round(billableQty * authoritativeUnitPrice * 100) / 100;

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
        } else {
          // DP and Retention
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
          }
        }

        // A10. Create and Save Invoice
        const invoice = new Invoice();
        invoice.poId = po.id;
        invoice.paymentTermId = paymentTerm.id;
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

        await queryRunner.commitTransaction();
        return savedInvoice;
      }

      // ==========================================
      // BRANCH B: LEGACY / FULL PO INVOICE
      // ==========================================
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
          const authoritativeTotalPrice = Math.round(itemQty * authoritativeUnitPrice * 100) / 100;

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
      totalInvoiceAmount = Math.round(totalInvoiceAmount * 100) / 100;

      // Calculate 3-Way Matching Data
      const totalPoAmount = Number(po.totalAmount);
      const goodsReceipts = await queryRunner.manager.find(GoodsReceipt, {
        where: { poId: po.id },
        relations: ['items'],
      });

      let totalGrAmount = 0;
      for (const gr of goodsReceipts) {
        for (const grItem of gr.items) {
          const matchedPoItem = po.items?.find(i => i.id === grItem.poItemId);
          if (matchedPoItem) {
            totalGrAmount += Number(grItem.receivedQuantity) * Number(matchedPoItem.unitPrice);
          }
        }
      }

      const isMatched = (
        Math.abs(totalInvoiceAmount - totalPoAmount) < 0.01 &&
        Math.abs(totalPoAmount - totalGrAmount) < 0.01
      );
      const matchStatus = isMatched ? 'MATCHED' : 'MISMATCHED';

      const invoice = new Invoice();
      invoice.poId = po.id;
      invoice.invoiceNumber = invoiceNumber;
      invoice.invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
      invoice.totalAmount = totalInvoiceAmount;
      invoice.matchStatus = matchStatus;
      invoice.paymentStatus = 'UNPAID';
      invoice.status = 'UNPAID';
      invoice.createdBy = userId;
      invoice.items = invoiceItems;

      const savedInvoice = await queryRunner.manager.save(Invoice, invoice);

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

      await queryRunner.commitTransaction();

      // Emit event if mismatched
      if (!isMatched) {
        this.eventEmitter.emit('finance.mismatch', {
          invoiceId: savedInvoice.id,
          invoiceNumber: savedInvoice.invoiceNumber,
          poId: po.id,
          totalInvoice: totalInvoiceAmount,
          totalPO: totalPoAmount,
          totalGR: totalGrAmount,
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
      });

      if (!invoice || invoice.deletedAt) {
        throw new BadRequestException('Invoice not found');
      }

      // 1.b Segregation of Duties (SoD): Authoritative Verifier Check
      let verifierId: number | null = null;
      const verifyAudit = await queryRunner.manager.findOne(AuditLog, {
        where: { table_name: 'invoices', record_id: invoice.id, action: 'VERIFY' },
        order: { id: 'DESC' },
      });
      if (verifyAudit && verifyAudit.created_by) {
        verifierId = Number(verifyAudit.created_by);
      } else if (invoice.updatedBy) {
        verifierId = Number(invoice.updatedBy);
      }

      if (invoice.paymentTermId) {
        // TERM-BASED INVOICE
        if (!verifierId || (invoice.createdBy && verifierId === Number(invoice.createdBy))) {
          throw new BadRequestException('Prinsip Segregation of Duties (SoD) melarang pembuat invoice (Maker) melakukan pembayaran.');
        }
        if (verifierId === Number(userId)) {
          throw new BadRequestException('Prinsip Segregation of Duties (SoD) melarang verifikator invoice (Checker) melakukan pembayaran.');
        }
      } else {
        // LEGACY INVOICE
        if (invoice.createdBy && Number(invoice.createdBy) === Number(userId)) {
          throw new BadRequestException('Prinsip Segregation of Duties (SoD) melarang pembuat invoice (Maker) melakukan pembayaran.');
        }
        if (verifierId && verifierId === Number(userId)) {
          throw new BadRequestException('Prinsip Segregation of Duties (SoD) melarang verifikator invoice (Checker) melakukan pembayaran.');
        }
      }

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

      // 5. Calculate Already Paid & Remaining on Invoice
      const existingPayments = (await queryRunner.manager.find(Payment, {
        where: { invoiceId: invoice.id },
      })) || [];
      let alreadyPaid = 0;
      for (const p of existingPayments) {
        if (!p.deletedAt) {
          alreadyPaid += Number(p.amount);
        }
      }
      alreadyPaid = Math.round(alreadyPaid * 100) / 100;
      const invoiceTotal = Number(invoice.totalAmount);
      const remaining = Math.round((invoiceTotal - alreadyPaid) * 100) / 100;

      if (Math.round(paymentAmount * 100) / 100 > remaining + 0.001) {
        throw new BadRequestException(
          `Payment amount (${paymentAmount}) melebihi sisa tagihan invoice (${remaining})`
        );
      }

      // 6. PO-Level Overpayment Guard
      if (invoice.poId) {
        const po = await queryRunner.manager.findOne(PurchaseOrder, {
          where: { id: invoice.poId },
        });
        if (po) {
          const poInvoices = (await queryRunner.manager.find(Invoice, {
            where: { poId: po.id },
          })) || [];
          const poInvoiceIds = poInvoices.map((inv) => inv.id);

          let totalPoPaidBefore = 0;
          if (poInvoiceIds.length > 0) {
            const allPoPayments = (await queryRunner.manager.find(Payment, {
              where: { invoiceId: In(poInvoiceIds) },
            })) || [];
            for (const p of allPoPayments) {
              if (!p.deletedAt) {
                totalPoPaidBefore += Number(p.amount);
              }
            }
          }
          totalPoPaidBefore = Math.round(totalPoPaidBefore * 100) / 100;
          const poTotal = Number(po.totalAmount || 0);
          const projectedTotalPaid = Math.round((totalPoPaidBefore + paymentAmount) * 100) / 100;

          if (projectedTotalPaid > poTotal + 0.001) {
            throw new BadRequestException(
              `Akumulasi pembayaran PO (${projectedTotalPaid}) melebihi total Purchase Order (${poTotal})`
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

        if (paymentTerm.status === PaymentTermStatus.PAID) {
          throw new BadRequestException('Payment term sudah lunas (PAID)');
        }

        if (paymentTerm.status !== PaymentTermStatus.VERIFIED) {
          throw new BadRequestException(
            `Pembayaran termin hanya dapat diproses untuk termin berstatus VERIFIED (status saat ini: ${paymentTerm.status})`
          );
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
      payment.paymentNumber = paymentNumber;
      payment.paymentDate = new Date(dto.paymentDate);
      payment.amount = paymentAmount;
      payment.createdBy = userId;

      const saved = await queryRunner.manager.save(Payment, payment);
      const savedPayment = (saved && (saved.paymentNumber || saved.id)) ? { ...payment, ...saved } : payment;

      // 10. Update Invoice Payment Status
      const remainingAfter = Math.round((remaining - paymentAmount) * 100) / 100;
      const isFullyPaid = remainingAfter <= 0.01;

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
          let cumulativePoPayments = 0;
          if (activeInvoiceIds.length > 0) {
            const allPoPayments = (await queryRunner.manager.find(Payment, {
              where: { invoiceId: In(activeInvoiceIds) },
            })) || [];
            for (const p of allPoPayments) {
              if (!p.deletedAt) {
                cumulativePoPayments += Number(p.amount);
              }
            }
          }
          cumulativePoPayments = Math.round(cumulativePoPayments * 100) / 100;
          const poTotal = Number(lockedPo.totalAmount || 0);

          // Authoritative Financial Closure Condition:
          // a. All active payment terms are PAID (if terms exist)
          const allTermsPaid = activeTerms.length > 0 && activeTerms.every((t) => t.status === PaymentTermStatus.PAID);
          // b. Cumulative active payments >= PO total amount
          const isPoAmountSettled = cumulativePoPayments >= poTotal - 0.001;
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
                  let prPoPaymentsSum = 0;
                  if (prPoInvIds.length > 0) {
                    const prPoPmts = (await queryRunner.manager.find(Payment, {
                      where: { invoiceId: In(prPoInvIds) },
                    })) || [];
                    for (const pm of prPoPmts) {
                      if (!pm.deletedAt) prPoPaymentsSum += Number(pm.amount);
                    }
                  }

                  if (!prPoTermsPaid || !prPoInvsPaid || prPoPaymentsSum < Number(prPo.totalAmount || 0) - 0.001) {
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

    const poTotal = po ? Number(po.totalAmount || 0) : 0;
    const invoicedAmount = Number(invoice.totalAmount || 0);

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
        if (po.status !== 'COMPLETED') {
          mismatches.push({
            code: MismatchCode.PO_NOT_ACTIVE,
            message: 'Purchase Order harus berstatus COMPLETED untuk verifikasi invoice penuh.',
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
      let activeInvoiceItems: any[] = [];
      if (po?.invoices && Array.isArray(po.invoices)) {
        activeInvoiceItems = po.invoices.filter(i => !i.deletedAt && i.status !== 'CANCELLED' && i.status !== 'REJECTED' && i.matchStatus !== 'REJECTED' && Number(i.id) !== Number(invoice.id))
                                      .flatMap(i => i.items || []);
      } else if (po?.id && em && typeof em.find === 'function') {
        const otherInvoices = (await em.find(Invoice, { where: { poId: po.id }, relations: ['items'] })) || [];
        activeInvoiceItems = otherInvoices.filter(i => !i.deletedAt && i.status !== 'CANCELLED' && i.status !== 'REJECTED' && i.matchStatus !== 'REJECTED' && Number(i.id) !== Number(invoice.id))
                                         .flatMap(i => i.items || []);
      }

      for (const invItem of invoice.items) {
        if (invItem.deletedAt) continue;

        const authoritativePoItem = poItems.find(pi => Number(pi.id) === Number(invItem.poItemId));
        
        if (!authoritativePoItem || (authoritativePoItem.purchaseOrderId && po?.id && Number(authoritativePoItem.purchaseOrderId) !== Number(po.id))) {
          mismatches.push({
            code: MismatchCode.ITEM_NOT_FOUND,
            message: `Item invoice (PO Item ID: ${invItem.poItemId}) bukan merupakan bagian dari Purchase Order ini.`,
          });
          continue; 
        }

        if (Math.abs(Number(invItem.unitPrice) - Number(authoritativePoItem.unitPrice)) > 0.01) {
          mismatches.push({
            code: MismatchCode.PRICE_MISMATCH,
            message: `Harga satuan item invoice (Rp${Number(invItem.unitPrice).toLocaleString('id-ID')}) tidak sesuai dengan harga PO (Rp${Number(authoritativePoItem.unitPrice).toLocaleString('id-ID')}).`,
          });
        }

        const previouslyInvoicedQty = activeInvoiceItems
          .filter(i => Number(i.poItemId) === Number(invItem.poItemId) && !i.deletedAt)
          .reduce((sum, i) => sum + Number(i.quantity || 0), 0);

        const currentQty = Number(invItem.quantity || 0);
        const receivedQty = Number(authoritativePoItem.receivedQuantity || 0);
        const remainingBillable = Math.max(0, receivedQty - previouslyInvoicedQty);

        if (currentQty > remainingBillable + 0.001) {
          mismatches.push({
            code: MismatchCode.QUANTITY_EXCEEDED,
            message: `Kuantitas item invoice (${currentQty}) melebihi sisa kapasitas tagih (Diterima: ${receivedQty}, Sudah ditagihkan: ${previouslyInvoicedQty}).`,
          });
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

              const currentInvoiceAmount = Number(invoice.totalAmount || 0);
              if (Math.round((previousProgressBilled + currentInvoiceAmount) * 100) / 100 > Math.round(totalReceivedPhysicalValue * 100) / 100 + 0.01) {
                mismatches.push({
                  code: MismatchCode.PROGRESS_BILLING_EXCEEDS_RECEIVED,
                  message: `Nilai akumulasi penagihan progress (Rp${(previousProgressBilled + currentInvoiceAmount).toLocaleString('id-ID')}) melebihi total nilai fisik barang yang telah diterima (Rp${totalReceivedPhysicalValue.toLocaleString('id-ID')}).`,
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
        } else if (paymentTerm.termType === PaymentTermType.FINAL_DELIVERY) {
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
      if (po && Math.round(cumulativeInvoicedAmount * 100) / 100 > Math.round(poTotal * 100) / 100 + 0.01) {
        mismatches.push({
          code: MismatchCode.CUMULATIVE_AMOUNT_EXCEEDED_PO,
          message: 'Akumulasi nilai invoice melebihi total Purchase Order.',
        });
      }

      if (paymentTerm && termAmount !== undefined) {
        if (invoicedAmount > termAmount + 0.01) {
          mismatches.push({
            code: MismatchCode.AMOUNT_EXCEEDED_TERM,
            message: `Nominal invoice (Rp${invoicedAmount.toLocaleString('id-ID')}) tidak sesuai dengan nominal termin (Rp${termAmount.toLocaleString('id-ID')}).`,
          });
        } else if (Math.round(cumulativeTermInvoicedAmount * 100) / 100 > Math.round(termAmount * 100) / 100 + 0.01) {
          mismatches.push({
            code: MismatchCode.AMOUNT_EXCEEDED_TERM,
            message: `Akumulasi invoice termin (Rp${cumulativeTermInvoicedAmount.toLocaleString('id-ID')}) melebihi nominal termin (Rp${termAmount.toLocaleString('id-ID')}).`,
          });
        }

        const priorTermInvoiced = cumulativeTermInvoicedAmount - invoicedAmount;
        if (priorTermInvoiced >= termAmount - 0.01 && invoicedAmount > 0.01) {
          mismatches.push({
            code: MismatchCode.TERM_ALREADY_INVOICED,
            message: 'Payment term sudah selesai ditagihkan seluruhnya.',
          });
        }

        remainingTermAmount = Math.max(0, Math.round((termAmount - cumulativeTermInvoicedAmount) * 100) / 100);
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
        const goodsReceipts = (await em.find(GoodsReceipt, {
          where: { poId: po.id },
          relations: ['items'],
        })) || [];

        let totalGrAmount = 0;
        for (const gr of goodsReceipts) {
          for (const grItem of gr.items || []) {
            const matchedPoItem = po.items?.find(i => i.id === grItem.poItemId);
            if (matchedPoItem) {
              totalGrAmount += Number(grItem.receivedQuantity) * Number(matchedPoItem.unitPrice);
            }
          }
        }

        const isMatched = (
          Math.abs(invoicedAmount - totalGrAmount) < 0.01
        );

        if (!isMatched) {
          mismatches.push({
            code: MismatchCode.THREE_WAY_MISMATCH,
            message: `3-Way Matching gagal: Nilai tagihan (Rp${invoicedAmount.toLocaleString('id-ID')}) tidak sesuai dengan nilai penerimaan barang (Rp${totalGrAmount.toLocaleString('id-ID')}).`,
          });
        }
      }
    }

    const remainingPoAmount = Math.max(0, Math.round((poTotal - cumulativeInvoicedAmount) * 100) / 100);

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
    if (cumulativePaidAmount > invoicedAmount + 0.01) {
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
      relations: ['purchaseOrder', 'purchaseOrder.items', 'purchaseOrder.vendor', 'purchaseOrder.paymentTerms', 'purchaseOrder.invoices', 'paymentTerm', 'items', 'payments'],
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
        relations: ['purchaseOrder', 'purchaseOrder.items', 'purchaseOrder.vendor', 'paymentTerm', 'items', 'payments'],
      });

      if (!invoice || invoice.deletedAt) {
        throw new BadRequestException('Invoice tidak ditemukan.');
      }

      // Maker-Checker Segregation of Duties
      if (invoice.createdBy && Number(invoice.createdBy) === Number(userId)) {
        throw new BadRequestException('Maker-Checker Violation: Anda tidak dapat memverifikasi invoice yang Anda buat sendiri.');
      }

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

        await queryRunner.commitTransaction();

        this.eventEmitter.emit('finance.invoice_rejected', {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          poId: invoice.poId,
          paymentTermId: invoice.paymentTermId,
          rejectedBy: userId,
          notes: dto.notes,
          timestamp: new Date().toISOString(),
        });

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

      await queryRunner.commitTransaction();

      matchingResult.status = 'VERIFIED';

      this.eventEmitter.emit('finance.invoice_verified', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        poId: invoice.poId,
        paymentTermId: lockedPaymentTerm?.id,
        termName: lockedPaymentTerm?.termName,
        termType: lockedPaymentTerm?.termType,
        amount: invoice.totalAmount,
        verifiedBy: userId,
        evidenceRef: dto.evidenceRef,
        notes: dto.notes,
        timestamp: new Date().toISOString(),
      });

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
      } catch (_) {}
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

  async getInvoices() {
    return this.invoiceRepository.find({
      relations: [
        'items',
        'purchaseOrder',
        'purchaseOrder.vendor',
        'purchaseOrder.purchaseRequest',
        'purchaseOrder.purchaseRequest.project',
        'paymentTerm',
      ],
    });
  }

  async getInvoiceById(id: number) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: [
        'items',
        'purchaseOrder',
        'purchaseOrder.vendor',
        'purchaseOrder.purchaseRequest',
        'purchaseOrder.purchaseRequest.project',
        'paymentTerm',
        'payments',
      ],
    });
    if (!invoice) {
      throw new BadRequestException('Invoice tidak ditemukan');
    }
    return invoice;
  }

  async getPayments() {
    return this.paymentRepository.find({
      relations: [
        'invoice',
        'invoice.purchaseOrder',
        'invoice.purchaseOrder.vendor',
        'invoice.purchaseOrder.purchaseRequest',
        'invoice.purchaseOrder.purchaseRequest.project',
      ],
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
}

