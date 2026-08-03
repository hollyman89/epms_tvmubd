import { Proposal } from './proposal.entity';
import { Customer } from './customer.entity';
import { User } from './user.entity';
import { ContractAmendment } from './contract-amendment.entity';
export declare enum LegalStatus {
    DRAFT = "DRAFT",
    ON_REVIEW = "ON_REVIEW",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    REVISION_REQUESTED = "REVISION_REQUESTED"
}
export declare class Contract {
    id: number;
    version: number;
    proposal_id: number;
    tender_id: number;
    customer_id: number;
    contract_number: string;
    contract_value: number;
    start_date: Date;
    end_date: Date;
    status: string;
    legal_status: LegalStatus;
    legal_reviewer_id: number;
    legal_notes: string;
    spk_file_url: string;
    proposal: Proposal;
    customer: Customer;
    legal_reviewer: User;
    project_manager_id: number;
    project_manager: User;
    ops_team_activated_at: Date;
    grace_deadline: Date;
    grace_extended_by: number;
    grace_extended_at: Date;
    grace_extension_count: number;
    amendments: ContractAmendment[];
    created_by: number;
    updated_by: number;
    deleted_by: number;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
}
