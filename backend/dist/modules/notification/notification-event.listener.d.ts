import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, DataSource } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { Queue } from 'bullmq';
export declare class NotificationEventListener {
    private readonly notificationRepo;
    private readonly dataSource;
    private readonly notificationGateway;
    private emailQueue;
    private readonly eventEmitter;
    private readonly logger;
    constructor(notificationRepo: Repository<Notification>, dataSource: DataSource, notificationGateway: NotificationGateway, emailQueue: Queue, eventEmitter: EventEmitter2);
    handleTenderWonEvent(payload: {
        contractId?: number;
        tenderId: number;
        customerId?: number;
        title?: string;
    }): Promise<void>;
    handleContractApprovedEvent(payload: any): Promise<void>;
    handleNotificationSend(payload: {
        recipientId?: number | string | (number | string)[];
        title: string;
        message: string;
        type: string;
        audience?: string;
        tenderId?: number;
        metaData?: any;
    }): Promise<void>;
    private resolveRecipients;
    private mapNotificationType;
}
