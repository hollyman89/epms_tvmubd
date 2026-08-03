import { Injectable, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, OptimisticLockVersionMismatchError } from 'typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceItem } from '../../entities/invoice-item.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
    private readonly eventEmitter: EventEmitter2
  ) {}

  async createInvoice(dto: CreateInvoiceDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify PO is COMPLETED
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: dto.purchaseOrderId },
        relations: ['items']
      });

      if (!po) {
        throw new BadRequestException('PO not found');
      }

      if (po.status !== 'COMPLETED') {
        throw new BadRequestException('Invoice can only be created for COMPLETED Purchase Orders');
      }

      // 2. Generate Invoice Number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await queryRunner.manager.count(Invoice, {
        where: { invoiceNumber: Like(`INV-${dateStr}%`) }
      });
      const seq = String(count + 1).padStart(3, '0');
      const invoiceNumber = `INV-${dateStr}-${seq}`;

      // 3. Create Invoice Object
      let totalInvoiceAmount = 0;
      const invoiceItems: InvoiceItem[] = [];

      for (const itemDto of dto.items) {
        const poItem = po.items.find(i => i.id === itemDto.poItemId);
        if (!poItem) {
          throw new BadRequestException(`PO Item ${itemDto.poItemId} not found in this PO`);
        }

        const invItem = new InvoiceItem();
        invItem.poItemId = itemDto.poItemId;
        invItem.quantity = itemDto.quantity;
        invItem.unitPrice = itemDto.unitPrice;
        invItem.totalPrice = itemDto.totalPrice;
        invItem.createdBy = userId;
        
        // Validation constraint logic could be added here
        
        invoiceItems.push(invItem);
        totalInvoiceAmount += itemDto.totalPrice;
      }

      // 4. Calculate 3-Way Matching Data
      // Total PO
      const totalPoAmount = Number(po.totalAmount);
      
      // Total GR
      const goodsReceipts = await queryRunner.manager.find(GoodsReceipt, {
        where: { poId: po.id },
        relations: ['items']
      });
      
      let totalGrAmount = 0;
      for (const gr of goodsReceipts) {
        for (const grItem of gr.items) {
          const matchedPoItem = po.items.find(i => i.id === grItem.poItemId);
          if (matchedPoItem) {
            totalGrAmount += Number(grItem.receivedQuantity) * Number(matchedPoItem.unitPrice);
          }
        }
      }

      // 5. Evaluate Match Status
      const isMatched = (
        Math.abs(totalInvoiceAmount - totalPoAmount) < 0.01 && 
        Math.abs(totalPoAmount - totalGrAmount) < 0.01
      );
      const matchStatus = isMatched ? 'MATCHED' : 'MISMATCHED';

      const invoice = new Invoice();
      invoice.poId = po.id;
      invoice.invoiceNumber = invoiceNumber;
      invoice.invoiceDate = new Date(dto.invoiceDate);
      invoice.totalAmount = totalInvoiceAmount;
      invoice.matchStatus = matchStatus;
      invoice.createdBy = userId;
      invoice.items = invoiceItems;

      const savedInvoice = await queryRunner.manager.save(invoice);
      
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
          createdAt: new Date().toISOString()
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
      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: dto.invoiceId }
      });

      if (!invoice) {
        throw new BadRequestException('Invoice not found');
      }

      if (invoice.matchStatus !== 'MATCHED') {
        throw new BadRequestException('Invoice belum disetujui untuk pembayaran');
      }

      if (invoice.paymentStatus === 'PAID') {
        throw new BadRequestException('Invoice is already PAID');
      }
      
      if (dto.paymentAmount > Number(invoice.totalAmount)) {
        throw new BadRequestException('Payment amount cannot exceed invoice total amount');
      }

      // Generate Payment Number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await queryRunner.manager.count(Payment, {
        where: { paymentNumber: Like(`PAY-${dateStr}%`) }
      });
      const seq = String(count + 1).padStart(3, '0');
      const paymentNumber = `PAY-${dateStr}-${seq}`;

      const payment = new Payment();
      payment.invoiceId = invoice.id;
      payment.paymentNumber = paymentNumber;
      payment.paymentDate = new Date(dto.paymentDate);
      payment.amount = dto.paymentAmount;
      // payment.paymentMethod = dto.paymentMethod; // Not in entity
      // payment.referenceNumber = dto.referenceNumber; // Not in entity
      payment.createdBy = userId;

      await queryRunner.manager.save(payment);

      invoice.paymentStatus = 'PAID';
      invoice.updatedBy = userId;
      await queryRunner.manager.save(invoice);

      await queryRunner.commitTransaction();

      // Emit event for notification
      this.eventEmitter.emit('finance.payment_processed', {
        paymentId: payment.id,
        invoiceId: invoice.id,
        poId: invoice.poId,
        paymentNumber: payment.paymentNumber,
        amount: payment.amount,
        message: `Pembayaran untuk PO #${invoice.poId} telah diproses`,
        timestamp: new Date().toISOString()
      });

      return payment;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      if (
        err instanceof OptimisticLockVersionMismatchError ||
        err.name === 'OptimisticLockVersionMismatchError' ||
        err.message?.includes('OptimisticLockVersionMismatchError')
      ) {
        throw new ConflictException('Data pembayaran telah berubah, silakan reload halaman');
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getInvoices() {
    return this.invoiceRepository.find({
      relations: ['items', 'purchaseOrder']
    });
  }

  async getPayments() {
    return this.paymentRepository.find({
      relations: ['invoice']
    });
  }
}
