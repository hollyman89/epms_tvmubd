import { WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
export declare class EmailProcessor extends WorkerHost {
    private emailDlq;
    private readonly logger;
    constructor(emailDlq: Queue);
    process(job: Job<any, any, string>): Promise<any>;
    onFailed(job: Job, error: Error): Promise<void>;
}
