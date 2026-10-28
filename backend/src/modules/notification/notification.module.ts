import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { ManagementNotificationConsumer } from './management-notification.consumer';
import { Notification } from '../../entities/notification.entity';
import { PushOutbox } from '../../entities/push-outbox.entity';

import { NotificationGateway } from './notification.gateway';
import { NotificationListener } from './notification.listener';
import { BusinessSyncConsumer } from './business-sync.consumer';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { PushOutboxService } from './push-outbox.service';
import { PushOutboxWorker } from './push-outbox.worker';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      PushOutbox,
    ]),
    QueueModule,
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
    PushOutboxService,
    PushOutboxWorker,
  ],
  exports: [
    NotificationService,
    NotificationGateway,
    NotificationListener,
    BusinessSyncConsumer,
    CanonicalNotificationWriter,
    CanonicalNotificationConsumer,
    PushOutboxService,
    PushOutboxWorker,
  ],
})
export class NotificationModule {}
