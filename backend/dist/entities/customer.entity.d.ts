import { Tender } from './tender.entity';
import { User } from './user.entity';
export declare class Customer {
    id: number;
    code: string;
    name: string;
    company: string;
    contact_person: string;
    phone: string;
    email: string;
    business_sector: string;
    city: string;
    status: string;
    marketing_pic_id: number;
    marketing_pic: User;
    tenders: Tender[];
    created_by: number;
    updated_by: number;
    deleted_by: number;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
}
