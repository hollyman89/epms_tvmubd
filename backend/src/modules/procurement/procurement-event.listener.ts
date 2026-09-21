import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProcurementPackageService } from './procurement-package.service';

@Injectable()
export class ProcurementEventListener {
  private readonly logger = new Logger(ProcurementEventListener.name);

  constructor(
    private readonly procurementPackageService: ProcurementPackageService,
  ) {}

  @OnEvent('workflow.instance.completed')
  async handleWorkflowInstanceCompleted(payload: {
    instanceId: number;
    entityType: string;
    entityId: number | string;
    finalStatus: string;
  }): Promise<void> {
    if (
      String(payload?.entityType).toUpperCase() === 'PURCHASE_REQUEST' &&
      String(payload?.finalStatus).toUpperCase() === 'REJECTED'
    ) {
      this.logger.log(
        `⚡ [ProcurementEventListener] Terminal REJECTED event received for PURCHASE_REQUEST #${payload.entityId} (Instance #${payload.instanceId}). Synchronizing linked package...`,
      );
      try {
        await this.procurementPackageService.handlePrRejection(
          Number(payload.entityId),
          Number(payload.instanceId),
        );
      } catch (err: any) {
        this.logger.error(
          `❌ Failed to synchronize package rejection for PR #${payload.entityId}: ${err?.message}`,
          err?.stack,
        );
      }
    }
  }
}
