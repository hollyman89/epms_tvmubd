import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * NotificationEventListener
 * 
 * Menangani semua event 'notification.send' dari seluruh modul (Marketing, Scheduler, dll).
 * Menyimpan notifikasi ke DB dan push via WebSocket ke user yang tepat.
 * 
 * Menggantikan dependensi RabbitMQ yang sebelumnya tidak berjalan.
 */
@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly dataSource: DataSource,
    private readonly notificationGateway: NotificationGateway,
    @InjectQueue('email-send') private emailQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle 'notification.send' events from EventEmitter2.
   * 
   * Payload shape:
   * {
   *   recipientId?: number | 'C-LEVEL',  // specific user ID, or role-based target
   *   title: string,
   *   message: string,
   *   type: 'WARNING' | 'INFO' | 'SUCCESS' | 'ERROR' | 'EMAIL_AND_INAPP' | 'EMAIL_EMERGENCY',
   *   audience?: 'ALL' | 'DIRECTOR' | 'MARKETING',  // role-based broadcast
   *   tenderId?: number,
   *   metaData?: any,
   * }
   */
  @OnEvent('marketing.tender.won')
  async handleTenderWonEvent(payload: { contractId?: number; tenderId: number; customerId?: number; title?: string }) {
    this.logger.log(`🔥 [NotificationEventListener] Event diterima: Tender WON - Tender ID ${payload.tenderId}`);
    
    // Only send the "Draft Kontrak siap direview" notification if a contract was actually created (e.g. after SPK upload).
    if (payload.contractId) {
      await this.handleNotificationSend({
        title: 'Tender WON - Draft Kontrak Baru',
        message: `Tender "${payload.title || 'Project'}" telah disetujui (WON). Draft Kontrak #${payload.contractId} siap direview.`,
        type: 'TASK',
        audience: 'LEGAL',
        tenderId: payload.tenderId,
        metaData: { 
          category: 'SALES',
          priority: 'HIGH',
          reference_type: 'CONTRACT',
          reference_id: payload.contractId,
          action_buttons: ['REVIEW_CONTRACT'],
          contractId: payload.contractId, 
          actionLink: '/legal/review?tab=WAITING' 
        }
      });
    }
  }

  @OnEvent('legal.contract.approved')
  async handleContractApprovedEvent(payload: any) {
    if (payload.legalStatus !== 'APPROVED') return;

    this.logger.log(`🔥 [NotificationEventListener] Event diterima: Legal Contract Approved - Contract ID ${payload.contractId}`);
    
    let projectName = `Kontrak #${payload.contractNumber || payload.contractId}`;
    let tenderId = undefined;
    let ownerUserId: number | undefined = undefined;
    
    try {
      const contractData = await this.dataSource.query(
        `SELECT t.id as tenderId, t.title as tenderTitle, t.marketing_pic_id as marketingPicId, t.created_by as createdBy 
         FROM contracts c
         LEFT JOIN proposals p ON c.proposal_id = p.id
         LEFT JOIN tenders t ON p.tender_id = t.id
         WHERE c.id = ?`,
        [payload.contractId]
      );
      if (contractData && contractData.length > 0) {
        if (contractData[0].tenderTitle) projectName = contractData[0].tenderTitle;
        if (contractData[0].tenderId) tenderId = contractData[0].tenderId;
        ownerUserId = contractData[0].marketingPicId ? Number(contractData[0].marketingPicId) : (contractData[0].createdBy ? Number(contractData[0].createdBy) : undefined);
      }
    } catch (e) {
      this.logger.warn(`Failed to fetch tender info for contract ${payload.contractId}`);
    }

    this.eventEmitter.emit('notification.send', {
      title: 'Kontrak Disetujui Legal — Siap Penugasan PM',
      message: `Kontrak "${projectName}" telah disetujui oleh tim Legal dan siap untuk penugasan Project Manager oleh PMO.`,
      type: 'TASK',
      audience: 'PMO',
      tenderId: tenderId,
      metaData: { 
        category: 'PMO',
        priority: 'HIGH',
        reference_type: 'CONTRACT',
        reference_id: payload.contractId,
        action_buttons: ['PROJECT_BOARD'],
        contractId: payload.contractId, 
        actionLink: '/project-delivery' 
      }
    });

    const marketingNotifPayload: any = {
      title: '✅ SPK Disetujui Legal',
      message: `Proyek "${projectName}" telah disetujui oleh tim Legal. Proses Sales untuk proyek ini telah selesai.`,
      type: 'SUCCESS',
      tenderId: tenderId,
      metaData: { 
        category: 'LEGAL',
        priority: 'NORMAL',
        reference_type: 'CONTRACT',
        reference_id: payload.contractId,
        action_buttons: ['VIEW_CONTRACT'],
        contractId: payload.contractId, 
        actionLink: tenderId ? `/sales/tenders/${tenderId}` : '/sales' 
      }
    };

    if (ownerUserId) {
      marketingNotifPayload.recipientId = ownerUserId;
    } else {
      marketingNotifPayload.audience = 'MARKETING';
    }

    this.eventEmitter.emit('notification.send', marketingNotifPayload);
  }

  @OnEvent('contract.revision_requested')
  async handleContractRevisionRequestedEvent(payload: { contractId: number; userId?: number; reason?: string }) {
    this.logger.log(`🔥 [NotificationEventListener] Event diterima: Contract Revision Requested - Contract ID ${payload.contractId}`);

    let projectName = `Kontrak #${payload.contractId}`;
    let tenderId = undefined;
    let ownerUserId: number | undefined = undefined;

    try {
      const contractData = await this.dataSource.query(
        `SELECT t.id as tenderId, t.title as tenderTitle, t.marketing_pic_id as marketingPicId, t.created_by as createdBy 
         FROM contracts c
         LEFT JOIN proposals p ON c.proposal_id = p.id
         LEFT JOIN tenders t ON p.tender_id = t.id
         WHERE c.id = ?`,
        [payload.contractId]
      );
      if (contractData && contractData.length > 0) {
        if (contractData[0].tenderTitle) projectName = contractData[0].tenderTitle;
        if (contractData[0].tenderId) tenderId = contractData[0].tenderId;
        ownerUserId = contractData[0].marketingPicId ? Number(contractData[0].marketingPicId) : (contractData[0].createdBy ? Number(contractData[0].createdBy) : undefined);
      }
    } catch (e) {
      this.logger.warn(`Failed to fetch tender info for contract ${payload.contractId}`);
    }

    const notifPayload: any = {
      title: '⚠️ Revisi Kontrak Diminta Legal',
      message: `Kontrak untuk proyek "${projectName}" membutuhkan revisi dari tim Legal. Catatan: ${payload.reason || 'Silakan cek catatan legal.'}`,
      type: 'WARNING',
      tenderId: tenderId,
      metaData: {
        category: 'LEGAL',
        priority: 'HIGH',
        reference_type: 'CONTRACT',
        reference_id: payload.contractId,
        action_buttons: ['REVIEW_REVISION'],
        contractId: payload.contractId,
        actionLink: tenderId ? `/sales/tenders/${tenderId}` : '/sales'
      }
    };

    if (ownerUserId) {
      notifPayload.recipientId = ownerUserId;
    } else {
      notifPayload.audience = 'MARKETING';
    }

    this.eventEmitter.emit('notification.send', notifPayload);
  }

  @OnEvent('project.started')
  async handleProjectStartedEvent(payload: { projectId: number; tenderId?: number; title?: string }) {
    this.logger.log(`🔥 [NotificationEventListener] Event diterima: Project Started - Project ID ${payload.projectId}`);

    this.eventEmitter.emit('notification.send', {
      title: '🚀 Proyek Operasional Dimulai',
      message: `Proyek "${payload.title || 'Project'}" resmi dimulai (Inisiasi PMO).`,
      type: 'INFO',
      audience: 'PMO',
      tenderId: payload.tenderId,
      metaData: {
        category: 'PMO',
        priority: 'HIGH',
        reference_type: 'PROJECT',
        reference_id: payload.projectId,
        action_buttons: ['PROJECT_BOARD'],
        actionLink: '/project-delivery'
      }
    });
  }

  /**
   * Handle 'notification.send' events from EventEmitter2.
   * 
   * Payload shape:
   * {
   *   recipientId?: number | 'C-LEVEL',  // specific user ID, or role-based target
   *   title: string,
   *   message: string,
   *   type: 'WARNING' | 'INFO' | 'SUCCESS' | 'ERROR' | 'EMAIL_AND_INAPP' | 'EMAIL_EMERGENCY',
   *   audience?: 'ALL' | 'DIRECTOR' | 'MARKETING' | 'LEGAL',  // role-based broadcast
   *   tenderId?: number,
   *   metaData?: any,
   * }
   */
  @OnEvent('notification.send')
  async handleNotificationSend(payload: {
    recipientId?: number | string | (number | string)[];
    title: string;
    message: string;
    type: string;
    audience?: string;
    tenderId?: number;
    metaData?: any;
  }) {
    this.logger.log(`[notification.send] Received: ${payload.title}`);

    try {
      // 1. Resolve target user IDs
      const targetUserIds = await this.resolveRecipients(payload);

      if (targetUserIds.length === 0) {
        this.logger.warn(`[notification.send] No target users found for: ${payload.title}`);
        return;
      }

      // 2. Create and save notifications
      const notifications: Notification[] = [];

      for (const userId of targetUserIds) {
        const notif = new Notification();
        notif.userId = userId;
        notif.title = payload.title;
        notif.message = payload.message;
        notif.notificationType = this.mapNotificationType(payload.type);
        notif.actionLink = payload.metaData?.actionLink || (payload.tenderId ? `/sales/tenders/${payload.tenderId}` : '/legal/review?tab=WAITING');
        notif.isRead = false;
        notif.createdBy = 0; // system
        notif.createdAt = new Date();

        const inputMeta = payload.metaData || {};
        const metaDataEnriched = {
          category: inputMeta.category || 'SYSTEM',
          priority: inputMeta.priority || 'NORMAL',
          reference_type: inputMeta.reference_type || (payload.tenderId ? 'TENDER' : 'SYSTEM'),
          reference_id: inputMeta.reference_id || payload.tenderId || 0,
          action_buttons: inputMeta.action_buttons || [],
          ...inputMeta
        };

        notif.metaData = metaDataEnriched;

        notifications.push(notif);
      }

      const savedNotifs = await this.notificationRepo.save(notifications);
      this.logger.log(`[notification.send] Saved ${savedNotifs.length} notifications for: ${payload.title}`);

      // 3. Push via WebSocket to each recipient
      for (const notif of savedNotifs) {
        this.notificationGateway.sendNotificationToUser(notif.userId, notif);
      }

      // 4. Send Email via BullMQ if type requires email
      if (payload.type === 'EMAIL_AND_INAPP' || payload.type === 'EMAIL_EMERGENCY') {
        for (const userId of targetUserIds) {
          const userEmail = `user_${userId}@company.com`;
          await this.emailQueue.add('send-email', {
            to: userEmail,
            subject: payload.title,
            text: payload.message,
            html: `<p>${payload.message}</p>`
          });
        }
      }

    } catch (err) {
      this.logger.error(`[notification.send] Failed to process: ${err.message}`, err.stack);
    }
  }

  /**
   * Resolve recipient user IDs based on payload.
   * Supports: specific userId, role-based audience, or C-LEVEL escalation.
   */
  private async resolveRecipients(payload: {
    recipientId?: number | string | (number | string)[];
    audience?: string;
  }): Promise<number[]> {
    let resolvedIds: Set<number> = new Set();
    let targetRoles: string[] = [];
    
    // Helper to process a single recipient ID string/number
    const processRecipient = (recId: number | string) => {
      if (typeof recId === 'number') {
        resolvedIds.add(recId);
      } else if (recId === 'C-LEVEL') {
        targetRoles.push('SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR');
      } else if (!isNaN(Number(recId))) {
        resolvedIds.add(Number(recId));
      }
    };

    // Case 1: Specific ID(s)
    if (payload.recipientId) {
      if (Array.isArray(payload.recipientId)) {
        payload.recipientId.forEach(processRecipient);
      } else {
        processRecipient(payload.recipientId);
      }
    }

    // Case 2: Role-based broadcast
    if (payload.audience === 'ALL') {
      targetRoles.push('SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR');
    } else if (payload.audience === 'DIRECTOR') {
      targetRoles.push('DIRECTOR');
    } else if (payload.audience === 'MARKETING') {
      targetRoles.push('MARKETING');
    } else if (payload.audience === 'LEGAL') {
      targetRoles.push('LEGAL', 'SUPER_ADMIN');
    } else if (payload.audience === 'PMO') {
      targetRoles.push('PMO', 'PROJECT_MANAGER', 'SUPER_ADMIN');
    } else if (payload.audience === 'HEAD_OF_OPERATIONS') {
      targetRoles.push('HEAD_OF_OPERATIONS', 'PMO');
    }

    try {
      // Validate specific recipient user IDs (must be active and not soft-deleted)
      if (resolvedIds.size > 0) {
        const idList = Array.from(resolvedIds);
        const validUsers = await this.dataSource.query(
          `SELECT id FROM users
           WHERE id IN (${idList.map(() => '?').join(',')})
             AND (is_active = 1 OR is_active = true)
             AND deleted_at IS NULL`,
          idList
        );
        const validIdSet = new Set(validUsers.map((u: any) => Number(u.id)));
        resolvedIds = new Set(Array.from(resolvedIds).filter(id => validIdSet.has(id)));
      }

      // Query role-based audience users if targetRoles specified
      if (targetRoles.length > 0) {
        const users = await this.dataSource.query(`
          SELECT DISTINCT u.id
          FROM users u
          JOIN user_roles ur ON u.id = ur.user_id
          JOIN roles r ON r.id = ur.role_id
          WHERE r.name IN (${targetRoles.map(() => '?').join(',')})
            AND (u.is_active = 1 OR u.is_active = true)
            AND u.deleted_at IS NULL
            AND r.deleted_at IS NULL
        `, targetRoles);
        users.forEach((u: any) => resolvedIds.add(Number(u.id)));
      }

      return Array.from(resolvedIds);
    } catch (err) {
      this.logger.error(`[resolveRecipients] DB query failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Map notification type strings to the enum values in the DB.
   */
  private mapNotificationType(type: string): string {
    switch (type) {
      case 'WARNING':
      case 'ERROR':
      case 'EMAIL_EMERGENCY':
      case 'EMAIL_AND_INAPP':
        return 'ALERT';
      case 'SUCCESS':
      case 'INFO':
        return 'SYSTEM';
      default:
        return 'ALERT';
    }
  }
}
