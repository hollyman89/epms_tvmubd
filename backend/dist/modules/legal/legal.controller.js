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
exports.LegalController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const legal_service_1 = require("./legal.service");
const sla_grace_service_1 = require("./sla-grace.service");
const legal_review_dto_1 = require("./dto/legal-review.dto");
let LegalController = class LegalController {
    constructor(legalService, slaGraceService) {
        this.legalService = legalService;
        this.slaGraceService = slaGraceService;
    }
    async getPendingContracts(status) {
        return await this.legalService.getPendingContracts(status);
    }
    async getContracts(status) {
        return await this.legalService.getContractsByStatus(status);
    }
    async reviewContract(dto, req) {
        const userId = req.user?.sub || req.user?.userId || req.user?.id || 1;
        return await this.legalService.reviewContract(dto, userId);
    }
    async reviewContractAlias(dto, req) {
        const userId = req.user?.sub || req.user?.userId || req.user?.id || 1;
        return await this.legalService.reviewContract(dto, userId);
    }
    async requestGraceExtension(id, daysToAdd = 3, reason, req) {
        const userId = req.user?.sub || req.user?.userId;
        return await this.slaGraceService.requestGraceExtension(id, daysToAdd || 3, userId, reason);
    }
    async getActiveGraceWidget() {
        const activeExtensions = await this.slaGraceService.getActiveGraceExtensions();
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Active SLA grace extensions retrieved successfully',
            data: activeExtensions,
        };
    }
    async getPdfGenerationStatus(id) {
        return {
            statusCode: common_1.HttpStatus.OK,
            data: {
                status: 'FAILED',
                downloadUrl: null,
                retryAfter: 2,
                errorDetails: 'S3 not configured in staging. Fallback to clean dummy.'
            }
        };
    }
};
exports.LegalController = LegalController;
__decorate([
    (0, common_1.Get)('contracts/pending'),
    (0, swagger_1.ApiOperation)({ summary: 'Get contracts for legal review with optional status filter (ALL, PENDING, APPROVED, REJECTED)' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, enum: ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LegalController.prototype, "getPendingContracts", null);
__decorate([
    (0, common_1.Get)('contracts'),
    (0, swagger_1.ApiOperation)({ summary: 'RESTful endpoint to get contracts filtered by status' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, enum: ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LegalController.prototype, "getContracts", null);
__decorate([
    (0, common_1.Post)('contracts/review'),
    (0, swagger_1.ApiOperation)({ summary: 'Submit a legal review for a contract/proposal' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [legal_review_dto_1.LegalReviewDto, Object]),
    __metadata("design:returntype", Promise)
], LegalController.prototype, "reviewContract", null);
__decorate([
    (0, common_1.Post)('review'),
    (0, swagger_1.ApiOperation)({ summary: 'Submit a legal review for a contract/proposal (alias)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [legal_review_dto_1.LegalReviewDto, Object]),
    __metadata("design:returntype", Promise)
], LegalController.prototype, "reviewContractAlias", null);
__decorate([
    (0, common_1.Post)('contracts/:id/grace-extension'),
    (0, swagger_1.ApiOperation)({ summary: 'Request SLA grace deadline extension (+3 days max 3x limit)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Grace SLA deadline extended successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Maksimal perpanjangan Grace SLA (3x) telah tercapai' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)('daysToAdd')),
    __param(2, (0, common_1.Body)('reason')),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, Object]),
    __metadata("design:returntype", Promise)
], LegalController.prototype, "requestGraceExtension", null);
__decorate([
    (0, common_1.Get)('sla/grace-widget'),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch active SLA grace extensions for dashboard widget' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LegalController.prototype, "getActiveGraceWidget", null);
__decorate([
    (0, common_1.Get)('contracts/:id/pdf-generation-status'),
    (0, swagger_1.ApiOperation)({ summary: 'Polling status asinkron PDF Generation' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], LegalController.prototype, "getPdfGenerationStatus", null);
exports.LegalController = LegalController = __decorate([
    (0, swagger_1.ApiTags)('Legal & SLA Grace Engine'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('legal'),
    __metadata("design:paramtypes", [legal_service_1.LegalService,
        sla_grace_service_1.SlaGraceService])
], LegalController);
//# sourceMappingURL=legal.controller.js.map