import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly notificationGateway: NotificationGateway) {}

  @OnEvent('marketing.spk.uploaded')
  handleSpkUploadedEvent(event: any) {
    const payload = event?.payload || event;
    const contractId = payload.contractId || event?.aggregateId;
    if (this.notificationGateway?.server && contractId) {
      this.notificationGateway.server.emit('legal.queue.updated', {
        type: payload.isRevision ? 'REVISED_CONTRACT' : 'NEW_CONTRACT',
        contractId,
        tenderId: payload.tenderId,
        title: payload.title,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Broadcast Socket.io 'legal.queue.updated' sent for SPK upload.`);
    }
  }

  @OnEvent('legal.contract.approved')
  handleContractApprovedEvent(event: any) {
    const payload = event?.payload || event;
    const contractId = payload.contractId || event?.aggregateId;
    this.logger.log(`Event diterima: Legal Contract Approved - Contract ID ${contractId}`);

    if (this.notificationGateway?.server && contractId) {
      this.notificationGateway.server.emit('legal.queue.updated', {
        type: 'CONTRACT_APPROVED',
        contractId,
        legalStatus: payload.legalStatus || 'APPROVED',
        timestamp: new Date().toISOString(),
      });
      this.notificationGateway.server.emit('marketing.tender.management_update', {
        type: 'CONTRACT_APPROVED',
        contractId,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Broadcast Socket.io 'legal.queue.updated' & 'marketing.tender.management_update' sent.`);
    }
  }

  @OnEvent('legal.contract.revision_requested')
  handleContractRevisionRequestedEvent(event: any) {
    const payload = event?.payload || event;
    const contractId = payload.contractId || event?.aggregateId;
    this.logger.log(`Event diterima: Legal Contract Revision Requested - Contract ID ${contractId}`);

    if (this.notificationGateway?.server && contractId) {
      this.notificationGateway.server.emit('legal.queue.updated', {
        type: 'REVISION_REQUESTED',
        contractId,
        legalStatus: payload.legalStatus || 'REVISION_REQUESTED',
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Broadcast Socket.io 'legal.queue.updated' sent for revision request.`);
    }
  }

  @OnEvent('legal.queue.updated')
  handleQueueUpdatedEvent(payload: any) {
    if (this.notificationGateway?.server) {
      this.notificationGateway.server.emit('legal.queue.updated', payload);
    }
  }

  @OnEvent('contract.resubmitted')
  handleContractResubmittedEvent(payload: any) {
    this.logger.log(`Event diterima: Contract Resubmitted to PM - Contract ID ${payload?.contractId}`);

    if (this.notificationGateway?.server) {
      this.notificationGateway.server.emit('marketing.tender.management_update', {
        type: 'CHARTER_RESUBMITTED',
        contractId: payload?.contractId,
        tenderId: payload?.tenderId,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Broadcast Socket.io 'marketing.tender.management_update' sent for Charter Resubmit.`);
    }
  }
}
