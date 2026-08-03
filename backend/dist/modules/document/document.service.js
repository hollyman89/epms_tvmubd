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
exports.DocumentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const document_entity_1 = require("../../entities/document.entity");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
let DocumentService = class DocumentService {
    constructor(documentRepository, s3Client) {
        this.documentRepository = documentRepository;
        this.s3Client = s3Client;
    }
    async uploadToS3(file, folder) {
        const key = `${folder}/${Date.now()}-${file.originalname}`;
        const bucket = process.env.AWS_S3_BUCKET || 'epms-bucket';
        const region = process.env.AWS_REGION || 'ap-southeast-1';
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        });
        await this.s3Client.send(command);
        return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    }
    async generatePresignedUrl(folder, originalName, mimeType, entityType, entityId, userId) {
        const key = `${folder}/${Date.now()}-${originalName}`;
        const bucket = process.env.AWS_S3_BUCKET || 'epms-bucket';
        const region = process.env.AWS_REGION || 'ap-southeast-1';
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: mimeType,
        });
        const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn: 900 });
        const finalUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
        return {
            presignedUrl,
            finalUrl,
            key
        };
    }
    async saveMetadata(data) {
        const bucket = process.env.AWS_S3_BUCKET || 'epms-bucket';
        const region = process.env.AWS_REGION || 'ap-southeast-1';
        const finalUrl = `https://${bucket}.s3.${region}.amazonaws.com/${data.key}`;
        const document = this.documentRepository.create({
            entityType: data.entityType,
            entityId: data.entityId,
            fileName: data.fileName,
            filePath: finalUrl,
            mimeType: data.mimeType,
            fileSize: data.fileSize,
            createdBy: data.userId || 1,
        });
        return await this.documentRepository.save(document);
    }
    async uploadFile(entityType, entityId, file, userId) {
        const fileUrl = await this.uploadToS3(file, entityType.toLowerCase());
        const document = this.documentRepository.create({
            entityType,
            entityId,
            fileName: file.originalname,
            filePath: fileUrl,
            mimeType: file.mimetype,
            fileSize: file.size,
            createdBy: userId || 1,
        });
        return await this.documentRepository.save(document);
    }
    async getFilesByEntity(entityType, entityId) {
        const documents = await this.documentRepository.find({
            where: { entityType, entityId },
            order: { createdAt: 'DESC' },
        });
        const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
        return documents.map(doc => {
            let fileUrl = doc.filePath || '';
            if (!fileUrl.startsWith('http')) {
                const cleanPath = fileUrl.replace(/^\/+/, '');
                if (cleanPath.startsWith('uploads/')) {
                    fileUrl = `${baseUrl}/${cleanPath}`;
                }
                else if (cleanPath.startsWith('proposals/')) {
                    fileUrl = `${baseUrl}/uploads/${cleanPath}`;
                }
                else {
                    fileUrl = `${baseUrl}/uploads/proposals/${cleanPath}`;
                }
            }
            return {
                ...doc,
                fileUrl,
            };
        });
    }
    async getFileById(id) {
        const document = await this.documentRepository.findOne({ where: { id } });
        if (!document) {
            throw new common_1.NotFoundException('Document not found');
        }
        return document;
    }
    async getAllFiles() {
        const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
        const documents = await this.documentRepository.find({
            order: { createdAt: 'DESC' },
        });
        return documents.map(doc => {
            let fileUrl = doc.filePath || '';
            if (!fileUrl.startsWith('http')) {
                const cleanPath = fileUrl.replace(/^\/+/, '');
                if (cleanPath.startsWith('uploads/')) {
                    fileUrl = `${baseUrl}/${cleanPath}`;
                }
                else if (cleanPath.startsWith('proposals/')) {
                    fileUrl = `${baseUrl}/uploads/${cleanPath}`;
                }
                else {
                    fileUrl = `${baseUrl}/uploads/proposals/${cleanPath}`;
                }
            }
            return {
                ...doc,
                fileUrl,
            };
        });
    }
};
exports.DocumentService = DocumentService;
exports.DocumentService = DocumentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(document_entity_1.Document)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        client_s3_1.S3Client])
], DocumentService);
//# sourceMappingURL=document.service.js.map