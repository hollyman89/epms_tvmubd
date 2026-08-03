import { Response } from 'express';
import { MarketingService } from './marketing.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateTenderDto, UpdateTenderStatusDto, UpdateTenderDto } from './dto/create-tender.dto';
import { TenderDetailResponseDto } from './dto/tender-detail-response.dto';
import { CreateTenderActivityDto } from './dto/tender-activity.dto';
export declare class NegotiatePriceDto {
    new_price: number;
    reason?: string;
}
export declare class ApproveDiscountDto {
    is_approved: boolean;
    notes?: string;
}
export declare class VerifySpkDto {
    is_valid: boolean;
    notes?: string;
}
export declare class MarketingController {
    private readonly marketingService;
    constructor(marketingService: MarketingService);
    deleteTender(id: number, req: any): Promise<{
        status: string;
        message: string;
    }>;
    createCustomer(dto: CreateCustomerDto, req: any): Promise<import("../../entities/customer.entity").Customer>;
    getCustomers(): Promise<import("../../entities/customer.entity").Customer[]>;
    getTenders(req: any): Promise<any[]>;
    getTenderById(id: number, req: any): Promise<TenderDetailResponseDto>;
    createTender(dto: CreateTenderDto, req: any): Promise<import("../../entities/tender.entity").Tender>;
    getDashboardSummary(req: any, period?: string): Promise<{
        totalTenders: number;
        wonTenders: number;
        wonRevenue: number;
        winRate: number;
        totalPipeline: number;
        negotiationCount: number;
        stageBreakdown: {
            lead: number;
            qualification: number;
            proposal: number;
            negotiation: number;
            won: number;
            lost: number;
        };
    }>;
    getMarketingPics(): Promise<any>;
    updateTender(id: number, dto: UpdateTenderDto, req: any): Promise<{
        message: string;
        tender: import("../../entities/tender.entity").Tender;
    }>;
    negotiatePrice(id: number, dto: NegotiatePriceDto, req: any): Promise<{
        status: string;
        message: string;
        discount_percentage: number;
    }>;
    approveDiscount(id: number, dto: ApproveDiscountDto, req: any): Promise<{
        status: string;
        message: string;
    }>;
    uploadSpk(id: number, file: Express.Multer.File, req: any): Promise<{
        success: boolean;
        message: string;
        url: string;
        contractId: any;
    }>;
    getPresignedUrl(id: number, body: {
        filename: string;
    }, req: any): Promise<{
        status: string;
        message: string;
        presigned_url: string;
        file_key: string;
    }>;
    verifySpk(id: number, dto: VerifySpkDto, req: any): Promise<{
        status: string;
        message: string;
    }>;
    setGracePeriod(id: number, req: any): Promise<{
        status: string;
        message: string;
        tender: import("../../entities/tender.entity").Tender;
    }>;
    updateTenderStatus(id: number, dto: UpdateTenderStatusDto, req: any): Promise<{
        message: string;
        tender: import("../../entities/tender.entity").Tender;
        proposal: import("../../entities/proposal.entity").Proposal;
    } | {
        message: string;
        tender: import("../../entities/tender.entity").Tender;
        proposal?: undefined;
    }>;
    uploadProposal(id: number, file: Express.Multer.File, req: any): Promise<{
        message: string;
        filename: string;
        stage: string;
    }>;
    getTenderActivities(id: number, req: any): Promise<import("../../entities/tender-activity.entity").TenderActivity[]>;
    createTenderActivity(id: number, dto: CreateTenderActivityDto, req: any): Promise<import("../../entities/tender-activity.entity").TenderActivity>;
    downloadProposal(filename: string, res: Response): void;
}
