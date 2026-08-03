import { PurchaseRequestItem } from './purchase-request-item.entity';
import { Rfq } from './rfq.entity';
export declare class PurchaseRequest {
    id: number;
    version: number;
    projectId: number;
    requesterId: number;
    prNumber: string;
    totalEstimatedAmount: number;
    status: string;
    items: PurchaseRequestItem[];
    rfqs: Rfq[];
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
}
