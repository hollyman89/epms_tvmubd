import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';
import { ManagementReviewSyncService } from './management-review-sync.service';

@Injectable()
export class ProjectEventListener {
  private readonly logger = new Logger(ProjectEventListener.name);

  constructor(
    private readonly projectService: ProjectService,
    private readonly managementReviewSyncService: ManagementReviewSyncService,
  ) {}

  @OnEvent('finance.payment_processed')
  async handlePaymentProcessed(payload: { invoiceId: number; amount?: number; paymentAmount?: number; poId?: number }) {
    const effectiveAmount = Number(payload.paymentAmount ?? payload.amount ?? 0);
    this.logger.log(`[ProjectEventListener] Payment Processed Event Received: Invoice ${payload.invoiceId}, Amount: ${effectiveAmount}`);
    if (payload.poId) {
      await this.projectService.recalculateWbsBudgetFromPo(payload.poId, effectiveAmount);
    }
  }

  @OnEvent('internal.workflow.task.completed')
  async handleWorkflowTaskCompleted(payload: {
    taskId?: number;
    instanceId?: number;
    action?: string;
    decidedBy?: number;
    fromNode?: string;
    toNode?: string;
    entityType?: string;
    entityId?: number | string;
    comments?: string;
    reason?: string;
  }) {
    if (String(payload?.entityType).toUpperCase() === 'PROJECT') {
      this.logger.log(
        `[ProjectEventListener] internal.workflow.task.completed for PROJECT #${payload.entityId} (Task #${payload.taskId}, Action: ${payload.action}, Node: ${payload.fromNode} -> ${payload.toNode})`,
      );
      try {
        await this.managementReviewSyncService.syncManagementReviewFromWorkflow({
          workflowInstanceId: payload.instanceId,
          taskId: payload.taskId,
          projectId: payload.entityId,
          entityType: payload.entityType,
          fromNode: payload.fromNode,
          toNode: payload.toNode,
          action: payload.action,
          decidedBy: payload.decidedBy,
          decidedAt: new Date(),
          comments: payload.comments || payload.reason,
        });
      } catch (err: any) {
        this.logger.error(`[ProjectEventListener] Failed to sync projection for PROJECT #${payload.entityId}: ${err.message}`, err.stack);
      }
    }
  }
}
