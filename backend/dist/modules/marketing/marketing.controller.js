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
exports.MarketingController = exports.VerifySpkDto = exports.ApproveDiscountDto = exports.NegotiatePriceDto = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path = require("path");
const fs = require("fs");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const marketing_service_1 = require("./marketing.service");
const create_customer_dto_1 = require("./dto/create-customer.dto");
const create_tender_dto_1 = require("./dto/create-tender.dto");
const tender_detail_response_dto_1 = require("./dto/tender-detail-response.dto");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/guards/roles.guard");
const tender_activity_dto_1 = require("./dto/tender-activity.dto");
const class_validator_1 = require("class-validator");
class NegotiatePriceDto {
}
exports.NegotiatePriceDto = NegotiatePriceDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], NegotiatePriceDto.prototype, "new_price", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], NegotiatePriceDto.prototype, "reason", void 0);
class ApproveDiscountDto {
}
exports.ApproveDiscountDto = ApproveDiscountDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ApproveDiscountDto.prototype, "is_approved", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ApproveDiscountDto.prototype, "notes", void 0);
class VerifySpkDto {
}
exports.VerifySpkDto = VerifySpkDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], VerifySpkDto.prototype, "is_valid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], VerifySpkDto.prototype, "notes", void 0);
let MarketingController = class MarketingController {
    constructor(marketingService) {
        this.marketingService = marketingService;
    }
    async deleteTender(id, req) {
        return await this.marketingService.deleteTender(id, req.user.userId);
    }
    async createCustomer(dto, req) {
        return await this.marketingService.createCustomer(dto, req.user.userId);
    }
    async getCustomers() {
        return await this.marketingService.getCustomers();
    }
    async getTenders(req) {
        return await this.marketingService.getTenders(req.user.userId, req.user.roles);
    }
    async getTenderById(id, req) {
        return await this.marketingService.getTenderById(id, req.user.userId, req.user.roles);
    }
    async createTender(dto, req) {
        return await this.marketingService.createTender(dto, req.user.userId);
    }
    async getDashboardSummary(req, period) {
        return await this.marketingService.getDashboardSummary(period, req.user.userId, req.user.roles);
    }
    async getMarketingPics() {
        return await this.marketingService.getMarketingPics();
    }
    async updateTender(id, dto, req) {
        return await this.marketingService.updateTender(id, dto, req.user.userId);
    }
    async negotiatePrice(id, dto, req) {
        const userId = req.user?.userId || req.user?.id;
        const userRoles = req.user?.roles || [];
        return await this.marketingService.negotiatePrice(id, dto, userId, userRoles);
    }
    async approveDiscount(id, dto, req) {
        return await this.marketingService.approveDiscount(id, dto, req.user.userId);
    }
    async uploadSpk(id, file, req) {
        if (!file) {
            throw new common_1.BadRequestException('File SPK wajib diupload');
        }
        const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
        const publicUrl = `${baseUrl}/uploads/contracts/${file.filename}`;
        return await this.marketingService.saveSPKAndUpdateContract(id, file, publicUrl, req.user.userId || req.user.sub);
    }
    async getPresignedUrl(id, body, req) {
        return await this.marketingService.getPresignedUrl(id, body.filename, req.user.userId || req.user.sub);
    }
    async verifySpk(id, dto, req) {
        return await this.marketingService.verifySpk(id, dto, req.user.userId);
    }
    async setGracePeriod(id, req) {
        return await this.marketingService.setGracePeriod(id, req.user.userId);
    }
    async updateTenderStatus(id, dto, req) {
        return await this.marketingService.updateTenderStatusTransactionally(id, dto, req.user.userId);
    }
    async uploadProposal(id, file, req) {
        if (!file) {
            throw new common_1.BadRequestException('File is required');
        }
        return await this.marketingService.uploadProposal(id, file, req.user.userId);
    }
    async getTenderActivities(id, req) {
        return await this.marketingService.getTenderActivities(id, req.user.userId, req.user.roles);
    }
    async createTenderActivity(id, dto, req) {
        return await this.marketingService.createTenderActivity(id, dto, req.user.userId);
    }
    downloadProposal(filename, res) {
        const filePath = path.join(process.cwd(), 'uploads', 'proposals', filename);
        if (!fs.existsSync(filePath)) {
            throw new common_1.NotFoundException('Proposal document not found');
        }
        return res.sendFile(filePath);
    }
};
exports.MarketingController = MarketingController;
__decorate([
    (0, common_1.Delete)('tenders/:id'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a Tender (Super Admin only)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "deleteTender", null);
__decorate([
    (0, common_1.Post)('customers'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new Customer' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_customer_dto_1.CreateCustomerDto, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "createCustomer", null);
__decorate([
    (0, common_1.Get)('customers'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all customers' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "getCustomers", null);
__decorate([
    (0, common_1.Get)('tenders'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all tenders' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "getTenders", null);
__decorate([
    (0, common_1.Get)('tenders/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get tender by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tender detail retrieved successfully.', type: tender_detail_response_dto_1.TenderDetailResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "getTenderById", null);
__decorate([
    (0, common_1.Post)('tenders'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new Tender' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_tender_dto_1.CreateTenderDto, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "createTender", null);
__decorate([
    (0, common_1.Get)('dashboard/summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Marketing Dashboard Summary (KPIs)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "getDashboardSummary", null);
__decorate([
    (0, common_1.Get)('pics'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Marketing PICs' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "getMarketingPics", null);
__decorate([
    (0, common_1.Patch)('tenders/:id'),
    (0, roles_decorator_1.Roles)('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER'),
    (0, swagger_1.ApiOperation)({ summary: 'Update Tender details' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_tender_dto_1.UpdateTenderDto, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "updateTender", null);
__decorate([
    (0, common_1.Patch)('tenders/:id/negotiate'),
    (0, roles_decorator_1.Roles)('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER'),
    (0, swagger_1.ApiOperation)({ summary: 'Negotiate Tender Price' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, NegotiatePriceDto, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "negotiatePrice", null);
__decorate([
    (0, common_1.Patch)('tenders/:id/approve-discount'),
    (0, roles_decorator_1.Roles)('DIRECTOR', 'SUPER_ADMIN', 'GENERAL_MANAGER'),
    (0, swagger_1.ApiOperation)({ summary: 'Approve or Reject Tender Discount' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, ApproveDiscountDto, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "approveDiscount", null);
__decorate([
    (0, common_1.Post)('tenders/:id/upload-spk'),
    (0, roles_decorator_1.Roles)('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload SPK document - simpan permanen ke disk dan update contract.spk_file_url' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (req, file, cb) => {
                const uploadPath = path.join(process.cwd(), 'uploads', 'contracts');
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const ext = path.extname(file.originalname);
                cb(null, `spk-${req.params.id}-${uniqueSuffix}${ext}`);
            }
        }),
        fileFilter: (req, file, cb) => {
            const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
            const ext = path.extname(file.originalname).toLowerCase();
            if (allowed.includes(ext)) {
                cb(null, true);
            }
            else {
                cb(new common_1.BadRequestException('Hanya file PDF, DOC, atau gambar yang diizinkan'), false);
            }
        },
        limits: { fileSize: 20 * 1024 * 1024 }
    })),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "uploadSpk", null);
__decorate([
    (0, common_1.Post)('tenders/:id/presigned-url'),
    (0, roles_decorator_1.Roles)('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Presigned URL for SPK upload (legacy - gunakan upload-spk untuk disk storage)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "getPresignedUrl", null);
__decorate([
    (0, common_1.Post)('tenders/:id/verify-spk'),
    (0, roles_decorator_1.Roles)('LEGAL', 'SUPER_ADMIN', 'DIRECTOR', 'GENERAL_MANAGER'),
    (0, swagger_1.ApiOperation)({ summary: 'Verify SPK document (Admin/Legal/Exec)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, VerifySpkDto, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "verifySpk", null);
__decorate([
    (0, common_1.Patch)('tenders/:id/grace-period'),
    (0, roles_decorator_1.Roles)('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Set grace period for tender' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "setGracePeriod", null);
__decorate([
    (0, common_1.Patch)('tenders/:id/status'),
    (0, roles_decorator_1.Roles)('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Update Tender status (WON/LOST)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_tender_dto_1.UpdateTenderStatusDto, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "updateTenderStatus", null);
__decorate([
    (0, common_1.Post)('tenders/:id/upload-proposal'),
    (0, roles_decorator_1.Roles)('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload Proposal Document and update stage to PROPOSAL' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (req, file, cb) => {
                const uploadPath = path.join(process.cwd(), 'uploads', 'proposals');
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const ext = path.extname(file.originalname);
                cb(null, `proposal-${uniqueSuffix}${ext}`);
            }
        })
    })),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "uploadProposal", null);
__decorate([
    (0, common_1.Get)('tenders/:id/activities'),
    (0, swagger_1.ApiOperation)({ summary: 'Get tender activities (Chat-Ops)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "getTenderActivities", null);
__decorate([
    (0, common_1.Post)('tenders/:id/activities'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a new comment/activity' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, tender_activity_dto_1.CreateTenderActivityDto, Object]),
    __metadata("design:returntype", Promise)
], MarketingController.prototype, "createTenderActivity", null);
__decorate([
    (0, common_1.Get)('tenders/proposals/:filename'),
    (0, roles_decorator_1.Roles)('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER'),
    (0, swagger_1.ApiOperation)({ summary: 'Download or View Proposal Document' }),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MarketingController.prototype, "downloadProposal", null);
exports.MarketingController = MarketingController = __decorate([
    (0, swagger_1.ApiTags)('Marketing'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('marketing'),
    __metadata("design:paramtypes", [marketing_service_1.MarketingService])
], MarketingController);
//# sourceMappingURL=marketing.controller.js.map