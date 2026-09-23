import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { ManagementNotificationConsumer } from './management-notification.consumer';
import { NotificationEventListener } from './notification-event.listener';
import { Notification } from '../../entities/notification.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { Project } from '../../entities/project.entity';
import { Payment } from '../../entities/payment.entity';

import { NotificationGateway } from './notification.gateway';
import { NotificationListener } from './notification.listener';
import { BusinessSyncConsumer } from './business-sync.consumer';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      PurchaseOrder,
      PurchaseRequest,
      Project,
      Payment
    ]),
    QueueModule
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    NotificationEventListener,
    ManagementNotificationConsumer,
    NotificationListener,
    BusinessSyncConsumer,
  ],
  exports: [NotificationService, NotificationGateway, NotificationListener, BusinessSyncConsumer],
})
export class NotificationModule {}

