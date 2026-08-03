import { PurchaseRequest } from './purchase-request.entity';
export declare class PurchaseRequestItem {
    id: number;
    prId: number;
    itemName: string;
    quantity: number;
    uom: string;
    estimatedUnitPrice: number;
    totalPrice: number;
    purchaseRequest: PurchaseRequest;
    createdAt: Date;
    updatedAt: Date;
}
