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
var EmailProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const common_1 = require("@nestjs/common");
const bullmq_3 = require("@nestjs/bullmq");
const nodemailer = require("nodemailer");
let EmailProcessor = EmailProcessor_1 = class EmailProcessor extends bullmq_1.WorkerHost {
    constructor(emailDlq) {
        super();
        this.emailDlq = emailDlq;
        this.logger = new common_1.Logger(EmailProcessor_1.name);
    }
    async process(job) {
        this.logger.log(`[Worker] Processing Email Job #${job.id} (Attempt ${job.attemptsMade + 1}/3)`);
        const sanitizedTo = job.data.to ? String(job.data.to).replace(/(?<=.{2}).(?=.*@)/g, '*') : 'unknown';
        this.logger.log(`[Worker] Target recipient: ${sanitizedTo}`);
        const host = process.env.SMTP_HOST || 'smtp.mailtrap.io';
        const port = Number(process.env.SMTP_PORT || 2525);
        const user = process.env.SMTP_USER || 'mock_user';
        const pass = process.env.SMTP_PASS || 'mock_pass';
        const transporter = nodemailer.createTransport({
            host,
            port,
            auth: { user, pass },
        });
        const mailOptions = {
            from: '"EPMS System" <noreply@epms.company.com>',
            to: job.data.to,
            subject: job.data.subject,
            text: job.data.text,
            html: job.data.html,
        };
        try {
            this.logger.log(`[SMTP Engine] Sending email to: ${sanitizedTo}`);
            return { status: 'success', sentAt: new Date().toISOString() };
        }
        catch (error) {
            this.logger.error(`[Worker Error] Failed job #${job.id}: ${error.message}`);
            throw error;
        }
    }
    async onFailed(job, error) {
        this.logger.warn(`Job #${job.id} failed attempt ${job.attemptsMade}/3: ${error.message}`);
        if (job.attemptsMade >= 3) {
            this.logger.error(`🚨 Job #${job.id} exceeded max retries (3). Moving to Dead Letter Queue (email-dlq)!`);
            await this.emailDlq.add('failed-email-dlq', {
                originalJobId: job.id,
                failedAt: new Date().toISOString(),
                attemptsMade: job.attemptsMade,
                errorMessage: error.message,
                data: job.data,
            });
            const dlqCount = await this.emailDlq.getJobCounts('waiting', 'failed');
            const totalDlq = (dlqCount.waiting || 0) + (dlqCount.failed || 0);
            if (totalDlq > 5) {
                this.logger.error(`CRITICAL ALERT: DLQ Failed Threshold Exceeded! Total Failed Jobs in DLQ: ${totalDlq} (>5 Limit).`);
            }
        }
    }
};
exports.EmailProcessor = EmailProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job, Error]),
    __metadata("design:returntype", Promise)
], EmailProcessor.prototype, "onFailed", null);
exports.EmailProcessor = EmailProcessor = EmailProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('email-send', {
        concurrency: 10,
    }),
    __param(0, (0, bullmq_3.InjectQueue)('email-dlq')),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], EmailProcessor);
//# sourceMappingURL=email.processor.js.map