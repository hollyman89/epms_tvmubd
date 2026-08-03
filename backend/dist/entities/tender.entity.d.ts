import { Customer } from './customer.entity';
import { Proposal } from './proposal.entity';
export declare enum TenderStatus {
    NEW = "NEW",
    IN_PROGRESS = "IN_PROGRESS",
    NEGOTIATION = "NEGOTIATION",
    PENDING_APPROVAL = "PENDING_APPROVAL",
    WON = "WON",
    LOST = "LOST"
}
export declare class Tender {
    id: number;
    version: number;
    customer_id: number;
    title: string;
    submission_deadline: Date;
    estimated_budget: number;
    negotiated_price: number;
    max_discount_rate: number;
    grace_deadline: Date;
    spk_file_key: string;
    spk_verification_status: string;
    marketing_pic_id: number;
    pic_customer_name: string;
    pic_customer_phone: string;
    pic_customer_email: string;
    business_sector: string;
    stage: string;
    probability_percentage: number;
    priority: string;
    source: string;
    notes: string;
    expected_closing_date: Date;
    procurement_type: string;
    project_location: string;
    bid_submission_deadline: Date;
    status: TenderStatus;
    customer: Customer;
    proposals: Proposal[];
    created_by: number;
    updated_by: number;
    deleted_by: number;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
}
