"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcurementController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const procurement_service_1 = require("./procurement.service");
const create_pr_dto_1 = require("./dto/create-pr.dto");
const create_rfq_dto_1 = require("./dto/create-rfq.dto");
const vendor_comparison_dto_1 = require("./dto/vendor-comparison.dto");
const create_po_dto_1 = require("./dto/create-po.dto");
const create_gr_dto_1 = require("./dto/create-gr.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let ProcurementController = class ProcurementController {
    constructor(procurementService) {
        this.procurementService = procurementService;
    }
    async getAllPurchaseRequests() {
        return this.procurementService.getAllPurchaseRequests();
    }
    async createAndSubmitPurchaseRequest(req, dto) {
        const userId = req.user.userId;
        return this.procurementService.createAndSubmitPurchaseRequest(userId, dto);
    }
    async createRfq(req, dto) {
        return this.procurementService.createRfq(dto);
    }
    async submitVendorComparison(dto) {
        return this.procurementService.submitVendorComparison(dto.rfqId, dto.vendors);
    }
    async getAllPurchaseOrders() {
        return this.procurementService.getAllPurchaseOrders();
    }
    async createPurchaseOrder(req, dto) {
        const userId = req.user.userId;
        return this.procurementService.createPurchaseOrder(userId, dto);
    }
    async getPurchaseOrderById(purchaseOrderId) {
        return this.procurementService.getPurchaseOrderById(purchaseOrderId);
    }
    async createGoodsReceipt(req, dto) {
        const userId = req.user.userId;
        return this.procurementService.createGoodsReceipt(dto, userId);
    }
    async getGoodsReceiptById(goodsReceiptId) {
        return this.procurementService.getGoodsReceiptById(goodsReceiptId);
    }
};
exports.ProcurementController = ProcurementController;
__decorate([
    (0, common_1.Get)('pr'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all Purchase Requests' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProcurementController.prototype, "getAllPurchaseRequests", null);
__decorate([
    (0, common_1.Post)('pr'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new Purchase Request and Submit to Workflow' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_pr_dto_1.CreatePurchaseRequestDto]),
    __metadata("design:returntype", Promise)
], ProcurementController.prototype, "createAndSubmitPurchaseRequest", null);
__decorate([
    (0, common_1.Post)('rfqs'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new RFQ from a Purchase Request' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_rfq_dto_1.CreateRfqDto]),
    __metadata("design:returntype", Promise)
], ProcurementController.prototype, "createRfq", null);
__decorate([
    (0, common_1.Post)('vendor-comparison'),
    (0, swagger_1.ApiOperation)({ summary: 'Submit vendor comparison for an RFQ (min 3 vendors)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [vendor_comparison_dto_1.SubmitVendorComparisonDto]),
    __metadata("design:returntype", Promise)
], ProcurementController.prototype, "submitVendorComparison", null);
__decorate([
    (0, common_1.Get)('purchase-orders'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all Purchase Orders' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProcurementController.prototype, "getAllPurchaseOrders", null);
__decorate([
    (0, common_1.Post)('purchase-orders'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new Purchase Order' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_po_dto_1.CreatePurchaseOrderDto]),
    __metadata("design:returntype", Promise)
], ProcurementController.prototype, "createPurchaseOrder", null);
__decorate([
    (0, common_1.Get)('purchase-orders/:purchaseOrderId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Purchase Order details by ID' }),
    __param(0, (0, common_1.Param)('purchaseOrderId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ProcurementController.prototype, "getPurchaseOrderById", null);
__decorate([
    (0, common_1.Post)('goods-receipts'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new Goods Receipt for a Purchase Order' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_gr_dto_1.CreateGoodsReceiptDto]),
    __metadata("design:returntype", Promise)
], ProcurementController.prototype, "createGoodsReceipt", null);
__decorate([
    (0, common_1.Get)('goods-receipts/:goodsReceiptId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Goods Receipt details by ID' }),
    __param(0, (0, common_1.Param)('goodsReceiptId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ProcurementController.prototype, "getGoodsReceiptById", null);
exports.ProcurementController = ProcurementController = __decorate([
    (0, swagger_1.ApiTags)('Procurement'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('procurement'),
    __metadata("design:paramtypes", [procurement_service_1.ProcurementService])
], ProcurementController);
//# sourceMappingURL=procurement.controller.js.map