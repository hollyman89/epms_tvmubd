import { Contract } from './contract.entity';
import { User } from './user.entity';
export declare class ContractAmendment {
    id: number;
    contract_id: number;
    version_number: number;
    old_value: number;
    new_value: number;
    reason: string;
    approved_by: number;
    contract: Contract;
    approver: User;
    created_at: Date;
    updated_at: Date;
}
