import { Repository, DataSource } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { Project } from '../../entities/project.entity';
import { Payment } from '../../entities/payment.entity';
export declare class NotificationService {
    private notificationRepo;
    private poRepo;
    private prRepo;
    private projectRepo;
    private paymentRepo;
    private dataSource;
    private readonly logger;
    constructor(notificationRepo: Repository<Notification>, poRepo: Repository<PurchaseOrder>, prRepo: Repository<PurchaseRequest>, projectRepo: Repository<Project>, paymentRepo: Repository<Payment>, dataSource: DataSource);
    handlePaymentProcessed(data: any): Promise<void>;
    getMyNotifications(userId: number, page: number, limit: number, isRead?: boolean): Promise<{
        data: Notification[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getUnreadCount(userId: number): Promise<number>;
    markAsRead(userId: number, notifId: number): Promise<Notification>;
    markAllAsRead(userId: number): Promise<{
        success: boolean;
    }>;
    deleteNotification(userId: number, notifId: number): Promise<{
        success: boolean;
    }>;
}
