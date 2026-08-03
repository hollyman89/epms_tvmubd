import { Repository, DataSource } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
export declare class ManagementNotificationConsumer {
    private notificationRepo;
    private dataSource;
    private notificationGateway;
    private readonly logger;
    constructor(notificationRepo: Repository<Notification>, dataSource: DataSource, notificationGateway: NotificationGateway);
    handleManagementUpdate(data: any): Promise<void>;
}
