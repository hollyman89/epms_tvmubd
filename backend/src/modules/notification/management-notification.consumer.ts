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
  async handleManagementUpdate(data: any) {
    this.logger.log(`Received marketing.tender.management_update event: ${JSON.stringify(data)}`);
    try {
      const { tenderId, title, customerName, estimatedBudget, updatedBy, action } = data;

      // 1. Determine target users based on action (Using Parameterized Query and GROUP_CONCAT to prevent duplicates)
      let query = `
        SELECT u.id, GROUP_CONCAT(r.name) as roles
        FROM users u 
        JOIN user_roles ur ON u.id = ur.user_id 
        JOIN roles r ON r.id = ur.role_id 
        WHERE r.name IN ('SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR') 
          AND u.deleted_at IS NULL
        GROUP BY u.id
      `;
      let queryParams: any[] = [];

      if (action === 'MARKED_WON' || action === 'UPDATED') {
        // If WON or UPDATED, notify Management AND the specific user who updated it
        query = `
          SELECT u.id, GROUP_CONCAT(r.name) as roles
          FROM users u 
          JOIN user_roles ur ON u.id = ur.user_id 
          JOIN roles r ON r.id = ur.role_id 
          WHERE (r.name IN ('SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR') OR u.id = ?) 
            AND u.deleted_at IS NULL
          GROUP BY u.id
        `;
        queryParams.push(data.updaterId || 0);
      }

      const managers = await this.dataSource.query(query, queryParams);

      if (!managers || managers.length === 0) {
        this.logger.warn('No target users found to receive notification.');
        return;
      }

      const notifications = [];
      const budgetNum = Number(estimatedBudget) || 0;
      let tier = 'Small';
      if (budgetNum >= 1000000000) {
        tier = 'Large';
      } else if (budgetNum >= 100000000) {
        tier = 'Medium';
      }

      for (const manager of managers) {
        try {
          const notif = new Notification();
          notif.userId = manager.id;
          
          let msg = '';

          if (action === 'CREATED') {
            msg = `<span style="font-weight: 600; color: #0f172a;">${updatedBy}</span> membuat tender <span style="font-weight: 600; color: #0f172a;">${title}</span> dari <span style="font-weight: 600; color: #0f172a;">${customerName}</span> (${tier}).`;
          } else if (action === 'MARKED_WON') {
            if (manager.id === data.updaterId) {
              msg = `🎉 Selamat! Anda telah memenangkan tender <span style="font-weight: 600; color: #0f172a;">${title}</span> dari <span style="font-weight: 600; color: #0f172a;">${customerName}</span> (${tier}).`;
            } else {
              msg = `<span style="font-weight: 600; color: #0f172a;">${updatedBy}</span> memenangkan <span style="font-weight: 600; color: #0f172a;">${title}</span> dari <span style="font-weight: 600; color: #0f172a;">${customerName}</span> (${tier}).`;
            }
          } else if (action === 'MARKED_LOST') {
            msg = `<span style="font-weight: 600; color: #0f172a;">${updatedBy}</span> mengonfirmasi kekalahan tender <span style="font-weight: 600; color: #0f172a;">${title}</span> dari <span style="font-weight: 600; color: #0f172a;">${customerName}</span> (${tier}).`;
          } else if (action === 'UPDATED') {
            msg = `<span style="font-weight: 600; color: #0f172a;">${updatedBy}</span> memperbarui tender <span style="font-weight: 600; color: #0f172a;">${title}</span> dari <span style="font-weight: 600; color: #0f172a;">${customerName}</span> (${tier}).`;
          } else {
            msg = `<span style="font-weight: 600; color: #0f172a;">${updatedBy}</span> melakukan update pada tender <span style="font-weight: 600; color: #0f172a;">${title}</span>.`;
          }

          if (action === 'CREATED') {
            notif.title = 'Tender Baru';
          } else if (action === 'MARKED_WON') {
            notif.title = 'Pemenang Tender';
          } else if (action === 'MARKED_LOST') {
            notif.title = 'Kekalahan Tender';
          } else {
            notif.title = 'Info Sistem';
          }
          
          notif.message = msg;
          notif.notificationType = 'ALERT';
          notif.actionLink = `/sales/tenders/${tenderId}`;
          notif.isRead = false;
          notif.createdBy = 0; // system
          notif.createdAt = new Date();
          
          let requiresApproval = false;
          const userRoles = manager.roles ? manager.roles.split(',') : [];
          if (userRoles.includes('DIRECTOR')) {
            requiresApproval = true;
          }

          notif.metaData = {
            lead_id: tenderId,
            user_name: updatedBy,
            project_name: title,
            customer_name: customerName,
            tier: tier,
            won_at: action === 'MARKED_WON' ? new Date().toISOString() : null,
            requires_approval: requiresApproval,
            action_type: action
          };
          
          notifications.push(notif);
        } catch (innerErr) {
          this.logger.error(`Failed to create notification object for user ${manager.id}: ${innerErr.message}`, innerErr.stack);
        }
      }

      if (notifications.length > 0) {
        const savedNotifs = await this.notificationRepo.save(notifications);
        this.logger.log(`Saved ${savedNotifs.length} management notifications`);
        
        // Broadcast via WebSocket
        for (const notif of savedNotifs) {
          this.notificationGateway.sendNotificationToUser(notif.userId, notif);
        }
      }
    } catch (err) {
      this.logger.error(`[AUDIT_LOG_ERROR] Failed to process management notification: ${err.message}`, err.stack);
    }
  }
}
