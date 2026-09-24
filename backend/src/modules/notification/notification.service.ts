import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { Project } from '../../entities/project.entity';
import { Payment } from '../../entities/payment.entity';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(PurchaseOrder)
    private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseRequest)
    private prRepo: Repository<PurchaseRequest>,
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    private dataSource: DataSource
  ) {}

  @OnEvent('finance.payment_processed')
  async handlePaymentProcessed(data: any) {
    this.logger.log(`Received finance.payment_processed event: ${JSON.stringify(data)}`);
    
    try {
      const { paymentId, poId, amount, paymentNumber } = data;

      // 1. Mapping User: Project Manager
      const po = await this.poRepo.findOne({ where: { id: poId } });
      let pmId: number | null = null;
      if (po && po.purchaseRequestId) {
        const pr = await this.prRepo.findOne({ where: { id: po.purchaseRequestId } });
        if (pr && pr.projectId) {
          const project = await this.projectRepo.findOne({ where: { id: pr.projectId } });
          if (project) {
            pmId = project.managerId;
          }
        }
      }

      // 2. Mapping User: Finance User (who created the payment)
      const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
      let financeUserId: number | null = null;
      if (payment) {
        financeUserId = payment.createdBy;
      }

      const notifications = [];

      // Create notification for PM
      if (pmId) {
        const pmNotif = new Notification();
        pmNotif.userId = pmId;
        pmNotif.title = 'Pembayaran Diterima';
        pmNotif.message = `Pembayaran ${paymentNumber} senilai Rp ${Number(amount).toLocaleString('id-ID')} untuk PO #${poId} telah diproses`;
        pmNotif.notificationType = 'ALERT';
        pmNotif.actionLink = `/projects/pos/${poId}`;
        notifications.push(pmNotif);
      }

      // Create notification for Finance User
      // Make sure we don't send duplicate if Finance is also the PM (rare but possible)
      if (financeUserId && financeUserId !== pmId) {
        const finNotif = new Notification();
        finNotif.userId = financeUserId;
        finNotif.title = 'Transaksi Berhasil';
        finNotif.message = `Pembayaran senilai Rp ${Number(amount).toLocaleString('id-ID')} berhasil dicatat`;
        finNotif.notificationType = 'SYSTEM';
        finNotif.actionLink = `/finance/payments/${paymentId}`;
        notifications.push(finNotif);
      }

      if (notifications.length > 0) {
        await this.notificationRepo.save(notifications);
        this.logger.log(`Saved ${notifications.length} notifications`);
      }
    } catch (err) {
      // Error Handling: Log to 'audit_logs' equivalent (console logger) to prevent crash
      this.logger.error(`[AUDIT_LOG_ERROR] Failed to process finance.payment_processed event: ${err.message}`, err.stack);
    }
  }

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
