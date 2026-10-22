import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { BusinessEvent, NotificationPolicy } from '../../shared/contracts/business-event.contract';
import { CanonicalNotificationWriter } from './canonical-notification.writer';
import { NotificationService } from './notification.service';
import {
  CanonicalNotificationError,
  CanonicalNotificationInput,
  CanonicalNotificationResult,
  CanonicalProjectionConfig,
} from './canonical-notification.contract';

@Injectable()
export class CanonicalNotificationConsumer {
  private readonly logger = new Logger(CanonicalNotificationConsumer.name);

  constructor(
    private readonly writer: CanonicalNotificationWriter,
    @Optional() private readonly dataSource?: DataSource,
    @Optional() private readonly notificationService?: NotificationService,
  ) {}

  /**
   * Phase N3: Canonical Bell Projection for Marketing Milestone — Tender WON.
   * Projected strictly to explicit recipients (Marketing PIC).
   * Deduplication guaranteed via: <eventId>:<recipientId>:MARKETING_TENDER_WON.
   */
  @OnEvent('marketing.tender.won')
  async handleMarketingTenderWon(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical marketing.tender.won event (missing eventId)`,
      );
      return [];
    }

    const tenderTitle = event.payload?.title || `Tender #${event.aggregateId}`;
    return this.projectEventToNotifications(event, {
      purpose: 'MARKETING_TENDER_WON',
      type: 'ALERT',
      title: 'Tender Menang (WON)',
      message: `Tender "${tenderTitle}" telah resmi dimenangkan (WON).`,
      actionTarget: '/sales',
      metaData: {
        tenderId: event.aggregateId,
        actionType: 'MARKED_WON',
      },
    });
  }

  /**
   * Phase N3: Canonical Bell Projection for Marketing Milestone — Tender LOST.
   * Projected strictly to explicit recipients (Marketing PIC).
   * Deduplication guaranteed via: <eventId>:<recipientId>:MARKETING_TENDER_LOST.
   */
  @OnEvent('marketing.tender.lost')
  async handleMarketingTenderLost(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical marketing.tender.lost event (missing eventId)`,
      );
      return [];
    }

    const tenderTitle = event.payload?.title || `Tender #${event.aggregateId}`;
    return this.projectEventToNotifications(event, {
      purpose: 'MARKETING_TENDER_LOST',
      type: 'ALERT',
      title: 'Tender Kalah (LOST)',
      message: `Tender "${tenderTitle}" telah ditandai kalah (LOST).`,
      actionTarget: '/sales',
      metaData: {
        tenderId: event.aggregateId,
        actionType: 'MARKED_LOST',
      },
    });
  }

