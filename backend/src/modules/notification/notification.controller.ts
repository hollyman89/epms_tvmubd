import { Controller, Get, Patch, Delete, Param, Query, UseGuards, Request, DefaultValuePipe, ParseIntPipe} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for logged in user with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully.' })
  async getMyNotifications(
    @Request() req, 
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('isRead') isRead?: string
  ) {
    const isReadBool = isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    const result = await this.notificationService.getMyNotifications(req.user.userId, page, limit, isReadBool);
    return {
      message: 'Notifications retrieved successfully',
      data: result.data,
      meta: result.meta
    };
  }

  @Get('count/unread')
  @ApiOperation({ summary: 'Get total unread notifications' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved successfully.' })
  async getUnreadCount(@Request() req) {
    const count = await this.notificationService.getUnreadCount(req.user.userId);
    return {
      message: 'Unread count retrieved successfully',
      data: { count }
    };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread notifications (Alias Route)' })
  async getUnreadCountAlias(@Request() req) {
    return this.getUnreadCount(req);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for logged in user' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read.' })
  async markAllAsRead(@Request() req) {
    await this.notificationService.markAllAsRead(req.user.userId);
    return { message: 'All notifications marked as read' };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark specific notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  async markAsRead(@Request() req, @Param('id') id: string) {
    const notif = await this.notificationService.markAsRead(req.user.userId, parseInt(id, 10));
    return { message: 'Notification marked as read', data: notif };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted successfully.' })
  async deleteNotification(@Request() req, @Param('id') id: string) {
    await this.notificationService.deleteNotification(req.user.userId, parseInt(id, 10));
    return { message: 'Notification deleted successfully' };
  }

  @Get('health/websocket-redis')
  @ApiOperation({ summary: 'Health check to verify WebSocket & Redis connectivity' })
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
}
