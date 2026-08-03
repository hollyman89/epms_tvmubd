import { PurchaseOrder } from './purchase-order.entity';
import { InvoiceItem } from './invoice-item.entity';
import { Payment } from './payment.entity';
export declare class Invoice {
    id: number;
    poId: number;
    invoiceNumber: string;
    invoiceDate: Date;
    totalAmount: number;
    matchStatus: string;
    paymentStatus: string;
    createdBy: number;
    updatedBy: number;
    deletedBy: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    version: number;
    purchaseOrder: PurchaseOrder;
    items: InvoiceItem[];
    payments: Payment[];
}
