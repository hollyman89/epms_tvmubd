import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Tender, TenderStatus } from '../../entities/tender.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class TenderScheduler {
  private readonly logger = new Logger(TenderScheduler.name);

  constructor(
    @InjectRepository(Tender)
    private readonly tenderRepo: Repository<Tender>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Run every minute
  @Cron('* * * * *')
  async handleGracePeriodAndTimeouts() {
    this.logger.debug('Running TenderScheduler...');
    const now = new Date();

    // 1. Grace Period Demotion
    const expiredTenders = await this.tenderRepo.find({
      where: {
        status: TenderStatus.WON,
        grace_deadline: LessThan(now),
      }
    });

    for (const tender of expiredTenders) {
      if ((tender as any).legal_status === 'APPROVED' || (tender as any).legalStatus === 'APPROVED') {
        this.logger.log(`Skipping demotion for Tender ${tender.id}: Contract is already Legal APPROVED.`);
        continue;
      }

      if (!tender.spk_file_key) {
        this.logger.warn(`Demoting Tender ${tender.id} due to SPK Grace Period expiry.`);
        tender.status = TenderStatus.NEGOTIATION;
        tender.grace_deadline = null; // reset
        await this.tenderRepo.save(tender);

        // Notifikasi ke Direktur
        this.eventEmitter.emit('notification.send', {
          recipientId: 1, // Director ID
          title: 'Laporan: SPK Upload Expired',
          message: `Tender ${tender.title} diturunkan ke NEGOTIATION karena SPK tidak diupload dalam 2x24 jam.`,
          type: 'ALERT' // Type enum mapped in listener
        });

        // Notifikasi ke Marketing PIC
        if (tender.marketing_pic_id) {
          this.eventEmitter.emit('notification.send', {
            recipientId: tender.marketing_pic_id,
            title: 'Peringatan: Tender Diturunkan',
            message: `Tender ${tender.title} diturunkan karena SPK belum diupload. Segera upload ulang untuk mengembalikan ke WON.`,
            type: 'EMAIL_AND_INAPP'
          });

          // Simulated Email Fallback (Backup Channel)
          this.logger.log(`[EMAIL FALLBACK] Mengirim email peringatan ke PIC ID: ${tender.marketing_pic_id} untuk Tender ${tender.title}`);
        }

        // Catat mutasi Audit Log
        this.eventEmitter.emit('audit.log', {
          action: 'DEMOTION',
          entityId: tender.id,
          entityName: 'tenders',
          reason: 'Auto-revert: Grace Period Expired. Notifikasi dikirim ke Direktur dan PIC.'
        });
      }
    }

    // 2. Diskon Timeout (Auto-Escalate)
    // Tender is PENDING_APPROVAL for > 2 hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const pendingTenders = await this.tenderRepo.find({
      where: {
        status: TenderStatus.PENDING_APPROVAL as any,
        updated_at: LessThan(twoHoursAgo)
      }
    });

    for (const tender of pendingTenders) {
      this.logger.warn(`Auto-Escalating Tender ${tender.id} due to 2 hours Approval Timeout.`);
      
      // Aturan 3: Auto-Escalate, status tetap PENDING_APPROVAL
      // Update updated_at so it doesn't spam every 10 seconds, or mark escalated
      // We can just bump updated_at to now
      tender.updated_at = now;
      await this.tenderRepo.save(tender);

      // Kirim Notifikasi Auto-Escalate ke CEO/VP Sales
      this.eventEmitter.emit('notification.send', {
        recipientId: 'C-LEVEL', // Identifier handled by notification gateway
        title: 'URGENT: Tender Approval Escalated',
        message: `Tender ${tender.title} memerlukan persetujuan diskon lebih dari 20%. Tidak ada respon dari Direktur dalam 2 jam terakhir.`,
        type: 'EMAIL_EMERGENCY'
      });

      // Catat mutasi Audit Log
      this.eventEmitter.emit('audit.log', {
        action: 'AUTO_ESCALATE',
        entityId: tender.id,
        entityName: 'tenders',
        reason: 'Approval timeout (> 2 jam), diekskalasi ke C-Suite'
      });
    }
  }
}
