import { Tender } from './tender.entity';
export declare class TenderPriceHistory {
    id: number;
    tender_id: number;
    old_price: number;
    new_price: number;
    changed_by: number;
    reason: string;
    created_at: Date;
    tender: Tender;
}
