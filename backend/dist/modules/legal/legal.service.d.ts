import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Contract } from '../../entities/contract.entity';
import { LegalReviewDto } from './dto/legal-review.dto';
export declare class LegalService {
    private contractRepo;
    private readonly dataSource;
    private readonly eventEmitter;
    constructor(contractRepo: Repository<Contract>, dataSource: DataSource, eventEmitter: EventEmitter2);
    validateCommentSanitization(content: string): void;
    getContractsByStatus(status?: string): Promise<Contract[]>;
    getPendingContracts(status?: string): Promise<Contract[]>;
    reviewContract(dto: LegalReviewDto, userId: number): Promise<Contract>;
}
