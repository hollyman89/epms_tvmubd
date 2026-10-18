import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BusinessEvent } from '../../shared/contracts/business-event.contract';
import { NotificationGateway } from './notification.gateway';

export interface BusinessSyncEnvelope {
  eventId: string;
  eventName: string;
  eventVersion: number;
  occurredAt: string;
  aggregateType: string;
  aggregateId: string | number;
  projectId?: number;
}

const APPROVED_ROLE_SYNC_POLICIES: Record<string, string[]> = {
  'workflow.task.assigned': [], // Uses producer direct routing (assignee user + role)
  'workflow.task.completed': [
    'HEAD_OF_OPERATIONS',
    'GENERAL_MANAGER',
    'PROCUREMENT',
    'PURCHASING',
    'FINANCE',
    'DIRECTOR',
    'PMO',
    'SUPER_ADMIN',
  ],
  'workflow.task.returned': [], // Uses producer direct routing (recipient user + role)
  'workflow.instance.completed': [
    'HEAD_OF_OPERATIONS',
    'GENERAL_MANAGER',
    'DIRECTOR',
    'PMO',
    'SUPER_ADMIN',
    'PROCUREMENT',
    'FINANCE',
  ],
  'project.pm.assigned': ['PMO', 'SUPER_ADMIN'], // In addition to direct user:${pmId} from producer routing
  'project.kickoff.executed': ['PMO', 'SUPER_ADMIN', 'DIRECTOR'],
  'procurement.package.submitted': ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'],
  'procurement.package.returned': ['PROCUREMENT', 'PURCHASING', 'PMO', 'SUPER_ADMIN'],
  'procurement.rfq.created': ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'],
  'procurement.po.issued': ['PROCUREMENT', 'PURCHASING', 'FINANCE', 'SUPER_ADMIN'],
  'procurement.gr.received': ['PROCUREMENT', 'PURCHASING', 'FINANCE', 'SUPER_ADMIN'],
  'procurement.service_claim.submitted': ['PROJECT_MANAGER', 'PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'],
  'procurement.service_claim.pm_verified': ['PROCUREMENT', 'PURCHASING', 'FINANCE', 'SUPER_ADMIN'],
  'procurement.service_claim.approved_for_invoice': ['FINANCE', 'PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'],
  'procurement.service_claim.returned': ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'],
  'procurement.service_claim.rejected': ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'],
  'finance.invoice.created': ['FINANCE', 'SUPER_ADMIN', 'ADMIN'],
  'finance.invoice.verified': ['FINANCE', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN'],
  'finance.invoice.rejected': ['FINANCE', 'SUPER_ADMIN'], // In addition to direct user:${invoice.createdBy}
  'finance.payment.recorded': ['FINANCE', 'DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN'],
};

@Injectable()
export class BusinessSyncConsumer {
  private readonly logger = new Logger(BusinessSyncConsumer.name);

  constructor(private readonly notificationGateway: NotificationGateway) {}

  @OnEvent('workflow.task.assigned')
  handleWorkflowTaskAssigned(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'workflow.task.assigned');
  }

  @OnEvent('workflow.task.completed')
  handleWorkflowTaskCompleted(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'workflow.task.completed');
  }

  @OnEvent('workflow.task.returned')
  handleWorkflowTaskReturned(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'workflow.task.returned');
  }

  @OnEvent('workflow.instance.completed')
  handleWorkflowInstanceCompleted(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'workflow.instance.completed');
  }

  @OnEvent('project.pm.assigned')
  handleProjectPmAssigned(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'project.pm.assigned');
  }

  @OnEvent('project.kickoff.executed')
  handleProjectKickoffExecuted(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'project.kickoff.executed');
  }

  @OnEvent('procurement.package.submitted')
  handleProcurementPackageSubmitted(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'procurement.package.submitted');
  }

  @OnEvent('procurement.package.returned')
  handleProcurementPackageReturned(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'procurement.package.returned');
  }

  @OnEvent('procurement.rfq.created')
  handleProcurementRfqCreated(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'procurement.rfq.created');
  }

  @OnEvent('procurement.po.issued')
  handleProcurementPoIssued(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'procurement.po.issued');
  }

  @OnEvent('procurement.gr.received')
  handleProcurementGrReceived(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'procurement.gr.received');
  }

  @OnEvent('finance.invoice.created')
  handleFinanceInvoiceCreated(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'finance.invoice.created');
  }

  @OnEvent('finance.invoice.verified')
  handleFinanceInvoiceVerified(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'finance.invoice.verified');
  }

  @OnEvent('finance.invoice.rejected')
  handleFinanceInvoiceRejected(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'finance.invoice.rejected');
  }

  @OnEvent('finance.payment.recorded')
  handleFinancePaymentRecorded(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'finance.payment.recorded');
  }

  @OnEvent('procurement.service_claim.submitted')
  handleProcurementServiceClaimSubmitted(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'procurement.service_claim.submitted');
  }

  @OnEvent('procurement.service_claim.pm_verified')
  handleProcurementServiceClaimPmVerified(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'procurement.service_claim.pm_verified');
  }

  @OnEvent('procurement.service_claim.approved_for_invoice')
  handleProcurementServiceClaimApprovedForInvoice(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'procurement.service_claim.approved_for_invoice');
  }

  @OnEvent('procurement.service_claim.returned')
  handleProcurementServiceClaimReturned(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'procurement.service_claim.returned');
  }

  @OnEvent('procurement.service_claim.rejected')
  handleProcurementServiceClaimRejected(event: BusinessEvent): void {
    this.processCanonicalSync(event, 'procurement.service_claim.rejected');
  }

  /**
   * Synchronously process canonical event into a minimal BusinessSyncEnvelope
   * and dispatch to verified socket audience rooms.
   */
  public processCanonicalSync(event: BusinessEvent, expectedEventName: string): void {
    // 1. Strict Validation of Required Canonical Fields
    if (!event || typeof event !== 'object') {
      throw new Error(`[BusinessSyncConsumer] Malformed canonical event: event payload is not an object.`);
    }

    if (!event.eventId || typeof event.eventId !== 'string') {
      throw new Error(`[BusinessSyncConsumer] Missing or invalid 'eventId' on canonical event '${expectedEventName}'.`);
    }

    if (!event.eventName || event.eventName !== expectedEventName) {
      throw new Error(
        `[BusinessSyncConsumer] Event name mismatch: expected '${expectedEventName}', got '${event.eventName}'.`,
      );
    }

    if (event.eventVersion === undefined || event.eventVersion === null || isNaN(Number(event.eventVersion))) {
      throw new Error(`[BusinessSyncConsumer] Missing or invalid 'eventVersion' on canonical event '${event.eventName}'.`);
    }

    if (!event.occurredAt || typeof event.occurredAt !== 'string') {
      throw new Error(`[BusinessSyncConsumer] Missing or invalid 'occurredAt' on canonical event '${event.eventName}'.`);
    }

    if (!event.aggregateType || typeof event.aggregateType !== 'string') {
      throw new Error(`[BusinessSyncConsumer] Missing or invalid 'aggregateType' on canonical event '${event.eventName}'.`);
    }

    if (event.aggregateId === undefined || event.aggregateId === null || event.aggregateId === '') {
      throw new Error(`[BusinessSyncConsumer] Missing or invalid 'aggregateId' on canonical event '${event.eventName}'.`);
    }

    // 2. Validate Sync Audience Policy Exists
    const approvedRoles = APPROVED_ROLE_SYNC_POLICIES[event.eventName];
    if (approvedRoles === undefined) {
      throw new Error(
        `[BusinessSyncConsumer] Configuration defect: No approved sync-audience policy for event '${event.eventName}'.`,
      );
    }

    // 3. Resolve Target Rooms
    const targetRooms = new Set<string>();

    // A. Producer-provided direct routing (user / role)
    if (event.routing) {
      if (Array.isArray(event.routing.userIds)) {
        for (const uid of event.routing.userIds) {
          if (uid !== undefined && uid !== null && !isNaN(Number(uid))) {
            targetRooms.add(`user:${Number(uid)}`);
          }
        }
      }
      if (Array.isArray(event.routing.roles)) {
        for (const role of event.routing.roles) {
          if (typeof role === 'string' && role.trim().length > 0) {
            targetRooms.add(`role:${role.trim().toUpperCase()}`);
          }
        }
      }
    }

    // B. Direct user room for project.kickoff.executed ONLY if managerId is explicitly present in payload
    if (event.eventName === 'project.kickoff.executed' && event.payload && typeof event.payload === 'object') {
      const payloadManagerId = (event.payload as any).managerId;
      if (payloadManagerId !== undefined && payloadManagerId !== null && !isNaN(Number(payloadManagerId))) {
        targetRooms.add(`user:${Number(payloadManagerId)}`);
      }
    }

    // C. Approved Role-Based Sync Audience Policy
    for (const role of approvedRoles) {
      targetRooms.add(`role:${role}`);
    }

    if (targetRooms.size === 0) {
      throw new Error(
        `[BusinessSyncConsumer] Delivery defect: Zero target rooms resolved for canonical event '${event.eventName}' (ID: ${event.eventId}).`,
      );
    }

    // 4. Construct Minimal Sync Envelope (No sensitive internals leaked)
    const envelope: BusinessSyncEnvelope = {
      eventId: event.eventId,
      eventName: event.eventName,
      eventVersion: Number(event.eventVersion),
      occurredAt: event.occurredAt,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId, // Canonical type preserved (number or string)
      ...(event.projectId !== undefined && event.projectId !== null ? { projectId: Number(event.projectId) } : {}),
    };

    // 5. Synchronous Dispatch to Authorized Rooms (Offline sockets do not fail delivery)
    const roomsList = Array.from(targetRooms);
    this.notificationGateway.sendSyncEventToRooms(roomsList, envelope);

    this.logger.debug(
      `Dispatched canonical sync '${envelope.eventName}' (ID: ${envelope.eventId}) to ${roomsList.length} room(s).`,
    );
  }
}
