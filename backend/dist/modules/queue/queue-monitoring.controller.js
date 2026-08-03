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
exports.QueueMonitoringController = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const swagger_1 = require("@nestjs/swagger");
let QueueMonitoringController = class QueueMonitoringController {
    constructor(emailQueue, emailDlq, pdfQueue) {
        this.emailQueue = emailQueue;
        this.emailDlq = emailDlq;
        this.pdfQueue = pdfQueue;
    }
    async getQueueStats() {
        const [emailCounts, dlqCounts, pdfCounts] = await Promise.all([
            this.emailQueue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting'),
            this.emailDlq.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting'),
            this.pdfQueue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting'),
        ]);
        const thresholdAlert = dlqCounts.failed > 5 || dlqCounts.waiting > 5;
        return {
            statusCode: 200,
            timestamp: new Date().toISOString(),
            alerting: {
                thresholdExceeded: thresholdAlert,
                thresholdLimit: 5,
                message: thresholdAlert
                    ? '🚨 ALERT: Dead Letter Queue (DLQ) threshold exceeded! >5 failed jobs detected.'
                    : '✅ Queue status healthy.',
            },
            queues: {
                emailPrimary: {
                    name: 'email-send',
                    ...emailCounts,
                },
                emailDlq: {
                    name: 'email-dlq',
                    ...dlqCounts,
                },
                pdfGeneration: {
                    name: 'pdf-generation',
                    ...pdfCounts,
                },
            },
        };
    }
    async retryDlqJobs() {
        const failedJobs = await this.emailDlq.getJobs(['failed', 'waiting']);
        let retriedCount = 0;
        for (const job of failedJobs) {
            await this.emailQueue.add('send-email', job.data, {
                attempts: 3,
                backoff: { type: 'fixed', delay: 5000 },
            });
            await job.remove();
            retriedCount++;
        }
        return {
            statusCode: 200,
            message: `Successfully requeued ${retriedCount} failed jobs from DLQ to primary queue.`,
        };
    }
};
exports.QueueMonitoringController = QueueMonitoringController;
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get queue metrics and DLQ count for monitoring' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Queue metrics retrieved successfully.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueMonitoringController.prototype, "getQueueStats", null);
__decorate([
    (0, common_1.Post)('dlq/retry-all'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Retry all failed jobs in Dead Letter Queue (DLQ)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueMonitoringController.prototype, "retryDlqJobs", null);
exports.QueueMonitoringController = QueueMonitoringController = __decorate([
    (0, swagger_1.ApiTags)('Queue Monitoring'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MONITORING'),
    (0, common_1.Controller)('queue'),
    __param(0, (0, bullmq_1.InjectQueue)('email-send')),
    __param(1, (0, bullmq_1.InjectQueue)('email-dlq')),
    __param(2, (0, bullmq_1.InjectQueue)('pdf-generation')),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue])
], QueueMonitoringController);
//# sourceMappingURL=queue-monitoring.controller.js.map