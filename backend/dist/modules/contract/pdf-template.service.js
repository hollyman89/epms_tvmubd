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
var PdfTemplateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfTemplateService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const pdf_template_entity_1 = require("../../entities/pdf-template.entity");
const crypto = require("crypto");
let PdfTemplateService = PdfTemplateService_1 = class PdfTemplateService {
    constructor(templateRepo) {
        this.templateRepo = templateRepo;
        this.logger = new common_1.Logger(PdfTemplateService_1.name);
        this.compiledCache = new Map();
    }
    renderHandlebars(templateHtml, data) {
        let rendered = templateHtml;
        Object.keys(data).forEach((key) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            const val = data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
            rendered = rendered.replace(regex, val);
        });
        rendered = rendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, conditionKey, body) => {
            return data[conditionKey] ? body : '';
        });
        return rendered;
    }
    validateTemplate(content) {
        if (!content || !content.trim()) {
            throw new common_1.BadRequestException('Template content cannot be empty!');
        }
        const openIfs = (content.match(/{{#if/g) || []).length;
        const closeIfs = (content.match(/{{\/if}}/g) || []).length;
        if (openIfs !== closeIfs) {
            throw new common_1.BadRequestException('Syntax Error: Mismatched {{#if}} and {{/if}} tags!');
        }
        return true;
    }
    async createTemplate(dto) {
        this.validateTemplate(dto.content);
        const existing = await this.templateRepo.findOne({
            where: { name: dto.name },
            order: { version: 'DESC' },
        });
        const nextVersion = existing ? existing.version + 1 : 1;
        const template = this.templateRepo.create({
            name: dto.name,
            content: dto.content,
            version: nextVersion,
            is_active: true,
            variable_mapping: dto.variable_mapping || {
                contractNumber: 'No. Kontrak',
                customerName: 'Nama Klien',
                contractValue: 'Nilai Kontrak',
            },
        });
        await this.templateRepo.save(template);
        this.compiledCache.delete(`template_${template.id}`);
        return {
            statusCode: 201,
            message: `PDF Template '${dto.name}' (v${nextVersion}) created successfully.`,
            template,
        };
    }
    async findAll() {
        return await this.templateRepo.find({
            order: { id: 'DESC' },
        });
    }
    async previewTemplate(templateId, sampleData) {
        const template = await this.templateRepo.findOne({ where: { id: templateId } });
        if (!template)
            throw new common_1.NotFoundException('PDF Template not found');
        const mockData = sampleData || {
            contractNumber: 'CON-2026-DEMO-001',
            customerName: 'PT Telekomunikasi Indonesia Tbk',
            contractValue: 'Rp 1.500.000.000',
            startDate: '01 Agustus 2026',
            endDate: '31 Juli 2027',
            companyLogoUrl: 'http://localhost:3000/logo.png',
            hasDeposit: true,
            depositAmount: 'Rp 150.000.000',
        };
        const renderedHtml = this.renderHandlebars(template.content, mockData);
        return {
            statusCode: 200,
            templateId,
            name: template.name,
            version: template.version,
            renderedHtml,
            sampleData: mockData,
        };
    }
    async renderContractPdf(templateId, contractData) {
        const preview = await this.previewTemplate(templateId, contractData);
        const pdfBuffer = Buffer.from(preview.renderedHtml);
        const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
        const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
        return {
            statusCode: 200,
            templateId,
            contractNumber: contractData.contractNumber || 'CON-EXPORT',
            documentHash: hash,
            compiledHtml: preview.renderedHtml,
            downloadUrl: `${baseUrl}/uploads/proposals/contract_${contractData.contractNumber || 'export'}.pdf`,
        };
    }
};
exports.PdfTemplateService = PdfTemplateService;
exports.PdfTemplateService = PdfTemplateService = PdfTemplateService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(pdf_template_entity_1.PdfTemplate)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PdfTemplateService);
//# sourceMappingURL=pdf-template.service.js.map