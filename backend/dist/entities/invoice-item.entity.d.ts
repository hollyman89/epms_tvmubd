import { Invoice } from './invoice.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
export declare class InvoiceItem {
    id: number;
    invoiceId: number;
    poItemId: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    createdBy: number;
    updatedBy: number;
    deletedBy: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    invoice: Invoice;
    purchaseOrderItem: PurchaseOrderItem;
}
