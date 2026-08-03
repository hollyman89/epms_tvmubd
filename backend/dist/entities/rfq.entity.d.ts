import { PurchaseRequest } from './purchase-request.entity';
export declare class Rfq {
    id: number;
    prId: number;
    rfqNumber: string;
    status: string;
    closingDate: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    purchaseRequest: PurchaseRequest;
}
