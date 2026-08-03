import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { Rfq } from '../../entities/rfq.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { CreatePurchaseRequestDto } from './dto/create-pr.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { CreateGoodsReceiptDto } from './dto/create-gr.dto';
export declare class ProcurementService {
    private prRepo;
    private rfqRepo;
    private vendorComparisonRepo;
    private poRepo;
    private grRepo;
    private readonly workflowService;
    private readonly dataSource;
    private readonly eventEmitter;
    private readonly logger;
    constructor(prRepo: Repository<PurchaseRequest>, rfqRepo: Repository<Rfq>, vendorComparisonRepo: Repository<VendorComparison>, poRepo: Repository<PurchaseOrder>, grRepo: Repository<GoodsReceipt>, workflowService: WorkflowService, dataSource: DataSource, eventEmitter: EventEmitter2);
    createAndSubmitPurchaseRequest(userId: number, dto: CreatePurchaseRequestDto): Promise<{
        success: boolean;
        message: string;
        data: PurchaseRequest;
    }>;
    validateWbsBudget(wbsId: number, requestedAmount: number, manager?: any): Promise<boolean>;
    createRfq(dto: CreateRfqDto): Promise<{
        success: boolean;
        message: string;
        data: Rfq;
    }>;
    submitVendorComparison(rfqId: number, vendorsData: any[]): Promise<{
        success: boolean;
        message: string;
        data: VendorComparison[];
    }>;
    createPurchaseOrder(userId: number, dto: CreatePurchaseOrderDto): Promise<{
        success: boolean;
        message: string;
        data: PurchaseOrder;
    }>;
    getPurchaseOrderById(id: number): Promise<{
        success: boolean;
        message: string;
        data: PurchaseOrder;
    }>;
    createGoodsReceipt(dto: CreateGoodsReceiptDto, userId: number): Promise<{
        success: boolean;
        message: string;
        data: GoodsReceipt;
    }>;
    getGoodsReceiptById(grId: number): Promise<GoodsReceipt>;
    getAllPurchaseOrders(): Promise<PurchaseOrder[]>;
    getAllPurchaseRequests(): Promise<PurchaseRequest[]>;
}
