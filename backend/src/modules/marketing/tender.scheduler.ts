import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, EntityManager, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { Tender, TenderStatus, TenderStage } from '../../entities/tender.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { emitLegalQueueUpdated } from '../../shared/helpers/legal-event.helper';
import {
  evaluateMarketingActionItem,
  MarketingActionConditionType,
} from './marketing-action-item.predicate';
import {
  toJakartaDateString,
  diffInJakartaCalendarDays,
  calculateInactivityReferenceDate,
} from './tender-followup.helper';

@Injectable()
export class TenderScheduler {
  private readonly logger = new Logger(TenderScheduler.name);

  constructor(
    @InjectRepository(Tender)
    private readonly tenderRepo: Repository<Tender>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  private getDataSource(): DataSource {
    return this.dataSource || (this.tenderRepo.manager.connection as DataSource);
  }

  /**
   * Helper: Save canonical BusinessEvent to transactional Outbox
   */
  private async saveOutboxEvent(
    manager: EntityManager,
    event: BusinessEvent<any>,
  ): Promise<OutboxEvent> {
    const outbox = manager.create(OutboxEvent, {
      event_id: event.eventId,
      event_name: event.eventName,
      event_version: String(event.eventVersion),
      aggregate_type: event.aggregateType,
      aggregate_id: Number(event.aggregateId),
      correlation_id: event.correlationId || null,
      payload: {
        occurredAt: event.occurredAt,
        projectId: event.projectId,
        actor: event.actor,
        routing: event.routing,
        notificationPolicy: event.notificationPolicy,
        businessPayload: event.payload,
      },
      status: OutboxStatus.PENDING,
      retry_count: 0,
    });
    return await manager.save(OutboxEvent, outbox);
  }

  /**
   * Helper: Resolve validated recipients (Marketing PIC + active Directors) deduplicated
   */
  private async resolveTargetRecipients(
    marketingPicId: number | null,
    tenderId: number,
    contextLabel: string,
  ): Promise<number[]> {
    const targetRecipientIds = new Set<number>();

    // 1. Resolve Marketing PIC
    if (!marketingPicId) {
      this.logger.warn(
        `[${contextLabel}] Recipient Marketing PIC invalid for Tender #${tenderId}: marketing_pic_id is missing/null.`
      );
      this.eventEmitter.emit('audit.log', {
        action: 'RECIPIENT_RESOLUTION_FAILED',
        entityId: tenderId,
        entityName: 'tenders',
        reason: `${contextLabel} notification: marketing_pic_id is missing/null for Tender #${tenderId}`,
      });
    } else {
      try {
        const validPicUsers = await this.tenderRepo.manager.query(
          `SELECT u.id
           FROM users u
           JOIN user_roles ur ON u.id = ur.user_id
           JOIN roles r ON r.id = ur.role_id
           WHERE u.id = ?
             AND (u.is_active = 1 OR u.is_active = true)
             AND u.deleted_at IS NULL
             AND r.name = 'MARKETING'
             AND r.deleted_at IS NULL
           LIMIT 1`,
          [marketingPicId]
        );

        if (validPicUsers && validPicUsers.length > 0) {
          targetRecipientIds.add(marketingPicId);
        } else {
          this.logger.warn(
            `[${contextLabel}] Recipient Marketing PIC invalid for Tender #${tenderId}: user #${marketingPicId} is inactive, soft-deleted, or lacks MARKETING role.`
          );
          this.eventEmitter.emit('audit.log', {
            action: 'RECIPIENT_RESOLUTION_FAILED',
            entityId: tenderId,
            entityName: 'tenders',
            reason: `${contextLabel} notification: marketing_pic_id #${marketingPicId} for Tender #${tenderId} is inactive, soft-deleted, or lacks MARKETING role`,
          });
        }
      } catch (err: any) {
        this.logger.error(`[${contextLabel}] Error validating Marketing PIC #${marketingPicId}: ${err?.message}`);
      }
    }

    // 2. Resolve Director Recipients
    try {
      const validDirectors = await this.tenderRepo.manager.query(
        `SELECT DISTINCT u.id
         FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'DIRECTOR'
           AND (u.is_active = 1 OR u.is_active = true)
           AND u.deleted_at IS NULL
           AND r.deleted_at IS NULL`
      );

      if (validDirectors && validDirectors.length > 0) {
        for (const d of validDirectors) {
          targetRecipientIds.add(Number(d.id));
        }
      } else {
        this.logger.warn(
          `[${contextLabel}] No active DIRECTOR users found in database for Tender #${tenderId}.`
        );
        this.eventEmitter.emit('audit.log', {
          action: 'RECIPIENT_RESOLUTION_FAILED',
          entityId: tenderId,
          entityName: 'tenders',
          reason: `${contextLabel} notification: No active DIRECTOR users found for Tender #${tenderId}`,
        });
      }
    } catch (err: any) {
      this.logger.error(`[${contextLabel}] Error resolving DIRECTOR recipients: ${err?.message}`);
    }

    return Array.from(targetRecipientIds);
  }

  // Run every minute
  @Cron('* * * * *')
  async handleGracePeriodAndTimeouts() {
    this.logger.debug('Running TenderScheduler...');
    const now = new Date();

    // 1. Initial SPK Upload Grace Period Demotion (48 Hours SLA)
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

        // Resolve recipients first
        const marketingPicId = tender.marketing_pic_id ? Number(tender.marketing_pic_id) : null;
        const finalRecipientIds = await this.resolveTargetRecipients(
          marketingPicId,
          tender.id,
          'SLA Overdue'
        );

        await this.tenderRepo.manager.transaction(async (manager) => {
          tender.status = TenderStatus.NEGOTIATION;
          tender.stage = TenderStage.NEGOTIATION;
          tender.spk_verification_status = 'SPK_REQUIRED';
          tender.grace_deadline = null; // reset
          tender.spk_file_key = null;
          await manager.save(Tender, tender);

          // Soft delete any orphan contract for this tender without SPK
          const contractRepo = manager.getRepository(Contract);
          const orphanContracts = await contractRepo.find({
            where: { tender_id: tender.id }
          });

          for (const contract of orphanContracts) {
            if (!contract.spk_file_url) {
              await contractRepo.softDelete(contract.id);
              this.logger.warn(`Soft deleted orphan contract #${contract.id} for expired Tender #${tender.id}`);
            }
          }

          // Record in Tender Activity History (for UI "Riwayat Aktivitas")
          await manager.query(
            `INSERT INTO tender_activities (tender_id, user_id, type, content, created_at)
             VALUES (?, NULL, 'SYSTEM', ?, NOW())`,
            [
              tender.id,
              'Tender dikembalikan ke NEGOTIATION karena Grace Period SPK 2x24 jam telah berakhir.',
            ]
          );

          // Phase N8: Transactional Outbox Canonical Event (replaces legacy notification.send)
          if (finalRecipientIds.length > 0) {
            const canonicalEvent: BusinessEvent = {
              eventId: randomUUID(),
              eventName: 'system.sla.spk_grace_expired',
              eventVersion: 1,
              occurredAt: new Date().toISOString(),
              aggregateType: 'Tender',
              aggregateId: tender.id,
              routing: { userIds: finalRecipientIds },
              payload: {
                tenderId: tender.id,
                tenderTitle: tender.title,
                marketingPicId,
                reason: 'SPK_GRACE_PERIOD_EXPIRED',
                previousStatus: TenderStatus.WON,
                currentStatus: TenderStatus.NEGOTIATION,
              },
            };
            await this.saveOutboxEvent(manager, canonicalEvent);
          }
        });

        if (finalRecipientIds.length === 0) {
          this.logger.warn(
            `[SLA Overdue] Notification skipped for Tender #${tender.id}: No valid Marketing PIC or Director recipients found.`
          );
        }

        emitLegalQueueUpdated(this.eventEmitter, {
          action: 'GRACE_EXPIRED',
          tenderId: tender.id
        });

        // Catat mutasi Audit Log
        this.eventEmitter.emit('audit.log', {
          action: 'DEMOTION',
          entityId: tender.id,
          entityName: 'tenders',
          reason: 'Auto-revert: Grace Period Expired. Stage returned to NEGOTIATION. Notifications dispatched to PIC and Director.'
        });

        this.eventEmitter.emit('marketing.tender.management_update', {
          tenderId: tender.id,
          updatedBy: 'Sistem',
          updaterId: null,
          action: 'NEW_ACTIVITY',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 2. Legal Revision SLA Expiry & H-1 Reminder (3 Days / 72 Hours SLA)
    try {
      const revisionContracts = await this.tenderRepo.manager.query(
        `SELECT c.id as contract_id, c.tender_id, c.status as contract_status, c.legal_status, c.grace_deadline, c.updated_at,
                t.id as tender_id, t.status as tender_status, t.stage as tender_stage, t.marketing_pic_id, t.title as tender_title
         FROM contracts c
         JOIN tenders t ON c.tender_id = t.id
         WHERE (c.legal_status = 'REVISION_REQUESTED' OR c.status = 'REVISION_NEEDED')
           AND c.deleted_at IS NULL
           AND t.deleted_at IS NULL`
      );

      for (const row of revisionContracts) {
        const contractId = Number(row.contract_id);
        const tenderId = Number(row.tender_id);
        const marketingPicId = row.marketing_pic_id ? Number(row.marketing_pic_id) : null;

        // NULL Safety: contracts.grace_deadline IS NULL -> Skip record & log warning
        if (!row.grace_deadline) {
          this.logger.warn(
            `[Revision SLA] Skipped Contract #${contractId} (Tender #${tenderId}): contracts.grace_deadline is NULL.`
          );
          continue;
        }

        const revisionDeadline = new Date(row.grace_deadline);
        const h1Threshold = new Date(revisionDeadline.getTime() - 24 * 60 * 60 * 1000); // 24 hours before deadline

        if (now >= revisionDeadline) {
          // --- SLA 3 HARI EXPIRED -> ROLLBACK KE NEGOTIATION ---
          this.logger.warn(
            `[Revision SLA] Legal Revision SLA Expired for Contract #${contractId} (Tender #${tenderId}). Demoting to NEGOTIATION.`
          );

          // Resolve Overdue Recipients (Marketing PIC + Directors deduplicated)
          const overdueRecipientIds = await this.resolveTargetRecipients(
            marketingPicId,
            tenderId,
            'Revision SLA Overdue'
          );

          const tenderTitle = row.tender_title || `Tender #${tenderId}`;

          await this.tenderRepo.manager.transaction(async (manager) => {
            // 1. Mutate Tender
            await manager
              .createQueryBuilder()
              .update(Tender)
              .set({
                status: TenderStatus.NEGOTIATION,
                stage: TenderStage.NEGOTIATION,
                spk_verification_status: 'SPK_REQUIRED',
                grace_deadline: () => 'NULL',
                spk_file_key: () => 'NULL',
              })
              .where('id = :tenderId', { tenderId })
              .execute();

            // 2. Mutate Contract (preserve physical SPK file on disk)
            await manager.query(
              `UPDATE contracts 
               SET status = 'REVISION_EXPIRED', legal_status = 'DRAFT'
               WHERE id = ?`,
              [contractId]
            );

            // 3. Record in Tender Activity History (for UI "Riwayat Aktivitas")
            await manager.query(
              `INSERT INTO tender_activities (tender_id, user_id, type, content, created_at)
               VALUES (?, NULL, 'SYSTEM', ?, NOW())`,
              [
                tenderId,
                'Tender dikembalikan dari WON ke NEGOTIATION karena batas waktu revisi SPK 3 hari telah berakhir.',
              ]
            );

            // 4. Phase N8: Transactional Outbox Canonical Event (replaces legacy notification.send)
            if (overdueRecipientIds.length > 0) {
              const canonicalEvent: BusinessEvent = {
                eventId: randomUUID(),
                eventName: 'system.sla.revision_expired',
                eventVersion: 1,
                occurredAt: new Date().toISOString(),
                aggregateType: 'Contract',
                aggregateId: contractId,
                routing: { userIds: overdueRecipientIds },
                payload: {
                  contractId,
                  tenderId,
                  tenderTitle,
                  marketingPicId,
                  reason: 'LEGAL_REVISION_SLA_EXPIRED',
                  previousStage: 'WON',
                  currentStage: 'NEGOTIATION',
                },
              };
              await this.saveOutboxEvent(manager, canonicalEvent);
            }
          });

          // 5. Emit Legal Queue Update
          emitLegalQueueUpdated(this.eventEmitter, {
            action: 'REVISION_EXPIRED',
            tenderId: tenderId,
            contractId: contractId,
          });

          // 6. Emit Audit Logs
          this.eventEmitter.emit('audit.log', {
            action: 'REVISION_SLA_EXPIRED',
            entityId: contractId,
            entityName: 'contracts',
            reason: 'Legal Revision SLA Expired (3 Days) without updated SPK upload.',
          });

          this.eventEmitter.emit('audit.log', {
            action: 'DEMOTION',
            entityId: tenderId,
            entityName: 'tenders',
            reason: 'Auto-revert: Legal Revision SLA Expired (3 Days). Stage returned to NEGOTIATION.',
          });

          // 7. Emit realtime management update event for Chat-Ops timeline
          this.eventEmitter.emit('marketing.tender.management_update', {
            tenderId: tenderId,
            updatedBy: 'Sistem',
            updaterId: null,
            action: 'NEW_ACTIVITY',
            timestamp: new Date().toISOString(),
          });
        } else if (now >= h1Threshold && now < revisionDeadline) {
          // --- H-1 REMINDER (Kurang dari 24 jam sebelum deadline) ---
          const existingReminder = await this.tenderRepo.manager.query(
            `SELECT id FROM audit_logs 
             WHERE table_name = 'contracts' 
               AND record_id = ? 
               AND action = 'REVISION_DEADLINE_APPROACHING' 
               AND created_at >= ? 
             LIMIT 1`,
            [contractId, row.updated_at]
          );

          if (!existingReminder || existingReminder.length === 0) {
            this.logger.log(
              `[Revision SLA] Dispatching H-1 reminder for Contract #${contractId} (Tender #${tenderId}).`
            );

            const reminderRecipientIds = await this.resolveTargetRecipients(
              marketingPicId,
              tenderId,
              'Revision H-1 Reminder'
            );

            if (reminderRecipientIds.length > 0) {
              const canonicalEvent: BusinessEvent = {
                eventId: randomUUID(),
                eventName: 'system.sla.revision_reminder_h1',
                eventVersion: 1,
                occurredAt: new Date().toISOString(),
                aggregateType: 'Contract',
                aggregateId: contractId,
                routing: { userIds: reminderRecipientIds },
                payload: {
                  contractId,
                  tenderId,
                  tenderTitle: row.tender_title || `Tender #${tenderId}`,
                  marketingPicId,
                  hoursRemaining: 24,
                },
              };
              await this.saveOutboxEvent(this.tenderRepo.manager, canonicalEvent);
            }

            this.eventEmitter.emit('audit.log', {
              action: 'REVISION_DEADLINE_APPROACHING',
              entityId: contractId,
              entityName: 'contracts',
              reason: 'H-1 Revision SLA reminder dispatched: less than 24 hours remaining.',
            });
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`[Revision SLA] Error processing revision SLA expiry: ${err?.message}`);
    }

    // 3. Diskon Timeout (Auto-Escalate)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const pendingTenders = await this.tenderRepo.find({
      where: {
        status: TenderStatus.PENDING_APPROVAL as any,
        updated_at: LessThan(twoHoursAgo)
      }
    });

    for (const tender of pendingTenders) {
      this.logger.warn(`Auto-Escalating Tender ${tender.id} due to 2 hours Approval Timeout.`);

      // Resolve C-Level users
      let cLevelUserIds: number[] = [];
      try {
        const cLevelRows = await this.tenderRepo.manager.query(
          `SELECT DISTINCT u.id
           FROM users u
           JOIN user_roles ur ON u.id = ur.user_id
           JOIN roles r ON r.id = ur.role_id
           WHERE r.name IN ('SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR')
             AND (u.is_active = 1 OR u.is_active = true)
             AND u.deleted_at IS NULL
             AND r.deleted_at IS NULL`
        );
        cLevelUserIds = cLevelRows.map((r: any) => Number(r.id));
      } catch (err: any) {
        this.logger.error(`Error resolving C-Level users: ${err?.message}`);
      }

      await this.tenderRepo.manager.transaction(async (manager) => {
        // Aturan 3: Auto-Escalate, status tetap PENDING_APPROVAL
        tender.updated_at = now;
        await manager.save(Tender, tender);

        // Phase N8: Transactional Outbox Canonical Event (replaces legacy notification.send)
        const canonicalEvent: BusinessEvent = {
          eventId: randomUUID(),
          eventName: 'system.sla.discount_timeout',
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          aggregateType: 'Tender',
          aggregateId: tender.id,
          routing: {
            roles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR'],
            userIds: cLevelUserIds.length > 0 ? cLevelUserIds : undefined,
          },
          payload: {
            tenderId: tender.id,
            tenderTitle: tender.title,
            discountPercentage: tender.max_discount_rate || 20,
            timeoutHours: 2,
          },
        };
        await this.saveOutboxEvent(manager, canonicalEvent);
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

  /**
   * Helper: Resolve responsible marketing user (PIC primary, fallback to creator with active MARKETING role).
   */
  private async resolveResponsibleMarketingUser(
    manager: EntityManager,
    tender: { marketing_pic_id?: number | null; created_by?: number | null },
  ): Promise<number | null> {
    const candidatePicId = tender.marketing_pic_id ? Number(tender.marketing_pic_id) : null;
    if (candidatePicId) {
      const validPic = await manager.query(
        `SELECT u.id
         FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.id = ?
           AND (u.is_active = 1 OR u.is_active = true)
           AND u.deleted_at IS NULL
           AND r.name = 'MARKETING'
           AND r.deleted_at IS NULL
         LIMIT 1`,
        [candidatePicId],
      );
      if (validPic && validPic.length > 0) {
        return candidatePicId;
      }
    }

    // Fallback to created_by if marketing_pic_id is null
    const candidateCreatorId = tender.created_by ? Number(tender.created_by) : null;
    if (!candidatePicId && candidateCreatorId) {
      const validCreator = await manager.query(
        `SELECT u.id
         FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.id = ?
           AND (u.is_active = 1 OR u.is_active = true)
           AND u.deleted_at IS NULL
           AND r.name = 'MARKETING'
           AND r.deleted_at IS NULL
         LIMIT 1`,
        [candidateCreatorId],
      );
      if (validCreator && validCreator.length > 0) {
        return candidateCreatorId;
      }
    }

    return null;
  }

  /**
   * Helper: Find latest whitelisted meaningful marketing follow-up activity performed by responsible marketing user.
   */
  private async findLatestMeaningfulMarketingActivity(
    manager: EntityManager,
    tenderId: number,
    responsibleUserId: number,
  ): Promise<Date | null> {
    const dates: Date[] = [];

    // 1. Check tender_activities by responsibleUserId with whitelisted content
    const activities = await manager.query(
      `SELECT created_at
       FROM tender_activities
       WHERE tender_id = ?
         AND user_id = ?
         AND (
           content LIKE 'Tender stage changed from %'
           OR content LIKE 'Marketing submitted tender for GO / NO GO review%'
           OR content LIKE 'Marketing resubmitted tender for GO / NO GO review%'
           OR content LIKE 'Dokumen SPK (%) berhasil diunggah%'
           OR content LIKE 'Dokumen revisi SPK (%) berhasil diunggah%'
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenderId, responsibleUserId],
    );
    if (activities && activities.length > 0 && activities[0].created_at) {
      dates.push(new Date(activities[0].created_at));
    }

    // 2. Check tender_price_history changed_by responsibleUserId
    const priceHistories = await manager.query(
      `SELECT created_at
       FROM tender_price_history
       WHERE tender_id = ?
         AND changed_by = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenderId, responsibleUserId],
    );
    if (priceHistories && priceHistories.length > 0 && priceHistories[0].created_at) {
      dates.push(new Date(priceHistories[0].created_at));
    }

    // 3. Check documents created_by responsibleUserId (category = 'PROPOSAL')
    const proposalDocs = await manager.query(
      `SELECT created_at
       FROM documents
       WHERE entity_type = 'TENDER'
         AND entity_id = ?
         AND category = 'PROPOSAL'
         AND created_by = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenderId, responsibleUserId],
    );
    if (proposalDocs && proposalDocs.length > 0 && proposalDocs[0].created_at) {
      dates.push(new Date(proposalDocs[0].created_at));
    }

    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  /**
   * Helper: Find timestamp when tender entered current stage via tender_activities.
   */
  private async findStageEntryDate(
    manager: EntityManager,
    tenderId: number,
    currentStage: string,
  ): Promise<Date | null> {
    const stageActivity = await manager.query(
      `SELECT created_at
       FROM tender_activities
       WHERE tender_id = ?
         AND content LIKE ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenderId, `% to ${currentStage}%`],
    );
    if (stageActivity && stageActivity.length > 0 && stageActivity[0].created_at) {
      return new Date(stageActivity[0].created_at);
    }
    return null;
  }

  /**
   * Phase FOLLOWUP-P1: Daily 09:00 Asia/Jakarta Evaluation of Active Marketing Tenders.
   * Multi-instance safe via MySQL connection-scoped GET_LOCK('epms_marketing_followup_daily_scan', 0).
   * Emits max one Marketing reminder per tender/PIC/day and one Director escalation per 2-calendar-day inactivity cycle.
   */
  @Cron('0 9 * * *', {
    timeZone: 'Asia/Jakarta',
  })
  async handleDailyMarketingFollowUpScan(): Promise<void> {
    const ds = this.getDataSource();
    if (!ds || typeof ds.createQueryRunner !== 'function') {
      this.logger.warn('[FOLLOWUP_SCAN_FAILED] DataSource is not available for advisory lock. Skipping scan.');
      return;
    }

    const lockRunner = ds.createQueryRunner();
    await lockRunner.connect();
    let lockAcquired = false;

    try {
      const lockResult = await lockRunner.query(
        `SELECT GET_LOCK('epms_marketing_followup_daily_scan', 0) AS lock_acquired`
      );
      lockAcquired = lockResult && Number(lockResult[0]?.lock_acquired) === 1;

      if (!lockAcquired) {
        this.logger.warn(
          `[FOLLOWUP_SCAN_SKIPPED_LOCK] Another backend instance holds 'epms_marketing_followup_daily_scan'. Exiting cleanly.`
        );
        return;
      }

      this.logger.log(`[FOLLOWUP_SCAN_STARTED] Acquired advisory lock. Starting daily follow-up evaluation...`);

      // 1. Resolve active Directors ONCE per scan
      let directorIds: number[] = [];
      try {
        const activeDirectors = await lockRunner.query(
          `SELECT DISTINCT u.id
           FROM users u
           JOIN user_roles ur ON u.id = ur.user_id
           JOIN roles r ON r.id = ur.role_id
           WHERE r.name = 'DIRECTOR'
             AND (u.is_active = 1 OR u.is_active = true)
             AND u.deleted_at IS NULL
             AND r.deleted_at IS NULL`
        );
        directorIds = activeDirectors ? activeDirectors.map((d: any) => Number(d.id)) : [];
      } catch (dirErr: any) {
        this.logger.error(`Error resolving DIRECTOR users: ${dirErr?.message}`);
      }

      if (directorIds.length === 0) {
        this.logger.warn(`[FOLLOWUP_NO_DIRECTOR] No active DIRECTOR users found in database.`);
        this.eventEmitter.emit('audit.log', {
          action: 'RECIPIENT_RESOLUTION_FAILED',
          entityName: 'tenders',
          reason: 'FOLLOWUP_NO_DIRECTOR: No active DIRECTOR users found in database.',
        });
      }

      // 2. Query all active non-terminal candidate tenders
      const candidates = await this.tenderRepo
        .createQueryBuilder('tender')
        .leftJoinAndSelect('tender.customer', 'customer')
        .where('tender.status NOT IN (:...terminalStatuses)', { terminalStatuses: ['WON', 'LOST'] })
        .andWhere('tender.stage NOT IN (:...terminalStages)', { terminalStages: ['WON', 'LOST'] })
        .andWhere('tender.deleted_at IS NULL')
        .getMany();

      const actionableCandidates = candidates.filter((c) => {
        const evaluation = evaluateMarketingActionItem(c);
        return evaluation.isActionItem;
      });

      this.logger.log(
        `[FOLLOWUP_ELIGIBLE_COUNT] Found ${actionableCandidates.length} eligible actionable tenders (from ${candidates.length} active).`
      );

      // 3. Process each actionable tender in its own bounded transaction
      for (const candidate of actionableCandidates) {
        try {
          await this.tenderRepo.manager.transaction(async (manager) => {
            // Re-read current tender inside transaction to guard against race condition
            const tender = await manager.findOne(Tender, {
              where: { id: candidate.id },
              relations: ['customer'],
              lock: { mode: 'pessimistic_read' },
            });

            if (
              !tender ||
              ['WON', 'LOST'].includes(String(tender.stage).toUpperCase()) ||
              ['WON', 'LOST'].includes(String(tender.status).toUpperCase())
            ) {
              this.logger.log(
                `[FOLLOWUP_TERMINAL_SKIPPED] Tender #${candidate.id} transitioned to terminal state. Skipping.`
              );
              return;
            }

            const currentEval = evaluateMarketingActionItem(tender);
            if (!currentEval.isActionItem) {
              return;
            }

            // Resolve responsible Marketing user (PIC -> created_by fallback with validation)
            const responsibleUserId = await this.resolveResponsibleMarketingUser(manager, tender);
            if (!responsibleUserId) {
              this.logger.warn(
                `[FOLLOWUP_NO_PIC] No valid Marketing PIC or creator found for Tender #${tender.id}.`
              );
              this.eventEmitter.emit('audit.log', {
                action: 'RECIPIENT_RESOLUTION_FAILED',
                entityId: tender.id,
                entityName: 'tenders',
                reason: `FOLLOWUP_NO_PIC: Tender #${tender.id} has no active marketing_pic_id or active marketing created_by`,
              });
              return;
            }

            // A. Daily Marketing Reminder (Max ONE per tender per PIC per calendar day)
            const jakartaToday = toJakartaDateString();
            const reminderEventId = `marketing-followup:${tender.id}:${responsibleUserId}:${jakartaToday}`;

            const existingReminder = await manager.query(
              `SELECT id FROM outbox_events WHERE event_id = ? LIMIT 1`,
              [reminderEventId]
            );

            if (existingReminder && existingReminder.length > 0) {
              this.logger.debug(
                `[FOLLOWUP_REMINDER_DUPLICATE_SKIPPED] Reminder event ${reminderEventId} already exists.`
              );
            } else {
              const reminderEvent: BusinessEvent = {
                eventId: reminderEventId,
                eventName: 'marketing.tender.followup_reminder',
                eventVersion: 1,
                occurredAt: new Date().toISOString(),
                aggregateType: 'Tender',
                aggregateId: tender.id,
                actor: { userId: null, roles: ['SYSTEM'] },
                routing: { userIds: [responsibleUserId] },
                payload: {
                  tenderId: tender.id,
                  title: tender.title,
                  customerName: tender.customer?.name || 'N/A',
                  stage: tender.stage,
                  conditionType: currentEval.conditionType,
                  reason: currentEval.reason,
                  bidSubmissionDeadline: tender.bid_submission_deadline,
                  daysOverdue: currentEval.daysOverdue,
                  daysRemaining: currentEval.daysRemaining,
                  stuckDays: currentEval.stuckDays,
                },
              };
              await this.saveOutboxEvent(manager, reminderEvent);
              this.logger.log(
                `[FOLLOWUP_REMINDER_EMITTED] Emitted follow-up reminder for Tender #${tender.id} to user #${responsibleUserId}.`
              );
            }

            // B. Director Inactivity Escalation Evaluation (>= 2 calendar days)
            const latestMeaningfulDate = await this.findLatestMeaningfulMarketingActivity(
              manager,
              tender.id,
              responsibleUserId
            );

            let stageEntryDate: Date | null = null;
            if (currentEval.conditionType === MarketingActionConditionType.UPCOMING_DEADLINE) {
              stageEntryDate = await this.findStageEntryDate(manager, tender.id, tender.stage);
            }

            const inactivityRef = calculateInactivityReferenceDate({
              conditionType: currentEval.conditionType!,
              bidSubmissionDeadline: tender.bid_submission_deadline,
              createdAt: tender.created_at || (tender as any).createdAt,
              latestMeaningfulFollowUpDate: latestMeaningfulDate,
              stageEntryDate,
              probabilityZeroProvableDate: null, // Conservative: do not fabricate unproven STUCK reference
            });

            if (inactivityRef) {
              const calendarDaysInactive = diffInJakartaCalendarDays(new Date(), inactivityRef);
              if (calendarDaysInactive >= 2 && directorIds.length > 0) {
                const cycleRefDateStr = toJakartaDateString(inactivityRef);
                const escalationEventId = `marketing-escalation:${tender.id}:${cycleRefDateStr}`;

                const existingEscalation = await manager.query(
                  `SELECT id FROM outbox_events WHERE event_id = ? LIMIT 1`,
                  [escalationEventId]
                );

                if (existingEscalation && existingEscalation.length > 0) {
                  this.logger.debug(
                    `[FOLLOWUP_ESCALATION_DUPLICATE_SKIPPED] Escalation event ${escalationEventId} already exists for cycle ${cycleRefDateStr}.`
                  );
                } else {
                  const picUser = await manager.query(
                    `SELECT full_name FROM users WHERE id = ? LIMIT 1`,
                    [responsibleUserId]
                  );
                  const picFullName =
                    picUser && picUser[0]?.full_name ? picUser[0].full_name : `User #${responsibleUserId}`;

                  const escalationEvent: BusinessEvent = {
                    eventId: escalationEventId,
                    eventName: 'marketing.tender.director_escalation',
                    eventVersion: 1,
                    occurredAt: new Date().toISOString(),
                    aggregateType: 'Tender',
                    aggregateId: tender.id,
                    actor: { userId: null, roles: ['SYSTEM'] },
                    routing: { userIds: directorIds },
                    payload: {
                      tenderId: tender.id,
                      title: tender.title,
                      customerName: tender.customer?.name || 'N/A',
                      picUserId: responsibleUserId,
                      picFullName,
                      stage: tender.stage,
                      conditionType: currentEval.conditionType,
                      reason: currentEval.reason,
                      bidSubmissionDeadline: tender.bid_submission_deadline,
                      lastMeaningfulFollowUp: latestMeaningfulDate ? latestMeaningfulDate.toISOString() : null,
                      calendarDaysInactive,
                      inactivityReferenceDate: cycleRefDateStr,
                    },
                  };
                  await this.saveOutboxEvent(manager, escalationEvent);
                  this.logger.log(
                    `[FOLLOWUP_ESCALATION_EMITTED] Emitted Director escalation for Tender #${tender.id} (${calendarDaysInactive} days inactive).`
                  );
                }
              }
            }
          });
        } catch (tenderErr: any) {
          this.logger.error(
            `Error processing follow-up for Tender #${candidate.id}: ${tenderErr?.message}`,
            tenderErr?.stack
          );
        }
      }

      this.logger.log(`[FOLLOWUP_SCAN_COMPLETED] Daily follow-up scan completed successfully.`);
    } catch (err: any) {
      this.logger.error(`[FOLLOWUP_SCAN_FAILED] Daily follow-up scan encountered an error: ${err?.message}`, err?.stack);
    } finally {
      if (lockAcquired) {
        try {
          await lockRunner.query(`SELECT RELEASE_LOCK('epms_marketing_followup_daily_scan')`);
        } catch (releaseErr: any) {
          this.logger.error(`Failed to release advisory lock: ${releaseErr?.message}`);
        }
      }
      await lockRunner.release();
    }
  }
}

