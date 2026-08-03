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
exports.FinanceController = void 0;
const common_1 = require("@nestjs/common");
const finance_service_1 = require("./finance.service");
const create_invoice_dto_1 = require("./dto/create-invoice.dto");
const create_payment_dto_1 = require("./dto/create-payment.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const swagger_1 = require("@nestjs/swagger");
let FinanceController = class FinanceController {
    constructor(financeService) {
        this.financeService = financeService;
    }
    async createInvoice(dto, req) {
        const invoice = await this.financeService.createInvoice(dto, req.user.id);
        return {
            message: 'Invoice created successfully',
            data: invoice
        };
    }
    async createPayment(dto, req) {
        const payment = await this.financeService.createPayment(dto, req.user.id);
        return {
            message: 'Payment processed successfully',
            data: payment
        };
    }
    async getInvoices() {
        const invoices = await this.financeService.getInvoices();
        return {
            message: 'Invoices retrieved successfully',
            data: invoices
        };
    }
    async getPayments() {
        const payments = await this.financeService.getPayments();
        return {
            message: 'Payments retrieved successfully',
            data: payments
        };
    }
};
exports.FinanceController = FinanceController;
__decorate([
    (0, common_1.Post)('invoices'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new Invoice (Triggers 3-Way Matching)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Invoice successfully created.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad Request (e.g. PO is not COMPLETED).' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_invoice_dto_1.CreateInvoiceDto, Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "createInvoice", null);
__decorate([
    (0, common_1.Post)('payments'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new Payment for an Invoice' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Payment successfully processed.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad Request (e.g. Invoice not MATCHED, or already PAID).' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_payment_dto_1.CreatePaymentDto, Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "createPayment", null);
__decorate([
    (0, common_1.Get)('invoices'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all Invoices' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getInvoices", null);
__decorate([
    (0, common_1.Get)('payments'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all Payments' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getPayments", null);
exports.FinanceController = FinanceController = __decorate([
    (0, swagger_1.ApiTags)('Finance'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('finance'),
    __metadata("design:paramtypes", [finance_service_1.FinanceService])
], FinanceController);
//# sourceMappingURL=finance.controller.js.map