  /**
   * Phase FOLLOWUP-P1: Canonical Bell Projection for Daily Marketing Follow-Up Reminder.
   * Projected strictly to explicit recipient (Responsible Marketing PIC/Creator).
   * Deduplication guaranteed via: <eventId>:<recipientId>:MARKETING_FOLLOWUP_REMINDER.
   */
  @OnEvent('marketing.tender.followup_reminder')
  async handleMarketingFollowUpReminder(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical marketing.tender.followup_reminder event (missing eventId)`,
      );
      return [];
    }

    const p = event.payload;
    const reasonText = p?.reason || 'Memerlukan tindak lanjut segera.';
    const customerPrefix = p?.customerName && p.customerName !== 'N/A' ? `[${p.customerName}] ` : '';

    return this.projectEventToNotifications(event, {
      purpose: 'MARKETING_FOLLOWUP_REMINDER',
      type: 'ALERT',
      title: `Pengingat Tindak Lanjut: ${p?.title || `Tender #${event.aggregateId}`}`,
      message: `${customerPrefix}${reasonText}`,
      actionTarget: `/sales?tab=1&tenderId=${event.aggregateId}`,
      metaData: {
        tenderId: event.aggregateId,
        conditionType: p?.conditionType,
        actionType: 'MARKETING_FOLLOWUP',
      },
    });
  }

  /**
   * Phase FOLLOWUP-P1: Canonical Bell Projection for Director Inactivity Escalation.
   * Projected strictly to explicit recipients (all active Directors).
   * Deduplication guaranteed via: <eventId>:<recipientId>:MARKETING_DIRECTOR_ESCALATION.
   */
  @OnEvent('marketing.tender.director_escalation')
  async handleMarketingDirectorEscalation(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical marketing.tender.director_escalation event (missing eventId)`,
      );
      return [];
    }

    const p = event.payload;
    const daysInactive = p?.calendarDaysInactive || 2;
    const picName = p?.picFullName || 'Marketing PIC';

    return this.projectEventToNotifications(event, {
      purpose: 'MARKETING_DIRECTOR_ESCALATION',
      type: 'ALERT',
      title: `Eskalasi Tender: Tidak Ada Kemajuan (${daysInactive} Hari)`,
      message: `Tender "${p?.title || `Tender #${event.aggregateId}`}" (${picName}) tidak mengalami aktivitas bermakna selama ${daysInactive} hari kalender. Alasan: ${p?.reason || 'Perlu Perhatian'}.`,
      actionTarget: `/sales?tab=1&tenderId=${event.aggregateId}`,
      metaData: {
        tenderId: event.aggregateId,
        conditionType: p?.conditionType,
        calendarDaysInactive: daysInactive,
        actionType: 'DIRECTOR_ESCALATION',
      },
    });
  }

  /**
   * Phase N4: Canonical Bell Projection for Marketing -> Legal Handover (SPK Uploaded).
   * Informs Legal team that a contract draft is submitted and ready for review.
   * Deduplication guaranteed via: <eventId>:<recipientId>:LEGAL_REVIEW_CONTRACT_SUBMITTED.
   */
  @OnEvent('marketing.spk.uploaded')
  async handleMarketingSpkUploaded(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical marketing.spk.uploaded event (missing eventId)`,
      );
      return [];
    }

    const isRevision = Boolean(event.payload?.isRevision);
    const tenderTitle = event.payload?.title || `Tender #${event.payload?.tenderId || event.aggregateId}`;
    const contractId = event.payload?.contractId || event.aggregateId;

    // Resolve recipient Legal users from DataSource if available, or event.routing?.userIds
    const legalRecipientIds = await this.resolveRoleUserIds(['LEGAL', 'SUPER_ADMIN']);
    const recipientIds = legalRecipientIds.length > 0
      ? legalRecipientIds
      : (event.routing?.userIds || []);

    return this.projectEventToNotifications(event, {
      purpose: 'LEGAL_REVIEW_CONTRACT_SUBMITTED',
      type: 'ALERT',
      title: isRevision ? 'Dokumen Revisi SPK Diunggah' : 'Draft Kontrak Baru Siap Direview',
      message: isRevision
        ? `Dokumen revisi SPK untuk tender "${tenderTitle}" telah diunggah dan siap direview kembali oleh tim Legal.`
        : `Tender "${tenderTitle}" memiliki draft kontrak #${contractId} yang siap direview.`,
      actionTarget: isRevision ? '/legal/review?tab=REVISION' : '/legal/review?tab=WAITING',
      recipientIds,
      metaData: {
        category: 'LEGAL',
        contractId,
        tenderId: event.payload?.tenderId,
        actionType: isRevision ? 'REVISED_SPK_UPLOADED' : 'SPK_UPLOADED',
      },
    });
  }

  /**
   * Phase N4: Canonical Bell Projection for Legal Review Milestone — Contract APPROVED.
   * Informational notification to:
   * 1. PMO & SUPER_ADMIN (Contract active, ready for Kick Off / PM Assignment; PROJECT_MANAGER isolated)
   * 2. Marketing PIC (Sales completion confirmation)
   * Deduplication guaranteed via: <eventId>:<recipientId>:<purpose>.
   */
  @OnEvent('legal.contract.approved')
  async handleLegalContractApproved(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical legal.contract.approved event (missing eventId)`,
      );
      return [];
    }

    const contractId = event.payload?.contractId || event.aggregateId;
    const tenderTitle = event.payload?.tenderTitle || `Kontrak #${event.payload?.contractNumber || contractId}`;
    const tenderId = event.payload?.tenderId;
    const marketingPicId = event.payload?.marketingPicId;

    const results: CanonicalNotificationResult[] = [];

    // 1. Projection to PMO & SUPER_ADMIN (strictly excluding PROJECT_MANAGER)
    const pmoRecipientIds = await this.resolveRoleUserIds(['PMO', 'SUPER_ADMIN'], ['PROJECT_MANAGER']);
    if (pmoRecipientIds.length > 0) {
      const pmoResults = await this.projectEventToNotifications(event, {
        purpose: 'LEGAL_CONTRACT_APPROVED_PMO',
        type: 'ALERT',
        title: 'Kontrak Disetujui Legal — Siap Penugasan PM',
        message: `Kontrak "${tenderTitle}" telah disetujui oleh tim Legal dan siap untuk penugasan Project Manager oleh PMO.`,
        actionTarget: '/project-delivery',
        recipientIds: pmoRecipientIds,
        metaData: {
          category: 'PMO',
          priority: 'HIGH',
          reference_type: 'CONTRACT',
          reference_id: contractId,
          contractId,
          tenderId,
          actionType: 'CONTRACT_APPROVED',
        },
      });
      results.push(...pmoResults);
    }

    // 2. Projection to Marketing PIC (informative sales completion milestone)
    if (marketingPicId && typeof marketingPicId === 'number' && marketingPicId > 0) {
      const mktResults = await this.projectEventToNotifications(event, {
        purpose: 'LEGAL_CONTRACT_APPROVED_MARKETING',
        type: 'SYSTEM',
        title: 'SPK Disetujui Legal',
        message: `Proyek "${tenderTitle}" telah disetujui oleh tim Legal. Proses Sales untuk proyek ini telah selesai.`,
        actionTarget: tenderId ? `/sales/tenders/${tenderId}` : '/sales',
        recipientIds: [marketingPicId],
        metaData: {
          category: 'LEGAL',
          priority: 'NORMAL',
          reference_type: 'CONTRACT',
          reference_id: contractId,
          contractId,
          tenderId,
          actionType: 'CONTRACT_APPROVED',
        },
      });
      results.push(...mktResults);
    }

    const approvingActorId = (event as any).actor?.userId || event.payload?.actor?.userId || event.payload?.actorId;
    if (approvingActorId && this.notificationService) {
      await this.notificationService.markRelatedNotificationsRead(approvingActorId, 'CONTRACT', contractId);
    }

    return results;
  }

  /**
   * Phase N4: Canonical Bell Projection for Legal Review Milestone — Contract REVISION_REQUESTED.
   * Informational notification to Marketing PIC that revision is requested.
   * Deduplication guaranteed via: <eventId>:<recipientId>:LEGAL_CONTRACT_REVISION_REQUESTED.
   */
  @OnEvent('legal.contract.revision_requested')
  async handleLegalContractRevisionRequested(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical legal.contract.revision_requested event (missing eventId)`,
      );
      return [];
    }

    const contractId = event.payload?.contractId || event.aggregateId;
    const tenderTitle = event.payload?.tenderTitle || `Kontrak #${event.payload?.contractNumber || contractId}`;
    const tenderId = event.payload?.tenderId;
    const marketingPicId = event.payload?.marketingPicId;
    const reason = event.payload?.reason || 'Silakan cek catatan legal.';

    if (!marketingPicId || typeof marketingPicId !== 'number' || marketingPicId <= 0) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] No Marketing PIC found for legal revision on Contract #${contractId}. Zero Bell generated.`,
      );
      return [];
    }

    return this.projectEventToNotifications(event, {
      purpose: 'LEGAL_CONTRACT_REVISION_REQUESTED',
      type: 'ALERT',
      title: 'Revisi Kontrak Diminta Legal',
      message: `Kontrak untuk proyek "${tenderTitle}" membutuhkan revisi dari tim Legal. Catatan: ${reason}`,
      actionTarget: tenderId ? `/sales/tenders/${tenderId}` : '/sales',
      recipientIds: [marketingPicId],
      metaData: {
        category: 'LEGAL',
        priority: 'HIGH',
        reference_type: 'CONTRACT',
        reference_id: contractId,
        contractId,
        tenderId,
        actionType: 'REVISION_REQUESTED',
        reason,
      },
    });
  }

  /**
   * Phase N5: Canonical Bell Projection for PMO -> PM Assignment.
   * Informs the assigned Project Manager that they have been officially assigned.
   * Deduplication guaranteed via: <eventId>:<recipientId>:PROJECT_PM_ASSIGNED.
   * Recipient: strictly the assigned PM (isolated, zero broadcast to other PMs).
   */
  @OnEvent('project.pm.assigned')
  async handleProjectPmAssigned(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical project.pm.assigned event (missing eventId)`,
      );
      return [];
    }

    const payload = event.payload || {};
    const projectId = payload.projectId || event.aggregateId;
    const projectCode = payload.projectCode || String(projectId);
    const projectManagerId =
      payload.projectManagerId ||
      (event.routing?.userIds && event.routing.userIds.length > 0 ? event.routing.userIds[0] : undefined);

    if (!projectManagerId) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] project.pm.assigned missing projectManagerId (eventId: ${event.eventId})`,
      );
      return [];
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROJECT_PM_ASSIGNED',
      type: 'INFO',
      title: 'Penugasan Project Manager Baru',
      message: `Anda telah resmi ditugaskan sebagai Project Manager untuk proyek #${projectCode}. Silakan mulai menyusun Operational Plan.`,
      actionTarget: '/project-delivery',
      recipientIds: [Number(projectManagerId)],
      metaData: {
        category: 'PROJECT',
        priority: 'HIGH',
        reference_type: 'PROJECT',
        reference_id: projectId,
        contractId: payload.contractId,
        projectCode,
        actionType: 'PROJECT_PM_ASSIGNED',
        action_buttons: ['OPERATIONAL_PLAN'],
      },
    });
  }

  /**
   * Phase N7: Canonical Bell Projection for Finance Milestone — Payment Recorded.
   * Informational notification to:
   * 1. Project Manager linked to the PO (if resolved via PO -> PR -> Project)
   * 2. Finance User who recorded the payment (if recordedBy exists and != pmId)
   * Deduplication guaranteed via: <eventId>:<recipientId>:<purpose>.
   */
  @OnEvent('finance.payment.recorded')
  async handleFinancePaymentRecorded(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical finance.payment.recorded event (missing eventId)`,
      );
      return [];
    }

    const payload = event.payload || {};
    const paymentId = payload.paymentId || event.aggregateId;
    const poId = payload.poId;
    const amount = Number(payload.amount || 0);
    const paymentNumber = payload.paymentNumber || (paymentId ? `PAY-${paymentId}` : 'Pembayaran');
    const recordedBy = payload.recordedBy
      ? Number(payload.recordedBy)
      : (event.actor?.userId ? Number(event.actor.userId) : null);

    const results: CanonicalNotificationResult[] = [];

    // 1. Resolve Project Manager for the PO
    let pmId: number | null = payload.projectManagerId ? Number(payload.projectManagerId) : null;
    if (!pmId && poId) {
      pmId = await this.resolvePmUserIdFromPo(Number(poId));
    }

    // 2. Notification for Project Manager
    if (pmId && pmId > 0) {
      const pmResults = await this.projectEventToNotifications(event, {
        purpose: 'FINANCE_PAYMENT_RECORDED_PM',
        type: 'ALERT',
        title: 'Pembayaran Diterima',
        message: `Pembayaran ${paymentNumber} senilai Rp ${amount.toLocaleString('id-ID')} untuk PO #${poId} telah diproses`,
        actionTarget: `/procurement?tab=po&poId=${poId}`,
        recipientIds: [pmId],
        metaData: {
          category: 'FINANCE',
          priority: 'NORMAL',
          reference_type: 'PAYMENT',
          reference_id: paymentId,
          paymentId,
          poId,
          amount,
          paymentNumber,
          actionType: 'PAYMENT_RECORDED',
        },
      });
      results.push(...pmResults);
    }

    // 3. Notification for Finance User (payer)
    if (recordedBy && recordedBy > 0 && recordedBy !== pmId) {
      const finResults = await this.projectEventToNotifications(event, {
        purpose: 'FINANCE_PAYMENT_RECORDED_PAYER',
        type: 'SYSTEM',
        title: 'Transaksi Berhasil',
        message: `Pembayaran senilai Rp ${amount.toLocaleString('id-ID')} berhasil dicatat`,
        actionTarget: `/finance/payments`,
        recipientIds: [recordedBy],
        metaData: {
          category: 'FINANCE',
          priority: 'NORMAL',
          reference_type: 'PAYMENT',
          reference_id: paymentId,
          paymentId,
          poId,
          amount,
          paymentNumber,
          actionType: 'PAYMENT_RECORDED',
        },
      });
      results.push(...finResults);
    }

    return results;
  }

  /**
   * Phase N8: Canonical Bell Projection for System / SLA — SPK Grace Period Expired.
   * Informational alert to Marketing PIC + Directors that 48h SLA expired and tender was demoted.
   * Deduplication guaranteed via: <eventId>:<recipientId>:SYSTEM_SLA_SPK_GRACE_EXPIRED.
   */
  @OnEvent('system.sla.spk_grace_expired')
  async handleSystemSlaSpkGraceExpired(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical system.sla.spk_grace_expired event (missing eventId)`,
      );
      return [];
    }

    const tenderId = event.payload?.tenderId || event.aggregateId;

    return this.projectEventToNotifications(event, {
      purpose: 'SYSTEM_SLA_SPK_GRACE_EXPIRED',
      type: 'ALERT',
      title: 'SPK Belum Diunggah',
      message: 'Grace Period 2x24 jam telah berakhir. Tender dikembalikan ke NEGOTIATION. Silakan unggah SPK untuk melanjutkan proses menuju WON dan Legal Review.',
      actionTarget: `/sales/tenders/${tenderId}`,
      metaData: {
        category: 'MARKETING',
        priority: 'HIGH',
        reference_type: 'TENDER',
        reference_id: tenderId,
        tender_id: tenderId,
        action_type: 'SPK_REQUIRED',
        marketing_pic_id: event.payload?.marketingPicId,
      },
    });
  }

  /**
   * Phase N8: Canonical Bell Projection for System / SLA — Legal Revision SLA Expired.
   * Informational alert to Marketing PIC + Directors that 72h SLA expired and contract/tender demoted.
   * Deduplication guaranteed via: <eventId>:<recipientId>:SYSTEM_SLA_REVISION_EXPIRED.
   */
  @OnEvent('system.sla.revision_expired')
  async handleSystemSlaRevisionExpired(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical system.sla.revision_expired event (missing eventId)`,
      );
      return [];
    }

    const contractId = event.payload?.contractId || event.aggregateId;
    const tenderId = event.payload?.tenderId;
    const tenderTitle = event.payload?.tenderTitle || `Tender #${tenderId || contractId}`;

    return this.projectEventToNotifications(event, {
      purpose: 'SYSTEM_SLA_REVISION_EXPIRED',
      type: 'ALERT',
      title: 'Tender Dikembalikan ke Negotiation',
      message: `${tenderTitle} telah dikembalikan dari WON ke NEGOTIATION karena batas waktu revisi SPK 3 hari telah berakhir dan dokumen revisi belum diunggah.`,
      actionTarget: tenderId ? `/sales/tenders/${tenderId}` : '/sales',
      metaData: {
        category: 'LEGAL',
        priority: 'HIGH',
        reference_type: 'CONTRACT',
        reference_id: contractId,
        contract_id: contractId,
        tender_id: tenderId,
        action_type: 'DEMOTION',
        reason: 'LEGAL_REVISION_SLA_EXPIRED',
        marketing_pic_id: event.payload?.marketingPicId,
      },
    });
  }

  /**
   * Phase N8: Canonical Bell Projection for System / SLA — Legal Revision SLA H-1 Reminder.
   * Informational reminder to Marketing PIC + Directors that less than 24h remain for SPK revision.
   * Deduplication guaranteed via: <eventId>:<recipientId>:SYSTEM_SLA_REVISION_REMINDER_H1.
   */
  @OnEvent('system.sla.revision_reminder_h1')
  async handleSystemSlaRevisionReminderH1(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical system.sla.revision_reminder_h1 event (missing eventId)`,
      );
      return [];
    }

    const contractId = event.payload?.contractId || event.aggregateId;
    const tenderId = event.payload?.tenderId;

    return this.projectEventToNotifications(event, {
      purpose: 'SYSTEM_SLA_REVISION_REMINDER_H1',
      type: 'ALERT',
      title: 'Pengingat: Batas Waktu Revisi SPK H-1',
      message: 'Batas waktu revisi dokumen SPK tersisa kurang dari 24 jam. Segera unggah dokumen revisi agar tender tidak dikembalikan ke NEGOTIATION.',
      actionTarget: tenderId ? `/sales/tenders/${tenderId}` : '/sales',
      metaData: {
        category: 'LEGAL',
        priority: 'HIGH',
        reference_type: 'CONTRACT',
        reference_id: contractId,
        contract_id: contractId,
        tender_id: tenderId,
        action_type: 'REVISION_REMINDER_H1',
        marketing_pic_id: event.payload?.marketingPicId,
      },
    });
  }

  /**
   * Phase N8: Canonical Bell Projection for System / SLA — Discount Approval Timeout.
   * Emergency escalation alert to C-Suite (SUPER_ADMIN, GENERAL_MANAGER, DIRECTOR).
   * Enqueues BullMQ email job with deduplicated jobId: email:<dedupeKey>.
   * Deduplication guaranteed via: <eventId>:<recipientId>:SYSTEM_SLA_DISCOUNT_TIMEOUT.
   */
  @OnEvent('system.sla.discount_timeout')
  async handleSystemSlaDiscountTimeout(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical system.sla.discount_timeout event (missing eventId)`,
      );
      return [];
    }

    const tenderId = event.payload?.tenderId || event.aggregateId;
    const tenderTitle = event.payload?.tenderTitle || `Tender #${tenderId}`;

    let recipientIds: number[] = [];
    if (event.routing?.userIds && event.routing.userIds.length > 0) {
      recipientIds = event.routing.userIds;
    } else {
      recipientIds = await this.resolveRoleUserIds(['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR']);
    }

    return this.projectEventToNotifications(event, {
      purpose: 'SYSTEM_SLA_DISCOUNT_TIMEOUT',
      type: 'ALERT',
      title: 'URGENT: Tender Approval Escalated',
      message: `Tender ${tenderTitle} memerlukan persetujuan diskon lebih dari 20%. Tidak ada respon dari Direktur dalam 2 jam terakhir.`,
      actionTarget: `/sales/tenders/${tenderId}`,
      recipientIds,
      sendEmail: true,
      metaData: {
        category: 'MARKETING',
        priority: 'URGENT',
        reference_type: 'TENDER',
        reference_id: tenderId,
        tender_id: tenderId,
        action_type: 'AUTO_ESCALATE',
      },
    });
  }

  /**
   * Phase N8: Canonical Bell Projection for System / SLA — Grace SLA Extended.
   * Confirmation notification to the user who requested the extension.
   * Deduplication guaranteed via: <eventId>:<recipientId>:SYSTEM_SLA_GRACE_EXTENDED.
   */
  @OnEvent('system.sla.grace_extended')
  async handleSystemSlaGraceExtended(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical system.sla.grace_extended event (missing eventId)`,
      );
      return [];
    }

    const contractId = event.payload?.contractId || event.aggregateId;
    const daysToAdd = event.payload?.daysAdded || 3;
    const extensionCount = event.payload?.extensionCount || 1;
    const formattedDeadline = event.payload?.formattedDeadline || '';

    return this.projectEventToNotifications(event, {
      purpose: 'SYSTEM_SLA_GRACE_EXTENDED',
      type: 'SYSTEM',
      title: 'Grace SLA Deadline Diperpanjang',
      message: `Batas waktu SLA Kontrak diperpanjang +${daysToAdd} hari hingga ${formattedDeadline}. (Perpanjangan ke-${extensionCount}/3).`,
      actionTarget: '/legal/review?tab=REVISION',
      metaData: {
        category: 'LEGAL',
        priority: 'NORMAL',
        reference_type: 'CONTRACT',
        reference_id: contractId,
        contractId,
        actionType: 'SLA_GRACE_EXTENDED',
        extensionCount,
      },
    });
  }

  /**
   * Phase N8.1: Canonical Bell Projection for Marketing Milestone — Go/No-Go Submitted.
   * Personal tracking confirmation to submitter (Marketing PIC).
   * Deduplication guaranteed via: <eventId>:<recipientId>:MARKETING_GONOGO_SUBMITTED.
   */
  @OnEvent('marketing.gonogo.submitted')
  async handleMarketingGoNoGoSubmitted(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical marketing.gonogo.submitted event (missing eventId)`,
      );
      return [];
    }

    const tenderTitle = event.payload?.tenderTitle || `Tender #${event.payload?.tenderId || event.aggregateId}`;
    const tenderId = event.payload?.tenderId || event.aggregateId;

    return this.projectEventToNotifications(event, {
      purpose: 'MARKETING_GONOGO_SUBMITTED',
      type: 'INFO',
      title: 'GO/NO GO Berhasil Diajukan',
      message: `Tender "${tenderTitle}" sedang menunggu APPROVE Director.`,
      actionTarget: `/sales/tenders/${tenderId}`,
      metaData: {
        category: 'MARKETING',
        tenderId,
        actionType: 'GO_NOGO_SUBMITTED',
      },
    });
  }

  /**
   * Phase N8.1: Canonical Bell Projection for Marketing Milestone — Go/No-Go Approved (GO).
   * Informational milestone notification to Marketing PIC.
   * Deduplication guaranteed via: <eventId>:<recipientId>:MARKETING_GONOGO_APPROVED.
   */
  @OnEvent('marketing.gonogo.approved')
  async handleMarketingGoNoGoApproved(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical marketing.gonogo.approved event (missing eventId)`,
      );
      return [];
    }

    const tenderTitle = event.payload?.tenderTitle || `Tender #${event.payload?.tenderId || event.aggregateId}`;
    const tenderId = event.payload?.tenderId || event.aggregateId;

    return this.projectEventToNotifications(event, {
      purpose: 'MARKETING_GONOGO_APPROVED',
      type: 'SUCCESS',
      title: 'Tender Disetujui (GO)',
      message: `Tender "${tenderTitle}" telah disetujui. Status berubah menjadi Qualification.`,
      actionTarget: `/sales/tenders/${tenderId}`,
      metaData: {
        category: 'MARKETING',
        tenderId,
        actionType: 'GO_NOGO_APPROVED',
      },
    });
  }

  /**
   * Phase N8.1: Canonical Bell Projection for Marketing — Critical Discount Warning.
   * Alert to Directors & General Managers when requested discount exceeds max authorized discount.
   * Deduplication guaranteed via: <eventId>:<recipientId>:MARKETING_DISCOUNT_CRITICAL_WARNING.
   */
  @OnEvent('marketing.discount.critical_warning')
  async handleMarketingDiscountCriticalWarning(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical marketing.discount.critical_warning event (missing eventId)`,
      );
      return [];
    }

    const tenderTitle = event.payload?.tenderTitle || `Tender #${event.payload?.tenderId || event.aggregateId}`;
    const tenderId = event.payload?.tenderId || event.aggregateId;
    const discountPercentage = event.payload?.discountPercentage || 0;
    const maxDiscount = event.payload?.maxDiscount || 20;

    const directorRecipientIds = await this.resolveRoleUserIds(['DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN']);
    const recipientIds = directorRecipientIds.length > 0
      ? directorRecipientIds
      : (event.routing?.userIds || []);

    return this.projectEventToNotifications(event, {
      purpose: 'MARKETING_DISCOUNT_CRITICAL_WARNING',
      type: 'WARNING',
      title: 'Peringatan Diskon Kritis',
      message: `Tender ${tenderTitle} mengajukan diskon ${discountPercentage}% (Batas: ${maxDiscount}%). Menunggu persetujuan Direktur.`,
      actionTarget: `/sales?tab=1&tenderId=${tenderId}&action=discount-approval`,
      recipientIds,
      metaData: {
        category: 'MARKETING',
        tenderId,
        actionType: 'CRITICAL_DISCOUNT_WARNING',
      },
    });
  }

  /**
   * Phase N8.1: Canonical Bell Projection for Marketing — Discount Rejected.
   * Informs Marketing PIC that requested discount was rejected and price reverted.
   * Deduplication guaranteed via: <eventId>:<recipientId>:MARKETING_DISCOUNT_REJECTED.
   */
  @OnEvent('marketing.discount.rejected')
  async handleMarketingDiscountRejected(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical marketing.discount.rejected event (missing eventId)`,
      );
      return [];
    }

    const tenderTitle = event.payload?.tenderTitle || `Tender #${event.payload?.tenderId || event.aggregateId}`;
    const tenderId = event.payload?.tenderId || event.aggregateId;
    const notes = event.payload?.notes || '-';

    return this.projectEventToNotifications(event, {
      purpose: 'MARKETING_DISCOUNT_REJECTED',
      type: 'WARNING',
      title: 'Diskon Ditolak',
      message: `Pengajuan diskon untuk tender ${tenderTitle} DITOLAK. Harga dikembalikan ke awal. Notes: ${notes}`,
      actionTarget: `/sales/tenders/${tenderId}`,
      metaData: {
        category: 'MARKETING',
        tenderId,
        actionType: 'DISCOUNT_REJECTED',
      },
    });
  }

  /**
   * Phase N8.1: Canonical Bell Projection for Marketing — Discount Approved.
   * Informs Marketing PIC that requested discount was approved by Director.
   * Deduplication guaranteed via: <eventId>:<recipientId>:MARKETING_DISCOUNT_APPROVED.
   */
  @OnEvent('marketing.discount.approved')
  async handleMarketingDiscountApproved(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical marketing.discount.approved event (missing eventId)`,
      );
      return [];
    }

    const tenderTitle = event.payload?.tenderTitle || `Tender #${event.payload?.tenderId || event.aggregateId}`;
    const tenderId = event.payload?.tenderId || event.aggregateId;
    const notes = event.payload?.notes || '-';

    return this.projectEventToNotifications(event, {
      purpose: 'MARKETING_DISCOUNT_APPROVED',
      type: 'SUCCESS',
      title: 'Diskon Disetujui',
      message: `Pengajuan diskon untuk tender ${tenderTitle} DISETUJUI oleh Direktur. Notes: ${notes}`,
      actionTarget: `/sales/tenders/${tenderId}`,
      metaData: {
        category: 'MARKETING',
        tenderId,
        actionType: 'DISCOUNT_APPROVED',
      },
    });
  }

  /**
   * Phase N8.1: Canonical Bell Projection for Project — Operational Started (PMO Initiation).
   * Informs PMO & SUPER_ADMIN that project operational is initiated and ready on Project Board.
   * Deduplication guaranteed via: <eventId>:<recipientId>:PROJECT_OPERATIONAL_STARTED.
   */
  @OnEvent('project.started')
  async handleProjectStarted(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical project.started event (missing eventId)`,
      );
      return [];
    }

    const tenderTitle = event.payload?.tenderTitle || event.payload?.title || `Project #${event.payload?.projectId || event.aggregateId}`;
    const projectId = event.payload?.projectId;
    const tenderId = event.payload?.tenderId;

    const pmoRecipientIds = await this.resolveRoleUserIds(['PMO', 'SUPER_ADMIN'], ['PROJECT_MANAGER']);
    const recipientIds = pmoRecipientIds.length > 0
      ? pmoRecipientIds
      : (event.routing?.userIds || []);

    return this.projectEventToNotifications(event, {
      purpose: 'PROJECT_OPERATIONAL_STARTED',
      type: 'INFO',
      title: 'Proyek Operasional Dimulai',
      message: `Proyek "${tenderTitle}" resmi dimulai (Inisiasi PMO).`,
      actionTarget: '/project-delivery',
      recipientIds,
      metaData: {
        category: 'PMO',
        priority: 'HIGH',
        reference_type: 'PROJECT',
        reference_id: projectId,
        tenderId,
        actionType: 'PROJECT_STARTED',
      },
    });
  }

  @OnEvent('project.closure.submitted')
  async handleProjectClosureSubmitted(event: any): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') return [];
    const eventId = event.eventId || event.event_id;
    if (!eventId) return [];

    const payload = event.payload?.businessPayload || event.payload || {};
    const projectId = payload.projectId;
    const projectCode = payload.projectCode || `PRJ-${projectId}`;
    const closureId = payload.closureId || event.aggregate_id || event.aggregateId;

    const hooUserIds = await this.resolveRoleUserIds(['HEAD_OF_OPERATIONS', 'SUPER_ADMIN']);
    const recipientIds = hooUserIds.length > 0 ? hooUserIds : (event.routing?.userIds || []);

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_CLOSURE_SUBMITTED',
        type: 'ALERT',
        title: 'Pengajuan Penutupan Proyek',
        message: `Penutupan proyek "${projectCode}" diajukan oleh PM dan membutuhkan review Head of Operations.`,
        actionTarget: `/governance/tasks?projectId=${projectId}`,
        recipientIds,
        metaData: {
          category: 'PROJECT_CLOSURE',
          priority: 'HIGH',
          reference_type: 'PROJECT_CLOSURE',
          reference_id: closureId,
          projectId,
          closureId,
          actionType: 'CLOSURE_SUBMITTED',
        },
      },
    );
  }

  @OnEvent('project.closure.hoo.approved')
  @OnEvent('project.closure.hoo_reviewed')
  async handleProjectClosureHooReviewed(event: any): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') return [];
    const eventId = event.eventId || event.event_id;
    if (!eventId) return [];

    const payload = event.payload?.businessPayload || event.payload || {};
    const projectId = payload.projectId;
    const projectCode = payload.projectCode || `PRJ-${projectId}`;
    const closureId = payload.closureId || event.aggregate_id || event.aggregateId;

    const directorUserIds = await this.resolveRoleUserIds(['DIRECTOR', 'SUPER_ADMIN']);
    const recipientIds = directorUserIds.length > 0 ? directorUserIds : (event.routing?.userIds || []);

    const actorId = (event as any).actor?.userId || payload.actorId || payload.actor?.userId;
    if (actorId && this.notificationService) {
      await this.notificationService.markRelatedNotificationsRead(actorId, 'PROJECT_CLOSURE', closureId);
    }

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_CLOSURE_HOO_APPROVED',
        type: 'ALERT',
        title: 'Persetujuan Penutupan Proyek Direktur',
        message: `Penutupan proyek "${projectCode}" telah disetujui HOO dan menunggu persetujuan Direktur.`,
        actionTarget: `/governance/tasks?projectId=${projectId}`,
        recipientIds,
        metaData: {
          category: 'PROJECT_CLOSURE',
          priority: 'HIGH',
          reference_type: 'PROJECT_CLOSURE',
          reference_id: closureId,
          projectId,
          closureId,
          actionType: 'CLOSURE_HOO_APPROVED',
        },
      },
    );
  }

  @OnEvent('project.closure.director.approved')
  @OnEvent('project.closure.approved')
  async handleProjectClosureApproved(event: any): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') return [];
    const eventId = event.eventId || event.event_id;
    if (!eventId) return [];

    const payload = event.payload?.businessPayload || event.payload || {};
    const projectId = payload.projectId;
    const projectCode = payload.projectCode || `PRJ-${projectId}`;
    const closureId = payload.closureId || event.aggregate_id || event.aggregateId;

    let pmId: number | null = payload.actorId ? Number(payload.actorId) : null;
    if (!pmId && projectId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT manager_id FROM projects WHERE id = ?`, [projectId]);
        if (rows && rows.length > 0 && rows[0].manager_id) pmId = Number(rows[0].manager_id);
      } catch {}
    }
    const recipientIds = pmId ? [pmId] : (event.routing?.userIds || []);

    const actorId = (event as any).actor?.userId || payload.actorId || payload.actor?.userId;
    if (actorId && this.notificationService) {
      await this.notificationService.markRelatedNotificationsRead(actorId, 'PROJECT_CLOSURE', closureId);
    }

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_CLOSURE_APPROVED',
        type: 'SYSTEM',
        title: 'Penutupan Proyek Disetujui',
        message: `Penutupan proyek "${projectCode}" telah disetujui Direktur. Proyek resmi ditutup.`,
        actionTarget: `/project-delivery?view=workspace&projectId=${projectId}&section=closure`,
        recipientIds,
        metaData: {
          category: 'PROJECT_CLOSURE',
          priority: 'NORMAL',
          reference_type: 'PROJECT_CLOSURE',
          reference_id: closureId,
          projectId,
          closureId,
          actionType: 'CLOSURE_APPROVED',
        },
      },
    );
  }

  @OnEvent('project.closure.hoo.returned')
  @OnEvent('project.closure.director.returned')
  @OnEvent('project.closure.returned')
  async handleProjectClosureReturned(event: any): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') return [];
    const eventId = event.eventId || event.event_id;
    if (!eventId) return [];

    const payload = event.payload?.businessPayload || event.payload || {};
    const projectId = payload.projectId;
    const projectCode = payload.projectCode || `PRJ-${projectId}`;
    const closureId = payload.closureId || event.aggregate_id || event.aggregateId;
    const returnReason = payload.returnReason || 'Penutupan proyek dikembalikan untuk revisi.';

    let pmId: number | null = payload.actorId ? Number(payload.actorId) : null;
    if (!pmId && projectId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT manager_id FROM projects WHERE id = ?`, [projectId]);
        if (rows && rows.length > 0 && rows[0].manager_id) pmId = Number(rows[0].manager_id);
      } catch {}
    }
    const recipientIds = pmId ? [pmId] : (event.routing?.userIds || []);

    const actorId = (event as any).actor?.userId || payload.actorId || payload.actor?.userId;
    if (actorId && this.notificationService) {
      await this.notificationService.markRelatedNotificationsRead(actorId, 'PROJECT_CLOSURE', closureId);
    }

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_CLOSURE_RETURNED',
        type: 'ALERT',
        title: 'Penutupan Proyek Dikembalikan',
        message: `Pengajuan penutupan proyek "${projectCode}" dikembalikan. Catatan: ${returnReason}`,
        actionTarget: `/project-delivery?view=workspace&projectId=${projectId}&section=closure`,
        recipientIds,
        metaData: {
          category: 'PROJECT_CLOSURE',
          priority: 'HIGH',
          reference_type: 'PROJECT_CLOSURE',
          reference_id: closureId,
          projectId,
          closureId,
          actionType: 'CLOSURE_RETURNED',
        },
      },
    );
  }

  private async resolvePmUserIdFromPo(poId: number): Promise<number | null> {
    if (!this.dataSource || !poId) return null;
    try {
      const rows = await this.dataSource.query(
        `SELECT p.manager_id
         FROM purchase_orders po
         JOIN purchase_requests pr ON pr.id = po.pr_id
         JOIN projects p ON p.id = pr.project_id
         WHERE po.id = ?
           AND po.deleted_at IS NULL
           AND p.deleted_at IS NULL
         LIMIT 1`,
        [poId],
      );
      if (rows && rows.length > 0) {
        const mgrId = rows[0].manager_id ?? rows[0].managerId;
        if (mgrId) return Number(mgrId);
      }
      return null;
    } catch (err: any) {
      this.logger.error(`[CanonicalNotificationConsumer] Failed to resolve PM for PO #${poId}: ${err.message}`);
      return null;
    }
  }

  private async resolveRoleUserIds(roles: string[], excludeRoles: string[] = []): Promise<number[]> {
    if (!this.dataSource || !roles || roles.length === 0) return [];
    try {
      const users = await this.dataSource.query(
        `SELECT DISTINCT u.id
         FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.name IN (${roles.map(() => '?').join(',')})
           AND (u.is_active = 1 OR u.is_active = true)
           AND u.deleted_at IS NULL
           AND r.deleted_at IS NULL`,
        roles,
      );
      let userIds = users.map((u: any) => Number(u.id));
      if (excludeRoles.length > 0) {
        const excluded = await this.dataSource.query(
          `SELECT DISTINCT u.id
           FROM users u
           JOIN user_roles ur ON u.id = ur.user_id
           JOIN roles r ON r.id = ur.role_id
           WHERE r.name IN (${excludeRoles.map(() => '?').join(',')})
             AND u.deleted_at IS NULL`,
          excludeRoles,
        );
        const excludeSet = new Set(excluded.map((u: any) => Number(u.id)));
        userIds = userIds.filter((id: number) => !excludeSet.has(id));
      }
      return userIds;
    } catch (err: any) {
      this.logger.error(`[CanonicalNotificationConsumer] Failed to resolve role users for ${roles.join(',')}: ${err.message}`);
      return [];
    }
  }

  /**
   * Projects a canonical BusinessEvent into persistent Bell notification(s).
   * 
   * Strict Architectural Invariants:
   * 1. If event.notificationPolicy === 'SYNC_ONLY', projection is bypassed entirely.
   * 2. Recipients must be explicitly provided in event.routing.userIds or projectionConfig.recipientIds.
   * 3. Zero semantic guessing of recipients.
   * 4. Idempotency guaranteed via eventId + recipientId + purpose dedupeKey.
   */
  public async projectEventToNotifications(
    event: BusinessEvent,
    config: CanonicalProjectionConfig,
  ): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') {
      throw new CanonicalNotificationError('INVALID_PROJECTION', 'Event must be a valid BusinessEvent.');
    }

    if (!event.eventId || typeof event.eventId !== 'string' || event.eventId.trim().length === 0) {
      throw new CanonicalNotificationError(
        'MISSING_EVENT_ID',
        'Canonical BusinessEvent must contain a valid non-empty eventId.',
      );
    }

    // Invariant: SYNC_ONLY policy produces zero Bell notifications
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping projection for event '${event.eventName}' (${event.eventId}): notificationPolicy is SYNC_ONLY`,
      );
      return [];
    }

    if (!config || typeof config !== 'object') {
      throw new CanonicalNotificationError('INVALID_PROJECTION', 'ProjectionConfig must be provided.');
    }

    if (!config.purpose || typeof config.purpose !== 'string' || config.purpose.trim().length === 0) {
      throw new CanonicalNotificationError(
        'MISSING_PURPOSE',
        'ProjectionConfig must specify an explicit purpose.',
      );
    }

    if (config.type) {
      const normalizedType = String(config.type).trim().toUpperCase();
      if (normalizedType === 'TASK') {
        throw new CanonicalNotificationError(
          'ACTIONABLE_TASK_NOT_ALLOWED',
          'Canonical Bell notifications cannot be created with type TASK. Actionable tasks must be managed via WorkflowTask.',
        );
      }
    }

    // Resolve explicit recipients only (NO semantic guessing)
    const recipientSet = new Set<number>();
    if (Array.isArray(config.recipientIds)) {
      for (const id of config.recipientIds) {
        if (typeof id === 'number' && !isNaN(id) && id > 0) {
          recipientSet.add(id);
        }
      }
    } else if (Array.isArray(event.routing?.userIds)) {
      for (const id of event.routing!.userIds!) {
        if (typeof id === 'number' && !isNaN(id) && id > 0) {
          recipientSet.add(id);
        }
      }
    }

    const recipients = Array.from(recipientSet);
    if (recipients.length === 0) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Zero explicit recipients resolved for event '${event.eventName}' (${event.eventId}). No notification projected.`,
      );
      return [];
    }

    const title = typeof config.title === 'function' ? config.title(event) : config.title;
    const message = typeof config.message === 'function' ? config.message(event) : config.message;
    const actionTarget =
      typeof config.actionTarget === 'function' ? config.actionTarget(event) : config.actionTarget;
    const metaData =
      typeof config.metaData === 'function' ? config.metaData(event) : config.metaData || {};

    const inputs: CanonicalNotificationInput[] = recipients.map((recipientId) => ({
      eventId: event.eventId,
      recipientId,
      purpose: config.purpose,
      title,
      message,
      type: config.type || 'ALERT',
      actionTarget,
      metaData: {
        ...metaData,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        correlationId: event.correlationId,
      },
      sendEmail: config.sendEmail || false,
    }));

    return this.writer.persistBatch(inputs);
  }
}
