import { GoodsReceipt } from './goods-receipt.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
export declare class GoodsReceiptItem {
    id: number;
    grId: number;
    poItemId: number;
    receivedQuantity: number;
    remarks: string;
    createdBy: number;
    updatedBy: number;
    deletedBy: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    goodsReceipt: GoodsReceipt;
    purchaseOrderItem: PurchaseOrderItem;
}
