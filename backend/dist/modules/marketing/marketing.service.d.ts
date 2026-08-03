import { OnModuleInit } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Customer } from '../../entities/customer.entity';
import { Tender } from '../../entities/tender.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Contract } from '../../entities/contract.entity';
import { TenderActivity } from '../../entities/tender-activity.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateTenderDto, UpdateTenderStatusDto } from './dto/create-tender.dto';
import { TenderDetailResponseDto } from './dto/tender-detail-response.dto';
import { CreateTenderActivityDto } from './dto/tender-activity.dto';
import { TenderPriceHistory } from '../../entities/tender-price-history.entity';
export declare class MarketingService implements OnModuleInit {
    private customerRepo;
    private tenderRepo;
    private proposalRepo;
    private contractRepo;
    private activityRepo;
    private priceHistoryRepo;
    private dataSource;
    private eventEmitter;
    constructor(customerRepo: Repository<Customer>, tenderRepo: Repository<Tender>, proposalRepo: Repository<Proposal>, contractRepo: Repository<Contract>, activityRepo: Repository<TenderActivity>, priceHistoryRepo: Repository<TenderPriceHistory>, dataSource: DataSource, eventEmitter: EventEmitter2);
    onModuleInit(): Promise<void>;
    private ensureContractTableSchema;
    private calculateProbabilityPercentage;
    createCustomer(dto: CreateCustomerDto, userId: number): Promise<Customer>;
    getCustomers(): Promise<Customer[]>;
    createTender(dto: CreateTenderDto, userId: number): Promise<Tender>;
    getTenders(userId: number, roles: string[]): Promise<any[]>;
    getTenderById(id: number, userId?: number, roles?: string[]): Promise<TenderDetailResponseDto>;
    getLegalReviews(): Promise<Contract[]>;
    getDashboardSummary(period?: string, userId?: number, roles?: string[]): Promise<{
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
    updateTender(id: number, dto: any, userId: number): Promise<{
        message: string;
        tender: Tender;
    }>;
    updateTenderStatusTransactionally(id: number, dto: UpdateTenderStatusDto, userId: number): Promise<{
        message: string;
        tender: Tender;
        proposal: Proposal;
    } | {
        message: string;
        tender: Tender;
        proposal?: undefined;
    }>;
    getTenderActivities(tenderId: number, userId?: number, roles?: string[]): Promise<TenderActivity[]>;
    createTenderActivity(tenderId: number, dto: CreateTenderActivityDto, userId: number): Promise<TenderActivity>;
    uploadProposal(tenderId: number, file: Express.Multer.File, userId: number): Promise<{
        message: string;
        filename: string;
        stage: string;
    }>;
    negotiatePrice(id: number, dto: {
        new_price: number;
        reason?: string;
    }, userId: number, userRoles?: string[]): Promise<{
        status: string;
        message: string;
        discount_percentage: number;
    }>;
    approveDiscount(id: number, dto: {
        is_approved: boolean;
        notes?: string;
    }, userId: number): Promise<{
        status: string;
        message: string;
    }>;
    getPresignedUrl(id: number, filename: string, userId: number): Promise<{
        status: string;
        message: string;
        presigned_url: string;
        file_key: string;
    }>;
    verifySpk(id: number, dto: {
        is_valid: boolean;
        notes?: string;
    }, userId: number): Promise<{
        status: string;
        message: string;
    }>;
    setGracePeriod(id: number, userId: number): Promise<{
        status: string;
        message: string;
        tender: Tender;
    }>;
    deleteTender(id: number, userId: number): Promise<{
        status: string;
        message: string;
    }>;
    saveSPKAndUpdateContract(tenderIdParam: any, file: Express.Multer.File, publicUrlParam: string, userId: number): Promise<{
        success: boolean;
        message: string;
        url: string;
        contractId: any;
    }>;
}
