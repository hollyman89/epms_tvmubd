import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('email-send')
export class EmailQueueProcessor extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`[Worker] Memproses Email untuk Job ID: ${job.id}`);
    console.log('Data:', job.data);
    // Logika pengiriman email akan diletakkan di sini
    return { status: 'success' };
  }
}
