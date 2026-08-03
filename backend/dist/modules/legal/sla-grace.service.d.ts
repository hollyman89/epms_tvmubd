import { OnModuleInit } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { Contract } from '../../entities/contract.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class SlaGraceService implements OnModuleInit {
    private contractRepo;
    private dataSource;
    private eventEmitter;
    private readonly logger;
    constructor(contractRepo: Repository<Contract>, dataSource: DataSource, eventEmitter: EventEmitter2);
    onModuleInit(): Promise<void>;
    handleRevisionRequested(payload: {
        contractId: number;
        userId: number;
        reason?: string;
    }): Promise<void>;
    requestGraceExtension(contractId: number, daysToAdd: number, userId: number, reason?: string): Promise<{
        statusCode: number;
        contractId: number;
        extensionCount: number;
        maxLimit: number;
        graceDeadline: string;
        message: string;
    }>;
    getActiveGraceExtensions(): Promise<{
        contractId: number;
        contractNumber: string;
        extensionCount: number;
        maxLimit: number;
        graceDeadline: Date;
        extendedAt: Date;
        status: string;
    }[]>;
}
