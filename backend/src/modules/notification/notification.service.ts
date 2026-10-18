import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  async getMyNotifications(userId: number, page: number, limit: number, isRead?: boolean) {
    const where: any = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead;
    }
    
    const [data, total] = await this.notificationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isRead: false }
    });
  }

  async markAsRead(userId: number, notifId: number) {
    const notif = await this.notificationRepo.findOne({ where: { id: notifId, userId } });
    if (!notif) {
      throw new NotFoundException('Notification not found');
    }
    notif.isRead = true;
    await this.notificationRepo.save(notif);
    return notif;
  }

  async markAllAsRead(userId: number) {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
    return { success: true };
  }

  async deleteNotification(userId: number, notifId: number) {
    const notif = await this.notificationRepo.findOne({ where: { id: notifId, userId } });
    if (!notif) {
      throw new NotFoundException('Notification not found');
    }
    // Soft delete
    await this.notificationRepo.softDelete(notif.id);
    return { success: true };
  }

  /**
   * Reconciles related notifications to read state when the associated business task is completed.
   */
  async markRelatedNotificationsRead(
    userId: number,
    referenceType: string,
    referenceId: string | number,
  ): Promise<number> {
    const unreadNotifs = await this.notificationRepo.find({
      where: { userId, isRead: false },
    });
    const toUpdate: number[] = [];
    const refTypeStr = String(referenceType).toUpperCase();
    const refIdStr = String(referenceId);

    for (const n of unreadNotifs) {
      const meta = n.metaData;
      if (!meta || typeof meta !== 'object') continue;
      const nRefType = String(
        meta.reference_type || meta.referenceType || meta.category || '',
      ).toUpperCase();
      const nRefId = String(
        meta.reference_id ??
          meta.referenceId ??
          meta.claimId ??
          meta.contractId ??
          meta.tenderId ??
          meta.projectId ??
          meta.paymentId ??
          '',
      );

      if (nRefType === refTypeStr && nRefId === refIdStr) {
        toUpdate.push(n.id);
      }
    }

    if (toUpdate.length > 0) {
      for (const id of toUpdate) {
        await this.notificationRepo.update({ id }, { isRead: true });
      }
      this.logger.log(
        `Marked ${toUpdate.length} related notification(s) read for user ${userId} (${refTypeStr} #${refIdStr})`,
      );
    }

    return toUpdate.length;
  }
}
