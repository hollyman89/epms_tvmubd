"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const finance_controller_1 = require("./finance.controller");
const finance_service_1 = require("./finance.service");
const invoice_entity_1 = require("../../entities/invoice.entity");
const invoice_item_entity_1 = require("../../entities/invoice-item.entity");
const payment_entity_1 = require("../../entities/payment.entity");
const purchase_order_entity_1 = require("../../entities/purchase-order.entity");
const goods_receipt_entity_1 = require("../../entities/goods-receipt.entity");
let FinanceModule = class FinanceModule {
};
exports.FinanceModule = FinanceModule;
exports.FinanceModule = FinanceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                invoice_entity_1.Invoice,
                invoice_item_entity_1.InvoiceItem,
                payment_entity_1.Payment,
                purchase_order_entity_1.PurchaseOrder,
                goods_receipt_entity_1.GoodsReceipt
            ])
        ],
        controllers: [finance_controller_1.FinanceController],
        providers: [finance_service_1.FinanceService],
        exports: [finance_service_1.FinanceService],
    })
], FinanceModule);
//# sourceMappingURL=finance.module.js.map