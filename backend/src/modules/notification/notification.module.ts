import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { ManagementNotificationConsumer } from './management-notification.consumer';
import { Notification } from '../../entities/notification.entity';

import { NotificationGateway } from './notification.gateway';
import { NotificationListener } from './notification.listener';
import { BusinessSyncConsumer } from './business-sync.consumer';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
    ]),
    QueueModule
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    ManagementNotificationConsumer,
    NotificationListener,
    BusinessSyncConsumer,
    CanonicalNotificationWriter,
    CanonicalNotificationConsumer,
  ],
  exports: [
    NotificationService,
    NotificationGateway,
    NotificationListener,
    BusinessSyncConsumer,
    CanonicalNotificationWriter,
    CanonicalNotificationConsumer,
  ],
})
export class NotificationModule {}

