import { Controller, Get, Post, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Queue Monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('queue')
export class QueueMonitoringController {
  constructor(
    @InjectQueue('email-send') private emailQueue: Queue,
    @InjectQueue('email-dlq') private emailDlq: Queue,
    @InjectQueue('pdf-generation') private pdfQueue: Queue,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get queue metrics and DLQ count for monitoring' })
  @ApiResponse({ status: 200, description: 'Queue metrics retrieved successfully.' })
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
          ? 'ALERT: Dead Letter Queue (DLQ) threshold exceeded! >5 failed jobs detected.'
          : 'Queue status healthy.',
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

  @Post('dlq/retry-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry all failed jobs in Dead Letter Queue (DLQ)' })
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
}
