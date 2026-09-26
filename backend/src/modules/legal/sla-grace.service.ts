import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Contract } from '../../entities/contract.entity';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SlaGraceService {
  private readonly logger = new Logger(SlaGraceService.name);

  constructor(
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 2. Event Listener: Acknowledges 72h SLA grace period initialized when contract status becomes REVISION_REQUESTED
   */
  @OnEvent('legal.contract.revision_requested')
  @OnEvent('contract.revision_requested')
  async handleRevisionRequested(payload: any) {
    const contractId = payload?.payload?.contractId || payload?.contractId;
    this.logger.log(`[Revision SLA] Contract #${contractId} marked REVISION_REQUESTED. 72h SLA grace period active.`);
  }

  /**
   * 3. Core Logic: Request SLA Grace Extension (Enforces Max 3 Limit)
   */
  async requestGraceExtension(contractId: number, daysToAdd: number = 3, userId: number, reason?: string) {
    const contract = await this.contractRepo.findOne({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contract not found');

    const currentCount = Number(contract.grace_extension_count || 0);

    // Enforce Max 3 Extensions Limit
    if (currentCount >= 3) {
      throw new BadRequestException(
        `Batas Maksimal Perpanjangan Grace SLA (3x) telah tercapai untuk Kontrak #${contractId}! Tidak dapat menambah grace period lagi.`
      );
    }

    const now = new Date();
    const currentDeadline = contract.grace_deadline ? new Date(contract.grace_deadline) : now;
    const newDeadline = new Date(currentDeadline.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    await this.contractRepo.manager.transaction(async (manager) => {
      contract.grace_deadline = newDeadline;
      contract.grace_extended_by = userId;
      contract.grace_extended_at = now;
      contract.grace_extension_count = currentCount + 1;

      await manager.save(Contract, contract);

      // Phase N8: Transactional Outbox Canonical Event (replaces legacy notification.send)
      const canonicalEvent: BusinessEvent = {
        eventId: randomUUID(),
        eventName: 'system.sla.grace_extended',
        eventVersion: 1,
        occurredAt: now.toISOString(),
        aggregateType: 'Contract',
        aggregateId: contract.id,
        actor: { userId },
        routing: { userIds: [userId] },
        payload: {
          contractId: contract.id,
          contractNumber: contract.contract_number,
          daysAdded: daysToAdd,
          extensionCount: contract.grace_extension_count,
          newDeadline: newDeadline.toISOString(),
          formattedDeadline: newDeadline.toLocaleDateString('id-ID'),
          extendedBy: userId,
        },
      };

      const outbox = manager.create(OutboxEvent, {
        event_id: canonicalEvent.eventId,
        event_name: canonicalEvent.eventName,
        event_version: String(canonicalEvent.eventVersion),
        aggregate_type: canonicalEvent.aggregateType,
        aggregate_id: Number(canonicalEvent.aggregateId),
        correlation_id: canonicalEvent.correlationId || null,
        payload: {
          occurredAt: canonicalEvent.occurredAt,
          projectId: canonicalEvent.projectId,
          actor: canonicalEvent.actor,
          routing: canonicalEvent.routing,
          notificationPolicy: canonicalEvent.notificationPolicy,
          businessPayload: canonicalEvent.payload,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await manager.save(OutboxEvent, outbox);
    });

    // Audit Log
    this.eventEmitter.emit('audit.log', {
      action: 'SLA_GRACE_EXTENDED',
      entityId: contractId,
      entityName: 'contracts',
      reason: `Grace deadline extended +${daysToAdd} days (Attempt ${contract.grace_extension_count}/3). Reason: ${reason || 'N/A'}`,
      userId,
    });

    return {
      statusCode: 200,
      contractId,
      extensionCount: contract.grace_extension_count,
      maxLimit: 3,
      graceDeadline: newDeadline.toISOString(),
      message: `Perpanjangan Grace SLA ke-${contract.grace_extension_count}/3 berhasil diterapkan (+${daysToAdd} hari).`,
    };
  }

  /**
   * 4. Fetch Active Grace Extensions for Dashboard Widget
   */
  async getActiveGraceExtensions() {
    try {
      const activeContracts = await this.contractRepo.find({
        take: 10
      });

      return activeContracts.map((c) => ({
        contractId: c.id,
        contractNumber: c.contract_number,
        extensionCount: c.grace_extension_count || 0,
        maxLimit: 3,
        graceDeadline: c.grace_deadline || null,
        extendedAt: c.grace_extended_at || null,
        status: c.legal_status || c.status || 'ACTIVE',
      }));
    } catch (e) {
      return [];
    }
  }
}
