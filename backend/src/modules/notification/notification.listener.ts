import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly notificationGateway: NotificationGateway) {}

  @OnEvent('marketing.tender.won')
  handleTenderWonEvent(payload: { contractId?: number; tenderId: number; customerId?: number; title?: string }) {
    this.logger.log(`🔥 Event diterima: Tender WON - Tender ID ${payload.tenderId}`);

    if (this.notificationGateway?.server && payload.contractId) {
      this.notificationGateway.server.emit('legal.queue.updated', {
        type: 'NEW_CONTRACT',
        contractId: payload.contractId,
        tenderId: payload.tenderId,
        title: payload.title,
        timestamp: new Date().toISOString()
      });
      this.logger.log(`⚡ Broadcast Socket.io 'legal.queue.updated' sent to all connected clients.`);
    }
  }

  @OnEvent('legal.contract.approved')
  handleContractApprovedEvent(payload: any) {
    this.logger.log(`🔥 Event diterima: Legal Contract Approved - Contract ID ${payload.contractId}`);

    if (this.notificationGateway?.server) {
      this.notificationGateway.server.emit('legal.queue.updated', {
        type: 'CONTRACT_APPROVED',
        contractId: payload.contractId,
        legalStatus: payload.legalStatus,
        timestamp: new Date().toISOString()
      });
      this.notificationGateway.server.emit('marketing.tender.management_update', {
        type: 'CONTRACT_APPROVED',
        contractId: payload.contractId,
        timestamp: new Date().toISOString()
      });
      this.logger.log(`⚡ Broadcast Socket.io 'legal.queue.updated' & 'marketing.tender.management_update' sent.`);
    }
  }

  @OnEvent('legal.queue.updated')
  handleQueueUpdatedEvent(payload: any) {
    if (this.notificationGateway?.server) {
      this.notificationGateway.server.emit('legal.queue.updated', payload);
    }
  }

  @OnEvent('project.pm.assigned')
  handleProjectPmAssignedEvent(payload: {
    projectId: number;
    projectCode: string;
    contractId: number;
    projectManagerId: number;
    assignedBy: number;
    status: string;
    timestamp: string;
  }) {
    this.logger.log(`🔥 Event diterima: project.pm.assigned for PM ${payload?.projectManagerId}`);
    if (this.notificationGateway?.server && payload?.projectManagerId) {
      const pmRoom = `room:user:${payload.projectManagerId}`;
      const altRoom = `user:${payload.projectManagerId}`;
      this.notificationGateway.server.to(pmRoom).to(altRoom).emit('project.pm.assigned', payload);
      this.logger.log(`⚡ Targeted Socket.io 'project.pm.assigned' sent strictly to user ${payload.projectManagerId}`);
    }
  }

  @OnEvent('contract.resubmitted')
  handleContractResubmittedEvent(payload: any) {
    this.logger.log(`🔥 Event diterima: Contract Resubmitted to PM - Contract ID ${payload?.contractId}`);

    if (this.notificationGateway?.server) {
      this.notificationGateway.server.emit('marketing.tender.management_update', {
        type: 'CHARTER_RESUBMITTED',
        contractId: payload?.contractId,
        tenderId: payload?.tenderId,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`⚡ Broadcast Socket.io 'marketing.tender.management_update' sent for Charter Resubmit.`);
    }
  }
}
