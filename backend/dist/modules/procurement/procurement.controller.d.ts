import { ProcurementService } from './procurement.service';
import { CreatePurchaseRequestDto } from './dto/create-pr.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { SubmitVendorComparisonDto } from './dto/vendor-comparison.dto';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { CreateGoodsReceiptDto } from './dto/create-gr.dto';
export declare class ProcurementController {
    private readonly procurementService;
    constructor(procurementService: ProcurementService);
    getAllPurchaseRequests(): Promise<import("../../entities/purchase-request.entity").PurchaseRequest[]>;
    createAndSubmitPurchaseRequest(req: any, dto: CreatePurchaseRequestDto): Promise<{
        success: boolean;
        message: string;
        data: import("../../entities/purchase-request.entity").PurchaseRequest;
    }>;
    createRfq(req: any, dto: CreateRfqDto): Promise<{
        success: boolean;
        message: string;
        data: import("../../entities/rfq.entity").Rfq;
    }>;
    submitVendorComparison(dto: SubmitVendorComparisonDto): Promise<{
        success: boolean;
        message: string;
        data: import("../../entities/vendor-comparison.entity").VendorComparison[];
    }>;
    getAllPurchaseOrders(): Promise<import("../../entities/purchase-order.entity").PurchaseOrder[]>;
    createPurchaseOrder(req: any, dto: CreatePurchaseOrderDto): Promise<{
        success: boolean;
        message: string;
        data: import("../../entities/purchase-order.entity").PurchaseOrder;
    }>;
    getPurchaseOrderById(purchaseOrderId: number): Promise<{
        success: boolean;
        message: string;
        data: import("../../entities/purchase-order.entity").PurchaseOrder;
    }>;
    createGoodsReceipt(req: any, dto: CreateGoodsReceiptDto): Promise<{
        success: boolean;
        message: string;
        data: import("../../entities/goods-receipt.entity").GoodsReceipt;
    }>;
    getGoodsReceiptById(goodsReceiptId: number): Promise<import("../../entities/goods-receipt.entity").GoodsReceipt>;
}
