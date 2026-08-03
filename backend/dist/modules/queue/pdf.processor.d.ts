import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Contract } from '../../entities/contract.entity';
export declare class PdfProcessor extends WorkerHost {
    private contractRepo;
    private s3Client;
    constructor(contractRepo: Repository<Contract>);
    process(job: Job<any, any, string>): Promise<any>;
}
