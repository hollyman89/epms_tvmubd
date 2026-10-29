import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { ManagementNotificationConsumer } from './management-notification.consumer';
import { Notification } from '../../entities/notification.entity';
import { PushOutbox } from '../../entities/push-outbox.entity';
import { PushSubscription } from '../../entities/push-subscription.entity';

import { NotificationGateway } from './notification.gateway';
import { NotificationListener } from './notification.listener';
import { BusinessSyncConsumer } from './business-sync.consumer';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { CanonicalNotificationConsumer } from './canonical-notification.consumer';
import { PushOutboxService } from './push-outbox.service';
import { PushOutboxWorker } from './push-outbox.worker';
import { PushSsrfGuard } from './push-ssrf.guard';
import { PushSubscriptionService } from './push-subscription.service';
import { WebPushDispatcher } from './web-push.dispatcher';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      PushOutbox,
      PushSubscription,
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
    PushSsrfGuard,
    PushSubscriptionService,
    WebPushDispatcher,
    {
      provide: 'PUSH_SUBSCRIPTION_PROVIDER',
      useExisting: PushSubscriptionService,
    },
    {
      provide: 'PUSH_DISPATCHER',
      useExisting: WebPushDispatcher,
    },
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
    PushSsrfGuard,
    PushSubscriptionService,
    WebPushDispatcher,
    PushOutboxWorker,
  ],
})
export class NotificationModule {}
