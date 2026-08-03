import { Queue } from 'bullmq';
export declare class QueueMonitoringController {
    private emailQueue;
    private emailDlq;
    private pdfQueue;
    constructor(emailQueue: Queue, emailDlq: Queue, pdfQueue: Queue);
    getQueueStats(): Promise<{
        statusCode: number;
        timestamp: string;
        alerting: {
            thresholdExceeded: boolean;
            thresholdLimit: number;
            message: string;
        };
        queues: {
            emailPrimary: {
                name: string;
            };
            emailDlq: {
                name: string;
            };
            pdfGeneration: {
                name: string;
            };
        };
    }>;
    retryDlqJobs(): Promise<{
        statusCode: number;
        message: string;
    }>;
}
