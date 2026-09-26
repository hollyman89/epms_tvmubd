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
}
