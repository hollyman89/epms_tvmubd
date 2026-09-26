import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class ManagementNotificationConsumer {
  private readonly logger = new Logger(ManagementNotificationConsumer.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private dataSource: DataSource,
    private notificationGateway: NotificationGateway
  ) {}

  @OnEvent('marketing.tender.management_update')
  async handleManagementUpdate(data: any): Promise<void> {
    this.logger.log(`Received marketing.tender.management_update event: ${JSON.stringify(data)}`);
    // Phase N3: marketing.tender.management_update is strictly a DATA_CHANGED / Sales UI signal.
    // Decoupled from Bell notification persistence:
    // - ZERO rows inserted into notifications table.
    // - ZERO new_notification Bell emissions via notificationGateway.
    // - Generic 'Info Sistem' Bell generation eliminated.
    // Real-time sales pipeline update is handled by SalesGateway (sales:pipeline_updated).
    return;
  }
}
