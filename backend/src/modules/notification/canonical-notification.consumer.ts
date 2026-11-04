import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import {
  BusinessEvent,
  NotificationPolicy,
  OutboxDeliveryOutcome,
  attachOutboxReceipt,
} from '../../shared/contracts/business-event.contract';
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

    return this.markDelivered(results);
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
   * Phase F-CRIT-01: Canonical Bell & Push Projection for Legal Review Milestone — Contract REJECTED.
   * Actionable/Alert notification to Marketing PIC when Legal rejects a contract/SPK.
   * Deduplication guaranteed via: <eventId>:<recipientId>:LEGAL_CONTRACT_REJECTED.
   */
  @OnEvent('legal.contract.rejected')
  async handleLegalContractRejected(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical legal.contract.rejected event (missing eventId)`,
      );
      return this.markIntentionallyIgnored('Missing canonical eventId on legal.contract.rejected');
    }

    const contractId = event.payload?.contractId || event.aggregateId;
    const tenderTitle = event.payload?.tenderTitle || `Kontrak #${event.payload?.contractNumber || contractId}`;
    const tenderId = event.payload?.tenderId;
    const marketingPicId = Number(
      event.payload?.marketingPicId || event.routing?.userIds?.[0] || 0,
    );
    const reviewerId = Number(
      event.actor?.userId || event.payload?.reviewerId || event.payload?.actorId || 0,
    );
    const reason = event.payload?.reason || 'Silakan cek catatan penolakan legal.';

    if (reviewerId > 0 && this.notificationService) {
      await this.notificationService.markRelatedNotificationsRead(reviewerId, 'CONTRACT', contractId);
    }

    if (!marketingPicId || isNaN(marketingPicId) || marketingPicId <= 0 || marketingPicId === reviewerId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] No distinct Marketing PIC recipient for legal rejection on Contract #${contractId}. Zero Bell generated.`,
      );
      return this.markIntentionallyIgnored('No distinct Marketing PIC recipient for legal.contract.rejected');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'LEGAL_CONTRACT_REJECTED',
      type: 'ALERT',
      title: 'Kontrak Ditolak Legal',
      message: `Kontrak untuk proyek "${tenderTitle}" ditolak oleh tim Legal. Alasan: ${reason}`,
      actionTarget: tenderId ? `/sales/tenders/${tenderId}` : '/sales',
      recipientIds: [marketingPicId],
      metaData: {
        category: 'LEGAL',
        priority: 'HIGH',
        reference_type: 'CONTRACT',
        reference_id: contractId,
        contractId,
        tenderId,
        actionType: 'CONTRACT_REJECTED',
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
      actionTarget: projectId
        ? `/project-delivery?view=workspace&projectId=${projectId}&section=overview`
        : '/project-delivery',
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
   * Phase F-HIGH-01: Canonical Bell Projection for Project Formal Kickoff.
   * Notifies PMO and Head of Operations (HOPS) that project has kicked off and baseline is active.
   * Strict Exclusion: Director is excluded by policy, and the PM actor is excluded.
   * Deduplication guaranteed via: <eventId>:<recipientId>:PROJECT_KICKOFF_EXECUTED.
   */
  @OnEvent('project.kickoff.executed')
  async handleProjectKickoffExecuted(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on project.kickoff.executed');
    }
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const projectId = Number(event.projectId ?? payload.projectId ?? event.aggregateId ?? 0);
    const projectCode = payload.projectCode || String(projectId);
    const actorId = Number(event.actor?.userId ?? payload.managerId ?? 0);

    const projectCtx = await this.resolveProjectContext(projectId);
    const displayProjectName = projectCtx.projectName || projectCode || `Proyek #${projectId}`;

    // Target roles: PMO and HEAD_OF_OPERATIONS. Strictly exclude DIRECTOR.
    const targetRoles = ['PMO', 'HEAD_OF_OPERATIONS'];
    const roleUserIds = await this.resolveRoleUserIds(targetRoles, ['DIRECTOR']);

    const recipientSet = new Set<number>(roleUserIds);
    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }
    // Strict exclusions: PM actor and Director
    if (actorId > 0) {
      recipientSet.delete(actorId);
    }
    const directorUserIds = await this.resolveRoleUserIds(['DIRECTOR']);
    for (const dId of directorUserIds) {
      recipientSet.delete(dId);
    }

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No eligible PMO/HOPS recipients for project.kickoff.executed');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROJECT_KICKOFF_EXECUTED',
      type: 'INFO',
      title: `Formal Kick-off Proyek Dilaksanakan (${projectCode})`,
      message: `Proyek "${displayProjectName}" telah resmi memulai fase pelaksanaan (IN_PROGRESS) dengan baseline aktif.`,
      actionTarget: `/project-delivery?view=workspace&projectId=${projectId}&section=overview`,
      recipientIds,
      metaData: {
        category: 'PROJECT',
        priority: 'NORMAL',
        reference_type: 'PROJECT',
        reference_id: projectId,
        projectId,
        projectCode,
        actionType: 'KICKOFF_EXECUTED',
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
      return this.markIntentionallyIgnored(
        'Skipping non-canonical finance.payment.recorded event (missing eventId)',
      );
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

    if (results.length === 0) {
      return this.markIntentionallyIgnored(
        'Zero explicit recipients resolved for finance.payment.recorded',
      );
    }

    return this.markDelivered(results);
  }

  /**
   * Phase F-CRIT-05: Canonical Bell Projection for Payment Request Submitted.
   * Notifies active Directors that a payment request requires approval.
   * Deduplication guaranteed via: <eventId>:<recipientId>:FINANCE_PAYMENT_REQUEST_SUBMITTED.
   */
  @OnEvent('finance.payment_request.submitted')
  async handleFinancePaymentRequestSubmitted(
    event: BusinessEvent<any>,
  ): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical finance.payment_request.submitted event (missing eventId)`,
      );
      return this.markIntentionallyIgnored(
        'Skipping non-canonical finance.payment_request.submitted event (missing eventId)',
      );
    }

    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const requestId = payload.requestId || payload.paymentRequestId || event.aggregateId;
    const requestNumber = payload.requestNumber || (requestId ? `PRQ-${requestId}` : 'Payment Request');
    const invoiceNumber = payload.invoiceNumber || '';
    const actorId = Number(event.actor?.userId || payload.submittedBy || 0);

    const directorIds = await this.resolveRoleUserIds(['DIRECTOR']);
    const recipientIds = directorIds.filter((uid) => uid !== actorId);

    if (recipientIds.length === 0) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] Zero distinct active DIRECTOR recipients found for Payment Request #${requestId}`,
      );
      return this.markIntentionallyIgnored(
        `Zero distinct active DIRECTOR recipients found for Payment Request #${requestId}`,
      );
    }

    const stableEventId = requestId ? `prq-sub-${requestId}` : event.eventId;

    return this.projectEventToNotifications(
      { ...event, eventId: stableEventId },
      {
        purpose: 'FINANCE_PAYMENT_REQUEST_SUBMITTED',
        type: 'ALERT',
        title: 'Persetujuan Pembayaran',
        message: invoiceNumber
          ? `Pengajuan pembayaran ${requestNumber} untuk invoice ${invoiceNumber} menunggu persetujuan Direktur.`
          : `Pengajuan pembayaran ${requestNumber} menunggu persetujuan Direktur.`,
        actionTarget: `/finance/payments?tab=approvals&requestId=${requestId}`,
        recipientIds,
        metaData: {
          category: 'FINANCE',
          priority: 'HIGH',
          reference_type: 'PAYMENT_REQUEST',
          reference_id: requestId,
          requestId,
          paymentRequestId: requestId,
          requestNumber,
          invoiceNumber,
          actionType: 'DIRECTOR_APPROVAL',
        },
      },
    );
  }

  /**
   * Phase F-CRIT-05: Canonical Bell Projection for Payment Request Returned.
   * Notifies the Finance requester that the request was returned for revision.
   * Deduplication guaranteed via: <eventId>:<recipientId>:FINANCE_PAYMENT_REQUEST_RETURNED.
   */
  @OnEvent('finance.payment_request.returned')
  async handleFinancePaymentRequestReturned(
    event: BusinessEvent<any>,
  ): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical finance.payment_request.returned event (missing eventId)`,
      );
      return this.markIntentionallyIgnored(
        'Skipping non-canonical finance.payment_request.returned event (missing eventId)',
      );
    }

    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const requestId = payload.requestId || payload.paymentRequestId || event.aggregateId;
    const requestNumber = payload.requestNumber || (requestId ? `PRQ-${requestId}` : 'Payment Request');
    const revisionNotes = payload.revisionNotes || '';
    const actorId = Number(event.actor?.userId || payload.returnedBy || 0);

    let requesterId = Number(payload.requestedBy || 0);
    if (!requesterId && requestId) {
      requesterId = (await this.resolvePaymentRequestRequester(Number(requestId))) || 0;
    }

    if (!requesterId || requesterId <= 0) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] No requester resolved for returned Payment Request #${requestId}`,
      );
      return this.markIntentionallyIgnored(
        `No requester resolved for returned Payment Request #${requestId}`,
      );
    }

    if (requesterId === actorId) {
      return this.markIntentionallyIgnored(
        'Self-actor exclusion: requester is the actor who returned the Payment Request',
      );
    }

    return this.projectEventToNotifications(event, {
      purpose: 'FINANCE_PAYMENT_REQUEST_RETURNED',
      type: 'ALERT',
      title: 'Revisi Pengajuan Pembayaran',
      message: revisionNotes
        ? `Pengajuan pembayaran ${requestNumber} dikembalikan Direktur untuk revisi: ${revisionNotes}`
        : `Pengajuan pembayaran ${requestNumber} dikembalikan Direktur untuk revisi.`,
      actionTarget: `/finance/payments?tab=requests&requestId=${requestId}`,
      recipientIds: [requesterId],
      metaData: {
        category: 'FINANCE',
        priority: 'HIGH',
        reference_type: 'PAYMENT_REQUEST',
        reference_id: requestId,
        requestId,
        paymentRequestId: requestId,
        requestNumber,
        revisionNotes,
        actionType: 'PAYMENT_REQUEST_RETURNED',
      },
    });
  }

  /**
   * Phase F-CRIT-05: Canonical Bell Projection for Payment Request Resubmitted.
   * Notifies active Directors that a returned payment request has been resubmitted.
   * Deduplication guaranteed via: <eventId>:<recipientId>:FINANCE_PAYMENT_REQUEST_RESUBMITTED.
   */
  @OnEvent('finance.payment_request.resubmitted')
  async handleFinancePaymentRequestResubmitted(
    event: BusinessEvent<any>,
  ): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical finance.payment_request.resubmitted event (missing eventId)`,
      );
      return this.markIntentionallyIgnored(
        'Skipping non-canonical finance.payment_request.resubmitted event (missing eventId)',
      );
    }

    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const requestId = payload.requestId || payload.paymentRequestId || event.aggregateId;
    const requestNumber = payload.requestNumber || (requestId ? `PRQ-${requestId}` : 'Payment Request');
    const actorId = Number(event.actor?.userId || payload.resubmittedBy || 0);

    let cycle = Number(payload.cycle || payload.resubmissionCount || 0);
    if (!cycle && typeof event.eventId === 'string') {
      const match = event.eventId.match(/-resub-(\d+)/);
      if (match) {
        cycle = parseInt(match[1], 10);
      }
    }
    const cycleSuffix = cycle > 0 ? `-resub-${cycle}` : '-resub-1';
    const stableEventId = requestId ? `prq-sub-${requestId}${cycleSuffix}` : event.eventId;

    const directorIds = await this.resolveRoleUserIds(['DIRECTOR']);
    const recipientIds = directorIds.filter((uid) => uid !== actorId);

    if (recipientIds.length === 0) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] Zero distinct active DIRECTOR recipients found for resubmitted Payment Request #${requestId}`,
      );
      return this.markIntentionallyIgnored(
        `Zero distinct active DIRECTOR recipients found for resubmitted Payment Request #${requestId}`,
      );
    }

    return this.projectEventToNotifications(
      { ...event, eventId: stableEventId },
      {
        purpose: 'FINANCE_PAYMENT_REQUEST_RESUBMITTED',
        type: 'ALERT',
        title:
          cycle > 1
            ? `Revisi ke-${cycle} Pengajuan Pembayaran Menunggu Persetujuan`
            : 'Revisi Pengajuan Pembayaran Menunggu Persetujuan',
        message: `Pengajuan pembayaran ${requestNumber} telah diajukan ulang oleh Finance dan menunggu persetujuan Direktur.`,
        actionTarget: `/finance/payments?tab=approvals&requestId=${requestId}`,
        recipientIds,
        metaData: {
          category: 'FINANCE',
          priority: 'HIGH',
          reference_type: 'PAYMENT_REQUEST',
          reference_id: requestId,
          requestId,
          paymentRequestId: requestId,
          requestNumber,
          cycle,
          actionType: 'DIRECTOR_APPROVAL_RESUBMIT',
        },
      },
    );
  }

  /**
   * Phase F-CRIT-05: Canonical Bell Projection for Payment Request Approved.
   * Informs Finance team and original requester that the payment request is approved and ready for payout.
   * Deduplication guaranteed via: <eventId>:<recipientId>:FINANCE_PAYMENT_REQUEST_APPROVED.
   */
  @OnEvent('finance.payment_request.approved')
  async handleFinancePaymentRequestApproved(
    event: BusinessEvent<any>,
  ): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical finance.payment_request.approved event (missing eventId)`,
      );
      return this.markIntentionallyIgnored(
        'Skipping non-canonical finance.payment_request.approved event (missing eventId)',
      );
    }

    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const requestId = payload.requestId || payload.paymentRequestId || event.aggregateId;
    const requestNumber = payload.requestNumber || (requestId ? `PRQ-${requestId}` : 'Payment Request');
    const actorId = Number(event.actor?.userId || payload.approvedBy || 0);

    let requesterId = Number(payload.requestedBy || 0);
    if (!requesterId && requestId) {
      requesterId = (await this.resolvePaymentRequestRequester(Number(requestId))) || 0;
    }

    const financeUserIds = await this.resolveRoleUserIds(['FINANCE']);
    const recipientSet = new Set<number>();
    if (requesterId > 0) recipientSet.add(requesterId);
    for (const fId of financeUserIds) {
      if (fId > 0) recipientSet.add(fId);
    }
    if (actorId > 0) {
      recipientSet.delete(actorId);
    }

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] Zero distinct recipients found for approved Payment Request #${requestId}`,
      );
      return this.markIntentionallyIgnored(
        `Zero distinct recipients found for approved Payment Request #${requestId}`,
      );
    }

    const stableEventId = requestId ? `prq-app-${requestId}` : event.eventId;

    return this.projectEventToNotifications(
      { ...event, eventId: stableEventId },
      {
        purpose: 'FINANCE_PAYMENT_REQUEST_APPROVED',
        type: 'ALERT',
        title: 'Pengajuan Pembayaran Disetujui',
        message: `Pengajuan pembayaran ${requestNumber} telah DISETUJUI oleh Direktur dan siap dibayarkan.`,
        actionTarget: `/finance/payments?tab=ready_to_pay&requestId=${requestId}`,
        recipientIds,
        metaData: {
          category: 'FINANCE',
          priority: 'HIGH',
          reference_type: 'PAYMENT_REQUEST',
          reference_id: requestId,
          requestId,
          paymentRequestId: requestId,
          requestNumber,
          actionType: 'PAYMENT_REQUEST_APPROVED',
        },
      },
    );
  }

  /**
   * Phase F-CRIT-05: Canonical Bell Projection for Payment Request Rejected.
   * Informs the Finance requester that the payment request has been rejected by Director.
   * Deduplication guaranteed via: <eventId>:<recipientId>:FINANCE_PAYMENT_REQUEST_REJECTED.
   */
  @OnEvent('finance.payment_request.rejected')
  async handleFinancePaymentRequestRejected(
    event: BusinessEvent<any>,
  ): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical finance.payment_request.rejected event (missing eventId)`,
      );
      return this.markIntentionallyIgnored(
        'Skipping non-canonical finance.payment_request.rejected event (missing eventId)',
      );
    }

    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const requestId = payload.requestId || payload.paymentRequestId || event.aggregateId;
    const requestNumber = payload.requestNumber || (requestId ? `PRQ-${requestId}` : 'Payment Request');
    const rejectionReason = payload.rejectionReason || '';
    const actorId = Number(event.actor?.userId || payload.rejectedBy || 0);

    let requesterId = Number(payload.requestedBy || 0);
    if (!requesterId && requestId) {
      requesterId = (await this.resolvePaymentRequestRequester(Number(requestId))) || 0;
    }

    if (!requesterId || requesterId <= 0) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] No requester resolved for rejected Payment Request #${requestId}`,
      );
      return this.markIntentionallyIgnored(
        `No requester resolved for rejected Payment Request #${requestId}`,
      );
    }

    if (requesterId === actorId) {
      return this.markIntentionallyIgnored(
        'Self-actor exclusion: requester is the actor who rejected the Payment Request',
      );
    }

    const stableEventId = requestId ? `prq-rej-${requestId}` : event.eventId;

    return this.projectEventToNotifications(
      { ...event, eventId: stableEventId },
      {
        purpose: 'FINANCE_PAYMENT_REQUEST_REJECTED',
        type: 'ALERT',
        title: 'Pengajuan Pembayaran Ditolak',
        message: rejectionReason
          ? `Pengajuan pembayaran ${requestNumber} DITOLAK oleh Direktur: ${rejectionReason}`
          : `Pengajuan pembayaran ${requestNumber} DITOLAK oleh Direktur.`,
        actionTarget: `/finance/payments?tab=requests&requestId=${requestId}`,
        recipientIds: [requesterId],
        metaData: {
          category: 'FINANCE',
          priority: 'NORMAL',
          reference_type: 'PAYMENT_REQUEST',
          reference_id: requestId,
          requestId,
          paymentRequestId: requestId,
          requestNumber,
          rejectionReason,
          actionType: 'PAYMENT_REQUEST_REJECTED',
        },
      },
    );
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
   * Phase N8.1: Canonical Bell & Push Projection for Marketing Milestone — Go/No-Go Submitted.
   * 1. Actionable approval alert to authorized Approvers (DIRECTOR, GENERAL_MANAGER, SUPER_ADMIN).
   * 2. Personal tracking confirmation to submitter (Marketing PIC).
   * Deduplication guaranteed via:
   *   - Approver:  <eventId>:<approverId>:MARKETING_GONOGO_APPROVAL_REQUIRED
   *   - Submitter: <eventId>:<submitterId>:MARKETING_GONOGO_SUBMITTED
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
    const isResubmission = Boolean(event.payload?.isResubmission);
    const submitterId =
      (event as any).actor?.userId ||
      (Array.isArray(event.routing?.userIds) && event.routing.userIds.length > 0 ? event.routing.userIds[0] : null);

    const results: CanonicalNotificationResult[] = [];

    // 1. Projection to Authorized Approvers (DIRECTOR, GENERAL_MANAGER, SUPER_ADMIN)
    const directorRecipientIds = await this.resolveRoleUserIds(['DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN']);
    const candidateApproverIds = (
      directorRecipientIds.length > 0
        ? directorRecipientIds
        : ((event.routing as any)?.approverIds || (event.routing as any)?.candidateUserIds || [])
    ).filter((id: number) => !submitterId || id !== submitterId);

    const targetApproverIds =
      candidateApproverIds.length > 0
        ? candidateApproverIds
        : directorRecipientIds.filter((id: number) => !submitterId || id !== submitterId);

    if (targetApproverIds.length > 0) {
      const approverResults = await this.projectEventToNotifications(event, {
        purpose: 'MARKETING_GONOGO_APPROVAL_REQUIRED',
        type: 'ALERT',
        title: isResubmission ? 'Persetujuan Ulang GO / NO GO' : 'Persetujuan GO / NO GO Diperlukan',
        message: isResubmission
          ? `Tender "${tenderTitle}" telah direvisi dan diajukan kembali untuk persetujuan GO / NO GO.`
          : `Tender "${tenderTitle}" telah diajukan dan membutuhkan persetujuan GO / NO GO dari Direktur.`,
        actionTarget: `/sales?tab=1&tenderId=${tenderId}&action=go-nogo`,
        recipientIds: targetApproverIds,
        metaData: {
          category: 'MARKETING',
          priority: 'HIGH',
          reference_type: 'TENDER',
          reference_id: tenderId,
          tenderId,
          actionType: isResubmission ? 'GO_NOGO_RESUBMITTED' : 'GO_NOGO_SUBMITTED',
        },
      });
      results.push(...approverResults);
    }

    // 2. Personal tracking confirmation to Submitter (Marketing PIC)
    if (submitterId && typeof submitterId === 'number' && submitterId > 0) {
      const submitterResults = await this.projectEventToNotifications(event, {
        purpose: 'MARKETING_GONOGO_SUBMITTED',
        type: 'INFO',
        title: isResubmission ? 'GO/NO GO Berhasil Diajukan Ulang' : 'GO/NO GO Berhasil Diajukan',
        message: `Tender "${tenderTitle}" sedang menunggu APPROVE Director.`,
        actionTarget: `/sales/tenders/${tenderId}`,
        recipientIds: [submitterId],
        metaData: {
          category: 'MARKETING',
          priority: 'NORMAL',
          reference_type: 'TENDER',
          reference_id: tenderId,
          tenderId,
          actionType: isResubmission ? 'GO_NOGO_RESUBMITTED' : 'GO_NOGO_SUBMITTED',
        },
      });
      results.push(...submitterResults);
    } else if (Array.isArray(event.routing?.userIds) && event.routing.userIds.length > 0) {
      const submitterResults = await this.projectEventToNotifications(event, {
        purpose: 'MARKETING_GONOGO_SUBMITTED',
        type: 'INFO',
        title: isResubmission ? 'GO/NO GO Berhasil Diajukan Ulang' : 'GO/NO GO Berhasil Diajukan',
        message: `Tender "${tenderTitle}" sedang menunggu APPROVE Director.`,
        actionTarget: `/sales/tenders/${tenderId}`,
        recipientIds: event.routing.userIds,
        metaData: {
          category: 'MARKETING',
          priority: 'NORMAL',
          reference_type: 'TENDER',
          reference_id: tenderId,
          tenderId,
          actionType: isResubmission ? 'GO_NOGO_RESUBMITTED' : 'GO_NOGO_SUBMITTED',
        },
      });
      results.push(...submitterResults);
    }

    return this.markDelivered(results);
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

    const approvingActorId = (event as any).actor?.userId || event.payload?.actor?.userId || event.payload?.actorId;
    if (approvingActorId && this.notificationService) {
      await this.notificationService.markRelatedNotificationsRead(approvingActorId, 'TENDER', tenderId);
    }

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
      actionTarget: projectId
        ? `/project-delivery?view=workspace&projectId=${projectId}&section=overview`
        : '/project-delivery',
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

  /**
   * Phase PROCUREMENT-PR: Canonical Bell Projection for Submitted Purchase Request.
   * Informs FINANCE that a new PR has been submitted and is waiting for Finance Review.
   * Deduplication guaranteed via: <eventId>:<recipientId>:PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW.
   */
  @OnEvent('procurement.pr.submitted')
  @OnEvent('purchase_request.submitted')
  async handlePurchaseRequestSubmitted(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical procurement.pr.submitted event (missing eventId)`,
      );
      return this.markIntentionallyIgnored('Skipping non-canonical procurement.pr.submitted event (missing eventId)');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const prId = payload.purchaseRequestId || payload.prId || event.aggregateId;
    const prNumber = payload.prNumber || `PR #${prId}`;
    const projectId = payload.projectId || event.projectId;

    const recipientIds = await this.resolveRoleUserIds(['FINANCE']);
    if (!recipientIds || recipientIds.length === 0) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] No active users with role FINANCE found for PR #${prId}`,
      );
      return this.markIntentionallyIgnored(`No active users with role FINANCE found for PR #${prId}`);
    }

    // Stable Business Event Identity:
    // Guarantees that any emission for this PR (from WorkflowEngine, ProcurementService,
    // or network/outbox retries) collapses into the EXACT same deterministic dedupeKey per cycle.
    let cycle = Number(payload.resubmissionCount || payload.cycle || 0);
    if (!cycle && typeof event.eventId === 'string') {
      const match = event.eventId.match(/-resub-(\d+)/);
      if (match) {
        cycle = parseInt(match[1], 10);
      }
    }
    const isResubmission = Boolean(
      payload.isResubmission ||
      payload.resubmitted ||
      cycle > 0 ||
      event.eventId?.includes('-resub'),
    );
    const cycleSuffix = cycle > 0 ? `-resub-${cycle}` : (isResubmission ? '-resub-1' : '');

    const stableEventId = prId
      ? `pr-sub-${prId}${isResubmission ? cycleSuffix : ''}`
      : event.eventId;

    return this.projectEventToNotifications(
      { ...event, eventId: stableEventId },
      {
        purpose: 'PURCHASE_REQUEST_SUBMITTED_FINANCE_REVIEW',
        type: 'ALERT',
        title: isResubmission
          ? (cycle > 1
              ? `Revisi ke-${cycle} Purchase Request Menunggu Review Finance`
              : 'Revisi Purchase Request Menunggu Review Finance')
          : 'Purchase Request Menunggu Review Finance',
        message: isResubmission
          ? (cycle > 1
              ? `Purchase Request "${prNumber}" telah direvisi (siklus ke-${cycle}) dan diajukan kembali untuk peninjauan Finance.`
              : `Purchase Request "${prNumber}" telah direvisi dan diajukan kembali untuk peninjauan Finance.`)
          : `Purchase Request "${prNumber}" telah diajukan dan membutuhkan peninjauan Finance.`,
        actionTarget: `/procurement?tab=pr&prId=${prId}`,
        recipientIds,
        metaData: {
          category: 'PROCUREMENT',
          priority: 'HIGH',
          reference_type: 'PURCHASE_REQUEST',
          reference_id: prId,
          prId,
          purchaseRequestId: prId,
          prNumber,
          projectId,
          actionType: 'FINANCE_REVIEW',
        },
      },
    );
  }

  /**
   * Phase PROCUREMENT-RFQ: Canonical Bell Projection for Approved Purchase Request.
   * Informs PROCUREMENT and PURCHASING that approved PR is ready for RFQ preparation.
   * Deduplication guaranteed via: <eventId>:<recipientId>:PROCUREMENT_PR_APPROVED_RFQ.
   */
  @OnEvent('procurement.pr.approved')
  @OnEvent('purchase_request.approved')
  async handlePurchaseRequestApproved(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical procurement.pr.approved event (missing eventId)`,
      );
      return this.markIntentionallyIgnored('Skipping non-canonical procurement.pr.approved event (missing eventId)');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const prId = payload.purchaseRequestId || payload.prId || event.aggregateId;
    const prNumber = payload.prNumber || `PR #${prId}`;
    const projectId = payload.projectId || event.projectId;

    const recipientIds = await this.resolveRoleUserIds(['PROCUREMENT', 'PURCHASING']);
    if (!recipientIds || recipientIds.length === 0) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] No active users with role PROCUREMENT or PURCHASING found for PR #${prId}`,
      );
      return this.markIntentionallyIgnored(
        `No active users with role PROCUREMENT or PURCHASING found for PR #${prId}`,
      );
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROCUREMENT_PR_APPROVED_RFQ',
      type: 'ALERT',
      title: 'Purchase Request Disetujui — Siap Proses RFQ',
      message: `Purchase Request "${prNumber}" telah disetujui Direktur dan siap untuk proses pembuatan RFQ.`,
      actionTarget: `/procurement?tab=pr&prId=${prId}`,
      recipientIds,
      metaData: {
        category: 'PROCUREMENT',
        priority: 'HIGH',
        reference_type: 'PURCHASE_REQUEST',
        reference_id: prId,
        prId,
        purchaseRequestId: prId,
        prNumber,
        projectId,
        actionType: 'CREATE_RFQ',
      },
    });
  }

  /**
   * Phase PROCUREMENT-CLAIM: Canonical Bell Projection for Service Claim Submitted.
   * Informs assigned Project Manager that a new service claim requires technical verification.
   * Deduplication guaranteed via: <eventId>:<recipientId>:SERVICE_CLAIM_SUBMITTED.
   */
  @OnEvent('procurement.service_claim.submitted')
  async handleServiceClaimSubmitted(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical procurement.service_claim.submitted event (missing eventId)`,
      );
      return this.markIntentionallyIgnored('Missing eventId');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const claimId = payload.claimId || event.aggregateId;
    const claimNumber = payload.claimNumber || `Klaim #${claimId}`;
    let projectId = payload.projectId || event.projectId;
    const poNumber = payload.poNumber || (payload.poId ? `PO #${payload.poId}` : '');
    let poId = payload.poId || payload.purchaseOrderId;
    const submitterId = payload.submittedBy ? Number(payload.submittedBy) : null;

    if (!projectId && claimId) {
      const ctx = await this.resolveClaimContext(Number(claimId));
      if (ctx?.projectId) projectId = ctx.projectId;
      if (!poId && ctx?.poId) poId = ctx.poId;
    }

    // Resolve PM recipient: explicit routing -> payload projectManagerId -> database resolution
    let pmId: number | null = null;
    if (event.routing?.userIds && event.routing.userIds.length > 0) {
      pmId = Number(event.routing.userIds[0]);
    } else if (payload.projectManagerId) {
      pmId = Number(payload.projectManagerId);
    } else if (projectId) {
      pmId = await this.resolvePmUserIdFromProject(Number(projectId));
    }

    if (!pmId || pmId <= 0) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] No assigned Project Manager found for service claim #${claimNumber} (projectId: ${projectId})`,
      );
      return this.markIntentionallyIgnored(`No PM found for service claim #${claimNumber}`);
    }

    // Self-notification suppression: if PM submitted the claim, suppress notification
    if (submitterId && pmId === submitterId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Submitter is assigned PM (${pmId}). Suppressing self-notification for claim #${claimNumber}.`,
      );
      return this.markIntentionallyIgnored('Submitter is assigned PM (self-notification suppressed)');
    }

    const poText = poNumber ? ` untuk ${poNumber}` : '';

    return this.projectEventToNotifications(event, {
      purpose: 'SERVICE_CLAIM_SUBMITTED',
      type: 'ALERT',
      title: `Pengajuan Klaim Jasa Baru (${claimNumber})`,
      message: `Klaim jasa baru${poText} diajukan dan membutuhkan verifikasi teknis.`,
      actionTarget: `/project-delivery?projectId=${projectId}&serviceClaimId=${claimId}&claimId=${claimId}`,
      recipientIds: [pmId],
      metaData: {
        category: 'PROCUREMENT',
        priority: 'HIGH',
        reference_type: 'SERVICE_CLAIM',
        reference_id: claimId,
        claimId,
        claimNumber,
        projectId,
        poId,
        actionType: 'SERVICE_CLAIM_SUBMITTED',
      },
    });
  }

  /**
   * Phase PROCUREMENT-CLAIM: Canonical Bell Projection for Service Claim Technically Verified by PM.
   * When approved: informs Procurement & Purchasing that technical verification is complete and ready for commercial audit.
   * When returned/rejected: delegates to respective handlers.
   * Deduplication guaranteed via: <eventId>:<recipientId>:<purpose>.
   */
  @OnEvent('procurement.service_claim.pm_verified')
  @OnEvent('procurement.service_claim.verified')
  async handleServiceClaimVerified(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      this.logger.debug(
        `[CanonicalNotificationConsumer] Skipping non-canonical service claim verified event (missing eventId)`,
      );
      return this.markIntentionallyIgnored('Missing eventId');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const decision = payload.decision;

    if (decision === 'RETURN') {
      return this.handleServiceClaimReturned(event);
    }
    if (decision === 'REJECT') {
      return this.handleServiceClaimRejected(event);
    }

    // Default / APPROVE: notify Procurement & Purchasing
    const claimId = payload.claimId || event.aggregateId;
    const claimNumber = payload.claimNumber || `Klaim #${claimId}`;
    let poId = payload.poId || payload.purchaseOrderId;
    let projectId = payload.projectId || event.projectId;
    const verifierId = payload.verifierId || (event.actor?.userId ? Number(event.actor.userId) : null);

    if ((!poId || !projectId) && claimId) {
      const ctx = await this.resolveClaimContext(Number(claimId));
      if (!poId && ctx?.poId) poId = ctx.poId;
      if (!projectId && ctx?.projectId) projectId = ctx.projectId;
    }

    const procRecipientIds = await this.resolveRoleUserIds(['PROCUREMENT', 'PURCHASING']);
    const baseRecipients = event.routing?.userIds && event.routing.userIds.length > 0
      ? event.routing.userIds
      : procRecipientIds;

    // Actor exclusion: exclude verifier PM from receiving Procurement notification
    const recipientIds = verifierId
      ? baseRecipients.filter((id) => Number(id) !== Number(verifierId))
      : baseRecipients;

    if (!recipientIds || recipientIds.length === 0) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] No active Procurement/Purchasing users found for service claim #${claimNumber}`,
      );
      return this.markIntentionallyIgnored(`No active Procurement/Purchasing users found for claim #${claimNumber}`);
    }

    const actionTarget = poId
      ? `/procurement?tab=po&poId=${poId}&claimId=${claimId}&action=service-claim`
      : `/procurement?tab=po&claimId=${claimId}&action=service-claim`;

    return this.projectEventToNotifications(event, {
      purpose: 'SERVICE_CLAIM_VERIFIED',
      type: 'ALERT',
      title: `Klaim Jasa Terverifikasi Teknis (${claimNumber})`,
      message: `Klaim jasa ${claimNumber} telah disetujui secara teknis oleh PM dan siap untuk verifikasi komersial.`,
      actionTarget,
      recipientIds,
      metaData: {
        category: 'PROCUREMENT',
        priority: 'HIGH',
        reference_type: 'SERVICE_CLAIM',
        reference_id: claimId,
        claimId,
        claimNumber,
        poId,
        projectId,
        actionType: 'SERVICE_CLAIM_VERIFIED',
      },
    });
  }

  /**
   * Phase PROCUREMENT-CLAIM: Canonical Bell Projection for Service Claim Returned (by PM or Procurement).
   * Informs submitter that revision is required with notes.
   * Deduplication guaranteed via: <eventId>:<recipientId>:SERVICE_CLAIM_RETURNED.
   */
  @OnEvent('procurement.service_claim.returned')
  async handleServiceClaimReturned(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing eventId');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const claimId = payload.claimId || event.aggregateId;
    const claimNumber = payload.claimNumber || `Klaim #${claimId}`;
    let submitterId = payload.submittedBy || (event.routing?.userIds && event.routing.userIds[0]);
    let projectId = payload.projectId || event.projectId;
    let poId = payload.poId || payload.purchaseOrderId;

    if ((!submitterId || !projectId || !poId) && claimId) {
      const ctx = await this.resolveClaimContext(Number(claimId));
      if (!submitterId && ctx?.submittedBy) submitterId = ctx.submittedBy;
      if (!projectId && ctx?.projectId) projectId = ctx.projectId;
      if (!poId && ctx?.poId) poId = ctx.poId;
    }

    const notes = payload.revisionNotes || '-';

    if (!submitterId) {
      this.logger.warn(`[CanonicalNotificationConsumer] No submitter found for returned service claim #${claimNumber}`);
      return this.markIntentionallyIgnored(`No submitter found for returned claim #${claimNumber}`);
    }

    const returnSource = payload.commercialVerifierId ? 'Tim Pengadaan' : 'PM';
    const actionTarget = poId
      ? `/procurement?tab=po&poId=${poId}&claimId=${claimId}&action=service-claim`
      : (claimId ? `/procurement?tab=po&claimId=${claimId}&action=service-claim` : `/procurement`);

    return this.projectEventToNotifications(event, {
      purpose: 'SERVICE_CLAIM_RETURNED',
      type: 'ALERT',
      title: `Klaim Jasa Membutuhkan Revisi (${claimNumber})`,
      message: `Klaim dikembalikan oleh ${returnSource} dengan catatan: ${notes}`,
      actionTarget,
      recipientIds: [Number(submitterId)],
      metaData: {
        category: 'PROCUREMENT',
        priority: 'HIGH',
        reference_type: 'SERVICE_CLAIM',
        reference_id: claimId,
        claimId,
        claimNumber,
        poId,
        projectId,
        actionType: 'SERVICE_CLAIM_RETURNED',
      },
    });
  }

  /**
   * Phase PROCUREMENT-CLAIM: Canonical Bell Projection for Service Claim Rejected (by PM or Procurement).
   * Informs submitter that claim was rejected with reason.
   * Deduplication guaranteed via: <eventId>:<recipientId>:SERVICE_CLAIM_REJECTED.
   */
  @OnEvent('procurement.service_claim.rejected')
  async handleServiceClaimRejected(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing eventId');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const claimId = payload.claimId || event.aggregateId;
    const claimNumber = payload.claimNumber || `Klaim #${claimId}`;
    let submitterId = payload.submittedBy || (event.routing?.userIds && event.routing.userIds[0]);
    let projectId = payload.projectId || event.projectId;
    let poId = payload.poId || payload.purchaseOrderId;

    if ((!submitterId || !projectId || !poId) && claimId) {
      const ctx = await this.resolveClaimContext(Number(claimId));
      if (!submitterId && ctx?.submittedBy) submitterId = ctx.submittedBy;
      if (!projectId && ctx?.projectId) projectId = ctx.projectId;
      if (!poId && ctx?.poId) poId = ctx.poId;
    }

    const reason = payload.rejectionReason || '-';

    if (!submitterId) {
      this.logger.warn(`[CanonicalNotificationConsumer] No submitter found for rejected service claim #${claimNumber}`);
      return this.markIntentionallyIgnored(`No submitter found for rejected claim #${claimNumber}`);
    }

    const rejectSource = payload.commercialVerifierId ? 'Tim Pengadaan' : 'PM';
    const actionTarget = poId
      ? `/procurement?tab=po&poId=${poId}&claimId=${claimId}&action=service-claim`
      : (claimId ? `/procurement?tab=po&claimId=${claimId}&action=service-claim` : `/procurement`);

    return this.projectEventToNotifications(event, {
      purpose: 'SERVICE_CLAIM_REJECTED',
      type: 'ALERT',
      title: `Klaim Jasa Ditolak (${claimNumber})`,
      message: `Klaim ditolak oleh ${rejectSource}: ${reason}`,
      actionTarget,
      recipientIds: [Number(submitterId)],
      metaData: {
        category: 'PROCUREMENT',
        priority: 'HIGH',
        reference_type: 'SERVICE_CLAIM',
        reference_id: claimId,
        claimId,
        claimNumber,
        poId,
        projectId,
        actionType: 'SERVICE_CLAIM_REJECTED',
      },
    });
  }

  /**
   * Phase PROCUREMENT-CLAIM: Canonical Bell Projection for Service Claim Approved for Invoice.
   * When commercially approved by Procurement: informs Finance that claim is ready for vendor invoice creation.
   * Deduplication guaranteed via: <eventId>:<recipientId>:SERVICE_CLAIM_APPROVED_FOR_INVOICE.
   */
  @OnEvent('procurement.service_claim.approved_for_invoice')
  async handleServiceClaimApprovedForInvoice(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing eventId');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const claimId = payload.claimId || event.aggregateId;
    const claimNumber = payload.claimNumber || `Klaim #${claimId}`;
    let poId = payload.poId || payload.purchaseOrderId;
    let projectId = payload.projectId || event.projectId;
    const verifierId = payload.verifierId || payload.commercialVerifierId || (event.actor?.userId ? Number(event.actor.userId) : null);

    if ((!poId || !projectId) && claimId) {
      const ctx = await this.resolveClaimContext(Number(claimId));
      if (!poId && ctx?.poId) poId = ctx.poId;
      if (!projectId && ctx?.projectId) projectId = ctx.projectId;
    }

    const financeUserIds = await this.resolveRoleUserIds(['FINANCE']);
    const recipientIds = verifierId
      ? financeUserIds.filter((id) => Number(id) !== Number(verifierId))
      : financeUserIds;

    if (!recipientIds || recipientIds.length === 0) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] No active Finance users found for invoice-ready service claim #${claimNumber}`,
      );
      return this.markIntentionallyIgnored(`No active Finance users found for claim #${claimNumber}`);
    }

    const poText = poId ? ` (PO #${poId})` : '';
    const actionTarget = poId
      ? `/finance/invoices?tab=ready_pos&poId=${poId}&serviceClaimId=${claimId}`
      : `/finance/invoices?tab=ready_pos&serviceClaimId=${claimId}`;

    return this.projectEventToNotifications(event, {
      purpose: 'SERVICE_CLAIM_APPROVED_FOR_INVOICE',
      type: 'ALERT',
      title: `Klaim Jasa Siap Ditagihkan (${claimNumber})`,
      message: `Klaim jasa ${claimNumber}${poText} telah disetujui komersial dan siap diproses untuk penerbitan invoice vendor.`,
      actionTarget,
      recipientIds,
      metaData: {
        category: 'FINANCE',
        priority: 'HIGH',
        reference_type: 'SERVICE_CLAIM',
        reference_id: claimId,
        claimId,
        claimNumber,
        poId,
        projectId,
        actionType: 'SERVICE_CLAIM_APPROVED_FOR_INVOICE',
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
    const closureId = payload.closureId || event.aggregate_id || event.aggregateId;

    let projectName = payload.projectName;
    if (!projectName && projectId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT name FROM projects WHERE id = ?`, [projectId]);
        if (rows && rows.length > 0 && rows[0].name) projectName = rows[0].name;
      } catch {}
    }
    const safeProjectName = projectName && !projectName.match(/^Proyek\s*#\d+$/i) ? projectName : undefined;
    const displayProjectName = safeProjectName || 'proyek ini';

    const actorId = Number(
      (event as any).actor?.userId || payload.actorId || payload.actor?.userId || payload.submittedBy || 0,
    );
    if (actorId > 0 && this.notificationService) {
      await this.notificationService.markRelatedNotificationsRead(actorId, 'PROJECT_CLOSURE', closureId);
    }

    const hooUserIds = await this.resolveRoleUserIds(['HEAD_OF_OPERATIONS', 'SUPER_ADMIN']);
    const rawRecipientIds = hooUserIds.length > 0 ? hooUserIds : (event.routing?.userIds || []);
    const recipientIds = rawRecipientIds.filter((id: number) => id !== actorId);

    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No eligible recipients after actor exclusion for project.closure.submitted');
    }

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_CLOSURE_SUBMITTED',
        type: 'ALERT',
        title: 'Pengajuan Penutupan Proyek Baru',
        message: `PM telah mengajukan penutupan proyek "${displayProjectName}" untuk Anda tinjau.`,
        actionTarget: `/governance/tasks?projectId=${projectId}`,
        recipientIds,
        metaData: {
          category: 'PROJECT_CLOSURE',
          priority: 'HIGH',
          reference_type: 'PROJECT_CLOSURE',
          reference_id: closureId,
          projectId,
          closureId,
          projectName: safeProjectName,
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
    const closureId = payload.closureId || event.aggregate_id || event.aggregateId;

    let projectName = payload.projectName;
    if (!projectName && projectId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT name FROM projects WHERE id = ?`, [projectId]);
        if (rows && rows.length > 0 && rows[0].name) projectName = rows[0].name;
      } catch {}
    }
    const safeProjectName = projectName && !projectName.match(/^Proyek\s*#\d+$/i) ? projectName : undefined;
    const displayProjectName = safeProjectName || 'proyek ini';

    const actorId = Number(
      (event as any).actor?.userId || payload.actorId || payload.actor?.userId || 0,
    );
    if (actorId > 0 && this.notificationService) {
      await this.notificationService.markRelatedNotificationsRead(actorId, 'PROJECT_CLOSURE', closureId);
    }

    const directorUserIds = await this.resolveRoleUserIds(['DIRECTOR', 'SUPER_ADMIN']);
    const rawRecipientIds = directorUserIds.length > 0 ? directorUserIds : (event.routing?.userIds || []);
    const recipientIds = rawRecipientIds.filter((id: number) => id !== actorId);

    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No eligible recipients after actor exclusion for project.closure.hoo.approved');
    }

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_CLOSURE_HOO_APPROVED',
        type: 'ALERT',
        title: 'Penutupan Proyek Menunggu Keputusan Anda',
        message: `Head of Operations telah meninjau penutupan proyek "${displayProjectName}" dan meneruskannya kepada Anda untuk keputusan akhir.`,
        actionTarget: `/governance/tasks?projectId=${projectId}`,
        recipientIds,
        metaData: {
          category: 'PROJECT_CLOSURE',
          priority: 'HIGH',
          reference_type: 'PROJECT_CLOSURE',
          reference_id: closureId,
          projectId,
          closureId,
          projectName: safeProjectName,
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
    const closureId = payload.closureId || event.aggregate_id || event.aggregateId;

    let projectName = payload.projectName;
    if (!projectName && projectId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT name FROM projects WHERE id = ?`, [projectId]);
        if (rows && rows.length > 0 && rows[0].name) projectName = rows[0].name;
      } catch {}
    }
    const safeProjectName = projectName && !projectName.match(/^Proyek\s*#\d+$/i) ? projectName : undefined;
    const displayProjectName = safeProjectName || 'proyek ini';

    let pmId: number | null = payload.projectManagerId
      ? Number(payload.projectManagerId)
      : payload.pmId
        ? Number(payload.pmId)
        : null;

    if (!pmId && projectId) {
      pmId = await this.resolvePmUserIdFromProject(Number(projectId));
    }
    const rawRecipientIds = pmId ? [pmId] : (event.routing?.userIds || []);

    const actorId = Number(
      (event as any).actor?.userId || payload.actorId || payload.actor?.userId || 0,
    );
    if (actorId > 0 && this.notificationService) {
      await this.notificationService.markRelatedNotificationsRead(actorId, 'PROJECT_CLOSURE', closureId);
    }

    const recipientIds = rawRecipientIds.filter((id: number) => id !== actorId);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No eligible recipients after actor exclusion for project.closure.director.approved');
    }

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_CLOSURE_APPROVED',
        type: 'SYSTEM',
        title: 'Penutupan Proyek Disetujui',
        message: `Penutupan proyek "${displayProjectName}" telah disetujui Direktur. Proyek resmi ditutup.`,
        actionTarget: `/project-delivery?view=workspace&projectId=${projectId}&section=closure`,
        recipientIds,
        metaData: {
          category: 'PROJECT_CLOSURE',
          priority: 'NORMAL',
          reference_type: 'PROJECT_CLOSURE',
          reference_id: closureId,
          projectId,
          closureId,
          projectName: safeProjectName,
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
    const closureId = payload.closureId || event.aggregate_id || event.aggregateId;

    let projectName = payload.projectName;
    if (!projectName && projectId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT name FROM projects WHERE id = ?`, [projectId]);
        if (rows && rows.length > 0 && rows[0].name) projectName = rows[0].name;
      } catch {}
    }
    const safeProjectName = projectName && !projectName.match(/^Proyek\s*#\d+$/i) ? projectName : undefined;
    const displayProjectName = safeProjectName || 'proyek ini';

    let pmId: number | null = payload.projectManagerId
      ? Number(payload.projectManagerId)
      : payload.pmId
        ? Number(payload.pmId)
        : null;

    if (!pmId && projectId) {
      pmId = await this.resolvePmUserIdFromProject(Number(projectId));
    }
    const rawRecipientIds = pmId ? [pmId] : (event.routing?.userIds || []);

    const actorId = Number(
      (event as any).actor?.userId || payload.actorId || payload.actor?.userId || 0,
    );
    if (actorId > 0 && this.notificationService) {
      await this.notificationService.markRelatedNotificationsRead(actorId, 'PROJECT_CLOSURE', closureId);
    }

    const recipientIds = rawRecipientIds.filter((id: number) => id !== actorId);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No eligible recipients after actor exclusion for project.closure.returned');
    }

    const reason = payload.returnReason || payload.reason;
    const reasonText = reason ? `: ${reason}` : '. Silakan lihat catatan reviewer dan ajukan kembali.';

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_CLOSURE_RETURNED',
        type: 'ALERT',
        title: 'Pengajuan Penutupan Proyek Dikembalikan',
        message: `Pengajuan penutupan proyek "${displayProjectName}" perlu diperbaiki${reasonText}`,
        actionTarget: `/project-delivery?view=workspace&projectId=${projectId}&section=closure`,
        recipientIds,
        metaData: {
          category: 'PROJECT_CLOSURE',
          priority: 'HIGH',
          reference_type: 'PROJECT_CLOSURE',
          reference_id: closureId,
          projectId,
          closureId,
          projectName: safeProjectName,
          actionType: 'CLOSURE_RETURNED',
          returnReason: reason,
        },
      },
    );
  }

  /**
   * Canonical Bell & Push Projection: Project Progress Claim Submitted.
   * Projected to HOPS and PMO reviewers, with submitter excluded.
   * Deduplication key: <eventId>:<recipientId>:PROJECT_PROGRESS_CLAIM_SUBMITTED.
   */
  @OnEvent('project.progress_claim.submitted')
  async handleProjectProgressClaimSubmitted(event: any): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') return [];
    const eventId = event.eventId || event.event_id;
    if (!eventId) return [];

    const payload = event.payload?.businessPayload || event.payload || {};
    const projectId = payload.projectId;
    const progressLogId = payload.progressLogId || event.aggregate_id || event.aggregateId;
    const taskId = payload.taskId;

    let projectName = payload.projectName;
    if (!projectName && projectId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT name FROM projects WHERE id = ?`, [projectId]);
        if (rows && rows.length > 0 && rows[0].name) projectName = rows[0].name;
      } catch {}
    }
    const safeProjectName = projectName && !projectName.match(/^Proyek\s*#\d+$/i) ? projectName : undefined;
    const displayProjectName = safeProjectName || `Proyek #${projectId}`;

    let taskName = payload.taskName;
    if (!taskName && taskId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT name FROM tasks WHERE id = ?`, [taskId]);
        if (rows && rows.length > 0 && rows[0].name) taskName = rows[0].name;
      } catch {}
    }
    const safeTaskName = taskName || `Task #${taskId}`;

    const actorId = Number(
      (event as any).actor?.userId || payload.actorId || payload.actor?.userId || payload.submittedBy || 0,
    );

    const reviewerUserIds = await this.resolveRoleUserIds(['HEAD_OF_OPERATIONS', 'PMO']);
    const rawRecipientIds = reviewerUserIds.length > 0 ? reviewerUserIds : (event.routing?.userIds || []);
    const recipientIds = rawRecipientIds.filter((id: number) => id !== actorId);

    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No eligible reviewers after submitter exclusion for project.progress_claim.submitted');
    }

    const prevProg = Number(payload.previousProgress ?? 0);
    const repProg = Number(payload.reportedProgress ?? 0);

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_PROGRESS_CLAIM_SUBMITTED',
        type: 'ALERT',
        title: 'Klaim Progres Menunggu Verifikasi',
        message: `Task "${safeTaskName}" pada "${displayProjectName}" diajukan progres ${prevProg}% → ${repProg}%. Menunggu verifikasi.`,
        actionTarget: `/project-delivery?view=workspace&projectId=${projectId}&section=tasks&progressClaimId=${progressLogId}`,
        recipientIds,
        metaData: {
          category: 'PROJECT',
          priority: 'HIGH',
          reference_type: 'PROJECT_PROGRESS_CLAIM',
          reference_id: progressLogId,
          projectId,
          taskId,
          progressLogId,
          projectName: safeProjectName,
          taskName: safeTaskName,
          actionType: 'PROGRESS_CLAIM_VERIFICATION',
        },
      },
    );
  }

  /**
   * Canonical Bell & Push Projection: Project Progress Claim Returned / Rejected.
   * Projected strictly to the original submitting PM with the verified rejection reason.
   * Deduplication key: <eventId>:<recipientId>:PROJECT_PROGRESS_CLAIM_RETURNED.
   */
  @OnEvent('project.progress_claim.returned')
  async handleProjectProgressClaimReturned(event: any): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') return [];
    const eventId = event.eventId || event.event_id;
    if (!eventId) return [];

    const payload = event.payload?.businessPayload || event.payload || {};
    const projectId = payload.projectId;
    const progressLogId = payload.progressLogId || event.aggregate_id || event.aggregateId;
    const taskId = payload.taskId;

    let projectName = payload.projectName;
    if (!projectName && projectId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT name FROM projects WHERE id = ?`, [projectId]);
        if (rows && rows.length > 0 && rows[0].name) projectName = rows[0].name;
      } catch {}
    }
    const safeProjectName = projectName && !projectName.match(/^Proyek\s*#\d+$/i) ? projectName : undefined;
    const displayProjectName = safeProjectName || `Proyek #${projectId}`;

    let taskName = payload.taskName;
    if (!taskName && taskId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT name FROM tasks WHERE id = ?`, [taskId]);
        if (rows && rows.length > 0 && rows[0].name) taskName = rows[0].name;
      } catch {}
    }
    const safeTaskName = taskName || `Task #${taskId}`;

    let submittedBy: number | null = payload.submittedBy ? Number(payload.submittedBy) : null;
    if (!submittedBy && progressLogId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(
          `SELECT submitted_by FROM project_progress_logs WHERE id = ? LIMIT 1`,
          [progressLogId],
        );
        if (rows && rows.length > 0 && rows[0].submitted_by) submittedBy = Number(rows[0].submitted_by);
      } catch {}
    }

    if (!submittedBy) {
      return this.markIntentionallyIgnored('Missing original submitter for project.progress_claim.returned');
    }

    const actorId = Number(
      (event as any).actor?.userId || payload.actorId || payload.actor?.userId || payload.verifiedBy || 0,
    );
    if (actorId === submittedBy) {
      return this.markIntentionallyIgnored('Submitter is verifier (self-notification suppressed)');
    }

    const rejectionReason = (payload.rejectionReason || payload.reason || '').trim();
    const reasonText = rejectionReason ? `: "${rejectionReason}"` : '. Silakan tinjau kembali bukti pekerjaan.';

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_PROGRESS_CLAIM_RETURNED',
        type: 'ALERT',
        title: 'Klaim Progres Dikembalikan',
        message: `Klaim progres task "${safeTaskName}" pada "${displayProjectName}" dikembalikan oleh HOPS${reasonText}`,
        actionTarget: `/project-delivery?view=workspace&projectId=${projectId}&section=tasks&progressClaimId=${progressLogId}`,
        recipientIds: [submittedBy],
        metaData: {
          category: 'PROJECT',
          priority: 'HIGH',
          reference_type: 'PROJECT_PROGRESS_CLAIM',
          reference_id: progressLogId,
          projectId,
          taskId,
          progressLogId,
          projectName: safeProjectName,
          taskName: safeTaskName,
          actionType: 'PROGRESS_CLAIM_RETURNED',
          rejectionReason,
        },
      },
    );
  }

  /**
   * Canonical Bell & Push Projection: Project Progress Claim Approved.
   * Projected strictly to the original submitting PM confirming approved official progress.
   * Deduplication key: <eventId>:<recipientId>:PROJECT_PROGRESS_CLAIM_APPROVED.
   */
  @OnEvent('project.progress_claim.approved')
  async handleProjectProgressClaimApproved(event: any): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') return [];
    const eventId = event.eventId || event.event_id;
    if (!eventId) return [];

    const payload = event.payload?.businessPayload || event.payload || {};
    const projectId = payload.projectId;
    const progressLogId = payload.progressLogId || event.aggregate_id || event.aggregateId;
    const taskId = payload.taskId;

    let projectName = payload.projectName;
    if (!projectName && projectId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT name FROM projects WHERE id = ?`, [projectId]);
        if (rows && rows.length > 0 && rows[0].name) projectName = rows[0].name;
      } catch {}
    }
    const safeProjectName = projectName && !projectName.match(/^Proyek\s*#\d+$/i) ? projectName : undefined;
    const displayProjectName = safeProjectName || `Proyek #${projectId}`;

    let taskName = payload.taskName;
    if (!taskName && taskId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(`SELECT name FROM tasks WHERE id = ?`, [taskId]);
        if (rows && rows.length > 0 && rows[0].name) taskName = rows[0].name;
      } catch {}
    }
    const safeTaskName = taskName || `Task #${taskId}`;

    let submittedBy: number | null = payload.submittedBy ? Number(payload.submittedBy) : null;
    if (!submittedBy && progressLogId && this.dataSource) {
      try {
        const rows = await this.dataSource.query(
          `SELECT submitted_by FROM project_progress_logs WHERE id = ? LIMIT 1`,
          [progressLogId],
        );
        if (rows && rows.length > 0 && rows[0].submitted_by) submittedBy = Number(rows[0].submitted_by);
      } catch {}
    }

    if (!submittedBy) {
      return this.markIntentionallyIgnored('Missing original submitter for project.progress_claim.approved');
    }

    const prevProg = Number(payload.previousProgress ?? 0);
    const officialProg = Number(payload.officialProgress ?? payload.reportedProgress ?? 100);

    return this.projectEventToNotifications(
      { ...event, eventId },
      {
        purpose: 'PROJECT_PROGRESS_CLAIM_APPROVED',
        type: 'ALERT',
        title: 'Klaim Progres Disetujui',
        message: `Klaim progres task "${safeTaskName}" pada "${displayProjectName}" telah disetujui HOPS (${prevProg}% → ${officialProg}%).`,
        actionTarget: `/project-delivery?view=workspace&projectId=${projectId}&section=tasks`,
        recipientIds: [submittedBy],
        metaData: {
          category: 'PROJECT',
          priority: 'NORMAL',
          reference_type: 'PROJECT_PROGRESS_CLAIM',
          reference_id: progressLogId,
          projectId,
          taskId,
          progressLogId,
          projectName: safeProjectName,
          taskName: safeTaskName,
          actionType: 'PROGRESS_CLAIM_APPROVED',
          previousProgress: prevProg,
          officialProgress: officialProg,
        },
      },
    );
  }

  /**
   * Phase N8.2: Canonical Bell Projection for Invoice Rejected.
   * Sends ALERT Bell notification to the invoice creator (invoice.createdBy) if verifiable.
   * If recipient cannot be determined authoritatively, projection is safely skipped (no guessing).
   * Deduplication guaranteed via: <eventId>:<recipientId>:FINANCE_INVOICE_REJECTED.
   */
  @OnEvent('finance.invoice.rejected')
  async handleFinanceInvoiceRejected(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) return [];
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) return [];

    const payload = event.payload || {};
    const invoiceId = payload.invoiceId || event.aggregateId;
    const invoiceNumber = payload.invoiceNumber || `INV-${invoiceId}`;
    const poId = payload.poId;
    const notes = payload.notes ? String(payload.notes).trim() : '';

    // Authoritative Recipient Resolution: invoice.createdBy
    let creatorId: number | null = payload.createdBy
      ? Number(payload.createdBy)
      : Array.isArray(event.routing?.userIds) && event.routing.userIds.length > 0
        ? Number(event.routing.userIds[0])
        : null;

    if (!creatorId && invoiceId) {
      creatorId = await this.resolveInvoiceCreator(Number(invoiceId));
    }

    if (!creatorId || !(await this.verifyActiveUser(creatorId))) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] Cannot determine authoritative active creator for rejected Invoice #${invoiceId}. Projection skipped.`,
      );
      return [];
    }

    const rejectionDetail = notes ? `: ${notes}` : '.';

    return this.projectEventToNotifications(event, {
      purpose: 'FINANCE_INVOICE_REJECTED',
      type: 'ALERT',
      title: `Invoice Ditolak (${invoiceNumber})`,
      message: `Invoice "${invoiceNumber}" ditolak oleh Finance${rejectionDetail}`,
      actionTarget: `/finance/invoices?tab=invoices_list&invoiceId=${invoiceId}`,
      recipientIds: [creatorId],
      metaData: {
        category: 'FINANCE',
        priority: 'HIGH',
        reference_type: 'INVOICE',
        reference_id: invoiceId,
        invoiceId,
        invoiceNumber,
        poId,
        notes: notes || undefined,
        actionType: 'INVOICE_REJECTED',
      },
    });
  }

  /**
   * Phase N8.2: Canonical Bell Projection for Invoice Verified.
   * Sends informational SYSTEM Bell notification to the invoice creator (invoice.createdBy).
   * Strict Rule: PM recipient MUST NOT be added without valid relation or business rule.
   * Deduplication guaranteed via: <eventId>:<recipientId>:FINANCE_INVOICE_VERIFIED.
   */
  @OnEvent('finance.invoice.verified')
  async handleFinanceInvoiceVerified(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) return [];
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) return [];

    const payload = event.payload || {};
    const invoiceId = payload.invoiceId || event.aggregateId;
    const invoiceNumber = payload.invoiceNumber || `INV-${invoiceId}`;
    const poId = payload.poId;

    // Authoritative Recipient Resolution: invoice.createdBy ONLY
    let creatorId: number | null = payload.createdBy
      ? Number(payload.createdBy)
      : Array.isArray(event.routing?.userIds) && event.routing.userIds.length > 0
        ? Number(event.routing.userIds[0])
        : null;

    if (!creatorId && invoiceId) {
      creatorId = await this.resolveInvoiceCreator(Number(invoiceId));
    }

    if (!creatorId || !(await this.verifyActiveUser(creatorId))) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] Cannot determine authoritative active creator for verified Invoice #${invoiceId}. Projection skipped.`,
      );
      return [];
    }

    return this.projectEventToNotifications(event, {
      purpose: 'FINANCE_INVOICE_VERIFIED',
      type: 'SYSTEM',
      title: `Invoice Berhasil Diverifikasi (${invoiceNumber})`,
      message: `Invoice "${invoiceNumber}" telah diverifikasi oleh Finance dan siap untuk pembayaran.`,
      actionTarget: `/finance/invoices?tab=invoices_list&invoiceId=${invoiceId}`,
      recipientIds: [creatorId],
      metaData: {
        category: 'FINANCE',
        priority: 'NORMAL',
        reference_type: 'INVOICE',
        reference_id: invoiceId,
        invoiceId,
        invoiceNumber,
        poId,
        actionType: 'INVOICE_VERIFIED',
      },
    });
  }

  /**
   * Phase F-HIGH-01: Canonical Bell Projection for Finance Invoice Created.
   * Notifies Finance role users (verifiers) that a vendor invoice has been created.
   * Creator actor is strictly excluded.
   * Deduplication guaranteed via: <eventId>:<recipientId>:FINANCE_INVOICE_CREATED.
   */
  @OnEvent('finance.invoice.created')
  async handleFinanceInvoiceCreated(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on finance.invoice.created');
    }
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const invoiceId = Number(payload.invoiceId || event.aggregateId || 0);
    const invoiceNumber = payload.invoiceNumber || `INV-${invoiceId}`;
    const poId = Number(payload.poId || 0);
    let actorId = Number(event.actor?.userId ?? payload.createdBy ?? 0);

    if (!actorId && invoiceId > 0) {
      const dbCreatorId = await this.resolveInvoiceCreator(invoiceId);
      if (dbCreatorId) actorId = dbCreatorId;
    }

    const financeUserIds = await this.resolveRoleUserIds(['FINANCE']);
    const recipientSet = new Set<number>(financeUserIds);

    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }

    // Exclude creator actor
    if (actorId > 0) {
      recipientSet.delete(actorId);
    }

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No Finance verifier recipients resolved for finance.invoice.created');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'FINANCE_INVOICE_CREATED',
      type: 'INFO',
      title: `Faktur Tagihan Dibuat (${invoiceNumber})`,
      message: `Faktur tagihan ${invoiceNumber} telah dibuat dan siap untuk proses verifikasi matching.`,
      actionTarget: `/finance/invoices?tab=invoices_list&invoiceId=${invoiceId}`,
      recipientIds,
      metaData: {
        category: 'FINANCE',
        priority: 'NORMAL',
        reference_type: 'INVOICE',
        reference_id: invoiceId,
        invoiceId,
        invoiceNumber,
        poId,
        actionType: 'INVOICE_CREATED',
      },
    });
  }

  /**
   * Phase F-HIGH-01: Canonical Bell Projection for Procurement Package Submitted.
   * Notifies Procurement and Purchasing that a procurement package has been submitted by PM.
   * Submitter (PM actor) is strictly excluded.
   * Deduplication guaranteed via: <eventId>:<recipientId>:PROCUREMENT_PACKAGE_SUBMITTED.
   */
  @OnEvent('procurement.package.submitted')
  async handleProcurementPackageSubmitted(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on procurement.package.submitted');
    }
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const packageId = Number(payload.packageId || event.aggregateId || 0);
    const packageNumber = payload.packageNumber || `PKG-${packageId}`;
    const projectId = Number(payload.projectId || event.projectId || 0);
    const actorId = Number(event.actor?.userId ?? payload.submittedBy ?? 0);

    const targetRoles = ['PROCUREMENT', 'PURCHASING'];
    const roleUserIds = await this.resolveRoleUserIds(targetRoles);

    const recipientSet = new Set<number>(roleUserIds);
    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }
    if (actorId > 0) {
      recipientSet.delete(actorId);
    }

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored(
        'No eligible Procurement/Purchasing recipients for procurement.package.submitted',
      );
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROCUREMENT_PACKAGE_SUBMITTED',
      type: 'ALERT',
      title: `Paket Pengadaan Diajukan (${packageNumber})`,
      message: `Paket pengadaan ${packageNumber} telah diajukan dan siap diproses ke tahap RFQ/Pengadaan.`,
      actionTarget: `/procurement?tab=packages&packageId=${packageId}`,
      recipientIds,
      metaData: {
        category: 'PROCUREMENT',
        priority: 'NORMAL',
        reference_type: 'PROCUREMENT_PACKAGE',
        reference_id: packageId,
        packageId,
        packageNumber,
        projectId,
        actionType: 'PACKAGE_SUBMITTED',
      },
    });
  }

  /**
   * Phase N8.2: Canonical Bell Projection for Procurement Package Returned.
   * Actionable alert to the PM / Requester responsible for the procurement package based on authoritative relations.
   * Strictly avoids heuristic guessing or role-based broadcasts.
   * Deduplication guaranteed via: <eventId>:<recipientId>:PROCUREMENT_PACKAGE_RETURNED.
   */
  @OnEvent('procurement.package.returned')
  async handleProcurementPackageReturned(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing valid event or eventId');
    }
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload || {};
    const packageId = payload.packageId || event.aggregateId;
    const packageNumber = payload.packageNumber || `PKG-${packageId}`;
    const projectId = payload.projectId || event.projectId;
    const reason = payload.reason ? String(payload.reason).trim() : '';

    // Authoritative Recipient Resolution: PM or Requester from data relations
    let targetUserId: number | null = payload.requestedBy
      ? Number(payload.requestedBy)
      : Array.isArray(event.routing?.userIds) && event.routing.userIds.length > 0
        ? Number(event.routing.userIds[0])
        : null;

    if (targetUserId && !(await this.verifyActiveUser(targetUserId))) {
      targetUserId = null;
    }

    if (!targetUserId && packageId) {
      targetUserId = await this.resolvePackageRequesterOrPm(
        Number(packageId),
        projectId ? Number(projectId) : undefined,
      );
    }

    if (!targetUserId) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] Cannot determine authoritative active PM/requester for returned Package #${packageId}. Projection skipped.`,
      );
      return this.markIntentionallyIgnored(
        `Cannot determine authoritative active PM/requester for returned Package #${packageId}`,
      );
    }

    const reasonDetail = reason ? `: ${reason}` : ' untuk direvisi.';

    return this.projectEventToNotifications(event, {
      purpose: 'PROCUREMENT_PACKAGE_RETURNED',
      type: 'ALERT',
      title: `Paket Pengadaan Dikembalikan (${packageNumber})`,
      message: `Paket pengadaan "${packageNumber}" dikembalikan oleh tim Procurement${reasonDetail}`,
      actionTarget: `/procurement?tab=packages&packageId=${packageId}`,
      recipientIds: [targetUserId],
      metaData: {
        category: 'PROCUREMENT',
        priority: 'HIGH',
        reference_type: 'PROCUREMENT_PACKAGE',
        reference_id: packageId,
        packageId,
        packageNumber,
        projectId,
        reason: reason || undefined,
        actionType: 'PACKAGE_RETURNED',
      },
    });
  }

  /**
   * Phase F-HIGH-01: Canonical Bell Projection for Purchase Order Issued.
   * Notifies the Project Manager and Purchase Request Requester that PO has been issued.
   * The issuing actor (Purchasing) is strictly excluded.
   * Deduplication guaranteed via: <eventId>:<recipientId>:PURCHASE_ORDER_ISSUED.
   */
  @OnEvent('procurement.po.issued')
  async handleProcurementPoIssued(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on procurement.po.issued');
    }
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const poId = Number(payload.poId || event.aggregateId || 0);
    const poNumber = payload.poNumber || `PO-${poId}`;
    let projectId = Number(payload.projectId || event.projectId || 0);
    let purchaseRequestId = Number(payload.purchaseRequestId || 0);
    const actorId = Number(event.actor?.userId ?? payload.issuedBy ?? 0);

    const recipientSet = new Set<number>();

    // Resolve PO context if needed (to get PM and PR requester)
    if (poId > 0) {
      const pmIdFromPo = await this.resolvePmUserIdFromPo(poId);
      if (pmIdFromPo && pmIdFromPo > 0) {
        recipientSet.add(pmIdFromPo);
      }
    }

    if (!purchaseRequestId && poId > 0) {
      const poCtx = await this.resolvePurchaseOrderContext(poId);
      if (poCtx.found) {
        if (!projectId && poCtx.projectId) projectId = poCtx.projectId;
        if (poCtx.prId) purchaseRequestId = poCtx.prId;
        if (poCtx.requesterId && poCtx.requesterId > 0) recipientSet.add(poCtx.requesterId);
        if (poCtx.managerId && poCtx.managerId > 0) recipientSet.add(poCtx.managerId);
      }
    } else if (purchaseRequestId > 0) {
      const prCtx = await this.resolvePurchaseRequestContext(purchaseRequestId);
      if (prCtx.found) {
        if (!projectId && prCtx.projectId) projectId = prCtx.projectId;
        if (prCtx.requesterId && prCtx.requesterId > 0) recipientSet.add(prCtx.requesterId);
      }
    }

    if (projectId > 0) {
      const pmIdFromProj = await this.resolvePmUserIdFromProject(projectId);
      if (pmIdFromProj && pmIdFromProj > 0) {
        recipientSet.add(pmIdFromProj);
      }
    }

    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }

    if (actorId > 0) {
      recipientSet.delete(actorId);
    }

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No PM or PR requester recipients resolved for procurement.po.issued');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PURCHASE_ORDER_ISSUED',
      type: 'INFO',
      title: `Purchase Order Diterbitkan (${poNumber})`,
      message: `Purchase Order ${poNumber} telah resmi diterbitkan untuk vendor.`,
      actionTarget: `/procurement?tab=po&poId=${poId}`,
      recipientIds,
      metaData: {
        category: 'PROCUREMENT',
        priority: 'NORMAL',
        reference_type: 'PURCHASE_ORDER',
        reference_id: poId,
        poId,
        poNumber,
        projectId,
        purchaseRequestId,
        actionType: 'PO_ISSUED',
      },
    });
  }

  /**
   * Phase F-HIGH-01: Canonical Bell Projection for Goods Receipt Recorded.
   * Notifies Finance and the Project Manager that goods receipt has been recorded.
   * The receiving actor is strictly excluded.
   * Deduplication guaranteed via: <eventId>:<recipientId>:GOODS_RECEIPT_RECORDED.
   */
  @OnEvent('procurement.gr.received')
  async handleProcurementGrReceived(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on procurement.gr.received');
    }
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) {
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
    }

    const payload = event.payload?.businessPayload || event.payload || {};
    const grId = Number(payload.grId || event.aggregateId || 0);
    const grNumber = payload.grNumber || `GR-${grId}`;
    const poId = Number(payload.poId || 0);
    const poNumber = payload.poNumber || (poId ? `PO #${poId}` : '');
    const actorId = Number(event.actor?.userId ?? payload.receivedBy ?? 0);

    const recipientSet = new Set<number>();

    // 1. Finance recipients
    const financeUserIds = await this.resolveRoleUserIds(['FINANCE']);
    for (const uid of financeUserIds) {
      if (uid > 0) recipientSet.add(uid);
    }

    // 2. Project Manager linked to PO
    if (poId > 0) {
      const pmId = await this.resolvePmUserIdFromPo(poId);
      if (pmId && pmId > 0) {
        recipientSet.add(pmId);
      }
    }

    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }

    // Exclude the receiving actor
    if (actorId > 0) {
      recipientSet.delete(actorId);
    }

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No Finance or PM recipients resolved for procurement.gr.received');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'GOODS_RECEIPT_RECORDED',
      type: 'INFO',
      title: `Penerimaan Barang Dicatat (${grNumber})`,
      message: `Penerimaan barang untuk PO ${poNumber} telah dicatat dan siap diproses rekonsiliasi faktur.`,
      actionTarget: poId ? `/procurement?tab=gr&poId=${poId}` : `/procurement?tab=gr`,
      recipientIds,
      metaData: {
        category: 'PROCUREMENT',
        priority: 'NORMAL',
        reference_type: 'GOODS_RECEIPT',
        reference_id: grId,
        grId,
        grNumber,
        poId,
        poNumber,
        actionType: 'GR_RECORDED',
      },
    });
  }

  private static readonly MANAGEMENT_REVIEW_STAGE_CONFIG: Record<
    string,
    {
      role: string;
      purpose: string;
      stageLabel: string;
      stageNumber: number;
    }
  > = {
    node_hops_review: {
      role: 'HEAD_OF_OPERATIONS',
      purpose: 'MANAGEMENT_REVIEW_HOPS_ASSIGNED',
      stageLabel: 'Head of Operations (HOPS)',
      stageNumber: 2,
    },
    node_procurement_review: {
      role: 'PROCUREMENT',
      purpose: 'MANAGEMENT_REVIEW_PROCUREMENT_ASSIGNED',
      stageLabel: 'Procurement',
      stageNumber: 3,
    },
    node_finance_review: {
      role: 'FINANCE',
      purpose: 'MANAGEMENT_REVIEW_FINANCE_ASSIGNED',
      stageLabel: 'Finance',
      stageNumber: 4,
    },
    node_director_approval: {
      role: 'DIRECTOR',
      purpose: 'MANAGEMENT_REVIEW_DIRECTOR_ASSIGNED',
      stageLabel: 'Director',
      stageNumber: 5,
    },
  };

  private static readonly MANAGEMENT_REVIEW_RETURN_STAGE_LABELS: Record<string, string> = {
    node_pm_revision_hops: 'Head of Operations (HOPS)',
    node_pm_revision_procurement: 'Procurement',
    node_pm_revision_finance: 'Finance',
    node_pm_revision_director: 'Director',
  };

  public static readonly DEDICATED_EVENT_WORKFLOWS = new Set([
    'PROJECT_CLOSURE',
    'TENDER_GO_NOGO_WORKFLOW',
    'DISCOUNT_APPROVAL_WORKFLOW',
    'LEGAL_REVIEW_WORKFLOW',
    'PROJECT_INITIATION_WORKFLOW',
  ]);

  /**
   * Canonical Bell & Web Push Projection for Workflow Task Assignments.
   * Covers:
   *  - Management Review Reviewer Stages (PROJECT_PLAN_REVIEW_WORKFLOW):
   *      - PM -> HOPS (node_hops_review)
   *      - HOPS -> Procurement (node_procurement_review)
   *      - Procurement -> Finance (node_finance_review)
   *      - Finance -> Director (node_director_approval)
   *      - PM Resubmit -> Reviewer Stage (node_pm_revision_* -> node_*_review)
   *  - Procurement Request (PURCHASE_REQUEST_WORKFLOW):
   *      - Finance -> Director Approval (node_director_approval)
   * Workflows with dedicated domain events (PROJECT_CLOSURE, etc.) are intentionally ignored
   * to guarantee zero duplicate notifications.
   */
  @OnEvent('workflow.task.assigned')
  async handleWorkflowTaskAssigned(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') return [];
    const eventId = event.eventId || (event as any).event_id;
    if (!eventId) return [];
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) return [];

    const payload = event.payload?.businessPayload || event.payload || {};
    let workflowKey = payload.workflowKey ? String(payload.workflowKey).trim().toUpperCase() : undefined;
    const instanceId = Number(payload.workflowInstanceId ?? payload.instanceId ?? 0);
    let entityType = payload.entityType ? String(payload.entityType).trim().toUpperCase() : undefined;
    let entityId = Number(payload.entityId ?? payload.projectId ?? event.projectId ?? event.aggregateId ?? 0);
    const nodeId = String(payload.nodeId || '').trim();

    if (!workflowKey && instanceId > 0) {
      const instanceCtx = await this.resolveWorkflowInstanceContext(instanceId);
      if (instanceCtx.found) {
        workflowKey = instanceCtx.workflowKey?.toUpperCase();
        entityType = entityType || instanceCtx.entityType?.toUpperCase();
        entityId = entityId || instanceCtx.entityId || 0;
      }
    }

    // Workflows with dedicated domain events produce no generic workflow task assignment notifications
    if (workflowKey && CanonicalNotificationConsumer.DEDICATED_EVENT_WORKFLOWS.has(workflowKey)) {
      return this.markIntentionallyIgnored(
        `Workflow '${workflowKey}' task assignment is handled by dedicated domain events`,
      );
    }

    // Branch 1: PROJECT_PLAN_REVIEW_WORKFLOW (Management Review)
    if (
      workflowKey === 'PROJECT_PLAN_REVIEW_WORKFLOW' ||
      (!workflowKey && entityType === 'PROJECT' && CanonicalNotificationConsumer.MANAGEMENT_REVIEW_STAGE_CONFIG[nodeId])
    ) {
      const stageConfig = CanonicalNotificationConsumer.MANAGEMENT_REVIEW_STAGE_CONFIG[nodeId];
      if (!stageConfig) {
        if (nodeId.startsWith('node_pm_revision')) {
          return this.markIntentionallyIgnored(
            `PROJECT_PLAN_REVIEW_WORKFLOW revision node '${nodeId}' is handled by workflow.task.returned`,
          );
        }
        return this.markIntentionallyIgnored(
          `PROJECT_PLAN_REVIEW_WORKFLOW stage '${nodeId}' requires no assignment notification`,
        );
      }

      const projectId = Number(event.projectId ?? payload.projectId ?? entityId ?? 0);
      if (!projectId || isNaN(projectId) || projectId <= 0) {
        return [];
      }

      const taskId = payload.taskId || event.aggregateId;
      const actorId = Number((event as any).actor?.userId ?? payload.actorId ?? 0) || null;
      const fromNode = String(payload.fromNode || '').trim();
      const action = String(payload.action || '').toUpperCase();
      const isResubmission = action === 'RESUBMIT' || fromNode.startsWith('node_pm_revision');

      const projectCtx = await this.resolveProjectContext(projectId);
      const rawName = payload.projectName || projectCtx.projectName;
      const safeProjectName =
        rawName && !String(rawName).match(/^Proyek\s*#\d+$/i) ? String(rawName) : undefined;
      const displayProjectName =
        safeProjectName || (projectCtx.projectCode ? projectCtx.projectCode : `Proyek #${projectId}`);

      let recipientIds: number[] = [];
      const assignedUserId = Number(payload.assignedUserId ?? 0);
      if (assignedUserId > 0) {
        const isActive = await this.verifyActiveUserOrUnconfigured(assignedUserId);
        if (isActive) {
          recipientIds = [assignedUserId];
        }
      } else {
        const roleUserIds = await this.resolveRoleUserIds([stageConfig.role]);
        if (roleUserIds.length > 0) {
          recipientIds = roleUserIds;
        } else if (Array.isArray(event.routing?.userIds) && event.routing.userIds.length > 0) {
          recipientIds = event.routing.userIds
            .map((id) => Number(id))
            .filter((id) => !isNaN(id) && id > 0);
        }
      }

      if (actorId) {
        recipientIds = recipientIds.filter((id) => id !== actorId);
      }

      if (recipientIds.length === 0) {
        this.logger.warn(
          `[CanonicalNotificationConsumer] Zero active reviewer recipients resolved for Management Review node '${nodeId}' on Project #${projectId} (Task #${taskId}). Projection skipped.`,
        );
        return [];
      }

      const title = isResubmission
        ? `Revisi Rencana Operasional Proyek Menunggu Review ${stageConfig.stageLabel}`
        : `Review Rencana Operasional Proyek (${stageConfig.stageLabel})`;

      const message = isResubmission
        ? `PM telah mengajukan ulang revisi Rencana Operasional Proyek "${displayProjectName}". Silakan tinjau kembali pada tahap ${stageConfig.stageLabel}.`
        : nodeId === 'node_hops_review'
          ? `Rencana Operasional Proyek "${displayProjectName}" telah diajukan oleh PM dan menunggu review ${stageConfig.stageLabel}.`
          : `Rencana Operasional Proyek "${displayProjectName}" telah disetujui pada tahap sebelumnya dan kini menunggu review ${stageConfig.stageLabel}.`;

      const actionTarget = taskId
        ? `/governance/tasks?taskId=${taskId}&projectId=${projectId}`
        : `/governance/tasks?projectId=${projectId}`;

      return this.projectEventToNotifications(
        { ...event, eventId },
        {
          purpose: stageConfig.purpose,
          type: 'ALERT',
          title,
          message,
          actionTarget,
          recipientIds,
          metaData: {
            category: 'PROJECT',
            priority: 'HIGH',
            reference_type: 'WORKFLOW_TASK',
            reference_id: taskId,
            taskId,
            projectId,
            projectName: safeProjectName,
            workflowInstanceId: payload.workflowInstanceId,
            nodeId,
            stageRole: stageConfig.role,
            stageNumber: stageConfig.stageNumber,
            actionType: isResubmission ? 'MANAGEMENT_REVIEW_RESUBMITTED' : 'MANAGEMENT_REVIEW_ASSIGNED',
          },
        },
      );
    }

    // Branch 2: PURCHASE_REQUEST_WORKFLOW
    if (workflowKey === 'PURCHASE_REQUEST_WORKFLOW' || (!workflowKey && entityType === 'PURCHASE_REQUEST')) {
      if (nodeId === 'node_director_approval') {
        const prId = Number(entityId || payload.purchaseRequestId || payload.prId || 0);
        if (!prId || isNaN(prId) || prId <= 0) {
          return this.markIntentionallyIgnored('Missing valid PR ID for director approval task');
        }

        const prCtx = await this.resolvePurchaseRequestContext(prId);
        const prNumber = prCtx.prNumber || payload.prNumber || `PR #${prId}`;
        const taskId = payload.taskId || event.aggregateId;
        const actorId = Number((event as any).actor?.userId ?? payload.actorId ?? 0) || null;

        let recipientIds: number[] = [];
        const assignedUserId = Number(payload.assignedUserId ?? 0);
        if (assignedUserId > 0) {
          const isActive = await this.verifyActiveUserOrUnconfigured(assignedUserId);
          if (isActive) {
            recipientIds = [assignedUserId];
          }
        } else {
          recipientIds = await this.resolveRoleUserIds(['DIRECTOR']);
          if (recipientIds.length === 0 && Array.isArray(event.routing?.userIds)) {
            recipientIds = event.routing.userIds
              .map((id) => Number(id))
              .filter((id) => !isNaN(id) && id > 0);
          }
        }

        if (actorId) {
          recipientIds = recipientIds.filter((id) => id !== actorId);
        }

        if (recipientIds.length === 0) {
          this.logger.warn(
            `[CanonicalNotificationConsumer] Zero active DIRECTOR recipients resolved for PR #${prId} (Task #${taskId}). Projection skipped.`,
          );
          return this.markIntentionallyIgnored(
            `Zero active DIRECTOR recipients resolved for PR #${prId} (Task #${taskId})`,
          );
        }

        return this.projectEventToNotifications(
          { ...event, eventId },
          {
            purpose: 'PURCHASE_REQUEST_DIRECTOR_APPROVAL_ASSIGNED',
            type: 'ALERT',
            title: 'Persetujuan Purchase Request (Direktur)',
            message: `Purchase Request "${prNumber}" telah disetujui Finance dan membutuhkan persetujuan Direktur.`,
            actionTarget: `/procurement?tab=pr&prId=${prId}`,
            recipientIds,
            metaData: {
              category: 'PROCUREMENT',
              priority: 'HIGH',
              reference_type: 'PURCHASE_REQUEST',
              reference_id: prId,
              prId,
              purchaseRequestId: prId,
              prNumber,
              projectId: prCtx.projectId,
              workflowInstanceId: instanceId || payload.workflowInstanceId,
              nodeId,
              stageRole: 'DIRECTOR',
              actionType: 'PURCHASE_REQUEST_DIRECTOR_ASSIGNED',
            },
          },
        );
      }

      if (nodeId === 'node_finance_review') {
        return this.markIntentionallyIgnored(
          'Dedicated procurement.pr.submitted handles finance review assignment',
        );
      }

      if (nodeId === 'node_procurement_revision') {
        return this.markIntentionallyIgnored(
          'workflow.task.returned handles procurement revision notification',
        );
      }

      return this.markIntentionallyIgnored(
        `PURCHASE_REQUEST_WORKFLOW node '${nodeId}' requires no direct assignment notification`,
      );
    }

    // Unrecognized workflow
    return [];
  }

  /**
   * Canonical Bell & Web Push Projection for Workflow Task Returns / Revisions.
   * Covers:
   *  - Management Review Return -> PM (PROJECT_PLAN_REVIEW_WORKFLOW)
   *      - HOPS -> PM (node_pm_revision_hops)
   *      - Procurement -> PM (node_pm_revision_procurement)
   *      - Finance -> PM (node_pm_revision_finance)
   *      - Director -> PM (node_pm_revision_director)
   *  - Purchase Request Return -> Requester / Creator & Endorsing Finance (PURCHASE_REQUEST_WORKFLOW)
   *      - Finance Return -> Requester (node_finance_review -> node_procurement_revision)
   *      - Director Return -> Requester AND Finance (node_director_approval -> node_procurement_revision)
   * Workflows with dedicated domain events (PROJECT_CLOSURE, etc.) are intentionally ignored.
   */
  @OnEvent('workflow.task.returned')
  async handleWorkflowTaskReturned(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') return [];
    const eventId = event.eventId || (event as any).event_id;
    if (!eventId) return [];
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) return [];

    const payload = event.payload?.businessPayload || event.payload || {};
    const action = String(payload.action || '').toUpperCase();
    if (action !== 'RETURN') {
      return [];
    }

    let workflowKey = payload.workflowKey ? String(payload.workflowKey).trim().toUpperCase() : undefined;
    const instanceId = Number(payload.workflowInstanceId ?? payload.instanceId ?? 0);
    let entityType = payload.entityType ? String(payload.entityType).trim().toUpperCase() : undefined;
    let entityId = Number(payload.entityId ?? payload.projectId ?? event.projectId ?? event.aggregateId ?? 0);
    const toNode = String(payload.toNode || '').trim();
    const fromNode = String(payload.fromNode || '').trim();

    if (!workflowKey && instanceId > 0) {
      const instanceCtx = await this.resolveWorkflowInstanceContext(instanceId);
      if (instanceCtx.found) {
        workflowKey = instanceCtx.workflowKey?.toUpperCase();
        entityType = entityType || instanceCtx.entityType?.toUpperCase();
        entityId = entityId || instanceCtx.entityId || 0;
      }
    }

    if (workflowKey && CanonicalNotificationConsumer.DEDICATED_EVENT_WORKFLOWS.has(workflowKey)) {
      return this.markIntentionallyIgnored(
        `Workflow '${workflowKey}' task return is handled by dedicated domain events`,
      );
    }

    // Branch 1: PROJECT_PLAN_REVIEW_WORKFLOW
    if (
      workflowKey === 'PROJECT_PLAN_REVIEW_WORKFLOW' ||
      (!workflowKey && entityType === 'PROJECT' && CanonicalNotificationConsumer.MANAGEMENT_REVIEW_RETURN_STAGE_LABELS[toNode])
    ) {
      const reviewerStageLabel = CanonicalNotificationConsumer.MANAGEMENT_REVIEW_RETURN_STAGE_LABELS[toNode];
      if (!reviewerStageLabel) {
        return this.markIntentionallyIgnored(
          `PROJECT_PLAN_REVIEW_WORKFLOW return to unrecognized revision node '${toNode}'`,
        );
      }

      const projectId = Number(event.projectId ?? payload.projectId ?? entityId ?? 0);
      if (!projectId || isNaN(projectId) || projectId <= 0) {
        return [];
      }

      const taskId = payload.taskId || event.aggregateId;
      const actorId = Number((event as any).actor?.userId ?? payload.decidedBy ?? 0) || null;
      const reason = payload.reason ? String(payload.reason).trim() : '';

      const projectCtx = await this.resolveProjectContext(projectId);
      const pmUserId = await this.resolveAuthoritativeProjectPm(projectCtx);

      if (!pmUserId || (actorId && pmUserId === actorId)) {
        this.logger.warn(
          `[CanonicalNotificationConsumer] Cannot determine valid active PM recipient for Management Review RETURN on Project #${projectId} (toNode: ${toNode}). Projection skipped.`,
        );
        return [];
      }

      const rawName = payload.projectName || projectCtx.projectName;
      const safeProjectName =
        rawName && !String(rawName).match(/^Proyek\s*#\d+$/i) ? String(rawName) : undefined;
      const displayProjectName =
        safeProjectName || (projectCtx.projectCode ? projectCtx.projectCode : `Proyek #${projectId}`);

      const title = `Rencana Operasional Proyek Perlu Revisi (${reviewerStageLabel})`;
      const message = reason
        ? `Rencana Operasional Proyek "${displayProjectName}" dikembalikan oleh ${reviewerStageLabel} untuk direvisi. Catatan: ${reason}`
        : `Rencana Operasional Proyek "${displayProjectName}" dikembalikan oleh ${reviewerStageLabel} untuk direvisi. Silakan perbarui rencana operasional dan ajukan kembali.`;

      return this.projectEventToNotifications(
        { ...event, eventId },
        {
          purpose: 'MANAGEMENT_REVIEW_RETURNED_TO_PM',
          type: 'ALERT',
          title,
          message,
          actionTarget: `/project-delivery?projectId=${projectId}&action=operational-plan`,
          recipientIds: [pmUserId],
          metaData: {
            category: 'PROJECT',
            priority: 'HIGH',
            reference_type: 'WORKFLOW_TASK',
            reference_id: taskId,
            taskId,
            projectId,
            projectName: safeProjectName,
            instanceId: payload.instanceId,
            fromNode,
            toNode,
            reviewerStage: reviewerStageLabel,
            reason: reason || undefined,
            actionType: 'MANAGEMENT_REVIEW_RETURNED',
          },
        },
      );
    }

    // Branch 2: PURCHASE_REQUEST_WORKFLOW
    if (workflowKey === 'PURCHASE_REQUEST_WORKFLOW' || (!workflowKey && entityType === 'PURCHASE_REQUEST')) {
      if (toNode === 'node_procurement_revision') {
        const prId = Number(entityId || payload.purchaseRequestId || payload.prId || 0);
        if (!prId || isNaN(prId) || prId <= 0) {
          return this.markIntentionallyIgnored('Missing valid PR ID for workflow return task');
        }

        const prCtx = await this.resolvePurchaseRequestContext(prId);
        const prNumber = prCtx.prNumber || payload.prNumber || `PR #${prId}`;
        const taskId = payload.taskId || event.aggregateId;
        const actorId = Number((event as any).actor?.userId ?? payload.decidedBy ?? payload.actorId ?? 0) || null;
        const reason = payload.reason ? String(payload.reason).trim() : '';

        let requesterUserId: number | null = prCtx.requesterId || prCtx.createdBy || Number(payload.requesterId || 0) || null;
        if (requesterUserId) {
          const isActive = await this.verifyActiveUserOrUnconfigured(requesterUserId);
          if (!isActive) {
            requesterUserId = null;
          }
        }

        if (fromNode === 'node_director_approval') {
          // Director Return: Notify PR requester AND the actual Finance reviewer who previously endorsed it with action APPROVE
          const financeReviewers = await this.resolvePreviousReviewerUserIds(
            instanceId,
            'node_finance_review',
            'APPROVE',
          );

          if (financeReviewers.length === 0) {
            this.logger.warn(
              `[CanonicalNotificationConsumer] Actual Finance reviewer (action APPROVE) could not be proven for Director RETURN on PR #${prId} (instance #${instanceId}). Skipping Finance recipient without role fallback.`,
            );
          }

          let recipientIds = [
            ...(requesterUserId ? [requesterUserId] : []),
            ...financeReviewers,
          ];
          recipientIds = [...new Set(recipientIds)];

          if (actorId) {
            recipientIds = recipientIds.filter((id) => id !== actorId);
          }

          if (recipientIds.length === 0) {
            this.logger.warn(
              `[CanonicalNotificationConsumer] Zero active recipients resolved for Director RETURN on PR #${prId} (instance #${instanceId}). Projection skipped.`,
            );
            return this.markIntentionallyIgnored(
              `Zero active recipients resolved for Director RETURN on PR #${prId} (instance #${instanceId})`,
            );
          }

          const title = 'Purchase Request Dikembalikan Direktur';
          const message = reason
            ? `Purchase Request "${prNumber}" dikembalikan oleh Direktur untuk direvisi. Catatan: ${reason}`
            : `Purchase Request "${prNumber}" dikembalikan oleh Direktur untuk direvisi. Silakan periksa dan perbaiki.`;

          return this.projectEventToNotifications(
            { ...event, eventId },
            {
              purpose: 'PURCHASE_REQUEST_DIRECTOR_RETURNED',
              type: 'ALERT',
              title,
              message,
              actionTarget: `/procurement?tab=pr&prId=${prId}`,
              recipientIds,
              metaData: {
                category: 'PROCUREMENT',
                priority: 'HIGH',
                reference_type: 'PURCHASE_REQUEST',
                reference_id: prId,
                prId,
                purchaseRequestId: prId,
                prNumber,
                projectId: prCtx.projectId,
                instanceId,
                fromNode,
                toNode,
                reason: reason || undefined,
                actionType: 'PURCHASE_REQUEST_DIRECTOR_RETURNED',
              },
            },
          );
        }

        if (fromNode === 'node_finance_review') {
          // Finance Return: Notify PR requester/creator
          let recipientIds = requesterUserId ? [requesterUserId] : [];
          if (actorId) {
            recipientIds = recipientIds.filter((id) => id !== actorId);
          }

          if (recipientIds.length === 0) {
            this.logger.warn(
              `[CanonicalNotificationConsumer] Zero active recipients resolved for Finance RETURN on PR #${prId}. Projection skipped.`,
            );
            return this.markIntentionallyIgnored(
              `Zero active recipients resolved for Finance RETURN on PR #${prId}`,
            );
          }

          const title = 'Purchase Request Dikembalikan Finance';
          const message = reason
            ? `Purchase Request "${prNumber}" dikembalikan oleh Finance untuk direvisi. Catatan: ${reason}`
            : `Purchase Request "${prNumber}" dikembalikan oleh Finance untuk direvisi. Silakan periksa dan perbaiki.`;

          return this.projectEventToNotifications(
            { ...event, eventId },
            {
              purpose: 'PURCHASE_REQUEST_RETURNED_TO_PROCUREMENT',
              type: 'ALERT',
              title,
              message,
              actionTarget: `/procurement?tab=pr&prId=${prId}`,
              recipientIds,
              metaData: {
                category: 'PROCUREMENT',
                priority: 'HIGH',
                reference_type: 'PURCHASE_REQUEST',
                reference_id: prId,
                prId,
                purchaseRequestId: prId,
                prNumber,
                projectId: prCtx.projectId,
                instanceId,
                fromNode,
                toNode,
                reason: reason || undefined,
                actionType: 'PURCHASE_REQUEST_FINANCE_RETURNED',
              },
            },
          );
        }

        // Generic return to procurement revision from other node
        let recipientIds = requesterUserId ? [requesterUserId] : [];
        if (actorId) {
          recipientIds = recipientIds.filter((id) => id !== actorId);
        }

        if (recipientIds.length === 0) {
          return this.markIntentionallyIgnored(`Zero active recipients resolved for generic RETURN on PR #${prId}`);
        }

        return this.projectEventToNotifications(
          { ...event, eventId },
          {
            purpose: 'PURCHASE_REQUEST_RETURNED_TO_PROCUREMENT',
            type: 'ALERT',
            title: 'Purchase Request Perlu Revisi',
            message: reason
              ? `Purchase Request "${prNumber}" dikembalikan untuk direvisi. Catatan: ${reason}`
              : `Purchase Request "${prNumber}" dikembalikan untuk direvisi. Silakan lakukan perbaikan.`,
            actionTarget: `/procurement?tab=pr&prId=${prId}`,
            recipientIds,
            metaData: {
              category: 'PROCUREMENT',
              priority: 'HIGH',
              reference_type: 'PURCHASE_REQUEST',
              reference_id: prId,
              prId,
              purchaseRequestId: prId,
              prNumber,
              projectId: prCtx.projectId,
              instanceId,
              fromNode,
              toNode,
              reason: reason || undefined,
              actionType: 'PURCHASE_REQUEST_RETURNED',
            },
          },
        );
      }

      return this.markIntentionallyIgnored(
        `PURCHASE_REQUEST_WORKFLOW return to non-revision node '${toNode}'`,
      );
    }

    // Unrecognized workflow
    return [];
  }

  /**
   * Canonical Bell & Web Push Projection for Workflow Instance Completion.
   * Covers:
   *  - Management Review Final Approval (PROJECT_PLAN_REVIEW_WORKFLOW): Director -> Ready for Kick-Off.
   *  - Purchase Request (PURCHASE_REQUEST_WORKFLOW): Intentionally ignored because dedicated
   *    procurement.pr.approved handles notifications to Procurement and Purchasing.
   *  - Project Closure (PROJECT_CLOSURE): Intentionally ignored because dedicated
   *    project.closure.director.approved handles closure notifications.
   */
  @OnEvent('workflow.instance.completed')
  async handleWorkflowInstanceCompleted(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object') return [];
    const eventId = event.eventId || (event as any).event_id;
    if (!eventId) return [];
    if (event.notificationPolicy === NotificationPolicy.SYNC_ONLY) return [];

    const payload = event.payload?.businessPayload || event.payload || {};
    let workflowKey = payload.workflowKey ? String(payload.workflowKey).trim().toUpperCase() : undefined;
    const instanceId = Number(payload.workflowInstanceId ?? payload.instanceId ?? event.aggregateId ?? 0);
    let entityType = payload.entityType ? String(payload.entityType).trim().toUpperCase() : undefined;
    let entityId = Number(payload.entityId ?? payload.projectId ?? event.projectId ?? 0);

    if (!workflowKey && instanceId > 0) {
      const instanceCtx = await this.resolveWorkflowInstanceContext(instanceId);
      if (instanceCtx.found) {
        workflowKey = instanceCtx.workflowKey?.toUpperCase();
        entityType = entityType || instanceCtx.entityType?.toUpperCase();
        entityId = entityId || instanceCtx.entityId || 0;
      }
    }

    // Dedicated domain event workflows
    if (workflowKey && CanonicalNotificationConsumer.DEDICATED_EVENT_WORKFLOWS.has(workflowKey)) {
      return this.markIntentionallyIgnored(
        `Workflow '${workflowKey}' instance completion is handled by dedicated domain events`,
      );
    }

    // Purchase Request completion is handled by dedicated procurement.pr.approved
    if (workflowKey === 'PURCHASE_REQUEST_WORKFLOW' || (!workflowKey && entityType === 'PURCHASE_REQUEST')) {
      return this.markIntentionallyIgnored(
        'Dedicated procurement.pr.approved event handles canonical notification for PR completion',
      );
    }

    // Branch 1: PROJECT_PLAN_REVIEW_WORKFLOW
    if (
      workflowKey === 'PROJECT_PLAN_REVIEW_WORKFLOW' ||
      (!workflowKey && entityType === 'PROJECT')
    ) {
      const finalStatus = String(payload.finalStatus || '').toUpperCase();
      if (finalStatus !== 'COMPLETED') {
        return [];
      }

      if (String(payload.action || '').toUpperCase() !== 'APPROVE') {
        return [];
      }

      if (String(payload.fromNode || '').trim() !== 'node_director_approval') {
        return [];
      }

      if (String(payload.toNode || '').trim() !== 'node_end') {
        return [];
      }

      if (String(payload.reviewStatus || '').toUpperCase() !== 'READY_FOR_KICKOFF') {
        return [];
      }

      if (!payload.workflowKey && instanceId > 0) {
        const isValidMrInstance = await this.verifyManagementReviewWorkflowInstance(instanceId);
        if (!isValidMrInstance) {
          return [];
        }
      }

      const projectId = Number(event.projectId ?? payload.projectId ?? entityId ?? 0);
      if (!projectId || isNaN(projectId) || projectId <= 0) {
        return [];
      }

      const projectCtx = await this.resolveProjectContext(projectId);
      if (
        projectCtx.found &&
        projectCtx.reviewStatus &&
        String(projectCtx.reviewStatus).toUpperCase() !== 'READY_FOR_KICKOFF'
      ) {
        this.logger.warn(
          `[CanonicalNotificationConsumer] Skipping Management Review completion notification for Project #${projectId}: review status is '${projectCtx.reviewStatus}' (expected READY_FOR_KICKOFF).`,
        );
        return [];
      }

      const actorId = Number((event as any).actor?.userId ?? payload.decidedBy ?? 0) || null;
      const pmUserId = await this.resolveAuthoritativeProjectPm(projectCtx);

      if (!pmUserId || (actorId && pmUserId === actorId)) {
        this.logger.warn(
          `[CanonicalNotificationConsumer] Cannot determine valid active PM recipient for Management Review final approval on Project #${projectId}. Projection skipped.`,
        );
        return [];
      }

      const rawName = payload.projectName || projectCtx.projectName;
      const safeProjectName =
        rawName && !String(rawName).match(/^Proyek\s*#\d+$/i) ? String(rawName) : undefined;
      const displayProjectName =
        safeProjectName || (projectCtx.projectCode ? projectCtx.projectCode : `Proyek #${projectId}`);

      return this.projectEventToNotifications(
        { ...event, eventId },
        {
          purpose: 'MANAGEMENT_REVIEW_APPROVED_READY_FOR_KICKOFF',
          type: 'ALERT',
          title: 'Rencana Operasional Proyek Disetujui (Siap Kick-Off)',
          message: `Rencana Operasional Proyek "${displayProjectName}" telah disetujui secara final oleh Director (READY_FOR_KICKOFF). Silakan lakukan Formal Kick-Off untuk memulai eksekusi proyek.`,
          actionTarget: `/project-delivery?projectId=${projectId}`,
          recipientIds: [pmUserId],
          metaData: {
            category: 'PROJECT',
            priority: 'HIGH',
            reference_type: 'PROJECT',
            reference_id: projectId,
            projectId,
            projectName: safeProjectName,
            instanceId: payload.instanceId || event.aggregateId,
            reviewStatus: 'READY_FOR_KICKOFF',
            actionType: 'MANAGEMENT_REVIEW_APPROVED',
          },
        },
      );
    }

    // Unrecognized workflow
    return [];
  }

  private async resolveProjectContext(projectId: number): Promise<{
    found: boolean;
    projectName?: string;
    projectCode?: string;
    managerId: number | null;
    isManagerActive: boolean;
    reviewStatus?: string;
  }> {
    if (!this.dataSource || !projectId || isNaN(projectId) || projectId <= 0) {
      return { found: false, managerId: null, isManagerActive: false };
    }
    try {
      const rows = await this.dataSource.query(
        `SELECT p.id, p.name, p.code, p.manager_id,
                u.id AS user_id, u.is_active, u.deleted_at AS user_deleted_at,
                pmr.status AS review_status
         FROM projects p
         LEFT JOIN users u ON u.id = p.manager_id
         LEFT JOIN project_management_reviews pmr ON pmr.project_id = p.id AND pmr.deleted_at IS NULL
         WHERE p.id = ?
           AND p.deleted_at IS NULL
         LIMIT 1`,
        [projectId],
      );
      if (!rows || rows.length === 0) {
        return { found: false, managerId: null, isManagerActive: false };
      }
      const row = rows[0];
      const rawManagerId = row.manager_id ?? row.managerId;
      const managerId = rawManagerId && Number(rawManagerId) > 0 ? Number(rawManagerId) : null;
      const isManagerActive = Boolean(
        managerId &&
          row.is_active !== 0 &&
          row.is_active !== false &&
          !row.user_deleted_at &&
          (row.user_id === undefined || row.user_id !== null),
      );
      return {
        found: true,
        projectName: row.name || undefined,
        projectCode: row.code || undefined,
        managerId,
        isManagerActive,
        reviewStatus: row.review_status ?? row.reviewStatus ?? undefined,
      };
    } catch (err: any) {
      this.logger.error(
        `[CanonicalNotificationConsumer] Failed to resolve project context for Project #${projectId}: ${err.message}`,
      );
      return { found: false, managerId: null, isManagerActive: false };
    }
  }

  private async resolveAuthoritativeProjectPm(projectCtx: {
    found: boolean;
    managerId: number | null;
    isManagerActive: boolean;
  }): Promise<number | null> {
    if (!projectCtx.found || !projectCtx.managerId || !projectCtx.isManagerActive) {
      return null;
    }
    return projectCtx.managerId;
  }

  private async resolveWorkflowInstanceContext(instanceId: number): Promise<{
    found: boolean;
    workflowKey?: string;
    entityType?: string;
    entityId?: number;
    currentNodeId?: string;
  }> {
    if (!this.dataSource || !instanceId || isNaN(instanceId) || instanceId <= 0) {
      return { found: false };
    }
    try {
      const rows = await this.dataSource.query(
        `SELECT wi.id, wi.entity_type, wi.entity_id, wi.current_node_id, wd.workflow_key
         FROM workflow_instances wi
         JOIN workflow_definitions wd ON wd.id = wi.workflow_definition_id
         WHERE wi.id = ?
         LIMIT 1`,
        [instanceId],
      );
      if (!rows || rows.length === 0) {
        return { found: false };
      }
      const row = rows[0];
      return {
        found: true,
        workflowKey: row.workflow_key ? String(row.workflow_key).trim() : undefined,
        entityType: row.entity_type ? String(row.entity_type).trim() : undefined,
        entityId: row.entity_id ? Number(row.entity_id) : undefined,
        currentNodeId: row.current_node_id ? String(row.current_node_id).trim() : undefined,
      };
    } catch (err: any) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] Failed to resolve workflow instance context #${instanceId}: ${err?.message || err}`,
      );
      return { found: false };
    }
  }

  private async verifyManagementReviewWorkflowInstance(instanceId: number): Promise<boolean> {
    if (!this.dataSource || !instanceId || isNaN(instanceId) || instanceId <= 0) {
      return true;
    }
    const ctx = await this.resolveWorkflowInstanceContext(instanceId);
    if (!ctx.found) {
      return true;
    }
    return String(ctx.workflowKey || '').toUpperCase() === 'PROJECT_PLAN_REVIEW_WORKFLOW';
  }

  private async resolvePurchaseRequestContext(prId: number): Promise<{
    found: boolean;
    prNumber?: string;
    projectId?: number;
    requesterId?: number | null;
    createdBy?: number | null;
    status?: string;
  }> {
    if (!this.dataSource || !prId || isNaN(prId) || prId <= 0) {
      return { found: false, requesterId: null, createdBy: null };
    }
    try {
      const rows = await this.dataSource.query(
        `SELECT pr.id, pr.pr_number, pr.project_id, pr.requester_id, pr.created_by, pr.status
         FROM purchase_requests pr
         WHERE pr.id = ?
         LIMIT 1`,
        [prId],
      );
      if (!rows || rows.length === 0) {
        return { found: false, requesterId: null, createdBy: null };
      }
      const row = rows[0];
      return {
        found: true,
        prNumber: row.pr_number ? String(row.pr_number).trim() : undefined,
        projectId: row.project_id ? Number(row.project_id) : undefined,
        requesterId: row.requester_id ? Number(row.requester_id) : null,
        createdBy: row.created_by ? Number(row.created_by) : null,
        status: row.status ? String(row.status).trim() : undefined,
      };
    } catch (err: any) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] Failed to resolve purchase request context #${prId}: ${err?.message || err}`,
      );
      return { found: false, requesterId: null, createdBy: null };
    }
  }

  private async resolvePreviousReviewerUserIds(
    instanceId: number,
    targetNodeId: string,
    targetAction: string = 'APPROVE',
  ): Promise<number[]> {
    const result: number[] = [];
    if (!this.dataSource || !instanceId || isNaN(instanceId) || instanceId <= 0 || !targetNodeId) {
      return result;
    }
    try {
      const rows = await this.dataSource.query(
        `SELECT decided_by
         FROM workflow_tasks
         WHERE workflow_instance_id = ?
           AND node_id = ?
           AND status = 'COMPLETED'
           AND action = ?
         ORDER BY id DESC
         LIMIT 1`,
        [instanceId, targetNodeId, targetAction],
      );
      if (rows && rows.length > 0) {
        const userId = Number(rows[0].decided_by || 0);
        if (userId > 0) {
          const isActive = await this.verifyActiveUserOrUnconfigured(userId);
          if (isActive) {
            result.push(userId);
          } else {
            this.logger.warn(
              `[CanonicalNotificationConsumer] Previous reviewer user #${userId} for node '${targetNodeId}' (action '${targetAction}') on instance #${instanceId} is inactive/deleted. Recipient unresolved.`,
            );
          }
        } else {
          this.logger.warn(
            `[CanonicalNotificationConsumer] No valid decided_by user ID found in task for node '${targetNodeId}' (action '${targetAction}') on instance #${instanceId}. Recipient unresolved.`,
          );
        }
      } else {
        this.logger.warn(
          `[CanonicalNotificationConsumer] Zero completed tasks with action '${targetAction}' found for node '${targetNodeId}' on instance #${instanceId}. Reviewer recipient unresolved.`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `[CanonicalNotificationConsumer] Failed resolving previous reviewer for instance ${instanceId}: ${err?.message || err}`,
      );
    }
    return [...new Set(result)];
  }

  private async verifyActiveUserOrUnconfigured(userId: number): Promise<boolean> {
    if (!userId || isNaN(userId) || userId <= 0) return false;
    if (!this.dataSource) return true;
    try {
      const rows = await this.dataSource.query(
        `SELECT id, is_active, deleted_at
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId],
      );
      if (!rows || rows.length === 0) {
        return true;
      }
      const row = rows[0];
      if (row.deleted_at || row.is_active === 0 || row.is_active === false) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async verifyActiveUser(userId: number): Promise<boolean> {
    if (!this.dataSource || !userId || isNaN(userId) || userId <= 0) return false;
    try {
      const rows = await this.dataSource.query(
        `SELECT id
         FROM users
         WHERE id = ?
           AND (is_active = 1 OR is_active = true)
           AND deleted_at IS NULL
         LIMIT 1`,
        [userId],
      );
      return Boolean(rows && rows.length > 0);
    } catch (err: any) {
      this.logger.error(`[CanonicalNotificationConsumer] Failed to verify active user #${userId}: ${err.message}`);
      return false;
    }
  }

  private async resolveInvoiceCreator(invoiceId: number): Promise<number | null> {
    if (!this.dataSource || !invoiceId) return null;
    try {
      const rows = await this.dataSource.query(
        `SELECT created_by
         FROM invoices
         WHERE id = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        [invoiceId],
      );
      if (rows && rows.length > 0) {
        const creatorId = rows[0].created_by ?? rows[0].createdBy;
        if (creatorId) return Number(creatorId);
      }
      return null;
    } catch (err: any) {
      this.logger.error(`[CanonicalNotificationConsumer] Failed to resolve creator for Invoice #${invoiceId}: ${err.message}`);
      return null;
    }
  }

  private async resolvePackageRequesterOrPm(packageId: number, projectId?: number): Promise<number | null> {
    if (!this.dataSource || !packageId) return null;
    try {
      const rows = await this.dataSource.query(
        `SELECT pkg.requested_by, pkg.project_id, p.manager_id
         FROM procurement_packages pkg
         LEFT JOIN projects p ON p.id = pkg.project_id AND p.deleted_at IS NULL
         WHERE pkg.id = ?
           AND pkg.deleted_at IS NULL
         LIMIT 1`,
        [packageId],
      );
      if (rows && rows.length > 0) {
        const row = rows[0];
        const requestedBy = row.requested_by ? Number(row.requested_by) : (row.requestedBy ? Number(row.requestedBy) : null);
        if (requestedBy && (await this.verifyActiveUser(requestedBy))) {
          return requestedBy;
        }
        const managerId = row.manager_id ? Number(row.manager_id) : (row.managerId ? Number(row.managerId) : null);
        if (managerId && (await this.verifyActiveUser(managerId))) {
          return managerId;
        }
      }
      if (projectId) {
        const pmId = await this.resolvePmUserIdFromProject(projectId);
        if (pmId && (await this.verifyActiveUser(pmId))) {
          return pmId;
        }
      }
      return null;
    } catch (err: any) {
      this.logger.error(`[CanonicalNotificationConsumer] Failed to resolve PM/requester for Package #${packageId}: ${err.message}`);
      return null;
    }
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

  private async resolvePurchaseOrderContext(poId: number): Promise<{
    found: boolean;
    poNumber?: string;
    prId?: number;
    projectId?: number;
    requesterId?: number | null;
    managerId?: number | null;
  }> {
    if (!this.dataSource || !poId || isNaN(poId) || poId <= 0) {
      return { found: false };
    }
    try {
      const rows = await this.dataSource.query(
        `SELECT po.id, po.po_number, po.pr_id, pr.project_id, pr.requester_id, p.manager_id
         FROM purchase_orders po
         LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
         LEFT JOIN projects p ON p.id = pr.project_id AND p.deleted_at IS NULL
         WHERE po.id = ?
           AND po.deleted_at IS NULL
         LIMIT 1`,
        [poId],
      );
      if (!rows || rows.length === 0) {
        return { found: false };
      }
      const row = rows[0];
      return {
        found: true,
        poNumber: row.po_number ? String(row.po_number).trim() : undefined,
        prId: row.pr_id ? Number(row.pr_id) : undefined,
        projectId: row.project_id ? Number(row.project_id) : undefined,
        requesterId: row.requester_id ? Number(row.requester_id) : null,
        managerId: row.manager_id ? Number(row.manager_id) : null,
      };
    } catch (err: any) {
      this.logger.warn(`[CanonicalNotificationConsumer] Failed to resolve PO context #${poId}: ${err?.message || err}`);
      return { found: false };
    }
  }

  private async resolvePmUserIdFromProject(projectId: number): Promise<number | null> {
    if (!this.dataSource || !projectId) return null;
    try {
      const rows = await this.dataSource.query(
        `SELECT manager_id
         FROM projects
         WHERE id = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        [projectId],
      );
      if (rows && rows.length > 0) {
        const mgrId = rows[0].manager_id ?? rows[0].managerId;
        if (mgrId) return Number(mgrId);
      }
      return null;
    } catch (err: any) {
      this.logger.error(`[CanonicalNotificationConsumer] Failed to resolve PM for Project #${projectId}: ${err.message}`);
      return null;
    }
  }

  private async resolveClaimContext(
    claimId: number,
  ): Promise<{ poId: number | null; projectId: number | null; submittedBy: number | null } | null> {
    if (!this.dataSource || !claimId) return null;
    try {
      const rows = await this.dataSource.query(
        `SELECT po_id, project_id, submitted_by
         FROM service_claims
         WHERE id = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        [claimId],
      );
      if (rows && rows.length > 0) {
        return {
          poId: rows[0].po_id ? Number(rows[0].po_id) : null,
          projectId: rows[0].project_id ? Number(rows[0].project_id) : null,
          submittedBy: rows[0].submitted_by ? Number(rows[0].submitted_by) : null,
        };
      }
      return null;
    } catch (err: any) {
      this.logger.error(`[CanonicalNotificationConsumer] Failed to resolve context for Claim #${claimId}: ${err.message}`);
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

  private async resolvePaymentRequestRequester(prqId: number): Promise<number | null> {
    if (!this.dataSource || !prqId || isNaN(prqId) || prqId <= 0) return null;
    try {
      const rows = await this.dataSource.query(
        `SELECT requested_by FROM payment_requests WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [prqId],
      );
      if (rows && rows.length > 0 && rows[0].requested_by) {
        return Number(rows[0].requested_by);
      }
      return null;
    } catch (err: any) {
      this.logger.error(
        `[CanonicalNotificationConsumer] Failed to resolve requester for Payment Request #${prqId}: ${err.message}`,
      );
      return null;
    }
  }

  private async resolveIssueContext(issueId: number): Promise<{
    found: boolean;
    issueNumber?: string;
    projectId?: number;
    ownerId?: number;
    reportedById?: number;
    severity?: string;
  }> {
    if (!this.dataSource || !issueId || isNaN(issueId) || issueId <= 0) {
      return { found: false };
    }
    try {
      const rows = await this.dataSource.query(
        `SELECT id, issue_number, project_id, owner_id, reported_by_id, severity
         FROM project_issues
         WHERE id = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        [issueId],
      );
      if (!rows || rows.length === 0) {
        return { found: false };
      }
      const row = rows[0];
      return {
        found: true,
        issueNumber: row.issue_number ?? row.issueNumber ?? undefined,
        projectId: row.project_id
          ? Number(row.project_id)
          : row.projectId
            ? Number(row.projectId)
            : undefined,
        ownerId: row.owner_id
          ? Number(row.owner_id)
          : row.ownerId
            ? Number(row.ownerId)
            : undefined,
        reportedById: row.reported_by_id
          ? Number(row.reported_by_id)
          : row.reportedById
            ? Number(row.reportedById)
            : undefined,
        severity: row.severity ? String(row.severity).toUpperCase() : undefined,
      };
    } catch (err: any) {
      this.logger.error(
        `[CanonicalNotificationConsumer] Failed to resolve issue context for Issue #${issueId}: ${err.message}`,
      );
      return { found: false };
    }
  }

  // =========================================================================
  // PHASE F-CRIT-01: PROJECT ISSUE & PROJECT RISK CANONICAL HANDLERS
  // =========================================================================

  @OnEvent('project.issue.created')
  async handleProjectIssueCreated(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on project.issue.created');
    }

    const issueId = event.payload?.issueId || event.aggregateId;
    let issueNumber = event.payload?.issueNumber;
    let projectId = Number(event.projectId ?? event.payload?.projectId ?? 0) || undefined;
    let severity = String(event.payload?.severity || '').toUpperCase();
    let ownerId = Number(event.payload?.ownerId || 0);
    const actorId = Number(
      event.actor?.userId ?? event.payload?.actorId ?? event.payload?.reportedById ?? 0,
    );

    if ((!ownerId || !projectId || !issueNumber || !severity) && issueId) {
      const dbCtx = await this.resolveIssueContext(Number(issueId));
      if (dbCtx.found) {
        if (!issueNumber) issueNumber = dbCtx.issueNumber;
        if (!projectId) projectId = dbCtx.projectId;
        if (!ownerId && dbCtx.ownerId) ownerId = dbCtx.ownerId;
        if (!severity && dbCtx.severity) severity = dbCtx.severity;
      }
    }
    if (!issueNumber) issueNumber = `ISS-${issueId}`;
    if (!severity) severity = 'MEDIUM';

    const recipientSet = new Set<number>();
    if (ownerId > 0) recipientSet.add(ownerId);
    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }

    if (severity === 'CRITICAL') {
      if (projectId) {
        const pmId = await this.resolvePmUserIdFromProject(projectId);
        if (pmId && pmId > 0) recipientSet.add(pmId);
      }
      const opsIds = await this.resolveRoleUserIds(['HEAD_OF_OPERATIONS', 'PMO']);
      for (const uid of opsIds) {
        if (uid > 0) recipientSet.add(uid);
      }
    }

    if (actorId > 0) {
      recipientSet.delete(actorId);
    }

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored(
        'No distinct actionable recipient for project.issue.created (self-owned non-critical issue)',
      );
    }

    return this.projectEventToNotifications(event, {
      purpose: severity === 'CRITICAL' ? 'PROJECT_ISSUE_CRITICAL_CREATED' : 'PROJECT_ISSUE_CREATED',
      type: 'ALERT',
      title: severity === 'CRITICAL' ? 'Isu Proyek Kritis Baru' : 'Penugasan Isu Proyek Baru',
      message: `Isu proyek ${issueNumber} (${severity}) telah dibuat dan memerlukan tindak lanjut.`,
      actionTarget:
        projectId && issueId
          ? `/project-delivery?view=workspace&projectId=${projectId}&section=issue-risk&type=issue&id=${issueId}`
          : projectId
            ? `/project-delivery?projectId=${projectId}`
            : '/project-delivery',
      recipientIds,
      metaData: {
        category: 'PROJECT_ISSUE',
        priority: severity === 'CRITICAL' ? 'HIGH' : 'NORMAL',
        reference_type: 'PROJECT_ISSUE',
        reference_id: issueId,
        issueId,
        issueNumber,
        projectId,
        severity,
        actionType: 'ISSUE_CREATED',
      },
    });
  }

  @OnEvent('project.issue.assigned')
  async handleProjectIssueAssigned(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on project.issue.assigned');
    }

    const issueId = event.payload?.issueId || event.aggregateId;
    let issueNumber = event.payload?.issueNumber;
    let projectId = Number(event.projectId ?? event.payload?.projectId ?? 0) || undefined;
    const newOwnerId = Number(event.payload?.newOwnerId ?? event.payload?.ownerId ?? 0);
    const actorId = Number(event.actor?.userId ?? event.payload?.actorId ?? 0);

    if ((!issueNumber || !projectId) && issueId) {
      const dbCtx = await this.resolveIssueContext(Number(issueId));
      if (dbCtx.found) {
        if (!issueNumber) issueNumber = dbCtx.issueNumber;
        if (!projectId) projectId = dbCtx.projectId;
      }
    }
    if (!issueNumber) issueNumber = `ISS-${issueId}`;

    if (!newOwnerId || newOwnerId <= 0 || newOwnerId === actorId) {
      return this.markIntentionallyIgnored('Issue assigned to actor self or missing newOwnerId');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROJECT_ISSUE_ASSIGNED',
      type: 'ALERT',
      title: 'Penugasan PIC Isu Proyek',
      message: `Anda ditugaskan sebagai PIC untuk isu proyek ${issueNumber}.`,
      actionTarget:
        projectId && issueId
          ? `/project-delivery?view=workspace&projectId=${projectId}&section=issue-risk&type=issue&id=${issueId}`
          : projectId
            ? `/project-delivery?projectId=${projectId}`
            : '/project-delivery',
      recipientIds: [newOwnerId],
      metaData: {
        category: 'PROJECT_ISSUE',
        priority: 'HIGH',
        reference_type: 'PROJECT_ISSUE',
        reference_id: issueId,
        issueId,
        issueNumber,
        projectId,
        actionType: 'ISSUE_ASSIGNED',
      },
    });
  }

  @OnEvent('project.issue.escalated')
  async handleProjectIssueEscalated(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on project.issue.escalated');
    }

    const issueId = event.payload?.issueId || event.aggregateId;
    let issueNumber = event.payload?.issueNumber;
    let projectId = Number(event.projectId ?? event.payload?.projectId ?? 0) || undefined;
    let ownerId = Number(event.payload?.ownerId || 0);
    const actorId = Number(event.actor?.userId ?? event.payload?.actorId ?? 0);

    if ((!ownerId || !issueNumber || !projectId) && issueId) {
      const dbCtx = await this.resolveIssueContext(Number(issueId));
      if (dbCtx.found) {
        if (!issueNumber) issueNumber = dbCtx.issueNumber;
        if (!projectId) projectId = dbCtx.projectId;
        if (!ownerId && dbCtx.ownerId) ownerId = dbCtx.ownerId;
      }
    }
    if (!issueNumber) issueNumber = `ISS-${issueId}`;

    const recipientSet = new Set<number>();
    if (ownerId > 0) recipientSet.add(ownerId);
    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }
    if (projectId) {
      const pmId = await this.resolvePmUserIdFromProject(projectId);
      if (pmId && pmId > 0) recipientSet.add(pmId);
    }
    const opsIds = await this.resolveRoleUserIds(['HEAD_OF_OPERATIONS', 'PMO']);
    for (const uid of opsIds) {
      if (uid > 0) recipientSet.add(uid);
    }
    if (actorId > 0) recipientSet.delete(actorId);

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No distinct recipient for project.issue.escalated');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROJECT_ISSUE_ESCALATED',
      type: 'ALERT',
      title: 'Eskalasi Isu Proyek',
      message: `Isu proyek ${issueNumber} telah dieskalasi untuk perhatian manajemen.`,
      actionTarget:
        projectId && issueId
          ? `/project-delivery?view=workspace&projectId=${projectId}&section=issue-risk&type=issue&id=${issueId}`
          : projectId
            ? `/project-delivery?projectId=${projectId}`
            : '/project-delivery',
      recipientIds,
      metaData: {
        category: 'PROJECT_ISSUE',
        priority: 'HIGH',
        reference_type: 'PROJECT_ISSUE',
        reference_id: issueId,
        issueId,
        issueNumber,
        projectId,
        actionType: 'ISSUE_ESCALATED',
      },
    });
  }

  @OnEvent('project.issue.resolved')
  async handleProjectIssueResolved(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on project.issue.resolved');
    }

    const issueId = event.payload?.issueId || event.aggregateId;
    let issueNumber = event.payload?.issueNumber;
    let projectId = Number(event.projectId ?? event.payload?.projectId ?? 0) || undefined;
    let reportedById = Number(event.payload?.reportedById || 0);
    const actorId = Number(
      event.actor?.userId ?? event.payload?.resolvedBy ?? event.payload?.actorId ?? 0,
    );

    if ((!reportedById || !issueNumber || !projectId) && issueId) {
      const dbCtx = await this.resolveIssueContext(Number(issueId));
      if (dbCtx.found) {
        if (!issueNumber) issueNumber = dbCtx.issueNumber;
        if (!projectId) projectId = dbCtx.projectId;
        if (!reportedById && dbCtx.reportedById) reportedById = dbCtx.reportedById;
      }
    }
    if (!issueNumber) issueNumber = `ISS-${issueId}`;

    const recipientSet = new Set<number>();
    if (reportedById > 0) recipientSet.add(reportedById);
    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }
    if (projectId) {
      const pmId = await this.resolvePmUserIdFromProject(projectId);
      if (pmId && pmId > 0) recipientSet.add(pmId);
    }
    if (actorId > 0) recipientSet.delete(actorId);

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No distinct recipient for project.issue.resolved');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROJECT_ISSUE_RESOLVED',
      type: 'INFO',
      title: 'Isu Proyek Diselesaikan (Resolved)',
      message: `Isu proyek ${issueNumber} telah ditandai selesai (Resolved) dan siap diverifikasi/ditutup.`,
      actionTarget:
        projectId && issueId
          ? `/project-delivery?view=workspace&projectId=${projectId}&section=issue-risk&type=issue&id=${issueId}`
          : projectId
            ? `/project-delivery?projectId=${projectId}`
            : '/project-delivery',
      recipientIds,
      metaData: {
        category: 'PROJECT_ISSUE',
        priority: 'NORMAL',
        reference_type: 'PROJECT_ISSUE',
        reference_id: issueId,
        issueId,
        issueNumber,
        projectId,
        actionType: 'ISSUE_RESOLVED',
      },
    });
  }

  @OnEvent('project.issue.closed')
  async handleProjectIssueClosed(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on project.issue.closed');
    }

    const issueId = event.payload?.issueId || event.aggregateId;
    let issueNumber = event.payload?.issueNumber;
    let projectId = Number(event.projectId ?? event.payload?.projectId ?? 0) || undefined;
    let ownerId = Number(event.payload?.ownerId || 0);
    let reportedById = Number(event.payload?.reportedById || 0);
    const actorId = Number(
      event.actor?.userId ?? event.payload?.closedBy ?? event.payload?.actorId ?? 0,
    );

    if ((!ownerId || !reportedById || !issueNumber || !projectId) && issueId) {
      const dbCtx = await this.resolveIssueContext(Number(issueId));
      if (dbCtx.found) {
        if (!issueNumber) issueNumber = dbCtx.issueNumber;
        if (!projectId) projectId = dbCtx.projectId;
        if (!ownerId && dbCtx.ownerId) ownerId = dbCtx.ownerId;
        if (!reportedById && dbCtx.reportedById) reportedById = dbCtx.reportedById;
      }
    }
    if (!issueNumber) issueNumber = `ISS-${issueId}`;

    const recipientSet = new Set<number>();
    if (ownerId > 0) recipientSet.add(ownerId);
    if (reportedById > 0) recipientSet.add(reportedById);
    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }
    if (actorId > 0) recipientSet.delete(actorId);

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No distinct recipient for project.issue.closed');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROJECT_ISSUE_CLOSED',
      type: 'SYSTEM',
      title: 'Isu Proyek Ditutup (Closed)',
      message: `Isu proyek ${issueNumber} telah resmi ditutup (Closed).`,
      actionTarget:
        projectId && issueId
          ? `/project-delivery?view=workspace&projectId=${projectId}&section=issue-risk&type=issue&id=${issueId}`
          : projectId
            ? `/project-delivery?projectId=${projectId}`
            : '/project-delivery',
      recipientIds,
      metaData: {
        category: 'PROJECT_ISSUE',
        priority: 'NORMAL',
        reference_type: 'PROJECT_ISSUE',
        reference_id: issueId,
        issueId,
        issueNumber,
        projectId,
        actionType: 'ISSUE_CLOSED',
      },
    });
  }

  @OnEvent('project.issue.reopened')
  async handleProjectIssueReopened(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on project.issue.reopened');
    }

    const issueId = event.payload?.issueId || event.aggregateId;
    let issueNumber = event.payload?.issueNumber;
    let projectId = Number(event.projectId ?? event.payload?.projectId ?? 0) || undefined;
    let ownerId = Number(event.payload?.ownerId || 0);
    const reason = event.payload?.reason || 'Memerlukan tindak lanjut ulang.';
    const actorId = Number(
      event.actor?.userId ?? event.payload?.reopenedBy ?? event.payload?.actorId ?? 0,
    );

    if ((!ownerId || !issueNumber || !projectId) && issueId) {
      const dbCtx = await this.resolveIssueContext(Number(issueId));
      if (dbCtx.found) {
        if (!issueNumber) issueNumber = dbCtx.issueNumber;
        if (!projectId) projectId = dbCtx.projectId;
        if (!ownerId && dbCtx.ownerId) ownerId = dbCtx.ownerId;
      }
    }
    if (!issueNumber) issueNumber = `ISS-${issueId}`;

    const recipientSet = new Set<number>();
    if (ownerId > 0) recipientSet.add(ownerId);
    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }
    if (projectId) {
      const pmId = await this.resolvePmUserIdFromProject(projectId);
      if (pmId && pmId > 0) recipientSet.add(pmId);
    }
    if (actorId > 0) recipientSet.delete(actorId);

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No distinct recipient for project.issue.reopened');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROJECT_ISSUE_REOPENED',
      type: 'ALERT',
      title: 'Isu Proyek Dibuka Kembali (Reopened)',
      message: `Isu proyek ${issueNumber} dibuka kembali. Alasan: ${reason}`,
      actionTarget:
        projectId && issueId
          ? `/project-delivery?view=workspace&projectId=${projectId}&section=issue-risk&type=issue&id=${issueId}`
          : projectId
            ? `/project-delivery?projectId=${projectId}`
            : '/project-delivery',
      recipientIds,
      metaData: {
        category: 'PROJECT_ISSUE',
        priority: 'HIGH',
        reference_type: 'PROJECT_ISSUE',
        reference_id: issueId,
        issueId,
        issueNumber,
        projectId,
        reason,
        actionType: 'ISSUE_REOPENED',
      },
    });
  }

  @OnEvent('project.issue.started')
  @OnEvent('project.issue.cancelled')
  @OnEvent('project.issue.updated')
  @OnEvent('project.issue.status_changed')
  async handleProjectIssueRoutineSyncOnly(
    event: BusinessEvent<any>,
  ): Promise<CanonicalNotificationResult[]> {
    return this.markIntentionallyIgnored(
      `Routine project issue lifecycle event '${event?.eventName}' is sync-only by canonical policy`,
    );
  }

  @OnEvent('project.risk.critical_detected')
  @OnEvent('project.risk.escalated')
  async handleProjectRiskCriticalDetected(
    event: BusinessEvent<any>,
  ): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on project.risk.critical_detected');
    }

    const riskId = event.payload?.riskId || event.aggregateId;
    const riskNumber = event.payload?.riskNumber || `RSK-${riskId}`;
    const projectId = Number(event.projectId ?? event.payload?.projectId ?? 0) || undefined;
    const ownerId = Number(event.payload?.ownerId || 0);
    const riskScore = event.payload?.riskScore ?? '-';
    const actorId = Number(event.actor?.userId ?? event.payload?.actorId ?? 0);

    const recipientSet = new Set<number>();
    if (ownerId > 0) recipientSet.add(ownerId);
    if (Array.isArray(event.routing?.userIds)) {
      for (const uid of event.routing.userIds) {
        if (Number(uid) > 0) recipientSet.add(Number(uid));
      }
    }
    if (projectId) {
      const pmId = await this.resolvePmUserIdFromProject(projectId);
      if (pmId && pmId > 0) recipientSet.add(pmId);
    }
    const opsIds = await this.resolveRoleUserIds(['HEAD_OF_OPERATIONS', 'PMO']);
    for (const uid of opsIds) {
      if (uid > 0) recipientSet.add(uid);
    }
    if (actorId > 0) recipientSet.delete(actorId);

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return this.markIntentionallyIgnored('No distinct recipient for critical/escalated project risk');
    }

    const isEscalated = event.eventName === 'project.risk.escalated';
    return this.projectEventToNotifications(event, {
      purpose: isEscalated ? 'PROJECT_RISK_ESCALATED' : 'PROJECT_RISK_CRITICAL_DETECTED',
      type: 'ALERT',
      title: isEscalated ? 'Eskalasi Risiko Proyek' : 'Risiko Proyek Kritis Terdeteksi',
      message: `Risiko proyek kritis ${riskNumber} (Skor: ${riskScore}) memerlukan perhatian dan mitigasi segera.`,
      actionTarget:
        projectId && riskId
          ? `/project-delivery?view=workspace&projectId=${projectId}&section=issue-risk&type=risk&id=${riskId}`
          : projectId
            ? `/project-delivery?projectId=${projectId}`
            : '/project-delivery',
      recipientIds,
      metaData: {
        category: 'PROJECT_RISK',
        priority: 'HIGH',
        reference_type: 'PROJECT_RISK',
        reference_id: riskId,
        riskId,
        riskNumber,
        projectId,
        riskScore,
        riskLevel: event.payload?.riskLevel || 'CRITICAL',
        actionType: isEscalated ? 'RISK_ESCALATED' : 'RISK_CRITICAL_DETECTED',
      },
    });
  }

  @OnEvent('project.risk.assigned')
  async handleProjectRiskAssigned(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on project.risk.assigned');
    }

    const riskId = event.payload?.riskId || event.aggregateId;
    const riskNumber = event.payload?.riskNumber || `RSK-${riskId}`;
    const projectId = Number(event.projectId ?? event.payload?.projectId ?? 0) || undefined;
    const newOwnerId = Number(event.payload?.newOwnerId ?? event.payload?.ownerId ?? 0);
    const actorId = Number(event.actor?.userId ?? event.payload?.actorId ?? 0);

    if (!newOwnerId || newOwnerId <= 0 || newOwnerId === actorId) {
      return this.markIntentionallyIgnored('Risk assigned to actor self or missing newOwnerId');
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROJECT_RISK_ASSIGNED',
      type: 'ALERT',
      title: 'Penugasan PIC Risiko Proyek',
      message: `Anda ditugaskan sebagai PIC mitigasi untuk risiko proyek ${riskNumber}.`,
      actionTarget:
        projectId && riskId
          ? `/project-delivery?view=workspace&projectId=${projectId}&section=issue-risk&type=risk&id=${riskId}`
          : projectId
            ? `/project-delivery?projectId=${projectId}`
            : '/project-delivery',
      recipientIds: [newOwnerId],
      metaData: {
        category: 'PROJECT_RISK',
        priority: 'HIGH',
        reference_type: 'PROJECT_RISK',
        reference_id: riskId,
        riskId,
        riskNumber,
        projectId,
        actionType: 'RISK_ASSIGNED',
      },
    });
  }

  @OnEvent('project.risk.created')
  async handleProjectRiskCreated(event: BusinessEvent<any>): Promise<CanonicalNotificationResult[]> {
    if (!event || typeof event !== 'object' || !event.eventId) {
      return this.markIntentionallyIgnored('Missing canonical eventId on project.risk.created');
    }

    const riskLevel = String(event.payload?.riskLevel || '').toUpperCase();
    if (riskLevel === 'CRITICAL') {
      // ProjectRiskService.createRisk emits project.risk.critical_detected in the same transaction
      return this.markIntentionallyIgnored(
        'Critical risk creation is notified via dedicated project.risk.critical_detected event',
      );
    }

    const riskId = event.payload?.riskId || event.aggregateId;
    const riskNumber = event.payload?.riskNumber || `RSK-${riskId}`;
    const projectId = Number(event.projectId ?? event.payload?.projectId ?? 0) || undefined;
    const ownerId = Number(event.payload?.ownerId || 0);
    const actorId = Number(
      event.actor?.userId ?? event.payload?.actorId ?? event.payload?.identifiedById ?? 0,
    );

    if (!ownerId || ownerId <= 0 || ownerId === actorId) {
      return this.markIntentionallyIgnored(
        'Non-critical project risk created by owner self; sync-only by canonical policy',
      );
    }

    return this.projectEventToNotifications(event, {
      purpose: 'PROJECT_RISK_CREATED',
      type: 'INFO',
      title: 'Penugasan Risiko Proyek Baru',
      message: `Risiko proyek ${riskNumber} (${riskLevel || 'NORMAL'}) telah diidentifikasi dan ditugaskan kepada Anda.`,
      actionTarget:
        projectId && riskId
          ? `/project-delivery?view=workspace&projectId=${projectId}&section=issue-risk&type=risk&id=${riskId}`
          : projectId
            ? `/project-delivery?projectId=${projectId}`
            : '/project-delivery',
      recipientIds: [ownerId],
      metaData: {
        category: 'PROJECT_RISK',
        priority: 'NORMAL',
        reference_type: 'PROJECT_RISK',
        reference_id: riskId,
        riskId,
        riskNumber,
        projectId,
        riskLevel,
        actionType: 'RISK_CREATED',
      },
    });
  }

  @OnEvent('project.risk.assessed')
  @OnEvent('project.risk.materialized')
  @OnEvent('project.risk.closed')
  @OnEvent('project.risk.cancelled')
  @OnEvent('project.risk.updated')
  @OnEvent('project.risk.mitigation_updated')
  @OnEvent('project.risk.status_changed')
  @OnEvent('project.risk.reopened')
  async handleProjectRiskRoutineSyncOnly(
    event: BusinessEvent<any>,
  ): Promise<CanonicalNotificationResult[]> {
    return this.markIntentionallyIgnored(
      `Routine project risk lifecycle event '${event?.eventName}' is sync-only by canonical policy`,
    );
  }

  private markDelivered(
    results: CanonicalNotificationResult[],
    reason?: string,
  ): CanonicalNotificationResult[] {
    return attachOutboxReceipt(results, {
      __outboxContract: true,
      channel: 'CANONICAL_NOTIFICATION',
      outcome:
        results.length > 0
          ? OutboxDeliveryOutcome.DELIVERED
          : OutboxDeliveryOutcome.INTENTIONALLY_IGNORED,
      deliveredCount: results.length,
      reason:
        reason ||
        (results.length > 0
          ? undefined
          : 'Zero actionable recipients after canonical filtering'),
    });
  }

  private markIntentionallyIgnored(reason: string): CanonicalNotificationResult[] {
    return attachOutboxReceipt([], {
      __outboxContract: true,
      channel: 'CANONICAL_NOTIFICATION',
      outcome: OutboxDeliveryOutcome.INTENTIONALLY_IGNORED,
      deliveredCount: 0,
      reason,
    });
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
      return this.markIntentionallyIgnored('notificationPolicy is SYNC_ONLY');
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
      return this.markIntentionallyIgnored(
        `Zero explicit recipients resolved for event '${event.eventName}'`,
      );
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

    const persisted = await this.writer.persistBatch(inputs);
    return this.markDelivered(persisted);
  }
}
