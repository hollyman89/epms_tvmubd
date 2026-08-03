import { PurchaseOrder } from './purchase-order.entity';
export declare class PurchaseOrderItem {
    id: number;
    purchaseOrderId: number;
    itemName: string;
    quantity: number;
    receivedQuantity: number;
    unitPrice: number;
    totalPrice: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    purchaseOrder: PurchaseOrder;
}
