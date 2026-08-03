import { NotificationService } from './notification.service';
export declare class NotificationController {
    private readonly notificationService;
    constructor(notificationService: NotificationService);
    getMyNotifications(req: any, page: number, limit: number, isRead?: string): Promise<{
        message: string;
        data: import("../../entities/notification.entity").Notification[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getUnreadCount(req: any): Promise<{
        message: string;
        data: {
            count: number;
        };
    }>;
    getUnreadCountAlias(req: any): Promise<{
        message: string;
        data: {
            count: number;
        };
    }>;
    markAllAsRead(req: any): Promise<{
        message: string;
    }>;
    markAsRead(req: any, id: string): Promise<{
        message: string;
        data: import("../../entities/notification.entity").Notification;
    }>;
    deleteNotification(req: any, id: string): Promise<{
        message: string;
    }>;
    checkWebsocketRedisHealth(): Promise<{
        status: string;
        timestamp: string;
        services: {
            websocket: {
                namespace: string;
                status: string;
            };
            redisIoAdapter: {
                host: string;
                port: number;
                status: string;
            };
        };
    }>;
}
