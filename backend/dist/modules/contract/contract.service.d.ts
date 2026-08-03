import { Repository } from 'typeorm';
import { Contract } from '../../entities/contract.entity';
import { ContractAmendment } from '../../entities/contract-amendment.entity';
import { Tender } from '../../entities/tender.entity';
import { User } from '../../entities/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class ContractService {
    private contractRepo;
    private amendmentRepo;
    private tenderRepo;
    private userRepo;
    private eventEmitter;
    constructor(contractRepo: Repository<Contract>, amendmentRepo: Repository<ContractAmendment>, tenderRepo: Repository<Tender>, userRepo: Repository<User>, eventEmitter: EventEmitter2);
    findAll(): Promise<Contract[]>;
    findOne(id: number): Promise<Contract>;
    update(id: number, data: any): Promise<Contract>;
    amend(id: number, userId: number, reason: string, newValue: number): Promise<ContractAmendment>;
    handleContractGeneration(payload: {
        tenderId: number;
        userId: number;
    }): Promise<Contract>;
    approveContract(contractId: number, userId: number): Promise<Contract>;
    computePdfSha256Hash(pdfBuffer: Buffer, metadata: {
        timestamp: string;
        version: number;
    }): string;
    verifyDocumentIntegrity(contractId: number, versionNumber: number): Promise<{
        statusCode: number;
        contractId: number;
        version: number;
        status: string;
        integrity: string;
        documentHash: any;
        verifiedAt: string;
    }>;
}
