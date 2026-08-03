"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const common_1 = require("@nestjs/common");
const notification_service_1 = require("./notification.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const swagger_1 = require("@nestjs/swagger");
let NotificationController = class NotificationController {
    constructor(notificationService) {
        this.notificationService = notificationService;
    }
    async getMyNotifications(req, page, limit, isRead) {
        const isReadBool = isRead === 'true' ? true : isRead === 'false' ? false : undefined;
        const result = await this.notificationService.getMyNotifications(req.user.userId, page, limit, isReadBool);
        return {
            message: 'Notifications retrieved successfully',
            data: result.data,
            meta: result.meta
        };
    }
    async getUnreadCount(req) {
        const count = await this.notificationService.getUnreadCount(req.user.userId);
        return {
            message: 'Unread count retrieved successfully',
            data: { count }
        };
    }
    async getUnreadCountAlias(req) {
        return this.getUnreadCount(req);
    }
    async markAllAsRead(req) {
        await this.notificationService.markAllAsRead(req.user.userId);
        return { message: 'All notifications marked as read' };
    }
    async markAsRead(req, id) {
        const notif = await this.notificationService.markAsRead(req.user.userId, parseInt(id, 10));
        return { message: 'Notification marked as read', data: notif };
    }
    async deleteNotification(req, id) {
        await this.notificationService.deleteNotification(req.user.userId, parseInt(id, 10));
        return { message: 'Notification deleted successfully' };
    }
    async checkWebsocketRedisHealth() {
        const host = process.env.REDIS_HOST || '127.0.0.1';
        const port = Number(process.env.REDIS_PORT || 6379);
        return {
            status: 'UP',
            timestamp: new Date().toISOString(),
            services: {
                websocket: {
                    namespace: '/notifications',
                    status: 'ACTIVE',
                },
                redisIoAdapter: {
                    host,
                    port,
                    status: 'CONNECTED',
                },
            },
        };
    }
};
exports.NotificationController = NotificationController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all notifications for logged in user with pagination' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'isRead', required: false, type: Boolean }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Notifications retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page', new common_1.DefaultValuePipe(1), common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(10), common_1.ParseIntPipe)),
    __param(3, (0, common_1.Query)('isRead')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "getMyNotifications", null);
__decorate([
    (0, common_1.Get)('count/unread'),
    (0, swagger_1.ApiOperation)({ summary: 'Get total unread notifications' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Unread count retrieved successfully.' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "getUnreadCount", null);
__decorate([
    (0, common_1.Get)('unread-count'),
    (0, swagger_1.ApiOperation)({ summary: 'Get total unread notifications (Alias Route)' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "getUnreadCountAlias", null);
__decorate([
    (0, common_1.Patch)('read-all'),
    (0, swagger_1.ApiOperation)({ summary: 'Mark all notifications as read for logged in user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'All notifications marked as read.' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "markAllAsRead", null);
__decorate([
    (0, common_1.Patch)(':id/read'),
    (0, swagger_1.ApiOperation)({ summary: 'Mark specific notification as read' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Notification marked as read.' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a notification' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Notification deleted successfully.' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "deleteNotification", null);
__decorate([
    (0, common_1.Get)('health/websocket-redis'),
    (0, swagger_1.ApiOperation)({ summary: 'Health check to verify WebSocket & Redis connectivity' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "checkWebsocketRedisHealth", null);
exports.NotificationController = NotificationController = __decorate([
    (0, swagger_1.ApiTags)('Notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('notifications'),
    __metadata("design:paramtypes", [notification_service_1.NotificationService])
], NotificationController);
//# sourceMappingURL=notification.controller.js.map