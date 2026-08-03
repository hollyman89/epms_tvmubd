import { Repository, DataSource } from 'typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class FinanceService {
    private dataSource;
    private poRepository;
    private grRepository;
    private invoiceRepository;
    private paymentRepository;
    private readonly eventEmitter;
    constructor(dataSource: DataSource, poRepository: Repository<PurchaseOrder>, grRepository: Repository<GoodsReceipt>, invoiceRepository: Repository<Invoice>, paymentRepository: Repository<Payment>, eventEmitter: EventEmitter2);
    createInvoice(dto: CreateInvoiceDto, userId: number): Promise<Invoice>;
    createPayment(dto: CreatePaymentDto, userId: number): Promise<Payment>;
    getInvoices(): Promise<Invoice[]>;
    getPayments(): Promise<Payment[]>;
}
