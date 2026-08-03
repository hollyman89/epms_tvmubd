import { HttpStatus } from '@nestjs/common';
import { LegalService } from './legal.service';
import { SlaGraceService } from './sla-grace.service';
import { LegalReviewDto } from './dto/legal-review.dto';
export declare class LegalController {
    private readonly legalService;
    private readonly slaGraceService;
    constructor(legalService: LegalService, slaGraceService: SlaGraceService);
    getPendingContracts(status?: string): Promise<import("../../entities/contract.entity").Contract[]>;
    getContracts(status?: string): Promise<import("../../entities/contract.entity").Contract[]>;
    reviewContract(dto: LegalReviewDto, req: any): Promise<import("../../entities/contract.entity").Contract>;
    reviewContractAlias(dto: LegalReviewDto, req: any): Promise<import("../../entities/contract.entity").Contract>;
    requestGraceExtension(id: number, daysToAdd: number, reason: string, req: any): Promise<{
        statusCode: number;
        contractId: number;
        extensionCount: number;
        maxLimit: number;
        graceDeadline: string;
        message: string;
    }>;
    getActiveGraceWidget(): Promise<{
        statusCode: HttpStatus;
        message: string;
        data: {
            contractId: number;
            contractNumber: string;
            extensionCount: number;
            maxLimit: number;
            graceDeadline: Date;
            extendedAt: Date;
            status: string;
        }[];
    }>;
    getPdfGenerationStatus(id: number): Promise<{
        statusCode: HttpStatus;
        data: {
            status: string;
            downloadUrl: any;
            retryAfter: number;
            errorDetails: string;
        };
    }>;
}
