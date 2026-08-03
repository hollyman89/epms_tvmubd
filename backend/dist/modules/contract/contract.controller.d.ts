import { ContractService } from './contract.service';
import { Queue } from 'bullmq';
export declare class ContractController {
    private readonly contractService;
    private pdfQueue;
    constructor(contractService: ContractService, pdfQueue: Queue);
    findAll(): Promise<import("../../entities/contract.entity").Contract[]>;
    getPdfStatus(jobId: string): Promise<{
        jobId: string;
        status: any;
        result: any;
    } | {
        status: string;
        result: {
            url: string;
        };
        jobId?: undefined;
    }>;
    generatePdf(id: string): Promise<{
        jobId: any;
        status: string;
    }>;
    findOne(id: string): Promise<import("../../entities/contract.entity").Contract>;
    update(id: string, data: any): Promise<import("../../entities/contract.entity").Contract>;
    amend(id: string, req: any, reason: string, newValue: number): Promise<import("../../entities/contract-amendment.entity").ContractAmendment>;
    approve(id: string, req: any): Promise<import("../../entities/contract.entity").Contract>;
    verifyVersionIntegrity(id: string, version: string): Promise<{
        statusCode: number;
        contractId: number;
        version: number;
        status: string;
        integrity: string;
        documentHash: any;
        verifiedAt: string;
    }>;
}
