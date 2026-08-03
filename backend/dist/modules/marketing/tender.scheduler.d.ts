import { Repository } from 'typeorm';
import { Tender } from '../../entities/tender.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class TenderScheduler {
    private readonly tenderRepo;
    private readonly eventEmitter;
    private readonly logger;
    constructor(tenderRepo: Repository<Tender>, eventEmitter: EventEmitter2);
    handleGracePeriodAndTimeouts(): Promise<void>;
}
