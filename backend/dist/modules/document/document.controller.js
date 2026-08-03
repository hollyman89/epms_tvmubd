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
exports.DocumentController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const multer_1 = require("multer");
const document_service_1 = require("./document.service");
let DocumentController = class DocumentController {
    constructor(documentService) {
        this.documentService = documentService;
    }
    async uploadFile(file, entityType, entityId) {
        if (!file) {
            throw new common_1.BadRequestException('File is required');
        }
        const document = await this.documentService.uploadFile(entityType, Number(entityId), file);
        return {
            message: 'Document uploaded successfully',
            data: document
        };
    }
    async getPresignedUrl(body) {
        if (!body.fileName || !body.mimeType || !body.entityType || !body.entityId) {
            throw new common_1.BadRequestException('fileName, mimeType, entityType, and entityId are required');
        }
        const result = await this.documentService.generatePresignedUrl(body.entityType.toLowerCase(), body.fileName, body.mimeType, body.entityType, body.entityId, 1);
        return {
            message: 'Presigned URL generated successfully',
            data: result
        };
    }
    async saveMetadata(body) {
        if (!body.fileName || !body.mimeType || !body.entityType || !body.entityId || !body.key || typeof body.fileSize !== 'number') {
            throw new common_1.BadRequestException('fileName, mimeType, fileSize, entityType, entityId, and key are required');
        }
        const result = await this.documentService.saveMetadata({
            entityType: body.entityType.toLowerCase(),
            entityId: body.entityId,
            fileName: body.fileName,
            mimeType: body.mimeType,
            fileSize: body.fileSize,
            key: body.key,
            userId: 1
        });
        return {
            message: 'Document metadata saved successfully',
            data: result
        };
    }
    async getAllDocuments() {
        const documents = await this.documentService.getAllFiles();
        return {
            message: 'All documents retrieved successfully',
            data: documents
        };
    }
    async getEntityDocuments(entityType, entityId) {
        const documents = await this.documentService.getFilesByEntity(entityType, Number(entityId));
        return {
            message: 'Documents retrieved successfully',
            data: documents
        };
    }
};
exports.DocumentController = DocumentController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a document for an entity (e.g. PO, Invoice)' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
                entityType: { type: 'string', example: 'PURCHASE_ORDER' },
                entityId: { type: 'number', example: 1 },
            },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('entityType')),
    __param(2, (0, common_1.Body)('entityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Post)('presigned-url'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate a presigned URL to upload file directly to S3 from client' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                fileName: { type: 'string', example: 'proposal.pdf' },
                mimeType: { type: 'string', example: 'application/pdf' },
                entityType: { type: 'string', example: 'SPK' },
                entityId: { type: 'number', example: 1 },
            },
        },
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "getPresignedUrl", null);
__decorate([
    (0, common_1.Post)('metadata'),
    (0, swagger_1.ApiOperation)({ summary: 'Save document metadata after successful S3 upload' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                fileName: { type: 'string', example: 'proposal.pdf' },
                mimeType: { type: 'string', example: 'application/pdf' },
                fileSize: { type: 'number', example: 1048576 },
                entityType: { type: 'string', example: 'SPK' },
                entityId: { type: 'number', example: 1 },
                key: { type: 'string', example: 'spk/1721...-proposal.pdf' },
            },
        },
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "saveMetadata", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all uploaded documents across the system' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "getAllDocuments", null);
__decorate([
    (0, common_1.Get)('entity/:entityType/:entityId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all documents for a specific entity' }),
    __param(0, (0, common_1.Param)('entityType')),
    __param(1, (0, common_1.Param)('entityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "getEntityDocuments", null);
exports.DocumentController = DocumentController = __decorate([
    (0, swagger_1.ApiTags)('Documents'),
    (0, common_1.Controller)('documents'),
    __metadata("design:paramtypes", [document_service_1.DocumentService])
], DocumentController);
//# sourceMappingURL=document.controller.js.map