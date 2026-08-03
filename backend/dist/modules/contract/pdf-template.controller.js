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
exports.PdfTemplateController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const pdf_template_service_1 = require("./pdf-template.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
let PdfTemplateController = class PdfTemplateController {
    constructor(pdfTemplateService) {
        this.pdfTemplateService = pdfTemplateService;
    }
    async findAll() {
        return await this.pdfTemplateService.findAll();
    }
    async createTemplate(dto) {
        return await this.pdfTemplateService.createTemplate(dto);
    }
    async previewTemplate(id, sampleData) {
        return await this.pdfTemplateService.previewTemplate(id, sampleData);
    }
    async renderContractPdf(id, contractData) {
        return await this.pdfTemplateService.renderContractPdf(id, contractData);
    }
};
exports.PdfTemplateController = PdfTemplateController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all Handlebars PDF templates' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PdfTemplateController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'LEGAL'),
    (0, swagger_1.ApiOperation)({ summary: 'Create new PDF Handlebars template version' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PdfTemplateController.prototype, "createTemplate", null);
__decorate([
    (0, common_1.Post)(':id/preview'),
    (0, swagger_1.ApiOperation)({ summary: 'Preview Handlebars template HTML rendering with sample JSON payload' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], PdfTemplateController.prototype, "previewTemplate", null);
__decorate([
    (0, common_1.Post)(':id/render'),
    (0, swagger_1.ApiOperation)({ summary: 'Render dynamic contract PDF & compute SHA-256 digital signature' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], PdfTemplateController.prototype, "renderContractPdf", null);
exports.PdfTemplateController = PdfTemplateController = __decorate([
    (0, swagger_1.ApiTags)('PDF Template Engine'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('pdf-templates'),
    __metadata("design:paramtypes", [pdf_template_service_1.PdfTemplateService])
], PdfTemplateController);
//# sourceMappingURL=pdf-template.controller.js.map