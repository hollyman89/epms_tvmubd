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
exports.PdfProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const PDFDocument = require("pdfkit");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const contract_entity_1 = require("../../entities/contract.entity");
const client_s3_1 = require("@aws-sdk/client-s3");
let PdfProcessor = class PdfProcessor extends bullmq_1.WorkerHost {
    constructor(contractRepo) {
        super();
        this.contractRepo = contractRepo;
        this.s3Client = new client_s3_1.S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock_key',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock_secret',
            },
        });
    }
    async process(job) {
        console.log(`[Worker] Memproses PDF untuk Contract ID: ${job.data.contractId}`);
        const contract = await this.contractRepo.findOne({ where: { id: job.data.contractId } });
        if (!contract) {
            throw new Error(`Contract ${job.data.contractId} not found`);
        }
        const doc = new PDFDocument();
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.fontSize(20).text(`Contract Document - ${contract.contract_number || 'DRAFT'}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Status: ${contract.legal_status}`);
        doc.fontSize(12).text(`Generated asynchronously via BullMQ worker.`);
        return new Promise((resolve, reject) => {
            doc.on('end', async () => {
                try {
                    const pdfData = Buffer.concat(buffers);
                    console.log(`[Worker] PDF Generated successfully. Size: ${pdfData.length} bytes.`);
                    const key = `contracts/${contract.id}-${Date.now()}.pdf`;
                    await this.s3Client.send(new client_s3_1.PutObjectCommand({
                        Bucket: process.env.AWS_S3_BUCKET || 'epms-staging-bucket',
                        Key: key,
                        Body: pdfData,
                        ContentType: 'application/pdf',
                    }));
                    const s3Url = `https://${process.env.AWS_S3_BUCKET || 'epms-staging-bucket'}.s3.amazonaws.com/${key}`;
                    console.log(`[Worker] Uploaded to S3: ${s3Url}`);
                    resolve({ status: 'completed', url: s3Url });
                }
                catch (error) {
                    console.error(`[Worker] S3 Upload failed: ${error.message}`);
                    reject(error);
                }
            });
            doc.end();
        });
    }
};
exports.PdfProcessor = PdfProcessor;
exports.PdfProcessor = PdfProcessor = __decorate([
    (0, bullmq_1.Processor)('pdf-generation', { concurrency: 5 }),
    __param(0, (0, typeorm_1.InjectRepository)(contract_entity_1.Contract)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PdfProcessor);
//# sourceMappingURL=pdf.processor.js.map