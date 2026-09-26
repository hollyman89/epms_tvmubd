import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { Tender, TenderStatus, TenderStage } from '../../entities/tender.entity';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { emitLegalQueueUpdated } from '../../shared/helpers/legal-event.helper';

@Injectable()
export class TenderScheduler {
  private readonly logger = new Logger(TenderScheduler.name);

  constructor(
    @InjectRepository(Tender)
    private readonly tenderRepo: Repository<Tender>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
}

