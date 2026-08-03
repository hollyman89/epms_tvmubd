import { Tender } from './tender.entity';
import { User } from './user.entity';
export declare enum ActivityType {
    SYSTEM = "SYSTEM",
    COMMENT = "COMMENT"
}
export declare class TenderActivity {
    id: number;
    tender_id: number;
    user_id: number;
    type: ActivityType;
    content: string;
    tender: Tender;
    user: User;
    created_at: Date;
}
