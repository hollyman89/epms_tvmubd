import { PurchaseRequest } from './purchase-request.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { GoodsReceipt } from './goods-receipt.entity';
import { Invoice } from './invoice.entity';
export declare class PurchaseOrder {
    id: number;
    version: number;
    purchaseRequestId: number;
    vendorId: number;
    poNumber: string;
    totalAmount: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    purchaseRequest: PurchaseRequest;
    items: PurchaseOrderItem[];
    goodsReceipts: GoodsReceipt[];
    invoices: Invoice[];
}
