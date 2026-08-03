import { Tender } from './tender.entity';
import { Contract } from './contract.entity';
export declare class Proposal {
    id: number;
    tender_id: number;
    proposal_number: string;
    proposed_amount: number;
    status: string;
    tender: Tender;
    contracts: Contract[];
    created_by: number;
    updated_by: number;
    deleted_by: number;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
}
