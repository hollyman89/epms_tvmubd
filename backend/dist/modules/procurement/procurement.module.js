"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcurementModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const procurement_controller_1 = require("./procurement.controller");
const procurement_service_1 = require("./procurement.service");
const workflow_module_1 = require("../workflow-engine/workflow.module");
const purchase_request_entity_1 = require("../../entities/purchase-request.entity");
const purchase_request_item_entity_1 = require("../../entities/purchase-request-item.entity");
const rfq_entity_1 = require("../../entities/rfq.entity");
const vendor_comparison_entity_1 = require("../../entities/vendor-comparison.entity");
const purchase_order_entity_1 = require("../../entities/purchase-order.entity");
const purchase_order_item_entity_1 = require("../../entities/purchase-order-item.entity");
const goods_receipt_entity_1 = require("../../entities/goods-receipt.entity");
const goods_receipt_item_entity_1 = require("../../entities/goods-receipt-item.entity");
let ProcurementModule = class ProcurementModule {
};
exports.ProcurementModule = ProcurementModule;
exports.ProcurementModule = ProcurementModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                purchase_request_entity_1.PurchaseRequest,
                purchase_request_item_entity_1.PurchaseRequestItem,
                rfq_entity_1.Rfq,
                vendor_comparison_entity_1.VendorComparison,
                purchase_order_entity_1.PurchaseOrder,
                purchase_order_item_entity_1.PurchaseOrderItem,
                goods_receipt_entity_1.GoodsReceipt,
                goods_receipt_item_entity_1.GoodsReceiptItem
            ]),
            workflow_module_1.WorkflowModule,
        ],
        controllers: [procurement_controller_1.ProcurementController],
        providers: [procurement_service_1.ProcurementService],
        exports: [procurement_service_1.ProcurementService],
    })
], ProcurementModule);
//# sourceMappingURL=procurement.module.js.map