import { PurchaseOrder } from './purchase-order.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';
export declare class GoodsReceipt {
    id: number;
    version: number;
    poId: number;
    grNumber: string;
    receiptDate: Date;
    remarks: string;
    createdBy: number;
    updatedBy: number;
    deletedBy: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    purchaseOrder: PurchaseOrder;
    items: GoodsReceiptItem[];
}
