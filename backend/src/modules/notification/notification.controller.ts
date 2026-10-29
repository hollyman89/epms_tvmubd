import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  DefaultValuePipe,
  ParseIntPipe,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  PushSubscriptionService,
  UpsertPushSubscriptionInput,
} from './push-subscription.service';
import { WebPushDispatcher } from './web-push.dispatcher';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    @Optional()
    private readonly pushSubscriptionService?: PushSubscriptionService,
    @Optional()
    private readonly webPushDispatcher?: WebPushDispatcher,
  ) {}

  @Get('push/vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for browser Web Push subscription' })
  @ApiResponse({ status: 200, description: 'VAPID public key retrieved successfully.' })
  async getVapidPublicKey() {
    if (!this.webPushDispatcher) {
      throw new ServiceUnavailableException('Web Push dispatcher is not available');
    }
    const publicKey = this.webPushDispatcher.getPublicKeyOrThrow();
    return {
      publicKey,
      enabled: true,
    };
  }

  @Get('push/subscriptions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active Web Push subscriptions for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Push subscriptions retrieved successfully.' })
  async getMyPushSubscriptions(@Request() req) {
    if (!this.pushSubscriptionService) {
      throw new ServiceUnavailableException('Push subscription service is not available');
    }
    const items = await this.pushSubscriptionService.listUserSubscriptions(req.user.userId);
    return {
      message: 'Push subscriptions retrieved successfully',
      data: items,
    };
  }

  @Post('push/subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register or update a Web Push subscription for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Push subscription registered successfully.' })
  async subscribePush(
    @Request() req,
    @Body() body: UpsertPushSubscriptionInput,
  ) {
    if (!this.pushSubscriptionService) {
      throw new ServiceUnavailableException('Push subscription service is not available');
    }
    const userAgent =
      body?.userAgent || req?.headers?.['user-agent'] || null;
    const result = await this.pushSubscriptionService.upsertSubscription(
      req.user.userId,
      {
        ...body,
        userAgent,
      },
    );
    return {
      message: 'Push subscription registered successfully',
      data: result,
    };
  }

  @Post('push/unsubscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a Web Push subscription owned by the authenticated user' })
  @ApiResponse({ status: 200, description: 'Push subscription revoked successfully.' })
  async unsubscribePush(
    @Request() req,
    @Body() body: { subscriptionId?: number; endpoint?: string },
  ) {
    if (!this.pushSubscriptionService) {
      throw new ServiceUnavailableException('Push subscription service is not available');
    }
    const result = await this.pushSubscriptionService.revokeSubscription(
      req.user.userId,
      {
        subscriptionId: body?.subscriptionId,
        endpoint: body?.endpoint,
      },
    );
    return {
      message: 'Push subscription revoked successfully',
      data: result,
    };
  }

  @Delete('push/subscriptions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific Web Push subscription by ID for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Push subscription revoked successfully.' })
  async deletePushSubscription(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (!this.pushSubscriptionService) {
      throw new ServiceUnavailableException('Push subscription service is not available');
    }
    const result = await this.pushSubscriptionService.revokeSubscription(
      req.user.userId,
      { subscriptionId: id },
    );
    return {
      message: 'Push subscription revoked successfully',
      data: result,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get total unread notifications (Alias Route)' })
  async getUnreadCountAlias(@Request() req) {
    return this.getUnreadCount(req);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all notifications as read for logged in user' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read.' })
  async markAllAsRead(@Request() req) {
    await this.notificationService.markAllAsRead(req.user.userId);
    return { message: 'All notifications marked as read' };
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark specific notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  async markAsRead(@Request() req, @Param('id') id: string) {
    const notif = await this.notificationService.markAsRead(req.user.userId, parseInt(id, 10));
    return { message: 'Notification marked as read', data: notif };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
