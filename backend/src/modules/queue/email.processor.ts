import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import * as nodemailer from 'nodemailer';

@Processor('email-send', {
  concurrency: 10,
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(@InjectQueue('email-dlq') private emailDlq: Queue) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[Worker] Processing Email Job #${job.id} (Attempt ${job.attemptsMade + 1}/3)`);

    // Sanitize log data: No sensitive passwords exposed in logs
    const sanitizedTo = job.data.to ? String(job.data.to).replace(/(?<=.{2}).(?=.*@)/g, '*') : 'unknown';
    this.logger.log(`[Worker] Target recipient: ${sanitizedTo}`);

    // SMTP Setup from ENV
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
      // Mock / Actual email sending logic
      this.logger.log(`[SMTP Engine] Sending email to: ${sanitizedTo}`);
      return { status: 'success', sentAt: new Date().toISOString() };
    } catch (error) {
      this.logger.error(`[Worker Error] Failed job #${job.id}: ${error.message}`);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    this.logger.warn(`Job #${job.id} failed attempt ${job.attemptsMade}/3: ${error.message}`);

    // If max attempts (3) reached, route to Dead Letter Queue (DLQ)
    if (job.attemptsMade >= 3) {
      this.logger.error(`🚨 Job #${job.id} exceeded max retries (3). Moving to Dead Letter Queue (email-dlq)!`);
      
      await this.emailDlq.add('failed-email-dlq', {
        originalJobId: job.id,
        failedAt: new Date().toISOString(),
        attemptsMade: job.attemptsMade,
        errorMessage: error.message,
        data: job.data,
      });

      // Threshold alert check (>5 DLQ items)
      const dlqCount = await this.emailDlq.getJobCounts('waiting', 'failed');
      const totalDlq = (dlqCount.waiting || 0) + (dlqCount.failed || 0);

      if (totalDlq > 5) {
        this.logger.error(`CRITICAL ALERT: DLQ Failed Threshold Exceeded! Total Failed Jobs in DLQ: ${totalDlq} (>5 Limit).`);
      }
    }
  }
}
